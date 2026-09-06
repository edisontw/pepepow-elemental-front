import {
  WORLD_UNITS_PER_METER,
  type ArenaDefinition,
  type ArenaZone,
  type TraversalCellKind,
  type TraversalPatch,
} from '../simulation/arena';
import type { UnitSpawn } from '../simulation/components';
import { STARTING_ENEMY_ARCHETYPES, STARTING_PLAYER_ARCHETYPES, UNITS } from '../simulation/m03-content';
import { BiomeType, TerrainType, type GeneratedWorld, type GridPoint } from './world-definition';

const CELL_SIZE = WORLD_UNITS_PER_METER;

function originCoordinate(cellCount: number): number {
  return -Math.floor((cellCount * CELL_SIZE) / 2);
}

export function worldCellToSimulationPosition(world: GeneratedWorld, point: GridPoint): { x: number; z: number } {
  return {
    x: originCoordinate(world.width) + point.x * CELL_SIZE + Math.floor(CELL_SIZE / 2),
    z: originCoordinate(world.height) + point.z * CELL_SIZE + Math.floor(CELL_SIZE / 2),
  };
}

function rowRunPatches(
  world: GeneratedWorld,
  idPrefix: string,
  kind: TraversalCellKind,
  predicate: (index: number) => boolean,
): TraversalPatch[] {
  const patches: TraversalPatch[] = [];
  for (let row = 0; row < world.height; row += 1) {
    let runStart = -1;
    for (let column = 0; column <= world.width; column += 1) {
      const matches = column < world.width && predicate(row * world.width + column);
      if (matches && runStart < 0) runStart = column;
      if ((!matches || column === world.width) && runStart >= 0) {
        patches.push({
          id: `${idPrefix}-${row}-${runStart}-${column - 1}`,
          kind,
          minColumn: runStart,
          maxColumn: column - 1,
          minRow: row,
          maxRow: row,
        });
        runStart = -1;
      }
    }
  }
  return patches;
}

function patchToZone(world: GeneratedWorld, patch: TraversalPatch, kind: ArenaZone['kind'], suffix = ''): ArenaZone {
  const widthCells = patch.maxColumn - patch.minColumn + 1;
  const depthCells = patch.maxRow - patch.minRow + 1;
  const centerCell = {
    x: patch.minColumn + (widthCells - 1) / 2,
    z: patch.minRow + (depthCells - 1) / 2,
  };
  return {
    id: `${patch.id}${suffix}`,
    kind,
    centerX: originCoordinate(world.width) + Math.round((centerCell.x + 0.5) * CELL_SIZE),
    centerZ: originCoordinate(world.height) + Math.round((centerCell.z + 0.5) * CELL_SIZE),
    width: widthCells * CELL_SIZE,
    depth: depthCells * CELL_SIZE,
  };
}

function patchArea(patch: TraversalPatch): number {
  return (patch.maxColumn - patch.minColumn + 1) * (patch.maxRow - patch.minRow + 1);
}

function spawnArmy(world: GeneratedWorld, playerId: number, spawnId: 'PLAYER' | 'ENEMY'): UnitSpawn[] {
  const spawn = world.spawns.find((candidate) => candidate.id === spawnId);
  if (!spawn) throw new Error(`Generated world is missing ${spawnId} spawn.`);
  const center = worldCellToSimulationPosition(world, spawn.cell);
  const archetypes = spawnId === 'PLAYER' ? STARTING_PLAYER_ARCHETYPES : STARTING_ENEMY_ARCHETYPES;
  const offsets = [
    { x: -240, z: -180 }, { x: 0, z: -180 }, { x: 240, z: -180 },
    { x: -240, z: 180 }, { x: 0, z: 180 }, { x: 240, z: 180 },
  ];
  return archetypes.map((archetype, index) => {
    const definition = UNITS[archetype];
    const offset = offsets[index] ?? { x: 0, z: 0 };
    return {
      archetype,
      playerId,
      x: center.x + offset.x,
      z: center.z + offset.z,
      ...definition.spawn,
    };
  });
}

export function generatedWorldToArena(world: GeneratedWorld): ArenaDefinition {
  const blockedWater = rowRunPatches(
    world,
    'generated-water',
    'BLOCKED_RIVER',
    (index) => world.terrain[index] === TerrainType.WATER,
  );
  const naturalCrossings = rowRunPatches(
    world,
    'generated-crossing',
    'NATURAL_CROSSING',
    (index) => world.terrain[index] === TerrainType.CROSSING,
  );
  const vegetation = rowRunPatches(
    world,
    'generated-woodland',
    'WALKABLE_GROUND',
    (index) => world.biome[index] === BiomeType.WOODLAND && world.terrain[index] === TerrainType.GROUND,
  );

  const width = world.width * CELL_SIZE;
  const depth = world.height * CELL_SIZE;
  const showcaseWater = [...blockedWater].sort((left, right) => patchArea(right) - patchArea(left))[0];
  const forestZones = [...vegetation]
    .sort((left, right) => patchArea(right) - patchArea(left) || left.id.localeCompare(right.id))
    .slice(0, 8)
    .map((patch) => patchToZone(world, patch, 'FOREST'));
  const zones: ArenaZone[] = [
    { id: 'generated-ground', kind: 'NORMAL_GROUND', centerX: 0, centerZ: 0, width, depth },
    ...blockedWater.map((patch) => patchToZone(world, patch, 'RIVER')),
    ...naturalCrossings.map((patch) => patchToZone(world, patch, 'NATURAL_CROSSING')),
    ...forestZones,
  ];
  if (showcaseWater) zones.push(patchToZone(world, showcaseWater, 'FREEZABLE_CROSSING', '-elemental-test'));

  return {
    id: `generated-${world.identity.rulesetVersion}-${world.identity.blockHeight}-${world.generationAttempt}`,
    width,
    depth,
    zones,
    traversal: {
      originX: originCoordinate(world.width),
      originZ: originCoordinate(world.height),
      cellSize: CELL_SIZE,
      columns: world.width,
      rows: world.height,
      initialNavVersion: 1,
      patches: [...blockedWater, ...naturalCrossings],
      freezableWaterPatches: blockedWater,
      vegetationPatches: vegetation,
    },
    units: [
      ...spawnArmy(world, 0, 'PLAYER'),
      ...spawnArmy(world, 1, 'ENEMY'),
    ],
  };
}
