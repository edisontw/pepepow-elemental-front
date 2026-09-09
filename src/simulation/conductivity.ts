import type { EntityID } from './components';
import type { EntityStore } from './entity-store';
import { UNITS } from './m03-content';
import type { NavigationGrid } from './navigation';
import { SurfaceType, type TerrainState } from './terrain-state';

export const CONDUCTIVITY_SCALE = 1000;
export const DRY_GROUND_CONDUCTIVITY = 200;
export const ICE_CONDUCTIVITY = 400;
export const WATER_CONDUCTIVITY = 1000;
export const METAL_UNIT_CONDUCTIVITY = 800;
export const WET_UNIT_CONDUCTIVITY = 900;

export function terrainConductivity(surface: SurfaceType | null): number {
  if (surface === SurfaceType.WATER) return WATER_CONDUCTIVITY;
  if (surface === SurfaceType.ICE) return ICE_CONDUCTIVITY;
  return DRY_GROUND_CONDUCTIVITY;
}

export function effectiveConductivity(
  entityId: EntityID,
  entities: EntityStore,
  terrain: TerrainState,
  navigation: NavigationGrid,
): number {
  const position = entities.positions.get(entityId);
  if (!position) return DRY_GROUND_CONDUCTIVITY;
  const cell = navigation.worldToCell(position.x, position.z);
  const surfaceValue = terrainConductivity(terrain.surfaceAt(cell));
  const archetype = entities.archetypes.get(entityId);
  const metalValue = archetype && UNITS[archetype].tags.includes('METAL') ? METAL_UNIT_CONDUCTIVITY : 0;
  const wetValue = entities.statuses.get(entityId)?.wet === true ? WET_UNIT_CONDUCTIVITY : 0;
  return Math.max(surfaceValue, metalValue, wetValue);
}
