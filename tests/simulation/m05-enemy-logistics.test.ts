import { describe, expect, it } from 'vitest';
import { enemyProductionProfile } from '../../src/simulation/enemy-logistics-state';
import { M05Simulation } from '../../src/simulation/m05-simulation';
import { generateWorld } from '../../src/world/generator';

describe('M05 enemy logistics', () => {
  it('uses faction-specific producers and unit cycles', () => {
    expect(enemyProductionProfile('IRON_LEGION')).toEqual({
      producer: 'BARRACKS',
      cycle: ['SPEAR_GUARD', 'VANGUARD', 'RANGER', 'SPEAR_GUARD'],
    });
    expect(enemyProductionProfile('FLAME_CULT')).toEqual({
      producer: 'ARCANE_TOWER',
      cycle: ['ELEMENTALIST', 'ELEMENTALIST', 'ELEMENTALIST'],
    });
    expect(enemyProductionProfile('WILD_HORDE')).toEqual({
      producer: 'BARRACKS',
      cycle: ['SCOUT', 'VANGUARD', 'RANGER', 'SCOUT'],
    });
  });

  it('builds the faction producer through M03 BUILD and pays the normal resource cost', () => {
    const world = generateWorld(1_000_000);
    const simulation = new M05Simulation(world, { faction: 'FLAME_CULT', difficulty: 'STANDARD' });
    const initial = simulation.strategy.snapshot().resources[1]!;
    expect(initial.materialMilli).toBe(300_000);
    expect(initial.manaMilli).toBe(100_000);

    simulation.step();
    expect(simulation.enemyLogistics.snapshot().lastAction).toBe('BUILD_PRODUCER');
    simulation.step();

    const strategic = simulation.strategy.snapshot();
    const tower = strategic.buildings.find((building) => building.playerId === 1 && building.type === 'ARCANE_TOWER');
    expect(tower).toBeDefined();
    expect(tower?.completed).toBe(false);
    expect(strategic.resources[1]!.materialMilli).toBeLessThan(initial.materialMilli - 219_000);
    expect(strategic.resources[1]!.manaMilli).toBeLessThan(initial.manaMilli - 39_000);
  });

  it('eventually produces a new enemy only from its completed producer and normal TRAIN queue', () => {
    const world = generateWorld(1_000_888);
    const simulation = new M05Simulation(world, { faction: 'IRON_LEGION', difficulty: 'STANDARD' });
    const initialEnemyIds = simulation.snapshot().entities.filter((entity) => entity.playerId === 1).map((entity) => entity.id);
    expect(initialEnemyIds).toHaveLength(6);

    let sawProducer = false;
    let sawTrainQueue = false;
    for (let tick = 0; tick < 700; tick += 1) {
      simulation.step();
      const strategic = simulation.strategy.snapshot();
      const barracks = strategic.buildings.find((building) => building.playerId === 1 && building.type === 'BARRACKS');
      if (barracks?.completed) sawProducer = true;
      if (strategic.productionQueue.some((order) => order.playerId === 1)) sawTrainQueue = true;
      if (simulation.snapshot().entities.filter((entity) => entity.playerId === 1).length > initialEnemyIds.length) break;
    }

    const finalSnapshot = simulation.snapshot();
    const newEnemies = finalSnapshot.entities.filter((entity) => entity.playerId === 1 && !initialEnemyIds.includes(entity.id));
    expect(sawProducer).toBe(true);
    expect(sawTrainQueue).toBe(true);
    expect(newEnemies.length).toBeGreaterThan(0);
    expect(newEnemies[0]?.archetype).toBe('SPEAR_GUARD');
    expect(simulation.enemyLogistics.snapshot().commandCount).toBeGreaterThanOrEqual(2);
  });

  it('keeps logistics deterministic and part of the combined M05 hash', () => {
    const world = generateWorld(1_000_999);
    const first = new M05Simulation(world, { faction: 'WILD_HORDE', difficulty: 'HARD' });
    const second = new M05Simulation(world, { faction: 'WILD_HORDE', difficulty: 'HARD' });
    for (let tick = 0; tick < 450; tick += 1) {
      const firstFrame = first.step();
      const secondFrame = second.step();
      expect(firstFrame.stateHash).toBe(secondFrame.stateHash);
    }
    expect(first.enemyLogistics.snapshot()).toEqual(second.enemyLogistics.snapshot());
  });
});
