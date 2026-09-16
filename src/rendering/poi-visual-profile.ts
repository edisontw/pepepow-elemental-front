import type { PoiType } from '../world/world-definition';

export type PoiOwnershipState = 'NEUTRAL' | 'PLAYER' | 'ENEMY';
export type PoiPrimitive = 'box' | 'cylinder' | 'sphere';

export interface PoiVisualProfile {
  label: string;
  minimapGlyph: 'STAR' | 'TRIANGLE' | 'SQUARE' | 'DIAMOND';
  landmark: readonly {
    primitive: PoiPrimitive;
    position: readonly [number, number, number];
    scale: readonly [number, number, number];
  }[];
}

export const POI_VISUAL_PROFILES: Readonly<Record<PoiType, PoiVisualProfile>> = {
  SHRINE: {
    label: 'Shrine',
    minimapGlyph: 'STAR',
    landmark: [
      { primitive: 'cylinder', position: [0, 0.1, 0], scale: [1.14, 0.12, 1.14] },
      { primitive: 'cylinder', position: [0, 0.22, 0], scale: [0.88, 0.12, 0.88] },
      { primitive: 'box', position: [-0.52, 0.78, 0], scale: [0.2, 1.12, 0.26] },
      { primitive: 'box', position: [0.52, 0.78, 0], scale: [0.2, 1.12, 0.26] },
      { primitive: 'box', position: [0, 1.28, 0], scale: [1.22, 0.18, 0.3] },
      { primitive: 'box', position: [0, 0.72, -0.46], scale: [0.72, 0.12, 0.18] },
      { primitive: 'sphere', position: [0, 1.68, 0], scale: [0.32, 0.32, 0.32] },
    ],
  },
  NEUTRAL_CAMP: {
    label: 'Neutral Camp',
    minimapGlyph: 'TRIANGLE',
    landmark: [
      { primitive: 'cylinder', position: [0, 0.09, 0], scale: [1.08, 0.11, 0.92] },
      { primitive: 'box', position: [-0.34, 0.44, 0.08], scale: [0.78, 0.58, 0.66] },
      { primitive: 'box', position: [0.35, 0.34, -0.22], scale: [0.52, 0.38, 0.48] },
      { primitive: 'cylinder', position: [0.61, 0.75, -0.42], scale: [0.075, 1.16, 0.075] },
      { primitive: 'box', position: [0.61, 1.28, -0.42], scale: [0.34, 0.08, 0.18] },
      { primitive: 'cylinder', position: [-0.04, 0.18, 0.62], scale: [0.3, 0.08, 0.3] },
    ],
  },
  VILLAGE: {
    label: 'Village',
    minimapGlyph: 'SQUARE',
    landmark: [
      { primitive: 'cylinder', position: [0, 0.08, 0], scale: [1.18, 0.1, 1.04] },
      { primitive: 'box', position: [-0.5, 0.34, 0.24], scale: [0.64, 0.58, 0.58] },
      { primitive: 'box', position: [0.18, 0.3, 0.4], scale: [0.5, 0.5, 0.46] },
      { primitive: 'box', position: [0.5, 0.42, -0.28], scale: [0.46, 0.74, 0.46] },
      { primitive: 'box', position: [-0.22, 0.26, -0.46], scale: [0.44, 0.42, 0.42] },
      { primitive: 'cylinder', position: [0.08, 1.02, -0.02], scale: [0.085, 0.86, 0.085] },
      { primitive: 'box', position: [0.08, 1.42, -0.02], scale: [0.3, 0.09, 0.22] },
    ],
  },
  ANCIENT_RUIN: {
    label: 'Ancient Ruin',
    minimapGlyph: 'DIAMOND',
    landmark: [
      { primitive: 'cylinder', position: [0, 0.09, 0], scale: [1.12, 0.12, 1.02] },
      { primitive: 'box', position: [-0.5, 0.7, 0], scale: [0.23, 1.22, 0.25] },
      { primitive: 'box', position: [0.5, 0.7, 0], scale: [0.23, 1.22, 0.25] },
      { primitive: 'box', position: [0, 1.2, 0], scale: [1.12, 0.2, 0.28] },
      { primitive: 'box', position: [-0.18, 0.4, -0.48], scale: [0.28, 0.72, 0.22] },
      { primitive: 'box', position: [0.32, 0.18, 0.48], scale: [0.54, 0.24, 0.34] },
      { primitive: 'box', position: [-0.5, 0.12, 0.42], scale: [0.34, 0.18, 0.3] },
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
