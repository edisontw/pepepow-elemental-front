import {
  BiomeType,
  TerrainType,
  WorldCellFlag,
  type GeneratedWorld,
  type GridPoint,
} from '../world/world-definition';

export type EnvironmentPropKind =
  | 'WOODLAND_GROVE'
  | 'WOODLAND_EDGE'
  | 'HIGHLAND_RIDGE'
  | 'HIGHLAND_ROCK'
  | 'RIVER_REED'
  | 'RIVER_BANK_STONE'
  | 'PLAINS_SCRUB'
  | 'PLAINS_STONE'
  | 'BIOME_EDGE_SCRUB'
  | 'BIOME_EDGE_STONE'
  | 'ROUTE_EDGE_POST'
  | 'SETTLEMENT_SUPPLIES'
  | 'RESOURCE_FRINGE'
  | 'POI_FRINGE';

export interface EnvironmentVisualProp {
  kind: EnvironmentPropKind;
  cellX: number;
  cellZ: number;
  offsetX: number;
  offsetZ: number;
  scale: number;
  rotationDegrees: number;
  variant: number;
}

export const MAX_ENVIRONMENT_PROPS = 300;

const ORTHOGONAL_NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const EIGHT_NEIGHBORS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
] as const;
const NEAR_SITE_OFFSETS = [
  [2, 0], [-2, 0], [0, 2], [0, -2],
  [2, 1], [2, -1], [-2, 1], [-2, -1],
  [1, 2], [-1, 2], [1, -2], [-1, -2],
  [3, 0], [-3, 0], [0, 3], [0, -3],
] as const;
const SETTLEMENT_OFFSETS = [
  [3, 1], [3, -1], [-3, 1], [-3, -1],
  [1, 3], [-1, 3], [1, -3], [-1, -3],
  [4, 0], [-4, 0], [0, 4], [0, -4],
] as const;

function cellIndex(world: GeneratedWorld, x: number, z: number): number {
  return z * world.width + x;
}

function inBounds(world: GeneratedWorld, x: number, z: number): boolean {
  return x >= 0 && z >= 0 && x < world.width && z < world.height;
}

function visualByte(world: GeneratedWorld, x: number, z: number, salt: number): number {
  const sourceIndex = Math.abs(x * 11 + z * 17 + salt * 23) % Math.max(1, world.visualVariant.length);
  const source = world.visualVariant[sourceIndex] ?? 0;
  let hash = (source ^ Math.imul(x + 1, 0x45d9f3b) ^ Math.imul(z + 1, 0x119de1f3) ^ Math.imul(salt + 1, 0x27d4eb2d)) >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x45d9f3b) >>> 0;
  hash ^= hash >>> 16;
  return hash & 0xff;
}

function reserveAround(reserved: Set<number>, world: GeneratedWorld, point: GridPoint, radius: number): void {
  for (let dz = -radius; dz <= radius; dz += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = point.x + dx;
      const z = point.z + dz;
      if (!inBounds(world, x, z)) continue;
      reserved.add(cellIndex(world, x, z));
    }
  }
}

function strategicReservedCells(world: GeneratedWorld): Set<number> {
  const reserved = new Set<number>();
  for (const resource of world.resources) reserveAround(reserved, world, resource.cell, 2);
  for (const poi of world.pois) reserveAround(reserved, world, poi.cell, 2);
  for (const spawn of world.spawns) reserveAround(reserved, world, spawn.cell, 4);
  reserveAround(reserved, world, world.objective.cell, 4);
  reserveAround(reserved, world, world.boss.cell, 4);
  return reserved;
}

function touchesTerrain(world: GeneratedWorld, x: number, z: number, terrain: TerrainType): boolean {
  for (const [dx, dz] of ORTHOGONAL_NEIGHBORS) {
    const nx = x + dx;
    const nz = z + dz;
    if (!inBounds(world, nx, nz)) continue;
    if (world.terrain[cellIndex(world, nx, nz)] === terrain) return true;
  }
  return false;
}

function touchesFlag(world: GeneratedWorld, x: number, z: number, flag: WorldCellFlag): boolean {
  for (const [dx, dz] of ORTHOGONAL_NEIGHBORS) {
    const nx = x + dx;
    const nz = z + dz;
    if (!inBounds(world, nx, nz)) continue;
    if (((world.flags[cellIndex(world, nx, nz)] ?? 0) & flag) !== 0) return true;
  }
  return false;
}

