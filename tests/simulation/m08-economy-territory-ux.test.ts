import { describe, expect, it } from 'vitest';
import { EntityStore } from '../../src/simulation/entity-store';
import { productionDurationTicks } from '../../src/simulation/m03-content';
import { NavigationGrid } from '../../src/simulation/navigation';
import { StrategicState } from '../../src/simulation/strategic-state';
import { generateWorld } from '../../src/world/generator';
import { WorldCellFlag, type GeneratedWorld } from '../../src/world/world-definition';
import { generatedWorldToArena, worldCellToSimulationPosition } from '../../src/world/world-arena';

function harness(blockHeight: number) {
  const world = generateWorld(blockHeight);
  const arena = generatedWorldToArena(world);
  const entities = new EntityStore();
  for (const spawn of arena.units) entities.createUnit(spawn);
  const navigation = new NavigationGrid(arena.traversal);
  const state = new StrategicState(world, entities, navigation);
  return { world, entities, navigation, state };
}

function playerRegion(world: GeneratedWorld): number {
  const spawn = world.spawns.find((candidate) => candidate.id === 'PLAYER');
  if (!spawn) throw new Error('Missing player spawn.');
  return spawn.regionId;
}

function buildableCells(world: GeneratedWorld, regionId: number): Array<{ x: number; z: number }> {
  const result: Array<{ x: number; z: number }> = [];
  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const index = z * world.width + x;
      if (world.regionByCell[index] !== regionId) continue;
      if (((world.flags[index] ?? 0) & WorldCellFlag.BUILDABLE) !== 0) result.push({ x, z });
    }
  }
  return result;
}

describe('M08 economy and territory UX correction', () => {
  it('lets a completed Outpost claim adjacent neutral territory and extend supply', () => {
    const { world, state } = harness(1_000_021);
    const start = playerRegion(world);
    const neighbors = [...(world.regions[start]?.neighbors ?? [])];
    expect(neighbors.length).toBeGreaterThan(0);

    let targetRegion: number | null = null;
    for (const regionId of neighbors) {
      if (state.ownerOfRegion(regionId) !== null) continue;
      const cell = buildableCells(world, regionId)[0];
      if (!cell) continue;
      const position = worldCellToSimulationPosition(world, cell);
      if (state.processCommand({
        targetTick: 1,
        playerId: 0,
        type: 'BUILD',
        buildingType: 'OUTPOST',
        targetX: position.x,
        targetZ: position.z,
      }, 1)) {
        targetRegion = regionId;
        break;
      }
    }

    expect(targetRegion).not.toBeNull();
    if (targetRegion === null) return;
    expect(state.ownerOfRegion(targetRegion)).toBeNull();
    for (let tick = 1; tick <= 301; tick += 1) state.advanceEconomy(tick);
    expect(state.ownerOfRegion(targetRegion)).toBe(0);
    expect(state.isRegionSupplied(0, targetRegion)).toBe(true);
  });

  it('accelerates training with additional same-type producers while preserving explicit building queues', () => {
    expect(productionDurationTicks(120, 1)).toBe(120);
    expect(productionDurationTicks(120, 2)).toBe(108);
    expect(productionDurationTicks(120, 4)).toBe(84);
    expect(productionDurationTicks(120, 8)).toBe(84);

    const { world, state } = harness(1_000_022);
    const regionId = playerRegion(world);
    const cells = buildableCells(world, regionId);
    expect(cells.length).toBeGreaterThan(2);
    const first = worldCellToSimulationPosition(world, cells[0]!);
    const second = worldCellToSimulationPosition(world, cells[1]!);

    expect(state.processCommand({ targetTick: 1, playerId: 0, type: 'BUILD', buildingType: 'BARRACKS', targetX: first.x, targetZ: first.z }, 1)).toBe(true);
    for (let tick = 1; tick <= 1_020; tick += 1) state.advanceEconomy(tick);
    expect(state.processCommand({ targetTick: 1_021, playerId: 0, type: 'BUILD', buildingType: 'BARRACKS', targetX: second.x, targetZ: second.z }, 1_021)).toBe(true);
    for (let tick = 1_021; tick <= 1_371; tick += 1) state.advanceEconomy(tick);

    const barracks = state.snapshot().buildings.filter((building) => building.playerId === 0 && building.type === 'BARRACKS' && building.completed);
    expect(barracks).toHaveLength(2);
    const chosen = barracks[1]!;
    expect(state.processCommand({ targetTick: 1_372, playerId: 0, type: 'TRAIN', buildingId: chosen.id, unitType: 'VANGUARD' }, 1_372)).toBe(true);
    const order = state.snapshot().productionQueue[0];
    expect(order).toMatchObject({ buildingId: chosen.id, startTick: 1_372, durationTicks: 108, completeTick: 1_480 });
  });

  it('spawns completed units at their producer and gives them a deterministic exit path', () => {
    const { world, entities, navigation, state } = harness(1_000_023);
    const regionId = playerRegion(world);
    const candidate = buildableCells(world, regionId).find((cell) => {
      const offsets = [[0, 3], [3, 0], [0, -3], [-3, 0]] as const;
      return offsets.some(([dx, dz]) => navigation.isWalkable({ column: cell.x + dx, row: cell.z + dz }));
    });
    expect(candidate).toBeDefined();
    if (!candidate) return;
    const position = worldCellToSimulationPosition(world, candidate);
    expect(state.processCommand({ targetTick: 1, playerId: 0, type: 'BUILD', buildingType: 'BARRACKS', targetX: position.x, targetZ: position.z }, 1)).toBe(true);
    for (let tick = 1; tick <= 351; tick += 1) state.advanceEconomy(tick);
    const barracks = state.snapshot().buildings.find((building) => building.type === 'BARRACKS' && building.playerId === 0)!;
    expect(state.processCommand({ targetTick: 352, playerId: 0, type: 'TRAIN', buildingId: barracks.id, unitType: 'VANGUARD' }, 352)).toBe(true);
    const beforeIds = new Set(entities.entityIds());
    for (let tick = 352; tick <= 472; tick += 1) state.advanceEconomy(tick);
    const spawnedId = entities.entityIds().find((entityId) => !beforeIds.has(entityId));
    expect(spawnedId).toBeDefined();
    if (spawnedId === undefined) return;
    const spawnedPosition = entities.positions.get(spawnedId)!;
    const movement = entities.movements.get(spawnedId)!;
    expect(spawnedPosition).toEqual({ x: barracks.x, z: barracks.z });
    expect(movement.targetX).not.toBeNull();
    expect(movement.targetZ).not.toBeNull();
    expect(movement.path.length).toBeGreaterThan(0);
  });
});
