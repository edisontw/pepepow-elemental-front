import { describe, expect, it } from 'vitest';
import { generateWorld } from '../../src/world/generator';
import { M02_STANDARD_RULES, TerrainType } from '../../src/world/world-definition';
import { createWorldIdentity, createWorldRng } from '../../src/world/world-seed';

const GOLDEN_BLOCKS = [
  { blockHeight: 0, hash: 'cf60d3e5' },
  { blockHeight: 1, hash: '946adf84' },
  { blockHeight: 42, hash: 'f7573142' },
  { blockHeight: 1000, hash: '7cb8fcbd' },
  { blockHeight: 123456, hash: 'c57d9fe7' },
  { blockHeight: 9999999, hash: 'a3fd0868' },
] as const;

describe('M02 procedural battlefield', () => {
  it('reproduces the same world for the same block and ruleset', () => {
    const first = generateWorld(8_765_432);
    const second = generateWorld(8_765_432);
    expect(second.gameplayHash).toBe(first.gameplayHash);
    expect(second.generationAttempt).toBe(first.generationAttempt);
    expect(second.elevation).toEqual(first.elevation);
    expect(second.terrain).toEqual(first.terrain);
    expect(second.regionByCell).toEqual(first.regionByCell);
    expect(second.resources).toEqual(first.resources);
    expect(second.pois).toEqual(first.pois);
    expect(second.spawns).toEqual(first.spawns);
  });

  it('keeps gameplay placement independent from visual RNG changes', () => {
    const first = generateWorld(42, M02_STANDARD_RULES, { visualSalt: 'visual-a' });
    const second = generateWorld(42, M02_STANDARD_RULES, { visualSalt: 'visual-b' });
    expect(second.gameplayHash).toBe(first.gameplayHash);
    expect(second.resources).toEqual(first.resources);
    expect(second.pois).toEqual(first.pois);
    expect(second.spawns).toEqual(first.spawns);
    expect(second.visualVariant).not.toEqual(first.visualVariant);
  });

  it('derives independent deterministic RNG streams from world identity', () => {
    const identity = createWorldIdentity(1234, M02_STANDARD_RULES.rulesetVersion);
    const terrainA = createWorldRng(identity, 'elevation', 0);
    const terrainB = createWorldRng(identity, 'elevation', 0);
    const visual = createWorldRng(identity, 'visual', 0);
    const terrainSequenceA = Array.from({ length: 8 }, () => terrainA.nextUint32());
    const terrainSequenceB = Array.from({ length: 8 }, () => terrainB.nextUint32());
    const visualSequence = Array.from({ length: 8 }, () => visual.nextUint32());
    expect(terrainSequenceB).toEqual(terrainSequenceA);
    expect(visualSequence).not.toEqual(terrainSequenceA);
  });

  it('binds battlefield identity to the ruleset version', () => {
    const first = generateWorld(77, { ...M02_STANDARD_RULES, rulesetVersion: 'm02-rules-a' });
    const second = generateWorld(77, { ...M02_STANDARD_RULES, rulesetVersion: 'm02-rules-b' });
    expect(second.identity.masterSeed).not.toBe(first.identity.masterSeed);
    expect(second.gameplayHash).not.toBe(first.gameplayHash);
  });

  it('reproduces deterministic generation retries', () => {
    const retryRules = {
      ...M02_STANDARD_RULES,
      rulesetVersion: 'm02-retry-test-v1',
      minimumQualityScore: 95,
      maxGenerationAttempts: 8,
    };
    const first = generateWorld(700_000, retryRules);
    const second = generateWorld(700_000, retryRules);
    expect(first.generationAttempt).toBe(2);
    expect(first.quality.score).toBeGreaterThanOrEqual(95);
    expect(first.gameplayHash).toBe('f06eb83d');
    expect(second.generationAttempt).toBe(first.generationAttempt);
    expect(second.gameplayHash).toBe(first.gameplayHash);
  });

  it.each(GOLDEN_BLOCKS)('matches Golden Block $blockHeight', ({ blockHeight, hash }) => {
    const world = generateWorld(blockHeight);
    expect(world.validation.hardFailures).toEqual([]);
    expect(world.gameplayHash).toBe(hash);
  });

  it('produces legible strategic regions, routes, crossings, resources, and sites', () => {
    const world = generateWorld(31_337);
    expect(world.regions).toHaveLength(12);
    expect(world.routes.length).toBeGreaterThanOrEqual(13);
    expect(world.quality.routeCycleCount).toBeGreaterThanOrEqual(2);
    expect(Math.min(...world.regions.map((region) => region.cellCount))).toBeGreaterThanOrEqual(1300);
    expect(world.resources.filter((resource) => resource.type === 'MATERIAL')).toHaveLength(10);
    expect(world.resources.filter((resource) => resource.type === 'MANA')).toHaveLength(5);
    expect(world.pois.filter((poi) => poi.type === 'SHRINE')).toHaveLength(6);
    expect(world.terrain.filter((terrain) => terrain === TerrainType.CROSSING).length).toBeGreaterThanOrEqual(18);
    expect(world.objective.id).toBe('OBJECTIVE');
    expect(world.boss.id).toBe('BOSS');
  });

  it('passes hard invariants across 2,048 deterministic block seeds', () => {
    for (let offset = 0; offset < 2_048; offset += 1) {
      const world = generateWorld(1_000_000 + offset);
      expect(world.validation.hardFailures, `block ${1_000_000 + offset}`).toEqual([]);
      expect(world.quality.score, `block ${1_000_000 + offset}`).toBeGreaterThanOrEqual(M02_STANDARD_RULES.minimumQualityScore);
    }
  }, 30_000);
});
