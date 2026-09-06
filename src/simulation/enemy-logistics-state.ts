import type { UnitArchetype } from './components';
import { BUILDINGS, UNITS, type BuildingType } from './m03-content';
import type { M03Command } from './m03-commands';
import type { StrategicSnapshot } from './strategic-state';
import type { EnemyFaction } from './m05-content';
import { WorldCellFlag, type GeneratedWorld, type GridPoint } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';

const ENEMY_PLAYER_ID = 1;
const PLAN_INTERVAL_TICKS = 50;
const RESOURCE_SCALE = 1000;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const FACTION_PRODUCTION: Readonly<Record<EnemyFaction, {
  producer: BuildingType;
  cycle: readonly UnitArchetype[];
}>> = {
  IRON_LEGION: {
    producer: 'BARRACKS',
    cycle: ['SPEAR_GUARD', 'VANGUARD', 'RANGER', 'SPEAR_GUARD'],
  },
  FLAME_CULT: {
    producer: 'ARCANE_TOWER',
    cycle: ['ELEMENTALIST', 'ELEMENTALIST', 'ELEMENTALIST'],
  },
  WILD_HORDE: {
    producer: 'BARRACKS',
    cycle: ['SCOUT', 'VANGUARD', 'RANGER', 'SCOUT'],
  },
};

export type EnemyLogisticsAction = 'IDLE' | 'BUILD_PRODUCER' | 'TRAIN';

export interface EnemyLogisticsSnapshot {
  stateHash: string;
  producerType: BuildingType;
  productionCycleIndex: number;
  nextPlanTick: number;
  lastAction: EnemyLogisticsAction;
  lastUnitType: UnitArchetype | null;
  lastBuildingId: number | null;
  commandCount: number;
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
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index) & 0xff;
    result = Math.imul(result, FNV_PRIME);
  }
  return result >>> 0;
}

function canAfford(
  resources: { materialMilli: number; manaMilli: number; influenceMilli: number },
  cost: { material: number; mana: number; influence: number },
): boolean {
  return resources.materialMilli >= cost.material * RESOURCE_SCALE
    && resources.manaMilli >= cost.mana * RESOURCE_SCALE
    && resources.influenceMilli >= cost.influence * RESOURCE_SCALE;
}

export function enemyProductionProfile(faction: EnemyFaction): Readonly<{
  producer: BuildingType;
  cycle: readonly UnitArchetype[];
}> {
  return FACTION_PRODUCTION[faction];
}

export class EnemyLogisticsState {
  private productionCycleIndex = 0;
  private nextPlanTick = 1;
  private lastAction: EnemyLogisticsAction = 'IDLE';
  private lastUnitType: UnitArchetype | null = null;
  private lastBuildingId: number | null = null;
  private commandCount = 0;

  constructor(
    private readonly world: GeneratedWorld,
    readonly faction: EnemyFaction,
  ) {}

  advance(
    tick: number,
    strategic: StrategicSnapshot,
    enqueueStrategicCommand: (command: M03Command) => void,
  ): void {
    if (tick < this.nextPlanTick) return;
    this.nextPlanTick = tick + PLAN_INTERVAL_TICKS;
    this.lastAction = 'IDLE';
    this.lastUnitType = null;
    this.lastBuildingId = null;

    const profile = FACTION_PRODUCTION[this.faction];
    const enemyResources = strategic.resources[ENEMY_PLAYER_ID];
    if (!enemyResources) return;

    const producer = strategic.buildings
      .filter((building) => building.playerId === ENEMY_PLAYER_ID && building.type === profile.producer)
      .sort((left, right) => left.id - right.id)[0];

    if (!producer) {
      const definition = BUILDINGS[profile.producer];
      if (!canAfford(enemyResources, definition.cost)) return;
      const buildCell = this.chooseProducerCell(strategic);
      if (!buildCell) return;
      const position = worldCellToSimulationPosition(this.world, buildCell);
      enqueueStrategicCommand({
        type: 'BUILD',
        targetTick: tick + 1,
        playerId: ENEMY_PLAYER_ID,
        buildingType: profile.producer,
        targetX: position.x,
        targetZ: position.z,
      });
      this.lastAction = 'BUILD_PRODUCER';
      this.commandCount += 1;
      return;
    }

    if (!producer.completed) return;
    if (strategic.productionQueue.some((order) => order.playerId === ENEMY_PLAYER_ID)) return;

    const unitType = profile.cycle[this.productionCycleIndex % profile.cycle.length];
    if (!unitType) return;
    const unit = UNITS[unitType];
    const populationUsed = strategic.populationUsed[ENEMY_PLAYER_ID] ?? 0;
    const populationCap = strategic.populationCap[ENEMY_PLAYER_ID] ?? 0;
    if (populationUsed + unit.population > populationCap || !canAfford(enemyResources, unit.cost)) return;

    enqueueStrategicCommand({
      type: 'TRAIN',
      targetTick: tick + 1,
      playerId: ENEMY_PLAYER_ID,
      buildingId: producer.id,
      unitType,
    });
    this.lastAction = 'TRAIN';
    this.lastUnitType = unitType;
    this.lastBuildingId = producer.id;
    this.productionCycleIndex += 1;
    this.commandCount += 1;
  }

  snapshot(): EnemyLogisticsSnapshot {
    const withoutHash = {
      producerType: FACTION_PRODUCTION[this.faction].producer,
      productionCycleIndex: this.productionCycleIndex,
      nextPlanTick: this.nextPlanTick,
      lastAction: this.lastAction,
      lastUnitType: this.lastUnitType,
      lastBuildingId: this.lastBuildingId,
      commandCount: this.commandCount,
    };
    let hash = FNV_OFFSET;
    hash = hashString(hash, this.faction);
    hash = hashString(hash, withoutHash.producerType);
    hash = hashInteger(hash, withoutHash.productionCycleIndex);
    hash = hashInteger(hash, withoutHash.nextPlanTick);
    hash = hashString(hash, withoutHash.lastAction);
    hash = hashString(hash, withoutHash.lastUnitType ?? '');
    hash = hashInteger(hash, withoutHash.lastBuildingId ?? -1);
    hash = hashInteger(hash, withoutHash.commandCount);
    return { stateHash: hash.toString(16).padStart(8, '0'), ...withoutHash };
  }

  private chooseProducerCell(strategic: StrategicSnapshot): GridPoint | null {
    const enemySpawn = this.world.spawns.find((spawn) => spawn.id === 'ENEMY');
    if (!enemySpawn) return null;
    const region = this.world.regions[enemySpawn.regionId];
    if (!region) return null;
    const occupied = new Set(strategic.buildings.map((building) => `${building.x}:${building.z}`));
    const candidates: GridPoint[] = [];
    for (let index = 0; index < this.world.flags.length; index += 1) {
      if (this.world.regionByCell[index] !== enemySpawn.regionId) continue;
      if (((this.world.flags[index] ?? 0) & WorldCellFlag.BUILDABLE) === 0) continue;
      const x = index % this.world.width;
      const z = Math.floor(index / this.world.width);
      const cell = { x, z };
      const position = worldCellToSimulationPosition(this.world, cell);
      if (occupied.has(`${position.x}:${position.z}`)) continue;
      candidates.push(cell);
    }
    candidates.sort((left, right) => {
      const leftDistance = (left.x - region.center.x) ** 2 + (left.z - region.center.z) ** 2;
      const rightDistance = (right.x - region.center.x) ** 2 + (right.z - region.center.z) ** 2;
      return leftDistance - rightDistance || left.z - right.z || left.x - right.x;
    });
    return candidates[0] ?? null;
  }
}
