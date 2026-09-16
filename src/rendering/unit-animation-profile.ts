export type UnitAnimationState = 'IDLE' | 'MOVE' | 'ATTACK' | 'CAST' | 'HIT' | 'DEATH';

export interface UnitAnimationIntent {
  tick: number;
  moving: boolean;
  frozen: boolean;
  attack: boolean;
  cast: boolean;
  hit: boolean;
  dead: boolean;
  movePlaybackRate?: number;
}

export interface UnitAnimationProfile {
  clips: Readonly<Partial<Record<UnitAnimationState, string>>>;
  transitionSeconds: Readonly<Partial<Record<UnitAnimationState, number>>>;
  playbackSpeed: Readonly<Partial<Record<UnitAnimationState, number>>>;
}

const STANDARD_CLIPS = {
  IDLE: 'Idle',
  MOVE: 'Move',
  ATTACK: 'Attack',
  CAST: 'Cast',
  HIT: 'Hit',
  DEATH: 'Death',
} as const;

const STANDARD_PROFILE: UnitAnimationProfile = {
  clips: STANDARD_CLIPS,
  transitionSeconds: {
    IDLE: 0.16,
    MOVE: 0.14,
    ATTACK: 0.07,
    CAST: 0.08,
    HIT: 0.045,
    DEATH: 0.08,
  },
  playbackSpeed: {
    IDLE: 1,
    MOVE: 1,
    ATTACK: 1,
    CAST: 1,
    HIT: 1,
    DEATH: 1,
  },
};

const UNIT_PROFILES = new Map<string, UnitAnimationProfile>([
  ['unit.vanguard', STANDARD_PROFILE],
  ['unit.elementalist.fire', STANDARD_PROFILE],
  ['unit.elementalist.water', STANDARD_PROFILE],
  ['unit.elementalist.ice', STANDARD_PROFILE],
  ['unit.elementalist.lightning', STANDARD_PROFILE],
  ['unit.spear-guard', STANDARD_PROFILE],
  ['unit.ranger', STANDARD_PROFILE],
  ['unit.scout', STANDARD_PROFILE],
  ['unit.engineer', STANDARD_PROFILE],
  ['unit.golem', STANDARD_PROFILE],
  ['unit.siege-construct', STANDARD_PROFILE],
]);

export function unitAnimationProfile(modelId: string): UnitAnimationProfile {
  return UNIT_PROFILES.get(modelId) ?? STANDARD_PROFILE;
}

export function resolveUnitAnimationState(intent: UnitAnimationIntent): UnitAnimationState {
  if (intent.dead) return 'DEATH';
  if (intent.hit) return 'HIT';
  if (intent.cast) return 'CAST';
  if (intent.attack) return 'ATTACK';
  if (intent.moving && !intent.frozen) return 'MOVE';
  return 'IDLE';
}

export function isOneShotAnimationState(state: UnitAnimationState): boolean {
  return state === 'ATTACK' || state === 'CAST' || state === 'HIT';
}
