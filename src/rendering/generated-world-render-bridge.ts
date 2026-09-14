import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import { SurfaceType, type TerrainState } from '../simulation/terrain-state';
import { BiomeType, TerrainType, WorldCellFlag, type GeneratedWorld } from '../world/world-definition';
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
  material.metalness = 0.02;
  material.gloss = 0.28;
  material.opacity = opacity;
  if (opacity < 1) material.blendType = pc.BLEND_NORMAL;
  if (emissive) {
    material.emissive = emissive;
    material.emissiveIntensity = 1.15;
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
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type, material, castShadows: false, receiveShadows: false });
  entity.setPosition(position);
  entity.setLocalScale(scale);
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

function runsForGrid(
  width: number,
  height: number,
  predicate: (index: number) => boolean,
): RowRun[] {
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

function touchesTerrain(world: GeneratedWorld, index: number, terrain: TerrainType): boolean {
  const x = index % world.width;
  const z = Math.floor(index / world.width);
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (const [dx, dz] of neighbors) {
    const nx = x + dx;
    const nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= world.width || nz >= world.height) continue;
    if (world.terrain[nz * world.width + nx] === terrain) return true;
  }
  return false;
}

function propBaseY(kind: EnvironmentVisualProp['kind']): number {
  if (kind === 'RIVER_REED') return 0.045;
  if (kind === 'RIVER_BANK_STONE') return 0.032;
  if (kind === 'ROUTE_EDGE_POST') return 0.028;
  return 0.022;
}

export class GeneratedWorldRenderBridge {
  private readonly staticEntities: pc.Entity[] = [];
  private readonly iceEntities: pc.Entity[] = [];
  private readonly groundMaterial = createMaterial(new pc.Color(0.17, 0.235, 0.145));
  private readonly groundAccentMaterial = createMaterial(new pc.Color(0.235, 0.275, 0.165));
  private readonly woodlandMaterial = createMaterial(new pc.Color(0.085, 0.205, 0.085));
  private readonly woodlandFloorMaterial = createMaterial(new pc.Color(0.14, 0.175, 0.085));
  private readonly highlandMaterial = createMaterial(new pc.Color(0.305, 0.3, 0.255));
  private readonly highlandScreeMaterial = createMaterial(new pc.Color(0.385, 0.365, 0.295));
  private readonly riverBankMaterial = createMaterial(new pc.Color(0.27, 0.255, 0.16));
  private readonly routeShoulderMaterial = createMaterial(new pc.Color(0.235, 0.205, 0.145));
  private readonly routeMaterial = createMaterial(new pc.Color(0.36, 0.305, 0.205));
  private readonly riverMaterial = createMaterial(
    new pc.Color(0.048, 0.22, 0.405),
    new pc.Color(0.008, 0.045, 0.095),
  );
  private readonly riverHighlightMaterial = createMaterial(
    new pc.Color(0.11, 0.38, 0.58),
    new pc.Color(0.015, 0.08, 0.14),
    0.34,
  );
  private readonly crossingMaterial = createMaterial(new pc.Color(0.43, 0.31, 0.17));
  private readonly iceMaterial = createMaterial(
    new pc.Color(0.58, 0.88, 0.96),
    new pc.Color(0.12, 0.34, 0.42),
    0.86,
  );
  private readonly trunkMaterial = createMaterial(new pc.Color(0.16, 0.095, 0.05));
  private readonly canopyMaterial = createMaterial(new pc.Color(0.045, 0.245, 0.085));
  private readonly canopyLightMaterial = createMaterial(new pc.Color(0.09, 0.34, 0.12));
  private readonly rockMaterial = createMaterial(new pc.Color(0.37, 0.375, 0.34));
  private readonly rockLightMaterial = createMaterial(new pc.Color(0.45, 0.445, 0.39));
  private readonly reedMaterial = createMaterial(new pc.Color(0.32, 0.48, 0.19));
  private readonly scrubMaterial = createMaterial(new pc.Color(0.22, 0.34, 0.14));
  private readonly scrubLightMaterial = createMaterial(new pc.Color(0.31, 0.40, 0.17));
  private readonly dryGrassMaterial = createMaterial(new pc.Color(0.43, 0.405, 0.2));
  private readonly routePostMaterial = createMaterial(new pc.Color(0.26, 0.17, 0.09));
  private readonly supplyMaterial = createMaterial(new pc.Color(0.33, 0.205, 0.105));
  private readonly supplyBandMaterial = createMaterial(new pc.Color(0.31, 0.315, 0.29));
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
      this.woodlandMaterial,
      this.woodlandFloorMaterial,
      this.highlandMaterial,
      this.highlandScreeMaterial,
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

