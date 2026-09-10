import { describe, expect, it } from 'vitest';
import { pointToSegmentDistanceSquared } from '../../src/rendering/screen-space-pick';

describe('pointToSegmentDistanceSquared', () => {
  it('treats clicks along the projected unit body as hits', () => {
    expect(pointToSegmentDistanceSquared(100, 70, 100, 120, 100, 20)).toBe(0);
    expect(pointToSegmentDistanceSquared(112, 70, 100, 120, 100, 20)).toBe(144);
  });

  it('uses the nearest endpoint outside the projected body', () => {
    expect(pointToSegmentDistanceSquared(100, 140, 100, 120, 100, 20)).toBe(400);
    expect(pointToSegmentDistanceSquared(100, 0, 100, 120, 100, 20)).toBe(400);
  });

  it('handles a zero-length segment', () => {
    expect(pointToSegmentDistanceSquared(13, 14, 10, 10, 10, 10)).toBe(25);
  });
});
