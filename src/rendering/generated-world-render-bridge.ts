import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import { SurfaceType, type TerrainState } from '../simulation/terrain-state';
import { BiomeType, TerrainType, type GeneratedWorld, type GridPoint } from '../world/world-definition';
import { createEnvironmentVisualLayout, type EnvironmentVisualProp } from './environment-visual-layout';

interface RowRun {
  row: number;
  startColumn: number;
  endColumn: number;
}

type PrimitiveType = 'box' | 'plane' | 'cylinder' | 'capsule' | 'sphere';

function createMaterial(color: pc.Color, emissive?: pc.Color, opacity = 1): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.metalness = 0.015;
  material.gloss = 0.24;
  material.opacity = opacity;
  if (opacity < 1) {
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
  }
  if (emissive) {
    material.emissive = emissive;
    material.emissiveIntensity = 1.05;
  }
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
  rotationY = 0,
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type, material, castShadows: false, receiveShadows: false });
  entity.setPosition(position);
  entity.setLocalScale(scale);
  if (rotationY !== 0) entity.setEulerAngles(0, rotationY, 0);
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

function originMetres(cellCount: number): number {
  return -Math.floor((cellCount * WORLD_UNITS_PER_METER) / 2) / WORLD_UNITS_PER_METER;
}

function inBounds(world: GeneratedWorld, x: number, z: number): boolean {
  return x >= 0 && z >= 0 && x < world.width && z < world.height;
}

