import { BiomeType, TerrainType, type GeneratedWorld } from '../world/world-definition';
import type { EnvironmentPlacement } from './environment-placement-system';

/** Presentation weights only. Macro groves share the same forest-floor treatment
 * as generated woodland, without changing cover, navigation or world cells. */
export function terrainSurfaceControl(world: GeneratedWorld, placements: readonly EnvironmentPlacement[]): Uint8Array {
  const pixels = new Uint8Array(world.width * world.height * 4);
  for (let z = 0; z < world.height; z++) for (let x = 0; x < world.width; x++) {
    let wood = 0, rock = 0, wet = 0, n = 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const xx = Math.max(0, Math.min(world.width - 1, x + dx));
      const zz = Math.max(0, Math.min(world.height - 1, z + dz));
      const i = zz * world.width + xx;
      wood += world.biome[i] === BiomeType.WOODLAND ? 1 : 0;
      rock += world.biome[i] === BiomeType.HIGHLANDS ? 1 : 0;
      wet += world.terrain[i] === TerrainType.WATER ? 1 : 0;
      n++;
    }
    const i = (z * world.width + x) * 4;
    pixels[i] = wood / n * 255;
    pixels[i + 1] = rock / n * 255;
    pixels[i + 2] = Math.min(255, wet / n * 380);
    pixels[i + 3] = world.moisture[z * world.width + x] ?? 128;
  }
  for (const tree of placements) {
    if (tree.sheet !== 'trees') continue;
    const cx = tree.x + Math.floor(world.width / 2);
    const cz = tree.z + Math.floor(world.height / 2);
    const radius = Math.max(1.2, tree.width * 0.65);
    for (let z = Math.max(0, Math.floor(cz - radius)); z <= Math.min(world.height - 1, Math.ceil(cz + radius)); z++) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(world.width - 1, Math.ceil(cx + radius)); x++) {
        if (world.terrain[z * world.width + x] !== TerrainType.GROUND) continue;
        const t = Math.max(0, 1 - Math.hypot(x + 0.5 - cx, z + 0.5 - cz) / radius);
        const i = (z * world.width + x) * 4;
        pixels[i] = Math.max(pixels[i]!, Math.round(t * t * (3 - 2 * t) * 230));
      }
    }
  }
  return pixels;
}
