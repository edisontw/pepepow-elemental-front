import { describe, expect, it } from 'vitest';
import {
  isOneShotAnimationState,
  resolveUnitAnimationState,
  unitAnimationProfile,
  type UnitAnimationIntent,
} from '../../src/rendering/unit-animation-profile';

function intent(overrides: Partial<UnitAnimationIntent> = {}): UnitAnimationIntent {
  return {
    tick: 10,
    moving: false,
    frozen: false,
    attack: false,
    cast: false,
    hit: false,
    dead: false,
    ...overrides,
  };
}

describe('unit animation presentation state', () => {
  it('uses deterministic presentation priority', () => {
    expect(resolveUnitAnimationState(intent({ moving: true }))).toBe('MOVE');
    expect(resolveUnitAnimationState(intent({ moving: true, attack: true }))).toBe('ATTACK');
    expect(resolveUnitAnimationState(intent({ attack: true, cast: true }))).toBe('CAST');
    expect(resolveUnitAnimationState(intent({ cast: true, hit: true }))).toBe('HIT');
    expect(resolveUnitAnimationState(intent({ hit: true, dead: true }))).toBe('DEATH');
  });

  it('suppresses locomotion while frozen', () => {
    expect(resolveUnitAnimationState(intent({ moving: true, frozen: true }))).toBe('IDLE');
  });

  it('keeps canonical clip names for Vanguard vertical slice', () => {
    const profile = unitAnimationProfile('unit.vanguard');
    expect(profile.clips.IDLE).toBe('Idle');
    expect(profile.clips.MOVE).toBe('Move');
    expect(profile.clips.ATTACK).toBe('Attack');
    expect(profile.clips.HIT).toBe('Hit');
    expect(profile.clips.DEATH).toBe('Death');
  });

  it('marks action reactions as one-shots only', () => {
    expect(isOneShotAnimationState('ATTACK')).toBe(true);
    expect(isOneShotAnimationState('CAST')).toBe(true);
    expect(isOneShotAnimationState('HIT')).toBe(true);
    expect(isOneShotAnimationState('MOVE')).toBe(false);
    expect(isOneShotAnimationState('DEATH')).toBe(false);
  });
});
