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

function createMaterial(color: pc.Color, gloss = 0.12): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.metalness = 0;
  material.gloss = gloss;
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

/**
 * A restrained second environment layer that adds vertical depth and edge detail
 * without changing navigation or any authoritative world state.
 */
export class EnvironmentDetailLayer {
  private readonly roots: DetailRoot[] = [];

  private readonly trunkMaterial = createMaterial(new pc.Color(0.115, 0.067, 0.035), 0.08);
  private readonly canopyDarkMaterial = createMaterial(new pc.Color(0.024, 0.115, 0.038), 0.08);
  private readonly canopyMidMaterial = createMaterial(new pc.Color(0.045, 0.19, 0.06), 0.08);
  private readonly canopyLightMaterial = createMaterial(new pc.Color(0.075, 0.255, 0.085), 0.08);
  private readonly undergrowthMaterial = createMaterial(new pc.Color(0.105, 0.23, 0.075), 0.06);
  private readonly rockDarkMaterial = createMaterial(new pc.Color(0.25, 0.25, 0.225), 0.09);
  private readonly rockLightMaterial = createMaterial(new pc.Color(0.43, 0.405, 0.335), 0.09);
  private readonly dryGrassMaterial = createMaterial(new pc.Color(0.39, 0.35, 0.17), 0.06);
  private readonly reedMaterial = createMaterial(new pc.Color(0.22, 0.39, 0.12), 0.06);
  private readonly routePostMaterial = createMaterial(new pc.Color(0.22, 0.13, 0.065), 0.07);

  constructor(private readonly app: pc.Application, private readonly world: GeneratedWorld) {
    this.renderForestDepth();
    this.renderRiverBanks();
    this.renderHighlandEdges();
    this.renderRouteEdges();
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
    this.trunkMaterial.destroy();
    this.canopyDarkMaterial.destroy();
    this.canopyMidMaterial.destroy();
    this.canopyLightMaterial.destroy();
    this.undergrowthMaterial.destroy();
    this.rockDarkMaterial.destroy();
    this.rockLightMaterial.destroy();
    this.dryGrassMaterial.destroy();
    this.reedMaterial.destroy();
    this.routePostMaterial.destroy();
  }

  private register(root: pc.Entity, x: number, z: number): void {
    this.app.root.addChild(root);
    this.roots.push({ root, cellIndex: cellIndex(this.world, x, z) });
  }

  private renderForestDepth(): void {
    let groups = 0;
    for (let z = 2; z < this.world.height - 2 && groups < 42; z += 3) {
      const stagger = (Math.floor(z / 3) & 1) === 0 ? 0 : 1;
      for (let x = 2 + stagger; x < this.world.width - 2 && groups < 42; x += 3) {
        const index = cellIndex(this.world, x, z);
        const flags = this.world.flags[index] ?? 0;
        if (this.world.terrain[index] !== TerrainType.GROUND || this.world.biome[index] !== BiomeType.WOODLAND) continue;
        if ((flags & WorldCellFlag.ROUTE) !== 0 || isNearSite(this.world, x, z, 2)) continue;
        const neighbors = sameBiomeNeighborCount(this.world, x, z, BiomeType.WOODLAND);
        const variant = hashByte(this.world, x, z, 901);
        if (neighbors < 4 || variant > 210) continue;

        const root = new pc.Entity(`Forest Depth Accent ${x},${z}`);
        const base = worldPosition(this.world, x, z);
        const jitterX = (hashByte(this.world, x, z, 907) / 255 - 0.5) * 0.95;
        const jitterZ = (hashByte(this.world, x, z, 911) / 255 - 0.5) * 0.95;
        root.setPosition(base.x + jitterX, 0.022, base.z + jitterZ);
        root.setEulerAngles(0, variant * 1.37, 0);

        const treeCount = 3 + (variant % 2);
        for (let tree = 0; tree < treeCount; tree += 1) {
          const angle = tree * 2.39996 + variant * 0.019;
          const radius = tree === 0 ? 0.12 : 0.45 + tree * 0.11;
          const tx = Math.cos(angle) * radius;
          const tz = Math.sin(angle) * radius * 0.78;
          const size = 0.82 + (hashByte(this.world, x + tree, z, 919) / 255) * 0.34;
          const trunkHeight = 0.82 + size * 0.42;
          addPrimitive(
            root,
            'cylinder',
            `Forest Accent Trunk ${tree + 1}`,
            [tx, trunkHeight * 0.43, tz],
            [0.07 * size, trunkHeight * 0.82, 0.07 * size],
            this.trunkMaterial,
          );
          const canopyMaterial = tree % 3 === 0
            ? this.canopyLightMaterial
            : tree % 3 === 1
              ? this.canopyMidMaterial
              : this.canopyDarkMaterial;
          addPrimitive(
            root,
            'sphere',
            `Forest Accent Crown ${tree + 1}`,
            [tx, trunkHeight + 0.25 * size, tz],
            [0.52 * size, 0.64 * size, 0.46 * size],
            canopyMaterial,
          );
          if (tree === 0 || (tree === 1 && variant > 128)) {
            addPrimitive(
              root,
              'sphere',
              `Forest Accent Upper Crown ${tree + 1}`,
              [tx + 0.08 * size, trunkHeight + 0.72 * size, tz - 0.04 * size],
              [0.34 * size, 0.39 * size, 0.31 * size],
              tree === 0 ? this.canopyDarkMaterial : this.canopyMidMaterial,
            );
          }
        }
        addPrimitive(root, 'sphere', 'Forest Accent Understory A', [-0.42, 0.085, 0.32], [0.38, 0.13, 0.28], this.undergrowthMaterial);
        addPrimitive(root, 'sphere', 'Forest Accent Understory B', [0.46, 0.075, -0.28], [0.31, 0.11, 0.24], this.undergrowthMaterial);
        this.register(root, x, z);
        groups += 1;
      }
    }
  }

