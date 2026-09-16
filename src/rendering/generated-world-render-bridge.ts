import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import { SurfaceType, type TerrainState } from '../simulation/terrain-state';
import { VisibilityLevel } from '../simulation/visibility-state';
import {
  BiomeType,
  TerrainType,
  WorldCellFlag,
  type GeneratedWorld,
  type GridPoint,
  type StrategicRoute,
} from '../world/world-definition';
import { createEnvironmentVisualLayout, type EnvironmentVisualProp } from './environment-visual-layout';

interface RowRun {
  row: number;
  startColumn: number;
  endColumn: number;
}

interface MeshBuffers {
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
}

type PrimitiveType = 'box' | 'plane' | 'cylinder' | 'capsule' | 'sphere';
type RoadLayer = 'SHOULDER' | 'CORE' | 'RUT_LEFT' | 'RUT_RIGHT';

const ORTHOGONAL_NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(0.0001, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hashByte(x: number, z: number, salt: number): number {
  let value = Math.imul(x + 1, 0x45d9f3b) ^ Math.imul(z + 1, 0x119de1f3) ^ Math.imul(salt + 1, 0x27d4eb2d);
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b);
  value ^= value >>> 16;
  return value & 0xff;
}

function createMaterial(color: pc.Color, opacity = 1, gloss = 0.16): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.metalness = 0;
  material.gloss = gloss;
  material.opacity = opacity;
  if (opacity < 1) {
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
    material.cull = pc.CULLFACE_NONE;
  }
  material.update();
  return material;
}

function createVertexMaterial(
  name: string,
  transparent = false,
  unlit = false,
  gloss = 0.12,
): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.name = name;
  material.diffuse = new pc.Color(1, 1, 1);
  material.diffuseVertexColor = true;
  material.metalness = 0;
  material.gloss = gloss;
  if (unlit) {
    material.useLighting = false;
    material.emissive = new pc.Color(1, 1, 1);
    material.emissiveVertexColor = true;
  }
  if (transparent) {
    material.opacityVertexColor = true;
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
  }
  if (transparent || name.startsWith('ENV_ROAD')) material.cull = pc.CULLFACE_NONE;
  material.update();
  return material;
}

function addPrimitive(
  app: pc.Application,
  type: PrimitiveType,
  name: string,
  position: pc.Vec3,
  scale: pc.Vec3,
  material: pc.Material,
  rotation?: pc.Vec3,
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type, material, castShadows: false, receiveShadows: false });
  entity.setPosition(position);
  entity.setLocalScale(scale);
  if (rotation) entity.setEulerAngles(rotation);
  app.root.addChild(entity);
  return entity;
}

function addChildPrimitive(
  parent: pc.Entity,
  type: Exclude<PrimitiveType, 'plane'>,
  name: string,
  position: pc.Vec3,
  scale: pc.Vec3,
  material: pc.Material,
  rotation?: pc.Vec3,
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type, material, castShadows: false, receiveShadows: false });
  entity.setLocalPosition(position);
  entity.setLocalScale(scale);
  if (rotation) entity.setLocalEulerAngles(rotation);
  parent.addChild(entity);
  return entity;
}

function originMetres(cellCount: number): number {
  return -Math.floor((cellCount * WORLD_UNITS_PER_METER) / 2) / WORLD_UNITS_PER_METER;
}

function inBounds(world: GeneratedWorld, x: number, z: number): boolean {
  return x >= 0 && z >= 0 && x < world.width && z < world.height;
}

function cellIndex(world: GeneratedWorld, x: number, z: number): number {
  return z * world.width + x;
}

function biomeColor(biome: BiomeType): readonly [number, number, number] {
  // Keep biome identity readable, but hold the palettes close enough that
  // interpolation reads as natural ground variation rather than map-sized blocks.
  if (biome === BiomeType.WOODLAND) return [43, 68, 39];
  if (biome === BiomeType.HIGHLANDS) return [83, 78, 62];
  return [58, 82, 50];
}

function valueNoise(world: GeneratedWorld, x: number, z: number, cellSize: number, salt: number): number {
  const latticeX = Math.floor(x / cellSize);
  const latticeZ = Math.floor(z / cellSize);
  const blendX = smoothstep(0, 1, (x / cellSize) - latticeX);
  const blendZ = smoothstep(0, 1, (z / cellSize) - latticeZ);
  const topLeft = hashByte(latticeX, latticeZ, world.identity.masterSeed + salt) / 255;
  const topRight = hashByte(latticeX + 1, latticeZ, world.identity.masterSeed + salt) / 255;
  const bottomLeft = hashByte(latticeX, latticeZ + 1, world.identity.masterSeed + salt) / 255;
  const bottomRight = hashByte(latticeX + 1, latticeZ + 1, world.identity.masterSeed + salt) / 255;
  const top = topLeft + (topRight - topLeft) * blendX;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * blendX;
  return top + (bottom - top) * blendZ;
}

function settlementWear(world: GeneratedWorld, x: number, z: number): number {
  let wear = 0;
  const sites = [
    ...world.spawns.map((spawn) => ({ cell: spawn.cell, radius: 5.2 })),
    ...world.pois.filter((poi) => poi.type === 'VILLAGE').map((poi) => ({ cell: poi.cell, radius: 3.5 })),
  ];
  for (const site of sites) {
    const distance = Math.hypot(x - site.cell.x - 0.5, z - site.cell.z - 0.5);
    wear = Math.max(wear, 1 - Math.min(1, distance / site.radius));
  }
  return wear;
}

function sampledTerrain(world: GeneratedWorld, x: number, z: number): {
  red: number;
  green: number;
  blue: number;
  elevation: number;
  moisture: number;
  woodlandWeight: number;
  highlandWeight: number;
} {
  let red = 0;
  let green = 0;
  let blue = 0;
  let elevation = 0;
  let moisture = 0;
  let woodlandWeight = 0;
  let highlandWeight = 0;
  let weightTotal = 0;
  const centreX = Math.max(0, Math.min(world.width - 1, Math.round(x)));
  const centreZ = Math.max(0, Math.min(world.height - 1, Math.round(z)));

  // A wider, distance-weighted presentation sample removes abrupt categorical
  // biome steps without touching authoritative world-generation cells.
  for (let dz = -3; dz <= 3; dz += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      const sampleX = centreX + dx;
      const sampleZ = centreZ + dz;
      if (!inBounds(world, sampleX, sampleZ)) continue;
      const index = cellIndex(world, sampleX, sampleZ);
      const distanceSquared = dx * dx + dz * dz;
      const weight = (dx === 0 && dz === 0 ? 1.7 : 1) / (1 + distanceSquared * 0.62);
      const biome = world.biome[index] as BiomeType;
      const [r, g, b] = biomeColor(biome);
      red += r * weight;
      green += g * weight;
      blue += b * weight;
      elevation += (world.elevation[index] ?? 128) * weight;
      moisture += (world.moisture[index] ?? 128) * weight;
      if (biome === BiomeType.WOODLAND) woodlandWeight += weight;
      if (biome === BiomeType.HIGHLANDS) highlandWeight += weight;
      weightTotal += weight;
    }
  }

  const safeWeight = Math.max(1, weightTotal);
  return {
    red: red / safeWeight,
    green: green / safeWeight,
    blue: blue / safeWeight,
    elevation: elevation / safeWeight,
    moisture: moisture / safeWeight,
    woodlandWeight: woodlandWeight / safeWeight,
    highlandWeight: highlandWeight / safeWeight,
  };
}