function sameBiomeNeighborCount(world: GeneratedWorld, x: number, z: number, biome: BiomeType): number {
  let count = 0;
  for (const [dx, dz] of EIGHT_NEIGHBORS) {
    const nx = x + dx;
    const nz = z + dz;
    if (!inBounds(world, nx, nz)) continue;
    const index = cellIndex(world, nx, nz);
    if (world.terrain[index] === TerrainType.GROUND && world.biome[index] === biome) count += 1;
  }
  return count;
}

function touchesDifferentBiome(world: GeneratedWorld, x: number, z: number, biome: BiomeType): boolean {
  for (const [dx, dz] of ORTHOGONAL_NEIGHBORS) {
    const nx = x + dx;
    const nz = z + dz;
    if (!inBounds(world, nx, nz)) continue;
    const index = cellIndex(world, nx, nz);
    if (world.terrain[index] === TerrainType.GROUND && world.biome[index] !== biome) return true;
  }
  return false;
}

function makeProp(
  world: GeneratedWorld,
  kind: EnvironmentPropKind,
  x: number,
  z: number,
  salt: number,
): EnvironmentVisualProp {
  const variant = visualByte(world, x, z, salt);
  const offsetByteX = visualByte(world, x, z, salt + 7);
  const offsetByteZ = visualByte(world, x, z, salt + 13);
  const scaleByte = visualByte(world, x, z, salt + 19);
  const rotationByte = visualByte(world, x, z, salt + 29);
  return {
    kind,
    cellX: x,
    cellZ: z,
    offsetX: ((offsetByteX / 255) - 0.5) * 0.44,
    offsetZ: ((offsetByteZ / 255) - 0.5) * 0.44,
    scale: 0.72 + (scaleByte / 255) * 0.5,
    rotationDegrees: (rotationByte / 255) * 360,
    variant,
  };
}

function nearbyDecorationCell(
  world: GeneratedWorld,
  center: GridPoint,
  offsets: readonly (readonly [number, number])[],
  salt: number,
  occupied: Set<number>,
): GridPoint | null {
  const start = visualByte(world, center.x, center.z, salt) % offsets.length;
  for (let step = 0; step < offsets.length; step += 1) {
    const [dx, dz] = offsets[(start + step) % offsets.length]!;
    const x = center.x + dx;
    const z = center.z + dz;
    if (!inBounds(world, x, z)) continue;
    const index = cellIndex(world, x, z);
    const flags = world.flags[index] ?? 0;
    if (world.terrain[index] !== TerrainType.GROUND) continue;
    if ((flags & WorldCellFlag.ROUTE) !== 0) continue;
    if (occupied.has(index)) continue;
    occupied.add(index);
    return { x, z };
  }
  return null;
}

function addCuratedAround(
  target: EnvironmentVisualProp[],
  world: GeneratedWorld,
  center: GridPoint,
  kind: EnvironmentPropKind,
  count: number,
  salt: number,
  offsets: readonly (readonly [number, number])[],
  occupied: Set<number>,
): void {
  for (let index = 0; index < count; index += 1) {
    const cell = nearbyDecorationCell(world, center, offsets, salt + index * 17, occupied);
    if (!cell) return;
    target.push(makeProp(world, kind, cell.x, cell.z, salt + index * 31));
  }
}

