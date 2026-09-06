import {
  TerrainType,
  WorldCellFlag,
  type BattlefieldQuality,
  type GridPoint,
  type MajorSite,
  type PointOfInterest,
  type ResourceNode,
  type StrategicRegion,
  type StrategicRoute,
  type WorldSpawn,
  type WorldValidation,
} from './world-definition';

export interface WorldValidationView {
  width: number;
  height: number;
  terrain: Uint8Array;
  biome: Uint8Array;
  flags: Uint16Array;
  regionByCell: Uint8Array;
  regions: readonly StrategicRegion[];
  routes: readonly StrategicRoute[];
  resources: readonly ResourceNode[];
  pois: readonly PointOfInterest[];
  spawns: readonly WorldSpawn[];
  objective: MajorSite;
  boss: MajorSite;
}

function indexOf(world: WorldValidationView, point: GridPoint): number {
  return point.z * world.width + point.x;
}

function inBounds(world: WorldValidationView, point: GridPoint): boolean {
  return point.x >= 0 && point.z >= 0 && point.x < world.width && point.z < world.height;
}

function isWalkable(world: WorldValidationView, point: GridPoint): boolean {
  if (!inBounds(world, point)) return false;
  return ((world.flags[indexOf(world, point)] ?? 0) & WorldCellFlag.WALKABLE) !== 0;
}

function reachableMask(world: WorldValidationView, start: GridPoint): Uint8Array {
  const visited = new Uint8Array(world.width * world.height);
  if (!isWalkable(world, start)) return visited;
  const queueX = new Uint16Array(world.width * world.height);
  const queueZ = new Uint16Array(world.width * world.height);
  let head = 0;
  let tail = 0;
  queueX[tail] = start.x;
  queueZ[tail] = start.z;
  tail += 1;
  visited[indexOf(world, start)] = 1;
  const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  while (head < tail) {
    const x = queueX[head] ?? 0;
    const z = queueZ[head] ?? 0;
    head += 1;
    for (const [dx, dz] of offsets) {
      const point = { x: x + dx, z: z + dz };
      if (!isWalkable(world, point)) continue;
      const index = indexOf(world, point);
      if (visited[index] !== 0) continue;
      visited[index] = 1;
      queueX[tail] = point.x;
      queueZ[tail] = point.z;
      tail += 1;
    }
  }
  return visited;
}

function isReachable(world: WorldValidationView, mask: Uint8Array, point: GridPoint): boolean {
  return inBounds(world, point) && mask[indexOf(world, point)] === 1;
}

function squaredDistance(a: GridPoint, b: GridPoint): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function countConnectedRegions(world: WorldValidationView): number {
  if (world.regions.length === 0) return 0;
  const seen = new Set<number>([world.regions[0]?.id ?? 0]);
  const queue = [world.regions[0]?.id ?? 0];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    const region = world.regions.find((candidate) => candidate.id === id);
    if (!region) continue;
    for (const neighbor of region.neighbors) {
      if (seen.has(neighbor)) continue;
      seen.add(neighbor);
      queue.push(neighbor);
    }
  }
  return seen.size;
}

