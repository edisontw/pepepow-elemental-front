import { describe, expect, it } from 'vitest';
import { M01_ARENA, type ArenaDefinition } from '../../src/simulation/arena';
import type { GameCommand } from '../../src/simulation/commands';
import type { UnitSpawn } from '../../src/simulation/components';
import { Simulation } from '../../src/simulation/simulation';

function spawn(playerId: number, x: number, z: number, archetype: 'VANGUARD' | 'RANGER', health = 100): UnitSpawn {
  const ranged = archetype === 'RANGER';
  return {
    playerId, x, z, archetype, maxHealth: health, selectionRadius: 700, speedPerTick: 500,
    attackDamage: ranged ? 12 : 20, attackIntervalTicks: ranged ? 8 : 10, attackRange: ranged ? 6_000 : 1_250,
  };
}

function arenaWith(units: readonly UnitSpawn[]): ArenaDefinition {
  return { ...M01_ARENA, id: 'combat-test-arena', units };
}

function runTicks(simulation: Simulation, count: number): void {
  for (let index = 0; index < count; index += 1) simulation.step();
}

function attack(targetTick = 1): GameCommand {
  return { targetTick, playerId: 0, type: 'ATTACK', entityIds: [1], targetEntityId: 2 };
}

describe('M01 deterministic direct combat', () => {
  it('validates attacker ownership and hostile target', () => {
    const arena = arenaWith([spawn(0, -5_500, -5_500, 'RANGER'), spawn(1, -1_500, -5_500, 'VANGUARD')]);
    const wrongOwner = new Simulation('ownership', arena);
    wrongOwner.enqueueCommand({ ...attack(), playerId: 1 });
    wrongOwner.step();
    expect(wrongOwner.snapshot().entities[1]?.currentHealth).toBe(100);
    expect(wrongOwner.snapshot().activeAttackOrders).toBe(0);

    const friendly = new Simulation('friendly', arenaWith([spawn(0, -5_500, -5_500, 'RANGER'), spawn(0, -1_500, -5_500, 'VANGUARD')]));
    friendly.enqueueCommand(attack());
    friendly.step();
    expect(friendly.snapshot().activeAttackOrders).toBe(0);
  });

  it('makes melee pursue before attacking while ranged attacks immediately in range', () => {
    const melee = new Simulation('melee', arenaWith([spawn(0, -8_500, -5_500, 'VANGUARD'), spawn(1, -1_500, -5_500, 'VANGUARD')]));
    melee.enqueueCommand(attack());
    melee.step();
    expect(melee.snapshot().entities[1]?.currentHealth).toBe(100);
    expect(melee.snapshot().entities[0]?.x).toBeGreaterThan(-8_500);
    runTicks(melee, 20);
    expect(melee.snapshot().entities[1]?.currentHealth).toBeLessThan(100);

    const ranged = new Simulation('ranged', arenaWith([spawn(0, -5_500, -5_500, 'RANGER'), spawn(1, -1_500, -5_500, 'VANGUARD')]));
    ranged.enqueueCommand(attack());
    ranged.step();
    expect(ranged.snapshot().entities[1]?.currentHealth).toBe(88);
  });

  it('applies damage on the exact integer-tick cadence', () => {
    const simulation = new Simulation('cadence', arenaWith([spawn(0, -5_500, -5_500, 'RANGER'), spawn(1, -1_500, -5_500, 'VANGUARD', 200)]));
    simulation.enqueueCommand(attack());
    simulation.step();
    expect(simulation.snapshot().entities[1]?.currentHealth).toBe(188);
    runTicks(simulation, 7);
    expect(simulation.snapshot().entities[1]?.currentHealth).toBe(188);
    simulation.step();
    expect(simulation.snapshot().entities[1]?.currentHealth).toBe(176);
  });

  it('kills and cleans up the target deterministically, then rejects dead targets', () => {
    const simulation = new Simulation('death', arenaWith([spawn(0, -5_500, -5_500, 'RANGER'), spawn(1, -1_500, -5_500, 'VANGUARD', 24)]));
    simulation.enqueueCommand(attack());
    runTicks(simulation, 9);
    expect(simulation.snapshot().entities[1]).toMatchObject({ currentHealth: 0, alive: false });
    expect(simulation.snapshot().entities[0]?.attackTargetEntityId).toBeNull();
    simulation.enqueueCommand(attack(10));
    simulation.step();
    expect(simulation.snapshot().activeAttackOrders).toBe(0);
  });

  it('STOP cancels pursuit and MOVE replaces ATTACK', () => {
    const units = [spawn(0, -12_500, -5_500, 'VANGUARD'), spawn(1, -1_500, -5_500, 'VANGUARD')];
    const stopped = new Simulation('stop-attack', arenaWith(units));
    stopped.enqueueCommand(attack());
    stopped.enqueueCommand({ targetTick: 3, playerId: 0, type: 'STOP', entityIds: [1] });
    runTicks(stopped, 3);
    const stoppedX = stopped.snapshot().entities[0]?.x;
    runTicks(stopped, 5);
    expect(stopped.snapshot().entities[0]).toMatchObject({ x: stoppedX, attackTargetEntityId: null, targetX: null });

    const moved = new Simulation('move-replaces', arenaWith(units));
    moved.enqueueCommand(attack());
    moved.enqueueCommand({ targetTick: 2, playerId: 0, type: 'MOVE', entityIds: [1], targetX: -15_500, targetZ: -5_500 });
    runTicks(moved, 2);
    expect(moved.snapshot().entities[0]?.attackTargetEntityId).toBeNull();
    expect(moved.snapshot().entities[0]?.targetX).not.toBeNull();
  });

  it('replays combat streams with identical checkpoint/final hashes independent of map insertion order', () => {
    const arena = arenaWith([spawn(0, -5_500, -5_500, 'RANGER'), spawn(1, -1_500, -5_500, 'VANGUARD', 200)]);
    const first = new Simulation('combat-replay', arena);
    const second = new Simulation('combat-replay', arena);
    second.entities.positions.set(2, second.entities.positions.get(2)!);
    second.entities.positions.delete(1);
    second.entities.positions.set(1, { x: -5_500, z: -5_500 });
    first.enqueueCommand(attack());
    second.enqueueCommand(attack());
    const checkpoints: string[] = [];
    const repeated: string[] = [];
    for (let tick = 1; tick <= 30; tick += 1) {
      first.step(); second.step();
      if (tick % 10 === 0) { checkpoints.push(first.snapshot().stateHash); repeated.push(second.snapshot().stateHash); }
    }
    expect(checkpoints).toEqual(repeated);
  });
});
