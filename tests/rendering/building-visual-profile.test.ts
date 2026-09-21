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
  'MANA_WELL',
];

describe('M08 building visual profiles', () => {
  it('covers every strategic building type with a readable composite profile', () => {
    expect(Object.keys(BUILDING_VISUAL_PROFILES).sort()).toEqual([...BUILDING_TYPES].sort());
    for (const type of BUILDING_TYPES) {
      const profile = BUILDING_VISUAL_PROFILES[type];
      expect(profile.parts.length).toBeGreaterThanOrEqual(3);
      expect(profile.footprint).toBeGreaterThan(0);
      expect(profile.height).toBeGreaterThan(0);
      expect(profile.marker.length).toBeGreaterThan(0);
      expect(profile.parts.some((part) => part.material === 'ACCENT')).toBe(true);
    }
  });

  it('uses distinct in-world identity motifs instead of UI codes', () => {
    const markers = BUILDING_TYPES.map((type) => BUILDING_VISUAL_PROFILES[type].marker);
    expect(new Set(markers).size).toBe(BUILDING_TYPES.length);
    expect(BUILDING_VISUAL_PROFILES.BARRACKS.marker).toBe('GATE');
    expect(BUILDING_VISUAL_PROFILES.ARCANE_TOWER.marker).toBe('ORB');
    expect(BUILDING_VISUAL_PROFILES.WORKSHOP.marker).toBe('TOOLS');
    expect(BUILDING_VISUAL_PROFILES.EXTRACTOR.marker).toBe('PUMP');
    expect(BUILDING_VISUAL_PROFILES.MANA_WELL.marker).toBe('WELL');
  });

  it('gives the Elemental Core the strongest scale hierarchy', () => {
    const core = BUILDING_VISUAL_PROFILES.ELEMENTAL_CORE;
    expect(core.height).toBeGreaterThan(BUILDING_VISUAL_PROFILES.OUTPOST.height);
    expect(core.footprint).toBeGreaterThan(BUILDING_VISUAL_PROFILES.WORKSHOP.footprint);
  });
});
