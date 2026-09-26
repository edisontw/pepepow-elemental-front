import { describe, expect, it } from 'vitest';
import { CURRENT_CHALLENGE_RULESET_VERSION } from '../../src/challenge/ruleset';
import {
  FRONT_ORDER_SETTLE_RADIUS,
  GUARD_PURSUIT_LEASH,
  M06Simulation,
} from '../../src/simulation/m06-simulation';
import { CORE_UNIT_HEAL_RADIUS } from '../../src/simulation/m06-content';
import { generateWorld } from '../../src/world/generator';

function simulation(seed = 4_950_628): M06Simulation {
  return new M06Simulation(generateWorld(seed), { pace: 'SMOKE', difficulty: 'CASUAL' });
}

function playerIds(sim: M06Simulation): number[] {
  return sim.snapshot().entities.filter((entity) => entity.playerId === 0 && entity.alive).map((entity) => entity.id);
}

function firstEnemyId(sim: M06Simulation): number {
  return sim.snapshot().entities.find((entity) => entity.playerId === 1 && entity.alive)!.id;
}

function order(sim: M06Simulation, frontOrder: 'ADVANCE' | 'GUARD' | 'REGROUP', target?: { x: number; z: number }): void {
  sim.enqueueSquadOrder({
    targetTick: sim.snapshot().tick + 1,
    playerId: 0,
    type: 'SET_FRONT_ORDER',
    squadId: 1,
    order: frontOrder,
    ...(target ? { targetX: target.x, targetZ: target.z } : {}),
  });
}

function reachableTarget(sim: M06Simulation, entityId: number, minimumCells = 8): { x: number; z: number } {
  const position = sim.entities.positions.get(entityId)!;
  const start = sim.navigation.worldToCell(position.x, position.z);
  const world = sim.generatedWorld;
  for (let row = 0; row < world.height; row += 1) {
    for (let column = 0; column < world.width; column += 1) {
      const cell = { column, row };
      if (!sim.navigation.isWalkable(cell)) continue;
      const path = sim.navigation.findPath(start, cell);
      if (!path || path.length < minimumCells) continue;
      return sim.navigation.cellToWorld(cell);
    }
  }
  throw new Error('No reachable P5-A1 test target.');
}

