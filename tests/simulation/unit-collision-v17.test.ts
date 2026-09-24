import { describe, expect, it } from 'vitest';
import { M01_ARENA, type ArenaDefinition } from '../../src/simulation/arena';
import { acquireEncounterTargets } from '../../src/simulation/auto-aggro';
import type { UnitSpawn } from '../../src/simulation/components';
import { Simulation } from '../../src/simulation/simulation';
import {
  FRIENDLY_DESTINATION_MERGE_RADIUS,
  FRIENDLY_SETTLED_CONTACT_PERMILLE,
  FRIENDLY_TRAFFIC_CONTACT_PERMILLE,
  UNIT_CONTACT_PADDING,
} from '../../src/simulation/unit-collision';

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

function friendlyContactDistance(
  left: { bodyRadius: number },
  right: { bodyRadius: number },
  permille: number,
): number {
  return Math.round(((left.bodyRadius + right.bodyRadius) * permille) / 1000) + UNIT_CONTACT_PADDING;
}

describe('v22 authoritative unit contact and separation', () => {
  it('accepts overlapping stationary friendlies as a deterministic settled cluster', () => {
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
    expect(firstFrame.entities.slice(0, 2).map((entity) => [entity.x, entity.z])).toEqual([
      [5_000, 5_000],
      [5_000, 5_000],
    ]);
    expect(firstFrame.stateHash).toBe(secondFrame.stateHash);

    const settledPositions = firstFrame.entities.slice(0, 2).map((entity) => [entity.x, entity.z]);
    for (let tick = 0; tick < 8; tick += 1) first.step();
    expect(first.snapshot().entities.slice(0, 2).map((entity) => [entity.x, entity.z])).toEqual(settledPositions);
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

  it('keeps an engaged melee attacker stable when another attacker arrives at the same target', () => {
    const simulation = new Simulation('unit-contact-melee-arrival', openArena([
      unit(0, 4_900, 5_000),
      unit(0, 3_900, 5_000),
      unit(1, 6_000, 5_000, 600),
    ]));
    const targetHealth = simulation.entities.health.get(3)!;
    targetHealth.current = 2_000;
    targetHealth.max = 2_000;

    simulation.enqueueCommand({
      type: 'HOLD',
      targetTick: 1,
      playerId: 1,
      entityIds: [3],
    });
    simulation.enqueueCommand({
      type: 'ATTACK',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetEntityId: 3,
    });
    simulation.step();
    const settledFront = { ...simulation.entities.positions.get(1)! };

    simulation.enqueueCommand({
      type: 'ATTACK',
      targetTick: 2,
      playerId: 0,
      entityIds: [2],
      targetEntityId: 3,
    });
    simulation.step();

    expect(simulation.entities.positions.get(1)).toEqual(settledFront);
    expect(simulation.entities.positions.get(2)).not.toEqual({ x: 4_400, z: 5_000 });
    expect(distance(
      simulation.entities.positions.get(1)!,
      simulation.entities.positions.get(3)!,
    )).toBeLessThanOrEqual(simulation.entities.combat.get(1)!.attackRange);
  });

  it('stabilizes multiple melee attackers around one shared target without repeated pursuit jitter', () => {
    const simulation = new Simulation('unit-contact-melee-ring', openArena([
      unit(0, 4_500, 4_500),
      unit(0, 4_500, 5_000),
      unit(0, 4_500, 5_500),
      unit(1, 6_000, 5_000, 600),
    ]));
    const targetHealth = simulation.entities.health.get(4)!;
    targetHealth.current = 2_000;
    targetHealth.max = 2_000;
    simulation.enqueueCommand({
      type: 'HOLD',
      targetTick: 1,
      playerId: 1,
      entityIds: [4],
    });
    simulation.enqueueCommand({
      type: 'ATTACK',
      targetTick: 1,
      playerId: 0,
      entityIds: [1, 2, 3],
      targetEntityId: 4,
    });

    for (let tick = 0; tick < 24; tick += 1) simulation.step();
    const settled = simulation.snapshot();
    const target = settled.entities[3]!;
    const attackers = settled.entities.slice(0, 3);
    expect(target).toMatchObject({ x: 6_000, z: 5_000 });
    expect(target.currentHealth).toBeLessThan(2_000);
    for (const attacker of attackers) {
      expect(distance(attacker, target)).toBeLessThanOrEqual(attacker.attackRange);
      expect(attacker.targetX).toBeNull();
      expect(attacker.targetZ).toBeNull();
    }

    const settledPositions = attackers.map((attacker) => [attacker.x, attacker.z]);
    for (let tick = 0; tick < 10; tick += 1) simulation.step();
    const later = simulation.snapshot();
    expect(later.entities.slice(0, 3).map((attacker) => [attacker.x, attacker.z])).toEqual(settledPositions);
    expect(later.entities[3]).toMatchObject({ x: 6_000, z: 5_000 });
  });

  it('keeps tolerated friendly overlap stable after a melee target dies', () => {
    const simulation = new Simulation('unit-contact-post-combat-settle', openArena([
      unit(0, 4_900, 5_000),
      unit(0, 5_200, 5_800),
      unit(0, 5_200, 4_200),
      unit(1, 6_000, 5_000, 600),
    ]));
    const targetHealth = simulation.entities.health.get(4)!;
    targetHealth.current = 18;
    targetHealth.max = 18;

    simulation.enqueueCommand({
      type: 'HOLD',
      targetTick: 1,
      playerId: 1,
      entityIds: [4],
    });
    simulation.enqueueCommand({
      type: 'ATTACK',
      targetTick: 1,
      playerId: 0,
      entityIds: [1, 2, 3],
      targetEntityId: 4,
    });

    const killed = simulation.step();
    expect(killed.entities[3]!.alive).toBe(false);
    const settledPositions = killed.entities.slice(0, 3).map((entity) => [entity.x, entity.z]);

    for (let tick = 0; tick < 8; tick += 1) simulation.step();
    const later = simulation.snapshot().entities.slice(0, 3);
    expect(later.map((entity) => [entity.x, entity.z])).toEqual(settledPositions);

    const first = later[0]!;
    const second = later[1]!;
    const fullBodyDistance = first.bodyRadius + second.bodyRadius + UNIT_CONTACT_PADDING;
    expect(distance(first, second)).toBeLessThan(fullBodyDistance);
    expect(distance(first, second)).toBeGreaterThanOrEqual(
      friendlyContactDistance(first, second, FRIENDLY_SETTLED_CONTACT_PERMILLE),
    );
  });

  it('discards a traffic yield-return when an idle unit auto-aggros, then settles where combat ends', () => {
    const simulation = new Simulation('unit-contact-autoaggro-yield-settle', openArena([
      unit(0, 4_000, 5_000),
      unit(0, 5_000, 5_000),
      unit(1, 15_000, 5_000),
    ]));

    simulation.enqueueCommand({
      type: 'MOVE',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetX: 8_000,
      targetZ: 5_000,
    });
    simulation.step();

    const yielded = simulation.entities.movements.get(2)!;
    expect(yielded.yieldReturnX).not.toBeNull();
    expect(yielded.yieldReturnZ).not.toBeNull();

    const fighter = simulation.entities.positions.get(2)!;
    simulation.entities.positions.set(3, { x: fighter.x + 1_000, z: fighter.z });
    const enemyHealth = simulation.entities.health.get(3)!;
    enemyHealth.current = 18;
    enemyHealth.max = 18;
    simulation.visibility.update(simulation.entities, simulation.navigation);

    const acquired = acquireEncounterTargets(
      simulation.entities,
      simulation.navigation,
      simulation.visibility,
      simulation.terrain,
      2,
    );
    expect(acquired).toBeGreaterThan(0);
    expect(simulation.entities.combat.get(2)!.targetEntityId).toBe(3);
    expect(simulation.entities.movements.get(2)).toMatchObject({
      yieldReturnX: null,
      yieldReturnZ: null,
    });

    simulation.enqueueCommand({ type: 'STOP', targetTick: 2, playerId: 0, entityIds: [1] });
    const killed = simulation.step();
    expect(killed.entities[2]!.alive).toBe(false);
    expect(killed.entities[1]).toMatchObject({
      attackTargetEntityId: null,
      targetX: null,
      targetZ: null,
      yieldReturnX: null,
      yieldReturnZ: null,
    });

    const settled = [killed.entities[0]!, killed.entities[1]!].map((entity) => [entity.x, entity.z]);
    for (let tick = 0; tick < 8; tick += 1) simulation.step();
    expect(simulation.snapshot().entities.slice(0, 2).map((entity) => [entity.x, entity.z])).toEqual(settled);
  });

  it('lets friendlies converge on one exact destination and settle without oscillation', () => {
    const simulation = new Simulation('unit-contact-shared-destination', openArena([
      unit(0, 4_500, 5_500),
      unit(0, 8_500, 5_500),
    ]));
    for (const entityId of [1, 2]) {
      simulation.enqueueCommand({
        type: 'MOVE',
        targetTick: 1,
        playerId: 0,
        entityIds: [entityId],
        targetX: 5_500,
        targetZ: 5_500,
      });
    }

    for (let tick = 0; tick < 20; tick += 1) simulation.step();
    const arrived = simulation.snapshot().entities.slice(0, 2);
    expect(arrived[0]).toMatchObject({ x: 5_500, z: 5_500, targetX: null, targetZ: null });
    expect(arrived[1]).toMatchObject({ x: 5_500, z: 5_500, targetX: null, targetZ: null });
    expect(distance(arrived[0]!, arrived[1]!)).toBe(0);
    expect(FRIENDLY_DESTINATION_MERGE_RADIUS).toBe(2_000);

    const settled = arrived.map((entity) => [entity.x, entity.z]);
    for (let tick = 0; tick < 10; tick += 1) simulation.step();
    expect(simulation.snapshot().entities.slice(0, 2).map((entity) => [entity.x, entity.z])).toEqual(settled);
  });

  it('keeps the melee defender anchored when accidental penetration is resolved', () => {
    const simulation = new Simulation('unit-contact-melee-anchor', openArena([
      unit(0, 5_500, 5_000),
      unit(1, 6_000, 5_000, 600),
    ]));
    simulation.enqueueCommand({
      type: 'HOLD',
      targetTick: 1,
      playerId: 1,
      entityIds: [2],
    });
    simulation.enqueueCommand({
      type: 'ATTACK',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetEntityId: 2,
    });

    const frame = simulation.step();
    expect(frame.entities[1]).toMatchObject({ x: 6_000, z: 5_000 });
    expect(distance(frame.entities[0]!, frame.entities[1]!)).toBeGreaterThanOrEqual(
      frame.entities[0]!.bodyRadius + frame.entities[1]!.bodyRadius + UNIT_CONTACT_PADDING,
    );
    expect(distance(frame.entities[0]!, frame.entities[1]!)).toBeLessThanOrEqual(frame.entities[0]!.attackRange);
  });

  it('gives front-most same-faction traffic deterministic right-of-way in a chokepoint queue', () => {
    const simulation = new Simulation('unit-contact-traffic-priority', openArena([
      unit(0, 2_500, 5_500, 600),
      unit(0, 3_500, 5_500, 600),
    ]));
    for (const entityId of [1, 2]) {
      simulation.enqueueCommand({
        type: 'MOVE',
        targetTick: 1,
        playerId: 0,
        entityIds: [entityId],
        targetX: 10_500,
        targetZ: 5_500,
      });
    }

    const frame = simulation.step();
    const rear = frame.entities[0]!;
    const front = frame.entities[1]!;
    expect(front.x).toBeGreaterThan(rear.x);
    expect(front.x).toBeGreaterThanOrEqual(4_000);
    expect(rear.x).toBeLessThan(3_000);
    expect(distance(rear, front)).toBeGreaterThanOrEqual(
      friendlyContactDistance(rear, front, FRIENDLY_TRAFFIC_CONTACT_PERMILLE),
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

  it('resolves active friendly overlap only onto walkable terrain', () => {
    const simulation = new Simulation('unit-contact-wall-fallback', openArena([
      unit(0, 4_500, 5_000),
      unit(0, 5_000, 5_000),
    ]));
    simulation.navigation.applyWalkabilityChanges([
      { cell: { column: 4, row: 4 }, walkable: false },
    ]);
    simulation.enqueueCommand({
      type: 'MOVE',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetX: 7_000,
      targetZ: 5_000,
    });
    simulation.enqueueCommand({
      type: 'HOLD',
      targetTick: 1,
      playerId: 0,
      entityIds: [2],
    });

    const frame = simulation.step();
    const mover = frame.entities[0]!;
    const anchor = frame.entities[1]!;
    expect(distance(mover, anchor)).toBeGreaterThanOrEqual(
      friendlyContactDistance(mover, anchor, FRIENDLY_TRAFFIC_CONTACT_PERMILLE),
    );
    expect(simulation.navigation.isWalkable(simulation.navigation.worldToCell(mover.x, mover.z))).toBe(true);
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
      friendlyContactDistance(mover, idle, FRIENDLY_TRAFFIC_CONTACT_PERMILLE),
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
