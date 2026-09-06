import type { EntityID, PlayerID } from './components';
import type { EntityStore } from './entity-store';
import type { NavigationGrid } from './navigation';
import { effectiveConductivity } from './conductivity';
import { SurfaceType, type TerrainState } from './terrain-state';

export const CHAIN_LIGHTNING_BASE_DAMAGE = 55;
export const CHAIN_LIGHTNING_WET_DAMAGE = Math.floor(CHAIN_LIGHTNING_BASE_DAMAGE * 125 / 100);
export const CHAIN_LIGHTNING_BASE_RANGE = 4_000;
export const CHAIN_LIGHTNING_WET_RANGE = 6_000;
export const CHAIN_LIGHTNING_MAX_ADDITIONAL_JUMPS = 4;

interface ChainCandidate {
  id: EntityID;
  conductivity: number;
  distanceSquared: number;
}

export function buildLightningChain(
  initialTargetId: EntityID,
  castingPlayerId: PlayerID,
  entities: EntityStore,
  terrain: TerrainState,
  navigation: NavigationGrid,
): EntityID[] {
  if (!isHostileAliveTarget(initialTargetId, castingPlayerId, entities)) return [];
  const chain = [initialTargetId];
  const hit = new Set<EntityID>(chain);

  while (chain.length <= CHAIN_LIGHTNING_MAX_ADDITIONAL_JUMPS) {
    const currentId = chain[chain.length - 1]!;
    const currentPosition = entities.positions.get(currentId)!;
    const currentSurface = terrain.surfaceAt(navigation.worldToCell(currentPosition.x, currentPosition.z));
    const currentIsWet = entities.statuses.get(currentId)?.wet === true || currentSurface === SurfaceType.WATER;
    const range = currentIsWet ? CHAIN_LIGHTNING_WET_RANGE : CHAIN_LIGHTNING_BASE_RANGE;
    const rangeSquared = range * range;
    const candidates: ChainCandidate[] = [];

    for (const candidateId of entities.entityIds()) {
      if (hit.has(candidateId) || !isHostileAliveTarget(candidateId, castingPlayerId, entities)) continue;
      const candidatePosition = entities.positions.get(candidateId)!;
      const deltaX = candidatePosition.x - currentPosition.x;
      const deltaZ = candidatePosition.z - currentPosition.z;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared > rangeSquared) continue;
      candidates.push({
        id: candidateId,
        conductivity: effectiveConductivity(candidateId, entities, terrain, navigation),
        distanceSquared,
      });
    }

    candidates.sort((left, right) => (
      right.conductivity - left.conductivity
      || left.distanceSquared - right.distanceSquared
      || left.id - right.id
    ));
    const next = candidates[0];
    if (!next) break;
    chain.push(next.id);
    hit.add(next.id);
  }
  return chain;
}

export function lightningDamage(entityId: EntityID, entities: EntityStore): number {
  return entities.statuses.get(entityId)?.wet === true
    ? CHAIN_LIGHTNING_WET_DAMAGE
    : CHAIN_LIGHTNING_BASE_DAMAGE;
}

function isHostileAliveTarget(entityId: EntityID, castingPlayerId: PlayerID, entities: EntityStore): boolean {
  return entities.hasUnit(entityId)
    && (entities.health.get(entityId)?.current ?? 0) > 0
    && entities.factions.get(entityId)?.playerId !== castingPlayerId;
}
