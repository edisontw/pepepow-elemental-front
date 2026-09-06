export type EnemyFaction = 'IRON_LEGION' | 'FLAME_CULT' | 'WILD_HORDE';
export type EnemyDifficulty = 'CASUAL' | 'STANDARD' | 'HARD';
export type StrategicAiAction = 'SCOUT' | 'EXPAND' | 'DEFEND' | 'RAID' | 'ATTACK' | 'CONTEST_POI' | 'REGROUP';

export interface EnemyFactionProfile {
  id: EnemyFaction;
  label: string;
  actionWeightsPermille: Readonly<Record<StrategicAiAction, number>>;
  preferredRaidArchetypes: readonly string[];
}

export interface EnemyDifficultyProfile {
  id: EnemyDifficulty;
  decisionIntervalTicks: number;
  memoryDecayPerDecision: number;
  minimumActionScore: number;
}

export interface EnemyUtilityContext {
  ownStrength: number;
  knownPlayerStrength: number;
  visiblePlayerUnits: number;
  ownRegionCount: number;
  neutralFrontierCount: number;
  threatenedOwnRegions: number;
  knownPlayerSuppliedRegions: number;
  contestablePoiCount: number;
  unknownRegionCount: number;
  damagedArmyPermille: number;
  directorPressure: number;
  recoveryActive: boolean;
  antiTurtleActive: boolean;
}

export const ENEMY_FACTIONS: Readonly<Record<EnemyFaction, EnemyFactionProfile>> = {
  IRON_LEGION: {
    id: 'IRON_LEGION',
    label: 'Iron Legion',
    actionWeightsPermille: {
      SCOUT: 780,
      EXPAND: 1120,
      DEFEND: 1350,
      RAID: 760,
      ATTACK: 1180,
      CONTEST_POI: 980,
      REGROUP: 1250,
    },
    preferredRaidArchetypes: ['SPEAR_GUARD', 'VANGUARD', 'RANGER'],
  },
  FLAME_CULT: {
    id: 'FLAME_CULT',
    label: 'Flame Cult',
    actionWeightsPermille: {
      SCOUT: 920,
      EXPAND: 900,
      DEFEND: 720,
      RAID: 1420,
      ATTACK: 1380,
      CONTEST_POI: 1080,
      REGROUP: 820,
    },
    preferredRaidArchetypes: ['RANGER', 'SCOUT', 'VANGUARD'],
  },
  WILD_HORDE: {
    id: 'WILD_HORDE',
    label: 'Wild Horde',
    actionWeightsPermille: {
      SCOUT: 1420,
      EXPAND: 1160,
      DEFEND: 820,
      RAID: 1320,
      ATTACK: 980,
      CONTEST_POI: 1220,
      REGROUP: 1120,
    },
    preferredRaidArchetypes: ['SCOUT', 'RANGER', 'VANGUARD'],
  },
};

export const ENEMY_DIFFICULTIES: Readonly<Record<EnemyDifficulty, EnemyDifficultyProfile>> = {
  CASUAL: {
    id: 'CASUAL',
    decisionIntervalTicks: 40,
    memoryDecayPerDecision: 70,
    minimumActionScore: 140,
  },
  STANDARD: {
    id: 'STANDARD',
    decisionIntervalTicks: 25,
    memoryDecayPerDecision: 45,
    minimumActionScore: 110,
  },
  HARD: {
    id: 'HARD',
    decisionIntervalTicks: 15,
    memoryDecayPerDecision: 30,
    minimumActionScore: 80,
  },
};

function weighted(score: number, weightPermille: number): number {
  return Math.floor((Math.max(0, score) * weightPermille) / 1000);
}

export function scoreEnemyActions(
  context: EnemyUtilityContext,
  faction: EnemyFactionProfile,
): Readonly<Record<StrategicAiAction, number>> {
  const armyAdvantage = Math.max(0, context.ownStrength - context.knownPlayerStrength);
  const armyDisadvantage = Math.max(0, context.knownPlayerStrength - context.ownStrength);
  const lowPressure = Math.max(0, 100 - context.directorPressure);
  const highPressure = context.directorPressure;
  const recovery = context.recoveryActive ? 250 : 0;
  const antiTurtle = context.antiTurtleActive ? 280 : 0;

  const raw: Record<StrategicAiAction, number> = {
    SCOUT: context.unknownRegionCount * 55 + (context.visiblePlayerUnits === 0 ? 180 : 0) + Math.floor(lowPressure / 2),
    EXPAND: context.neutralFrontierCount * 135 + context.ownRegionCount < 3 ? 90 : 0,
    DEFEND: context.threatenedOwnRegions * 240 + armyDisadvantage * 2 + recovery,
    RAID: context.knownPlayerSuppliedRegions * 210 + antiTurtle + Math.floor(highPressure * 1.5),
    ATTACK: context.visiblePlayerUnits * 120 + armyAdvantage * 2 + highPressure * 2,
    CONTEST_POI: context.contestablePoiCount * 175 + Math.floor(lowPressure / 3),
    REGROUP: Math.floor(context.damagedArmyPermille / 2) + armyDisadvantage * 2 + recovery,
  };

  return {
    SCOUT: weighted(raw.SCOUT, faction.actionWeightsPermille.SCOUT),
    EXPAND: weighted(raw.EXPAND, faction.actionWeightsPermille.EXPAND),
    DEFEND: weighted(raw.DEFEND, faction.actionWeightsPermille.DEFEND),
    RAID: weighted(raw.RAID, faction.actionWeightsPermille.RAID),
    ATTACK: weighted(raw.ATTACK, faction.actionWeightsPermille.ATTACK),
    CONTEST_POI: weighted(raw.CONTEST_POI, faction.actionWeightsPermille.CONTEST_POI),
    REGROUP: weighted(raw.REGROUP, faction.actionWeightsPermille.REGROUP),
  };
}

export function validateM05Content(): readonly string[] {
  const errors: string[] = [];
  const actions: readonly StrategicAiAction[] = ['SCOUT', 'EXPAND', 'DEFEND', 'RAID', 'ATTACK', 'CONTEST_POI', 'REGROUP'];
  for (const profile of Object.values(ENEMY_FACTIONS)) {
    for (const action of actions) {
      const weight = profile.actionWeightsPermille[action];
      if (!Number.isSafeInteger(weight) || weight <= 0) errors.push(`${profile.id} has invalid ${action} utility weight.`);
    }
  }
  for (const profile of Object.values(ENEMY_DIFFICULTIES)) {
    if (!Number.isSafeInteger(profile.decisionIntervalTicks) || profile.decisionIntervalTicks < 1) errors.push(`${profile.id} has invalid decision interval.`);
    if (!Number.isSafeInteger(profile.memoryDecayPerDecision) || profile.memoryDecayPerDecision < 0) errors.push(`${profile.id} has invalid memory decay.`);
    if (!Number.isSafeInteger(profile.minimumActionScore) || profile.minimumActionScore < 0) errors.push(`${profile.id} has invalid minimum action score.`);
  }
  return errors;
}
