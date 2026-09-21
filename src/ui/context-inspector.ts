import { buildingVisualProfile } from '../rendering/building-visual-profile';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { M03Simulation } from '../simulation/m03-simulation';
import {
  UNITS,
  type BuildingType,
  type ProducerBuildingType,
} from '../simulation/m03-content';
import type { UnitArchetype } from '../simulation/components';
import type { EntitySnapshot } from '../simulation/simulation';
import type { StrategicBuilding } from '../simulation/strategic-state';
import { unitXpProgress } from '../simulation/veteran-progression';

const PLAYER_ID = 0;
const TICKS_PER_SECOND = 10;
const UPDATE_INTERVAL_SECONDS = 0.1;
const UNIT_ORDER: readonly UnitArchetype[] = [
  'VANGUARD',
  'SPEAR_GUARD',
  'RANGER',
  'SCOUT',
  'ELEMENTALIST',
  'ENGINEER',
  'GOLEM',
  'SIEGE_CONSTRUCT',
];
const PRODUCER_TYPES: readonly ProducerBuildingType[] = ['BARRACKS', 'ARCANE_TOWER', 'WORKSHOP'];

const BUILDING_PURPOSE: Readonly<Record<BuildingType, string>> = {
  ELEMENTAL_CORE: 'Command core and strategic network anchor.',
  BARRACKS: 'Trains frontline infantry, guards, rangers, and scouts.',
  ARCANE_TOWER: 'Trains Elementalists and supports the arcane network.',
  WORKSHOP: 'Builds engineers, golems, and siege constructs.',
  OUTPOST: 'Claims territory and extends population capacity.',
  EXTRACTOR: 'Harvests Material from an amber deposit.',
  MANA_WELL: 'Harvests Mana from a Mana Spring.',
};

function label(value: string): string {
  return value
    .split('_')
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(' ');
}

function formatMetres(worldUnits: number): string {
  const metres = worldUnits / WORLD_UNITS_PER_METER;
  return metres >= 10 ? metres.toFixed(0) : metres.toFixed(1);
}

function statusText(unit: EntitySnapshot): string {
  const statuses: string[] = [];
  if (unit.frozenTicks > 0) statuses.push('Frozen');
  else if (unit.chilledTicks > 0) statuses.push('Chilled');
  if (unit.wet) statuses.push('Wet');
  return statuses.length > 0 ? statuses.join(' · ') : 'Ready';
}

function producerType(type: BuildingType): type is ProducerBuildingType {
  return PRODUCER_TYPES.includes(type as ProducerBuildingType);
}

export class ContextInspector {
  private readonly element: HTMLDivElement;
  private readonly styleElement: HTMLStyleElement;
  private selectedBuildingId: number | null = null;
  private elapsed = 0;
  private lastMarkup = '';

