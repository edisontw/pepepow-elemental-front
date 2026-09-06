import { describe, expect, it } from 'vitest';
import { EnemyWarState } from '../../src/simulation/enemy-war-state';
import {
  ENEMY_DIFFICULTIES,
  ENEMY_FACTIONS,
  scoreEnemyActions,
  validateM05Content,
  type EnemyUtilityContext,
} from '../../src/simulation/m05-content';
import { M05Simulation } from '../../src/simulation/m05-simulation';
import { generateWorld } from '../../src/world/generator';
import { worldCellToSimulationPosition } from '../../src/world/world-arena';

const NOOP_SINK = {
  enqueueCommand: () => undefined,
  enqueueStrategicCommand: () => undefined,
};

function utilityContext(overrides: Partial<EnemyUtilityContext> = {}): EnemyUtilityContext {
  return {
    ownStrength: 600,
    knownPlayerStrength: 500,
    visiblePlayerUnits: 0,
    ownRegionCount: 1,
    neutralFrontierCount: 1,
    threatenedOwnRegions: 0,
    knownPlayerSuppliedRegions: 0,
    contestablePoiCount: 0,
    unknownRegionCount: 8,
    damagedArmyPermille: 0,
    directorPressure: 40,
    recoveryActive: false,
    antiTurtleActive: false,
    ...overrides,
  };
}

