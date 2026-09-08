import { WORLD_UNITS_PER_METER } from './arena';
import type { EntityID } from './components';
import type { EntityStore } from './entity-store';
import { forestAllowsDetection } from './elemental-battlefield-rules';
import type { NavigationGrid } from './navigation';
import type { VisibilityState } from './visibility-state';

const IDLE_MIN_AGGRO_RANGE = 6 * WORLD_UNITS_PER_METER;
const MOVING_MIN_CONTACT_RANGE = 3.5 * WORLD_UNITS_PER_METER;
const IDLE_RANGE_PADDING = 2 * WORLD_UNITS_PER_METER;
const MOVING_RANGE_PADDING = 1 * WORLD_UNITS_PER_METER;

interface TargetCandidate {
  entityId: EntityID;
  distanceSquared: number;
}

function squaredDistance(
  left: { x: number; z: number },
  right: { x: number; z: number },
): number {
  const dx = left.x - right.x;
  const dz = left.z - right.z;
  return dx * dx + dz * dz;
}

/**
 * Acquire a nearby visible hostile when a unit has no explicit combat target.
 * Idle units guard a modest radius; moving units only react to close contact so
 * normal move orders do not become long-range attack-move orders.
 *
 * Target choice is deterministic: nearest squared distance, then EntityID.
 */
export function acquireEncounterTargets(
  entities: EntityStore,
  navigation: NavigationGrid,
  visibility: VisibilityState,
  terrain: Parameters<typeof forestAllowsDetection>[3],
  tick: number,
): number {
  let acquired = 0;
  const entityIds = entities.entityIds();
  for (const entityId of entityIds) {
    if (!entities.hasUnit(entityId)) continue;
    const faction = entities.factions.get(entityId);
    const position = entities.positions.get(entityId);
    const combat = entities.combat.get(entityId);
    const movement = entities.movements.get(entityId);
    if (!faction || !position || !combat || !movement) continue;
    if (combat.targetEntityId !== null && entities.hasUnit(combat.targetEntityId)) continue;
    if (combat.targetEntityId !== null) {
      combat.targetEntityId = null;
      combat.pursuitTargetCellKey = null;
    }

    const moving = movement.targetX !== null && movement.targetZ !== null;
    const range = Math.max(
      combat.attackRange + (moving ? MOVING_RANGE_PADDING : IDLE_RANGE_PADDING),
      moving ? MOVING_MIN_CONTACT_RANGE : IDLE_MIN_AGGRO_RANGE,
    );
    const rangeSquared = range * range;
    let best: TargetCandidate | null = null;

    for (const targetId of entityIds) {
      if (targetId === entityId || !entities.hasUnit(targetId)) continue;
      const targetFaction = entities.factions.get(targetId);
      const targetPosition = entities.positions.get(targetId);
      if (!targetFaction || !targetPosition || targetFaction.playerId === faction.playerId) continue;
      if (!visibility.isWorldVisible(faction.playerId, targetPosition.x, targetPosition.z, navigation)) continue;
      if (!forestAllowsDetection(targetId, faction.playerId, entities, terrain, navigation)) continue;
      const distanceSquared = squaredDistance(position, targetPosition);
      if (distanceSquared > rangeSquared) continue;
      if (
        best === null
        || distanceSquared < best.distanceSquared
        || (distanceSquared === best.distanceSquared && targetId < best.entityId)
      ) {
        best = { entityId: targetId, distanceSquared };
      }
    }

    if (!best) continue;
    combat.targetEntityId = best.entityId;
    combat.pursuitTargetCellKey = null;
    combat.nextAttackTick = Math.min(combat.nextAttackTick, tick);
    acquired += 1;
  }
  return acquired;
}
