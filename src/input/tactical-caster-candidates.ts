import type { TacticalSpellId } from '../simulation/element-types';
import type { M04SimulationSnapshot } from '../simulation/m04-simulation';
import { TACTICAL_SPELLS } from '../simulation/spell-content';

export interface TacticalSpellReadiness {
  candidateCasterIds: readonly number[];
  alignedCasterCount: number;
  readyCasterCount: number;
  cooldownTicks: number | null;
  enoughMana: boolean;
}

export function globalTacticalCasterIds(
  snapshot: M04SimulationSnapshot,
  playerId: number,
): number[] {
  const living = new Set(
    snapshot.entities
      .filter((entity) => entity.playerId === playerId && entity.alive && entity.archetype === 'ELEMENTALIST')
      .map((entity) => entity.id),
  );
  return snapshot.elementalAuthority.alignedElementalists
    .filter((entry) => living.has(entry.entityId))
    .map((entry) => entry.entityId)
    .sort((left, right) => left - right);
}

export function tacticalSpellReadiness(
  snapshot: M04SimulationSnapshot,
  playerId: number,
  spellId: TacticalSpellId,
): TacticalSpellReadiness {
  const spell = TACTICAL_SPELLS[spellId];
  const candidates = globalTacticalCasterIds(snapshot, playerId);
  const alignmentById = new Map(
    snapshot.elementalAuthority.alignedElementalists.map((entry) => [entry.entityId, entry.element] as const),
  );
  const aligned = candidates.filter((entityId) => alignmentById.get(entityId) === spell.element);
  const cooldownByCasterSpell = new Map(
    snapshot.elementalAuthority.spells.tacticalCooldowns.map((cooldown) => [
      `${cooldown.casterEntityId}:${cooldown.spellId}`,
      cooldown.readyTick,
    ] as const),
  );
  const remaining = aligned.map((entityId) => Math.max(
    0,
    (cooldownByCasterSpell.get(`${entityId}:${spellId}`) ?? 0) - snapshot.tick,
  ));
  const readyCasterCount = remaining.filter((ticks) => ticks === 0).length;
  const mana = snapshot.elementalMana.players[playerId]?.currentManaMilli ?? 0;
  return {
    candidateCasterIds: candidates,
    alignedCasterCount: aligned.length,
    readyCasterCount,
    cooldownTicks: remaining.length === 0 ? null : Math.min(...remaining),
    enoughMana: mana >= spell.manaCostMilli,
  };
}
