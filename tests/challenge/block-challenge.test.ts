import { describe, expect, it } from 'vitest';
import {
  assertBlockChallengeWorldMatches,
  blockChallengeCode,
  createBlockChallengeIdentity,
  createBlockChallengeShareUrl,
  readBlockChallengeShareRequest,
} from '../../src/challenge/block-challenge';
import {
  DEFAULT_MANUAL_BLOCK_HEIGHT,
  ManualBlockSource,
  manualBlockHeightFromSearch,
} from '../../src/challenge/block-source';
import { CURRENT_CHALLENGE_RULESET_VERSION } from '../../src/challenge/ruleset';
import { generateWorld } from '../../src/world/generator';

const RUN_OPTIONS = {
  mode: 'DESTROY',
  pace: 'STANDARD',
  faction: 'IRON_LEGION',
  difficulty: 'STANDARD',
} as const;

describe('M07 Block Challenge foundation', () => {
  it('keeps manual block mode deterministic and always available', async () => {
    const source = new ManualBlockSource(1_234_567);
    await expect(source.resolve()).resolves.toEqual({
      blockHeight: 1_234_567,
      source: 'MANUAL',
      label: 'Manual Block',
    });
    expect(manualBlockHeightFromSearch('?block=7654321')).toBe(7_654_321);
    expect(manualBlockHeightFromSearch('?block=invalid')).toBe(DEFAULT_MANUAL_BLOCK_HEIGHT);
  });

  it('creates the same challenge identity and code for the same world and run options', () => {
    const firstWorld = generateWorld(1_234_567);
    const secondWorld = generateWorld(1_234_567);
    const first = createBlockChallengeIdentity(firstWorld, RUN_OPTIONS);
    const second = createBlockChallengeIdentity(secondWorld, RUN_OPTIONS);

    expect(second).toEqual(first);
    expect(blockChallengeCode(second)).toBe(blockChallengeCode(first));
    expect(first.rulesetVersion).toBe(CURRENT_CHALLENGE_RULESET_VERSION);
    expect(first.rulesetVersion).not.toBe(firstWorld.identity.rulesetVersion);
    expect(first.worldGameplayHash).toBe(firstWorld.gameplayHash);
  });

  it('round-trips an exact challenge through a share URL', () => {
    const world = generateWorld(2_000_123);
    const identity = createBlockChallengeIdentity(world, {
      mode: 'BOSS_HUNT',
      pace: 'STANDARD',
      faction: 'FLAME_CULT',
      difficulty: 'HARD',
    });
    const shareUrl = createBlockChallengeShareUrl('https://example.test/game/?replay=last', identity);
    const request = readBlockChallengeShareRequest(shareUrl.search);

    expect(request).not.toBeNull();
    expect(request).toMatchObject({
      blockHeight: identity.blockHeight,
      rulesetVersion: identity.rulesetVersion,
      expectedWorldGameplayHash: identity.worldGameplayHash,
      expectedGenerationAttempt: identity.generationAttempt,
      mode: identity.mode,
      pace: identity.pace,
      faction: identity.faction,
      difficulty: identity.difficulty,
    });
    expect(shareUrl.searchParams.has('replay')).toBe(false);
    expect(() => assertBlockChallengeWorldMatches(request!, world)).not.toThrow();
  });

  it('rejects a shared identity when the gameplay ruleset or generated world does not match', () => {
    const world = generateWorld(3_000_001);
    const identity = createBlockChallengeIdentity(world, RUN_OPTIONS);
    const shareUrl = createBlockChallengeShareUrl('https://example.test/game/', identity);

    const wrongRuleset = new URL(shareUrl);
    wrongRuleset.searchParams.set('ruleset', 'obsolete-ruleset');
    expect(() => assertBlockChallengeWorldMatches(readBlockChallengeShareRequest(wrongRuleset.search)!, world))
      .toThrow('Challenge ruleset mismatch.');

    shareUrl.searchParams.set('world', 'tampered-world-hash');
    const request = readBlockChallengeShareRequest(shareUrl.search);
    expect(request).not.toBeNull();
    expect(() => assertBlockChallengeWorldMatches(request!, world)).toThrow('Challenge world hash mismatch.');
  });
});
