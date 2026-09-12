import { describe, expect, it } from 'vitest';
import { resolvePresentationFacing } from '../../src/rendering/unit-facing';

describe('unit presentation facing priority', () => {
  it('keeps travel-facing ahead of combat-facing while moving', () => {
    expect(resolvePresentationFacing(0, 180, 90)).toEqual({
      yawDegrees: 0,
      baseYawDegrees: 0,
    });
  });

  it('uses combat-facing when stationary', () => {
    expect(resolvePresentationFacing(null, 180, 90)).toEqual({
      yawDegrees: 180,
      baseYawDegrees: 180,
    });
  });

  it('keeps the last base-facing when neither movement nor combat supplies a direction', () => {
    expect(resolvePresentationFacing(null, null, 90)).toEqual({
      yawDegrees: 90,
      baseYawDegrees: 90,
    });
  });
});
