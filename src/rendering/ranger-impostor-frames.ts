import { impostorFrameFiles, impostorFrameUrl } from './impostor-frame-assets';

export const RANGER_IMPOSTOR_FRAME_FILES = impostorFrameFiles('ranger');

/**
 * The Ranger turnaround uses the common AI screen-facing side convention:
 * front/rear are correct while observer-side left/right pairs are reversed.
 * Keep the global fixed-camera mapping canonical and correct only this asset.
 */
export const RANGER_IMPOSTOR_FRAME_REMAP = [0, 7, 6, 5, 4, 3, 2, 1] as const;
export const RANGER_IMPOSTOR_HEADING_OFFSET_DEGREES = 0;

export function rangerImpostorFrameUrl(frame: number, baseUrl: string): string {
  return impostorFrameUrl(frame, baseUrl, RANGER_IMPOSTOR_FRAME_FILES);
}
