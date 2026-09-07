import { describe, expect, it } from 'vitest';
import { createEnvironmentVisualLayout, MAX_ENVIRONMENT_PROPS } from '../../src/rendering/environment-visual-layout';
import { generateWorld } from '../../src/world/generator';
import { BiomeType, TerrainType, WorldCellFlag } from '../../src/world/world-definition';

describe('M08 environment visual layout', () => {
  it('is deterministic and bounded for the same generated world', () => {
    const world = generateWorld(42);
    const first = createEnvironmentVisualLayout(world);
    const second = createEnvironmentVisualLayout(world);
    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(MAX_ENVIRONMENT_PROPS);
  });

  it('changes with the visual salt without changing gameplay identity', () => {
    const firstWorld = generateWorld(42, undefined, { visualSalt: 'm08-layout-a' });
    const secondWorld = generateWorld(42, undefined, { visualSalt: 'm08-layout-b' });
    expect(secondWorld.gameplayHash).toBe(firstWorld.gameplayHash);
    expect(secondWorld.visualVariant).not.toEqual(firstWorld.visualVariant);
    expect(createEnvironmentVisualLayout(secondWorld)).not.toEqual(createEnvironmentVisualLayout(firstWorld));
  });

  it('keeps props on presentation-appropriate cells and off strategic routes', () => {
    const world = generateWorld(1_000_000);
    const layout = createEnvironmentVisualLayout(world);
    for (const prop of layout) {
      const index = prop.cellZ * world.width + prop.cellX;
      const terrain = world.terrain[index];
      const biome = world.biome[index];
      if (prop.kind === 'WOODLAND_TREE') {
        expect(terrain).toBe(TerrainType.GROUND);
        expect(biome).toBe(BiomeType.WOODLAND);
        expect((world.flags[index]! & WorldCellFlag.ROUTE) === 0).toBe(true);
      } else if (prop.kind === 'HIGHLAND_ROCK') {
        expect(terrain).toBe(TerrainType.GROUND);
        expect(biome).toBe(BiomeType.HIGHLANDS);
        expect((world.flags[index]! & WorldCellFlag.ROUTE) === 0).toBe(true);
      } else {
        expect(terrain).toBe(TerrainType.WATER);
      }
      expect(prop.scale).toBeGreaterThan(0);
      expect(Math.abs(prop.offsetX)).toBeLessThanOrEqual(0.22);
      expect(Math.abs(prop.offsetZ)).toBeLessThanOrEqual(0.22);
    }
  });
});
