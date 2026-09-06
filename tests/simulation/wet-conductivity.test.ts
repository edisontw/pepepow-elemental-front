import { describe, expect, it } from 'vitest';
import { M01_ARENA, type ArenaDefinition } from '../../src/simulation/arena';
import {
  DRY_GROUND_CONDUCTIVITY,
  effectiveConductivity,
  ICE_CONDUCTIVITY,
  WATER_CONDUCTIVITY,
  WET_UNIT_CONDUCTIVITY,
} from '../../src/simulation/conductivity';
import type { UnitSpawn } from '../../src/simulation/components';
import { Simulation } from '../../src/simulation/simulation';
import { SurfaceType } from '../../src/simulation/terrain-state';

const WATER = { x: 2_500, z: -2_500 };
const GROUND = { x: -5_500, z: -2_500 };

function spawn(x: number, z: number): UnitSpawn {
  return {
    archetype: 'VANGUARD', playerId: 0, x, z, speedPerTick: 420, selectionRadius: 700,
    maxHealth: 180, attackDamage: 18, attackIntervalTicks: 11, attackRange: 1_250,
  };
}

function arenaAt(x: number, z: number): ArenaDefinition {
  return { ...M01_ARENA, id: `status-${x}-${z}`, units: [spawn(x, z)] };
}

function terrainCast(simulation: Simulation, tick: number, effectId: 'FREEZE' | 'HEAT' | 'FIRE'): void {
  simulation.enqueueCommand({
    targetTick: tick, playerId: 0, type: 'CAST', effectId,
    targetX: WATER.x, targetZ: WATER.z, radius: 700,
  });
}

describe('M01 environmental Wet status and conductivity', () => {
  it('keeps ground occupants dry and gives Water occupants Wet', () => {
    const ground = new Simulation('dry-ground', arenaAt(GROUND.x, GROUND.z));
    const water = new Simulation('wet-water', arenaAt(WATER.x, WATER.z));
    ground.step(); water.step();
    expect(ground.snapshot().entities[0]?.wet).toBe(false);
    expect(water.snapshot().entities[0]?.wet).toBe(true);
    expect(water.snapshot().wetUnitCount).toBe(1);
  });

  it('does not treat Ice as Wet and clears Wet when stranded Water refreezes', () => {
    const simulation = new Simulation('ice-dry', arenaAt(WATER.x, WATER.z));
    simulation.step();
    expect(simulation.snapshot().entities[0]?.wet).toBe(true);
    terrainCast(simulation, 2, 'FREEZE');
    terrainCast(simulation, 3, 'FREEZE');
    simulation.step(); simulation.step();
    expect(simulation.terrain.surfaceAt({ column: 26, row: 16 })).toBe(SurfaceType.ICE);
    expect(simulation.snapshot().entities[0]?.wet).toBe(false);
  });

  it('makes a melt-under-unit transition Water + Wet without teleporting', () => {
    const simulation = new Simulation('fire-wet', arenaAt(WATER.x, WATER.z));
    terrainCast(simulation, 1, 'FREEZE'); terrainCast(simulation, 2, 'FREEZE');
    simulation.step(); simulation.step();
    const before = simulation.snapshot().entities[0]!;
    terrainCast(simulation, 3, 'FIRE'); terrainCast(simulation, 3, 'FIRE');
    simulation.step();
    expect(simulation.terrain.surfaceAt({ column: 26, row: 16 })).toBe(SurfaceType.WATER);
    expect(simulation.snapshot().entities[0]).toMatchObject({ x: before.x, z: before.z, wet: true });
  });

  it('derives dry, Ice, Wet-unit, and Water conductivity on the integer scale', () => {
    const dry = new Simulation('conductivity-dry', arenaAt(GROUND.x, GROUND.z));
    dry.step();
    expect(effectiveConductivity(1, dry.entities, dry.terrain, dry.navigation)).toBe(DRY_GROUND_CONDUCTIVITY);
    dry.entities.statuses.get(1)!.wet = true;
    expect(effectiveConductivity(1, dry.entities, dry.terrain, dry.navigation)).toBe(WET_UNIT_CONDUCTIVITY);

    const water = new Simulation('conductivity-water', arenaAt(WATER.x, WATER.z));
    water.step();
    expect(effectiveConductivity(1, water.entities, water.terrain, water.navigation)).toBe(WATER_CONDUCTIVITY);
    terrainCast(water, 2, 'FREEZE'); terrainCast(water, 3, 'FREEZE');
    water.step(); water.step();
    expect(effectiveConductivity(1, water.entities, water.terrain, water.navigation)).toBe(ICE_CONDUCTIVITY);
  });

  it('includes Wet in the canonical state hash', () => {
    const first = new Simulation('wet-hash', arenaAt(GROUND.x, GROUND.z));
    const second = new Simulation('wet-hash', arenaAt(GROUND.x, GROUND.z));
    first.entities.statuses.get(1)!.wet = true;
    expect(first.snapshot().stateHash).not.toBe(second.snapshot().stateHash);
  });
});
