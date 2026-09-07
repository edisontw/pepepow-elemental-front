import type { SimulationSnapshot } from '../simulation/simulation';
import { deriveAudioCues, type AudioCue } from './audio-events';

const MASTER_GAIN = 0.22;

export class AudioFeedback {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
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
  }

  private updateMasterGain(): void {
    if (!this.context || !this.masterGain) return;
    const value = this.muted ? 0 : MASTER_GAIN;
    this.masterGain.gain.setTargetAtTime(value, this.context.currentTime, 0.012);
  }

  private playCue(cue: AudioCue): void {
    const strength = 1 + (cue.intensity - 1) * 0.16;
    switch (cue.id) {
      case 'sfx.combat.hit':
        this.tone(160, 85, 0.055, 'triangle', 0.24 * strength);
        break;
      case 'sfx.combat.death':
        this.tone(118, 44, 0.22, 'sawtooth', 0.32 * strength);
        this.tone(72, 38, 0.25, 'sine', 0.2 * strength, 0.015);
        break;
      case 'sfx.element.fire-ignite':
        this.tone(250, 105, 0.12, 'sawtooth', 0.2 * strength);
        this.tone(430, 170, 0.09, 'triangle', 0.12 * strength, 0.02);
        break;
      case 'sfx.element.ice-form':
        this.tone(820, 430, 0.19, 'sine', 0.23 * strength);
        this.tone(1120, 650, 0.14, 'sine', 0.12 * strength, 0.025);
        break;
      case 'sfx.element.ice-break':
        this.tone(365, 105, 0.11, 'square', 0.19 * strength);
        this.tone(185, 72, 0.17, 'triangle', 0.13 * strength, 0.018);
        break;
      case 'sfx.element.lightning-chain':
        this.tone(1320, 125, 0.095, 'sawtooth', 0.3 * strength);
        this.tone(690, 185, 0.12, 'square', 0.16 * strength, 0.012);
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
    const attackEnd = start + Math.min(0.009, duration * 0.2);
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
