import { describe, expect, it } from 'vitest';
import type { EntitySnapshot } from '../../src/simulation/simulation';
import { presentationAttackTargetId } from '../../src/rendering/combat-event-resolution';

function unit(nextAttackTick: number, attackTargetEntityId: number | null): EntitySnapshot {
  return { nextAttackTick, attackTargetEntityId } as EntitySnapshot;
}

describe('combat presentation attack target resolution', () => {
  it('uses the current target for a normal completed attack', () => {
    expect(presentationAttackTargetId(unit(2, 7), unit(8, 7))).toBe(7);
  });

  it('falls back to the prior target when a killing blow clears it during cleanup', () => {
    expect(presentationAttackTargetId(unit(2, 7), unit(8, null))).toBe(7);
  });

  it('does not invent an attack event when the authoritative attack cadence did not advance', () => {
    expect(presentationAttackTargetId(unit(8, 7), unit(8, null))).toBeNull();
  });
});
