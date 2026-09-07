import type { EntitySnapshot } from '../simulation/simulation';
import { M03Simulation } from '../simulation/m03-simulation';
import {
  BUILDINGS,
  UNITS,
  productionSpeedPercent,
  type BuildingType,
  type OutpostSpecialization,
  type ProducerBuildingType,
} from '../simulation/m03-content';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { UnitArchetype } from '../simulation/components';
import { WorldCellFlag } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';

const PLAYER_ID = 0;
const TICKS_PER_SECOND = 10;
const EXTRACTOR_PICK_RADIUS = 2.5 * WORLD_UNITS_PER_METER;
const BUILD_ORDER: readonly Exclude<BuildingType, 'ELEMENTAL_CORE'>[] = [
  'BARRACKS', 'ARCANE_TOWER', 'WORKSHOP', 'OUTPOST', 'EXTRACTOR',
];
const TRAIN_ORDER: readonly UnitArchetype[] = [
  'VANGUARD', 'SPEAR_GUARD', 'RANGER', 'SCOUT', 'ELEMENTALIST', 'ENGINEER', 'GOLEM', 'SIEGE_CONSTRUCT',
];
const SPECIALIZATIONS: readonly OutpostSpecialization[] = ['WATCHTOWER', 'BARRIER_HUB', 'MANA_BEACON'];
const PRODUCER_TYPES: readonly ProducerBuildingType[] = ['BARRACKS', 'ARCANE_TOWER', 'WORKSHOP'];

function formatResource(milli: number): string {
  const value = milli / 1000;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function label(value: string): string {
  return value.split('_').map((word) => word[0] + word.slice(1).toLowerCase()).join(' ');
}

function progressPercent(tick: number, startTick: number, durationTicks: number): number {
  if (durationTicks <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((tick - startTick) * 100) / durationTicks)));
}

function remainingSeconds(tick: number, completeTick: number): string {
  return `${Math.max(0, Math.ceil((completeTick - tick) / TICKS_PER_SECOND))}s`;
}

interface PlacementCheck {
  valid: boolean;
  regionId: number | null;
  resourceNodeId: string | null;
  targetX: number;
  targetZ: number;
  reason: string;
}

