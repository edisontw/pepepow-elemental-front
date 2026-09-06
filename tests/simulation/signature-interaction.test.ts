import { describe, expect, it } from 'vitest';
import { M01_ARENA, type ArenaDefinition } from '../../src/simulation/arena';
import type { GameCommand } from '../../src/simulation/commands';
import type { UnitSpawn } from '../../src/simulation/components';
import { CHAIN_LIGHTNING_WET_DAMAGE } from '../../src/simulation/lightning';
import { Simulation } from '../../src/simulation/simulation';
import { SurfaceType } from '../../src/simulation/terrain-state';

const CROSSING = { targetX: 2_000, targetZ: -3_000, radius: 5_000 };
const MELT_CELL_CENTER = { x: 500, z: -2_500 };

function spawn(playerId: number, x: number, z: number): UnitSpawn {
  return {
    archetype: 'VANGUARD', playerId, x, z, speedPerTick: 420, selectionRadius: 700,
    maxHealth: 500, attackDamage: 18, attackIntervalTicks: 11, attackRange: 1_250,
  };
}

function signatureArena(): ArenaDefinition {
  return {
    ...M01_ARENA,
    id: 'signature-interaction',
    units: [
      spawn(1, -5_500, -2_500),
      spawn(1, -3_500, -2_500),
      spawn(1, -2_500, -2_500),
      spawn(1, 1_500, -2_500),
      spawn(0, -6_500, -2_500),
    ],
  };
}

function commands(): GameCommand[] {
  return [
    { targetTick: 1, playerId: 0, type: 'CAST', effectId: 'FREEZE', ...CROSSING },
    { targetTick: 2, playerId: 0, type: 'CAST', effectId: 'FREEZE', ...CROSSING },
    { targetTick: 3, playerId: 1, type: 'MOVE', entityIds: [1], targetX: 10_500, targetZ: -2_500 },
    { targetTick: 3, playerId: 0, type: 'MOVE', entityIds: [5], targetX: 10_500, targetZ: -2_500 },
    { targetTick: 19, playerId: 0, type: 'STOP', entityIds: [5] },
    { targetTick: 19, playerId: 0, type: 'CAST', effectId: 'FIRE', targetX: MELT_CELL_CENTER.x, targetZ: MELT_CELL_CENTER.z, radius: 700 },
    { targetTick: 19, playerId: 0, type: 'CAST', effectId: 'FIRE', targetX: MELT_CELL_CENTER.x, targetZ: MELT_CELL_CENTER.z, radius: 700 },
    { targetTick: 20, playerId: 0, type: 'CAST', effectId: 'CHAIN_LIGHTNING', targetEntityId: 2 },
  ];
}

function runSignature(): { simulation: Simulation; hashes: string[] } {
  const simulation = new Simulation('signature-replay', signatureArena());
  commands().forEach((command) => simulation.enqueueCommand(command));
  const hashes: string[] = [];
  for (let tick = 1; tick <= 24; tick += 1) {
    simulation.step();
    if (tick % 3 === 0) hashes.push(simulation.snapshot().stateHash);
  }
  return { simulation, hashes };
}

describe('M01 Freeze → Cross → Fire Melt → Wet → Lightning signature', () => {
  it('executes the complete elemental terrain interaction through Simulation commands', () => {
    const simulation = new Simulation('signature-phases', signatureArena());
    expect(simulation.terrain.surfaceAt({ column: 24, row: 16 })).toBe(SurfaceType.WATER);
    expect(simulation.navigation.isWalkable({ column: 24, row: 16 })).toBe(false);
    commands().forEach((command) => simulation.enqueueCommand(command));

    simulation.step(); simulation.step();
    expect(simulation.terrain.surfaceAt({ column: 24, row: 16 })).toBe(SurfaceType.ICE);
    expect(simulation.navigation.isWalkable({ column: 24, row: 16 })).toBe(true);
    expect(simulation.navigation.navVersion).toBe(2);

    for (let tick = 3; tick <= 18; tick += 1) simulation.step();
    const enemyRoute = simulation.snapshot().entities[0]!.path
      .map((point) => simulation.navigation.worldToCell(point.x, point.z));
    const playerRoute = simulation.snapshot().entities[4]!.path
      .map((point) => simulation.navigation.worldToCell(point.x, point.z));
    expect(enemyRoute).toContainEqual({ column: 24, row: 16 });
    expect(playerRoute).toContainEqual({ column: 24, row: 16 });

    simulation.step();
    const afterMelt = simulation.snapshot();
    expect(simulation.terrain.surfaceAt({ column: 24, row: 16 })).toBe(SurfaceType.WATER);
    expect(simulation.navigation.isWalkable({ column: 24, row: 16 })).toBe(false);
    expect(simulation.navigation.navVersion).toBe(3);
    expect(afterMelt.entities[0]).toMatchObject({ x: 340, z: -2_500, wet: true });
    expect(afterMelt.entities[4]).toMatchObject({ x: -1_080, z: -2_500, wet: false, targetX: null });

    simulation.step();
    const afterLightning = simulation.snapshot();
    expect(afterLightning.lastLightningChain.slice(0, 4)).toEqual([2, 1, 4, 3]);
    expect(afterLightning.entities[0]?.currentHealth).toBe(500 - CHAIN_LIGHTNING_WET_DAMAGE);
    expect(afterLightning.entities[1]?.currentHealth).toBe(445);
    expect(afterLightning.entities[4]?.currentHealth).toBe(500);
  });

  it('replays the full command stream with identical chain results and hash checkpoints', () => {
    const first = runSignature();
    const second = runSignature();
    expect(first.simulation.snapshot().lastLightningChain).toEqual(second.simulation.snapshot().lastLightningChain);
    expect(first.hashes).toEqual(second.hashes);
    expect(first.simulation.snapshot().stateHash).toBe(second.simulation.snapshot().stateHash);
  });
});
