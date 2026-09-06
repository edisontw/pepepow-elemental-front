import { describe, expect, it } from 'vitest';
import {
  LocalVerifiedLeaderboard,
  type KeyValueStorage,
  type ScoreSubmissionVerifier,
} from '../../src/challenge/leaderboard';
import {
  SCORE_SUBMISSION_VERSION,
  type ChallengeScoreSubmission,
} from '../../src/challenge/score-proof';
import { BLOCK_CHALLENGE_VERSION } from '../../src/challenge/block-challenge';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function submission(score: number, finalTick: number, finalStateHash: string): ChallengeScoreSubmission {
  const challenge = {
    version: BLOCK_CHALLENGE_VERSION,
    blockHeight: 1_000_000,
    rulesetVersion: 'm02-standard-v1',
    worldGameplayHash: 'world-hash',
    generationAttempt: 0,
    mode: 'DESTROY' as const,
    pace: 'SMOKE' as const,
    faction: 'IRON_LEGION' as const,
    difficulty: 'CASUAL' as const,
  };
  return {
    version: SCORE_SUBMISSION_VERSION,
    challenge,
    challengeCode: 'BC1-TEST0001',
    replay: {
      header: {
        version: 'm06-replay-v1',
        blockHeight: challenge.blockHeight,
        rulesetVersion: challenge.rulesetVersion,
        worldGameplayHash: challenge.worldGameplayHash,
        generationAttempt: challenge.generationAttempt,
        mode: challenge.mode,
        pace: challenge.pace,
        faction: challenge.faction,
        difficulty: challenge.difficulty,
      },
      commands: [],
      finalTick,
      finalStateHash,
      outcome: 'VICTORY',
      totalScore: score,
    },
  };
}

describe('M07 verified leaderboard gateway', () => {
  it('stores only verifier-approved entries and ranks by score then time', async () => {
    const verify: ScoreSubmissionVerifier = (candidate) => ({
      status: 'VERIFIED',
      challenge: candidate.challenge,
      challengeCode: candidate.challengeCode,
      score: candidate.replay.totalScore,
      finalTick: candidate.replay.finalTick,
      finalStateHash: candidate.replay.finalStateHash,
      outcome: 'VICTORY',
    });
    const board = new LocalVerifiedLeaderboard(new MemoryStorage(), () => '2026-09-07T00:00:00.000Z', verify);

    await expect(board.submit(submission(20_000, 900, 'hash-a'))).resolves.toMatchObject({ status: 'ACCEPTED', rank: 1 });
    await expect(board.submit(submission(25_000, 1_100, 'hash-b'))).resolves.toMatchObject({ status: 'ACCEPTED', rank: 1 });
    await expect(board.submit(submission(25_000, 950, 'hash-c'))).resolves.toMatchObject({ status: 'ACCEPTED', rank: 1 });

    const entries = await board.list('BC1-TEST0001');
    expect(entries.map((entry) => [entry.score, entry.finalTick, entry.finalStateHash])).toEqual([
      [25_000, 950, 'hash-c'],
      [25_000, 1_100, 'hash-b'],
      [20_000, 900, 'hash-a'],
    ]);
    expect(entries.every((entry) => entry.verification === 'MATCH')).toBe(true);
  });

  it('does not persist a rejected proof', async () => {
    const reject: ScoreSubmissionVerifier = () => ({ status: 'REJECTED', reason: 'REPLAY_DIVERGED' });
    const board = new LocalVerifiedLeaderboard(new MemoryStorage(), () => '2026-09-07T00:00:00.000Z', reject);
    await expect(board.submit(submission(30_000, 800, 'bad-hash'))).resolves.toEqual({
      status: 'REJECTED',
      proof: { status: 'REJECTED', reason: 'REPLAY_DIVERGED' },
    });
    await expect(board.list('BC1-TEST0001')).resolves.toEqual([]);
  });
});
