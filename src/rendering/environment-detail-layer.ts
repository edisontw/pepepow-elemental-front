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

type PrimitiveType = 'box' | 'cone' | 'cylinder' | 'sphere';

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

function routeDistance(world: GeneratedWorld, x: number, z: number, radius = 2): number {
  for (let distance = 0; distance <= radius; distance += 1) {
    for (let dz = -distance; dz <= distance; dz += 1) {
      for (let dx = -distance; dx <= distance; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== distance) continue;
        const nx = x + dx;
        const nz = z + dz;
        if (!inBounds(world, nx, nz)) continue;
        if (((world.flags[cellIndex(world, nx, nz)] ?? 0) & WorldCellFlag.ROUTE) !== 0) return distance;
      }
    }
  }
  return radius + 1;
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
 * Presentation-only deterministic dressing. All placement derives from world identity
 * and never feeds gameplay RNG, navigation, replay, or authoritative state.
 */
export class EnvironmentDetailLayer {
  private readonly roots: DetailRoot[] = [];
  private readonly lowQuality = new URLSearchParams(window.location.search).get('quality')?.trim().toLowerCase() === 'low';

  private readonly trunkMaterial = createMaterial(new pc.Color(0.105, 0.058, 0.03), 0.08);
  private readonly barkLightMaterial = createMaterial(new pc.Color(0.17, 0.095, 0.045), 0.07);
  private readonly coniferDarkMaterial = createMaterial(new pc.Color(0.018, 0.078, 0.032), 0.07);
  private readonly coniferMidMaterial = createMaterial(new pc.Color(0.03, 0.135, 0.05), 0.07);
  private readonly coniferLightMaterial = createMaterial(new pc.Color(0.055, 0.205, 0.07), 0.07);
  private readonly broadleafMaterial = createMaterial(new pc.Color(0.105, 0.27, 0.085), 0.07);
  private readonly undergrowthMaterial = createMaterial(new pc.Color(0.095, 0.205, 0.065), 0.06);
  private readonly woodlandFloorMaterial = createMaterial(new pc.Color(0.085, 0.095, 0.048), 0.04);
  private readonly needleFloorMaterial = createMaterial(new pc.Color(0.145, 0.12, 0.062), 0.035);
  private readonly mossMaterial = createMaterial(new pc.Color(0.105, 0.16, 0.055), 0.04);
  private readonly plainsFloorMaterial = createMaterial(new pc.Color(0.23, 0.29, 0.12), 0.04);
  private readonly meadowLightMaterial = createMaterial(new pc.Color(0.36, 0.39, 0.16), 0.045);
  private readonly highlandFloorMaterial = createMaterial(new pc.Color(0.31, 0.29, 0.22), 0.05);
  private readonly settlementFloorMaterial = createMaterial(new pc.Color(0.34, 0.27, 0.16), 0.05);
  private readonly mudMaterial = createMaterial(new pc.Color(0.18, 0.16, 0.105), 0.05);
  private readonly rockDarkMaterial = createMaterial(new pc.Color(0.23, 0.23, 0.21), 0.09);
  private readonly rockMidMaterial = createMaterial(new pc.Color(0.33, 0.32, 0.275), 0.09);
  private readonly rockLightMaterial = createMaterial(new pc.Color(0.43, 0.405, 0.335), 0.09);
  private readonly ruinStoneMaterial = createMaterial(new pc.Color(0.355, 0.35, 0.31), 0.07);
  private readonly dryGrassMaterial = createMaterial(new pc.Color(0.39, 0.35, 0.17), 0.06);
  private readonly flowerWhiteMaterial = createMaterial(new pc.Color(0.82, 0.83, 0.68), 0.05);
  private readonly flowerYellowMaterial = createMaterial(new pc.Color(0.82, 0.65, 0.12), 0.05);
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
    this.renderRuinEdges();
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
      this.coniferDarkMaterial,
      this.coniferMidMaterial,
      this.coniferLightMaterial,
      this.broadleafMaterial,
      this.undergrowthMaterial,
      this.woodlandFloorMaterial,
      this.needleFloorMaterial,
      this.mossMaterial,
      this.plainsFloorMaterial,
      this.meadowLightMaterial,
      this.highlandFloorMaterial,
      this.settlementFloorMaterial,
      this.mudMaterial,
      this.rockDarkMaterial,
      this.rockMidMaterial,
      this.rockLightMaterial,
      this.ruinStoneMaterial,
      this.dryGrassMaterial,
      this.flowerWhiteMaterial,
      this.flowerYellowMaterial,
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

