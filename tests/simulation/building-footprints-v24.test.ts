import { describe, expect, it } from 'vitest';
import { buildingFootprintCells, buildingFootprintOffsets } from '../../src/simulation/building-footprint';
import { NavigationGrid } from '../../src/simulation/navigation';
import type { ArenaTraversalDefinition } from '../../src/simulation/arena';

function openTraversal(): ArenaTraversalDefinition {
  return {
    originX: 0,
    originZ: 0,
    cellSize: 1_000,
    columns: 12,
    rows: 12,
    initialNavVersion: 1,
    patches: [],
    freezableWaterPatches: [],
    vegetationPatches: [],
  };
}

describe('v24 building navigation footprints', () => {
  it('uses a 3x3 Core, cross-shaped Barracks/Workshop, and center-only smaller structures', () => {
    expect(buildingFootprintOffsets('ELEMENTAL_CORE')).toHaveLength(9);
    expect(buildingFootprintOffsets('BARRACKS')).toHaveLength(5);
    expect(buildingFootprintOffsets('WORKSHOP')).toHaveLength(5);
    for (const type of ['ARCANE_TOWER', 'OUTPOST', 'EXTRACTOR', 'MANA_WELL'] as const) {
      expect(buildingFootprintOffsets(type)).toEqual([{ column: 0, row: 0 }]);
    }
  });

  it('routes around a dynamic building blocker without mutating terrain walkability', () => {
    const navigation = new NavigationGrid(openTraversal());
    const footprint = buildingFootprintCells({ column: 5, row: 5 }, 'BARRACKS');
    const beforeVersion = navigation.navVersion;

    expect(navigation.canAddDynamicBlockers(footprint)).toBe(true);
    expect(navigation.addDynamicBlockers(footprint)).toBe(true);
    expect(navigation.navVersion).toBe(beforeVersion + 1);
    for (const cell of footprint) {
      expect(navigation.isTerrainWalkable(cell)).toBe(true);
      expect(navigation.isDynamicallyBlocked(cell)).toBe(true);
      expect(navigation.isWalkable(cell)).toBe(false);
    }

    const path = navigation.findPath({ column: 2, row: 5 }, { column: 8, row: 5 });
    expect(path).not.toBeNull();
    const blockedKeys = new Set(footprint.map((cell) => navigation.cellKey(cell)));
    expect(path!.some((cell) => blockedKeys.has(navigation.cellKey(cell)))).toBe(false);

    expect(navigation.removeDynamicBlockers(footprint)).toBe(true);
    expect(navigation.navVersion).toBe(beforeVersion + 2);
    for (const cell of footprint) {
      expect(navigation.isTerrainWalkable(cell)).toBe(true);
      expect(navigation.isDynamicallyBlocked(cell)).toBe(false);
      expect(navigation.isWalkable(cell)).toBe(true);
    }
  });

  it('supports counted blockers so removing one owner cannot reopen a shared cell early', () => {
    const navigation = new NavigationGrid(openTraversal());
    const cell = { column: 4, row: 4 };
    navigation.addDynamicBlockers([cell]);
    navigation.addDynamicBlockers([cell]);
    expect(navigation.isWalkable(cell)).toBe(false);

    navigation.removeDynamicBlockers([cell]);
    expect(navigation.isWalkable(cell)).toBe(false);

    navigation.removeDynamicBlockers([cell]);
    expect(navigation.isWalkable(cell)).toBe(true);
  });
});
