import { DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER } from './impostor-frame-assets';

export const IMPOSTOR_ANIMATION_ACTIONS = [
  'IDLE',
  'MOVE',
  'ATTACK',
  'HIT',
  'DEATH',
] as const;

export type ImpostorAnimationAction = typeof IMPOSTOR_ANIMATION_ACTIONS[number];

export interface ImpostorAnimationSample {
  action: ImpostorAnimationAction;
  elapsedSeconds: number;
}

export const IMPOSTOR_ANIMATION_FRAMES_PER_DIRECTION = 4;
export const IMPOSTOR_MOVE_CYCLE_DISTANCE_METRES = 1.35;

export const IMPOSTOR_ANIMATION_ASSET_REVISION = '20260918-complete-unit-animation-pack-v2';

export const IMPOSTOR_ANIMATION_DIRECTION_STEMS = [
  'front',
  'front_left',
  'left',
  'rear_left',
  'rear',
  'rear_right',
  'right',
  'front_right',
] as const;

const ACTION_DIRECTORIES: Readonly<Record<ImpostorAnimationAction, string>> = {
  IDLE: 'idle',
  MOVE: 'move',
  ATTACK: 'attack',
  HIT: 'hit',
  DEATH: 'death',
};

const ACTION_FPS: Readonly<Record<ImpostorAnimationAction, number>> = {
  IDLE: 2.5,
  MOVE: 8,
  ATTACK: 12,
  HIT: 16,
  DEATH: 8,
};

const LOOPING_ACTIONS = new Set<ImpostorAnimationAction>(['IDLE', 'MOVE']);

/**
 * Returns the 32 files for one action in runtime view order:
 * 8 camera-relative views x 4 animation frames.
 *
 * Source direction names remain canonical. The shared diagonal swap is applied
 * only when constructing runtime view order, matching the existing fixed-camera
 * calibration without renaming or mutating source assets.
 */
export function animatedImpostorFrameFiles(
  slug: string,
  action: ImpostorAnimationAction,
): readonly string[] {
  const directory = ACTION_DIRECTORIES[action];
  return DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER.flatMap((sourceDirection) => {
    const stem = IMPOSTOR_ANIMATION_DIRECTION_STEMS[sourceDirection]
      ?? IMPOSTOR_ANIMATION_DIRECTION_STEMS[0];
    return Array.from({ length: IMPOSTOR_ANIMATION_FRAMES_PER_DIRECTION }, (_, frame) => {
      const suffix = frame.toString().padStart(2, '0');
      return `assets/impostors/${slug}/${directory}/${stem}_${suffix}.webp?v=${encodeURIComponent(IMPOSTOR_ANIMATION_ASSET_REVISION)}`;
    });
  });
}

export function impostorAnimationMaterialIndex(viewFrame: number, animationFrame: number): number {
  const normalizedView = ((Math.round(viewFrame) % 8) + 8) % 8;
  const normalizedAnimation = ((Math.round(animationFrame) % IMPOSTOR_ANIMATION_FRAMES_PER_DIRECTION)
    + IMPOSTOR_ANIMATION_FRAMES_PER_DIRECTION) % IMPOSTOR_ANIMATION_FRAMES_PER_DIRECTION;
  return normalizedView * IMPOSTOR_ANIMATION_FRAMES_PER_DIRECTION + normalizedAnimation;
}

export function impostorAnimationFrame(
  action: ImpostorAnimationAction,
  elapsedSeconds: number,
): number {
  const elapsed = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
  const raw = Math.floor(elapsed * ACTION_FPS[action]);
  if (LOOPING_ACTIONS.has(action)) return raw % IMPOSTOR_ANIMATION_FRAMES_PER_DIRECTION;
  return Math.min(IMPOSTOR_ANIMATION_FRAMES_PER_DIRECTION - 1, raw);
}

export function impostorMoveElapsedSeconds(distanceMetres: number): number {
  const distance = Math.max(0, Number.isFinite(distanceMetres) ? distanceMetres : 0);
  return (distance / IMPOSTOR_MOVE_CYCLE_DISTANCE_METRES) * impostorAnimationDurationSeconds('MOVE');
}

export function impostorAnimationDurationSeconds(action: ImpostorAnimationAction): number {
  return IMPOSTOR_ANIMATION_FRAMES_PER_DIRECTION / ACTION_FPS[action];
}

export function isLoopingImpostorAnimation(action: ImpostorAnimationAction): boolean {
  return LOOPING_ACTIONS.has(action);
}