  constructor(
    private readonly simulation: M03Simulation,
    private readonly selectedUnits: () => readonly EntitySnapshot[],
    private readonly battlefieldCanvas: HTMLCanvasElement,
    private readonly strategyElement: HTMLElement,
    private readonly screenToSimulationPosition: (clientX: number, clientY: number) => { x: number; z: number } | null,
  ) {
    this.styleElement = document.createElement('style');
    this.styleElement.textContent = `
      .context-inspector {
        position: fixed;
        left: 19.35rem;
        bottom: .55rem;
        z-index: 38;
        width: min(330px, calc(100vw - 34rem));
        padding: 11px 12px 12px;
        border: 1px solid rgba(126, 190, 184, 0.42);
        border-radius: 7px;
        background: linear-gradient(180deg, rgba(9, 23, 27, 0.94), rgba(5, 15, 18, 0.94));
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32), inset 0 1px rgba(255, 255, 255, 0.035);
        color: #d8e5df;
        font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        pointer-events: auto;
        backdrop-filter: blur(4px);
      }
      .context-inspector[hidden] { display: none; }
      .context-inspector .context-kicker {
        color: #72b7aa;
        font-size: 10px;
        letter-spacing: 0.13em;
      }
      .context-inspector h3 {
        margin: 2px 0 2px;
        color: #f0f5ef;
        font-size: 16px;
        letter-spacing: 0.02em;
      }
      .context-inspector .context-subtitle {
        display: block;
        margin-bottom: 9px;
        color: #96aaa4;
        font-size: 11px;
      }
      .context-inspector .context-health {
        height: 5px;
        margin: 6px 0 3px;
        overflow: hidden;
        border-radius: 4px;
        background: rgba(255,255,255,0.08);
      }
      .context-inspector .context-health > i {
        display: block;
        height: 100%;
        background: #59c97f;
      }
      .context-inspector .context-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 5px;
        margin: 8px 0 4px;
      }
      .context-inspector .context-stat {
        min-width: 0;
        padding: 5px 6px;
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 4px;
        background: rgba(255,255,255,0.035);
      }
      .context-inspector .context-stat small {
        display: block;
        color: #728985;
        font-size: 9px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .context-inspector .context-stat b {
        display: block;
        overflow: hidden;
        margin-top: 1px;
        color: #dce9e4;
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .context-inspector .context-production {
        margin-top: 9px;
        padding-top: 8px;
        border-top: 1px solid rgba(255,255,255,0.08);
      }
      .context-inspector .context-production > strong {
        display: block;
        margin-bottom: 6px;
        color: #bcd2cb;
        font-size: 11px;
      }
      .context-inspector .context-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 5px;
      }
      .context-inspector .building-code {
        display: inline-grid;
        place-items: center;
        min-width: 38px;
        margin-right: 6px;
        padding: 2px 5px;
        border: 1px solid rgba(230, 190, 102, 0.36);
        border-radius: 4px;
        background: rgba(103, 74, 28, 0.34);
        color: #efd68d;
        font-size: 10px;
        letter-spacing: 0.08em;
        vertical-align: middle;
      }
      .context-inspector button {
        min-height: 34px;
        padding: 5px 7px;
        border: 1px solid rgba(96, 181, 166, 0.32);
        border-radius: 4px;
        background: rgba(32, 77, 72, 0.48);
        color: #dcece7;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .context-inspector button:hover { background: rgba(46, 104, 96, 0.62); }
      .context-inspector button:disabled { opacity: 0.42; cursor: default; }
      .context-inspector button small { display: block; color: #8fa9a2; font-size: 9px; }
      .context-inspector .context-note { margin-top: 7px; color: #7f9690; font-size: 10px; }
      @media (max-width: 800px) {
        .context-inspector { left: 8px; bottom: calc(38vh + 16px); width: min(310px, calc(100vw - 16px)); }
        .context-inspector .context-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `;
    document.head.appendChild(this.styleElement);

    this.element = document.createElement('div');
    this.element.className = 'context-inspector';
    this.element.hidden = true;
    this.element.addEventListener('click', this.onPanelClick);
    document.body.appendChild(this.element);

    battlefieldCanvas.addEventListener('pointerdown', this.onBattlefieldPointerDown, true);
    this.render();
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    if (this.elapsed < UPDATE_INTERVAL_SECONDS) return;
    this.elapsed = 0;
    this.render();
  }

  destroy(): void {
    this.battlefieldCanvas.removeEventListener('pointerdown', this.onBattlefieldPointerDown, true);
    this.element.removeEventListener('click', this.onPanelClick);
    this.element.remove();
    this.styleElement.remove();
  }

