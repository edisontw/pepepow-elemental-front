import { WORLD_UNITS_PER_METER } from './arena';
import type { GameCommand } from './commands';
import type { EntityID } from './components';
import type { EntityStore } from './entity-store';
import type { NavigationGrid } from './navigation';
import type { GeneratedWorld } from '../world/world-definition';

export const NEUTRAL_PLAYER_ID = 2;
export const NEUTRAL_GUARDIANS_PER_CAMP = 2;
export const NEUTRAL_CAMP_XP_REWARD = 120;
export const NEUTRAL_CAMP_XP_RADIUS = 14 * WORLD_UNITS_PER_METER;
export const NEUTRAL_CAMP_LEASH_RADIUS = 12 * WORLD_UNITS_PER_METER;
export const NEUTRAL_CAMP_AGGRO_RADIUS = 8 * WORLD_UNITS_PER_METER;

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

interface NeutralGuardian {
  entityId: EntityID;
  homeX: number;
  homeZ: number;
}

interface NeutralCampRecord {
  id: string;
  regionId: number;
  x: number;
  z: number;
  guardians: NeutralGuardian[];
  cleared: boolean;
  clearedTick: number | null;
  rewardPlayerId: number | null;
  rewardRecipientEntityIds: EntityID[];
}

export interface NeutralCampSnapshot {
  id: string;
  regionId: number;
  x: number;
  z: number;
  guardianEntityIds: readonly EntityID[];
  aliveGuardianCount: number;
  cleared: boolean;
  clearedTick: number | null;
  rewardPlayerId: number | null;
  rewardXp: number;
  rewardRecipientEntityIds: readonly EntityID[];
}

export interface NeutralEncounterSnapshot {
  stateHash: string;
  totalCleared: number;
  camps: readonly NeutralCampSnapshot[];
}

function hashInteger(hash: number, value: number): number {
  let result = hash;
  const normalized = value | 0;
  for (let shift = 0; shift < 32; shift += 8) {
    result ^= (normalized >>> shift) & 0xff;
    result = Math.imul(result, FNV_PRIME);
  }
  return result >>> 0;
}

function hashString(hash: number, value: string): number {
  let result = hashInteger(hash, value.length);
  for (const character of value) result = hashInteger(result, character.charCodeAt(0));
  return result;
}

function distanceSquared(leftX: number, leftZ: number, rightX: number, rightZ: number): number {
  const dx = leftX - rightX;
  const dz = leftZ - rightZ;
  return dx * dx + dz * dz;
}

const GUARDIAN_OFFSETS = [
  { column: -2, row: 0 },
  { column: 2, row: 0 },
  { column: 0, row: -2 },
  { column: 0, row: 2 },
  { column: -2, row: -2 },
  { column: 2, row: 2 },
] as const;

export class NeutralEncounterState {
  private readonly camps = new Map<string, NeutralCampRecord>();

  constructor(
    world: GeneratedWorld,
    private readonly entities: EntityStore,
    navigation: NavigationGrid,
  ) {
    const camps = world.pois
      .filter((poi) => poi.type === 'NEUTRAL_CAMP')
      .sort((left, right) => left.id.localeCompare(right.id));

    for (const camp of camps) {
      const centerCell = { column: camp.cell.x, row: camp.cell.z };
      const center = navigation.cellToWorld(centerCell);
      const guardians: NeutralGuardian[] = [];
      const usedCells = new Set<string>();

      for (let index = 0; index < NEUTRAL_GUARDIANS_PER_CAMP; index += 1) {
        let resolved = navigation.resolveWalkableTarget(centerCell);
        for (let offsetIndex = index; offsetIndex < GUARDIAN_OFFSETS.length + index; offsetIndex += 1) {
          const offset = GUARDIAN_OFFSETS[offsetIndex % GUARDIAN_OFFSETS.length]!;
          const candidate = navigation.resolveWalkableTarget({
            column: centerCell.column + offset.column,
            row: centerCell.row + offset.row,
          });
          if (!candidate) continue;
          const key = navigation.cellKey(candidate);
          if (usedCells.has(key)) continue;
          resolved = candidate;
          usedCells.add(key);
          break;
        }
        if (!resolved) continue;
        const position = navigation.cellToWorld(resolved);
        const entityId = entities.createUnit({
          archetype: 'GOLEM',
          playerId: NEUTRAL_PLAYER_ID,
          x: position.x,
          z: position.z,
          speedPerTick: 210,
          selectionRadius: 900,
          maxHealth: 260,
          attackDamage: 22,
          attackIntervalTicks: 18,
          attackRange: Math.round(1.35 * WORLD_UNITS_PER_METER),
          neutralCampId: camp.id,
        });
        guardians.push({ entityId, homeX: position.x, homeZ: position.z });
      }

      this.camps.set(camp.id, {
        id: camp.id,
        regionId: camp.regionId,
        x: center.x,
        z: center.z,
        guardians,
        cleared: guardians.length === 0,
        clearedTick: null,
        rewardPlayerId: null,
        rewardRecipientEntityIds: [],
      });
    }
  }

