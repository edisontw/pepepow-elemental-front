import { describe, expect, it } from 'vitest';
import type { UnitArchetype } from '../../src/simulation/components';
import { M06Simulation } from '../../src/simulation/m06-simulation';
import { addMissingVisualQaUnits } from '../../src/simulation/visual-qa-roster';
import { generateWorld } from '../../src/world/generator';

const EXPECTED_ARCHETYPES: readonly UnitArchetype[] = [
  'VANGUARD',
  'SPEAR_GUARD',
  'RANGER',
  'SCOUT',
  'ELEMENTALIST',
  'ENGINEER',
  'GOLEM',
  'SIEGE_CONSTRUCT',
];

describe('visual QA roster', () => {
  it('adds every missing player archetype without changing the enemy starting army', () => {
    const simulation = new M06Simulation(generateWorld(1_000_000), { difficulty: 'CASUAL' });
    const enemyBefore = simulation.snapshot().entities.filter((entity) => entity.playerId === 1).length;

    addMissingVisualQaUnits(simulation);

    const snapshot = simulation.snapshot();
    const playerArchetypes = new Set(
      snapshot.entities.filter((entity) => entity.playerId === 0).map((entity) => entity.archetype),
    );
    for (const archetype of EXPECTED_ARCHETYPES) expect(playerArchetypes.has(archetype), archetype).toBe(true);
    expect(snapshot.entities.filter((entity) => entity.playerId === 1)).toHaveLength(enemyBefore);

    const elementalistId = snapshot.entities.find((entity) => (
      entity.playerId === 0 && entity.archetype === 'ELEMENTALIST'
    ))?.id;
    expect(elementalistId).toBeDefined();
    expect(simulation.entities.elementalAlignments.get(elementalistId!)?.element)
      .toBe(simulation.attunements.starting(0)[0]);
  });
});