export class StrategicPanel {
  private elapsed = 0;
  private message = 'Expand territory by constructing Outposts into adjacent neutral regions.';
  private pendingBuildType: Exclude<BuildingType, 'ELEMENTAL_CORE'> | null = null;
  private selectedProducerId: number | null = null;

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
    else if (action === 'select-producer') this.selectProducer(Number(target.dataset.value));
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
      targetX: placement.targetX,
      targetZ: placement.targetZ,
      ...(placement.resourceNodeId ? { resourceNodeId: placement.resourceNodeId } : {}),
    });
    this.pendingBuildType = null;
    this.updatePlacementCursor();
    const owner = placement.regionId === null ? -1 : this.simulation.strategy.snapshot().regionOwners[placement.regionId];
    this.message = placement.resourceNodeId
      ? `Queued ${label(buildingType)} on ${placement.resourceNodeId}.`
      : buildingType === 'OUTPOST' && owner !== PLAYER_ID
        ? `Queued Outpost in neutral Region ${(placement.regionId ?? 0) + 1}; completion will claim the territory.`
        : `Queued ${label(buildingType)} in Region ${(placement.regionId ?? 0) + 1}.`;
    this.render();
  };

  private beginBuild(buildingType: Exclude<BuildingType, 'ELEMENTAL_CORE'>): void {
    this.pendingBuildType = buildingType;
    this.updatePlacementCursor();
    this.message = buildingType === 'EXTRACTOR'
      ? 'Place Extractor: click a visible Material Deposit in controlled supplied territory. Right click or Esc cancels.'
      : buildingType === 'OUTPOST'
        ? 'Place Outpost: click controlled territory or a neutral region directly adjacent to supplied territory. Completion expands your border.'
        : `Place ${label(buildingType)}: left click controlled supplied ground. Right click or Esc cancels.`;
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

  private checkPlacement(buildingType: Exclude<BuildingType, 'ELEMENTAL_CORE'>, targetX: number, targetZ: number): PlacementCheck {
    const world = this.simulation.generatedWorld;
    const snapshot = this.simulation.strategy.snapshot();
    if (buildingType === 'EXTRACTOR') {
      const occupied = new Set(snapshot.buildings.flatMap((building) => building.resourceNodeId ? [building.resourceNodeId] : []));
      const candidates = world.resources
        .filter((resource) => (
          resource.type === 'MATERIAL'
          && !occupied.has(resource.id)
          && snapshot.regionOwners[resource.regionId] === PLAYER_ID
          && snapshot.suppliedRegions[PLAYER_ID]?.includes(resource.regionId)
          && !snapshot.contestedRegions.includes(resource.regionId)
        ))
        .map((resource) => {
          const position = worldCellToSimulationPosition(world, resource.cell);
          const dx = position.x - targetX;
          const dz = position.z - targetZ;
          return { resource, position, distanceSquared: dx * dx + dz * dz };
        })
        .sort((left, right) => left.distanceSquared - right.distanceSquared || left.resource.id.localeCompare(right.resource.id));
      const chosen = candidates[0];
      if (!chosen || chosen.distanceSquared > EXTRACTOR_PICK_RADIUS * EXTRACTOR_PICK_RADIUS) {
        return {
          valid: false, regionId: null, resourceNodeId: null, targetX, targetZ,
          reason: 'Click directly on an available amber Material Deposit marker.',
        };
      }
      return {
        valid: true,
        regionId: chosen.resource.regionId,
        resourceNodeId: chosen.resource.id,
        targetX: chosen.position.x,
        targetZ: chosen.position.z,
        reason: '',
      };
    }

    const cell = this.simulation.navigation.worldToCell(targetX, targetZ);
    if (cell.column < 0 || cell.row < 0 || cell.column >= world.width || cell.row >= world.height) {
      return { valid: false, regionId: null, resourceNodeId: null, targetX, targetZ, reason: 'That location is outside the battlefield.' };
    }
    const index = cell.row * world.width + cell.column;
    if (((world.flags[index] ?? 0) & WorldCellFlag.BUILDABLE) === 0) {
      return { valid: false, regionId: null, resourceNodeId: null, targetX, targetZ, reason: 'Choose buildable ground; water, crossings, and blocked terrain are invalid.' };
    }
    const regionId = world.regionByCell[index];
    if (regionId === undefined) {
      return { valid: false, regionId: null, resourceNodeId: null, targetX, targetZ, reason: 'That location is outside a strategic territory region.' };
    }
    if (snapshot.contestedRegions.includes(regionId)) {
      return { valid: false, regionId, resourceNodeId: null, targetX, targetZ, reason: `Region ${regionId + 1} is contested and cannot accept construction.` };
    }
    const owner = snapshot.regionOwners[regionId] ?? -1;
    const supplied = snapshot.suppliedRegions[PLAYER_ID]?.includes(regionId) === true;
    const neighborSupplied = world.regions[regionId]?.neighbors.some((neighbor) => snapshot.suppliedRegions[PLAYER_ID]?.includes(neighbor)) === true;
    if (buildingType === 'OUTPOST') {
      if (owner >= 0 && owner !== PLAYER_ID) {
        return { valid: false, regionId, resourceNodeId: null, targetX, targetZ, reason: 'Enemy-controlled territory cannot receive your Outpost.' };
      }
      const alreadyHasOutpost = snapshot.buildings.some((building) => (
        building.playerId === PLAYER_ID && building.type === 'OUTPOST' && building.regionId === regionId
      ));
      if (alreadyHasOutpost) return { valid: false, regionId, resourceNodeId: null, targetX, targetZ, reason: `Region ${regionId + 1} already has an Outpost.` };
      if (!supplied && !neighborSupplied) {
        return { valid: false, regionId, resourceNodeId: null, targetX, targetZ, reason: 'Outposts expand only into territory adjacent to your supplied network.' };
      }
    } else {
      if (owner !== PLAYER_ID) {
        return { valid: false, regionId, resourceNodeId: null, targetX, targetZ, reason: 'Build an Outpost first to claim this territory.' };
      }
      if (!supplied) {
        return { valid: false, regionId, resourceNodeId: null, targetX, targetZ, reason: `Region ${regionId + 1} is controlled but not supplied.` };
      }
    }
    const occupied = snapshot.buildings.some((building) => {
      const buildingCell = this.simulation.navigation.worldToCell(building.x, building.z);
      return buildingCell.column === cell.column && buildingCell.row === cell.row;
    });
    if (occupied) return { valid: false, regionId, resourceNodeId: null, targetX, targetZ, reason: 'Another building already occupies that cell.' };
    return { valid: true, regionId, resourceNodeId: null, targetX, targetZ, reason: '' };
  }

  private selectProducer(buildingId: number): void {
    const snapshot = this.simulation.strategy.snapshot();
    const producer = snapshot.buildings.find((building) => (
      building.id === buildingId
      && building.playerId === PLAYER_ID
      && building.completed
      && PRODUCER_TYPES.includes(building.type as ProducerBuildingType)
      && snapshot.suppliedRegions[PLAYER_ID]?.includes(building.regionId)
    ));
    if (!producer) {
      this.message = 'That production building is not currently available.';
      return;
    }
    this.selectedProducerId = producer.id;
    this.message = `Production source selected: ${label(producer.type)} #${producer.id}.`;
  }

  private queueTrain(unitType: UnitArchetype): void {
    const definition = UNITS[unitType];
    const snapshot = this.simulation.strategy.snapshot();
    const producer = snapshot.buildings.find((building) => building.id === this.selectedProducerId);
    if (!producer || producer.playerId !== PLAYER_ID || !producer.completed || producer.type !== definition.producer) {
      this.message = `Select a completed ${label(definition.producer)} as the production source for ${label(unitType)}.`;
      return;
    }
    if (!snapshot.suppliedRegions[PLAYER_ID]?.includes(producer.regionId)) {
      this.message = `${label(producer.type)} #${producer.id} is cut off from supply.`;
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

  private selectedRegion(units: readonly EntitySnapshot[]): number | null {
    const unit = units.find((candidate) => candidate.playerId === PLAYER_ID && candidate.alive);
    if (!unit) return null;
    const cell = this.simulation.navigation.worldToCell(unit.x, unit.z);
    if (cell.column < 0 || cell.row < 0 || cell.column >= this.simulation.generatedWorld.width || cell.row >= this.simulation.generatedWorld.height) return null;
    return this.simulation.generatedWorld.regionByCell[cell.row * this.simulation.generatedWorld.width + cell.column] ?? null;
  }

  private availableProducers(snapshot: ReturnType<M03Simulation['strategy']['snapshot']>) {
    return snapshot.buildings.filter((building) => (
      building.playerId === PLAYER_ID
      && building.completed
      && PRODUCER_TYPES.includes(building.type as ProducerBuildingType)
      && snapshot.suppliedRegions[PLAYER_ID]?.includes(building.regionId)
    ));
  }

  private ensureSelectedProducer(snapshot: ReturnType<M03Simulation['strategy']['snapshot']>): void {
    const available = this.availableProducers(snapshot);
    if (available.some((building) => building.id === this.selectedProducerId)) return;
    this.selectedProducerId = available[0]?.id ?? null;
  }

  private armyMarkup(simulationSnapshot: ReturnType<M03Simulation['snapshot']>): string {
    const queued = new Map<UnitArchetype, number>();
    for (const order of simulationSnapshot.strategic.productionQueue) {
      if (order.playerId !== PLAYER_ID) continue;
      queued.set(order.unitType, (queued.get(order.unitType) ?? 0) + 1);
    }
    const rows = TRAIN_ORDER.map((unitType) => {
      const alive = simulationSnapshot.entities.filter((unit) => unit.playerId === PLAYER_ID && unit.alive && unit.archetype === unitType).length;
      const waiting = queued.get(unitType) ?? 0;
      return `<span title="${label(unitType)}"><b>${label(unitType)}</b><em>${alive}${waiting ? ` +${waiting}q` : ''}</em></span>`;
    }).join('');
    return `<div class="army-counts"><strong>Army</strong><div>${rows}</div></div>`;
  }

  private producerMarkup(snapshot: ReturnType<M03Simulation['strategy']['snapshot']>): string {
    const producers = this.availableProducers(snapshot);
    if (producers.length === 0) return '<div class="producer-select"><strong>Produce at</strong><small>Build a Barracks, Arcane Tower, or Workshop.</small></div>';
    const buttons = producers.map((building) => {
      const sameTypeCount = producers.filter((candidate) => candidate.type === building.type).length;
      const speed = productionSpeedPercent(sameTypeCount);
      const queue = snapshot.productionQueue.filter((order) => order.buildingId === building.id).length;
      const active = building.id === this.selectedProducerId ? ' active' : '';
      return `<button class="${active.trim()}" data-action="select-producer" data-value="${building.id}">${label(building.type)} #${building.id}<small>${speed}% speed · Q${queue}</small></button>`;
    }).join('');
    return `<div class="producer-select"><strong>Produce at</strong><div>${buttons}</div></div>`;
  }

  private queueMarkup(tick: number, snapshot: ReturnType<M03Simulation['strategy']['snapshot']>): string {
    const construction = snapshot.buildings
      .filter((building) => building.playerId === PLAYER_ID && !building.completed && building.type !== 'ELEMENTAL_CORE')
      .map((building) => {
        const duration = BUILDINGS[building.type].buildTicks;
        const startTick = building.completeTick - duration;
        const percent = progressPercent(tick, startTick, duration);
        return `<div class="strategy-progress-row"><span>${label(building.type)} #${building.id}</span><em>${percent}% · ${remainingSeconds(tick, building.completeTick)}</em><i><b style="width:${percent}%"></b></i></div>`;
      });
    const production = snapshot.productionQueue
      .filter((order) => order.playerId === PLAYER_ID)
      .slice(0, 8)
      .map((order) => {
        const percent = progressPercent(tick, order.startTick, order.durationTicks);
        const queued = tick < order.startTick;
        return `<div class="strategy-progress-row"><span>${queued ? 'Queued' : 'Training'} ${label(order.unitType)} · #${order.buildingId}</span><em>${percent}% · ${remainingSeconds(tick, order.completeTick)}</em><i><b style="width:${percent}%"></b></i></div>`;
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
    this.ensureSelectedProducer(snapshot);
    const owned = snapshot.regionOwners.filter((owner) => owner === PLAYER_ID).length;
    const supplied = snapshot.suppliedRegions[PLAYER_ID]?.length ?? 0;
    const buildingButtons = BUILD_ORDER.map((buildingType) => {
      const cost = BUILDINGS[buildingType].cost;
      const active = this.pendingBuildType === buildingType ? ' active' : '';
      const title = buildingType === 'EXTRACTOR'
        ? 'Choose Extractor, then click an amber Material Deposit'
        : buildingType === 'OUTPOST'
          ? 'Outposts claim adjacent neutral territory when construction completes'
          : 'Choose this building, then place it inside controlled supplied territory';
      return `<button class="${active.trim()}" data-action="build" data-value="${buildingType}" title="${title}">${label(buildingType)}<small>${cost.material}M${cost.mana ? ` · ${cost.mana}A` : ''}${cost.influence ? ` · ${cost.influence}I` : ''}</small></button>`;
    }).join('');
    const selectedProducer = snapshot.buildings.find((building) => building.id === this.selectedProducerId);
    const trainButtons = TRAIN_ORDER.map((unitType) => {
      const definition = UNITS[unitType];
      const enabled = selectedProducer?.type === definition.producer;
      return `<button data-action="train" data-value="${unitType}" ${enabled ? '' : 'disabled'}>${label(unitType)}<small>${definition.cost.material}M${definition.cost.mana ? ` · ${definition.cost.mana}A` : ''} · P${definition.population}</small></button>`;
    }).join('');
    const specializationButtons = SPECIALIZATIONS.map((specialization) => (
      `<button data-action="specialize" data-value="${specialization}">${label(specialization)}</button>`
    )).join('');
    this.element.innerHTML = `
      <div class="strategy-title">ECONOMY & COMMAND</div>
      <div class="resource-strip">
        <b>${formatResource(stock.materialMilli)} <span>Material</span></b>
        <b>${formatResource(stock.manaMilli)} <span>Mana</span></b>
        <b>${formatResource(stock.influenceMilli)} <span>Influence</span></b>
        <b>${snapshot.populationUsed[PLAYER_ID] ?? 0}/${snapshot.populationCap[PLAYER_ID] ?? 0} <span>Population</span></b>
      </div>
      <div class="resource-key"><span class="material-dot"></span>Amber = Material Deposit <span class="mana-dot"></span>Violet = Mana Spring</div>
      <div class="strategy-meta">Territory ${owned}/${snapshot.regionOwners.length} · Supplied ${supplied} · Contested ${snapshot.contestedRegions.length}</div>
      ${this.armyMarkup(simulationSnapshot)}
      ${this.queueMarkup(simulationSnapshot.tick, snapshot)}
      <div class="strategy-section"><strong>Build</strong><div class="strategy-buttons">${buildingButtons}</div></div>
      <div class="strategy-section"><strong>Produce</strong>${this.producerMarkup(snapshot)}<div class="strategy-buttons compact">${trainButtons}</div></div>
      <div class="strategy-section territory-info"><strong>Expansion</strong><small>Core claims the starting region. Complete an Outpost in an adjacent neutral region to extend controlled and supplied territory.</small><div class="strategy-buttons">
        <button data-action="capture-poi">Capture POI (+10 Influence)</button>
      </div></div>
      <div class="strategy-section"><strong>Outpost</strong><div class="strategy-buttons compact">${specializationButtons}</div></div>
      <div class="strategy-message">${this.message}</div>
    `;
  }
}
