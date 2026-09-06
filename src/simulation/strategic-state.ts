import type {
  BuildCommand,
  CaptureCommand,
  SpecializeOutpostCommand,
  StrategicCommand,
  TrainCommand,
} from './commands';
import type { EntityID, PlayerID, UnitArchetype } from './components';
import type { EntityStore } from './entity-store';
import type { NavigationGrid } from './navigation';
import {
  BASE_POPULATION_CAP,
  BUILDINGS,
  CAPTURE_BASE_TICKS,
  CAPTURE_POWER_CAP_TENTHS,
  OUTPOST_POPULATION_CAP,
  STARTING_RESOURCES,
  UNITS,
  type BuildingType,
  type OutpostSpecialization,
  type ResourceCost,
} from './m03-content';
import { WorldCellFlag, type GeneratedWorld, type GridPoint, type PointOfInterest, type ResourceNode } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';

const RESOURCE_SCALE = 1000;
const NEUTRAL_OWNER = 255;
const CAPTURE_THRESHOLD_TENTHS = CAPTURE_BASE_TICKS * 10;
const CORE_MATERIAL_MILLI_PER_TICK = 300;
const CORE_MANA_MILLI_PER_TICK = 50;
const MATERIAL_NORMAL_MILLI_PER_TICK = 500;
const MATERIAL_RICH_MILLI_PER_TICK = 800;
const MANA_NORMAL_MILLI_PER_TICK = 200;
const MANA_RICH_MILLI_PER_TICK = 300;
const DISCONNECTED_MATERIAL_PERMILLE = 400;
const DISCONNECTED_MANA_PERMILLE = 500;
const INFLUENCE_CAPTURE_REWARD_MILLI = 10 * RESOURCE_SCALE;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

interface ResourceStock {
  materialMilli: number;
  manaMilli: number;
  influenceMilli: number;
}

export interface StrategicBuilding {
  id: number;
  playerId: PlayerID;
  type: BuildingType;
  x: number;
  z: number;
  regionId: number;
  completeTick: number;
  completed: boolean;
  resourceNodeId: string | null;
  specialization: OutpostSpecialization | null;
}

interface ProductionOrder {
  id: number;
  buildingId: number;
  playerId: PlayerID;
  unitType: UnitArchetype;
  completeTick: number;
}

interface CaptureOrder {
  playerId: PlayerID;
  entityIds: readonly EntityID[];
  targetRegionId: number | null;
  targetPoiId: string | null;
  progressTenths: number;
}

export interface StrategicResourcesSnapshot {
  materialMilli: number;
  manaMilli: number;
  influenceMilli: number;
}

export interface StrategicSnapshot {
  stateHash: string;
  resources: Readonly<Record<number, StrategicResourcesSnapshot>>;
  populationUsed: Readonly<Record<number, number>>;
  populationCap: Readonly<Record<number, number>>;
  regionOwners: readonly number[];
  contestedRegions: readonly number[];
  suppliedRegions: Readonly<Record<number, readonly number[]>>;
  poiOwners: Readonly<Record<string, number>>;
  buildings: readonly StrategicBuilding[];
  productionQueue: readonly {
    id: number;
    buildingId: number;
    playerId: number;
    unitType: UnitArchetype;
    completeTick: number;
  }[];
  captureOrders: readonly {
    playerId: number;
    entityIds: readonly number[];
    targetRegionId: number | null;
    targetPoiId: string | null;
    progressTenths: number;
  }[];
}

function cloneStock(stock: ResourceStock): StrategicResourcesSnapshot {
  return { ...stock };
}

function scaledCost(cost: ResourceCost): ResourceStock {
  return {
    materialMilli: cost.material * RESOURCE_SCALE,
    manaMilli: cost.mana * RESOURCE_SCALE,
    influenceMilli: cost.influence * RESOURCE_SCALE,
  };
}

function hashInteger(hash: number, value: number): number {
  let result = hash;
  const normalized = value | 0;
  for (let shift = 0; shift < 32; shift += 8) {
    result ^= (normalized >>> shift) & 0xff;
    result = Math.imul(result, FNV_PRIME);
  }
  return result >>> 0;
}

function hashString(hash: number, value: string): number {
  let result = hashInteger(hash, value.length);
  for (const character of value) result = hashInteger(result, character.charCodeAt(0));
  return result;
}

function squaredDistance(left: { x: number; z: number }, right: { x: number; z: number }): number {
  const dx = left.x - right.x;
  const dz = left.z - right.z;
  return dx * dx + dz * dz;
}

