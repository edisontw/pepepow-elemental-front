import type { EntityID, PlayerID } from './components';

interface CommandBase {
  targetTick: number;
  playerId: PlayerID;
  entityIds: readonly EntityID[];
}

export interface MoveCommand extends CommandBase {
  type: 'MOVE';
  targetX: number;
  targetZ: number;
}

export interface StopCommand extends CommandBase {
  type: 'STOP';
}

export interface AttackCommand extends CommandBase {
  type: 'ATTACK';
  targetEntityId: EntityID;
}

export type GameCommand = MoveCommand | StopCommand | AttackCommand;

interface QueuedCommand {
  command: GameCommand;
  enqueueOrder: number;
}

function normalizeEntityIds(entityIds: readonly EntityID[]): EntityID[] {
  return [...new Set(entityIds)]
    .filter((entityId) => Number.isSafeInteger(entityId) && entityId > 0)
    .sort((left, right) => left - right);
}

function normalizeCommand(command: GameCommand): GameCommand {
  const base = {
    targetTick: command.targetTick,
    playerId: command.playerId,
    entityIds: normalizeEntityIds(command.entityIds),
  };
  if (command.type === 'MOVE') {
    return { ...base, type: 'MOVE', targetX: Math.round(command.targetX), targetZ: Math.round(command.targetZ) };
  }
  if (command.type === 'ATTACK') {
    return { ...base, type: 'ATTACK', targetEntityId: command.targetEntityId };
  }
  return { ...base, type: 'STOP' };
}

export class CommandQueue {
  private commands: QueuedCommand[] = [];
  private nextEnqueueOrder = 0;

  enqueue(command: GameCommand): void {
    if (!Number.isSafeInteger(command.targetTick) || command.targetTick < 1) {
      throw new Error('Command targetTick must be a positive integer.');
    }
    if (!Number.isSafeInteger(command.playerId) || command.playerId < 0) {
      throw new Error('Command playerId must be a non-negative integer.');
    }
    if (
      command.type === 'MOVE'
      && (!Number.isSafeInteger(command.targetX) || !Number.isSafeInteger(command.targetZ))
    ) {
      throw new Error('MOVE target coordinates must be safe integers.');
    }
    if (command.type === 'ATTACK' && (!Number.isSafeInteger(command.targetEntityId) || command.targetEntityId <= 0)) {
      throw new Error('ATTACK targetEntityId must be a positive safe integer.');
    }
    this.commands.push({
      command: normalizeCommand(command),
      enqueueOrder: this.nextEnqueueOrder,
    });
    this.nextEnqueueOrder += 1;
  }

  drainForTick(tick: number): GameCommand[] {
    const due: QueuedCommand[] = [];
    const future: QueuedCommand[] = [];
    for (const queued of this.commands) {
      (queued.command.targetTick <= tick ? due : future).push(queued);
    }
    this.commands = future;
    due.sort((left, right) => (
      left.command.targetTick - right.command.targetTick
      || left.command.playerId - right.command.playerId
      || left.enqueueOrder - right.enqueueOrder
    ));
    return due.map(({ command }) => command);
  }

  get size(): number {
    return this.commands.length;
  }
}