  private renderRiverBanks(): void {
    let groups = 0;
    for (let z = 1; z < this.world.height - 1 && groups < 30; z += 2) {
      for (let x = 1; x < this.world.width - 1 && groups < 30; x += 2) {
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND || !touchesTerrain(this.world, x, z, TerrainType.WATER)) continue;
        if (((this.world.flags[index] ?? 0) & WorldCellFlag.ROUTE) !== 0) continue;
        const variant = hashByte(this.world, x, z, 941);
        if (variant > 168) continue;

        const root = new pc.Entity(`River Bank Accent ${x},${z}`);
        const base = worldPosition(this.world, x, z);
        root.setPosition(base.x, 0.026, base.z);
        root.setEulerAngles(0, variant * 1.29, 0);
        addPrimitive(root, 'box', 'River Bank Stone', [-0.14, 0.07, 0.02], [0.26, 0.13, 0.19], variant < 128 ? this.rockDarkMaterial : this.rockLightMaterial, [6, 19, 7]);
        for (let reed = 0; reed < 4; reed += 1) {
          const lateral = (reed - 1.5) * 0.09;
          addPrimitive(root, 'cylinder', `River Bank Reed ${reed + 1}`, [0.18 + lateral, 0.18 + reed * 0.018, -0.12 + (reed % 2) * 0.05], [0.022, 0.34 + reed * 0.035, 0.022], this.reedMaterial);
        }
        this.register(root, x, z);
        groups += 1;
      }
    }
  }

  private renderHighlandEdges(): void {
    let groups = 0;
    for (let z = 2; z < this.world.height - 2 && groups < 18; z += 4) {
      for (let x = 2; x < this.world.width - 2 && groups < 18; x += 4) {
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND || this.world.biome[index] !== BiomeType.HIGHLANDS) continue;
        if (isNearSite(this.world, x, z, 2)) continue;
        const variant = hashByte(this.world, x, z, 967);
        if (variant > 174) continue;

        const root = new pc.Entity(`Highland Edge Accent ${x},${z}`);
        const base = worldPosition(this.world, x, z);
        root.setPosition(base.x, 0.02, base.z);
        root.setEulerAngles(0, variant * 1.13, 0);
        addPrimitive(root, 'box', 'Highland Accent Rock A', [-0.2, 0.12, 0.02], [0.6, 0.23, 0.34], this.rockDarkMaterial, [8, 16, 8]);
        addPrimitive(root, 'box', 'Highland Accent Rock B', [0.31, 0.085, -0.18], [0.34, 0.17, 0.25], this.rockLightMaterial, [-6, -24, 11]);
        addPrimitive(root, 'sphere', 'Highland Accent Grass', [-0.28, 0.055, -0.31], [0.25, 0.09, 0.18], this.dryGrassMaterial);
        this.register(root, x, z);
        groups += 1;
      }
    }
  }

  private renderRouteEdges(): void {
    let groups = 0;
    for (let z = 1; z < this.world.height - 1 && groups < 22; z += 3) {
      for (let x = 1; x < this.world.width - 1 && groups < 22; x += 3) {
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND || !touchesRoute(this.world, x, z)) continue;
        if (((this.world.flags[index] ?? 0) & WorldCellFlag.ROUTE) !== 0 || isNearSite(this.world, x, z, 2)) continue;
        const variant = hashByte(this.world, x, z, 991);
        if (variant > 112) continue;

        const root = new pc.Entity(`Route Edge Accent ${x},${z}`);
        const base = worldPosition(this.world, x, z);
        root.setPosition(base.x, 0.024, base.z);
        root.setEulerAngles(0, variant * 1.41, 0);
        addPrimitive(root, 'cylinder', 'Route Edge Post', [0, 0.22, 0], [0.05, 0.42, 0.05], this.routePostMaterial);
        addPrimitive(root, 'box', 'Route Edge Cap', [0, 0.42, 0], [0.14, 0.065, 0.1], this.rockLightMaterial, [0, 9, 0]);
        if ((variant & 1) === 0) {
          addPrimitive(root, 'box', 'Route Edge Stone', [0.25, 0.055, -0.12], [0.18, 0.1, 0.14], this.rockDarkMaterial, [4, 27, 6]);
        }
        this.register(root, x, z);
        groups += 1;
      }
    }
  }
}
