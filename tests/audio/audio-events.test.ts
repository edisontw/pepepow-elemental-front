import { describe, expect, it } from 'vitest';
import { deriveAudioCues } from '../../src/audio/audio-events';
import { Simulation } from '../../src/simulation/simulation';

function snapshots(): [ReturnType<Simulation['snapshot']>, ReturnType<Simulation['snapshot']>] {
  const simulation = new Simulation('m08-audio-events');
  const previous = simulation.snapshot();
  simulation.step();
  return [previous, simulation.snapshot()];
}

describe('M08 audio event derivation', () => {
  it('derives elemental transition cues from authoritative snapshot deltas', () => {
    const [previous, current] = snapshots();
    const changed = {
      ...current,
      terrain: {
        ...current.terrain,
        burning: previous.terrain.burning + 2,
        ice: previous.terrain.ice + 3,
      },
    };
    expect(deriveAudioCues(previous, changed)).toEqual([
      { id: 'sfx.element.fire-ignite', intensity: 2 },
      { id: 'sfx.element.ice-form', intensity: 3 },
    ]);
  });

  it('plays a lightning cue only when the authoritative chain caused new damage', () => {
    const [previous, current] = snapshots();
    const target = current.entities[0]!;
    const stale = { ...current, lastLightningChain: [target.id] };
    expect(deriveAudioCues(previous, stale)).toEqual([]);

    const damaged = {
      ...current,
      lastLightningChain: [target.id, current.entities[1]!.id],
      entities: current.entities.map((entity) => entity.id === target.id
        ? { ...entity, currentHealth: entity.currentHealth - 1 }
        : entity),
    };
    expect(deriveAudioCues(previous, damaged)).toEqual([
      { id: 'sfx.element.lightning-chain', intensity: 2 },
    ]);
  });

  it('derives an attack cue from the same authoritative attack-tick transition used by projectile feedback', () => {
    const [previous, current] = snapshots();
    const attacker = current.entities[0]!;
    const target = current.entities[1]!;
    const attacking = {
      ...current,
      entities: current.entities.map((entity) => entity.id === attacker.id
        ? {
          ...entity,
          attackTargetEntityId: target.id,
          nextAttackTick: Math.max(entity.nextAttackTick, previous.entities[0]!.nextAttackTick + 1),
        }
        : entity),
    };
    expect(deriveAudioCues(previous, attacking)).toContainEqual({ id: 'sfx.combat.attack', intensity: 1 });
  });

  it('aggregates visible combat hit and death feedback without changing simulation state', () => {
    const [previous, current] = snapshots();
    const first = current.entities[0]!;
    const second = current.entities[1]!;
    const changed = {
      ...current,
      entities: current.entities.map((entity) => {
        if (entity.id === first.id) return { ...entity, currentHealth: entity.currentHealth - 1 };
        if (entity.id === second.id) return { ...entity, currentHealth: 0, alive: false };
        return entity;
      }),
    };
    expect(deriveAudioCues(previous, changed)).toEqual([
      { id: 'sfx.combat.death', intensity: 1 },
      { id: 'sfx.combat.hit', intensity: 2 },
    ]);
    expect(previous.entities.every((entity) => entity.alive)).toBe(true);
  });
});
