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
] as const;

describe('batch unit impostor static paths', () => {
  it('uses the canonical eight runtime filenames for standard uploaded unit sets', () => {
    for (const slug of STANDARD_SLUGS) {
      expect(impostorFrameFiles(slug)).toEqual(
        IMPOSTOR_DIRECTION_FILENAMES.map((filename) => `assets/impostors/${slug}/${filename}`),
      );
    }
  });

  it('keeps the accepted Water Elementalist manual recovery directions', () => {
    expect(impostorFrameFiles('elementalist-water')).toEqual(
      ELEMENTALIST_WATER_TEMPORARY_DIRECTION_FILENAMES.map((filename) => `assets/impostors/elementalist-water/${filename}`),
    );
    expect(ELEMENTALIST_WATER_TEMPORARY_DIRECTION_FILENAMES).toEqual([
      '00-front.webp',
      '01-front-left.webp',
      '06-right.webp',
      '03-rear-left.webp',
      '04-rear.webp',
      '05-rear-right.webp',
      '02-left.webp',
      '07-front-right.webp',
    ]);
  });

  it('temporarily avoids the two unusable Engineer diagonal files', () => {
    expect(impostorFrameFiles('engineer')).toEqual(
      ENGINEER_TEMPORARY_DIRECTION_FILENAMES.map((filename) => `assets/impostors/engineer/${filename}`),
    );
    expect(ENGINEER_TEMPORARY_DIRECTION_FILENAMES[3]).toBe('04-rear.webp');
    expect(ENGINEER_TEMPORARY_DIRECTION_FILENAMES[7]).toBe('06-right.webp');
  });

  it('keeps canonical frame order for the shared fixed-camera mapping', () => {
    expect(SCREEN_FACING_TURNAROUND_FRAME_REMAP).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('pre-reverses Golem and Siege source loading to cancel their legacy per-asset remap', () => {
    for (const slug of ['golem', 'siege-construct'] as const) {
      expect(impostorFrameFiles(slug)).toEqual([
        `assets/impostors/${slug}/00-front.webp`,
        `assets/impostors/${slug}/07-front-right.webp`,
        `assets/impostors/${slug}/06-right.webp`,
        `assets/impostors/${slug}/05-rear-right.webp`,
        `assets/impostors/${slug}/04-rear.webp`,
        `assets/impostors/${slug}/03-rear-left.webp`,
        `assets/impostors/${slug}/02-left.webp`,
        `assets/impostors/${slug}/01-front-left.webp`,
      ]);
    }
  });
});