function terrainColorAt(world: GeneratedWorld, x: number, z: number): readonly [number, number, number, number] {
  const sample = sampledTerrain(world, x, z);
  const lowFrequency = valueNoise(world, x, z, 10, 5) - 0.5;
  const midFrequency = valueNoise(world, x, z, 4.5, 29) - 0.5;
  const fineFrequency = (hashByte(Math.floor(x * 1.2), Math.floor(z * 1.2), world.identity.masterSeed + 71) / 255) - 0.5;
  const heightShade = ((sample.elevation / 255) - 0.5) * 14;
  const moistureShade = ((sample.moisture / 255) - 0.5) * 8;
  const variation = lowFrequency * 14 + midFrequency * 7 + fineFrequency * 2;

  const wear = settlementWear(world, x, z);
  const nearestX = Math.max(0, Math.min(world.width - 1, Math.round(x)));
  const nearestZ = Math.max(0, Math.min(world.height - 1, Math.round(z)));
  const route = ((world.flags[cellIndex(world, nearestX, nearestZ)] ?? 0) & WorldCellFlag.ROUTE) !== 0 ? 0.26 : 0;
  const earth = Math.max(wear * 0.58, route);

  return [
    clampByte(sample.red + heightShade + variation - moistureShade * 0.18 + sample.highlandWeight * 5 + earth * 14),
    clampByte(sample.green + heightShade * 0.42 + variation + moistureShade - sample.woodlandWeight * 2 - earth * 8),
    clampByte(sample.blue + heightShade * 0.22 + variation * 0.42 - moistureShade * 0.12 - sample.highlandWeight * 2 - earth * 6),
    255,
  ];
}

function terrainVisualHeightAt(world: GeneratedWorld, x: number, z: number): number {
  const sample = sampledTerrain(world, x, z);
  const normalized = (sample.elevation - 110) / 145;
  const biomeLift = sample.highlandWeight * 0.004 + sample.woodlandWeight * 0.0015;
  const micro = ((hashByte(Math.round(x), Math.round(z), world.identity.masterSeed + 401) / 255) - 0.5) * 0.0018;
  return Math.max(-0.003, Math.min(0.016, normalized * 0.011 + biomeLift + micro));
}

function sameBiomeNeighborCount(world: GeneratedWorld, x: number, z: number, biome: BiomeType): number {
  let count = 0;
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dz === 0) continue;
      const nx = x + dx;
      const nz = z + dz;
      if (!inBounds(world, nx, nz)) continue;
      const index = cellIndex(world, nx, nz);
      if (world.terrain[index] === TerrainType.GROUND && world.biome[index] === biome) count += 1;
    }
  }
  return count;
}

function touchesWater(world: GeneratedWorld, x: number, z: number): boolean {
  for (const [dx, dz] of ORTHOGONAL_NEIGHBORS) {
    const nx = x + dx;
    const nz = z + dz;
    if (!inBounds(world, nx, nz)) continue;
    if (world.terrain[cellIndex(world, nx, nz)] === TerrainType.WATER) return true;
  }
  return false;
}

function isWater(world: GeneratedWorld, x: number, z: number): boolean {
  return inBounds(world, x, z) && world.terrain[cellIndex(world, x, z)] === TerrainType.WATER;
}

function waterWeightAtCorner(world: GeneratedWorld, x: number, z: number): number {
  let wet = 0;
  let samples = 0;
  for (let dz = -1; dz <= 0; dz += 1) {
    for (let dx = -1; dx <= 0; dx += 1) {
      const cellX = x + dx;
      const cellZ = z + dz;
      if (!inBounds(world, cellX, cellZ)) continue;
      samples += 1;
      if (isWater(world, cellX, cellZ)) wet += 1;
    }
  }
  return samples > 0 ? wet / samples : 0;
}

function addMeshEntity(
  app: pc.Application,
  name: string,
  mesh: pc.Mesh,
  material: pc.Material,
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', {
    meshInstances: [new pc.MeshInstance(mesh, material)],
    castShadows: false,
    receiveShadows: false,
  });
  app.root.addChild(entity);
  return entity;
}

function createMesh(app: pc.Application, buffers: MeshBuffers): pc.Mesh {
  const mesh = new pc.Mesh(app.graphicsDevice);
  mesh.setPositions(buffers.positions);
  mesh.setNormals(buffers.normals);
  mesh.setColors32(buffers.colors);
  mesh.setIndices(buffers.indices);
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  return mesh;
}

function buildGroundMesh(app: pc.Application, world: GeneratedWorld, originX: number, originZ: number): pc.Mesh {
  const buffers: MeshBuffers = { positions: [], normals: [], colors: [], indices: [] };
  const step = 1;
  const columns = world.width + 1;
  const rows = world.height + 1;

  for (let row = 0; row < rows; row += 1) {
    const cellZ = Math.min(world.height, row * step);
    for (let column = 0; column < columns; column += 1) {
      const cellX = Math.min(world.width, column * step);
      const sampleX = cellX - 0.5;
      const sampleZ = cellZ - 0.5;
      const y = terrainVisualHeightAt(world, sampleX, sampleZ);
      const left = terrainVisualHeightAt(world, sampleX - 1, sampleZ);
      const right = terrainVisualHeightAt(world, sampleX + 1, sampleZ);
      const top = terrainVisualHeightAt(world, sampleX, sampleZ - 1);
      const bottom = terrainVisualHeightAt(world, sampleX, sampleZ + 1);
      const normalX = left - right;
      const normalZ = top - bottom;
      const normalY = 2;
      const normalLength = Math.sqrt(normalX * normalX + normalY * normalY + normalZ * normalZ);

      buffers.positions.push(originX + cellX, y, originZ + cellZ);
      buffers.normals.push(normalX / normalLength, normalY / normalLength, normalZ / normalLength);
      buffers.colors.push(...terrainColorAt(world, sampleX, sampleZ));
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const topLeft = row * columns + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + columns;
      const bottomRight = bottomLeft + 1;
      buffers.indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
    }
  }

  return createMesh(app, buffers);
}

