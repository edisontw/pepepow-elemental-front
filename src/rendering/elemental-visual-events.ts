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

export function removedVisualCells(previous: ReadonlySet<string>, current: ReadonlySet<string>): readonly string[] {
  const removed: string[] = [];
  for (const key of previous) if (!current.has(key)) removed.push(key);
  return removed.sort();
}
