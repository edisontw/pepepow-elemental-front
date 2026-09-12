import {
  IDENTITY_IMPOSTOR_FRAME_REMAP,
  impostorFrameFiles,
  impostorFrameUrl,
} from './impostor-frame-assets';

export const VANGUARD_IMPOSTOR_FRAME_FILES = impostorFrameFiles('vanguard');

// The uploaded Vanguard set is named in canonical observer-side order. Use the
// actual diagonal frames so screen up-right no longer collapses to a cardinal
// right-facing substitute.
export const VANGUARD_IMPOSTOR_FRAME_REMAP = IDENTITY_IMPOSTOR_FRAME_REMAP;
export const VANGUARD_IMPOSTOR_HEADING_OFFSET_DEGREES = 0;

export function vanguardImpostorFrameUrl(frame: number, baseUrl: string): string {
  return impostorFrameUrl(frame, baseUrl, VANGUARD_IMPOSTOR_FRAME_FILES);
}
