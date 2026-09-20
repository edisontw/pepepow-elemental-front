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
  const sites = [...world.spawns, ...world.pois, ...world.resources, world.objective, world.boss];
  const at = (x: number, z: number): number => z * world.width + x;
  const ground = (x: number, z: number): boolean => x > 0 && z > 0 && x < world.width - 1 && z < world.height - 1 && world.terrain[at(x, z)] === TerrainType.GROUND;
  const routeNear = (x: number, z: number): boolean => {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (((world.flags[at(x + dx, z + dz)] ?? 0) & WorldCellFlag.ROUTE) !== 0) return true;
    }
    return false;
  };
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

  // Forest massing intentionally follows the authoritative WOODLAND footprint.
  // The world generator already marks broad woodland regions; this layer makes
  // those regions read as continuous forest rather than sparse isolated trees.
  // Presentation density does not change walkability, cover, worldgen, or replay.
  for (let z = 2; z < world.height - 2; z += 2) for (let x = 2; x < world.width - 2; x += 2) {
    const i = at(x, z), r = hash(seed, x, z, 13);
    if (!ground(x, z) || sites.some(s => Math.hypot(x - s.cell.x, z - s.cell.z) < 3.3)) continue;

    const roadside = routeNear(x, z);
    const nearbyWoodland = woodlandNeighbors(x, z);

    if (world.biome[i] === BiomeType.WOODLAND) {
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

    // A light transition skirt on cells immediately bordering woodland creates
    // irregular, believable edges while remaining too sparse to masquerade as
    // authoritative forest cover outside the WOODLAND biome.
    if (!roadside && nearbyWoodland >= 2 && r < (lowQuality ? 0.07 : 0.24)) {
      const frame = 4 + (hash(seed, x, z, 109) > 0.5 ? 1 : 0);
      const height = frame === 4 ? 1.38 : 0.92;
      add('trees', frame, x + (hash(seed, x, z, 113) - 0.5) * 0.7, z + (hash(seed, x, z, 127) - 0.5) * 0.7, height, height);
      if (!lowQuality && hash(seed, x, z, 131) < 0.38) add('props', 10, x - 0.45, z + 0.48, 0.65, 0.65);
      continue;
    }

    // Open terrain should still have texture and silhouette. Keep these much
    // sparser than woodland so routes, build space and biome identity stay clear.
    const fillerLimit = world.biome[i] === BiomeType.HIGHLANDS
      ? (lowQuality ? 0.075 : 0.27)
      : (lowQuality ? 0.05 : 0.19);
    if (r < fillerLimit) {
      const frame = world.biome[i] === BiomeType.HIGHLANDS
        ? 8
        : roadside && hash(seed, x, z, 137) < 0.18
          ? 11
          : 10;
      const size = frame === 8 ? 1.12 : frame === 11 ? 0.92 : 0.68;
      add('props', frame, x + 0.35, z + 0.4, size, size);
      if (!lowQuality && world.biome[i] === BiomeType.HIGHLANDS && hash(seed, x, z, 149) < 0.22) {
        add('props', 8, x - 0.58, z - 0.44, 0.74, 0.74);
      }
    }
  }

  for (const poi of world.pois) {
    const x = poi.cell.x + 0.5, z = poi.cell.z + 0.5;
    if (poi.type === 'ANCIENT_RUIN') {
      for (const [frame, dx, dz, size] of [[0,-1.7,1.2,1.0],[1,-2.2,-0.4,0.85],[2,1.8,1.5,1.1],[3,2.4,-1.5,1.8],[9,-1.5,-2,1.2],[10,1.4,-2.2,0.65]]) add('props',frame!,x+dx!,z+dz!,size!,size!);
    } else if (poi.type === 'VILLAGE') {
      for (const [frame, dx, dz, size] of [[4,-2.4,1.6,1.5],[5,2.4,1.7,1.4],[6,-1.8,-1.6,1.25],[7,2,-1.8,1.3]]) add('props',frame!,x+dx!,z+dz!,size!,size!);
    }
  }
  for (const spawn of world.spawns) for (const [frame, dx, dz] of [[4,-3.8,2.4],[6,3.5,2],[7,-3.5,-2]]) add('props',frame!,spawn.cell.x+dx!,spawn.cell.z+dz!,1.45,1.45);
  for (const resource of world.resources) {
    add('props', 8, resource.cell.x - 1.2, resource.cell.z + 1.0, 0.85, 0.85);
    add('props', resource.type === 'MATERIAL' ? 6 : 10, resource.cell.x + 1.5, resource.cell.z - 0.8, 0.7, 0.7);
  }
  return result;
}
