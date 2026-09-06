import { describe, expect, it } from 'vitest';
import { M01_ARENA } from '../../src/simulation/arena';
import { NavigationGrid } from '../../src/simulation/navigation';
import { Simulation } from '../../src/simulation/simulation';

function runTicks(simulation: Simulation, count: number): void {
  for (let index = 0; index < count; index += 1) simulation.step();
}

describe('M01 deterministic static navigation', () => {
  it('marks river and terrain walls blocked while leaving forest and the natural crossing walkable', () => {
    const navigation = new NavigationGrid(M01_ARENA.traversal);
    expect(navigation.cellKind({ column: 26, row: 10 })).toBe('BLOCKED_RIVER');
    expect(navigation.cellKind({ column: 10, row: 21 })).toBe('BLOCKED_TERRAIN');
    expect(navigation.cellKind({ column: 26, row: 31 })).toBe('NATURAL_CROSSING');
    expect(navigation.isWalkable({ column: 10, row: 30 })).toBe(true);
  });

  it('resolves a blocked MOVE target to a deterministic nearest legal cell', () => {
    const navigation = new NavigationGrid(M01_ARENA.traversal);
    expect(navigation.resolveWalkableTarget({ column: 26, row: 10 })).toEqual({ column: 29, row: 10 });
  });

  it('routes across the river only through the natural crossing and has a stable equal-cost tie-break', () => {
    const navigation = new NavigationGrid(M01_ARENA.traversal);
    const first = navigation.findPath({ column: 20, row: 10 }, { column: 32, row: 10 });
    const second = navigation.findPath({ column: 20, row: 10 }, { column: 32, row: 10 });
    expect(first).toEqual(second);
    expect(first?.filter(({ column }) => column >= 24 && column <= 28).every(({ row }) => row >= 30 && row <= 32)).toBe(true);

    const tiePath = navigation.findPath({ column: 20, row: 19 }, { column: 22, row: 21 });
    expect(tiePath?.[0]).toEqual({ column: 20, row: 20 });
  });

  it('moves a unit through the crossing without ever occupying blocked cells', () => {
    const simulation = new Simulation('river-crossing');
    simulation.enqueueCommand({ targetTick: 1, playerId: 0, type: 'MOVE', entityIds: [1], targetX: 10_500, targetZ: -8_500 });
    for (let index = 0; index < 260; index += 1) {
      simulation.step();
      const unit = simulation.snapshot().entities[0]!;
      expect(simulation.navigation.isWalkable(simulation.navigation.worldToCell(unit.x, unit.z))).toBe(true);
    }
    const final = simulation.snapshot().entities[0]!;
    expect(final.x).toBe(10_500);
    expect(final.z).toBe(-8_500);
  });

  it('produces identical paths/final state and different target hashes deterministically', () => {
    const first = new Simulation('path-replay');
    const second = new Simulation('path-replay');
    const different = new Simulation('path-replay');
    const command = { targetTick: 1, playerId: 0, type: 'MOVE' as const, entityIds: [1], targetX: 10_500, targetZ: -8_500 };
    first.enqueueCommand(command);
    second.enqueueCommand(command);
    different.enqueueCommand({ ...command, targetZ: 8_500 });
    first.step();
    second.step();
    expect(first.snapshot().entities[0]?.path).toEqual(second.snapshot().entities[0]?.path);
    runTicks(first, 259);
    runTicks(second, 259);
    runTicks(different, 259);
    expect(first.snapshot().stateHash).toBe(second.snapshot().stateHash);
    expect(first.snapshot().stateHash).not.toBe(different.snapshot().stateHash);
  });
});
