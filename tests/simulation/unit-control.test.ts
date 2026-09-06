import { describe, expect, it } from 'vitest';
import type { GameCommand } from '../../src/simulation/commands';
import { Simulation } from '../../src/simulation/simulation';

function runTicks(simulation: Simulation, count: number): void {
  for (let index = 0; index < count; index += 1) simulation.step();
}

function runReplay(commands: readonly GameCommand[], ticks: number): string {
  const simulation = new Simulation('m01-replay-smoke');
  for (const command of commands) simulation.enqueueCommand(command);
  runTicks(simulation, ticks);
  return simulation.snapshot().stateHash;
}

describe('M01 deterministic unit control', () => {
  it('creates deterministic integer entity IDs', () => {
    const first = new Simulation('entity-id-check');
    const second = new Simulation('entity-id-check');
    expect(first.snapshot().entities.map(({ id }) => id)).toEqual(
      second.snapshot().entities.map(({ id }) => id),
    );
    expect(first.snapshot().entities.map(({ id }) => id)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    );
  });

  it('moves multiple units deterministically and applies formation destinations', () => {
    const command: GameCommand = {
      targetTick: 1,
      playerId: 0,
      type: 'MOVE',
      entityIds: [4, 1, 3, 2],
      targetX: 10_000,
      targetZ: 8_000,
    };
    const first = new Simulation('move-check');
    const second = new Simulation('move-check');
    first.enqueueCommand(command);
    second.enqueueCommand(command);
    runTicks(first, 60);
    runTicks(second, 60);

    expect(first.snapshot()).toEqual(second.snapshot());
    const destinations = first.snapshot().entities.slice(0, 4).map(({ x, z }) => [x, z]);
    expect(new Set(destinations.map(String)).size).toBe(4);
  });

  it('applies STOP before movement on its command tick', () => {
    const simulation = new Simulation('stop-check');
    simulation.enqueueCommand({
      targetTick: 1,
      playerId: 0,
      type: 'MOVE',
      entityIds: [1],
      targetX: 15_000,
      targetZ: 10_000,
    });
    runTicks(simulation, 3);
    const beforeStop = simulation.snapshot().entities[0];
    simulation.enqueueCommand({ targetTick: 4, playerId: 0, type: 'STOP', entityIds: [1] });
    simulation.step();
    const afterStop = simulation.snapshot().entities[0];

    expect(afterStop).toMatchObject({ x: beforeStop?.x, z: beforeStop?.z, targetX: null, targetZ: null });
  });

  it('rejects movement for entities the player does not own', () => {
    const commanded = new Simulation('ownership-check');
    const control = new Simulation('ownership-check');
    commanded.enqueueCommand({
      targetTick: 1,
      playerId: 1,
      type: 'MOVE',
      entityIds: [1],
      targetX: 20_000,
      targetZ: 20_000,
    });
    commanded.step();
    control.step();
    expect(commanded.snapshot().stateHash).toBe(control.snapshot().stateHash);
  });

  it('replays an identical MOVE/STOP stream to the same final hash', () => {
    const commands: GameCommand[] = [
      { targetTick: 2, playerId: 0, type: 'MOVE', entityIds: [1, 2, 3, 4], targetX: 9_000, targetZ: -2_000 },
      { targetTick: 12, playerId: 0, type: 'STOP', entityIds: [2, 4] },
      { targetTick: 15, playerId: 0, type: 'MOVE', entityIds: [1, 3], targetX: 14_000, targetZ: 11_000 },
    ];
    expect(runReplay(commands, 50)).toBe(runReplay(commands, 50));
  });

  it('diverges when the command stream differs', () => {
    const base: GameCommand[] = [
      { targetTick: 1, playerId: 0, type: 'MOVE', entityIds: [1, 2], targetX: 10_000, targetZ: 6_000 },
    ];
    const changed: GameCommand[] = [
      { targetTick: 1, playerId: 0, type: 'MOVE', entityIds: [1, 2], targetX: 10_000, targetZ: -6_000 },
    ];
    expect(runReplay(base, 20)).not.toBe(runReplay(changed, 20));
  });
});