export class StrategicState {
  private readonly stocks = new Map<PlayerID, ResourceStock>();
  private readonly buildings = new Map<number, StrategicBuilding>();
  private readonly productionOrders: ProductionOrder[] = [];
  private readonly captureOrders = new Map<string, CaptureOrder>();
  private readonly regionOwners: Uint8Array;
  private contestedRegions = new Uint8Array(0);
  private readonly suppliedByPlayer = new Map<PlayerID, Set<number>>();
  private readonly poiOwners = new Map<string, PlayerID>();
  private nextBuildingId = 1;
  private nextProductionOrderId = 1;

  constructor(
    readonly world: GeneratedWorld,
    private readonly entities: EntityStore,
    private readonly navigation: NavigationGrid,
  ) {
    this.regionOwners = new Uint8Array(world.regions.length);
    this.regionOwners.fill(NEUTRAL_OWNER);
    this.contestedRegions = new Uint8Array(world.regions.length);
    const playerSpawn = world.spawns.find((spawn) => spawn.id === 'PLAYER');
    const enemySpawn = world.spawns.find((spawn) => spawn.id === 'ENEMY');
    if (!playerSpawn || !enemySpawn) throw new Error('M03 requires player and enemy generated-world spawns.');
    this.ensurePlayer(0);
    this.ensurePlayer(1);
    this.regionOwners[playerSpawn.regionId] = 0;
    this.regionOwners[enemySpawn.regionId] = 1;
    this.createCore(0, playerSpawn.cell, playerSpawn.regionId);
    this.createCore(1, enemySpawn.cell, enemySpawn.regionId);
    this.recomputeTerritoryAndSupply();
  }

  processCommand(command: StrategicCommand, tick: number): boolean {
    if (command.type === 'BUILD') return this.processBuild(command, tick);
    if (command.type === 'TRAIN') return this.processTrain(command, tick);
    if (command.type === 'CAPTURE') return this.processCapture(command);
    return this.processSpecialization(command);
  }

  advanceEconomy(tick: number): void {
    this.completeBuildings(tick);
    this.completeProduction(tick);
    for (const playerId of this.playerIds()) {
      const stock = this.ensurePlayer(playerId);
      stock.materialMilli += CORE_MATERIAL_MILLI_PER_TICK;
      stock.manaMilli += CORE_MANA_MILLI_PER_TICK;
    }
    for (const building of this.sortedBuildings()) {
      if (!building.completed || building.type !== 'EXTRACTOR' || building.resourceNodeId === null) continue;
      if (this.ownerOfRegion(building.regionId) !== building.playerId) continue;
      const node = this.world.resources.find((candidate) => candidate.id === building.resourceNodeId);
      if (!node || node.type !== 'MATERIAL') continue;
      const connected = this.isRegionSupplied(building.playerId, building.regionId);
      const base = node.rich ? MATERIAL_RICH_MILLI_PER_TICK : MATERIAL_NORMAL_MILLI_PER_TICK;
      const income = connected ? base : Math.floor((base * DISCONNECTED_MATERIAL_PERMILLE) / 1000);
      this.ensurePlayer(building.playerId).materialMilli += income;
    }
    for (const node of this.world.resources) {
      if (node.type !== 'MANA') continue;
      const owner = this.ownerOfRegion(node.regionId);
      if (owner === null) continue;
      const connected = this.isRegionSupplied(owner, node.regionId);
      const base = node.rich ? MANA_RICH_MILLI_PER_TICK : MANA_NORMAL_MILLI_PER_TICK;
      const income = connected ? base : Math.floor((base * DISCONNECTED_MANA_PERMILLE) / 1000);
      this.ensurePlayer(owner).manaMilli += income;
    }
  }

  advanceTerritory(): void {
    const ordered = [...this.captureOrders.entries()].sort(([left], [right]) => left.localeCompare(right));
    for (const [key, order] of ordered) {
      const regionId = order.targetRegionId ?? this.poiById(order.targetPoiId)?.regionId;
      if (regionId === undefined || regionId === null) {
        this.captureOrders.delete(key);
        continue;
      }
      const capturePower = Math.min(CAPTURE_POWER_CAP_TENTHS, this.capturePowerInRegion(order, regionId));
      if (capturePower <= 0) continue;
      const effectivePower = this.contestedRegions[regionId] === 1 ? Math.max(1, Math.floor(capturePower / 2)) : capturePower;
      order.progressTenths += effectivePower;
      if (order.progressTenths < CAPTURE_THRESHOLD_TENTHS) continue;
      if (order.targetRegionId !== null) {
        this.regionOwners[order.targetRegionId] = order.playerId;
      } else if (order.targetPoiId !== null && this.poiOwners.get(order.targetPoiId) !== order.playerId) {
        this.poiOwners.set(order.targetPoiId, order.playerId);
        this.ensurePlayer(order.playerId).influenceMilli += INFLUENCE_CAPTURE_REWARD_MILLI;
      }
      this.captureOrders.delete(key);
      this.recomputeTerritoryAndSupply();
    }
    this.recomputeTerritoryAndSupply();
  }

