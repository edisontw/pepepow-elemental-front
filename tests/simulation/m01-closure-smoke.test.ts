import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import type { GameCommand } from '../../src/simulation/commands';
import { FixedTickRunner } from '../../src/simulation/fixed-tick-runner';
import { formationOffsets, Simulation } from '../../src/simulation/simulation';

const EAST = { x: 16_000, z: 8_000 };
const WEST = { x: -16_000, z: 8_000 };
const CONVERGENCE_TICKS = 340;

function moveCommands(simulation: Simulation, targetTick: number, swapSides = false): GameCommand[] {
  const snapshot = simulation.snapshot();
  const playerIds = snapshot.entities.filter((unit) => unit.playerId === 0).map((unit) => unit.id);
  const enemyIds = snapshot.entities.filter((unit) => unit.playerId === 1).map((unit) => unit.id);
  return [
    { targetTick, playerId: 0, type: 'MOVE', entityIds: playerIds, targetX: swapSides ? WEST.x : EAST.x, targetZ: swapSides ? WEST.z : EAST.z },
    { targetTick, playerId: 1, type: 'MOVE', entityIds: enemyIds, targetX: swapSides ? EAST.x : WEST.x, targetZ: swapSides ? EAST.z : WEST.z },
  ];
}

function expectedDestinations(simulation: Simulation, playerId: number, target: { x: number; z: number }): Map<number, string> {
  const ids = simulation.snapshot().entities.filter((unit) => unit.playerId === playerId).map((unit) => unit.id);
  const offsets = formationOffsets(ids.length);
  return new Map(ids.map((id, index) => {
    const offset = offsets[index]!;
    const requested = simulation.navigation.worldToCell(target.x + offset.x, target.z + offset.z);
    const resolved = simulation.navigation.resolveWalkableTarget(requested)!;
    const world = simulation.navigation.cellToWorld(resolved);
    return [id, `${world.x},${world.z}`];
  }));
}

function runConvergence(seed: string): { simulation: Simulation; hashes: string[] } {
  const simulation = new Simulation(seed);
  const expected = new Map([
    ...expectedDestinations(simulation, 0, EAST),
    ...expectedDestinations(simulation, 1, WEST),
  ]);
  for (const command of moveCommands(simulation, 1)) simulation.enqueueCommand(command);
  const hashes: string[] = [];
  for (let tick = 1; tick <= CONVERGENCE_TICKS; tick += 1) {
    const snapshot = simulation.step();
    if ([1, 25, 50, 100, 180, CONVERGENCE_TICKS].includes(tick)) hashes.push(snapshot.stateHash);
  }

  for (const unit of simulation.snapshot().entities) {
    expect(`${unit.x},${unit.z}`).toBe(expected.get(unit.id));
    expect(unit).toMatchObject({ alive: true, targetX: null, targetZ: null, attackTargetEntityId: null });
    expect(unit.path).toHaveLength(0);
    expect(simulation.navigation.isWalkable(simulation.navigation.worldToCell(unit.x, unit.z))).toBe(true);
  }
  expect(new Set(simulation.snapshot().entities.map((unit) => `${unit.x},${unit.z}`)).size).toBe(40);
  return { simulation, hashes };
}

describe('M01 closure acceptance smoke', () => {
  it('ships a 40-unit handcrafted arena containing all four initial archetypes', () => {
    const snapshot = new Simulation('m01-roster').snapshot();
    expect(snapshot.entities).toHaveLength(40);
    expect(new Set(snapshot.entities.map((unit) => unit.archetype))).toEqual(
      new Set(['VANGUARD', 'RANGER', 'ELEMENTALIST', 'GOLEM']),
    );
    expect(snapshot.entities.find((unit) => unit.archetype === 'ELEMENTALIST')).toMatchObject({
      maxHealth: 100, attackDamage: 14, attackIntervalTicks: 15, attackRange: 9_000,
    });
    expect(snapshot.entities.find((unit) => unit.archetype === 'GOLEM')).toMatchObject({
      maxHealth: 600, attackDamage: 42, attackIntervalTicks: 18, attackRange: 1_250,
    });
  });

  it('moves 40 units through the chokepoint without deadlock and replays matching hashes', () => {
    const first = runConvergence('m01-40-unit-replay');
    const second = runConvergence('m01-40-unit-replay');
    expect(first.hashes).toEqual(second.hashes);
    expect(first.simulation.snapshot().stateHash).toBe(second.simulation.snapshot().stateHash);
  }, 15_000);

  it('is FPS-independent and remains within the generous simulation performance gate', () => {
    const runSchedule = (schedule: number[]): string => {
      const simulation = new Simulation('m01-40-unit-fps');
      for (const command of moveCommands(simulation, 1)) simulation.enqueueCommand(command);
      const runner = new FixedTickRunner(simulation);
      for (const frameMs of schedule) runner.advance(frameMs);
      return simulation.snapshot().stateHash;
    };
    expect(runSchedule(Array.from({ length: 680 }, () => 50))).toBe(
      runSchedule(Array.from({ length: 340 }, () => 100)),
    );

    const simulation = new Simulation('m01-performance');
    for (const command of [
      ...moveCommands(simulation, 1),
      ...moveCommands(simulation, 141, true),
      ...moveCommands(simulation, 281),
    ]) simulation.enqueueCommand(command);
    const started = performance.now();
    for (let tick = 1; tick <= 420; tick += 1) {
      const snapshot = simulation.step();
      if (tick % 25 === 0) {
        expect(snapshot.stateHash).toMatch(/^[0-9a-f]{8}$/);
        for (const unit of snapshot.entities) {
          expect(Number.isSafeInteger(unit.x) && Number.isSafeInteger(unit.z)).toBe(true);
        }
      }
    }
    const elapsedMs = performance.now() - started;
    console.info(`M01 40-unit performance: ${elapsedMs.toFixed(1)} ms / 420 ticks (${(elapsedMs / 420).toFixed(3)} ms/tick)`);
    expect(elapsedMs).toBeLessThan(5_000);
  }, 15_000);
});
