import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import { SurfaceType, type TerrainState } from '../simulation/terrain-state';
import {
  BiomeType,
  TerrainType,
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

function createMaterial(color: pc.Color, opacity = 1): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.metalness = 0;
  material.gloss = 0.16;
  material.opacity = opacity;
  if (opacity < 1) {
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
  }
  material.update();
  return material;
}

function createVertexMaterial(name: string, transparent = false, unlit = false): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.name = name;
  material.diffuse = new pc.Color(1, 1, 1);
  material.diffuseVertexColor = true;
  material.metalness = 0;
  material.gloss = 0.12;
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
  if (biome === BiomeType.WOODLAND) return [49, 78, 44];
  if (biome === BiomeType.HIGHLANDS) return [96, 91, 73];
  return [67, 94, 56];
}

function terrainColorAt(world: GeneratedWorld, x: number, z: number): readonly [number, number, number, number] {
  let red = 0;
  let green = 0;
  let blue = 0;
  let weightTotal = 0;
  let elevation = 0;
  let moisture = 0;
  const centreX = Math.max(0, Math.min(world.width - 1, Math.round(x)));
  const centreZ = Math.max(0, Math.min(world.height - 1, Math.round(z)));

  for (let dz = -2; dz <= 2; dz += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const sampleX = centreX + dx;
      const sampleZ = centreZ + dz;
      if (!inBounds(world, sampleX, sampleZ)) continue;
      const index = cellIndex(world, sampleX, sampleZ);
      const distance = Math.sqrt(dx * dx + dz * dz);
      const weight = Math.max(0.18, 2.9 - distance);
      const [r, g, b] = biomeColor(world.biome[index] as BiomeType);
      red += r * weight;
      green += g * weight;
      blue += b * weight;
      elevation += (world.elevation[index] ?? 128) * weight;
      moisture += (world.moisture[index] ?? 128) * weight;
      weightTotal += weight;
    }
  }

  const safeWeight = Math.max(1, weightTotal);
  red /= safeWeight;
  green /= safeWeight;
  blue /= safeWeight;
  elevation /= safeWeight;
  moisture /= safeWeight;

  const coarse = (hashByte(Math.floor(x / 2), Math.floor(z / 2), world.identity.masterSeed) / 255) - 0.5;
  const fine = (hashByte(Math.floor(x * 1.7), Math.floor(z * 1.7), world.identity.masterSeed + 71) / 255) - 0.5;
  const heightShade = ((elevation / 255) - 0.5) * 14;
  const moistureShade = ((moisture / 255) - 0.5) * 8;
  const variation = coarse * 9 + fine * 5;

  return [
    clampByte(red + heightShade + variation - moistureShade * 0.25),
    clampByte(green + heightShade * 0.55 + variation + moistureShade),
    clampByte(blue + heightShade * 0.35 + variation * 0.55 - moistureShade * 0.15),
    255,
  ];
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
  const step = 2;
  const columns = Math.ceil(world.width / step) + 1;
  const rows = Math.ceil(world.height / step) + 1;

  for (let row = 0; row < rows; row += 1) {
    const cellZ = Math.min(world.height, row * step);
    for (let column = 0; column < columns; column += 1) {
      const cellX = Math.min(world.width, column * step);
      buffers.positions.push(originX + cellX, 0, originZ + cellZ);
      buffers.normals.push(0, 1, 0);
      buffers.colors.push(...terrainColorAt(world, cellX - 0.5, cellZ - 0.5));
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
      const corners = [
        [x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1],
      ] as const;

      for (let corner = 0; corner < corners.length; corner += 1) {
        const [cornerX, cornerZ] = corners[corner]!;
        const alpha = smoothstep(0.08, 0.92, alphas[corner] ?? 0);
        const variation = hashByte(cornerX, cornerZ, world.identity.masterSeed + 97) / 255;
        buffers.positions.push(originX + cornerX, 0.032, originZ + cornerZ);
        buffers.normals.push(0, 1, 0);
        buffers.colors.push(
          clampByte(24 + variation * 8),
          clampByte(92 + variation * 22),
          clampByte(126 + variation * 30),
          clampByte(alpha * 232),
        );
      }
      buffers.indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
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
      { offset: -halfWidth, shade: 0.92, alpha: 0 },
      { offset: -halfWidth * 0.62, shade: 0.96, alpha: 180 },
      { offset: halfWidth * 0.62, shade: 1, alpha: 180 },
      { offset: halfWidth, shade: 0.92, alpha: 0 },
    ];
  }
  if (layer === 'CORE') {
    return [
      { offset: -halfWidth, shade: 0.82, alpha: 255 },
      { offset: -halfWidth * 0.34, shade: 1.03, alpha: 255 },
      { offset: halfWidth * 0.34, shade: 1, alpha: 255 },
      { offset: halfWidth, shade: 0.84, alpha: 255 },
    ];
  }
  return [
    { offset: -halfWidth, shade: 0.72, alpha: 0 },
    { offset: 0, shade: 0.7, alpha: 105 },
    { offset: halfWidth, shade: 0.72, alpha: 0 },
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
    ? [105, 94, 65] as const
    : layer === 'CORE'
      ? [119, 94, 55] as const
      : [74, 60, 42] as const;

  for (const route of world.routes) {
    const points = normalizedRoutePoints(route);
    if (points.length < 2) continue;
    const coreHalf = 0.34 + Math.min(0.16, Math.max(1, route.widthCells) * 0.055);
    const halfWidth = layer === 'SHOULDER' ? coreHalf + 0.42 : layer === 'CORE' ? coreHalf : 0.055;
    const section = roadCrossSection(layer, halfWidth);
    const routeBase = buffers.positions.length / 3;

    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex]!;
      const [normalX, normalZ] = routeNormal(points, pointIndex);
      const rutShift = layer === 'RUT_LEFT' ? -coreHalf * 0.42 : layer === 'RUT_RIGHT' ? coreHalf * 0.42 : 0;
      const variation = (hashByte(point.x, point.z, world.identity.masterSeed + 131) / 255 - 0.5) * 0.08;

      for (const cross of section) {
        const offset = cross.offset + rutShift;
        buffers.positions.push(
          originX + point.x + 0.5 + normalX * offset,
          layer === 'SHOULDER' ? 0.018 : layer === 'CORE' ? 0.025 : 0.029,
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
  private readonly iceEntities: pc.Entity[] = [];
  private readonly meshes: pc.Mesh[] = [];

  private readonly groundMaterial = createVertexMaterial('ENV_GROUND');
  private readonly waterMaterial = createVertexMaterial('ENV_WATER', true, true);
  private readonly roadShoulderMaterial = createVertexMaterial('ENV_ROAD_SHOULDER', true);
  private readonly roadCoreMaterial = createVertexMaterial('ENV_ROAD_CORE');
  private readonly roadRutMaterial = createVertexMaterial('ENV_ROAD_RUT', true);
  private readonly crossingMaterial = createMaterial(new pc.Color(0.38, 0.30, 0.19));
  private readonly iceMaterial = createMaterial(new pc.Color(0.56, 0.84, 0.91), 0.84);

  private readonly trunkMaterial = createMaterial(new pc.Color(0.16, 0.095, 0.05));
  private readonly canopyDarkMaterial = createMaterial(new pc.Color(0.035, 0.16, 0.055));
  private readonly canopyMidMaterial = createMaterial(new pc.Color(0.055, 0.24, 0.075));
  private readonly canopyLightMaterial = createMaterial(new pc.Color(0.10, 0.32, 0.11));
  private readonly forestShadowMaterial = createMaterial(new pc.Color(0.025, 0.085, 0.035), 0.22);
  private readonly understoryMaterial = createMaterial(new pc.Color(0.13, 0.27, 0.09));

  private readonly rockDarkMaterial = createMaterial(new pc.Color(0.29, 0.29, 0.255));
  private readonly rockMidMaterial = createMaterial(new pc.Color(0.39, 0.38, 0.32));
  private readonly rockLightMaterial = createMaterial(new pc.Color(0.48, 0.455, 0.37));
  private readonly dryGrassMaterial = createMaterial(new pc.Color(0.42, 0.39, 0.19));
  private readonly scrubMaterial = createMaterial(new pc.Color(0.20, 0.33, 0.12));
  private readonly reedMaterial = createMaterial(new pc.Color(0.29, 0.48, 0.16));
  private readonly routePostMaterial = createMaterial(new pc.Color(0.25, 0.16, 0.08));
  private readonly supplyMaterial = createMaterial(new pc.Color(0.34, 0.215, 0.11));
  private readonly metalBandMaterial = createMaterial(new pc.Color(0.31, 0.32, 0.30));

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

  sync(navVersion: number, iceCount: number): void {
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
      this.waterMaterial,
      this.roadShoulderMaterial,
      this.roadCoreMaterial,
      this.roadRutMaterial,
      this.crossingMaterial,
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
    const waterMesh = buildWaterMesh(this.app, this.world, originX, originZ);
    const roadShoulderMesh = buildRoadMesh(this.app, this.world, originX, originZ, 'SHOULDER');
    const roadCoreMesh = buildRoadMesh(this.app, this.world, originX, originZ, 'CORE');
    const roadRutLeftMesh = buildRoadMesh(this.app, this.world, originX, originZ, 'RUT_LEFT');
    const roadRutRightMesh = buildRoadMesh(this.app, this.world, originX, originZ, 'RUT_RIGHT');

    this.meshes.push(groundMesh, waterMesh, roadShoulderMesh, roadCoreMesh, roadRutLeftMesh, roadRutRightMesh);
    this.entities.push(
      addMeshEntity(this.app, 'Environment Ground Mesh', groundMesh, this.groundMaterial),
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
      const crossing = addPrimitive(
        this.app,
        'box',
        `Natural Crossing ${run.row}:${run.startColumn}-${run.endColumn}`,
        new pc.Vec3(centreX, 0.042, centreZ),
        new pc.Vec3(widthCells, 0.055, 0.86),
        this.crossingMaterial,
      );
      this.entities.push(crossing);

      const seamCount = Math.max(1, Math.floor(widthCells * 1.5));
      for (let seam = 1; seam < seamCount; seam += 1) {
        const x = centreX - widthCells / 2 + (seam / seamCount) * widthCells;
        this.entities.push(addPrimitive(
          this.app,
          'box',
          'Crossing Seam',
          new pc.Vec3(x, 0.074, centreZ),
          new pc.Vec3(0.025, 0.012, 0.72),
          this.routePostMaterial,
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

    for (let z = 2; z < this.world.height - 2; z += 3) {
      for (let x = 2; x < this.world.width - 2; x += 3) {
        if (groveCount >= 52 && edgeCount >= 18) return;
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND || this.world.biome[index] !== BiomeType.WOODLAND) continue;
        if (this.isNearStrategicSite(x, z, 3)) continue;

        const neighbors = sameBiomeNeighborCount(this.world, x, z, BiomeType.WOODLAND);
        const variant = hashByte(x, z, this.world.identity.masterSeed + 211);
        const dense = neighbors >= 6;
        if (dense && (variant > 176 || groveCount >= 52)) continue;
        if (!dense && (neighbors < 3 || variant > 112 || edgeCount >= 18)) continue;

        const jitterX = ((hashByte(x, z, 223) / 255) - 0.5) * 0.9;
        const jitterZ = ((hashByte(x, z, 227) / 255) - 0.5) * 0.9;
        const scale = (dense ? 1.05 : 0.78) + (hashByte(x, z, 229) / 255) * 0.24;
        const root = new pc.Entity(dense ? `Woodland Grove ${x},${z}` : `Woodland Edge ${x},${z}`);
        root.setPosition(originX + x + 0.5 + jitterX, 0.022, originZ + z + 0.5 + jitterZ);
        root.setEulerAngles(0, variant * 1.41, 0);
        this.app.root.addChild(root);
        this.entities.push(root);
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
      new pc.Vec3(0, 0.018, 0),
      new pc.Vec3((dense ? 2.3 : 1.55) * scale, 0.018, (dense ? 1.7 : 1.1) * scale),
      this.forestShadowMaterial,
    );

    const lobes = dense ? 7 : 4;
    for (let index = 0; index < lobes; index += 1) {
      const angle = index * 2.39996 + variant * 0.031;
      const ring = dense ? (index < 2 ? 0.25 : 0.72) : 0.5;
      const x = Math.cos(angle) * ring * scale;
      const z = Math.sin(angle) * ring * 0.72 * scale;
      const treeScale = scale * (0.76 + ((variant + index * 41) % 37) / 100);
      const height = 0.95 + ((variant + index * 29) % 31) / 100;
      if (index < (dense ? 4 : 2)) {
        addChildPrimitive(
          root,
          'cylinder',
          'Forest Trunk',
          new pc.Vec3(x, 0.36 * treeScale, z),
          new pc.Vec3(0.095 * treeScale, 0.68 * treeScale, 0.095 * treeScale),
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
        'Forest Canopy Mass',
        new pc.Vec3(x, height * treeScale, z),
        new pc.Vec3(0.72 * treeScale, 0.58 * treeScale, 0.64 * treeScale),
        canopyMaterial,
      );
    }

    const understoryCount = dense ? 4 : 2;
    for (let index = 0; index < understoryCount; index += 1) {
      const angle = index * 1.85 + variant * 0.043;
      addChildPrimitive(
        root,
        'sphere',
        'Forest Understory',
        new pc.Vec3(Math.cos(angle) * 0.86 * scale, 0.11 * scale, Math.sin(angle) * 0.66 * scale),
        new pc.Vec3(0.42 * scale, 0.18 * scale, 0.32 * scale),
        this.understoryMaterial,
      );
    }
  }

  private renderHighlandMasses(): void {
    const originX = originMetres(this.world.width);
    const originZ = originMetres(this.world.height);
    let count = 0;

    for (let z = 3; z < this.world.height - 3 && count < 28; z += 4) {
      for (let x = 3; x < this.world.width - 3 && count < 28; x += 4) {
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND || this.world.biome[index] !== BiomeType.HIGHLANDS) continue;
        if (this.isNearStrategicSite(x, z, 2)) continue;
        const neighbors = sameBiomeNeighborCount(this.world, x, z, BiomeType.HIGHLANDS);
        const variant = hashByte(x, z, this.world.identity.masterSeed + 311);
        if (neighbors < 5 || variant > 112) continue;

        const root = new pc.Entity(`Highland Rock Group ${x},${z}`);
        root.setPosition(
          originX + x + 0.5 + ((hashByte(x, z, 313) / 255) - 0.5) * 0.9,
          0.022,
          originZ + z + 0.5 + ((hashByte(x, z, 317) / 255) - 0.5) * 0.9,
        );
        root.setEulerAngles(0, variant * 1.17, 0);
        this.app.root.addChild(root);
        this.entities.push(root);

        const scale = 0.82 + (variant / 255) * 0.35;
        addChildPrimitive(root, 'box', 'Highland Rock A', new pc.Vec3(-0.25 * scale, 0.2 * scale, 0), new pc.Vec3(0.78 * scale, 0.38 * scale, 0.62 * scale), this.rockDarkMaterial, new pc.Vec3(7, 18, 6));
        addChildPrimitive(root, 'box', 'Highland Rock B', new pc.Vec3(0.38 * scale, 0.15 * scale, -0.18 * scale), new pc.Vec3(0.5 * scale, 0.28 * scale, 0.38 * scale), this.rockMidMaterial, new pc.Vec3(-6, -23, 11));
        if ((variant & 1) === 0) {
          addChildPrimitive(root, 'box', 'Highland Rock C', new pc.Vec3(0.08 * scale, 0.1 * scale, 0.42 * scale), new pc.Vec3(0.34 * scale, 0.2 * scale, 0.28 * scale), this.rockLightMaterial, new pc.Vec3(4, 31, -7));
        }
        addChildPrimitive(root, 'sphere', 'Highland Grass', new pc.Vec3(-0.48 * scale, 0.055 * scale, 0.3 * scale), new pc.Vec3(0.27 * scale, 0.1 * scale, 0.19 * scale), this.dryGrassMaterial);
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
      this.populateCuratedProp(root, prop);
    }
  }

  private shouldRenderCuratedProp(prop: EnvironmentVisualProp): boolean {
    if (prop.kind === 'WOODLAND_GROVE' || prop.kind === 'WOODLAND_EDGE') return false;
    if (prop.kind === 'HIGHLAND_RIDGE' || prop.kind === 'HIGHLAND_ROCK') return false;
    if (prop.kind === 'PLAINS_SCRUB') return prop.variant < 58;
    if (prop.kind === 'PLAINS_STONE') return prop.variant < 42;
    if (prop.kind === 'BIOME_EDGE_SCRUB' || prop.kind === 'BIOME_EDGE_STONE') return prop.variant < 128;
    return true;
  }

  private populateCuratedProp(root: pc.Entity, prop: EnvironmentVisualProp): void {
    const scale = prop.scale;

    if (prop.kind === 'RIVER_REED') {
      for (let index = 0; index < 4; index += 1) {
        const lateral = (index - 1.5) * 0.1 * scale;
        addChildPrimitive(
          root,
          'cylinder',
          'River Reed',
          new pc.Vec3(lateral, (0.2 + index * 0.025) * scale, ((prop.variant + index * 31) % 5 - 2) * 0.03 * scale),
          new pc.Vec3(0.028 * scale, (0.38 + index * 0.055) * scale, 0.028 * scale),
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
      addChildPrimitive(root, 'box', 'Supply Crate A', new pc.Vec3(-0.16 * scale, 0.12 * scale, 0), new pc.Vec3(0.36 * scale, 0.24 * scale, 0.31 * scale), this.supplyMaterial);
      addChildPrimitive(root, 'box', 'Supply Crate B', new pc.Vec3(0.21 * scale, 0.085 * scale, 0.12 * scale), new pc.Vec3(0.26 * scale, 0.17 * scale, 0.23 * scale), this.supplyMaterial, new pc.Vec3(0, 18, 0));
      addChildPrimitive(root, 'box', 'Supply Band', new pc.Vec3(-0.16 * scale, 0.14 * scale, 0), new pc.Vec3(0.055 * scale, 0.26 * scale, 0.33 * scale), this.metalBandMaterial);
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
        new pc.Vec3(originX + run.startColumn + widthCells / 2, 0.047, originZ + run.row + 0.5),
        new pc.Vec3(widthCells * 0.96, 1, 0.96),
        this.iceMaterial,
      ));
    }
  }
}
