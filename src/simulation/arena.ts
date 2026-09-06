import type { UnitSpawn } from './components';

export const WORLD_UNITS_PER_METER = 1000;

export type ArenaZoneKind = 'NORMAL_GROUND' | 'FOREST' | 'RIVER' | 'CHOKEPOINT' | 'FREEZABLE_CROSSING';

export interface ArenaZone {
  id: string;
  kind: ArenaZoneKind;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
}

export interface ArenaDefinition {
  id: string;
  width: number;
  depth: number;
  zones: readonly ArenaZone[];
  units: readonly UnitSpawn[];
}

const METRE = WORLD_UNITS_PER_METER;
const PLAYER_UNIT_COUNT = 16;

const units: UnitSpawn[] = Array.from({ length: PLAYER_UNIT_COUNT }, (_, index) => ({
  playerId: 0,
  x: (-15 + (index % 4) * 2.1) * METRE,
  z: (-11 + Math.floor(index / 4) * 2.1) * METRE,
  speedPerTick: 420,
  selectionRadius: 700,
}));

export const M01_ARENA: ArenaDefinition = {
  id: 'm01-handcrafted-arena-v1',
  width: 48 * METRE,
  depth: 38 * METRE,
  zones: [
    { id: 'ground', kind: 'NORMAL_GROUND', centerX: 0, centerZ: 0, width: 48 * METRE, depth: 38 * METRE },
    { id: 'west-forest', kind: 'FOREST', centerX: -14 * METRE, centerZ: 10 * METRE, width: 11 * METRE, depth: 9 * METRE },
    { id: 'east-forest', kind: 'FOREST', centerX: 14 * METRE, centerZ: -10 * METRE, width: 10 * METRE, depth: 8 * METRE },
    { id: 'river', kind: 'RIVER', centerX: 2 * METRE, centerZ: 0, width: 5 * METRE, depth: 38 * METRE },
    { id: 'north-chokepoint', kind: 'CHOKEPOINT', centerX: 2 * METRE, centerZ: 12 * METRE, width: 10 * METRE, depth: 5 * METRE },
    { id: 'future-ice-crossing', kind: 'FREEZABLE_CROSSING', centerX: 2 * METRE, centerZ: -3 * METRE, width: 5 * METRE, depth: 7 * METRE },
  ],
  units,
};
