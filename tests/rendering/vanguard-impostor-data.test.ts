import { describe, expect, it } from 'vitest';
import { VANGUARD_IMPOSTOR_DATA_URI } from '../../src/rendering/vanguard-impostor-data';

describe('Vanguard impostor image payload', () => {
  it('contains a non-truncated WebP RIFF data URI', () => {
    expect(VANGUARD_IMPOSTOR_DATA_URI.startsWith('data:image/webp;base64,UklGR')).toBe(true);
    expect(VANGUARD_IMPOSTOR_DATA_URI.length).toBeGreaterThan(10_000);
  });
});
