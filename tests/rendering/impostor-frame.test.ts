import { describe, expect, it } from 'vitest';
import {
  impostorAtlasOffset,
  impostorFrameForHeading,
  stableImpostorFrameForHeading,
} from '../../src/rendering/impostor-frame';
import {
  SCREEN_FACING_TURNAROUND_FRAME_REMAP,
  remapImpostorFrame,
} from '../../src/rendering/impostor-frame-assets';

function headingForWorldDelta(deltaX: number, deltaZ: number): number {
  // Matches UnitRenderBridge: world +Z is heading 0, +X is +90 degrees.
  return Math.atan2(deltaX, deltaZ) * 180 / Math.PI;
}

describe('impostor frame mapping', () => {
  it('maps the fixed 45 degree RTS camera into unit-local observer-side directions', () => {
    expect(impostorFrameForHeading(45)).toBe(0);   // front
    expect(impostorFrameForHeading(90)).toBe(1);  // front-left observer view
    expect(impostorFrameForHeading(135)).toBe(2); // left observer view
    expect(impostorFrameForHeading(180)).toBe(3); // rear-left observer view
    expect(impostorFrameForHeading(225)).toBe(4); // rear
    expect(impostorFrameForHeading(-90)).toBe(5); // rear-right observer view
    expect(impostorFrameForHeading(-45)).toBe(6); // right observer view
    expect(impostorFrameForHeading(0)).toBe(7);   // front-right observer view
    expect(impostorFrameForHeading(405)).toBe(0);
  });

  it('reverses source-side progression while preserving front and rear', () => {
    const expected = [0, 7, 6, 5, 4, 3, 2, 1] as const;
    for (let frame = 0; frame < 8; frame += 1) {
      expect(remapImpostorFrame(frame, SCREEN_FACING_TURNAROUND_FRAME_REMAP)).toBe(expected[frame]);
    }
  });

  it('maps all eight canonical world movement vectors to the corrected turnaround source frame', () => {
    // The generated sheets use observer-side left/right labels, so screen-facing
    // movement must select the opposite side source frame for non-front/rear views.
    const cases = [
      { label: 'down', deltaX: 1, deltaZ: 1, sourceFrame: 0 },
      { label: 'down-right', deltaX: 1, deltaZ: 0, sourceFrame: 7 },
      { label: 'right', deltaX: 1, deltaZ: -1, sourceFrame: 6 },
      { label: 'up-right', deltaX: 0, deltaZ: -1, sourceFrame: 5 },
      { label: 'up', deltaX: -1, deltaZ: -1, sourceFrame: 4 },
      { label: 'up-left', deltaX: -1, deltaZ: 0, sourceFrame: 3 },
      { label: 'left', deltaX: -1, deltaZ: 1, sourceFrame: 2 },
      { label: 'down-left', deltaX: 0, deltaZ: 1, sourceFrame: 1 },
    ] as const;

    for (const { label, deltaX, deltaZ, sourceFrame } of cases) {
      const heading = headingForWorldDelta(deltaX, deltaZ);
      const viewFrame = impostorFrameForHeading(heading);
      expect(
        remapImpostorFrame(viewFrame, SCREEN_FACING_TURNAROUND_FRAME_REMAP),
        label,
      ).toBe(sourceFrame);
    }
  });

  it('keeps the current frame briefly past a sector boundary to avoid chatter', () => {
    expect(impostorFrameForHeading(70)).toBe(1);
    expect(stableImpostorFrameForHeading(70, 0)).toBe(0);
    expect(stableImpostorFrameForHeading(75, 0)).toBe(1);

    expect(impostorFrameForHeading(20)).toBe(7);
    expect(stableImpostorFrameForHeading(20, 0)).toBe(0);
    expect(stableImpostorFrameForHeading(10, 0)).toBe(7);
    expect(stableImpostorFrameForHeading(90, -1)).toBe(1);
  });

  it('maps frames into the legacy 4x2 atlas without leaving the texture', () => {
    expect(impostorAtlasOffset(0)).toEqual([0, 0.5]);
    expect(impostorAtlasOffset(3)).toEqual([0.75, 0.5]);
    expect(impostorAtlasOffset(4)).toEqual([0, 0]);
    expect(impostorAtlasOffset(7)).toEqual([0.75, 0]);
    expect(impostorAtlasOffset(8)).toEqual([0, 0.5]);
  });
});
