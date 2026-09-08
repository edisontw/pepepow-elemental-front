import { WORLD_UNITS_PER_METER } from './arena';
import type { UnitArchetype, UnitSpawn } from './components';

export type BuildingType = 'ELEMENTAL_CORE' | 'BARRACKS' | 'ARCANE_TOWER' | 'WORKSHOP' | 'OUTPOST' | 'EXTRACTOR' | 'MANA_WELL';
export type ProducerBuildingType = Exclude<BuildingType, 'ELEMENTAL_CORE' | 'OUTPOST' | 'EXTRACTOR' | 'MANA_WELL'>;
export type OutpostSpecialization = 'WATCHTOWER' | 'BARRIER_HUB' | 'MANA_BEACON';
export type ResourceBuildingType = 'EXTRACTOR' | 'MANA_WELL';

export interface ResourceCost {
  material: number;
  mana: number;
  influence: number;
}

export interface BuildingDefinition {
  type: BuildingType;
  cost: ResourceCost;
  buildTicks: number;
  maxHealth: number;
}

export interface UnitDefinition {
  archetype: UnitArchetype;
  producer: ProducerBuildingType;
  cost: ResourceCost;
  population: number;
  trainTicks: number;
  capturePowerTenths: number;
  spawn: Omit<UnitSpawn, 'archetype' | 'playerId' | 'x' | 'z'>;
}

export const STARTING_RESOURCES = {
  material: 300,
  mana: 100,
  influence: 10,
} as const;

export const BASE_POPULATION_CAP = 30;
export const OUTPOST_POPULATION_CAP = 10;
export const CAPTURE_BASE_TICKS = 200;
export const CAPTURE_POWER_CAP_TENTHS = 30;
export const PRODUCTION_NETWORK_BONUS_PER_EXTRA_PERMILLE = 100;
export const PRODUCTION_NETWORK_MAX_BONUS_PERMILLE = 300;

const M = WORLD_UNITS_PER_METER;

export const RESOURCE_DEFENSE_UPGRADE = {
  cost: { material: 90, mana: 30, influence: 0 },
  bonusHealth: 300,
  attackDamage: 16,
  attackIntervalTicks: 12,
  attackRange: 8 * M,
  structureRadius: 1.2 * M,
} as const;

export function productionDurationTicks(baseTicks: number, completedProducerCount: number): number {
  const extras = Math.max(0, completedProducerCount - 1);
  const bonusPermille = Math.min(
    PRODUCTION_NETWORK_MAX_BONUS_PERMILLE,
    extras * PRODUCTION_NETWORK_BONUS_PER_EXTRA_PERMILLE,
  );
  return Math.max(1, Math.ceil((baseTicks * (1000 - bonusPermille)) / 1000));
}

export function productionSpeedPercent(completedProducerCount: number): number {
  const extras = Math.max(0, completedProducerCount - 1);
  const bonusPermille = Math.min(
    PRODUCTION_NETWORK_MAX_BONUS_PERMILLE,
    extras * PRODUCTION_NETWORK_BONUS_PER_EXTRA_PERMILLE,
  );
  return 100 + Math.round((bonusPermille * 100) / (1000 - bonusPermille));
}

export const BUILDINGS: Readonly<Record<BuildingType, BuildingDefinition>> = {
  ELEMENTAL_CORE: {
    type: 'ELEMENTAL_CORE',
    cost: { material: 0, mana: 0, influence: 0 },
    buildTicks: 0,
    maxHealth: 5000,
  },
  BARRACKS: {
    type: 'BARRACKS',
    cost: { material: 250, mana: 0, influence: 0 },
    buildTicks: 350,
    maxHealth: 1200,
  },
  ARCANE_TOWER: {
    type: 'ARCANE_TOWER',
    cost: { material: 220, mana: 40, influence: 0 },
    buildTicks: 350,
    maxHealth: 900,
  },
  WORKSHOP: {
    type: 'WORKSHOP',
    cost: { material: 350, mana: 0, influence: 0 },
    buildTicks: 500,
    maxHealth: 1300,
  },
  OUTPOST: {
    type: 'OUTPOST',
    cost: { material: 180, mana: 0, influence: 10 },
    buildTicks: 300,
    maxHealth: 1000,
  },
  EXTRACTOR: {
    type: 'EXTRACTOR',
    cost: { material: 100, mana: 0, influence: 0 },
    buildTicks: 180,
    maxHealth: 500,
  },
  MANA_WELL: {
    type: 'MANA_WELL',
    cost: { material: 100, mana: 0, influence: 0 },
    buildTicks: 180,
    maxHealth: 500,
  },
};

