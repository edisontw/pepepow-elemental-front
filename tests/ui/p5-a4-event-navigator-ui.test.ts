import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
const cameraSource = readFileSync(new URL('../../src/rendering/rts-camera.ts', import.meta.url), 'utf8');
const layoutCss = readFileSync(new URL('../../src/layout.css', import.meta.url), 'utf8');

describe('P5-A4 Event Navigator UI contract', () => {
  it('mounts a compact recent-event surface that only focuses the camera on click', () => {
    expect(indexHtml).toContain('id="event-navigator"');
    expect(mainSource).toContain('new EventNavigator(');
    expect(mainSource).toContain('(x, z) => scene.focusWorld(x, z, true)');
    expect(layoutCss).toContain('#app #event-navigator[hidden] { display: none; }');
  });

  it('uses a smooth player-invoked camera focus path without replacing normal immediate focus', () => {
    expect(cameraSource).toContain('focusSmoothlyAt(worldXMetres: number, worldZMetres: number)');
    expect(cameraSource).toContain('private advanceSmoothFocus(deltaSeconds: number)');
    expect(cameraSource).toContain('this.smoothFocusActive = false;');
    expect(cameraSource).toContain('focusAt(worldXMetres: number, worldZMetres: number)');
  });
});
