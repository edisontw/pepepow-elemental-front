import { describe, expect, it } from 'vitest';
import {
  BUILDING_IMPOSTOR_ASSET_REVISION,
  BUILDING_IMPOSTOR_CONFIGS,
  buildingImpostorConfig,
  buildingImpostorFile,
} from '../../src/rendering/building-impostor-assets';

const EXPECTED_ASSET_IDS = [
  'building.elemental-core.debug',
  'building.barracks',
  'building.arcane-tower',
  'building.workshop',
  'building.outpost',
  'building.extractor',
  'building.mana-well',
] as const;

describe('building impostor assets', () => {
  it('defines one static WebP presentation for every canonical building', () => {
    expect(BUILDING_IMPOSTOR_ASSET_REVISION.length).toBeGreaterThan(0);
    expect(BUILDING_IMPOSTOR_CONFIGS.map((config) => config.assetId)).toEqual(EXPECTED_ASSET_IDS);

    for (const config of BUILDING_IMPOSTOR_CONFIGS) {
      expect(buildingImpostorConfig(config.assetId)).toBe(config);
      expect(buildingImpostorFile(config)).toBe(
        `assets/buildings/${config.slug}/building.webp?v=${encodeURIComponent(BUILDING_IMPOSTOR_ASSET_REVISION)}`,
      );
      expect(config.planeSize).toBeGreaterThan(0);
      expect(config.shadowX).toBeGreaterThan(0);
      expect(config.shadowZ).toBeGreaterThan(0);
    }
  });

  it('keeps Elemental Core as the largest first-pass presentation anchor', () => {
    const core = buildingImpostorConfig('building.elemental-core.debug');
    expect(core).toBeDefined();
    expect(core!.planeSize).toBe(Math.max(...BUILDING_IMPOSTOR_CONFIGS.map((config) => config.planeSize)));
  });
});
