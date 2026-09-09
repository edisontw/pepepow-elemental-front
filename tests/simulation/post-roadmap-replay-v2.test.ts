import { describe, expect, it } from 'vitest';
import { CURRENT_CHALLENGE_RULESET_VERSION } from '../../src/challenge/ruleset';
import { M06Simulation } from '../../src/simulation/m06-simulation';
import { generateWorld } from '../../src/world/generator';

describe('post-roadmap replay v2 identity', () => {
  it('binds replay state to starting Attunements and ef-standard-v2', () => {
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
    expect(packet.header.version).toBe('ef-replay-v2');
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
