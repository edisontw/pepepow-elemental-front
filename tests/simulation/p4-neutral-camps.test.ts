import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_CAMP_XP_REWARD,
  NEUTRAL_GUARDIANS_PER_CAMP,
  NEUTRAL_PLAYER_ID,
} from '../../src/simulation/neutral-encounter-state';
import { M06Simulation } from '../../src/simulation/m06-simulation';
import { generateWorld } from '../../src/world/generator';

function playerIds(simulation: M06Simulation): number[] {
  return simulation.snapshot().entities
    .filter((entity) => entity.playerId === 0 && entity.alive)
    .map((entity) => entity.id);
}

describe('Phase 4 neutral camps', () => {
  it('activates all generated Neutral Camp POIs with deterministic sentinel guardians', () => {
    const world = generateWorld(4_950_700);
    const first = new M06Simulation(world, { pace: 'SMOKE', difficulty: 'CASUAL' });
    const second = new M06Simulation(world, { pace: 'SMOKE', difficulty: 'CASUAL' });

    const camps = first.neutralEncounters.snapshot().camps;
    expect(camps).toHaveLength(world.pois.filter((poi) => poi.type === 'NEUTRAL_CAMP').length);
    expect(camps).toHaveLength(5);
    expect(NEUTRAL_GUARDIANS_PER_CAMP).toBe(3);
    expect(camps.every((camp) => camp.guardianEntityIds.length === NEUTRAL_GUARDIANS_PER_CAMP)).toBe(true);

    for (const camp of camps) {
      for (const entityId of camp.guardianEntityIds) {
        const entity = first.snapshot().entities.find((candidate) => candidate.id === entityId);
        expect(entity).toMatchObject({
          playerId: NEUTRAL_PLAYER_ID,
          archetype: 'GOLEM',
          neutralCampId: camp.id,
          experience: 0,
        });
      }
    }

    expect(first.snapshot().stateHash).toBe(second.snapshot().stateHash);
    first.step();
    second.step();
    expect(first.snapshot().stateHash).toBe(second.snapshot().stateHash);
  });

  it('blocks camp capture until guards are cleared, then distributes deterministic XP to nearby participants', () => {
    const simulation = new M06Simulation(generateWorld(4_950_701), {
      pace: 'SMOKE',
      difficulty: 'CASUAL',
    });
    const camp = simulation.neutralEncounters.snapshot().camps[0];
    expect(camp).toBeDefined();
    if (!camp) return;

    const participants = playerIds(simulation).slice(0, 3);
    expect(participants).toHaveLength(3);
    for (const entityId of participants) {
      const position = simulation.entities.positions.get(entityId)!;
      position.x = camp.x;
      position.z = camp.z;
    }

    simulation.enqueueStrategicCommand({
      targetTick: 1,
      playerId: 0,
      type: 'CAPTURE',
      entityIds: participants,
      targetPoiId: camp.id,
    });
    simulation.step();
    expect(simulation.strategy.snapshot().captureOrders.some((order) => order.targetPoiId === camp.id)).toBe(false);

    for (const guardianId of camp.guardianEntityIds) {
      simulation.entities.health.get(guardianId)!.current = 0;
    }
    simulation.step();

    const cleared = simulation.neutralEncounters.snapshot().camps.find((candidate) => candidate.id === camp.id);
    expect(cleared).toMatchObject({
      cleared: true,
      aliveGuardianCount: 0,
      rewardPlayerId: 0,
      rewardXp: NEUTRAL_CAMP_XP_REWARD,
    });
    expect(cleared?.rewardRecipientEntityIds).toEqual(participants);

    const totalXp = participants.reduce(
      (sum, entityId) => sum + (simulation.entities.experience.get(entityId)?.xp ?? 0),
      0,
    );
    expect(totalXp).toBe(NEUTRAL_CAMP_XP_REWARD);

    simulation.enqueueStrategicCommand({
      targetTick: simulation.snapshot().tick + 1,
      playerId: 0,
      type: 'CAPTURE',
      entityIds: participants,
      targetPoiId: camp.id,
    });
    simulation.step();
    expect(simulation.strategy.snapshot().captureOrders.some((order) => order.targetPoiId === camp.id)).toBe(true);
  });

  it('keeps neutral guardians attackable through the normal unit ATTACK command', () => {
    const simulation = new M06Simulation(generateWorld(4_950_702), {
      pace: 'SMOKE',
      difficulty: 'CASUAL',
    });
    const camp = simulation.neutralEncounters.snapshot().camps[0];
    const attackerId = playerIds(simulation)[0];
    const guardianId = camp?.guardianEntityIds[0];
    expect(attackerId).toBeDefined();
    expect(guardianId).toBeDefined();
    if (attackerId === undefined || guardianId === undefined) return;

    simulation.enqueueCommand({
      targetTick: 1,
      playerId: 0,
      type: 'ATTACK',
      entityIds: [attackerId],
      targetEntityId: guardianId,
    });
    const frame = simulation.step();
    const attacker = frame.entities.find((entity) => entity.id === attackerId);
    expect(attacker?.attackTargetEntityId).toBe(guardianId);
  });
});
