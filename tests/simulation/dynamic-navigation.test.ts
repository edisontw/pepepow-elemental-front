import { describe, expect, it } from 'vitest';
import { M01_ARENA, type ArenaDefinition } from '../../src/simulation/arena';
import type { GameCommand } from '../../src/simulation/commands';
import type { UnitSpawn } from '../../src/simulation/components';
import { FixedTickRunner } from '../../src/simulation/fixed-tick-runner';
import { Simulation } from '../../src/simulation/simulation';
import { SurfaceType } from '../../src/simulation/terrain-state';

const FREEZE_CENTER = { x: 2_000, z: -3_000 };

function cast(targetTick: number, effectId: 'FREEZE' | 'HEAT'): GameCommand {
  return { targetTick, playerId: 0, type: 'CAST', effectId, targetX: FREEZE_CENTER.x, targetZ: FREEZE_CENTER.z, radius: 5_000 };
}

function move(targetTick = 3): GameCommand {
  return { targetTick, playerId: 0, type: 'MOVE', entityIds: [1], targetX: 10_500, targetZ: -8_500 };
}

function runTicks(simulation: Simulation, count: number): void {
  for (let index = 0; index < count; index += 1) simulation.step();
}

function playerSpawn(x = -15_000, z = -11_000): UnitSpawn {
  return {
    archetype: 'VANGUARD', playerId: 0, x, z, speedPerTick: 420, selectionRadius: 700,
    maxHealth: 180, attackDamage: 18, attackIntervalTicks: 11, attackRange: 1_250,
  };
}

function arenaWithoutNaturalCrossing(): ArenaDefinition {
  return {
    ...M01_ARENA,
    id: 'dynamic-no-alternate-route',
    units: [playerSpawn()],
    traversal: {
      ...M01_ARENA.traversal,
      patches: M01_ARENA.traversal.patches.filter((patch) => patch.id !== 'natural-crossing'),
    },
  };
}

