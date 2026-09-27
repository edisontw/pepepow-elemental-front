import { describe, expect, it } from 'vitest';
import { M06Simulation, type M06SimulationSnapshot } from '../../src/simulation/m06-simulation';
import { generateWorld } from '../../src/world/generator';
import { deriveEventNavigatorCandidates } from '../../src/ui/event-navigator-model';

function harness() {
  const world = generateWorld(1_000_000);
  const simulation = new M06Simulation(world);
  return { world, snapshot: simulation.snapshot() };
}

describe('P5-A4 Event Navigator model', () => {
  it('surfaces battle start and a guarded front under attack from snapshot transitions', () => {
    const { world, snapshot: previous } = harness();
    const player = previous.entities.find((entity) => entity.playerId === 0)!;
    const enemy = previous.entities.find((entity) => entity.playerId === 1)!;
    const firstSquad = previous.squads.squads.find((squad) => squad.playerId === 0)!;

    const current: M06SimulationSnapshot = {
      ...previous,
      tick: previous.tick + 1,
      entities: previous.entities.map((entity) => (
        entity.id === player.id ? { ...entity, attackTargetEntityId: enemy.id } : entity
      )),
      squads: {
        ...previous.squads,
        squads: previous.squads.squads.map((squad) => (
          squad.id === firstSquad.id
            ? { ...squad, currentOrder: 'GUARD', targetX: player.x, targetZ: player.z }
            : squad
        )),
      },
    };

    const events = deriveEventNavigatorCandidates(previous, current, world);
    expect(events.some((event) => event.kind === 'BATTLE')).toBe(true);
    expect(events.some((event) => event.kind === 'GUARD' && event.key === `guard:${firstSquad.id}`)).toBe(true);
  });

  it('surfaces visible enemy pressure near a completed player Outpost', () => {
    const { world, snapshot: previousBase } = harness();
    const player = previousBase.entities.find((entity) => entity.playerId === 0)!;
    const enemy = previousBase.entities.find((entity) => entity.playerId === 1)!;
    const core = previousBase.strategic.buildings.find((building) => building.playerId === 0)!;
    const outpost = {
      ...core,
      id: 999,
      type: 'OUTPOST' as const,
      x: player.x,
      z: player.z,
      completed: true,
      destroyed: false,
    };
    const previous: M06SimulationSnapshot = {
      ...previousBase,
      strategic: {
        ...previousBase.strategic,
        buildings: [...previousBase.strategic.buildings, outpost],
      },
      entities: previousBase.entities.map((entity) => (
        entity.id === enemy.id ? { ...entity, x: player.x + 50_000, z: player.z + 50_000, visibleToPlayer: true } : entity
      )),
    };
    const current: M06SimulationSnapshot = {
      ...previous,
      tick: previous.tick + 1,
      entities: previous.entities.map((entity) => (
        entity.id === enemy.id ? { ...entity, x: player.x + 2_000, z: player.z, visibleToPlayer: true } : entity
      )),
    };

    expect(deriveEventNavigatorCandidates(previous, current, world))
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'OUTPOST', key: 'outpost:999' })]));
  });

  it('surfaces Shrine secured and neutral camp cleared transitions', () => {
    const { world, snapshot: previous } = harness();
    const shrine = world.pois.find((poi) => poi.type === 'SHRINE');
    const camp = previous.neutralEncounters.camps[0];
    if (!shrine || !camp) throw new Error('Expected generated Shrine and neutral camp.');

    const current: M06SimulationSnapshot = {
      ...previous,
      tick: previous.tick + 1,
      strategic: {
        ...previous.strategic,
        poiOwners: { ...previous.strategic.poiOwners, [shrine.id]: 0 },
      },
      neutralEncounters: {
        ...previous.neutralEncounters,
        totalCleared: previous.neutralEncounters.totalCleared + 1,
        camps: previous.neutralEncounters.camps.map((candidate) => (
          candidate.id === camp.id
            ? { ...candidate, cleared: true, clearedTick: previous.tick + 1, rewardPlayerId: 0, rewardXp: 150 }
            : candidate
        )),
      },
    };

    const events = deriveEventNavigatorCandidates(previous, current, world);
    expect(events.some((event) => event.kind === 'SHRINE' && event.key === `shrine:${shrine.id}`)).toBe(true);
    expect(events.some((event) => event.kind === 'CAMP' && event.key === `camp:${camp.id}`)).toBe(true);
  });

  it('surfaces a newly critical veteran and the newly exposed finale objective', () => {
    const { world, snapshot: previous } = harness();
    const veteran = previous.entities.find((entity) => entity.playerId === 0)!;
    const current: M06SimulationSnapshot = {
      ...previous,
      tick: previous.tick + 1,
      entities: previous.entities.map((entity) => (
        entity.id === veteran.id
          ? { ...entity, level: 2, experience: 50, currentHealth: Math.floor(entity.maxHealth * 0.3) }
          : entity
      )),
      run: {
        ...previous.run,
        finaleUnlocked: true,
        finaleUnlockedTick: previous.tick + 1,
        finaleUnlockReason: 'TIME',
      },
    };

    const events = deriveEventNavigatorCandidates(previous, current, world);
    expect(events.some((event) => event.kind === 'VETERAN' && event.key === `veteran:${veteran.id}`)).toBe(true);
    expect(events.some((event) => event.kind === 'OBJECTIVE' && event.label === 'Enemy Core exposed')).toBe(true);
  });
});
