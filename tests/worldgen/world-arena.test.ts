import { describe, expect, it } from 'vitest';
import { simulationPositionToMinimapFraction } from '../../src/world/debug-view';
import { generateWorld } from '../../src/world/generator';
import { generatedWorldToArena, worldCellToSimulationPosition } from '../../src/world/world-arena';
import { WorldCellFlag } from '../../src/world/world-definition';

describe('generated world arena presentation adapter', () => {
  it.each([0, 42, 1_000_000])('keeps both starting armies distinct, walkable, in their spawn region, clear of the Core, and off resource sites for block %i', (blockHeight) => {
    const world = generateWorld(blockHeight);
    const arena = generatedWorldToArena(world);
    const resourceCells = new Set(world.resources.map((resource) => `${resource.cell.x},${resource.cell.z}`));

    for (const playerId of [0, 1]) {
      const units = arena.units.filter((unit) => unit.playerId === playerId);
      const spawnId = playerId === 0 ? 'PLAYER' : 'ENEMY';
      const spawn = world.spawns.find((candidate) => candidate.id === spawnId);
      expect(spawn).toBeDefined();
      const corePosition = worldCellToSimulationPosition(world, spawn!.cell);
      expect(units).toHaveLength(6);
      const occupied = new Set<string>();
      for (const unit of units) {
        const column = Math.floor((unit.x - arena.traversal.originX) / arena.traversal.cellSize);
        const row = Math.floor((unit.z - arena.traversal.originZ) / arena.traversal.cellSize);
        const key = `${column},${row}`;
        expect(occupied.has(key)).toBe(false);
        occupied.add(key);
        expect(resourceCells.has(key)).toBe(false);
        expect(column).toBeGreaterThanOrEqual(0);
        expect(column).toBeLessThan(world.width);
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(world.height);
        const index = row * world.width + column;
        expect((world.flags[index] ?? 0) & WorldCellFlag.WALKABLE).not.toBe(0);
        expect(world.regionByCell[index]).toBe(spawn!.regionId);

        const deltaX = unit.x - corePosition.x;
        const deltaZ = unit.z - corePosition.z;
        const clearance = 3 * arena.traversal.cellSize;
        expect(deltaX * deltaX + deltaZ * deltaZ).toBeGreaterThanOrEqual(clearance * clearance);
      }
    }
  });

  it.each([0, 42, 1_000_000])('maps authoritative generated cells to the same minimap coordinates for block %i', (blockHeight) => {
    const world = generateWorld(blockHeight);
    const points = [
      ...world.spawns.map((spawn) => spawn.cell),
      world.objective.cell,
      world.boss.cell,
      ...world.regions.slice(0, 3).map((region) => region.center),
    ];

    for (const point of points) {
      const position = worldCellToSimulationPosition(world, point);
      const [fractionX, fractionY] = simulationPositionToMinimapFraction(world, position.x, position.z);
      expect(fractionX).toBeCloseTo((point.x + 0.5) / world.width, 12);
      expect(fractionY).toBeCloseTo((point.z + 0.5) / world.height, 12);
    }
  });
});
