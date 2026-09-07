import { describe, expect, it } from 'vitest';
import type { UnitArchetype } from '../../src/simulation/components';
import { UNIT_VISUAL_PROFILES } from '../../src/rendering/unit-visual-profile';

const ARCHETYPES: readonly UnitArchetype[] = [
  'VANGUARD',
  'SPEAR_GUARD',
  'RANGER',
  'SCOUT',
  'ELEMENTALIST',
  'ENGINEER',
  'GOLEM',
  'SIEGE_CONSTRUCT',
];

describe('M08 unit visual profiles', () => {
  it('defines a non-empty presentation profile for every gameplay archetype', () => {
    expect(Object.keys(UNIT_VISUAL_PROFILES).sort()).toEqual([...ARCHETYPES].sort());
    for (const archetype of ARCHETYPES) {
      const profile = UNIT_VISUAL_PROFILES[archetype];
      expect(profile.parts.length).toBeGreaterThan(0);
      expect(profile.height).toBeGreaterThan(0);
      expect(profile.selectionScale).toBeGreaterThan(0);
      for (const part of profile.parts) {
        expect(part.scale.every((axis) => axis > 0)).toBe(true);
      }
    }
  });

  it('keeps role silhouettes meaningfully distinct', () => {
    const signatures = ARCHETYPES.map((archetype) => {
      const profile = UNIT_VISUAL_PROFILES[archetype];
      return profile.parts
        .map((part) => `${part.primitive}:${part.position.join(',')}:${part.scale.join(',')}`)
        .join('|');
    });
    expect(new Set(signatures).size).toBe(ARCHETYPES.length);
  });

  it('marks the established ranged roles for visible projectile feedback', () => {
    expect(UNIT_VISUAL_PROFILES.RANGER.projectile).toBe('BOLT');
    expect(UNIT_VISUAL_PROFILES.ELEMENTALIST.projectile).toBe('ORB');
    expect(UNIT_VISUAL_PROFILES.SIEGE_CONSTRUCT.projectile).toBe('SHELL');
    expect(UNIT_VISUAL_PROFILES.VANGUARD.projectile).toBe('NONE');
    expect(UNIT_VISUAL_PROFILES.SPEAR_GUARD.projectile).toBe('NONE');
    expect(UNIT_VISUAL_PROFILES.GOLEM.projectile).toBe('NONE');
  });
});
