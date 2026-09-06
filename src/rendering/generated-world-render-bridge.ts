import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import { SurfaceType, type TerrainState } from '../simulation/terrain-state';
import { BiomeType, TerrainType, type GeneratedWorld } from '../world/world-definition';

interface RowRun {
  row: number;
  startColumn: number;
  endColumn: number;
}

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
  type: 'box' | 'plane',
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
  private readonly groundMaterial = createMaterial(new pc.Color(0.13, 0.23, 0.16));
  private readonly woodlandMaterial = createMaterial(new pc.Color(0.08, 0.28, 0.11));
  private readonly highlandMaterial = createMaterial(new pc.Color(0.34, 0.35, 0.30));
  private readonly riverMaterial = createMaterial(
    new pc.Color(0.055, 0.24, 0.43),
    new pc.Color(0.01, 0.055, 0.11),
  );
  private readonly crossingMaterial = createMaterial(new pc.Color(0.46, 0.34, 0.19));
  private readonly iceMaterial = createMaterial(
    new pc.Color(0.58, 0.88, 0.96),
    new pc.Color(0.12, 0.34, 0.42),
    0.86,
  );
  private lastIceCount = -1;
  private lastNavVersion = -1;

  constructor(
    private readonly app: pc.Application,
    private readonly world: GeneratedWorld,
    private readonly terrain: TerrainState,
  ) {
    this.renderStaticTerrain();
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
