import { describe, expect, it } from 'vitest';
import { EntityStore } from '../../src/simulation/entity-store';
import { M06Simulation } from '../../src/simulation/m06-simulation';
import { NavigationGrid } from '../../src/simulation/navigation';
import { StrategicState } from '../../src/simulation/strategic-state';
import { generateWorld } from '../../src/world/generator';
import type { GeneratedWorld } from '../../src/world/world-definition';
import { generatedWorldToArena, worldCellToSimulationPosition } from '../../src/world/world-arena';

const CORE_MATERIAL_PER_TICK = 300;
const CORE_MANA_PER_TICK = 50;

function harness(blockHeight: number, automatic = true) {
  const world = generateWorld(blockHeight);
  const arena = generatedWorldToArena(world);
  const entities = new EntityStore();
  for (const spawn of arena.units) entities.createUnit(spawn);
  const navigation = new NavigationGrid(arena.traversal);
  const state = new StrategicState(
    world,
    entities,
    navigation,
    automatic ? { automaticResourceSitePlayerIds: [0] } : {},
  );
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

function shortestPath(world: GeneratedWorld, start: number, target: number): number[] | null {
  const queue: number[][] = [[start]];
  const visited = new Set<number>([start]);
  while (queue.length > 0) {
    const path = queue.shift();
    if (!path) break;
    const current = path[path.length - 1]!;
    if (current === target) return path;
    for (const neighbor of [...(world.regions[current]?.neighbors ?? [])].sort((a, b) => a - b)) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push([...path, neighbor]);
    }
  }
  return null;
}

function captureRegion(
  state: StrategicState,
  world: GeneratedWorld,
  entities: EntityStore,
  entityIds: readonly number[],
  regionId: number,
): void {
  const region = world.regions[regionId];
  if (!region) throw new Error(`Missing region ${regionId}.`);
  const position = worldCellToSimulationPosition(world, region.center);
  for (const entityId of entityIds) {
    const component = entities.positions.get(entityId);
    if (!component) continue;
    component.x = position.x;
    component.z = position.z;
  }
  expect(state.processCommand({
    targetTick: 1,
    playerId: 0,
    type: 'CAPTURE',
    entityIds,
    targetRegionId: regionId,
  }, 1)).toBe(true);
  for (let tick = 0; tick < 240; tick += 1) state.advanceTerritory();
  expect(state.ownerOfRegion(regionId)).toBe(0);
}

function expectedAutomaticIncomePerTick(
  sites: ReturnType<StrategicState['snapshot']>['automaticResourceSites'],
): { material: number; mana: number } {
  let material = CORE_MATERIAL_PER_TICK;
  let mana = CORE_MANA_PER_TICK;
  for (const site of sites.filter((entry) => entry.playerId === 0)) {
    if (site.type === 'MATERIAL') {
      const base = site.rich ? 800 : 500;
      material += site.connected ? base : Math.floor(base * 0.4);
    } else {
      const base = site.rich ? 300 : 200;
      mana += site.connected ? base : Math.floor(base * 0.5);
    }
  }
  return { material, mana };
}

describe('P5-A3 automatic baseline resource sites', () => {
  it('activates controlled starting resource nodes without an Extractor or Mana Well', () => {
    const { world, state } = harness(1_000_000);
    const startRegion = playerRegion(world);
    const startingNodes = world.resources.filter((node) => node.regionId === startRegion);
    expect(startingNodes.some((node) => node.type === 'MATERIAL')).toBe(true);

    const before = state.snapshot().resources[0]!;
    const sites = state.snapshot().automaticResourceSites.filter((site) => site.playerId === 0);
    expect(sites.map((site) => site.resourceNodeId)).toEqual(
      startingNodes.map((node) => node.id).sort((a, b) => a.localeCompare(b)),
    );

    const expected = expectedAutomaticIncomePerTick(sites);
    for (let tick = 1; tick <= 10; tick += 1) state.advanceEconomy(tick);
    const after = state.snapshot().resources[0]!;
    expect(after.materialMilli - before.materialMilli).toBe(expected.material * 10);
    expect(after.manaMilli - before.manaMilli).toBe(expected.mana * 10);
  });

  it('activates a captured Mana site and preserves connected supply semantics', () => {
    const { world, entities, state, playerUnits } = harness(1_000_031);
    const start = playerRegion(world);
    const enemy = enemyRegion(world);
    const manaNode = world.resources.find((node) => {
      if (node.type !== 'MANA' || node.regionId === enemy) return false;
      const path = shortestPath(world, start, node.regionId);
      return path !== null && !path.slice(1).includes(enemy);
    });
    if (!manaNode) throw new Error('Seed does not expose an accessible Mana Spring.');

    const path = shortestPath(world, start, manaNode.regionId)!;
    for (const regionId of path.slice(1)) captureRegion(state, world, entities, playerUnits, regionId);

    const snapshot = state.snapshot();
    const site = snapshot.automaticResourceSites.find((entry) => entry.resourceNodeId === manaNode.id);
    expect(site).toMatchObject({ playerId: 0, type: 'MANA', connected: true });
  });

  it('does not double-count a legacy resource building on an automatic site', () => {
    const { world, state } = harness(1_000_000);
    const startRegion = playerRegion(world);
    const materialNode = world.resources.find((node) => node.regionId === startRegion && node.type === 'MATERIAL');
    if (!materialNode) throw new Error('Missing starting Material Deposit.');
    const position = worldCellToSimulationPosition(world, materialNode.cell);

    expect(state.processCommand({
      targetTick: 1,
      playerId: 0,
      type: 'BUILD',
      buildingType: 'EXTRACTOR',
      targetX: position.x,
      targetZ: position.z,
      resourceNodeId: materialNode.id,
    }, 1)).toBe(true);
    for (let tick = 1; tick <= 181; tick += 1) state.advanceEconomy(tick);

    const before = state.snapshot().resources[0]!;
    const sites = state.snapshot().automaticResourceSites.filter((site) => site.playerId === 0);
    const expected = expectedAutomaticIncomePerTick(sites);
    for (let tick = 182; tick <= 191; tick += 1) state.advanceEconomy(tick);
    const after = state.snapshot().resources[0]!;
    expect(after.materialMilli - before.materialMilli).toBe(expected.material * 10);
    expect(after.manaMilli - before.manaMilli).toBe(expected.mana * 10);
  });

  it('enables automatic sites for the player in the current M06 Command Mode runtime only', () => {
    const simulation = new M06Simulation(generateWorld(1_000_000));
    expect(simulation.strategy.automaticResourceSitesEnabled(0)).toBe(true);
    expect(simulation.strategy.automaticResourceSitesEnabled(1)).toBe(false);
  });
});
