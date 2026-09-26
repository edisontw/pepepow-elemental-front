import type { EntityID, PlayerID } from './components';

export type FrontOrder = 'ADVANCE' | 'GUARD' | 'REGROUP';
export type RegroupState = 'NONE' | 'RETURNING' | 'RECOVERING' | 'READY';

export const COMMAND_SQUAD_CAPACITY = 6;

export interface SquadSnapshot {
  id: number;
  playerId: PlayerID;
  memberEntityIds: readonly EntityID[];
  rosterLocked: boolean;
  currentOrder: FrontOrder | null;
  targetX: number | null;
  targetZ: number | null;
  regroupDestinationX: number | null;
  regroupDestinationZ: number | null;
  regroupState: RegroupState;
  guardTargetEntityId: EntityID | null;
}

export interface SquadStateSnapshot {
  squads: readonly SquadSnapshot[];
  stateHash: string;
}

interface SquadRecord {
  id: number;
  playerId: PlayerID;
  memberEntityIds: EntityID[];
  rosterLocked: boolean;
  currentOrder: FrontOrder | null;
  targetX: number | null;
  targetZ: number | null;
  regroupDestinationX: number | null;
  regroupDestinationZ: number | null;
  regroupState: RegroupState;
  guardTargetEntityId: EntityID | null;
}

export interface SquadSeed {
  id: number;
  playerId: PlayerID;
  memberEntityIds: readonly EntityID[];
  rosterLocked?: boolean;
}

