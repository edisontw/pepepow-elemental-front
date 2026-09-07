import { describe, expect, it } from 'vitest';
import { lightningDamageChain, removedVisualCells } from '../../src/rendering/elemental-visual-events';
import { Simulation } from '../../src/simulation/simulation';

function snapshots(): [ReturnType<Simulation['snapshot']>, ReturnType<Simulation['snapshot']>] {
  const simulation = new Simulation('m08-elemental-events');
  const previous = simulation.snapshot();
  simulation.step();
  return [previous, simulation.snapshot()];
}

describe('M08 elemental visual event derivation', () => {
  it('does not pulse a stale lightning chain without new damage', () => {
    const [previous, current] = snapshots();
    const stale = { ...current, lastLightningChain: [current.entities[0]!.id] };
    expect(lightningDamageChain(previous, stale)).toEqual([]);
  });

  it('returns the authoritative chain when one of its members takes new damage', () => {
    const [previous, current] = snapshots();
    const target = current.entities[0]!;
    const damaged = {
      ...current,
      lastLightningChain: [target.id, current.entities[1]!.id],
      entities: current.entities.map((entity) => entity.id === target.id
        ? { ...entity, currentHealth: entity.currentHealth - 1 }
        : entity),
    };
    expect(lightningDamageChain(previous, damaged)).toEqual(damaged.lastLightningChain);
  });

  it('derives removed visual cells deterministically', () => {
    expect(removedVisualCells(new Set(['2,3', '1,1', '4,4']), new Set(['4,4']))).toEqual(['1,1', '2,3']);
  });
});
