import { describe, expect, it } from 'vitest';
import { clientToPlayCanvasScreen } from '../../src/input/screen-coordinate-contract';

describe('PlayCanvas screen coordinate contract', () => {
  it('uses CSS client pixels relative to the canvas rect', () => {
    expect(clientToPlayCanvasScreen(460, 290, {
      left: 100,
      top: 50,
      width: 800,
      height: 600,
    })).toEqual({ x: 360, y: 240 });
  });

  it('does not scale coordinates by a high-DPI backing-store ratio', () => {
    const bounds = { left: 0, top: 0, width: 1000, height: 700 };
    // A 1500x1050 backbuffer at maxPixelRatio=1.5 still has a 1000x700
    // PlayCanvas client rect, so the center remains (500, 350), not (750, 525).
    expect(clientToPlayCanvasScreen(500, 350, bounds)).toEqual({ x: 500, y: 350 });
  });
});
