import type { UnitArchetype } from '../simulation/components';

export type UnitVisualPrimitive = 'box' | 'capsule' | 'cylinder' | 'sphere';
export type UnitVisualMaterialRole = 'TEAM' | 'ACCENT';
export type UnitProjectileStyle = 'NONE' | 'BOLT' | 'ORB' | 'SHELL';

export interface UnitVisualPart {
  primitive: UnitVisualPrimitive;
  material: UnitVisualMaterialRole;
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
}

export interface UnitVisualProfile {
  height: number;
  selectionScale: number;
  projectile: UnitProjectileStyle;
  parts: readonly UnitVisualPart[];
}

export const UNIT_VISUAL_PROFILES: Readonly<Record<UnitArchetype, UnitVisualProfile>> = {
  VANGUARD: {
    height: 1.9,
    selectionScale: 1.2,
    projectile: 'NONE',
    parts: [
      { primitive: 'capsule', material: 'TEAM', position: [0, 0.82, 0], scale: [0.72, 1.16, 0.72] },
      { primitive: 'box', material: 'ACCENT', position: [0.48, 0.82, 0.22], scale: [0.16, 0.82, 0.62] },
    ],
  },
  SPEAR_GUARD: {
    height: 1.82,
    selectionScale: 1.16,
    projectile: 'NONE',
    parts: [
      { primitive: 'capsule', material: 'TEAM', position: [0, 0.86, 0], scale: [0.64, 1.2, 0.64] },
      { primitive: 'box', material: 'ACCENT', position: [-0.4, 0.92, 0.48], scale: [0.1, 0.1, 1.72] },
      { primitive: 'sphere', material: 'ACCENT', position: [-0.4, 0.92, 1.34], scale: [0.2, 0.2, 0.2] },
    ],
  },
  RANGER: {
    height: 1.56,
    selectionScale: 1.12,
    projectile: 'BOLT',
    parts: [
      { primitive: 'box', material: 'TEAM', position: [0, 0.76, 0], scale: [0.72, 1.08, 0.56] },
      { primitive: 'box', material: 'ACCENT', position: [0, 0.84, -0.38], scale: [1.02, 0.09, 0.12] },
      { primitive: 'box', material: 'ACCENT', position: [0, 0.84, 0.38], scale: [0.56, 0.09, 0.12] },
    ],
  },
  SCOUT: {
    height: 1.24,
    selectionScale: 1.0,
    projectile: 'BOLT',
    parts: [
      { primitive: 'capsule', material: 'TEAM', position: [0, 0.6, 0], scale: [0.54, 0.82, 0.54] },
      { primitive: 'box', material: 'ACCENT', position: [-0.42, 0.66, -0.18], scale: [0.48, 0.08, 0.64] },
      { primitive: 'box', material: 'ACCENT', position: [0.42, 0.66, -0.18], scale: [0.48, 0.08, 0.64] },
    ],
  },
  ELEMENTALIST: {
    height: 2.3,
    selectionScale: 1.1,
    projectile: 'ORB',
    parts: [
      { primitive: 'cylinder', material: 'TEAM', position: [0, 0.72, 0], scale: [0.58, 1.08, 0.58] },
      { primitive: 'sphere', material: 'ACCENT', position: [0, 1.42, 0], scale: [0.42, 0.42, 0.42] },
    ],
  },
  ENGINEER: {
    height: 1.58,
    selectionScale: 1.08,
    projectile: 'NONE',
    parts: [
      { primitive: 'cylinder', material: 'TEAM', position: [0, 0.7, 0], scale: [0.62, 1.02, 0.62] },
      { primitive: 'box', material: 'ACCENT', position: [0, 0.76, -0.48], scale: [0.68, 0.72, 0.3] },
      { primitive: 'box', material: 'ACCENT', position: [0.48, 0.54, 0.12], scale: [0.18, 0.18, 0.72] },
    ],
  },
  GOLEM: {
    height: 2.46,
    selectionScale: 1.42,
    projectile: 'NONE',
    parts: [
      { primitive: 'box', material: 'TEAM', position: [0, 1.06, 0], scale: [1.32, 1.66, 1.14] },
      { primitive: 'box', material: 'ACCENT', position: [-0.9, 1.26, 0], scale: [0.62, 0.62, 0.72] },
      { primitive: 'box', material: 'ACCENT', position: [0.9, 1.26, 0], scale: [0.62, 0.62, 0.72] },
      { primitive: 'sphere', material: 'ACCENT', position: [0, 1.18, 0.62], scale: [0.34, 0.34, 0.2] },
    ],
  },
  SIEGE_CONSTRUCT: {
    height: 1.82,
    selectionScale: 1.34,
    projectile: 'SHELL',
    parts: [
      { primitive: 'box', material: 'TEAM', position: [0, 0.62, 0], scale: [1.42, 0.82, 1.52] },
      { primitive: 'cylinder', material: 'ACCENT', position: [0, 1.06, 0.12], scale: [0.66, 0.42, 0.66] },
      { primitive: 'box', material: 'ACCENT', position: [0, 1.08, 0.94], scale: [0.22, 0.22, 1.46] },
    ],
  },
};

export function unitVisualProfile(archetype: UnitArchetype): UnitVisualProfile {
  return UNIT_VISUAL_PROFILES[archetype];
}
