import { describe, expect, it } from 'vitest';
import { buildingFootprintCells } from '../../src/simulation/building-footprint';
import { EntityStore } from '../../src/simulation/entity-store';
import { M03Simulation } from '../../src/simulation/m03-simulation';
import { NavigationGrid } from '../../src/simulation/navigation';
import { StrategicState } from '../../src/simulation/strategic-state';
import { generateWorld } from '../../src/world/generator';
import { WorldCellFlag } from '../../src/world/world-definition';
import { generatedWorldToArena, worldCellToSimulationPosition } from '../../src/world/world-arena';

describe('v24 building navigation footprints', () => {
  it('layers and releases dynamic blockers without changing terrain authority', () => {
    const world = generateWorld(1_000_040);
    const navigation = new NavigationGrid(generatedWorldToArena(world).traversal);
    const cell = { column: 4, row: 4 };
    const terrainWalkable = navigation.isTerrainWalkable(cell);
    if (!terrainWalkable) return;

    const initialVersion = navigation.navVersion;
    expect(navigation.setDynamicBlockedCells('a', [cell])).toBe(true);
    expect(navigation.isTerrainWalkable(cell)).toBe(true);
    expect(navigation.isWalkable(cell)).toBe(false);
    expect(navigation.navVersion).toBe(initialVersion + 1);

    navigation.setDynamicBlockedCells('b', [cell]);
    navigation.clearDynamicBlockedCells('a');
    expect(navigation.isWalkable(cell)).toBe(false);

    navigation.clearDynamicBlockedCells('b');
    expect(navigation.isWalkable(cell)).toBe(true);
    expect(navigation.isTerrainWalkable(cell)).toBe(true);
  });

  it('replans an active move around a newly placed building footprint', () => {
    const world = generateWorld(1_000_042);
    const simulation = new M03Simulation(world);
    const navigation = simulation.navigation;
    const playerSpawn = world.spawns.find((spawn) => spawn.id === 'PLAYER');
    const unit = simulation.snapshot().entities.find((entity) => entity.playerId === 0 && entity.alive);
    expect(playerSpawn).toBeDefined();
    expect(unit).toBeDefined();
    if (!playerSpawn || !unit) return;

    let choice: {
      build: { x: number; z: number };
      start: { column: number; row: number };
      goal: { column: number; row: number };
    } | null = null;

    for (let z = 5; z < world.height - 5 && choice === null; z += 1) {
      for (let x = 5; x < world.width - 5; x += 1) {
        const index = z * world.width + x;
        if (world.regionByCell[index] !== playerSpawn.regionId) continue;
        if (((world.flags[index] ?? 0) & WorldCellFlag.BUILDABLE) === 0) continue;
        const footprint = buildingFootprintCells('BARRACKS', { column: x, row: z });
        if (footprint.some((part) => (
          !navigation.isTerrainWalkable(part)
          || navigation.isDynamicallyBlocked(part)
        ))) continue;

        const candidates = [
          [{ column: x - 5, row: z }, { column: x + 5, row: z }],
          [{ column: x, row: z - 5 }, { column: x, row: z + 5 }],
        ] as const;
        for (const [start, goal] of candidates) {
          if (!navigation.isWalkable(start) || !navigation.isWalkable(goal)) continue;
          const path = navigation.findPath(start, goal);
          if (!path) continue;
          const footprintKeys = new Set(footprint.map((cell) => navigation.cellKey(cell)));
          if (!path.some((cell) => footprintKeys.has(navigation.cellKey(cell)))) continue;
          choice = { build: { x, z }, start, goal };
          break;
        }
        if (choice) break;
      }
    }

    expect(choice).not.toBeNull();
    if (!choice) return;

    const position = simulation.entities.positions.get(unit.id)!;
    const startWorld = navigation.cellToWorld(choice.start);
    position.x = startWorld.x;
    position.z = startWorld.z;
    const combat = simulation.entities.combat.get(unit.id)!;
    combat.targetEntityId = null;
    combat.pursuitTargetCellKey = null;

    const goalWorld = navigation.cellToWorld(choice.goal);
    simulation.enqueueCommand({
      type: 'MOVE',
      targetTick: 1,
      playerId: 0,
      entityIds: [unit.id],
      targetX: goalWorld.x,
      targetZ: goalWorld.z,
    });
    simulation.step();

    const footprint = buildingFootprintCells('BARRACKS', {
      column: choice.build.x,
      row: choice.build.z,
    });
    const footprintKeys = new Set(footprint.map((cell) => navigation.cellKey(cell)));
    const beforeBuild = simulation.entities.movements.get(unit.id)!;
    expect(beforeBuild.path.some((point) => (
      footprintKeys.has(navigation.cellKey(navigation.worldToCell(point.x, point.z)))
    ))).toBe(true);

    const buildWorld = worldCellToSimulationPosition(world, choice.build);
    simulation.enqueueStrategicCommand({
      type: 'BUILD',
      targetTick: 2,
      playerId: 0,
      buildingType: 'BARRACKS',
      targetX: buildWorld.x,
      targetZ: buildWorld.z,
    });
    simulation.step();

    const replanned = simulation.entities.movements.get(unit.id)!;
    expect(replanned.pathNavVersion).toBe(navigation.navVersion);
    expect(replanned.path.slice(replanned.pathIndex).every((point) => (
      !footprintKeys.has(navigation.cellKey(navigation.worldToCell(point.x, point.z)))
    ))).toBe(true);

    let enteredFootprint = false;
    for (let tick = 0; tick < 80; tick += 1) {
      const current = simulation.entities.positions.get(unit.id)!;
      if (footprintKeys.has(navigation.cellKey(navigation.worldToCell(current.x, current.z)))) {
        enteredFootprint = true;
        break;
      }
      if (simulation.entities.movements.get(unit.id)?.targetX === null) break;
      simulation.step();
    }
    expect(enteredFootprint).toBe(false);
    const finalPosition = simulation.entities.positions.get(unit.id)!;
    expect(navigation.cellKey(navigation.worldToCell(finalPosition.x, finalPosition.z)))
      .toBe(navigation.cellKey(choice.goal));
  });

  it('blocks solid building cores immediately and spawns trained units outside the footprint', () => {
    const world = generateWorld(1_000_041);
    const arena = generatedWorldToArena(world);
    const entities = new EntityStore();
    for (const spawn of arena.units) entities.createUnit(spawn);
    const navigation = new NavigationGrid(arena.traversal);
    const state = new StrategicState(world, entities, navigation);

    const playerCore = state.snapshot().buildings.find((building) => (
      building.playerId === 0 && building.type === 'ELEMENTAL_CORE'
    ));
    expect(playerCore).toBeDefined();
    if (!playerCore) return;

    const coreCell = navigation.worldToCell(playerCore.x, playerCore.z);
    const coreFootprint = buildingFootprintCells('ELEMENTAL_CORE', coreCell);
    expect(coreFootprint).toHaveLength(9);
    expect(coreFootprint.every((cell) => navigation.isWalkable(cell) === false)).toBe(true);

    const playerSpawn = world.spawns.find((spawn) => spawn.id === 'PLAYER');
    expect(playerSpawn).toBeDefined();
    if (!playerSpawn) return;

    let barracksCell: { x: number; z: number } | null = null;
    for (let z = 0; z < world.height && barracksCell === null; z += 1) {
      for (let x = 0; x < world.width; x += 1) {
        const index = z * world.width + x;
        if (world.regionByCell[index] !== playerSpawn.regionId) continue;
        if (((world.flags[index] ?? 0) & WorldCellFlag.BUILDABLE) === 0) continue;
        const footprint = buildingFootprintCells('BARRACKS', { column: x, row: z });
        if (footprint.some((part) => (
          part.column < 0
          || part.row < 0
          || part.column >= world.width
          || part.row >= world.height
          || navigation.isDynamicallyBlocked(part)
        ))) continue;
        barracksCell = { x, z };
        break;
      }
    }
    expect(barracksCell).not.toBeNull();
    if (!barracksCell) return;

    const barracksPosition = worldCellToSimulationPosition(world, barracksCell);
    expect(state.processCommand({
      type: 'BUILD',
      targetTick: 1,
      playerId: 0,
      buildingType: 'BARRACKS',
      targetX: barracksPosition.x,
      targetZ: barracksPosition.z,
    }, 1)).toBe(true);

    const barracks = state.snapshot().buildings.find((building) => (
      building.playerId === 0 && building.type === 'BARRACKS'
    ));
    expect(barracks).toBeDefined();
    if (!barracks) return;

    const barracksCenter = navigation.worldToCell(barracks.x, barracks.z);
    const barracksFootprint = buildingFootprintCells('BARRACKS', barracksCenter);
    expect(barracksFootprint).toHaveLength(5);
    expect(barracksFootprint.every((cell) => navigation.isWalkable(cell) === false)).toBe(true);

    for (let tick = 1; tick <= 351; tick += 1) state.advanceEconomy(tick);
    const beforeIds = new Set(entities.entityIds());
    expect(state.processCommand({
      type: 'TRAIN',
      targetTick: 352,
      playerId: 0,
      buildingId: barracks.id,
      unitType: 'VANGUARD',
    }, 352)).toBe(true);
    for (let tick = 352; tick <= 472; tick += 1) state.advanceEconomy(tick);

    const spawnedId = entities.entityIds().find((entityId) => !beforeIds.has(entityId));
    expect(spawnedId).toBeDefined();
    if (spawnedId === undefined) return;
    const spawned = entities.positions.get(spawnedId)!;
    const spawnedCell = navigation.worldToCell(spawned.x, spawned.z);
    expect(navigation.isWalkable(spawnedCell)).toBe(true);
    expect(barracksFootprint.some((cell) => navigation.cellKey(cell) === navigation.cellKey(spawnedCell))).toBe(false);
  });
});
