import { describe, expect, it } from 'vitest';
import { resourcePulseScale } from '../../src/rendering/resource-render-bridge';

describe('resource pulse presentation', () => {
  it.each([false, true])('stays flat and inside a single-cell footprint (rich=%s)', (rich) => {
    for (const tick of [0, 10, 100, 1000]) {
      const scale = resourcePulseScale(rich, tick, 0);
      expect(scale[1]).toBe(0.018);
      expect(scale[0]).toBe(scale[2]);
      expect(scale[0]).toBeLessThanOrEqual(0.9);
      expect(scale[0]).toBeGreaterThan(0.5);
    }
  });
});