describe('Phase 5 P5-A1 persistent Squad Front Orders', () => {
  it('creates stable deterministic squad membership and hashes authoritative order state', () => {
    const first = simulation();
    const second = simulation();
    expect(first.snapshot().squads).toEqual(second.snapshot().squads);
    expect(first.snapshot().squads.squads[0]?.memberEntityIds).toEqual(playerIds(first));
    const unit = playerIds(first)[0]!;
    const target = reachableTarget(first, unit);
    order(first, 'ADVANCE', target);
    first.step();
    expect(first.snapshot().squads.squads[0]).toMatchObject({
      id: 1,
      playerId: 0,
      currentOrder: 'ADVANCE',
      targetX: target.x,
      targetZ: target.z,
    });
    expect(first.snapshot().stateHash).not.toBe(second.snapshot().stateHash);
  });

  it('Advance engages local combat and resumes its persistent destination', () => {
    const sim = simulation(4_950_630);
    const ids = playerIds(sim);
    const unit = ids[0]!;
    for (const id of ids.slice(1)) sim.entities.health.get(id)!.alive = false;
    const start = { ...sim.entities.positions.get(unit)! };
    const target = reachableTarget(sim, unit, 12);
    const enemy = firstEnemyId(sim);
    sim.entities.positions.set(enemy, { x: start.x + 1_000, z: start.z });
    sim.entities.health.get(enemy)!.current = 1;
    sim.entities.combat.get(unit)!.attackDamage = 500;

    order(sim, 'ADVANCE', target);
    sim.step();
    sim.step();
    expect(sim.entities.hasUnit(enemy)).toBe(false);
    const afterCombat = { ...sim.entities.positions.get(unit)! };
    for (let tick = 0; tick < 12; tick += 1) sim.step();
    const later = sim.entities.positions.get(unit)!;
    const beforeDistance = Math.hypot(afterCombat.x - target.x, afterCombat.z - target.z);
    const afterDistance = Math.hypot(later.x - target.x, later.z - target.z);
    expect(afterDistance).toBeLessThan(beforeDistance);
    expect(sim.snapshot().squads.squads[0]?.currentOrder).toBe('ADVANCE');
  });

  it('Guard enforces a bounded pursuit leash and returns to its guard point', () => {
    const sim = simulation(4_950_629);
    const ids = playerIds(sim);
    const unit = ids[0]!;
    for (const id of ids.slice(1)) sim.entities.health.get(id)!.alive = false;
    const guard = { ...sim.entities.positions.get(unit)! };
    const enemy = firstEnemyId(sim);
    sim.entities.positions.set(enemy, { x: guard.x + 4_000, z: guard.z });
    sim.entities.combat.get(enemy)!.attackDamage = 0;

    order(sim, 'GUARD', guard);
    sim.step();
    sim.step();
    expect(sim.snapshot().squads.squads[0]?.guardTargetEntityId).toBe(enemy);

    sim.entities.positions.set(enemy, { x: guard.x + GUARD_PURSUIT_LEASH + 2_000, z: guard.z });
    const safeCell = sim.navigation.findPath(
      sim.navigation.worldToCell(guard.x, guard.z),
      sim.navigation.worldToCell(guard.x + 8_000, guard.z),
    )?.at(-1);
    if (safeCell) sim.entities.positions.set(unit, sim.navigation.cellToWorld(safeCell));
    sim.step();
    expect(sim.snapshot().squads.squads[0]?.guardTargetEntityId).toBeNull();
    expect(sim.entities.combat.get(unit)!.targetEntityId).toBeNull();
    const movement = sim.entities.movements.get(unit)!;
    expect(movement.targetX === guard.x || Math.hypot(sim.entities.positions.get(unit)!.x - guard.x, sim.entities.positions.get(unit)!.z - guard.z) <= FRONT_ORDER_SETTLE_RADIUS).toBe(true);
  });

  it('Regroup chooses a reachable Core recovery point and moves toward it', () => {
    const sim = simulation(4_950_631);
    const ids = playerIds(sim);
    const unit = ids[0]!;
    for (const id of ids.slice(1)) sim.entities.health.get(id)!.alive = false;
    const far = reachableTarget(sim, unit, 14);
    sim.entities.positions.set(unit, far);
    sim.entities.health.get(unit)!.current = Math.max(1, Math.floor(sim.entities.health.get(unit)!.max / 2));
    const core = sim.run.snapshot().playerCore;

    order(sim, 'REGROUP');
    sim.step();
    const squad = sim.snapshot().squads.squads[0]!;
    expect(squad.currentOrder).toBe('REGROUP');
    expect(squad.regroupState).toBe('RETURNING');
    expect(squad.regroupDestinationX).not.toBeNull();
    expect(squad.regroupDestinationZ).not.toBeNull();
    const destination = { x: squad.regroupDestinationX!, z: squad.regroupDestinationZ! };
    expect(sim.navigation.isWalkable(sim.navigation.worldToCell(destination.x, destination.z))).toBe(true);
    expect(Math.hypot(destination.x - core.x, destination.z - core.z)).toBeLessThanOrEqual(CORE_UNIT_HEAL_RADIUS);
    const before = Math.hypot(far.x - destination.x, far.z - destination.z);
    for (let tick = 0; tick < 8; tick += 1) sim.step();
    const position = sim.entities.positions.get(unit)!;
    expect(Math.hypot(position.x - destination.x, position.z - destination.z)).toBeLessThan(before);
  });

  it('never triggers Regroup from low HP alone', () => {
    const sim = simulation(4_950_632);
    const unit = playerIds(sim)[0]!;
    sim.entities.health.get(unit)!.current = 1;
    for (let tick = 0; tick < 8; tick += 1) sim.step();
    expect(sim.snapshot().squads.squads[0]?.currentOrder).toBeNull();
    expect(sim.snapshot().squads.squads[0]?.regroupState).toBe('NONE');
  });

  it('records Front Orders and reproduces identical state hashes in replay', () => {
    const world = generateWorld(4_950_633);
    const source = new M06Simulation(world, { pace: 'SMOKE', difficulty: 'CASUAL' });
    const unit = playerIds(source)[0]!;
    const target = reachableTarget(source, unit, 10);
    order(source, 'ADVANCE', target);
    const hashes: string[] = [];
    for (let tick = 0; tick < 20; tick += 1) hashes.push(source.step().stateHash);
    const packet = source.replayCheckpointPacket();
    expect(packet.header.version).toBe('ef-replay-v25');
    expect(packet.header.rulesetVersion).toBe(CURRENT_CHALLENGE_RULESET_VERSION);
    expect(packet.commands.some((entry) => entry.channel === 'SQUAD')).toBe(true);

    const replay = new M06Simulation(world, { pace: 'SMOKE', difficulty: 'CASUAL' });
    replay.loadReplay(packet);
    for (const hash of hashes) expect(replay.step().stateHash).toBe(hash);
    expect(replay.snapshot().replayVerification).toBe('MATCH');
  });

  it('lets a later Classic direct order cancel persistent Front Order authority', () => {
    const sim = simulation(4_950_634);
    const unit = playerIds(sim)[0]!;
    const advance = reachableTarget(sim, unit, 10);
    order(sim, 'ADVANCE', advance);
    sim.step();
    expect(sim.snapshot().squads.squads[0]?.currentOrder).toBe('ADVANCE');

    const classicTarget = reachableTarget(sim, unit, 4);
    sim.enqueueCommand({
      targetTick: sim.snapshot().tick + 1,
      playerId: 0,
      type: 'MOVE',
      entityIds: [unit],
      targetX: classicTarget.x,
      targetZ: classicTarget.z,
    });
    sim.step();
    expect(sim.snapshot().squads.squads[0]?.currentOrder).toBeNull();
    expect(sim.entities.movements.get(unit)!.orderMode).toBe('NORMAL');
  });
});
