import { describe, expect, it } from 'vitest';
import { createEnvironmentVisualLayout, MAX_ENVIRONMENT_PROPS } from '../../src/rendering/environment-visual-layout';
import { generateWorld } from '../../src/world/generator';
import { BiomeType, TerrainType, WorldCellFlag, type GeneratedWorld } from '../../src/world/world-definition';

const LAND_KINDS = new Set([
  'WOODLAND_GROVE',
  'WOODLAND_EDGE',
  'HIGHLAND_RIDGE',
  'HIGHLAND_ROCK',
  'RIVER_BANK_STONE',
  'PLAINS_SCRUB',
  'PLAINS_STONE',
  'BIOME_EDGE_SCRUB',
  'BIOME_EDGE_STONE',
  'ROUTE_EDGE_POST',
  'SETTLEMENT_SUPPLIES',
  'RESOURCE_FRINGE',
  'POI_FRINGE',
]);

function touchesTerrain(world: GeneratedWorld, x: number, z: number, terrain: TerrainType): boolean {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx;
    const nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= world.width || nz >= world.height) continue;
    if (world.terrain[nz * world.width + nx] === terrain) return true;
  }
  return false;
}

function touchesRoute(world: GeneratedWorld, x: number, z: number): boolean {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx;
    const nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= world.width || nz >= world.height) continue;
    if (((world.flags[nz * world.width + nx] ?? 0) & WorldCellFlag.ROUTE) !== 0) return true;
  }
  return false;
}

describe('terrain and environment visual layout', () => {
  it('is deterministic and bounded for the same generated world', () => {
    const world = generateWorld(42);
    const first = createEnvironmentVisualLayout(world);
    const second = createEnvironmentVisualLayout(world);
    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(MAX_ENVIRONMENT_PROPS);
  });

  it('changes with the visual salt without changing gameplay identity', () => {
    const firstWorld = generateWorld(42, undefined, { visualSalt: 'terrain-pass-a' });
    const secondWorld = generateWorld(42, undefined, { visualSalt: 'terrain-pass-b' });
    expect(secondWorld.gameplayHash).toBe(firstWorld.gameplayHash);
    expect(secondWorld.visualVariant).not.toEqual(firstWorld.visualVariant);
    expect(createEnvironmentVisualLayout(secondWorld)).not.toEqual(createEnvironmentVisualLayout(firstWorld));
  });

  it('keeps visual props on presentation-appropriate cells and off strategic routes', () => {
    const world = generateWorld(1_000_000);
    const layout = createEnvironmentVisualLayout(world);
    for (const prop of layout) {
      const index = prop.cellZ * world.width + prop.cellX;
      const terrain = world.terrain[index];
      const biome = world.biome[index];
      const flags = world.flags[index] ?? 0;

      if (prop.kind === 'RIVER_REED') {
        expect(terrain).toBe(TerrainType.WATER);
        expect(touchesTerrain(world, prop.cellX, prop.cellZ, TerrainType.GROUND)).toBe(true);
      } else {
        expect(LAND_KINDS.has(prop.kind)).toBe(true);
        expect(terrain).toBe(TerrainType.GROUND);
        expect((flags & WorldCellFlag.ROUTE) === 0).toBe(true);
      }

      if (prop.kind === 'WOODLAND_GROVE' || prop.kind === 'WOODLAND_EDGE') {
        expect(biome).toBe(BiomeType.WOODLAND);
      } else if (prop.kind === 'HIGHLAND_RIDGE' || prop.kind === 'HIGHLAND_ROCK') {
        expect(biome).toBe(BiomeType.HIGHLANDS);
      } else if (prop.kind === 'PLAINS_SCRUB' || prop.kind === 'PLAINS_STONE') {
        expect(biome).toBe(BiomeType.PLAINS);
      } else if (prop.kind === 'RIVER_BANK_STONE') {
        expect(touchesTerrain(world, prop.cellX, prop.cellZ, TerrainType.WATER)).toBe(true);
      } else if (prop.kind === 'ROUTE_EDGE_POST') {
        expect(touchesRoute(world, prop.cellX, prop.cellZ)).toBe(true);
      }

      expect(prop.scale).toBeGreaterThan(0);
      expect(Math.abs(prop.offsetX)).toBeLessThanOrEqual(0.22);
      expect(Math.abs(prop.offsetZ)).toBeLessThanOrEqual(0.22);
    }
  });

  it('adds structured surroundings in addition to generic plains filler', () => {
    const world = generateWorld(1_000_000);
    const layout = createEnvironmentVisualLayout(world);
    expect(layout.some((prop) => prop.kind === 'SETTLEMENT_SUPPLIES')).toBe(true);
    expect(layout.some((prop) => prop.kind === 'RESOURCE_FRINGE')).toBe(true);
    expect(layout.some((prop) => prop.kind === 'POI_FRINGE')).toBe(true);
    expect(layout.some((prop) => prop.kind === 'ROUTE_EDGE_POST')).toBe(true);
    expect(layout.some((prop) => prop.kind === 'RIVER_REED' || prop.kind === 'RIVER_BANK_STONE')).toBe(true);
    expect(layout.some((prop) => prop.kind === 'WOODLAND_GROVE' || prop.kind === 'WOODLAND_EDGE')).toBe(true);
    expect(layout.some((prop) => prop.kind === 'HIGHLAND_RIDGE' || prop.kind === 'HIGHLAND_ROCK')).toBe(true);
    expect(layout.some((prop) => prop.kind === 'PLAINS_SCRUB' || prop.kind === 'PLAINS_STONE')).toBe(true);
  });

  it('keeps world-generation authority unchanged', () => {
    const world = generateWorld(42);
    createEnvironmentVisualLayout(world);
    expect(world.identity.rulesetVersion).toBe('m02-standard-v1');
  });
});