  private coniferMaterial(variant: number): pc.Material {
    if (variant % 7 < 2) return this.coniferDarkMaterial;
    if (variant % 7 < 6) return this.coniferMidMaterial;
    return this.coniferLightMaterial;
  }

  private createTallConifer(parent: pc.Entity, name: string, x: number, z: number, scale: number, variant: number): void {
    const trunkHeight = 1.58 * scale;
    addPrimitive(parent, 'cylinder', `${name} Trunk`, [x, trunkHeight * 0.43, z], [0.075 * scale, trunkHeight * 0.86, 0.075 * scale], variant % 3 === 0 ? this.barkLightMaterial : this.trunkMaterial);
    const crown = this.coniferMaterial(variant);
    const tiers = [
      { y: 0.82, w: 0.66, h: 0.7 },
      { y: 1.18, w: 0.56, h: 0.66 },
      { y: 1.5, w: 0.43, h: 0.58 },
      { y: 1.77, w: 0.29, h: 0.48 },
    ] as const;
    for (let tier = 0; tier < tiers.length; tier += 1) {
      const spec = tiers[tier]!;
      const drift = (((variant + tier * 17) % 9) - 4) * 0.012 * scale;
      addPrimitive(parent, 'cone', `${name} Crown ${tier + 1}`, [x + drift, spec.y * scale, z - drift * 0.6], [spec.w * scale, spec.h * scale, spec.w * 0.92 * scale], crown, [0, (variant + tier * 31) % 37 - 18, 0]);
    }
  }

  private createMediumConifer(parent: pc.Entity, name: string, x: number, z: number, scale: number, variant: number): void {
    const trunkHeight = 1.18 * scale;
    addPrimitive(parent, 'cylinder', `${name} Trunk`, [x, trunkHeight * 0.42, z], [0.065 * scale, trunkHeight * 0.84, 0.065 * scale], this.trunkMaterial);
    const crown = this.coniferMaterial(variant + 2);
    addPrimitive(parent, 'cone', `${name} Crown 1`, [x, 0.72 * scale, z], [0.58 * scale, 0.68 * scale, 0.54 * scale], crown, [0, variant % 23 - 11, 0]);
    addPrimitive(parent, 'cone', `${name} Crown 2`, [x + 0.018 * scale, 1.04 * scale, z], [0.43 * scale, 0.59 * scale, 0.4 * scale], crown, [0, (variant + 19) % 29 - 14, 0]);
    addPrimitive(parent, 'cone', `${name} Crown 3`, [x - 0.014 * scale, 1.28 * scale, z], [0.29 * scale, 0.45 * scale, 0.27 * scale], crown, [0, (variant + 7) % 19 - 9, 0]);
  }

  private createSmallConifer(parent: pc.Entity, name: string, x: number, z: number, scale: number, variant: number): void {
    addPrimitive(parent, 'cylinder', `${name} Trunk`, [x, 0.33 * scale, z], [0.045 * scale, 0.62 * scale, 0.045 * scale], this.trunkMaterial);
    const crown = this.coniferMaterial(variant + 4);
    addPrimitive(parent, 'cone', `${name} Crown 1`, [x, 0.54 * scale, z], [0.42 * scale, 0.55 * scale, 0.39 * scale], crown, [0, variant % 27 - 13, 0]);
    addPrimitive(parent, 'cone', `${name} Crown 2`, [x + 0.012 * scale, 0.78 * scale, z], [0.27 * scale, 0.42 * scale, 0.25 * scale], crown, [0, (variant + 11) % 31 - 15, 0]);
  }

