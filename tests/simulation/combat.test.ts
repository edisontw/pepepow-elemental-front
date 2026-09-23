import { describe, expect, it } from 'vitest';
import { M01_ARENA, type ArenaDefinition } from '../../src/simulation/arena';
import type { GameCommand } from '../../src/simulation/commands';
import type { UnitSpawn } from '../../src/simulation/components';
import { Simulation } from '../../src/simulation/simulation';

function spawn(playerId: number, x: number, z: number, archetype: 'VANGUARD' | 'RANGER' | 'ELEMENTALIST', health = 100): UnitSpawn {
  const elemental = archetype === 'ELEMENTALIST';
  const ranged = archetype === 'RANGER';
  return {
    playerId, x, z, archetype, maxHealth: health, selectionRadius: 700, speedPerTick: elemental ? 320 : 500,
    bodyRadius: elemental ? 420 : undefined,
    attackDamage: elemental ? 14 : ranged ? 12 : 20,
    attackIntervalTicks: elemental ? 15 : ranged ? 8 : 10,
    attackRange: elemental ? 9_000 : ranged ? 6_000 : 1_250,
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

  it('keeps Elementalist basic attacks at ranged standoff instead of walking into melee', () => {
    const simulation = new Simulation('elementalist-ranged-standoff', arenaWith([
      spawn(0, -10_500, -5_500, 'ELEMENTALIST'),
      spawn(1, -2_500, -5_500, 'VANGUARD', 200),
    ]));
    const before = simulation.snapshot().entities[0]!;

    simulation.enqueueCommand({
      type: 'ATTACK',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetEntityId: 2,
    });
    const frame = simulation.step();
    const caster = frame.entities[0]!;
    const target = frame.entities[1]!;

    expect(caster.x).toBe(before.x);
    expect(caster.z).toBe(before.z);
    expect(target.currentHealth).toBe(186);
    expect(Math.hypot(caster.x - target.x, caster.z - target.z)).toBe(8_000);
    expect(Math.hypot(caster.x - target.x, caster.z - target.z)).toBeLessThanOrEqual(caster.attackRange);
  });

  it('finishes sub-cell pursuit when melee units share a navigation cell but remain out of range', () => {
    const traversal = {
      originX: 0,
      originZ: 0,
      cellSize: 1_000,
      columns: 4,
      rows: 4,
      initialNavVersion: 1,
      patches: [],
      freezableWaterPatches: [],
      vegetationPatches: [],
    };
    const simulation = new Simulation('same-cell-melee-gap', {
      ...M01_ARENA,
      id: 'same-cell-melee-gap',
      width: 4_000,
      depth: 4_000,
      zones: [],
      traversal,
      units: [
        spawn(0, 1_010, 1_010, 'VANGUARD'),
        spawn(1, 1_990, 1_990, 'VANGUARD'),
      ],
    });
    const before = simulation.snapshot();
    const initialDistance = Math.hypot(
      before.entities[0]!.x - before.entities[1]!.x,
      before.entities[0]!.z - before.entities[1]!.z,
    );
    expect(initialDistance).toBeGreaterThan(before.entities[0]!.attackRange);

    simulation.enqueueCommand(attack());
    const frame = simulation.step();

    expect(frame.entities[0]!.x).toBeGreaterThan(before.entities[0]!.x);
    expect(frame.entities[0]!.z).toBeGreaterThan(before.entities[0]!.z);
    expect(frame.entities[1]!.currentHealth).toBeLessThan(100);
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
