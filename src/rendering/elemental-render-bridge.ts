import * as pc from 'playcanvas';
import { BattleVfx, ELEMENT_TINTS, ringMesh } from './battle-vfx';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { ActiveStrategicZoneSnapshot, M04SimulationSnapshot } from '../simulation/m04-simulation';
import { STRATEGIC_PULSE_INTERVAL_TICKS, STRATEGIC_SPELLS } from '../simulation/spell-content';
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

type StrategicSpellId = ActiveStrategicZoneSnapshot['spellId'];

interface StrategicZoneVisual {
  root: pc.Entity;
  outerRing: pc.Entity;
  innerRing: pc.Entity;
  core: pc.Entity;
  accents: readonly pc.Entity[];
  spellId: StrategicSpellId;
  lastPulseTick: number;
}

function createMaterial(color: pc.Color, emissive: pc.Color, opacity = 1): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.emissive = emissive;
  material.emissiveIntensity = 2;
  material.gloss = 0.45;
  material.opacity = opacity;
  if (opacity < 1) { material.blendType = pc.BLEND_NORMAL; material.depthWrite = false; }
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

function metres(value: number): number {
  return value / WORLD_UNITS_PER_METER;
}

export class ElementalRenderBridge {
  private readonly burning = new Map<string, pc.Entity>();
  private readonly transient: TransientVisual[] = [];
  private readonly strategicZones = new Map<number, StrategicZoneVisual>();
  private readonly flameMaterial = createMaterial(new pc.Color(1, 0.22, 0.02), new pc.Color(1, 0.08, 0.005));
  private readonly flameCoreMaterial = createMaterial(new pc.Color(1, 0.82, 0.18), new pc.Color(1, 0.34, 0.02));
  private readonly waterMaterial = createMaterial(new pc.Color(0.22, 0.7, 1), new pc.Color(0.04, 0.2, 0.5), 0.5);
  private readonly iceSparkMaterial = createMaterial(new pc.Color(0.76, 0.95, 1), new pc.Color(0.22, 0.6, 0.72), 0.78);
  private readonly lightningMaterial = createMaterial(new pc.Color(0.72, 0.9, 1), new pc.Color(0.34, 0.62, 1), 0.88);
  private readonly steamMaterial = createMaterial(new pc.Color(0.72, 0.86, 0.9), new pc.Color(0.12, 0.22, 0.24), 0.32);
  private readonly strategicMaterials: Readonly<Record<StrategicSpellId, pc.StandardMaterial>> = {
    INFERNO: createMaterial(new pc.Color(1, .26, .035), new pc.Color(1, .08, .005), .56),
    DELUGE: createMaterial(new pc.Color(.10, .74, 1), new pc.Color(.03, .38, .86), .48),
    BLIZZARD: createMaterial(new pc.Color(.74, .94, 1), new pc.Color(.20, .62, .82), .52),
    THUNDERSTORM: createMaterial(new pc.Color(.68, .48, 1), new pc.Color(.40, .16, 1), .54),
  };
  private lastIceCells: Set<string>;
  private lastProcessedTick = -1;
  private readonly rippleMesh: pc.Mesh;

  constructor(
    private readonly app: pc.Application,
    private readonly terrain: TerrainState,
    initialSnapshot: SimulationSnapshot,
    private readonly effects: BattleVfx,
  ) {
    this.rippleMesh = ringMesh(app.graphicsDevice);
    this.lastIceCells = this.currentIceCells();
    this.syncBurning(initialSnapshot, 0);
    this.syncStrategicZones(initialSnapshot, 0);
  }

  sync(previous: SimulationSnapshot, current: SimulationSnapshot, alpha: number): void {
    this.syncBurning(current, alpha);
    this.syncStrategicZones(current, alpha);
    if (current.tick !== this.lastProcessedTick) {
      this.processLightning(previous, current);
      this.processWater(previous, current);
      this.processIceTransitions(current.tick);
      this.processStrategicPulses(current);
      this.lastProcessedTick = current.tick;
    }
    this.updateTransient(current.tick, alpha);
  }

