import { animatedImpostorFileOrderForSlug } from './impostor-frame-assets';
import type { ImpostorAnimationAction } from './impostor-animation';

export const IMPOSTOR_ATLAS_REVISION = '20260920-atlas-direction-v8-screen-cardinal-calibration';
export const ATLAS_WIDTH = 1568;
export const ATLAS_HEIGHT = 1040;

export function impostorAtlasFile(slug: string, action: ImpostorAnimationAction): string {
  return `assets/impostor-atlases/${slug}/${action.toLowerCase()}.webp?v=${IMPOSTOR_ATLAS_REVISION}`;
}

/** Match the existing unflipped image upload: source and UV rows start at the top. */
export function impostorAtlasRect(slug: string, runtimeIndex: number): { x: number; y: number; width: number; height: number } {
  const index = ((Math.floor(runtimeIndex) % 32) + 32) % 32;
  const source = animatedImpostorFileOrderForSlug(slug)[Math.floor(index / 4)]! * 4 + index % 4;
  return {
    x: ((source % 8) * 196 + 2) / ATLAS_WIDTH,
    y: (Math.floor(source / 8) * 260 + 2) / ATLAS_HEIGHT,
    width: 192 / ATLAS_WIDTH,
    height: 256 / ATLAS_HEIGHT,
  };
}
