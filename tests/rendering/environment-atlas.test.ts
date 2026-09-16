import { describe, expect, it } from 'vitest';
import { environmentAtlasUv } from '../../src/rendering/environment-atlas';

describe('top-left environment atlas contract (unflipped upload)', () => {
  it('selects meadow from the top row and road dirt from the bottom row', () => {
    expect(environmentAtlasUv(0, 4, 2, 0.5, 0.5)).toEqual([0.125, 0.25]);
    expect(environmentAtlasUv(4, 4, 2, 0.5, 0.5)).toEqual([0.125, 0.75]);
  });
  it('selects wildflowers rather than the grave-marker row', () => {
    const flowers = environmentAtlasUv(10, 4, 3, 0.5, 0.5);
    const cross = environmentAtlasUv(2, 4, 3, 0.5, 0.5);
    expect(flowers[0]).toBe(0.625);
    expect(flowers[1]).toBeCloseTo(5 / 6);
    expect(cross[1]).toBeCloseTo(1 / 6);
  });
  it('pins tall-fir apex above its trunk without changing frames when mirrored', () => {
    const apex = environmentAtlasUv(0, 3, 2, 0.5, 0);
    const base = environmentAtlasUv(0, 3, 2, 0.5, 1);
    expect(apex[1]).toBeCloseTo(0.004);
    expect(base[1]).toBeCloseTo(0.496);
    const left = environmentAtlasUv(0, 3, 2, 0, 1);
    const right = environmentAtlasUv(0, 3, 2, 1, 1);
    expect(left[1]).toBe(right[1]);
    expect(left[0]).toBeLessThan(right[0]);
  });
});
