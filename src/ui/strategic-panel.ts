import type { EntitySnapshot } from '../simulation/simulation';
import { M03Simulation } from '../simulation/m03-simulation';
import { BUILDINGS, UNITS, type BuildingType, type OutpostSpecialization } from '../simulation/m03-content';
import type { UnitArchetype } from '../simulation/components';
import { WorldCellFlag } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';

const PLAYER_ID = 0;
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

export class StrategicPanel {
  private elapsed = 0;
  private message = 'Select units, move into a region, then capture or expand.';

  constructor(
    private readonly element: HTMLElement,
    private readonly simulation: M03Simulation,
    private readonly selectedUnits: () => readonly EntitySnapshot[],
  ) {
    element.addEventListener('click', this.onClick);
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
  }

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-action]') : null;
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === 'build') this.queueBuild(target.dataset.value as BuildingType);
    else if (action === 'train') this.queueTrain(target.dataset.value as UnitArchetype);
    else if (action === 'capture-region') this.queueCaptureRegion();
    else if (action === 'capture-poi') this.queueCapturePoi();
    else if (action === 'specialize') this.queueSpecialization(target.dataset.value as OutpostSpecialization);
    this.render();
  };

  private queueBuild(buildingType: BuildingType): void {
    const tick = this.simulation.snapshot().tick + 1;
    if (buildingType === 'EXTRACTOR') {
      const target = this.findExtractorTarget();
      if (!target) {
        this.message = 'No available controlled Material Deposit is ready for an Extractor.';
        return;
      }
      const position = worldCellToSimulationPosition(this.simulation.generatedWorld, target.cell);
      this.simulation.enqueueStrategicCommand({
        targetTick: tick,
        playerId: PLAYER_ID,
        type: 'BUILD',
        buildingType,
        targetX: position.x,
        targetZ: position.z,
        resourceNodeId: target.id,
      });
      this.message = `Queued Extractor on ${target.id}.`;
      return;
    }
    const cell = this.findBuildCell(buildingType);
    if (!cell) {
      this.message = `No valid controlled region currently supports ${label(buildingType)}.`;
      return;
    }
    const position = worldCellToSimulationPosition(this.simulation.generatedWorld, cell);
    this.simulation.enqueueStrategicCommand({
      targetTick: tick,
      playerId: PLAYER_ID,
      type: 'BUILD',
      buildingType,
      targetX: position.x,
      targetZ: position.z,
    });
    this.message = `Queued ${label(buildingType)} construction.`;
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

  private findBuildCell(buildingType: BuildingType): { x: number; z: number } | null {
    const world = this.simulation.generatedWorld;
    const snapshot = this.simulation.strategy.snapshot();
    const selectedRegion = this.selectedRegion(this.selectedUnits());
    const coreRegion = snapshot.buildings.find((building) => building.playerId === PLAYER_ID && building.type === 'ELEMENTAL_CORE')?.regionId;
    const preferred = [selectedRegion, coreRegion, ...(snapshot.suppliedRegions[PLAYER_ID] ?? [])]
      .filter((regionId): regionId is number => regionId !== null && regionId !== undefined);
    const regionIds = [...new Set(preferred)];
    const occupiedCells = new Set(snapshot.buildings.map((building) => {
      const cell = this.simulation.navigation.worldToCell(building.x, building.z);
      return `${cell.column},${cell.row}`;
    }));
    const hasOutpost = new Set(snapshot.buildings.filter((building) => building.playerId === PLAYER_ID && building.type === 'OUTPOST').map((building) => building.regionId));

    for (const regionId of regionIds) {
      if (snapshot.regionOwners[regionId] !== PLAYER_ID) continue;
      const supplied = snapshot.suppliedRegions[PLAYER_ID]?.includes(regionId) === true;
      const neighborSupplied = world.regions[regionId]?.neighbors.some((neighbor) => snapshot.suppliedRegions[PLAYER_ID]?.includes(neighbor)) === true;
      if (buildingType === 'OUTPOST') {
        if (hasOutpost.has(regionId) || (!supplied && !neighborSupplied)) continue;
      } else if (!supplied) continue;
      const center = world.regions[regionId]?.center;
      if (!center) continue;
      const candidates: Array<{ x: number; z: number; distance: number }> = [];
      for (let z = 0; z < world.height; z += 1) {
        for (let x = 0; x < world.width; x += 1) {
          const index = z * world.width + x;
          if (world.regionByCell[index] !== regionId || ((world.flags[index] ?? 0) & WorldCellFlag.BUILDABLE) === 0) continue;
          if (occupiedCells.has(`${x},${z}`)) continue;
          const dx = x - center.x;
          const dz = z - center.z;
          candidates.push({ x, z, distance: dx * dx + dz * dz });
        }
      }
      candidates.sort((left, right) => left.distance - right.distance || left.z - right.z || left.x - right.x);
      const candidate = candidates[0];
      if (candidate) return { x: candidate.x, z: candidate.z };
    }
    return null;
  }

  private selectedRegion(units: readonly EntitySnapshot[]): number | null {
    const unit = units.find((candidate) => candidate.playerId === PLAYER_ID && candidate.alive);
    if (!unit) return null;
    const cell = this.simulation.navigation.worldToCell(unit.x, unit.z);
    if (cell.column < 0 || cell.row < 0 || cell.column >= this.simulation.generatedWorld.width || cell.row >= this.simulation.generatedWorld.height) return null;
    return this.simulation.generatedWorld.regionByCell[cell.row * this.simulation.generatedWorld.width + cell.column] ?? null;
  }

  private render(): void {
    const snapshot = this.simulation.strategy.snapshot();
    const stock = snapshot.resources[PLAYER_ID];
    if (!stock) return;
    const owned = snapshot.regionOwners.filter((owner) => owner === PLAYER_ID).length;
    const supplied = snapshot.suppliedRegions[PLAYER_ID]?.length ?? 0;
    const buildingButtons = BUILD_ORDER.map((buildingType) => {
      const cost = BUILDINGS[buildingType].cost;
      return `<button data-action="build" data-value="${buildingType}" title="Build near selected controlled region">${label(buildingType)}<small>${cost.material}M${cost.mana ? ` · ${cost.mana}A` : ''}${cost.influence ? ` · ${cost.influence}I` : ''}</small></button>`;
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
