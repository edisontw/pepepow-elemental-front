import { describe, expect, it } from 'vitest';
import {
  ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES,
  elementalistFireImpostorFrameUrl,
} from '../../src/rendering/elementalist-fire-impostor-frames';

describe('Fire Elementalist impostor frame assets', () => {
  it('keeps the canonical eight-direction runtime order', () => {
    expect(ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES).toEqual([
      'assets/impostors/elementalist-fire/00-front.webp',
      'assets/impostors/elementalist-fire/01-front-left.webp',
      'assets/impostors/elementalist-fire/02-left.webp',
      'assets/impostors/elementalist-fire/03-rear-left.webp',
      'assets/impostors/elementalist-fire/04-rear.webp',
      'assets/impostors/elementalist-fire/05-rear-right.webp',
      'assets/impostors/elementalist-fire/06-right.webp',
      'assets/impostors/elementalist-fire/07-front-right.webp',
    ]);
  });

  it('builds base-aware URLs and wraps frame indices', () => {
    expect(elementalistFireImpostorFrameUrl(0, '/pepepow-elemental-front/'))
      .toBe('/pepepow-elemental-front/assets/impostors/elementalist-fire/00-front.webp');
    expect(elementalistFireImpostorFrameUrl(7, '/pepepow-elemental-front/'))
      .toBe('/pepepow-elemental-front/assets/impostors/elementalist-fire/07-front-right.webp');
    expect(elementalistFireImpostorFrameUrl(8, '/pepepow-elemental-front/'))
      .toBe('/pepepow-elemental-front/assets/impostors/elementalist-fire/00-front.webp');
    expect(elementalistFireImpostorFrameUrl(-1, '/pepepow-elemental-front/'))
      .toBe('/pepepow-elemental-front/assets/impostors/elementalist-fire/07-front-right.webp');
  });
});
