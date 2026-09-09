import type { AttunementState } from './attunement-state';
import type { EntityStore } from './entity-store';
import type { NavigationGrid } from './navigation';
import type { StrategicSnapshot } from './strategic-state';
import type { VisibilityState } from './visibility-state';
import type { SpellTarget, StrategicSpellId, TacticalSpellId } from './element-types';
import {
  STRATEGIC_ANCHOR_REACH,
  STRATEGIC_SPELLS,
  TACTICAL_SPELLS,
  type StrategicAnchorClass,
} from './spell-content';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export interface TacticalCooldownSnapshot {
  casterEntityId: number;
  spellId: TacticalSpellId;
  readyTick: number;
}

export interface StrategicCooldownSnapshot {
  playerId: number;
  spellId: StrategicSpellId;
  readyTick: number;
}

export interface SpellAuthoritySnapshot {
  stateHash: string;
  tacticalCooldowns: readonly TacticalCooldownSnapshot[];
  strategicCooldowns: readonly StrategicCooldownSnapshot[];
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
  for (const character of value) {
    result ^= character.charCodeAt(0) & 0xff;
    result = Math.imul(result, FNV_PRIME);
  }
  return result >>> 0;
}

function squaredDistance(left: { x: number; z: number }, right: { x: number; z: number }): number {
  const dx = left.x - right.x;
  const dz = left.z - right.z;
  return dx * dx + dz * dz;
}

function tacticalKey(entityId: number, spellId: TacticalSpellId): string {
  return `${entityId}:${spellId}`;
}

function strategicKey(playerId: number, spellId: StrategicSpellId): string {
  return `${playerId}:${spellId}`;
}

function anchorClass(building: StrategicSnapshot['buildings'][number]): StrategicAnchorClass | null {
  if (building.type === 'ELEMENTAL_CORE') return 'ELEMENTAL_CORE';
  if (building.type === 'ARCANE_TOWER') return 'ARCANE_TOWER';
  if (building.type === 'OUTPOST' && building.specialization === 'MANA_BEACON') return 'MANA_BEACON_OUTPOST';
  return null;
}

export class SpellAuthorityState {
  private readonly tacticalReadyTick = new Map<string, number>();
  private readonly strategicReadyTick = new Map<string, number>();

  tacticalReady(entityId: number, spellId: TacticalSpellId, tick: number): boolean {
    return tick >= (this.tacticalReadyTick.get(tacticalKey(entityId, spellId)) ?? 0);
  }

  strategicReady(playerId: number, spellId: StrategicSpellId, tick: number): boolean {
    return tick >= (this.strategicReadyTick.get(strategicKey(playerId, spellId)) ?? 0);
  }

  startTacticalCooldown(entityId: number, spellId: TacticalSpellId, tick: number): void {
    this.tacticalReadyTick.set(tacticalKey(entityId, spellId), tick + TACTICAL_SPELLS[spellId].cooldownTicks);
  }

  startStrategicCooldown(playerId: number, spellId: StrategicSpellId, tick: number): void {
    this.strategicReadyTick.set(strategicKey(playerId, spellId), tick + STRATEGIC_SPELLS[spellId].cooldownTicks);
  }

