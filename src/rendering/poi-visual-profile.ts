import type { PoiType } from '../world/world-definition';

export type PoiOwnershipState = 'NEUTRAL' | 'PLAYER' | 'ENEMY';
export type PoiPrimitive = 'box' | 'cylinder' | 'sphere';

export interface PoiVisualProfile {
  label: string;
  minimapGlyph: 'STAR' | 'TRIANGLE' | 'SQUARE' | 'DIAMOND';
  landmark: readonly {
    primitive: PoiPrimitive;
    y: number;
    scale: readonly [number, number, number];
  }[];
}

export const POI_VISUAL_PROFILES: Readonly<Record<PoiType, PoiVisualProfile>> = {
  SHRINE: {
    label: 'Shrine',
    minimapGlyph: 'STAR',
    landmark: [
      { primitive: 'cylinder', y: 0.18, scale: [0.82, 0.22, 0.82] },
      { primitive: 'box', y: 0.82, scale: [0.3, 1.08, 0.3] },
      { primitive: 'sphere', y: 1.48, scale: [0.32, 0.32, 0.32] },
    ],
  },
  NEUTRAL_CAMP: {
    label: 'Neutral Camp',
    minimapGlyph: 'TRIANGLE',
    landmark: [
      { primitive: 'cylinder', y: 0.12, scale: [0.9, 0.16, 0.9] },
      { primitive: 'box', y: 0.58, scale: [0.86, 0.72, 0.66] },
      { primitive: 'cylinder', y: 1.18, scale: [0.08, 0.9, 0.08] },
    ],
  },
  VILLAGE: {
    label: 'Village',
    minimapGlyph: 'SQUARE',
    landmark: [
      { primitive: 'box', y: 0.34, scale: [0.72, 0.6, 0.64] },
      { primitive: 'box', y: 0.46, scale: [0.48, 0.82, 0.48] },
      { primitive: 'cylinder', y: 1.05, scale: [0.09, 0.75, 0.09] },
    ],
  },
  ANCIENT_RUIN: {
    label: 'Ancient Ruin',
    minimapGlyph: 'DIAMOND',
    landmark: [
      { primitive: 'cylinder', y: 0.1, scale: [0.96, 0.14, 0.96] },
      { primitive: 'box', y: 0.72, scale: [0.22, 1.25, 0.22] },
      { primitive: 'box', y: 0.72, scale: [0.22, 1.25, 0.22] },
    ],
  },
};

export function poiVisualProfile(type: PoiType): PoiVisualProfile {
  return POI_VISUAL_PROFILES[type];
}

export function poiOwnershipState(owner: number | undefined, playerId = 0): PoiOwnershipState {
  if (owner === playerId) return 'PLAYER';
  if (owner !== undefined && owner >= 0 && owner !== 255) return 'ENEMY';
  return 'NEUTRAL';
}
