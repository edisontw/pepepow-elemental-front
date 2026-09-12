import { describe, expect, it } from 'vitest';
import {
  BOTH_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER,
  FRONT_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER,
  SCREEN_FACING_TURNAROUND_FRAME_REMAP,
  REAR_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER,
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
  it('loads eight cache-busted runtime files for every uploaded unit set', () => {
    expect(IMPOSTOR_ASSET_REVISION.length).toBeGreaterThan(0);
    for (const slug of ALL_SLUGS) {
      const order = impostorRuntimeFileOrderForSlug(slug);
      expect(impostorFrameFiles(slug)).toEqual(
        order.map(
          (sourceFrame) =>
            `assets/impostors/${slug}/${IMPOSTOR_DIRECTION_FILENAMES[sourceFrame]}?v=${encodeURIComponent(IMPOSTOR_ASSET_REVISION)}`,
        ),
      );
    }
  });

  it('keeps renderer frame remaps identity after runtime file-order calibration', () => {
    const identity = [0, 1, 2, 3, 4, 5, 6, 7];
    expect(SCREEN_FACING_TURNAROUND_FRAME_REMAP).toEqual(identity);
    expect(VANGUARD_IMPOSTOR_FRAME_REMAP).toEqual(identity);
    expect(RANGER_IMPOSTOR_FRAME_REMAP).toEqual(identity);
    expect(ELEMENTALIST_FIRE_IMPOSTOR_FRAME_REMAP).toEqual(identity);
    expect(impostorRuntimeFileOrderForSlug('scout')).toEqual(identity);
    expect(impostorRuntimeFileOrderForSlug('engineer')).toEqual(identity);
  });

  it('applies only the diagonal-pair file-order calibrations observed in WebGL', () => {
    expect(FRONT_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER).toEqual([0, 7, 2, 3, 4, 5, 6, 1]);
    expect(REAR_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER).toEqual([0, 1, 2, 5, 4, 3, 6, 7]);
    expect(BOTH_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER).toEqual([0, 7, 2, 5, 4, 3, 6, 1]);

    expect(impostorRuntimeFileOrderForSlug('ranger')).toEqual(FRONT_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER);
    expect(impostorRuntimeFileOrderForSlug('spear-guard')).toEqual(FRONT_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER);
    expect(impostorRuntimeFileOrderForSlug('elementalist-ice')).toEqual(FRONT_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER);
    expect(impostorRuntimeFileOrderForSlug('golem')).toEqual(FRONT_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER);
    expect(impostorRuntimeFileOrderForSlug('elementalist-lightning')).toEqual(BOTH_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER);
    expect(impostorRuntimeFileOrderForSlug('elementalist-water')).toEqual(BOTH_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER);
    expect(impostorRuntimeFileOrderForSlug('siege-construct')).toEqual(REAR_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER);
  });
});
