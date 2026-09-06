import { describe, expect, it } from 'vitest';
import { M01_ARENA, type ArenaDefinition } from '../../src/simulation/arena';
import type { UnitSpawn } from '../../src/simulation/components';
import { FixedTickRunner } from '../../src/simulation/fixed-tick-runner';
import { Simulation } from '../../src/simulation/simulation';
import { VisibilityLevel } from '../../src/simulation/visibility-state';

function spawn(playerId: number, x: number, z: number): UnitSpawn {
  return {
    archetype: 'VANGUARD', playerId, x, z, speedPerTick: 500, selectionRadius: 700,
    maxHealth: 180, attackDamage: 18, attackIntervalTicks: 10, attackRange: 1_250,
  };
}

function arenaWith(units: readonly UnitSpawn[]): ArenaDefinition {
  return { ...M01_ARENA, id: 'fog-baseline', units };
}

describe('M01 authoritative fog-of-war baseline', () => {
  it('tracks Unexplored, Explored, and Visible cells per player', () => {
    const simulation = new Simulation('fog-levels', arenaWith([
      spawn(0, -10_500, -5_500),
      spawn(1, -3_500, -5_500),
      spawn(1, 18_500, 15_500),
    ]));
    expect(simulation.visibility.levelAt(0, { column: 13, row: 13 })).toBe(VisibilityLevel.VISIBLE);
    expect(simulation.visibility.levelAt(0, { column: 47, row: 37 })).toBe(VisibilityLevel.UNEXPLORED);
    expect(simulation.snapshot().entities[1]?.visibleToPlayer).toBe(true);
    expect(simulation.snapshot().entities[2]?.visibleToPlayer).toBe(false);

    simulation.entities.positions.get(1)!.x = 10_500;
    simulation.entities.positions.get(1)!.z = 10_500;
    simulation.step();
    expect(simulation.visibility.levelAt(0, { column: 13, row: 13 })).toBe(VisibilityLevel.EXPLORED);
  });

  it('removes vision from dead units while preserving explored terrain', () => {
    const simulation = new Simulation('fog-death', arenaWith([spawn(0, -10_500, -5_500)]));
    const formerlyVisible = { column: 13, row: 13 };
    simulation.entities.health.get(1)!.current = 0;
    simulation.step();
    expect(simulation.visibility.levelAt(0, formerlyVisible)).toBe(VisibilityLevel.EXPLORED);
    expect(simulation.snapshot().visibility.visible).toBe(0);
  });

  it('includes visibility in the canonical hash and remains replay/FPS independent', () => {
    const arena = arenaWith([spawn(0, -10_500, -5_500)]);
    const first = new Simulation('fog-hash', arena);
    const second = new Simulation('fog-hash', arena);
    first.visibility.cellsForPlayer(0)![0] = VisibilityLevel.VISIBLE;
    expect(first.snapshot().stateHash).not.toBe(second.snapshot().stateHash);

    const run = (schedule: number[]): ReturnType<Simulation['snapshot']> => {
      const simulation = new Simulation('fog-replay', arena);
      simulation.enqueueCommand({
        targetTick: 1, playerId: 0, type: 'MOVE', entityIds: [1], targetX: -2_500, targetZ: 5_500,
      });
      const runner = new FixedTickRunner(simulation);
      for (const frameMs of schedule) runner.advance(frameMs);
      return simulation.snapshot();
    };
    expect(run(Array.from({ length: 20 }, () => 50))).toEqual(run(Array.from({ length: 10 }, () => 100)));
  });
});
