import { WORLD_UNITS_PER_METER } from './arena';
import type { EntityID } from './components';
import type { EntityStore } from './entity-store';
import type { NavigationGrid } from './navigation';

const BUCKET_SIZE = 2 * WORLD_UNITS_PER_METER;
const RELAXATION_PASSES = 3;
const MELEE_CONTACT_MAX_RANGE = Math.round(2.5 * WORLD_UNITS_PER_METER);
export const FRIENDLY_DESTINATION_MERGE_RADIUS = 2 * WORLD_UNITS_PER_METER;
export const FRIENDLY_SETTLED_CONTACT_PERMILLE = 700;
export const FRIENDLY_TRAFFIC_CONTACT_PERMILLE = 850;
const RING_ROTATION_SCALE = 10_000;
const RING_ROTATIONS = [
  { cos: 9976, sin: 698 },
  { cos: 9903, sin: 1392 },
  { cos: 9781, sin: 2079 },
] as const;
export const UNIT_CONTACT_PADDING = 20;

const FALLBACK_DIRECTIONS = [
  [1000, 0],
  [707, 707],
  [0, 1000],
  [-707, 707],
  [-1000, 0],
  [-707, -707],
  [0, -1000],
  [707, -707],
] as const;

function bucketKey(x: number, z: number): string {
  return `${Math.floor(x / BUCKET_SIZE)}:${Math.floor(z / BUCKET_SIZE)}`;
}

function bucketCoordinates(x: number, z: number): { x: number; z: number } {
  return { x: Math.floor(x / BUCKET_SIZE), z: Math.floor(z / BUCKET_SIZE) };
}

function buildBuckets(entityIds: readonly EntityID[], entities: EntityStore): Map<string, EntityID[]> {
  const buckets = new Map<string, EntityID[]>();
  for (const entityId of entityIds) {
    if (!entities.hasUnit(entityId)) continue;
    const position = entities.positions.get(entityId)!;
    const key = bucketKey(position.x, position.z);
    const bucket = buckets.get(key) ?? [];
    bucket.push(entityId);
    buckets.set(key, bucket);
  }
  return buckets;
}

function isHardAnchor(entityId: EntityID, entities: EntityStore): boolean {
  const movement = entities.movements.get(entityId);
  const status = entities.statuses.get(entityId);
  return (status?.frozenTicks ?? 0) > 0 || movement?.orderMode === 'HOLD';
}

function hasMovementIntent(entityId: EntityID, entities: EntityStore): boolean {
  const movement = entities.movements.get(entityId);
  return movement !== undefined && movement.targetX !== null && movement.targetZ !== null;
}

function movementPriority(entityId: EntityID, entities: EntityStore): number {
  const movement = entities.movements.get(entityId);
  if (!movement || movement.targetX === null || movement.targetZ === null) return 0;
  return movement.yieldReturnX === null ? 2 : 1;
}

function remainingTargetDistanceSquared(entityId: EntityID, entities: EntityStore): number {
  const movement = entities.movements.get(entityId);
  const position = entities.positions.get(entityId);
  if (!movement || !position || movement.targetX === null || movement.targetZ === null) {
    return Number.MAX_SAFE_INTEGER;
  }
  const dx = movement.targetX - position.x;
  const dz = movement.targetZ - position.z;
  return dx * dx + dz * dz;
}

function rememberYieldReturn(entityId: EntityID, entities: EntityStore): void {
  const movement = entities.movements.get(entityId);
  const position = entities.positions.get(entityId);
  if (!movement || !position || movement.yieldReturnX !== null || movement.yieldReturnZ !== null) return;
  movement.yieldReturnX = position.x;
  movement.yieldReturnZ = position.z;
}

function canOccupy(x: number, z: number, navigation: NavigationGrid): boolean {
  return navigation.isWalkable(navigation.worldToCell(x, z));
}

