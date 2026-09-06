import { BUILDINGS } from './m03-content';

export type RunMode = 'DESTROY' | 'BOSS_HUNT';
export type RunPace = 'STANDARD' | 'SMOKE';
export type RunPhase = 'DISCOVERY' | 'COMMITMENT' | 'EXPANSION' | 'ESCALATION' | 'FINALE' | 'COMPLETE';
export type RunOutcome = 'IN_PROGRESS' | 'VICTORY' | 'DEFEAT';
export type FinaleUnlockReason = 'TIME' | 'MOMENTUM';
export type CoreState = 'ACTIVE' | 'CRITICAL' | 'DESTROYED';
export type BossType = 'FROST_TITAN' | 'STORM_COLOSSUS' | 'INFERNAL_BEHEMOTH';

export interface BossDefinition {
  id: BossType;
  label: string;
  maxHealth: number;
  armor: number;
  abilityIntervalTicks: number;
  battlefieldRadius: number;
}

export const CORE_MAX_HEALTH = BUILDINGS.ELEMENTAL_CORE.maxHealth;
export const CORE_ARMOR = 30;
export const CORE_CRITICAL_TICKS = 300;
export const CORE_RECOVERY_HEALTH = Math.ceil(CORE_MAX_HEALTH * 0.1);
export const ENGINEER_REPAIR_PER_TICK = 5;
export const ENGINEER_REPAIR_RADIUS = 8_000;
export const STRUCTURE_BODY_RADIUS = 2_800;
export const BOSS_BODY_RADIUS = 3_200;
export const MIN_EARLY_FINALE_TICK = 9_000;
export const STANDARD_FINALE_TICK = 14_400;
export const SMOKE_FINALE_TICK = 300;

export const BOSS_DEFINITIONS: Readonly<Record<BossType, BossDefinition>> = {
  FROST_TITAN: {
    id: 'FROST_TITAN',
    label: 'Frost Titan',
    maxHealth: 8_000,
    armor: 35,
    abilityIntervalTicks: 60,
    battlefieldRadius: 7_000,
  },
  STORM_COLOSSUS: {
    id: 'STORM_COLOSSUS',
    label: 'Storm Colossus',
    maxHealth: 7_000,
    armor: 25,
    abilityIntervalTicks: 50,
    battlefieldRadius: 12_000,
  },
  INFERNAL_BEHEMOTH: {
    id: 'INFERNAL_BEHEMOTH',
    label: 'Infernal Behemoth',
    maxHealth: 9_000,
    armor: 30,
    abilityIntervalTicks: 45,
    battlefieldRadius: 8_000,
  },
};

export function bossTypeForSeed(masterSeed: number): BossType {
  const bosses: readonly BossType[] = ['FROST_TITAN', 'STORM_COLOSSUS', 'INFERNAL_BEHEMOTH'];
  return bosses[Math.abs(masterSeed) % bosses.length]!;
}

export function finaleUnlockTick(pace: RunPace): number {
  return pace === 'SMOKE' ? SMOKE_FINALE_TICK : STANDARD_FINALE_TICK;
}

export function phaseForTick(tick: number, pace: RunPace): RunPhase {
  if (pace === 'SMOKE') {
    if (tick < 60) return 'DISCOVERY';
    if (tick < 120) return 'COMMITMENT';
    if (tick < 180) return 'EXPANSION';
    if (tick < SMOKE_FINALE_TICK) return 'ESCALATION';
    return 'FINALE';
  }
  if (tick < 3_000) return 'DISCOVERY';
  if (tick < 7_200) return 'COMMITMENT';
  if (tick < 12_000) return 'EXPANSION';
  if (tick < STANDARD_FINALE_TICK) return 'ESCALATION';
  return 'FINALE';
}
