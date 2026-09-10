import {
  SCREEN_FACING_TURNAROUND_FRAME_REMAP,
  impostorFrameFiles,
  impostorFrameUrl,
} from './impostor-frame-assets';

export const VANGUARD_IMPOSTOR_FRAME_FILES = impostorFrameFiles('vanguard');
export const VANGUARD_IMPOSTOR_FRAME_REMAP = SCREEN_FACING_TURNAROUND_FRAME_REMAP;
export const VANGUARD_IMPOSTOR_HEADING_OFFSET_DEGREES = 0;

export function vanguardImpostorFrameUrl(frame: number, baseUrl: string): string {
  return impostorFrameUrl(frame, baseUrl, VANGUARD_IMPOSTOR_FRAME_FILES);
}