function buildShorelineMesh(app: pc.Application, world: GeneratedWorld, originX: number, originZ: number): pc.Mesh {
  const buffers: MeshBuffers = { positions: [], normals: [], colors: [], indices: [] };

  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (isWater(world, x, z) || !touchesWater(world, x, z)) continue;
      const base = buffers.positions.length / 3;
      const corners = [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]] as const;
      for (const [cornerX, cornerZ] of corners) {
        const wet = waterWeightAtCorner(world, cornerX, cornerZ);
        const alpha = smoothstep(0.05, 0.72, wet);
        const variation = hashByte(cornerX, cornerZ, world.identity.masterSeed + 509) / 255;
        buffers.positions.push(originX + cornerX, 0.020, originZ + cornerZ);
        buffers.normals.push(0, 1, 0);
        buffers.colors.push(
          clampByte(72 + variation * 14),
          clampByte(65 + variation * 12),
          clampByte(42 + variation * 8),
          clampByte(alpha * 210),
        );
      }
      buffers.indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }

  return createMesh(app, buffers);
}

function buildWaterMesh(app: pc.Application, world: GeneratedWorld, originX: number, originZ: number): pc.Mesh {
  const buffers: MeshBuffers = { positions: [], normals: [], colors: [], indices: [] };

  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (!isWater(world, x, z) && !touchesWater(world, x, z)) continue;
      const alphas = [
        waterWeightAtCorner(world, x, z),
        waterWeightAtCorner(world, x + 1, z),
        waterWeightAtCorner(world, x, z + 1),
        waterWeightAtCorner(world, x + 1, z + 1),
      ];
      if (Math.max(...alphas) <= 0) continue;

      const base = buffers.positions.length / 3;
      const corners = [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]] as const;

      for (let corner = 0; corner < corners.length; corner += 1) {
        const [cornerX, cornerZ] = corners[corner]!;
        const alpha = smoothstep(0.1, 0.9, alphas[corner] ?? 0);
        const coarse = valueNoise(world, cornerX, cornerZ, 4, 97);
        const fine = hashByte(cornerX, cornerZ, world.identity.masterSeed + 103) / 255;
        const depth = alphas[corner] ?? 0;
        buffers.positions.push(originX + cornerX, 0.028, originZ + cornerZ);
        buffers.normals.push(0, 1, 0);
        buffers.colors.push(
          clampByte(38 - depth * 23 + coarse * 7),
          clampByte(75 - depth * 23 + coarse * 13 + fine * 4),
          clampByte(78 - depth * 7 + coarse * 17 + fine * 5),
          clampByte(alpha * 218),
        );
      }
      buffers.indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }

  return createMesh(app, buffers);
}

function buildSettlementApronMesh(
  app: pc.Application,
  world: GeneratedWorld,
  originX: number,
  originZ: number,
): pc.Mesh {
  const buffers: MeshBuffers = { positions: [], normals: [], colors: [], indices: [] };
  const sites: { cell: GridPoint; radius: number; salt: number }[] = [
    ...world.spawns.map((spawn, index) => ({ cell: spawn.cell, radius: 3.65, salt: 601 + index * 31 })),
    ...world.pois
      .filter((poi) => poi.type === 'VILLAGE')
      .map((poi, index) => ({ cell: poi.cell, radius: 2.3, salt: 701 + index * 23 })),
  ];

  for (const site of sites) {
    const segments = 20;
    const ringScales = [0.34, 0.7, 1] as const;
    const centre = buffers.positions.length / 3;
    const centreX = originX + site.cell.x + 0.5;
    const centreZ = originZ + site.cell.z + 0.5;
    buffers.positions.push(centreX, 0.019, centreZ);
    buffers.normals.push(0, 1, 0);
    buffers.colors.push(97, 80, 59, 82);

    const ringBases: number[] = [];
    for (let ringIndex = 0; ringIndex < ringScales.length; ringIndex += 1) {
      const ringBase = buffers.positions.length / 3;
      ringBases.push(ringBase);
      const ringScale = ringScales[ringIndex]!;
      const alpha = ringIndex === 0 ? 64 : ringIndex === 1 ? 28 : 0;

      for (let segment = 0; segment < segments; segment += 1) {
        const angle = (segment / segments) * Math.PI * 2;
        const jitter = 0.94 + (hashByte(site.cell.x + segment, site.cell.z + ringIndex * 7, site.salt) / 255) * 0.12;
        const radius = site.radius * ringScale * jitter;
        const variation = hashByte(site.cell.x + ringIndex * 11, site.cell.z + segment, site.salt + 13) / 255;
        buffers.positions.push(
          centreX + Math.cos(angle) * radius,
          0.018 + ringIndex * 0.0002,
          centreZ + Math.sin(angle) * radius * 0.84,
        );
        buffers.normals.push(0, 1, 0);
        buffers.colors.push(
          clampByte(92 + variation * 7),
          clampByte(77 + variation * 6),
          clampByte(55 + variation * 5),
          alpha,
        );
      }
    }

    const innerBase = ringBases[0]!;
    for (let segment = 0; segment < segments; segment += 1) {
      const current = innerBase + segment;
      const next = innerBase + ((segment + 1) % segments);
      buffers.indices.push(centre, current, next);
    }

    for (let ringIndex = 0; ringIndex < ringBases.length - 1; ringIndex += 1) {
      const inner = ringBases[ringIndex]!;
      const outer = ringBases[ringIndex + 1]!;
      for (let segment = 0; segment < segments; segment += 1) {
        const nextSegment = (segment + 1) % segments;
        const a = inner + segment;
        const b = inner + nextSegment;
        const c = outer + segment;
        const d = outer + nextSegment;
        buffers.indices.push(a, c, b, b, c, d);
      }
    }
  }

  return createMesh(app, buffers);
}

function normalizedRoutePoints(route: StrategicRoute): readonly GridPoint[] {
  const points: GridPoint[] = [];
  for (const point of route.path) {
    const previous = points[points.length - 1];
    if (previous && previous.x === point.x && previous.z === point.z) continue;
    points.push(point);
  }
  return points;
}

