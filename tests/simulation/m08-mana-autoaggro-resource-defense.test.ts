import { describe, expect, it } from 'vitest';
import { acquireEncounterTargets } from '../../src/simulation/auto-aggro';
import { EntityStore } from '../../src/simulation/entity-store';
import { M05Simulation } from '../../src/simulation/m05-simulation';
import { NavigationGrid } from '../../src/simulation/navigation';
import { Simulation } from '../../src/simulation/simulation';
import { StrategicState } from '../../src/simulation/strategic-state';
import { generateWorld } from '../../src/world/generator';
import type { GeneratedWorld, ResourceNode } from '../../src/world/world-definition';
import { generatedWorldToArena, worldCellToSimulationPosition } from '../../src/world/world-arena';

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

function resourceHarness(blockHeight = 1_000_031) {
  const world = generateWorld(blockHeight);
  const arena = generatedWorldToArena(world);
  const entities = new EntityStore();
  for (const spawn of arena.units) entities.createUnit(spawn);
  const navigation = new NavigationGrid(arena.traversal);
  const state = new StrategicState(world, entities, navigation);
  const playerUnits = entities.entityIds().filter((entityId) => entities.factions.get(entityId)?.playerId === 0);
  const enemyUnits = entities.entityIds().filter((entityId) => entities.factions.get(entityId)?.playerId === 1);
  return { world, entities, state, playerUnits, enemyUnits };
}

function moveUnitsToRegion(
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
}

