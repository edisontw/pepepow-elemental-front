import { impostorFrameFiles, impostorFrameUrl } from './impostor-frame-assets';

export const VANGUARD_IMPOSTOR_FRAME_FILES = impostorFrameFiles('vanguard');

export function vanguardImpostorFrameUrl(frame: number, baseUrl: string): string {
  return impostorFrameUrl(frame, baseUrl, VANGUARD_IMPOSTOR_FRAME_FILES);
}
