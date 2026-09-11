import { describe, expect, it } from 'vitest';
import {
  VANGUARD_IMPOSTOR_FRAME_FILES,
  VANGUARD_IMPOSTOR_FRAME_REMAP,
  VANGUARD_IMPOSTOR_HEADING_OFFSET_DEGREES,
  vanguardImpostorFrameUrl,
} from '../../src/rendering/vanguard-impostor-frames';

describe('Vanguard impostor frame assets', () => {
  it('keeps the canonical eight-direction runtime order', () => {
    expect(VANGUARD_IMPOSTOR_FRAME_FILES).toEqual([
      'assets/impostors/vanguard/00-front.webp',
      'assets/impostors/vanguard/01-front-left.webp',
      'assets/impostors/vanguard/02-left.webp',
      'assets/impostors/vanguard/03-rear-left.webp',
      'assets/impostors/vanguard/04-rear.webp',
      'assets/impostors/vanguard/05-rear-right.webp',
      'assets/impostors/vanguard/06-right.webp',
      'assets/impostors/vanguard/07-front-right.webp',
    ]);
  });

  it('uses cardinal-safe fallbacks for all current diagonal views', () => {
    expect(VANGUARD_IMPOSTOR_FRAME_REMAP).toEqual([0, 6, 6, 6, 4, 2, 2, 2]);
    expect(VANGUARD_IMPOSTOR_HEADING_OFFSET_DEGREES).toBe(0);
  });

  it('builds base-aware URLs and wraps frame indices', () => {
    expect(vanguardImpostorFrameUrl(0, '/pepepow-elemental-front/'))
      .toBe('/pepepow-elemental-front/assets/impostors/vanguard/00-front.webp');
    expect(vanguardImpostorFrameUrl(7, '/pepepow-elemental-front/'))
      .toBe('/pepepow-elemental-front/assets/impostors/vanguard/07-front-right.webp');
    expect(vanguardImpostorFrameUrl(8, '/pepepow-elemental-front/'))
      .toBe('/pepepow-elemental-front/assets/impostors/vanguard/00-front.webp');
    expect(vanguardImpostorFrameUrl(-1, '/pepepow-elemental-front/'))
      .toBe('/pepepow-elemental-front/assets/impostors/vanguard/07-front-right.webp');
  });
});
