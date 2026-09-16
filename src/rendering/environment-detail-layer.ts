import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import { VisibilityLevel } from '../simulation/visibility-state';
import {
  BiomeType,
  TerrainType,
  WorldCellFlag,
  type GeneratedWorld,
  type GridPoint,
} from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';

type PrimitiveType = 'box' | 'cylinder' | 'sphere';

interface DetailRoot {
  root: pc.Entity;
  cellIndex: number;
}

const ORTHOGONAL_NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const SERVICE_OFFSETS = [
  [3, 1], [3, -1], [-3, 1], [-3, -1],
  [1, 3], [-1, 3], [1, -3], [-1, -3],
  [4, 0], [-4, 0], [0, 4], [0, -4],
] as const;

function createMaterial(
  color: pc.Color,
  gloss = 0.12,
  opacity = 1,
  emissive?: pc.Color,
): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.metalness = 0;
  material.gloss = gloss;
  material.opacity = opacity;
  if (emissive) {
    material.emissive = emissive;
    material.emissiveIntensity = 0.45;
  }
  if (opacity < 1) {
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
    material.cull = pc.CULLFACE_NONE;
  }
  material.update();
  return material;
}

function addPrimitive(
  parent: pc.Entity,
  type: PrimitiveType,
  name: string,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  material: pc.Material,
  rotation: readonly [number, number, number] = [0, 0, 0],
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', {
    type,
    material,
    castShadows: false,
    receiveShadows: false,
  });
  entity.setLocalPosition(position[0], position[1], position[2]);
  entity.setLocalScale(scale[0], scale[1], scale[2]);
  entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
  parent.addChild(entity);
  return entity;
}

function cellIndex(world: GeneratedWorld, x: number, z: number): number {
  return z * world.width + x;
}

function inBounds(world: GeneratedWorld, x: number, z: number): boolean {
  return x >= 0 && z >= 0 && x < world.width && z < world.height;
}

function hashByte(world: GeneratedWorld, x: number, z: number, salt: number): number {
  let value = Math.imul(x + 1, 0x45d9f3b)
    ^ Math.imul(z + 1, 0x119de1f3)
    ^ Math.imul(world.identity.masterSeed + salt + 1, 0x27d4eb2d);
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b);
  value ^= value >>> 16;
  return value & 0xff;
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

function touchesTerrain(world: GeneratedWorld, x: number, z: number, terrain: TerrainType): boolean {
  for (const [dx, dz] of ORTHOGONAL_NEIGHBORS) {
    const nx = x + dx;
    const nz = z + dz;
    if (!inBounds(world, nx, nz)) continue;
    if (world.terrain[cellIndex(world, nx, nz)] === terrain) return true;
  }
  return false;
}

function touchesRoute(world: GeneratedWorld, x: number, z: number): boolean {
  for (const [dx, dz] of ORTHOGONAL_NEIGHBORS) {
    const nx = x + dx;
    const nz = z + dz;
    if (!inBounds(world, nx, nz)) continue;
    if (((world.flags[cellIndex(world, nx, nz)] ?? 0) & WorldCellFlag.ROUTE) !== 0) return true;
  }
  return false;
}

function directionToTerrain(world: GeneratedWorld, x: number, z: number, terrain: TerrainType): readonly [number, number] {
  for (const [dx, dz] of ORTHOGONAL_NEIGHBORS) {
    const nx = x + dx;
    const nz = z + dz;
    if (!inBounds(world, nx, nz)) continue;
    if (world.terrain[cellIndex(world, nx, nz)] === terrain) return [dx, dz];
  }
  return [0, 1];
}

function directionToRoute(world: GeneratedWorld, x: number, z: number): readonly [number, number] {
  for (const [dx, dz] of ORTHOGONAL_NEIGHBORS) {
    const nx = x + dx;
    const nz = z + dz;
    if (!inBounds(world, nx, nz)) continue;
    if (((world.flags[cellIndex(world, nx, nz)] ?? 0) & WorldCellFlag.ROUTE) !== 0) return [dx, dz];
  }
  return [0, 1];
}

