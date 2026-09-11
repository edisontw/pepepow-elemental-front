import { describe, expect, it } from 'vitest';
import {
  RANGER_IMPOSTOR_FRAME_FILES,
  RANGER_IMPOSTOR_FRAME_REMAP,
  RANGER_IMPOSTOR_HEADING_OFFSET_DEGREES,
  rangerImpostorFrameUrl,
} from '../../src/rendering/ranger-impostor-frames';
import { impostorFrameForHeading } from '../../src/rendering/impostor-frame';
import { remapImpostorFrame } from '../../src/rendering/impostor-frame-assets';

function headingForWorldDelta(deltaX: number, deltaZ: number): number {
  return Math.atan2(deltaX, deltaZ) * 180 / Math.PI;
}

describe('Ranger impostor frame calibration', () => {
  it('keeps canonical filenames and an asset-specific mirrored side remap', () => {
    expect(RANGER_IMPOSTOR_FRAME_FILES).toEqual([
      'assets/impostors/ranger/00-front.webp',
      'assets/impostors/ranger/01-front-left.webp',
      'assets/impostors/ranger/02-left.webp',
      'assets/impostors/ranger/03-rear-left.webp',
      'assets/impostors/ranger/04-rear.webp',
      'assets/impostors/ranger/05-rear-right.webp',
      'assets/impostors/ranger/06-right.webp',
      'assets/impostors/ranger/07-front-right.webp',
    ]);
    expect(RANGER_IMPOSTOR_FRAME_REMAP).toEqual([0, 7, 6, 5, 4, 3, 2, 1]);
    expect(RANGER_IMPOSTOR_HEADING_OFFSET_DEGREES).toBe(0);
  });

  it('preserves front/rear while reversing Ranger side-pair source frames', () => {
    const cases = [
      { deltaX: 1, deltaZ: 1, sourceFrame: 0 },
      { deltaX: 1, deltaZ: 0, sourceFrame: 7 },
      { deltaX: 1, deltaZ: -1, sourceFrame: 6 },
      { deltaX: 0, deltaZ: -1, sourceFrame: 5 },
      { deltaX: -1, deltaZ: -1, sourceFrame: 4 },
      { deltaX: -1, deltaZ: 0, sourceFrame: 3 },
      { deltaX: -1, deltaZ: 1, sourceFrame: 2 },
      { deltaX: 0, deltaZ: 1, sourceFrame: 1 },
    ] as const;

    for (const { deltaX, deltaZ, sourceFrame } of cases) {
      const viewFrame = impostorFrameForHeading(headingForWorldDelta(deltaX, deltaZ));
      expect(remapImpostorFrame(viewFrame, RANGER_IMPOSTOR_FRAME_REMAP)).toBe(sourceFrame);
    }
  });

  it('builds base-aware URLs and wraps frame indices', () => {
    expect(rangerImpostorFrameUrl(0, '/pepepow-elemental-front/'))
      .toBe('/pepepow-elemental-front/assets/impostors/ranger/00-front.webp');
    expect(rangerImpostorFrameUrl(-1, '/pepepow-elemental-front/'))
      .toBe('/pepepow-elemental-front/assets/impostors/ranger/07-front-right.webp');
  });
});
