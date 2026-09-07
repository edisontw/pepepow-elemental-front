import { describe, expect, it } from 'vitest';
import { EntityStore } from '../../src/simulation/entity-store';
import { NavigationGrid } from '../../src/simulation/navigation';
import { StrategicState } from '../../src/simulation/strategic-state';
import { generateWorld } from '../../src/world/generator';
import { WorldCellFlag, type GeneratedWorld } from '../../src/world/world-definition';
import { generatedWorldToArena, worldCellToSimulationPosition } from '../../src/world/world-arena';

function harness(blockHeight = 1_000_000) {
  const world = generateWorld(blockHeight);
  const arena = generatedWorldToArena(world);
  const entities = new EntityStore();
  for (const spawn of arena.units) entities.createUnit(spawn);
  const navigation = new NavigationGrid(arena.traversal);
  const state = new StrategicState(world, entities, navigation);
  const playerUnits = entities.entityIds().filter((entityId) => entities.factions.get(entityId)?.playerId === 0);
  return { world, entities, state, playerUnits };
}

function playerRegion(world: GeneratedWorld): number {
  const spawn = world.spawns.find((candidate) => candidate.id === 'PLAYER');
  if (!spawn) throw new Error('Missing player spawn.');
  return spawn.regionId;
}

function enemyRegion(world: GeneratedWorld): number {
  const spawn = world.spawns.find((candidate) => candidate.id === 'ENEMY');
  if (!spawn) throw new Error('Missing enemy spawn.');
  return spawn.regionId;
}

function buildableCell(world: GeneratedWorld, regionId: number, avoid: ReadonlySet<string> = new Set()) {
  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const index = z * world.width + x;
      if (world.regionByCell[index] !== regionId) continue;
      if (((world.flags[index] ?? 0) & WorldCellFlag.BUILDABLE) === 0) continue;
      if (!avoid.has(`${x},${z}`)) return { x, z };
    }
  }
  throw new Error(`No buildable cell in region ${regionId}.`);
}

function shortestPath(world: GeneratedWorld, start: number, target: number): number[] | null {
  const queue: number[][] = [[start]];
  const visited = new Set<number>([start]);
  while (queue.length > 0) {
    const path = queue.shift();
    if (!path) break;
    const current = path[path.length - 1];
    if (current === target) return path;
    for (const neighbor of [...(world.regions[current!]?.neighbors ?? [])].sort((a, b) => a - b)) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push([...path, neighbor]);
    }
  }
  return null;
}

function safeTwoHopPath(world: GeneratedWorld): number[] {
  const start = playerRegion(world);
  const enemy = enemyRegion(world);
  for (const region of world.regions) {
    const path = shortestPath(world, start, region.id);
    if (path && path.length >= 3 && !path.slice(1).includes(enemy)) return path;
  }
  throw new Error('Seed does not expose a safe two-hop expansion path.');
}

function moveUnitsToRegion(world: GeneratedWorld, entities: EntityStore, entityIds: readonly number[], regionId: number): void {
  const region = world.regions[regionId];
  if (!region) throw new Error(`Missing region ${regionId}.`);
  const position = worldCellToSimulationPosition(world, region.center);
  for (const entityId of entityIds) {
    const component = entities.positions.get(entityId);
    if (!component) continue;
    component.x = position.x;
    component.z = position.z;
  }
}

function captureRegion(
  state: StrategicState,
  world: GeneratedWorld,
  entities: EntityStore,
  entityIds: readonly number[],
  regionId: number,
): void {
  moveUnitsToRegion(world, entities, entityIds, regionId);
  expect(state.processCommand({ targetTick: 1, playerId: 0, type: 'CAPTURE', entityIds, targetRegionId: regionId }, 1)).toBe(true);
  for (let tick = 0; tick < 240; tick += 1) state.advanceTerritory();
  expect(state.ownerOfRegion(regionId)).toBe(0);
}

