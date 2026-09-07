import { describe, expect, it } from 'vitest';
import {
  PEPEPOW_BLOCK_HEIGHT_ENDPOINTS,
  PepepowRpcBlockSource,
  pepepowLiveOffsetFromSearch,
} from '../../src/challenge/pepepow-rpc-block-source';

describe('M07 PEPEPOW RPC block source', () => {
  it('prefers the PEPEPOW Light status endpoint for live height resolution', () => {
    expect(PEPEPOW_BLOCK_HEIGHT_ENDPOINTS[0]).toBe('https://light.pepepow.net/api/status');
  });

  it('resolves the current PEPEPOW height from Light status JSON', async () => {
    const fetcher: typeof fetch = async () => new Response('{"status":"ok","height":4950628}', { status: 200 });
    const source = new PepepowRpcBlockSource({
      fallbackBlockHeight: 1_000_000,
      endpoints: ['https://light.pepepow.net/api/status'],
      fetcher,
    });

    await expect(source.resolve()).resolves.toMatchObject({
      blockHeight: 4_950_628,
      source: 'PEPEPOW_RPC',
      label: 'PEPEPOW Current Block',
      networkTipHeight: 4_950_628,
      endpoint: 'https://light.pepepow.net/api/status',
    });
  });

  it('accepts alternative Light status height field names', async () => {
    const fetcher: typeof fetch = async () => new Response('{"tip_height":"4950628"}', { status: 200 });
    const source = new PepepowRpcBlockSource({
      fallbackBlockHeight: 1,
      endpoints: ['https://light.pepepow.net/api/status'],
      fetcher,
    });

    await expect(source.resolve()).resolves.toMatchObject({ blockHeight: 4_950_628, source: 'PEPEPOW_RPC' });
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

  it('tries the next endpoint and falls back to manual play if all height sources fail', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      return new Response('unavailable', { status: 503 });
    };
    const source = new PepepowRpcBlockSource({
      fallbackBlockHeight: 1_234_567,
      endpoints: ['https://first.test/status', 'https://second.test/getblockcount'],
      fetcher,
    });

    const resolution = await source.resolve();
    expect(calls).toBe(2);
    expect(resolution.blockHeight).toBe(1_234_567);
    expect(resolution.source).toBe('MANUAL');
    expect(resolution.label).toBe('Manual Fallback');
    expect(resolution.fallbackReason).toContain('HTTP 503');
  });

  it('keeps explorer-style scalar and JSON responses as compatibility fallbacks', async () => {
    const scalarFetcher: typeof fetch = async () => new Response('4950628', { status: 200 });
    const scalar = new PepepowRpcBlockSource({
      fallbackBlockHeight: 1,
      endpoints: ['https://example.test/api/getblockcount'],
      fetcher: scalarFetcher,
    });
    await expect(scalar.resolve()).resolves.toMatchObject({ blockHeight: 4_950_628, source: 'PEPEPOW_RPC' });

    const jsonFetcher: typeof fetch = async () => new Response('{"blockHeight":"4950628"}', { status: 200 });
    const json = new PepepowRpcBlockSource({
      fallbackBlockHeight: 1,
      endpoints: ['https://example.test/api/getblockcount'],
      fetcher: jsonFetcher,
    });
    await expect(json.resolve()).resolves.toMatchObject({ blockHeight: 4_950_628, source: 'PEPEPOW_RPC' });
  });

  it('parses live PEPEPOW query offsets without affecting ordinary manual URLs', () => {
    expect(pepepowLiveOffsetFromSearch('?live=pepepow')).toBe(0);
    expect(pepepowLiveOffsetFromSearch('?live=pepepow&offset=10')).toBe(10);
    expect(pepepowLiveOffsetFromSearch('?live=pepepow&offset=invalid')).toBe(0);
    expect(pepepowLiveOffsetFromSearch('?block=4950000')).toBeNull();
  });
});
