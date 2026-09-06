import {
  WORLD_UNITS_PER_METER,
  type ArenaDefinition,
  type ArenaZone,
  type TraversalCellKind,
  type TraversalPatch,
} from '../simulation/arena';
import type { UnitSpawn } from '../simulation/components';
import { STARTING_ENEMY_ARCHETYPES, STARTING_PLAYER_ARCHETYPES, UNITS } from '../simulation/m03-content';
import { BiomeType, TerrainType, WorldCellFlag, type GeneratedWorld, type GridPoint } from './world-definition';

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

function nearbyWalkableSpawnCells(world: GeneratedWorld, center: GridPoint, regionId: number, count: number): GridPoint[] {
  const candidates: GridPoint[] = [];
  const fallback: GridPoint[] = [];
  const radius = 4;
  for (let z = Math.max(0, center.z - radius); z <= Math.min(world.height - 1, center.z + radius); z += 1) {
    for (let x = Math.max(0, center.x - radius); x <= Math.min(world.width - 1, center.x + radius); x += 1) {
      const index = z * world.width + x;
      if (((world.flags[index] ?? 0) & WorldCellFlag.WALKABLE) === 0) continue;
      const point = { x, z };
      fallback.push(point);
      if (world.regionByCell[index] === regionId) candidates.push(point);
    }
  }
  const order = (left: GridPoint, right: GridPoint): number => {
    const leftDx = left.x - center.x;
    const leftDz = left.z - center.z;
    const rightDx = right.x - center.x;
    const rightDz = right.z - center.z;
    return (leftDx * leftDx + leftDz * leftDz) - (rightDx * rightDx + rightDz * rightDz)
      || left.z - right.z
      || left.x - right.x;
  };
  candidates.sort(order);
  fallback.sort(order);
  const selected = [...candidates];
  for (const point of fallback) {
    if (selected.length >= count) break;
    if (selected.some((candidate) => candidate.x === point.x && candidate.z === point.z)) continue;
    selected.push(point);
  }
  if (selected.length < count) throw new Error(`Generated ${regionId} spawn region lacks ${count} nearby walkable cells.`);
  return selected.slice(0, count);
}

function spawnArmy(world: GeneratedWorld, playerId: number, spawnId: 'PLAYER' | 'ENEMY'): UnitSpawn[] {
  const spawn = world.spawns.find((candidate) => candidate.id === spawnId);
  if (!spawn) throw new Error(`Generated world is missing ${spawnId} spawn.`);
  const archetypes = spawnId === 'PLAYER' ? STARTING_PLAYER_ARCHETYPES : STARTING_ENEMY_ARCHETYPES;
  const cells = nearbyWalkableSpawnCells(world, spawn.cell, spawn.regionId, archetypes.length);
  return archetypes.map((archetype, index) => {
    const definition = UNITS[archetype];
    const cell = cells[index] ?? spawn.cell;
    const position = worldCellToSimulationPosition(world, cell);
    return {
      archetype,
      playerId,
      x: position.x,
      z: position.z,
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
