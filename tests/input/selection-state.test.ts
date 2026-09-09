import { describe, expect, it } from 'vitest';
import { SelectionState } from '../../src/input/selection-state';
import { formatSelectedUnitState } from '../../src/ui/debug-overlay';
import type { EntitySnapshot } from '../../src/simulation/simulation';

describe('M01 selection and control groups', () => {
  it('replaces, adds, and toggles a normalized deterministic selection', () => {
    const selection = new SelectionState();
    selection.select([4, 2, 2], 'REPLACE');
    expect(selection.ids).toEqual([2, 4]);

    selection.select([3, 1], 'ADD');
    expect(selection.ids).toEqual([1, 2, 3, 4]);

    selection.select([2, 5], 'TOGGLE');
    expect(selection.ids).toEqual([1, 3, 4, 5]);
  });

  it('assigns and recalls control groups while filtering ineligible units', () => {
    const selection = new SelectionState();
    selection.select([4, 1, 3], 'REPLACE');
    selection.assignControlGroup(2);
    selection.select([9], 'REPLACE');

    expect(selection.recallControlGroup(2, (entityId) => entityId !== 3)).toBe(true);
    expect(selection.ids).toEqual([1, 4]);
  });

  it('supports control group zero alongside one through nine', () => {
    const selection = new SelectionState();
    selection.select([7, 2], 'REPLACE');
    selection.assignControlGroup(0);
    selection.select([9], 'REPLACE');
    expect(selection.recallControlGroup(0, () => true)).toBe(true);
    expect(selection.ids).toEqual([2, 7]);
  });

  it('leaves selection unchanged for an unassigned group and prunes dead units', () => {
    const selection = new SelectionState();
    selection.select([1, 2, 3], 'REPLACE');

    expect(selection.recallControlGroup(7, () => true)).toBe(false);
    expect(selection.ids).toEqual([1, 2, 3]);
    expect(selection.prune((entityId) => entityId !== 2)).toBe(true);
    expect(selection.ids).toEqual([1, 3]);
    expect(selection.prune(() => true)).toBe(false);
  });

  it('rejects invalid control-group slots', () => {
    const selection = new SelectionState();
    expect(() => selection.assignControlGroup(-1)).toThrow(/0 to 9/);
    expect(() => selection.recallControlGroup(10, () => true)).toThrow(/0 to 9/);
  });

  it('formats selected unit health, order, and status for the debug overlay', () => {
    const unit = {
      id: 3, archetype: 'ELEMENTALIST', currentHealth: 70, maxHealth: 100,
      attackTargetEntityId: 8, targetX: null, targetZ: null, wet: true,
      chilledTicks: 0, frozenTicks: 2,
    } as EntitySnapshot;
    expect(formatSelectedUnitState([unit])).toBe('#3 ELEMENTALIST 70/100HP ATTACK#8 WET FROZEN');
    expect(formatSelectedUnitState([])).toBe('NONE');
  });
});