  destroy(): void {
    for (const entity of this.burning.values()) entity.destroy();
    this.burning.clear();
    for (const visual of this.transient) visual.entity.destroy();
    this.transient.length = 0;
    for (const visual of this.strategicZones.values()) visual.root.destroy();
    this.strategicZones.clear();
    this.rippleMesh.destroy();
    this.flameMaterial.destroy();
    this.flameCoreMaterial.destroy();
    this.waterMaterial.destroy();
    this.iceSparkMaterial.destroy();
    this.lightningMaterial.destroy();
    this.steamMaterial.destroy();
    for (const material of Object.values(this.strategicMaterials)) material.destroy();
  }

  private syncBurning(snapshot: SimulationSnapshot, alpha: number): void {
    const active = new Set(snapshot.burningCells.map((cell) => keyForCell(cell.column, cell.row)));
    for (const cell of snapshot.burningCells) {
      const key = keyForCell(cell.column, cell.row);
      let root = this.burning.get(key);
      if (!root) {
        root = this.createFire(cell.column, cell.row);
        this.burning.set(key, root);
        const center = this.terrain.cellCenter(cell);
        this.effects.burst(center.x / WORLD_UNITS_PER_METER, .3, center.z / WORLD_UNITS_PER_METER, ELEMENT_TINTS.FIRE, snapshot.tick, 5, .68);
      }
      const center = this.terrain.cellCenter(cell);
      root.setPosition(center.x / WORLD_UNITS_PER_METER, 0.09, center.z / WORLD_UNITS_PER_METER);
      const phase = ((snapshot.tick + cell.column * 3 + cell.row * 5) % 11 + alpha) / 11;
      const pulse = 0.9 + Math.sin(phase * Math.PI * 2) * 0.1;
      root.setLocalScale(pulse, 1 + Math.sin(phase * 18) * .2, pulse);
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
    lower.addComponent('render', { type: 'cone', material: this.flameMaterial });
    lower.setLocalPosition(-0.14, 0.32, 0.08);
    lower.setLocalScale(0.3, 0.7, 0.3);
    lower.setLocalEulerAngles(0, 0, -8);
    root.addChild(lower);

    const side = new pc.Entity('Flame Side');
    side.addComponent('render', { type: 'cone', material: this.flameMaterial });
    side.setLocalPosition(0.18, 0.25, -0.08);
    side.setLocalScale(0.22, 0.5, 0.22);
    side.setLocalEulerAngles(0, 0, 11);
    root.addChild(side);

    const core = new pc.Entity('Flame Core');
    core.addComponent('render', { type: 'cone', material: this.flameCoreMaterial });
    core.setLocalPosition(0.02, 0.31, 0.01);
    core.setLocalScale(0.17, 0.54, 0.17);
    root.addChild(core);

    const ember = new pc.Entity('Ember Glow');
    ember.addComponent('render', { type: 'sphere', material: this.flameCoreMaterial });
    ember.setLocalPosition(0, 0.1, 0);
    ember.setLocalScale(0.5, 0.11, 0.5);
    root.addChild(ember);

    this.app.root.addChild(root);
    return root;
  }

  private syncStrategicZones(snapshot: SimulationSnapshot, alpha: number): void {
    const authority = (snapshot as Partial<M04SimulationSnapshot>).elementalAuthority;
    const zones = authority?.activeStrategicZones ?? [];
    const active = new Set<number>();

    for (const zone of zones) {
      if (!this.strategicZoneVisible(zone, snapshot)) continue;
      active.add(zone.id);
      let visual = this.strategicZones.get(zone.id);
      if (!visual) {
        visual = this.createStrategicZone(zone, snapshot.tick);
        this.strategicZones.set(zone.id, visual);
        this.spawnStrategicPulse(zone, snapshot.tick, true);
      }
      this.animateStrategicZone(visual, zone, snapshot.tick, alpha);
    }

    for (const [zoneId, visual] of [...this.strategicZones]) {
      if (active.has(zoneId)) continue;
      visual.root.destroy();
      this.strategicZones.delete(zoneId);
    }
  }

  private strategicZoneVisible(zone: ActiveStrategicZoneSnapshot, snapshot: SimulationSnapshot): boolean {
    if (zone.playerId === 0) return true;
    const radius = STRATEGIC_SPELLS[zone.spellId].radius;
    const radiusSquared = radius * radius;
    return snapshot.entities.some((entity) => {
      if (!entity.visibleToPlayer) return false;
      const dx = entity.x - zone.targetX;
      const dz = entity.z - zone.targetZ;
      return dx * dx + dz * dz <= radiusSquared;
    });
  }

  private createStrategicZone(zone: ActiveStrategicZoneSnapshot, tick: number): StrategicZoneVisual {
    const spell = STRATEGIC_SPELLS[zone.spellId];
    const material = this.strategicMaterials[zone.spellId];
    const radius = metres(spell.radius);
    const root = new pc.Entity(`Strategic ${zone.spellId} Zone ${zone.id}`);
    root.setPosition(metres(zone.targetX), .08, metres(zone.targetZ));

    const outerRing = new pc.Entity(`${zone.spellId} Outer Footprint`);
    outerRing.addComponent('render', {
      meshInstances: [new pc.MeshInstance(this.rippleMesh, material)],
      castShadows: false,
    });
    root.addChild(outerRing);

    const innerRing = new pc.Entity(`${zone.spellId} Inner Footprint`);
    innerRing.addComponent('render', {
      meshInstances: [new pc.MeshInstance(this.rippleMesh, material)],
      castShadows: false,
    });
    innerRing.setLocalPosition(0, .025, 0);
    root.addChild(innerRing);

    const core = new pc.Entity(`${zone.spellId} Strategic Core`);
    core.addComponent('render', {
      type: zone.spellId === 'INFERNO' ? 'cone' : 'sphere',
      material,
      castShadows: false,
    });
    root.addChild(core);

    const accents: pc.Entity[] = [];
    const accentCount = zone.spellId === 'THUNDERSTORM' ? 6 : zone.spellId === 'BLIZZARD' ? 8 : 6;
    for (let index = 0; index < accentCount; index += 1) {
      const angle = (index / accentCount) * Math.PI * 2;
      const accent = new pc.Entity(`${zone.spellId} Accent ${index + 1}`);
      const type = zone.spellId === 'INFERNO' ? 'cone'
        : zone.spellId === 'BLIZZARD' ? 'box'
          : 'sphere';
      accent.addComponent('render', { type, material, castShadows: false });
      const orbitRadius = radius * (zone.spellId === 'THUNDERSTORM' ? .40 : .52);
      accent.setLocalPosition(
        Math.cos(angle) * orbitRadius,
        zone.spellId === 'THUNDERSTORM' ? 2.7 + (index % 2) * .42 : .20,
        Math.sin(angle) * orbitRadius,
      );
      if (zone.spellId === 'INFERNO') accent.setLocalScale(.28, .84 + (index % 2) * .32, .28);
      else if (zone.spellId === 'DELUGE') accent.setLocalScale(.54, .10, .82);
      else if (zone.spellId === 'BLIZZARD') {
        accent.setLocalScale(.10, .78 + (index % 3) * .16, .10);
        accent.setLocalEulerAngles(18, index * (360 / accentCount), index % 2 === 0 ? 18 : -18);
      } else accent.setLocalScale(.74 + (index % 2) * .18, .22, .74 + (index % 2) * .18);
      root.addChild(accent);
      accents.push(accent);
    }

    this.app.root.addChild(root);
    return {
      root,
      outerRing,
      innerRing,
      core,
      accents,
      spellId: zone.spellId,
      lastPulseTick: tick,
    };
  }

  private animateStrategicZone(
    visual: StrategicZoneVisual,
    zone: ActiveStrategicZoneSnapshot,
    tick: number,
    alpha: number,
  ): void {
    const spell = STRATEGIC_SPELLS[zone.spellId];
    const radius = metres(spell.radius);
    const age = Math.max(0, tick + alpha - zone.startTick);
    const duration = Math.max(1, zone.endTick - zone.startTick);
    const progress = Math.max(0, Math.min(1, age / duration));
    const pulse = .5 + .5 * Math.sin(age * .62 + zone.id * .73);
    const ringScale = radius / .48;

    visual.root.setPosition(metres(zone.targetX), .08, metres(zone.targetZ));
    visual.outerRing.setLocalScale(ringScale * (.985 + pulse * .025), 1, ringScale * (.985 + pulse * .025));
    visual.innerRing.setLocalScale(ringScale * (.62 + pulse * .035), 1, ringScale * (.62 + pulse * .035));
    visual.innerRing.setLocalEulerAngles(0, age * (zone.spellId === 'THUNDERSTORM' ? -9 : 6), 0);

    if (zone.spellId === 'INFERNO') {
      visual.core.setLocalPosition(0, .44 + pulse * .22, 0);
      visual.core.setLocalScale(.64 + pulse * .20, 1.2 + pulse * .62, .64 + pulse * .20);
      for (const [index, accent] of visual.accents.entries()) {
        const angle = (index / visual.accents.length) * Math.PI * 2 + age * .055;
        accent.setLocalPosition(Math.cos(angle) * radius * .50, .30 + pulse * .18, Math.sin(angle) * radius * .50);
        accent.setLocalScale(.24 + pulse * .08, .66 + ((index + tick) % 3) * .16 + pulse * .28, .24 + pulse * .08);
      }
    } else if (zone.spellId === 'DELUGE') {
      visual.core.setLocalPosition(0, .20 + pulse * .06, 0);
      visual.core.setLocalScale(radius * .12, .08 + pulse * .05, radius * .12);
      for (const [index, accent] of visual.accents.entries()) {
        const angle = (index / visual.accents.length) * Math.PI * 2 - age * .035;
        const orbit = radius * (.34 + (index % 2) * .16);
        accent.setLocalPosition(Math.cos(angle) * orbit, .18 + Math.sin(age * .5 + index) * .08, Math.sin(angle) * orbit);
        accent.setLocalEulerAngles(0, -angle * 180 / Math.PI, index % 2 === 0 ? 8 : -8);
      }
    } else if (zone.spellId === 'BLIZZARD') {
      visual.root.setLocalEulerAngles(0, age * -2.2, 0);
      visual.core.setLocalPosition(0, .34 + pulse * .10, 0);
      visual.core.setLocalScale(.44 + pulse * .12, .30 + pulse * .12, .44 + pulse * .12);
      for (const [index, accent] of visual.accents.entries()) {
        const angle = (index / visual.accents.length) * Math.PI * 2 + age * .025;
        const orbit = radius * (.32 + (index % 3) * .09);
        accent.setLocalPosition(Math.cos(angle) * orbit, .38 + (index % 2) * .18 + pulse * .10, Math.sin(angle) * orbit);
        accent.setLocalEulerAngles(18 + Math.sin(age * .22 + index) * 8, age * (7 + (index % 3) * 2) + index * 45, index % 2 === 0 ? 18 : -18);
      }
    } else {
      visual.core.setLocalPosition(0, 3.20 + Math.sin(age * .34) * .18, 0);
      visual.core.setLocalScale(1.12 + pulse * .28, .26 + pulse * .10, 1.12 + pulse * .28);
      for (const [index, accent] of visual.accents.entries()) {
        const angle = (index / visual.accents.length) * Math.PI * 2 + age * .028;
        const orbit = radius * (.26 + (index % 2) * .10);
        accent.setLocalPosition(
          Math.cos(angle) * orbit,
          2.55 + (index % 2) * .48 + Math.sin(age * .45 + index) * .12,
          Math.sin(angle) * orbit,
        );
      }
    }

    const endFade = progress > .86 ? Math.max(.16, 1 - (progress - .86) / .14) : 1;
    visual.root.setLocalScale(endFade, endFade, endFade);
  }

  private processStrategicPulses(snapshot: SimulationSnapshot): void {
    const authority = (snapshot as Partial<M04SimulationSnapshot>).elementalAuthority;
    const zones = authority?.activeStrategicZones ?? [];
    for (const zone of zones) {
      const visual = this.strategicZones.get(zone.id);
      if (!visual) continue;
      const mostRecentPulseTick = zone.nextPulseTick - STRATEGIC_PULSE_INTERVAL_TICKS;
      if (mostRecentPulseTick !== snapshot.tick || visual.lastPulseTick === mostRecentPulseTick) continue;
      visual.lastPulseTick = mostRecentPulseTick;
      this.spawnStrategicPulse(zone, snapshot.tick, false);
    }
  }

  private spawnStrategicPulse(zone: ActiveStrategicZoneSnapshot, tick: number, onset: boolean): void {
    const spell = STRATEGIC_SPELLS[zone.spellId];
    const tint = ELEMENT_TINTS[spell.element];
    const x = metres(zone.targetX);
    const z = metres(zone.targetZ);
    const radius = metres(spell.radius);
    const force = onset ? 1.28 : 1.0;
    const count = onset ? 18 : 10;
    this.effects.burst(x, zone.spellId === 'THUNDERSTORM' ? 2.9 : .30, z, tint, tick, count, force);

    const points = zone.spellId === 'THUNDERSTORM' ? 3 : 4;
    for (let index = 0; index < points; index += 1) {
      const angle = zone.id * .91 + tick * .13 + index * (Math.PI * 2 / points);
      const distance = radius * (.26 + (index % 2) * .18);
      const px = x + Math.cos(angle) * distance;
      const pz = z + Math.sin(angle) * distance;
      if (zone.spellId === 'THUNDERSTORM') {
        const start = new pc.Vec3(px + Math.sin(angle * 1.7) * .55, 5.4 + (index % 2) * .6, pz);
        const end = new pc.Vec3(px, .22, pz);
        this.effects.bolt(start, end, tick + index);
        this.effects.burst(px, .22, pz, tint, tick + index, onset ? 8 : 5, onset ? .92 : .68);
      } else {
        this.effects.burst(px, .22, pz, tint, tick + index, onset ? 7 : 4, onset ? .78 : .52);
      }
    }
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
    const root = new pc.Entity('Lightning Impact');
    root.setPosition(position);

    const core = new pc.Entity('Lightning Core');
    core.addComponent('render', { type: 'sphere', material: this.lightningMaterial });
    core.setLocalScale(0.38, 0.38, 0.38);
    root.addChild(core);

    const lance = new pc.Entity('Lightning Lance');
    lance.addComponent('render', { type: 'box', material: this.lightningMaterial });
    lance.setLocalPosition(0, .36, 0);
    lance.setLocalScale(.065, .82, .065);
    lance.setLocalEulerAngles(0, 0, 8);
    root.addChild(lance);

    const cross = new pc.Entity('Lightning Cross');
    cross.addComponent('render', { type: 'box', material: this.lightningMaterial });
    cross.setLocalScale(.52, .045, .075);
    cross.setLocalEulerAngles(0, 38, 0);
    root.addChild(cross);

    this.effects.burst(position.x, position.y, position.z, ELEMENT_TINTS.LIGHTNING, tick, 4, .42);
    this.app.root.addChild(root);
    this.transient.push({
      entity: root,
      bornTick: tick,
      expiresTick: tick + 2,
      baseScale: 1,
      originY: position.y,
      kind: 'LIGHTNING_NODE',
    });
  }

  private spawnLightningBeam(start: pc.Vec3, end: pc.Vec3, tick: number): void {
    this.effects.bolt(start, end, tick);
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
    const root = new pc.Entity('Water Burst Impact');
    root.setPosition(x, originY, z);

    const outer = new pc.Entity('Water Outer Ripple');
    outer.addComponent('render', { meshInstances: [new pc.MeshInstance(this.rippleMesh, this.waterMaterial)], castShadows: false });
    root.addChild(outer);

    const inner = new pc.Entity('Water Inner Ripple');
    inner.addComponent('render', { meshInstances: [new pc.MeshInstance(this.rippleMesh, this.waterMaterial)], castShadows: false });
    inner.setLocalScale(.58, 1, .58);
    inner.setLocalPosition(0, .035, 0);
    root.addChild(inner);

    const splash = new pc.Entity('Water Splash Core');
    splash.addComponent('render', { type: 'sphere', material: this.waterMaterial });
    splash.setLocalPosition(0, .17, 0);
    splash.setLocalScale(.34, .22, .34);
    root.addChild(splash);

    this.effects.burst(x, .2, z, ELEMENT_TINTS.WATER, tick, 9, .78);
    root.setLocalScale(0.45, 1, 0.45);
    this.app.root.addChild(root);
    this.transient.push({
      entity: root,
      bornTick: tick,
      expiresTick: tick + 4,
      baseScale: 0.45,
      originY,
      kind: 'WATER_RING',
    });
  }

  private spawnIceSpark(x: number, z: number, tick: number): void {
    const originY = 0.16;
    this.effects.burst(x, .18, z, ELEMENT_TINTS.ICE, tick, 6, .66);
    const root = new pc.Entity('Ice Formation Spark');
    root.setPosition(x, originY, z);

    const slashA = new pc.Entity('Ice Crack A');
    slashA.addComponent('render', { type: 'box', material: this.iceSparkMaterial });
    slashA.setLocalScale(0.58, 0.035, 0.065);
    slashA.setEulerAngles(0, 38, 0);
    root.addChild(slashA);

    const slashB = new pc.Entity('Ice Crack B');
    slashB.addComponent('render', { type: 'box', material: this.iceSparkMaterial });
    slashB.setLocalScale(0.44, 0.035, 0.055);
    slashB.setEulerAngles(0, -42, 0);
    root.addChild(slashB);

    const shardAngles = [18, 112, 208, 302];
    for (let index = 0; index < shardAngles.length; index += 1) {
      const angle = shardAngles[index]! * Math.PI / 180;
      const shard = new pc.Entity(`Ice Shard ${index + 1}`);
      shard.addComponent('render', { type: 'box', material: this.iceSparkMaterial });
      shard.setLocalPosition(Math.cos(angle) * .22, .18 + (index % 2) * .08, Math.sin(angle) * .22);
      shard.setLocalScale(.065, .36 + (index % 2) * .13, .065);
      shard.setLocalEulerAngles(12 + (index % 2) * 8, shardAngles[index]!, index % 2 === 0 ? 12 : -14);
      root.addChild(shard);
    }

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
    while (this.transient.length > 96) this.transient.shift()!.entity.destroy();
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
        visual.entity.setLocalScale(scale, Math.max(.15, 1 - progress * .82), scale);
      } else if (visual.kind === 'ICE_SPARK') {
        const scale = 0.72 + Math.sin(progress * Math.PI) * 0.48;
        visual.entity.setLocalScale(scale, scale, scale);
      } else if (visual.kind === 'LIGHTNING_NODE') {
        const scale = 1.18 - progress * 0.42;
        visual.entity.setLocalScale(scale, scale, scale);
      }
    }
  }
}
