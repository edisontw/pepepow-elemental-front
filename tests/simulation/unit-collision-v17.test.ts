import { describe, expect, it } from 'vitest';
import { M01_ARENA, type ArenaDefinition } from '../../src/simulation/arena';
import type { UnitSpawn } from '../../src/simulation/components';
import { Simulation } from '../../src/simulation/simulation';
import { UNIT_CONTACT_PADDING } from '../../src/simulation/unit-collision';

function unit(playerId: number, x: number, z: number, bodyRadius = 480): UnitSpawn {
  return {
    archetype: 'VANGUARD',
    playerId,
    x,
    z,
    speedPerTick: 500,
    selectionRadius: 700,
    bodyRadius,
    maxHealth: 180,
    attackDamage: 18,
    attackIntervalTicks: 10,
    attackRange: 1_250,
  };
}

function openArena(units: readonly UnitSpawn[]): ArenaDefinition {
  return {
    ...M01_ARENA,
    id: 'unit-contact-v17',
    width: 20_000,
    depth: 20_000,
    zones: [],
    traversal: {
      originX: 0,
      originZ: 0,
      cellSize: 1_000,
      columns: 20,
      rows: 20,
      initialNavVersion: 1,
      patches: [],
      freezableWaterPatches: [],
      vegetationPatches: [],
    },
    units,
  };
}

function distance(left: { x: number; z: number }, right: { x: number; z: number }): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

