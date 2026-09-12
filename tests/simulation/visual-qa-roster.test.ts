import { describe, expect, it } from 'vitest';
import type { UnitArchetype } from '../../src/simulation/components';
import { ELEMENT_IDS } from '../../src/simulation/element-types';
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
  it('adds every visual unit and all four Elementalist alignments without changing the enemy starting army', () => {
    const simulation = new M06Simulation(generateWorld(1_000_000), { difficulty: 'CASUAL' });
    const enemyBefore = simulation.snapshot().entities.filter((entity) => entity.playerId === 1).length;

    addMissingVisualQaUnits(simulation);

    const snapshot = simulation.snapshot();
    const playerEntities = snapshot.entities.filter((entity) => entity.playerId === 0);
    const playerArchetypes = new Set(playerEntities.map((entity) => entity.archetype));
    for (const archetype of EXPECTED_ARCHETYPES) expect(playerArchetypes.has(archetype), archetype).toBe(true);
    expect(snapshot.entities.filter((entity) => entity.playerId === 1)).toHaveLength(enemyBefore);

    const playerElementalistAlignments = playerEntities
      .filter((entity) => entity.archetype === 'ELEMENTALIST')
      .map((entity) => simulation.entities.elementalAlignments.get(entity.id)?.element)
      .filter((element): element is (typeof ELEMENT_IDS)[number] => element !== undefined);
    expect(new Set(playerElementalistAlignments)).toEqual(new Set(ELEMENT_IDS));
  });
});
