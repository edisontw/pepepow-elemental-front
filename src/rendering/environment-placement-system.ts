import { BiomeType, TerrainType, WorldCellFlag, type GeneratedWorld } from '../world/world-definition';

export interface EnvironmentPlacement {
  sheet: 'trees' | 'props';
  frame: number;
  x: number;
  z: number;
  width: number;
  height: number;
  cell: number;
  flip: boolean;
}

/** Presentation hash only: never consumes authoritative RNG. */
function hash(seed: number, x: number, z: number, salt: number): number {
  let n = Math.imul(x + salt, 0x45d9f3b) ^ Math.imul(z + seed, 0x119de1f3);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function environmentPlacements(world: GeneratedWorld, lowQuality: boolean): EnvironmentPlacement[] {
  const result: EnvironmentPlacement[] = [];
  const seed = world.identity.masterSeed;
  const at = (x: number, z: number): number => z * world.width + x;
  const ground = (x: number, z: number): boolean => x > 0 && z > 0 && x < world.width - 1 && z < world.height - 1 && world.terrain[at(x, z)] === TerrainType.GROUND;
  const routeNear = (x: number, z: number, radius = 1): boolean => {
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      if (((world.flags[at(x + dx, z + dz)] ?? 0) & WorldCellFlag.ROUTE) !== 0) return true;
    }
    return false;
  };
  const forestSiteSetback = (x: number, z: number): boolean =>
    world.spawns.some(spawn => Math.hypot(x - spawn.cell.x, z - spawn.cell.z) < 6.2)
    || world.pois.some(poi => Math.hypot(x - poi.cell.x, z - poi.cell.z) < 4.6)
    || world.resources.some(resource => Math.hypot(x - resource.cell.x, z - resource.cell.z) < 3.6)
    || Math.hypot(x - world.objective.cell.x, z - world.objective.cell.z) < 6.4
    || Math.hypot(x - world.boss.cell.x, z - world.boss.cell.z) < 6.4;
  const macroNoise = (x: number, z: number, scale: number, salt: number): number => {
    const gx = Math.floor(x / scale), gz = Math.floor(z / scale);
    const tx = x / scale - gx, tz = z / scale - gz;
    const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
    const h00 = hash(seed, gx, gz, salt), h10 = hash(seed, gx + 1, gz, salt);
    const h01 = hash(seed, gx, gz + 1, salt), h11 = hash(seed, gx + 1, gz + 1, salt);
    const nx0 = h00 + (h10 - h00) * sx, nx1 = h01 + (h11 - h01) * sx;
    return nx0 + (nx1 - nx0) * sz;
  };
  const macroForestSignal = (x: number, z: number): number =>
    macroNoise(x, z, 11, 181) * 0.72 + macroNoise(x, z, 23, 233) * 0.28;
  const woodlandNeighbors = (x: number, z: number): number => {
    let count = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      const nx = x + dx, nz = z + dz;
      if (!ground(nx, nz)) continue;
      if (world.biome[at(nx, nz)] === BiomeType.WOODLAND) count++;
    }
    return count;
  };
  const add = (sheet: 'trees' | 'props', frame: number, x: number, z: number, width: number, height: number): void => {
    const cx = Math.floor(x), cz = Math.floor(z);
    if (!ground(cx, cz) || ((world.flags[at(cx, cz)] ?? 0) & WorldCellFlag.ROUTE) !== 0) return;
    result.push({ sheet, frame, x: x - Math.floor(world.width / 2), z: z - Math.floor(world.height / 2), width, height, cell: at(cx, cz), flip: hash(seed, cx, cz, 501) > 0.5 });
  };

  // Build a presentation-only coarse forest mask. Generated WOODLAND remains
  // authoritative gameplay data; these extra cells only expand visible canopy mass.
  const macroCandidates: Array<{ cell: number; x: number; z: number; signal: number }> = [];
  let eligibleForestSamples = 0;
  let woodlandForestSamples = 0;
  for (let z = 2; z < world.height - 2; z += 2) for (let x = 2; x < world.width - 2; x += 2) {
    if (!ground(x, z) || forestSiteSetback(x, z) || routeNear(x, z, 2)) continue;
    eligibleForestSamples++;
    const cell = at(x, z);
    if (world.biome[cell] === BiomeType.WOODLAND) woodlandForestSamples++;
    else macroCandidates.push({ cell, x, z, signal: macroForestSignal(x, z) });
  }
  const targetForestSamples = Math.round(eligibleForestSamples * 0.30);
  const maxForestSamples = Math.round(eligibleForestSamples * 0.33);
  const minimumMacroSamples = Math.min(
    Math.round(macroCandidates.length * 0.05),
    Math.max(0, maxForestSamples - woodlandForestSamples),
  );
  const desiredMacroSamples = Math.min(
    macroCandidates.length,
    Math.max(minimumMacroSamples, targetForestSamples - woodlandForestSamples),
  );
  macroCandidates.sort((a, b) => b.signal - a.signal || a.cell - b.cell);
  const macroForestCells = new Set(macroCandidates.slice(0, desiredMacroSamples).map(candidate => candidate.cell));
  const macroForestNeighbors = (x: number, z: number): number => {
    let count = 0;
    for (let dz = -2; dz <= 2; dz += 2) for (let dx = -2; dx <= 2; dx += 2) {
      if (dx === 0 && dz === 0) continue;
      if (macroForestCells.has(at(x + dx, z + dz))) count++;
    }
    return count;
  };

  // Forest massing combines authoritative WOODLAND with presentation-only
  // macro clusters on suitable open ground. Nothing here changes gameplay cover,
  // walkability, navigation, world generation, fog authority, replay, or hashes.
  for (let z = 2; z < world.height - 2; z += 2) for (let x = 2; x < world.width - 2; x += 2) {
    const i = at(x, z), r = hash(seed, x, z, 13);
    if (!ground(x, z) || forestSiteSetback(x, z)) continue;

    const roadside = routeNear(x, z);
    const forestRoadSetback = routeNear(x, z, 2);
    const nearbyWoodland = woodlandNeighbors(x, z);

    if (world.biome[i] === BiomeType.WOODLAND) {
      if (forestRoadSetback) continue;
      // Keep a few broad pocket clearings so the canopy does not become a wall,
      // but make them uncommon enough that woodland reads as a terrain mass.
      const clearing = hash(seed, Math.floor(x / 7), Math.floor(z / 7), 73) > 0.955;
      if (clearing || r > (lowQuality ? 0.62 : 0.94)) continue;

      const core = !roadside && nearbyWoodland >= 6;
      const primaryFrame = core
        ? Math.floor(hash(seed, x, z, 27) * 4)
        : 4 + (hash(seed, x, z, 29) > 0.5 ? 1 : 0);
      const primaryHeight = (primaryFrame < 2 ? 3.65 : primaryFrame < 4 ? 2.85 : primaryFrame === 4 ? 1.55 : 1.05)
        * (0.86 + hash(seed, x, z, 31) * 0.28);
      const jx = (hash(seed, x, z, 37) - 0.5) * 0.9;
      const jz = (hash(seed, x, z, 41) - 0.5) * 0.9;
      add('trees', primaryFrame, x + jx, z + jz, primaryHeight, primaryHeight);

      if (!lowQuality && core) {
        // Layer a second canopy tier into forest interiors. Two offset cards per
        // sample produce much fuller overhead mass without adding draw calls,
        // because the layer is already spatially batched by atlas/material.
        if (hash(seed, x, z, 47) < 0.74) {
          const companionFrame = 2 + Math.floor(hash(seed, x, z, 53) * 2);
          const companionHeight = (2.3 + hash(seed, x, z, 59) * 0.62);
          const dx = (hash(seed, x, z, 61) - 0.5) * 1.5;
          const dz = (hash(seed, x, z, 67) - 0.5) * 1.5;
          add('trees', companionFrame, x + dx, z + dz, companionHeight, companionHeight);
        }
        if (hash(seed, x, z, 71) < 0.58) {
          const underFrame = 4 + (hash(seed, x, z, 79) > 0.52 ? 1 : 0);
          const underHeight = underFrame === 4 ? 1.42 : 0.96;
          const dx = (hash(seed, x, z, 83) - 0.5) * 1.65;
          const dz = (hash(seed, x, z, 89) - 0.5) * 1.65;
          add('trees', underFrame, x + dx, z + dz, underHeight, underHeight);
        }
      }

      // Understory/deadwood breaks up the forest floor and helps the mass feel
      // grounded instead of like upright cards on empty grass.
      if (!lowQuality && hash(seed, x, z, 97) < 0.34) {
        add('props', hash(seed, x, z, 101) < 0.55 ? 9 : 10, x - 0.62, z + 0.68, 0.9, 0.9);
      }
      continue;
    }

    // Presentation-only macro forest: smooth coarse noise is ranked per battlefield
    // so visible wooded mass lands near 30% of suitable sampled ground even when
    // generated WOODLAND is sparse. Core/edge structure keeps the regions organic.
    if (macroForestCells.has(i)) {
      const macroNeighbors = macroForestNeighbors(x, z);
      const core = macroNeighbors >= 5;
      const densityRoll = hash(seed, x, z, 157);
      const keepLimit = lowQuality ? (core ? 0.48 : 0.34) : (core ? 0.96 : 0.84);
      if (densityRoll > keepLimit) continue;

      const primaryFrame = core
        ? Math.floor(hash(seed, x, z, 163) * 4)
        : 2 + Math.floor(hash(seed, x, z, 167) * 3);
      const primaryHeight = (primaryFrame < 2 ? 3.5 : primaryFrame < 4 ? 2.72 : 1.5)
        * (0.88 + hash(seed, x, z, 173) * 0.24);
      const jx = (hash(seed, x, z, 179) - 0.5) * 1.0;
      const jz = (hash(seed, x, z, 191) - 0.5) * 1.0;
      add('trees', primaryFrame, x + jx, z + jz, primaryHeight, primaryHeight);

      if (!lowQuality) {
        if (core && hash(seed, x, z, 193) < 0.72) {
          const companionFrame = 2 + Math.floor(hash(seed, x, z, 197) * 2);
          const companionHeight = 2.28 + hash(seed, x, z, 199) * 0.58;
          add(
            'trees',
            companionFrame,
            x + (hash(seed, x, z, 211) - 0.5) * 1.55,
            z + (hash(seed, x, z, 223) - 0.5) * 1.55,
            companionHeight,
            companionHeight,
          );
        }
        if (hash(seed, x, z, 227) < (core ? 0.68 : 0.48)) {
          const underFrame = 4 + (hash(seed, x, z, 229) > 0.55 ? 1 : 0);
          const underHeight = underFrame === 4 ? 1.38 : 0.92;
          add(
            'trees',
            underFrame,
            x + (hash(seed, x, z, 239) - 0.5) * 1.65,
            z + (hash(seed, x, z, 241) - 0.5) * 1.65,
            underHeight,
            underHeight,
          );
        }
        if (hash(seed, x, z, 251) < 0.46) {
          add('props', hash(seed, x, z, 257) < 0.52 ? 9 : 10, x - 0.52, z + 0.6, 0.82, 0.82);
        }
      }
      continue;
    }

    // Saplings, scrub and deadwood soften macro-cluster edges without visually
    // sealing routes or turning all open ground into a continuous wall.
    const nearbyMacro = macroForestNeighbors(x, z);
    if (!forestRoadSetback && nearbyMacro >= 2 && hash(seed, x, z, 263) < (lowQuality ? 0.055 : 0.22)) {
      const frame = 4 + (hash(seed, x, z, 269) > 0.66 ? 1 : 0);
      const height = frame === 4 ? 1.34 : 0.9;
      add('trees', frame, x + (hash(seed, x, z, 271) - 0.5) * 0.8, z + (hash(seed, x, z, 277) - 0.5) * 0.8, height, height);
      if (!lowQuality && hash(seed, x, z, 281) < 0.42) add('props', hash(seed, x, z, 283) < 0.5 ? 9 : 10, x - 0.42, z + 0.44, 0.68, 0.68);
      continue;
    }

    // Generated woodland still gets a small irregular fringe. The wider two-cell
    // route setback keeps the visual canopy out of important movement corridors.
    if (!forestRoadSetback && nearbyWoodland >= 2 && r < (lowQuality ? 0.07 : 0.24)) {
      const frame = 4 + (hash(seed, x, z, 109) > 0.5 ? 1 : 0);
      const height = frame === 4 ? 1.38 : 0.92;
      add('trees', frame, x + (hash(seed, x, z, 113) - 0.5) * 0.7, z + (hash(seed, x, z, 127) - 0.5) * 0.7, height, height);
      if (!lowQuality && hash(seed, x, z, 131) < 0.38) add('props', 10, x - 0.45, z + 0.48, 0.65, 0.65);
      continue;
    }

    // Remaining open terrain gets more varied low-profile dressing so large blank
    // grass fields are reduced without competing with units, objectives or routes.
    const fillerRoll = hash(seed, x, z, 293);
    const fillerLimit = world.biome[i] === BiomeType.HIGHLANDS
      ? (lowQuality ? 0.09 : 0.36)
      : (lowQuality ? 0.065 : 0.28);
    if (fillerRoll < fillerLimit) {
      const choice = hash(seed, x, z, 307);
      if (!roadside && world.biome[i] !== BiomeType.HIGHLANDS && choice < 0.18) {
        const frame = 4 + (hash(seed, x, z, 311) > 0.78 ? 1 : 0);
        const height = frame === 4 ? 1.18 : 0.82;
        add('trees', frame, x + 0.3, z + 0.36, height, height);
      } else {
        const frame = world.biome[i] === BiomeType.HIGHLANDS
          ? (choice < 0.72 ? 8 : 10)
          : roadside && choice < 0.16
            ? 11
            : choice < 0.42
              ? 9
              : 10;
        const size = frame === 8 ? 1.12 : frame === 11 ? 0.92 : frame === 9 ? 0.78 : 0.68;
        add('props', frame, x + 0.35, z + 0.4, size, size);
      }
      if (!lowQuality && hash(seed, x, z, 313) < 0.18) {
        const frame = world.biome[i] === BiomeType.HIGHLANDS ? 8 : hash(seed, x, z, 317) < 0.5 ? 9 : 10;
        add('props', frame, x - 0.58, z - 0.44, frame === 8 ? 0.76 : 0.64, frame === 8 ? 0.76 : 0.64);
      }
    }
  }

  for (const poi of world.pois) {
    const x = poi.cell.x + 0.5, z = poi.cell.z + 0.5;
    if (poi.type === 'ANCIENT_RUIN') {
      for (const [frame, dx, dz, size] of [[0,-1.7,1.2,1.0],[1,-2.2,-0.4,0.85],[2,1.8,1.5,1.1],[3,2.4,-1.5,1.8],[9,-1.5,-2,1.2],[10,1.4,-2.2,0.65]]) add('props',frame!,x+dx!,z+dz!,size!,size!);
    } else if (poi.type === 'VILLAGE') {
      // Avoid the detached crate/barrel tile at RTS camera distance.
      for (const [frame, dx, dz, size] of [[4,-2.4,1.6,1.5],[5,2.4,1.7,1.4],[10,-1.8,-1.6,1.05],[7,2,-1.8,1.3]]) add('props',frame!,x+dx!,z+dz!,size!,size!);
    }
  }
  for (const spawn of world.spawns) for (const [frame, dx, dz] of [[4,-3.8,2.4],[8,3.5,2],[7,-3.5,-2]]) add('props',frame!,spawn.cell.x+dx!,spawn.cell.z+dz!,1.45,1.45);
  for (const resource of world.resources) {
    add('props', 8, resource.cell.x - 1.2, resource.cell.z + 1.0, 0.85, 0.85);
    add('props', resource.type === 'MATERIAL' ? 8 : 10, resource.cell.x + 1.5, resource.cell.z - 0.8, 0.7, 0.7);
  }
  return result;
}