  private createShrubAccent(parent: pc.Entity, name: string, x: number, z: number, scale: number, variant: number): void {
    const material = variant % 5 === 0 ? this.broadleafMaterial : this.undergrowthMaterial;
    addPrimitive(parent, 'sphere', `${name} A`, [x, 0.11 * scale, z], [0.34 * scale, 0.17 * scale, 0.28 * scale], material);
    addPrimitive(parent, 'sphere', `${name} B`, [x + 0.2 * scale, 0.13 * scale, z - 0.06 * scale], [0.27 * scale, 0.2 * scale, 0.24 * scale], material);
  }

  private addFlowerScatter(parent: pc.Entity, variant: number): void {
    if (this.lowQuality) return;
    const flowerCount = 3 + (variant % 3);
    for (let flower = 0; flower < flowerCount; flower += 1) {
      const angle = flower * 2.31 + variant * 0.071;
      const radius = 0.2 + ((variant + flower * 23) % 42) / 100;
      const material = (variant + flower) % 3 === 0 ? this.flowerYellowMaterial : this.flowerWhiteMaterial;
      addPrimitive(parent, 'sphere', `Meadow Flower ${flower + 1}`, [Math.cos(angle) * radius, 0.045, Math.sin(angle) * radius * 0.7], [0.045, 0.026, 0.045], material);
    }
  }

