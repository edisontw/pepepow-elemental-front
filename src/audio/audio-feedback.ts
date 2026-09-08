import type { SimulationSnapshot } from '../simulation/simulation';
import { deriveAudioCues, type AudioCue } from './audio-events';

const MASTER_GAIN = 0.48;
const AMBIENT_GAIN = 0.018;

export class AudioFeedback {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private readonly ambientOscillators: OscillatorNode[] = [];
  private muted = false;
  private lastTick = -1;
  private readonly onPointerDown = (): void => { void this.unlock(); };
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'KeyM' && !event.repeat) {
      this.muted = !this.muted;
      this.updateMasterGain();
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
        this.tone(540, 230, 0.11, 'triangle', 0.3 * strength);
        this.tone(310, 155, 0.08, 'square', 0.13 * strength, 0.018);
        break;
      case 'sfx.combat.hit':
        this.tone(210, 78, 0.13, 'triangle', 0.34 * strength);
        break;
      case 'sfx.combat.death':
        this.tone(155, 42, 0.34, 'sawtooth', 0.42 * strength);
        this.tone(82, 34, 0.38, 'sine', 0.27 * strength, 0.02);
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
