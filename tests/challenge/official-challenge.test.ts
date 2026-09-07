import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_CHALLENGES,
  OfficialBlockSource,
  officialChallengeById,
  officialChallengeForDay,
  officialChallengeIdFromSearch,
  parseOfficialChallengeManifest,
} from '../../src/challenge/official-challenge';
import {
  createBlockChallengeIdentity,
  createBlockChallengeShareUrl,
} from '../../src/challenge/block-challenge';
import { generateWorld } from '../../src/world/generator';

describe('M07 official challenge manifest', () => {
  it('loads the canonical featured official challenge with an exact block and ruleset', () => {
    const featured = OFFICIAL_CHALLENGES.entries[0];
    expect(featured).toBeDefined();
    expect(featured).toMatchObject({
      id: 'm07-launch',
      label: 'M07 Official Launch',
      blockHeight: 4_950_628,
      rulesetVersion: 'm02-standard-v1',
      dayKey: null,
    });
    expect(officialChallengeById('m07-launch')).toEqual(featured);
    expect(officialChallengeById('missing')).toBeNull();
  });

  it('resolves an official entry through BlockSource without network access', async () => {
    const challenge = officialChallengeById('m07-launch');
    expect(challenge).not.toBeNull();
    if (!challenge) return;

    await expect(new OfficialBlockSource(challenge).resolve()).resolves.toMatchObject({
      blockHeight: 4_950_628,
      source: 'OFFICIAL',
      label: 'M07 Official Launch',
      officialChallengeId: 'm07-launch',
    });
  });

  it('supports future Daily entries by dayKey without imposing a refresh cadence', () => {
    const manifest = parseOfficialChallengeManifest({
      version: 'm07-official-challenges-v1',
      entries: [
        {
          id: 'daily-2026-09-07',
          label: 'Daily Challenge 2026-09-07',
          blockHeight: 4_950_700,
          rulesetVersion: 'm02-standard-v1',
          dayKey: '2026-09-07',
          source: 'test fixture',
          sourceBlockHash: null,
        },
      ],
    });
    expect(manifest.entries[0]?.dayKey).toBe('2026-09-07');
    expect(officialChallengeForDay('2026-09-07')).toBeNull();
  });

  it('rejects duplicate ids, duplicate day keys, and malformed dates', () => {
    expect(() => parseOfficialChallengeManifest({
      version: 'm07-official-challenges-v1',
      entries: [
        { id: 'same', label: 'A', blockHeight: 1, rulesetVersion: 'r', dayKey: null, source: 'x' },
        { id: 'same', label: 'B', blockHeight: 2, rulesetVersion: 'r', dayKey: null, source: 'x' },
      ],
    })).toThrow('Duplicate official challenge id');

    expect(() => parseOfficialChallengeManifest({
      version: 'm07-official-challenges-v1',
      entries: [
        { id: 'a', label: 'A', blockHeight: 1, rulesetVersion: 'r', dayKey: '2026-09-07', source: 'x' },
        { id: 'b', label: 'B', blockHeight: 2, rulesetVersion: 'r', dayKey: '2026-09-07', source: 'x' },
      ],
    })).toThrow('Duplicate official challenge dayKey');

    expect(() => parseOfficialChallengeManifest({
      version: 'm07-official-challenges-v1',
      entries: [
        { id: 'a', label: 'A', blockHeight: 1, rulesetVersion: 'r', dayKey: '09/07/2026', source: 'x' },
      ],
    })).toThrow('Invalid official challenge dayKey');
  });

  it('parses the official query and canonicalizes sharing away from source-selection parameters', () => {
    expect(officialChallengeIdFromSearch('?official=m07-launch')).toBe('m07-launch');
    expect(officialChallengeIdFromSearch('?block=123')).toBeNull();

    const world = generateWorld(4_950_628);
    const identity = createBlockChallengeIdentity(world, {
      mode: 'DESTROY',
      pace: 'STANDARD',
      faction: 'IRON_LEGION',
      difficulty: 'STANDARD',
    });
    const url = createBlockChallengeShareUrl(
      'https://example.test/game?official=m07-launch&live=pepepow&offset=10&source=pepepow',
      identity,
    );
    expect(url.searchParams.get('challenge')).toBe('bc1');
    expect(url.searchParams.get('block')).toBe('4950628');
    expect(url.searchParams.has('official')).toBe(false);
    expect(url.searchParams.has('live')).toBe(false);
    expect(url.searchParams.has('offset')).toBe(false);
    expect(url.searchParams.has('source')).toBe(false);
  }, 15_000);
});
