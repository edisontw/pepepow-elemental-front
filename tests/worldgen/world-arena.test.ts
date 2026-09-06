import { describe, expect, it } from 'vitest';
import { generateWorld } from '../../src/world/generator';
import { generatedWorldToArena } from '../../src/world/world-arena';
import { WorldCellFlag } from '../../src/world/world-definition';

describe('generated world arena presentation adapter', () => {
  it.each([0, 42, 1_000_000])('spreads both starting armies across distinct nearby walkable cells for block %i', (blockHeight) => {
    const world = generateWorld(blockHeight);
    const arena = generatedWorldToArena(world);

    for (const playerId of [0, 1]) {
      const units = arena.units.filter((unit) => unit.playerId === playerId);
      expect(units).toHaveLength(6);
      const occupied = new Set<string>();
      for (const unit of units) {
        const column = Math.floor((unit.x - arena.traversal.originX) / arena.traversal.cellSize);
        const row = Math.floor((unit.z - arena.traversal.originZ) / arena.traversal.cellSize);
        const key = `${column},${row}`;
        expect(occupied.has(key)).toBe(false);
        occupied.add(key);
        expect(column).toBeGreaterThanOrEqual(0);
        expect(column).toBeLessThan(world.width);
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(world.height);
        const index = row * world.width + column;
        expect((world.flags[index] ?? 0) & WorldCellFlag.WALKABLE).not.toBe(0);
      }
    }
  });
});
