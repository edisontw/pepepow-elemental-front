import { describe, expect, it } from 'vitest';
import type { ArenaDefinition } from '../../src/simulation/arena';
import { EntityStore } from '../../src/simulation/entity-store';
import { Simulation } from '../../src/simulation/simulation';
import {
  MAX_UNIT_XP,
  UNIT_LEVEL_XP_THRESHOLDS,
  combatKillXp,
  grantExperience,
  unitLevelForXp,
  unitXpProgress,
} from '../../src/simulation/veteran-progression';

const ARENA: ArenaDefinition = {
  id: 'p4-veteran-test',
  width: 20_000,
  depth: 20_000,
  zones: [{ id: 'ground', kind: 'NORMAL_GROUND', centerX: 0, centerZ: 0, width: 20_000, depth: 20_000 }],
  traversal: {
    originX: -10_000,
    originZ: -10_000,
    cellSize: 1_000,
    columns: 20,
    rows: 20,
    initialNavVersion: 1,
    patches: [],
    freezableWaterPatches: [],
    vegetationPatches: [],
  },
  units: [
    {
      archetype: 'VANGUARD',
      playerId: 0,
      x: 0,
      z: 0,
      speedPerTick: 360,
      selectionRadius: 700,
      maxHealth: 180,
      attackDamage: 18,
      attackIntervalTicks: 11,
      attackRange: 1_250,
    },
    {
      archetype: 'RANGER',
      playerId: 0,
      x: 500,
      z: 0,
      speedPerTick: 350,
      selectionRadius: 700,
      maxHealth: 110,
      attackDamage: 17,
      attackIntervalTicks: 14,
      attackRange: 10_000,
    },
    {
      archetype: 'VANGUARD',
      playerId: 1,
      x: 1_000,
      z: 0,
      speedPerTick: 360,
      selectionRadius: 700,
      maxHealth: 180,
      attackDamage: 18,
      attackIntervalTicks: 11,
      attackRange: 1_250,
    },
  ],
};

describe('Phase 4 veteran progression', () => {
  it('maps deterministic cumulative XP thresholds to Level 1-5', () => {
    expect(UNIT_LEVEL_XP_THRESHOLDS).toEqual([0, 50, 120, 220, 350]);
    expect(unitLevelForXp(0)).toBe(1);
    expect(unitLevelForXp(49)).toBe(1);
    expect(unitLevelForXp(50)).toBe(2);
    expect(unitLevelForXp(119)).toBe(2);
    expect(unitLevelForXp(120)).toBe(3);
    expect(unitLevelForXp(220)).toBe(4);
    expect(unitLevelForXp(350)).toBe(5);
    expect(unitLevelForXp(9_999)).toBe(5);

    expect(unitXpProgress(119)).toMatchObject({
      level: 2,
      currentLevelXp: 50,
      nextLevelXp: 120,
      progressXp: 69,
      progressRequired: 70,
    });
    expect(unitXpProgress(350)).toMatchObject({
      level: 5,
      currentLevelXp: 350,
      nextLevelXp: null,
      progressXp: 0,
      progressRequired: null,
    });
  });

  it('applies modest linear HP/damage growth and only restores the new max-HP delta', () => {
    const entities = new EntityStore();
    const id = entities.createUnit({
      archetype: 'VANGUARD',
      playerId: 0,
      x: 0,
      z: 0,
      speedPerTick: 360,
      selectionRadius: 700,
      maxHealth: 180,
      attackDamage: 18,
      attackIntervalTicks: 11,
      attackRange: 1_250,
    });

    expect(grantExperience(entities, id, 49)).toBe(false);
    expect(entities.health.get(id)).toMatchObject({ current: 180, max: 180 });
    expect(entities.combat.get(id)?.attackDamage).toBe(18);

    expect(grantExperience(entities, id, 1)).toBe(true);
    expect(unitLevelForXp(entities.experience.get(id)!.xp)).toBe(2);
    expect(entities.health.get(id)).toMatchObject({ current: 191, max: 191 });
    expect(entities.combat.get(id)?.attackDamage).toBe(19);

    entities.health.get(id)!.current = 100;
    expect(grantExperience(entities, id, 70)).toBe(true);
    expect(unitLevelForXp(entities.experience.get(id)!.xp)).toBe(3);
    expect(entities.health.get(id)).toMatchObject({ current: 111, max: 202 });
    expect(entities.combat.get(id)?.attackDamage).toBe(19);

    expect(grantExperience(entities, id, 10_000)).toBe(true);
    expect(entities.experience.get(id)?.xp).toBe(MAX_UNIT_XP);
    expect(unitLevelForXp(entities.experience.get(id)!.xp)).toBe(5);
    expect(entities.health.get(id)?.max).toBe(223);
    expect(entities.combat.get(id)?.attackDamage).toBe(21);
  });

  it('shares normal combat-kill XP among nearby same-faction participants without last-hit ownership', () => {
    const simulation = new Simulation('p4-veteran-combat', ARENA);
    simulation.entities.health.get(3)!.current = 1;

    simulation.enqueueCommand({
      type: 'ATTACK',
      targetTick: 1,
      playerId: 0,
      entityIds: [1],
      targetEntityId: 3,
    });
    const frame = simulation.step();

    expect(frame.entities.find((entity) => entity.id === 3)?.alive).toBe(false);
    expect(combatKillXp('VANGUARD')).toBe(20);
    expect(simulation.entities.experience.get(1)?.xp).toBe(10);
    expect(simulation.entities.experience.get(2)?.xp).toBe(10);
    expect(frame.entities.find((entity) => entity.id === 1)?.level).toBe(1);
    expect(frame.entities.find((entity) => entity.id === 2)?.level).toBe(1);
  });
});
