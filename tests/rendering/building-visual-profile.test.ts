import { describe, expect, it } from 'vitest';
import type { BuildingType } from '../../src/simulation/m03-content';
import { BUILDING_VISUAL_PROFILES } from '../../src/rendering/building-visual-profile';

const BUILDING_TYPES: readonly BuildingType[] = [
  'ELEMENTAL_CORE',
  'BARRACKS',
  'ARCANE_TOWER',
  'WORKSHOP',
  'OUTPOST',
  'EXTRACTOR',
];

describe('M08 building visual profiles', () => {
  it('covers every strategic building type with a readable composite profile', () => {
    expect(Object.keys(BUILDING_VISUAL_PROFILES).sort()).toEqual([...BUILDING_TYPES].sort());
    for (const type of BUILDING_TYPES) {
      const profile = BUILDING_VISUAL_PROFILES[type];
      expect(profile.parts.length).toBeGreaterThanOrEqual(3);
      expect(profile.footprint).toBeGreaterThan(0);
      expect(profile.height).toBeGreaterThan(0);
      expect(profile.parts.some((part) => part.material === 'ACCENT')).toBe(true);
    }
  });

  it('gives the Elemental Core the strongest scale hierarchy', () => {
    const core = BUILDING_VISUAL_PROFILES.ELEMENTAL_CORE;
    expect(core.height).toBeGreaterThan(BUILDING_VISUAL_PROFILES.OUTPOST.height);
    expect(core.footprint).toBeGreaterThan(BUILDING_VISUAL_PROFILES.WORKSHOP.footprint);
  });
});
