import { describe, expect, it } from 'vitest';
import {
  POI_VISUAL_PROFILES,
  poiOwnershipState,
  poiVisualProfile,
} from '../../src/rendering/poi-visual-profile';
import type { PoiType } from '../../src/world/world-definition';

const POI_TYPES: readonly PoiType[] = ['SHRINE', 'NEUTRAL_CAMP', 'VILLAGE', 'ANCIENT_RUIN'];

describe('M08 POI readability correction', () => {
  it('gives every POI type a distinct player-facing label, minimap glyph, and composite landmark', () => {
    expect(Object.keys(POI_VISUAL_PROFILES).sort()).toEqual([...POI_TYPES].sort());
    expect(new Set(POI_TYPES.map((type) => poiVisualProfile(type).minimapGlyph)).size).toBe(POI_TYPES.length);
    for (const type of POI_TYPES) {
      const profile = poiVisualProfile(type);
      expect(profile.label.length).toBeGreaterThan(0);
      expect(profile.landmark.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('maps unclaimed, player-controlled, and enemy-controlled POIs to explicit ownership states', () => {
    expect(poiOwnershipState(undefined)).toBe('NEUTRAL');
    expect(poiOwnershipState(255)).toBe('NEUTRAL');
    expect(poiOwnershipState(0)).toBe('PLAYER');
    expect(poiOwnershipState(1)).toBe('ENEMY');
  });
});
