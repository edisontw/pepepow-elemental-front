import manifest from '../../data/audio/manifest.json';
import type { SimulationSnapshot } from '../simulation/simulation';
import { deriveAudioCues, type AudioCue } from './audio-events';

const MASTER_GAIN = 0.48;
const AMBIENT_GAIN = 0.012;
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
  private ambientSampleGain: GainNode | null = null;
  private readonly ambientOscillators: OscillatorNode[] = [];
  private readonly ambientSources: AudioBufferSourceNode[] = [];
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
          : kind === 'ATTACK_MOVE'
            ? 'voice.command.attack-move'
            : kind === 'MOVE'
              ? 'voice.command.move'
              : kind === 'HOLD'
                ? 'voice.command.hold'
                : kind === 'SELECT'
                  ? 'voice.command.ready'
                  : null;
        if (voiceId) {
          if (!this.playVoiceSample(voiceId, 0.22, 1)) this.speakCommand(kind);
        } else if (kind === 'STOP') {
          this.radioClick(0.7);
        }
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
    for (const source of this.ambientSources) {
      try { source.stop(); } catch { /* already stopped */ }
      source.disconnect();
    }
    this.ambientSources.length = 0;
    this.ambientGain?.disconnect();
    this.ambientGain = null;
    this.ambientSampleGain?.disconnect();
    this.ambientSampleGain = null;
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
        this.playSample('sfx.element.fire-ignite', 0.27 * strength, 0.98);
        this.tone(310, 96, 0.18, 'sawtooth', 0.16 * strength);
        this.noise(0.12, 0.07 * strength, 1750, 0.012);
        break;
      case 'sfx.element.water-burst':
        this.playSample('sfx.element.water-burst', 0.31 * strength, 0.96);
        this.tone(390, 138, 0.22, 'sine', 0.16 * strength);
        this.tone(680, 220, 0.15, 'triangle', 0.10 * strength, 0.018);
        break;
      case 'sfx.element.ice-form':
        this.playSample('sfx.element.ice-form', 0.23 * strength, 1.12);
        this.tone(1040, 430, 0.30, 'sine', 0.22 * strength);
        this.tone(1540, 690, 0.22, 'triangle', 0.14 * strength, 0.028);
        break;
      case 'sfx.element.ice-break':
        this.playSample('sfx.element.ice-break', 0.31 * strength, 0.92);
        this.tone(480, 96, 0.20, 'square', 0.18 * strength);
        this.noise(0.09, 0.08 * strength, 3100, 0.01);
        break;
      case 'sfx.element.lightning-chain':
        this.playSample('sfx.element.lightning-chain', 0.28 * strength, 1.04);
        this.tone(1820, 145, 0.17, 'sawtooth', 0.31 * strength);
        this.tone(960, 180, 0.20, 'square', 0.18 * strength, 0.012);
        this.noise(0.07, 0.08 * strength, 5200, 0.018);
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
      ...samplePaths('sfx.element.fire-ignite'),
      ...samplePaths('sfx.element.water-burst'),
      ...samplePaths('sfx.element.ice-form'),
      ...samplePaths('sfx.element.ice-break'),
      ...samplePaths('sfx.element.lightning-chain'),
      ...samplePaths('sfx.command.move'),
      ...samplePaths('sfx.movement.footstep'),
      ...samplePaths('ambience.battlefield.low'),
      ...samplePaths('ambience.battlefield.industry'),
      ...samplePaths('voice.command.move'),
      ...samplePaths('voice.command.attack-move'),
      ...samplePaths('voice.command.attack'),
      ...samplePaths('voice.command.hold'),
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
    })).then(() => {
      if (this.context === context) this.startAmbientSamples();
    });
    return this.sampleLoadPromise;
  }

  private startAmbientSamples(): void {
    const context = this.context;
    const master = this.masterGain;
    if (!context || !master || context.state !== 'running' || this.ambientSources.length > 0) return;

    this.ambientSampleGain = context.createGain();
    this.ambientSampleGain.gain.setValueAtTime(1, context.currentTime);
    this.ambientSampleGain.connect(master);

    for (const [id, level, playbackRate] of [
      ['ambience.battlefield.low', 0.030, 1],
      ['ambience.battlefield.industry', 0.012, 0.94],
    ] as const) {
      const path = samplePaths(id).find((candidate) => this.sampleBuffers.has(candidate));
      if (!path) continue;
      const buffer = this.sampleBuffers.get(path)!;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.setValueAtTime(playbackRate, context.currentTime);
      gain.gain.setValueAtTime(level * SAMPLE_BASE_GAIN, context.currentTime);
      source.connect(gain);
      gain.connect(this.ambientSampleGain);
      source.start();
      source.addEventListener('ended', () => gain.disconnect(), { once: true });
      this.ambientSources.push(source);
    }
  }

  private playVoiceSample(id: string, level: number, playbackRate = 1): boolean {
    const context = this.context;
    const master = this.masterGain;
    if (!context || !master || context.state !== 'running') return false;
    const paths = samplePaths(id);
    if (paths.length === 0) return false;

    const startIndex = this.sampleCursor.get(id) ?? 0;
    let buffer: AudioBuffer | null = null;
    for (let offset = 0; offset < paths.length; offset += 1) {
      const candidate = paths[(startIndex + offset) % paths.length]!;
      const loaded = this.sampleBuffers.get(candidate);
      if (loaded) {
        buffer = loaded;
        this.sampleCursor.set(id, (startIndex + offset + 1) % paths.length);
        break;
      }
    }
    if (!buffer) return false;

    const start = context.currentTime + 0.018;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const compressor = context.createDynamicsCompressor();
    const gain = context.createGain();

    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, start);
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(240, start);
    highpass.Q.setValueAtTime(0.7, start);
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(3800, start);
    lowpass.Q.setValueAtTime(0.85, start);
    compressor.threshold.setValueAtTime(-26, start);
    compressor.knee.setValueAtTime(12, start);
    compressor.ratio.setValueAtTime(5, start);
    compressor.attack.setValueAtTime(0.004, start);
    compressor.release.setValueAtTime(0.12, start);
    gain.gain.setValueAtTime(Math.max(0.0001, level * SAMPLE_BASE_GAIN), start);

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(gain);
    gain.connect(master);

    this.duckAmbience(0.58);
    this.radioClick(1);
    source.start(start);
    source.addEventListener('ended', () => {
      source.disconnect();
      highpass.disconnect();
      lowpass.disconnect();
      compressor.disconnect();
      gain.disconnect();
    }, { once: true });
    return true;
  }

  private duckAmbience(duration: number): void {
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    if (this.ambientSampleGain) {
      this.ambientSampleGain.gain.cancelScheduledValues(now);
      this.ambientSampleGain.gain.setTargetAtTime(0.42, now, 0.015);
      this.ambientSampleGain.gain.setTargetAtTime(1, now + duration, 0.12);
    }
    if (this.ambientGain) {
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setTargetAtTime(AMBIENT_GAIN * 0.45, now, 0.015);
      this.ambientGain.gain.setTargetAtTime(AMBIENT_GAIN, now + duration, 0.12);
    }
  }

  private radioClick(strength: number): void {
    this.noise(0.028, 0.022 * strength, 4200);
    this.tone(1180, 760, 0.024, 'square', 0.025 * strength, 0.004);
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