function routeNormal(points: readonly GridPoint[], index: number): readonly [number, number] {
  const current = points[index]!;
  const previous = points[Math.max(0, index - 1)]!;
  const next = points[Math.min(points.length - 1, index + 1)]!;
  let dx = next.x - previous.x;
  let dz = next.z - previous.z;
  if (Math.abs(dx) + Math.abs(dz) < 0.001) {
    dx = current.x - previous.x;
    dz = current.z - previous.z;
  }
  const length = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
  return [-dz / length, dx / length];
}

function roadCrossSection(layer: RoadLayer, halfWidth: number): readonly { offset: number; shade: number; alpha: number }[] {
  if (layer === 'SHOULDER') {
    return [
      { offset: -halfWidth, shade: 0.84, alpha: 0 },
      { offset: -halfWidth * 0.6, shade: 0.93, alpha: 72 },
      { offset: halfWidth * 0.6, shade: 0.96, alpha: 72 },
      { offset: halfWidth, shade: 0.84, alpha: 0 },
    ];
  }
  if (layer === 'CORE') {
    return [
      { offset: -halfWidth, shade: 0.82, alpha: 132 },
      { offset: -halfWidth * 0.45, shade: 1.0, alpha: 224 },
      { offset: halfWidth * 0.45, shade: 0.97, alpha: 224 },
      { offset: halfWidth, shade: 0.80, alpha: 132 },
    ];
  }
  return [
    { offset: -halfWidth, shade: 0.76, alpha: 0 },
    { offset: 0, shade: 0.67, alpha: 38 },
    { offset: halfWidth, shade: 0.76, alpha: 0 },
  ];
}

function buildRoadMesh(
  app: pc.Application,
  world: GeneratedWorld,
  originX: number,
  originZ: number,
  layer: RoadLayer,
): pc.Mesh {
  const buffers: MeshBuffers = { positions: [], normals: [], colors: [], indices: [] };
  const baseColor = layer === 'SHOULDER'
  ? [72, 67, 50] as const
  : layer === 'CORE'
    ? [96, 76, 50] as const
    : [54, 47, 35] as const;

  for (const route of world.routes) {
    const points = normalizedRoutePoints(route);
    if (points.length < 2) continue;
    const coreHalf = 0.5 + Math.min(0.2, Math.max(1, route.widthCells) * 0.07);
    const halfWidth = layer === 'SHOULDER' ? coreHalf + 0.36 : layer === 'CORE' ? coreHalf : 0.075;
    const section = roadCrossSection(layer, halfWidth);
    const routeBase = buffers.positions.length / 3;

    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex]!;
      const [normalX, normalZ] = routeNormal(points, pointIndex);
      const approach = Math.min(pointIndex, points.length - 1 - pointIndex) < 3 ? 1.14 : 1;
      const widthScale = (0.91 + (hashByte(point.x, point.z, world.identity.masterSeed + 127) / 255) * 0.18) * approach;
      const centreWobble = ((hashByte(point.x, point.z, world.identity.masterSeed + 129) / 255) - 0.5) * 0.1;
      const rutShift = layer === 'RUT_LEFT' ? -coreHalf * 0.43 : layer === 'RUT_RIGHT' ? coreHalf * 0.43 : 0;
      const variation = (hashByte(point.x, point.z, world.identity.masterSeed + 131) / 255 - 0.5) * 0.08;

      for (const cross of section) {
        const offset = cross.offset * widthScale + rutShift * widthScale + centreWobble;
        buffers.positions.push(
          originX + point.x + 0.5 + normalX * offset,
          layer === 'SHOULDER' ? 0.020 : layer === 'CORE' ? 0.025 : 0.029,
          originZ + point.z + 0.5 + normalZ * offset,
        );
        buffers.normals.push(0, 1, 0);
        buffers.colors.push(
          clampByte(baseColor[0] * (cross.shade + variation)),
          clampByte(baseColor[1] * (cross.shade + variation)),
          clampByte(baseColor[2] * (cross.shade + variation)),
          cross.alpha,
        );
      }
    }

    for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
      for (let band = 0; band < section.length - 1; band += 1) {
        const current = routeBase + pointIndex * section.length + band;
        const currentNext = current + 1;
        const next = current + section.length;
        const nextNext = next + 1;
        buffers.indices.push(current, next, currentNext, currentNext, next, nextNext);
      }
    }
  }

  return createMesh(app, buffers);
}

function runsForGrid(width: number, height: number, predicate: (index: number) => boolean): RowRun[] {
  const runs: RowRun[] = [];
  for (let row = 0; row < height; row += 1) {
    let runStart = -1;
    for (let column = 0; column <= width; column += 1) {
      const matches = column < width && predicate(row * width + column);
      if (matches && runStart < 0) runStart = column;
      if ((!matches || column === width) && runStart >= 0) {
        runs.push({ row, startColumn: runStart, endColumn: column - 1 });
        runStart = -1;
      }
    }
  }
  return runs;
}

function propBaseY(kind: EnvironmentVisualProp['kind']): number {
  if (kind === 'RIVER_REED') return 0.05;
  if (kind === 'RIVER_BANK_STONE') return 0.036;
  if (kind === 'ROUTE_EDGE_POST') return 0.032;
  return 0.025;
}

export class GeneratedWorldRenderBridge {
  private readonly entities: pc.Entity[] = [];
  private readonly fogManagedRoots: { root: pc.Entity; cellIndex: number }[] = [];
  private readonly iceEntities: pc.Entity[] = [];
  private readonly meshes: pc.Mesh[] = [];

  private readonly groundMaterial = createVertexMaterial('ENV_GROUND', false, false, 0.055);
  private readonly shorelineMaterial = createVertexMaterial('ENV_SHORELINE', true, false, 0.04);
  private readonly settlementApronMaterial = createVertexMaterial('ENV_SETTLEMENT_APRON', true, false, 0.04);
  private readonly waterMaterial = createVertexMaterial('ENV_WATER', true, false, 0.52);
  private readonly roadShoulderMaterial = createVertexMaterial('ENV_ROAD_SHOULDER', true);
  private readonly roadCoreMaterial = createVertexMaterial('ENV_ROAD_CORE', true);
  private readonly roadRutMaterial = createVertexMaterial('ENV_ROAD_RUT', true);

