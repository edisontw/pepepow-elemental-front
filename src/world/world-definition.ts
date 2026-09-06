export const STANDARD_WORLD_SIZE = 128;
export const STANDARD_REGION_COLUMNS = 4;
export const STANDARD_REGION_ROWS = 3;

export enum TerrainType {
  GROUND = 0,
  WATER = 1,
  CROSSING = 2,
}

export enum BiomeType {
  PLAINS = 0,
  WOODLAND = 1,
  HIGHLANDS = 2,
}

export const enum WorldCellFlag {
  WALKABLE = 1 << 0,
  BUILDABLE = 1 << 1,
  WATER = 1 << 2,
  SHALLOW = 1 << 3,
  FOREST = 1 << 4,
  HIGH_GROUND = 1 << 5,
  ROUTE = 1 << 6,
}

export interface GridPoint {
  x: number;
  z: number;
}

export interface WorldIdentity {
  namespace: string;
  rulesetVersion: string;
  blockHeight: number;
  masterSeed: number;
}

export interface StrategicRegion {
  id: number;
  name: string;
  center: GridPoint;
  biome: BiomeType;
  cellCount: number;
  neighbors: readonly number[];
}

export interface StrategicRoute {
  id: string;
  fromRegion: number;
  toRegion: number;
  widthCells: number;
  path: readonly GridPoint[];
  crossingCells: readonly GridPoint[];
}

export type ResourceType = 'MATERIAL' | 'MANA';

export interface ResourceNode {
  id: string;
  type: ResourceType;
  cell: GridPoint;
  regionId: number;
  rich: boolean;
}

export type PoiType = 'SHRINE' | 'NEUTRAL_CAMP' | 'VILLAGE' | 'ANCIENT_RUIN';

export interface PointOfInterest {
  id: string;
  type: PoiType;
  cell: GridPoint;
  regionId: number;
  lowRisk: boolean;
}

export interface WorldSpawn {
  id: 'PLAYER' | 'ENEMY';
  cell: GridPoint;
  regionId: number;
}

export interface MajorSite {
  id: 'OBJECTIVE' | 'BOSS';
  cell: GridPoint;
  regionId: number;
}

export interface BattlefieldQuality {
  score: number;
  waterPermille: number;
  forestPermille: number;
  highGroundPermille: number;
  routeCycleCount: number;
  resourceRegionCount: number;
}

export interface WorldValidation {
  valid: boolean;
  hardFailures: readonly string[];
}

export interface GeneratedWorld {
  identity: WorldIdentity;
  generationAttempt: number;
  width: number;
  height: number;
  elevation: Int16Array;
  moisture: Uint8Array;
  terrain: Uint8Array;
  biome: Uint8Array;
  flags: Uint16Array;
  regionByCell: Uint8Array;
  regions: readonly StrategicRegion[];
  routes: readonly StrategicRoute[];
  resources: readonly ResourceNode[];
  pois: readonly PointOfInterest[];
  spawns: readonly WorldSpawn[];
  objective: MajorSite;
  boss: MajorSite;
  quality: BattlefieldQuality;
  validation: WorldValidation;
  gameplayHash: string;
  visualVariant: Uint8Array;
}

export interface WorldGenerationRules {
  rulesetVersion: string;
  width: number;
  height: number;
  minimumQualityScore: number;
  maxGenerationAttempts: number;
}

export interface WorldGenerationOptions {
  visualSalt?: string;
}

export const M02_STANDARD_RULES: WorldGenerationRules = {
  rulesetVersion: 'm02-standard-v1',
  width: STANDARD_WORLD_SIZE,
  height: STANDARD_WORLD_SIZE,
  minimumQualityScore: 72,
  maxGenerationAttempts: 12,
};
