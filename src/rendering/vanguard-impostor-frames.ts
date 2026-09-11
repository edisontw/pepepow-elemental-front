import {
  impostorFrameFiles,
  impostorFrameUrl,
} from './impostor-frame-assets';

export const VANGUARD_IMPOSTOR_FRAME_FILES = impostorFrameFiles('vanguard');

// Temporary presentation-only safety map. The current diagonal Vanguard source
// views do not consistently match their intended screen-facing direction. Use
// reliable left/right cardinal views for all four diagonal movement sectors so
// the unit never appears to face the opposite side while moving. Replace this
// with a true eight-direction map once corrected source art is uploaded.
export const VANGUARD_IMPOSTOR_FRAME_REMAP = [0, 6, 6, 6, 4, 2, 2, 2] as const;
export const VANGUARD_IMPOSTOR_HEADING_OFFSET_DEGREES = 0;

export function vanguardImpostorFrameUrl(frame: number, baseUrl: string): string {
  return impostorFrameUrl(frame, baseUrl, VANGUARD_IMPOSTOR_FRAME_FILES);
}
