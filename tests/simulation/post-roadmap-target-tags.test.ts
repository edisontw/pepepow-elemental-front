import { describe, expect, it } from 'vitest';
import { M04Simulation } from '../../src/simulation/m04-simulation';
import { UNITS } from '../../src/simulation/m03-content';
import { dynamicUnitTags, staticBuildingTags, staticUnitTags } from '../../src/simulation/target-tags';
import { generateWorld } from '../../src/world/generator';

describe('post-roadmap target tags', () => {
  it('assigns readable static jobs without a hidden armor table', () => {
    expect(staticUnitTags('GOLEM')).toEqual(['HEAVY', 'METAL']);
    expect(staticUnitTags('SIEGE_CONSTRUCT')).toEqual(['HEAVY', 'METAL', 'RANGED', 'SIEGE']);
    expect(staticUnitTags('ELEMENTALIST')).toEqual(['LIGHT', 'RANGED', 'ELEMENTAL', 'ARCANE', 'SUPPORT']);
  });

  it('derives Wet and Conductive from authoritative state', () => {
    const simulation = new M04Simulation(generateWorld(4_950_628), { playerManaRules: true });
    const anchor = simulation.snapshot().entities.find((entity) => entity.playerId === 0)!;
    const definition = UNITS.GOLEM;
    const golem = simulation.entities.createUnit({
      archetype: 'GOLEM',
      playerId: 0,
      x: anchor.x,
      z: anchor.z,
      ...definition.spawn,
    });
    expect(dynamicUnitTags(golem, simulation.entities, simulation.terrain, simulation.navigation)).toContain('CONDUCTIVE');
    const status = simulation.entities.statuses.get(golem)!;
    status.wet = true;
    status.wetTicks = 10;
    expect(dynamicUnitTags(golem, simulation.entities, simulation.terrain, simulation.navigation)).toEqual(
      expect.arrayContaining(['WET', 'CONDUCTIVE']),
    );
  });

  it('derives Arcane relay and Fortified resource tags from building state', () => {
    const simulation = new M04Simulation(generateWorld(4_950_628), { playerManaRules: true });
    const core = simulation.strategy.snapshot().buildings.find((building) => building.type === 'ELEMENTAL_CORE')!;
    expect(staticBuildingTags(core)).toEqual(expect.arrayContaining(['BUILDING', 'FORTIFIED', 'ARCANE']));
    const relay = { ...core, type: 'OUTPOST' as const, specialization: 'MANA_BEACON' as const, resourceDefenseLevel: 0 as const };
    expect(staticBuildingTags(relay)).toEqual(expect.arrayContaining(['BUILDING', 'ARCANE']));
  });
});
