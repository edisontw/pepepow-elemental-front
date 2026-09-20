export const IMPOSTOR_DIRECTION_FILENAMES = [
  '00-front.webp',
  '01-front-left.webp',
  '02-left.webp',
  '03-rear-left.webp',
  '04-rear.webp',
  '05-rear-right.webp',
  '06-right.webp',
  '07-front-right.webp',
] as const;

export const IDENTITY_IMPOSTOR_FRAME_REMAP = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export const DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER = [0, 7, 2, 5, 4, 3, 6, 1] as const;

/**
 * HUMAN-VALIDATED DIRECTION LOCK — 2026-09-20.
 *
 * This is the accepted roster-wide mapping for the refreshed five-action pack.
 * Do NOT reinterpret it from filename semantics, camera intuition, or an older
 * static-turnaround rule. Do NOT change it unless a new manual WebGL check
 * identifies a specific wrong movement direction.
 *
 * Runtime observer slot -> source direction:
 *   0 -> 6  right
 *   1 -> 1  front_left
 *   2 -> 4  rear
 *   3 -> 3  rear_left
 *   4 -> 2  left
 *   5 -> 5  rear_right
 *   6 -> 0  front
 *   7 -> 7  front_right
 *
 * Runtime slots correspond to the existing heading resolver; source names are
 * asset filenames, not screen-space movement labels.
 */
export const ANIMATED_IMPOSTOR_FILE_ORDER = [6, 1, 4, 3, 2, 5, 0, 7] as const;

/**
 * FIXED-CAMERA SCREEN DIRECTION LOCK — manual browser QA, 2026-09-20.
 *
 * This mapping is derived from the actual camera pan/world transform at yaw 45°:
 *   slot 0 = screen down
 *   slot 1 = screen down-right
 *   slot 2 = screen right
 *   slot 3 = screen up-right
 *   slot 4 = screen up
 *   slot 5 = screen up-left
 *   slot 6 = screen left
 *   slot 7 = screen down-left
 *
 * Therefore screen left/right is ALWAYS runtime slot pair 2 / 6.
 * Screen up/down is ALWAYS runtime slot pair 4 / 0.
 * Never infer screen direction from source stem names.
 */
export const SCREEN_HORIZONTAL_CORRECTION_FILE_ORDER = [6, 1, 0, 3, 2, 5, 4, 7] as const;

/**
 * Siege Construct's exact side source art (left/right stems) has a
 * foreshortened/missing-looking barrel. Its screen-horizontal runtime slots
 * therefore reuse the two existing front diagonal views that preserve the
 * long cannon silhouette:
 *   slot 2 (screen right) -> source 7 front_right
 *   slot 6 (screen left)  -> source 1 front_left
 *
 * Screen up/down and the four diagonal runtime slots are otherwise preserved.
 */
export const SIEGE_CONSTRUCT_CORRECTION_FILE_ORDER = [6, 1, 1, 3, 2, 5, 7, 7] as const;

/**
 * Spear Guard source art has insufficient pike silhouette in these otherwise
 * direction-correct runtime views. Keep the accepted direction mapping intact
 * and add the existing GLB weapon geometry only for these screen slots.
 */
export const SPEAR_GUARD_WEAPON_OVERLAY_VIEW_FRAMES = [2, 4, 5, 6] as const;

export function spearGuardNeedsWeaponOverlay(viewFrame: number): boolean {
  const normalized = ((Math.round(viewFrame) % 8) + 8) % 8;
  return SPEAR_GUARD_WEAPON_OVERLAY_VIEW_FRAMES.includes(
    normalized as typeof SPEAR_GUARD_WEAPON_OVERLAY_VIEW_FRAMES[number],
  );
}

const SCREEN_HORIZONTAL_CORRECTION_SLUGS = new Set([
  'elementalist-fire',
  'elementalist-water',
  'elementalist-ice',
  'elementalist-lightning',
  'engineer',
  'golem',
  'scout',
  'spear-guard',
]);

export function animatedImpostorFileOrderForSlug(slug: string): readonly number[] {
  if (slug === 'siege-construct') return SIEGE_CONSTRUCT_CORRECTION_FILE_ORDER;
  return SCREEN_HORIZONTAL_CORRECTION_SLUGS.has(slug)
    ? SCREEN_HORIZONTAL_CORRECTION_FILE_ORDER
    : ANIMATED_IMPOSTOR_FILE_ORDER;
}

/**
 * Bump whenever canonical public impostor binaries or their runtime file order
 * changes in-place. The public filenames stay stable, so this query revision
 * prevents stale browser/CDN frames from surviving a presentation fix.
 */
export const IMPOSTOR_ASSET_REVISION = '20260913-shared-diagonal-direction-map-v2';

/**
 * Geometry resolves one of eight canonical observer-side runtime slots. The
 * heading contract is shared by every unit and remains identity-mapped here;
 * file-order calibration is presentation-only.
 */
export const SCREEN_FACING_TURNAROUND_FRAME_REMAP = IDENTITY_IMPOSTOR_FRAME_REMAP;

/**
 * Manual WebGL QA established that the uploaded turnaround diagonals are read
 * from the opposite screen-facing side by the fixed RTS camera. All approved
 * eight-direction unit sets use the same canonical naming convention, so every
 * unit shares one file-order rule: swap front-left/front-right and also
 * rear-left/rear-right while leaving cardinal views unchanged.
 */
export function impostorRuntimeFileOrderForSlug(_slug: string): readonly number[] {
  return DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER;
}

export function impostorFrameFiles(slug: string): readonly string[] {
  return impostorRuntimeFileOrderForSlug(slug).map((sourceFrame) => {
    const filename = IMPOSTOR_DIRECTION_FILENAMES[sourceFrame] ?? IMPOSTOR_DIRECTION_FILENAMES[0];
    return `assets/impostors/${slug}/${filename}?v=${encodeURIComponent(IMPOSTOR_ASSET_REVISION)}`;
  });
}

export function remapImpostorFrame(frame: number, frameRemap: readonly number[]): number {
  if (frameRemap.length === 0) return 0;
  const normalized = ((Math.round(frame) % frameRemap.length) + frameRemap.length) % frameRemap.length;
  const mapped = frameRemap[normalized];
  return Number.isInteger(mapped) ? ((mapped! % frameRemap.length) + frameRemap.length) % frameRemap.length : normalized;
}

export function impostorFrameUrl(
  frame: number,
  baseUrl: string,
  frameFiles: readonly string[],
): string {
  const normalized = ((Math.round(frame) % frameFiles.length) + frameFiles.length) % frameFiles.length;
  return `${baseUrl}${frameFiles[normalized]}`;
}