  snapshot(): StrategicSnapshot {
    const resources: Record<number, StrategicResourcesSnapshot> = {};
    const populationUsed: Record<number, number> = {};
    const populationCap: Record<number, number> = {};
    const suppliedRegions: Record<number, readonly number[]> = {};
    for (const playerId of this.playerIds()) {
      resources[playerId] = cloneStock(this.ensurePlayer(playerId));
      populationUsed[playerId] = this.populationUsed(playerId);
      populationCap[playerId] = this.populationCap(playerId);
      suppliedRegions[playerId] = [...(this.suppliedByPlayer.get(playerId) ?? new Set<number>())].sort((a, b) => a - b);
    }
    const poiOwners: Record<string, number> = {};
    for (const [poiId, owner] of [...this.poiOwners.entries()].sort(([a], [b]) => a.localeCompare(b))) poiOwners[poiId] = owner;
    const captureOrders = [...this.captureOrders.values()]
      .sort((left, right) => this.captureOrderKey(left).localeCompare(this.captureOrderKey(right)))
      .map((order) => ({ ...order, entityIds: [...order.entityIds] }));
    const snapshotWithoutHash = {
      resources,
      populationUsed,
      populationCap,
      regionOwners: [...this.regionOwners].map((owner) => owner === NEUTRAL_OWNER ? -1 : owner),
      contestedRegions: [...this.contestedRegions].flatMap((value, index) => value === 1 ? [index] : []),
      suppliedRegions,
      poiOwners,
      buildings: this.sortedBuildings().map((building) => ({ ...building })),
      productionQueue: [...this.productionOrders]
        .sort((left, right) => left.completeTick - right.completeTick || left.id - right.id)
        .map((order) => ({ ...order })),
      captureOrders,
    };
    return { stateHash: this.computeHash(snapshotWithoutHash), ...snapshotWithoutHash };
  }

  ownerOfRegion(regionId: number): PlayerID | null {
    const owner = this.regionOwners[regionId];
    return owner === undefined || owner === NEUTRAL_OWNER ? null : owner;
  }

  isRegionSupplied(playerId: PlayerID, regionId: number): boolean {
    return this.suppliedByPlayer.get(playerId)?.has(regionId) === true;
  }

  private processBuild(command: BuildCommand, tick: number): boolean {
    if (command.buildingType === 'ELEMENTAL_CORE') return false;
    const requestedCell = this.navigation.worldToCell(command.targetX, command.targetZ);
    if (!this.inWorld(requestedCell.column, requestedCell.row)) return false;
    let cell = { x: requestedCell.column, z: requestedCell.row };
    let resourceNode: ResourceNode | undefined;
    if (command.buildingType === 'EXTRACTOR') {
      if (command.resourceNodeId === undefined) return false;
      resourceNode = this.world.resources.find((candidate) => candidate.id === command.resourceNodeId && candidate.type === 'MATERIAL');
      if (!resourceNode) return false;
      cell = resourceNode.cell;
      if (this.sortedBuildings().some((building) => building.type === 'EXTRACTOR' && building.resourceNodeId === resourceNode?.id)) return false;
    }
    const cellIndex = cell.z * this.world.width + cell.x;
    const cellFlags = this.world.flags[cellIndex] ?? 0;
    if (command.buildingType === 'EXTRACTOR') {
      if ((cellFlags & WorldCellFlag.WALKABLE) === 0) return false;
    } else if ((cellFlags & WorldCellFlag.BUILDABLE) === 0) {
      return false;
    }
    const regionId = this.world.regionByCell[cellIndex];
    if (regionId === undefined || this.ownerOfRegion(regionId) !== command.playerId || this.contestedRegions[regionId] === 1) return false;
    if (command.buildingType === 'OUTPOST') {
      if (this.sortedBuildings().some((building) => building.playerId === command.playerId && building.type === 'OUTPOST' && building.regionId === regionId)) return false;
      const supplied = this.isRegionSupplied(command.playerId, regionId);
      const neighborSupplied = this.world.regions[regionId]?.neighbors.some((neighbor) => this.isRegionSupplied(command.playerId, neighbor)) === true;
      if (!supplied && !neighborSupplied) return false;
    } else if (!this.isRegionSupplied(command.playerId, regionId)) {
      return false;
    }
    const position = worldCellToSimulationPosition(this.world, cell);
    const occupied = this.sortedBuildings().some((building) => this.navigation.cellKey(this.navigation.worldToCell(building.x, building.z)) === this.navigation.cellKey({ column: cell.x, row: cell.z }));
    if (occupied) return false;
    const definition = BUILDINGS[command.buildingType];
    if (!this.spend(command.playerId, definition.cost)) return false;
    const building: StrategicBuilding = {
      id: this.nextBuildingId,
      playerId: command.playerId,
      type: command.buildingType,
      x: position.x,
      z: position.z,
      regionId,
      completeTick: tick + definition.buildTicks,
      completed: definition.buildTicks === 0,
      resourceNodeId: resourceNode?.id ?? null,
      specialization: null,
    };
    this.buildings.set(building.id, building);
    this.nextBuildingId += 1;
    return true;
  }

