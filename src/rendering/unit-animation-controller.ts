import * as pc from 'playcanvas';
import {
  isOneShotAnimationState,
  resolveUnitAnimationState,
  unitAnimationProfile,
  type UnitAnimationIntent,
  type UnitAnimationProfile,
  type UnitAnimationState,
} from './unit-animation-profile';

interface ContainerAnimationAssetLike {
  resource?: pc.AnimTrack | null;
}

interface ContainerResourceWithAnimations {
  animations?: readonly ContainerAnimationAssetLike[];
}

const STATE_PRIORITY: Readonly<Record<UnitAnimationState, number>> = {
  IDLE: 0,
  MOVE: 1,
  ATTACK: 2,
  CAST: 2,
  HIT: 3,
  DEATH: 4,
};

function normalizedTrackName(value: string): string {
  const segments = value.split(/[|/:\\]/g);
  return (segments.at(-1) ?? value).trim().toLowerCase();
}

function animationTracks(resource: unknown): readonly pc.AnimTrack[] {
  const container = resource as ContainerResourceWithAnimations | null | undefined;
  return (container?.animations ?? [])
    .map((animation) => animation.resource)
    .filter((track): track is pc.AnimTrack => Boolean(track));
}

/** Presentation-only GLB clip controller. It never mutates authoritative state. */
export class UnitAnimationController {
  private modelId = '';
  private modelRoot: pc.Entity | null = null;
  private profile: UnitAnimationProfile = unitAnimationProfile('');
  private availableStates = new Set<UnitAnimationState>();
  private currentState: UnitAnimationState | null = null;
  private activeOneShot: UnitAnimationState | null = null;
  private readonly lastTriggerTick = new Map<UnitAnimationState, number>();
  private ownsAnimComponent = false;

  constructor(private readonly app: pc.Application) {}

  sync(modelId: string, modelRoot: pc.Entity | null, intent: UnitAnimationIntent): void {
    this.ensureBound(modelId, modelRoot);
    const anim = this.modelRoot?.anim;
    const layer = anim?.baseLayer;
    if (!anim || !layer || this.availableStates.size === 0) return;

    if (intent.dead) {
      this.transitionTo('DEATH');
      this.activeOneShot = null;
      return;
    }

    const requested = resolveUnitAnimationState(intent);
    const requestedIsOneShot = isOneShotAnimationState(requested);
    const isNewTrigger = requestedIsOneShot && this.lastTriggerTick.get(requested) !== intent.tick;

    if (
      requestedIsOneShot
      && isNewTrigger
      && this.availableStates.has(requested)
      && (this.activeOneShot === null || STATE_PRIORITY[requested] >= STATE_PRIORITY[this.activeOneShot])
    ) {
      this.lastTriggerTick.set(requested, intent.tick);
      this.activeOneShot = requested;
      this.transitionTo(requested);
      return;
    }

    if (this.activeOneShot !== null) {
      if (!this.oneShotComplete()) return;
      this.activeOneShot = null;
    }

    const locomotionState: UnitAnimationState = intent.moving && !intent.frozen ? 'MOVE' : 'IDLE';
    const fallbackState = this.availableStates.has(locomotionState)
      ? locomotionState
      : this.availableStates.has('IDLE')
        ? 'IDLE'
        : null;
    if (fallbackState === null) return;

    anim.speed = fallbackState === 'MOVE'
      ? pc.math.clamp(intent.movePlaybackRate ?? 1, 0.72, 1.35)
      : 1;
    this.transitionTo(fallbackState);
  }

  hasClip(state: UnitAnimationState): boolean {
    return this.availableStates.has(state);
  }

  get hasAnyClip(): boolean {
    return this.availableStates.size > 0;
  }

  get state(): UnitAnimationState | null {
    return this.currentState;
  }

  get normalizedActionProgress(): number {
    const layer = this.modelRoot?.anim?.baseLayer;
    if (!layer || !this.currentState || !isOneShotAnimationState(this.currentState)) return 0;
    const duration = Math.max(0.0001, layer.activeStateDuration);
    return pc.math.clamp(layer.activeStateCurrentTime / duration, 0, 1);
  }

  destroy(): void {
    if (this.modelRoot && this.ownsAnimComponent && this.modelRoot.anim) {
      this.modelRoot.removeComponent('anim');
    }
    this.modelId = '';
    this.modelRoot = null;
    this.availableStates.clear();
    this.currentState = null;
    this.activeOneShot = null;
    this.lastTriggerTick.clear();
    this.ownsAnimComponent = false;
  }

  private ensureBound(modelId: string, modelRoot: pc.Entity | null): void {
    if (!modelRoot || !modelId) return;
    if (this.modelRoot === modelRoot && this.modelId === modelId && this.availableStates.size > 0) return;

    if (this.modelRoot !== modelRoot || this.modelId !== modelId) this.resetBinding();

    const asset = this.app.assets.find(modelId, 'container');
    const tracks = animationTracks(asset?.resource);
    if (tracks.length === 0) return;

    this.modelId = modelId;
    this.modelRoot = modelRoot;
    this.profile = unitAnimationProfile(modelId);
    if (!modelRoot.anim) {
      modelRoot.addComponent('anim', { activate: false, speed: 1 });
      this.ownsAnimComponent = true;
    }
    const anim = modelRoot.anim;
    if (!anim) return;

    const states: readonly UnitAnimationState[] = ['IDLE', 'MOVE', 'ATTACK', 'CAST', 'HIT', 'DEATH'];
    for (const state of states) {
      const clipName = this.profile.clips[state];
      if (!clipName) continue;
      const targetName = clipName.trim().toLowerCase();
      const track = tracks.find((candidate) => {
        const normalized = normalizedTrackName(candidate.name);
        return normalized === targetName || normalized.endsWith(targetName);
      });
      if (!track) continue;
      anim.assignAnimation(
        clipName,
        track,
        undefined,
        this.profile.playbackSpeed[state] ?? 1,
        state === 'IDLE' || state === 'MOVE',
      );
      this.availableStates.add(state);
    }

    if (this.availableStates.has('IDLE')) this.transitionTo('IDLE', true);
    else if (this.availableStates.has('MOVE')) this.transitionTo('MOVE', true);
  }

  private transitionTo(state: UnitAnimationState, force = false): void {
    if (!this.modelRoot?.anim || !this.availableStates.has(state)) return;
    if (!force && this.currentState === state) return;
    const clipName = this.profile.clips[state];
    if (!clipName) return;
    this.modelRoot.anim.speed = this.profile.playbackSpeed[state] ?? 1;
    this.modelRoot.anim.baseLayer?.transition(clipName, force ? 0 : (this.profile.transitionSeconds[state] ?? 0.08));
    this.modelRoot.anim.playing = true;
    this.currentState = state;
  }

  private oneShotComplete(): boolean {
    const layer = this.modelRoot?.anim?.baseLayer;
    if (!layer) return true;
    const duration = layer.activeStateDuration;
    return duration <= 0 || layer.activeStateCurrentTime >= duration - 0.015;
  }

  private resetBinding(): void {
    if (this.modelRoot && this.ownsAnimComponent && this.modelRoot.anim) {
      this.modelRoot.removeComponent('anim');
    }
    this.modelId = '';
    this.modelRoot = null;
    this.availableStates.clear();
    this.currentState = null;
    this.activeOneShot = null;
    this.lastTriggerTick.clear();
    this.ownsAnimComponent = false;
  }
}
