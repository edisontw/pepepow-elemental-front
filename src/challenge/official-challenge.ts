import manifestJson from '../../data/challenges/official-challenges.json';
import {
  assertValidBlockHeight,
  type BlockResolution,
  type BlockSource,
} from './block-source';

export const OFFICIAL_CHALLENGE_MANIFEST_VERSION = 'm07-official-challenges-v1' as const;

export interface OfficialChallengeEntry {
  id: string;
  label: string;
  blockHeight: number;
  rulesetVersion: string;
  dayKey: string | null;
  source: string;
  sourceBlockHash: string | null;
}

export interface OfficialChallengeManifest {
  version: typeof OFFICIAL_CHALLENGE_MANIFEST_VERSION;
  entries: readonly OfficialChallengeEntry[];
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Official challenge ${field} must be non-empty.`);
  return value.trim();
}

export function parseOfficialChallengeManifest(value: unknown): OfficialChallengeManifest {
  if (typeof value !== 'object' || value === null) throw new Error('Official challenge manifest must be an object.');
  const record = value as { version?: unknown; entries?: unknown };
  if (record.version !== OFFICIAL_CHALLENGE_MANIFEST_VERSION) throw new Error('Unsupported official challenge manifest version.');
  if (!Array.isArray(record.entries)) throw new Error('Official challenge manifest entries must be an array.');

  const ids = new Set<string>();
  const days = new Set<string>();
  const entries = record.entries.map((raw): OfficialChallengeEntry => {
    if (typeof raw !== 'object' || raw === null) throw new Error('Official challenge entry must be an object.');
    const entry = raw as Record<string, unknown>;
    const id = nonEmptyString(entry.id, 'id');
    if (ids.has(id)) throw new Error(`Duplicate official challenge id: ${id}.`);
    ids.add(id);
    const blockHeight = Number(entry.blockHeight);
    assertValidBlockHeight(blockHeight);
    const dayKey = entry.dayKey === null || entry.dayKey === undefined ? null : nonEmptyString(entry.dayKey, 'dayKey');
    if (dayKey !== null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) throw new Error(`Invalid official challenge dayKey: ${dayKey}.`);
      if (days.has(dayKey)) throw new Error(`Duplicate official challenge dayKey: ${dayKey}.`);
      days.add(dayKey);
    }
    return {
      id,
      label: nonEmptyString(entry.label, 'label'),
      blockHeight,
      rulesetVersion: nonEmptyString(entry.rulesetVersion, 'rulesetVersion'),
      dayKey,
      source: nonEmptyString(entry.source, 'source'),
      sourceBlockHash: entry.sourceBlockHash === null || entry.sourceBlockHash === undefined
        ? null
        : nonEmptyString(entry.sourceBlockHash, 'sourceBlockHash'),
    };
  });

  return { version: OFFICIAL_CHALLENGE_MANIFEST_VERSION, entries };
}

export const OFFICIAL_CHALLENGES = parseOfficialChallengeManifest(manifestJson);

export function officialChallengeById(id: string): OfficialChallengeEntry | null {
  const normalized = id.trim();
  return OFFICIAL_CHALLENGES.entries.find((entry) => entry.id === normalized) ?? null;
}

export function officialChallengeForDay(dayKey: string): OfficialChallengeEntry | null {
  return OFFICIAL_CHALLENGES.entries.find((entry) => entry.dayKey === dayKey) ?? null;
}

export function officialChallengeIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get('official')?.trim();
  return id ? id : null;
}

export class OfficialBlockSource implements BlockSource {
  readonly kind = 'OFFICIAL' as const;

  constructor(readonly challenge: OfficialChallengeEntry) {
    assertValidBlockHeight(challenge.blockHeight);
  }

  async resolve(): Promise<BlockResolution> {
    return {
      blockHeight: this.challenge.blockHeight,
      source: this.kind,
      label: this.challenge.label,
      officialChallengeId: this.challenge.id,
    };
  }
}
