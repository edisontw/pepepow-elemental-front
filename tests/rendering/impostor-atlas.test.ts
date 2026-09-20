import { readFileSync, existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import { impostorAtlasFile, impostorAtlasRect, ATLAS_WIDTH, ATLAS_HEIGHT } from '../../src/rendering/impostor-atlas';
import { animatedImpostorFrameFiles, IMPOSTOR_ANIMATION_ACTIONS, IMPOSTOR_ANIMATION_DIRECTION_STEMS } from '../../src/rendering/impostor-animation';

it('maps every atlas tile to the same canonical direction/frame as the committed pack', () => {
  const manifest = JSON.parse(readFileSync('public/assets/impostor-atlases/manifest.json', 'utf8'));
  expect(manifest.entries).toHaveLength(55);
  for (const { slug, action } of manifest.entries) {
    const name = action.toUpperCase() as typeof IMPOSTOR_ANIMATION_ACTIONS[number];
    expect(existsSync(`public/${impostorAtlasFile(slug, name).split('?')[0]}`)).toBe(true);
    const files = animatedImpostorFrameFiles(slug, name);
    const tiles = new Set<string>();
    for (let i = 0; i < 32; i++) {
      const rect = impostorAtlasRect(slug, i);
      const column = Math.round((rect.x * ATLAS_WIDTH - 2) / 196);
      const row = Math.round((rect.y * ATLAS_HEIGHT - 2) / 260);
      const source = row * 8 + column;
      expect(files[i]).toContain(`${IMPOSTOR_ANIMATION_DIRECTION_STEMS[Math.floor(source / 4)]}_${(source % 4).toString().padStart(2, '0')}.webp`);
      expect(rect.x + rect.width).toBeLessThan(1);
      expect(rect.y + rect.height).toBeLessThan(1);
      expect(rect.x).toBeGreaterThan(0);
      expect(rect.y).toBeGreaterThan(0);
      tiles.add(`${row},${column}`);
    }
    expect(tiles.size).toBe(32);
  }
});
