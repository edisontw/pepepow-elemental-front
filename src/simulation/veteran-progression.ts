import { WORLD_UNITS_PER_METER } from './arena';
import type { EntityID, UnitArchetype } from './components';
import type { EntityStore } from './entity-store';
import { UNITS } from './m03-content';

export const MAX_UNIT_LEVEL = 5;
export const UNIT_LEVEL_XP_THRESHOLDS = [0, 60, 150, 280, 450] as const;
export const MAX_UNIT_XP = UNIT_LEVEL_XP_THRESHOLDS[MAX_UNIT_LEVEL - 1];
export const UNIT_MAX_HEALTH_PER_LEVEL_PERMILLE = 60;
export const UNIT_ATTACK_DAMAGE_PER_LEVEL_PERMILLE = 40;
export const COMBAT_XP_SHARE_RADIUS = 12 * WORLD_UNITS_PER_METER;

export function isVeteranFaction(playerId: number): boolean {
  return playerId === 0 || playerId === 1;
}

export interface UnitXpProgress {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number | null;
  progressXp: number;
  progressRequired: number | null;
}

export function unitLevelForXp(xp: number): number {
  const normalized = Math.max(0, Math.floor(xp));
  let level = 1;
  for (let index = 1; index < UNIT_LEVEL_XP_THRESHOLDS.length; index += 1) {
    if (normalized < UNIT_LEVEL_XP_THRESHOLDS[index]!) break;
    level = index + 1;
  }
  return Math.min(MAX_UNIT_LEVEL, level);
}

export function unitXpProgress(xp: number): UnitXpProgress {
  const normalized = Math.max(0, Math.min(MAX_UNIT_XP, Math.floor(xp)));
  const level = unitLevelForXp(normalized);
  const currentLevelXp = UNIT_LEVEL_XP_THRESHOLDS[level - 1]!;
  const nextLevelXp = level >= MAX_UNIT_LEVEL ? null : UNIT_LEVEL_XP_THRESHOLDS[level]!;
  return {
    level,
    currentLevelXp,
    nextLevelXp,
    progressXp: normalized - currentLevelXp,
    progressRequired: nextLevelXp === null ? null : nextLevelXp - currentLevelXp,
  };
}

function scaledStat(base: number, perLevelPermille: number, level: number): number {
  const bonusLevels = Math.max(0, Math.min(MAX_UNIT_LEVEL, level) - 1);
  return Math.max(1, Math.round((base * (1000 + bonusLevels * perLevelPermille)) / 1000));
}

export function scaledMaxHealth(baseMaxHealth: number, level: number): number {
  return scaledStat(baseMaxHealth, UNIT_MAX_HEALTH_PER_LEVEL_PERMILLE, level);
}

export function scaledAttackDamage(baseAttackDamage: number, level: number): number {
  return scaledStat(baseAttackDamage, UNIT_ATTACK_DAMAGE_PER_LEVEL_PERMILLE, level);
}

export function combatKillXp(archetype: UnitArchetype): number {
  return 12 + UNITS[archetype].population * 8;
}

export function grantExperience(entities: EntityStore, entityId: EntityID, amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0 || !entities.hasUnit(entityId)) return false;
  const experience = entities.experience.get(entityId);
  const health = entities.health.get(entityId);
  const combat = entities.combat.get(entityId);
  if (!experience || !health || !combat) return false;

  const previousLevel = unitLevelForXp(experience.xp);
  experience.xp = Math.min(MAX_UNIT_XP, experience.xp + Math.floor(amount));
  const nextLevel = unitLevelForXp(experience.xp);
  if (nextLevel <= previousLevel) return false;

  const priorMax = health.max;
  const nextMax = scaledMaxHealth(experience.baseMaxHealth, nextLevel);
  const nextDamage = scaledAttackDamage(experience.baseAttackDamage, nextLevel);
  health.max = nextMax;
  health.current = Math.min(nextMax, health.current + Math.max(0, nextMax - priorMax));
  combat.attackDamage = nextDamage;
  return true;
}

export function grantSharedExperience(
  entities: EntityStore,
  entityIds: readonly EntityID[],
  totalXp: number,
): EntityID[] {
  if (!Number.isFinite(totalXp) || totalXp <= 0) return [];
  const ordered = [...new Set(entityIds)]
    .filter((entityId) => entities.hasUnit(entityId))
    .sort((left, right) => left - right);
  if (ordered.length === 0) return [];

  const base = Math.floor(totalXp / ordered.length);
  let remainder = Math.floor(totalXp) % ordered.length;
  const leveled: EntityID[] = [];
  for (const entityId of ordered) {
    const amount = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    if (grantExperience(entities, entityId, amount)) leveled.push(entityId);
  }
  return leveled;
}

export function nearbyFactionParticipants(
  entities: EntityStore,
  playerId: number,
  x: number,
  z: number,
  radius = COMBAT_XP_SHARE_RADIUS,
): EntityID[] {
  const radiusSquared = radius * radius;
  return entities.entityIds()
    .filter((entityId) => {
      if (!entities.hasUnit(entityId) || entities.factions.get(entityId)?.playerId !== playerId) return false;
      const position = entities.positions.get(entityId);
      if (!position) return false;
      const dx = position.x - x;
      const dz = position.z - z;
      return dx * dx + dz * dz <= radiusSquared;
    })
    .sort((left, right) => left - right);
}