function tryFriendlyBlockerSidestep(
  moverId: EntityID,
  blockerId: EntityID,
  entities: EntityStore,
  navigation: NavigationGrid,
  minimumDistance: number,
): boolean {
  const mover = entities.positions.get(moverId);
  const blocker = entities.positions.get(blockerId);
  const movement = entities.movements.get(moverId);
  if (!mover || !blocker || !movement || movement.targetX === null || movement.targetZ === null) return false;

  const waypoint = movement.pathIndex < movement.path.length
    ? movement.path[movement.pathIndex]!
    : { x: movement.targetX, z: movement.targetZ };
  const forwardX = waypoint.x - mover.x;
  const forwardZ = waypoint.z - mover.z;
  const forwardLength = Math.round(Math.sqrt(forwardX * forwardX + forwardZ * forwardZ));
  if (forwardLength <= 0) return false;

  const perpendicularX = -forwardZ;
  const perpendicularZ = forwardX;
  const preferredSign: -1 | 1 = ((moverId * 31 + blockerId * 17) & 1) === 0 ? -1 : 1;
  const signs: readonly (-1 | 1)[] = [preferredSign, preferredSign === 1 ? -1 : 1];

  for (const sign of signs) {
    const candidate = displaced(
      blocker.x,
      blocker.z,
      perpendicularX,
      perpendicularZ,
      forwardLength,
      minimumDistance + 2,
      sign,
    );
    if (!canOccupy(candidate.x, candidate.z, navigation)) continue;
    const dx = candidate.x - mover.x;
    const dz = candidate.z - mover.z;
    if (dx * dx + dz * dz < minimumDistance * minimumDistance) continue;
    rememberYieldReturn(blockerId, entities);
    blocker.x = candidate.x;
    blocker.z = candidate.z;
    return true;
  }
  return false;
}

function tryMoverSidestep(
  moverId: EntityID,
  blockerId: EntityID,
  entities: EntityStore,
  navigation: NavigationGrid,
  minimumDistance: number,
): boolean {
  const mover = entities.positions.get(moverId);
  const blocker = entities.positions.get(blockerId);
  const movement = entities.movements.get(moverId);
  if (!mover || !blocker || !movement || movement.targetX === null || movement.targetZ === null) return false;

  const waypoint = movement.pathIndex < movement.path.length
    ? movement.path[movement.pathIndex]!
    : { x: movement.targetX, z: movement.targetZ };
  const forwardX = waypoint.x - mover.x;
  const forwardZ = waypoint.z - mover.z;
  const forwardLength = Math.round(Math.sqrt(forwardX * forwardX + forwardZ * forwardZ));
  if (forwardLength <= 0) return false;

  const perpendicularX = -forwardZ;
  const perpendicularZ = forwardX;
  const preferredSign: -1 | 1 = ((moverId * 43 + blockerId * 19) & 1) === 0 ? -1 : 1;
  const signs: readonly (-1 | 1)[] = [preferredSign, preferredSign === 1 ? -1 : 1];

  for (const sign of signs) {
    const candidate = displaced(
      mover.x,
      mover.z,
      perpendicularX,
      perpendicularZ,
      forwardLength,
      minimumDistance + 2,
      sign,
    );
    if (!canOccupy(candidate.x, candidate.z, navigation)) continue;
    const dx = candidate.x - blocker.x;
    const dz = candidate.z - blocker.z;
    if (dx * dx + dz * dz < minimumDistance * minimumDistance) continue;
    mover.x = candidate.x;
    mover.z = candidate.z;
    return true;
  }
  return false;
}

function isMeleeEngagement(entityId: EntityID, targetId: EntityID, entities: EntityStore): boolean {
  const combat = entities.combat.get(entityId);
  const position = entities.positions.get(entityId);
  const target = entities.positions.get(targetId);
  if (!combat || !position || !target || combat.targetEntityId !== targetId) return false;
  if (combat.attackRange > MELEE_CONTACT_MAX_RANGE) return false;
  const dx = position.x - target.x;
  const dz = position.z - target.z;
  return dx * dx + dz * dz <= combat.attackRange * combat.attackRange;
}

function sharedMeleeTargetIntent(leftId: EntityID, rightId: EntityID, entities: EntityStore): EntityID | null {
  const leftCombat = entities.combat.get(leftId);
  const rightCombat = entities.combat.get(rightId);
  if (!leftCombat || !rightCombat) return null;
  if (leftCombat.attackRange > MELEE_CONTACT_MAX_RANGE || rightCombat.attackRange > MELEE_CONTACT_MAX_RANGE) return null;
  if (leftCombat.targetEntityId === null || leftCombat.targetEntityId !== rightCombat.targetEntityId) return null;
  return entities.hasUnit(leftCombat.targetEntityId) ? leftCombat.targetEntityId : null;
}

