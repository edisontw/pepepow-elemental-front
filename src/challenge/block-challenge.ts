import type { EnemyDifficulty, EnemyFaction } from '../simulation/m05-content';
import type { RunMode, RunPace } from '../simulation/m06-content';
import { hashString } from '../simulation/random';
import type { GeneratedWorld } from '../world/world-definition';

export const BLOCK_CHALLENGE_VERSION = 'block-challenge-v1' as const;
export const BLOCK_CHALLENGE_QUERY_VALUE = 'bc1';

export interface BlockChallengeRunOptions {
  mode: RunMode;
  pace: RunPace;
  faction: EnemyFaction;
  difficulty: EnemyDifficulty;
}

export interface BlockChallengeIdentity extends BlockChallengeRunOptions {
  version: typeof BLOCK_CHALLENGE_VERSION;
  blockHeight: number;
  rulesetVersion: string;
  worldGameplayHash: string;
  generationAttempt: number;
}

export interface BlockChallengeShareRequest extends BlockChallengeRunOptions {
  blockHeight: number;
  rulesetVersion: string;
  expectedWorldGameplayHash: string | null;
  expectedGenerationAttempt: number | null;
}

function identityPayload(identity: BlockChallengeIdentity): string {
  return [
    identity.version,
    identity.blockHeight,
    identity.rulesetVersion,
    identity.worldGameplayHash,
    identity.generationAttempt,
    identity.mode,
    identity.pace,
    identity.faction,
    identity.difficulty,
  ].join('|');
}

function parseInteger(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function createBlockChallengeIdentity(
  world: GeneratedWorld,
  options: BlockChallengeRunOptions,
): BlockChallengeIdentity {
  return {
    version: BLOCK_CHALLENGE_VERSION,
    blockHeight: world.identity.blockHeight,
    rulesetVersion: world.identity.rulesetVersion,
    worldGameplayHash: world.gameplayHash,
    generationAttempt: world.generationAttempt,
    mode: options.mode,
    pace: options.pace,
    faction: options.faction,
    difficulty: options.difficulty,
  };
}

export function blockChallengeCode(identity: BlockChallengeIdentity): string {
  return `BC1-${hashString(identityPayload(identity)).toString(16).padStart(8, '0').toUpperCase()}`;
}

export function createBlockChallengeShareUrl(baseUrl: string | URL, identity: BlockChallengeIdentity): URL {
  const url = new URL(baseUrl.toString());
  url.searchParams.set('challenge', BLOCK_CHALLENGE_QUERY_VALUE);
  url.searchParams.set('block', String(identity.blockHeight));
  url.searchParams.set('ruleset', identity.rulesetVersion);
  url.searchParams.set('world', identity.worldGameplayHash);
  url.searchParams.set('attempt', String(identity.generationAttempt));
  url.searchParams.set('mode', identity.mode === 'BOSS_HUNT' ? 'boss' : 'destroy');
  url.searchParams.set('pace', identity.pace.toLowerCase());
  url.searchParams.set('faction', identity.faction.toLowerCase());
  url.searchParams.set('difficulty', identity.difficulty.toLowerCase());
  url.searchParams.delete('replay');
  return url;
}

export function readBlockChallengeShareRequest(search: string): BlockChallengeShareRequest | null {
  const params = new URLSearchParams(search);
  if (params.get('challenge')?.trim().toLowerCase() !== BLOCK_CHALLENGE_QUERY_VALUE) return null;

  const blockHeight = parseInteger(params.get('block'));
  const rulesetVersion = params.get('ruleset')?.trim() ?? '';
  if (blockHeight === null || rulesetVersion.length === 0) return null;

  const modeRaw = params.get('mode')?.trim().toLowerCase();
  const paceRaw = params.get('pace')?.trim().toLowerCase();
  const factionRaw = params.get('faction')?.trim().toLowerCase();
  const difficultyRaw = params.get('difficulty')?.trim().toLowerCase();

  const mode: RunMode = modeRaw === 'boss' || modeRaw === 'boss_hunt' ? 'BOSS_HUNT' : 'DESTROY';
  const pace: RunPace = paceRaw === 'smoke' ? 'SMOKE' : 'STANDARD';
  const faction: EnemyFaction = factionRaw === 'flame' || factionRaw === 'flame_cult'
    ? 'FLAME_CULT'
    : factionRaw === 'wild' || factionRaw === 'wild_horde'
      ? 'WILD_HORDE'
      : 'IRON_LEGION';
  const difficulty: EnemyDifficulty = difficultyRaw === 'casual'
    ? 'CASUAL'
    : difficultyRaw === 'hard'
      ? 'HARD'
      : 'STANDARD';

  return {
    blockHeight,
    rulesetVersion,
    expectedWorldGameplayHash: params.get('world')?.trim() || null,
    expectedGenerationAttempt: parseInteger(params.get('attempt')),
    mode,
    pace,
    faction,
    difficulty,
  };
}

export function assertBlockChallengeWorldMatches(
  request: BlockChallengeShareRequest,
  world: GeneratedWorld,
): void {
  if (request.blockHeight !== world.identity.blockHeight) throw new Error('Challenge block height mismatch.');
  if (request.rulesetVersion !== world.identity.rulesetVersion) throw new Error('Challenge ruleset mismatch.');
  if (request.expectedWorldGameplayHash !== null && request.expectedWorldGameplayHash !== world.gameplayHash) {
    throw new Error('Challenge world hash mismatch.');
  }
  if (request.expectedGenerationAttempt !== null && request.expectedGenerationAttempt !== world.generationAttempt) {
    throw new Error('Challenge generation attempt mismatch.');
  }
}
