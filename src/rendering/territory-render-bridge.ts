import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { StrategicSnapshot } from '../simulation/strategic-state';
import type { GeneratedWorld } from '../world/world-definition';

interface TerritoryRun {
  row: number;
  startColumn: number;
  endColumn: number;
  owner: number;
}

function overlayMaterial(color: pc.Color, emissive: pc.Color, opacity: number): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.emissive = emissive;
  material.emissiveIntensity = 0.28;
  material.opacity = opacity;
  material.blendType = pc.BLEND_NORMAL;
  material.depthWrite = false;
  material.gloss = 0;
  material.update();
  return material;
}

function originMetres(cellCount: number): number {
  return -Math.floor((cellCount * WORLD_UNITS_PER_METER) / 2) / WORLD_UNITS_PER_METER;
}

export class TerritoryRenderBridge {
  private readonly entities: pc.Entity[] = [];
  private readonly playerMaterial = overlayMaterial(new pc.Color(0.08, 0.74, 0.58), new pc.Color(0.02, 0.24, 0.17), 0.13);
  private readonly enemyMaterial = overlayMaterial(new pc.Color(0.9, 0.2, 0.16), new pc.Color(0.28, 0.02, 0.01), 0.11);
  private readonly contestedMaterial = overlayMaterial(new pc.Color(0.95, 0.72, 0.18), new pc.Color(0.25, 0.13, 0.01), 0.14);
  private lastKey = '';

  constructor(
    private readonly app: pc.Application,
    private readonly world: GeneratedWorld,
  ) {}

  sync(snapshot: StrategicSnapshot): void {
    const key = `${snapshot.regionOwners.join(',')}|${snapshot.contestedRegions.join(',')}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.rebuild(snapshot);
  }

  destroy(): void {
    this.clear();
    this.playerMaterial.destroy();
    this.enemyMaterial.destroy();
    this.contestedMaterial.destroy();
  }

  private rebuild(snapshot: StrategicSnapshot): void {
    this.clear();
    const contested = new Set(snapshot.contestedRegions);
    const runs: TerritoryRun[] = [];
    for (let row = 0; row < this.world.height; row += 1) {
      let startColumn = 0;
      let activeOwner: number | null = null;
      for (let column = 0; column <= this.world.width; column += 1) {
        let owner: number | null = null;
        if (column < this.world.width) {
          const regionId = this.world.regionByCell[row * this.world.width + column];
          if (regionId !== undefined) {
            owner = contested.has(regionId) ? 2 : (snapshot.regionOwners[regionId] ?? -1);
            if (owner !== 0 && owner !== 1 && owner !== 2) owner = null;
          }
        }
        if (owner === activeOwner) continue;
        if (activeOwner !== null) runs.push({ row, startColumn, endColumn: column - 1, owner: activeOwner });
        activeOwner = owner;
        startColumn = column;
      }
    }

    const originX = originMetres(this.world.width);
    const originZ = originMetres(this.world.height);
    for (const run of runs) {
      const width = run.endColumn - run.startColumn + 1;
      const entity = new pc.Entity(`Territory ${run.owner}:${run.row}:${run.startColumn}-${run.endColumn}`);
      entity.addComponent('render', {
        type: 'plane',
        material: run.owner === 0 ? this.playerMaterial : run.owner === 1 ? this.enemyMaterial : this.contestedMaterial,
      });
      entity.setPosition(
        originX + run.startColumn + width / 2,
        0.027,
        originZ + run.row + 0.5,
      );
      entity.setLocalScale(width, 1, 1);
      this.app.root.addChild(entity);
      this.entities.push(entity);
    }
  }

  private clear(): void {
    for (const entity of this.entities) entity.destroy();
    this.entities.length = 0;
  }
}
