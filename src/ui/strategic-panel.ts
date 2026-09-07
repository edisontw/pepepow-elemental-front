import type { EntitySnapshot } from '../simulation/simulation';
import { M03Simulation } from '../simulation/m03-simulation';
import { BUILDINGS, UNITS, type BuildingType, type OutpostSpecialization } from '../simulation/m03-content';
import type { UnitArchetype } from '../simulation/components';
import { WorldCellFlag } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';

const PLAYER_ID = 0;
const TICKS_PER_SECOND = 10;
const BUILD_ORDER: readonly Exclude<BuildingType, 'ELEMENTAL_CORE'>[] = [
  'BARRACKS', 'ARCANE_TOWER', 'WORKSHOP', 'OUTPOST', 'EXTRACTOR',
];
const TRAIN_ORDER: readonly UnitArchetype[] = [
  'VANGUARD', 'SPEAR_GUARD', 'RANGER', 'SCOUT', 'ELEMENTALIST', 'ENGINEER', 'GOLEM', 'SIEGE_CONSTRUCT',
];
const SPECIALIZATIONS: readonly OutpostSpecialization[] = ['WATCHTOWER', 'BARRIER_HUB', 'MANA_BEACON'];

function formatResource(milli: number): string {
  const value = milli / 1000;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function label(value: string): string {
  return value.split('_').map((word) => word[0] + word.slice(1).toLowerCase()).join(' ');
}

function progressPercent(tick: number, completeTick: number, durationTicks: number): number {
  if (durationTicks <= 0) return 100;
  const startTick = completeTick - durationTicks;
  return Math.max(0, Math.min(100, Math.round(((tick - startTick) * 100) / durationTicks)));
}

function remainingSeconds(tick: number, completeTick: number): string {
  return `${Math.max(0, Math.ceil((completeTick - tick) / TICKS_PER_SECOND))}s`;
}

interface PlacementCheck {
  valid: boolean;
  regionId: number | null;
  reason: string;
}

export class StrategicPanel {
  private elapsed = 0;
  private message = 'Select units, move into a region, then capture or expand.';
  private pendingBuildType: Exclude<BuildingType, 'ELEMENTAL_CORE'> | null = null;

  constructor(
    private readonly element: HTMLElement,
    private readonly simulation: M03Simulation,
    private readonly selectedUnits: () => readonly EntitySnapshot[],
    private readonly battlefieldCanvas: HTMLCanvasElement,
    private readonly screenToSimulationPosition: (clientX: number, clientY: number) => { x: number; z: number } | null,
  ) {
    element.addEventListener('click', this.onClick);
    battlefieldCanvas.addEventListener('pointerdown', this.onBattlefieldPointerDown, true);
    window.addEventListener('keydown', this.onKeyDown);
    this.render();
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    if (this.elapsed < 0.2) return;
    this.elapsed = 0;
    this.render();
  }

  destroy(): void {
    this.element.removeEventListener('click', this.onClick);
    this.battlefieldCanvas.removeEventListener('pointerdown', this.onBattlefieldPointerDown, true);
    window.removeEventListener('keydown', this.onKeyDown);
    this.pendingBuildType = null;
    this.updatePlacementCursor();
  }

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-action]') : null;
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === 'build') this.beginBuild(target.dataset.value as Exclude<BuildingType, 'ELEMENTAL_CORE'>);
    else if (action === 'train') this.queueTrain(target.dataset.value as UnitArchetype);
    else if (action === 'capture-region') this.queueCaptureRegion();
    else if (action === 'capture-poi') this.queueCapturePoi();
    else if (action === 'specialize') this.queueSpecialization(target.dataset.value as OutpostSpecialization);
    this.render();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape' || this.pendingBuildType === null) return;
    this.cancelBuildPlacement();
    this.render();
  };

  private readonly onBattlefieldPointerDown = (event: PointerEvent): void => {
    if (this.pendingBuildType === null) return;
    if (event.button === 2) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.cancelBuildPlacement();
      this.render();
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const position = this.screenToSimulationPosition(event.clientX, event.clientY);
    if (!position) {
      this.message = 'Choose a ground location inside the battlefield.';
      this.render();
      return;
    }
    const buildingType = this.pendingBuildType;
    const placement = this.checkPlacement(buildingType, position.x, position.z);
    if (!placement.valid) {
      this.message = placement.reason;
      this.render();
      return;
    }
    this.simulation.enqueueStrategicCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: PLAYER_ID,
      type: 'BUILD',
      buildingType,
      targetX: position.x,
      targetZ: position.z,
    });
    this.pendingBuildType = null;
    this.updatePlacementCursor();
    this.message = `Queued ${label(buildingType)} in Region ${(placement.regionId ?? 0) + 1}.`;
    this.render();
  };

  private beginBuild(buildingType: Exclude<BuildingType, 'ELEMENTAL_CORE'>): void {
    if (buildingType === 'EXTRACTOR') {
      this.pendingBuildType = null;
      this.updatePlacementCursor();
      this.queueExtractor();
      return;
    }
    this.pendingBuildType = buildingType;
    this.updatePlacementCursor();
    this.message = `Place ${label(buildingType)}: left click controlled buildable ground. Right click or Esc cancels.`;
  }

  private cancelBuildPlacement(): void {
    const cancelled = this.pendingBuildType;
    this.pendingBuildType = null;
    this.updatePlacementCursor();
    if (cancelled) this.message = `${label(cancelled)} placement cancelled.`;
  }

  private updatePlacementCursor(): void {
    this.battlefieldCanvas.classList.toggle('build-placement-active', this.pendingBuildType !== null);
  }

  private queueExtractor(): void {
    const target = this.findExtractorTarget();
    if (!target) {
      this.message = 'No available controlled Material Deposit is ready for an Extractor.';
      return;
    }
    const position = worldCellToSimulationPosition(this.simulation.generatedWorld, target.cell);
    this.simulation.enqueueStrategicCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: PLAYER_ID,
      type: 'BUILD',
      buildingType: 'EXTRACTOR',
      targetX: position.x,
      targetZ: position.z,
      resourceNodeId: target.id,
    });
    this.message = `Queued Extractor on ${target.id}.`;
  }

  private checkPlacement(buildingType: Exclude<BuildingType, 'ELEMENTAL_CORE'>, targetX: number, targetZ: number): PlacementCheck {
    if (buildingType === 'EXTRACTOR') {
      return { valid: false, regionId: null, reason: 'Extractors must be attached to a Material Deposit.' };
    }
    const world = this.simulation.generatedWorld;
    const snapshot = this.simulation.strategy.snapshot();
    const cell = this.simulation.navigation.worldToCell(targetX, targetZ);
    if (cell.column < 0 || cell.row < 0 || cell.column >= world.width || cell.row >= world.height) {
      return { valid: false, regionId: null, reason: 'That location is outside the battlefield.' };
    }
    const index = cell.row * world.width + cell.column;
    if (((world.flags[index] ?? 0) & WorldCellFlag.BUILDABLE) === 0) {
      return { valid: false, regionId: null, reason: 'Choose buildable ground; water, crossings, and blocked terrain are invalid.' };
    }
    const regionId = world.regionByCell[index];
    if (regionId === undefined || snapshot.regionOwners[regionId] !== PLAYER_ID) {
      return { valid: false, regionId: regionId ?? null, reason: 'Buildings must be placed in player-controlled territory.' };
    }
    if (snapshot.contestedRegions.includes(regionId)) {
      return { valid: false, regionId, reason: `Region ${regionId + 1} is contested and cannot accept construction.` };
    }
    const supplied = snapshot.suppliedRegions[PLAYER_ID]?.includes(regionId) === true;
    if (buildingType === 'OUTPOST') {
      const alreadyHasOutpost = snapshot.buildings.some((building) => (
        building.playerId === PLAYER_ID && building.type === 'OUTPOST' && building.regionId === regionId
      ));
      if (alreadyHasOutpost) return { valid: false, regionId, reason: `Region ${regionId + 1} already has an Outpost.` };
      const neighborSupplied = world.regions[regionId]?.neighbors.some((neighbor) => snapshot.suppliedRegions[PLAYER_ID]?.includes(neighbor)) === true;
      if (!supplied && !neighborSupplied) {
        return { valid: false, regionId, reason: 'An Outpost must connect to current supplied territory.' };
      }
    } else if (!supplied) {
      return { valid: false, regionId, reason: `Region ${regionId + 1} is controlled but not supplied.` };
    }
    const occupied = snapshot.buildings.some((building) => {
      const buildingCell = this.simulation.navigation.worldToCell(building.x, building.z);
      return buildingCell.column === cell.column && buildingCell.row === cell.row;
    });
    if (occupied) return { valid: false, regionId, reason: 'Another building already occupies that cell.' };
    return { valid: true, regionId, reason: '' };
  }

  private queueTrain(unitType: UnitArchetype): void {
    const definition = UNITS[unitType];
    const snapshot = this.simulation.strategy.snapshot();
    const producer = snapshot.buildings.find((building) => (
      building.playerId === PLAYER_ID
      && building.completed
      && building.type === definition.producer
      && snapshot.suppliedRegions[PLAYER_ID]?.includes(building.regionId)
    ));
    if (!producer) {
      this.message = `Build and supply a ${label(definition.producer)} before training ${label(unitType)}.`;
      return;
    }
    this.simulation.enqueueStrategicCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: PLAYER_ID,
      type: 'TRAIN',
      buildingId: producer.id,
      unitType,
    });
    this.message = `Queued ${label(unitType)} at ${label(producer.type)} #${producer.id}.`;
  }

  private queueCaptureRegion(): void {
    const units = this.selectedUnits().filter((unit) => unit.playerId === PLAYER_ID && unit.alive);
    const regionId = this.selectedRegion(units);
    if (units.length === 0 || regionId === null) {
      this.message = 'Select player units standing inside the region you want to capture.';
      return;
    }
    if (this.simulation.strategy.ownerOfRegion(regionId) === PLAYER_ID) {
      this.message = `Region ${regionId + 1} is already controlled.`;
      return;
    }
    this.simulation.enqueueStrategicCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: PLAYER_ID,
      type: 'CAPTURE',
      entityIds: units.map((unit) => unit.id),
      targetRegionId: regionId,
    });
    this.message = `Capturing region ${regionId + 1}; keep selected units inside it.`;
  }

  private queueCapturePoi(): void {
    const units = this.selectedUnits().filter((unit) => unit.playerId === PLAYER_ID && unit.alive);
    const regionId = this.selectedRegion(units);
    if (units.length === 0 || regionId === null) {
      this.message = 'Select player units inside a region containing a POI.';
      return;
    }
    const snapshot = this.simulation.strategy.snapshot();
    const poi = this.simulation.generatedWorld.pois.find((candidate) => (
      candidate.regionId === regionId && snapshot.poiOwners[candidate.id] !== PLAYER_ID
    ));
    if (!poi) {
      this.message = `Region ${regionId + 1} has no uncaptured POI.`;
      return;
    }
    this.simulation.enqueueStrategicCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: PLAYER_ID,
      type: 'CAPTURE',
      entityIds: units.map((unit) => unit.id),
      targetPoiId: poi.id,
    });
    this.message = `Capturing ${label(poi.type)} ${poi.id}; reward is +10 Influence.`;
  }

  private queueSpecialization(specialization: OutpostSpecialization): void {
    const outpost = this.simulation.strategy.snapshot().buildings.find((building) => (
      building.playerId === PLAYER_ID && building.type === 'OUTPOST' && building.completed && building.specialization === null
    ));
    if (!outpost) {
      this.message = 'No completed unspecialized Outpost is available.';
      return;
    }
    this.simulation.enqueueStrategicCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: PLAYER_ID,
      type: 'SPECIALIZE_OUTPOST',
      buildingId: outpost.id,
      specialization,
    });
    this.message = `Queued ${label(specialization)} specialization for Outpost #${outpost.id}.`;
  }

  private findExtractorTarget() {
    const snapshot = this.simulation.strategy.snapshot();
    const occupied = new Set(snapshot.buildings.flatMap((building) => building.resourceNodeId ? [building.resourceNodeId] : []));
    return this.simulation.generatedWorld.resources.find((resource) => (
      resource.type === 'MATERIAL'
      && !occupied.has(resource.id)
      && snapshot.regionOwners[resource.regionId] === PLAYER_ID
      && snapshot.suppliedRegions[PLAYER_ID]?.includes(resource.regionId)
    ));
  }

  private selectedRegion(units: readonly EntitySnapshot[]): number | null {
    const unit = units.find((candidate) => candidate.playerId === PLAYER_ID && candidate.alive);
    if (!unit) return null;
    const cell = this.simulation.navigation.worldToCell(unit.x, unit.z);
    if (cell.column < 0 || cell.row < 0 || cell.column >= this.simulation.generatedWorld.width || cell.row >= this.simulation.generatedWorld.height) return null;
    return this.simulation.generatedWorld.regionByCell[cell.row * this.simulation.generatedWorld.width + cell.column] ?? null;
  }

  private queueMarkup(tick: number, snapshot: ReturnType<M03Simulation['strategy']['snapshot']>): string {
    const construction = snapshot.buildings
      .filter((building) => building.playerId === PLAYER_ID && !building.completed && building.type !== 'ELEMENTAL_CORE')
      .map((building) => {
        const duration = BUILDINGS[building.type].buildTicks;
        const percent = progressPercent(tick, building.completeTick, duration);
        return `<div class="strategy-progress-row"><span>${label(building.type)}</span><em>${percent}% · ${remainingSeconds(tick, building.completeTick)}</em><i><b style="width:${percent}%"></b></i></div>`;
      });
    const production = snapshot.productionQueue
      .filter((order) => order.playerId === PLAYER_ID)
      .slice(0, 6)
      .map((order) => {
        const duration = UNITS[order.unitType].trainTicks;
        const percent = progressPercent(tick, order.completeTick, duration);
        const queued = tick < order.completeTick - duration;
        return `<div class="strategy-progress-row"><span>${queued ? 'Queued' : 'Training'} ${label(order.unitType)}</span><em>${percent}% · ${remainingSeconds(tick, order.completeTick)}</em><i><b style="width:${percent}%"></b></i></div>`;
      });
    const hiddenOrders = Math.max(0, snapshot.productionQueue.filter((order) => order.playerId === PLAYER_ID).length - production.length);
    if (construction.length === 0 && production.length === 0) return '';
    return `<div class="strategy-progress"><strong>Active Queue</strong>${construction.join('')}${production.join('')}${hiddenOrders > 0 ? `<small>+${hiddenOrders} more queued</small>` : ''}</div>`;
  }

  private render(): void {
    const simulationSnapshot = this.simulation.snapshot();
    const snapshot = simulationSnapshot.strategic;
    const stock = snapshot.resources[PLAYER_ID];
    if (!stock) return;
    const owned = snapshot.regionOwners.filter((owner) => owner === PLAYER_ID).length;
    const supplied = snapshot.suppliedRegions[PLAYER_ID]?.length ?? 0;
    const buildingButtons = BUILD_ORDER.map((buildingType) => {
      const cost = BUILDINGS[buildingType].cost;
      const active = this.pendingBuildType === buildingType ? ' active' : '';
      const title = buildingType === 'EXTRACTOR' ? 'Build on the next available controlled Material Deposit' : 'Choose this building, then place it on the battlefield';
      return `<button class="${active.trim()}" data-action="build" data-value="${buildingType}" title="${title}">${label(buildingType)}<small>${cost.material}M${cost.mana ? ` · ${cost.mana}A` : ''}${cost.influence ? ` · ${cost.influence}I` : ''}</small></button>`;
    }).join('');
    const trainButtons = TRAIN_ORDER.map((unitType) => {
      const definition = UNITS[unitType];
      return `<button data-action="train" data-value="${unitType}">${label(unitType)}<small>${definition.cost.material}M${definition.cost.mana ? ` · ${definition.cost.mana}A` : ''} · P${definition.population}</small></button>`;
    }).join('');
    const specializationButtons = SPECIALIZATIONS.map((specialization) => (
      `<button data-action="specialize" data-value="${specialization}">${label(specialization)}</button>`
    )).join('');
    this.element.innerHTML = `
      <div class="strategy-title">M03 ECONOMY & TERRITORY</div>
      <div class="resource-strip">
        <b>${formatResource(stock.materialMilli)} <span>Material</span></b>
        <b>${formatResource(stock.manaMilli)} <span>Mana</span></b>
        <b>${formatResource(stock.influenceMilli)} <span>Influence</span></b>
        <b>${snapshot.populationUsed[PLAYER_ID] ?? 0}/${snapshot.populationCap[PLAYER_ID] ?? 0} <span>Population</span></b>
      </div>
      <div class="strategy-meta">Territory ${owned}/${snapshot.regionOwners.length} · Supplied ${supplied} · Contested ${snapshot.contestedRegions.length} · Queue ${snapshot.productionQueue.length}</div>
      ${this.queueMarkup(simulationSnapshot.tick, snapshot)}
      <div class="strategy-section"><strong>Build</strong><div class="strategy-buttons">${buildingButtons}</div></div>
      <div class="strategy-section"><strong>Produce</strong><div class="strategy-buttons compact">${trainButtons}</div></div>
      <div class="strategy-section"><strong>Territory</strong><div class="strategy-buttons">
        <button data-action="capture-region">Capture Current Region</button>
        <button data-action="capture-poi">Capture POI (+10 Influence)</button>
      </div></div>
      <div class="strategy-section"><strong>Outpost</strong><div class="strategy-buttons compact">${specializationButtons}</div></div>
      <div class="strategy-message">${this.message}</div>
    `;
  }
}
