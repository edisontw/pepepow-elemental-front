import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const controlsSource = readFileSync(new URL('../../src/input/unit-controls.ts', import.meta.url), 'utf8');

describe('P5-A2 Global Tactical controls', () => {
  it('exposes the persistent Tactical spell control surface without caster-selection instructions', () => {
    expect(indexHtml).toContain('id="tactical-spells"');
    expect(indexHtml).toContain('id="tactical-cast-hint"');
    expect(indexHtml).not.toContain('Select an aligned Elementalist to cast');
  });

  it('builds Tactical candidate lists from the global living Elementalist pool instead of current selection', () => {
    expect(controlsSource).toContain('globalTacticalCasterIds(snapshot, 0)');
    expect(controlsSource).not.toContain('candidateCasterIds: this.selection.ids');
  });
});
