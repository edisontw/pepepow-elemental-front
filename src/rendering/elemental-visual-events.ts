import type { M04SimulationSnapshot } from '../simulation/m04-simulation';
import type { EntityID } from '../simulation/components';
import type { SimulationSnapshot } from '../simulation/simulation';

export function lightningDamageChain(
  previous: SimulationSnapshot,
  current: SimulationSnapshot,
): readonly EntityID[] {
  if (current.lastLightningChain.length === 0) return [];
  const previousHealth = new Map(previous.entities.map((entity) => [entity.id, entity.currentHealth]));
  const currentById = new Map(current.entities.map((entity) => [entity.id, entity]));
  const damaged = current.lastLightningChain.filter((entityId) => {
    const currentEntity = currentById.get(entityId);
    const priorHealth = previousHealth.get(entityId);
    return currentEntity !== undefined && priorHealth !== undefined && currentEntity.currentHealth < priorHealth;
  });
  return damaged.length > 0 ? [...current.lastLightningChain] : [];
}

export function addedVisualCells(previous: ReadonlySet<string>, current: ReadonlySet<string>): readonly string[] {
  const added: string[] = [];
  for (const key of current) if (!previous.has(key)) added.push(key);
  return added.sort();
}

export function removedVisualCells(previous: ReadonlySet<string>, current: ReadonlySet<string>): readonly string[] {
  const removed: string[] = [];
  for (const key of previous) if (!current.has(key)) removed.push(key);
  return removed.sort();
}

export function newlyWetVisibleEntities(
  previous: SimulationSnapshot,
  current: SimulationSnapshot,
): readonly EntityID[] {
  const cast = (current as Partial<M04SimulationSnapshot>).elementalAuthority?.lastCastResult;
  const v3Water = cast?.status === 'CAST' && cast.spellId === 'WATER_BURST' && cast.tick === current.tick;
  const legacyWater = current.lastTerrainEffect === 'WATER' && current.lastTerrainEffectTick === current.tick;
  if (!v3Water && !legacyWater) return [];
  const previousById = new Map(previous.entities.map((entity) => [entity.id, entity]));
  return current.entities
    .filter((entity) => {
      const prior = previousById.get(entity.id);
      return entity.alive
        && (entity.playerId === 0 || entity.visibleToPlayer)
        && entity.wet
        && prior !== undefined
        && !prior.wet;
    })
    .map((entity) => entity.id)
    .sort((left, right) => left - right);
}
