import { describe, expect, it } from 'vitest';
import { globalTacticalCasterIds, tacticalSpellReadiness } from '../../src/input/tactical-caster-candidates';
import { M04Simulation } from '../../src/simulation/m04-simulation';
import { UNITS } from '../../src/simulation/m03-content';
import { generateWorld } from '../../src/world/generator';

function simulation(): M04Simulation {
  return new M04Simulation(generateWorld(4_950_628), { playerManaRules: true });
}

describe('P5-A2 Global Tactical caster candidates', () => {
  it('returns every living aligned player Elementalist in stable EntityID order', () => {
    const sim = simulation();
    const anchor = sim.snapshot().entities.find((entity) => entity.playerId === 0)!;
    const def = UNITS.ELEMENTALIST;
    const second = sim.entities.createUnit({
      archetype: 'ELEMENTALIST', playerId: 0, x: anchor.x + 2_000, z: anchor.z, ...def.spawn,
    });
    const first = sim.entities.createUnit({
      archetype: 'ELEMENTALIST', playerId: 0, x: anchor.x + 1_000, z: anchor.z, ...def.spawn,
    });
    const enemy = sim.entities.createUnit({
      archetype: 'ELEMENTALIST', playerId: 1, x: anchor.x + 3_000, z: anchor.z, ...def.spawn,
    });
    sim.entities.setElementalAlignment(second, 'FIRE');
    sim.entities.setElementalAlignment(first, 'WATER');
    sim.entities.setElementalAlignment(enemy, 'ICE');

    expect(globalTacticalCasterIds(sim.snapshot(), 0)).toEqual([second, first].sort((a, b) => a - b));

    sim.entities.health.get(first)!.alive = false;
    expect(globalTacticalCasterIds(sim.snapshot(), 0)).toEqual([second]);
  });

  it('reports readiness across all aligned casters rather than current unit selection', () => {
    const sim = simulation();
    const anchor = sim.snapshot().entities.find((entity) => entity.playerId === 0)!;
    const def = UNITS.ELEMENTALIST;
    const caster = sim.entities.createUnit({
      archetype: 'ELEMENTALIST', playerId: 0, x: anchor.x + 1_000, z: anchor.z, ...def.spawn,
    });
    sim.entities.setElementalAlignment(caster, 'FIRE');
    sim.visibility.update(sim.entities, sim.navigation);

    const before = tacticalSpellReadiness(sim.snapshot(), 0, 'FIREBOLT');
    expect(before.alignedCasterCount).toBe(1);
    expect(before.readyCasterCount).toBe(1);
    expect(before.enoughMana).toBe(true);

    sim.enqueueCommand({
      type: 'CAST_TACTICAL',
      targetTick: 1,
      playerId: 0,
      spellId: 'FIREBOLT',
      candidateCasterIds: globalTacticalCasterIds(sim.snapshot(), 0),
      target: { kind: 'POINT', x: anchor.x + 1_500, z: anchor.z },
    });
    const frame = sim.step();
    expect(frame.elementalAuthority.lastCastResult?.status).toBe('CAST');

    const after = tacticalSpellReadiness(frame, 0, 'FIREBOLT');
    expect(after.alignedCasterCount).toBe(1);
    expect(after.readyCasterCount).toBe(0);
    expect(after.cooldownTicks).toBeGreaterThan(0);
  });
});