function isNearSite(world: GeneratedWorld, x: number, z: number, radius: number): boolean {
  const sites: GridPoint[] = [
    ...world.spawns.map((spawn) => spawn.cell),
    ...world.resources.map((resource) => resource.cell),
    ...world.pois.map((poi) => poi.cell),
    world.objective.cell,
    world.boss.cell,
  ];
  return sites.some((site) => Math.abs(site.x - x) <= radius && Math.abs(site.z - z) <= radius);
}

function worldPosition(world: GeneratedWorld, x: number, z: number): pc.Vec3 {
  const position = worldCellToSimulationPosition(world, { x, z });
  return new pc.Vec3(position.x / WORLD_UNITS_PER_METER, 0.025, position.z / WORLD_UNITS_PER_METER);
}

function isClearGround(world: GeneratedWorld, x: number, z: number): boolean {
  if (!inBounds(world, x, z)) return false;
  const index = cellIndex(world, x, z);
  return world.terrain[index] === TerrainType.GROUND && ((world.flags[index] ?? 0) & WorldCellFlag.ROUTE) === 0;
}

/**
 * Presentation-only environment depth layer. It deliberately concentrates detail
 * into readable masses and site surroundings instead of evenly scattering props.
 */
export class EnvironmentDetailLayer {
  private readonly roots: DetailRoot[] = [];
  private readonly lowQuality = new URLSearchParams(window.location.search).get('quality')?.trim().toLowerCase() === 'low';

  private readonly trunkMaterial = createMaterial(new pc.Color(0.105, 0.058, 0.03), 0.08);
  private readonly barkLightMaterial = createMaterial(new pc.Color(0.17, 0.095, 0.045), 0.07);
  private readonly canopyDarkMaterial = createMaterial(new pc.Color(0.018, 0.095, 0.03), 0.08);
  private readonly canopyMidMaterial = createMaterial(new pc.Color(0.036, 0.16, 0.05), 0.08);
  private readonly canopyLightMaterial = createMaterial(new pc.Color(0.065, 0.235, 0.075), 0.08);
  private readonly undergrowthMaterial = createMaterial(new pc.Color(0.095, 0.205, 0.065), 0.06);
  private readonly woodlandFloorMaterial = createMaterial(new pc.Color(0.105, 0.11, 0.055), 0.04);
  private readonly plainsFloorMaterial = createMaterial(new pc.Color(0.23, 0.29, 0.12), 0.04);
  private readonly highlandFloorMaterial = createMaterial(new pc.Color(0.31, 0.29, 0.22), 0.05);
  private readonly settlementFloorMaterial = createMaterial(new pc.Color(0.34, 0.27, 0.16), 0.05);
  private readonly mudMaterial = createMaterial(new pc.Color(0.18, 0.16, 0.105), 0.05);
  private readonly rockDarkMaterial = createMaterial(new pc.Color(0.23, 0.23, 0.21), 0.09);
  private readonly rockMidMaterial = createMaterial(new pc.Color(0.33, 0.32, 0.275), 0.09);
  private readonly rockLightMaterial = createMaterial(new pc.Color(0.43, 0.405, 0.335), 0.09);
  private readonly dryGrassMaterial = createMaterial(new pc.Color(0.39, 0.35, 0.17), 0.06);
  private readonly reedMaterial = createMaterial(new pc.Color(0.22, 0.39, 0.12), 0.06);
  private readonly routePostMaterial = createMaterial(new pc.Color(0.22, 0.13, 0.065), 0.07);
  private readonly supplyMaterial = createMaterial(new pc.Color(0.32, 0.19, 0.09), 0.08);
  private readonly metalMaterial = createMaterial(new pc.Color(0.27, 0.28, 0.26), 0.18);
  private readonly waterGlintMaterial = createMaterial(
    new pc.Color(0.42, 0.69, 0.72),
    0.28,
    0.34,
    new pc.Color(0.035, 0.09, 0.095),
  );

  constructor(private readonly app: pc.Application, private readonly world: GeneratedWorld) {
    this.renderBiomeFloorPatches();
    this.renderForestDepth();
    this.renderRiverBanks();
    this.renderHighlandEdges();
    this.renderRouteEdges();
    this.renderSettlementServiceAreas();
    if (!this.lowQuality) this.renderWaterGlints();
  }

