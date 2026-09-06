import { describe, expect, it } from 'vitest';
import { M01_ARENA } from '../../src/simulation/arena';
import { NavigationGrid } from '../../src/simulation/navigation';
import { Simulation } from '../../src/simulation/simulation';
import {
  FREEZE_TEMPERATURE_DELTA,
  HEAT_ICE_DAMAGE,
  ICE_DURABILITY_MAX,
  SurfaceType,
  TerrainState,
  WATER_FREEZE_THRESHOLD,
} from '../../src/simulation/terrain-state';

const CROSSING_CELL = { column: 26, row: 16 };
const CROSSING_X = 2_000;
const CROSSING_Z = -3_000;
const EFFECT_RADIUS = 5_000;

function cast(simulation: Simulation, targetTick: number, effectId: 'FREEZE' | 'HEAT'): void {
  simulation.enqueueCommand({
    targetTick, playerId: 0, type: 'CAST', effectId,
    targetX: CROSSING_X, targetZ: CROSSING_Z, radius: EFFECT_RADIUS,
  });
}

describe('M01 authoritative water and ice terrain', () => {
  it('starts the future crossing as neutral, freezable, non-walkable water and preserves the natural crossing', () => {
    const terrain = new TerrainState(M01_ARENA.traversal);
    const navigation = new NavigationGrid(M01_ARENA.traversal);
    expect(terrain.surfaceAt(CROSSING_CELL)).toBe(SurfaceType.WATER);
    expect(terrain.temperatureAt(CROSSING_CELL)).toBe(0);
    expect(terrain.iceDurabilityAt(CROSSING_CELL)).toBe(0);
    expect(terrain.isFreezable(CROSSING_CELL)).toBe(true);
    expect(navigation.isWalkable(CROSSING_CELL)).toBe(false);
    expect(terrain.surfaceAt({ column: 26, row: 31 })).toBe(SurfaceType.NATURAL_CROSSING);
    expect(navigation.isWalkable({ column: 26, row: 31 })).toBe(true);
  });

  it('applies cold deterministically, freezes only at threshold, initializes durability, and batches one nav bump', () => {
    const simulation = new Simulation('freeze-threshold');
    cast(simulation, 1, 'FREEZE');
    simulation.step();
    expect(simulation.terrain.temperatureAt(CROSSING_CELL)).toBe(FREEZE_TEMPERATURE_DELTA);
    expect(FREEZE_TEMPERATURE_DELTA).toBeGreaterThan(WATER_FREEZE_THRESHOLD);
    expect(simulation.terrain.surfaceAt(CROSSING_CELL)).toBe(SurfaceType.WATER);
    expect(simulation.navigation.navVersion).toBe(1);

    cast(simulation, 2, 'FREEZE');
    simulation.step();
    expect(simulation.terrain.surfaceAt(CROSSING_CELL)).toBe(SurfaceType.ICE);
    expect(simulation.terrain.iceDurabilityAt(CROSSING_CELL)).toBe(ICE_DURABILITY_MAX);
    expect(simulation.navigation.isWalkable(CROSSING_CELL)).toBe(true);
    expect(simulation.navigation.navVersion).toBe(2);
    expect(simulation.snapshot().terrain.ice).toBe(35);

    cast(simulation, 3, 'FREEZE');
    simulation.step();
    expect(simulation.navigation.navVersion).toBe(2);
  });

  it('does not freeze ground, walls, or the natural crossing', () => {
    const simulation = new Simulation('eligible-only');
    simulation.enqueueCommand({
      targetTick: 1, playerId: 0, type: 'CAST', effectId: 'FREEZE',
      targetX: 2_000, targetZ: 12_000, radius: 20_000,
    });
    simulation.step();
    simulation.enqueueCommand({
      targetTick: 2, playerId: 0, type: 'CAST', effectId: 'FREEZE',
      targetX: 2_000, targetZ: 12_000, radius: 20_000,
    });
    simulation.step();
    expect(simulation.terrain.surfaceAt({ column: 10, row: 30 })).toBe(SurfaceType.GROUND);
    expect(simulation.terrain.surfaceAt({ column: 10, row: 21 })).toBe(SurfaceType.BLOCKED_TERRAIN);
    expect(simulation.terrain.surfaceAt({ column: 26, row: 31 })).toBe(SurfaceType.NATURAL_CROSSING);
  });

  it('damages ice deterministically, then melts to non-walkable water with one nav bump', () => {
    const simulation = new Simulation('heat-melt');
    cast(simulation, 1, 'FREEZE'); cast(simulation, 2, 'FREEZE');
    simulation.step(); simulation.step();
    cast(simulation, 3, 'HEAT');
    simulation.step();
    expect(simulation.terrain.iceDurabilityAt(CROSSING_CELL)).toBe(ICE_DURABILITY_MAX - HEAT_ICE_DAMAGE);
    expect(simulation.terrain.surfaceAt(CROSSING_CELL)).toBe(SurfaceType.ICE);
    expect(simulation.navigation.navVersion).toBe(2);

    cast(simulation, 4, 'HEAT');
    simulation.step();
    expect(simulation.terrain.iceDurabilityAt(CROSSING_CELL)).toBe(0);
    expect(simulation.terrain.surfaceAt(CROSSING_CELL)).toBe(SurfaceType.WATER);
    expect(simulation.navigation.isWalkable(CROSSING_CELL)).toBe(false);
    expect(simulation.navigation.navVersion).toBe(3);
  });

  it('includes canonical row-major terrain state in replay hashes', () => {
    const first = new Simulation('terrain-hash');
    const second = new Simulation('terrain-hash');
    cast(first, 1, 'FREEZE'); cast(second, 1, 'FREEZE');
    first.step(); second.step();
    expect(first.snapshot().stateHash).toBe(second.snapshot().stateHash);

    cast(first, 2, 'FREEZE');
    first.step(); second.step();
    expect(first.snapshot().stateHash).not.toBe(second.snapshot().stateHash);
  });
});
