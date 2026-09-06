import type { DeterministicRng } from '../simulation/random';
import {
  BiomeType,
  M02_STANDARD_RULES,
  STANDARD_REGION_COLUMNS,
  STANDARD_REGION_ROWS,
  TerrainType,
  WorldCellFlag,
  type GeneratedWorld,
  type GridPoint,
  type MajorSite,
  type PointOfInterest,
  type ResourceNode,
  type StrategicRegion,
  type StrategicRoute,
  type WorldGenerationOptions,
  type WorldGenerationRules,
  type WorldSpawn,
} from './world-definition';
import { computeGameplayHash } from './world-hash';
import { createWorldIdentity, createWorldRng, nextInt, nextRange } from './world-seed';
import { scoreBattlefield, validateWorld } from './world-validator';

const REGION_NAMES = [
  'Northwest Reach',
  'North March',
  'North Basin',
  'Northeast Heights',
  'Westwood',
  'Central Vale',
  'Riverlands',
  'Eastwatch',
  'Southwest Wilds',
  'South Ridge',
  'South Basin',
  'Southeast Frontier',
] as const;

interface GenerationLayers {
  elevation: Int16Array;
  moisture: Uint8Array;
  terrain: Uint8Array;
  biome: Uint8Array;
  flags: Uint16Array;
  regionByCell: Uint8Array;
}

interface HydrologyResult {
  crossings: readonly GridPoint[];
}

interface PlacementState {
  occupied: Set<string>;
  points: GridPoint[];
}

function cellIndex(width: number, x: number, z: number): number {
  return z * width + x;
}

