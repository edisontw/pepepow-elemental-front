import { describe, expect, it } from 'vitest';
import type { ArenaDefinition } from '../../src/simulation/arena';
import type { UnitArchetype, UnitSpawn } from '../../src/simulation/components';
import {
  FIRE_IMPACT_DAMAGE,
  WATER_WET_DURATION_TICKS,
} from '../../src/simulation/elemental-tactics';
import { CHAIN_LIGHTNING_WET_DAMAGE } from '../../src/simulation/lightning';
import { Simulation } from '../../src/simulation/simulation';
import { SurfaceType } from '../../src/simulation/terrain-state';

const CELL = 1_000;
const ORIGIN_X = -6_000;
const ORIGIN_Z = -4_000;

function center(column: number, row: number): { x: number; z: number } {
  return {
    x: ORIGIN_X + column * CELL + CELL / 2,
    z: ORIGIN_Z + row * CELL + CELL / 2,
  };
}

function spawn(
  playerId: number,
  column: number,
  row: number,
  archetype: UnitArchetype = 'VANGUARD',
  health = 500,
): UnitSpawn {
  const position = center(column, row);
  return {
    archetype,
    playerId,
    ...position,
    speedPerTick: archetype === 'GOLEM' ? 230 : 360,
    selectionRadius: archetype === 'GOLEM' ? 900 : 700,
    maxHealth: health,
    attackDamage: archetype === 'GOLEM' ? 42 : 18,
    attackIntervalTicks: archetype === 'GOLEM' ? 18 : 11,
    attackRange: 1_250,
  };
}

function arena(units: readonly UnitSpawn[]): ArenaDefinition {
  return {
    id: 'elemental-tactical-jobs',
    width: 12 * CELL,
    depth: 8 * CELL,
    zones: [],
    traversal: {
      originX: ORIGIN_X,
      originZ: ORIGIN_Z,
      cellSize: CELL,
      columns: 12,
      rows: 8,
      initialNavVersion: 1,
      patches: [
        { id: 'river', kind: 'BLOCKED_RIVER', minColumn: 6, maxColumn: 6, minRow: 0, maxRow: 7 },
      ],
      freezableWaterPatches: [
        { id: 'river', kind: 'BLOCKED_RIVER', minColumn: 6, maxColumn: 6, minRow: 0, maxRow: 7 },
      ],
      vegetationPatches: [
        { id: 'forest', kind: 'WALKABLE_GROUND', minColumn: 8, maxColumn: 10, minRow: 4, maxRow: 6 },
      ],
    },
    units,
  };
}

function castTerrain(
  simulation: Simulation,
  effectId: 'FIRE' | 'WATER' | 'FREEZE' | 'HEAT',
  column: number,
  row: number,
  targetTick: number,
  radius = 0,
): void {
  const target = center(column, row);
  simulation.enqueueCommand({
    targetTick,
    playerId: 0,
    type: 'CAST',
    effectId,
    targetX: target.x,
    targetZ: target.z,
    radius,
  });
}

