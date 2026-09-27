import { describe, expect, it } from 'vitest';
import { M01_ARENA, type ArenaDefinition } from '../../src/simulation/arena';
import {
  acquireEncounterTargets,
  acquireLocalSupportTargets,
  LOCAL_SUPPORT_RESPONSE_RANGE,
} from '../../src/simulation/auto-aggro';
import { Simulation } from '../../src/simulation/simulation';

class SupportSimulation extends Simulation {
  protected override prepareAutonomousCombat(tick: number): void {
    acquireEncounterTargets(this.entities, this.navigation, this.visibility, this.terrain, tick, [0]);
    acquireLocalSupportTargets(this.entities, this.navigation, this.visibility, this.terrain, tick, [0]);
  }
}

function supportArena(): ArenaDefinition {
  const base = M01_ARENA.units[0]!;
  return {
    ...M01_ARENA,
    zones: [],
    traversal: {
      originX: 0,
      originZ: 0,
      cellSize: 1000,
      columns: 24,
      rows: 20,
      initialNavVersion: 1,
      patches: [],
      freezableWaterPatches: [],
      vegetationPatches: [],
    },
    units: [
      { ...base, playerId: 0, x: 2500, z: 2500, speedPerTick: 400, attackRange: 1300, attackDamage: 10 },
      { ...base, playerId: 0, x: 11_000, z: 2500, speedPerTick: 400, attackRange: 1300, attackDamage: 40 },
      { ...base, playerId: 0, x: 19_500, z: 2500, speedPerTick: 400, attackRange: 1300, attackDamage: 10 },
    ],
  };
}

function hostile(sim: SupportSimulation, x: number, z: number, maxHealth = 100): number {
  const base = M01_ARENA.units[0]!;
  return sim.entities.createUnit({
    ...base,
    playerId: 1,
    x,
    z,
    speedPerTick: 0,
    attackDamage: 0,
    attackRange: 0,
    maxHealth,
  });
}

function automationTick(sim: SupportSimulation): void {
  sim.step();
}