function pointKey(point: GridPoint): string {
  return `${point.x},${point.z}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function squaredDistance(a: GridPoint, b: GridPoint): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function makeNoiseGrid(rng: DeterministicRng, width: number, height: number): Uint8Array {
  const values = new Uint8Array(width * height);
  for (let index = 0; index < values.length; index += 1) values[index] = nextInt(rng, 256);
  return values;
}

function sampleBilinearInteger(grid: Uint8Array, gridWidth: number, gridHeight: number, x: number, z: number, width: number, height: number): number {
  const scaledX = Math.floor((x * (gridWidth - 1) * 256) / Math.max(1, width - 1));
  const scaledZ = Math.floor((z * (gridHeight - 1) * 256) / Math.max(1, height - 1));
  const x0 = Math.min(gridWidth - 1, scaledX >> 8);
  const z0 = Math.min(gridHeight - 1, scaledZ >> 8);
  const x1 = Math.min(gridWidth - 1, x0 + 1);
  const z1 = Math.min(gridHeight - 1, z0 + 1);
  const fx = scaledX & 255;
  const fz = scaledZ & 255;
  const a = grid[z0 * gridWidth + x0] ?? 0;
  const b = grid[z0 * gridWidth + x1] ?? 0;
  const c = grid[z1 * gridWidth + x0] ?? 0;
  const d = grid[z1 * gridWidth + x1] ?? 0;
  const top = a * (256 - fx) + b * fx;
  const bottom = c * (256 - fx) + d * fx;
  return Math.floor((top * (256 - fz) + bottom * fz) / 65_536);
}

function generateElevation(width: number, height: number, rng: DeterministicRng): Int16Array {
  const coarse = makeNoiseGrid(rng, 9, 9);
  const detail = makeNoiseGrid(rng, 17, 17);
  const elevation = new Int16Array(width * height);
  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const broad = sampleBilinearInteger(coarse, 9, 9, x, z, width, height);
      const local = sampleBilinearInteger(detail, 17, 17, x, z, width, height);
      const centerDistance = Math.abs(x - Math.floor(width / 2)) + Math.abs(z - Math.floor(height / 2));
      const edgeLift = Math.floor((centerDistance * 22) / Math.max(width, height));
      elevation[cellIndex(width, x, z)] = clamp(Math.floor((broad * 3 + local) / 4) + edgeLift, 0, 255);
    }
  }
  return elevation;
}

function markWater(terrain: Uint8Array, flags: Uint16Array, width: number, x: number, z: number): void {
  const index = cellIndex(width, x, z);
  terrain[index] = TerrainType.WATER;
  flags[index] = WorldCellFlag.WATER;
}

function markCrossing(terrain: Uint8Array, flags: Uint16Array, width: number, x: number, z: number): void {
  const index = cellIndex(width, x, z);
  terrain[index] = TerrainType.CROSSING;
  flags[index] = WorldCellFlag.WALKABLE | WorldCellFlag.SHALLOW;
}

function generateHydrology(width: number, height: number, terrain: Uint8Array, flags: Uint16Array, rng: DeterministicRng): HydrologyResult {
  const riverCenterByRow = new Int16Array(height);
  let center = Math.floor(width / 2) + nextRange(rng, -8, 8);
  const riverHalfWidth = 5;
  for (let z = 0; z < height; z += 1) {
    if (z % 7 === 0) center = clamp(center + nextRange(rng, -2, 2), 44, width - 45);
    riverCenterByRow[z] = center;
    for (let x = center - riverHalfWidth; x <= center + riverHalfWidth; x += 1) markWater(terrain, flags, width, x, z);
  }

  const crossingRows = [
    nextRange(rng, 24, 34),
    nextRange(rng, 58, 70),
    nextRange(rng, 92, 104),
  ];
  const crossings: GridPoint[] = [];
  for (const crossingRow of crossingRows) {
    for (let z = crossingRow - 1; z <= crossingRow + 2; z += 1) {
      const rowCenter = riverCenterByRow[z] ?? center;
      for (let x = rowCenter - riverHalfWidth; x <= rowCenter + riverHalfWidth; x += 1) markCrossing(terrain, flags, width, x, z);
    }
    crossings.push({ x: riverCenterByRow[crossingRow] ?? center, z: crossingRow });
  }

  const branchRow = nextRange(rng, 42, 86);
  const branchToWest = nextInt(rng, 2) === 0;
  const branchCenter = riverCenterByRow[branchRow] ?? center;
  const branchStart = branchToWest ? 0 : branchCenter;
  const branchEnd = branchToWest ? branchCenter : width - 1;
  for (let x = branchStart; x <= branchEnd; x += 1) {
    markWater(terrain, flags, width, x, branchRow);
    if (branchRow + 1 < height) markWater(terrain, flags, width, x, branchRow + 1);
  }
  const branchCrossingX = branchToWest ? Math.floor(branchCenter / 2) : Math.floor((branchCenter + width - 1) / 2);
  for (let x = branchCrossingX - 2; x <= branchCrossingX + 2; x += 1) {
    markCrossing(terrain, flags, width, x, branchRow);
    if (branchRow + 1 < height) markCrossing(terrain, flags, width, x, branchRow + 1);
  }
  crossings.push({ x: branchCrossingX, z: branchRow });
  return { crossings };
}

function generateBiomeAndMoisture(
  width: number,
  height: number,
  elevation: Int16Array,
  terrain: Uint8Array,
  flags: Uint16Array,
  rng: DeterministicRng,
): { moisture: Uint8Array; biome: Uint8Array } {
  const coarseMoisture = makeNoiseGrid(rng, 9, 9);
  const detailMoisture = makeNoiseGrid(rng, 17, 17);
  const moisture = new Uint8Array(width * height);
  const biome = new Uint8Array(width * height);
  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = cellIndex(width, x, z);
      const broad = sampleBilinearInteger(coarseMoisture, 9, 9, x, z, width, height);
      const local = sampleBilinearInteger(detailMoisture, 17, 17, x, z, width, height);
      const moistureValue = clamp(Math.floor((broad * 3 + local) / 4), 0, 255);
      moisture[index] = moistureValue;
      if (terrain[index] === TerrainType.WATER || terrain[index] === TerrainType.CROSSING) continue;
      flags[index] = WorldCellFlag.WALKABLE | WorldCellFlag.BUILDABLE;
      const heightValue = elevation[index] ?? 0;
      if (heightValue >= 190) {
        biome[index] = BiomeType.HIGHLANDS;
        flags[index] = (flags[index] ?? 0) | WorldCellFlag.HIGH_GROUND;
      } else if (moistureValue >= 174) {
        biome[index] = BiomeType.WOODLAND;
        flags[index] = (flags[index] ?? 0) | WorldCellFlag.FOREST;
      } else {
        biome[index] = BiomeType.PLAINS;
      }
    }
  }
  return { moisture, biome };
}

function regionIdForCell(x: number, z: number, width: number, height: number): number {
  const column = Math.min(STANDARD_REGION_COLUMNS - 1, Math.floor((x * STANDARD_REGION_COLUMNS) / width));
  const row = Math.min(STANDARD_REGION_ROWS - 1, Math.floor((z * STANDARD_REGION_ROWS) / height));
  return row * STANDARD_REGION_COLUMNS + column;
}

function isWalkable(flags: Uint16Array, width: number, point: GridPoint): boolean {
  return ((flags[cellIndex(width, point.x, point.z)] ?? 0) & WorldCellFlag.WALKABLE) !== 0;
}

function nearestWalkable(flags: Uint16Array, width: number, height: number, target: GridPoint, maxRadius = 24): GridPoint {
  if (isWalkable(flags, width, target)) return target;
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (const dx of [-radius, radius]) {
        const point = { x: clamp(target.x + dx, 0, width - 1), z: clamp(target.z + dz, 0, height - 1) };
        if (isWalkable(flags, width, point)) return point;
      }
    }
    for (let dx = -radius + 1; dx < radius; dx += 1) {
      for (const dz of [-radius, radius]) {
        const point = { x: clamp(target.x + dx, 0, width - 1), z: clamp(target.z + dz, 0, height - 1) };
        if (isWalkable(flags, width, point)) return point;
      }
    }
  }
  throw new Error(`Unable to find walkable cell near ${target.x},${target.z}.`);
}

function buildRegionLayer(
  width: number,
  height: number,
  biome: Uint8Array,
  flags: Uint16Array,
  rng: DeterministicRng,
): { regionByCell: Uint8Array; regions: StrategicRegion[] } {
  const regionCount = STANDARD_REGION_COLUMNS * STANDARD_REGION_ROWS;
  const regionByCell = new Uint8Array(width * height);
  const counts = new Uint32Array(regionCount);
  const biomeCounts = Array.from({ length: regionCount }, () => new Uint32Array(3));
  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = regionIdForCell(x, z, width, height);
      const index = cellIndex(width, x, z);
      regionByCell[index] = id;
      counts[id] = (counts[id] ?? 0) + 1;
      const biomeId = biome[index] ?? BiomeType.PLAINS;
      const bucket = biomeCounts[id];
      if (bucket) bucket[biomeId] = (bucket[biomeId] ?? 0) + 1;
    }
  }

  const regions: StrategicRegion[] = [];
  const sectorWidth = Math.floor(width / STANDARD_REGION_COLUMNS);
  const sectorHeight = Math.floor(height / STANDARD_REGION_ROWS);
  for (let row = 0; row < STANDARD_REGION_ROWS; row += 1) {
    for (let column = 0; column < STANDARD_REGION_COLUMNS; column += 1) {
      const id = row * STANDARD_REGION_COLUMNS + column;
      const target = {
        x: clamp(column * sectorWidth + Math.floor(sectorWidth / 2) + nextRange(rng, -6, 6), 2, width - 3),
        z: clamp(row * sectorHeight + Math.floor(sectorHeight / 2) + nextRange(rng, -6, 6), 2, height - 3),
      };
      const center = nearestWalkable(flags, width, height, target);
      const buckets = biomeCounts[id] ?? new Uint32Array(3);
      let dominantBiome = BiomeType.PLAINS;
      for (let candidate = 1; candidate < buckets.length; candidate += 1) {
        if ((buckets[candidate] ?? 0) > (buckets[dominantBiome] ?? 0)) dominantBiome = candidate as BiomeType;
      }
      regions.push({
        id,
        name: REGION_NAMES[id] ?? `Region ${id + 1}`,
        center,
        biome: dominantBiome,
        cellCount: counts[id] ?? 0,
        neighbors: [],
      });
    }
  }
  return { regionByCell, regions };
}

function cardinalPath(from: GridPoint, to: GridPoint, via?: GridPoint): GridPoint[] {
  const points: GridPoint[] = [];
  const targets = via ? [via, to] : [to];
  let current = { ...from };
  points.push({ ...current });
  for (const target of targets) {
    while (current.x !== target.x) {
      current = { x: current.x + Math.sign(target.x - current.x), z: current.z };
      points.push({ ...current });
    }
    while (current.z !== target.z) {
      current = { x: current.x, z: current.z + Math.sign(target.z - current.z) };
      points.push({ ...current });
    }
  }
  return points;
}

function routePairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function chooseCrossing(from: GridPoint, to: GridPoint, crossings: readonly GridPoint[]): GridPoint | undefined {
  if (crossings.length === 0) return undefined;
  const midpoint = { x: Math.floor((from.x + to.x) / 2), z: Math.floor((from.z + to.z) / 2) };
  return crossings.reduce((best, crossing) => squaredDistance(crossing, midpoint) < squaredDistance(best, midpoint) ? crossing : best);
}

function buildRoutes(
  width: number,
  terrain: Uint8Array,
  flags: Uint16Array,
  regions: StrategicRegion[],
  crossings: readonly GridPoint[],
  rng: DeterministicRng,
): StrategicRoute[] {
  const pairs: Array<[number, number]> = [];
  for (let row = 0; row < STANDARD_REGION_ROWS; row += 1) {
    for (let column = 0; column < STANDARD_REGION_COLUMNS - 1; column += 1) {
      const from = row * STANDARD_REGION_COLUMNS + column;
      pairs.push([from, from + 1]);
    }
  }
  for (let row = 0; row < STANDARD_REGION_ROWS - 1; row += 1) {
    const from = row * STANDARD_REGION_COLUMNS;
    pairs.push([from, from + STANDARD_REGION_COLUMNS]);
  }
  const used = new Set(pairs.map(([a, b]) => routePairKey(a, b)));
  const extras: Array<[number, number]> = [];
  for (let row = 0; row < STANDARD_REGION_ROWS - 1; row += 1) {
    for (let column = 1; column < STANDARD_REGION_COLUMNS; column += 1) {
      extras.push([row * STANDARD_REGION_COLUMNS + column, (row + 1) * STANDARD_REGION_COLUMNS + column]);
    }
  }
  for (let pick = 0; pick < 3 && extras.length > 0; pick += 1) {
    const index = nextInt(rng, extras.length);
    const pair = extras.splice(index, 1)[0];
    if (!pair) continue;
    const key = routePairKey(pair[0], pair[1]);
    if (!used.has(key)) {
      used.add(key);
      pairs.push(pair);
    }
  }

  const routes: StrategicRoute[] = [];
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index];
    if (!pair) continue;
    const from = regions[pair[0]];
    const to = regions[pair[1]];
    if (!from || !to) continue;
    const oppositeRiverSides = (from.center.x < width / 2) !== (to.center.x < width / 2);
    const via = oppositeRiverSides ? chooseCrossing(from.center, to.center, crossings) : undefined;
    const path = cardinalPath(from.center, to.center, via);
    const crossingCells: GridPoint[] = [];
    for (const point of path) {
      const cell = cellIndex(width, point.x, point.z);
      if (terrain[cell] === TerrainType.CROSSING) crossingCells.push(point);
      if (((flags[cell] ?? 0) & WorldCellFlag.WALKABLE) !== 0) flags[cell] = (flags[cell] ?? 0) | WorldCellFlag.ROUTE;
    }
    routes.push({
      id: `route-${pair[0]}-${pair[1]}`,
      fromRegion: pair[0],
      toRegion: pair[1],
      widthCells: nextRange(rng, 4, 7),
      path,
      crossingCells,
    });
  }

  const neighbors = Array.from({ length: regions.length }, () => new Set<number>());
  for (const route of routes) {
    neighbors[route.fromRegion]?.add(route.toRegion);
    neighbors[route.toRegion]?.add(route.fromRegion);
  }
  for (let index = 0; index < regions.length; index += 1) {
    const region = regions[index];
    if (!region) continue;
    regions[index] = { ...region, neighbors: [...(neighbors[index] ?? new Set<number>())].sort((a, b) => a - b) };
  }
  return routes;
}

function sectorBounds(regionId: number, width: number, height: number): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const column = regionId % STANDARD_REGION_COLUMNS;
  const row = Math.floor(regionId / STANDARD_REGION_COLUMNS);
  return {
    minX: Math.floor((column * width) / STANDARD_REGION_COLUMNS),
    maxX: Math.floor(((column + 1) * width) / STANDARD_REGION_COLUMNS) - 1,
    minZ: Math.floor((row * height) / STANDARD_REGION_ROWS),
    maxZ: Math.floor(((row + 1) * height) / STANDARD_REGION_ROWS) - 1,
  };
}

function isPlacementValid(flags: Uint16Array, width: number, point: GridPoint, state: PlacementState, minimumSpacing: number): boolean {
  if (!isWalkable(flags, width, point) || state.occupied.has(pointKey(point))) return false;
  const minSquared = minimumSpacing * minimumSpacing;
  return state.points.every((other) => squaredDistance(other, point) >= minSquared);
}

function reservePoint(state: PlacementState, point: GridPoint): GridPoint {
  state.occupied.add(pointKey(point));
  state.points.push(point);
  return point;
}

function placeNear(
  flags: Uint16Array,
  width: number,
  height: number,
  target: GridPoint,
  state: PlacementState,
  maxRadius: number,
  minimumSpacing: number,
): GridPoint {
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const point = { x: clamp(target.x + dx, 1, width - 2), z: clamp(target.z + dz, 1, height - 2) };
        if (isPlacementValid(flags, width, point, state, minimumSpacing)) return reservePoint(state, point);
      }
    }
  }
  throw new Error(`Unable to place world feature near ${target.x},${target.z}.`);
}

function placeInRegion(
  flags: Uint16Array,
  width: number,
  height: number,
  regionId: number,
  state: PlacementState,
  rng: DeterministicRng,
  minimumSpacing: number,
): GridPoint {
  const bounds = sectorBounds(regionId, width, height);
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const point = { x: nextRange(rng, bounds.minX + 2, bounds.maxX - 2), z: nextRange(rng, bounds.minZ + 2, bounds.maxZ - 2) };
    if (isPlacementValid(flags, width, point, state, minimumSpacing)) return reservePoint(state, point);
  }
  const center = { x: Math.floor((bounds.minX + bounds.maxX) / 2), z: Math.floor((bounds.minZ + bounds.maxZ) / 2) };
  return placeNear(flags, width, height, center, state, Math.max(width, height), minimumSpacing);
}

function chooseCornerPair(rng: DeterministicRng): [number, number] {
  const pairs: Array<[number, number]> = [[8, 3], [11, 0], [0, 11], [3, 8]];
  return pairs[nextInt(rng, pairs.length)] ?? [8, 3];
}

function buildPlacements(
  width: number,
  height: number,
  flags: Uint16Array,
  regions: readonly StrategicRegion[],
  spawnRng: DeterministicRng,
  resourceRng: DeterministicRng,
  poiRng: DeterministicRng,
  enemyRng: DeterministicRng,
  bossRng: DeterministicRng,
): { resources: ResourceNode[]; pois: PointOfInterest[]; spawns: WorldSpawn[]; objective: MajorSite; boss: MajorSite } {
  const state: PlacementState = { occupied: new Set<string>(), points: [] };
  const [playerRegionId, enemyRegionId] = chooseCornerPair(spawnRng);
  const playerRegion = regions[playerRegionId];
  const enemyRegion = regions[enemyRegionId];
  if (!playerRegion || !enemyRegion) throw new Error('Missing corner strategic region.');
  const playerCell = placeNear(flags, width, height, playerRegion.center, state, 12, 0);
  const enemyCell = placeNear(flags, width, height, enemyRegion.center, state, 12, 8);
  const spawns: WorldSpawn[] = [
    { id: 'PLAYER', cell: playerCell, regionId: playerRegionId },
    { id: 'ENEMY', cell: enemyCell, regionId: enemyRegionId },
  ];

  const resources: ResourceNode[] = [];
  const safeMaterialCell = placeNear(flags, width, height, playerCell, state, 12, 5);
  resources.push({ id: 'material-0', type: 'MATERIAL', cell: safeMaterialCell, regionId: playerRegionId, rich: false });
  const expansionRegionId = playerRegion.neighbors[nextInt(resourceRng, playerRegion.neighbors.length)] ?? ((playerRegionId + 1) % regions.length);
  const expansionMaterialCell = placeInRegion(flags, width, height, expansionRegionId, state, resourceRng, 6);
  resources.push({ id: 'material-1', type: 'MATERIAL', cell: expansionMaterialCell, regionId: expansionRegionId, rich: false });
  for (let index = 2; index < 10; index += 1) {
    const regionId = nextInt(resourceRng, regions.length);
    const cell = placeInRegion(flags, width, height, regionId, state, resourceRng, 6);
    resources.push({ id: `material-${index}`, type: 'MATERIAL', cell, regionId, rich: nextInt(resourceRng, 5) === 0 });
  }
  for (let index = 0; index < 5; index += 1) {
    const regionId = nextInt(resourceRng, regions.length);
    const cell = placeInRegion(flags, width, height, regionId, state, resourceRng, 6);
    resources.push({ id: `mana-${index}`, type: 'MANA', cell, regionId, rich: nextInt(resourceRng, 4) === 0 });
  }

  const pois: PointOfInterest[] = [];
  const safePoiCell = placeNear(flags, width, height, playerCell, state, 16, 5);
  pois.push({ id: 'shrine-0', type: 'SHRINE', cell: safePoiCell, regionId: playerRegionId, lowRisk: true });
  const poiPlan: ReadonlyArray<{ type: PointOfInterest['type']; count: number }> = [
    { type: 'SHRINE', count: 5 },
    { type: 'NEUTRAL_CAMP', count: 5 },
    { type: 'VILLAGE', count: 2 },
    { type: 'ANCIENT_RUIN', count: 2 },
  ];
  for (const plan of poiPlan) {
    for (let index = 0; index < plan.count; index += 1) {
      const regionId = nextInt(poiRng, regions.length);
      const cell = placeInRegion(flags, width, height, regionId, state, poiRng, 5);
      pois.push({ id: `${plan.type.toLowerCase()}-${index + (plan.type === 'SHRINE' ? 1 : 0)}`, type: plan.type, cell, regionId, lowRisk: false });
    }
  }

  const candidateSiteRegions = regions
    .map((region) => ({ region, distance: squaredDistance(region.center, playerCell) }))
    .filter(({ region }) => region.id !== playerRegionId && region.id !== enemyRegionId)
    .sort((a, b) => b.distance - a.distance || a.region.id - b.region.id);
  const bossRegion = candidateSiteRegions[nextInt(bossRng, Math.min(3, candidateSiteRegions.length))]?.region ?? enemyRegion;
  const objectiveRegion = candidateSiteRegions.find(({ region }) => region.id !== bossRegion.id)?.region ?? enemyRegion;
  const bossCell = placeNear(flags, width, height, bossRegion.center, state, 18, 9);
  const objectiveCell = placeNear(flags, width, height, objectiveRegion.center, state, 18, 9);
  const boss: MajorSite = { id: 'BOSS', cell: bossCell, regionId: bossRegion.id };
  const objective: MajorSite = { id: 'OBJECTIVE', cell: objectiveCell, regionId: objectiveRegion.id };
  void enemyRng.nextUint32();
  return { resources, pois, spawns, objective, boss };
}

function createVisualVariant(identitySeed: number, rulesetVersion: string, attempt: number, visualSalt: string): Uint8Array {
  const identity = { namespace: 'pepepow-elemental-front', rulesetVersion, blockHeight: 0, masterSeed: identitySeed };
  const rng = createWorldRng(identity, 'visual', attempt, visualSalt);
  const variant = new Uint8Array(64);
  for (let index = 0; index < variant.length; index += 1) variant[index] = nextInt(rng, 256);
  return variant;
}

export function generateWorldAttempt(
  blockHeight: number,
  rules: WorldGenerationRules = M02_STANDARD_RULES,
  generationAttempt = 0,
  options: WorldGenerationOptions = {},
): GeneratedWorld {
  if (rules.width !== 128 || rules.height !== 128) throw new Error('M02 strategic-region layout currently requires a 128×128 standard world.');
  const identity = createWorldIdentity(blockHeight, rules.rulesetVersion);
  const elevationRng = createWorldRng(identity, 'elevation', generationAttempt);
  const hydrologyRng = createWorldRng(identity, 'hydrology', generationAttempt);
  const biomeRng = createWorldRng(identity, 'biome', generationAttempt);
  const regionRng = createWorldRng(identity, 'region', generationAttempt);
  const routeRng = createWorldRng(identity, 'route', generationAttempt);
  const resourceRng = createWorldRng(identity, 'resource', generationAttempt);
  const poiRng = createWorldRng(identity, 'poi', generationAttempt);
  const spawnRng = createWorldRng(identity, 'spawn', generationAttempt);
  const enemyRng = createWorldRng(identity, 'enemy', generationAttempt);
  const bossRng = createWorldRng(identity, 'boss', generationAttempt);

  const terrain = new Uint8Array(rules.width * rules.height);
  const flags = new Uint16Array(rules.width * rules.height);
  const elevation = generateElevation(rules.width, rules.height, elevationRng);
  const hydrology = generateHydrology(rules.width, rules.height, terrain, flags, hydrologyRng);
  const biomeLayer = generateBiomeAndMoisture(rules.width, rules.height, elevation, terrain, flags, biomeRng);
  const regionLayer = buildRegionLayer(rules.width, rules.height, biomeLayer.biome, flags, regionRng);
  const routes = buildRoutes(rules.width, terrain, flags, regionLayer.regions, hydrology.crossings, routeRng);
  const placements = buildPlacements(
    rules.width,
    rules.height,
    flags,
    regionLayer.regions,
    spawnRng,
    resourceRng,
    poiRng,
    enemyRng,
    bossRng,
  );
  const layers: GenerationLayers = {
    elevation,
    moisture: biomeLayer.moisture,
    terrain,
    biome: biomeLayer.biome,
    flags,
    regionByCell: regionLayer.regionByCell,
  };
  const validationView = {
    width: rules.width,
    height: rules.height,
    terrain: layers.terrain,
    biome: layers.biome,
    flags: layers.flags,
    regionByCell: layers.regionByCell,
    regions: regionLayer.regions,
    routes,
    resources: placements.resources,
    pois: placements.pois,
    spawns: placements.spawns,
    objective: placements.objective,
    boss: placements.boss,
  };
  const quality = scoreBattlefield(validationView);
  const validation = validateWorld(validationView);
  const withoutHashes: Omit<GeneratedWorld, 'gameplayHash' | 'visualVariant'> = {
    identity,
    generationAttempt,
    width: rules.width,
    height: rules.height,
    ...layers,
    regions: regionLayer.regions,
    routes,
    resources: placements.resources,
    pois: placements.pois,
    spawns: placements.spawns,
    objective: placements.objective,
    boss: placements.boss,
    quality,
    validation,
  };
  const gameplayHash = computeGameplayHash(withoutHashes);
  const visualVariant = createVisualVariant(identity.masterSeed, rules.rulesetVersion, generationAttempt, options.visualSalt ?? 'visual-v1');
  return { ...withoutHashes, gameplayHash, visualVariant };
}

export function generateWorld(
  blockHeight: number,
  rules: WorldGenerationRules = M02_STANDARD_RULES,
  options: WorldGenerationOptions = {},
): GeneratedWorld {
  let bestValid: GeneratedWorld | undefined;
  let lastWorld: GeneratedWorld | undefined;
  for (let attempt = 0; attempt < rules.maxGenerationAttempts; attempt += 1) {
    const world = generateWorldAttempt(blockHeight, rules, attempt, options);
    lastWorld = world;
    if (!world.validation.valid) continue;
    if (!bestValid || world.quality.score > bestValid.quality.score) bestValid = world;
    if (world.quality.score >= rules.minimumQualityScore) return world;
  }
  if (bestValid) return bestValid;
  const failures = lastWorld?.validation.hardFailures.join(' | ') ?? 'No generation attempt executed.';
  throw new Error(`Unable to generate a valid battlefield for block ${blockHeight}. ${failures}`);
}
