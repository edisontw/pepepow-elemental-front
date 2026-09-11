import {
  impostorFrameFiles,
  impostorFrameUrl,
} from './impostor-frame-assets';

export const ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES = impostorFrameFiles('elementalist-fire');

// Temporary presentation-only safety map. The current lower-right diagonal
// source view reads as lower-left in WebGL, so use the reliable right-facing
// cardinal frame for that movement sector until corrected source art replaces
// the diagonal. Other directions retain their current calibrated mapping.
export const ELEMENTALIST_FIRE_IMPOSTOR_FRAME_REMAP = [0, 6, 6, 5, 4, 3, 2, 1] as const;
export const ELEMENTALIST_FIRE_IMPOSTOR_HEADING_OFFSET_DEGREES = 0;

export function elementalistFireImpostorFrameUrl(frame: number, baseUrl: string): string {
  return impostorFrameUrl(frame, baseUrl, ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES);
}
