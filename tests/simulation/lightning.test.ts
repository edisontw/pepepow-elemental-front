import { describe, expect, it } from 'vitest';
import { M01_ARENA, type ArenaDefinition } from '../../src/simulation/arena';
import type { UnitSpawn } from '../../src/simulation/components';
import { FixedTickRunner } from '../../src/simulation/fixed-tick-runner';
import {
  CHAIN_LIGHTNING_BASE_DAMAGE,
  CHAIN_LIGHTNING_WET_DAMAGE,
} from '../../src/simulation/lightning';
import { Simulation } from '../../src/simulation/simulation';

function spawn(playerId: number, x: number, z: number, health = 500): UnitSpawn {
  return {
    archetype: 'VANGUARD', playerId, x, z, speedPerTick: 420, selectionRadius: 700,
    maxHealth: health, attackDamage: 18, attackIntervalTicks: 11, attackRange: 1_250,
  };
}

function arenaWith(units: readonly UnitSpawn[]): ArenaDefinition {
  return { ...M01_ARENA, id: 'lightning-test', units };
}

function cast(simulation: Simulation, targetEntityId: number, targetTick = 1, playerId = 0): void {
  simulation.enqueueCommand({ targetTick, playerId, type: 'CAST', effectId: 'CHAIN_LIGHTNING', targetEntityId });
}

describe('M01 deterministic Chain Lightning', () => {
  it('rejects invalid, dead, and friendly initial targets as deterministic no-ops', () => {
    const friendly = new Simulation('lightning-invalid', arenaWith([spawn(0, -5_500, -5_500)]));
    cast(friendly, 99); cast(friendly, 1);
    friendly.step();
    expect(friendly.snapshot().lastLightningChain).toEqual([]);
    expect(friendly.snapshot().entities[0]?.currentHealth).toBe(500);

    const dead = new Simulation('lightning-dead', arenaWith([spawn(1, -5_500, -5_500, 0)]));
    cast(dead, 1); dead.step();
    expect(dead.snapshot().lastLightningChain).toEqual([]);
  });

  it('deals 55 to dry targets and 68 to Water/Wet targets', () => {
    const dry = new Simulation('lightning-dry', arenaWith([spawn(1, -5_500, -5_500)]));
    cast(dry, 1); dry.step();
    expect(dry.snapshot().entities[0]?.currentHealth).toBe(500 - CHAIN_LIGHTNING_BASE_DAMAGE);

    const wet = new Simulation('lightning-wet', arenaWith([spawn(1, 500, -2_500)]));
    cast(wet, 1); wet.step();
    expect(wet.snapshot().entities[0]).toMatchObject({ wet: true, currentHealth: 500 - CHAIN_LIGHTNING_WET_DAMAGE });
  });

  it('prefers a farther conductive target over a closer dry target', () => {
    const simulation = new Simulation('conductive-priority', arenaWith([
      spawn(1, -3_500, -2_500),
      spawn(1, -2_500, -2_500),
      spawn(1, 500, -2_500),
    ]));
    cast(simulation, 1); simulation.step();
    expect(simulation.snapshot().lastLightningChain.slice(0, 3)).toEqual([1, 3, 2]);
  });

  it('falls back to distance, then EntityID, for equal conductivity', () => {
    const distance = new Simulation('distance-priority', arenaWith([
      spawn(1, -5_500, -5_500), spawn(1, -4_500, -5_500), spawn(1, -2_500, -5_500),
    ]));
    cast(distance, 1); distance.step();
    expect(distance.snapshot().lastLightningChain[1]).toBe(2);

    const entityId = new Simulation('id-priority', arenaWith([
      spawn(1, -5_500, -5_500), spawn(1, -4_500, -5_500), spawn(1, -6_500, -5_500),
    ]));
    cast(entityId, 1); entityId.step();
    expect(entityId.snapshot().lastLightningChain[1]).toBe(2);
  });

  it('uses 4 m from dry nodes and 6 m from Wet/Water nodes', () => {
    const dry = new Simulation('dry-range', arenaWith([
      spawn(1, -10_500, -5_500), spawn(1, -6_000, -5_500),
    ]));
    cast(dry, 1); dry.step();
    expect(dry.snapshot().lastLightningChain).toEqual([1]);

    const wet = new Simulation('wet-range', arenaWith([
      spawn(1, 500, -2_500), spawn(1, 6_000, -2_500),
    ]));
    cast(wet, 1); wet.step();
    expect(wet.snapshot().lastLightningChain).toEqual([1, 2]);
  });

  it('never repeats or chains to friendlies, caps at four additional jumps, and stops when exhausted', () => {
    const units = Array.from({ length: 6 }, (_, index) => spawn(1, -10_500 + index * 1_000, -5_500));
    units.splice(2, 0, spawn(0, -8_000, -5_500));
    const simulation = new Simulation('chain-cap', arenaWith(units));
    cast(simulation, 1); simulation.step();
    const chain = simulation.snapshot().lastLightningChain;
    expect(chain).toHaveLength(5);
    expect(new Set(chain).size).toBe(chain.length);
    expect(chain).not.toContain(3);
    expect(simulation.snapshot().entities[2]?.currentHealth).toBe(500);

    const exhausted = new Simulation('chain-exhausted', arenaWith([spawn(1, -5_500, -5_500)]));
    cast(exhausted, 1); exhausted.step();
    expect(exhausted.snapshot().lastLightningChain).toEqual([1]);
  });

  it('cleans up lightning deaths through the normal deterministic death path', () => {
    const simulation = new Simulation('lightning-death', arenaWith([spawn(1, -5_500, -5_500, 55)]));
    cast(simulation, 1); simulation.step();
    expect(simulation.snapshot().entities[0]).toMatchObject({ currentHealth: 0, alive: false });
  });

  it('replays identical casts and stays independent of render-frame schedule', () => {
    const run = (schedule: readonly number[]): string => {
      const simulation = new Simulation('lightning-fps', arenaWith([
        spawn(1, -5_500, -5_500), spawn(1, -3_500, -5_500), spawn(1, -1_500, -5_500),
      ]));
      cast(simulation, 1, 3);
      const runner = new FixedTickRunner(simulation);
      for (const milliseconds of schedule) runner.advance(milliseconds);
      return simulation.snapshot().stateHash;
    };
    const sixtyFps = Array.from({ length: 60 }, () => 1_000 / 60);
    expect(run(sixtyFps)).toBe(run(Array.from({ length: 10 }, () => 100)));
    expect(run(sixtyFps)).toBe(run(sixtyFps));
  });

  it('diverges when the Lightning target or timing changes', () => {
    const units = [spawn(1, -5_500, -5_500), spawn(1, -3_500, -5_500), spawn(1, -1_500, -5_500)];
    const first = new Simulation('lightning-divergence', arenaWith(units));
    const second = new Simulation('lightning-divergence', arenaWith(units));
    cast(first, 1, 1); cast(second, 3, 2);
    first.step(); second.step();
    expect(first.snapshot().stateHash).not.toBe(second.snapshot().stateHash);
  });
});
