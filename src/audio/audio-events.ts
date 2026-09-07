import type { EntityID } from '../simulation/components';
import type { EntitySnapshot, SimulationSnapshot } from '../simulation/simulation';

export type AudioCueId =
  | 'sfx.combat.attack'
  | 'sfx.combat.hit'
  | 'sfx.combat.death'
  | 'sfx.element.fire-ignite'
  | 'sfx.element.ice-form'
  | 'sfx.element.ice-break'
  | 'sfx.element.lightning-chain';

export interface AudioCue {
  id: AudioCueId;
  intensity: 1 | 2 | 3;
}

function intensityFromCount(count: number): 1 | 2 | 3 {
  if (count >= 3) return 3;
  if (count === 2) return 2;
  return 1;
}

function snapshotMap(snapshot: SimulationSnapshot): Map<EntityID, EntitySnapshot> {
  return new Map(snapshot.entities.map((entity) => [entity.id, entity]));
}

function newlyDamagedLightningTargets(
  previousById: ReadonlyMap<EntityID, EntitySnapshot>,
  current: SimulationSnapshot,
): ReadonlySet<EntityID> {
  if (current.lastLightningChain.length === 0) return new Set();
  const currentById = snapshotMap(current);
  const hasNewDamage = current.lastLightningChain.some((entityId) => {
    const prior = previousById.get(entityId);
    const entity = currentById.get(entityId);
    return prior !== undefined && entity !== undefined && entity.currentHealth < prior.currentHealth;
  });
  return hasNewDamage ? new Set(current.lastLightningChain) : new Set();
}

export function deriveAudioCues(
  previous: SimulationSnapshot,
  current: SimulationSnapshot,
): readonly AudioCue[] {
  if (current.tick === previous.tick) return [];

  const cues: AudioCue[] = [];
  const previousById = snapshotMap(previous);
  const lightningTargets = newlyDamagedLightningTargets(previousById, current);
  let visibleAttacks = 0;
  let visibleHits = 0;
  let visibleDeaths = 0;

  for (const entity of current.entities) {
    const prior = previousById.get(entity.id);
    if (!prior || !prior.visibleToPlayer) continue;
    if (
      entity.alive
      && entity.attackTargetEntityId !== null
      && entity.nextAttackTick > prior.nextAttackTick
    ) visibleAttacks += 1;
    if (prior.alive && !entity.alive) visibleDeaths += 1;
    if (
      prior.alive
      && entity.currentHealth < prior.currentHealth
      && !lightningTargets.has(entity.id)
    ) visibleHits += 1;
  }

  if (current.terrain.burning > previous.terrain.burning) {
    cues.push({
      id: 'sfx.element.fire-ignite',
      intensity: intensityFromCount(current.terrain.burning - previous.terrain.burning),
    });
  }
  if (current.terrain.ice > previous.terrain.ice) {
    cues.push({
      id: 'sfx.element.ice-form',
      intensity: intensityFromCount(current.terrain.ice - previous.terrain.ice),
    });
  } else if (current.terrain.ice < previous.terrain.ice) {
    cues.push({
      id: 'sfx.element.ice-break',
      intensity: intensityFromCount(previous.terrain.ice - current.terrain.ice),
    });
  }
  if (lightningTargets.size > 0) {
    cues.push({
      id: 'sfx.element.lightning-chain',
      intensity: intensityFromCount(lightningTargets.size),
    });
  }
  if (visibleAttacks > 0) {
    cues.push({ id: 'sfx.combat.attack', intensity: intensityFromCount(visibleAttacks) });
  }
  if (visibleDeaths > 0) {
    cues.push({ id: 'sfx.combat.death', intensity: intensityFromCount(visibleDeaths) });
  }
  if (visibleHits > 0) {
    cues.push({ id: 'sfx.combat.hit', intensity: intensityFromCount(visibleHits) });
  }

  return cues;
}