  private readonly crossingMaterial = createMaterial(new pc.Color(0.31, 0.22, 0.13), 1, 0.1);
  private readonly bridgeBeamMaterial = createMaterial(new pc.Color(0.19, 0.12, 0.065), 1, 0.08);
  private readonly bridgeStoneMaterial = createMaterial(new pc.Color(0.34, 0.33, 0.28), 1, 0.08);
  private readonly iceMaterial = createMaterial(new pc.Color(0.53, 0.79, 0.86), 0.8, 0.48);

  private readonly trunkMaterial = createMaterial(new pc.Color(0.14, 0.08, 0.042));
  private readonly canopyDarkMaterial = createMaterial(new pc.Color(0.028, 0.13, 0.043), 1, 0.09);
  private readonly canopyMidMaterial = createMaterial(new pc.Color(0.048, 0.20, 0.065), 1, 0.09);
  private readonly canopyLightMaterial = createMaterial(new pc.Color(0.085, 0.285, 0.095), 1, 0.09);
  private readonly forestShadowMaterial = createMaterial(new pc.Color(0.02, 0.065, 0.025), 0.17, 0.02);
  private readonly understoryMaterial = createMaterial(new pc.Color(0.105, 0.23, 0.075));

  private readonly rockDarkMaterial = createMaterial(new pc.Color(0.26, 0.26, 0.235));
  private readonly rockMidMaterial = createMaterial(new pc.Color(0.36, 0.35, 0.30));
  private readonly rockLightMaterial = createMaterial(new pc.Color(0.46, 0.43, 0.35));
  private readonly dryGrassMaterial = createMaterial(new pc.Color(0.40, 0.36, 0.17));
  private readonly scrubMaterial = createMaterial(new pc.Color(0.17, 0.29, 0.105));
  private readonly reedMaterial = createMaterial(new pc.Color(0.25, 0.43, 0.13));
  private readonly routePostMaterial = createMaterial(new pc.Color(0.23, 0.14, 0.07));
  private readonly supplyMaterial = createMaterial(new pc.Color(0.31, 0.19, 0.095));
  private readonly metalBandMaterial = createMaterial(new pc.Color(0.28, 0.29, 0.27));

  private lastIceCount = -1;
  private lastNavVersion = -1;

  constructor(
    private readonly app: pc.Application,
    private readonly world: GeneratedWorld,
    private readonly terrain: TerrainState,
  ) {
    this.renderTerrainArt();
    this.renderForestMasses();
    this.renderHighlandMasses();
    this.renderCuratedDressing();
  }

  sync(navVersion: number, iceCount: number, visibility?: Uint8Array): void {
    if (visibility) {
      for (const presentation of this.fogManagedRoots) {
        presentation.root.enabled = (visibility[presentation.cellIndex] ?? VisibilityLevel.UNEXPLORED) !== VisibilityLevel.UNEXPLORED;
      }
    }
    if (navVersion === this.lastNavVersion && iceCount === this.lastIceCount) return;
    this.lastNavVersion = navVersion;
    this.lastIceCount = iceCount;
    this.rebuildIceOverlay();
  }

  destroy(): void {
    for (const entity of this.iceEntities) entity.destroy();
    for (const entity of this.entities) entity.destroy();
    for (const mesh of this.meshes) mesh.destroy();
    this.iceEntities.length = 0;
    this.entities.length = 0;
    this.meshes.length = 0;

    for (const material of [
      this.groundMaterial,
      this.shorelineMaterial,
      this.settlementApronMaterial,
      this.waterMaterial,
      this.roadShoulderMaterial,
      this.roadCoreMaterial,
      this.roadRutMaterial,
      this.crossingMaterial,
      this.bridgeBeamMaterial,
      this.bridgeStoneMaterial,
      this.iceMaterial,
      this.trunkMaterial,
      this.canopyDarkMaterial,
      this.canopyMidMaterial,
      this.canopyLightMaterial,
      this.forestShadowMaterial,
      this.understoryMaterial,
      this.rockDarkMaterial,
      this.rockMidMaterial,
      this.rockLightMaterial,
      this.dryGrassMaterial,
      this.scrubMaterial,
      this.reedMaterial,
      this.routePostMaterial,
      this.supplyMaterial,
      this.metalBandMaterial,
    ]) material.destroy();
  }

  private renderTerrainArt(): void {
    const originX = originMetres(this.world.width);
    const originZ = originMetres(this.world.height);

    const groundMesh = buildGroundMesh(this.app, this.world, originX, originZ);
    const shorelineMesh = buildShorelineMesh(this.app, this.world, originX, originZ);
    const settlementApronMesh = buildSettlementApronMesh(this.app, this.world, originX, originZ);
    const waterMesh = buildWaterMesh(this.app, this.world, originX, originZ);
    const roadShoulderMesh = buildRoadMesh(this.app, this.world, originX, originZ, 'SHOULDER');
    const roadCoreMesh = buildRoadMesh(this.app, this.world, originX, originZ, 'CORE');
    const roadRutLeftMesh = buildRoadMesh(this.app, this.world, originX, originZ, 'RUT_LEFT');
    const roadRutRightMesh = buildRoadMesh(this.app, this.world, originX, originZ, 'RUT_RIGHT');

    this.meshes.push(
      groundMesh,
      shorelineMesh,
      settlementApronMesh,
      waterMesh,
      roadShoulderMesh,
      roadCoreMesh,
      roadRutLeftMesh,
      roadRutRightMesh,
    );
    this.entities.push(
      addMeshEntity(this.app, 'Environment Ground Mesh', groundMesh, this.groundMaterial),
      addMeshEntity(this.app, 'Environment Shoreline Mesh', shorelineMesh, this.shorelineMaterial),
      addMeshEntity(this.app, 'Environment Settlement Apron Mesh', settlementApronMesh, this.settlementApronMaterial),
      addMeshEntity(this.app, 'Environment Water Mesh', waterMesh, this.waterMaterial),
      addMeshEntity(this.app, 'Environment Road Shoulder Mesh', roadShoulderMesh, this.roadShoulderMaterial),
      addMeshEntity(this.app, 'Environment Road Core Mesh', roadCoreMesh, this.roadCoreMaterial),
      addMeshEntity(this.app, 'Environment Road Left Rut Mesh', roadRutLeftMesh, this.roadRutMaterial),
      addMeshEntity(this.app, 'Environment Road Right Rut Mesh', roadRutRightMesh, this.roadRutMaterial),
    );

    this.renderCrossings(originX, originZ);
  }

