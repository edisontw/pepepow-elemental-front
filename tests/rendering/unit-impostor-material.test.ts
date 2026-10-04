import { expect, it, vi } from 'vitest';
import type * as pc from 'playcanvas';
import { createUnitContactShadow } from '../../src/rendering/unit-impostor-material';
let pixels: Uint8Array;
vi.mock('playcanvas', async (original) => {
  const actual = await original<typeof pc>();
  return { ...actual, Texture: class {
    lock() { pixels = new Uint8Array(64 * 64 * 4); return pixels; }
    unlock() {}
  } };
});
it('feathers the contact shadow to transparent edges while retaining its center', () => {
  createUnitContactShadow({} as pc.GraphicsDevice);
  const alpha = (x: number, y: number) => pixels[(y * 64 + x) * 4 + 3]!;
  expect(alpha(0, 0)).toBe(0);
  expect(alpha(0, 32)).toBeLessThan(2);
  expect(alpha(32, 32)).toBeGreaterThan(250);
  expect(alpha(48, 32)).toBeLessThan(alpha(40, 32));
  expect(alpha(48, 32)).toBeGreaterThan(alpha(56, 32));
});
