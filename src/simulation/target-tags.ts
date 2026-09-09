import { effectiveConductivity } from './conductivity';
import type { EntityStore } from './entity-store';
import type { DynamicTargetTag, StaticTargetTag, TargetTag } from './element-types';
import { BUILDINGS, UNITS } from './m03-content';
import type { NavigationGrid } from './navigation';
import type { StrategicBuilding } from './strategic-state';
import { type TerrainState } from './terrain-state';

export const CONDUCTIVE_TAG_THRESHOLD = 700;

export function staticUnitTags(archetype: keyof typeof UNITS): readonly StaticTargetTag[] {
  return UNITS[archetype].tags;
}

export function staticBuildingTags(building: StrategicBuilding): readonly StaticTargetTag[] {
  const tags = new Set<StaticTargetTag>(BUILDINGS[building.type].tags);
  if (building.type === 'OUTPOST' && building.specialization === 'MANA_BEACON') tags.add('ARCANE');
  if ((building.type === 'EXTRACTOR' || building.type === 'MANA_WELL') && building.resourceDefenseLevel > 0) tags.add('FORTIFIED');
  return [...tags].sort();
}

export function dynamicUnitTags(
  entityId: number,
  entities: EntityStore,
  terrain: TerrainState,
  navigation: NavigationGrid,
): readonly DynamicTargetTag[] {
  const tags = new Set<DynamicTargetTag>();
  const status = entities.statuses.get(entityId);
  const position = entities.positions.get(entityId);
  if (status?.wet) tags.add('WET');
  if ((status?.chilledTicks ?? 0) > 0) tags.add('CHILLED');
  if ((status?.frozenTicks ?? 0) > 0) tags.add('FROZEN');
  if (position) {
    const cell = navigation.worldToCell(position.x, position.z);
    const index = terrain.indexOf(cell);
    if (index !== null && (terrain.burningAge[index] ?? 0) > 0) tags.add('BURNING');
    if (effectiveConductivity(entityId, entities, terrain, navigation) >= CONDUCTIVE_TAG_THRESHOLD) tags.add('CONDUCTIVE');
  }
  return [...tags].sort();
}

export function unitTargetTags(
  entityId: number,
  entities: EntityStore,
  terrain: TerrainState,
  navigation: NavigationGrid,
): readonly TargetTag[] {
  const archetype = entities.archetypes.get(entityId);
  if (!archetype) return dynamicUnitTags(entityId, entities, terrain, navigation);
  return [...new Set<TargetTag>([
    ...staticUnitTags(archetype),
    ...dynamicUnitTags(entityId, entities, terrain, navigation),
  ])].sort();
}
