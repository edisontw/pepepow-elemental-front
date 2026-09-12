import {
  IDENTITY_IMPOSTOR_FRAME_REMAP,
  impostorFrameFiles,
  impostorFrameUrl,
} from './impostor-frame-assets';

export const RANGER_IMPOSTOR_FRAME_FILES = impostorFrameFiles('ranger');

// Ranger files use canonical observer-side order. Keep runtime order and the
// renderer remap identity so all units share the same eight-direction contract.
export const RANGER_IMPOSTOR_FRAME_REMAP = IDENTITY_IMPOSTOR_FRAME_REMAP;
export const RANGER_IMPOSTOR_HEADING_OFFSET_DEGREES = 0;

export function rangerImpostorFrameUrl(frame: number, baseUrl: string): string {
  return impostorFrameUrl(frame, baseUrl, RANGER_IMPOSTOR_FRAME_FILES);
}