describe('M05 Enemy War', () => {
  it('validates faction and difficulty profiles without raw combat-stat difficulty modifiers', () => {
    expect(validateM05Content()).toEqual([]);
    expect(Object.keys(ENEMY_FACTIONS)).toEqual(['IRON_LEGION', 'FLAME_CULT', 'WILD_HORDE']);
    expect(ENEMY_DIFFICULTIES.HARD.decisionIntervalTicks).toBeLessThan(ENEMY_DIFFICULTIES.STANDARD.decisionIntervalTicks);
    expect(ENEMY_DIFFICULTIES.STANDARD.decisionIntervalTicks).toBeLessThan(ENEMY_DIFFICULTIES.CASUAL.decisionIntervalTicks);
    for (const profile of Object.values(ENEMY_DIFFICULTIES)) {
      expect(Object.keys(profile).sort()).toEqual(['decisionIntervalTicks', 'id', 'memoryDecayPerDecision', 'minimumActionScore']);
    }
  });

  it('gives the three factions behaviorally distinct utility preferences', () => {
    const raidContext = utilityContext({ knownPlayerSuppliedRegions: 2, antiTurtleActive: true, directorPressure: 70 });
    const ironRaid = scoreEnemyActions(raidContext, ENEMY_FACTIONS.IRON_LEGION).RAID;
    const flameRaid = scoreEnemyActions(raidContext, ENEMY_FACTIONS.FLAME_CULT).RAID;
    expect(flameRaid).toBeGreaterThan(ironRaid);

    const scoutContext = utilityContext({ unknownRegionCount: 10, visiblePlayerUnits: 0, directorPressure: 15 });
    const ironScout = scoreEnemyActions(scoutContext, ENEMY_FACTIONS.IRON_LEGION).SCOUT;
    const hordeScout = scoreEnemyActions(scoutContext, ENEMY_FACTIONS.WILD_HORDE).SCOUT;
    expect(hordeScout).toBeGreaterThan(ironScout);
  });

  it('records a visible player unit, then preserves only last-known position after it leaves enemy fog', () => {
    const world = generateWorld(1_000_000);
    const simulation = new M05Simulation(world, { faction: 'IRON_LEGION', difficulty: 'STANDARD' });
    const playerId = simulation.entities.entityIds().find((entityId) => simulation.entities.factions.get(entityId)?.playerId === 0);
    const enemyId = simulation.entities.entityIds().find((entityId) => simulation.entities.factions.get(entityId)?.playerId === 1);
    expect(playerId).toBeDefined();
    expect(enemyId).toBeDefined();
    if (playerId === undefined || enemyId === undefined) return;

    const enemyPosition = simulation.entities.positions.get(enemyId)!;
    const playerPosition = simulation.entities.positions.get(playerId)!;
    playerPosition.x = enemyPosition.x;
    playerPosition.z = enemyPosition.z;
    simulation.visibility.update(simulation.entities, simulation.navigation);
    simulation.enemyWar.advance(1, simulation.strategy.snapshot(), NOOP_SINK);
    const seen = simulation.enemyWar.snapshot().lastKnownPlayerUnits.find((unit) => unit.entityId === playerId);
    expect(seen).toBeDefined();
    expect(simulation.enemyWar.snapshot().visiblePlayerEntityIds).toContain(playerId);
    if (!seen) return;

    const playerSpawn = world.spawns.find((spawn) => spawn.id === 'PLAYER');
    expect(playerSpawn).toBeDefined();
    if (!playerSpawn) return;
    const hiddenPosition = worldCellToSimulationPosition(world, playerSpawn.cell);
    playerPosition.x = hiddenPosition.x;
    playerPosition.z = hiddenPosition.z;
    simulation.visibility.update(simulation.entities, simulation.navigation);
    expect(simulation.visibility.isWorldVisible(1, playerPosition.x, playerPosition.z, simulation.navigation)).toBe(false);
    simulation.enemyWar.advance(2, simulation.strategy.snapshot(), NOOP_SINK);

    const remembered = simulation.enemyWar.snapshot().lastKnownPlayerUnits.find((unit) => unit.entityId === playerId);
    expect(simulation.enemyWar.snapshot().visiblePlayerEntityIds).not.toContain(playerId);
    expect(remembered?.x).toBe(seen.x);
    expect(remembered?.z).toBe(seen.z);
    expect(remembered?.lastSeenTick).toBe(1);
  });

  it('does not learn a hidden player-owned region from authoritative strategic state alone', () => {
    const world = generateWorld(1_000_111);
    const simulation = new M05Simulation(world);
    const playerSpawn = world.spawns.find((spawn) => spawn.id === 'PLAYER');
    expect(playerSpawn).toBeDefined();
    if (!playerSpawn) return;
    const center = worldCellToSimulationPosition(world, world.regions[playerSpawn.regionId]!.center);
    expect(simulation.visibility.isWorldVisible(1, center.x, center.z, simulation.navigation)).toBe(false);
    simulation.enemyWar.advance(1, simulation.strategy.snapshot(), NOOP_SINK);
    const known = simulation.enemyWar.snapshot().knownRegionOwners.find((entry) => entry.regionId === playerSpawn.regionId);
    expect(known?.owner).not.toBe(0);
  });

  it('reproduces Enemy War decisions and combined hashes from the same world and command stream', () => {
    const world = generateWorld(1_000_222);
    const first = new M05Simulation(world, { faction: 'WILD_HORDE', difficulty: 'HARD' });
    const second = new M05Simulation(world, { faction: 'WILD_HORDE', difficulty: 'HARD' });
    for (let tick = 0; tick < 120; tick += 1) {
      const firstFrame = first.step();
      const secondFrame = second.step();
      expect(firstFrame.stateHash).toBe(secondFrame.stateHash);
    }
    expect(first.enemyWar.snapshot()).toEqual(second.enemyWar.snapshot());
    expect(first.enemyWar.snapshot().decisionCount).toBeGreaterThan(1);
  });

  it('changes decision tempo by difficulty without changing unit combat statistics', () => {
    const world = generateWorld(1_000_333);
    const casual = new M05Simulation(world, { difficulty: 'CASUAL' });
    const hard = new M05Simulation(world, { difficulty: 'HARD' });
    const casualEnemy = casual.snapshot().entities.filter((entity) => entity.playerId === 1);
    const hardEnemy = hard.snapshot().entities.filter((entity) => entity.playerId === 1);
    expect(hardEnemy.map((entity) => [entity.archetype, entity.maxHealth, entity.attackDamage, entity.attackRange]))
      .toEqual(casualEnemy.map((entity) => [entity.archetype, entity.maxHealth, entity.attackDamage, entity.attackRange]));

    for (let tick = 0; tick < 100; tick += 1) {
      casual.step();
      hard.step();
    }
    expect(hard.enemyWar.snapshot().decisionCount).toBeGreaterThan(casual.enemyWar.snapshot().decisionCount);
  });

  it('does not create arbitrary enemy units while producing strategic pressure', () => {
    const world = generateWorld(1_000_444);
    const simulation = new M05Simulation(world, { faction: 'FLAME_CULT', difficulty: 'HARD' });
    const initialEnemyCount = simulation.snapshot().entities.filter((entity) => entity.playerId === 1).length;
    for (let tick = 0; tick < 160; tick += 1) simulation.step();
    const finalEnemyCount = simulation.snapshot().entities.filter((entity) => entity.playerId === 1).length;
    expect(finalEnemyCount).toBeLessThanOrEqual(initialEnemyCount);
    expect(simulation.enemyWar.snapshot().currentDecision).not.toBeNull();
    expect(simulation.enemyWar.snapshot().director.pressure).toBeGreaterThanOrEqual(0);
    expect(simulation.enemyWar.snapshot().director.pressure).toBeLessThanOrEqual(100);
  });

  it('can instantiate the AI state independently of presentation and choose a deterministic action', () => {
    const world = generateWorld(1_000_555);
    const simulation = new M05Simulation(world);
    const state = new EnemyWarState(
      world,
      simulation.entities,
      simulation.navigation,
      simulation.visibility,
      'IRON_LEGION',
      'STANDARD',
    );
    state.advance(1, simulation.strategy.snapshot(), NOOP_SINK);
    expect(state.snapshot().currentDecision).not.toBeNull();
    expect(state.snapshot().stateHash).toMatch(/^[0-9a-f]{8}$/);
  });
});
