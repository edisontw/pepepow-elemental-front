import type { EntityID, PlayerID, UnitArchetype } from './components';
import type { BuildingType, OutpostSpecialization } from './m03-content';

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
  effectId: 'FREEZE' | 'HEAT' | 'FIRE';
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

export interface BuildCommand extends CommandBase {
  type: 'BUILD';
  entityIds?: never;
  buildingType: BuildingType;
  targetX: number;
  targetZ: number;
  resourceNodeId?: string;
}

export interface TrainCommand extends CommandBase {
  type: 'TRAIN';
  entityIds?: never;
  buildingId: number;
  unitType: UnitArchetype;
}

export interface CaptureCommand extends EntityCommandBase {
  type: 'CAPTURE';
  targetRegionId?: number;
  targetPoiId?: string;
}

export interface SpecializeOutpostCommand extends CommandBase {
  type: 'SPECIALIZE_OUTPOST';
  entityIds?: never;
  buildingId: number;
  specialization: OutpostSpecialization;
}

export type CastCommand = TerrainCastCommand | ChainLightningCommand;
export type StrategicCommand = BuildCommand | TrainCommand | CaptureCommand | SpecializeOutpostCommand;
export type GameCommand = MoveCommand | StopCommand | AttackCommand | CastCommand | StrategicCommand;

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
  if (command.type === 'BUILD') {
    return {
      ...base,
      type: 'BUILD',
      buildingType: command.buildingType,
      targetX: Math.round(command.targetX),
      targetZ: Math.round(command.targetZ),
      ...(command.resourceNodeId === undefined ? {} : { resourceNodeId: command.resourceNodeId }),
    };
  }
  if (command.type === 'TRAIN') {
    return { ...base, type: 'TRAIN', buildingId: command.buildingId, unitType: command.unitType };
  }
  if (command.type === 'SPECIALIZE_OUTPOST') {
    return { ...base, type: 'SPECIALIZE_OUTPOST', buildingId: command.buildingId, specialization: command.specialization };
  }
  const entityIds = normalizeEntityIds(command.entityIds);
  if (command.type === 'MOVE') {
    return { ...base, entityIds, type: 'MOVE', targetX: Math.round(command.targetX), targetZ: Math.round(command.targetZ) };
  }
  if (command.type === 'ATTACK') {
    return { ...base, entityIds, type: 'ATTACK', targetEntityId: command.targetEntityId };
  }
  if (command.type === 'CAPTURE') {
    return {
      ...base,
      entityIds,
      type: 'CAPTURE',
      ...(command.targetRegionId === undefined ? {} : { targetRegionId: command.targetRegionId }),
      ...(command.targetPoiId === undefined ? {} : { targetPoiId: command.targetPoiId }),
    };
  }
  return { ...base, entityIds, type: 'STOP' };
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
      (command.type === 'MOVE'
        || command.type === 'BUILD'
        || (command.type === 'CAST' && command.effectId !== 'CHAIN_LIGHTNING'))
      && (!Number.isSafeInteger(command.targetX) || !Number.isSafeInteger(command.targetZ))
    ) {
      throw new Error(`${command.type} target coordinates must be safe integers.`);
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
    if ((command.type === 'TRAIN' || command.type === 'SPECIALIZE_OUTPOST')
      && (!Number.isSafeInteger(command.buildingId) || command.buildingId <= 0)) {
      throw new Error(`${command.type} buildingId must be a positive safe integer.`);
    }
    if (command.type === 'CAPTURE') {
      const hasRegion = command.targetRegionId !== undefined;
      const hasPoi = command.targetPoiId !== undefined;
      if (hasRegion === hasPoi) throw new Error('CAPTURE must target exactly one region or POI.');
      if (hasRegion && (!Number.isSafeInteger(command.targetRegionId) || command.targetRegionId! < 0)) {
        throw new Error('CAPTURE targetRegionId must be a non-negative safe integer.');
      }
      if (hasPoi && command.targetPoiId!.trim() === '') throw new Error('CAPTURE targetPoiId must be non-empty.');
    }
    if (command.type === 'BUILD' && command.resourceNodeId !== undefined && command.resourceNodeId.trim() === '') {
      throw new Error('BUILD resourceNodeId must be non-empty when supplied.');
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
