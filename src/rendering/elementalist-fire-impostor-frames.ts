import {
  IDENTITY_IMPOSTOR_FRAME_REMAP,
  impostorFrameFiles,
  impostorFrameUrl,
} from './impostor-frame-assets';

export const ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES = impostorFrameFiles('elementalist-fire');

export const ELEMENTALIST_FIRE_IMPOSTOR_FRAME_REMAP = IDENTITY_IMPOSTOR_FRAME_REMAP;
export const ELEMENTALIST_FIRE_IMPOSTOR_HEADING_OFFSET_DEGREES = 0;

export function elementalistFireImpostorFrameUrl(frame: number, baseUrl: string): string {
  return impostorFrameUrl(frame, baseUrl, ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES);
}
