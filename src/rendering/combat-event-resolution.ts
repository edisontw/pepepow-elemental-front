import type { EntityID } from '../simulation/components';
import type { EntitySnapshot } from '../simulation/simulation';

/**
 * Presentation-only attack-event resolver.
 *
 * Authoritative combat can kill a target and clear the attack target in the same
 * fixed tick. nextAttackTick still advances on the actual strike, so presentation
 * may safely fall back to the prior target for that one completed attack event.
 */
export function presentationAttackTargetId(
  previous: EntitySnapshot,
  current: EntitySnapshot,
): EntityID | null {
  if (current.nextAttackTick <= previous.nextAttackTick) return null;
  return current.attackTargetEntityId ?? previous.attackTargetEntityId;
}
