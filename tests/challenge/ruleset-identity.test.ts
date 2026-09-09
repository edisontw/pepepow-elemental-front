import { describe, expect, it } from 'vitest';
import { createBlockChallengeIdentity } from '../../src/challenge/block-challenge';
import { CURRENT_CHALLENGE_RULESET_VERSION, isSupportedChallengeRuleset } from '../../src/challenge/ruleset';
import { M06Simulation } from '../../src/simulation/m06-simulation';
import { generateWorld } from '../../src/world/generator';

describe('post-roadmap competitive ruleset identity', () => {
  it('versions ef-standard-v2 gameplay independently from the stable M02 world generator', () => {
    const world = generateWorld(4_950_628);
    const challenge = createBlockChallengeIdentity(world, {
      mode: 'DESTROY',
      pace: 'STANDARD',
      faction: 'IRON_LEGION',
      difficulty: 'STANDARD',
    });
    const replay = new M06Simulation(world).replayCheckpointPacket();

    expect(world.identity.rulesetVersion).toBe('m02-standard-v1');
    expect(CURRENT_CHALLENGE_RULESET_VERSION).toBe('ef-standard-v2');
    expect(challenge.rulesetVersion).toBe(CURRENT_CHALLENGE_RULESET_VERSION);
    expect(replay.header.rulesetVersion).toBe(CURRENT_CHALLENGE_RULESET_VERSION);
    expect(replay.header.version).toBe('ef-replay-v2');
    expect(replay.header.startingAttunements).toEqual(['FIRE', 'WATER']);
    expect(isSupportedChallengeRuleset(CURRENT_CHALLENGE_RULESET_VERSION)).toBe(true);
    expect(isSupportedChallengeRuleset('m08-standard-v1')).toBe(false);
    expect(isSupportedChallengeRuleset(world.identity.rulesetVersion)).toBe(false);
  });
});