function convergingToSharedDestination(leftId: EntityID, rightId: EntityID, entities: EntityStore): boolean {
  const leftMovement = entities.movements.get(leftId);
  const rightMovement = entities.movements.get(rightId);
  const left = entities.positions.get(leftId);
  const right = entities.positions.get(rightId);
  if (!leftMovement || !rightMovement || !left || !right) return false;

  let targetX: number | null = null;
  let targetZ: number | null = null;
  const leftHasTarget = leftMovement.targetX !== null && leftMovement.targetZ !== null;
  const rightHasTarget = rightMovement.targetX !== null && rightMovement.targetZ !== null;

  if (
    leftHasTarget
    && rightHasTarget
    && leftMovement.targetX === rightMovement.targetX
    && leftMovement.targetZ === rightMovement.targetZ
  ) {
    targetX = leftMovement.targetX;
    targetZ = leftMovement.targetZ;
  } else if (
    leftHasTarget
    && !rightHasTarget
    && right.x === leftMovement.targetX
    && right.z === leftMovement.targetZ
  ) {
    targetX = leftMovement.targetX;
    targetZ = leftMovement.targetZ;
  } else if (
    rightHasTarget
    && !leftHasTarget
    && left.x === rightMovement.targetX
    && left.z === rightMovement.targetZ
  ) {
    targetX = rightMovement.targetX;
    targetZ = rightMovement.targetZ;
  }

  if (targetX === null || targetZ === null) return false;
  const radiusSquared = FRIENDLY_DESTINATION_MERGE_RADIUS * FRIENDLY_DESTINATION_MERGE_RADIUS;
  const leftDx = left.x - targetX;
  const leftDz = left.z - targetZ;
  const rightDx = right.x - targetX;
  const rightDz = right.z - targetZ;
  return leftDx * leftDx + leftDz * leftDz <= radiusSquared
    && rightDx * rightDx + rightDz * rightDz <= radiusSquared;
}

function trySharedMeleeRingSeparation(
  leftId: EntityID,
  rightId: EntityID,
  targetId: EntityID,
  entities: EntityStore,
  navigation: NavigationGrid,
  minimumDistance: number,
): boolean {
  const left = entities.positions.get(leftId);
  const right = entities.positions.get(rightId);
  const target = entities.positions.get(targetId);
  const leftCombat = entities.combat.get(leftId);
  const rightCombat = entities.combat.get(rightId);
  if (!left || !right || !target || !leftCombat || !rightCombat) return false;

  // Keep one combatant stable while the other fans around the shared target.
  // Higher EntityID moves on exact symmetry so replay ordering is fixed.
  const leftRadiusSq = (left.x - target.x) ** 2 + (left.z - target.z) ** 2;
  const rightRadiusSq = (right.x - target.x) ** 2 + (right.z - target.z) ** 2;
  const moverId = leftRadiusSq > rightRadiusSq
    ? leftId
    : rightRadiusSq > leftRadiusSq
      ? rightId
      : Math.max(leftId, rightId);
  const blockerId = moverId === leftId ? rightId : leftId;
  const mover = entities.positions.get(moverId)!;
  const blocker = entities.positions.get(blockerId)!;
  const relativeX = mover.x - target.x;
  const relativeZ = mover.z - target.z;
  if (relativeX === 0 && relativeZ === 0) return false;
  const blockerX = blocker.x - target.x;
  const blockerZ = blocker.z - target.z;
  const cross = relativeX * blockerZ - relativeZ * blockerX;
  const preferredSign: -1 | 1 = cross < 0
    ? 1
    : cross > 0
      ? -1
      : ((moverId * 31 + blockerId * 17 + targetId * 13) & 1) === 0 ? -1 : 1;
  const signs: readonly (-1 | 1)[] = [preferredSign, preferredSign === 1 ? -1 : 1];
  const currentDx = mover.x - blocker.x;
  const currentDz = mover.z - blocker.z;
  const currentDistanceSq = currentDx * currentDx + currentDz * currentDz;

  for (const rotation of RING_ROTATIONS) {
    for (const sign of signs) {
      const candidateRelativeX = Math.round(
        (relativeX * rotation.cos - sign * relativeZ * rotation.sin) / RING_ROTATION_SCALE,
      );
      const candidateRelativeZ = Math.round(
        (sign * relativeX * rotation.sin + relativeZ * rotation.cos) / RING_ROTATION_SCALE,
      );
      const candidate = {
        x: target.x + candidateRelativeX,
        z: target.z + candidateRelativeZ,
      };
      if (!canOccupy(candidate.x, candidate.z, navigation)) continue;
      const blockerDx = candidate.x - blocker.x;
      const blockerDz = candidate.z - blocker.z;
      const blockerDistanceSq = blockerDx * blockerDx + blockerDz * blockerDz;
      if (blockerDistanceSq <= currentDistanceSq) continue;

      mover.x = candidate.x;
      mover.z = candidate.z;
      // A small angular correction may need more than one relaxation pass,
      // but it never ejects the attacker from its valid melee ring.
      return blockerDistanceSq >= minimumDistance * minimumDistance || blockerDistanceSq > currentDistanceSq;
    }
  }
  return false;
}

