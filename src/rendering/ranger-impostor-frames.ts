import {
  IDENTITY_IMPOSTOR_FRAME_REMAP,
  impostorFrameFiles,
  impostorFrameUrl,
} from './impostor-frame-assets';

export const RANGER_IMPOSTOR_FRAME_FILES = impostorFrameFiles('ranger');

// Runtime source-file order is calibrated centrally by impostorFrameFiles.
// Keep the renderer remap identity so heading sectors and hysteresis stay shared.
export const RANGER_IMPOSTOR_FRAME_REMAP = IDENTITY_IMPOSTOR_FRAME_REMAP;
export const RANGER_IMPOSTOR_HEADING_OFFSET_DEGREES = 0;

export function rangerImpostorFrameUrl(frame: number, baseUrl: string): string {
  return impostorFrameUrl(frame, baseUrl, RANGER_IMPOSTOR_FRAME_FILES);
}
