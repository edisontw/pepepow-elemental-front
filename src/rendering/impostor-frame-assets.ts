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
 * Canonical runtime files are stored directly in observer-side frame order.
 * Keep this shared symbol as an identity alias for existing presentation code.
 */
export const SCREEN_FACING_TURNAROUND_FRAME_REMAP = IDENTITY_IMPOSTOR_FRAME_REMAP;

export function impostorFrameFiles(slug: string): readonly string[] {
  return IMPOSTOR_DIRECTION_FILENAMES.map((filename) => `assets/impostors/${slug}/${filename}`);
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
