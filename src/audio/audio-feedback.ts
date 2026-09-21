import manifest from '../../data/audio/manifest.json';
import type { SimulationSnapshot } from '../simulation/simulation';
import { deriveAudioCues, type AudioCue } from './audio-events';

const MASTER_GAIN = 0.48;
const AMBIENT_GAIN = 0.018;
const SAMPLE_BASE_GAIN = 0.72;

type AudioManifestEntry = {
  id: string;
  path: string;
  variants?: readonly string[];
};

const AUDIO_ENTRIES = (manifest as { entries: readonly AudioManifestEntry[] }).entries;

export type UnitCommandFeedback = 'SELECT' | 'MOVE' | 'ATTACK_MOVE' | 'ATTACK' | 'HOLD' | 'STOP';

function samplePaths(id: string): readonly string[] {
  const entry = AUDIO_ENTRIES.find((candidate) => candidate.id === id);
  if (!entry || entry.path.includes('://')) return [];
  return [entry.path, ...(entry.variants ?? [])];
}

export class AudioFeedback {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private readonly ambientOscillators: OscillatorNode[] = [];
  private muted = false;
  private lastTick = -1;
  private lastCommandAt = Number.NEGATIVE_INFINITY;
  private lastVoiceAt = Number.NEGATIVE_INFINITY;
  private nextFootstepAt = Number.NEGATIVE_INFINITY;
  private readonly sampleBuffers = new Map<string, AudioBuffer>();
  private readonly sampleCursor = new Map<string, number>();
  private sampleLoadPromise: Promise<void> | null = null;
  private readonly onPointerDown = (): void => { void this.unlock(); };
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'KeyM' && !event.repeat) {
      this.muted = !this.muted;
      this.updateMasterGain();
      if (this.muted) window.speechSynthesis?.cancel();
    }
    void this.unlock();
  };

  constructor() {
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('keydown', this.onKeyDown);
  }

  sync(previous: SimulationSnapshot, current: SimulationSnapshot): void {
    if (current.tick === this.lastTick) return;
    this.lastTick = current.tick;
    if (!this.context || this.context.state !== 'running' || this.muted) return;
    for (const cue of deriveAudioCues(previous, current)) this.playCue(cue);
    this.playMovement(previous, current);
  }

  command(kind: UnitCommandFeedback): void {
    void this.unlock().then(() => {
      if (!this.context || this.context.state !== 'running' || this.muted) return;
      const now = this.context.currentTime;
      if (now - this.lastCommandAt < 0.16) return;
      this.lastCommandAt = now;
      const attack = kind === 'ATTACK' || kind === 'ATTACK_MOVE';
      const sampled = this.playSample('sfx.command.move', attack ? 0.12 : kind === 'SELECT' ? 0.075 : 0.09, attack ? 0.96 : 1.04);
      if (!sampled) {
        this.tone(attack ? 360 : 250, attack ? 520 : 330, 0.075, 'triangle', attack ? 0.14 : 0.09);
        this.noise(attack ? 0.055 : 0.035, attack ? 0.055 : 0.032, attack ? 1800 : 1050, 0.012);
      }
      if (now - this.lastVoiceAt >= 0.85) {
        this.lastVoiceAt = now;
        const voiceId = kind === 'ATTACK'
          ? 'voice.command.attack'
          : kind === 'MOVE' || kind === 'ATTACK_MOVE'
            ? 'voice.command.move'
            : 'voice.command.ready';
        if (!this.playSample(voiceId, 0.18, 1)) this.speakCommand(kind);
      }
    });
  }

  destroy(): void {
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKeyDown);
    for (const oscillator of this.ambientOscillators) {
      try { oscillator.stop(); } catch { /* already stopped */ }
      oscillator.disconnect();
    }
    this.ambientOscillators.length = 0;
    this.ambientGain?.disconnect();
    this.ambientGain = null;
    window.speechSynthesis?.cancel();
    const context = this.context;
    this.context = null;
    this.masterGain = null;
    if (context && context.state !== 'closed') void context.close();
  }

  private async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      this.updateMasterGain();
    }
    if (this.context.state === 'suspended') await this.context.resume();
    this.startAmbient();
    void this.preloadSamples();
  }

  private startAmbient(): void {
    const context = this.context;
    const master = this.masterGain;
    if (!context || !master || this.ambientOscillators.length > 0) return;
    this.ambientGain = context.createGain();
    this.ambientGain.gain.setValueAtTime(AMBIENT_GAIN, context.currentTime);
    this.ambientGain.connect(master);
    for (const [frequency, detune] of [[55, -4], [82.5, 5]] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.detune.setValueAtTime(detune, context.currentTime);
      oscillator.connect(this.ambientGain);
      oscillator.start();
      this.ambientOscillators.push(oscillator);
    }
  }

  private updateMasterGain(): void {
    if (!this.context || !this.masterGain) return;
    const value = this.muted ? 0 : MASTER_GAIN;
    this.masterGain.gain.setTargetAtTime(value, this.context.currentTime, 0.012);
  }

  private playCue(cue: AudioCue): void {
    const strength = 1 + (cue.intensity - 1) * 0.18;
    switch (cue.id) {
      case 'sfx.combat.attack':
        this.playSample('sfx.combat.attack', 0.16 * strength, 0.98);
        this.tone(510, 190, 0.10, 'triangle', 0.15 * strength);
        break;
      case 'sfx.combat.hit':
        this.playSample('sfx.combat.hit', 0.28 * strength, 0.98);
        this.tone(205, 72, 0.11, 'triangle', 0.16 * strength);
        break;
      case 'sfx.combat.structure-hit':
        this.playSample('sfx.combat.structure-hit', 0.36 * strength, 0.9);
        this.tone(118, 42, 0.22, 'sine', 0.30 * strength);
        this.noise(0.12, 0.11 * strength, 720, 0.004);
        break;
      case 'sfx.combat.death':
        this.playSample('sfx.combat.death', 0.25 * strength, 0.84);
        this.tone(130, 38, 0.30, 'sine', 0.24 * strength);
        break;
      case 'sfx.element.fire-ignite':
        this.tone(290, 92, 0.2, 'sawtooth', 0.28 * strength);
        this.tone(520, 155, 0.16, 'triangle', 0.18 * strength, 0.025);
        break;
      case 'sfx.element.water-burst':
        this.tone(430, 155, 0.24, 'sine', 0.31 * strength);
        this.tone(720, 240, 0.18, 'triangle', 0.18 * strength, 0.018);
        this.tone(190, 92, 0.28, 'sine', 0.16 * strength, 0.035);
        break;
      case 'sfx.element.ice-form':
        this.tone(980, 360, 0.34, 'sine', 0.36 * strength);
        this.tone(1460, 620, 0.25, 'triangle', 0.23 * strength, 0.028);
        this.tone(620, 280, 0.3, 'sine', 0.16 * strength, 0.055);
        break;
      case 'sfx.element.ice-break':
        this.tone(520, 105, 0.22, 'square', 0.32 * strength);
        this.tone(240, 58, 0.28, 'triangle', 0.22 * strength, 0.022);
        break;
      case 'sfx.element.lightning-chain':
        this.tone(1760, 125, 0.19, 'sawtooth', 0.43 * strength);
        this.tone(920, 160, 0.23, 'square', 0.28 * strength, 0.015);
        this.tone(2380, 460, 0.12, 'triangle', 0.22 * strength, 0.035);
        break;
    }
  }

  private playMovement(previous: SimulationSnapshot, current: SimulationSnapshot): void {
    const context = this.context;
    if (!context || context.currentTime < this.nextFootstepAt) return;
    const previousById = new Map(previous.entities.map((entity) => [entity.id, entity]));
    const moving = current.entities.reduce((count, entity) => {
      const prior = previousById.get(entity.id);
      if (
        !prior
        || !entity.alive
        || entity.playerId !== 0
        || !entity.visibleToPlayer
        || entity.frozenTicks > 0
        || (entity.x === prior.x && entity.z === prior.z)
      ) return count;
      return count + 1;
    }, 0);
    if (moving === 0) return;

    const gain = 0.045 + Math.min(0.07, Math.max(0, moving - 1) * 0.012);
    const rate = 0.94 + ((current.tick + moving) % 5) * 0.025;
    if (this.playSample('sfx.movement.footstep', gain, rate)) {
      this.nextFootstepAt = context.currentTime + (moving >= 5 ? 0.24 : moving >= 2 ? 0.29 : 0.34);
    }
  }

  private async preloadSamples(): Promise<void> {
    const context = this.context;
    if (!context) return;
    if (this.sampleLoadPromise) return this.sampleLoadPromise;

    const paths = [...new Set([
      ...samplePaths('sfx.combat.attack'),
      ...samplePaths('sfx.combat.hit'),
      ...samplePaths('sfx.combat.death'),
      ...samplePaths('sfx.combat.structure-hit'),
      ...samplePaths('sfx.command.move'),
      ...samplePaths('sfx.movement.footstep'),
      ...samplePaths('voice.command.move'),
      ...samplePaths('voice.command.attack'),
      ...samplePaths('voice.command.ready'),
    ])];

    this.sampleLoadPromise = Promise.all(paths.map(async (path) => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
        if (!response.ok) return;
        const data = await response.arrayBuffer();
        const decoded = await context.decodeAudioData(data);
        if (this.context === context) this.sampleBuffers.set(path, decoded);
      } catch {
        // Procedural layers remain as a safe fallback when a sample cannot load.
      }
    })).then(() => undefined);
    return this.sampleLoadPromise;
  }

  private playSample(id: string, level: number, playbackRate = 1, delay = 0): boolean {
    const context = this.context;
    const master = this.masterGain;
    if (!context || !master || context.state !== 'running') return false;
    const paths = samplePaths(id);
    if (paths.length === 0) return false;

    const startIndex = this.sampleCursor.get(id) ?? 0;
    let path: string | null = null;
    let buffer: AudioBuffer | null = null;
    for (let offset = 0; offset < paths.length; offset += 1) {
      const candidate = paths[(startIndex + offset) % paths.length]!;
      const loaded = this.sampleBuffers.get(candidate);
      if (loaded) {
        path = candidate;
        buffer = loaded;
        this.sampleCursor.set(id, (startIndex + offset + 1) % paths.length);
        break;
      }
    }
    if (!path || !buffer) return false;

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, context.currentTime + delay);
    gain.gain.setValueAtTime(Math.max(0.0001, level * SAMPLE_BASE_GAIN), context.currentTime + delay);
    source.connect(gain);
    gain.connect(master);
    source.start(context.currentTime + delay);
    source.addEventListener('ended', () => {
      source.disconnect();
      gain.disconnect();
    }, { once: true });
    return true;
  }

  private speakCommand(kind: UnitCommandFeedback): void {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    const phrase: Readonly<Record<UnitCommandFeedback, string>> = {
      SELECT: 'Ready.',
      MOVE: 'Moving.',
      ATTACK_MOVE: 'Advancing.',
      ATTACK: 'Engaging.',
      HOLD: 'Holding.',
      STOP: 'Stopping.',
    };
    const utterance = new SpeechSynthesisUtterance(phrase[kind]);
    utterance.volume = 0.16;
    utterance.rate = 1.08;
    utterance.pitch = 0.82;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  private noise(duration: number, level: number, cutoff: number, delay = 0): void {
    const context = this.context;
    const master = this.masterGain;
    if (!context || !master || context.state !== 'running') return;
    const sampleRate = context.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      const raw = Math.sin((index + 1) * 12.9898) * 43758.5453;
      data[index] = ((raw - Math.floor(raw)) * 2 - 1) * (1 - index / frameCount);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, context.currentTime);
    gain.gain.setValueAtTime(level, context.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(context.currentTime + delay);
    source.stop(context.currentTime + delay + duration + 0.01);
    source.addEventListener('ended', () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    }, { once: true });
  }

  private tone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType,
    level: number,
    delay = 0,
  ): void {
    const context = this.context;
    const master = this.masterGain;
    if (!context || !master || context.state !== 'running') return;

    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const start = context.currentTime + delay;
    const attackEnd = start + Math.min(0.012, duration * 0.2);
    const end = start + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, startFrequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), end);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), attackEnd);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      envelope.disconnect();
    }, { once: true });
  }
}
