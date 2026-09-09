import { describe, expect, it } from 'vitest';
import {
  addedVisualCells,
  lightningDamageChain,
  newlyWetVisibleEntities,
  removedVisualCells,
} from '../../src/rendering/elemental-visual-events';
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

  it('derives added and removed visual cells deterministically', () => {
    const previous = new Set(['2,3', '1,1', '4,4']);
    const current = new Set(['4,4', '6,2', '0,7']);
    expect(addedVisualCells(previous, current)).toEqual(['0,7', '6,2']);
    expect(removedVisualCells(previous, current)).toEqual(['1,1', '2,3']);
  });

  it('derives visible newly-wet Water Burst targets only on the authoritative cast tick', () => {
    const [previous, current] = snapshots();
    const target = current.entities[0]!;
    const waterFrame = {
      ...current,
      lastTerrainEffect: 'WATER' as const,
      lastTerrainEffectTick: current.tick,
      entities: current.entities.map((entity) => entity.id === target.id
        ? { ...entity, wet: true, wetTicks: 10, visibleToPlayer: true }
        : entity),
    };
    expect(newlyWetVisibleEntities(previous, waterFrame)).toEqual([target.id]);
    expect(newlyWetVisibleEntities(previous, { ...waterFrame, lastTerrainEffectTick: current.tick - 1 })).toEqual([]);
  });

  it('shows v3 Water Burst without requiring the legacy terrain event', () => {
    const [previous, current] = snapshots();
    const target = current.entities[0]!;
    const v3Frame = {
      ...current,
      elementalAuthority: { lastCastResult: { tick: current.tick, status: 'CAST', spellId: 'WATER_BURST' } },
      entities: current.entities.map((entity) => entity.id === target.id
        ? { ...entity, wet: true, wetTicks: 10, visibleToPlayer: true } : entity),
    };
    expect(newlyWetVisibleEntities(previous, v3Frame)).toEqual([target.id]);
    const noCast = { ...v3Frame, elementalAuthority: undefined };
    expect(newlyWetVisibleEntities(previous, noCast)).toEqual([]);
  });

});
