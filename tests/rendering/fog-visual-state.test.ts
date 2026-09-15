import { describe, expect, it } from 'vitest';
import { VisibilityLevel } from '../../src/simulation/visibility-state';
import { FOG_ALPHA, fogAlphaForLevel, fogCornerAlpha, visibilityFingerprint } from '../../src/rendering/fog-visual-state';

describe('fog-of-war presentation state', () => {
  it('keeps the authoritative three states visually distinct', () => {
    expect(fogAlphaForLevel(VisibilityLevel.VISIBLE)).toBe(FOG_ALPHA.visible);
    expect(fogAlphaForLevel(VisibilityLevel.EXPLORED)).toBe(FOG_ALPHA.explored);
    expect(fogAlphaForLevel(VisibilityLevel.UNEXPLORED)).toBe(FOG_ALPHA.unexplored);
    expect(FOG_ALPHA.unexplored).toBeGreaterThan(FOG_ALPHA.explored);
    expect(FOG_ALPHA.explored).toBeGreaterThan(FOG_ALPHA.visible);
  });

  it('feathers boundaries by averaging cells around each mesh corner', () => {
    const cells = Uint8Array.from([
      VisibilityLevel.VISIBLE, VisibilityLevel.VISIBLE,
      VisibilityLevel.UNEXPLORED, VisibilityLevel.UNEXPLORED,
    ]);
    const alpha = fogCornerAlpha(cells, 2, 2, 1, 1);
    expect(alpha).toBeGreaterThan(FOG_ALPHA.visible);
    expect(alpha).toBeLessThan(FOG_ALPHA.unexplored);
  });

  it('only refreshes when authoritative visibility values change', () => {
    const first = Uint8Array.from([0, 1, 2, 0]);
    const same = Uint8Array.from(first);
    const changed = Uint8Array.from([0, 1, 2, 1]);
    expect(visibilityFingerprint(same)).toBe(visibilityFingerprint(first));
    expect(visibilityFingerprint(changed)).not.toBe(visibilityFingerprint(first));
  });
});
