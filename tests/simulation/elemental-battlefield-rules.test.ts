import { describe, expect, it } from 'vitest';
import {
  applyBurningUnitDamage,
  BURNING_UNIT_DAMAGE_PER_PULSE,
  BURNING_UNIT_DAMAGE_PULSE_TICKS,
} from '../../src/simulation/elemental-battlefield-rules';
import { Simulation } from '../../src/simulation/simulation';

function moveFirstUnitToWestForest(simulation: Simulation): number {
  const unitId = simulation.entities.entityIds()[0]!;
  const position = simulation.entities.positions.get(unitId)!;
  position.x = -14_000;
  position.z = 10_000;
  return unitId;
}

describe('M08 elemental battlefield rules', () => {
  it('turns burning woodland into deterministic area denial at 8 damage/sec baseline', () => {
    const simulation = new Simulation('m08-burning-hazard');
    const unitId = moveFirstUnitToWestForest(simulation);
    const health = simulation.entities.health.get(unitId)!;
    const initialHealth = health.current;

    simulation.terrain.applyEffects([{ effectId: 'FIRE', targetX: -14_000, targetZ: 10_000, radius: 2_000 }]);
    const firstPulseTick = (BURNING_UNIT_DAMAGE_PULSE_TICKS - (unitId % BURNING_UNIT_DAMAGE_PULSE_TICKS))
      % BURNING_UNIT_DAMAGE_PULSE_TICKS;
    const tick = firstPulseTick === 0 ? BURNING_UNIT_DAMAGE_PULSE_TICKS : firstPulseTick;
    expect(applyBurningUnitDamage(simulation.entities, simulation.terrain, simulation.navigation, tick)).toBe(1);
    expect(health.current).toBe(initialHealth - BURNING_UNIT_DAMAGE_PER_PULSE);
  });

  it('does not damage a unit outside active burning vegetation', () => {
    const simulation = new Simulation('m08-burning-safe');
    const unitId = simulation.entities.entityIds()[0]!;
    const health = simulation.entities.health.get(unitId)!;
    const initialHealth = health.current;
    const tick = BURNING_UNIT_DAMAGE_PULSE_TICKS - (unitId % BURNING_UNIT_DAMAGE_PULSE_TICKS);

    expect(applyBurningUnitDamage(simulation.entities, simulation.terrain, simulation.navigation, tick)).toBe(0);
    expect(health.current).toBe(initialHealth);
  });
});
