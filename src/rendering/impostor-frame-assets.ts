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
 * FIXED-CAMERA SOURCE CALIBRATION — manual browser QA, 2026-09-20.
 *
 * Source stems describe observer-relative artwork, not screen movement.
 * Browser validation established the actual screen cardinal pairs:
 * - runtime slots 0 / 4 = screen right / left;
 * - runtime slots 2 / 6 = screen down / up.
 *
 * Several later-production units need only the screen-vertical pair swapped.
 * Spear Guard instead needs only the screen-horizontal pair swapped.
 *
 * Siege Construct needs both: its screen vertical pair matches the later batch,
 * while its generated exact side source art has a malformed/foreshortened cannon.
 * For exact screen right/left, use the existing opposite diagonal views with a
 * full readable barrel (front-right / rear-left) rather than the broken side art.
 */
export const SCREEN_VERTICAL_CORRECTION_FILE_ORDER = [6, 1, 0, 3, 2, 5, 4, 7] as const;
export const SPEAR_GUARD_HORIZONTAL_CORRECTION_FILE_ORDER = [2, 1, 4, 3, 6, 5, 0, 7] as const;
export const SIEGE_CONSTRUCT_CORRECTION_FILE_ORDER = [7, 1, 0, 3, 3, 5, 4, 7] as const;

const SCREEN_VERTICAL_CORRECTION_SLUGS = new Set([
  'elementalist-fire',
  'elementalist-water',
  'elementalist-ice',
  'elementalist-lightning',
  'engineer',
  'golem',
  'scout',
]);

export function animatedImpostorFileOrderForSlug(slug: string): readonly number[] {
  if (slug === 'spear-guard') return SPEAR_GUARD_HORIZONTAL_CORRECTION_FILE_ORDER;
  if (slug === 'siege-construct') return SIEGE_CONSTRUCT_CORRECTION_FILE_ORDER;
  return SCREEN_VERTICAL_CORRECTION_SLUGS.has(slug)
    ? SCREEN_VERTICAL_CORRECTION_FILE_ORDER
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
