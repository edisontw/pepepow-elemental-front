import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { TerrainState } from '../simulation/terrain-state';
import { SurfaceType } from '../simulation/terrain-state';
import type { EntitySnapshot, SimulationSnapshot } from '../simulation/simulation';
import {
  addedVisualCells,
  lightningDamageChain,
  newlyWetVisibleEntities,
  removedVisualCells,
} from './elemental-visual-events';

interface TransientVisual {
  entity: pc.Entity;
  bornTick: number;
  expiresTick: number;
  baseScale: number;
  originY: number;
  kind: 'LIGHTNING_NODE' | 'LIGHTNING_BEAM' | 'STEAM' | 'WATER_RING' | 'ICE_SPARK';
}

function createMaterial(color: pc.Color, emissive: pc.Color, opacity = 1): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.emissive = emissive;
  material.emissiveIntensity = 2;
  material.gloss = 0.45;
  material.opacity = opacity;
  if (opacity < 1) material.blendType = pc.BLEND_NORMAL;
  material.update();
  return material;
}

function entityPosition(entity: EntitySnapshot): pc.Vec3 {
  return new pc.Vec3(
    entity.x / WORLD_UNITS_PER_METER,
    0.92,
    entity.z / WORLD_UNITS_PER_METER,
  );
}

function keyForCell(column: number, row: number): string {
  return `${column},${row}`;
}

export class ElementalRenderBridge {
  private readonly burning = new Map<string, pc.Entity>();
  private readonly transient: TransientVisual[] = [];
  private readonly flameMaterial = createMaterial(new pc.Color(1, 0.22, 0.02), new pc.Color(1, 0.08, 0.005));
  private readonly flameCoreMaterial = createMaterial(new pc.Color(1, 0.82, 0.18), new pc.Color(1, 0.34, 0.02));
  private readonly waterMaterial = createMaterial(new pc.Color(0.22, 0.7, 1), new pc.Color(0.04, 0.2, 0.5), 0.5);
  private readonly iceSparkMaterial = createMaterial(new pc.Color(0.76, 0.95, 1), new pc.Color(0.22, 0.6, 0.72), 0.78);
  private readonly lightningMaterial = createMaterial(new pc.Color(0.72, 0.9, 1), new pc.Color(0.34, 0.62, 1), 0.88);
  private readonly steamMaterial = createMaterial(new pc.Color(0.72, 0.86, 0.9), new pc.Color(0.12, 0.22, 0.24), 0.32);
  private lastIceCells: Set<string>;
  private lastProcessedTick = -1;

  constructor(
    private readonly app: pc.Application,
    private readonly terrain: TerrainState,
    initialSnapshot: SimulationSnapshot,
  ) {
    this.lastIceCells = this.currentIceCells();
    this.syncBurning(initialSnapshot, 0);
  }

  sync(previous: SimulationSnapshot, current: SimulationSnapshot, alpha: number): void {
    this.syncBurning(current, alpha);
    if (current.tick !== this.lastProcessedTick) {
      this.processLightning(previous, current);
      this.processWater(previous, current);
      this.processIceTransitions(current.tick);
      this.lastProcessedTick = current.tick;
    }
    this.updateTransient(current.tick, alpha);
  }

  destroy(): void {
    for (const entity of this.burning.values()) entity.destroy();
    this.burning.clear();
    for (const visual of this.transient) visual.entity.destroy();
    this.transient.length = 0;
    this.flameMaterial.destroy();
    this.flameCoreMaterial.destroy();
    this.waterMaterial.destroy();
    this.iceSparkMaterial.destroy();
    this.lightningMaterial.destroy();
    this.steamMaterial.destroy();
  }

  private syncBurning(snapshot: SimulationSnapshot, alpha: number): void {
    const active = new Set(snapshot.burningCells.map((cell) => keyForCell(cell.column, cell.row)));
    for (const cell of snapshot.burningCells) {
      const key = keyForCell(cell.column, cell.row);
      let root = this.burning.get(key);
      if (!root) {
        root = this.createFire(cell.column, cell.row);
        this.burning.set(key, root);
      }
      const center = this.terrain.cellCenter(cell);
      root.setPosition(center.x / WORLD_UNITS_PER_METER, 0.09, center.z / WORLD_UNITS_PER_METER);
      const phase = ((snapshot.tick + cell.column * 3 + cell.row * 5) % 11 + alpha) / 11;
      const pulse = 0.9 + Math.sin(phase * Math.PI * 2) * 0.1;
      root.setLocalScale(pulse, pulse, pulse);
    }
    for (const [key, root] of [...this.burning]) {
      if (active.has(key)) continue;
      root.destroy();
      this.burning.delete(key);
    }
  }

