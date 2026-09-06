import type { PlayerID } from './components';

interface RogueliteCommandBase {
  targetTick: number;
  playerId: PlayerID;
}

export interface ActivateShrineCommand extends RogueliteCommandBase {
  type: 'ACTIVATE_SHRINE';
  shrineId: string;
}

export interface ChooseShrineUpgradeCommand extends RogueliteCommandBase {
  type: 'CHOOSE_SHRINE_UPGRADE';
  shrineId: string;
  choiceIndex: number;
}

export type M04Command = ActivateShrineCommand | ChooseShrineUpgradeCommand;

interface QueuedCommand {
  command: M04Command;
  enqueueOrder: number;
}

function normalizeCommand(command: M04Command): M04Command {
  const base = { targetTick: command.targetTick, playerId: command.playerId };
  if (command.type === 'ACTIVATE_SHRINE') {
    return { ...base, type: 'ACTIVATE_SHRINE', shrineId: command.shrineId.trim() };
  }
  return {
    ...base,
    type: 'CHOOSE_SHRINE_UPGRADE',
    shrineId: command.shrineId.trim(),
    choiceIndex: command.choiceIndex,
  };
}

export class M04CommandQueue {
  private commands: QueuedCommand[] = [];
  private nextEnqueueOrder = 0;

  enqueue(command: M04Command): void {
    if (!Number.isSafeInteger(command.targetTick) || command.targetTick < 1) {
      throw new Error('M04 command targetTick must be a positive integer.');
    }
    if (!Number.isSafeInteger(command.playerId) || command.playerId < 0) {
      throw new Error('M04 command playerId must be a non-negative integer.');
    }
    if (command.shrineId.trim() === '') throw new Error('M04 shrineId must be non-empty.');
    if (command.type === 'CHOOSE_SHRINE_UPGRADE' && (!Number.isSafeInteger(command.choiceIndex) || command.choiceIndex < 0 || command.choiceIndex > 2)) {
      throw new Error('M04 choiceIndex must be 0, 1, or 2.');
    }
    this.commands.push({ command: normalizeCommand(command), enqueueOrder: this.nextEnqueueOrder });
    this.nextEnqueueOrder += 1;
  }

  drainForTick(tick: number): M04Command[] {
    const due: QueuedCommand[] = [];
    const future: QueuedCommand[] = [];
    for (const queued of this.commands) (queued.command.targetTick <= tick ? due : future).push(queued);
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
