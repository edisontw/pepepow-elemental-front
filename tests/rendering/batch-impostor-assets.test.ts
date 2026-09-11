import { describe, expect, it } from 'vitest';
import {
  SCREEN_FACING_TURNAROUND_FRAME_REMAP,
  IMPOSTOR_DIRECTION_FILENAMES,
  impostorFrameFiles,
} from '../../src/rendering/impostor-frame-assets';

const SLUGS = [
  'elementalist-water',
  'elementalist-ice',
  'elementalist-lightning',
  'spear-guard',
  'ranger',
  'scout',
  'engineer',
  'golem',
  'siege-construct',
] as const;

describe('batch unit impostor static paths', () => {
  it('uses the canonical eight runtime filenames for every uploaded unit set', () => {
    for (const slug of SLUGS) {
      expect(impostorFrameFiles(slug)).toEqual(
        IMPOSTOR_DIRECTION_FILENAMES.map((filename) => `assets/impostors/${slug}/${filename}`),
      );
    }
  });

  it('keeps AI turnaround frames in fixed-camera screen-facing order', () => {
    expect(SCREEN_FACING_TURNAROUND_FRAME_REMAP).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});