describe('M08 elemental tactical jobs', () => {
  it('gives Fire a standalone deny job: impact damage works without forest cover', () => {
    const simulation = new Simulation('fire-job', arena([
      spawn(0, 2, 2),
      spawn(1, 4, 2),
    ]));
    castTerrain(simulation, 'FIRE', 4, 2, 1);
    simulation.step();
    expect(simulation.snapshot().entities[1]?.currentHealth).toBe(500 - FIRE_IMPACT_DAMAGE);
    expect(simulation.snapshot().terrain.burning).toBe(0);
  });

  it('makes Water Burst a setup/displacement tool: Wet persists and light units are pushed', () => {
    const simulation = new Simulation('water-job', arena([
      spawn(0, 1, 2),
      spawn(1, 4, 2),
    ]));
    const before = simulation.snapshot().entities[1]!;
    castTerrain(simulation, 'WATER', 4, 2, 1, 3_500);
    simulation.step();
    const after = simulation.snapshot().entities[1]!;
    expect(after.wet).toBe(true);
    expect(after.wetTicks).toBe(WATER_WET_DURATION_TICKS);
    expect([after.x, after.z]).not.toEqual([before.x, before.z]);
  });

  it('lets Water wet but not push Heavy units', () => {
    const simulation = new Simulation('water-heavy', arena([
      spawn(0, 1, 2),
      spawn(1, 4, 2, 'GOLEM'),
    ]));
    const before = simulation.snapshot().entities[1]!;
    castTerrain(simulation, 'WATER', 4, 2, 1, 3_500);
    simulation.step();
    const after = simulation.snapshot().entities[1]!;
    expect(after.wet).toBe(true);
    expect([after.x, after.z]).toEqual([before.x, before.z]);
  });

  it('turns Water into Lightning setup on dry ground', () => {
    const simulation = new Simulation('water-lightning', arena([
      spawn(0, 1, 2),
      spawn(1, 4, 2),
    ]));
    castTerrain(simulation, 'WATER', 4, 2, 1, 0);
    simulation.step();
    const wetTarget = simulation.snapshot().entities[1]!;
    expect(wetTarget.wet).toBe(true);
    simulation.enqueueCommand({
      targetTick: 2,
      playerId: 0,
      type: 'CAST',
      effectId: 'CHAIN_LIGHTNING',
      targetEntityId: wetTarget.id,
    });
    simulation.step();
    expect(simulation.snapshot().entities[1]?.currentHealth).toBe(500 - CHAIN_LIGHTNING_WET_DAMAGE);
  });

  it('makes Ice an alternate route rather than a bridge duplicate, and Fire/Heat can remove it', () => {
    const simulation = new Simulation('ice-route', arena([]));
    const left = { column: 5, row: 3 };
    const river = { column: 6, row: 3 };
    const right = { column: 7, row: 3 };
    expect(simulation.navigation.findPath(left, right)).toBeNull();

    castTerrain(simulation, 'FREEZE', river.column, river.row, 1);
    simulation.step();
    expect(simulation.terrain.surfaceAt(river)).toBe(SurfaceType.ICE);
    expect(simulation.navigation.findPath(left, right)).not.toBeNull();

    castTerrain(simulation, 'HEAT', river.column, river.row, 2);
    simulation.step();
    expect(simulation.terrain.surfaceAt(river)).toBe(SurfaceType.WATER);
    expect(simulation.navigation.findPath(left, right)).toBeNull();
  });

  it('makes heavy traversal stress and eventually break a temporary ice route', () => {
    const river = { column: 6, row: 3 };
    const simulation = new Simulation('ice-heavy-risk', arena([
      spawn(0, river.column, river.row, 'GOLEM'),
    ]));
    castTerrain(simulation, 'FREEZE', river.column, river.row, 1);
    simulation.step();
    expect(simulation.terrain.surfaceAt(river)).toBe(SurfaceType.ICE);
    for (let tick = 2; tick <= 51; tick += 1) simulation.step();
    expect(simulation.terrain.surfaceAt(river)).toBe(SurfaceType.WATER);
    expect(simulation.navigation.isWalkable(river)).toBe(false);
  });

  it('makes intact forest real cover and Fire clear that concealment', () => {
    const forest = { column: 9, row: 5 };
    const simulation = new Simulation('forest-cover', arena([
      spawn(0, 2, 5),
      spawn(1, forest.column, forest.row, 'RANGER'),
    ]));
    const enemy = simulation.snapshot().entities[1]!;
    expect(simulation.visibility.isWorldVisible(0, enemy.x, enemy.z, simulation.navigation)).toBe(true);
    expect(enemy.visibleToPlayer).toBe(false);

    castTerrain(simulation, 'FIRE', forest.column, forest.row, 1);
    simulation.step();
    expect(simulation.snapshot().terrain.burning).toBeGreaterThan(0);
    expect(simulation.snapshot().entities[1]?.visibleToPlayer).toBe(true);
  });

  it('replays the same elemental command stream to the same tactical hash', () => {
    const run = (): string => {
      const simulation = new Simulation('elemental-job-replay', arena([
        spawn(0, 1, 2),
        spawn(1, 4, 2),
      ]));
      castTerrain(simulation, 'WATER', 4, 2, 1, 0);
      simulation.enqueueCommand({ targetTick: 2, playerId: 0, type: 'CAST', effectId: 'CHAIN_LIGHTNING', targetEntityId: 2 });
      castTerrain(simulation, 'FIRE', 4, 2, 3, 0);
      simulation.step();
      simulation.step();
      simulation.step();
      return simulation.snapshot().stateHash;
    };
    expect(run()).toBe(run());
  });
});
