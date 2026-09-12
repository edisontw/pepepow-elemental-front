import { describe, expect, it } from 'vitest';
import {
  ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES,
  ELEMENTALIST_FIRE_IMPOSTOR_FRAME_REMAP,
  ELEMENTALIST_FIRE_IMPOSTOR_HEADING_OFFSET_DEGREES,
  elementalistFireImpostorFrameUrl,
} from '../../src/rendering/elementalist-fire-impostor-frames';
import { IMPOSTOR_ASSET_REVISION } from '../../src/rendering/impostor-frame-assets';

const revision = `?v=${encodeURIComponent(IMPOSTOR_ASSET_REVISION)}`;

describe('Fire Elementalist impostor frame assets', () => {
  it('keeps the canonical eight-direction runtime order', () => {
    expect(ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES).toEqual([
      `assets/impostors/elementalist-fire/00-front.webp${revision}`,
      `assets/impostors/elementalist-fire/01-front-left.webp${revision}`,
      `assets/impostors/elementalist-fire/02-left.webp${revision}`,
      `assets/impostors/elementalist-fire/03-rear-left.webp${revision}`,
      `assets/impostors/elementalist-fire/04-rear.webp${revision}`,
      `assets/impostors/elementalist-fire/05-rear-right.webp${revision}`,
      `assets/impostors/elementalist-fire/06-right.webp${revision}`,
      `assets/impostors/elementalist-fire/07-front-right.webp${revision}`,
    ]);
  });

  it('uses canonical identity mapping for all eight directions', () => {
    expect(ELEMENTALIST_FIRE_IMPOSTOR_FRAME_REMAP).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(ELEMENTALIST_FIRE_IMPOSTOR_HEADING_OFFSET_DEGREES).toBe(0);
  });

  it('builds base-aware cache-busted URLs and wraps frame indices', () => {
    expect(elementalistFireImpostorFrameUrl(0, '/pepepow-elemental-front/'))
      .toBe(`/pepepow-elemental-front/assets/impostors/elementalist-fire/00-front.webp${revision}`);
    expect(elementalistFireImpostorFrameUrl(7, '/pepepow-elemental-front/'))
      .toBe(`/pepepow-elemental-front/assets/impostors/elementalist-fire/07-front-right.webp${revision}`);
    expect(elementalistFireImpostorFrameUrl(8, '/pepepow-elemental-front/'))
      .toBe(`/pepepow-elemental-front/assets/impostors/elementalist-fire/00-front.webp${revision}`);
    expect(elementalistFireImpostorFrameUrl(-1, '/pepepow-elemental-front/'))
      .toBe(`/pepepow-elemental-front/assets/impostors/elementalist-fire/07-front-right.webp${revision}`);
  });
});