  private readonly onBattlefieldPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.battlefieldCanvas.classList.contains('build-placement-active')) return;
    const position = this.screenToSimulationPosition(event.clientX, event.clientY);
    if (!position) return;
    const building = this.pickPlayerBuilding(position.x, position.z);
    this.selectedBuildingId = building?.id ?? null;
    if (building && producerType(building.type)) this.syncProducerSelection(building);
    this.elapsed = UPDATE_INTERVAL_SECONDS;
  };

  private readonly onPanelClick = (event: MouseEvent): void => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('button[data-context-action]')
      : null;
    if (!button || button.disabled) return;

    const building = this.selectedBuilding();
    if (!building || !producerType(building.type)) return;
    this.syncProducerSelection(building);

    if (button.dataset.contextAction === 'train') {
      const unitType = button.dataset.unitType as UnitArchetype | undefined;
      if (!unitType) return;
      const sourceButton = this.strategyElement.querySelector<HTMLButtonElement>(
        `button[data-action="train"][data-value="${unitType}"]`,
      );
      sourceButton?.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        shiftKey: event.shiftKey,
      }));
      this.elapsed = UPDATE_INTERVAL_SECONDS;
      return;
    }

    if (button.dataset.contextAction === 'rally') {
      const sourceButton = this.strategyElement.querySelector<HTMLButtonElement>('button[data-action="set-rally"]');
      sourceButton?.click();
      this.elapsed = UPDATE_INTERVAL_SECONDS;
    }
  };

  private pickPlayerBuilding(targetX: number, targetZ: number): StrategicBuilding | null {
    let best: StrategicBuilding | null = null;
    let bestNormalizedDistance = Number.POSITIVE_INFINITY;
    for (const building of this.simulation.strategy.snapshot().buildings) {
      if (building.playerId !== PLAYER_ID || building.destroyed) continue;
      const profile = buildingVisualProfile(building.type);
      const radius = Math.max(1.6, profile.footprint * 0.92) * WORLD_UNITS_PER_METER;
      const dx = building.x - targetX;
      const dz = building.z - targetZ;
      const normalizedDistance = (dx * dx + dz * dz) / (radius * radius);
      if (normalizedDistance > 1 || normalizedDistance >= bestNormalizedDistance) continue;
      best = building;
      bestNormalizedDistance = normalizedDistance;
    }
    return best;
  }

  private selectedBuilding(): StrategicBuilding | null {
    if (this.selectedBuildingId === null) return null;
    const building = this.simulation.strategy.snapshot().buildings.find((candidate) => candidate.id === this.selectedBuildingId);
    if (!building || building.playerId !== PLAYER_ID || building.destroyed) {
      this.selectedBuildingId = null;
      return null;
    }
    return building;
  }

  private syncProducerSelection(building: StrategicBuilding): void {
    if (!producerType(building.type) || !building.completed) return;
    const strategic = this.simulation.strategy.snapshot();
    if (!strategic.suppliedRegions[PLAYER_ID]?.includes(building.regionId)) return;

    const producerButton = this.strategyElement.querySelector<HTMLButtonElement>(
      `button[data-action="select-producer"][data-value="${building.id}"]`,
    );
    producerButton?.click();
    const armyTab = this.strategyElement.querySelector<HTMLButtonElement>(
      'button[data-action="command-view"][data-value="army"]',
    );
    armyTab?.click();
  }

  private render(): void {
    const selected = this.selectedUnits().filter((unit) => unit.playerId === PLAYER_ID && unit.alive);
    let markup = '';
    if (selected.length === 1) markup = this.unitMarkup(selected[0]!);
    else if (selected.length > 1) markup = this.groupMarkup(selected);
    else {
      const building = this.selectedBuilding();
      if (building) markup = this.buildingMarkup(building);
    }

    if (!markup) {
      this.element.hidden = true;
      this.lastMarkup = '';
      return;
    }
    this.element.hidden = false;
    if (markup === this.lastMarkup) return;
    this.lastMarkup = markup;
    this.element.innerHTML = markup;
  }

  private unitMarkup(unit: EntitySnapshot): string {
    const definition = UNITS[unit.archetype];
    const healthRatio = Math.max(0, Math.min(1, unit.currentHealth / Math.max(1, unit.maxHealth)));
    const attackCycleSeconds = unit.attackIntervalTicks / TICKS_PER_SECOND;
    const xp = unitXpProgress(unit.experience);
    const xpLabel = xp.nextLevelXp === null
      ? 'MAX'
      : `${unit.experience} / ${xp.nextLevelXp}`;
    return `
      <div class="context-kicker">UNIT #${unit.id} · LEVEL ${unit.level}</div>
      <h3>${label(unit.archetype)}</h3>
      <span class="context-subtitle">${definition.tags.map(label).join(' · ')} · ${statusText(unit)}</span>
      <div class="context-health"><i style="width:${healthRatio * 100}%"></i></div>
      <span class="context-subtitle">${unit.currentHealth} / ${unit.maxHealth} HP</span>
      <div class="context-stats">
        <div class="context-stat"><small>Level</small><b>Lv${unit.level}</b></div>
        <div class="context-stat"><small>XP</small><b>${xpLabel}</b></div>
        <div class="context-stat"><small>Damage</small><b>${unit.attackDamage}</b></div>
        <div class="context-stat"><small>Range</small><b>${formatMetres(unit.attackRange)} m</b></div>
        <div class="context-stat"><small>Attack cycle</small><b>${attackCycleSeconds.toFixed(1)} s</b></div>
      </div>
    `;
  }

  private groupMarkup(units: readonly EntitySnapshot[]): string {
    const health = units.reduce((sum, unit) => sum + unit.currentHealth, 0);
    const maxHealth = units.reduce((sum, unit) => sum + unit.maxHealth, 0);
    const healthRatio = Math.max(0, Math.min(1, health / Math.max(1, maxHealth)));
    const roleCounts = new Map<string, number>();
    for (const unit of units) {
      const role = label(unit.archetype);
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    }
    const veteranSummary = [5, 4, 3, 2, 1]
      .map((level) => ({ level, count: units.filter((unit) => unit.level === level).length }))
      .filter((entry) => entry.count > 0)
      .map((entry) => `${entry.count}×Lv${entry.level}`)
      .join(' · ');
    const roster = [...roleCounts.entries()]
      .map(([role, count]) => `<span title="${role}">${role}<b>×${count}</b></span>`)
      .join('');
    return `
      <div class="context-kicker">FORMATION</div>
      <h3>${units.length} Units Selected</h3>
      <div class="context-roster">${roster}</div>
      <div class="context-health"><i style="width:${healthRatio * 100}%"></i></div>
      <div class="context-group-summary"><span>${veteranSummary}</span><b>${health} / ${maxHealth} HP</b></div>
    `;
  }

  private buildingMarkup(building: StrategicBuilding): string {
    const snapshot = this.simulation.strategy.snapshot();
    const healthRatio = Math.max(0, Math.min(1, building.currentHealth / Math.max(1, building.maxHealth)));
    const supplied = snapshot.suppliedRegions[PLAYER_ID]?.includes(building.regionId) === true;
    const queueCount = snapshot.productionQueue.filter((order) => order.buildingId === building.id).length;
    const state = building.completed ? (supplied ? 'Operational' : 'Supply cut') : 'Under construction';
    const canProduce = producerType(building.type) && building.completed && supplied;
    const trainButtons = canProduce
      ? UNIT_ORDER
        .filter((unitType) => UNITS[unitType].producer === building.type)
        .map((unitType) => {
          const definition = UNITS[unitType];
          const cost = definition.cost;
          const queued = snapshot.productionQueue.filter((order) => order.buildingId === building.id && order.unitType === unitType).length;
          return `<button data-context-action="train" data-unit-type="${unitType}" title="Click to queue 1; Shift-click to queue up to 5">${label(unitType)}<small>${cost.material} Material${cost.mana ? ` · ${cost.mana} Mana` : ''} · P${definition.population}${queued ? ` · Q${queued}` : ''}</small></button>`;
        })
        .join('')
      : '';
    return `
      <div class="context-kicker">BUILDING #${building.id}</div>
      <h3><span class="building-code">${buildingVisualProfile(building.type).shortCode}</span>${label(building.type)}</h3>
      <span class="context-subtitle">${BUILDING_PURPOSE[building.type]}</span>
      <div class="context-health"><i style="width:${healthRatio * 100}%"></i></div>
      <span class="context-subtitle">${building.currentHealth} / ${building.maxHealth} HP · ${state}</span>
      <div class="context-stats">
        <div class="context-stat"><small>Region</small><b>${building.regionId + 1}</b></div>
        <div class="context-stat"><small>Supply</small><b>${supplied ? 'Connected' : 'Cut'}</b></div>
        <div class="context-stat"><small>Queue</small><b>${queueCount}</b></div>
      </div>
      ${producerType(building.type) ? `
        <div class="context-production">
          <strong>${canProduce ? 'Production · click 1 / Shift-click up to 5' : building.completed ? 'Production unavailable while supply is cut.' : 'Production unlocks when construction completes.'}</strong>
          ${canProduce ? `<div class="context-actions">${trainButtons}<button data-context-action="rally">Set Rally Point<small>Choose a battlefield destination</small></button></div>` : ''}
        </div>
      ` : ''}
      <div class="context-note">Click another unit or building to change context.</div>
    `;
  }
}
