import { describe, it, expect } from 'vitest';
import { generateWorld } from '../../src/world/generator';
import { BiomeType, TerrainType, WorldCellFlag } from '../../src/world/world-definition';
import { environmentPlacements } from '../../src/rendering/environment-placement-system';

describe('asset-backed environment placement', () => {
  it('preserves source cells, avoids roads/water, and thins across the map in low quality', () => {
    const world = generateWorld(42);
    const before = { terrain: [...world.terrain], flags: [...world.flags], biome: [...world.biome] };
    const full = environmentPlacements(world, false);
    const low = environmentPlacements(world, true);
    expect(environmentPlacements(world, false)).toEqual(full);
    expect(low.length).toBeLessThan(full.length);
    const fullTrees = full.filter(p => p.sheet === 'trees');
    const woodlandCells = Array.from(world.biome).filter(biome => biome === BiomeType.WOODLAND).length;
    const woodlandTrees = fullTrees.filter(p => world.biome[p.cell] === BiomeType.WOODLAND);
    expect(new Set(fullTrees.map(p => p.frame)).size).toBe(6);
    // Full-quality woodland should read as a continuous terrain mass rather than
    // isolated decorative trees. This is presentation density only.
    expect(woodlandTrees.length).toBeGreaterThan(woodlandCells * 0.25);
    for (const p of full) {
      expect(world.terrain[p.cell]).toBe(TerrainType.GROUND);
      expect((world.flags[p.cell]! & WorldCellFlag.ROUTE)).toBe(0);
      expect(p.cell).toBe(Math.floor(p.z + Math.floor(world.height / 2)) * world.width + Math.floor(p.x + Math.floor(world.width / 2)));
    }
    expect({ terrain: [...world.terrain], flags: [...world.flags], biome: [...world.biome] }).toEqual(before);
  });
});
