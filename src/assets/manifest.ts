export type AssetStatus =
  | 'PLACEHOLDER'
  | 'DEV_GENERATED'
  | 'NEEDS_MANUAL_GENERATION'
  | 'FINAL';

export interface AssetManifestEntry {
  id: string;
  kind: 'model' | 'texture' | 'vfx' | 'ui' | 'image';
  status: AssetStatus;
  path: string;
  canonicalFilename: string;
  aspectRatio?: string;
  promptRef?: string;
  license?: string;
  provenance?: string;
  notes?: string;
}

export interface AudioManifestEntry {
  id: string;
  kind: 'sfx' | 'music';
  status: AssetStatus;
  path: string;
  canonicalFilename: string;
  license?: string;
  sourceUrl?: string;
  attribution?: string;
  loop?: boolean;
  notes?: string;
}
