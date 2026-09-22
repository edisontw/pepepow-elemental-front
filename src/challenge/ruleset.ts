import { M02_STANDARD_RULES, type WorldGenerationRules } from '../world/world-definition';

/**
 * Version of the complete deterministic gameplay semantics used by Block Challenge,
 * replay verification, and score proofs.
 *
 * World generation has its own version (`M02_STANDARD_RULES.rulesetVersion`). Keeping
 * the two explicit prevents gameplay redesigns from silently changing established M02
 * battlefield generation or Golden Block world hashes.
 */
export const CURRENT_CHALLENGE_RULESET_VERSION = 'ef-standard-v16' as const;

export interface ChallengeRulesetDefinition {
  version: string;
  worldGenerationRules: WorldGenerationRules;
}

export const CURRENT_CHALLENGE_RULESET: ChallengeRulesetDefinition = {
  version: CURRENT_CHALLENGE_RULESET_VERSION,
  worldGenerationRules: M02_STANDARD_RULES,
};

export function isSupportedChallengeRuleset(version: string): boolean {
  // v12-v15 challenge links remain playable for historical non-current runs.
  // v16 adds deterministic sub-cell melee pursuit completion.
  return version === CURRENT_CHALLENGE_RULESET_VERSION
    || version === 'ef-standard-v15'
    || version === 'ef-standard-v14'
    || version === 'ef-standard-v13'
    || version === 'ef-standard-v12';
}
