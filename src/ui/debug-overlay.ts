import type { TickFrame } from '../simulation/fixed-tick-runner';
import type { EntitySnapshot } from '../simulation/simulation';
import type { StrategicSnapshot } from '../simulation/strategic-state';
import type { EnemyWarSnapshot } from '../simulation/enemy-war-state';

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

function resourceValue(milli: number): string {
  const value = milli / 1000;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export class DebugOverlay {
  private frameCount = 0;
  private elapsed = 0;
  private fps = 0;
  private latestTick: TickFrame | null = null;
  private selectedUnits: readonly EntitySnapshot[] = [];

  constructor(
    private readonly element: HTMLElement,
    private readonly strategicSnapshot?: () => StrategicSnapshot,
    private readonly enemySnapshot?: () => EnemyWarSnapshot,
  ) {}

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
    const strategy = this.strategicSnapshot?.();
    const enemy = this.enemySnapshot?.();
    const stock = strategy?.resources[0];
    const strategyRows = strategy && stock ? `
      <div class="debug-row"><span>Material / Mana</span><b>${resourceValue(stock.materialMilli)} / ${resourceValue(stock.manaMilli)}</b></div>
      <div class="debug-row"><span>Influence</span><b>${resourceValue(stock.influenceMilli)}</b></div>
      <div class="debug-row"><span>population</span><b>${strategy.populationUsed[0] ?? 0} / ${strategy.populationCap[0] ?? 0}</b></div>
      <div class="debug-row"><span>territory / supplied</span><b>${strategy.regionOwners.filter((owner) => owner === 0).length} / ${strategy.suppliedRegions[0]?.length ?? 0}</b></div>
      <div class="debug-row"><span>contested</span><b>${strategy.contestedRegions.length}</b></div>
      <div class="debug-row"><span>buildings / production</span><b>${strategy.buildings.length} / ${strategy.productionQueue.length}</b></div>
      <div class="debug-row"><span>strategic hash</span><b>${strategy.stateHash}</b></div>
    ` : '';
    const enemyRows = enemy ? `
      <div class="debug-row"><span>enemy faction</span><b>${enemy.faction}</b></div>
      <div class="debug-row"><span>enemy difficulty</span><b>${enemy.difficulty}</b></div>
      <div class="debug-row"><span>enemy intent</span><b>${enemy.currentDecision?.action ?? 'OBSERVING'}${enemy.currentDecision?.targetRegionId !== null && enemy.currentDecision?.targetRegionId !== undefined ? ` R${enemy.currentDecision.targetRegionId}` : ''}</b></div>
      <div class="debug-row"><span>AI pressure</span><b>${enemy.director.pressure}${enemy.director.recoveryActive ? ' RECOVERY' : ''}${enemy.director.antiTurtleActive ? ' ANTI-TURTLE' : ''}</b></div>
      <div class="debug-row"><span>AI visible / remembered</span><b>${enemy.visiblePlayerEntityIds.length} / ${enemy.lastKnownPlayerUnits.length}</b></div>
      <div class="debug-row"><span>AI known supply</span><b>${enemy.knownPlayerSuppliedRegions.length}</b></div>
      <div class="debug-row"><span>AI decisions / hash</span><b>${enemy.decisionCount} / ${enemy.stateHash}</b></div>
    ` : '';
    this.element.innerHTML = `
      <div class="debug-title">${enemy ? 'M05 ENEMY WAR' : strategy ? 'M03 DETERMINISTIC RTS' : 'M01 ELEMENTAL COMBAT'}</div>
      <div class="debug-row"><span>renderer</span><b class="debug-ok">ONLINE · ${this.fps} FPS</b></div>
      <div class="debug-row"><span>simulation</span><b class="debug-ok">ONLINE · 10 Hz</b></div>
      <div class="debug-row"><span>sim tick</span><b>${snapshot.tick}</b></div>
      ${strategyRows}
      ${enemyRows}
      <div class="debug-row"><span>entities</span><b>${snapshot.entities.length}</b></div>
      <div class="debug-row"><span>player alive</span><b>${snapshot.entities.filter((entity) => entity.alive && entity.playerId === 0).length}</b></div>
      <div class="debug-row"><span>enemy alive</span><b>${snapshot.entities.filter((entity) => entity.alive && entity.playerId !== 0).length}</b></div>
      <div class="debug-row"><span>nav version</span><b>${snapshot.navVersion}</b></div>
      <div class="debug-row"><span>nav dirty</span><b>${snapshot.navDirty ? 'DIRTY' : 'CLEAN'}</b></div>
      <div class="debug-row"><span>water / ice</span><b>${snapshot.terrain.water} / ${snapshot.terrain.ice}</b></div>
      <div class="debug-row"><span>forest fire</span><b>${snapshot.terrain.burning} burning / ${snapshot.terrain.consumedVegetation} consumed</b></div>
      <div class="debug-row"><span>wet units</span><b>${snapshot.wetUnitCount}</b></div>
      <div class="debug-row"><span>chilled / frozen</span><b>${snapshot.chilledUnitCount} / ${snapshot.frozenUnitCount}</b></div>
      <div class="debug-row"><span>fog V / E / U</span><b>${snapshot.visibility.visible} / ${snapshot.visibility.explored} / ${snapshot.visibility.unexplored}</b></div>
      <div class="debug-row"><span>selected</span><b>${this.selectedUnits.length}</b></div>
      <div class="debug-row"><span>selected state</span><b>${formatSelectedUnitState(this.selectedUnits)}</b></div>
      <div class="debug-row"><span>combined hash</span><b>${snapshot.stateHash}</b></div>
      <div class="debug-row"><span>commands</span><b>${snapshot.queuedCommandCount} queued</b></div>
      <div class="debug-row"><span>interpolation</span><b>${interpolationAlpha.toFixed(2)}</b></div>
    `;
  }
}
