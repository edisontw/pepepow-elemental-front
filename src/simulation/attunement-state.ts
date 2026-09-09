import { ELEMENT_IDS, type ElementId } from './element-types';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export type StartingAttunements = readonly [ElementId, ElementId];

export interface PlayerAttunementSnapshot {
  playerId: number;
  starting: StartingAttunements;
  unlocked: readonly ElementId[];
}

export interface AttunementSnapshot {
  stateHash: string;
  players: Readonly<Record<number, PlayerAttunementSnapshot>>;
}

function hashInteger(hash: number, value: number): number {
  let result = hash;
  const normalized = value | 0;
  for (let shift = 0; shift < 32; shift += 8) {
    result ^= (normalized >>> shift) & 0xff;
    result = Math.imul(result, FNV_PRIME);
  }
  return result >>> 0;
}

function hashString(hash: number, value: string): number {
  let result = hashInteger(hash, value.length);
  for (const character of value) {
    result ^= character.charCodeAt(0) & 0xff;
    result = Math.imul(result, FNV_PRIME);
  }
  return result >>> 0;
}

function validateStartingPair(pair: readonly ElementId[]): StartingAttunements {
  if (pair.length !== 2 || pair[0] === pair[1]) {
    throw new Error('Starting Attunements must contain exactly two distinct elements.');
  }
  return [pair[0]!, pair[1]!] as const;
}

function canonicalElements(values: Iterable<ElementId>): ElementId[] {
  const set = new Set(values);
  return ELEMENT_IDS.filter((element) => set.has(element));
}

export class AttunementState {
  private readonly players = new Map<number, { starting: StartingAttunements; unlocked: Set<ElementId> }>();

  constructor(initial: Readonly<Record<number, StartingAttunements>>) {
    const entries = Object.entries(initial).map(([playerId, pair]) => [Number(playerId), pair] as const)
      .sort(([left], [right]) => left - right);
    if (entries.length === 0) throw new Error('AttunementState requires at least one player.');
    for (const [playerId, pair] of entries) {
      if (!Number.isSafeInteger(playerId) || playerId < 0) throw new Error('Attunement playerId must be a non-negative integer.');
      const starting = validateStartingPair(pair);
      this.players.set(playerId, { starting, unlocked: new Set(starting) });
    }
  }

  has(playerId: number, element: ElementId): boolean {
    return this.players.get(playerId)?.unlocked.has(element) === true;
  }

  starting(playerId: number): StartingAttunements {
    const state = this.players.get(playerId);
    if (!state) throw new Error(`Missing Attunement state for player ${playerId}.`);
    return [...state.starting] as [ElementId, ElementId];
  }

  unlocked(playerId: number): readonly ElementId[] {
    const state = this.players.get(playerId);
    if (!state) return [];
    return canonicalElements(state.unlocked);
  }

  unlock(playerId: number, element: ElementId, exceptionalFourth = false): boolean {
    const state = this.players.get(playerId);
    if (!state || state.unlocked.has(element)) return false;
    if (state.unlocked.size >= 3 && !exceptionalFourth) return false;
    if (state.unlocked.size >= 4) return false;
    state.unlocked.add(element);
    return true;
  }

  isUpgradeEligible(playerId: number, tags: readonly (ElementId | 'MIXED')[]): boolean {
    const required = tags.filter((tag): tag is ElementId => tag !== 'MIXED');
    return required.length > 0 && required.every((element) => this.has(playerId, element));
  }

  snapshot(): AttunementSnapshot {
    const players: Record<number, PlayerAttunementSnapshot> = {};
    let hash = FNV_OFFSET;
    for (const playerId of [...this.players.keys()].sort((left, right) => left - right)) {
      const state = this.players.get(playerId)!;
      const starting = [...state.starting] as [ElementId, ElementId];
      const unlocked = canonicalElements(state.unlocked);
      players[playerId] = { playerId, starting, unlocked };
      hash = hashInteger(hash, playerId);
      for (const element of starting) hash = hashString(hash, element);
      for (const element of unlocked) hash = hashString(hash, element);
    }
    return { stateHash: hash.toString(16).padStart(8, '0'), players };
  }
}