function hostileMeleeAnchor(
  leftId: EntityID,
  rightId: EntityID,
  entities: EntityStore,
): EntityID | null {
  const leftEngaged = isMeleeEngagement(leftId, rightId, entities);
  const rightEngaged = isMeleeEngagement(rightId, leftId, entities);
  if (!leftEngaged && !rightEngaged) return null;
  if (leftEngaged && !rightEngaged) return rightId;
  if (rightEngaged && !leftEngaged) return leftId;

  const leftRadius = entities.bodies.get(leftId)?.radius ?? 0;
  const rightRadius = entities.bodies.get(rightId)?.radius ?? 0;
  if (leftRadius !== rightRadius) return leftRadius > rightRadius ? leftId : rightId;
  return Math.min(leftId, rightId);
}

function displaced(
  x: number,
  z: number,
  axisX: number,
  axisZ: number,
  divisor: number,
  amount: number,
  sign: -1 | 1,
): { x: number; z: number } {
  return {
    x: x + Math.round((axisX * amount * sign) / divisor),
    z: z + Math.round((axisZ * amount * sign) / divisor),
  };
}

function resolvePair(
  leftId: EntityID,
  rightId: EntityID,
  entities: EntityStore,
  navigation: NavigationGrid,
): void {
  const left = entities.positions.get(leftId);
  const right = entities.positions.get(rightId);
  const leftBody = entities.bodies.get(leftId);
  const rightBody = entities.bodies.get(rightId);
  if (!left || !right || !leftBody || !rightBody) return;

  const sameFaction = entities.factions.get(leftId)?.playerId === entities.factions.get(rightId)?.playerId;
  const leftMoving = hasMovementIntent(leftId, entities);
  const rightMoving = hasMovementIntent(rightId, entities);
  const sharedTargetId = sameFaction ? sharedMeleeTargetIntent(leftId, rightId, entities) : null;

  // A friendly cluster with no movement intent and no shared combat target is
  // already settled. Do not continuously "improve" its spacing: dense RTS
  // combat may legitimately leave units overlapped after a target dies, and
  // pushing them apart here creates visible post-combat oscillation.
  if (sameFaction && !leftMoving && !rightMoving && sharedTargetId === null) return;

  // Units deliberately converging on one exact friendly destination may merge
  // during the final 2 m of arrival. This prevents a mover that is about to
  // finish at an occupied destination from entering an endless sidestep/push
  // loop. Ordinary en-route traffic still uses soft separation.
  if (sameFaction && sharedTargetId === null && convergingToSharedDestination(leftId, rightId, entities)) return;

  const friendlyContactPermille = sharedTargetId !== null
    ? FRIENDLY_SETTLED_CONTACT_PERMILLE
    : FRIENDLY_TRAFFIC_CONTACT_PERMILLE;
  const bodyDistance = leftBody.radius + rightBody.radius;
  const minimumDistance = sameFaction
    ? Math.round((bodyDistance * friendlyContactPermille) / 1000) + UNIT_CONTACT_PADDING
    : bodyDistance + UNIT_CONTACT_PADDING;
  const dx = right.x - left.x;
  const dz = right.z - left.z;
  const distanceSquared = dx * dx + dz * dz;
  if (distanceSquared >= minimumDistance * minimumDistance) return;

  let axisX = dx;
  let axisZ = dz;
  let divisor: number;
  let distance: number;
  if (distanceSquared === 0) {
    const fallback = FALLBACK_DIRECTIONS[(leftId * 31 + rightId * 17) % FALLBACK_DIRECTIONS.length]!;
    axisX = fallback[0];
    axisZ = fallback[1];
    divisor = 1000;
    distance = 0;
  } else {
    distance = Math.max(1, Math.round(Math.sqrt(distanceSquared)));
    divisor = distance;
  }

  const overlap = minimumDistance + 2 - distance;
  if (overlap <= 0) return;

  const leftHard = isHardAnchor(leftId, entities);
  const rightHard = isHardAnchor(rightId, entities);
  const leftPriority = movementPriority(leftId, entities);
  const rightPriority = movementPriority(rightId, entities);

  let leftAmount: number;
  let rightAmount: number;

  const hostileAnchorId = sameFaction ? null : hostileMeleeAnchor(leftId, rightId, entities);

  if (sharedTargetId !== null && !leftHard && !rightHard) {
    // Units converging on the same melee target are combat-ring traffic, not
    // ordinary mover-vs-idle traffic. Fan the farther combatant tangentially
    // around the shared target so an arriving Vanguard never shoves an already
    // attacking Vanguard sideways by a full body width.
    if (trySharedMeleeRingSeparation(leftId, rightId, sharedTargetId, entities, navigation, minimumDistance)) return;

    // If terrain prevents a tangential correction, keep whichever combatant is
    // already closer to the target stable and let only the outer unit absorb
    // the minimum radial correction. Exact ties use EntityID.
    const target = entities.positions.get(sharedTargetId)!;
    const leftDistance = (left.x - target.x) ** 2 + (left.z - target.z) ** 2;
    const rightDistance = (right.x - target.x) ** 2 + (right.z - target.z) ** 2;
    const leftWins = leftDistance < rightDistance
      || (leftDistance === rightDistance && leftId < rightId);
    if (leftWins) {
      leftAmount = 0;
      rightAmount = overlap;
    } else {
      leftAmount = overlap;
      rightAmount = 0;
    }
  } else if (hostileAnchorId !== null && !leftHard && !rightHard) {
    // Once hostile melee contact is established, keep the defender / heavier
    // combatant stable. Only the other body absorbs accidental penetration so
    // a surrounded monster does not get pushed across the battlefield.
    if (hostileAnchorId === leftId) {
      leftAmount = 0;
      rightAmount = overlap;
    } else {
      leftAmount = overlap;
      rightAmount = 0;
    }
  } else if (sameFaction && leftPriority !== rightPriority && !leftHard && !rightHard) {
    // Explicit friendly movement outranks yield-return movement, which in turn
    // outranks ordinary idle placement. Lower-priority friendlies step aside
    // but remember where to settle again after traffic clears.
    const leftWins = leftPriority > rightPriority;
    const moverId = leftWins ? leftId : rightId;
    const blockerId = leftWins ? rightId : leftId;
    if (tryFriendlyBlockerSidestep(moverId, blockerId, entities, navigation, minimumDistance)) return;
    rememberYieldReturn(blockerId, entities);
    if (leftWins) {
      leftAmount = 0;
      rightAmount = overlap;
    } else {
      leftAmount = overlap;
      rightAmount = 0;
    }
  } else if (sameFaction && leftMoving && rightMoving && !leftHard && !rightHard) {
    // In same-direction traffic, splitting correction equally lets rear units
    // push the front line backward and can lock a chokepoint. Give deterministic
    // right-of-way to the unit closer to completing its current destination;
    // EntityID breaks exact ties. The trailing unit absorbs the separation and
    // will replan from its corrected authoritative position if necessary.
    const leftRemaining = remainingTargetDistanceSquared(leftId, entities);
    const rightRemaining = remainingTargetDistanceSquared(rightId, entities);
    const leftWins = leftRemaining < rightRemaining
      || (leftRemaining === rightRemaining && leftId < rightId);
    if (leftWins) {
      leftAmount = 0;
      rightAmount = overlap;
    } else {
      leftAmount = overlap;
      rightAmount = 0;
    }
  } else if (leftHard && !rightHard) {
    leftAmount = 0;
    rightAmount = overlap;
  } else if (rightHard && !leftHard) {
    leftAmount = overlap;
    rightAmount = 0;
  } else if (!sameFaction && leftMoving !== rightMoving) {
    // Hostile bodies remain hard obstacles, but a forced mover may sidestep
    // around an idle defender instead of being pushed backward into its route.
    const moverId = leftMoving ? leftId : rightId;
    const blockerId = leftMoving ? rightId : leftId;
    if (tryMoverSidestep(moverId, blockerId, entities, navigation, minimumDistance)) return;
    if (leftMoving) {
      leftAmount = overlap;
      rightAmount = 0;
    } else {
      leftAmount = 0;
      rightAmount = overlap;
    }
  } else {
    leftAmount = Math.floor(overlap / 2);
    rightAmount = overlap - leftAmount;
  }

  const leftCandidate = displaced(left.x, left.z, axisX, axisZ, divisor, leftAmount, -1);
  const rightCandidate = displaced(right.x, right.z, axisX, axisZ, divisor, rightAmount, 1);
  const leftValid = leftAmount === 0 || canOccupy(leftCandidate.x, leftCandidate.z, navigation);
  const rightValid = rightAmount === 0 || canOccupy(rightCandidate.x, rightCandidate.z, navigation);

  if (leftValid && rightValid) {
    left.x = leftCandidate.x;
    left.z = leftCandidate.z;
    right.x = rightCandidate.x;
    right.z = rightCandidate.z;
    return;
  }

  // If terrain blocks the preferred correction, try the preferred unit
  // first, then allow the nominal anchor to absorb the correction as a last
  // resort. "Anchored" is a preference, never permission to interpenetrate.
  const tryFullLeft = (): boolean => {
    const fullLeft = displaced(left.x, left.z, axisX, axisZ, divisor, overlap, -1);
    if (!canOccupy(fullLeft.x, fullLeft.z, navigation)) return false;
    left.x = fullLeft.x;
    left.z = fullLeft.z;
    return true;
  };
  const tryFullRight = (): boolean => {
    const fullRight = displaced(right.x, right.z, axisX, axisZ, divisor, overlap, 1);
    if (!canOccupy(fullRight.x, fullRight.z, navigation)) return false;
    right.x = fullRight.x;
    right.z = fullRight.z;
    return true;
  };
  if (leftAmount >= rightAmount) {
    if (tryFullLeft()) return;
    tryFullRight();
  } else {
    if (tryFullRight()) return;
    tryFullLeft();
  }
}