  private createFire(column: number, row: number): pc.Entity {
    const root = new pc.Entity(`Burning Cell ${column},${row}`);
    const lower = new pc.Entity('Flame Outer');
    lower.addComponent('render', { type: 'capsule', material: this.flameMaterial });
    lower.setLocalPosition(-0.12, 0.34, 0.08);
    lower.setLocalScale(0.28, 0.64, 0.28);
    root.addChild(lower);
    const core = new pc.Entity('Flame Core');
    core.addComponent('render', { type: 'capsule', material: this.flameCoreMaterial });
    core.setLocalPosition(0.11, 0.28, -0.06);
    core.setLocalScale(0.2, 0.46, 0.2);
    root.addChild(core);
    const ember = new pc.Entity('Ember Glow');
    ember.addComponent('render', { type: 'sphere', material: this.flameMaterial });
    ember.setLocalPosition(0, 0.12, 0);
    ember.setLocalScale(0.48, 0.12, 0.48);
    root.addChild(ember);
    this.app.root.addChild(root);
    return root;
  }

  private processLightning(previous: SimulationSnapshot, current: SimulationSnapshot): void {
    const chain = lightningDamageChain(previous, current);
    if (chain.length === 0) return;
    const entities = new Map(current.entities.map((entity) => [entity.id, entity]));
    const points: pc.Vec3[] = [];
    for (const entityId of chain) {
      const entity = entities.get(entityId);
      if (!entity || (!entity.visibleToPlayer && entity.playerId !== 0)) continue;
      points.push(entityPosition(entity));
    }
    if (points.length === 0) return;
    for (const point of points) this.spawnLightningNode(point, current.tick);
    for (let index = 1; index < points.length; index += 1) {
      this.spawnLightningBeam(points[index - 1]!, points[index]!, current.tick);
    }
  }

  private processWater(previous: SimulationSnapshot, current: SimulationSnapshot): void {
    const targets = newlyWetVisibleEntities(previous, current);
    if (targets.length === 0) return;
    const entities = new Map(current.entities.map((entity) => [entity.id, entity]));
    for (const entityId of targets.slice(0, 12)) {
      const entity = entities.get(entityId);
      if (!entity) continue;
      this.spawnWaterRing(entity.x / WORLD_UNITS_PER_METER, entity.z / WORLD_UNITS_PER_METER, current.tick);
    }
  }

  private spawnLightningNode(position: pc.Vec3, tick: number): void {
    const entity = new pc.Entity('Lightning Impact');
    entity.addComponent('render', { type: 'sphere', material: this.lightningMaterial });
    entity.setPosition(position);
    entity.setLocalScale(0.44, 0.44, 0.44);
    this.app.root.addChild(entity);
    this.transient.push({
      entity,
      bornTick: tick,
      expiresTick: tick + 2,
      baseScale: 0.44,
      originY: position.y,
      kind: 'LIGHTNING_NODE',
    });
  }

  private spawnLightningBeam(start: pc.Vec3, end: pc.Vec3, tick: number): void {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance <= 0.01) return;
    const entity = new pc.Entity('Lightning Chain');
    entity.addComponent('render', { type: 'box', material: this.lightningMaterial });
    const y = (start.y + end.y) / 2;
    entity.setPosition((start.x + end.x) / 2, y, (start.z + end.z) / 2);
    entity.setEulerAngles(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
    entity.setLocalScale(0.11, 0.11, distance);
    this.app.root.addChild(entity);
    this.transient.push({
      entity,
      bornTick: tick,
      expiresTick: tick + 2,
      baseScale: 1,
      originY: y,
      kind: 'LIGHTNING_BEAM',
    });
  }

  private processIceTransitions(tick: number): void {
    const current = this.currentIceCells();
    const added = addedVisualCells(this.lastIceCells, current).slice(0, 24);
    const removed = removedVisualCells(this.lastIceCells, current).slice(0, 24);
    for (const key of added) {
      const [columnRaw, rowRaw] = key.split(',');
      const column = Number(columnRaw);
      const row = Number(rowRaw);
      if (!Number.isInteger(column) || !Number.isInteger(row)) continue;
      const center = this.terrain.cellCenter({ column, row });
      this.spawnIceSpark(center.x / WORLD_UNITS_PER_METER, center.z / WORLD_UNITS_PER_METER, tick);
    }
    for (const key of removed) {
      const [columnRaw, rowRaw] = key.split(',');
      const column = Number(columnRaw);
      const row = Number(rowRaw);
      if (!Number.isInteger(column) || !Number.isInteger(row)) continue;
      const center = this.terrain.cellCenter({ column, row });
      this.spawnSteam(center.x / WORLD_UNITS_PER_METER, center.z / WORLD_UNITS_PER_METER, tick);
    }
    this.lastIceCells = current;
  }

