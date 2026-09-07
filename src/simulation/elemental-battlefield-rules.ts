import type { EntityStore } from './entity-store';
import type { NavigationGrid } from './navigation';
import type { TerrainState } from './terrain-state';

export const BURNING_UNIT_DAMAGE_PER_PULSE = 4;
export const BURNING_UNIT_DAMAGE_PULSE_TICKS = 5;

/**
 * Presentation-era Fire becomes a real area-denial rule here: units that remain
 * on an actively burning vegetation cell take deterministic damage. Four damage
 * every five 10 Hz ticks is an 8 damage/sec baseline, matching the design spec.
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
