import { describe, expect, it } from 'vitest';
import { EntityStore } from '../../src/simulation/entity-store';
import { M03Simulation } from '../../src/simulation/m03-simulation';
import { NavigationGrid } from '../../src/simulation/navigation';
import { StrategicState } from '../../src/simulation/strategic-state';
import { generateWorld } from '../../src/world/generator';
import { WorldCellFlag, type GeneratedWorld } from '../../src/world/world-definition';
import { generatedWorldToArena, worldCellToSimulationPosition } from '../../src/world/world-arena';

function createStrategicHarness(blockHeight = 1_000_000): {
  world: GeneratedWorld;
  entities: EntityStore;
  state: StrategicState;
  playerUnits: number[];
  enemyUnits: number[];
} {
  const world = generateWorld(blockHeight);
  const arena = generatedWorldToArena(world);
  const entities = new EntityStore();
  for (const spawn of arena.units) entities.createUnit(spawn);
  const state = new StrategicState(world, entities, new NavigationGrid(arena.traversal));
  const playerUnits = entities.entityIds().filter((entityId) => entities.factions.get(entityId)?.playerId === 0);
  const enemyUnits = entities.entityIds().filter((entityId) => entities.factions.get(entityId)?.playerId === 1);
  return { world, entities, state, playerUnits, enemyUnits };
}

function playerSpawnRegion(world: GeneratedWorld): number {
  const spawn = world.spawns.find((candidate) => candidate.id === 'PLAYER');
  if (!spawn) throw new Error('Missing player spawn.');
  return spawn.regionId;
}

function enemySpawnRegion(world: GeneratedWorld): number {
  const spawn = world.spawns.find((candidate) => candidate.id === 'ENEMY');
  if (!spawn) throw new Error('Missing enemy spawn.');
  return spawn.regionId;
}

