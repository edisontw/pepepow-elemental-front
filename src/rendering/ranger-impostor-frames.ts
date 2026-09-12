import {
  IDENTITY_IMPOSTOR_FRAME_REMAP,
  impostorFrameFiles,
  impostorFrameUrl,
} from './impostor-frame-assets';

export const RANGER_IMPOSTOR_FRAME_FILES = impostorFrameFiles('ranger');

// The uploaded Ranger set is named in canonical observer-side order. Keep the
// per-asset mapping identity so screen up-right selects the matching diagonal
// source instead of the mirrored up-left view.
export const RANGER_IMPOSTOR_FRAME_REMAP = IDENTITY_IMPOSTOR_FRAME_REMAP;
export const RANGER_IMPOSTOR_HEADING_OFFSET_DEGREES = 0;

export function rangerImpostorFrameUrl(frame: number, baseUrl: string): string {
  return impostorFrameUrl(frame, baseUrl, RANGER_IMPOSTOR_FRAME_FILES);
}
