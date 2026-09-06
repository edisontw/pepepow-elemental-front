import { describe, expect, it } from 'vitest';
import { M04CommandQueue } from '../../src/simulation/m04-commands';
import {
  UPGRADES,
  UPGRADES_BY_ID,
  validateM04Content,
} from '../../src/simulation/m04-content';
import { M03Simulation } from '../../src/simulation/m03-simulation';
import { M04Simulation } from '../../src/simulation/m04-simulation';
import {
  RogueliteState,
  detectSynergies,
  modifierFromEffects,
  triggerFromEffects,
} from '../../src/simulation/roguelite-state';
import { generateWorld } from '../../src/world/generator';
import { M02_STANDARD_RULES } from '../../src/world/world-definition';

function claimedShrineStrategic(world: ReturnType<typeof generateWorld>, shrineId: string) {
  const snapshot = new M03Simulation(world).strategy.snapshot();
  return {
    ...snapshot,
    poiOwners: { ...snapshot.poiOwners, [shrineId]: 0 },
  };
}

describe('M04 roguelite layer', () => {
  it('validates the data-authored upgrade and event catalog', () => {
    expect(validateM04Content()).toEqual([]);
    expect(UPGRADES.length).toBeGreaterThanOrEqual(12);
    for (const tag of ['FIRE', 'WATER', 'ICE', 'LIGHTNING'] as const) {
      expect(UPGRADES.filter((upgrade) => upgrade.tags.includes(tag)).length).toBeGreaterThanOrEqual(3);
    }
    expect(UPGRADES.filter((upgrade) => upgrade.tags.includes('MIXED')).length).toBeGreaterThanOrEqual(3);
  });

  it('offers exactly three deterministic Shrine choices and resolves one authoritative upgrade', () => {
    const world = generateWorld(1_000_000);
    const shrine = world.pois.find((poi) => poi.type === 'SHRINE');
    expect(shrine).toBeDefined();
    if (!shrine) return;
    const strategic = claimedShrineStrategic(world, shrine.id);
    const first = new RogueliteState(world);
    const second = new RogueliteState(world);

    expect(first.processCommand({ targetTick: 1, playerId: 0, type: 'ACTIVATE_SHRINE', shrineId: shrine.id }, strategic, 1)).toBe(true);
    expect(second.processCommand({ targetTick: 1, playerId: 0, type: 'ACTIVATE_SHRINE', shrineId: shrine.id }, strategic, 1)).toBe(true);
    const firstOpen = first.snapshot().players[0]?.openShrine;
    const secondOpen = second.snapshot().players[0]?.openShrine;
    expect(firstOpen?.choiceIds).toHaveLength(3);
    expect(new Set(firstOpen?.choiceIds ?? []).size).toBe(3);
    expect(firstOpen).toEqual(secondOpen);

    expect(first.processCommand({ targetTick: 2, playerId: 0, type: 'CHOOSE_SHRINE_UPGRADE', shrineId: shrine.id, choiceIndex: 1 }, strategic, 2)).toBe(true);
    expect(second.processCommand({ targetTick: 2, playerId: 0, type: 'CHOOSE_SHRINE_UPGRADE', shrineId: shrine.id, choiceIndex: 1 }, strategic, 2)).toBe(true);
    const resolved = first.snapshot().players[0];
    expect(resolved?.acquiredUpgradeIds).toHaveLength(1);
    expect(resolved?.resolvedShrineIds).toEqual([shrine.id]);
    expect(resolved?.maxManaMilli).toBeGreaterThanOrEqual(270_000);
    expect(first.snapshot().stateHash).toBe(second.snapshot().stateHash);
  });

  it('does not let visual RNG salt perturb Shrine choices', () => {
    const firstWorld = generateWorld(1_000_123, M02_STANDARD_RULES, { visualSalt: 'm04-a' });
    const secondWorld = generateWorld(1_000_123, M02_STANDARD_RULES, { visualSalt: 'm04-b' });
    const firstShrine = firstWorld.pois.find((poi) => poi.type === 'SHRINE');
    const secondShrine = secondWorld.pois.find((poi) => poi.type === 'SHRINE');
    expect(firstShrine?.id).toBe(secondShrine?.id);
    if (!firstShrine || !secondShrine) return;

    const first = new RogueliteState(firstWorld);
    const second = new RogueliteState(secondWorld);
    expect(first.processCommand(
      { targetTick: 1, playerId: 0, type: 'ACTIVATE_SHRINE', shrineId: firstShrine.id },
      claimedShrineStrategic(firstWorld, firstShrine.id),
      1,
    )).toBe(true);
    expect(second.processCommand(
      { targetTick: 1, playerId: 0, type: 'ACTIVATE_SHRINE', shrineId: secondShrine.id },
      claimedShrineStrategic(secondWorld, secondShrine.id),
      1,
    )).toBe(true);
    expect(first.snapshot().players[0]?.openShrine?.choiceIds).toEqual(second.snapshot().players[0]?.openShrine?.choiceIds);
  });

  it('requires a captured M02 Shrine and prevents duplicate resolution', () => {
    const world = generateWorld(1_000_321);
    const shrine = world.pois.find((poi) => poi.type === 'SHRINE');
    expect(shrine).toBeDefined();
    if (!shrine) return;
    const state = new RogueliteState(world);
    const unclaimed = new M03Simulation(world).strategy.snapshot();
    expect(state.processCommand({ targetTick: 1, playerId: 0, type: 'ACTIVATE_SHRINE', shrineId: shrine.id }, unclaimed, 1)).toBe(false);

    const claimed = claimedShrineStrategic(world, shrine.id);
    expect(state.processCommand({ targetTick: 2, playerId: 0, type: 'ACTIVATE_SHRINE', shrineId: shrine.id }, claimed, 2)).toBe(true);
    expect(state.processCommand({ targetTick: 3, playerId: 0, type: 'CHOOSE_SHRINE_UPGRADE', shrineId: shrine.id, choiceIndex: 0 }, claimed, 3)).toBe(true);
    expect(state.processCommand({ targetTick: 4, playerId: 0, type: 'ACTIVATE_SHRINE', shrineId: shrine.id }, claimed, 4)).toBe(false);
  });

  it('aggregates generic modifiers and triggers without bespoke upgrade classes', () => {
    const fire = UPGRADES_BY_ID['fire-kindling-front'];
    const waterLightning = UPGRADES_BY_ID['water-conductive-current'];
    expect(fire).toBeDefined();
    expect(waterLightning).toBeDefined();
    if (!fire || !waterLightning) return;
    expect(modifierFromEffects(fire.effects, 'FIRE_RADIUS_PERMILLE')).toBe(250);
    expect(triggerFromEffects(waterLightning.effects, 'CAST_CHAIN_LIGHTNING_ON_WET_TARGET', 'EXTRA_LIGHTNING_CAST')).toBe(1);
  });

  it('detects early mixed-element build synergies from upgrade tags', () => {
    expect(detectSynergies(['fire-kindling-front', 'water-deep-reserve'])).toContain('STEAM_ENGINE');
    expect(detectSynergies(['fire-kindling-front', 'ice-whiteout-ring'])).toContain('THERMAL_SHOCK');
    expect(detectSynergies(['water-deep-reserve', 'lightning-arc-relay'])).toContain('STORMFRONT');
    expect(detectSynergies(['ice-whiteout-ring', 'lightning-arc-relay'])).toContain('BLACK_ICE');
    expect(detectSynergies(['fire-kindling-front', 'water-deep-reserve', 'ice-whiteout-ring'])).toContain('ELEMENTAL_CONVERGENCE');
  });

  it('uses an isolated deterministic world-event schedule', () => {
    const world = generateWorld(1_000_777);
    const first = new RogueliteState(world);
    const second = new RogueliteState(world);
    expect(first.snapshot().eventSchedule).toEqual(second.snapshot().eventSchedule);
    first.advance(900);
    second.advance(900);
    expect(first.snapshot().activeWorldEvent).toEqual(second.snapshot().activeWorldEvent);
    expect(first.snapshot().stateHash).toBe(second.snapshot().stateHash);
  });

  it('includes upgrade ownership in the combined M04 simulation hash', () => {
    const world = generateWorld(1_000_888);
    const shrine = world.pois.find((poi) => poi.type === 'SHRINE');
    expect(shrine).toBeDefined();
    if (!shrine) return;
    const first = new M04Simulation(world);
    const second = new M04Simulation(world);
    const claimed = claimedShrineStrategic(world, shrine.id);
    const command = { targetTick: 1, playerId: 0, type: 'ACTIVATE_SHRINE' as const, shrineId: shrine.id };
    expect(first.roguelite.processCommand(command, claimed, 1)).toBe(true);
    expect(second.roguelite.processCommand(command, claimed, 1)).toBe(true);
    expect(first.snapshot().stateHash).toBe(second.snapshot().stateHash);

    expect(first.roguelite.processCommand(
      { targetTick: 2, playerId: 0, type: 'CHOOSE_SHRINE_UPGRADE', shrineId: shrine.id, choiceIndex: 0 },
      claimed,
      2,
    )).toBe(true);
    expect(second.roguelite.processCommand(
      { targetTick: 2, playerId: 0, type: 'CHOOSE_SHRINE_UPGRADE', shrineId: shrine.id, choiceIndex: 0 },
      claimed,
      2,
    )).toBe(true);
    expect(first.snapshot().stateHash).toBe(second.snapshot().stateHash);

    const third = new M04Simulation(world);
    expect(third.roguelite.processCommand(command, claimed, 1)).toBe(true);
    expect(third.roguelite.processCommand(
      { targetTick: 2, playerId: 0, type: 'CHOOSE_SHRINE_UPGRADE', shrineId: shrine.id, choiceIndex: 1 },
      claimed,
      2,
    )).toBe(true);
    expect(third.snapshot().stateHash).not.toBe(first.snapshot().stateHash);
  });

  it('orders M04 commands deterministically by tick, player, then enqueue order', () => {
    const queue = new M04CommandQueue();
    queue.enqueue({ targetTick: 3, playerId: 1, type: 'ACTIVATE_SHRINE', shrineId: 'SHRINE-1' });
    queue.enqueue({ targetTick: 2, playerId: 0, type: 'ACTIVATE_SHRINE', shrineId: 'SHRINE-2' });
    queue.enqueue({ targetTick: 2, playerId: 0, type: 'ACTIVATE_SHRINE', shrineId: 'SHRINE-3' });
    expect(queue.drainForTick(2).map((command) => command.shrineId)).toEqual(['SHRINE-2', 'SHRINE-3']);
    expect(queue.size).toBe(1);
  });
});