  sync(visibility?: Uint8Array): void {
    for (const detail of this.roots) {
      const level = visibility?.[detail.cellIndex] ?? VisibilityLevel.VISIBLE;
      detail.root.enabled = level !== VisibilityLevel.UNEXPLORED;
    }
  }

  destroy(): void {
    for (const detail of this.roots) detail.root.destroy();
    this.roots.length = 0;
    for (const material of [
      this.trunkMaterial,
      this.barkLightMaterial,
      this.canopyDarkMaterial,
      this.canopyMidMaterial,
      this.canopyLightMaterial,
      this.undergrowthMaterial,
      this.woodlandFloorMaterial,
      this.plainsFloorMaterial,
      this.highlandFloorMaterial,
      this.settlementFloorMaterial,
      this.mudMaterial,
      this.rockDarkMaterial,
      this.rockMidMaterial,
      this.rockLightMaterial,
      this.dryGrassMaterial,
      this.reedMaterial,
      this.routePostMaterial,
      this.supplyMaterial,
      this.metalMaterial,
      this.waterGlintMaterial,
    ]) material.destroy();
  }

  private register(root: pc.Entity, x: number, z: number): void {
    this.app.root.addChild(root);
    this.roots.push({ root, cellIndex: cellIndex(this.world, x, z) });
  }