  isCaptureBlocked(poiId: string): boolean {
    const camp = this.camps.get(poiId);
    return camp !== undefined && !camp.cleared;
  }

  prepareLeashes(targetTick: number, enqueue: (command: GameCommand) => void): void {
    const leashSquared = NEUTRAL_CAMP_LEASH_RADIUS * NEUTRAL_CAMP_LEASH_RADIUS;
    const aggroSquared = NEUTRAL_CAMP_AGGRO_RADIUS * NEUTRAL_CAMP_AGGRO_RADIUS;
    for (const camp of this.sortedCamps()) {
      if (camp.cleared) continue;
      for (const guardian of camp.guardians) {
        if (!this.entities.hasUnit(guardian.entityId)) continue;
        const position = this.entities.positions.get(guardian.entityId);
        const combat = this.entities.combat.get(guardian.entityId);
        if (!position || !combat) continue;

        const targetPosition = combat.targetEntityId === null
          ? null
          : this.entities.positions.get(combat.targetEntityId) ?? null;
        const guardianOutside = distanceSquared(position.x, position.z, camp.x, camp.z) > leashSquared;
        const targetOutside = targetPosition !== null
          && distanceSquared(targetPosition.x, targetPosition.z, camp.x, camp.z) > leashSquared;

        if (guardianOutside || targetOutside) {
          enqueue({
            type: 'MOVE',
            targetTick,
            playerId: NEUTRAL_PLAYER_ID,
            entityIds: [guardian.entityId],
            targetX: guardian.homeX,
            targetZ: guardian.homeZ,
          });
          continue;
        }

        if (combat.targetEntityId !== null && this.entities.hasUnit(combat.targetEntityId)) continue;

        let nearestTargetId: EntityID | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const candidateId of this.entities.entityIds()) {
          if (!this.entities.hasUnit(candidateId)) continue;
          const candidatePlayerId = this.entities.factions.get(candidateId)?.playerId;
          if (candidatePlayerId === undefined || candidatePlayerId === NEUTRAL_PLAYER_ID) continue;
          const candidatePosition = this.entities.positions.get(candidateId);
          if (!candidatePosition) continue;
          const fromCamp = distanceSquared(candidatePosition.x, candidatePosition.z, camp.x, camp.z);
          if (fromCamp > leashSquared) continue;
          const fromGuardian = distanceSquared(candidatePosition.x, candidatePosition.z, position.x, position.z);
          if (fromGuardian > aggroSquared) continue;
          if (
            fromGuardian < nearestDistance
            || (fromGuardian === nearestDistance && candidateId < (nearestTargetId ?? Number.MAX_SAFE_INTEGER))
          ) {
            nearestDistance = fromGuardian;
            nearestTargetId = candidateId;
          }
        }

        if (nearestTargetId !== null) {
          enqueue({
            type: 'ATTACK',
            targetTick,
            playerId: NEUTRAL_PLAYER_ID,
            entityIds: [guardian.entityId],
            targetEntityId: nearestTargetId,
          });
        }
      }
    }
  }

  advance(tick: number): void {
    for (const camp of this.sortedCamps()) {
      if (camp.cleared) continue;
      if (camp.guardians.some((guardian) => this.entities.hasUnit(guardian.entityId))) continue;

      camp.cleared = true;
      camp.clearedTick = tick;
      const reward = this.selectRewardRecipients(camp);
      camp.rewardPlayerId = reward.playerId;
      camp.rewardRecipientEntityIds = reward.entityIds;
      this.awardExperience(reward.entityIds, NEUTRAL_CAMP_XP_REWARD);
    }
  }

  snapshot(): NeutralEncounterSnapshot {
    const camps = this.sortedCamps().map((camp): NeutralCampSnapshot => ({
      id: camp.id,
      regionId: camp.regionId,
      x: camp.x,
      z: camp.z,
      guardianEntityIds: camp.guardians.map((guardian) => guardian.entityId),
      aliveGuardianCount: camp.guardians.filter((guardian) => this.entities.hasUnit(guardian.entityId)).length,
      cleared: camp.cleared,
      clearedTick: camp.clearedTick,
      rewardPlayerId: camp.rewardPlayerId,
      rewardXp: camp.cleared ? NEUTRAL_CAMP_XP_REWARD : 0,
      rewardRecipientEntityIds: [...camp.rewardRecipientEntityIds],
    }));
    let hash = FNV_OFFSET;
    for (const camp of camps) {
      hash = hashString(hash, camp.id);
      hash = hashInteger(hash, camp.regionId);
      hash = hashInteger(hash, camp.x);
      hash = hashInteger(hash, camp.z);
      for (const entityId of camp.guardianEntityIds) hash = hashInteger(hash, entityId);
      hash = hashInteger(hash, camp.aliveGuardianCount);
      hash = hashInteger(hash, camp.cleared ? 1 : 0);
      hash = hashInteger(hash, camp.clearedTick ?? -1);
      hash = hashInteger(hash, camp.rewardPlayerId ?? -1);
      hash = hashInteger(hash, camp.rewardXp);
      for (const entityId of camp.rewardRecipientEntityIds) hash = hashInteger(hash, entityId);
    }
    return {
      stateHash: hash.toString(16).padStart(8, '0'),
      totalCleared: camps.filter((camp) => camp.cleared).length,
      camps,
    };
  }

  private selectRewardRecipients(camp: NeutralCampRecord): { playerId: number | null; entityIds: EntityID[] } {
    const radiusSquared = NEUTRAL_CAMP_XP_RADIUS * NEUTRAL_CAMP_XP_RADIUS;
    const byPlayer = new Map<number, Array<{ entityId: EntityID; distanceSquared: number }>>();
    for (const entityId of this.entities.entityIds()) {
      if (!this.entities.hasUnit(entityId)) continue;
      const playerId = this.entities.factions.get(entityId)?.playerId;
      const position = this.entities.positions.get(entityId);
      if (playerId === undefined || playerId === NEUTRAL_PLAYER_ID || !position) continue;
      const squared = distanceSquared(position.x, position.z, camp.x, camp.z);
      if (squared > radiusSquared) continue;
      const entries = byPlayer.get(playerId) ?? [];
      entries.push({ entityId, distanceSquared: squared });
      byPlayer.set(playerId, entries);
    }

    const winner = [...byPlayer.entries()]
      .map(([playerId, entries]) => ({
        playerId,
        entries: entries.sort((left, right) => left.entityId - right.entityId),
        totalDistance: entries.reduce((sum, entry) => sum + entry.distanceSquared, 0),
      }))
      .sort((left, right) => (
        right.entries.length - left.entries.length
        || left.totalDistance - right.totalDistance
        || left.playerId - right.playerId
      ))[0];

    return winner
      ? { playerId: winner.playerId, entityIds: winner.entries.map((entry) => entry.entityId) }
      : { playerId: null, entityIds: [] };
  }

  private awardExperience(entityIds: readonly EntityID[], totalXp: number): void {
    if (entityIds.length === 0 || totalXp <= 0) return;
    const ordered = [...entityIds].sort((left, right) => left - right);
    const base = Math.floor(totalXp / ordered.length);
    let remainder = totalXp % ordered.length;
    for (const entityId of ordered) {
      const experience = this.entities.experience.get(entityId);
      if (!experience) continue;
      experience.xp += base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
    }
  }

  private sortedCamps(): NeutralCampRecord[] {
    return [...this.camps.values()].sort((left, right) => left.id.localeCompare(right.id));
  }
}
