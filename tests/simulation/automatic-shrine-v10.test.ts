import { expect, it } from 'vitest';
import { M04Simulation } from '../../src/simulation/m04-simulation';
import { RogueliteState } from '../../src/simulation/roguelite-state';
import { UPGRADES_BY_ID } from '../../src/simulation/m04-content';
import { generateWorld } from '../../src/world/generator';
import { worldCellToSimulationPosition } from '../../src/world/world-arena';

it('automatically offers three Attunement-eligible choices after physical securing, without activation input', () => {
  const world = generateWorld(1_000_000);
  const first = new M04Simulation(world);
  const second = new M04Simulation(world);
  const shrine = world.pois.find(p => p.type === 'SHRINE')!;
  const position = worldCellToSimulationPosition(world, shrine.cell);
  for (const sim of [first, second]) {
    for (const id of sim.entities.entityIds()) {
      if (sim.entities.factions.get(id)?.playerId === 0) sim.entities.positions.set(id, { ...position });
    }
  }
  for (let i = 0; i < 65; i++) {
    first.step(); second.step();
    expect(first.snapshot().stateHash).toBe(second.snapshot().stateHash);
  }
  const open = first.roguelite.snapshot().players[0]!.openShrine!;
  expect(first.strategy.snapshot().poiOwners[shrine.id]).toBe(0);
  expect(open.shrineId).toBe(shrine.id);
  expect(open.choiceIds).toHaveLength(3);
  for (const id of open.choiceIds) expect(first.attunements.isUpgradeEligible(0, UPGRADES_BY_ID[id]!.tags)).toBe(true);
  first.enqueueRogueliteCommand({ type: 'CHOOSE_SHRINE_UPGRADE', playerId: 0, targetTick: 66, shrineId: shrine.id, choiceIndex: 1 });
  first.step();
  expect(first.roguelite.snapshot().players[0]!.openShrine).toBeNull();
  expect(first.roguelite.snapshot().players[0]!.acquiredUpgradeIds).toEqual([open.choiceIds[1]]);
});

it('queues multiple secured Shrines by stable id, preserves open choices, and never offers a resolved Shrine twice', () => {
  const world = generateWorld(1_000_000);
  const sim = new M04Simulation(world);
  const state = new RogueliteState(world, sim.attunements);
  const shrines = world.pois.filter(p => p.type === 'SHRINE').sort((a, b) => a.id < b.id ? -1 : 1).slice(0, 2);
  const strategic = { ...sim.strategy.snapshot(), poiOwners: Object.fromEntries(shrines.map(p => [p.id, 0])) };
  state.offerSecuredShrines(strategic, 1);
  const open = state.snapshot().players[0]!.openShrine!;
  expect(open.shrineId).toBe(shrines[0]!.id);
  state.offerSecuredShrines(strategic, 2);
  expect(state.snapshot().players[0]!.openShrine).toEqual(open);
  for (const shrine of shrines) {
    expect(state.processCommand({ type: 'CHOOSE_SHRINE_UPGRADE', targetTick: 3, playerId: 0, shrineId: shrine.id, choiceIndex: 0 }, strategic, 3)).toBe(true);
    state.offerSecuredShrines(strategic, 3);
  }
  expect(state.snapshot().players[0]!.openShrine).toBeNull();
  expect(state.snapshot().players[0]!.resolvedShrineIds).toHaveLength(2);
});
