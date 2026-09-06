import type { TickFrame } from '../simulation/fixed-tick-runner';
import type { EntitySnapshot } from '../simulation/simulation';

export function formatSelectedUnitState(units: readonly EntitySnapshot[]): string {
  if (units.length === 0) return 'NONE';
  const unit = units[0]!;
  const order = unit.attackTargetEntityId !== null
    ? `ATTACK#${unit.attackTargetEntityId}`
    : unit.targetX !== null && unit.targetZ !== null ? 'MOVE' : 'IDLE';
  const statuses = [
    unit.wet ? 'WET' : '',
    unit.frozenTicks > 0 ? 'FROZEN' : unit.chilledTicks > 0 ? 'CHILLED' : '',
  ].filter(Boolean).join(' ');
  const remainder = units.length > 1 ? ` +${units.length - 1}` : '';
  return `#${unit.id} ${unit.archetype} ${unit.currentHealth}/${unit.maxHealth}HP ${order}${statuses ? ` ${statuses}` : ''}${remainder}`;
}

export class DebugOverlay {
  private frameCount = 0;
  private elapsed = 0;
  private fps = 0;
  private latestTick: TickFrame | null = null;
  private selectedUnits: readonly EntitySnapshot[] = [];

  constructor(private readonly element: HTMLElement) {}

  update(deltaSeconds: number, tickFrame: TickFrame, selectedUnits: readonly EntitySnapshot[]): void {
    this.frameCount += 1;
    this.elapsed += deltaSeconds;
    this.latestTick = tickFrame;
    this.selectedUnits = selectedUnits;
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
      <div class="debug-title">M01 ELEMENTAL COMBAT</div>
      <div class="debug-row"><span>renderer</span><b class="debug-ok">ONLINE · ${this.fps} FPS</b></div>
      <div class="debug-row"><span>simulation</span><b class="debug-ok">ONLINE · 10 Hz</b></div>
      <div class="debug-row"><span>sim tick</span><b>${snapshot.tick}</b></div>
      <div class="debug-row"><span>entities</span><b>${snapshot.entities.length}</b></div>
      <div class="debug-row"><span>player alive</span><b>${snapshot.entities.filter((entity) => entity.alive && entity.playerId === 0).length}</b></div>
      <div class="debug-row"><span>enemy alive</span><b>${snapshot.entities.filter((entity) => entity.alive && entity.playerId !== 0).length}</b></div>
      <div class="debug-row"><span>nav version</span><b>${snapshot.navVersion}</b></div>
      <div class="debug-row"><span>nav dirty</span><b>${snapshot.navDirty ? 'DIRTY' : 'CLEAN'}</b></div>
      <div class="debug-row"><span>water / ice</span><b>${snapshot.terrain.water} / ${snapshot.terrain.ice}</b></div>
      <div class="debug-row"><span>freezable water</span><b>${snapshot.terrain.freezableWater}</b></div>
      <div class="debug-row"><span>forest fire</span><b>${snapshot.terrain.burning} burning / ${snapshot.terrain.consumedVegetation} consumed</b></div>
      <div class="debug-row"><span>wet units</span><b>${snapshot.wetUnitCount}</b></div>
      <div class="debug-row"><span>chilled / frozen</span><b>${snapshot.chilledUnitCount} / ${snapshot.frozenUnitCount}</b></div>
      <div class="debug-row"><span>fog V / E / U</span><b>${snapshot.visibility.visible} / ${snapshot.visibility.explored} / ${snapshot.visibility.unexplored}</b></div>
      <div class="debug-row"><span>last terrain cast</span><b>${snapshot.lastTerrainEffect ?? 'NONE'}</b></div>
      <div class="debug-row"><span>last lightning</span><b>${snapshot.lastLightningChain.join(' → ') || 'NONE'}</b></div>
      <div class="debug-row"><span>attack orders</span><b>${snapshot.activeAttackOrders}</b></div>
      <div class="debug-row"><span>selected</span><b>${this.selectedUnits.length}</b></div>
      <div class="debug-row"><span>selected state</span><b>${formatSelectedUnitState(this.selectedUnits)}</b></div>
      <div class="debug-row"><span>state hash</span><b>${snapshot.stateHash}</b></div>
      <div class="debug-row"><span>commands</span><b>${snapshot.queuedCommandCount} queued</b></div>
      <div class="debug-row"><span>interpolation</span><b>${interpolationAlpha.toFixed(2)}</b></div>
    `;
  }
}