function stableMembers(ids: readonly EntityID[]): EntityID[] {
  return [...new Set(ids)]
    .filter((id) => Number.isSafeInteger(id) && id > 0)
    .sort((left, right) => left - right);
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export class SquadState {
  private readonly records = new Map<number, SquadRecord>();

  constructor(seeds: readonly SquadSeed[]) {
    for (const seed of [...seeds].sort((left, right) => left.id - right.id)) {
      if (!Number.isSafeInteger(seed.id) || seed.id <= 0 || this.records.has(seed.id)) {
        throw new Error('Squad IDs must be unique positive safe integers.');
      }
      if (!Number.isSafeInteger(seed.playerId) || seed.playerId < 0) {
        throw new Error('Squad player ownership must be a non-negative safe integer.');
      }
      const memberEntityIds = stableMembers(seed.memberEntityIds);
      this.records.set(seed.id, {
        id: seed.id,
        playerId: seed.playerId,
        memberEntityIds,
        rosterLocked: seed.rosterLocked ?? true,
        currentOrder: null,
        targetX: null,
        targetZ: null,
        regroupDestinationX: null,
        regroupDestinationZ: null,
        regroupState: 'NONE',
        guardTargetEntityId: null,
      });
    }
  }

  get(id: number): SquadSnapshot | null {
    const record = this.records.get(id);
    return record ? this.clone(record) : null;
  }

  createSquad(
    playerId: PlayerID,
    memberEntityIds: readonly EntityID[],
    rosterLocked = false,
  ): SquadSnapshot | null {
    if (!Number.isSafeInteger(playerId) || playerId < 0) return null;
    const members = stableMembers(memberEntityIds)
      .filter((id) => !this.isAssigned(playerId, id))
      .slice(0, COMMAND_SQUAD_CAPACITY);
    if (members.length === 0) return null;
    const id = Math.max(0, ...this.records.keys()) + 1;
    const record: SquadRecord = {
      id,
      playerId,
      memberEntityIds: members,
      rosterLocked,
      currentOrder: null,
      targetX: null,
      targetZ: null,
      regroupDestinationX: null,
      regroupDestinationZ: null,
      regroupState: 'NONE',
      guardTargetEntityId: null,
    };
    this.records.set(id, record);
    return this.clone(record);
  }

  appendMembers(
    squadId: number,
    playerId: PlayerID,
    memberEntityIds: readonly EntityID[],
  ): number {
    const record = this.records.get(squadId);
    if (!record || record.playerId !== playerId || record.rosterLocked) return 0;
    const room = Math.max(0, COMMAND_SQUAD_CAPACITY - record.memberEntityIds.length);
    if (room === 0) return 0;
    const additions = stableMembers(memberEntityIds)
      .filter((id) => !this.isAssigned(playerId, id))
      .slice(0, room);
    if (additions.length === 0) return 0;
    record.memberEntityIds = stableMembers([...record.memberEntityIds, ...additions]);
    return additions.length;
  }

  lockRoster(squadId: number, playerId: PlayerID): boolean {
    const record = this.records.get(squadId);
    if (!record || record.playerId !== playerId) return false;
    record.rosterLocked = true;
    return true;
  }

  assignOrder(
    squadId: number,
    playerId: PlayerID,
    order: FrontOrder,
    target: { x: number; z: number } | null,
    regroupDestination: { x: number; z: number } | null = null,
  ): boolean {
    const record = this.records.get(squadId);
    if (!record || record.playerId !== playerId) return false;
    if ((order === 'ADVANCE' || order === 'GUARD') && target === null) return false;
    record.rosterLocked = true;
    record.currentOrder = order;
    record.targetX = target?.x ?? regroupDestination?.x ?? null;
    record.targetZ = target?.z ?? regroupDestination?.z ?? null;
    record.regroupDestinationX = order === 'REGROUP' ? regroupDestination?.x ?? null : null;
    record.regroupDestinationZ = order === 'REGROUP' ? regroupDestination?.z ?? null : null;
    record.regroupState = order === 'REGROUP' ? 'RETURNING' : 'NONE';
    record.guardTargetEntityId = null;
    return true;
  }

  clearOrdersForMembers(playerId: PlayerID, memberEntityIds: readonly EntityID[]): void {
    const ids = new Set(stableMembers(memberEntityIds));
    if (ids.size === 0) return;
    for (const record of this.records.values()) {
      if (record.playerId !== playerId || !record.memberEntityIds.some((id) => ids.has(id))) continue;
      record.rosterLocked = true;
      this.clearRecord(record);
    }
  }

  setGuardTarget(squadId: number, targetEntityId: EntityID | null): void {
    const record = this.records.get(squadId);
    if (record?.currentOrder === 'GUARD') record.guardTargetEntityId = targetEntityId;
  }

  setRegroupState(squadId: number, state: Exclude<RegroupState, 'NONE'>): void {
    const record = this.records.get(squadId);
    if (record?.currentOrder === 'REGROUP') record.regroupState = state;
  }

  snapshot(): SquadStateSnapshot {
    const squads = [...this.records.values()]
      .sort((left, right) => left.id - right.id)
      .map((record) => this.clone(record));
    const canonical = squads.map((squad) => [
      squad.id,
      squad.playerId,
      squad.memberEntityIds.join(','),
      squad.rosterLocked ? 1 : 0,
      squad.currentOrder ?? '-',
      squad.targetX ?? '-',
      squad.targetZ ?? '-',
      squad.regroupDestinationX ?? '-',
      squad.regroupDestinationZ ?? '-',
      squad.regroupState,
      squad.guardTargetEntityId ?? '-',
    ].join(':')).join('|');
    return { squads, stateHash: fnv1a(canonical) };
  }

  private isAssigned(playerId: PlayerID, entityId: EntityID): boolean {
    for (const record of this.records.values()) {
      if (record.playerId === playerId && record.memberEntityIds.includes(entityId)) return true;
    }
    return false;
  }

  private clone(record: SquadRecord): SquadSnapshot {
    return {
      id: record.id,
      playerId: record.playerId,
      memberEntityIds: [...record.memberEntityIds],
      rosterLocked: record.rosterLocked,
      currentOrder: record.currentOrder,
      targetX: record.targetX,
      targetZ: record.targetZ,
      regroupDestinationX: record.regroupDestinationX,
      regroupDestinationZ: record.regroupDestinationZ,
      regroupState: record.regroupState,
      guardTargetEntityId: record.guardTargetEntityId,
    };
  }

  private clearRecord(record: SquadRecord): void {
    record.currentOrder = null;
    record.targetX = null;
    record.targetZ = null;
    record.regroupDestinationX = null;
    record.regroupDestinationZ = null;
    record.regroupState = 'NONE';
    record.guardTargetEntityId = null;
  }
}
