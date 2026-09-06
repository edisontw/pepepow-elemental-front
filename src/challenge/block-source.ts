export const DEFAULT_MANUAL_BLOCK_HEIGHT = 1_000_000;

export type BlockSourceKind = 'MANUAL' | 'PEPEPOW_RPC' | 'OFFICIAL';

export interface BlockResolution {
  blockHeight: number;
  source: BlockSourceKind;
  label: string;
  networkTipHeight?: number;
  endpoint?: string;
  fallbackReason?: string;
  officialChallengeId?: string;
}

export interface BlockSource {
  readonly kind: BlockSourceKind;
  resolve(): Promise<BlockResolution>;
}

export function assertValidBlockHeight(blockHeight: number): void {
  if (!Number.isSafeInteger(blockHeight) || blockHeight < 0) {
    throw new Error(`Block height must be a non-negative safe integer. Received ${blockHeight}.`);
  }
}

export class ManualBlockSource implements BlockSource {
  readonly kind = 'MANUAL' as const;

  constructor(private readonly blockHeight: number = DEFAULT_MANUAL_BLOCK_HEIGHT) {
    assertValidBlockHeight(blockHeight);
  }

  async resolve(): Promise<BlockResolution> {
    return {
      blockHeight: this.blockHeight,
      source: this.kind,
      label: 'Manual Block',
    };
  }
}

export function manualBlockHeightFromSearch(
  search: string,
  fallback = DEFAULT_MANUAL_BLOCK_HEIGHT,
): number {
  assertValidBlockHeight(fallback);
  const raw = new URLSearchParams(search).get('block');
  if (raw === null || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