  private renderCrossings(originX: number, originZ: number): void {
    for (const run of runsForGrid(
      this.world.width,
      this.world.height,
      (index) => this.world.terrain[index] === TerrainType.CROSSING,
    )) {
      const widthCells = run.endColumn - run.startColumn + 1;
      const centreX = originX + run.startColumn + widthCells / 2;
      const centreZ = originZ + run.row + 0.5;

      this.entities.push(addPrimitive(
        this.app,
        'box',
        `Bridge Deck ${run.row}:${run.startColumn}-${run.endColumn}`,
        new pc.Vec3(centreX, 0.06, centreZ),
        new pc.Vec3(widthCells + 0.1, 0.095, 1.18),
        this.crossingMaterial,
      ));

      this.entities.push(
        addPrimitive(
          this.app,
          'box',
          'Bridge Beam North',
          new pc.Vec3(centreX, 0.105, centreZ - 0.54),
          new pc.Vec3(widthCells + 0.28, 0.12, 0.09),
          this.bridgeBeamMaterial,
        ),
        addPrimitive(
          this.app,
          'box',
          'Bridge Beam South',
          new pc.Vec3(centreX, 0.105, centreZ + 0.54),
          new pc.Vec3(widthCells + 0.28, 0.12, 0.09),
          this.bridgeBeamMaterial,
        ),
        addPrimitive(
          this.app,
          'box',
          'Bridge Abutment West',
          new pc.Vec3(centreX - widthCells / 2 - 0.12, 0.075, centreZ),
          new pc.Vec3(0.38, 0.16, 1.36),
          this.bridgeStoneMaterial,
        ),
        addPrimitive(
          this.app,
          'box',
          'Bridge Abutment East',
          new pc.Vec3(centreX + widthCells / 2 + 0.12, 0.075, centreZ),
          new pc.Vec3(0.38, 0.16, 1.36),
          this.bridgeStoneMaterial,
        ),
      );

      const seamCount = Math.max(2, Math.floor(widthCells * 2));
      for (let seam = 1; seam < seamCount; seam += 1) {
        const x = centreX - widthCells / 2 + (seam / seamCount) * widthCells;
        this.entities.push(addPrimitive(
          this.app,
          'box',
          'Bridge Plank Seam',
          new pc.Vec3(x, 0.113, centreZ),
          new pc.Vec3(0.018, 0.012, 1.02),
          this.bridgeBeamMaterial,
        ));
      }
    }
  }

  private isNearStrategicSite(x: number, z: number, radius: number): boolean {
    const sites: GridPoint[] = [
      ...this.world.spawns.map((spawn) => spawn.cell),
      ...this.world.resources.map((resource) => resource.cell),
      ...this.world.pois.map((poi) => poi.cell),
      this.world.objective.cell,
      this.world.boss.cell,
    ];
    return sites.some((site) => Math.abs(site.x - x) <= radius && Math.abs(site.z - z) <= radius);
  }

