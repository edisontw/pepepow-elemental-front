const ELEMENTALIST_IMPOSTOR_IDS = new Set([
  'unit.elementalist.fire',
  'unit.elementalist.water',
  'unit.elementalist.ice',
  'unit.elementalist.lightning',
]);

/**
 * Screen movement names and canonical observer-view labels are not the same
 * coordinate system. With the fixed 45 degree RTS camera, screen down-right
 * (player-facing "front-right") resolves to runtime view frame 1, while
 * screen up-right (player-facing "rear-right") resolves to frame 3.
 *
 * The shared diagonal source-file order then loads 07-front-right.webp into
 * runtime frame 1 and 05-rear-right.webp into runtime frame 3.
 */
export const ELEMENTALIST_SCREEN_FRONT_RIGHT_VIEW_FRAME = 1;
export const ELEMENTALIST_SCREEN_REAR_RIGHT_VIEW_FRAME = 3;
export const ELEMENTALIST_SCREEN_FRONT_RIGHT_SCALE = 1.12;
export const ELEMENTALIST_WATER_SCREEN_FRONT_RIGHT_SCALE = 1.75;
export const ELEMENTALIST_SCREEN_REAR_RIGHT_SCALE = 1;

/**
 * Explicit per-view presentation normalization for aligned Elementalists.
 * Front, Right, Rear, and screen Rear-Right remain the stable references.
 *
 * Fire, Ice, and Lightning share the standard Front-Right correction. Water
 * keeps a much stronger asset-specific correction because repeated manual
 * WebGL QA still reads its 07-front-right source as substantially undersized.
 * This remains presentation-only and keeps the bottom edge pinned at runtime.
 */
export const ELEMENTALIST_VIEW_FRAME_SCALES = [
  1,
  ELEMENTALIST_SCREEN_FRONT_RIGHT_SCALE,
  1,
  ELEMENTALIST_SCREEN_REAR_RIGHT_SCALE,
  1,
  1,
  1,
  1,
] as const;

export const ELEMENTALIST_WATER_VIEW_FRAME_SCALES = [
  1,
  ELEMENTALIST_WATER_SCREEN_FRONT_RIGHT_SCALE,
  1,
  ELEMENTALIST_SCREEN_REAR_RIGHT_SCALE,
  1,
  1,
  1,
  1,
] as const;

export function unitImpostorFrameScale(assetId: string, viewFrame: number): number {
  const normalizedFrame = ((Math.round(viewFrame) % 8) + 8) % 8;
  if (!ELEMENTALIST_IMPOSTOR_IDS.has(assetId)) return 1;
  const scales = assetId === 'unit.elementalist.water'
    ? ELEMENTALIST_WATER_VIEW_FRAME_SCALES
    : ELEMENTALIST_VIEW_FRAME_SCALES;
  return scales[normalizedFrame] ?? 1;
}
