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
 * The generated turnaround sheets use observer-side labels while the runtime
 * advances view frames in screen-facing movement order. Front/rear stay fixed,
 * while every left/right side pair must be reversed before selecting source art.
 */
export const SCREEN_FACING_TURNAROUND_FRAME_REMAP = [0, 7, 6, 5, 4, 3, 2, 1] as const;

/**
 * Temporary Engineer recovery map. The uploaded 03 view is visually duplicated
 * toward the lower-left and 07 is currently empty, so use the nearest readable
 * cardinal frames for those two diagonals until replacement art is uploaded.
 * Remove this override once all eight Engineer source frames are corrected.
 */
export const ENGINEER_TEMPORARY_DIRECTION_FILENAMES = [
  '00-front.webp',
  '01-front-left.webp',
  '02-left.webp',
  '04-rear.webp',
  '04-rear.webp',
  '05-rear-right.webp',
  '06-right.webp',
  '06-right.webp',
] as const;

/**
 * Temporary Water Elementalist recovery map derived from manual WebGL checks.
 * The uploaded diagonal labels do not match their visible facing consistently:
 * source 03 reads up-right, 07 reads down-left, while 01/05 are safer cardinal
 * side views. Reorder only this asset set; shared runtime mapping stays unchanged.
 */
export const ELEMENTALIST_WATER_TEMPORARY_DIRECTION_FILENAMES = [
  '00-front.webp',
  '07-front-right.webp',
  '02-left.webp',
  '05-rear-right.webp',
  '04-rear.webp',
  '03-rear-left.webp',
  '06-right.webp',
  '01-front-left.webp',
] as const;

export function impostorFrameFiles(slug: string): readonly string[] {
  const filenames = slug === 'engineer'
    ? ENGINEER_TEMPORARY_DIRECTION_FILENAMES
    : slug === 'elementalist-water'
      ? ELEMENTALIST_WATER_TEMPORARY_DIRECTION_FILENAMES
      : IMPOSTOR_DIRECTION_FILENAMES;
  return filenames.map((filename) => `assets/impostors/${slug}/${filename}`);
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