describe('M08 expansion and resource clarity correction', () => {
  it('preserves Influence-gated chained Outpost expansion and resumes after a POI reward', () => {
    const { world, entities, state, playerUnits } = harness();
    const path = safeTwoHopPath(world);
    const firstRegion = path[1]!;
    const secondRegion = path[2]!;
    const firstCell = buildableCell(world, firstRegion);
    const firstPosition = worldCellToSimulationPosition(world, firstCell);

    expect(state.processCommand({
      targetTick: 1,
      playerId: 0,
      type: 'BUILD',
      buildingType: 'OUTPOST',
      targetX: firstPosition.x,
      targetZ: firstPosition.z,
    }, 1)).toBe(true);
    expect(state.snapshot().resources[0]!.influenceMilli).toBe(0);
    for (let tick = 1; tick <= 301; tick += 1) state.advanceEconomy(tick);
    expect(state.ownerOfRegion(firstRegion)).toBe(0);
    expect(state.isRegionSupplied(0, firstRegion)).toBe(true);

    const secondCell = buildableCell(world, secondRegion);
    const secondPosition = worldCellToSimulationPosition(world, secondCell);
    expect(state.processCommand({
      targetTick: 302,
      playerId: 0,
      type: 'BUILD',
      buildingType: 'OUTPOST',
      targetX: secondPosition.x,
      targetZ: secondPosition.z,
    }, 302)).toBe(false);

    const poi = world.pois[0];
    if (!poi) throw new Error('Missing POI.');
    moveUnitsToRegion(world, entities, playerUnits, poi.regionId);
    expect(state.processCommand({ targetTick: 303, playerId: 0, type: 'CAPTURE', entityIds: playerUnits, targetPoiId: poi.id }, 303)).toBe(true);
    for (let tick = 0; tick < 240; tick += 1) state.advanceTerritory();
    expect(state.snapshot().resources[0]!.influenceMilli).toBe(10_000);

    expect(state.processCommand({
      targetTick: 304,
      playerId: 0,
      type: 'BUILD',
      buildingType: 'OUTPOST',
      targetX: secondPosition.x,
      targetZ: secondPosition.z,
    }, 304)).toBe(true);
  });

  it('requires a Mana Well on a Mana Spring and removes free regional Mana Spring income', () => {
    const { world, entities, state, playerUnits } = harness(1_000_031);
    const start = playerRegion(world);
    const enemy = enemyRegion(world);
    const manaNode = world.resources.find((resource) => {
      if (resource.type !== 'MANA' || resource.regionId === enemy) return false;
      const path = shortestPath(world, start, resource.regionId);
      return path !== null && !path.slice(1).includes(enemy);
    });
    if (!manaNode) throw new Error('Seed does not expose an accessible Mana Spring.');
    const path = shortestPath(world, start, manaNode.regionId)!;
    for (const regionId of path.slice(1)) captureRegion(state, world, entities, playerUnits, regionId);

    const beforePassive = state.snapshot().resources[0]!.manaMilli;
    for (let tick = 1; tick <= 10; tick += 1) state.advanceEconomy(tick);
    expect(state.snapshot().resources[0]!.manaMilli - beforePassive).toBe(500);

    const position = worldCellToSimulationPosition(world, manaNode.cell);
    expect(state.processCommand({
      targetTick: 11,
      playerId: 0,
      type: 'BUILD',
      buildingType: 'EXTRACTOR',
      targetX: position.x,
      targetZ: position.z,
      resourceNodeId: manaNode.id,
    }, 11)).toBe(false);
    expect(state.processCommand({
      targetTick: 11,
      playerId: 0,
      type: 'BUILD',
      buildingType: 'MANA_WELL',
      targetX: position.x,
      targetZ: position.z,
      resourceNodeId: manaNode.id,
    }, 11)).toBe(true);
    for (let tick = 11; tick <= 191; tick += 1) state.advanceEconomy(tick);
    const beforeWell = state.snapshot().resources[0]!.manaMilli;
    for (let tick = 192; tick <= 201; tick += 1) state.advanceEconomy(tick);
    const expectedSpring = manaNode.rich ? 3_000 : 2_000;
    expect(state.snapshot().resources[0]!.manaMilli - beforeWell).toBe(500 + expectedSpring);
  });
});
