import type { BuildingType } from '../simulation/m03-content';

export type BuildingVisualPrimitive = 'box' | 'cylinder' | 'sphere';
export type BuildingVisualMaterialRole = 'TEAM' | 'ACCENT';

export interface BuildingVisualPart {
  primitive: BuildingVisualPrimitive;
  material: BuildingVisualMaterialRole;
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
}

export interface BuildingVisualProfile {
  footprint: number;
  height: number;
  parts: readonly BuildingVisualPart[];
}

export const BUILDING_VISUAL_PROFILES: Readonly<Record<BuildingType, BuildingVisualProfile>> = {
  ELEMENTAL_CORE: {
    footprint: 3.6,
    height: 4.2,
    parts: [
      { primitive: 'cylinder', material: 'TEAM', position: [0, 0.62, 0], scale: [3.5, 1.1, 3.5] },
      { primitive: 'cylinder', material: 'TEAM', position: [0, 1.68, 0], scale: [2.35, 1.7, 2.35] },
      { primitive: 'sphere', material: 'ACCENT', position: [0, 3.05, 0], scale: [1.18, 1.38, 1.18] },
      { primitive: 'box', material: 'ACCENT', position: [2.15, 1.2, 0], scale: [0.34, 1.9, 0.34] },
      { primitive: 'box', material: 'ACCENT', position: [-2.15, 1.2, 0], scale: [0.34, 1.9, 0.34] },
      { primitive: 'box', material: 'ACCENT', position: [0, 1.2, 2.15], scale: [0.34, 1.9, 0.34] },
      { primitive: 'box', material: 'ACCENT', position: [0, 1.2, -2.15], scale: [0.34, 1.9, 0.34] },
    ],
  },
  BARRACKS: {
    footprint: 2.7,
    height: 2.1,
    parts: [
      { primitive: 'box', material: 'TEAM', position: [0, 0.72, 0], scale: [2.8, 1.3, 2.3] },
      { primitive: 'box', material: 'ACCENT', position: [-1.05, 1.52, 0.35], scale: [0.48, 0.9, 0.48] },
      { primitive: 'box', material: 'ACCENT', position: [1.05, 1.52, 0.35], scale: [0.48, 0.9, 0.48] },
      { primitive: 'box', material: 'ACCENT', position: [0, 0.64, 1.28], scale: [1.18, 0.7, 0.28] },
    ],
  },
  ARCANE_TOWER: {
    footprint: 2.1,
    height: 3.8,
    parts: [
      { primitive: 'cylinder', material: 'TEAM', position: [0, 1.25, 0], scale: [1.7, 2.5, 1.7] },
      { primitive: 'cylinder', material: 'ACCENT', position: [0, 2.4, 0], scale: [1.05, 0.32, 1.05] },
      { primitive: 'sphere', material: 'ACCENT', position: [0, 3.2, 0], scale: [0.7, 0.7, 0.7] },
    ],
  },
  WORKSHOP: {
    footprint: 3.0,
    height: 2.6,
    parts: [
      { primitive: 'box', material: 'TEAM', position: [0, 0.76, 0], scale: [3.25, 1.42, 2.7] },
      { primitive: 'box', material: 'ACCENT', position: [0, 1.56, -0.55], scale: [1.85, 0.46, 1.0] },
      { primitive: 'cylinder', material: 'ACCENT', position: [-1.08, 1.85, 0.5], scale: [0.35, 1.25, 0.35] },
      { primitive: 'cylinder', material: 'ACCENT', position: [1.08, 1.85, 0.5], scale: [0.35, 1.25, 0.35] },
    ],
  },
  OUTPOST: {
    footprint: 2.2,
    height: 3.1,
    parts: [
      { primitive: 'cylinder', material: 'TEAM', position: [0, 0.62, 0], scale: [2.2, 1.05, 2.2] },
      { primitive: 'box', material: 'TEAM', position: [0, 1.7, 0], scale: [0.55, 1.75, 0.55] },
      { primitive: 'sphere', material: 'ACCENT', position: [0, 2.72, 0], scale: [0.54, 0.54, 0.54] },
    ],
  },
  EXTRACTOR: {
    footprint: 1.8,
    height: 1.8,
    parts: [
      { primitive: 'cylinder', material: 'TEAM', position: [0, 0.48, 0], scale: [1.72, 0.78, 1.72] },
      { primitive: 'cylinder', material: 'ACCENT', position: [0, 1.02, 0], scale: [0.76, 0.72, 0.76] },
      { primitive: 'box', material: 'ACCENT', position: [0.86, 0.72, 0], scale: [0.82, 0.18, 0.18] },
      { primitive: 'box', material: 'ACCENT', position: [-0.86, 0.72, 0], scale: [0.82, 0.18, 0.18] },
    ],
  },
  MANA_WELL: {
    footprint: 1.8,
    height: 2.0,
    parts: [
      { primitive: 'cylinder', material: 'TEAM', position: [0, 0.34, 0], scale: [1.75, 0.5, 1.75] },
      { primitive: 'cylinder', material: 'ACCENT', position: [0, 0.78, 0], scale: [1.08, 0.4, 1.08] },
      { primitive: 'sphere', material: 'ACCENT', position: [0, 1.48, 0], scale: [0.68, 0.68, 0.68] },
      { primitive: 'box', material: 'TEAM', position: [0, 1.0, 0], scale: [0.24, 1.1, 0.24] },
    ],
  },
};

export function buildingVisualProfile(type: BuildingType): BuildingVisualProfile {
  return BUILDING_VISUAL_PROFILES[type];
}
