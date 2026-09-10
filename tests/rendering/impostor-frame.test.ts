import { describe, expect, it } from 'vitest';
import { impostorAtlasOffset, impostorFrameForHeading } from '../../src/rendering/impostor-frame';

describe('impostor frame mapping', () => {
  it('maps the fixed 45 degree RTS camera around eight headings', () => {
    expect(impostorFrameForHeading(45)).toBe(0);
    expect(impostorFrameForHeading(0)).toBe(1);
    expect(impostorFrameForHeading(-45)).toBe(2);
    expect(impostorFrameForHeading(180)).toBe(5);
    expect(impostorFrameForHeading(405)).toBe(0);
  });

  it('maps frames into the 4x2 atlas without leaving the texture', () => {
    expect(impostorAtlasOffset(0)).toEqual([0, 0.5]);
    expect(impostorAtlasOffset(3)).toEqual([0.75, 0.5]);
    expect(impostorAtlasOffset(4)).toEqual([0, 0]);
    expect(impostorAtlasOffset(7)).toEqual([0.75, 0]);
    expect(impostorAtlasOffset(8)).toEqual([0, 0.5]);
  });
});
