import { describe, expect, it } from 'vitest';
import { M01_ARENA, type ArenaDefinition } from '../../src/simulation/arena';
import { acquireEncounterTargets } from '../../src/simulation/auto-aggro';
import { NavigationGrid } from '../../src/simulation/navigation';
import { Simulation } from '../../src/simulation/simulation';
import { M06Simulation } from '../../src/simulation/m06-simulation';
import { generateWorld } from '../../src/world/generator';

function arena(): ArenaDefinition {
  return { ...M01_ARENA, zones: [], traversal: {
    originX: 0, originZ: 0, cellSize: 1000, columns: 20, rows: 20, initialNavVersion: 1, patches: [], freezableWaterPatches: [], vegetationPatches: [],
  }, units: [{ ...M01_ARENA.units[0]!, x: 2500, z: 2500, speedPerTick: 400, attackRange: 1300, attackDamage: 200 }] };
}
function tick(sim: Simulation) {
  acquireEncounterTargets(sim.entities, sim.navigation, sim.visibility, sim.terrain, sim.snapshot().tick + 1);
  sim.step();
}
function hostile(sim: Simulation, x: number, z: number) {
  return sim.entities.createUnit({ ...M01_ARENA.units[0]!, playerId: 1, x, z, speedPerTick: 0, attackDamage: 0, attackRange: 0 });
}