describe('P5-A5 local combat support refinement', () => {
  it('pulls a nearby moving unit into an allied fight, then resumes its original MOVE destination', () => {
    const sim = new SupportSimulation('support-resume', supportArena());
    const enemy = hostile(sim, 3500, 2500);
    const destination = { x: 21_500, z: 2500 };

    sim.enqueueCommand({
      type: 'ATTACK',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetEntityId: enemy,
    });
    sim.enqueueCommand({
      type: 'MOVE',
      targetTick: 1,
      playerId: 0,
      entityIds: [2],
      targetX: destination.x,
      targetZ: destination.z,
    });
    automationTick(sim);

    const helperPosition = sim.entities.positions.get(2)!;
    const allyPosition = sim.entities.positions.get(1)!;
    expect(Math.hypot(helperPosition.x - allyPosition.x, helperPosition.z - allyPosition.z))
      .toBeLessThan(LOCAL_SUPPORT_RESPONSE_RANGE);

    automationTick(sim);
    const movement = sim.entities.movements.get(2)!;
    expect(sim.entities.combat.get(2)!.targetEntityId).toBe(enemy);
    expect(movement.localSupportActive).toBe(true);
    expect(movement.resumeMoveX).toBe(destination.x);
    expect(movement.resumeMoveZ).toBe(destination.z);

    for (let index = 0; index < 120 && sim.entities.hasUnit(enemy); index += 1) automationTick(sim);
    expect(sim.entities.hasUnit(enemy)).toBe(false);

    for (let index = 0; index < 120; index += 1) {
      automationTick(sim);
      const position = sim.entities.positions.get(2)!;
      if (position.x === destination.x && position.z === destination.z) break;
    }

    expect(sim.entities.positions.get(2)).toEqual(destination);
    expect(sim.entities.movements.get(2)).toMatchObject({
      resumeMoveX: null,
      resumeMoveZ: null,
      localSupportActive: false,
    });
  });

  it('lets ordinary transit engage a newly encountered local enemy and resume afterward', () => {
    const sim = new SupportSimulation('transit-encounter', {
      ...supportArena(),
      units: [supportArena().units[0]!],
    });
    const enemy = hostile(sim, 6500, 2500, 60);
    const destination = { x: 15_500, z: 2500 };
    sim.entities.combat.get(1)!.attackDamage = 60;

    sim.enqueueCommand({
      type: 'MOVE',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetX: destination.x,
      targetZ: destination.z,
    });
    automationTick(sim);
    automationTick(sim);

    expect(sim.entities.combat.get(1)!.targetEntityId).toBe(enemy);
    expect(sim.entities.movements.get(1)!.resumeMoveX).toBe(destination.x);

    for (let index = 0; index < 100 && sim.entities.hasUnit(enemy); index += 1) automationTick(sim);
    expect(sim.entities.hasUnit(enemy)).toBe(false);

    for (let index = 0; index < 100; index += 1) {
      automationTick(sim);
      if (sim.entities.positions.get(1)!.x === destination.x) break;
    }
    expect(sim.entities.positions.get(1)).toEqual(destination);
  });

  it('keeps MOVE issued during combat as a forced disengage until the destination is reached', () => {
    const sim = new SupportSimulation('forced-disengage-still-works', {
      ...supportArena(),
      units: [supportArena().units[0]!],
    });
    const enemy = hostile(sim, 3200, 2500, 500);
    sim.entities.combat.get(1)!.attackDamage = 1;

    automationTick(sim);
    expect(sim.entities.combat.get(1)!.targetEntityId).toBe(enemy);

    sim.enqueueCommand({
      type: 'MOVE',
      targetTick: sim.snapshot().tick + 1,
      playerId: 0,
      entityIds: [1],
      targetX: 15_500,
      targetZ: 2500,
    });
    automationTick(sim);
    expect(sim.entities.movements.get(1)!.autoSupportSuppressed).toBe(true);
    expect(sim.entities.combat.get(1)!.targetEntityId).toBeNull();

    for (let index = 0; index < 8; index += 1) {
      automationTick(sim);
      expect(sim.entities.combat.get(1)!.targetEntityId).toBeNull();
    }
    expect(sim.entities.positions.get(1)!.x).toBeGreaterThan(2500);
  });

  it('does not chain local-support calls outward through units that only joined as helpers', () => {
    const sim = new SupportSimulation('no-support-chain', supportArena());
    const enemy = hostile(sim, 3500, 2500, 500);
    sim.entities.combat.get(1)!.attackDamage = 1;

    sim.enqueueCommand({
      type: 'ATTACK',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetEntityId: enemy,
    });
    automationTick(sim);
    automationTick(sim);

    expect(sim.entities.combat.get(2)!.targetEntityId).toBe(enemy);
    expect(sim.entities.movements.get(2)!.localSupportActive).toBe(true);
    expect(sim.entities.combat.get(3)!.targetEntityId).toBeNull();

    automationTick(sim);
    expect(sim.entities.combat.get(3)!.targetEntityId).toBeNull();
  });

  it('does not override HOLD with local support', () => {
    const sim = new SupportSimulation('hold-does-not-support', supportArena());
    const enemy = hostile(sim, 3500, 2500, 500);
    sim.entities.combat.get(1)!.attackDamage = 1;

    sim.enqueueCommand({ type: 'ATTACK', targetTick: 1, playerId: 0, entityIds: [1], targetEntityId: enemy });
    sim.enqueueCommand({ type: 'HOLD', targetTick: 1, playerId: 0, entityIds: [2] });
    automationTick(sim);
    automationTick(sim);

    expect(sim.entities.movements.get(2)!.orderMode).toBe('HOLD');
    expect(sim.entities.combat.get(2)!.targetEntityId).toBeNull();
  });
});
