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
 * Canonical runtime files are already stored in observer-side frame order.
 * Keep this legacy shared symbol as identity so screen/world heading selects the
 * matching canonical frame instead of swapping every left/right pair.
 */
export const SCREEN_FACING_TURNAROUND_FRAME_REMAP = IDENTITY_IMPOSTOR_FRAME_REMAP;

const REVERSED_IMPOSTOR_DIRECTION_FILENAMES = [
  '00-front.webp',
  '07-front-right.webp',
  '06-right.webp',
  '05-rear-right.webp',
  '04-rear.webp',
  '03-rear-left.webp',
  '02-left.webp',
  '01-front-left.webp',
] as const;

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
 * Keep the previously accepted visible directions, but store them directly in
 * canonical runtime view-frame slots now that the shared mapping is identity.
 */
export const ELEMENTALIST_WATER_TEMPORARY_DIRECTION_FILENAMES = [
  '00-front.webp',
  '01-front-left.webp',
  '06-right.webp',
  '03-rear-left.webp',
  '04-rear.webp',
  '05-rear-right.webp',
  '02-left.webp',
  '07-front-right.webp',
] as const;

export function impostorFrameFiles(slug: string): readonly string[] {
  const filenames = slug === 'engineer'
    ? ENGINEER_TEMPORARY_DIRECTION_FILENAMES
    : slug === 'elementalist-water'
      ? ELEMENTALIST_WATER_TEMPORARY_DIRECTION_FILENAMES
      : slug === 'golem' || slug === 'siege-construct'
        // These two configs still carry a narrow per-asset reversed remap from
        // earlier QA. Reverse their loaded source order so the two reversals
        // cancel and canonical screen-facing directions are restored without
        // touching the render bridge or authoritative state.
        ? REVERSED_IMPOSTOR_DIRECTION_FILENAMES
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
