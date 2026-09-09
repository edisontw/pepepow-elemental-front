import { describe, expect, it } from 'vitest';
import { M04Simulation } from '../../src/simulation/m04-simulation';
import { UNITS } from '../../src/simulation/m03-content';
import { generateWorld } from '../../src/world/generator';

function createHarness(): { simulation: M04Simulation; casters: [number, number]; target: { x: number; z: number } } {
  const simulation = new M04Simulation(generateWorld(4_950_628), { playerManaRules: true });
  const anchor = simulation.snapshot().entities.find((entity) => entity.playerId === 0)!;
  const definition = UNITS.ELEMENTALIST;
  const first = simulation.entities.createUnit({
    archetype: 'ELEMENTALIST', playerId: 0, x: anchor.x + 500, z: anchor.z, ...definition.spawn,
  });
  const second = simulation.entities.createUnit({
    archetype: 'ELEMENTALIST', playerId: 0, x: anchor.x + 1_500, z: anchor.z, ...definition.spawn,
  });
  simulation.entities.setElementalAlignment(first, 'FIRE');
  simulation.entities.setElementalAlignment(second, 'FIRE');
  simulation.visibility.update(simulation.entities, simulation.navigation);
  return { simulation, casters: [first, second], target: { x: anchor.x + 750, z: anchor.z } };
}

describe('post-roadmap Tactical spell authority', () => {
  it('selects the same nearest valid caster independent of selection order', () => {
    const left = createHarness();
    const right = createHarness();
    left.simulation.enqueueCommand({
      type: 'CAST_TACTICAL', targetTick: 1, playerId: 0, spellId: 'FIREBOLT',
      candidateCasterIds: [left.casters[1], left.casters[0]], target: { kind: 'POINT', ...left.target },
    });
    right.simulation.enqueueCommand({
      type: 'CAST_TACTICAL', targetTick: 1, playerId: 0, spellId: 'FIREBOLT',
      candidateCasterIds: [right.casters[0], right.casters[1]], target: { kind: 'POINT', ...right.target },
    });
    const leftFrame = left.simulation.step();
    const rightFrame = right.simulation.step();
    expect(leftFrame.elementalAuthority.lastCastResult?.status).toBe('CAST');
    expect(leftFrame.elementalAuthority.lastCastResult?.casterEntityId).toBe(left.casters[0]);
    expect(rightFrame.elementalAuthority.lastCastResult?.casterEntityId).toBe(right.casters[0]);
    expect(leftFrame.stateHash).toBe(rightFrame.stateHash);
  });

  it('uses caster-local cooldown so a second aligned caster can cast next', () => {
    const { simulation, casters, target } = createHarness();
    simulation.enqueueCommand({
      type: 'CAST_TACTICAL', targetTick: 1, playerId: 0, spellId: 'FIREBOLT',
      candidateCasterIds: casters, target: { kind: 'POINT', ...target },
    });
    simulation.step();
    simulation.enqueueCommand({
      type: 'CAST_TACTICAL', targetTick: 2, playerId: 0, spellId: 'FIREBOLT',
      candidateCasterIds: casters, target: { kind: 'POINT', ...target },
    });
    const frame = simulation.step();
    expect(frame.elementalAuthority.lastCastResult?.status).toBe('CAST');
    expect(frame.elementalAuthority.lastCastResult?.casterEntityId).toBe(casters[1]);
  });

  it('rejects an Attuned spell when no candidate has the matching alignment and spends no Mana', () => {
    const { simulation, casters, target } = createHarness();
    const before = simulation.strategy.snapshot().resources[0]!.manaMilli;
    simulation.enqueueCommand({
      type: 'CAST_TACTICAL', targetTick: 1, playerId: 0, spellId: 'WATER_BURST',
      candidateCasterIds: casters, target: { kind: 'POINT', ...target },
    });
    const frame = simulation.step();
    expect(frame.elementalAuthority.lastCastResult?.status).toBe('INVALID');
    expect(frame.strategic.resources[0]!.manaMilli).toBe(before + 50);
    expect(frame.elementalAuthority.spells.tacticalCooldowns).toHaveLength(0);
  });
});
