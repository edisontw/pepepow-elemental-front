import { describe, expect, it } from 'vitest';
import {
  PepepowRpcBlockSource,
  pepepowLiveOffsetFromSearch,
} from '../../src/challenge/pepepow-rpc-block-source';

describe('M07 PEPEPOW RPC block source', () => {
  it('resolves the current PEPEPOW height from the public explorer response', async () => {
    const fetcher: typeof fetch = async () => new Response('4950628', { status: 200 });
    const source = new PepepowRpcBlockSource({
      fallbackBlockHeight: 1_000_000,
      endpoints: ['https://example.test/api/getblockcount'],
      fetcher,
    });

    await expect(source.resolve()).resolves.toMatchObject({
      blockHeight: 4_950_628,
      source: 'PEPEPOW_RPC',
      label: 'PEPEPOW Current Block',
      networkTipHeight: 4_950_628,
    });
  });

  it('selects a deterministic recent block by subtracting an explicit offset', async () => {
    const fetcher: typeof fetch = async () => new Response('4950628', { status: 200 });
    const source = new PepepowRpcBlockSource({
      offset: 100,
      fallbackBlockHeight: 1_000_000,
      endpoints: ['https://example.test/api/getblockcount'],
      fetcher,
    });

    await expect(source.resolve()).resolves.toMatchObject({
      blockHeight: 4_950_528,
      source: 'PEPEPOW_RPC',
      label: 'PEPEPOW Recent -100',
      networkTipHeight: 4_950_628,
    });
  });

  it('tries the next endpoint and falls back to manual play if all RPC endpoints fail', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      return new Response('unavailable', { status: 503 });
    };
    const source = new PepepowRpcBlockSource({
      fallbackBlockHeight: 1_234_567,
      endpoints: ['https://first.test/api/getblockcount', 'https://second.test/api/getblockcount'],
      fetcher,
    });

    const resolution = await source.resolve();
    expect(calls).toBe(2);
    expect(resolution.blockHeight).toBe(1_234_567);
    expect(resolution.source).toBe('MANUAL');
    expect(resolution.label).toBe('Manual Fallback');
    expect(resolution.fallbackReason).toContain('HTTP 503');
  });

  it('accepts JSON-shaped height responses for explorer compatibility', async () => {
    const fetcher: typeof fetch = async () => new Response('{"height":"4950628"}', { status: 200 });
    const source = new PepepowRpcBlockSource({
      fallbackBlockHeight: 1,
      endpoints: ['https://example.test/api/getblockcount'],
      fetcher,
    });

    await expect(source.resolve()).resolves.toMatchObject({ blockHeight: 4_950_628, source: 'PEPEPOW_RPC' });
  });

  it('parses live PEPEPOW query offsets without affecting ordinary manual URLs', () => {
    expect(pepepowLiveOffsetFromSearch('?live=pepepow')).toBe(0);
    expect(pepepowLiveOffsetFromSearch('?live=pepepow&offset=10')).toBe(10);
    expect(pepepowLiveOffsetFromSearch('?live=pepepow&offset=invalid')).toBe(0);
    expect(pepepowLiveOffsetFromSearch('?block=4950000')).toBeNull();
  });
});