function captureRegion(
  state: StrategicState,
  world: GeneratedWorld,
  entities: EntityStore,
  entityIds: readonly number[],
  regionId: number,
): void {
  if (state.ownerOfRegion(regionId) === 0) return;
  moveUnitsToRegion(world, entities, entityIds, regionId);
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

function accessibleManaNode(world: GeneratedWorld): { node: ResourceNode; path: number[] } {
  const playerSpawn = world.spawns.find((spawn) => spawn.id === 'PLAYER');
  const enemySpawn = world.spawns.find((spawn) => spawn.id === 'ENEMY');
  if (!playerSpawn || !enemySpawn) throw new Error('Missing generated-world spawn.');
  for (const node of world.resources) {
    if (node.type !== 'MANA' || node.regionId === enemySpawn.regionId) continue;
    const path = shortestPath(world, playerSpawn.regionId, node.regionId);
    if (path && !path.slice(1).includes(enemySpawn.regionId)) return { node, path };
  }
  throw new Error('Seed does not expose an accessible Mana Spring.');
}

function buildAndFortifyManaWell() {
  const harness = resourceHarness();
  const { world, entities, state, playerUnits } = harness;
  const { node, path } = accessibleManaNode(world);
  for (const regionId of path.slice(1)) captureRegion(state, world, entities, playerUnits, regionId);

  const position = worldCellToSimulationPosition(world, node.cell);
  expect(state.processCommand({
    targetTick: 1,
    playerId: 0,
    type: 'BUILD',
    buildingType: 'MANA_WELL',
    targetX: position.x,
    targetZ: position.z,
    resourceNodeId: node.id,
  }, 1)).toBe(true);
  for (let tick = 1; tick <= 181; tick += 1) state.advanceEconomy(tick);

  const well = state.snapshot().buildings.find((building) => building.resourceNodeId === node.id);
  if (!well) throw new Error('Mana Well did not complete.');
  expect(well.completed).toBe(true);
  expect(well.currentHealth).toBe(500);
  expect(state.processCommand({
    targetTick: 182,
    playerId: 0,
    type: 'UPGRADE_RESOURCE_DEFENSE',
    buildingId: well.id,
  }, 182)).toBe(true);
  return { ...harness, node, wellId: well.id };
}

describe('M08 Mana, encounter combat, and resource defense correction', () => {
  it('enables shared player Mana rules by default in war runs and enforces spell cost plus cooldown', () => {
    const simulation = new M05Simulation(generateWorld(1_000_000), { difficulty: 'CASUAL' });
    const before = simulation.snapshot();
    const caster = before.entities.find((entity) => entity.playerId === 0 && entity.alive);
    if (!caster) throw new Error('Missing player unit.');

    expect(before.elementalMana.enabled).toBe(true);
    const beforeMana = before.elementalMana.players[0]!.currentManaMilli;
    simulation.enqueueCommand({
      targetTick: 1,
      playerId: 0,
      type: 'CAST',
      effectId: 'FIRE',
      targetX: caster.x,
      targetZ: caster.z,
      radius: 3_000,
    });
    const afterCast = simulation.step();
    expect(afterCast.elementalMana.lastCastResult).toMatchObject({ effectId: 'FIRE', status: 'CAST' });
    expect(afterCast.elementalMana.players[0]!.currentManaMilli).toBeLessThan(beforeMana);
    expect(afterCast.elementalMana.players[0]!.cooldownTicks.FIRE).toBeGreaterThan(0);

    const manaAfterCast = afterCast.elementalMana.players[0]!.currentManaMilli;
    simulation.enqueueCommand({
      targetTick: 2,
      playerId: 0,
      type: 'CAST',
      effectId: 'FIRE',
      targetX: caster.x,
      targetZ: caster.z,
      radius: 3_000,
    });
    const duringCooldown = simulation.step();
    expect(duringCooldown.elementalMana.lastCastResult).toMatchObject({ effectId: 'FIRE', status: 'COOLDOWN' });
    expect(duringCooldown.elementalMana.players[0]!.currentManaMilli).toBeGreaterThanOrEqual(manaAfterCast);
  });

  it('deterministically auto-acquires a nearby visible hostile on encounter', () => {
    const world = generateWorld(1_000_000);
    const simulation = new Simulation('m08-auto-aggro-test', generatedWorldToArena(world));
    const playerId = simulation.entities.entityIds().find((entityId) => simulation.entities.factions.get(entityId)?.playerId === 0);
    const enemyId = simulation.entities.entityIds().find((entityId) => simulation.entities.factions.get(entityId)?.playerId === 1);
    if (!playerId || !enemyId) throw new Error('Missing opposing units.');
    const playerPosition = simulation.entities.positions.get(playerId)!;
    const enemyPosition = simulation.entities.positions.get(enemyId)!;
    enemyPosition.x = playerPosition.x + 1_000;
    enemyPosition.z = playerPosition.z;
    simulation.visibility.update(simulation.entities, simulation.navigation);

    const acquired = acquireEncounterTargets(
      simulation.entities,
      simulation.navigation,
      simulation.visibility,
      simulation.terrain,
      1,
    );
    expect(acquired).toBeGreaterThan(0);
    expect(simulation.entities.combat.get(playerId)!.targetEntityId).toBe(enemyId);
  });

  it('fortifies, defends, destroys, and deterministically hashes a Mana Well', () => {
    const first = buildAndFortifyManaWell();
    const fortified = first.state.snapshot().buildings.find((building) => building.id === first.wellId)!;
    expect(fortified.resourceDefenseLevel).toBe(1);
    expect(fortified.maxHealth).toBe(800);
    expect(fortified.currentHealth).toBe(800);

    const enemyId = first.enemyUnits[0];
    if (!enemyId) throw new Error('Missing enemy unit.');
    const enemyPosition = first.entities.positions.get(enemyId)!;
    enemyPosition.x = fortified.x + 7_000;
    enemyPosition.z = fortified.z;
    const enemyHealth = first.entities.health.get(enemyId)!;
    const beforeTowerShot = enemyHealth.current;
    first.state.advanceResourceCombat(182);
    expect(enemyHealth.current).toBe(beforeTowerShot - 16);

    enemyPosition.x = fortified.x + 1_000;
    const enemyCombat = first.entities.combat.get(enemyId)!;
    enemyCombat.attackDamage = 2_000;
    enemyCombat.nextAttackTick = 0;
    first.state.advanceResourceCombat(183);
    const destroyed = first.state.snapshot().buildings.find((building) => building.id === first.wellId)!;
    expect(destroyed.destroyed).toBe(true);
    expect(destroyed.currentHealth).toBe(0);

    const hashAfterDestruction = first.state.snapshot().stateHash;
    const second = buildAndFortifyManaWell();
    const secondWell = second.state.snapshot().buildings.find((building) => building.id === second.wellId)!;
    const secondEnemyId = second.enemyUnits[0]!;
    const secondEnemyPosition = second.entities.positions.get(secondEnemyId)!;
    secondEnemyPosition.x = secondWell.x + 7_000;
    secondEnemyPosition.z = secondWell.z;
    second.state.advanceResourceCombat(182);
    secondEnemyPosition.x = secondWell.x + 1_000;
    const secondEnemyCombat = second.entities.combat.get(secondEnemyId)!;
    secondEnemyCombat.attackDamage = 2_000;
    secondEnemyCombat.nextAttackTick = 0;
    second.state.advanceResourceCombat(183);
    expect(second.state.snapshot().stateHash).toBe(hashAfterDestruction);

    const rebuiltPosition = worldCellToSimulationPosition(first.world, first.node.cell);
    expect(first.state.processCommand({
      targetTick: 184,
      playerId: 0,
      type: 'BUILD',
      buildingType: 'MANA_WELL',
      targetX: rebuiltPosition.x,
      targetZ: rebuiltPosition.z,
      resourceNodeId: first.node.id,
    }, 184)).toBe(true);
  });
});