describe('v17 authoritative unit contact and separation', () => {
  it('separates overlapping idle units deterministically without leaving walkable terrain', () => {
    const first = new Simulation('unit-contact-idle', openArena([
      unit(0, 5_000, 5_000),
      unit(0, 5_000, 5_000),
    ]));
    const second = new Simulation('unit-contact-idle', openArena([
      unit(0, 5_000, 5_000),
      unit(0, 5_000, 5_000),
    ]));
    second.entities.positions.set(2, second.entities.positions.get(2)!);
    second.entities.positions.delete(1);
    second.entities.positions.set(1, { x: 5_000, z: 5_000 });

    const firstFrame = first.step();
    const secondFrame = second.step();
    const [left, right] = firstFrame.entities;
    expect(distance(left!, right!)).toBeGreaterThanOrEqual(
      left!.bodyRadius + right!.bodyRadius + UNIT_CONTACT_PADDING,
    );
    expect(first.navigation.isWalkable(first.navigation.worldToCell(left!.x, left!.z))).toBe(true);
    expect(first.navigation.isWalkable(first.navigation.worldToCell(right!.x, right!.z))).toBe(true);
    expect(firstFrame.stateHash).toBe(secondFrame.stateHash);
  });

  it('lets melee close to contact range and deal damage without center overlap', () => {
    const simulation = new Simulation('unit-contact-melee', openArena([
      unit(0, 3_000, 5_000),
      unit(1, 6_000, 5_000),
    ]));
    simulation.enqueueCommand({
      type: 'ATTACK',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetEntityId: 2,
    });

    let frame = simulation.snapshot();
    for (let tick = 0; tick < 8 && frame.entities[1]!.currentHealth === 180; tick += 1) {
      frame = simulation.step();
    }

    const attacker = frame.entities[0]!;
    const target = frame.entities[1]!;
    const centerDistance = distance(attacker, target);
    expect(target.currentHealth).toBeLessThan(180);
    expect(centerDistance).toBeGreaterThanOrEqual(
      attacker.bodyRadius + target.bodyRadius + UNIT_CONTACT_PADDING,
    );
    expect(centerDistance).toBeLessThanOrEqual(attacker.attackRange);
    expect(attacker.x).not.toBe(target.x);
    expect(attacker.z === target.z && attacker.x === target.x).toBe(false);
  });

  it('gives front-most same-faction traffic deterministic right-of-way in a chokepoint queue', () => {
    const simulation = new Simulation('unit-contact-traffic-priority', openArena([
      unit(0, 2_500, 5_500, 600),
      unit(0, 3_500, 5_500, 600),
    ]));
    simulation.enqueueCommand({
      type: 'MOVE',
      targetTick: 1,
      playerId: 0,
      entityIds: [1, 2],
      targetX: 10_500,
      targetZ: 5_500,
    });

    const frame = simulation.step();
    const rear = frame.entities[0]!;
    const front = frame.entities[1]!;
    expect(front.x).toBeGreaterThan(rear.x);
    expect(front.x).toBeGreaterThanOrEqual(4_000);
    expect(rear.x).toBeLessThan(3_000);
    expect(distance(rear, front)).toBeGreaterThanOrEqual(
      rear.bodyRadius + front.bodyRadius + UNIT_CONTACT_PADDING,
    );
  });

  it('replans from an authoritative local displacement when the old next path edge is no longer legal', () => {
    const simulation = new Simulation('unit-contact-path-repair', openArena([
      unit(0, 2_500, 2_500),
    ]));
    simulation.enqueueCommand({
      type: 'MOVE',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetX: 12_500,
      targetZ: 2_500,
    });
    simulation.step();

    // Emulate a deterministic contact correction into another walkable cell
    // without changing navVersion. The old next waypoint is now non-adjacent.
    simulation.entities.positions.set(1, { x: 2_500, z: 4_500 });
    for (let tick = 0; tick < 30; tick += 1) simulation.step();

    expect(simulation.snapshot().entities[0]).toMatchObject({
      x: 12_500,
      z: 2_500,
      targetX: null,
      targetZ: null,
    });
  });

  it('lets the nominal anchor yield when terrain blocks the preferred correction', () => {
    const simulation = new Simulation('unit-contact-wall-fallback', openArena([
      unit(0, 4_500, 5_000),
      unit(0, 5_000, 5_000),
    ]));
    simulation.navigation.applyWalkabilityChanges([
      { cell: { column: 4, row: 5 }, walkable: false },
    ]);
    simulation.enqueueCommand({
      type: 'HOLD',
      targetTick: 1,
      playerId: 0,
      entityIds: [2],
    });

    const beforeAnchor = simulation.snapshot().entities[1]!;
    const frame = simulation.step();
    const mover = frame.entities[0]!;
    const anchor = frame.entities[1]!;
    expect(anchor.x !== beforeAnchor.x || anchor.z !== beforeAnchor.z).toBe(true);
    expect(distance(mover, anchor)).toBeGreaterThanOrEqual(
      mover.bodyRadius + anchor.bodyRadius + UNIT_CONTACT_PADDING,
    );
    expect(simulation.navigation.isWalkable(simulation.navigation.worldToCell(anchor.x, anchor.z))).toBe(true);
  });

  it('gives an ordered friendly passage priority while an ordinary idle friendly yields locally', () => {
    const simulation = new Simulation('unit-contact-yield', openArena([
      unit(0, 4_000, 5_000),
      unit(0, 5_000, 5_000),
    ]));
    simulation.enqueueCommand({
      type: 'MOVE',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetX: 8_000,
      targetZ: 5_000,
    });
    const beforeIdle = simulation.snapshot().entities[1]!;
    const frame = simulation.step();
    const mover = frame.entities[0]!;
    const idle = frame.entities[1]!;
    expect(mover.x).toBeGreaterThan(4_000);
    expect(idle.x !== beforeIdle.x || idle.z !== beforeIdle.z).toBe(true);
    expect(distance(mover, idle)).toBeGreaterThanOrEqual(
      mover.bodyRadius + idle.bodyRadius + UNIT_CONTACT_PADDING,
    );

    for (let tick = 0; tick < 24; tick += 1) simulation.step();
    const settled = simulation.snapshot().entities;
    const resolvedMove = simulation.navigation.cellToWorld(
      simulation.navigation.resolveWalkableTarget(simulation.navigation.worldToCell(8_000, 5_000))!,
    );
    expect(settled[0]).toMatchObject({ ...resolvedMove, targetX: null, targetZ: null });
    expect(settled[1]).toMatchObject({
      x: beforeIdle.x,
      z: beforeIdle.z,
      targetX: null,
      targetZ: null,
      yieldReturnX: null,
      yieldReturnZ: null,
    });
  });
});
