import type { TickFrame } from '../simulation/fixed-tick-runner';

export class DebugOverlay {
  private frameCount = 0;
  private elapsed = 0;
  private fps = 0;
  private latestTick: TickFrame | null = null;
  private selectedCount = 0;

  constructor(private readonly element: HTMLElement) {}

  update(deltaSeconds: number, tickFrame: TickFrame, selectedCount: number): void {
    this.frameCount += 1;
    this.elapsed += deltaSeconds;
    this.latestTick = tickFrame;
    this.selectedCount = selectedCount;
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
      <div class="debug-title">M01 UNIT CONTROL</div>
      <div class="debug-row"><span>renderer</span><b class="debug-ok">ONLINE · ${this.fps} FPS</b></div>
      <div class="debug-row"><span>simulation</span><b class="debug-ok">ONLINE · 10 Hz</b></div>
      <div class="debug-row"><span>sim tick</span><b>${snapshot.tick}</b></div>
      <div class="debug-row"><span>entities</span><b>${snapshot.entities.length}</b></div>
      <div class="debug-row"><span>selected</span><b>${this.selectedCount}</b></div>
      <div class="debug-row"><span>state hash</span><b>${snapshot.stateHash}</b></div>
      <div class="debug-row"><span>commands</span><b>${snapshot.queuedCommandCount} queued</b></div>
      <div class="debug-row"><span>interpolation</span><b>${interpolationAlpha.toFixed(2)}</b></div>
    `;
  }
}
