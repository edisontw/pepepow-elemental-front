import { DeterministicRng, hashString } from '../simulation/random';
import type { WorldIdentity } from './world-definition';

export const WORLD_NAMESPACE = 'pepepow-elemental-front';

export type WorldRngStream =
  | 'elevation'
  | 'hydrology'
  | 'biome'
  | 'region'
  | 'route'
  | 'resource'
  | 'poi'
  | 'spawn'
  | 'enemy'
  | 'boss'
  | 'visual';

export function createWorldIdentity(blockHeight: number, rulesetVersion: string): WorldIdentity {
  if (!Number.isSafeInteger(blockHeight) || blockHeight < 0) {
    throw new Error(`Block height must be a non-negative safe integer. Received ${blockHeight}.`);
  }
  if (rulesetVersion.length === 0) throw new Error('Ruleset version must not be empty.');
  const masterSeed = hashString(`${WORLD_NAMESPACE}|${rulesetVersion}|${blockHeight}`);
  return { namespace: WORLD_NAMESPACE, rulesetVersion, blockHeight, masterSeed };
}

export function createWorldRng(identity: WorldIdentity, stream: WorldRngStream, attempt: number, salt = ''): DeterministicRng {
  if (!Number.isInteger(attempt) || attempt < 0) throw new Error('Generation attempt must be a non-negative integer.');
  return new DeterministicRng(`${identity.masterSeed}|${identity.rulesetVersion}|attempt:${attempt}|stream:${stream}|${salt}`);
}

export function nextInt(rng: DeterministicRng, exclusiveMax: number): number {
  if (!Number.isInteger(exclusiveMax) || exclusiveMax <= 0) throw new Error('exclusiveMax must be a positive integer.');
  return rng.nextUint32() % exclusiveMax;
}

export function nextRange(rng: DeterministicRng, minInclusive: number, maxInclusive: number): number {
  if (maxInclusive < minInclusive) throw new Error('Invalid integer range.');
  return minInclusive + nextInt(rng, maxInclusive - minInclusive + 1);
}