/**
 * Deterministic bounded local separation. A* remains route authority; this
 * pass prevents hostile body penetration while allowing controlled soft overlap
 * between moving/combat friendlies. Stationary non-combat friendly clusters are
 * accepted as settled state, and units converging on the same exact destination
 * may merge inside the final arrival zone without corrective displacement.
 */
export function resolveUnitSeparation(entities: EntityStore, navigation: NavigationGrid): void {
  const entityIds = entities.entityIds().filter((entityId) => entities.hasUnit(entityId));
  if (entityIds.length < 2) return;

  for (let pass = 0; pass < RELAXATION_PASSES; pass += 1) {
    const buckets = buildBuckets(entityIds, entities);
    for (const leftId of entityIds) {
      if (!entities.hasUnit(leftId)) continue;
      const left = entities.positions.get(leftId)!;
      const bucket = bucketCoordinates(left.x, left.z);
      const candidates: EntityID[] = [];
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const ids = buckets.get(`${bucket.x + dx}:${bucket.z + dz}`);
          if (!ids) continue;
          for (const candidateId of ids) {
            if (candidateId > leftId) candidates.push(candidateId);
          }
        }
      }
      candidates.sort((a, b) => a - b);
      for (const rightId of candidates) {
        if (entities.hasUnit(rightId)) resolvePair(leftId, rightId, entities, navigation);
      }
    }
  }
}
