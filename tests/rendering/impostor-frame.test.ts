import { describe, expect, it } from 'vitest';
import { impostorAtlasOffset, impostorFrameForHeading } from '../../src/rendering/impostor-frame';

describe('impostor frame mapping', () => {
  it('maps the fixed 45 degree RTS camera into unit-local view directions', () => {
    expect(impostorFrameForHeading(45)).toBe(0);   // front
    expect(impostorFrameForHeading(90)).toBe(1);  // front-left
    expect(impostorFrameForHeading(135)).toBe(2); // left
    expect(impostorFrameForHeading(180)).toBe(3); // rear-left
    expect(impostorFrameForHeading(225)).toBe(4); // rear
    expect(impostorFrameForHeading(-90)).toBe(5); // rear-right
    expect(impostorFrameForHeading(-45)).toBe(6); // right
    expect(impostorFrameForHeading(0)).toBe(7);   // front-right
    expect(impostorFrameForHeading(405)).toBe(0);
  });

  it('maps frames into the legacy 4x2 atlas without leaving the texture', () => {
    expect(impostorAtlasOffset(0)).toEqual([0, 0.5]);
    expect(impostorAtlasOffset(3)).toEqual([0.75, 0.5]);
    expect(impostorAtlasOffset(4)).toEqual([0, 0]);
    expect(impostorAtlasOffset(7)).toEqual([0.75, 0]);
    expect(impostorAtlasOffset(8)).toEqual([0, 0.5]);
  });
});
