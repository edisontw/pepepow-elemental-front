import { describe, expect, it } from 'vitest';
import {
  RANGER_IMPOSTOR_FRAME_FILES,
  RANGER_IMPOSTOR_FRAME_REMAP,
  RANGER_IMPOSTOR_HEADING_OFFSET_DEGREES,
  rangerImpostorFrameUrl,
} from '../../src/rendering/ranger-impostor-frames';
import { impostorFrameForHeading } from '../../src/rendering/impostor-frame';
import { IMPOSTOR_ASSET_REVISION, remapImpostorFrame } from '../../src/rendering/impostor-frame-assets';

function headingForWorldDelta(deltaX: number, deltaZ: number): number {
  return Math.atan2(deltaX, deltaZ) * 180 / Math.PI;
}

const revision = `?v=${encodeURIComponent(IMPOSTOR_ASSET_REVISION)}`;

describe('Ranger impostor frame calibration', () => {
  it('keeps canonical filenames and canonical observer-side remap', () => {
    expect(RANGER_IMPOSTOR_FRAME_FILES).toEqual([
      `assets/impostors/ranger/00-front.webp${revision}`,
      `assets/impostors/ranger/01-front-left.webp${revision}`,
      `assets/impostors/ranger/02-left.webp${revision}`,
      `assets/impostors/ranger/03-rear-left.webp${revision}`,
      `assets/impostors/ranger/04-rear.webp${revision}`,
      `assets/impostors/ranger/05-rear-right.webp${revision}`,
      `assets/impostors/ranger/06-right.webp${revision}`,
      `assets/impostors/ranger/07-front-right.webp${revision}`,
    ]);
    expect(RANGER_IMPOSTOR_FRAME_REMAP).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(RANGER_IMPOSTOR_HEADING_OFFSET_DEGREES).toBe(0);
  });

  it('maps all eight screen movement directions to matching runtime frames', () => {
    const cases = [
      { deltaX: 1, deltaZ: 1, runtimeFrame: 0 },
      { deltaX: 1, deltaZ: 0, runtimeFrame: 1 },
      { deltaX: 1, deltaZ: -1, runtimeFrame: 2 },
      { deltaX: 0, deltaZ: -1, runtimeFrame: 3 },
      { deltaX: -1, deltaZ: -1, runtimeFrame: 4 },
      { deltaX: -1, deltaZ: 0, runtimeFrame: 5 },
      { deltaX: -1, deltaZ: 1, runtimeFrame: 6 },
      { deltaX: 0, deltaZ: 1, runtimeFrame: 7 },
    ] as const;

    for (const { deltaX, deltaZ, runtimeFrame } of cases) {
      const viewFrame = impostorFrameForHeading(headingForWorldDelta(deltaX, deltaZ));
      expect(remapImpostorFrame(viewFrame, RANGER_IMPOSTOR_FRAME_REMAP)).toBe(runtimeFrame);
    }
  });

  it('builds base-aware cache-busted URLs and wraps frame indices', () => {
    expect(rangerImpostorFrameUrl(0, '/pepepow-elemental-front/'))
      .toBe(`/pepepow-elemental-front/assets/impostors/ranger/00-front.webp${revision}`);
    expect(rangerImpostorFrameUrl(-1, '/pepepow-elemental-front/'))
      .toBe(`/pepepow-elemental-front/assets/impostors/ranger/07-front-right.webp${revision}`);
  });
});
