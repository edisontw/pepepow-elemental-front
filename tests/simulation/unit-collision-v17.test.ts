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
    id: 'unit-contact-v23',
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

describe('v23 authoritative unit contact and separation', () => {
  it('accepts fully overlapping stationary friendlies as a deterministic settled cluster', () => {
    const first = new Simulation('unit-contact-idle', openArena([
      unit(0, 5_000, 5_000),
      unit(0, 5_000, 5_000),
    ]));
    const second = new Simulation('unit-contact-idle', openArena([
      unit(0, 5_000, 5_000),
      unit(0, 5_000, 5_000),
    ]));

    const firstFrame = first.step();
    const secondFrame = second.step();
    expect(firstFrame.entities.slice(0, 2).map((entity) => [entity.x, entity.z])).toEqual([
      [5_000, 5_000],
      [5_000, 5_000],
    ]);
    expect(firstFrame.stateHash).toBe(secondFrame.stateHash);

    for (let tick = 0; tick < 8; tick += 1) first.step();
    expect(first.snapshot().entities.slice(0, 2).map((entity) => [entity.x, entity.z])).toEqual([
      [5_000, 5_000],
      [5_000, 5_000],
    ]);
  });

  it('lets an ordered friendly pass directly through an idle friendly without displacing it', () => {
    const simulation = new Simulation('unit-contact-friendly-phase-idle', openArena([
      unit(0, 3_500, 5_500),
      unit(0, 5_500, 5_500),
    ]));
    const idleBefore = { ...simulation.entities.positions.get(2)! };

    simulation.enqueueCommand({
      type: 'MOVE',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetX: 8_000,
      targetZ: 5_000,
    });

    for (let tick = 0; tick < 12; tick += 1) simulation.step();
    const frame = simulation.snapshot();
    const resolved = simulation.navigation.cellToWorld(
      simulation.navigation.resolveWalkableTarget(simulation.navigation.worldToCell(8_000, 5_000))!,
    );
    expect(frame.entities[0]).toMatchObject({ ...resolved, targetX: null, targetZ: null });
    expect(simulation.entities.positions.get(2)).toEqual(idleBefore);
    expect(frame.entities[1]).toMatchObject({
      x: idleBefore.x,
      z: idleBefore.z,
      yieldReturnX: null,
      yieldReturnZ: null,
    });
  });

  it('lets opposite-direction friendly traffic phase through without sidestep or push', () => {
    const simulation = new Simulation('unit-contact-friendly-cross', openArena([
      unit(0, 3_500, 5_500),
      unit(0, 7_500, 5_500),
    ]));
    simulation.enqueueCommand({
      type: 'MOVE',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetX: 7_000,
      targetZ: 5_000,
    });
    simulation.enqueueCommand({
      type: 'MOVE',
      targetTick: 1,
      playerId: 0,
      entityIds: [2],
      targetX: 3_000,
      targetZ: 5_000,
    });

    for (let tick = 0; tick < 10; tick += 1) simulation.step();
    const frame = simulation.snapshot();
    const right = simulation.navigation.cellToWorld(
      simulation.navigation.resolveWalkableTarget(simulation.navigation.worldToCell(7_000, 5_000))!,
    );
    const left = simulation.navigation.cellToWorld(
      simulation.navigation.resolveWalkableTarget(simulation.navigation.worldToCell(3_000, 5_000))!,
    );
    expect(frame.entities[0]).toMatchObject({ ...right, targetX: null, targetZ: null });
    expect(frame.entities[1]).toMatchObject({ ...left, targetX: null, targetZ: null });
  });

  it('does not let an arriving friendly melee attacker push an already engaged friendly', () => {
    const simulation = new Simulation('unit-contact-friendly-melee-phase', openArena([
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
    const frontBefore = { ...simulation.entities.positions.get(1)! };

    simulation.enqueueCommand({
      type: 'ATTACK',
      targetTick: 2,
      playerId: 0,
      entityIds: [2],
      targetEntityId: 3,
    });
    for (let tick = 0; tick < 4; tick += 1) simulation.step();

    expect(simulation.entities.positions.get(1)).toEqual(frontBefore);
    expect(distance(
      simulation.entities.positions.get(1)!,
      simulation.entities.positions.get(3)!,
    )).toBeLessThanOrEqual(simulation.entities.combat.get(1)!.attackRange);
  });

  it('lets melee close to hostile contact range and deal damage without hostile center overlap', () => {
    const simulation = new Simulation('unit-contact-hostile-melee', openArena([
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
  });

  it('keeps the hostile melee defender anchored when accidental penetration is resolved', () => {
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

  it('keeps hostile separation corrections on walkable terrain', () => {
    const simulation = new Simulation('unit-contact-hostile-wall', openArena([
      unit(0, 4_500, 5_000),
      unit(1, 5_000, 5_000),
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
      playerId: 1,
      entityIds: [2],
    });

    const frame = simulation.step();
    const mover = frame.entities[0]!;
    const anchor = frame.entities[1]!;
    expect(distance(mover, anchor)).toBeGreaterThanOrEqual(
      mover.bodyRadius + anchor.bodyRadius + UNIT_CONTACT_PADDING,
    );
    expect(simulation.navigation.isWalkable(simulation.navigation.worldToCell(mover.x, mover.z))).toBe(true);
    expect(simulation.navigation.isWalkable(simulation.navigation.worldToCell(anchor.x, anchor.z))).toBe(true);
  });
});
