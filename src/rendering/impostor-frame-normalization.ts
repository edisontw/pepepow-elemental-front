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
export const ELEMENTALIST_SCREEN_REAR_RIGHT_SCALE = 1;

/**
 * Explicit per-view presentation normalization for aligned Elementalists.
 * Front, Right, Rear, and screen Rear-Right remain the stable references.
 * Only the demonstrated undersized screen Front-Right view is enlarged.
 *
 * Keep all eight slots explicit so a later visual calibration compares the
 * complete cycle instead of stacking one-off direction patches. Plane scaling
 * remains bottom-pinned in VisualAssetLibrary, preserving the foot baseline.
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

export function unitImpostorFrameScale(assetId: string, viewFrame: number): number {
  const normalizedFrame = ((Math.round(viewFrame) % 8) + 8) % 8;
  if (!ELEMENTALIST_IMPOSTOR_IDS.has(assetId)) return 1;
  return ELEMENTALIST_VIEW_FRAME_SCALES[normalizedFrame] ?? 1;
}
