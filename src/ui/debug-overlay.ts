import type { TickFrame } from '../simulation/fixed-tick-runner';

export class DebugOverlay {
  private frameCount = 0;
  private elapsed = 0;
  private fps = 0;
  private latestTick: TickFrame | null = null;

  constructor(private readonly element: HTMLElement) {}

  update(deltaSeconds: number, tickFrame: TickFrame): void {
    this.frameCount += 1;
    this.elapsed += deltaSeconds;
    this.latestTick = tickFrame;
    if (this.elapsed < 0.25) return;
    this.fps = Math.round(this.frameCount / this.elapsed);
    this.frameCount = 0;
    this.elapsed = 0;
    this.render();
  }

  private render(): void {
    if (!this.latestTick) return;
    const { snapshot, interpolationAlpha } = this.latestTick;
    this.element.innerHTML = `
      <div class="debug-title">M00 SYSTEM SHELL</div>
      <div class="debug-row"><span>renderer</span><b class="debug-ok">ONLINE · ${this.fps} FPS</b></div>
      <div class="debug-row"><span>simulation</span><b class="debug-ok">ONLINE · 10 Hz</b></div>
      <div class="debug-row"><span>sim tick</span><b>${snapshot.tick}</b></div>
      <div class="debug-row"><span>sim time</span><b>${(snapshot.elapsedMs / 1000).toFixed(1)} s</b></div>
      <div class="debug-row"><span>interpolation</span><b>${interpolationAlpha.toFixed(2)}</b></div>
      <div class="debug-row"><span>rng state</span><b>${snapshot.rngState.toString(16).padStart(8, '0')}</b></div>
      <div class="debug-row"><span>assets</span><b class="debug-ok">MANIFEST READY</b></div>
    `;
  }
}
