import { describe, expect, it } from 'vitest';
import {
  createChallengeScoreSubmission,
  verifyChallengeScoreSubmission,
  verifyReplayPacketDeterministically,
} from '../../src/challenge/score-proof';
import { M06Simulation, type M06ReplayPacket } from '../../src/simulation/m06-simulation';
import { generateWorld } from '../../src/world/generator';

function checkpointPacket(): M06ReplayPacket {
  const simulation = new M06Simulation(generateWorld(1_000_021), {
    mode: 'DESTROY',
    pace: 'SMOKE',
    faction: 'IRON_LEGION',
    difficulty: 'CASUAL',
  });
  const entityIds = simulation.snapshot().entities
    .filter((entity) => entity.playerId === 0 && entity.alive)
    .map((entity) => entity.id);
  simulation.enqueueCommand({
    targetTick: 1,
    playerId: 0,
    type: 'STOP',
    entityIds,
  });
  for (let tick = 0; tick < 90; tick += 1) simulation.step();
  return simulation.replayCheckpointPacket();
}

describe('M07 replay-backed score proof', () => {
  it('rebuilds the world and verifies an untampered replay checkpoint', () => {
    const proof = verifyReplayPacketDeterministically(checkpointPacket());
    expect(proof).toMatchObject({
      status: 'MATCH',
      finalTick: 90,
      outcome: 'IN_PROGRESS',
      totalScore: 0,
    });
  }, 15_000);

  it('rejects a forged external command for the enemy player', () => {
    const packet = checkpointPacket();
    const first = packet.commands[0];
    if (!first || first.channel !== 'GAME') throw new Error('Expected a recorded GAME command.');
    const tampered: M06ReplayPacket = {
      ...packet,
      commands: [{
        channel: 'GAME',
        command: { ...first.command, playerId: 1 },
      }],
    };
    expect(verifyReplayPacketDeterministically(tampered)).toEqual({
      status: 'REJECTED',
      reason: 'FORBIDDEN_COMMAND',
    });
  });

  it('rejects a replay whose final state hash was altered', () => {
    const packet = checkpointPacket();
    const tampered: M06ReplayPacket = { ...packet, finalStateHash: 'tampered-state-hash' };
    expect(verifyReplayPacketDeterministically(tampered)).toEqual({
      status: 'REJECTED',
      reason: 'REPLAY_DIVERGED',
    });
  }, 15_000);

  it('does not allow an in-progress checkpoint to become a score submission', () => {
    expect(() => createChallengeScoreSubmission(checkpointPacket())).toThrow('Only completed runs');
  });

  it('rejects a score envelope whose challenge identity was changed', () => {
    const packet = checkpointPacket();
    const completedShape: M06ReplayPacket = {
      ...packet,
      outcome: 'VICTORY',
      totalScore: 10_000,
    };
    const submission = createChallengeScoreSubmission(completedShape);
    const tampered = {
      ...submission,
      challenge: {
        ...submission.challenge,
        blockHeight: submission.challenge.blockHeight + 1,
      },
    };
    expect(verifyChallengeScoreSubmission(tampered)).toEqual({
      status: 'REJECTED',
      reason: 'IDENTITY_MISMATCH',
    });
  });
});