  private currentIceCells(): Set<string> {
    const cells = new Set<string>();
    const columns = this.terrain.definition.columns;
    for (let index = 0; index < this.terrain.surface.length; index += 1) {
      if (this.terrain.surface[index] !== SurfaceType.ICE) continue;
      cells.add(keyForCell(index % columns, Math.floor(index / columns)));
    }
    return cells;
  }

  private spawnWaterRing(x: number, z: number, tick: number): void {
    const originY = 0.12;
    const entity = new pc.Entity('Water Burst Impact');
    entity.addComponent('render', { type: 'cylinder', material: this.waterMaterial });
    entity.setPosition(x, originY, z);
    entity.setLocalScale(0.45, 0.035, 0.45);
    this.app.root.addChild(entity);
    this.transient.push({
      entity,
      bornTick: tick,
      expiresTick: tick + 4,
      baseScale: 0.45,
      originY,
      kind: 'WATER_RING',
    });
  }

  private spawnIceSpark(x: number, z: number, tick: number): void {
    const originY = 0.16;
    const root = new pc.Entity('Ice Formation Spark');
    root.setPosition(x, originY, z);
    const slashA = new pc.Entity('Ice Crack A');
    slashA.addComponent('render', { type: 'box', material: this.iceSparkMaterial });
    slashA.setLocalScale(0.52, 0.035, 0.07);
    slashA.setEulerAngles(0, 38, 0);
    root.addChild(slashA);
    const slashB = new pc.Entity('Ice Crack B');
    slashB.addComponent('render', { type: 'box', material: this.iceSparkMaterial });
    slashB.setLocalScale(0.38, 0.035, 0.06);
    slashB.setEulerAngles(0, -42, 0);
    root.addChild(slashB);
    this.app.root.addChild(root);
    this.transient.push({
      entity: root,
      bornTick: tick,
      expiresTick: tick + 4,
      baseScale: 1,
      originY,
      kind: 'ICE_SPARK',
    });
  }

  private spawnSteam(x: number, z: number, tick: number): void {
    const originY = 0.36;
    const entity = new pc.Entity('Ice Melt Steam');
    entity.addComponent('render', { type: 'sphere', material: this.steamMaterial });
    entity.setPosition(x, originY, z);
    entity.setLocalScale(0.48, 0.32, 0.48);
    this.app.root.addChild(entity);
    this.transient.push({
      entity,
      bornTick: tick,
      expiresTick: tick + 6,
      baseScale: 0.48,
      originY,
      kind: 'STEAM',
    });
  }

  private updateTransient(tick: number, alpha: number): void {
    for (let index = this.transient.length - 1; index >= 0; index -= 1) {
      const visual = this.transient[index]!;
      if (tick > visual.expiresTick) {
        visual.entity.destroy();
        this.transient.splice(index, 1);
        continue;
      }
      const duration = Math.max(1, visual.expiresTick - visual.bornTick);
      const progress = Math.max(0, Math.min(1, (tick - visual.bornTick + alpha) / duration));
      if (visual.kind === 'STEAM') {
        const position = visual.entity.getPosition();
        visual.entity.setPosition(position.x, visual.originY + progress * 0.85, position.z);
        const scale = visual.baseScale * (1 + progress * 1.15);
        visual.entity.setLocalScale(scale, scale * 0.72, scale);
      } else if (visual.kind === 'WATER_RING') {
        const scale = visual.baseScale * (1 + progress * 2.6);
        visual.entity.setLocalScale(scale, 0.035, scale);
      } else if (visual.kind === 'ICE_SPARK') {
        const scale = 0.72 + Math.sin(progress * Math.PI) * 0.48;
        visual.entity.setLocalScale(scale, scale, scale);
      } else if (visual.kind === 'LIGHTNING_NODE') {
        const scale = visual.baseScale * (1.15 - progress * 0.35);
        visual.entity.setLocalScale(scale, scale, scale);
      }
    }
  }
}
