import { describe, expect, it } from 'vitest';
import { CURRENT_CHALLENGE_RULESET_VERSION } from '../../src/challenge/ruleset';
import { M06Simulation } from '../../src/simulation/m06-simulation';
import { generateWorld } from '../../src/world/generator';

describe('post-roadmap replay v3 identity', () => {
  it('binds replay state to starting Attunements and ef-standard-v3', () => {
    const world = generateWorld(4_950_628);
    const first = new M06Simulation(world, {
      pace: 'SMOKE',
      difficulty: 'CASUAL',
      startingAttunementsByPlayer: { 0: ['FIRE', 'ICE'] },
    });
    const second = new M06Simulation(world, {
      pace: 'SMOKE',
      difficulty: 'CASUAL',
      startingAttunementsByPlayer: { 0: ['WATER', 'LIGHTNING'] },
    });
    expect(first.snapshot().stateHash).not.toBe(second.snapshot().stateHash);

    for (let tick = 0; tick < 8; tick += 1) first.step();
    const packet = first.replayCheckpointPacket();
    expect(packet.header.version).toBe('ef-replay-v3');
    expect(packet.header.rulesetVersion).toBe(CURRENT_CHALLENGE_RULESET_VERSION);
    expect(packet.header.startingAttunements).toEqual(['FIRE', 'ICE']);

    const replay = new M06Simulation(world, {
      pace: 'SMOKE',
      difficulty: 'CASUAL',
      startingAttunementsByPlayer: { 0: ['FIRE', 'ICE'] },
    });
    replay.loadReplay(packet);
    for (let tick = 0; tick < packet.finalTick; tick += 1) replay.step();
    expect(replay.snapshot().replayVerification).toBe('MATCH');
    expect(replay.snapshot().stateHash).toBe(packet.finalStateHash);
  });

  it('records and deterministically replays semantic formation MOVE commands', () => {
    const world = generateWorld(4_950_630);
    const source = new M06Simulation(world, { pace: 'SMOKE', difficulty: 'CASUAL' });
    const playerIds = source.snapshot().entities.filter((entity) => entity.playerId === 0 && entity.alive).map((entity) => entity.id);
    source.enqueueCommand({
      targetTick: 1,
      playerId: 0,
      type: 'MOVE',
      entityIds: playerIds,
      targetX: -8_000,
      targetZ: 8_000,
      formation: 'SPREAD',
    });
    for (let tick = 0; tick < 20; tick += 1) source.step();
    const packet = source.replayCheckpointPacket();
    expect(packet.commands[0]).toMatchObject({
      channel: 'GAME',
      command: { type: 'MOVE', formation: 'SPREAD' },
    });

    const replay = new M06Simulation(world, { pace: 'SMOKE', difficulty: 'CASUAL' });
    replay.loadReplay(packet);
    for (let tick = 0; tick < packet.finalTick; tick += 1) replay.step();
    expect(replay.snapshot().replayVerification).toBe('MATCH');
    expect(replay.snapshot().stateHash).toBe(packet.finalStateHash);
  });

  it('rejects replay playback when the constructor Attunements do not match the header', () => {
    const world = generateWorld(4_950_629);
    const source = new M06Simulation(world, {
      pace: 'SMOKE',
      difficulty: 'CASUAL',
      startingAttunementsByPlayer: { 0: ['FIRE', 'WATER'] },
    });
    source.step();
    const packet = source.replayCheckpointPacket();
    const mismatch = new M06Simulation(world, {
      pace: 'SMOKE',
      difficulty: 'CASUAL',
      startingAttunementsByPlayer: { 0: ['ICE', 'LIGHTNING'] },
    });
    expect(() => mismatch.loadReplay(packet)).toThrow(/Attunements mismatch/);
  });
});
