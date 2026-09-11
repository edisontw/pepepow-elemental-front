import type { EntitySnapshot } from '../simulation/simulation';
import { M03Simulation } from '../simulation/m03-simulation';
import {
  BUILDINGS,
  UNITS,
  productionSpeedPercent,
  type BuildingType,
  type ProducerBuildingType,
} from '../simulation/m03-content';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { UnitArchetype } from '../simulation/components';
import { WorldCellFlag } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';

const PLAYER_ID = 0;
const TICKS_PER_SECOND = 10;
const RESOURCE_PICK_RADIUS = 4 * WORLD_UNITS_PER_METER;
const BUILD_ORDER: readonly Exclude<BuildingType, 'ELEMENTAL_CORE'>[] = [
  'BARRACKS', 'ARCANE_TOWER', 'WORKSHOP', 'OUTPOST', 'EXTRACTOR', 'MANA_WELL',
];
const TRAIN_ORDER: readonly UnitArchetype[] = [
  'VANGUARD', 'SPEAR_GUARD', 'RANGER', 'SCOUT', 'ELEMENTALIST', 'ENGINEER', 'GOLEM', 'SIEGE_CONSTRUCT',
];
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

function resourceTypeForBuilding(buildingType: BuildingType): 'MATERIAL' | 'MANA' | null {
  if (buildingType === 'EXTRACTOR') return 'MATERIAL';
  if (buildingType === 'MANA_WELL') return 'MANA';
  return null;
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
  private commandView: 'build' | 'army' = 'build';
  private message = 'Construction is parallel. Outposts need 10 Influence; capture POIs to fund continued expansion.';
  private pendingBuildType: Exclude<BuildingType, 'ELEMENTAL_CORE'> | null = null;
  private pendingRallyBuildingId: number | null = null;
  private selectedProducerId: number | null = null;
  private pointerInside = false;

  constructor(
    private readonly element: HTMLElement,
    private readonly simulation: M03Simulation,
    private readonly selectedUnits: () => readonly EntitySnapshot[],
    private readonly battlefieldCanvas: HTMLCanvasElement,
    private readonly screenToSimulationPosition: (clientX: number, clientY: number) => { x: number; z: number } | null,
  ) {
    element.addEventListener('click', this.onClick);
    element.addEventListener('pointerenter', this.onPanelPointerEnter);
    element.addEventListener('pointerleave', this.onPanelPointerLeave);
    battlefieldCanvas.addEventListener('pointerdown', this.onBattlefieldPointerDown, true);
    window.addEventListener('keydown', this.onKeyDown);
    this.render();
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    if (this.elapsed < 0.2) return;
    this.elapsed = 0;
    if (this.pointerInside) {
      this.refreshResourceStrip();
      return;
    }
    this.render();
  }

  destroy(): void {
    this.element.removeEventListener('click', this.onClick);
    this.element.removeEventListener('pointerenter', this.onPanelPointerEnter);
    this.element.removeEventListener('pointerleave', this.onPanelPointerLeave);
    this.battlefieldCanvas.removeEventListener('pointerdown', this.onBattlefieldPointerDown, true);
    window.removeEventListener('keydown', this.onKeyDown);
    this.pendingBuildType = null;
    this.pendingRallyBuildingId = null;
    this.updatePlacementCursor();
  }

  private readonly onPanelPointerEnter = (): void => {
    this.pointerInside = true;
  };

  private readonly onPanelPointerLeave = (): void => {
    this.pointerInside = false;
    this.elapsed = 0;
    this.render();
  };

  private refreshResourceStrip(): void {
    const snapshot = this.simulation.strategy.snapshot();
    const stock = snapshot.resources[PLAYER_ID];
    if (!stock) return;
    const values = [
      formatResource(stock.materialMilli),
      formatResource(stock.manaMilli),
      formatResource(stock.influenceMilli),
      `${snapshot.populationUsed[PLAYER_ID] ?? 0}/${snapshot.populationCap[PLAYER_ID] ?? 0}`,
    ];
    const rows = this.element.querySelectorAll<HTMLElement>('.resource-strip b');
    values.forEach((value, index) => {
      const row = rows[index];
      if (!row) return;
      const labelElement = row.querySelector('span');
      if (!labelElement) return;
      const text = row.firstChild;
      if (text?.nodeType === 3) text.textContent = `${value} `;
      else row.insertBefore(document.createTextNode(`${value} `), labelElement);
    });
  }

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-action]') : null;
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === 'command-view' && (target.dataset.value === 'build' || target.dataset.value === 'army')) this.commandView = target.dataset.value;
    else if (action === 'build') this.beginBuild(target.dataset.value as Exclude<BuildingType, 'ELEMENTAL_CORE'>);
    else if (action === 'train') this.queueTrain(target.dataset.value as UnitArchetype);
    else if (action === 'select-producer') this.selectProducer(Number(target.dataset.value));
    else if (action === 'set-rally') this.beginRallyPlacement();
    else if (action === 'capture-poi') this.queueCapturePoi();
    this.render();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape' || (this.pendingBuildType === null && this.pendingRallyBuildingId === null)) return;
    this.cancelPlacementMode();
    this.render();
  };

  private readonly onBattlefieldPointerDown = (event: PointerEvent): void => {
    if (this.pendingBuildType === null && this.pendingRallyBuildingId === null) return;
    if (event.button === 2) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.cancelPlacementMode();
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

    if (this.pendingRallyBuildingId !== null) {
      const buildingId = this.pendingRallyBuildingId;
      this.simulation.enqueueStrategicCommand({
        targetTick: this.simulation.snapshot().tick + 1,
        playerId: PLAYER_ID,
        type: 'SET_RALLY_POINT',
        buildingId,
        targetX: position.x,
        targetZ: position.z,
      });
      this.pendingRallyBuildingId = null;
      this.updatePlacementCursor();
      this.message = `Rally point queued for production building #${buildingId}. New units will move there after spawning.`;
      this.render();
      return;
    }

    const buildingType = this.pendingBuildType;
    if (buildingType === null) return;
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
    if (!event.shiftKey) this.pendingBuildType = null;
    this.updatePlacementCursor();
    const owner = placement.regionId === null ? -1 : this.simulation.strategy.snapshot().regionOwners[placement.regionId];
    const suffix = event.shiftKey ? ' Shift placement remains active for another site.' : ' You can start another building immediately.';
    this.message = placement.resourceNodeId
      ? `Queued ${label(buildingType)} on ${placement.resourceNodeId}.${suffix}`
      : buildingType === 'OUTPOST' && owner !== PLAYER_ID
        ? `Queued Outpost in neutral Region ${(placement.regionId ?? 0) + 1}; completion will claim the territory.${suffix}`
        : `Queued ${label(buildingType)} in Region ${(placement.regionId ?? 0) + 1}.${suffix}`;
    this.render();
  };

  private beginBuild(buildingType: Exclude<BuildingType, 'ELEMENTAL_CORE'>): void {
    const affordability = this.affordabilityMessage(buildingType);
    if (affordability !== null) {
      this.pendingBuildType = null;
      this.pendingRallyBuildingId = null;
      this.updatePlacementCursor();
      this.message = affordability;
      return;
    }
    this.pendingRallyBuildingId = null;
    this.pendingBuildType = buildingType;
    this.updatePlacementCursor();
    this.message = buildingType === 'EXTRACTOR'
      ? 'Place Extractor: click a visible amber Material Deposit in controlled supplied territory. Shift-click keeps placement active; right click or Esc cancels.'
      : buildingType === 'MANA_WELL'
        ? 'Place Mana Well: click a visible violet Mana Spring in controlled supplied territory. Shift-click keeps placement active; right click or Esc cancels.'
        : buildingType === 'OUTPOST'
          ? 'Place Outpost: click controlled territory or a neutral region directly adjacent to supplied territory. Each Outpost costs 10 Influence.'
          : `Place ${label(buildingType)}: left click controlled supplied ground. Shift-click repeats placement; construction runs in parallel.`;
  }

  private affordabilityMessage(buildingType: Exclude<BuildingType, 'ELEMENTAL_CORE'>): string | null {
    const stock = this.simulation.strategy.snapshot().resources[PLAYER_ID];
    if (!stock) return 'Player resource stock is unavailable.';
    const cost = BUILDINGS[buildingType].cost;
    const missing: string[] = [];
    if (stock.materialMilli < cost.material * 1000) missing.push(`${cost.material - Math.floor(stock.materialMilli / 1000)} Material`);
    if (stock.manaMilli < cost.mana * 1000) missing.push(`${cost.mana - Math.floor(stock.manaMilli / 1000)} Mana`);
    if (stock.influenceMilli < cost.influence * 1000) missing.push(`${cost.influence - Math.floor(stock.influenceMilli / 1000)} Influence`);
    if (missing.length === 0) return null;
    if (buildingType === 'OUTPOST' && stock.influenceMilli < cost.influence * 1000) {
      return `Cannot place Outpost: need ${missing.join(', ')}. Capture a POI to gain +10 Influence, then expand into the next adjacent neutral region.`;
    }
    return `Cannot place ${label(buildingType)}: need ${missing.join(', ')}.`;
  }

  private beginRallyPlacement(): void {
    const snapshot = this.simulation.strategy.snapshot();
    const producer = snapshot.buildings.find((building) => (
      building.id === this.selectedProducerId
      && building.playerId === PLAYER_ID
      && building.completed
      && PRODUCER_TYPES.includes(building.type as ProducerBuildingType)
    ));
    if (!producer) {
      this.message = 'Select a completed production building before setting a Rally Point.';
      return;
    }
    this.pendingBuildType = null;
    this.pendingRallyBuildingId = producer.id;
    this.updatePlacementCursor();
    this.message = `Set Rally Point for ${label(producer.type)} #${producer.id}: click any reachable battlefield location. Right click or Esc cancels.`;
  }

  private cancelPlacementMode(): void {
    if (this.pendingRallyBuildingId !== null) {
      this.message = `Rally Point placement cancelled for building #${this.pendingRallyBuildingId}.`;
      this.pendingRallyBuildingId = null;
    } else if (this.pendingBuildType !== null) {
      this.message = `${label(this.pendingBuildType)} placement cancelled.`;
      this.pendingBuildType = null;
    }
    this.updatePlacementCursor();
  }

  private updatePlacementCursor(): void {
    this.battlefieldCanvas.classList.toggle(
      'build-placement-active',
      this.pendingBuildType !== null || this.pendingRallyBuildingId !== null,
    );
  }

  private checkPlacement(buildingType: Exclude<BuildingType, 'ELEMENTAL_CORE'>, targetX: number, targetZ: number): PlacementCheck {
    const world = this.simulation.generatedWorld;
    const snapshot = this.simulation.strategy.snapshot();
    const affordability = this.affordabilityMessage(buildingType);
    if (affordability !== null) {
      return { valid: false, regionId: null, resourceNodeId: null, targetX, targetZ, reason: affordability };
    }

    const resourceType = resourceTypeForBuilding(buildingType);
    if (resourceType !== null) {
      const occupied = new Set(snapshot.buildings.flatMap((building) => building.resourceNodeId ? [building.resourceNodeId] : []));
      const candidates = world.resources
        .filter((resource) => resource.type === resourceType)
        .map((resource) => {
          const position = worldCellToSimulationPosition(world, resource.cell);
          const dx = position.x - targetX;
          const dz = position.z - targetZ;
          return { resource, position, distanceSquared: dx * dx + dz * dz };
        })
        .sort((left, right) => left.distanceSquared - right.distanceSquared || left.resource.id.localeCompare(right.resource.id));
      const chosen = candidates[0];
      const marker = resourceType === 'MATERIAL' ? 'amber Material Deposit' : 'violet Mana Spring';
      const site = resourceType === 'MATERIAL' ? 'Material Deposit' : 'Mana Spring';
      const structure = resourceType === 'MATERIAL' ? 'Extractor' : 'Mana Well';
      if (!chosen || chosen.distanceSquared > RESOURCE_PICK_RADIUS * RESOURCE_PICK_RADIUS) {
        return {
          valid: false, regionId: null, resourceNodeId: null, targetX, targetZ,
          reason: `Click the ${marker} marker itself; placement snaps to the resource site.`,
        };
      }
      const regionId = chosen.resource.regionId;
      if (occupied.has(chosen.resource.id)) {
        return {
          valid: false, regionId, resourceNodeId: chosen.resource.id, targetX, targetZ,
          reason: `That ${site} already has a resource building.`,
        };
      }
      if (snapshot.contestedRegions.includes(regionId)) {
        return {
          valid: false, regionId, resourceNodeId: chosen.resource.id, targetX, targetZ,
          reason: `Region ${regionId + 1} is contested; ${structure} construction is blocked until control stabilizes.`,
        };
      }
      const owner = snapshot.regionOwners[regionId] ?? -1;
      if (owner !== PLAYER_ID) {
        return {
          valid: false, regionId, resourceNodeId: chosen.resource.id, targetX, targetZ,
          reason: owner < 0
            ? `That ${site} is in neutral territory. Build an Outpost to claim Region ${regionId + 1} first.`
            : `That ${site} is in enemy-controlled territory. Claim Region ${regionId + 1} before constructing a ${structure}.`,
        };
      }
      if (!snapshot.suppliedRegions[PLAYER_ID]?.includes(regionId)) {
        return {
          valid: false, regionId, resourceNodeId: chosen.resource.id, targetX, targetZ,
          reason: `That ${site} is in controlled but unsupplied territory. Restore supply before constructing a ${structure}.`,
        };
      }
      return {
        valid: true,
        regionId,
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
        return { valid: false, regionId, resourceNodeId: null, targetX, targetZ, reason: 'Outposts expand one step at a time: choose a neutral region directly adjacent to your supplied territory.' };
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
      this.message = 'Select player units inside a region containing a POI, then press Capture POI.';
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
    this.message = `Capturing ${label(poi.type)} ${poi.id}; completion grants +10 Influence for another Outpost.`;
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
      const rally = building.rallyPointX === null ? 'Auto exit' : 'Rally set';
      return `<button class="${active.trim()}" data-action="select-producer" data-value="${building.id}">${label(building.type)} #${building.id}<small>${speed}% speed · Q${queue} · ${rally}</small></button>`;
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
    return `<div class="strategy-progress"><strong>Work in progress</strong>${construction.join('')}${production.join('')}${hiddenOrders > 0 ? `<small>+${hiddenOrders} more queued</small>` : ''}</div>`;
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
        ? 'Extractor harvests an amber Material Deposit'
        : buildingType === 'MANA_WELL'
          ? 'Mana Well harvests a violet Mana Spring'
          : buildingType === 'OUTPOST'
            ? 'Outpost costs 10 Influence and claims an adjacent neutral region when construction completes'
            : 'Choose this building, then place it inside controlled supplied territory';
      return `<button class="${active.trim()}" data-action="build" data-value="${buildingType}" title="${title}">${label(buildingType)}<small>${cost.material}M${cost.mana ? ` · ${cost.mana}A` : ''}${cost.influence ? ` · ${cost.influence}I` : ''}</small></button>`;
    }).join('');
    const selectedProducer = snapshot.buildings.find((building) => building.id === this.selectedProducerId);
    const trainButtons = TRAIN_ORDER.map((unitType) => {
      const definition = UNITS[unitType];
      const enabled = selectedProducer?.type === definition.producer;
      return `<button data-action="train" data-value="${unitType}" ${enabled ? '' : 'disabled'}>${label(unitType)}<small>${definition.cost.material}M${definition.cost.mana ? ` · ${definition.cost.mana}A` : ''} · P${definition.population}</small></button>`;
    }).join('');
    const rallyActive = this.pendingRallyBuildingId !== null ? ' active' : '';
    const canFundOutpost = stock.materialMilli >= BUILDINGS.OUTPOST.cost.material * 1000
      && stock.influenceMilli >= BUILDINGS.OUTPOST.cost.influence * 1000;
    const expansionHint = canFundOutpost
      ? 'Outpost funded: choose a neutral region directly adjacent to supplied territory.'
      : `Next Outpost needs 180 Material + 10 Influence. Current Influence: ${formatResource(stock.influenceMilli)}. Capture a POI for +10 Influence.`;
    const selected = this.selectedUnits().filter((unit) => unit.alive && unit.playerId === PLAYER_ID);
    const hp = selected.reduce((sum, unit) => sum + unit.currentHealth, 0);
    const maxHp = selected.reduce((sum, unit) => sum + unit.maxHealth, 0);
    const roles = [...new Set(selected.map((unit) => label(unit.archetype)))];
    const selectedMarkup = `<div class="selection-card"><small>SELECTION</small><strong>${selected.length ? `${selected.length} ${selected.length === 1 ? 'unit' : 'units'}` : 'No units selected'}</strong><span>${selected.length ? roles.join(' · ') : 'Click a unit or drag a selection box.'}</span>${maxHp ? `<div class="selection-health" role="meter" aria-label="Selected army health" aria-valuemin="0" aria-valuemax="${maxHp}" aria-valuenow="${hp}"><i style="width:${100 * hp / maxHp}%"></i></div><small>${hp} / ${maxHp} HP</small>` : ''}</div>`;
    this.element.dataset.view = this.commandView;
    this.element.innerHTML = `
      <div class="strategy-title">FIELD COMMAND</div>
      <div class="resource-strip">
        <b>${formatResource(stock.materialMilli)} <span>Material</span></b>
        <b>${formatResource(stock.manaMilli)} <span>Mana</span></b>
        <b>${formatResource(stock.influenceMilli)} <span>Influence</span></b>
        <b>${snapshot.populationUsed[PLAYER_ID] ?? 0}/${snapshot.populationCap[PLAYER_ID] ?? 0} <span>Population</span></b>
      </div>
      <div class="resource-key"><span class="material-dot"></span>Amber Deposit → Extractor <span class="mana-dot"></span>Violet Mana Spring → Mana Well</div>
      <div class="strategy-meta">Territory ${owned}/${snapshot.regionOwners.length} · Supplied ${supplied} · Contested ${snapshot.contestedRegions.length}</div>
      ${selectedMarkup}
      <nav class="command-tabs" aria-label="Command category"><button data-action="command-view" data-value="build" aria-pressed="${this.commandView === 'build'}">Construction</button><button data-action="command-view" data-value="army" aria-pressed="${this.commandView === 'army'}">Army & Production</button></nav>
      <div class="army-view">${this.armyMarkup(simulationSnapshot)}</div>
      ${this.queueMarkup(simulationSnapshot.tick, snapshot)}
      <div class="strategy-section build-view"><strong>Construct</strong><div class="strategy-buttons">${buildingButtons}</div><small>Each site progresses independently. Shift-click the battlefield to place another building of the same type.</small></div>
      <div class="strategy-section army-view"><strong>Recruit</strong>${this.producerMarkup(snapshot)}<div class="strategy-buttons compact">${trainButtons}</div><div class="strategy-buttons"><button class="${rallyActive.trim()}" data-action="set-rally" ${selectedProducer ? '' : 'disabled'}>Set Rally Point</button></div></div>
      <div class="strategy-message" aria-live="polite">${this.message}</div>
      <div class="strategy-section territory-info"><strong>Expansion</strong><small>${expansionHint}</small><div class="strategy-buttons">
        <button data-action="capture-poi">Capture POI (+10 Influence)</button>
      </div></div>
    `;
  }
}