const selectionRadius = 700;

export const UNITS: Readonly<Record<UnitArchetype, UnitDefinition>> = {
  VANGUARD: {
    archetype: 'VANGUARD', producer: 'BARRACKS', cost: { material: 45, mana: 0, influence: 0 },
    population: 1, trainTicks: 120, capturePowerTenths: 15,
    spawn: { speedPerTick: 360, selectionRadius, maxHealth: 180, attackDamage: 18, attackIntervalTicks: 11, attackRange: 1.25 * M },
  },
  SPEAR_GUARD: {
    archetype: 'SPEAR_GUARD', producer: 'BARRACKS', cost: { material: 75, mana: 0, influence: 0 },
    population: 2, trainTicks: 180, capturePowerTenths: 10,
    spawn: { speedPerTick: 310, selectionRadius, maxHealth: 220, attackDamage: 20, attackIntervalTicks: 14, attackRange: 2.2 * M },
  },
  RANGER: {
    archetype: 'RANGER', producer: 'BARRACKS', cost: { material: 65, mana: 0, influence: 0 },
    population: 1, trainTicks: 160, capturePowerTenths: 10,
    spawn: { speedPerTick: 350, selectionRadius, maxHealth: 110, attackDamage: 17, attackIntervalTicks: 14, attackRange: 10 * M },
  },
  SCOUT: {
    archetype: 'SCOUT', producer: 'BARRACKS', cost: { material: 40, mana: 0, influence: 0 },
    population: 1, trainTicks: 90, capturePowerTenths: 5,
    spawn: { speedPerTick: 550, selectionRadius: 600, maxHealth: 80, attackDamage: 8, attackIntervalTicks: 12, attackRange: 6 * M },
  },
  ELEMENTALIST: {
    archetype: 'ELEMENTALIST', producer: 'ARCANE_TOWER', cost: { material: 70, mana: 25, influence: 0 },
    population: 2, trainTicks: 220, capturePowerTenths: 10,
    spawn: { speedPerTick: 320, selectionRadius, maxHealth: 100, attackDamage: 14, attackIntervalTicks: 15, attackRange: 9 * M },
  },
  ENGINEER: {
    archetype: 'ENGINEER', producer: 'WORKSHOP', cost: { material: 65, mana: 0, influence: 0 },
    population: 1, trainTicks: 180, capturePowerTenths: 10,
    spawn: { speedPerTick: 330, selectionRadius, maxHealth: 120, attackDamage: 9, attackIntervalTicks: 15, attackRange: 1.25 * M },
  },
  GOLEM: {
    archetype: 'GOLEM', producer: 'WORKSHOP', cost: { material: 220, mana: 60, influence: 0 },
    population: 5, trainTicks: 400, capturePowerTenths: 10,
    spawn: { speedPerTick: 230, selectionRadius: 900, maxHealth: 600, attackDamage: 42, attackIntervalTicks: 18, attackRange: 1.25 * M },
  },
  SIEGE_CONSTRUCT: {
    archetype: 'SIEGE_CONSTRUCT', producer: 'WORKSHOP', cost: { material: 260, mana: 20, influence: 0 },
    population: 5, trainTicks: 450, capturePowerTenths: 10,
    spawn: { speedPerTick: 180, selectionRadius: 900, maxHealth: 320, attackDamage: 25, attackIntervalTicks: 30, attackRange: 14 * M },
  },
};

export const STARTING_PLAYER_ARCHETYPES: readonly UnitArchetype[] = [
  'VANGUARD', 'VANGUARD', 'VANGUARD', 'VANGUARD', 'RANGER', 'SCOUT',
];

export const STARTING_ENEMY_ARCHETYPES: readonly UnitArchetype[] = [
  'VANGUARD', 'VANGUARD', 'VANGUARD', 'VANGUARD', 'RANGER', 'RANGER',
];
