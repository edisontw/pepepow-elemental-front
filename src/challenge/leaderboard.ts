import type {
  ChallengeScoreSubmission,
  RejectedScoreProof,
  ScoreProofResult,
  VerifiedScoreProof,
} from './score-proof';
import { verifyChallengeScoreSubmission } from './score-proof';

export const LOCAL_LEADERBOARD_VERSION = 'm07-local-leaderboard-v1' as const;
export const LOCAL_LEADERBOARD_LIMIT = 20;

export interface LeaderboardEntry {
  challengeCode: string;
  score: number;
  finalTick: number;
  finalStateHash: string;
  outcome: 'VICTORY' | 'DEFEAT';
  verification: 'MATCH';
  recordedAt: string;
}

export interface LeaderboardSubmissionAccepted {
  status: 'ACCEPTED';
  entry: LeaderboardEntry;
  rank: number;
}

export interface LeaderboardSubmissionRejected {
  status: 'REJECTED';
  proof: RejectedScoreProof;
}

export type LeaderboardSubmissionResult = LeaderboardSubmissionAccepted | LeaderboardSubmissionRejected;

export interface ChallengeLeaderboardGateway {
  submit(submission: ChallengeScoreSubmission): Promise<LeaderboardSubmissionResult>;
  list(challengeCode: string): Promise<readonly LeaderboardEntry[]>;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ScoreSubmissionVerifier = (submission: ChallengeScoreSubmission) => ScoreProofResult;

function storageKey(challengeCode: string): string {
  return `pepepow:elemental-front:m07:leaderboard:${challengeCode}`;
}

function sortEntries(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((left, right) => (
    right.score - left.score
    || left.finalTick - right.finalTick
    || left.finalStateHash.localeCompare(right.finalStateHash)
  ));
}

function entryFromProof(proof: VerifiedScoreProof, recordedAt: string): LeaderboardEntry {
  return {
    challengeCode: proof.challengeCode,
    score: proof.score,
    finalTick: proof.finalTick,
    finalStateHash: proof.finalStateHash,
    outcome: proof.outcome,
    verification: 'MATCH',
    recordedAt,
  };
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<LeaderboardEntry>;
  return typeof entry.challengeCode === 'string'
    && Number.isSafeInteger(entry.score)
    && Number.isSafeInteger(entry.finalTick)
    && typeof entry.finalStateHash === 'string'
    && (entry.outcome === 'VICTORY' || entry.outcome === 'DEFEAT')
    && entry.verification === 'MATCH'
    && typeof entry.recordedAt === 'string';
}

export class LocalVerifiedLeaderboard implements ChallengeLeaderboardGateway {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly verify: ScoreSubmissionVerifier = verifyChallengeScoreSubmission,
  ) {}

  async submit(submission: ChallengeScoreSubmission): Promise<LeaderboardSubmissionResult> {
    const proof = this.verify(submission);
    if (proof.status === 'REJECTED') return { status: 'REJECTED', proof };

    const existing = await this.list(proof.challengeCode);
    const withoutDuplicate = existing.filter((entry) => entry.finalStateHash !== proof.finalStateHash);
    const entry = entryFromProof(proof, this.now());
    const next = sortEntries([...withoutDuplicate, entry]).slice(0, LOCAL_LEADERBOARD_LIMIT);
    this.storage.setItem(storageKey(proof.challengeCode), JSON.stringify({
      version: LOCAL_LEADERBOARD_VERSION,
      entries: next,
    }));
    const rank = next.findIndex((candidate) => candidate.finalStateHash === entry.finalStateHash) + 1;
    return { status: 'ACCEPTED', entry, rank };
  }

  async list(challengeCode: string): Promise<readonly LeaderboardEntry[]> {
    const raw = this.storage.getItem(storageKey(challengeCode));
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return [];
      const record = parsed as { version?: unknown; entries?: unknown };
      if (record.version !== LOCAL_LEADERBOARD_VERSION || !Array.isArray(record.entries)) return [];
      return sortEntries(record.entries.filter(isLeaderboardEntry)).slice(0, LOCAL_LEADERBOARD_LIMIT);
    } catch {
      return [];
    }
  }
}
