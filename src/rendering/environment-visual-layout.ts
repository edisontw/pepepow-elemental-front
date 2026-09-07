import {
  BiomeType,
  TerrainType,
  WorldCellFlag,
  type GeneratedWorld,
  type GridPoint,
} from '../world/world-definition';

export type EnvironmentPropKind = 'WOODLAND_TREE' | 'HIGHLAND_ROCK' | 'RIVER_REED';

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

export const MAX_ENVIRONMENT_PROPS = 240;

function cellIndex(world: GeneratedWorld, x: number, z: number): number {
  return z * world.width + x;
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
      if (x < 0 || z < 0 || x >= world.width || z >= world.height) continue;
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

function touchesLand(world: GeneratedWorld, x: number, z: number): boolean {
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (const [dx, dz] of neighbors) {
    const nx = x + dx;
    const nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= world.width || nz >= world.height) continue;
    const terrain = world.terrain[cellIndex(world, nx, nz)];
    if (terrain === TerrainType.GROUND) return true;
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

export function createEnvironmentVisualLayout(world: GeneratedWorld): readonly EnvironmentVisualProp[] {
  const reserved = strategicReservedCells(world);
  const woodland: EnvironmentVisualProp[] = [];
  const highlands: EnvironmentVisualProp[] = [];
  const river: EnvironmentVisualProp[] = [];

  for (let z = 1; z < world.height - 1; z += 2) {
    for (let x = 1; x < world.width - 1; x += 2) {
      const index = cellIndex(world, x, z);
      const terrain = world.terrain[index];
      const flags = world.flags[index] ?? 0;
      if (terrain === TerrainType.GROUND && !reserved.has(index) && (flags & WorldCellFlag.ROUTE) === 0) {
        const biome = world.biome[index];
        const density = visualByte(world, x, z, 3);
        if (biome === BiomeType.WOODLAND && density < 92 && woodland.length < 128) {
          woodland.push(makeProp(world, 'WOODLAND_TREE', x, z, 31));
        } else if (biome === BiomeType.HIGHLANDS && density < 76 && highlands.length < 72) {
          highlands.push(makeProp(world, 'HIGHLAND_ROCK', x, z, 47));
        }
      } else if (
        terrain === TerrainType.WATER
        && touchesLand(world, x, z)
        && visualByte(world, x, z, 59) < 92
        && river.length < 40
      ) {
        river.push(makeProp(world, 'RIVER_REED', x, z, 67));
      }
    }
  }

  return [...woodland, ...highlands, ...river].slice(0, MAX_ENVIRONMENT_PROPS);
}