describe('M01 dynamic water/ice navigation', () => {
  it('uses only the natural crossing before freeze and the shorter ice route after freeze', () => {
    const before = new Simulation('before-freeze');
    before.enqueueCommand(move(1));
    before.step();
    const beforeRiverCells = before.snapshot().entities[0]!.path
      .map((point) => before.navigation.worldToCell(point.x, point.z))
      .filter((cell) => cell.column >= 24 && cell.column <= 28);
    expect(beforeRiverCells.every((cell) => cell.row >= 30 && cell.row <= 32)).toBe(true);

    const after = new Simulation('after-freeze');
    after.enqueueCommand(cast(1, 'FREEZE')); after.enqueueCommand(cast(2, 'FREEZE')); after.enqueueCommand(move());
    runTicks(after, 3);
    const afterRiverCells = after.snapshot().entities[0]!.path
      .map((point) => after.navigation.worldToCell(point.x, point.z))
      .filter((cell) => cell.column >= 24 && cell.column <= 28);
    expect(afterRiverCells.some((cell) => cell.row >= 13 && cell.row <= 19)).toBe(true);
    expect(afterRiverCells.every((cell) => cell.row >= 13 && cell.row <= 19)).toBe(true);
  });

  it('lets a unit cross frozen water without occupying blocked cells', () => {
    const simulation = new Simulation('cross-frozen');
    simulation.enqueueCommand(cast(1, 'FREEZE')); simulation.enqueueCommand(cast(2, 'FREEZE')); simulation.enqueueCommand(move());
    for (let tick = 0; tick < 120; tick += 1) {
      simulation.step();
      const unit = simulation.snapshot().entities[0]!;
      expect(simulation.navigation.isWalkable(simulation.navigation.worldToCell(unit.x, unit.z))).toBe(true);
    }
    expect(simulation.snapshot().entities[0]).toMatchObject({ x: 10_500, z: -8_500 });
  });

  it('rejects a stale path after ice ahead melts and reroutes through the natural crossing', () => {
    const simulation = new Simulation('melt-reroute');
    simulation.enqueueCommand(cast(1, 'FREEZE')); simulation.enqueueCommand(cast(2, 'FREEZE')); simulation.enqueueCommand(move());
    simulation.enqueueCommand(cast(5, 'HEAT')); simulation.enqueueCommand(cast(5, 'HEAT'));
    runTicks(simulation, 6);
    const unit = simulation.snapshot().entities[0]!;
    const riverCells = unit.path.slice(unit.pathIndex)
      .map((point) => simulation.navigation.worldToCell(point.x, point.z))
      .filter((cell) => cell.column >= 24 && cell.column <= 28);
    expect(simulation.terrain.surfaceAt({ column: 26, row: 16 })).toBe(SurfaceType.WATER);
    expect(riverCells.length).toBeGreaterThan(0);
    expect(riverCells.every((cell) => cell.row >= 30 && cell.row <= 32)).toBe(true);
  });

  it('stops safely when stale ice was the only route', () => {
    const simulation = new Simulation('melt-no-route', arenaWithoutNaturalCrossing());
    simulation.enqueueCommand(cast(1, 'FREEZE')); simulation.enqueueCommand(cast(2, 'FREEZE')); simulation.enqueueCommand(move());
    simulation.enqueueCommand(cast(4, 'HEAT')); simulation.enqueueCommand(cast(4, 'HEAT'));
    runTicks(simulation, 5);
    expect(simulation.snapshot().entities[0]).toMatchObject({ targetX: null, targetZ: null, path: [] });
  });

  it('does not teleport and stops movement when ice melts beneath a unit', () => {
    const cellCenter = M01_ARENA.traversal;
    const x = cellCenter.originX + 26 * cellCenter.cellSize + cellCenter.cellSize / 2;
    const z = cellCenter.originZ + 16 * cellCenter.cellSize + cellCenter.cellSize / 2;
    const arena = { ...M01_ARENA, id: 'melt-under-unit', units: [playerSpawn(x, z)] };
    const simulation = new Simulation('melt-under-unit', arena);
    simulation.enqueueCommand(cast(1, 'FREEZE')); simulation.enqueueCommand(cast(2, 'FREEZE'));
    simulation.enqueueCommand({ targetTick: 3, playerId: 0, type: 'MOVE', entityIds: [1], targetX: 10_500, targetZ: -2_500 });
    simulation.enqueueCommand(cast(3, 'HEAT')); simulation.enqueueCommand(cast(3, 'HEAT'));
    runTicks(simulation, 3);
    const positionAtMelt = simulation.snapshot().entities[0]!;
    expect(positionAtMelt.targetX).not.toBeNull();
    expect(simulation.navigation.worldToCell(positionAtMelt.x, positionAtMelt.z)).toEqual({ column: 26, row: 16 });
    simulation.step();
    expect(simulation.snapshot().entities[0]).toMatchObject({
      x: positionAtMelt.x, z: positionAtMelt.z, targetX: null, targetZ: null, path: [],
    });
    expect(simulation.terrain.surfaceAt({ column: 26, row: 16 })).toBe(SurfaceType.WATER);
    expect(simulation.navigation.isWalkable({ column: 26, row: 16 })).toBe(false);
  });

  it('replays identical terrain command streams and diverges when timing changes', () => {
    const commands = [cast(1, 'FREEZE'), cast(2, 'FREEZE'), move(3), cast(20, 'HEAT'), cast(21, 'HEAT')];
    const replay = (): string[] => {
      const simulation = new Simulation('dynamic-replay');
      commands.forEach((command) => simulation.enqueueCommand(command));
      const hashes: string[] = [];
      for (let tick = 1; tick <= 60; tick += 1) {
        simulation.step();
        if (tick % 10 === 0) hashes.push(simulation.snapshot().stateHash);
      }
      return hashes;
    };
    expect(replay()).toEqual(replay());

    const early = new Simulation('timing-divergence');
    const late = new Simulation('timing-divergence');
    [cast(1, 'FREEZE'), cast(2, 'FREEZE'), move(3)].forEach((command) => early.enqueueCommand(command));
    [cast(5, 'FREEZE'), cast(6, 'FREEZE'), move(3)].forEach((command) => late.enqueueCommand(command));
    runTicks(early, 12); runTicks(late, 12);
    expect(early.snapshot().stateHash).not.toBe(late.snapshot().stateHash);
  });

  it('keeps the result independent of render-frame schedule', () => {
    const run = (schedule: number[]): string => {
      const simulation = new Simulation('dynamic-fps');
      simulation.enqueueCommand(cast(1, 'FREEZE')); simulation.enqueueCommand(cast(2, 'FREEZE')); simulation.enqueueCommand(move());
      const runner = new FixedTickRunner(simulation);
      schedule.forEach((milliseconds) => runner.advance(milliseconds));
      return simulation.snapshot().stateHash;
    };
    expect(run(Array.from({ length: 60 }, () => 1000 / 60))).toBe(run(Array.from({ length: 10 }, () => 100)));
  });
});
