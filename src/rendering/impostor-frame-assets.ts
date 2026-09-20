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
 * Manual gameplay calibration for the refreshed five-action unit pack.
 *
 * The source pack's apparent screen-facing axes are rotated/reflected relative
 * to the runtime observer slots. A single roster-wide mapping fixes the four
 * confirmed cardinal cases without per-unit hacks:
 * screen-up -> rear, screen-down -> front, screen-right -> right,
 * screen-left -> left.
 */
export const ANIMATED_IMPOSTOR_FILE_ORDER = [6, 5, 4, 3, 2, 1, 0, 7] as const;

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