  private processTrain(command: TrainCommand, tick: number): boolean {
    const building = this.buildings.get(command.buildingId);
    const definition = UNITS[command.unitType];
    if (!building || !building.completed || building.playerId !== command.playerId || building.type !== definition.producer) return false;
    if (!this.isRegionSupplied(command.playerId, building.regionId)) return false;
    const committedPopulation = this.populationUsed(command.playerId) + this.queuedPopulation(command.playerId);
    if (committedPopulation + definition.population > this.populationCap(command.playerId)) return false;
    if (!this.spend(command.playerId, definition.cost)) return false;
    const lastAtBuilding = this.productionOrders
      .filter((order) => order.buildingId === building.id)
      .reduce((latest, order) => Math.max(latest, order.completeTick), tick);
    this.productionOrders.push({
      id: this.nextProductionOrderId,
      buildingId: building.id,
      playerId: command.playerId,
      unitType: command.unitType,
      completeTick: Math.max(tick, lastAtBuilding) + definition.trainTicks,
    });
    this.nextProductionOrderId += 1;
    return true;
  }

  private processCapture(command: CaptureCommand): boolean {
    if (command.targetRegionId !== undefined && (command.targetRegionId < 0 || command.targetRegionId >= this.world.regions.length)) return false;
    if (command.targetPoiId !== undefined && !this.poiById(command.targetPoiId)) return false;
    const entityIds = command.entityIds.filter((entityId) => this.entities.hasUnit(entityId) && this.entities.factions.get(entityId)?.playerId === command.playerId);
    if (entityIds.length === 0) return false;
    if (command.targetRegionId !== undefined && this.ownerOfRegion(command.targetRegionId) === command.playerId) return false;
    if (command.targetPoiId !== undefined && this.poiOwners.get(command.targetPoiId) === command.playerId) return false;
    const order: CaptureOrder = {
      playerId: command.playerId,
      entityIds: [...entityIds].sort((a, b) => a - b),
      targetRegionId: command.targetRegionId ?? null,
      targetPoiId: command.targetPoiId ?? null,
      progressTenths: 0,
    };
    this.captureOrders.set(this.captureOrderKey(order), order);
    return true;
  }

  private processSpecialization(command: SpecializeOutpostCommand): boolean {
    const building = this.buildings.get(command.buildingId);
    if (!building || !building.completed || building.type !== 'OUTPOST' || building.playerId !== command.playerId) return false;
    if (building.specialization !== null) return false;
    building.specialization = command.specialization;
    return true;
  }

  private createCore(playerId: PlayerID, cell: GridPoint, regionId: number): void {
    const position = worldCellToSimulationPosition(this.world, cell);
    const building: StrategicBuilding = {
      id: this.nextBuildingId,
      playerId,
      type: 'ELEMENTAL_CORE',
      x: position.x,
      z: position.z,
      regionId,
      completeTick: 0,
      completed: true,
      resourceNodeId: null,
      specialization: null,
    };
    this.buildings.set(building.id, building);
    this.nextBuildingId += 1;
  }

