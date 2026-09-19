import { describe, expect, it } from 'vitest';
import { EntityStore } from '../../src/simulation/entity-store';
import { STARTING_PLAYER_ARCHETYPES, UNITS } from '../../src/simulation/m03-content';
import { BOSS_DEFINITIONS } from '../../src/simulation/m06-content';
import { M06Simulation } from '../../src/simulation/m06-simulation';
import { NEUTRAL_CAMP_XP_REWARD } from '../../src/simulation/neutral-encounter-state';
import {
  grantSharedExperience,
  scaledAttackDamage,
  scaledMaxHealth,
  unitLevelForXp,
} from '../../src/simulation/veteran-progression';
import { generateWorld } from '../../src/world/generator';

function createVanguards(count: number): { entities: EntityStore; ids: number[] } {
  const entities = new EntityStore();
  const ids: number[] = [];
  for (let index = 0; index < count; index += 1) {
    ids.push(entities.createUnit({
      archetype: 'VANGUARD',
      playerId: 0,
      x: index * 500,
      z: 0,
      ...UNITS.VANGUARD.spawn,
    }));
  }
  return { entities, ids };
}

describe('Phase 4 balance / run integration', () => {
  it('lets a small raiding squad level from one camp without leveling a full starting army', () => {
    const pair = createVanguards(2);
    grantSharedExperience(pair.entities, pair.ids, NEUTRAL_CAMP_XP_REWARD);
    expect(pair.ids.map((id) => pair.entities.experience.get(id)?.xp)).toEqual([75, 75]);
    expect(pair.ids.map((id) => unitLevelForXp(pair.entities.experience.get(id)?.xp ?? 0))).toEqual([2, 2]);

    const trio = createVanguards(3);
    grantSharedExperience(trio.entities, trio.ids, NEUTRAL_CAMP_XP_REWARD);
    expect(trio.ids.map((id) => trio.entities.experience.get(id)?.xp)).toEqual([50, 50, 50]);
    expect(trio.ids.map((id) => unitLevelForXp(trio.entities.experience.get(id)?.xp ?? 0))).toEqual([2, 2, 2]);

    const fullArmy = createVanguards(6);
    grantSharedExperience(fullArmy.entities, fullArmy.ids, NEUTRAL_CAMP_XP_REWARD);
    expect(fullArmy.ids.map((id) => fullArmy.entities.experience.get(id)?.xp)).toEqual([25, 25, 25, 25, 25, 25]);
    expect(fullArmy.ids.every((id) => unitLevelForXp(fullArmy.entities.experience.get(id)?.xp ?? 0) === 1)).toBe(true);
  });

  it('recovers half health at the Core in about 25 seconds instead of the old low-HP accelerated rate', () => {
    const simulation = new M06Simulation(generateWorld(4_950_800), {
      pace: 'SMOKE',
      difficulty: 'CASUAL',
    });
    const snapshot = simulation.snapshot();
    const unit = snapshot.entities.find((entity) => entity.playerId === 0 && entity.alive);
    expect(unit).toBeDefined();
    if (!unit) return;

    for (const enemy of snapshot.entities.filter((entity) => entity.playerId === 1)) {
      const health = simulation.entities.health.get(enemy.id);
      if (health) health.current = 0;
    }

    const core = simulation.run.snapshot().playerCore;
    const position = simulation.entities.positions.get(unit.id)!;
    const health = simulation.entities.health.get(unit.id)!;
    position.x = core.x;
    position.z = core.z;
    health.current = Math.floor(health.max / 2);

    for (let tick = 0; tick < 240; tick += 1) simulation.step();
    expect(simulation.entities.health.get(unit.id)?.current).toBeLessThan(health.max);

    for (let tick = 240; tick < 250; tick += 1) simulation.step();
    expect(simulation.entities.health.get(unit.id)?.current).toBe(health.max);
  }, 15_000);

  it('keeps Level 5 veteran scaling bounded rather than multiplicative', () => {
    for (const definition of Object.values(UNITS)) {
      const level5Health = scaledMaxHealth(definition.spawn.maxHealth, 5);
      const level5Damage = scaledAttackDamage(definition.spawn.attackDamage, 5);
      expect(level5Health / definition.spawn.maxHealth).toBeLessThanOrEqual(1.25);
      expect(level5Damage / definition.spawn.attackDamage).toBeLessThanOrEqual(1.18);
    }
  });

  it('does not let a fully Level 5 starting squad trivialize a finale boss on paper', () => {
    const rawDps = STARTING_PLAYER_ARCHETYPES.reduce((sum, archetype) => {
      const definition = UNITS[archetype];
      const damage = scaledAttackDamage(definition.spawn.attackDamage, 5);
      return sum + (damage * 10) / definition.spawn.attackIntervalTicks;
    }, 0);

    for (const boss of Object.values(BOSS_DEFINITIONS)) {
      const armorAdjustedDps = (rawDps * 100) / (100 + boss.armor);
      const theoreticalTtkSeconds = boss.maxHealth / armorAdjustedDps;
      expect(theoreticalTtkSeconds).toBeGreaterThan(80);
      expect(theoreticalTtkSeconds).toBeLessThan(150);
    }
  });
});