export function createEnvironmentVisualLayout(world: GeneratedWorld): readonly EnvironmentVisualProp[] {
  const reserved = strategicReservedCells(world);
  const occupied = new Set<number>();
  const structured: EnvironmentVisualProp[] = [];
  const woodland: EnvironmentVisualProp[] = [];
  const highlands: EnvironmentVisualProp[] = [];
  const river: EnvironmentVisualProp[] = [];
  const plains: EnvironmentVisualProp[] = [];
  const biomeEdges: EnvironmentVisualProp[] = [];
  const routeEdges: EnvironmentVisualProp[] = [];

  for (const [index, spawn] of world.spawns.entries()) {
    addCuratedAround(structured, world, spawn.cell, 'SETTLEMENT_SUPPLIES', 2, 131 + index * 19, SETTLEMENT_OFFSETS, occupied);
  }
  for (const [index, resource] of world.resources.entries()) {
    if (structured.filter((prop) => prop.kind === 'RESOURCE_FRINGE').length >= 24) break;
    addCuratedAround(structured, world, resource.cell, 'RESOURCE_FRINGE', resource.rich ? 2 : 1, 173 + index * 13, NEAR_SITE_OFFSETS, occupied);
  }
  for (const [index, poi] of world.pois.entries()) {
    if (structured.filter((prop) => prop.kind === 'POI_FRINGE').length >= 18) break;
    addCuratedAround(structured, world, poi.cell, 'POI_FRINGE', 1, 211 + index * 11, NEAR_SITE_OFFSETS, occupied);
    if (poi.type === 'VILLAGE') {
      addCuratedAround(structured, world, poi.cell, 'SETTLEMENT_SUPPLIES', 1, 239 + index * 7, SETTLEMENT_OFFSETS, occupied);
    }
  }

  for (let z = 1; z < world.height - 1; z += 2) {
    for (let x = 1; x < world.width - 1; x += 2) {
      const index = cellIndex(world, x, z);
      if (occupied.has(index)) continue;
      const terrain = world.terrain[index];
      const flags = world.flags[index] ?? 0;

      if (terrain === TerrainType.WATER) {
        if (touchesTerrain(world, x, z, TerrainType.GROUND) && visualByte(world, x, z, 59) < 108 && river.length < 24) {
          river.push(makeProp(world, 'RIVER_REED', x, z, 67));
          occupied.add(index);
        }
        continue;
      }

      if (terrain !== TerrainType.GROUND || (flags & WorldCellFlag.ROUTE) !== 0) continue;

      if (touchesTerrain(world, x, z, TerrainType.WATER) && visualByte(world, x, z, 71) < 132 && river.length < 52) {
        river.push(makeProp(world, 'RIVER_BANK_STONE', x, z, 73));
        occupied.add(index);
        continue;
      }

      if (touchesFlag(world, x, z, WorldCellFlag.ROUTE) && visualByte(world, x, z, 79) < 64 && routeEdges.length < 18) {
        routeEdges.push(makeProp(world, 'ROUTE_EDGE_POST', x, z, 81));
        occupied.add(index);
        continue;
      }

      if (reserved.has(index)) continue;

      const biome = world.biome[index] as BiomeType;
      if (touchesDifferentBiome(world, x, z, biome) && visualByte(world, x, z, 101) < 88 && biomeEdges.length < 24) {
        biomeEdges.push(makeProp(
          world,
          biome === BiomeType.HIGHLANDS ? 'BIOME_EDGE_STONE' : 'BIOME_EDGE_SCRUB',
          x,
          z,
          103,
        ));
        occupied.add(index);
        continue;
      }

      const density = visualByte(world, x, z, 3);
      if (biome === BiomeType.WOODLAND && woodland.length < 82) {
        const neighbors = sameBiomeNeighborCount(world, x, z, BiomeType.WOODLAND);
        if (neighbors >= 5 && density < 116) {
          woodland.push(makeProp(world, 'WOODLAND_GROVE', x, z, 31));
          occupied.add(index);
        } else if (neighbors < 5 && density < 72) {
          woodland.push(makeProp(world, 'WOODLAND_EDGE', x, z, 37));
          occupied.add(index);
        }
      } else if (biome === BiomeType.HIGHLANDS && highlands.length < 44) {
        const neighbors = sameBiomeNeighborCount(world, x, z, BiomeType.HIGHLANDS);
        if (neighbors >= 5 && density < 96) {
          highlands.push(makeProp(world, 'HIGHLAND_RIDGE', x, z, 43));
          occupied.add(index);
        } else if (density < 70) {
          highlands.push(makeProp(world, 'HIGHLAND_ROCK', x, z, 47));
          occupied.add(index);
        }
      } else if (biome === BiomeType.PLAINS && plains.length < 40) {
        const plainsDensity = visualByte(world, x, z, 83);
        if (plainsDensity < 54) {
          plains.push(makeProp(world, 'PLAINS_SCRUB', x, z, 89));
          occupied.add(index);
        } else if (plainsDensity < 86) {
          plains.push(makeProp(world, 'PLAINS_STONE', x, z, 101));
          occupied.add(index);
        }
      }
    }
  }

  return [
    ...structured,
    ...routeEdges,
    ...river,
    ...biomeEdges,
    ...woodland,
    ...highlands,
    ...plains,
  ].slice(0, MAX_ENVIRONMENT_PROPS);
}