  private completeBuildings(tick: number): void {
    let changed = false;
    for (const building of this.sortedBuildings()) {
      if (!building.completed && tick >= building.completeTick) {
        building.completed = true;
        changed = true;
      }
    }
    if (changed) this.recomputeTerritoryAndSupply();
  }

  private completeProduction(tick: number): void {
    const due = this.productionOrders
      .filter((order) => order.completeTick <= tick)
      .sort((left, right) => left.completeTick - right.completeTick || left.id - right.id);
    if (due.length === 0) return;
    const dueIds = new Set(due.map((order) => order.id));
    for (let index = this.productionOrders.length - 1; index >= 0; index -= 1) {
      const order = this.productionOrders[index];
      if (order && dueIds.has(order.id)) this.productionOrders.splice(index, 1);
    }
    for (const order of due) {
      const building = this.buildings.get(order.buildingId);
      if (!building || !building.completed || building.playerId !== order.playerId) continue;
      const definition = UNITS[order.unitType];
      const offset = ((order.id % 5) - 2) * 180;
      this.entities.createUnit({
        archetype: order.unitType,
        playerId: order.playerId,
        x: building.x + offset,
        z: building.z + ((order.id % 3) - 1) * 180,
        ...definition.spawn,
      });
    }
  }

  private recomputeTerritoryAndSupply(): void {
    this.contestedRegions.fill(0);
    for (const region of this.world.regions) {
      const center = worldCellToSimulationPosition(this.world, region.center);
      const influencers = new Set<PlayerID>();
      for (const building of this.sortedBuildings()) {
        if (!building.completed || (building.type !== 'ELEMENTAL_CORE' && building.type !== 'OUTPOST')) continue;
        const radius = building.type === 'ELEMENTAL_CORE' ? 24_000 : 18_000;
        if (squaredDistance(center, building) <= radius * radius) influencers.add(building.playerId);
      }
      if (influencers.size > 1) this.contestedRegions[region.id] = 1;
    }
    this.suppliedByPlayer.clear();
    for (const playerId of this.playerIds()) {
      const core = this.sortedBuildings().find((building) => building.playerId === playerId && building.type === 'ELEMENTAL_CORE' && building.completed);
      const supplied = new Set<number>();
      if (core && this.ownerOfRegion(core.regionId) === playerId) {
        const frontier = [core.regionId];
        supplied.add(core.regionId);
        while (frontier.length > 0) {
          const regionId = frontier.shift();
          if (regionId === undefined) break;
          const neighbors = [...(this.world.regions[regionId]?.neighbors ?? [])].sort((a, b) => a - b);
          for (const neighbor of neighbors) {
            if (supplied.has(neighbor) || this.ownerOfRegion(neighbor) !== playerId) continue;
            supplied.add(neighbor);
            frontier.push(neighbor);
          }
        }
      }
      this.suppliedByPlayer.set(playerId, supplied);
    }
  }

  private capturePowerInRegion(order: CaptureOrder, regionId: number): number {
    let power = 0;
    for (const entityId of order.entityIds) {
      if (!this.entities.hasUnit(entityId) || this.entities.factions.get(entityId)?.playerId !== order.playerId) continue;
      const position = this.entities.positions.get(entityId);
      const archetype = this.entities.archetypes.get(entityId);
      if (!position || !archetype) continue;
      const cell = this.navigation.worldToCell(position.x, position.z);
      if (!this.inWorld(cell.column, cell.row)) continue;
      const currentRegion = this.world.regionByCell[cell.row * this.world.width + cell.column];
      if (currentRegion === regionId) power += UNITS[archetype].capturePowerTenths;
    }
    return power;
  }

  private populationUsed(playerId: PlayerID): number {
    let used = 0;
    for (const entityId of this.entities.entityIds()) {
      if (!this.entities.hasUnit(entityId) || this.entities.factions.get(entityId)?.playerId !== playerId) continue;
      const archetype = this.entities.archetypes.get(entityId);
      if (archetype) used += UNITS[archetype].population;
    }
    return used;
  }

  private populationCap(playerId: PlayerID): number {
    const connectedOutposts = this.sortedBuildings().filter((building) => (
      building.playerId === playerId
      && building.type === 'OUTPOST'
      && building.completed
      && this.ownerOfRegion(building.regionId) === playerId
      && this.isRegionSupplied(playerId, building.regionId)
    )).length;
    return BASE_POPULATION_CAP + connectedOutposts * OUTPOST_POPULATION_CAP;
  }

