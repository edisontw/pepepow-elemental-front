import { M02_STANDARD_RULES, type WorldGenerationRules } from '../world/world-definition';

/**
 * Version of the complete deterministic gameplay semantics used by Block Challenge,
 * replay verification, and score proofs.
 *
 * World generation has its own version (`M02_STANDARD_RULES.rulesetVersion`). Keeping
 * the two explicit prevents presentation/gameplay milestones from silently reusing an
 * older competitive identity while still preserving the established M02 battlefield.
 */
export const CURRENT_CHALLENGE_RULESET_VERSION = 'm08-standard-v1' as const;

export interface ChallengeRulesetDefinition {
  version: string;
  worldGenerationRules: WorldGenerationRules;
}

export const CURRENT_CHALLENGE_RULESET: ChallengeRulesetDefinition = {
  version: CURRENT_CHALLENGE_RULESET_VERSION,
  worldGenerationRules: M02_STANDARD_RULES,
};

export function isSupportedChallengeRuleset(version: string): boolean {
  return version === CURRENT_CHALLENGE_RULESET_VERSION;
}
