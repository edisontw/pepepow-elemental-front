import { describe, expect, it } from 'vitest';
import { generateWorld } from '../../src/world/generator';
import { environmentPlacements } from '../../src/rendering/environment-placement-system';
import { terrainSurfaceControl } from '../../src/rendering/terrain-surface-control';
import { TerrainType } from '../../src/world/world-definition';

describe('forest-floor presentation control', () => {
  it('grounds macro trees while retaining water weights, moisture and source world data', () => {
    const world = generateWorld(42);
    const before = { terrain: world.terrain.slice(), biome: world.biome.slice(), moisture: world.moisture.slice(), flags: world.flags.slice() };
    const bare = terrainSurfaceControl(world, []);
    const placements = environmentPlacements(world, false);
    const forest = terrainSurfaceControl(world, placements);
    let changedGround = 0;
    for (let cell = 0; cell < world.width * world.height; cell++) {
      if (forest[cell * 4] !== bare[cell * 4]) {
        changedGround++;
        expect(world.terrain[cell]).toBe(TerrainType.GROUND);
      }
      // Canopy treatment must not repaint shores/rock weights or alter moisture.
      expect(forest.slice(cell * 4 + 1, cell * 4 + 4)).toEqual(bare.slice(cell * 4 + 1, cell * 4 + 4));
    }
    expect(changedGround).toBeGreaterThan(20);
    expect(terrainSurfaceControl(world, placements)).toEqual(forest);
    expect({ terrain: world.terrain, biome: world.biome, moisture: world.moisture, flags: world.flags }).toEqual(before);
  });
});
