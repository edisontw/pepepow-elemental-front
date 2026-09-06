import type { GeneratedWorld } from './world-definition';

function mixByte(hash: number, value: number): number {
  return Math.imul((hash ^ (value & 0xff)) >>> 0, 0x01000193) >>> 0;
}

function mixNumber(hash: number, value: number): number {
  let mixed = hash;
  const normalized = value >>> 0;
  mixed = mixByte(mixed, normalized);
  mixed = mixByte(mixed, normalized >>> 8);
  mixed = mixByte(mixed, normalized >>> 16);
  mixed = mixByte(mixed, normalized >>> 24);
  return mixed;
}

function mixString(hash: number, value: string): number {
  let mixed = mixNumber(hash, value.length);
  for (let index = 0; index < value.length; index += 1) mixed = mixNumber(mixed, value.charCodeAt(index));
  return mixed;
}

function mixArray(hash: number, values: ArrayLike<number>): number {
  let mixed = mixNumber(hash, values.length);
  for (let index = 0; index < values.length; index += 1) mixed = mixNumber(mixed, values[index] ?? 0);
  return mixed;
}

export function computeGameplayHash(world: Omit<GeneratedWorld, 'gameplayHash' | 'visualVariant'>): string {
  let hash = 0x811c9dc5;
  hash = mixString(hash, world.identity.namespace);
  hash = mixString(hash, world.identity.rulesetVersion);
  hash = mixNumber(hash, world.identity.blockHeight);
  hash = mixNumber(hash, world.identity.masterSeed);
  hash = mixNumber(hash, world.generationAttempt);
  hash = mixNumber(hash, world.width);
  hash = mixNumber(hash, world.height);
  hash = mixArray(hash, world.elevation);
  hash = mixArray(hash, world.moisture);
  hash = mixArray(hash, world.terrain);
  hash = mixArray(hash, world.biome);
  hash = mixArray(hash, world.flags);
  hash = mixArray(hash, world.regionByCell);

  for (const region of world.regions) {
    hash = mixNumber(hash, region.id);
    hash = mixString(hash, region.name);
    hash = mixNumber(hash, region.center.x);
    hash = mixNumber(hash, region.center.z);
    hash = mixNumber(hash, region.biome);
    hash = mixNumber(hash, region.cellCount);
    for (const neighbor of region.neighbors) hash = mixNumber(hash, neighbor);
  }
  for (const route of world.routes) {
    hash = mixString(hash, route.id);
    hash = mixNumber(hash, route.fromRegion);
    hash = mixNumber(hash, route.toRegion);
    hash = mixNumber(hash, route.widthCells);
    for (const point of route.path) {
      hash = mixNumber(hash, point.x);
      hash = mixNumber(hash, point.z);
    }
    for (const point of route.crossingCells) {
      hash = mixNumber(hash, point.x);
      hash = mixNumber(hash, point.z);
    }
  }
  for (const resource of world.resources) {
    hash = mixString(hash, resource.id);
    hash = mixString(hash, resource.type);
    hash = mixNumber(hash, resource.cell.x);
    hash = mixNumber(hash, resource.cell.z);
    hash = mixNumber(hash, resource.regionId);
    hash = mixNumber(hash, resource.rich ? 1 : 0);
  }
  for (const poi of world.pois) {
    hash = mixString(hash, poi.id);
    hash = mixString(hash, poi.type);
    hash = mixNumber(hash, poi.cell.x);
    hash = mixNumber(hash, poi.cell.z);
    hash = mixNumber(hash, poi.regionId);
    hash = mixNumber(hash, poi.lowRisk ? 1 : 0);
  }
  for (const spawn of world.spawns) {
    hash = mixString(hash, spawn.id);
    hash = mixNumber(hash, spawn.cell.x);
    hash = mixNumber(hash, spawn.cell.z);
    hash = mixNumber(hash, spawn.regionId);
  }
  for (const site of [world.objective, world.boss]) {
    hash = mixString(hash, site.id);
    hash = mixNumber(hash, site.cell.x);
    hash = mixNumber(hash, site.cell.z);
    hash = mixNumber(hash, site.regionId);
  }
  return hash.toString(16).padStart(8, '0');
}
