import {
  ManualBlockSource,
  assertValidBlockHeight,
  type BlockResolution,
  type BlockSource,
} from './block-source';

export const PEPEPOW_BLOCK_HEIGHT_ENDPOINTS = [
  'https://light.pepepow.net/api/status',
  'https://explorer.pepepow.org/api/getblockcount',
  'https://explorer.pepepow.net/api/getblockcount',
] as const;

export interface PepepowRpcBlockSourceOptions {
  offset?: number;
  fallbackBlockHeight: number;
  endpoints?: readonly string[];
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

function parseHeightCandidate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    if (Number.isSafeInteger(numeric) && numeric >= 0) return numeric;
  }
  return null;
}

function parseBlockCount(payload: string): number {
  const trimmed = payload.trim();
  const direct = parseHeightCandidate(trimmed);
  if (direct !== null) return direct;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    const scalar = parseHeightCandidate(parsed);
    if (scalar !== null) return scalar;
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const preferredKeys = [
        'height',
        'block_height',
        'blockHeight',
        'tip_height',
        'blockcount',
        'daemon_height',
        'electrum_height',
      ] as const;
      for (const key of preferredKeys) {
        const candidate = parseHeightCandidate(record[key]);
        if (candidate !== null) return candidate;
      }
    }
  } catch {
    // Fall through to the explicit invalid-response error below.
  }

  throw new Error('PEPEPOW block-height response did not contain a valid height.');
}

export class PepepowRpcBlockSource implements BlockSource {
  readonly kind = 'PEPEPOW_RPC' as const;
  private readonly offset: number;
  private readonly endpoints: readonly string[];
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: PepepowRpcBlockSourceOptions) {
    this.offset = options.offset ?? 0;
    if (!Number.isSafeInteger(this.offset) || this.offset < 0) {
      throw new Error('PEPEPOW recent-block offset must be a non-negative safe integer.');
    }
    assertValidBlockHeight(options.fallbackBlockHeight);
    this.endpoints = options.endpoints ?? PEPEPOW_BLOCK_HEIGHT_ENDPOINTS;
    if (this.endpoints.length === 0) throw new Error('At least one PEPEPOW block-height endpoint is required.');
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 3_500;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new Error('PEPEPOW RPC timeout must be positive.');
  }

  async resolve(): Promise<BlockResolution> {
    const errors: string[] = [];
    for (const endpoint of this.endpoints) {
      try {
        const tipHeight = await this.fetchTipHeight(endpoint);
        const blockHeight = Math.max(0, tipHeight - this.offset);
        return {
          blockHeight,
          source: this.kind,
          label: this.offset === 0 ? 'PEPEPOW Current Block' : `PEPEPOW Recent -${this.offset}`,
          networkTipHeight: tipHeight,
          endpoint,
        };
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const fallback = await new ManualBlockSource(this.options.fallbackBlockHeight).resolve();
    return {
      ...fallback,
      label: 'Manual Fallback',
      fallbackReason: errors.join(' | ') || 'PEPEPOW block-height source unavailable.',
    };
  }

  private async fetchTipHeight(endpoint: string): Promise<number> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(endpoint, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.8' },
      });
      if (!response.ok) throw new Error(`PEPEPOW endpoint returned HTTP ${response.status}.`);
      return parseBlockCount(await response.text());
    } finally {
      clearTimeout(timer);
    }
  }
}

export function pepepowLiveOffsetFromSearch(search: string): number | null {
  const params = new URLSearchParams(search);
  if (params.get('live')?.trim().toLowerCase() !== 'pepepow') return null;
  const raw = params.get('offset');
  if (raw === null || raw.trim() === '') return 0;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}
