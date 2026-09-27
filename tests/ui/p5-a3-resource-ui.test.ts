import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const strategicPanel = readFileSync(new URL('../../src/ui/strategic-panel.ts', import.meta.url), 'utf8');
const layoutCss = readFileSync(new URL('../../src/layout.css', import.meta.url), 'utf8');

describe('P5-A3 Command Mode resource UI', () => {
  it('removes manual resource-harvester cards from the current automatic-site construction list', () => {
    expect(strategicPanel).toContain("automaticResourceSitesEnabled(PLAYER_ID)");
    expect(strategicPanel).toContain("buildingType !== 'EXTRACTOR' && buildingType !== 'MANA_WELL'");
    expect(strategicPanel).toContain('Auto resource sites');
  });

  it('keeps the purple Progression panel inside the compact right HUD rail', () => {
    expect(layoutCss).toContain('#app #roguelite-panel {\n    right: .55rem;\n    width: 10.75rem;');
    expect(layoutCss).toContain('max-height: min(18vh, 10.5rem);');
    expect(layoutCss).not.toContain('width: min(14rem, calc(100vw - 14rem));');
  });
});
