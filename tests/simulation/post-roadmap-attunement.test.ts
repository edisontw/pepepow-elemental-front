import { describe, expect, it } from 'vitest';
import { AttunementState } from '../../src/simulation/attunement-state';

describe('post-roadmap Attunement authority', () => {
  it('requires exactly two distinct starting elements and canonicalizes unlocks', () => {
    expect(() => new AttunementState({ 0: ['FIRE', 'FIRE'] })).toThrow(/two distinct/i);
    const state = new AttunementState({
      0: ['WATER', 'FIRE'],
      1: ['ICE', 'LIGHTNING'],
    });
    expect(state.starting(0)).toEqual(['WATER', 'FIRE']);
    expect(state.unlocked(0)).toEqual(['FIRE', 'WATER']);
    expect(state.has(0, 'ICE')).toBe(false);
  });

  it('allows a normal third Attunement but gates the fourth behind an exceptional unlock', () => {
    const state = new AttunementState({ 0: ['FIRE', 'WATER'] });
    expect(state.unlock(0, 'ICE')).toBe(true);
    expect(state.unlock(0, 'LIGHTNING')).toBe(false);
    expect(state.unlock(0, 'LIGHTNING', true)).toBe(true);
    expect(state.unlocked(0)).toEqual(['FIRE', 'WATER', 'ICE', 'LIGHTNING']);
  });

  it('requires every elemental tag on mixed upgrades to be Attuned', () => {
    const state = new AttunementState({ 0: ['WATER', 'LIGHTNING'] });
    expect(state.isUpgradeEligible(0, ['WATER'])).toBe(true);
    expect(state.isUpgradeEligible(0, ['WATER', 'LIGHTNING', 'MIXED'])).toBe(true);
    expect(state.isUpgradeEligible(0, ['FIRE', 'WATER', 'MIXED'])).toBe(false);
  });
});
