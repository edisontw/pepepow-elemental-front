import { describe, expect, it } from 'vitest';
import { createBlockChallengeIdentity } from '../../src/challenge/block-challenge';
import { CURRENT_CHALLENGE_RULESET_VERSION, isSupportedChallengeRuleset } from '../../src/challenge/ruleset';
import { M06Simulation } from '../../src/simulation/m06-simulation';
import { generateWorld } from '../../src/world/generator';

describe('M08 competitive ruleset identity', () => {
  it('versions complete gameplay semantics independently from the stable M02 world generator', () => {
    const world = generateWorld(4_950_628);
    const challenge = createBlockChallengeIdentity(world, {
      mode: 'DESTROY',
      pace: 'STANDARD',
      faction: 'IRON_LEGION',
      difficulty: 'STANDARD',
    });
    const replay = new M06Simulation(world).replayCheckpointPacket();

    expect(world.identity.rulesetVersion).toBe('m02-standard-v1');
    expect(challenge.rulesetVersion).toBe(CURRENT_CHALLENGE_RULESET_VERSION);
    expect(replay.header.rulesetVersion).toBe(CURRENT_CHALLENGE_RULESET_VERSION);
    expect(isSupportedChallengeRuleset(CURRENT_CHALLENGE_RULESET_VERSION)).toBe(true);
    expect(isSupportedChallengeRuleset(world.identity.rulesetVersion)).toBe(false);
  });
});
