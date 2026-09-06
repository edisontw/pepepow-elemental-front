import {
  ManualBlockSource,
  assertValidBlockHeight,
  type BlockResolution,
  type BlockSource,
} from './block-source';

export const PEPEPOW_EXPLORER_BLOCKCOUNT_ENDPOINTS = [
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

function parseBlockCount(payload: string): number {
  const trimmed = payload.trim();
  const direct = Number(trimmed);
  if (Number.isSafeInteger(direct) && direct >= 0) return direct;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'number' && Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const candidate = record.blockcount ?? record.blockHeight ?? record.height;
      if (typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0) return candidate;
      if (typeof candidate === 'string') {
        const numeric = Number(candidate);
        if (Number.isSafeInteger(numeric) && numeric >= 0) return numeric;
      }
    }
  } catch {
    // Fall through to the explicit invalid-response error below.
  }

  throw new Error('PEPEPOW block-count response did not contain a valid height.');
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
    this.endpoints = options.endpoints ?? PEPEPOW_EXPLORER_BLOCKCOUNT_ENDPOINTS;
    if (this.endpoints.length === 0) throw new Error('At least one PEPEPOW block-count endpoint is required.');
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
      fallbackReason: errors.join(' | ') || 'PEPEPOW RPC unavailable.',
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
        headers: { Accept: 'text/plain, application/json;q=0.9, */*;q=0.8' },
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