  selectTacticalCaster(
    playerId: number,
    spellId: TacticalSpellId,
    candidateCasterIds: readonly number[],
    target: SpellTarget,
    tick: number,
    entities: EntityStore,
    attunements: AttunementState,
    visibility: VisibilityState,
    navigation: NavigationGrid,
  ): number | null {
    const spell = TACTICAL_SPELLS[spellId];
    if (!attunements.has(playerId, spell.element)) return null;

    let targetPosition: { x: number; z: number };
    if (spell.targetMode === 'HOSTILE_ENTITY') {
      if (target.kind !== 'ENTITY' || !entities.hasUnit(target.entityId)) return null;
      if (entities.factions.get(target.entityId)?.playerId === playerId) return null;
      const position = entities.positions.get(target.entityId);
      if (!position || !visibility.isWorldVisible(playerId, position.x, position.z, navigation)) return null;
      targetPosition = position;
    } else {
      if (target.kind !== 'POINT') return null;
      if (!visibility.isWorldVisible(playerId, target.x, target.z, navigation)) return null;
      targetPosition = target;
    }

    const rangeSquared = spell.castRange * spell.castRange;
    const valid: { id: number; distanceSquared: number }[] = [];
    for (const entityId of [...new Set(candidateCasterIds)].sort((left, right) => left - right)) {
      if (!entities.hasUnit(entityId) || entities.factions.get(entityId)?.playerId !== playerId) continue;
      if (entities.archetypes.get(entityId) !== 'ELEMENTALIST') continue;
      if (entities.elementalAlignments.get(entityId)?.element !== spell.element) continue;
      if (!this.tacticalReady(entityId, spellId, tick)) continue;
      const position = entities.positions.get(entityId);
      if (!position) continue;
      const distance = squaredDistance(position, targetPosition);
      if (distance > rangeSquared) continue;
      valid.push({ id: entityId, distanceSquared: distance });
    }
    valid.sort((left, right) => left.distanceSquared - right.distanceSquared || left.id - right.id);
    return valid[0]?.id ?? null;
  }

  selectStrategicAnchor(
    playerId: number,
    spellId: StrategicSpellId,
    target: Extract<SpellTarget, { kind: 'POINT' }>,
    tick: number,
    strategic: StrategicSnapshot,
    attunements: AttunementState,
    visibility: VisibilityState,
    navigation: NavigationGrid,
  ): number | null {
    const spell = STRATEGIC_SPELLS[spellId];
    if (!attunements.has(playerId, spell.element) || !this.strategicReady(playerId, spellId, tick)) return null;
    if (!visibility.isWorldVisible(playerId, target.x, target.z, navigation)) return null;
    const supplied = new Set(strategic.suppliedRegions[playerId] ?? []);
    const valid: { id: number; distanceSquared: number }[] = [];
    for (const building of strategic.buildings) {
      if (building.playerId !== playerId || building.destroyed || !building.completed) continue;
      const kind = anchorClass(building);
      if (!kind) continue;
      if (kind !== 'ELEMENTAL_CORE' && !supplied.has(building.regionId)) continue;
      const distance = squaredDistance(building, target);
      const reach = STRATEGIC_ANCHOR_REACH[kind];
      if (distance > reach * reach) continue;
      valid.push({ id: building.id, distanceSquared: distance });
    }
    valid.sort((left, right) => left.distanceSquared - right.distanceSquared || left.id - right.id);
    return valid[0]?.id ?? null;
  }

  snapshot(): SpellAuthoritySnapshot {
    const tacticalCooldowns = [...this.tacticalReadyTick.entries()]
      .map(([key, readyTick]) => {
        const [entityIdRaw, spellId] = key.split(':') as [string, TacticalSpellId];
        return { casterEntityId: Number(entityIdRaw), spellId, readyTick };
      })
      .sort((left, right) => left.casterEntityId - right.casterEntityId || left.spellId.localeCompare(right.spellId));
    const strategicCooldowns = [...this.strategicReadyTick.entries()]
      .map(([key, readyTick]) => {
        const [playerIdRaw, spellId] = key.split(':') as [string, StrategicSpellId];
        return { playerId: Number(playerIdRaw), spellId, readyTick };
      })
      .sort((left, right) => left.playerId - right.playerId || left.spellId.localeCompare(right.spellId));

    let hash = FNV_OFFSET;
    for (const cooldown of tacticalCooldowns) {
      hash = hashInteger(hash, cooldown.casterEntityId);
      hash = hashString(hash, cooldown.spellId);
      hash = hashInteger(hash, cooldown.readyTick);
    }
    for (const cooldown of strategicCooldowns) {
      hash = hashInteger(hash, cooldown.playerId);
      hash = hashString(hash, cooldown.spellId);
      hash = hashInteger(hash, cooldown.readyTick);
    }
    return { stateHash: hash.toString(16).padStart(8, '0'), tacticalCooldowns, strategicCooldowns };
  }
}
