export interface BuildingImpostorConfig {
  assetId: string;
  slug: string;
  label: string;
  planeSize: number;
  shadowX: number;
  shadowZ: number;
}

/**
 * Bump whenever approved building WebP binaries change in-place. Public paths
 * stay stable, so the query revision prevents stale browser/CDN art.
 */
export const BUILDING_IMPOSTOR_ASSET_REVISION = '20260913-building-impostor-v2';

const CONFIGS = [
  {
    assetId: 'building.elemental-core.debug',
    slug: 'elemental-core',
    label: 'Elemental Core',
    planeSize: 5.0,
    shadowX: 3.3,
    shadowZ: 2.25,
  },
  {
    assetId: 'building.barracks',
    slug: 'barracks',
    label: 'Barracks',
    planeSize: 4.05,
    shadowX: 2.7,
    shadowZ: 1.85,
  },
  {
    assetId: 'building.arcane-tower',
    slug: 'arcane-tower',
    label: 'Arcane Tower',
    planeSize: 4.9,
    shadowX: 1.9,
    shadowZ: 1.4,
  },
  {
    assetId: 'building.workshop',
    slug: 'workshop',
    label: 'Workshop',
    planeSize: 4.35,
    shadowX: 3.05,
    shadowZ: 2.1,
  },
  {
    assetId: 'building.outpost',
    slug: 'outpost',
    label: 'Outpost',
    planeSize: 4.25,
    shadowX: 1.9,
    shadowZ: 1.3,
  },
  {
    assetId: 'building.extractor',
    slug: 'extractor',
    label: 'Extractor',
    planeSize: 3.65,
    shadowX: 1.85,
    shadowZ: 1.3,
  },
  {
    assetId: 'building.mana-well',
    slug: 'mana-well',
    label: 'Mana Well',
    planeSize: 3.8,
    shadowX: 1.8,
    shadowZ: 1.3,
  },
] as const satisfies readonly BuildingImpostorConfig[];

const BY_ASSET_ID = new Map<string, BuildingImpostorConfig>(
  CONFIGS.map((config) => [config.assetId, config]),
);

export const BUILDING_IMPOSTOR_CONFIGS: readonly BuildingImpostorConfig[] = CONFIGS;

export function buildingImpostorConfig(assetId: string): BuildingImpostorConfig | undefined {
  return BY_ASSET_ID.get(assetId);
}

export function buildingImpostorFile(config: BuildingImpostorConfig): string {
  return `assets/buildings/${config.slug}/building.webp?v=${encodeURIComponent(BUILDING_IMPOSTOR_ASSET_REVISION)}`;
}
