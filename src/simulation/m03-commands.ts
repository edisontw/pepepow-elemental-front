import type { EntityID, PlayerID, UnitArchetype } from './components';
import { isElementId, type ElementId } from './element-types';
import type { BuildingType, OutpostSpecialization } from './m03-content';

interface StrategicCommandBase {
  targetTick: number;
  playerId: PlayerID;
}

export interface BuildCommand extends StrategicCommandBase {
  type: 'BUILD';
  buildingType: BuildingType;
  targetX: number;
  targetZ: number;
  resourceNodeId?: string;
}

export interface TrainCommand extends StrategicCommandBase {
  type: 'TRAIN';
  buildingId: number;
  unitType: UnitArchetype;
  elementalistAlignment?: ElementId;
}

export interface SetRallyPointCommand extends StrategicCommandBase {
  type: 'SET_RALLY_POINT';
  buildingId: number;
  targetX: number;
  targetZ: number;
}

export interface CaptureCommand extends StrategicCommandBase {
  type: 'CAPTURE';
  entityIds: readonly EntityID[];
  targetRegionId?: number;
  targetPoiId?: string;
}

export interface SpecializeOutpostCommand extends StrategicCommandBase {
  type: 'SPECIALIZE_OUTPOST';
  buildingId: number;
  specialization: OutpostSpecialization;
}

export interface UpgradeResourceDefenseCommand extends StrategicCommandBase {
  type: 'UPGRADE_RESOURCE_DEFENSE';
  buildingId: number;
}

export type M03Command =
  | BuildCommand
  | TrainCommand
  | SetRallyPointCommand
  | CaptureCommand
  | SpecializeOutpostCommand
  | UpgradeResourceDefenseCommand;

interface QueuedCommand {
  command: M03Command;
  enqueueOrder: number;
}

function normalizeEntityIds(entityIds: readonly EntityID[]): EntityID[] {
  return [...new Set(entityIds)]
    .filter((entityId) => Number.isSafeInteger(entityId) && entityId > 0)
    .sort((left, right) => left - right);
}

function normalizeCommand(command: M03Command): M03Command {
  const base = { targetTick: command.targetTick, playerId: command.playerId };
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
    return {
      ...base,
      type: 'TRAIN',
      buildingId: command.buildingId,
      unitType: command.unitType,
      ...(command.elementalistAlignment === undefined ? {} : { elementalistAlignment: command.elementalistAlignment }),
    };
  }
  if (command.type === 'SET_RALLY_POINT') {
    return {
      ...base,
      type: 'SET_RALLY_POINT',
      buildingId: command.buildingId,
      targetX: Math.round(command.targetX),
      targetZ: Math.round(command.targetZ),
    };
  }
  if (command.type === 'SPECIALIZE_OUTPOST') {
    return { ...base, type: 'SPECIALIZE_OUTPOST', buildingId: command.buildingId, specialization: command.specialization };
  }
  if (command.type === 'UPGRADE_RESOURCE_DEFENSE') {
    return { ...base, type: 'UPGRADE_RESOURCE_DEFENSE', buildingId: command.buildingId };
  }
  return {
    ...base,
    type: 'CAPTURE',
    entityIds: normalizeEntityIds(command.entityIds),
    ...(command.targetRegionId === undefined ? {} : { targetRegionId: command.targetRegionId }),
    ...(command.targetPoiId === undefined ? {} : { targetPoiId: command.targetPoiId }),
  };
}

export class M03CommandQueue {
  private commands: QueuedCommand[] = [];
  private nextEnqueueOrder = 0;

  enqueue(command: M03Command): void {
    if (!Number.isSafeInteger(command.targetTick) || command.targetTick < 1) throw new Error('M03 command targetTick must be a positive integer.');
    if (!Number.isSafeInteger(command.playerId) || command.playerId < 0) throw new Error('M03 command playerId must be a non-negative integer.');
    if (command.type === 'BUILD') {
      if (!Number.isSafeInteger(command.targetX) || !Number.isSafeInteger(command.targetZ)) throw new Error('BUILD target coordinates must be safe integers.');
      if (command.resourceNodeId !== undefined && command.resourceNodeId.trim() === '') throw new Error('BUILD resourceNodeId must be non-empty when supplied.');
    }
    if (command.type === 'TRAIN' && command.elementalistAlignment !== undefined && !isElementId(command.elementalistAlignment)) {
      throw new Error('TRAIN elementalistAlignment must be a valid element.');
    }
    if (command.type === 'SET_RALLY_POINT') {
      if (!Number.isSafeInteger(command.targetX) || !Number.isSafeInteger(command.targetZ)) throw new Error('SET_RALLY_POINT target coordinates must be safe integers.');
    }
    if (
      (command.type === 'TRAIN'
        || command.type === 'SPECIALIZE_OUTPOST'
        || command.type === 'SET_RALLY_POINT'
        || command.type === 'UPGRADE_RESOURCE_DEFENSE')
      && (!Number.isSafeInteger(command.buildingId) || command.buildingId <= 0)
    ) {
      throw new Error(`${command.type} buildingId must be a positive safe integer.`);
    }
    if (command.type === 'CAPTURE') {
      const hasRegion = command.targetRegionId !== undefined;
      const hasPoi = command.targetPoiId !== undefined;
      if (hasRegion === hasPoi) throw new Error('CAPTURE must target exactly one region or POI.');
      if (hasRegion && (!Number.isSafeInteger(command.targetRegionId) || command.targetRegionId! < 0)) throw new Error('CAPTURE targetRegionId must be a non-negative safe integer.');
      if (hasPoi && command.targetPoiId!.trim() === '') throw new Error('CAPTURE targetPoiId must be non-empty.');
    }
    this.commands.push({ command: normalizeCommand(command), enqueueOrder: this.nextEnqueueOrder });
    this.nextEnqueueOrder += 1;
  }

  drainForTick(tick: number): M03Command[] {
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
