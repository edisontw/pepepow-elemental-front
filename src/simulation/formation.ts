import { WORLD_UNITS_PER_METER } from './arena';
import type { EntityID, UnitArchetype } from './components';
import type { EntityStore } from './entity-store';
import type { NavigationGrid } from './navigation';

export const FORMATION_IDS = ['LINE', 'COLUMN', 'SPREAD'] as const;
export type FormationId = typeof FORMATION_IDS[number];

export interface FormationDestination {
  entityId: EntityID;
  x: number;
  z: number;
}

interface FormationSlot {
  lateral: number;
  depth: number;
}

interface Basis {
  forwardX: number;
  forwardZ: number;
  rightX: number;
  rightZ: number;
}

const BASIS_SCALE = 1000;
const DIAGONAL = 707;
const M = WORLD_UNITS_PER_METER;

const FRONT_ARCHETYPES: ReadonlySet<UnitArchetype> = new Set(['GOLEM', 'SPEAR_GUARD', 'VANGUARD']);
const FLEX_ARCHETYPES: ReadonlySet<UnitArchetype> = new Set(['SCOUT']);

export function isFormationId(value: unknown): value is FormationId {
  return typeof value === 'string' && (FORMATION_IDS as readonly string[]).includes(value);
}

export function formationRoleRank(archetype: UnitArchetype): number {
  if (FRONT_ARCHETYPES.has(archetype)) return 0;
  if (FLEX_ARCHETYPES.has(archetype)) return 1;
  return 2;
}

function integerSquareCeiling(value: number): number {
  let result = 1;
  while (result * result < value) result += 1;
  return result;
}

function formationDimensions(formation: FormationId, count: number): {
  columns: number;
  lateralSpacing: number;
  depthSpacing: number;
} {
  if (formation === 'LINE') {
    return { columns: Math.max(1, Math.min(count, 8)), lateralSpacing: Math.round(1.8 * M), depthSpacing: Math.round(1.8 * M) };
  }
  if (formation === 'COLUMN') {
    return { columns: count <= 4 ? 1 : 2, lateralSpacing: Math.round(1.7 * M), depthSpacing: Math.round(1.8 * M) };
  }
  return {
    columns: integerSquareCeiling(Math.max(1, count)),
    lateralSpacing: Math.round(3.2 * M),
    depthSpacing: Math.round(3.2 * M),
  };
}

export function formationSlots(formation: FormationId, count: number): readonly FormationSlot[] {
  if (count <= 0) return [];
  const dimensions = formationDimensions(formation, count);
  const rows = Math.ceil(count / dimensions.columns);
  const slots: Array<FormationSlot & { row: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    const rowCount = Math.min(dimensions.columns, count - row * dimensions.columns);
    for (let column = 0; column < rowCount; column += 1) {
      slots.push({
        row,
        lateral: Math.round((column - (rowCount - 1) / 2) * dimensions.lateralSpacing),
        depth: Math.round(((rows - 1) / 2 - row) * dimensions.depthSpacing),
      });
    }
  }
  slots.sort((left, right) => (
    left.row - right.row
    || Math.abs(left.lateral) - Math.abs(right.lateral)
    || left.lateral - right.lateral
  ));
  return slots.map(({ lateral, depth }) => ({ lateral, depth }));
}

function orientationBasis(deltaX: number, deltaZ: number): Basis {
  if (deltaX === 0 && deltaZ === 0) {
    return { forwardX: 0, forwardZ: BASIS_SCALE, rightX: -BASIS_SCALE, rightZ: 0 };
  }
  const absX = Math.abs(deltaX);
  const absZ = Math.abs(deltaZ);
  let forwardX: number;
  let forwardZ: number;
  if (absX * 2 < absZ) {
    forwardX = 0;
    forwardZ = Math.sign(deltaZ) * BASIS_SCALE;
  } else if (absZ * 2 < absX) {
    forwardX = Math.sign(deltaX) * BASIS_SCALE;
    forwardZ = 0;
  } else {
    forwardX = Math.sign(deltaX) * DIAGONAL;
    forwardZ = Math.sign(deltaZ) * DIAGONAL;
  }
  return {
    forwardX,
    forwardZ,
    rightX: -forwardZ,
    rightZ: forwardX,
  };
}

function sortedFormationEntities(entityIds: readonly EntityID[], entities: EntityStore): EntityID[] {
  return [...new Set(entityIds)]
    .filter((entityId) => entities.hasUnit(entityId) && entities.archetypes.has(entityId) && entities.positions.has(entityId))
    .sort((left, right) => {
      const leftArchetype = entities.archetypes.get(left)!;
      const rightArchetype = entities.archetypes.get(right)!;
      return formationRoleRank(leftArchetype) - formationRoleRank(rightArchetype) || left - right;
    });
}

export function formationDestinations(
  entityIds: readonly EntityID[],
  formation: FormationId,
  targetX: number,
  targetZ: number,
  entities: EntityStore,
  navigation: NavigationGrid,
): readonly FormationDestination[] {
  const orderedIds = sortedFormationEntities(entityIds, entities);
  if (orderedIds.length === 0) return [];

  let sumX = 0;
  let sumZ = 0;
  for (const entityId of orderedIds) {
    const position = entities.positions.get(entityId)!;
    sumX += position.x;
    sumZ += position.z;
  }
  const centroidX = Math.trunc(sumX / orderedIds.length);
  const centroidZ = Math.trunc(sumZ / orderedIds.length);
  const basis = orientationBasis(targetX - centroidX, targetZ - centroidZ);
  const slots = formationSlots(formation, orderedIds.length);
  const reserved = new Set<string>();
  const result: FormationDestination[] = [];

  orderedIds.forEach((entityId, index) => {
    const slot = slots[index];
    if (!slot) return;
    const desiredX = targetX + Math.round((basis.rightX * slot.lateral + basis.forwardX * slot.depth) / BASIS_SCALE);
    const desiredZ = targetZ + Math.round((basis.rightZ * slot.lateral + basis.forwardZ * slot.depth) / BASIS_SCALE);
    const desiredCell = navigation.worldToCell(desiredX, desiredZ);
    const resolved = navigation.resolveWalkableTargetAvoiding(desiredCell, reserved)
      ?? navigation.resolveWalkableTarget(desiredCell);
    if (!resolved) return;
    reserved.add(navigation.cellKey(resolved));
    const world = navigation.cellToWorld(resolved);
    result.push({ entityId, x: world.x, z: world.z });
  });

  return result;
}
