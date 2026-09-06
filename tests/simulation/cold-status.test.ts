import { describe, expect, it } from 'vitest';
import { M01_ARENA, type ArenaDefinition } from '../../src/simulation/arena';
import type { UnitSpawn } from '../../src/simulation/components';
import { FixedTickRunner } from '../../src/simulation/fixed-tick-runner';
import { CHILLED_DURATION_TICKS, FROZEN_DURATION_TICKS, Simulation } from '../../src/simulation/simulation';

const UNIT = { x: -10_500, z: -5_500 };

function spawn(playerId = 0, x = UNIT.x, z = UNIT.z): UnitSpawn {
  return {
    archetype: 'VANGUARD', playerId, x, z, speedPerTick: 500, selectionRadius: 700,
    maxHealth: 180, attackDamage: 18, attackIntervalTicks: 10, attackRange: 1_250,
  };
}

function arenaWith(units: readonly UnitSpawn[]): ArenaDefinition {
  return { ...M01_ARENA, id: 'cold-status', units };
}

function cast(simulation: Simulation, tick: number, effectId: 'FREEZE' | 'HEAT' | 'FIRE'): void {
  simulation.enqueueCommand({
    targetTick: tick, playerId: 0, type: 'CAST', effectId,
    targetX: UNIT.x, targetZ: UNIT.z, radius: 700,
  });
}

describe('M01 authoritative Chilled and Frozen statuses', () => {
  it('chills on first cold exposure, freezes on the second, and heat thaws', () => {
    const simulation = new Simulation('cold-threshold', arenaWith([spawn()]));
    cast(simulation, 1, 'FREEZE');
    simulation.step();
    expect(simulation.snapshot().entities[0]).toMatchObject({ chilledTicks: CHILLED_DURATION_TICKS, frozenTicks: 0 });

    cast(simulation, 2, 'FREEZE');
    simulation.step();
    expect(simulation.snapshot().entities[0]).toMatchObject({ chilledTicks: 0, frozenTicks: FROZEN_DURATION_TICKS });

    cast(simulation, 3, 'HEAT');
    simulation.step();
    expect(simulation.snapshot().entities[0]).toMatchObject({ chilledTicks: 0, frozenTicks: 0 });
  });

  it('freezes a Wet unit on first exposure', () => {
    const water = { x: 2_500, z: -2_500 };
    const simulation = new Simulation('wet-freeze', arenaWith([spawn(0, water.x, water.z)]));
    simulation.step();
    expect(simulation.snapshot().entities[0]?.wet).toBe(true);
    simulation.enqueueCommand({
      targetTick: 2, playerId: 0, type: 'CAST', effectId: 'FREEZE',
      targetX: water.x, targetZ: water.z, radius: 700,
    });
    simulation.step();
    expect(simulation.snapshot().entities[0]).toMatchObject({ chilledTicks: 0, frozenTicks: FROZEN_DURATION_TICKS });
  });

  it('halves Chilled movement and makes Frozen units unable to move or attack', () => {
    const chilled = new Simulation('chilled-movement', arenaWith([spawn()]));
    chilled.entities.statuses.get(1)!.chilledTicks = 5;
    chilled.enqueueCommand({ targetTick: 1, playerId: 0, type: 'MOVE', entityIds: [1], targetX: -5_500, targetZ: -5_500 });
    chilled.step();
    expect(chilled.snapshot().entities[0]?.x).toBe(UNIT.x + 250);

    const frozen = new Simulation('frozen-actions', arenaWith([spawn(), spawn(1, -9_500, -5_500)]));
    frozen.entities.statuses.get(1)!.frozenTicks = 5;
    frozen.enqueueCommand({ targetTick: 1, playerId: 0, type: 'ATTACK', entityIds: [1], targetEntityId: 2 });
    frozen.step();
    expect(frozen.snapshot().entities[0]?.x).toBe(UNIT.x);
    expect(frozen.snapshot().entities[1]?.currentHealth).toBe(180);
  });

  it('hashes cold status and replays the same cast stream independently of render FPS', () => {
    const first = new Simulation('cold-hash', arenaWith([spawn()]));
    const second = new Simulation('cold-hash', arenaWith([spawn()]));
    first.entities.statuses.get(1)!.chilledTicks = 1;
    expect(first.snapshot().stateHash).not.toBe(second.snapshot().stateHash);

    const run = (schedule: number[]): string => {
      const simulation = new Simulation('cold-replay', arenaWith([spawn()]));
      cast(simulation, 1, 'FREEZE');
      cast(simulation, 3, 'FREEZE');
      cast(simulation, 8, 'FIRE');
      const runner = new FixedTickRunner(simulation);
      for (const frameMs of schedule) runner.advance(frameMs);
      return simulation.snapshot().stateHash;
    };
    expect(run(Array.from({ length: 20 }, () => 50))).toBe(run(Array.from({ length: 10 }, () => 100)));
  });
});
