import { describe, expect, it } from 'vitest';
import {
  VANGUARD_IMPOSTOR_FRAME_FILES,
  VANGUARD_IMPOSTOR_FRAME_REMAP,
  VANGUARD_IMPOSTOR_HEADING_OFFSET_DEGREES,
  vanguardImpostorFrameUrl,
} from '../../src/rendering/vanguard-impostor-frames';
import { IMPOSTOR_ASSET_REVISION } from '../../src/rendering/impostor-frame-assets';

const revision = `?v=${encodeURIComponent(IMPOSTOR_ASSET_REVISION)}`;

describe('Vanguard impostor frame assets', () => {
  it('keeps the canonical eight-direction runtime order', () => {
    expect(VANGUARD_IMPOSTOR_FRAME_FILES).toEqual([
      `assets/impostors/vanguard/00-front.webp${revision}`,
      `assets/impostors/vanguard/01-front-left.webp${revision}`,
      `assets/impostors/vanguard/02-left.webp${revision}`,
      `assets/impostors/vanguard/03-rear-left.webp${revision}`,
      `assets/impostors/vanguard/04-rear.webp${revision}`,
      `assets/impostors/vanguard/05-rear-right.webp${revision}`,
      `assets/impostors/vanguard/06-right.webp${revision}`,
      `assets/impostors/vanguard/07-front-right.webp${revision}`,
    ]);
  });

  it('uses the true canonical diagonal frames', () => {
    expect(VANGUARD_IMPOSTOR_FRAME_REMAP).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(VANGUARD_IMPOSTOR_HEADING_OFFSET_DEGREES).toBe(0);
  });

  it('builds base-aware cache-busted URLs and wraps frame indices', () => {
    expect(vanguardImpostorFrameUrl(0, '/pepepow-elemental-front/'))
      .toBe(`/pepepow-elemental-front/assets/impostors/vanguard/00-front.webp${revision}`);
    expect(vanguardImpostorFrameUrl(7, '/pepepow-elemental-front/'))
      .toBe(`/pepepow-elemental-front/assets/impostors/vanguard/07-front-right.webp${revision}`);
    expect(vanguardImpostorFrameUrl(8, '/pepepow-elemental-front/'))
      .toBe(`/pepepow-elemental-front/assets/impostors/vanguard/00-front.webp${revision}`);
    expect(vanguardImpostorFrameUrl(-1, '/pepepow-elemental-front/'))
      .toBe(`/pepepow-elemental-front/assets/impostors/vanguard/07-front-right.webp${revision}`);
  });
});
