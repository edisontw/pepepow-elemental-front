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
  const sites = [...world.spawns, ...world.pois, ...world.resources];
  const at = (x: number, z: number): number => z * world.width + x;
  const ground = (x: number, z: number): boolean => x > 0 && z > 0 && x < world.width - 1 && z < world.height - 1 && world.terrain[at(x, z)] === TerrainType.GROUND;
  const routeNear = (x: number, z: number): boolean => {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (((world.flags[at(x + dx, z + dz)] ?? 0) & WorldCellFlag.ROUTE) !== 0) return true;
    }
    return false;
  };
  const add = (sheet: 'trees' | 'props', frame: number, x: number, z: number, width: number, height: number): void => {
    const cx = Math.floor(x), cz = Math.floor(z);
    if (!ground(cx, cz) || ((world.flags[at(cx, cz)] ?? 0) & WorldCellFlag.ROUTE) !== 0) return;
    result.push({ sheet, frame, x: x - Math.floor(world.width / 2), z: z - Math.floor(world.height / 2), width, height, cell: at(cx, cz), flip: hash(seed, cx, cz, 501) > 0.5 });
  };
  // Spatially distributed thinning, never a scan-order budget that empties half the map.
  for (let z = 2; z < world.height - 2; z += 2) for (let x = 2; x < world.width - 2; x += 2) {
    const i = at(x, z), r = hash(seed, x, z, 13);
    if (!ground(x, z) || sites.some(s => Math.hypot(x - s.cell.x, z - s.cell.z) < 3.3)) continue;
    const roadside = routeNear(x, z);
    if (world.biome[i] === BiomeType.WOODLAND) {
      const clearing = hash(seed, Math.floor(x / 6), Math.floor(z / 6), 73) > 0.89;
      if (clearing || r > (lowQuality ? 0.45 : 0.78)) continue;
      let neighbors = 0;
      for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) if (world.biome[at(x + dx!, z + dz!)] === BiomeType.WOODLAND) neighbors++;
      const edge = roadside || neighbors < 4;
      const frame = edge ? 4 + (r > 0.5 ? 1 : 0) : Math.floor(hash(seed, x, z, 27) * 4);
      const h = (frame < 2 ? 3.5 : frame < 4 ? 2.6 : frame === 4 ? 1.45 : 0.95) * (0.84 + hash(seed, x, z, 31) * 0.32);
      const jx = hash(seed, x, z, 37) * 0.7, jz = hash(seed, x, z, 41) * 0.7;
      add('trees', frame, x + jx, z + jz, h, h);
      if (!lowQuality && !edge && r < 0.4) add('trees', 4, x + 0.9, z - 0.55, 1.45, 1.45);
      if (!lowQuality && r < 0.2) add('props', 9, x - 0.6, z + 0.7, 1.05, 1.05);
    } else if (r < (lowQuality ? 0.025 : 0.11)) {
      const frame = world.biome[i] === BiomeType.HIGHLANDS ? 8 : roadside && r < 0.018 ? 11 : 10;
      const size = frame === 8 ? 1.1 : frame === 11 ? 0.95 : 0.65;
      add('props', frame, x + 0.35, z + 0.4, size, size);
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
