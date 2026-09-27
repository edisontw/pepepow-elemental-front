import { WORLD_UNITS_PER_METER } from './arena';
import type { EntityID, MovementComponent } from './components';
import type { EntityStore } from './entity-store';
import { forestAllowsDetection } from './elemental-battlefield-rules';
import type { NavigationGrid } from './navigation';
import type { VisibilityState } from './visibility-state';

const IDLE_MIN_AGGRO_RANGE = 6 * WORLD_UNITS_PER_METER;
export const ATTACK_MOVE_AGGRO_RANGE = 12 * WORLD_UNITS_PER_METER;
export const LOCAL_SUPPORT_RESPONSE_RANGE = 12 * WORLD_UNITS_PER_METER;
export const LOCAL_SUPPORT_TARGET_RANGE = 18 * WORLD_UNITS_PER_METER;
const IDLE_RANGE_PADDING = 2 * WORLD_UNITS_PER_METER;

interface TargetCandidate {
  entityId: EntityID;
  distanceSquared: number;
}

interface SupportSignal {
  playerId: number;
  anchorEntityId: EntityID;
  targetEntityId: EntityID;
  anchorX: number;
  anchorZ: number;
}

function squaredDistance(
  left: { x: number; z: number },
  right: { x: number; z: number },
): number {
  const dx = left.x - right.x;
  const dz = left.z - right.z;
  return dx * dx + dz * dz;
}

function visibleToFaction(
  entityId: EntityID,
  playerId: number,
  entities: EntityStore,
  navigation: NavigationGrid,
  visibility: VisibilityState,
  terrain: Parameters<typeof forestAllowsDetection>[3],
): boolean {
  const position = entities.positions.get(entityId);
  return position !== undefined
    && visibility.isWorldVisible(playerId, position.x, position.z, navigation)
    && forestAllowsDetection(entityId, playerId, entities, terrain, navigation);
}

function preserveNormalMoveDestination(movement: MovementComponent): void {
  if (
    movement.orderMode !== 'NORMAL'
    || movement.autoSupportSuppressed
    || movement.resumeMoveX !== null
    || movement.resumeMoveZ !== null
    || movement.targetX === null
    || movement.targetZ === null
    || movement.yieldReturnX !== null
    || movement.yieldReturnZ !== null
  ) return;
  movement.resumeMoveX = movement.targetX;
  movement.resumeMoveZ = movement.targetZ;
}

function clearTemporaryPursuitPath(movement: MovementComponent, navVersion: number): void {
  movement.targetX = null;
  movement.targetZ = null;
  movement.path = [];
  movement.pathIndex = 0;
  movement.pathNavVersion = navVersion;
}

function directEncounterRange(movement: MovementComponent, attackRange: number): number {
  if (movement.orderMode === 'HOLD') return attackRange;
  if (movement.orderMode === 'ATTACK_MOVE') {
    return Math.max(attackRange + IDLE_RANGE_PADDING, ATTACK_MOVE_AGGRO_RANGE);
  }
  return Math.max(attackRange + IDLE_RANGE_PADDING, IDLE_MIN_AGGRO_RANGE);
}

/**
 * Acquire a nearby visible hostile when a unit has no explicit combat target.
 *
 * NORMAL MOVE keeps historical forced-disengage semantics when
 * autoSupportSuppressed is set by a MOVE issued during combat. Otherwise,
 * opted-in players may temporarily interrupt ordinary transit for a local
 * encounter; the original destination is preserved and resumed after combat.
 *
 * Target choice is deterministic: nearest squared distance, then EntityID.
 */
