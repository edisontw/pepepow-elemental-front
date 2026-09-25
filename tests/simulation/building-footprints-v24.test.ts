import { describe, expect, it } from 'vitest';
import { EntityStore } from '../../src/simulation/entity-store';
import { buildingNavigationCells } from '../../src/simulation/m03-content';
import { NavigationGrid } from '../../src/simulation/navigation';
import { StrategicState } from '../../src/simulation/strategic-state';
import { generateWorld } from '../../src/world/generator';
import { WorldCellFlag } from '../../src/world/world-definition';
import { generatedWorldToArena, worldCellToSimulationPosition } from '../../src/world/world-arena';

function harness(blockHeight = 1_000_041) {
  const world = generateWorld(blockHeight);
  const arena = generatedWorldToArena(world);
  const entities = new EntityStore();
  for (const spawn of arena.units) entities.createUnit(spawn);
  const navigation = new NavigationGrid(arena.traversal);
  const state = new StrategicState(world, entities, navigation);
  return { world, entities, navigation, state };
}

describe('v24 physical building navigation footprints', () => {
  it('blocks Core foundations while keeping the initial armies on legal cells', () => {
    const { entities, navigation, state } = harness();
    const cores = state.snapshot().buildings.filter((building) => building.type === 'ELEMENTAL_CORE');
    expect(cores).toHaveLength(2);
    for (const core of cores) {
      const center = navigation.worldToCell(core.x, core.z);
      const footprint = buildingNavigationCells(core.type, center);
      expect(footprint).toHaveLength(9);
      expect(footprint.every((cell) => !navigation.isWalkable(cell))).toBe(true);
    }
    for (const entityId of entities.entityIds()) {
      if (!entities.hasUnit(entityId)) continue;
      const position = entities.positions.get(entityId)!;
      expect(navigation.isWalkable(navigation.worldToCell(position.x, position.z))).toBe(true);
    }
  });

  it('blocks a new Barracks immediately and routes around its core footprint', () => {
    const { world, entities, navigation, state } = harness(1_000_042);
    const playerSpawn = world.spawns.find((spawn) => spawn.id === 'PLAYER');
    if (!playerSpawn) throw new Error('Missing player spawn.');
    const occupiedUnitCells = new Set(entities.entityIds().flatMap((entityId) => {
      if (!entities.hasUnit(entityId)) return [];
      const position = entities.positions.get(entityId);
      return position ? [navigation.cellKey(navigation.worldToCell(position.x, position.z))] : [];
    }));

    let chosen: { x: number; z: number } | null = null;
    for (let z = 2; z < world.height - 2 && chosen === null; z += 1) {
      for (let x = 2; x < world.width - 2; x += 1) {
        const index = z * world.width + x;
        if (world.regionByCell[index] !== playerSpawn.regionId) continue;
        if (((world.flags[index] ?? 0) & WorldCellFlag.BUILDABLE) === 0) continue;
        const footprint = buildingNavigationCells('BARRACKS', { column: x, row: z });
        if (!footprint.every((cell) => navigation.isWalkable(cell))) continue;
        if (footprint.some((cell) => occupiedUnitCells.has(navigation.cellKey(cell)))) continue;
        const left = { column: x - 2, row: z };
        const right = { column: x + 2, row: z };
        if (!navigation.isWalkable(left) || !navigation.isWalkable(right)) continue;
        chosen = { x, z };
        break;
      }
    }
    expect(chosen).not.toBeNull();
    if (!chosen) return;

    const position = worldCellToSimulationPosition(world, chosen);
    const versionBefore = navigation.navVersion;
    expect(state.processCommand({
      targetTick: 1,
      playerId: 0,
      type: 'BUILD',
      buildingType: 'BARRACKS',
      targetX: position.x,
      targetZ: position.z,
    }, 1)).toBe(true);
    expect(navigation.navVersion).toBe(versionBefore + 1);

    const footprint = buildingNavigationCells('BARRACKS', { column: chosen.x, row: chosen.z });
    const blockedKeys = new Set(footprint.map((cell) => navigation.cellKey(cell)));
    expect(footprint.every((cell) => !navigation.isWalkable(cell))).toBe(true);

    const path = navigation.findPath(
      { column: chosen.x - 2, row: chosen.z },
      { column: chosen.x + 2, row: chosen.z },
    );
    expect(path).not.toBeNull();
    expect(path?.some((cell) => blockedKeys.has(navigation.cellKey(cell)))).toBe(false);
  });
});
