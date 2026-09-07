import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import { SurfaceType, type TerrainState } from '../simulation/terrain-state';
import { BiomeType, TerrainType, type GeneratedWorld } from '../world/world-definition';
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
  entity.addComponent('render', { type, material });
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
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type, material });
  entity.setLocalPosition(position);
  entity.setLocalScale(scale);
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

export class GeneratedWorldRenderBridge {
  private readonly staticEntities: pc.Entity[] = [];
  private readonly iceEntities: pc.Entity[] = [];
  private readonly groundMaterial = createMaterial(new pc.Color(0.125, 0.215, 0.15));
  private readonly woodlandMaterial = createMaterial(new pc.Color(0.07, 0.255, 0.095));
  private readonly highlandMaterial = createMaterial(new pc.Color(0.32, 0.325, 0.285));
  private readonly riverMaterial = createMaterial(
    new pc.Color(0.048, 0.22, 0.405),
    new pc.Color(0.008, 0.045, 0.095),
  );
  private readonly crossingMaterial = createMaterial(new pc.Color(0.43, 0.31, 0.17));
  private readonly iceMaterial = createMaterial(
    new pc.Color(0.58, 0.88, 0.96),
    new pc.Color(0.12, 0.34, 0.42),
    0.86,
  );
  private readonly trunkMaterial = createMaterial(new pc.Color(0.16, 0.095, 0.05));
  private readonly canopyMaterial = createMaterial(new pc.Color(0.055, 0.31, 0.105));
  private readonly canopyLightMaterial = createMaterial(new pc.Color(0.09, 0.38, 0.13));
  private readonly rockMaterial = createMaterial(new pc.Color(0.37, 0.375, 0.34));
  private readonly rockLightMaterial = createMaterial(new pc.Color(0.45, 0.445, 0.39));
  private readonly reedMaterial = createMaterial(new pc.Color(0.32, 0.48, 0.19));
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
      this.woodlandMaterial,
      this.highlandMaterial,
      this.riverMaterial,
      this.crossingMaterial,
      this.iceMaterial,
      this.trunkMaterial,
      this.canopyMaterial,
      this.canopyLightMaterial,
      this.rockMaterial,
      this.rockLightMaterial,
      this.reedMaterial,
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

  private renderVisualProps(): void {
    const originX = originMetres(this.world.width);
    const originZ = originMetres(this.world.height);
    const layout = createEnvironmentVisualLayout(this.world);
    for (const prop of layout) {
      const root = new pc.Entity(`${prop.kind} ${prop.cellX},${prop.cellZ}`);
      root.setPosition(
        originX + prop.cellX + 0.5 + prop.offsetX,
        prop.kind === 'RIVER_REED' ? 0.04 : 0.02,
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
    if (prop.kind === 'WOODLAND_TREE') {
      addChildPrimitive(
        root,
        'cylinder',
        'Tree Trunk',
        new pc.Vec3(0, 0.38 * scale, 0),
        new pc.Vec3(0.13 * scale, 0.74 * scale, 0.13 * scale),
        this.trunkMaterial,
      );
      addChildPrimitive(
        root,
        'sphere',
        'Tree Crown',
        new pc.Vec3(0, 0.98 * scale, 0),
        new pc.Vec3(0.55 * scale, 0.68 * scale, 0.55 * scale),
        prop.variant < 128 ? this.canopyMaterial : this.canopyLightMaterial,
      );
      if (prop.variant > 190) {
        addChildPrimitive(
          root,
          'sphere',
          'Tree Crown Upper',
          new pc.Vec3(0.14 * scale, 1.34 * scale, -0.08 * scale),
          new pc.Vec3(0.36 * scale, 0.42 * scale, 0.36 * scale),
          this.canopyLightMaterial,
        );
      }
      return;
    }

    if (prop.kind === 'HIGHLAND_ROCK') {
      addChildPrimitive(
        root,
        'box',
        'Highland Rock',
        new pc.Vec3(0, 0.2 * scale, 0),
        new pc.Vec3(0.72 * scale, 0.38 * scale, 0.58 * scale),
        prop.variant < 128 ? this.rockMaterial : this.rockLightMaterial,
      );
      if (prop.variant > 175) {
        addChildPrimitive(
          root,
          'sphere',
          'Highland Stone',
          new pc.Vec3(0.34 * scale, 0.12 * scale, -0.22 * scale),
          new pc.Vec3(0.28 * scale, 0.2 * scale, 0.24 * scale),
          this.rockMaterial,
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
        new pc.Vec3(widthCells, 1, 1),
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
