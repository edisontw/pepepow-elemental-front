const ELEMENTALIST_IMPOSTOR_IDS = new Set([
  'unit.elementalist.fire',
  'unit.elementalist.water',
  'unit.elementalist.ice',
  'unit.elementalist.lightning',
]);

export const ELEMENTALIST_FRONT_RIGHT_VIEW_FRAME = 7;
export const ELEMENTALIST_FRONT_RIGHT_SCALE = 1.12;

/**
 * Small presentation-only calibration for canonical WebP views whose visible
 * subject occupancy differs from the other directions. The current aligned
 * Elementalist turnaround source used by the shared diagonal file-order rule
 * reads undersized in the runtime Front-Right slot, so compensate the plane
 * while keeping its bottom edge pinned to the unit origin.
 */
export function unitImpostorFrameScale(assetId: string, viewFrame: number): number {
  const normalizedFrame = ((Math.round(viewFrame) % 8) + 8) % 8;
  if (ELEMENTALIST_IMPOSTOR_IDS.has(assetId) && normalizedFrame === ELEMENTALIST_FRONT_RIGHT_VIEW_FRAME) {
    return ELEMENTALIST_FRONT_RIGHT_SCALE;
  }
  return 1;
}