describe('v12 navigation and RTS orders', () => {
  it('travels in all eight directions with diagonal speed bounded by the same unit speed', () => {
    for (const [dx, dz] of [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]) {
      const sim = new Simulation('eight', arena());
      sim.enqueueCommand({ type: 'MOVE', targetTick: 1, playerId: 0, entityIds: [1], targetX: 2500 + dx! * 2000, targetZ: 2500 + dz! * 2000 });
      sim.step();
      const unit = sim.snapshot().entities[0]!;
      expect(Math.sign(unit.x - 2500)).toBe(dx);
      expect(Math.sign(unit.z - 2500)).toBe(dz);
      expect(Math.hypot(unit.x - 2500, unit.z - 2500)).toBeLessThanOrEqual(401);
    }
  });

  it('uses octile shortest paths, stable ties, and blocks a diagonal if either flank is blocked', () => {
    const nav = new NavigationGrid(arena().traversal);
    const start = { column: 2, row: 2 };
    const goal = { column: 5, row: 4 };
    const path = nav.findPath(start, goal)!;
    expect(path).toHaveLength(3);
    expect(path).toEqual(nav.findPath(start, goal));
    for (const flank of [{ column: 3, row: 2 }, { column: 2, row: 3 }]) {
      nav.applyWalkabilityChanges([{ cell: flank, walkable: false }]);
      expect(nav.canTraverse(start, { column: 3, row: 3 })).toBe(false);
      let prior = start;
      for (const cell of nav.findPath(start, goal)!) {
        expect(nav.canTraverse(prior, cell)).toBe(true);
        prior = cell;
      }
      nav.applyWalkabilityChanges([{ cell: flank, walkable: true }]);
    }
  });

  it('repaths after a diagonal flank closes mid-edge and never enters blocked ground', () => {
    const sim = new Simulation('repath', arena());
    sim.enqueueCommand({ type: 'MOVE', targetTick: 1, playerId: 0, entityIds: [1], targetX: 6500, targetZ: 6500 });
    sim.step();
    sim.navigation.applyWalkabilityChanges([{ cell: { column: 3, row: 2 }, walkable: false }]);
    for (let i = 0; i < 30; i++) {
      sim.step();
      const unit = sim.snapshot().entities[0]!;
      expect(sim.navigation.isWalkable(sim.navigation.worldToCell(unit.x, unit.z))).toBe(true);
    }
    expect(sim.snapshot().entities[0]).toMatchObject({ x: 6500, z: 6500 });
  });

  it('attack-moves using nearest/id target selection and resumes its formation destination after combat', () => {
    const sim = new Simulation('attack-move', arena());
    const enemy = hostile(sim, 6500, 2500);
    const tied = hostile(sim, 2500, 6500);
    sim.enqueueCommand({ type: 'ATTACK_MOVE', targetTick: 1, playerId: 0, entityIds: [1], targetX: 15500, targetZ: 15500, formation: 'LINE' });
    sim.step();
    const destination = { x: sim.entities.movements.get(1)!.attackMoveX, z: sim.entities.movements.get(1)!.attackMoveZ };
    acquireEncounterTargets(sim.entities, sim.navigation, sim.visibility, sim.terrain, 2);
    expect(sim.entities.combat.get(1)!.targetEntityId).toBe(enemy);
    expect(enemy).toBeLessThan(tied);
    for (let i = 0; i < 160; i++) tick(sim);
    expect(sim.entities.hasUnit(enemy)).toBe(false);
    expect(sim.entities.hasUnit(tied)).toBe(false);
    expect(sim.entities.positions.get(1)).toEqual(destination);
    expect(sim.entities.movements.get(1)!.orderMode).toBe('NORMAL');
  });

  it('normal Move forcibly disengages and suppresses auto-aggro until cancelled or complete', () => {
    const sim = new Simulation('forced-move-disengage', arena());
    const enemy = hostile(sim, 3200, 2500);
    sim.entities.combat.get(1)!.attackDamage = 1;

    acquireEncounterTargets(sim.entities, sim.navigation, sim.visibility, sim.terrain, 1);
    expect(sim.entities.combat.get(1)!.targetEntityId).toBe(enemy);

    sim.enqueueCommand({
      type: 'MOVE',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetX: 8500,
      targetZ: 2500,
    });
    sim.step();
    expect(sim.entities.combat.get(1)!.targetEntityId).toBeNull();
    expect(sim.entities.movements.get(1)!.targetX).not.toBeNull();

    for (let i = 0; i < 4; i++) {
      tick(sim);
      expect(sim.entities.combat.get(1)!.targetEntityId).toBeNull();
      expect(sim.entities.positions.get(1)!.x).toBeGreaterThan(2500);
    }
  });

  it('Stop cancels forced Move and restores ordinary automatic aggro on the next tick', () => {
    const sim = new Simulation('stop-restores-aggro', arena());
    const enemy = hostile(sim, 3200, 2500);
    sim.entities.combat.get(1)!.attackDamage = 1;

    sim.enqueueCommand({
      type: 'MOVE',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetX: 8500,
      targetZ: 2500,
    });
    sim.step();
    tick(sim);
    expect(sim.entities.combat.get(1)!.targetEntityId).toBeNull();

    sim.enqueueCommand({
      type: 'STOP',
      targetTick: sim.snapshot().tick + 1,
      playerId: 0,
      entityIds: [1],
    });
    tick(sim);
    expect(sim.entities.movements.get(1)!.targetX).toBeNull();
    expect(sim.entities.combat.get(1)!.targetEntityId).toBeNull();

    tick(sim);
    expect(sim.entities.combat.get(1)!.targetEntityId).toBe(enemy);
  });

  it('Hold fires in range without chasing, retargets an in-range enemy, and a new order cancels Hold', () => {
    const sim = new Simulation('hold', arena());
    const far = hostile(sim, 6500, 2500);
    sim.enqueueCommand({ type: 'HOLD', targetTick: 1, playerId: 0, entityIds: [1] });
    sim.step();
    for (let i = 0; i < 5; i++) tick(sim);
    expect(sim.entities.combat.get(1)!.targetEntityId).toBeNull();
    expect(sim.entities.positions.get(1)).toEqual({ x: 2500, z: 2500 });
    sim.entities.positions.set(far, { x: 3500, z: 2500 });
    tick(sim);
    expect(sim.entities.hasUnit(far)).toBe(false);
    expect(sim.entities.movements.get(1)!.orderMode).toBe('HOLD');
    expect(sim.entities.positions.get(1)).toEqual({ x: 2500, z: 2500 });
    sim.enqueueCommand({ type: 'MOVE', targetTick: sim.snapshot().tick + 1, playerId: 0, entityIds: [1], targetX: 8500, targetZ: 8500 });
    tick(sim);
    expect(sim.entities.movements.get(1)!.orderMode).toBe('NORMAL');
    expect(sim.entities.positions.get(1)!.x).toBeGreaterThan(2500);
  });

  it('hashes order intent even with identical positions and paths', () => {
    const first = new Simulation('hash', arena());
    const second = new Simulation('hash', arena());
    second.entities.movements.get(1)!.orderMode = 'HOLD';
    expect(first.snapshot().stateHash).not.toBe(second.snapshot().stateHash);
    second.entities.movements.get(1)!.orderMode = 'ATTACK_MOVE';
    const before = second.snapshot().stateHash;
    second.entities.movements.get(1)!.attackMoveX = 9500;
    expect(second.snapshot().stateHash).not.toBe(before);
  });

  it('records A/H, replaces Core orders, and replays v10 on generated traversal with identical checkpoints', () => {
    const world = generateWorld(4_950_630);
    const source = new M06Simulation(world, { pace: 'SMOKE', difficulty: 'CASUAL' });
    const ids = source.snapshot().entities.filter(u => u.playerId === 0).map(u => u.id);
    source.enqueueObjectiveAttack(ids, 'ENEMY_CORE');
    source.enqueueCommand({ type: 'ATTACK_MOVE', targetTick: 2, playerId: 0, entityIds: ids, targetX: -8000, targetZ: 8000, formation: 'SPREAD' });
    source.enqueueCommand({ type: 'HOLD', targetTick: 16, playerId: 0, entityIds: ids });
    const hashes: string[] = [];
    for (let i = 0; i < 30; i++) hashes.push(source.step().stateHash);
    const packet = source.replayCheckpointPacket();
    expect(packet.header.version).toBe('ef-replay-v22');
    const replay = new M06Simulation(world, { pace: 'SMOKE', difficulty: 'CASUAL' });
    replay.loadReplay(packet);
    for (const hash of hashes) expect(replay.step().stateHash).toBe(hash);
    expect(replay.snapshot().replayVerification).toBe('MATCH');
  });
});
