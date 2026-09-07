import { describe, expect, it } from 'vitest';
import { EntityStore } from '../../src/simulation/entity-store';
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

describe('M08 parallel construction and producer Rally Points', () => {
  it('runs separate construction sites concurrently instead of serializing them', () => {
    const { world, state } = harness(1_000_031);
    const regionId = playerRegion(world);
    const materialNode = world.resources.find((resource) => resource.type === 'MATERIAL' && resource.regionId === regionId);
    expect(materialNode).toBeDefined();
    if (!materialNode) return;

    const barracksCell = buildableCells(world, regionId).find((cell) => cell.x !== materialNode.cell.x || cell.z !== materialNode.cell.z);
    expect(barracksCell).toBeDefined();
    if (!barracksCell) return;
    const barracksPosition = worldCellToSimulationPosition(world, barracksCell);
    expect(state.processCommand({
      targetTick: 1,
      playerId: 0,
      type: 'BUILD',
      buildingType: 'BARRACKS',
      targetX: barracksPosition.x,
      targetZ: barracksPosition.z,
    }, 1)).toBe(true);

    for (let tick = 1; tick <= 167; tick += 1) state.advanceEconomy(tick);
    const materialPosition = worldCellToSimulationPosition(world, materialNode.cell);
    expect(state.processCommand({
      targetTick: 168,
      playerId: 0,
      type: 'BUILD',
      buildingType: 'EXTRACTOR',
      targetX: materialPosition.x,
      targetZ: materialPosition.z,
      resourceNodeId: materialNode.id,
    }, 168)).toBe(true);

    const active = state.snapshot().buildings.filter((building) => building.playerId === 0 && !building.completed);
    expect(active.map((building) => building.type).sort()).toEqual(['BARRACKS', 'EXTRACTOR']);
    const barracks = active.find((building) => building.type === 'BARRACKS')!;
    const extractor = active.find((building) => building.type === 'EXTRACTOR')!;
    expect(barracks.completeTick).toBe(351);
    expect(extractor.completeTick).toBe(348);

    for (let tick = 168; tick <= 348; tick += 1) state.advanceEconomy(tick);
    expect(state.snapshot().buildings.find((building) => building.id === extractor.id)?.completed).toBe(true);
    expect(state.snapshot().buildings.find((building) => building.id === barracks.id)?.completed).toBe(false);

    for (let tick = 349; tick <= 351; tick += 1) state.advanceEconomy(tick);
    expect(state.snapshot().buildings.find((building) => building.id === barracks.id)?.completed).toBe(true);
  });

  it('stores a deterministic producer Rally Point and sends newly trained units toward it', () => {
    const { world, entities, navigation, state } = harness(1_000_032);
    const regionId = playerRegion(world);
    const barracksCell = buildableCells(world, regionId)[0];
    expect(barracksCell).toBeDefined();
    if (!barracksCell) return;
    const barracksPosition = worldCellToSimulationPosition(world, barracksCell);
    expect(state.processCommand({
      targetTick: 1,
      playerId: 0,
      type: 'BUILD',
      buildingType: 'BARRACKS',
      targetX: barracksPosition.x,
      targetZ: barracksPosition.z,
    }, 1)).toBe(true);
    for (let tick = 1; tick <= 351; tick += 1) state.advanceEconomy(tick);

    const barracks = state.snapshot().buildings.find((building) => building.playerId === 0 && building.type === 'BARRACKS');
    expect(barracks?.completed).toBe(true);
    if (!barracks) return;
    const startCell = navigation.worldToCell(barracks.x, barracks.z);
    let rallyCell: { column: number; row: number } | null = null;
    for (let row = 0; row < world.height && rallyCell === null; row += 1) {
      for (let column = 0; column < world.width; column += 1) {
        if (!navigation.isWalkable({ column, row })) continue;
        const path = navigation.findPath(startCell, { column, row });
        if (path && path.length >= 6) {
          rallyCell = { column, row };
          break;
        }
      }
    }
    expect(rallyCell).not.toBeNull();
    if (!rallyCell) return;
    const rallyPosition = navigation.cellToWorld(rallyCell);
    const hashBeforeRally = state.snapshot().stateHash;
    expect(state.processCommand({
      targetTick: 352,
      playerId: 0,
      type: 'SET_RALLY_POINT',
      buildingId: barracks.id,
      targetX: rallyPosition.x,
      targetZ: rallyPosition.z,
    }, 352)).toBe(true);
    const withRally = state.snapshot().buildings.find((building) => building.id === barracks.id)!;
    expect(withRally).toMatchObject({ rallyPointX: rallyPosition.x, rallyPointZ: rallyPosition.z });
    expect(state.snapshot().stateHash).not.toBe(hashBeforeRally);

    const beforeIds = new Set(entities.entityIds());
    expect(state.processCommand({
      targetTick: 352,
      playerId: 0,
      type: 'TRAIN',
      buildingId: barracks.id,
      unitType: 'VANGUARD',
    }, 352)).toBe(true);
    for (let tick = 352; tick <= 472; tick += 1) state.advanceEconomy(tick);
    const spawnedId = entities.entityIds().find((entityId) => !beforeIds.has(entityId));
    expect(spawnedId).toBeDefined();
    if (spawnedId === undefined) return;
    const movement = entities.movements.get(spawnedId)!;
    expect(movement.targetX).toBe(rallyPosition.x);
    expect(movement.targetZ).toBe(rallyPosition.z);
    expect(movement.path.length).toBeGreaterThan(0);
    expect(movement.path[movement.path.length - 1]).toEqual(rallyPosition);
  });
});
