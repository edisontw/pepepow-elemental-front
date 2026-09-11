import { describe, expect, it } from 'vitest';
import {
  ELEMENTALIST_WATER_TEMPORARY_DIRECTION_FILENAMES,
  ENGINEER_TEMPORARY_DIRECTION_FILENAMES,
  SCREEN_FACING_TURNAROUND_FRAME_REMAP,
  IMPOSTOR_DIRECTION_FILENAMES,
  impostorFrameFiles,
} from '../../src/rendering/impostor-frame-assets';

const STANDARD_SLUGS = [
  'vanguard',
  'elementalist-fire',
  'elementalist-ice',
  'elementalist-lightning',
  'spear-guard',
  'ranger',
  'scout',
  'golem',
  'siege-construct',
] as const;

describe('batch unit impostor static paths', () => {
  it('uses the canonical eight runtime filenames for standard uploaded unit sets', () => {
    for (const slug of STANDARD_SLUGS) {
      expect(impostorFrameFiles(slug)).toEqual(
        IMPOSTOR_DIRECTION_FILENAMES.map((filename) => `assets/impostors/${slug}/${filename}`),
      );
    }
  });

  it('uses the manual WebGL recovery order for Water Elementalist diagonals', () => {
    expect(impostorFrameFiles('elementalist-water')).toEqual(
      ELEMENTALIST_WATER_TEMPORARY_DIRECTION_FILENAMES.map((filename) => `assets/impostors/elementalist-water/${filename}`),
    );
    expect(ELEMENTALIST_WATER_TEMPORARY_DIRECTION_FILENAMES).toEqual([
      '00-front.webp',
      '07-front-right.webp',
      '02-left.webp',
      '05-rear-right.webp',
      '04-rear.webp',
      '03-rear-left.webp',
      '06-right.webp',
      '01-front-left.webp',
    ]);
  });

  it('temporarily avoids the two unusable Engineer diagonal files', () => {
    expect(impostorFrameFiles('engineer')).toEqual(
      ENGINEER_TEMPORARY_DIRECTION_FILENAMES.map((filename) => `assets/impostors/engineer/${filename}`),
    );
    expect(ENGINEER_TEMPORARY_DIRECTION_FILENAMES[3]).toBe('04-rear.webp');
    expect(ENGINEER_TEMPORARY_DIRECTION_FILENAMES[7]).toBe('06-right.webp');
  });

  it('reverses observer-side left/right pairs for fixed-camera screen-facing movement', () => {
    expect(SCREEN_FACING_TURNAROUND_FRAME_REMAP).toEqual([0, 7, 6, 5, 4, 3, 2, 1]);
  });
});
