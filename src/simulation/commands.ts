import type { EntityID, PlayerID } from './components';
import type { SpellTarget, StrategicSpellId, TacticalSpellId } from './element-types';
import { isFormationId, type FormationId } from './formation';
import { STRATEGIC_SPELLS, TACTICAL_SPELLS } from './spell-content';

interface CommandBase {
  targetTick: number;
  playerId: PlayerID;
}

interface EntityCommandBase extends CommandBase {
  entityIds: readonly EntityID[];
}

export interface MoveCommand extends EntityCommandBase {
  type: 'MOVE';
  targetX: number;
  targetZ: number;
  formation?: FormationId;
}

export interface StopCommand extends EntityCommandBase {
  type: 'STOP';
}

export interface AttackCommand extends EntityCommandBase {
  type: 'ATTACK';
  targetEntityId: EntityID;
}

export interface TerrainCastCommand extends CommandBase {
  type: 'CAST';
  entityIds?: never;
  effectId: 'FREEZE' | 'HEAT' | 'FIRE' | 'WATER';
  targetX: number;
  targetZ: number;
  radius: number;
}

export interface ChainLightningCommand extends CommandBase {
  type: 'CAST';
  entityIds?: never;
  effectId: 'CHAIN_LIGHTNING';
  targetEntityId: EntityID;
}

export interface CastTacticalSpellCommand extends CommandBase {
  type: 'CAST_TACTICAL';
  spellId: TacticalSpellId;
  candidateCasterIds: readonly EntityID[];
  target: SpellTarget;
}

export interface CastStrategicSpellCommand extends CommandBase {
  type: 'CAST_STRATEGIC';
  spellId: StrategicSpellId;
  target: Extract<SpellTarget, { kind: 'POINT' }>;
}

export type CastCommand = TerrainCastCommand | ChainLightningCommand;
export type SemanticSpellCommand = CastTacticalSpellCommand | CastStrategicSpellCommand;
export type GameCommand = MoveCommand | StopCommand | AttackCommand | CastCommand;
export type M04GameCommand = GameCommand | SemanticSpellCommand;
export type {
  BuildCommand,
  CaptureCommand,
  M03Command as StrategicCommand,
  SetRallyPointCommand,
  SpecializeOutpostCommand,
  TrainCommand,
  UpgradeResourceDefenseCommand,
} from './m03-commands';

interface QueuedCommand {
  command: GameCommand;
  enqueueOrder: number;
}

interface QueuedSemanticSpellCommand {
  command: SemanticSpellCommand;
  enqueueOrder: number;
}

function normalizeEntityIds(entityIds: readonly EntityID[]): EntityID[] {
  return [...new Set(entityIds)]
    .filter((entityId) => Number.isSafeInteger(entityId) && entityId > 0)
    .sort((left, right) => left - right);
}

function normalizeTarget(target: SpellTarget): SpellTarget {
  if (target.kind === 'ENTITY') return { kind: 'ENTITY', entityId: target.entityId };
  return { kind: 'POINT', x: Math.round(target.x), z: Math.round(target.z) };
}

function normalizeCommand(command: GameCommand): GameCommand {
  const base = {
    targetTick: command.targetTick,
    playerId: command.playerId,
  };
  if (command.type === 'CAST') {
    if (command.effectId === 'CHAIN_LIGHTNING') {
      return { ...base, type: 'CAST', effectId: 'CHAIN_LIGHTNING', targetEntityId: command.targetEntityId };
    }
    return {
      ...base,
      type: 'CAST',
      effectId: command.effectId,
      targetX: Math.round(command.targetX),
      targetZ: Math.round(command.targetZ),
      radius: Math.round(command.radius),
    };
  }
  const entityIds = normalizeEntityIds(command.entityIds);
  if (command.type === 'MOVE') {
    return {
      ...base,
      entityIds,
      type: 'MOVE',
      targetX: Math.round(command.targetX),
      targetZ: Math.round(command.targetZ),
      ...(command.formation === undefined ? {} : { formation: command.formation }),
    };
  }
  if (command.type === 'ATTACK') {
    return { ...base, entityIds, type: 'ATTACK', targetEntityId: command.targetEntityId };
  }
  return { ...base, entityIds, type: 'STOP' };
}

