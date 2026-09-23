import { WORLD_UNITS_PER_METER } from './arena';
import type { EntityID } from './components';
import type { EntityStore } from './entity-store';
import type { NavigationGrid } from './navigation';

const BUCKET_SIZE = 2 * WORLD_UNITS_PER_METER;
const RELAXATION_PASSES = 3;
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

  const minimumDistance = leftBody.radius + rightBody.radius + UNIT_CONTACT_PADDING;
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

  const sameFaction = entities.factions.get(leftId)?.playerId === entities.factions.get(rightId)?.playerId;
  const leftHard = isHardAnchor(leftId, entities);
  const rightHard = isHardAnchor(rightId, entities);
  const leftMoving = hasMovementIntent(leftId, entities);
  const rightMoving = hasMovementIntent(rightId, entities);
  const leftPriority = movementPriority(leftId, entities);
  const rightPriority = movementPriority(rightId, entities);

  let leftAmount: number;
  let rightAmount: number;

  if (sameFaction && leftPriority !== rightPriority && !leftHard && !rightHard) {
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
 * pass only prevents living unit bodies from occupying the same ground space.
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
