import type { UnitSpawn } from './components';

export const WORLD_UNITS_PER_METER = 1000;

export type ArenaZoneKind = 'NORMAL_GROUND' | 'FOREST' | 'RIVER' | 'CHOKEPOINT' | 'NATURAL_CROSSING' | 'FREEZABLE_CROSSING' | 'BLOCKED_TERRAIN';
export type TraversalCellKind = 'WALKABLE_GROUND' | 'BLOCKED_RIVER' | 'BLOCKED_TERRAIN' | 'NATURAL_CROSSING';

export interface TraversalPatch {
  id: string;
  kind: TraversalCellKind;
  minColumn: number;
  maxColumn: number;
  minRow: number;
  maxRow: number;
}

export interface ArenaTraversalDefinition {
  originX: number;
  originZ: number;
  cellSize: number;
  columns: number;
  rows: number;
  initialNavVersion: number;
  patches: readonly TraversalPatch[];
}

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
  traversal: ArenaTraversalDefinition;
  units: readonly UnitSpawn[];
}

const METRE = WORLD_UNITS_PER_METER;
const PLAYER_UNIT_COUNT = 16;

const units: UnitSpawn[] = Array.from({ length: PLAYER_UNIT_COUNT }, (_, index) => ({
  archetype: index % 2 === 0 ? 'VANGUARD' : 'RANGER',
  playerId: 0,
  x: (-15 + (index % 4) * 2.1) * METRE,
  z: (-11 + Math.floor(index / 4) * 2.1) * METRE,
  speedPerTick: 420,
  selectionRadius: 700,
  maxHealth: index % 2 === 0 ? 180 : 110,
  attackDamage: index % 2 === 0 ? 18 : 12,
  attackIntervalTicks: index % 2 === 0 ? 11 : 8,
  attackRange: index % 2 === 0 ? 1_250 : 6_000,
}));

for (let index = 0; index < 8; index += 1) {
  const ranged = index >= 4;
  units.push({
    archetype: ranged ? 'RANGER' : 'VANGUARD',
    playerId: 1,
    x: (13 + (index % 4) * 2.1) * METRE,
    z: (-5 + Math.floor(index / 4) * 10) * METRE,
    speedPerTick: ranged ? 390 : 430,
    selectionRadius: 700,
    maxHealth: ranged ? 105 : 190,
    attackDamage: ranged ? 13 : 20,
    attackIntervalTicks: ranged ? 8 : 12,
    attackRange: ranged ? 6_000 : 1_250,
  });
}

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
    { id: 'natural-crossing', kind: 'NATURAL_CROSSING', centerX: 2 * METRE, centerZ: 12 * METRE, width: 5 * METRE, depth: 3 * METRE },
    { id: 'future-ice-crossing', kind: 'FREEZABLE_CROSSING', centerX: 2 * METRE, centerZ: -3 * METRE, width: 5 * METRE, depth: 7 * METRE },
    { id: 'southwest-wall', kind: 'BLOCKED_TERRAIN', centerX: -13 * METRE, centerZ: 3 * METRE, width: 12 * METRE, depth: 2 * METRE },
    { id: 'southeast-wall', kind: 'BLOCKED_TERRAIN', centerX: 15 * METRE, centerZ: -11 * METRE, width: 2 * METRE, depth: 10 * METRE },
  ],
  traversal: {
    originX: -24 * METRE,
    originZ: -19 * METRE,
    cellSize: METRE,
    columns: 48,
    rows: 38,
    initialNavVersion: 1,
    patches: [
      { id: 'river', kind: 'BLOCKED_RIVER', minColumn: 24, maxColumn: 28, minRow: 0, maxRow: 37 },
      { id: 'southwest-wall', kind: 'BLOCKED_TERRAIN', minColumn: 5, maxColumn: 16, minRow: 21, maxRow: 22 },
      { id: 'southeast-wall', kind: 'BLOCKED_TERRAIN', minColumn: 38, maxColumn: 39, minRow: 3, maxRow: 12 },
      // Later patches intentionally override earlier ones. This is the only static river route in Slice 2.
      { id: 'natural-crossing', kind: 'NATURAL_CROSSING', minColumn: 24, maxColumn: 28, minRow: 30, maxRow: 32 },
    ],
  },
  units,
};