  private renderForestMasses(): void {
    const originX = originMetres(this.world.width);
    const originZ = originMetres(this.world.height);
    let groveCount = 0;
    let edgeCount = 0;

    for (let z = 2; z < this.world.height - 2; z += 2) {
      const stagger = (Math.floor(z / 2) & 1) === 0 ? 0 : 1;
      for (let x = 2 + stagger; x < this.world.width - 2; x += 2) {
        if (groveCount >= 72 && edgeCount >= 24) return;
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND || this.world.biome[index] !== BiomeType.WOODLAND) continue;
        if (this.isNearStrategicSite(x, z, 2)) continue;

        const neighbors = sameBiomeNeighborCount(this.world, x, z, BiomeType.WOODLAND);
        const variant = hashByte(x, z, this.world.identity.masterSeed + 211);
        const dense = neighbors >= 6;
        if (dense && (variant > 218 || groveCount >= 72)) continue;
        if (!dense && (neighbors < 3 || variant > 154 || edgeCount >= 24)) continue;

        const jitterX = ((hashByte(x, z, 223) / 255) - 0.5) * 1.05;
        const jitterZ = ((hashByte(x, z, 227) / 255) - 0.5) * 1.05;
        const scale = (dense ? 1.12 : 0.82) + (hashByte(x, z, 229) / 255) * (dense ? 0.34 : 0.22);
        const root = new pc.Entity(dense ? `Woodland Grove ${x},${z}` : `Woodland Edge ${x},${z}`);
        root.setPosition(originX + x + 0.5 + jitterX, 0.022, originZ + z + 0.5 + jitterZ);
        root.setEulerAngles(0, variant * 1.41, 0);
        this.app.root.addChild(root);
        this.entities.push(root);
        this.fogManagedRoots.push({ root, cellIndex: index });
        this.populateForestMass(root, variant, scale, dense);
        if (dense) groveCount += 1;
        else edgeCount += 1;
      }
    }
  }

  private populateForestMass(root: pc.Entity, variant: number, scale: number, dense: boolean): void {
    addChildPrimitive(
      root,
      'cylinder',
      'Forest Contact Shadow',
      new pc.Vec3(0, 0.016, 0),
      new pc.Vec3((dense ? 2.7 : 1.7) * scale, 0.016, (dense ? 2.0 : 1.2) * scale),
      this.forestShadowMaterial,
    );

    const lobes = dense ? 10 + (variant % 3) : 5 + (variant % 2);
    for (let index = 0; index < lobes; index += 1) {
      const angle = index * 2.39996 + variant * 0.031;
      const ring = dense
        ? index < 2 ? 0.18 : index < 6 ? 0.62 : 0.96
        : index < 2 ? 0.32 : 0.68;
      const x = Math.cos(angle) * ring * scale;
      const z = Math.sin(angle) * ring * 0.78 * scale;
      const treeScale = scale * (0.72 + ((variant + index * 41) % 42) / 100);
      const height = 1.0 + ((variant + index * 29) % 58) / 100;

      if (index < (dense ? 4 : 3)) {
        addChildPrimitive(
          root,
          'cylinder',
          'Forest Trunk',
          new pc.Vec3(x, 0.35 * treeScale, z),
          new pc.Vec3(0.085 * treeScale, 0.78 * treeScale, 0.085 * treeScale),
          this.trunkMaterial,
        );
      }

      const canopyMaterial = index % 3 === 0
        ? this.canopyLightMaterial
        : index % 3 === 1
          ? this.canopyMidMaterial
          : this.canopyDarkMaterial;
      addChildPrimitive(
        root,
        'sphere',
        'Forest Lower Crown',
        new pc.Vec3(x, height * treeScale, z),
        new pc.Vec3(0.75 * treeScale, 0.58 * treeScale, 0.67 * treeScale),
        canopyMaterial,
      );

      if (index < (dense ? 3 : 2)) {
        addChildPrimitive(
          root,
          'sphere',
          'Forest Upper Crown',
          new pc.Vec3(
            x + Math.cos(angle + 0.8) * 0.12 * treeScale,
            (height + 0.48) * treeScale,
            z + Math.sin(angle + 0.8) * 0.1 * treeScale,
          ),
          new pc.Vec3(0.5 * treeScale, 0.52 * treeScale, 0.45 * treeScale),
          index % 2 === 0 ? this.canopyDarkMaterial : this.canopyMidMaterial,
        );
      }
    }

    const understoryCount = dense ? 4 : 3;
    for (let index = 0; index < understoryCount; index += 1) {
      const angle = index * 2.05 + variant * 0.043;
      addChildPrimitive(
        root,
        'sphere',
        'Forest Understory',
        new pc.Vec3(Math.cos(angle) * 0.9 * scale, 0.105 * scale, Math.sin(angle) * 0.7 * scale),
        new pc.Vec3(0.44 * scale, 0.17 * scale, 0.31 * scale),
        this.understoryMaterial,
      );
    }
  }

  private renderHighlandMasses(): void {
    const originX = originMetres(this.world.width);
    const originZ = originMetres(this.world.height);
    let count = 0;

    for (let z = 3; z < this.world.height - 3 && count < 24; z += 5) {
      const stagger = (Math.floor(z / 5) & 1) === 0 ? 0 : 2;
      for (let x = 3 + stagger; x < this.world.width - 3 && count < 24; x += 5) {
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND || this.world.biome[index] !== BiomeType.HIGHLANDS) continue;
        if (this.isNearStrategicSite(x, z, 2)) continue;
        const neighbors = sameBiomeNeighborCount(this.world, x, z, BiomeType.HIGHLANDS);
        const variant = hashByte(x, z, this.world.identity.masterSeed + 311);
        if (neighbors < 5 || variant > 156) continue;

        const root = new pc.Entity(`Highland Ridge Group ${x},${z}`);
        root.setPosition(
          originX + x + 0.5 + ((hashByte(x, z, 313) / 255) - 0.5) * 1.2,
          0.022,
          originZ + z + 0.5 + ((hashByte(x, z, 317) / 255) - 0.5) * 1.2,
        );
        root.setEulerAngles(0, variant * 1.17, 0);
        this.app.root.addChild(root);
        this.entities.push(root);
        this.fogManagedRoots.push({ root, cellIndex: index });

        const scale = 0.94 + (variant / 255) * 0.38;
        addChildPrimitive(root, 'box', 'Highland Ridge A', new pc.Vec3(-0.18 * scale, 0.18 * scale, 0), new pc.Vec3(1.08 * scale, 0.34 * scale, 0.55 * scale), this.rockDarkMaterial, new pc.Vec3(6, 17, 5));
        addChildPrimitive(root, 'box', 'Highland Ridge B', new pc.Vec3(0.48 * scale, 0.13 * scale, -0.22 * scale), new pc.Vec3(0.58 * scale, 0.25 * scale, 0.38 * scale), this.rockMidMaterial, new pc.Vec3(-5, -22, 10));
        addChildPrimitive(root, 'box', 'Highland Scree A', new pc.Vec3(-0.52 * scale, 0.08 * scale, 0.34 * scale), new pc.Vec3(0.28 * scale, 0.14 * scale, 0.22 * scale), this.rockLightMaterial, new pc.Vec3(4, 33, -8));
        if ((variant & 1) === 0) {
          addChildPrimitive(root, 'box', 'Highland Scree B', new pc.Vec3(0.18 * scale, 0.07 * scale, 0.46 * scale), new pc.Vec3(0.23 * scale, 0.12 * scale, 0.18 * scale), this.rockLightMaterial, new pc.Vec3(-3, -29, 7));
        }
        addChildPrimitive(root, 'sphere', 'Highland Grass', new pc.Vec3(-0.48 * scale, 0.055 * scale, -0.32 * scale), new pc.Vec3(0.29 * scale, 0.1 * scale, 0.19 * scale), this.dryGrassMaterial);
        count += 1;
      }
    }
  }

  private renderCuratedDressing(): void {
    const originX = originMetres(this.world.width);
    const originZ = originMetres(this.world.height);
    const layout = createEnvironmentVisualLayout(this.world);

    for (const prop of layout) {
      if (!this.shouldRenderCuratedProp(prop)) continue;
      const root = new pc.Entity(`${prop.kind} ${prop.cellX},${prop.cellZ}`);
      root.setPosition(
        originX + prop.cellX + 0.5 + prop.offsetX,
        propBaseY(prop.kind),
        originZ + prop.cellZ + 0.5 + prop.offsetZ,
      );
      root.setEulerAngles(0, prop.rotationDegrees, 0);
      this.app.root.addChild(root);
      this.entities.push(root);
      this.fogManagedRoots.push({ root, cellIndex: cellIndex(this.world, prop.cellX, prop.cellZ) });
      this.populateCuratedProp(root, prop);
    }
  }

  private shouldRenderCuratedProp(prop: EnvironmentVisualProp): boolean {
    if (prop.kind === 'WOODLAND_GROVE' || prop.kind === 'WOODLAND_EDGE') return false;
    if (prop.kind === 'HIGHLAND_RIDGE' || prop.kind === 'HIGHLAND_ROCK') return false;
    if (prop.kind === 'PLAINS_SCRUB') return prop.variant < 48;
    if (prop.kind === 'PLAINS_STONE') return prop.variant < 34;
    if (prop.kind === 'BIOME_EDGE_SCRUB' || prop.kind === 'BIOME_EDGE_STONE') return prop.variant < 116;
    return true;
  }

  private populateCuratedProp(root: pc.Entity, prop: EnvironmentVisualProp): void {
    const scale = prop.scale;

    if (prop.kind === 'RIVER_REED') {
      for (let index = 0; index < 5; index += 1) {
        const lateral = (index - 2) * 0.085 * scale;
        addChildPrimitive(
          root,
          'cylinder',
          'River Reed',
          new pc.Vec3(lateral, (0.2 + index * 0.022) * scale, ((prop.variant + index * 31) % 5 - 2) * 0.03 * scale),
          new pc.Vec3(0.026 * scale, (0.38 + index * 0.05) * scale, 0.026 * scale),
          this.reedMaterial,
        );
      }
      return;
    }

    if (prop.kind === 'RIVER_BANK_STONE' || prop.kind === 'PLAINS_STONE' || prop.kind === 'BIOME_EDGE_STONE') {
      addChildPrimitive(
        root,
        'box',
        'Ground Stone',
        new pc.Vec3(0, 0.07 * scale, 0),
        new pc.Vec3(0.28 * scale, 0.13 * scale, 0.2 * scale),
        prop.variant < 128 ? this.rockDarkMaterial : this.rockMidMaterial,
        new pc.Vec3(5, 21, 7),
      );
      if (prop.kind === 'RIVER_BANK_STONE') {
        addChildPrimitive(root, 'sphere', 'Bank Grass', new pc.Vec3(0.22 * scale, 0.05 * scale, -0.1 * scale), new pc.Vec3(0.16 * scale, 0.08 * scale, 0.12 * scale), this.reedMaterial);
      }
      return;
    }

    if (prop.kind === 'PLAINS_SCRUB' || prop.kind === 'BIOME_EDGE_SCRUB') {
      addChildPrimitive(root, 'sphere', 'Ground Scrub', new pc.Vec3(0, 0.09 * scale, 0), new pc.Vec3(0.3 * scale, 0.16 * scale, 0.23 * scale), this.scrubMaterial);
      return;
    }

    if (prop.kind === 'ROUTE_EDGE_POST') {
      addChildPrimitive(root, 'cylinder', 'Route Post', new pc.Vec3(0, 0.23 * scale, 0), new pc.Vec3(0.055 * scale, 0.43 * scale, 0.055 * scale), this.routePostMaterial);
      addChildPrimitive(root, 'box', 'Route Post Cap', new pc.Vec3(0, 0.43 * scale, 0), new pc.Vec3(0.15 * scale, 0.07 * scale, 0.11 * scale), this.rockLightMaterial);
      return;
    }

    if (prop.kind === 'SETTLEMENT_SUPPLIES') {
      addChildPrimitive(root, 'box', 'Supply Crate A', new pc.Vec3(-0.18 * scale, 0.12 * scale, 0), new pc.Vec3(0.36 * scale, 0.24 * scale, 0.31 * scale), this.supplyMaterial);
      addChildPrimitive(root, 'box', 'Supply Crate B', new pc.Vec3(0.2 * scale, 0.085 * scale, 0.12 * scale), new pc.Vec3(0.26 * scale, 0.17 * scale, 0.23 * scale), this.supplyMaterial, new pc.Vec3(0, 18, 0));
      addChildPrimitive(root, 'box', 'Supply Band', new pc.Vec3(-0.18 * scale, 0.14 * scale, 0), new pc.Vec3(0.055 * scale, 0.26 * scale, 0.33 * scale), this.metalBandMaterial);
      addChildPrimitive(root, 'cylinder', 'Supply Barrel', new pc.Vec3(0.39 * scale, 0.12 * scale, -0.16 * scale), new pc.Vec3(0.14 * scale, 0.24 * scale, 0.14 * scale), this.supplyMaterial);
      if (prop.variant > 118) {
        addChildPrimitive(root, 'cylinder', 'Work Stake', new pc.Vec3(-0.44 * scale, 0.24 * scale, -0.18 * scale), new pc.Vec3(0.045 * scale, 0.46 * scale, 0.045 * scale), this.routePostMaterial);
        addChildPrimitive(root, 'box', 'Work Rack', new pc.Vec3(-0.33 * scale, 0.35 * scale, -0.18 * scale), new pc.Vec3(0.24 * scale, 0.07 * scale, 0.06 * scale), this.metalBandMaterial);
      }
      return;
    }

    if (prop.kind === 'RESOURCE_FRINGE') {
      addChildPrimitive(root, 'sphere', 'Resource Stone A', new pc.Vec3(-0.18 * scale, 0.055 * scale, 0.06 * scale), new pc.Vec3(0.21 * scale, 0.1 * scale, 0.16 * scale), this.rockDarkMaterial);
      addChildPrimitive(root, 'sphere', 'Resource Stone B', new pc.Vec3(0.18 * scale, 0.045 * scale, -0.12 * scale), new pc.Vec3(0.15 * scale, 0.08 * scale, 0.12 * scale), this.rockLightMaterial);
      addChildPrimitive(root, 'sphere', 'Resource Grass', new pc.Vec3(0.04 * scale, 0.04 * scale, 0.2 * scale), new pc.Vec3(0.17 * scale, 0.07 * scale, 0.12 * scale), this.dryGrassMaterial);
      return;
    }

    if (prop.kind === 'POI_FRINGE') {
      if (prop.variant < 128) {
        addChildPrimitive(root, 'box', 'POI Broken Stone', new pc.Vec3(0, 0.1 * scale, 0), new pc.Vec3(0.38 * scale, 0.2 * scale, 0.24 * scale), this.rockMidMaterial, new pc.Vec3(11, 31, 17));
        addChildPrimitive(root, 'box', 'POI Stone Chip', new pc.Vec3(0.28 * scale, 0.045 * scale, -0.18 * scale), new pc.Vec3(0.15 * scale, 0.09 * scale, 0.11 * scale), this.rockLightMaterial, new pc.Vec3(-5, -24, 9));
      } else {
        addChildPrimitive(root, 'cylinder', 'POI Stake', new pc.Vec3(0, 0.2 * scale, 0), new pc.Vec3(0.05 * scale, 0.38 * scale, 0.05 * scale), this.routePostMaterial);
        addChildPrimitive(root, 'box', 'POI Marker', new pc.Vec3(0.09 * scale, 0.34 * scale, 0), new pc.Vec3(0.2 * scale, 0.08 * scale, 0.06 * scale), this.metalBandMaterial);
      }
    }
  }

  private rebuildIceOverlay(): void {
    for (const entity of this.iceEntities) entity.destroy();
    this.iceEntities.length = 0;
    if (this.lastIceCount <= 0) return;

    const originX = originMetres(this.world.width);
    const originZ = originMetres(this.world.height);
    for (const run of runsForGrid(
      this.world.width,
      this.world.height,
      (index) => this.terrain.surface[index] === SurfaceType.ICE,
    )) {
      const widthCells = run.endColumn - run.startColumn + 1;
      this.iceEntities.push(addPrimitive(
        this.app,
        'plane',
        `Generated Ice ${run.row}:${run.startColumn}-${run.endColumn}`,
        new pc.Vec3(originX + run.startColumn + widthCells / 2, 0.048, originZ + run.row + 0.5),
        new pc.Vec3(widthCells * 0.96, 1, 0.96),
        this.iceMaterial,
      ));
    }
  }
}