  private queuedPopulation(playerId: PlayerID): number {
    return this.productionOrders
      .filter((order) => order.playerId === playerId)
      .reduce((total, order) => total + UNITS[order.unitType].population, 0);
  }

  private spend(playerId: PlayerID, cost: ResourceCost): boolean {
    const stock = this.ensurePlayer(playerId);
    const scaled = scaledCost(cost);
    if (stock.materialMilli < scaled.materialMilli || stock.manaMilli < scaled.manaMilli || stock.influenceMilli < scaled.influenceMilli) return false;
    stock.materialMilli -= scaled.materialMilli;
    stock.manaMilli -= scaled.manaMilli;
    stock.influenceMilli -= scaled.influenceMilli;
    return true;
  }

  private ensurePlayer(playerId: PlayerID): ResourceStock {
    let stock = this.stocks.get(playerId);
    if (!stock) {
      stock = {
        materialMilli: STARTING_RESOURCES.material * RESOURCE_SCALE,
        manaMilli: STARTING_RESOURCES.mana * RESOURCE_SCALE,
        influenceMilli: STARTING_RESOURCES.influence * RESOURCE_SCALE,
      };
      this.stocks.set(playerId, stock);
    }
    return stock;
  }

  private playerIds(): PlayerID[] {
    return [...this.stocks.keys()].sort((a, b) => a - b);
  }

  private sortedBuildings(): StrategicBuilding[] {
    return [...this.buildings.values()].sort((a, b) => a.id - b.id);
  }

  private poiById(poiId: string | null): PointOfInterest | undefined {
    return poiId === null ? undefined : this.world.pois.find((poi) => poi.id === poiId);
  }

  private captureOrderKey(order: CaptureOrder): string {
    return `${order.playerId}:${order.targetRegionId === null ? `poi:${order.targetPoiId}` : `region:${order.targetRegionId}`}`;
  }

  private inWorld(column: number, row: number): boolean {
    return column >= 0 && row >= 0 && column < this.world.width && row < this.world.height;
  }

  private computeHash(snapshot: Omit<StrategicSnapshot, 'stateHash'>): string {
    let hash = FNV_OFFSET;
    for (const playerId of Object.keys(snapshot.resources).map(Number).sort((a, b) => a - b)) {
      const stock = snapshot.resources[playerId];
      if (!stock) continue;
      hash = hashInteger(hash, playerId);
      hash = hashInteger(hash, stock.materialMilli);
      hash = hashInteger(hash, stock.manaMilli);
      hash = hashInteger(hash, stock.influenceMilli);
      hash = hashInteger(hash, snapshot.populationUsed[playerId] ?? 0);
      hash = hashInteger(hash, snapshot.populationCap[playerId] ?? 0);
      for (const regionId of snapshot.suppliedRegions[playerId] ?? []) hash = hashInteger(hash, regionId);
    }
    for (const owner of snapshot.regionOwners) hash = hashInteger(hash, owner);
    for (const regionId of snapshot.contestedRegions) hash = hashInteger(hash, regionId);
    for (const [poiId, owner] of Object.entries(snapshot.poiOwners).sort(([a], [b]) => a.localeCompare(b))) {
      hash = hashString(hash, poiId);
      hash = hashInteger(hash, owner);
    }
    for (const building of snapshot.buildings) {
      hash = hashInteger(hash, building.id);
      hash = hashInteger(hash, building.playerId);
      hash = hashString(hash, building.type);
      hash = hashInteger(hash, building.x);
      hash = hashInteger(hash, building.z);
      hash = hashInteger(hash, building.regionId);
      hash = hashInteger(hash, building.completeTick);
      hash = hashInteger(hash, building.completed ? 1 : 0);
      hash = hashString(hash, building.resourceNodeId ?? '');
      hash = hashString(hash, building.specialization ?? '');
    }
    for (const order of snapshot.productionQueue) {
      hash = hashInteger(hash, order.id);
      hash = hashInteger(hash, order.buildingId);
      hash = hashInteger(hash, order.playerId);
      hash = hashString(hash, order.unitType);
      hash = hashInteger(hash, order.completeTick);
    }
    for (const order of snapshot.captureOrders) {
      hash = hashInteger(hash, order.playerId);
      for (const entityId of order.entityIds) hash = hashInteger(hash, entityId);
      hash = hashInteger(hash, order.targetRegionId ?? -1);
      hash = hashString(hash, order.targetPoiId ?? '');
      hash = hashInteger(hash, order.progressTenths);
    }
    return hash.toString(16).padStart(8, '0');
  }
}