function normalizeSemanticSpellCommand(command: SemanticSpellCommand): SemanticSpellCommand {
  const base = { targetTick: command.targetTick, playerId: command.playerId };
  if (command.type === 'CAST_TACTICAL') {
    return {
      ...base,
      type: 'CAST_TACTICAL',
      spellId: command.spellId,
      candidateCasterIds: normalizeEntityIds(command.candidateCasterIds),
      target: normalizeTarget(command.target),
    };
  }
  return {
    ...base,
    type: 'CAST_STRATEGIC',
    spellId: command.spellId,
    target: { kind: 'POINT', x: Math.round(command.target.x), z: Math.round(command.target.z) },
  };
}

function validateBase(command: CommandBase): void {
  if (!Number.isSafeInteger(command.targetTick) || command.targetTick < 1) {
    throw new Error('Command targetTick must be a positive integer.');
  }
  if (!Number.isSafeInteger(command.playerId) || command.playerId < 0) {
    throw new Error('Command playerId must be a non-negative integer.');
  }
}

export class CommandQueue {
  private commands: QueuedCommand[] = [];
  private nextEnqueueOrder = 0;

  enqueue(command: GameCommand): void {
    validateBase(command);
    if (
      (command.type === 'MOVE' || (command.type === 'CAST' && command.effectId !== 'CHAIN_LIGHTNING'))
      && (!Number.isSafeInteger(command.targetX) || !Number.isSafeInteger(command.targetZ))
    ) {
      throw new Error(`${command.type} target coordinates must be safe integers.`);
    }
    if (command.type === 'MOVE' && command.formation !== undefined && !isFormationId(command.formation)) {
      throw new Error('MOVE formation must be LINE, COLUMN, or SPREAD.');
    }
    if (command.type === 'CAST' && command.effectId !== 'CHAIN_LIGHTNING' && (!Number.isSafeInteger(command.radius) || command.radius < 0)) {
      throw new Error('CAST radius must be a non-negative safe integer.');
    }
    if (command.type === 'CAST' && command.effectId === 'CHAIN_LIGHTNING'
      && (!Number.isSafeInteger(command.targetEntityId) || command.targetEntityId <= 0)) {
      throw new Error('CHAIN_LIGHTNING targetEntityId must be a positive safe integer.');
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

export class SemanticSpellCommandQueue {
  private commands: QueuedSemanticSpellCommand[] = [];
  private nextEnqueueOrder = 0;

  enqueue(command: SemanticSpellCommand): void {
    validateBase(command);
    if (command.type === 'CAST_TACTICAL') {
      if (!TACTICAL_SPELLS[command.spellId]) throw new Error('Unknown Tactical spell.');
      if (command.target.kind === 'ENTITY' && (!Number.isSafeInteger(command.target.entityId) || command.target.entityId <= 0)) {
        throw new Error('Tactical entity target must be a positive safe integer.');
      }
      if (command.target.kind === 'POINT' && (!Number.isSafeInteger(command.target.x) || !Number.isSafeInteger(command.target.z))) {
        throw new Error('Tactical point target coordinates must be safe integers.');
      }
    } else {
      if (!STRATEGIC_SPELLS[command.spellId]) throw new Error('Unknown Strategic spell.');
      if (!Number.isSafeInteger(command.target.x) || !Number.isSafeInteger(command.target.z)) {
        throw new Error('Strategic point target coordinates must be safe integers.');
      }
    }
    this.commands.push({ command: normalizeSemanticSpellCommand(command), enqueueOrder: this.nextEnqueueOrder });
    this.nextEnqueueOrder += 1;
  }

  drainForTick(tick: number): SemanticSpellCommand[] {
    const due: QueuedSemanticSpellCommand[] = [];
    const future: QueuedSemanticSpellCommand[] = [];
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