  private renderBiomeFloorPatches(): void {
    const maxPatches = this.lowQuality ? 12 : 28;
    let patches = 0;
    for (let z = 3; z < this.world.height - 3 && patches < maxPatches; z += 5) {
      const stagger = (Math.floor(z / 5) & 1) === 0 ? 0 : 2;
      for (let x = 3 + stagger; x < this.world.width - 3 && patches < maxPatches; x += 5) {
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND) continue;
        if (((this.world.flags[index] ?? 0) & WorldCellFlag.ROUTE) !== 0 || isNearSite(this.world, x, z, 2)) continue;
        const variant = hashByte(this.world, x, z, 823);
        if (variant > 172) continue;
        const biome = this.world.biome[index] as BiomeType;
        const root = new pc.Entity(`Biome Floor Patch ${x},${z}`);
        const base = worldPosition(this.world, x, z);
        root.setPosition(base.x, 0.0185, base.z);
        root.setEulerAngles(0, variant * 1.63, 0);
        const floorMaterial = biome === BiomeType.WOODLAND
          ? this.woodlandFloorMaterial
          : biome === BiomeType.HIGHLANDS
            ? this.highlandFloorMaterial
            : this.plainsFloorMaterial;
        const size = 0.78 + (variant / 255) * 0.42;
        addPrimitive(root, 'cylinder', 'Ground Tone Patch A', [-0.18, 0, 0.06], [1.18 * size, 0.012, 0.82 * size], floorMaterial);
        addPrimitive(root, 'cylinder', 'Ground Tone Patch B', [0.42, 0.001, -0.26], [0.68 * size, 0.011, 0.52 * size], floorMaterial);
        if (biome === BiomeType.HIGHLANDS) {
          addPrimitive(root, 'box', 'Scree Chip', [-0.46, 0.045, 0.28], [0.18, 0.08, 0.14], this.rockMidMaterial, [6, 23, 7]);
        } else if (biome === BiomeType.WOODLAND) {
          addPrimitive(root, 'sphere', 'Leaf Understory', [0.48, 0.055, 0.24], [0.26, 0.08, 0.19], this.undergrowthMaterial);
        } else if (variant > 96) {
          addPrimitive(root, 'sphere', 'Grass Tuft', [-0.44, 0.045, -0.22], [0.21, 0.075, 0.15], this.dryGrassMaterial);
        }
        this.register(root, x, z);
        patches += 1;
      }
    }
  }

  private renderForestDepth(): void {
    const maxGroups = this.lowQuality ? 34 : 92;
    let groups = 0;
    for (let z = 2; z < this.world.height - 2 && groups < maxGroups; z += 2) {
      const stagger = (Math.floor(z / 2) & 1) === 0 ? 0 : 1;
      for (let x = 2 + stagger; x < this.world.width - 2 && groups < maxGroups; x += 2) {
        const index = cellIndex(this.world, x, z);
        const flags = this.world.flags[index] ?? 0;
        if (this.world.terrain[index] !== TerrainType.GROUND || this.world.biome[index] !== BiomeType.WOODLAND) continue;
        if ((flags & WorldCellFlag.ROUTE) !== 0 || isNearSite(this.world, x, z, 2)) continue;
        const neighbors = sameBiomeNeighborCount(this.world, x, z, BiomeType.WOODLAND);
        const variant = hashByte(this.world, x, z, 901);
        if (neighbors < 3 || variant > 238) continue;

        const root = new pc.Entity(`Forest Depth Accent ${x},${z}`);
        const base = worldPosition(this.world, x, z);
        const jitterX = (hashByte(this.world, x, z, 907) / 255 - 0.5) * 0.95;
        const jitterZ = (hashByte(this.world, x, z, 911) / 255 - 0.5) * 0.95;
        root.setPosition(base.x + jitterX, 0.022, base.z + jitterZ);
        root.setEulerAngles(0, variant * 1.37, 0);

        const contactScale = 0.92 + (variant / 255) * 0.34;
        addPrimitive(root, 'cylinder', 'Forest Floor Contact', [0, -0.004, 0], [1.45 * contactScale, 0.012, 1.02 * contactScale], this.woodlandFloorMaterial);
        if (!this.lowQuality) {
          addPrimitive(root, 'cylinder', 'Forest Leaf Litter', [0.22, -0.002, -0.12], [0.92 * contactScale, 0.009, 0.68 * contactScale], this.mudMaterial);
        }

        const treeCount = this.lowQuality ? 3 + (variant % 2) : 5 + (variant % 3);
        for (let tree = 0; tree < treeCount; tree += 1) {
          const angle = tree * 2.39996 + variant * 0.019;
          const radius = tree === 0 ? 0.1 : 0.42 + tree * 0.09;
          const tx = Math.cos(angle) * radius;
          const tz = Math.sin(angle) * radius * 0.78;
          const size = 0.9 + (hashByte(this.world, x + tree, z, 919) / 255) * 0.55;
          const trunkHeight = 1.05 + size * 0.58;
          addPrimitive(root, 'cylinder', `Forest Accent Trunk ${tree + 1}`, [tx, trunkHeight * 0.47, tz], [0.07 * size, trunkHeight * 0.9, 0.07 * size], tree % 2 === 0 ? this.trunkMaterial : this.barkLightMaterial);
          const canopyMaterial = tree % 3 === 0
            ? this.canopyLightMaterial
            : tree % 3 === 1
              ? this.canopyMidMaterial
              : this.canopyDarkMaterial;
          addPrimitive(root, 'sphere', `Forest Accent Crown ${tree + 1}`, [tx, trunkHeight + 0.3 * size, tz], [0.5 * size, 0.68 * size, 0.45 * size], canopyMaterial);
          if (!this.lowQuality && (tree < 2 || (tree === 2 && variant > 112))) {
            addPrimitive(root, 'sphere', `Forest Accent Crown Lobe ${tree + 1}`, [tx - 0.18 * size, trunkHeight + 0.42 * size, tz + 0.08 * size], [0.33 * size, 0.38 * size, 0.3 * size], tree === 0 ? this.canopyDarkMaterial : this.canopyMidMaterial);
            addPrimitive(root, 'sphere', `Forest Accent Upper Crown ${tree + 1}`, [tx + 0.1 * size, trunkHeight + 0.86 * size, tz - 0.05 * size], [0.34 * size, 0.42 * size, 0.3 * size], tree === 0 ? this.canopyMidMaterial : this.canopyLightMaterial);
          }
        }
        addPrimitive(root, 'sphere', 'Forest Accent Understory A', [-0.42, 0.085, 0.32], [0.38, 0.13, 0.28], this.undergrowthMaterial);
        addPrimitive(root, 'sphere', 'Forest Accent Understory B', [0.46, 0.075, -0.28], [0.31, 0.11, 0.24], this.undergrowthMaterial);
        if (!this.lowQuality) addPrimitive(root, 'sphere', 'Forest Accent Understory C', [0.08, 0.065, -0.56], [0.28, 0.09, 0.21], this.undergrowthMaterial);
        if (!this.lowQuality && (variant & 3) === 0) {
          addPrimitive(root, 'cylinder', 'Fallen Log', [0.08, 0.075, 0.55], [0.07, 0.86, 0.07], this.trunkMaterial, [86, 22, 0]);
          addPrimitive(root, 'sphere', 'Fallen Log Brush', [-0.28, 0.07, 0.6], [0.24, 0.1, 0.19], this.undergrowthMaterial);
        }
        this.register(root, x, z);
        groups += 1;
      }
    }
  }

  private renderRiverBanks(): void {
    const maxGroups = this.lowQuality ? 14 : 34;
    let groups = 0;
    for (let z = 1; z < this.world.height - 1 && groups < maxGroups; z += 2) {
      for (let x = 1; x < this.world.width - 1 && groups < maxGroups; x += 2) {
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND || !touchesTerrain(this.world, x, z, TerrainType.WATER)) continue;
        if (((this.world.flags[index] ?? 0) & WorldCellFlag.ROUTE) !== 0) continue;
        const variant = hashByte(this.world, x, z, 941);
        if (variant > 208) continue;
        const [waterDx, waterDz] = directionToTerrain(this.world, x, z, TerrainType.WATER);
        const root = new pc.Entity(`River Bank Accent ${x},${z}`);
        const base = worldPosition(this.world, x, z);
        root.setPosition(base.x, 0.026, base.z);
        root.setEulerAngles(0, Math.atan2(waterDx, waterDz) * 180 / Math.PI, 0);
        addPrimitive(root, 'cylinder', 'River Mud Shelf', [0, 0.004, 0.23], [0.98, 0.012, 0.48], this.mudMaterial);
        addPrimitive(root, 'cylinder', 'River Wet Edge', [0, 0.006, 0.45], [0.76, 0.009, 0.17], this.woodlandFloorMaterial);
        addPrimitive(root, 'box', 'River Bank Stone', [-0.26, 0.075, 0.03], [0.28, 0.14, 0.2], variant < 128 ? this.rockDarkMaterial : this.rockLightMaterial, [6, 19, 7]);
        if ((variant & 1) === 0) addPrimitive(root, 'box', 'River Bank Stone Small', [0.34, 0.055, 0.16], [0.18, 0.1, 0.14], this.rockMidMaterial, [-4, -24, 8]);
        if (!this.lowQuality) addPrimitive(root, 'sphere', 'River Bank Grass', [0.38, 0.05, -0.12], [0.27, 0.08, 0.19], this.undergrowthMaterial);
        const reedCount = this.lowQuality ? 3 : 5;
        for (let reed = 0; reed < reedCount; reed += 1) {
          const lateral = (reed - (reedCount - 1) * 0.5) * 0.085;
          addPrimitive(root, 'cylinder', `River Bank Reed ${reed + 1}`, [lateral, 0.18 + reed * 0.014, 0.28 + (reed % 2) * 0.045], [0.02, 0.34 + reed * 0.028, 0.02], this.reedMaterial);
        }
        this.register(root, x, z);
        groups += 1;
      }
    }
  }

  private renderHighlandEdges(): void {
    const maxGroups = this.lowQuality ? 9 : 22;
    let groups = 0;
    for (let z = 2; z < this.world.height - 2 && groups < maxGroups; z += 4) {
      for (let x = 2; x < this.world.width - 2 && groups < maxGroups; x += 4) {
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND || this.world.biome[index] !== BiomeType.HIGHLANDS) continue;
        if (isNearSite(this.world, x, z, 2)) continue;
        const variant = hashByte(this.world, x, z, 967);
        if (variant > 204) continue;

        const root = new pc.Entity(`Highland Edge Accent ${x},${z}`);
        const base = worldPosition(this.world, x, z);
        root.setPosition(base.x, 0.02, base.z);
        root.setEulerAngles(0, variant * 1.13, 0);
        addPrimitive(root, 'cylinder', 'Highland Scree Bed', [0, -0.004, 0], [1.02, 0.012, 0.68], this.highlandFloorMaterial);
        addPrimitive(root, 'box', 'Highland Accent Rock A', [-0.28, 0.15, 0.02], [0.72, 0.29, 0.38], this.rockDarkMaterial, [8, 16, 8]);
        addPrimitive(root, 'box', 'Highland Accent Rock B', [0.35, 0.1, -0.2], [0.38, 0.2, 0.27], this.rockLightMaterial, [-6, -24, 11]);
        addPrimitive(root, 'box', 'Highland Accent Rock C', [0.08, 0.065, 0.36], [0.24, 0.12, 0.18], this.rockMidMaterial, [7, 31, -6]);
        addPrimitive(root, 'sphere', 'Highland Accent Grass', [-0.34, 0.055, -0.34], [0.27, 0.09, 0.19], this.dryGrassMaterial);
        if (!this.lowQuality && variant > 104) {
          addPrimitive(root, 'box', 'Highland Scree Chip A', [-0.58, 0.035, 0.28], [0.14, 0.07, 0.11], this.rockLightMaterial, [5, 12, 8]);
          addPrimitive(root, 'box', 'Highland Scree Chip B', [0.52, 0.03, 0.24], [0.11, 0.06, 0.09], this.rockDarkMaterial, [-4, -18, 5]);
        }
        this.register(root, x, z);
        groups += 1;
      }
    }
  }

  private renderRouteEdges(): void {
    const maxGroups = this.lowQuality ? 10 : 26;
    let groups = 0;
    for (let z = 1; z < this.world.height - 1 && groups < maxGroups; z += 3) {
      for (let x = 1; x < this.world.width - 1 && groups < maxGroups; x += 3) {
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND || !touchesRoute(this.world, x, z)) continue;
        if (((this.world.flags[index] ?? 0) & WorldCellFlag.ROUTE) !== 0 || isNearSite(this.world, x, z, 2)) continue;
        const variant = hashByte(this.world, x, z, 991);
        if (variant > 154) continue;

        const root = new pc.Entity(`Route Edge Accent ${x},${z}`);
        const base = worldPosition(this.world, x, z);
        const [routeDx, routeDz] = directionToRoute(this.world, x, z);
        root.setPosition(base.x, 0.024, base.z);
        root.setEulerAngles(0, Math.atan2(routeDx, routeDz) * 180 / Math.PI + ((variant % 13) - 6), 0);
        addPrimitive(root, 'cylinder', 'Route Shoulder Wear', [0, -0.004, 0.12], [0.76, 0.01, 0.31], variant < 96 ? this.mudMaterial : this.plainsFloorMaterial);
        if ((variant & 3) !== 0) {
          addPrimitive(root, 'cylinder', 'Route Edge Post', [0, 0.22, 0], [0.05, 0.42, 0.05], this.routePostMaterial);
          addPrimitive(root, 'box', 'Route Edge Cap', [0, 0.42, 0], [0.14, 0.065, 0.1], this.rockLightMaterial, [0, 9, 0]);
        }
        addPrimitive(root, 'sphere', 'Route Verge Grass', [-0.24, 0.05, 0.18], [0.28, 0.08, 0.18], this.dryGrassMaterial);
        if (!this.lowQuality && (variant & 3) === 0) addPrimitive(root, 'sphere', 'Route Verge Scrub', [0.32, 0.055, 0.25], [0.22, 0.09, 0.16], this.undergrowthMaterial);
        if ((variant & 1) === 0) addPrimitive(root, 'box', 'Route Edge Stone', [0.27, 0.055, -0.12], [0.18, 0.1, 0.14], this.rockDarkMaterial, [4, 27, 6]);
        this.register(root, x, z);
        groups += 1;
      }
    }
  }

  private renderSettlementServiceAreas(): void {
    const sites = [
      ...this.world.spawns.map((spawn, index) => ({ cell: spawn.cell, salt: 1103 + index * 41 })),
      ...this.world.pois
        .filter((poi) => poi.type === 'VILLAGE')
        .map((poi, index) => ({ cell: poi.cell, salt: 1201 + index * 37 })),
    ];
    const used = new Set<number>();
    for (const site of sites) {
      const count = this.lowQuality ? 1 : 3;
      for (let item = 0; item < count; item += 1) {
        const start = hashByte(this.world, site.cell.x, site.cell.z, site.salt + item * 13) % SERVICE_OFFSETS.length;
        let chosen: GridPoint | null = null;
        for (let step = 0; step < SERVICE_OFFSETS.length; step += 1) {
          const [dx, dz] = SERVICE_OFFSETS[(start + step) % SERVICE_OFFSETS.length]!;
          const x = site.cell.x + dx;
          const z = site.cell.z + dz;
          if (!isClearGround(this.world, x, z)) continue;
          const index = cellIndex(this.world, x, z);
          if (used.has(index)) continue;
          chosen = { x, z };
          used.add(index);
          break;
        }
        if (!chosen) continue;
        const variant = hashByte(this.world, chosen.x, chosen.z, site.salt + item * 19);
        const root = new pc.Entity(`Settlement Service Accent ${chosen.x},${chosen.z}`);
        const base = worldPosition(this.world, chosen.x, chosen.z);
        root.setPosition(base.x, 0.023, base.z);
        root.setEulerAngles(0, variant * 1.29, 0);
        addPrimitive(root, 'cylinder', 'Service Ground Wear', [0, 0, 0], [0.9, 0.012, 0.68], this.settlementFloorMaterial);
        if (!this.lowQuality) addPrimitive(root, 'cylinder', 'Service Track Wear', [0.38, 0.001, -0.28], [0.62, 0.009, 0.34], variant < 128 ? this.mudMaterial : this.plainsFloorMaterial);
        addPrimitive(root, 'box', 'Service Crate A', [-0.22, 0.12, -0.08], [0.36, 0.23, 0.31], this.supplyMaterial, [0, 12, 0]);
        addPrimitive(root, 'box', 'Service Crate B', [0.16, 0.085, 0.2], [0.27, 0.16, 0.23], this.supplyMaterial, [0, -18, 0]);
        addPrimitive(root, 'box', 'Service Crate Band', [-0.22, 0.13, -0.08], [0.055, 0.25, 0.33], this.metalMaterial);
        if (!this.lowQuality || (variant & 1) === 0) {
          addPrimitive(root, 'cylinder', 'Service Barrel', [0.39, 0.13, -0.2], [0.14, 0.25, 0.14], this.supplyMaterial);
          addPrimitive(root, 'cylinder', 'Service Post', [-0.46, 0.24, 0.25], [0.045, 0.45, 0.045], this.routePostMaterial);
          addPrimitive(root, 'box', 'Service Rack', [-0.33, 0.35, 0.25], [0.26, 0.065, 0.055], this.metalMaterial);
        }
        this.register(root, chosen.x, chosen.z);
      }
    }
  }

  private renderWaterGlints(): void {
    let groups = 0;
    for (let z = 2; z < this.world.height - 2 && groups < 18; z += 4) {
      const stagger = (Math.floor(z / 4) & 1) === 0 ? 0 : 2;
      for (let x = 2 + stagger; x < this.world.width - 2 && groups < 18; x += 4) {
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.WATER) continue;
        const variant = hashByte(this.world, x, z, 1301);
        if (variant > 162) continue;
        const root = new pc.Entity(`Water Glint ${x},${z}`);
        const base = worldPosition(this.world, x, z);
        root.setPosition(base.x, 0.041, base.z);
        root.setEulerAngles(0, variant * 1.7, 0);
        const width = 0.42 + (variant / 255) * 0.32;
        addPrimitive(root, 'box', 'Water Highlight A', [-0.16, 0, 0], [width, 0.008, 0.025], this.waterGlintMaterial, [0, 14, 0]);
        addPrimitive(root, 'box', 'Water Highlight B', [0.2, 0.001, 0.15], [width * 0.62, 0.007, 0.018], this.waterGlintMaterial, [0, -9, 0]);
        this.register(root, x, z);
        groups += 1;
      }
    }
  }
}
