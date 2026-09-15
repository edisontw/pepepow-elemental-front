import { VisibilityLevel } from '../simulation/visibility-state';

export const FOG_ALPHA = {
  visible: 0,
  explored: 104,
  unexplored: 230,
} as const;

export function fogAlphaForLevel(level: number): number {
  if (level === VisibilityLevel.VISIBLE) return FOG_ALPHA.visible;
  if (level === VisibilityLevel.EXPLORED) return FOG_ALPHA.explored;
  return FOG_ALPHA.unexplored;
}

export function fogCornerAlpha(
  cells: Uint8Array,
  width: number,
  height: number,
  cornerX: number,
  cornerZ: number,
): number {
  let alpha = 0;
  let samples = 0;
  for (let dz = -1; dz <= 0; dz += 1) {
    for (let dx = -1; dx <= 0; dx += 1) {
      const x = cornerX + dx;
      const z = cornerZ + dz;
      if (x < 0 || z < 0 || x >= width || z >= height) continue;
      alpha += fogAlphaForLevel(cells[z * width + x] ?? VisibilityLevel.UNEXPLORED);
      samples += 1;
    }
  }
  return samples === 0 ? FOG_ALPHA.unexplored : Math.round(alpha / samples);
}

export function visibilityFingerprint(cells: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const value of cells) {
    hash ^= value;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
