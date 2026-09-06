import {
  BLOCK_CHALLENGE_VERSION,
  blockChallengeCode,
  type BlockChallengeIdentity,
} from './block-challenge';
import {
  M06Simulation,
  type M06ReplayPacket,
} from '../simulation/m06-simulation';
import { generateWorld } from '../world/generator';
import { M02_STANDARD_RULES } from '../world/world-definition';

export const SCORE_SUBMISSION_VERSION = 'm07-score-v1' as const;
export const MAX_COMPETITIVE_REPLAY_TICKS = 36_000;

export interface ChallengeScoreSubmission {
  version: typeof SCORE_SUBMISSION_VERSION;
  challenge: BlockChallengeIdentity;
  challengeCode: string;
  replay: M06ReplayPacket;
}

export type ScoreProofFailureReason =
  | 'RUN_NOT_COMPLETE'
  | 'UNSUPPORTED_RULESET'
  | 'IDENTITY_MISMATCH'
  | 'FORBIDDEN_COMMAND'
  | 'REPLAY_TOO_LONG'
  | 'WORLD_MISMATCH'
  | 'REPLAY_DIVERGED'
  | 'RESULT_MISMATCH';

export interface VerifiedReplayProof {
  status: 'MATCH';
  finalTick: number;
  finalStateHash: string;
  outcome: M06ReplayPacket['outcome'];
  totalScore: number;
}

export interface RejectedScoreProof {
  status: 'REJECTED';
  reason: ScoreProofFailureReason;
}

export type ReplayProofResult = VerifiedReplayProof | RejectedScoreProof;

export interface VerifiedScoreProof {
  status: 'VERIFIED';
  challenge: BlockChallengeIdentity;
  challengeCode: string;
  score: number;
  finalTick: number;
  finalStateHash: string;
  outcome: 'VICTORY' | 'DEFEAT';
}

export type ScoreProofResult = VerifiedScoreProof | RejectedScoreProof;

function challengeIdentityFromReplay(packet: M06ReplayPacket): BlockChallengeIdentity {
  return {
    version: BLOCK_CHALLENGE_VERSION,
    blockHeight: packet.header.blockHeight,
    rulesetVersion: packet.header.rulesetVersion,
    worldGameplayHash: packet.header.worldGameplayHash,
    generationAttempt: packet.header.generationAttempt,
    mode: packet.header.mode,
    pace: packet.header.pace,
    faction: packet.header.faction,
    difficulty: packet.header.difficulty,
  };
}

function sameChallenge(left: BlockChallengeIdentity, right: BlockChallengeIdentity): boolean {
  return left.version === right.version
    && left.blockHeight === right.blockHeight
    && left.rulesetVersion === right.rulesetVersion
    && left.worldGameplayHash === right.worldGameplayHash
    && left.generationAttempt === right.generationAttempt
    && left.mode === right.mode
    && left.pace === right.pace
    && left.faction === right.faction
    && left.difficulty === right.difficulty;
}

function competitiveCommandStreamIsAllowed(packet: M06ReplayPacket): boolean {
  return packet.commands.every((entry) => entry.command.playerId === 0);
}

export function createChallengeScoreSubmission(packet: M06ReplayPacket): ChallengeScoreSubmission {
  if (packet.outcome === 'IN_PROGRESS') throw new Error('Only completed runs can create a challenge score submission.');
  const challenge = challengeIdentityFromReplay(packet);
  return {
    version: SCORE_SUBMISSION_VERSION,
    challenge,
    challengeCode: blockChallengeCode(challenge),
    replay: packet,
  };
}

export function verifyReplayPacketDeterministically(packet: M06ReplayPacket): ReplayProofResult {
  if (packet.header.rulesetVersion !== M02_STANDARD_RULES.rulesetVersion) {
    return { status: 'REJECTED', reason: 'UNSUPPORTED_RULESET' };
  }
  if (!competitiveCommandStreamIsAllowed(packet)) return { status: 'REJECTED', reason: 'FORBIDDEN_COMMAND' };
  if (packet.finalTick < 1 || packet.finalTick > MAX_COMPETITIVE_REPLAY_TICKS) {
    return { status: 'REJECTED', reason: 'REPLAY_TOO_LONG' };
  }

  let world;
  try {
    world = generateWorld(packet.header.blockHeight);
  } catch {
    return { status: 'REJECTED', reason: 'WORLD_MISMATCH' };
  }
  if (world.identity.rulesetVersion !== packet.header.rulesetVersion
    || world.gameplayHash !== packet.header.worldGameplayHash
    || world.generationAttempt !== packet.header.generationAttempt) {
    return { status: 'REJECTED', reason: 'WORLD_MISMATCH' };
  }

  const replay = new M06Simulation(world, {
    mode: packet.header.mode,
    pace: packet.header.pace,
    faction: packet.header.faction,
    difficulty: packet.header.difficulty,
  });
  try {
    replay.loadReplay(packet);
    for (let tick = 0; tick < packet.finalTick; tick += 1) replay.step();
  } catch {
    return { status: 'REJECTED', reason: 'REPLAY_DIVERGED' };
  }

  const snapshot = replay.snapshot();
  if (snapshot.replayVerification !== 'MATCH' || snapshot.stateHash !== packet.finalStateHash) {
    return { status: 'REJECTED', reason: 'REPLAY_DIVERGED' };
  }
  const computedScore = snapshot.run.result?.score.total ?? 0;
  if (snapshot.run.outcome !== packet.outcome || computedScore !== packet.totalScore) {
    return { status: 'REJECTED', reason: 'RESULT_MISMATCH' };
  }

  return {
    status: 'MATCH',
    finalTick: packet.finalTick,
    finalStateHash: packet.finalStateHash,
    outcome: packet.outcome,
    totalScore: computedScore,
  };
}

export function verifyChallengeScoreSubmission(submission: ChallengeScoreSubmission): ScoreProofResult {
  const packet = submission.replay;
  if (packet.outcome === 'IN_PROGRESS') return { status: 'REJECTED', reason: 'RUN_NOT_COMPLETE' };
  const replayChallenge = challengeIdentityFromReplay(packet);
  if (!sameChallenge(submission.challenge, replayChallenge)
    || submission.challengeCode !== blockChallengeCode(replayChallenge)) {
    return { status: 'REJECTED', reason: 'IDENTITY_MISMATCH' };
  }

  const replayProof = verifyReplayPacketDeterministically(packet);
  if (replayProof.status === 'REJECTED') return replayProof;
  if (replayProof.outcome === 'IN_PROGRESS') return { status: 'REJECTED', reason: 'RUN_NOT_COMPLETE' };

  return {
    status: 'VERIFIED',
    challenge: replayChallenge,
    challengeCode: submission.challengeCode,
    score: replayProof.totalScore,
    finalTick: replayProof.finalTick,
    finalStateHash: replayProof.finalStateHash,
    outcome: replayProof.outcome,
  };
}