export function acquireEncounterTargets(
  entities: EntityStore,
  navigation: NavigationGrid,
  visibility: VisibilityState,
  terrain: Parameters<typeof forestAllowsDetection>[3],
  tick: number,
  proactiveTransitPlayerIds: readonly number[] = [],
): number {
  let acquired = 0;
  const entityIds = entities.entityIds();
  const proactivePlayers = new Set(proactiveTransitPlayerIds);

  for (const entityId of entityIds) {
    if (!entities.hasUnit(entityId)) continue;
    const faction = entities.factions.get(entityId);
    const position = entities.positions.get(entityId);
    const combat = entities.combat.get(entityId);
    const movement = entities.movements.get(entityId);
    if (!faction || !position || !combat || !movement) continue;

    if (combat.targetEntityId !== null && entities.hasUnit(combat.targetEntityId)) {
      const target = entities.positions.get(combat.targetEntityId)!;
      const targetVisible = visibleToFaction(
        combat.targetEntityId,
        faction.playerId,
        entities,
        navigation,
        visibility,
        terrain,
      );
      const heldTargetValid = squaredDistance(position, target) <= combat.attackRange * combat.attackRange
        && targetVisible;

      if (movement.orderMode === 'HOLD') {
        if (heldTargetValid) continue;
        combat.targetEntityId = null;
        combat.pursuitTargetCellKey = null;
      } else if (movement.localSupportActive || movement.resumeMoveX !== null || movement.resumeMoveZ !== null) {
        if (targetVisible) continue;
        combat.targetEntityId = null;
        combat.pursuitTargetCellKey = null;
        movement.localSupportActive = false;
        clearTemporaryPursuitPath(movement, navigation.navVersion);
      } else {
        continue;
      }
    } else if (combat.targetEntityId !== null) {
      combat.targetEntityId = null;
      combat.pursuitTargetCellKey = null;
      movement.localSupportActive = false;
      if (movement.resumeMoveX !== null || movement.resumeMoveZ !== null) {
        clearTemporaryPursuitPath(movement, navigation.navVersion);
      }
    }

    const normalMoveActive = movement.orderMode === 'NORMAL'
      && movement.targetX !== null
      && movement.targetZ !== null
      && movement.yieldReturnX === null;

    if (
      normalMoveActive
      && (movement.autoSupportSuppressed || !proactivePlayers.has(faction.playerId))
    ) {
      combat.targetEntityId = null;
      combat.pursuitTargetCellKey = null;
      continue;
    }

    const range = directEncounterRange(movement, combat.attackRange);
    const rangeSquared = range * range;
    let best: TargetCandidate | null = null;

    for (const targetId of entityIds) {
      if (targetId === entityId || !entities.hasUnit(targetId)) continue;
      const targetFaction = entities.factions.get(targetId);
      const targetPosition = entities.positions.get(targetId);
      if (!targetFaction || !targetPosition || targetFaction.playerId === faction.playerId) continue;
      if (!visibleToFaction(targetId, faction.playerId, entities, navigation, visibility, terrain)) continue;
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

    if (normalMoveActive && proactivePlayers.has(faction.playerId)) {
      preserveNormalMoveDestination(movement);
    }

    // A traffic-yield return point is only meaningful while the unit remains
    // an uninvolved bystander. Autonomous combat must never resurrect it.
    movement.yieldReturnX = null;
    movement.yieldReturnZ = null;
    movement.localSupportActive = false;
    combat.targetEntityId = best.entityId;
    combat.pursuitTargetCellKey = null;
    combat.nextAttackTick = Math.min(combat.nextAttackTick, tick);
    acquired += 1;
  }
  return acquired;
}

function supportSignals(
  entities: EntityStore,
  supportedPlayers: ReadonlySet<number>,
): SupportSignal[] {
  const signals = new Map<string, SupportSignal>();

  for (const entityId of entities.entityIds()) {
    if (!entities.hasUnit(entityId)) continue;
    const faction = entities.factions.get(entityId);
    const position = entities.positions.get(entityId);
    const combat = entities.combat.get(entityId);
    const movement = entities.movements.get(entityId);
    if (!faction || !position || !combat || !movement || combat.targetEntityId === null) continue;
    if (!entities.hasUnit(combat.targetEntityId)) continue;

    const targetFaction = entities.factions.get(combat.targetEntityId);
    const targetPosition = entities.positions.get(combat.targetEntityId);
    if (!targetFaction || !targetPosition || targetFaction.playerId === faction.playerId) continue;

    // A player unit that independently found/was ordered onto a hostile is an
    // engagement anchor. Units that merely joined as support do not propagate
    // the call further, preventing chain recruitment across the whole army.
    if (supportedPlayers.has(faction.playerId) && !movement.localSupportActive) {
      const signal: SupportSignal = {
        playerId: faction.playerId,
        anchorEntityId: entityId,
        targetEntityId: combat.targetEntityId,
        anchorX: position.x,
        anchorZ: position.z,
      };
      signals.set(`${signal.playerId}:${signal.anchorEntityId}:${signal.targetEntityId}`, signal);
    }

    // Incoming hostile aggression is also a local distress signal, even when
    // the victim is explicitly moving away and therefore does not retaliate.
    if (supportedPlayers.has(targetFaction.playerId)) {
      const signal: SupportSignal = {
        playerId: targetFaction.playerId,
        anchorEntityId: combat.targetEntityId,
        targetEntityId: entityId,
        anchorX: targetPosition.x,
        anchorZ: targetPosition.z,
      };
      signals.set(`${signal.playerId}:${signal.anchorEntityId}:${signal.targetEntityId}`, signal);
    }
  }

  return [...signals.values()].sort((left, right) => (
    left.playerId - right.playerId
    || left.anchorEntityId - right.anchorEntityId
    || left.targetEntityId - right.targetEntityId
  ));
}

/**
 * Pull nearby opted-in friendly units into an already-established local fight.
 * HOLD and explicit forced-disengage MOVE are never overridden. NORMAL movers
 * preserve their original destination and resume it after combat.
 */
export function acquireLocalSupportTargets(
  entities: EntityStore,
  navigation: NavigationGrid,
  visibility: VisibilityState,
  terrain: Parameters<typeof forestAllowsDetection>[3],
  tick: number,
  supportPlayerIds: readonly number[],
): number {
  const supportedPlayers = new Set(supportPlayerIds);
  if (supportedPlayers.size === 0) return 0;

  const signals = supportSignals(entities, supportedPlayers);
  if (signals.length === 0) return 0;

  const responseRangeSquared = LOCAL_SUPPORT_RESPONSE_RANGE * LOCAL_SUPPORT_RESPONSE_RANGE;
  const targetRangeSquared = LOCAL_SUPPORT_TARGET_RANGE * LOCAL_SUPPORT_TARGET_RANGE;
  let acquired = 0;

  for (const entityId of entities.entityIds()) {
    if (!entities.hasUnit(entityId)) continue;
    const faction = entities.factions.get(entityId);
    const position = entities.positions.get(entityId);
    const combat = entities.combat.get(entityId);
    const movement = entities.movements.get(entityId);
    if (!faction || !position || !combat || !movement) continue;
    if (!supportedPlayers.has(faction.playerId)) continue;
    if (combat.targetEntityId !== null) continue;
    if (movement.orderMode === 'HOLD' || movement.autoSupportSuppressed) continue;

    let best: {
      targetEntityId: EntityID;
      anchorEntityId: EntityID;
      targetDistanceSquared: number;
    } | null = null;

    for (const signal of signals) {
      if (signal.playerId !== faction.playerId || !entities.hasUnit(signal.targetEntityId)) continue;
      const anchorDistanceSquared = squaredDistance(position, { x: signal.anchorX, z: signal.anchorZ });
      if (anchorDistanceSquared > responseRangeSquared) continue;

      const targetPosition = entities.positions.get(signal.targetEntityId)!;
      const targetDistanceSquared = squaredDistance(position, targetPosition);
      if (targetDistanceSquared > targetRangeSquared) continue;
      if (!visibleToFaction(
        signal.targetEntityId,
        faction.playerId,
        entities,
        navigation,
        visibility,
        terrain,
      )) continue;

      if (
        best === null
        || targetDistanceSquared < best.targetDistanceSquared
        || (targetDistanceSquared === best.targetDistanceSquared && signal.targetEntityId < best.targetEntityId)
        || (
          targetDistanceSquared === best.targetDistanceSquared
          && signal.targetEntityId === best.targetEntityId
          && signal.anchorEntityId < best.anchorEntityId
        )
      ) {
        best = {
          targetEntityId: signal.targetEntityId,
          anchorEntityId: signal.anchorEntityId,
          targetDistanceSquared,
        };
      }
    }

    if (!best) continue;

    preserveNormalMoveDestination(movement);
    movement.yieldReturnX = null;
    movement.yieldReturnZ = null;
    movement.localSupportActive = true;
    combat.targetEntityId = best.targetEntityId;
    combat.pursuitTargetCellKey = null;
    combat.nextAttackTick = Math.min(combat.nextAttackTick, tick);
    acquired += 1;
  }

  return acquired;
}