export function validateWorld(world: WorldValidationView): WorldValidation {
  const failures: string[] = [];
  const player = world.spawns.find((spawn) => spawn.id === 'PLAYER');
  const enemy = world.spawns.find((spawn) => spawn.id === 'ENEMY');
  if (!player) failures.push('Missing player spawn.');
  if (!enemy) failures.push('Missing enemy spawn.');
  if (!player) return { valid: false, hardFailures: failures };
  if (!isWalkable(world, player.cell)) failures.push('Player spawn is not walkable.');

  const reachable = reachableMask(world, player.cell);
  if (!isReachable(world, reachable, world.objective.cell)) failures.push('Objective is unreachable from player spawn.');
  if (!isReachable(world, reachable, world.boss.cell)) failures.push('Boss area is unreachable from player spawn.');
  if (enemy && !isReachable(world, reachable, enemy.cell)) failures.push('Enemy spawn is unreachable from player spawn.');

  const material = world.resources.filter((resource) => resource.type === 'MATERIAL');
  const mana = world.resources.filter((resource) => resource.type === 'MANA');
  if (material.length < 8 || material.length > 12) failures.push('Material resource count is outside the M02 envelope.');
  if (mana.length < 4 || mana.length > 7) failures.push('Mana resource count is outside the M02 envelope.');
  if (world.resources.some((resource) => !isWalkable(world, resource.cell))) failures.push('Resource is placed on an invalid cell.');
  if (world.pois.some((poi) => !isWalkable(world, poi.cell))) failures.push('POI is placed on an invalid cell.');

  const safeMaterial = material.some((resource) => squaredDistance(resource.cell, player.cell) <= 14 * 14);
  if (!safeMaterial) failures.push('Player spawn lacks a nearby Material source.');
  const safePoi = world.pois.some((poi) => poi.lowRisk && squaredDistance(poi.cell, player.cell) <= 18 * 18);
  if (!safePoi) failures.push('Player spawn lacks a nearby low-risk POI.');
  const expansion = material.some((resource) => resource.regionId !== player.regionId && isReachable(world, reachable, resource.cell));
  if (!expansion) failures.push('Player lacks a viable expansion Material source.');

  const occupied = new Set<string>();
  const allPoints: readonly GridPoint[] = [
    ...world.resources.map((resource) => resource.cell),
    ...world.pois.map((poi) => poi.cell),
    ...world.spawns.map((spawn) => spawn.cell),
    world.objective.cell,
    world.boss.cell,
  ];
  for (const point of allPoints) {
    const key = `${point.x},${point.z}`;
    if (occupied.has(key)) failures.push(`Illegal placement overlap at ${key}.`);
    occupied.add(key);
  }

  const crossingCount = world.terrain.reduce((count, terrain) => count + (terrain === TerrainType.CROSSING ? 1 : 0), 0);
  if (crossingCount < 18) failures.push('Hydrology lacks robust natural crossing capacity.');
  if (world.regions.length < 8 || world.regions.length > 14) failures.push('Strategic region count is outside the M02 envelope.');
  if (countConnectedRegions(world) !== world.regions.length) failures.push('Strategic region graph is disconnected.');
  if (world.routes.length < world.regions.length - 1) failures.push('Route graph does not connect all strategic regions.');

  return { valid: failures.length === 0, hardFailures: failures };
}

function permille(count: number, total: number): number {
  return Math.round((count * 1000) / total);
}

function rangePenalty(value: number, min: number, max: number, scale: number): number {
  if (value < min) return Math.ceil((min - value) / scale);
  if (value > max) return Math.ceil((value - max) / scale);
  return 0;
}

export function scoreBattlefield(world: WorldValidationView): BattlefieldQuality {
  const total = world.width * world.height;
  let water = 0;
  let forest = 0;
  let highGround = 0;
  for (let index = 0; index < total; index += 1) {
    const terrain = world.terrain[index] ?? TerrainType.GROUND;
    const flags = world.flags[index] ?? 0;
    if (terrain === TerrainType.WATER) water += 1;
    if ((flags & WorldCellFlag.FOREST) !== 0) forest += 1;
    if ((flags & WorldCellFlag.HIGH_GROUND) !== 0) highGround += 1;
  }
  const waterPermille = permille(water, total);
  const forestPermille = permille(forest, total);
  const highGroundPermille = permille(highGround, total);
  const routeCycleCount = Math.max(0, world.routes.length - world.regions.length + 1);
  const resourceRegionCount = new Set(world.resources.map((resource) => resource.regionId)).size;

  let score = 100;
  score -= rangePenalty(waterPermille, 80, 150, 5);
  score -= rangePenalty(forestPermille, 150, 260, 8);
  score -= rangePenalty(highGroundPermille, 100, 220, 8);
  if (routeCycleCount < 2) score -= (2 - routeCycleCount) * 8;
  if (routeCycleCount > 6) score -= (routeCycleCount - 6) * 3;
  if (resourceRegionCount < 6) score -= (6 - resourceRegionCount) * 4;
  const smallestRegion = Math.min(...world.regions.map((region) => region.cellCount));
  if (smallestRegion < 800) score -= Math.ceil((800 - smallestRegion) / 100);

  return {
    score: Math.max(0, Math.min(100, score)),
    waterPermille,
    forestPermille,
    highGroundPermille,
    routeCycleCount,
    resourceRegionCount,
  };
}
