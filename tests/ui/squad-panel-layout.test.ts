import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layoutCss = readFileSync(new URL('../../src/layout.css', import.meta.url), 'utf8');

describe('Command Mode HUD layout', () => {
  it('aligns the desktop squad panel with the compact right-side HUD rail', () => {
    expect(layoutCss).toContain('#app #squad-panel {\n  top: 26rem;');
    expect(layoutCss).toContain('width: 10.75rem;');
    expect(layoutCss).toContain('max-height: calc(100vh - 26.55rem);');
    expect(layoutCss).not.toContain('top: 34.15rem;');
    expect(layoutCss).not.toContain('right: 14.4rem;');
  });

  it('moves Command Mode to the free upper-left area on narrow layouts', () => {
    expect(layoutCss).toContain('@media (max-width: 800px)');
    expect(layoutCss).toContain('top: .5rem;\n    left: .5rem;\n    right: auto;');
  });
});
