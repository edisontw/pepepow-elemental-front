import {
  impostorFrameFiles,
  impostorFrameUrl,
} from './impostor-frame-assets';

export const ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES = impostorFrameFiles('elementalist-fire');

// Temporary presentation-only safety map. The current Fire diagonal source
// views are inconsistent in WebGL, including an up-right sector that reads as
// down-right. Use reliable left/right cardinal views for diagonal movement until
// corrected source art replaces those frames.
export const ELEMENTALIST_FIRE_IMPOSTOR_FRAME_REMAP = [0, 6, 6, 6, 4, 2, 2, 2] as const;
export const ELEMENTALIST_FIRE_IMPOSTOR_HEADING_OFFSET_DEGREES = 0;

export function elementalistFireImpostorFrameUrl(frame: number, baseUrl: string): string {
  return impostorFrameUrl(frame, baseUrl, ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES);
}