  private renderBiomeFloorPatches(): void {
    const maxPatches = this.lowQuality ? 14 : 40;
    let patches = 0;
    for (let z = 2; z < this.world.height - 2 && patches < maxPatches; z += 4) {
      const stagger = (Math.floor(z / 4) & 1) === 0 ? 0 : 2;
      for (let x = 2 + stagger; x < this.world.width - 2 && patches < maxPatches; x += 4) {
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND) continue;
        if (((this.world.flags[index] ?? 0) & WorldCellFlag.ROUTE) !== 0 || isNearSite(this.world, x, z, 1)) continue;
        const variant = hashByte(this.world, x, z, 823);
        if (variant > 205) continue;
        const biome = this.world.biome[index] as BiomeType;
        const root = new pc.Entity(`Biome Ground Dressing ${x},${z}`);
        const base = worldPosition(this.world, x, z);
        const jitterX = (hashByte(this.world, x, z, 827) / 255 - 0.5) * 1.3;
        const jitterZ = (hashByte(this.world, x, z, 829) / 255 - 0.5) * 1.3;
        root.setPosition(base.x + jitterX, 0.0185, base.z + jitterZ);
        root.setEulerAngles(0, variant * 1.63, 0);
        const size = 0.78 + (variant / 255) * 0.46;

        if (biome === BiomeType.WOODLAND) {
          addPrimitive(root, 'cylinder', 'Woodland Moss Patch', [-0.15, 0, 0.05], [1.08 * size, 0.011, 0.76 * size], this.woodlandFloorMaterial);
          addPrimitive(root, 'cylinder', 'Needle Litter Patch', [0.34, 0.002, -0.18], [0.72 * size, 0.009, 0.48 * size], this.needleFloorMaterial);
          if (!this.lowQuality) this.createShrubAccent(root, 'Woodland Low Growth', -0.38, 0.28, 0.68, variant);
          if ((variant & 3) === 0) addPrimitive(root, 'box', 'Woodland Pebble', [0.42, 0.06, 0.2], [0.18, 0.1, 0.14], this.rockDarkMaterial, [5, 24, 8]);
        } else if (biome === BiomeType.HIGHLANDS) {
          addPrimitive(root, 'cylinder', 'Highland Ground Patch', [-0.12, 0, 0.04], [1.08 * size, 0.011, 0.74 * size], this.highlandFloorMaterial);
          addPrimitive(root, 'box', 'Scree Chip A', [-0.42, 0.05, 0.25], [0.2, 0.09, 0.15], this.rockMidMaterial, [6, 23, 7]);
          if (!this.lowQuality) addPrimitive(root, 'box', 'Scree Chip B', [0.37, 0.04, -0.18], [0.14, 0.07, 0.12], this.rockLightMaterial, [-5, -17, 6]);
        } else {
          addPrimitive(root, 'cylinder', 'Meadow Tone Patch', [-0.15, 0, 0.03], [1.18 * size, 0.011, 0.82 * size], variant < 112 ? this.meadowLightMaterial : this.plainsFloorMaterial);
          addPrimitive(root, 'cylinder', 'Dry Grass Patch', [0.4, 0.002, -0.24], [0.62 * size, 0.008, 0.42 * size], this.dryGrassMaterial);
          addPrimitive(root, 'sphere', 'Meadow Grass Clump', [-0.46, 0.052, -0.18], [0.22, 0.08, 0.16], this.undergrowthMaterial);
          this.addFlowerScatter(root, variant);
          if (!this.lowQuality && variant > 128) addPrimitive(root, 'box', 'Meadow Pebble', [0.42, 0.038, 0.25], [0.12, 0.065, 0.1], this.rockMidMaterial, [4, 31, 6]);
        }

        this.register(root, x, z);
        patches += 1;
      }
    }
  }

  private renderForestDepth(): void {
    const maxGroups = this.lowQuality ? 22 : 50;
    let groups = 0;
    for (let z = 2; z < this.world.height - 2 && groups < maxGroups; z += 2) {
      const stagger = (Math.floor(z / 2) & 1) === 0 ? 0 : 1;
      for (let x = 2 + stagger; x < this.world.width - 2 && groups < maxGroups; x += 2) {
        const index = cellIndex(this.world, x, z);
        const flags = this.world.flags[index] ?? 0;
        if (this.world.terrain[index] !== TerrainType.GROUND || this.world.biome[index] !== BiomeType.WOODLAND) continue;
        if ((flags & WorldCellFlag.ROUTE) !== 0 || isNearSite(this.world, x, z, 2)) continue;

        const neighbors = sameBiomeNeighborCount(this.world, x, z, BiomeType.WOODLAND);
        if (neighbors < 2) continue;
        const variant = hashByte(this.world, x, z, 901);
        const patch = hashByte(this.world, Math.floor(x / 5), Math.floor(z / 4), 887);
        const opening = hashByte(this.world, x, z, 889);
        const clearingPatch = hashByte(this.world, Math.floor((x + 1) / 4), Math.floor((z + 2) / 4), 251);
        const edgeDistance = routeDistance(this.world, x, z, 2);
        const clearingLimit = patch < 92 ? 210 : patch < 184 ? 172 : 126;
        if (variant > 246 || opening > clearingLimit || clearingPatch > 232) continue;

        const root = new pc.Entity(`Conifer Grove ${x},${z}`);
        const base = worldPosition(this.world, x, z);
        const routeDirection = edgeDistance === 1 ? directionToRoute(this.world, x, z) : [0, 0] as const;
        const routePush = edgeDistance === 1 ? 0.38 : 0;
        const jitterX = (hashByte(this.world, x, z, 907) / 255 - 0.5) * 1.5 - routeDirection[0] * routePush;
        const jitterZ = (hashByte(this.world, x, z, 911) / 255 - 0.5) * 1.5 - routeDirection[1] * routePush;
        root.setPosition(base.x + jitterX, 0.022, base.z + jitterZ);
        root.setEulerAngles(0, variant * 1.37, 0);

        const contactScale = 0.84 + (variant / 255) * 0.3;
        addPrimitive(root, 'cylinder', 'Forest Moss Contact', [0, -0.004, 0], [1.48 * contactScale, 0.012, 1.02 * contactScale], this.woodlandFloorMaterial);
        addPrimitive(root, 'cylinder', 'Forest Needle Floor', [0.24, -0.002, -0.12], [0.95 * contactScale, 0.009, 0.68 * contactScale], this.needleFloorMaterial);
        if (!this.lowQuality) addPrimitive(root, 'cylinder', 'Forest Moss Pocket', [-0.44, -0.001, 0.28], [0.58, 0.008, 0.43], this.mossMaterial);

        const core = neighbors >= 6 && edgeDistance > 1;
        const edge = neighbors <= 4 || edgeDistance <= 1;
        const treeCount = this.lowQuality ? (edge ? 3 : 4) : (core ? 6 : edge ? 4 : 5);
        for (let tree = 0; tree < treeCount; tree += 1) {
          const angle = tree * 2.39996 + variant * 0.019;
          const radius = tree === 0 ? 0.08 : 0.32 + ((variant + tree * 37) % 76) / 100;
          const tx = Math.cos(angle) * radius;
          const tz = Math.sin(angle) * radius * (0.64 + ((variant + tree * 13) % 28) / 100);
          const treeVariant = hashByte(this.world, x + tree * 3, z + tree, 919);
          const scale = 0.82 + (treeVariant / 255) * 0.38;

          if (edgeDistance <= 1) {
            if (tree === 0 && variant % 4 === 0) this.createMediumConifer(root, `Roadside Conifer ${tree + 1}`, tx, tz, scale * 0.82, treeVariant);
            else if (tree < treeCount - 1) this.createSmallConifer(root, `Forest Edge Sapling ${tree + 1}`, tx, tz, scale * 0.78, treeVariant);
            else this.createShrubAccent(root, `Forest Edge Shrub ${tree + 1}`, tx, tz, 0.82 + scale * 0.16, treeVariant);
          } else if (core && tree < 2) {
            this.createTallConifer(root, `Tall Fir ${tree + 1}`, tx, tz, scale, treeVariant);
          } else if (!edge && tree < 3) {
            this.createMediumConifer(root, `Medium Fir ${tree + 1}`, tx, tz, scale, treeVariant);
          } else if (tree < treeCount - 1 || variant % 5 !== 0) {
            this.createSmallConifer(root, `Young Fir ${tree + 1}`, tx, tz, scale * 0.9, treeVariant);
          } else {
            this.createShrubAccent(root, `Broadleaf Accent ${tree + 1}`, tx, tz, 0.9 + scale * 0.2, treeVariant);
          }
        }

        this.createShrubAccent(root, 'Understory A', -0.5, 0.34, 0.82, variant + 3);
        if (!this.lowQuality) this.createShrubAccent(root, 'Understory B', 0.5, -0.32, 0.72, variant + 9);
        if (!this.lowQuality && (variant & 3) === 0) {
          addPrimitive(root, 'cylinder', 'Fallen Trunk', [0.08, 0.075, 0.56], [0.07, 0.88, 0.07], this.trunkMaterial, [86, 22, 0]);
          addPrimitive(root, 'box', 'Fallen Trunk Stone', [-0.34, 0.07, 0.5], [0.22, 0.12, 0.18], this.rockDarkMaterial, [6, 17, 8]);
        }
        if (!this.lowQuality && variant % 5 === 0) {
          addPrimitive(root, 'box', 'Forest Rock A', [0.44, 0.08, 0.46], [0.32, 0.16, 0.25], this.rockMidMaterial, [7, 21, 6]);
          addPrimitive(root, 'box', 'Forest Rock B', [0.64, 0.05, 0.38], [0.19, 0.1, 0.16], this.rockLightMaterial, [-4, -18, 7]);
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
        addPrimitive(root, 'cylinder', 'River Moss Edge', [0, 0.006, 0.45], [0.76, 0.009, 0.17], this.mossMaterial);
        addPrimitive(root, 'box', 'River Bank Stone', [-0.26, 0.075, 0.03], [0.28, 0.14, 0.2], variant < 128 ? this.rockDarkMaterial : this.rockLightMaterial, [6, 19, 7]);
        if ((variant & 1) === 0) addPrimitive(root, 'box', 'River Bank Stone Small', [0.34, 0.055, 0.16], [0.18, 0.1, 0.14], this.rockMidMaterial, [-4, -24, 8]);
        if (!this.lowQuality) this.createShrubAccent(root, 'River Bank Grass', 0.38, -0.12, 0.65, variant);
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
    const maxGroups = this.lowQuality ? 10 : 30;
    let groups = 0;
    for (let z = 1; z < this.world.height - 1 && groups < maxGroups; z += 3) {
      for (let x = 1; x < this.world.width - 1 && groups < maxGroups; x += 3) {
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND || !touchesRoute(this.world, x, z)) continue;
        if (((this.world.flags[index] ?? 0) & WorldCellFlag.ROUTE) !== 0 || isNearSite(this.world, x, z, 2)) continue;
        const variant = hashByte(this.world, x, z, 991);
        if (variant > 174) continue;

        const root = new pc.Entity(`Route Verge Accent ${x},${z}`);
        const base = worldPosition(this.world, x, z);
        const [routeDx, routeDz] = directionToRoute(this.world, x, z);
        root.setPosition(base.x, 0.024, base.z);
        root.setEulerAngles(0, Math.atan2(routeDx, routeDz) * 180 / Math.PI + ((variant % 13) - 6), 0);
        addPrimitive(root, 'cylinder', 'Route Worn Shoulder', [0, -0.004, 0.14], [0.92, 0.01, 0.34], variant < 110 ? this.mudMaterial : this.settlementFloorMaterial);
        addPrimitive(root, 'cylinder', 'Route Grass Encroachment', [-0.17, -0.002, -0.02], [0.72, 0.008, 0.25], this.plainsFloorMaterial);
        addPrimitive(root, 'sphere', 'Route Verge Grass A', [-0.34, 0.05, 0.2], [0.28, 0.08, 0.18], this.dryGrassMaterial);
        if (!this.lowQuality) addPrimitive(root, 'sphere', 'Route Verge Grass B', [0.28, 0.048, 0.3], [0.22, 0.075, 0.16], this.undergrowthMaterial);
        if ((variant & 3) === 0) {
          addPrimitive(root, 'cylinder', 'Route Edge Post', [0.4, 0.22, -0.04], [0.05, 0.42, 0.05], this.routePostMaterial);
          addPrimitive(root, 'box', 'Route Edge Cap', [0.4, 0.42, -0.04], [0.14, 0.065, 0.1], this.rockLightMaterial, [0, 9, 0]);
        }
        if ((variant & 1) === 0) addPrimitive(root, 'box', 'Route Edge Stone', [0.18, 0.055, -0.2], [0.18, 0.1, 0.14], this.rockDarkMaterial, [4, 27, 6]);
        if (!this.lowQuality && variant % 5 === 0) addPrimitive(root, 'box', 'Route Wheel Stone', [-0.08, 0.034, 0.39], [0.12, 0.06, 0.09], this.rockMidMaterial, [-3, -18, 5]);
        this.register(root, x, z);
        groups += 1;
      }
    }
  }

  private renderSettlementServiceAreas(): void {
    const sites = [
      ...this.world.spawns.map((spawn, index) => ({ cell: spawn.cell, salt: 1103 + index * 41, village: false })),
      ...this.world.pois
        .filter((poi) => poi.type === 'VILLAGE')
        .map((poi, index) => ({ cell: poi.cell, salt: 1201 + index * 37, village: true })),
    ];
    const used = new Set<number>();
    for (const site of sites) {
      const count = this.lowQuality ? 1 : site.village ? 4 : 3;
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
        const root = new pc.Entity(`${site.village ? 'Village Edge' : 'Settlement Service'} ${chosen.x},${chosen.z}`);
        const base = worldPosition(this.world, chosen.x, chosen.z);
        root.setPosition(base.x, 0.023, base.z);
        root.setEulerAngles(0, variant * 1.29, 0);
        addPrimitive(root, 'cylinder', 'Service Ground Wear', [0, 0, 0], [0.92, 0.012, 0.7], this.settlementFloorMaterial);
        if (!this.lowQuality) addPrimitive(root, 'cylinder', 'Service Track Wear', [0.38, 0.001, -0.28], [0.62, 0.009, 0.34], variant < 128 ? this.mudMaterial : this.plainsFloorMaterial);

        if (site.village && item % 2 === 0) {
          addPrimitive(root, 'cylinder', 'Fence Post A', [-0.46, 0.26, 0.08], [0.05, 0.48, 0.05], this.routePostMaterial, [0, 0, -3]);
          addPrimitive(root, 'cylinder', 'Fence Post B', [0.42, 0.23, -0.03], [0.05, 0.42, 0.05], this.routePostMaterial, [0, 0, 4]);
          addPrimitive(root, 'box', 'Fence Rail A', [-0.02, 0.31, 0.04], [0.9, 0.07, 0.07], this.routePostMaterial, [0, -5, 2]);
          if (!this.lowQuality) addPrimitive(root, 'box', 'Fence Rail B', [-0.02, 0.18, 0.04], [0.82, 0.055, 0.055], this.routePostMaterial, [0, -5, -2]);
          this.createShrubAccent(root, 'Fence Bush', 0.5, 0.3, 0.62, variant);
        } else {
          addPrimitive(root, 'box', 'Service Crate A', [-0.22, 0.12, -0.08], [0.36, 0.23, 0.31], this.supplyMaterial, [0, 12, 0]);
          addPrimitive(root, 'box', 'Service Crate B', [0.16, 0.085, 0.2], [0.27, 0.16, 0.23], this.supplyMaterial, [0, -18, 0]);
          addPrimitive(root, 'box', 'Service Crate Band', [-0.22, 0.13, -0.08], [0.055, 0.25, 0.33], this.metalMaterial);
          if (!this.lowQuality || (variant & 1) === 0) {
            addPrimitive(root, 'cylinder', 'Stacked Timber A', [0.4, 0.08, -0.22], [0.06, 0.54, 0.06], this.routePostMaterial, [88, 16, 0]);
            addPrimitive(root, 'cylinder', 'Stacked Timber B', [0.35, 0.11, -0.09], [0.055, 0.46, 0.055], this.routePostMaterial, [86, -9, 0]);
          }
        }
        this.register(root, chosen.x, chosen.z);
      }
    }
  }

  private renderRuinEdges(): void {
    const ruins = this.world.pois.filter((poi) => poi.type === 'ANCIENT_RUIN');
    const used = new Set<number>();
    for (const [ruinIndex, ruin] of ruins.entries()) {
      const count = this.lowQuality ? 2 : 4;
      for (let item = 0; item < count; item += 1) {
        const salt = 1403 + ruinIndex * 71 + item * 17;
        const start = hashByte(this.world, ruin.cell.x, ruin.cell.z, salt) % SERVICE_OFFSETS.length;
        let chosen: GridPoint | null = null;
        for (let step = 0; step < SERVICE_OFFSETS.length; step += 1) {
          const [dx, dz] = SERVICE_OFFSETS[(start + step) % SERVICE_OFFSETS.length]!;
          const x = ruin.cell.x + dx;
          const z = ruin.cell.z + dz;
          if (!isClearGround(this.world, x, z)) continue;
          const index = cellIndex(this.world, x, z);
          if (used.has(index)) continue;
          chosen = { x, z };
          used.add(index);
          break;
        }
        if (!chosen) continue;

        const variant = hashByte(this.world, chosen.x, chosen.z, salt + 11);
        const root = new pc.Entity(`Ruin Gravefield Accent ${chosen.x},${chosen.z}`);
        const base = worldPosition(this.world, chosen.x, chosen.z);
        root.setPosition(base.x, 0.021, base.z);
        root.setEulerAngles(0, variant * 1.47, 0);
        addPrimitive(root, 'cylinder', 'Ruin Dark Ground', [0, -0.002, 0], [0.92, 0.011, 0.72], this.woodlandFloorMaterial);
        addPrimitive(root, 'cylinder', 'Ruin Bare Soil', [0.28, 0, -0.15], [0.58, 0.009, 0.4], this.mudMaterial);
        addPrimitive(root, 'box', 'Standing Grave Marker', [-0.28, 0.28, 0.03], [0.2, 0.52, 0.1], this.ruinStoneMaterial, [0, variant % 17 - 8, variant % 5 - 2]);
        addPrimitive(root, 'box', 'Broken Grave Marker', [0.3, 0.17, -0.16], [0.18, 0.31, 0.1], this.rockMidMaterial, [8, -16, 17]);
        if (!this.lowQuality && item % 2 === 0) {
          addPrimitive(root, 'box', 'Stone Cross Vertical', [0.08, 0.34, 0.34], [0.11, 0.58, 0.09], this.ruinStoneMaterial, [0, -7, 2]);
          addPrimitive(root, 'box', 'Stone Cross Arm', [0.08, 0.41, 0.34], [0.34, 0.09, 0.09], this.ruinStoneMaterial, [0, -7, 2]);
        }
        if (!this.lowQuality) {
          addPrimitive(root, 'cylinder', 'Dead Branch', [-0.1, 0.07, -0.46], [0.045, 0.62, 0.045], this.trunkMaterial, [82, 31, 4]);
          this.createShrubAccent(root, 'Sparse Ruin Weed', -0.46, -0.26, 0.5, variant + 4);
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
