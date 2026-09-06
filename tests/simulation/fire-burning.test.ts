import { describe, expect, it } from 'vitest';
import { M01_ARENA, type ArenaDefinition } from '../../src/simulation/arena';
import type { UnitSpawn } from '../../src/simulation/components';
import { FixedTickRunner } from '../../src/simulation/fixed-tick-runner';
import { Simulation } from '../../src/simulation/simulation';
import {
  BURNING_HEAT_PER_TICK,
  SurfaceType,
  TerrainState,
  VegetationState,
} from '../../src/simulation/terrain-state';

const FOREST_CELL = { column: 9, row: 29 };
const FOREST_CENTER = { x: -14_500, z: 10_500 };

function fire(simulation: Simulation, targetTick = 1): void {
  simulation.enqueueCommand({
    targetTick,
    playerId: 0,
    type: 'CAST',
    effectId: 'FIRE',
    targetX: FOREST_CENTER.x,
    targetZ: FOREST_CENTER.z,
    radius: 0,
  });
}

function spawnAtForest(): UnitSpawn {
  return {
    archetype: 'VANGUARD', playerId: 0, x: FOREST_CENTER.x, z: FOREST_CENTER.z,
    speedPerTick: 420, selectionRadius: 700, maxHealth: 180,
    attackDamage: 18, attackIntervalTicks: 11, attackRange: 1_250,
  };
}

describe('M01 deterministic Fire and Burning foundation', () => {
  it('rasterizes only handcrafted walkable forest as flammable vegetation', () => {
    const terrain = new TerrainState(M01_ARENA.traversal);
    expect(terrain.vegetationAt(FOREST_CELL)).toBe(VegetationState.FLAMMABLE);
    expect(terrain.vegetationAt({ column: 20, row: 20 })).toBe(VegetationState.NONE);
    expect(terrain.vegetationAt({ column: 38, row: 8 })).toBe(VegetationState.NONE);
    expect(terrain.counts()).toMatchObject({ flammableVegetation: 163, burning: 0, consumedVegetation: 0 });
  });

  it('ignites one eligible cell, produces heat, and spreads locally in canonical row-major state', () => {
    const simulation = new Simulation('forest-spread');
    fire(simulation);
    simulation.step();
    expect(simulation.terrain.burningAgeAt(FOREST_CELL)).toBe(2);
    expect(simulation.terrain.temperatureAt(FOREST_CELL)).toBe(BURNING_HEAT_PER_TICK);
    expect(simulation.snapshot().terrain.burning).toBe(1);

    simulation.step();
    expect(simulation.snapshot().burningCells).toEqual([
      { column: 9, row: 28 },
      { column: 8, row: 29 },
      { column: 9, row: 29 },
      { column: 10, row: 29 },
      { column: 9, row: 30 },
    ]);
  });

  it('consumes vegetation after a fixed burn duration and cannot reignite it', () => {
    const simulation = new Simulation('forest-consumption');
    fire(simulation);
    for (let tick = 1; tick <= 9; tick += 1) simulation.step();
    expect(simulation.terrain.vegetationAt(FOREST_CELL)).toBe(VegetationState.CONSUMED);
    expect(simulation.terrain.burningAgeAt(FOREST_CELL)).toBe(0);

    fire(simulation, 10);
    simulation.step();
    expect(simulation.terrain.burningAgeAt(FOREST_CELL)).toBe(0);
  });

  it('prevents Water ignition and lets a sufficiently Wet occupant extinguish Burning', () => {
    const water = new Simulation('water-fire-guard');
    const waterCell = { column: 26, row: 16 };
    expect(water.terrain.surfaceAt(waterCell)).toBe(SurfaceType.WATER);
    expect(water.terrain.vegetationAt(waterCell)).toBe(VegetationState.NONE);
    water.enqueueCommand({
      targetTick: 1, playerId: 0, type: 'CAST', effectId: 'FIRE',
      targetX: 2_500, targetZ: -2_500, radius: 0,
    });
    water.step();
    expect(water.terrain.burningAgeAt(waterCell)).toBe(0);

    const arena: ArenaDefinition = { ...M01_ARENA, id: 'wet-dousing', units: [spawnAtForest()] };
    const doused = new Simulation('wet-dousing', arena);
    doused.entities.statuses.get(1)!.wet = true;
    fire(doused);
    doused.step();
    expect(doused.terrain.burningAgeAt(FOREST_CELL)).toBe(0);
    expect(doused.terrain.vegetationAt(FOREST_CELL)).toBe(VegetationState.FLAMMABLE);
  });

  it('hashes vegetation and Burning state and replays independently of render FPS', () => {
    const run = (schedule: number[]): ReturnType<Simulation['snapshot']> => {
      const simulation = new Simulation('burning-replay');
      fire(simulation);
      const runner = new FixedTickRunner(simulation);
      for (const frameMs of schedule) runner.advance(frameMs);
      return simulation.snapshot();
    };
    const fastFrames = Array.from({ length: 60 }, () => 1000 / 60);
    const lowFrames = Array.from({ length: 10 }, () => 100);
    expect(run(fastFrames)).toEqual(run(lowFrames));

    const untouched = new Simulation('burning-hash');
    const changed = new Simulation('burning-hash');
    changed.terrain.burningAge[changed.terrain.indexOf(FOREST_CELL)!] = 1;
    expect(changed.snapshot().stateHash).not.toBe(untouched.snapshot().stateHash);
  });
});