    this.renderRuns(
      runsForGrid(
        this.world.width,
        this.world.height,
        (index) => this.world.terrain[index] === TerrainType.GROUND && this.world.biome[index] === BiomeType.HIGHLANDS,
      ),
      originX,
      originZ,
      0.012,
      'Generated Highlands',
      this.highlandMaterial,
    );
    this.renderRuns(
      runsForGrid(
        this.world.width,
        this.world.height,
        (index) => this.world.terrain[index] === TerrainType.GROUND && this.world.biome[index] === BiomeType.WOODLAND,
      ),
      originX,
      originZ,
      0.018,
      'Generated Woodland',
      this.woodlandMaterial,
    );

    this.renderTerrainPatches(originX, originZ);

    this.renderRuns(
      runsForGrid(
        this.world.width,
        this.world.height,
        (index) => this.world.terrain[index] === TerrainType.GROUND && touchesTerrain(this.world, index, TerrainType.WATER),
      ),
      originX,
      originZ,
      0.021,
      'Generated River Bank',
      this.riverBankMaterial,
      0.92,
    );
    this.renderRuns(
      runsForGrid(
        this.world.width,
        this.world.height,
        (index) => this.world.terrain[index] === TerrainType.GROUND && ((this.world.flags[index] ?? 0) & WorldCellFlag.ROUTE) !== 0,
      ),
      originX,
      originZ,
      0.023,
      'Generated Route Shoulder',
      this.routeShoulderMaterial,
      1,
    );
    this.renderRuns(
      runsForGrid(
        this.world.width,
        this.world.height,
        (index) => this.world.terrain[index] === TerrainType.GROUND && ((this.world.flags[index] ?? 0) & WorldCellFlag.ROUTE) !== 0,
      ),
      originX,
      originZ,
      0.027,
      'Generated Route Core',
      this.routeMaterial,
      0.68,
    );
    this.renderRuns(
      runsForGrid(
        this.world.width,
        this.world.height,
        (index) => this.world.terrain[index] === TerrainType.WATER,
      ),
      originX,
      originZ,
      0.035,
      'Generated River',
      this.riverMaterial,
    );
    this.renderRuns(
      runsForGrid(
        this.world.width,
        this.world.height,
        (index) => this.world.terrain[index] === TerrainType.WATER,
      ),
      originX,
      originZ,
      0.043,
      'Generated River Highlight',
      this.riverHighlightMaterial,
      0.84,
    );

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
        new pc.Vec3(
          originX + run.startColumn + widthCells / 2,
          0.055,
          originZ + run.row + 0.5,
        ),
        new pc.Vec3(widthCells, 0.08, 1),
        this.crossingMaterial,
      ));
    }
  }

  private renderTerrainPatches(originX: number, originZ: number): void {
    let plainsCount = 0;
    let woodlandCount = 0;
    let highlandCount = 0;
    for (let z = 4; z < this.world.height - 4; z += 7) {
      for (let x = 4; x < this.world.width - 4; x += 7) {
        const index = z * this.world.width + x;
        if (this.world.terrain[index] !== TerrainType.GROUND) continue;
        if (((this.world.flags[index] ?? 0) & WorldCellFlag.ROUTE) !== 0) continue;
        const variant = this.world.visualVariant[index] ?? 0;
        const biome = this.world.biome[index];
        let material: pc.Material | null = null;
        let y = 0.007;
        let label = '';
        if (biome === BiomeType.PLAINS && variant < 156 && plainsCount < 28) {
          material = this.groundAccentMaterial;
          plainsCount += 1;
          label = 'Plains Ground Patch';
        } else if (biome === BiomeType.WOODLAND && variant < 148 && woodlandCount < 24) {
          material = this.woodlandFloorMaterial;
          woodlandCount += 1;
          y = 0.021;
          label = 'Woodland Floor Patch';
        } else if (biome === BiomeType.HIGHLANDS && variant < 142 && highlandCount < 20) {
          material = this.highlandScreeMaterial;
          highlandCount += 1;
          y = 0.016;
          label = 'Highland Scree Patch';
        }
        if (!material) continue;
        const footprint = 1.65 + (variant / 255) * 1.2;
        const patch = addPrimitive(
          this.app,
          'cylinder',
          `${label} ${x},${z}`,
          new pc.Vec3(originX + x + 0.5, y, originZ + z + 0.5),
          new pc.Vec3(footprint, 0.008, footprint * (0.66 + ((variant >> 5) & 3) * 0.08)),
          material,
        );
        patch.setLocalEulerAngles(0, (variant * 47) % 180, 0);
        this.staticEntities.push(patch);
      }
    }
  }

  private renderVisualProps(): void {
    const originX = originMetres(this.world.width);
    const originZ = originMetres(this.world.height);
    const layout = createEnvironmentVisualLayout(this.world);
    for (const prop of layout) {
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

  private populateVisualProp(root: pc.Entity, prop: EnvironmentVisualProp): void {
    const scale = prop.scale;
    if (prop.kind === 'WOODLAND_GROVE' || prop.kind === 'WOODLAND_EDGE') {
      const treeOffsets = prop.kind === 'WOODLAND_GROVE'
        ? [[-0.28, -0.12, 0.82], [0.24, 0.12, 0.72], [0.03, 0.28, 0.62]] as const
        : [[0, 0, 0.9]] as const;
      for (const [offsetX, offsetZ, treeScale] of treeOffsets) {
        const localScale = scale * treeScale;
        addChildPrimitive(
          root,
          'cylinder',
          'Tree Trunk',
          new pc.Vec3(offsetX * scale, 0.38 * localScale, offsetZ * scale),
          new pc.Vec3(0.12 * localScale, 0.72 * localScale, 0.12 * localScale),
          this.trunkMaterial,
        );
        addChildPrimitive(
          root,
          'sphere',
          'Tree Crown',
          new pc.Vec3(offsetX * scale, 0.98 * localScale, offsetZ * scale),
          new pc.Vec3(0.52 * localScale, 0.65 * localScale, 0.52 * localScale),
          ((prop.variant + Math.round(offsetX * 100)) & 1) === 0 ? this.canopyMaterial : this.canopyLightMaterial,
        );
      }
      if (prop.kind === 'WOODLAND_EDGE') {
        addChildPrimitive(
          root,
          'sphere',
          'Forest Edge Understory',
          new pc.Vec3(0.3 * scale, 0.08 * scale, -0.18 * scale),
          new pc.Vec3(0.34 * scale, 0.14 * scale, 0.22 * scale),
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
          new pc.Vec3(0.26 * scale, 0.1 * scale, 0.18 * scale),
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
        new pc.Vec3((prop.kind === 'BIOME_EDGE_SCRUB' ? 0.38 : 0.3) * scale, 0.16 * scale, 0.22 * scale),
        prop.variant < 136 ? this.scrubMaterial : this.scrubLightMaterial,
      );
      if (prop.kind === 'BIOME_EDGE_SCRUB') {
        addChildPrimitive(
          root,
          'sphere',
          'Edge Grass',
          new pc.Vec3(0.28 * scale, 0.05 * scale, -0.14 * scale),
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
        new pc.Vec3(0.07 * scale, 0.46 * scale, 0.07 * scale),
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
        new pc.Vec3(-0.14 * scale, 0.11 * scale, 0),
        new pc.Vec3(0.32 * scale, 0.22 * scale, 0.28 * scale),
        this.supplyMaterial,
      );
      addChildPrimitive(
        root,
        'box',
        'Supply Crate B',
        new pc.Vec3(0.18 * scale, 0.08 * scale, 0.11 * scale),
        new pc.Vec3(0.24 * scale, 0.16 * scale, 0.22 * scale),
        this.supplyMaterial,
        new pc.Vec3(0, 18, 0),
      );
      addChildPrimitive(
        root,
        'box',
        'Supply Band',
        new pc.Vec3(-0.14 * scale, 0.13 * scale, 0),
        new pc.Vec3(0.06 * scale, 0.24 * scale, 0.3 * scale),
        this.supplyBandMaterial,
      );
      return;
    }

    if (prop.kind === 'RESOURCE_FRINGE') {
      addChildPrimitive(
        root,
        'sphere',
        'Resource Fringe Stone A',
        new pc.Vec3(-0.16 * scale, 0.055 * scale, 0.05 * scale),
        new pc.Vec3(0.19 * scale, 0.1 * scale, 0.15 * scale),
        this.rockMaterial,
      );
      addChildPrimitive(
        root,
        'sphere',
        'Resource Fringe Stone B',
        new pc.Vec3(0.17 * scale, 0.045 * scale, -0.11 * scale),
        new pc.Vec3(0.14 * scale, 0.08 * scale, 0.12 * scale),
        this.rockLightMaterial,
      );
      addChildPrimitive(
        root,
        'sphere',
        'Resource Fringe Grass',
        new pc.Vec3(0.04 * scale, 0.04 * scale, 0.18 * scale),
        new pc.Vec3(0.16 * scale, 0.07 * scale, 0.12 * scale),
        this.dryGrassMaterial,
      );
      return;
    }

    if (prop.kind === 'POI_FRINGE') {
      if (prop.variant < 128) {
        addChildPrimitive(
          root,
          'box',
          'POI Broken Stone',
          new pc.Vec3(0, 0.09 * scale, 0),
          new pc.Vec3(0.34 * scale, 0.18 * scale, 0.22 * scale),
          this.rockMaterial,
          new pc.Vec3(12, 31, 18),
        );
      } else {
        addChildPrimitive(
          root,
          'cylinder',
          'POI Boundary Stake',
          new pc.Vec3(0, 0.2 * scale, 0),
          new pc.Vec3(0.055 * scale, 0.38 * scale, 0.055 * scale),
          this.routePostMaterial,
        );
        addChildPrimitive(
          root,
          'box',
          'POI Stake Marker',
          new pc.Vec3(0.09 * scale, 0.34 * scale, 0),
          new pc.Vec3(0.2 * scale, 0.08 * scale, 0.06 * scale),
          this.supplyBandMaterial,
        );
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
    scaleFactor = 1,
  ): void {
    for (const run of runs) {
      const widthCells = run.endColumn - run.startColumn + 1;
      this.staticEntities.push(addPrimitive(
        this.app,
        'plane',
        `${label} ${run.row}:${run.startColumn}-${run.endColumn}`,
        new pc.Vec3(
          originX + run.startColumn + widthCells / 2,
          y,
          originZ + run.row + 0.5,
        ),
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
        new pc.Vec3(
          originX + run.startColumn + widthCells / 2,
          0.046,
          originZ + run.row + 0.5,
        ),
        new pc.Vec3(widthCells, 1, 1),
        this.iceMaterial,
      ));
    }
  }
}