function cellIndex(world: GeneratedWorld, x: number, z: number): number {
  return z * world.width + x;
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

function waterDirection(world: GeneratedWorld, x: number, z: number): readonly [number, number] | null {
  let dx = 0;
  let dz = 0;
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (const [offsetX, offsetZ] of neighbors) {
    const nx = x + offsetX;
    const nz = z + offsetZ;
    if (!inBounds(world, nx, nz)) continue;
    if (world.terrain[cellIndex(world, nx, nz)] === TerrainType.WATER) {
      dx += offsetX;
      dz += offsetZ;
    }
  }
  if (dx === 0 && dz === 0) return null;
  return [dx, dz];
}

function propBaseY(kind: EnvironmentVisualProp['kind']): number {
  if (kind === 'RIVER_REED') return 0.046;
  if (kind === 'RIVER_BANK_STONE') return 0.034;
  if (kind === 'ROUTE_EDGE_POST') return 0.03;
  return 0.024;
}

function routeDirection(from: GridPoint, to: GridPoint): readonly [number, number] {
  return [Math.sign(to.x - from.x), Math.sign(to.z - from.z)];
}

export class GeneratedWorldRenderBridge {
  private readonly staticEntities: pc.Entity[] = [];
  private readonly iceEntities: pc.Entity[] = [];

  private readonly groundMaterial = createMaterial(new pc.Color(0.19, 0.285, 0.17));
  private readonly groundAccentMaterial = createMaterial(new pc.Color(0.235, 0.325, 0.19), undefined, 0.12);
  private readonly woodlandTintA = createMaterial(new pc.Color(0.095, 0.205, 0.09), undefined, 0.18);
  private readonly woodlandTintB = createMaterial(new pc.Color(0.12, 0.23, 0.10), undefined, 0.15);
  private readonly highlandTintA = createMaterial(new pc.Color(0.34, 0.33, 0.275), undefined, 0.16);
  private readonly highlandTintB = createMaterial(new pc.Color(0.39, 0.365, 0.30), undefined, 0.13);
  private readonly riverBankMaterial = createMaterial(new pc.Color(0.285, 0.285, 0.19), undefined, 0.52);
  private readonly routeShoulderMaterial = createMaterial(new pc.Color(0.34, 0.305, 0.22));
  private readonly routeMaterial = createMaterial(new pc.Color(0.41, 0.345, 0.225));
  private readonly riverMaterial = createMaterial(
    new pc.Color(0.055, 0.255, 0.39),
    new pc.Color(0.008, 0.055, 0.09),
  );
  private readonly riverHighlightMaterial = createMaterial(
    new pc.Color(0.12, 0.43, 0.59),
    new pc.Color(0.015, 0.08, 0.13),
    0.25,
  );
  private readonly crossingMaterial = createMaterial(new pc.Color(0.44, 0.32, 0.18));
  private readonly iceMaterial = createMaterial(
    new pc.Color(0.58, 0.88, 0.96),
    new pc.Color(0.12, 0.34, 0.42),
    0.86,
  );

  private readonly trunkMaterial = createMaterial(new pc.Color(0.17, 0.1, 0.055));
  private readonly canopyMaterial = createMaterial(new pc.Color(0.05, 0.275, 0.09));
  private readonly canopyLightMaterial = createMaterial(new pc.Color(0.10, 0.365, 0.135));
  private readonly rockMaterial = createMaterial(new pc.Color(0.36, 0.365, 0.335));
  private readonly rockLightMaterial = createMaterial(new pc.Color(0.46, 0.45, 0.39));
  private readonly reedMaterial = createMaterial(new pc.Color(0.34, 0.5, 0.19));
  private readonly scrubMaterial = createMaterial(new pc.Color(0.23, 0.35, 0.145));
  private readonly scrubLightMaterial = createMaterial(new pc.Color(0.32, 0.405, 0.175));
  private readonly dryGrassMaterial = createMaterial(new pc.Color(0.45, 0.405, 0.2));
  private readonly routePostMaterial = createMaterial(new pc.Color(0.27, 0.175, 0.095));
  private readonly supplyMaterial = createMaterial(new pc.Color(0.34, 0.215, 0.11));
  private readonly supplyBandMaterial = createMaterial(new pc.Color(0.32, 0.325, 0.3));

  private lastIceCount = -1;
  private lastNavVersion = -1;

  constructor(
    private readonly app: pc.Application,
    private readonly world: GeneratedWorld,
    private readonly terrain: TerrainState,
  ) {
    this.renderStaticTerrain();
    this.renderVisualProps();
  }

  sync(navVersion: number, iceCount: number): void {
    if (navVersion === this.lastNavVersion && iceCount === this.lastIceCount) return;
    this.lastNavVersion = navVersion;
    this.lastIceCount = iceCount;
    this.rebuildIceOverlay();
  }

  destroy(): void {
    for (const entity of this.iceEntities) entity.destroy();
    this.iceEntities.length = 0;
    for (const entity of this.staticEntities) entity.destroy();
    this.staticEntities.length = 0;
    for (const material of [
      this.groundMaterial,
      this.groundAccentMaterial,
      this.woodlandTintA,
      this.woodlandTintB,
      this.highlandTintA,
      this.highlandTintB,
      this.riverBankMaterial,
      this.routeShoulderMaterial,
      this.routeMaterial,
      this.riverMaterial,
      this.riverHighlightMaterial,
      this.crossingMaterial,
      this.iceMaterial,
      this.trunkMaterial,
      this.canopyMaterial,
      this.canopyLightMaterial,
      this.rockMaterial,
      this.rockLightMaterial,
      this.reedMaterial,
      this.scrubMaterial,
      this.scrubLightMaterial,
      this.dryGrassMaterial,
      this.routePostMaterial,
      this.supplyMaterial,
      this.supplyBandMaterial,
    ]) material.destroy();
  }

  private renderStaticTerrain(): void {
    const originX = originMetres(this.world.width);
    const originZ = originMetres(this.world.height);

    this.staticEntities.push(addPrimitive(
      this.app,
      'plane',
      'Generated Ground',
      new pc.Vec3(0, 0, 0),
      new pc.Vec3(this.world.width, 1, this.world.height),
      this.groundMaterial,
    ));

    this.renderBiomeTintPatches(originX, originZ);
    this.renderWater(originX, originZ);
    this.renderShorelineSoftening(originX, originZ);
    this.renderRoutes(originX, originZ);
    this.renderCrossings(originX, originZ);
  }

  private renderBiomeTintPatches(originX: number, originZ: number): void {
    let plainsPatches = 0;
    let woodlandPatches = 0;
    let highlandPatches = 0;

    for (let z = 3; z < this.world.height - 3; z += 7) {
      for (let x = 3; x < this.world.width - 3; x += 7) {
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND) continue;

        const biome = this.world.biome[index] as BiomeType;
        const variant = this.world.visualVariant[index] ?? 0;
        const neighbors = sameBiomeNeighborCount(this.world, x, z, biome);
        const jitterX = (((variant & 15) / 15) - 0.5) * 2.2;
        const jitterZ = ((((variant >> 4) & 15) / 15) - 0.5) * 2.2;
        const rotation = (variant * 41) % 180;

        let material: pc.Material | null = null;
        let width = 0;
        let depth = 0;
        let y = 0.008;
        let label = '';

        if (biome === BiomeType.WOODLAND && neighbors >= 6 && variant < 150 && woodlandPatches < 24) {
          material = (variant & 1) === 0 ? this.woodlandTintA : this.woodlandTintB;
          width = 1.65 + (variant % 5) * 0.16;
          depth = 1.15 + ((variant >> 3) % 5) * 0.13;
          y = 0.010;
          label = 'Woodland Ground Variation';
          woodlandPatches += 1;
        } else if (biome === BiomeType.HIGHLANDS && neighbors >= 6 && variant < 138 && highlandPatches < 20) {
          material = (variant & 1) === 0 ? this.highlandTintA : this.highlandTintB;
          width = 1.85 + (variant % 5) * 0.17;
          depth = 1.22 + ((variant >> 3) % 5) * 0.14;
          y = 0.009;
          label = 'Highland Ground Variation';
          highlandPatches += 1;
        } else if (biome === BiomeType.PLAINS && (variant % 13) === 0 && plainsPatches < 10) {
          material = this.groundAccentMaterial;
          width = 1.35 + (variant % 5) * 0.14;
          depth = 0.86 + ((variant >> 2) % 5) * 0.10;
          y = 0.006;
          label = 'Plains Ground Variation';
          plainsPatches += 1;
        }

        if (!material) continue;
        this.staticEntities.push(addPrimitive(
          this.app,
          'cylinder',
          `${label} ${x},${z}`,
          new pc.Vec3(originX + x + 0.5 + jitterX, y, originZ + z + 0.5 + jitterZ),
          new pc.Vec3(width, 0.006, depth),
          material,
          rotation,
        ));
      }
    }
  }

  private renderWater(originX: number, originZ: number): void {
    this.renderRuns(
      runsForGrid(this.world.width, this.world.height, (index) => this.world.terrain[index] === TerrainType.WATER),
      originX,
      originZ,
      0.033,
      'Generated River',
      this.riverMaterial,
      1,
    );
    this.renderRuns(
      runsForGrid(this.world.width, this.world.height, (index) => this.world.terrain[index] === TerrainType.WATER),
      originX,
      originZ,
      0.041,
      'Generated River Highlight',
      this.riverHighlightMaterial,
      0.82,
    );
  }

  private renderShorelineSoftening(originX: number, originZ: number): void {
    let count = 0;
    for (let z = 1; z < this.world.height - 1; z += 1) {
      for (let x = 1; x < this.world.width - 1; x += 1) {
        if (count >= 60) return;
        const index = cellIndex(this.world, x, z);
        if (this.world.terrain[index] !== TerrainType.GROUND) continue;
        const direction = waterDirection(this.world, x, z);
        if (!direction) continue;
        const variant = this.world.visualVariant[index] ?? 0;
        if ((variant & 3) >= 2) continue;

        const [waterX, waterZ] = direction;
        const magnitude = Math.max(1, Math.abs(waterX) + Math.abs(waterZ));
        const shiftX = (waterX / magnitude) * 0.18;
        const shiftZ = (waterZ / magnitude) * 0.18;
        const rotation = Math.atan2(waterZ, waterX) * 180 / Math.PI;
        const longAxis = 0.78 + (variant % 4) * 0.06;

        this.staticEntities.push(addPrimitive(
          this.app,
          'cylinder',
          `Soft River Bank ${x},${z}`,
          new pc.Vec3(originX + x + 0.5 + shiftX, 0.017, originZ + z + 0.5 + shiftZ),
          new pc.Vec3(longAxis, 0.006, 0.31),
          this.riverBankMaterial,
          rotation,
        ));
        count += 1;
      }
    }
  }

  private renderRoutes(originX: number, originZ: number): void {
    const renderedSections = new Set<string>();
    let sectionIndex = 0;

    for (const route of this.world.routes) {
      const path = route.path;
      if (path.length === 0) continue;
      if (path.length === 1) {
        const point = path[0]!;
        this.renderRouteSection(originX, originZ, point, point, route.widthCells, sectionIndex++);
        continue;
      }

      let startIndex = 0;
      let direction = routeDirection(path[0]!, path[1]!);
      for (let index = 2; index <= path.length; index += 1) {
        const nextDirection = index < path.length ? routeDirection(path[index - 1]!, path[index]!) : null;
        if (nextDirection && nextDirection[0] === direction[0] && nextDirection[1] === direction[1]) continue;

        const start = path[startIndex]!;
        const end = path[index - 1]!;
        const key = `${start.x},${start.z}:${end.x},${end.z}`;
        const reverseKey = `${end.x},${end.z}:${start.x},${start.z}`;
        if (!renderedSections.has(key) && !renderedSections.has(reverseKey)) {
          this.renderRouteSection(originX, originZ, start, end, route.widthCells, sectionIndex++);
          renderedSections.add(key);
        }

        startIndex = index - 1;
        if (nextDirection) direction = nextDirection;
      }
    }
  }

  private renderRouteSection(
    originX: number,
    originZ: number,
    start: GridPoint,
    end: GridPoint,
    widthCells: number,
    index: number,
  ): void {
    const startX = originX + start.x + 0.5;
    const startZ = originZ + start.z + 0.5;
    const endX = originX + end.x + 0.5;
    const endZ = originZ + end.z + 0.5;
    const dx = endX - startX;
    const dz = endZ - startZ;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const coreWidth = 0.48 + Math.min(0.22, Math.max(1, widthCells) * 0.07);
    const shoulderWidth = coreWidth + 0.18;

    if (distance < 0.001) {
      this.staticEntities.push(addPrimitive(
        this.app,
        'cylinder',
        `Route Shoulder Joint ${index}`,
        new pc.Vec3(startX, 0.019, startZ),
        new pc.Vec3(shoulderWidth, 0.010, shoulderWidth),
        this.routeShoulderMaterial,
      ));
      this.staticEntities.push(addPrimitive(
        this.app,
        'cylinder',
        `Route Core Joint ${index}`,
        new pc.Vec3(startX, 0.024, startZ),
        new pc.Vec3(coreWidth, 0.008, coreWidth),
        this.routeMaterial,
      ));
      return;
    }

    const angle = Math.atan2(dx, dz) * 180 / Math.PI;
    const centreX = (startX + endX) * 0.5;
    const centreZ = (startZ + endZ) * 0.5;
    const length = distance + 0.58;

    this.staticEntities.push(addPrimitive(
      this.app,
      'box',
      `Route Shoulder ${index}`,
      new pc.Vec3(centreX, 0.019, centreZ),
      new pc.Vec3(shoulderWidth, 0.009, length),
      this.routeShoulderMaterial,
      angle,
    ));
    this.staticEntities.push(addPrimitive(
      this.app,
      'box',
      `Route Core ${index}`,
      new pc.Vec3(centreX, 0.024, centreZ),
      new pc.Vec3(coreWidth, 0.007, length * 0.99),
      this.routeMaterial,
      angle,
    ));
  }

  private renderCrossings(originX: number, originZ: number): void {
    for (const run of runsForGrid(
      this.world.width,
      this.world.height,
      (index) => this.world.terrain[index] === TerrainType.CROSSING,
    )) {
      const widthCells = run.endColumn - run.startColumn + 1;
      this.staticEntities.push(addPrimitive(
        this.app,
        'box',
        `Generated Crossing ${run.row}:${run.startColumn}-${run.endColumn}`,
        new pc.Vec3(originX + run.startColumn + widthCells / 2, 0.055, originZ + run.row + 0.5),
        new pc.Vec3(widthCells, 0.08, 1),
        this.crossingMaterial,
      ));
    }
  }

  private renderVisualProps(): void {
    const originX = originMetres(this.world.width);
    const originZ = originMetres(this.world.height);
    const layout = createEnvironmentVisualLayout(this.world);

    for (const prop of layout) {
      if (!this.shouldRenderProp(prop)) continue;
      const root = new pc.Entity(`${prop.kind} ${prop.cellX},${prop.cellZ}`);
      root.setPosition(
        originX + prop.cellX + 0.5 + prop.offsetX,
        propBaseY(prop.kind),
        originZ + prop.cellZ + 0.5 + prop.offsetZ,
      );
      root.setEulerAngles(0, prop.rotationDegrees, 0);
      this.app.root.addChild(root);
      this.staticEntities.push(root);
      this.populateVisualProp(root, prop);
    }
  }

  private shouldRenderProp(prop: EnvironmentVisualProp): boolean {
    if (prop.kind === 'WOODLAND_GROVE') return prop.variant < 210;
    if (prop.kind === 'WOODLAND_EDGE') return prop.variant < 182;
    if (prop.kind === 'HIGHLAND_RIDGE') return prop.variant < 132;
    if (prop.kind === 'HIGHLAND_ROCK') return prop.variant < 96;
    if (prop.kind === 'PLAINS_STONE') return prop.variant < 118;
    return true;
  }

  private populateVisualProp(root: pc.Entity, prop: EnvironmentVisualProp): void {
    const scale = prop.scale;

    if (prop.kind === 'WOODLAND_GROVE' || prop.kind === 'WOODLAND_EDGE') {
      const offsets = prop.kind === 'WOODLAND_GROVE'
        ? [[-0.34, -0.18, 1.04], [0.27, 0.10, 0.98], [-0.04, 0.34, 0.88], [0.22, -0.30, 0.80], [-0.34, 0.30, 0.72]] as const
        : [[-0.12, 0, 0.98], [0.24, 0.18, 0.72]] as const;
      for (const [offsetX, offsetZ, treeScale] of offsets) {
        const localScale = scale * treeScale;
        addChildPrimitive(
          root,
          'cylinder',
          'Tree Trunk',
          new pc.Vec3(offsetX * scale, 0.42 * localScale, offsetZ * scale),
          new pc.Vec3(0.12 * localScale, 0.8 * localScale, 0.12 * localScale),
          this.trunkMaterial,
        );
        addChildPrimitive(
          root,
          'sphere',
          'Tree Crown',
          new pc.Vec3(offsetX * scale, 1.08 * localScale, offsetZ * scale),
          new pc.Vec3(0.64 * localScale, 0.76 * localScale, 0.64 * localScale),
          ((prop.variant + Math.round(offsetX * 100)) & 1) === 0 ? this.canopyMaterial : this.canopyLightMaterial,
        );
      }
      if (prop.kind === 'WOODLAND_EDGE') {
        addChildPrimitive(
          root,
          'sphere',
          'Forest Edge Understory',
          new pc.Vec3(0.34 * scale, 0.085 * scale, -0.22 * scale),
          new pc.Vec3(0.42 * scale, 0.15 * scale, 0.27 * scale),
          this.scrubMaterial,
        );
      }
      return;
    }

    if (prop.kind === 'HIGHLAND_RIDGE' || prop.kind === 'HIGHLAND_ROCK') {
      addChildPrimitive(
        root,
        'box',
        'Highland Rock',
        new pc.Vec3(-0.08 * scale, 0.2 * scale, 0),
        new pc.Vec3(0.72 * scale, 0.38 * scale, 0.58 * scale),
        prop.variant < 128 ? this.rockMaterial : this.rockLightMaterial,
        new pc.Vec3(7, 18, 6),
      );
      if (prop.kind === 'HIGHLAND_RIDGE' || prop.variant > 175) {
        addChildPrimitive(
          root,
          'box',
          'Highland Ridge Stone',
          new pc.Vec3(0.42 * scale, 0.14 * scale, -0.2 * scale),
          new pc.Vec3(0.42 * scale, 0.26 * scale, 0.3 * scale),
          this.rockLightMaterial,
          new pc.Vec3(-5, -24, 9),
        );
      }
      if (prop.kind === 'HIGHLAND_RIDGE') {
        addChildPrimitive(
          root,
          'sphere',
          'Highland Dry Grass',
          new pc.Vec3(-0.38 * scale, 0.06 * scale, 0.27 * scale),
          new pc.Vec3(0.3 * scale, 0.11 * scale, 0.2 * scale),
          this.dryGrassMaterial,
        );
      }
      return;
    }

    if (prop.kind === 'PLAINS_SCRUB' || prop.kind === 'BIOME_EDGE_SCRUB') {
      addChildPrimitive(
        root,
        'sphere',
        prop.kind === 'PLAINS_SCRUB' ? 'Plains Scrub' : 'Biome Edge Scrub',
        new pc.Vec3(0, 0.09 * scale, 0),
        new pc.Vec3((prop.kind === 'BIOME_EDGE_SCRUB' ? 0.4 : 0.31) * scale, 0.16 * scale, 0.23 * scale),
        prop.variant < 136 ? this.scrubMaterial : this.scrubLightMaterial,
      );
      if (prop.kind === 'BIOME_EDGE_SCRUB') {
        addChildPrimitive(
          root,
          'sphere',
          'Edge Grass',
          new pc.Vec3(0.29 * scale, 0.05 * scale, -0.14 * scale),
          new pc.Vec3(0.2 * scale, 0.08 * scale, 0.14 * scale),
          this.dryGrassMaterial,
        );
      }
      return;
    }

    if (prop.kind === 'PLAINS_STONE' || prop.kind === 'BIOME_EDGE_STONE' || prop.kind === 'RIVER_BANK_STONE') {
      addChildPrimitive(
        root,
        'box',
        prop.kind === 'RIVER_BANK_STONE' ? 'River Bank Stone' : 'Ground Stone',
        new pc.Vec3(0, 0.07 * scale, 0),
        new pc.Vec3((prop.kind === 'BIOME_EDGE_STONE' ? 0.34 : 0.26) * scale, 0.12 * scale, 0.19 * scale),
        prop.variant < 128 ? this.rockMaterial : this.rockLightMaterial,
        new pc.Vec3(4, 22, 5),
      );
      if (prop.kind === 'RIVER_BANK_STONE') {
        addChildPrimitive(
          root,
          'sphere',
          'River Bank Grass',
          new pc.Vec3(0.24 * scale, 0.055 * scale, -0.1 * scale),
          new pc.Vec3(0.18 * scale, 0.1 * scale, 0.13 * scale),
          this.reedMaterial,
        );
      }
      return;
    }

    if (prop.kind === 'ROUTE_EDGE_POST') {
      addChildPrimitive(
        root,
        'cylinder',
        'Route Waypost',
        new pc.Vec3(0, 0.24 * scale, 0),
        new pc.Vec3(0.065 * scale, 0.46 * scale, 0.065 * scale),
        this.routePostMaterial,
      );
      addChildPrimitive(
        root,
        'box',
        'Route Waypost Cap',
        new pc.Vec3(0, 0.46 * scale, 0),
        new pc.Vec3(0.16 * scale, 0.08 * scale, 0.12 * scale),
        this.rockLightMaterial,
      );
      return;
    }

    if (prop.kind === 'SETTLEMENT_SUPPLIES') {
      addChildPrimitive(
        root,
        'box',
        'Supply Crate A',
        new pc.Vec3(-0.16 * scale, 0.12 * scale, 0),
        new pc.Vec3(0.36 * scale, 0.24 * scale, 0.31 * scale),
        this.supplyMaterial,
      );
      addChildPrimitive(
        root,
        'box',
        'Supply Crate B',
        new pc.Vec3(0.2 * scale, 0.085 * scale, 0.12 * scale),
        new pc.Vec3(0.26 * scale, 0.17 * scale, 0.23 * scale),
        this.supplyMaterial,
        new pc.Vec3(0, 18, 0),
      );
      addChildPrimitive(
        root,
        'box',
        'Supply Band',
        new pc.Vec3(-0.16 * scale, 0.14 * scale, 0),
        new pc.Vec3(0.06 * scale, 0.26 * scale, 0.33 * scale),
        this.supplyBandMaterial,
      );
      return;
    }

    if (prop.kind === 'RESOURCE_FRINGE') {
      addChildPrimitive(root, 'sphere', 'Resource Fringe Stone A', new pc.Vec3(-0.17 * scale, 0.055 * scale, 0.06 * scale), new pc.Vec3(0.2 * scale, 0.1 * scale, 0.15 * scale), this.rockMaterial);
      addChildPrimitive(root, 'sphere', 'Resource Fringe Stone B', new pc.Vec3(0.18 * scale, 0.045 * scale, -0.12 * scale), new pc.Vec3(0.15 * scale, 0.08 * scale, 0.12 * scale), this.rockLightMaterial);
      addChildPrimitive(root, 'sphere', 'Resource Fringe Grass', new pc.Vec3(0.04 * scale, 0.04 * scale, 0.19 * scale), new pc.Vec3(0.17 * scale, 0.07 * scale, 0.12 * scale), this.dryGrassMaterial);
      return;
    }

    if (prop.kind === 'POI_FRINGE') {
      if (prop.variant < 128) {
        addChildPrimitive(
          root,
          'box',
          'POI Broken Stone',
          new pc.Vec3(0, 0.09 * scale, 0),
          new pc.Vec3(0.36 * scale, 0.18 * scale, 0.23 * scale),
          this.rockMaterial,
          new pc.Vec3(12, 31, 18),
        );
      } else {
        addChildPrimitive(root, 'cylinder', 'POI Boundary Stake', new pc.Vec3(0, 0.2 * scale, 0), new pc.Vec3(0.055 * scale, 0.38 * scale, 0.055 * scale), this.routePostMaterial);
        addChildPrimitive(root, 'box', 'POI Stake Marker', new pc.Vec3(0.09 * scale, 0.34 * scale, 0), new pc.Vec3(0.2 * scale, 0.08 * scale, 0.06 * scale), this.supplyBandMaterial);
      }
      return;
    }

    for (let index = 0; index < 3; index += 1) {
      const lateral = (index - 1) * 0.13 * scale;
      const forward = ((prop.variant + index * 47) % 5 - 2) * 0.035 * scale;
      addChildPrimitive(
        root,
        'cylinder',
        `River Reed ${index + 1}`,
        new pc.Vec3(lateral, (0.22 + index * 0.035) * scale, forward),
        new pc.Vec3(0.035 * scale, (0.42 + index * 0.07) * scale, 0.035 * scale),
        this.reedMaterial,
      );
    }
  }

  private renderRuns(
    runs: readonly RowRun[],
    originX: number,
    originZ: number,
    y: number,
    label: string,
    material: pc.Material,
    scaleFactor: number,
  ): void {
    for (const run of runs) {
      const widthCells = run.endColumn - run.startColumn + 1;
      this.staticEntities.push(addPrimitive(
        this.app,
        'plane',
        `${label} ${run.row}:${run.startColumn}-${run.endColumn}`,
        new pc.Vec3(originX + run.startColumn + widthCells / 2, y, originZ + run.row + 0.5),
        new pc.Vec3(widthCells * scaleFactor, 1, scaleFactor),
        material,
      ));
    }
  }

  private rebuildIceOverlay(): void {
    for (const entity of this.iceEntities) entity.destroy();
    this.iceEntities.length = 0;
    if (this.lastIceCount <= 0) return;

    const originX = originMetres(this.world.width);
    const originZ = originMetres(this.world.height);
    const runs = runsForGrid(
      this.world.width,
      this.world.height,
      (index) => this.terrain.surface[index] === SurfaceType.ICE,
    );
    for (const run of runs) {
      const widthCells = run.endColumn - run.startColumn + 1;
      this.iceEntities.push(addPrimitive(
        this.app,
        'plane',
        `Generated Ice ${run.row}:${run.startColumn}-${run.endColumn}`,
        new pc.Vec3(originX + run.startColumn + widthCells / 2, 0.046, originZ + run.row + 0.5),
        new pc.Vec3(widthCells, 1, 1),
        this.iceMaterial,
      ));
    }
  }
}
