import { describe, expect, it } from 'vitest';
import {
  IMPOSTOR_UNIT_VIEW_LABELS,
  impostorAtlasOffset,
  impostorFrameForHeading,
  RTS_CAMERA_YAW_DEGREES,
  stableImpostorFrameForHeading,
} from '../../src/rendering/impostor-frame';
import {
  FRONT_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER,
  IDENTITY_IMPOSTOR_FRAME_REMAP,
  SCREEN_FACING_TURNAROUND_FRAME_REMAP,
  impostorRuntimeFileOrderForSlug,
  remapImpostorFrame,
} from '../../src/rendering/impostor-frame-assets';

function headingForWorldDelta(deltaX: number, deltaZ: number): number {
  // Matches UnitRenderBridge: world +Z is heading 0, +X is +90 degrees.
  return Math.atan2(deltaX, deltaZ) * 180 / Math.PI;
}

describe('impostor frame mapping', () => {
  it('shares the fixed RTS camera yaw used by camera and impostor presentation', () => {
    expect(RTS_CAMERA_YAW_DEGREES).toBe(45);
  });

  it('locks left and right to unit-relative canonical observer views', () => {
    expect(IMPOSTOR_UNIT_VIEW_LABELS).toEqual([
      'Front',
      'Front-Left',
      'Left',
      'Rear-Left',
      'Rear',
      'Rear-Right',
      'Right',
      'Front-Right',
    ]);
  });

  it('maps the fixed 45 degree RTS camera into unit-relative observer views', () => {
    expect(impostorFrameForHeading(45)).toBe(0);   // unit front
    expect(impostorFrameForHeading(90)).toBe(1);  // unit front-left
    expect(impostorFrameForHeading(135)).toBe(2); // unit left
    expect(impostorFrameForHeading(180)).toBe(3); // unit rear-left
    expect(impostorFrameForHeading(225)).toBe(4); // unit rear
    expect(impostorFrameForHeading(-90)).toBe(5); // unit rear-right
    expect(impostorFrameForHeading(-45)).toBe(6); // unit right
    expect(impostorFrameForHeading(0)).toBe(7);   // unit front-right
    expect(impostorFrameForHeading(405)).toBe(0);
  });

  it('keeps canonical observer-side source progression unchanged', () => {
    const expected = [0, 1, 2, 3, 4, 5, 6, 7] as const;
    for (let frame = 0; frame < 8; frame += 1) {
      expect(remapImpostorFrame(frame, SCREEN_FACING_TURNAROUND_FRAME_REMAP)).toBe(expected[frame]);
    }
  });

  it('calibrates only Vanguard front diagonals from manual WebGL QA', () => {
    expect(impostorRuntimeFileOrderForSlug('vanguard')).toEqual(FRONT_DIAGONAL_SWAP_IMPOSTOR_FILE_ORDER);
    expect(impostorRuntimeFileOrderForSlug('ranger')).toEqual(IDENTITY_IMPOSTOR_FRAME_REMAP);
    expect(impostorRuntimeFileOrderForSlug('elementalist-fire')).toEqual(IDENTITY_IMPOSTOR_FRAME_REMAP);
  });

  it('maps all eight world movement vectors to the matching unit-relative source view', () => {
    const cases = [
      { view: 'Front', deltaX: 1, deltaZ: 1, sourceFrame: 0 },
      { view: 'Front-Left', deltaX: 1, deltaZ: 0, sourceFrame: 1 },
      { view: 'Left', deltaX: 1, deltaZ: -1, sourceFrame: 2 },
      { view: 'Rear-Left', deltaX: 0, deltaZ: -1, sourceFrame: 3 },
      { view: 'Rear', deltaX: -1, deltaZ: -1, sourceFrame: 4 },
      { view: 'Rear-Right', deltaX: -1, deltaZ: 0, sourceFrame: 5 },
      { view: 'Right', deltaX: -1, deltaZ: 1, sourceFrame: 6 },
      { view: 'Front-Right', deltaX: 0, deltaZ: 1, sourceFrame: 7 },
    ] as const;

    for (const { view, deltaX, deltaZ, sourceFrame } of cases) {
      const heading = headingForWorldDelta(deltaX, deltaZ);
      const viewFrame = impostorFrameForHeading(heading);
      expect(
        remapImpostorFrame(viewFrame, SCREEN_FACING_TURNAROUND_FRAME_REMAP),
        view,
      ).toBe(sourceFrame);
      expect(IMPOSTOR_UNIT_VIEW_LABELS[sourceFrame]).toBe(view);
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
