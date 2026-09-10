import { impostorFrameFiles, impostorFrameUrl } from './impostor-frame-assets';

export const ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES = impostorFrameFiles('elementalist-fire');

export function elementalistFireImpostorFrameUrl(frame: number, baseUrl: string): string {
  return impostorFrameUrl(frame, baseUrl, ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES);
}
