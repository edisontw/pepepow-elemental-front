import { describe, expect, it } from 'vitest';
import {
  DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER,
  SCREEN_FACING_TURNAROUND_FRAME_REMAP,
  IMPOSTOR_ASSET_REVISION,
  IMPOSTOR_DIRECTION_FILENAMES,
  impostorFrameFiles,
  impostorRuntimeFileOrderForSlug,
} from '../../src/rendering/impostor-frame-assets';
import { ELEMENTALIST_FIRE_IMPOSTOR_FRAME_REMAP } from '../../src/rendering/elementalist-fire-impostor-frames';
import { RANGER_IMPOSTOR_FRAME_REMAP } from '../../src/rendering/ranger-impostor-frames';
import { VANGUARD_IMPOSTOR_FRAME_REMAP } from '../../src/rendering/vanguard-impostor-frames';

const ALL_SLUGS = [
  'vanguard',
  'spear-guard',
  'ranger',
  'scout',
  'elementalist-fire',
  'elementalist-ice',
  'elementalist-lightning',
  'elementalist-water',
  'engineer',
  'golem',
  'siege-construct',
] as const;

describe('batch unit impostor static paths', () => {
  it('loads every canonical unit with the shared front/rear diagonal file order', () => {
    expect(IMPOSTOR_ASSET_REVISION.length).toBeGreaterThan(0);
    expect(DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER).toEqual([0, 7, 2, 5, 4, 3, 6, 1]);
    for (const slug of ALL_SLUGS) {
      expect(impostorRuntimeFileOrderForSlug(slug)).toEqual(DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER);
      expect(impostorFrameFiles(slug)).toEqual(
        DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER.map((sourceFrame) => {
          const filename = IMPOSTOR_DIRECTION_FILENAMES[sourceFrame] ?? IMPOSTOR_DIRECTION_FILENAMES[0];
          return `assets/impostors/${slug}/${filename}?v=${encodeURIComponent(IMPOSTOR_ASSET_REVISION)}`;
        }),
      );
    }
  });

  it('keeps canonical heading remaps for shared and specialized frame configs', () => {
    const identity = [0, 1, 2, 3, 4, 5, 6, 7];
    expect(SCREEN_FACING_TURNAROUND_FRAME_REMAP).toEqual(identity);
    expect(VANGUARD_IMPOSTOR_FRAME_REMAP).toEqual(identity);
    expect(RANGER_IMPOSTOR_FRAME_REMAP).toEqual(identity);
    expect(ELEMENTALIST_FIRE_IMPOSTOR_FRAME_REMAP).toEqual(identity);
  });
});
