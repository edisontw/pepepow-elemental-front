import { describe, expect, it } from 'vitest';
import { CommandQueue, type GameCommand } from '../../src/simulation/commands';

describe('CommandQueue', () => {
  it('orders commands by target tick, player, then stable enqueue order', () => {
    const queue = new CommandQueue();
    queue.enqueue({ targetTick: 3, playerId: 2, type: 'STOP', entityIds: [5] });
    queue.enqueue({ targetTick: 2, playerId: 1, type: 'STOP', entityIds: [4] });
    queue.enqueue({ targetTick: 3, playerId: 1, type: 'STOP', entityIds: [3] });
    queue.enqueue({ targetTick: 3, playerId: 1, type: 'MOVE', entityIds: [2], targetX: 4, targetZ: 8 });

    expect(queue.drainForTick(3).map((command) => [command.targetTick, command.playerId, command.type])).toEqual([
      [2, 1, 'STOP'],
      [3, 1, 'STOP'],
      [3, 1, 'MOVE'],
      [3, 2, 'STOP'],
    ]);
  });

  it('normalizes entity IDs into unique ascending order', () => {
    const queue = new CommandQueue();
    queue.enqueue({ targetTick: 1, playerId: 0, type: 'STOP', entityIds: [4, 2, 4, 3] });
    expect(queue.drainForTick(1)[0]?.entityIds).toEqual([2, 3, 4]);
  });

  it('applies same-tick commands in deterministic enqueue order', () => {
    const makeQueue = (): GameCommand[] => {
      const queue = new CommandQueue();
      queue.enqueue({ targetTick: 4, playerId: 0, type: 'MOVE', entityIds: [1], targetX: 100, targetZ: 200 });
      queue.enqueue({ targetTick: 4, playerId: 0, type: 'STOP', entityIds: [1] });
      return queue.drainForTick(4);
    };
    expect(makeQueue()).toEqual(makeQueue());
  });

  it('normalizes ATTACK attackers while preserving the target entity', () => {
    const queue = new CommandQueue();
    queue.enqueue({ targetTick: 2, playerId: 0, type: 'ATTACK', entityIds: [4, 1, 4, 2], targetEntityId: 17 });
    expect(queue.drainForTick(2)[0]).toEqual({
      targetTick: 2, playerId: 0, type: 'ATTACK', entityIds: [1, 2, 4], targetEntityId: 17,
    });
  });
});
