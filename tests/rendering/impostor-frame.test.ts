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

  it('remaps screen-facing AI turnaround labels without corrupting front/rear views', () => {
    expect(remapImpostorFrame(0, SCREEN_FACING_TURNAROUND_FRAME_REMAP)).toBe(0);
    expect(remapImpostorFrame(1, SCREEN_FACING_TURNAROUND_FRAME_REMAP)).toBe(7);
    expect(remapImpostorFrame(2, SCREEN_FACING_TURNAROUND_FRAME_REMAP)).toBe(6);
    expect(remapImpostorFrame(3, SCREEN_FACING_TURNAROUND_FRAME_REMAP)).toBe(5);
    expect(remapImpostorFrame(4, SCREEN_FACING_TURNAROUND_FRAME_REMAP)).toBe(4);
    expect(remapImpostorFrame(5, SCREEN_FACING_TURNAROUND_FRAME_REMAP)).toBe(3);
    expect(remapImpostorFrame(6, SCREEN_FACING_TURNAROUND_FRAME_REMAP)).toBe(2);
    expect(remapImpostorFrame(7, SCREEN_FACING_TURNAROUND_FRAME_REMAP)).toBe(1);
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
