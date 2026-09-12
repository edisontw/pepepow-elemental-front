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

/**
 * Bump whenever canonical public impostor binaries are replaced in-place.
 * The public filenames stay stable, so this query revision prevents stale
 * browser/CDN frames from surviving a visual asset replacement.
 */
export const IMPOSTOR_ASSET_REVISION = '368dc7b4';

/**
 * The renderer still consumes eight runtime slots in canonical view order.
 * Manual WebGL calibration below only changes which uploaded source filename
 * fills a slot when an AI-generated pair uses the opposite diagonal side.
 */
export const SCREEN_FACING_TURNAROUND_FRAME_REMAP = IDENTITY_IMPOSTOR_FRAME_REMAP;

export const FRONT_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER = [0, 7, 2, 3, 4, 5, 6, 1] as const;
export const REAR_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER = [0, 1, 2, 5, 4, 3, 6, 7] as const;
export const BOTH_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER = [0, 7, 2, 5, 4, 3, 6, 1] as const;

const CALIBRATED_IMPOSTOR_FILE_ORDER_BY_SLUG: Readonly<Record<string, readonly number[]>> = {
  ranger: FRONT_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER,
  'spear-guard': FRONT_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER,
  'elementalist-ice': FRONT_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER,
  golem: FRONT_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER,
  'elementalist-lightning': BOTH_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER,
  'elementalist-water': BOTH_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER,
  'siege-construct': REAR_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER,
};

export function impostorRuntimeFileOrderForSlug(slug: string): readonly number[] {
  return CALIBRATED_IMPOSTOR_FILE_ORDER_BY_SLUG[slug] ?? IDENTITY_IMPOSTOR_FRAME_REMAP;
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