function buildableCell(world: GeneratedWorld, regionId: number, avoid: ReadonlySet<string> = new Set()): { x: number; z: number } {
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

function moveUnitsToRegion(world: GeneratedWorld, entities: EntityStore, entityIds: readonly number[], regionId: number): void {
  const region = world.regions[regionId];
  if (!region) throw new Error(`Missing region ${regionId}.`);
  const position = worldCellToSimulationPosition(world, region.center);
  for (const entityId of entityIds) {
    const component = entities.positions.get(entityId);
    if (component) {
      component.x = position.x;
      component.z = position.z;
    }
  }
}

function captureRegion(state: StrategicState, world: GeneratedWorld, entities: EntityStore, entityIds: readonly number[], playerId: number, regionId: number): void {
  moveUnitsToRegion(world, entities, entityIds, regionId);
  expect(state.processCommand({ targetTick: 1, playerId, type: 'CAPTURE', entityIds, targetRegionId: regionId }, 1)).toBe(true);
  for (let tick = 0; tick < 240; tick += 1) state.advanceTerritory();
  expect(state.ownerOfRegion(regionId)).toBe(playerId);
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

function materialExpansionPath(world: GeneratedWorld): { path: number[]; resourceId: string; rich: boolean } {
  const start = playerSpawnRegion(world);
  const enemy = enemySpawnRegion(world);
  const candidates = world.resources.filter((resource) => (
    resource.type === 'MATERIAL'
    && resource.regionId !== start
    && resource.regionId !== enemy
  ));
  for (const resource of candidates) {
    const path = shortestPath(world, start, resource.regionId);
    if (path && path.length >= 3 && !path.slice(1).includes(enemy)) {
      return { path, resourceId: resource.id, rich: resource.rich };
    }
  }
  throw new Error('Golden M03 seed does not expose a safe two-hop Material expansion path.');
}

describe('M03 economy and territory', () => {
  it('starts from the canonical no-worker economy and accrues finite passive Core income', () => {
    const { state } = createStrategicHarness();
    const initial = state.snapshot();
    expect(initial.resources[0]).toEqual({ materialMilli: 300_000, manaMilli: 100_000, influenceMilli: 10_000 });
    expect(initial.populationUsed[0]).toBe(6);
    expect(initial.populationCap[0]).toBe(30);

    for (let tick = 1; tick <= 18_000; tick += 1) state.advanceEconomy(tick);
    const afterThirtyMinutes = state.snapshot().resources[0]!;
    expect(afterThirtyMinutes.materialMilli).toBe(5_700_000);
    expect(afterThirtyMinutes.manaMilli).toBeGreaterThanOrEqual(1_000_000);
    expect(afterThirtyMinutes.materialMilli).toBeLessThan(20_000_000);
    expect(afterThirtyMinutes.manaMilli).toBeLessThan(10_000_000);
  });

  it('deducts construction costs once, completes buildings, and trains units through a deterministic queue', () => {
    const { world, state } = createStrategicHarness();
    const regionId = playerSpawnRegion(world);
    const cell = buildableCell(world, regionId);
    const position = worldCellToSimulationPosition(world, cell);
    expect(state.processCommand({ targetTick: 1, playerId: 0, type: 'BUILD', buildingType: 'BARRACKS', targetX: position.x, targetZ: position.z }, 1)).toBe(true);
    expect(state.processCommand({ targetTick: 1, playerId: 0, type: 'BUILD', buildingType: 'BARRACKS', targetX: position.x, targetZ: position.z }, 1)).toBe(false);
    expect(state.snapshot().resources[0]!.materialMilli).toBe(50_000);

    for (let tick = 1; tick <= 351; tick += 1) state.advanceEconomy(tick);
    const barracks = state.snapshot().buildings.find((building) => building.type === 'BARRACKS');
    expect(barracks?.completed).toBe(true);
    expect(barracks).toBeDefined();
    expect(state.processCommand({ targetTick: 352, playerId: 0, type: 'TRAIN', buildingId: barracks!.id, unitType: 'VANGUARD' }, 352)).toBe(true);
    for (let tick = 352; tick <= 472; tick += 1) state.advanceEconomy(tick);
    expect(state.snapshot().populationUsed[0]).toBe(7);
  });

  it('captures POIs once and grants the canonical Influence reward without duplication', () => {
    const { world, entities, state, playerUnits } = createStrategicHarness();
    const start = playerSpawnRegion(world);
    const poi = world.pois.find((candidate) => candidate.regionId === start) ?? world.pois[0];
    if (!poi) throw new Error('Missing M02 POI.');
    moveUnitsToRegion(world, entities, playerUnits, poi.regionId);
    expect(state.processCommand({ targetTick: 1, playerId: 0, type: 'CAPTURE', entityIds: playerUnits, targetPoiId: poi.id }, 1)).toBe(true);
    for (let tick = 0; tick < 240; tick += 1) state.advanceTerritory();
    expect(state.snapshot().poiOwners[poi.id]).toBe(0);
    expect(state.snapshot().resources[0]!.influenceMilli).toBe(20_000);
    expect(state.processCommand({ targetTick: 2, playerId: 0, type: 'CAPTURE', entityIds: playerUnits, targetPoiId: poi.id }, 2)).toBe(false);
    expect(state.snapshot().resources[0]!.influenceMilli).toBe(20_000);
  });

  it('makes expansion valuable and supply cuts reduce population plus remote Extractor throughput', () => {
    const { world, entities, state, playerUnits, enemyUnits } = createStrategicHarness();
    const expansion = materialExpansionPath(world);
    const start = expansion.path[0]!;
    const intermediate = expansion.path[1]!;
    const target = expansion.path[expansion.path.length - 1]!;
    expect(start).toBe(playerSpawnRegion(world));

    for (const regionId of expansion.path.slice(1)) captureRegion(state, world, entities, playerUnits, 0, regionId);
    const occupied = new Set<string>();
    const outpostCell = buildableCell(world, target, occupied);
    occupied.add(`${outpostCell.x},${outpostCell.z}`);
    const outpostPosition = worldCellToSimulationPosition(world, outpostCell);
    expect(state.processCommand({ targetTick: 1, playerId: 0, type: 'BUILD', buildingType: 'OUTPOST', targetX: outpostPosition.x, targetZ: outpostPosition.z }, 1)).toBe(true);
    for (let tick = 1; tick <= 301; tick += 1) state.advanceEconomy(tick);
    expect(state.snapshot().populationCap[0]).toBe(40);

    const resource = world.resources.find((candidate) => candidate.id === expansion.resourceId)!;
    const resourcePosition = worldCellToSimulationPosition(world, resource.cell);
    expect(state.processCommand({ targetTick: 302, playerId: 0, type: 'BUILD', buildingType: 'EXTRACTOR', targetX: resourcePosition.x, targetZ: resourcePosition.z, resourceNodeId: resource.id }, 302)).toBe(true);
    for (let tick = 302; tick <= 482; tick += 1) state.advanceEconomy(tick);
    const beforeConnected = state.snapshot().resources[0]!.materialMilli;
    for (let tick = 483; tick <= 492; tick += 1) state.advanceEconomy(tick);
    const connectedDelta = state.snapshot().resources[0]!.materialMilli - beforeConnected;
    expect(connectedDelta).toBe(3_000 + (expansion.rich ? 8_000 : 5_000));

    captureRegion(state, world, entities, enemyUnits, 1, intermediate);
    expect(state.ownerOfRegion(target)).toBe(0);
    expect(state.isRegionSupplied(0, target)).toBe(false);
    expect(state.snapshot().populationCap[0]).toBe(30);
    const beforeDisconnected = state.snapshot().resources[0]!.materialMilli;
    for (let tick = 493; tick <= 502; tick += 1) state.advanceEconomy(tick);
    const disconnectedDelta = state.snapshot().resources[0]!.materialMilli - beforeDisconnected;
    expect(disconnectedDelta).toBe(3_000 + (expansion.rich ? 3_200 : 2_000));
    expect(disconnectedDelta).toBeLessThan(connectedDelta);
  });

  it('replays strategic commands to the same combined tactical + economy hash', () => {
    const world = generateWorld(765_432);
    const first = new M03Simulation(world);
    const second = new M03Simulation(world);
    const regionId = playerSpawnRegion(world);
    const cell = buildableCell(world, regionId);
    const position = worldCellToSimulationPosition(world, cell);
    for (const simulation of [first, second]) {
      simulation.enqueueStrategicCommand({ targetTick: 1, playerId: 0, type: 'BUILD', buildingType: 'BARRACKS', targetX: position.x, targetZ: position.z });
      for (let tick = 0; tick < 60; tick += 1) simulation.step();
    }
    expect(first.snapshot().stateHash).toBe(second.snapshot().stateHash);
    expect(first.snapshot().strategic).toEqual(second.snapshot().strategic);
  });
});
