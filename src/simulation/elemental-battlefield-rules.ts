import type { EntityID, PlayerID } from './components';
import type { EntityStore } from './entity-store';
import type { NavigationGrid } from './navigation';
import { VegetationState, type TerrainState } from './terrain-state';

export const BURNING_UNIT_DAMAGE_PER_PULSE = 4;
export const BURNING_UNIT_DAMAGE_PULSE_TICKS = 5;
export const FOREST_REVEAL_RANGE = 4_500;
export const FOREST_SKIRMISHER_REVEAL_RANGE = 3_500;

/**
 * Burning ground is persistent area denial: units that remain on an actively
 * burning vegetation cell take deterministic damage. Four damage every five
 * 10 Hz ticks is the 8 damage/sec design baseline.
 */
export function applyBurningUnitDamage(
  entities: EntityStore,
  terrain: TerrainState,
  navigation: NavigationGrid,
  tick: number,
): number {
  let damagedUnits = 0;
  for (const entityId of entities.entityIds()) {
    if (!entities.hasUnit(entityId)) continue;
    if ((tick + entityId) % BURNING_UNIT_DAMAGE_PULSE_TICKS !== 0) continue;
    const position = entities.positions.get(entityId);
    const health = entities.health.get(entityId);
    if (!position || !health?.alive) continue;
    const cell = navigation.worldToCell(position.x, position.z);
    if ((terrain.burningAgeAt(cell) ?? 0) <= 0) continue;

    health.current = Math.max(0, health.current - BURNING_UNIT_DAMAGE_PER_PULSE);
    damagedUnits += 1;
    if (health.current > 0) continue;

    health.alive = false;
    const combat = entities.combat.get(entityId);
    if (combat) {
      combat.targetEntityId = null;
      combat.pursuitTargetCellKey = null;
    }
    const movement = entities.movements.get(entityId);
    if (movement) {
      movement.targetX = null;
      movement.targetZ = null;
      movement.path = [];
      movement.pathIndex = 0;
      movement.pathNavVersion = navigation.navVersion;
    }
  }
  return damagedUnits;
}

/**
 * Fog remains the outer information boundary. Inside visible fog, intact
 * woodland grants close-range concealment until an opposing unit moves near.
 * Ranger and Scout are harder to reveal. Burning the cell removes concealment,
 * which gives Fire a concrete cover-clearing job for both sides.
 */
export function forestAllowsDetection(
  targetEntityId: EntityID,
  observerPlayerId: PlayerID,
  entities: EntityStore,
  terrain: TerrainState,
  navigation: NavigationGrid,
): boolean {
  if (!entities.hasUnit(targetEntityId)) return false;
  if (entities.factions.get(targetEntityId)?.playerId === observerPlayerId) return true;
  const targetPosition = entities.positions.get(targetEntityId);
  if (!targetPosition) return false;
  const targetCell = navigation.worldToCell(targetPosition.x, targetPosition.z);
  if (
    terrain.vegetationAt(targetCell) !== VegetationState.FLAMMABLE
    || (terrain.burningAgeAt(targetCell) ?? 0) > 0
  ) return true;

  const archetype = entities.archetypes.get(targetEntityId);
  const revealRange = archetype === 'RANGER' || archetype === 'SCOUT'
    ? FOREST_SKIRMISHER_REVEAL_RANGE
    : FOREST_REVEAL_RANGE;
  const revealRangeSquared = revealRange * revealRange;
  for (const observerId of entities.entityIds()) {
    if (!entities.hasUnit(observerId) || entities.factions.get(observerId)?.playerId !== observerPlayerId) continue;
    const observerPosition = entities.positions.get(observerId);
    if (!observerPosition) continue;
    const dx = observerPosition.x - targetPosition.x;
    const dz = observerPosition.z - targetPosition.z;
    if (dx * dx + dz * dz <= revealRangeSquared) return true;
  }
  return false;
}
