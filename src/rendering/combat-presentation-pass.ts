import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { UnitArchetype } from '../simulation/components';
import type { M04SimulationSnapshot } from '../simulation/m04-simulation';
import type { M06SimulationSnapshot } from '../simulation/m06-simulation';
import type { StrategicBuilding, StrategicSnapshot } from '../simulation/strategic-state';
import type { EntitySnapshot, SimulationSnapshot } from '../simulation/simulation';
import { BattleVfx, ELEMENT_TINTS } from './battle-vfx';
import { buildingVisualProfile } from './building-visual-profile';
import { unitVisualProfile, type UnitProjectileStyle } from './unit-visual-profile';

type Tint = readonly [number, number, number];
type ElementKey = keyof typeof ELEMENT_TINTS;
type TransientKind =
  | 'MELEE_SLASH'
  | 'MUZZLE_FLASH'
  | 'PROJECTILE_TRACE'
  | 'SHELL_TRACE'
  | 'UNIT_DEATH_DUST'
  | 'UNIT_DEATH_SHARD'
  | 'HEAVY_SHOCK_RING'
  | 'BUILDING_DUST'
  | 'BUILDING_SMOKE'
  | 'BUILDING_DEBRIS';

interface CombatTransient {
  entity: pc.Entity;
  kind: TransientKind;
  bornTick: number;
  expiresTick: number;
  start?: pc.Vec3;
  end?: pc.Vec3;
  baseScale: number;
  velocity?: pc.Vec3;
  spin?: pc.Vec3;
  impactTint?: Tint;
  impactForce?: number;
  element?: ElementKey;
  yaw?: number;
}

interface BuildingVisualState {
  destroyed: boolean;
  currentHealth: number;
}

function createMaterial(color: pc.Color, emissive?: pc.Color, opacity = 1): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.gloss = 0.38;
  material.opacity = opacity;
  if (emissive) {
    material.emissive = emissive;
    material.emissiveIntensity = 2;
  }
  if (opacity < 1) {
    material.blendType = pc.BLEND_ADDITIVEALPHA;
    material.depthWrite = false;
  }
  material.cull = pc.CULLFACE_NONE;
  material.update();
  return material;
}

function createSmokeMaterial(color: pc.Color, opacity: number): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.gloss = 0.08;
  material.opacity = opacity;
  material.blendType = pc.BLEND_NORMAL;
  material.depthWrite = false;
  material.cull = pc.CULLFACE_NONE;
  material.update();
  return material;
}

function metres(value: number): number {
  return value / WORLD_UNITS_PER_METER;
}

function entityPoint(entity: EntitySnapshot, heightFactor = 0.55): pc.Vec3 {
  return new pc.Vec3(
    metres(entity.x),
    unitVisualProfile(entity.archetype).height * heightFactor,
    metres(entity.z),
  );
}

function tintColor(tint: Tint): pc.Color {
  return new pc.Color(tint[0], tint[1], tint[2]);
}

function yawBetween(start: pc.Vec3, end: pc.Vec3): number {
  return Math.atan2(end.x - start.x, end.z - start.z) * 180 / Math.PI;
}

function snapshotMap(snapshot: SimulationSnapshot): Map<number, EntitySnapshot> {
  return new Map(snapshot.entities.map((entity) => [entity.id, entity]));
}

function isHeavyMelee(archetype: UnitArchetype): boolean {
  return archetype === 'GOLEM' || archetype === 'VANGUARD';
}

function addProjectilePart(
  parent: pc.Entity,
  name: string,
  type: 'box' | 'sphere',
  material: pc.Material,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  euler: readonly [number, number, number] = [0, 0, 0],
): pc.Entity {
  const part = new pc.Entity(name);
  part.addComponent('render', { type, material, castShadows: false });
  part.setLocalPosition(position[0], position[1], position[2]);
  part.setLocalScale(scale[0], scale[1], scale[2]);
  part.setLocalEulerAngles(euler[0], euler[1], euler[2]);
  parent.addChild(part);
  return part;
}

/**
 * Presentation-only combat layer. It derives motion and destruction cues from authoritative snapshots
 * but never changes simulation state, timings, damage, targeting, or replay identity.
 */
export class CombatPresentationPass {
  private readonly transient: CombatTransient[] = [];
  private readonly buildingState = new Map<number, BuildingVisualState>();
  private lastProcessedTick = -1;
  private readonly maxTransient: number;

  private readonly playerEnergy = createMaterial(
    new pc.Color(0.5, 1, 0.9),
    new pc.Color(0.08, 0.78, 0.62),
    0.9,
  );
  private readonly enemyEnergy = createMaterial(
    new pc.Color(1, 0.5, 0.14),
    new pc.Color(0.92, 0.14, 0.02),
    0.9,
  );
  private readonly meleeMaterial = createMaterial(
    new pc.Color(1, 0.9, 0.55),
    new pc.Color(1, 0.42, 0.06),
    0.82,
  );
  private readonly dustMaterial = createMaterial(
    new pc.Color(0.38, 0.33, 0.27),
    new pc.Color(0.04, 0.03, 0.025),
    0.48,
  );
  private readonly debrisMaterial = createMaterial(new pc.Color(0.24, 0.23, 0.21));
  private readonly shockMaterial = createMaterial(
    new pc.Color(0.86, 0.54, 0.22),
    new pc.Color(0.24, 0.07, 0.015),
    0.38,
  );
  private readonly smokeMaterial = createSmokeMaterial(new pc.Color(0.18, 0.19, 0.19), 0.32);
  private readonly elementMaterials = Object.fromEntries(
    Object.entries(ELEMENT_TINTS).map(([element, tint]) => {
      const color = tintColor(tint);
      return [element, createMaterial(color, color, 0.9)];
    }),
  ) as Record<ElementKey, pc.StandardMaterial>;

  constructor(
    private readonly app: pc.Application,
    private readonly effects: BattleVfx,
    initialStrategic: StrategicSnapshot | null = null,
    private readonly lowQuality = false,
  ) {
    this.maxTransient = lowQuality ? 28 : 48;
    if (initialStrategic) this.captureBuildingState(initialStrategic);
  }

  sync(
    previous: SimulationSnapshot,
    current: SimulationSnapshot,
    alpha: number,
    strategic: StrategicSnapshot | null,
  ): void {
    if (current.tick !== this.lastProcessedTick) {
      this.processUnitEvents(previous, current);
      if (strategic) this.processStrategicEvents(strategic, current.tick);
      this.lastProcessedTick = current.tick;
    }
    this.updateTransient(current.tick, alpha);
  }

  destroy(): void {
    for (const transient of this.transient) transient.entity.destroy();
    this.transient.length = 0;
    this.playerEnergy.destroy();
    this.enemyEnergy.destroy();
    this.meleeMaterial.destroy();
    this.dustMaterial.destroy();
    this.debrisMaterial.destroy();
    this.shockMaterial.destroy();
    this.smokeMaterial.destroy();
    for (const material of Object.values(this.elementMaterials)) material.destroy();
  }

  private processUnitEvents(previous: SimulationSnapshot, current: SimulationSnapshot): void {
    const previousById = snapshotMap(previous);
    const currentById = snapshotMap(current);
    const authority = (current as Partial<M04SimulationSnapshot>).elementalAuthority;
    const run = (current as Partial<M06SimulationSnapshot>).run;
    const objectiveOrders = new Map(run?.objectiveAttackOrders.map((order) => [order.entityId, order.objective]) ?? []);
    const alignments = new Map(authority?.alignedElementalists.map((entry) => [entry.entityId, entry.element]));

    for (const unit of current.entities) {
      const prior = previousById.get(unit.id);
      if (!prior) continue;

      if (prior.alive && !unit.alive && prior.visibleToPlayer) {
        this.spawnUnitDeath(prior, current.tick);
        continue;
      }

      if (!unit.alive || !unit.visibleToPlayer || unit.nextAttackTick <= prior.nextAttackTick) continue;

      const target = unit.attackTargetEntityId === null ? null : currentById.get(unit.attackTargetEntityId);
      if (target && !target.visibleToPlayer && target.playerId !== 0) continue;
      const objective = objectiveOrders.get(unit.id);
      const objectiveTarget = objective === 'ENEMY_CORE'
        ? run?.enemyCore
        : objective === 'PLAYER_CORE'
          ? run?.playerCore
          : objective === 'BOSS'
            ? run?.boss
            : null;
      if (!target && !objectiveTarget) continue;
      const structureTarget = objective === 'ENEMY_CORE' || objective === 'PLAYER_CORE';
      const end = target
        ? entityPoint(target, 0.48)
        : new pc.Vec3(
            metres(objectiveTarget!.x),
            structureTarget ? buildingVisualProfile('ELEMENTAL_CORE').height * 0.42 : 1.35,
            metres(objectiveTarget!.z),
          );
      const style = unitVisualProfile(unit.archetype).projectile;
      const alignment = alignments.get(unit.id);
      const tint = alignment ? ELEMENT_TINTS[alignment] : unit.playerId === 0
        ? ([0.42, 1, 0.86] as const)
        : ([1, 0.42, 0.12] as const);

      if (style === 'NONE') this.spawnMeleeAttack(unit, end, current.tick, structureTarget);
      else this.spawnRangedAttack(unit, end, style, tint, alignment ?? null, current.tick, structureTarget);
    }
  }

  private spawnMeleeAttack(attacker: EntitySnapshot, end: pc.Vec3, tick: number, structureTarget = false): void {
    const start = entityPoint(attacker, 0.48);
    const yaw = yawBetween(start, end);
    const heavy = isHeavyMelee(attacker.archetype);
    const root = new pc.Entity(`Melee motion ${attacker.id}`);
    root.setPosition(
      pc.math.lerp(start.x, end.x, 0.62),
      pc.math.lerp(start.y, end.y, 0.62),
      pc.math.lerp(start.z, end.z, 0.62),
    );
    root.setEulerAngles(0, yaw, 0);

    if (attacker.archetype === 'SPEAR_GUARD') {
      const thrust = new pc.Entity('Spear thrust streak');
      thrust.addComponent('render', { type: 'box', material: this.meleeMaterial, castShadows: false });
      thrust.setLocalPosition(0, 0.03, -0.1);
      thrust.setLocalScale(0.055, 0.055, 1.25);
      root.addChild(thrust);
    } else {
      const slashA = new pc.Entity('Slash edge A');
      slashA.addComponent('render', { type: 'box', material: this.meleeMaterial, castShadows: false });
      slashA.setLocalPosition(-0.18, 0.04, 0);
      slashA.setLocalScale(heavy ? 0.78 : 0.58, 0.055, 0.08);
      slashA.setLocalEulerAngles(0, 0, heavy ? 34 : 42);
      root.addChild(slashA);

      const slashB = new pc.Entity('Slash edge B');
      slashB.addComponent('render', { type: 'box', material: this.meleeMaterial, castShadows: false });
      slashB.setLocalPosition(0.14, -0.02, 0.05);
      slashB.setLocalScale(heavy ? 0.62 : 0.46, 0.045, 0.065);
      slashB.setLocalEulerAngles(0, 0, heavy ? -20 : -30);
      root.addChild(slashB);
    }

    this.app.root.addChild(root);
    this.pushTransient({
      entity: root,
      kind: 'MELEE_SLASH',
      bornTick: tick,
      expiresTick: tick + 2,
      baseScale: heavy ? 1.28 : 1,
    });
    this.effects.burst(
      end.x,
      end.y,
      end.z,
      heavy ? [1, 0.48, 0.08] : [1, 0.78, 0.28],
      tick,
      structureTarget ? (heavy ? 14 : 9) : (heavy ? 9 : 5),
      structureTarget ? (heavy ? 1.05 : 0.72) : (heavy ? 0.85 : 0.54),
    );
    if (attacker.archetype === 'GOLEM') {
      this.spawnHeavyShock(end.x, end.z, tick, structureTarget ? 1.45 : 1.12);
      if (!this.lowQuality) {
        this.effects.burst(start.x, 0.18, start.z, [0.52, 0.39, 0.24], tick, 4, 0.42);
      }
    }
  }

  private spawnRangedAttack(
    attacker: EntitySnapshot,
    end: pc.Vec3,
    style: UnitProjectileStyle,
    tint: Tint,
    element: ElementKey | null,
    tick: number,
    structureTarget = false,
  ): void {
    const attackerProfile = unitVisualProfile(attacker.archetype);
    const start = new pc.Vec3(metres(attacker.x), attackerProfile.height * 0.66, metres(attacker.z));
    const yaw = yawBetween(start, end);
    const material = element ? this.elementMaterials[element]
      : attacker.playerId === 0 ? this.playerEnergy : this.enemyEnergy;

    const muzzle = new pc.Entity(`Muzzle flash ${attacker.id}`);
    muzzle.setPosition(start);
    muzzle.setEulerAngles(0, yaw, 0);
    if (element === 'FIRE') {
      addProjectilePart(muzzle, 'Fire muzzle core', 'sphere', material, [0, 0, .18], [.21, .18, .30]);
      addProjectilePart(muzzle, 'Fire muzzle tongue', 'box', material, [0, .02, .38], [.11, .08, .44]);
    } else if (element === 'WATER') {
      addProjectilePart(muzzle, 'Water muzzle disk', 'sphere', material, [0, 0, .18], [.28, .09, .28]);
      addProjectilePart(muzzle, 'Water muzzle sheet', 'box', material, [0, 0, .26], [.42, .025, .18], [0, 0, 12]);
    } else if (element === 'ICE') {
      addProjectilePart(muzzle, 'Ice muzzle star A', 'box', material, [0, 0, .24], [.08, .08, .38], [0, 0, 45]);
      addProjectilePart(muzzle, 'Ice muzzle star B', 'box', material, [0, 0, .24], [.08, .08, .38], [0, 0, -45]);
    } else if (element === 'LIGHTNING') {
      addProjectilePart(muzzle, 'Lightning muzzle prong A', 'box', material, [-.08, 0, .28], [.04, .04, .38], [0, 18, 0]);
      addProjectilePart(muzzle, 'Lightning muzzle prong B', 'box', material, [.08, 0, .28], [.04, .04, .38], [0, -18, 0]);
      addProjectilePart(muzzle, 'Lightning muzzle core', 'sphere', material, [0, 0, .15], [.12, .12, .12]);
    } else {
      addProjectilePart(
        muzzle,
        'Muzzle core',
        'sphere',
        material,
        [0, 0, .18],
        style === 'SHELL' ? [.26, .20, .34] : [.18, .14, .24],
      );
      addProjectilePart(
        muzzle,
        'Muzzle cross',
        'box',
        material,
        [0, 0, .22],
        style === 'SHELL' ? [.42, .035, .055] : [.30, .035, .055],
        [0, 0, 45],
      );
    }
    this.app.root.addChild(muzzle);
    this.pushTransient({
      entity: muzzle,
      kind: 'MUZZLE_FLASH',
      bornTick: tick,
      expiresTick: tick + 1,
      baseScale: 1,
      element: element ?? undefined,
      yaw,
    });

    const trace = new pc.Entity(`${element ?? style} tracer ${attacker.id}`);
    trace.setPosition(start);
    trace.setEulerAngles(0, yaw, 0);
    if (style === 'ORB') {
      if (element === 'FIRE') {
        addProjectilePart(trace, 'Fire comet core', 'sphere', material, [0, .01, .12], [.19, .17, .28]);
        addProjectilePart(trace, 'Fire comet flame', 'box', material, [0, -.01, -.28], [.10, .08, .58]);
        addProjectilePart(trace, 'Fire comet halo', 'sphere', material, [0, 0, -.03], [.28, .10, .24]);
      } else if (element === 'WATER') {
        addProjectilePart(trace, 'Water dart core', 'sphere', material, [0, 0, .08], [.23, .13, .34]);
        addProjectilePart(trace, 'Water wake', 'box', material, [0, 0, -.30], [.30, .025, .50]);
        addProjectilePart(trace, 'Water wake fin', 'box', material, [0, 0, -.10], [.42, .025, .18], [0, 0, 12]);
      } else if (element === 'ICE') {
        addProjectilePart(trace, 'Ice shard core', 'box', material, [0, 0, .08], [.13, .13, .48], [0, 0, 45]);
        addProjectilePart(trace, 'Ice shard left', 'box', material, [-.11, .01, -.10], [.07, .07, .30], [0, 20, 45]);
        addProjectilePart(trace, 'Ice shard right', 'box', material, [.11, -.01, -.10], [.07, .07, .30], [0, -20, 45]);
      } else if (element === 'LIGHTNING') {
        addProjectilePart(trace, 'Lightning segment A', 'box', material, [-.07, .02, .20], [.045, .045, .30], [0, 22, 0]);
        addProjectilePart(trace, 'Lightning segment B', 'box', material, [.07, -.02, -.05], [.045, .045, .30], [0, -24, 0]);
        addProjectilePart(trace, 'Lightning segment C', 'box', material, [-.05, .02, -.30], [.04, .04, .26], [0, 18, 0]);
        addProjectilePart(trace, 'Lightning pulse core', 'sphere', material, [0, 0, .04], [.10, .10, .10]);
      } else {
        addProjectilePart(trace, 'Orb tracer core', 'sphere', material, [0, 0, 0], [.23, .23, .23]);
        addProjectilePart(trace, 'Orb tracer halo', 'sphere', material, [0, 0, 0], [.35, .12, .35]);
      }
    } else if (style === 'SHELL') {
      addProjectilePart(trace, 'Shell tracer body', 'sphere', material, [0, 0, 0], [.28, .24, .34]);
      addProjectilePart(trace, 'Shell smoke streak', 'box', this.smokeMaterial, [0, 0, -.42], [.12, .10, .72]);
    } else {
      addProjectilePart(trace, 'Bolt tracer core', 'box', material, [0, 0, 0], [.055, .055, .66]);
      addProjectilePart(trace, 'Bolt tracer trail', 'box', material, [0, 0, -.48], [.035, .035, .52]);
    }
    this.app.root.addChild(trace);
    this.pushTransient({
      entity: trace,
      kind: style === 'SHELL' ? 'SHELL_TRACE' : 'PROJECTILE_TRACE',
      bornTick: tick,
      expiresTick: tick + (style === 'SHELL' ? 3 : 2),
      start,
      end,
      baseScale: 1,
      impactTint: tint,
      impactForce: structureTarget
        ? (style === 'SHELL' ? 1.18 : element === 'FIRE' ? 1.02 : 0.82)
        : style === 'SHELL' ? 0.95 : element === 'FIRE' ? 0.82 : element === 'ICE' ? 0.74 : style === 'ORB' ? 0.68 : 0.52,
      element: element ?? undefined,
      yaw,
    });

    this.effects.burst(
      start.x,
      start.y,
      start.z,
      tint,
      tick,
      style === 'SHELL' ? 5 : element === 'LIGHTNING' ? 5 : 3,
      style === 'SHELL' ? 0.42 : element === 'FIRE' ? 0.34 : 0.28,
    );
    if (attacker.archetype === 'SIEGE_CONSTRUCT') {
      this.spawnHeavyShock(start.x, start.z, tick, 0.92);
      if (!this.lowQuality) {
        this.effects.burst(start.x, 0.22, start.z, [0.48, 0.42, 0.34], tick, 4, 0.36);
      }
    }
  }

  private spawnUnitDeath(unit: EntitySnapshot, tick: number): void {
    const profile = unitVisualProfile(unit.archetype);
    const x = metres(unit.x);
    const z = metres(unit.z);
    const heavy = unit.archetype === 'GOLEM' || unit.archetype === 'SIEGE_CONSTRUCT';

    const dust = new pc.Entity(`Unit death dust ${unit.id}`);
    dust.addComponent('render', { type: 'sphere', material: this.dustMaterial, castShadows: false });
    dust.setPosition(x, 0.18, z);
    dust.setLocalScale(profile.selectionScale * 0.45, 0.18, profile.selectionScale * 0.45);
    this.app.root.addChild(dust);
    this.pushTransient({
      entity: dust,
      kind: 'UNIT_DEATH_DUST',
      bornTick: tick,
      expiresTick: tick + 5,
      baseScale: profile.selectionScale * (heavy ? 0.72 : 0.52),
    });

    const shardCount = heavy ? 6 : 3;
    for (let index = 0; index < shardCount; index += 1) {
      const angle = (index / shardCount) * Math.PI * 2 + unit.id * 0.37;
      const shard = new pc.Entity(`Unit death shard ${unit.id}-${index}`);
      shard.addComponent('render', { type: 'box', material: this.debrisMaterial, castShadows: false });
      shard.setPosition(x, profile.height * 0.3, z);
      shard.setLocalScale(heavy ? 0.18 : 0.11, heavy ? 0.15 : 0.09, heavy ? 0.28 : 0.2);
      this.app.root.addChild(shard);
      this.pushTransient({
        entity: shard,
        kind: 'UNIT_DEATH_SHARD',
        bornTick: tick,
        expiresTick: tick + 5,
        baseScale: 1,
        velocity: new pc.Vec3(Math.cos(angle) * (heavy ? 0.18 : 0.12), 0.18 + (index % 2) * 0.06, Math.sin(angle) * (heavy ? 0.18 : 0.12)),
        spin: new pc.Vec3(19 + index * 7, 28 + index * 11, 13 + index * 5),
      });
    }

    this.effects.burst(x, profile.height * 0.3, z, heavy ? [0.78, 0.46, 0.18] : [0.6, 0.5, 0.36], tick, heavy ? 14 : 8, heavy ? 1 : 0.72);
  }

  private processStrategicEvents(snapshot: StrategicSnapshot, tick: number): void {
    for (const building of snapshot.buildings) {
      const prior = this.buildingState.get(building.id);
      if (prior && !prior.destroyed && building.destroyed) this.spawnBuildingDestruction(building, tick);
      else if (prior && !building.destroyed && building.currentHealth < prior.currentHealth) this.spawnBuildingHit(building, tick);
      this.buildingState.set(building.id, {
        destroyed: building.destroyed,
        currentHealth: building.currentHealth,
      });
    }
  }

  private spawnBuildingHit(building: StrategicBuilding, tick: number): void {
    const profile = buildingVisualProfile(building.type);
    const x = metres(building.x);
    const z = metres(building.z);
    const healthRatio = Math.max(0, Math.min(1, building.currentHealth / Math.max(1, building.maxHealth)));
    const severity = 1 - healthRatio;
    const emphasis = building.type === 'ELEMENTAL_CORE'
      ? 1.32
      : building.type === 'ARCANE_TOWER'
        ? 1.18
        : building.type === 'BARRACKS'
          ? 1.12
          : 1;
    this.effects.burst(
      x,
      Math.max(0.45, profile.height * 0.35),
      z,
      [1, 0.58, 0.2],
      tick,
      this.lowQuality ? 4 : Math.round(5 + severity * 4 * emphasis),
      (0.44 + severity * 0.23) * emphasis,
    );
    if (!this.lowQuality && severity >= 0.66) {
      const smoke = new pc.Entity(`Building hit smoke ${building.id}`);
      smoke.addComponent('render', { type: 'sphere', material: this.smokeMaterial, castShadows: false });
      smoke.setPosition(x, Math.max(0.55, profile.height * 0.56), z);
      this.app.root.addChild(smoke);
      this.pushTransient({
        entity: smoke,
        kind: 'BUILDING_SMOKE',
        bornTick: tick,
        expiresTick: tick + 5,
        baseScale: profile.footprint * 0.24 * emphasis,
      });
    }
  }

  private spawnBuildingDestruction(building: StrategicBuilding, tick: number): void {
    const profile = buildingVisualProfile(building.type);
    const x = metres(building.x);
    const z = metres(building.z);

    const dust = new pc.Entity(`Building collapse dust ${building.id}`);
    dust.addComponent('render', { type: 'sphere', material: this.dustMaterial, castShadows: false });
    dust.setPosition(x, 0.36, z);
    dust.setLocalScale(profile.footprint * 0.48, 0.34, profile.footprint * 0.48);
    this.app.root.addChild(dust);
    this.pushTransient({
      entity: dust,
      kind: 'BUILDING_DUST',
      bornTick: tick,
      expiresTick: tick + 8,
      baseScale: profile.footprint * 0.66,
    });

    this.spawnHeavyShock(x, z, tick, Math.max(1.1, profile.footprint * 0.46));

    const smokeCount = this.lowQuality ? 1 : 3;
    for (let index = 0; index < smokeCount; index += 1) {
      const smoke = new pc.Entity(`Building collapse smoke ${building.id}-${index}`);
      smoke.addComponent('render', { type: 'sphere', material: this.smokeMaterial, castShadows: false });
      const angle = index * 2.094 + building.id * 0.41;
      smoke.setPosition(
        x + Math.cos(angle) * profile.footprint * 0.12,
        0.34 + index * 0.16,
        z + Math.sin(angle) * profile.footprint * 0.12,
      );
      this.app.root.addChild(smoke);
      this.pushTransient({
        entity: smoke,
        kind: 'BUILDING_SMOKE',
        bornTick: tick,
        expiresTick: tick + 9 + index,
        baseScale: profile.footprint * (0.28 + index * 0.04),
      });
    }

    const debrisCount = this.lowQuality
      ? Math.min(4, Math.max(3, Math.round(profile.footprint)))
      : Math.min(9, Math.max(5, Math.round(profile.footprint * 2.2)));
    for (let index = 0; index < debrisCount; index += 1) {
      const angle = (index / debrisCount) * Math.PI * 2 + building.id * 0.29;
      const debris = new pc.Entity(`Building debris ${building.id}-${index}`);
      debris.addComponent('render', { type: 'box', material: this.debrisMaterial, castShadows: false });
      debris.setPosition(x, Math.max(0.4, profile.height * 0.3), z);
      const size = 0.16 + (index % 3) * 0.07;
      debris.setLocalScale(size, size * 0.72, size * 1.16);
      this.app.root.addChild(debris);
      this.pushTransient({
        entity: debris,
        kind: 'BUILDING_DEBRIS',
        bornTick: tick,
        expiresTick: tick + 8,
        baseScale: 1,
        velocity: new pc.Vec3(Math.cos(angle) * (0.16 + (index % 2) * 0.05), 0.22 + (index % 3) * 0.05, Math.sin(angle) * (0.16 + ((index + 1) % 2) * 0.05)),
        spin: new pc.Vec3(16 + index * 4, 21 + index * 7, 11 + index * 5),
      });
    }

    this.effects.burst(x, Math.max(0.4, profile.height * 0.28), z, [0.86, 0.45, 0.12], tick, 18, 1.15);
  }

  private updateTransient(tick: number, alpha: number): void {
    for (let index = this.transient.length - 1; index >= 0; index -= 1) {
      const transient = this.transient[index]!;
      const duration = Math.max(1, transient.expiresTick - transient.bornTick);
      const progress = Math.max(0, Math.min(1, (tick - transient.bornTick + alpha) / duration));

      if (tick + alpha >= transient.expiresTick) {
        if (transient.impactTint && transient.end) {
          this.effects.burst(
            transient.end.x,
            transient.end.y,
            transient.end.z,
            transient.impactTint,
            tick,
            transient.kind === 'SHELL_TRACE' ? 11 : transient.element === 'FIRE' ? 9 : transient.element === 'ICE' ? 8 : 6,
            transient.impactForce ?? 0.58,
          );
          if (transient.element === 'LIGHTNING') {
            const branchStart = transient.end.clone();
            branchStart.x -= 0.24;
            branchStart.y += 0.18;
            branchStart.z -= 0.08;
            const branchEnd = transient.end.clone();
            branchEnd.x += 0.26;
            branchEnd.y += 0.03;
            branchEnd.z += 0.12;
            this.effects.bolt(branchStart, branchEnd, tick);
          }
          if (transient.kind === 'SHELL_TRACE') {
            this.spawnHeavyShock(transient.end.x, transient.end.z, tick, transient.impactForce ?? 1);
          }
        }
        transient.entity.destroy();
        this.transient.splice(index, 1);
        continue;
      }

      if ((transient.kind === 'PROJECTILE_TRACE' || transient.kind === 'SHELL_TRACE') && transient.start && transient.end) {
        const ease = progress * progress * (3 - 2 * progress);
        let x = pc.math.lerp(transient.start.x, transient.end.x, ease);
        let z = pc.math.lerp(transient.start.z, transient.end.z, ease);
        let y = pc.math.lerp(transient.start.y, transient.end.y, ease);
        if (transient.kind === 'SHELL_TRACE') {
          y += Math.sin(progress * Math.PI) * 1.18;
        } else if (transient.element === 'FIRE') {
          y += Math.sin(progress * Math.PI) * 0.24;
        } else if (transient.element === 'WATER') {
          const dx = transient.end.x - transient.start.x;
          const dz = transient.end.z - transient.start.z;
          const length = Math.max(0.001, Math.hypot(dx, dz));
          const wobble = Math.sin(progress * Math.PI * 4) * 0.11 * (1 - progress * 0.35);
          x += (-dz / length) * wobble;
          z += (dx / length) * wobble;
          y += Math.sin(progress * Math.PI) * 0.08;
        } else if (transient.element === 'ICE') {
          y += Math.sin(progress * Math.PI) * 0.045;
        } else if (transient.element === 'LIGHTNING') {
          const dx = transient.end.x - transient.start.x;
          const dz = transient.end.z - transient.start.z;
          const length = Math.max(0.001, Math.hypot(dx, dz));
          const zigzag = Math.sin(progress * Math.PI * 10) * 0.14 * (1 - progress * 0.2);
          x += (-dz / length) * zigzag;
          z += (dx / length) * zigzag;
          y += Math.sin(progress * Math.PI * 7) * 0.055;
        } else {
          y += Math.sin(progress * Math.PI) * 0.12;
        }
        transient.entity.setPosition(x, y, z);

        const pulse = Math.sin(progress * Math.PI);
        if (transient.element === 'FIRE') {
          transient.entity.setLocalScale(1 + pulse * 0.22, 1 + pulse * 0.18, 1 + pulse * 0.08);
          transient.entity.setEulerAngles(0, transient.yaw ?? 0, progress * 160);
        } else if (transient.element === 'WATER') {
          transient.entity.setLocalScale(1 + pulse * 0.16, 0.92 + pulse * 0.08, 1 + pulse * 0.24);
          transient.entity.setEulerAngles(0, transient.yaw ?? 0, Math.sin(progress * Math.PI * 4) * 8);
        } else if (transient.element === 'ICE') {
          transient.entity.setLocalScale(1 + pulse * 0.08, 1 + pulse * 0.08, 1 + pulse * 0.18);
          transient.entity.setEulerAngles(0, transient.yaw ?? 0, progress * 220);
        } else if (transient.element === 'LIGHTNING') {
          const flicker = 0.92 + Math.abs(Math.sin(progress * Math.PI * 12)) * 0.28;
          transient.entity.setLocalScale(flicker, flicker, 1 + pulse * 0.12);
          transient.entity.setEulerAngles(0, transient.yaw ?? 0, Math.sin(progress * Math.PI * 8) * 18);
        } else {
          transient.entity.setLocalScale(1 + pulse * 0.14, 1 + pulse * 0.14, 1);
        }
      } else if (transient.kind === 'MELEE_SLASH') {
        const scale = transient.baseScale * (0.72 + Math.sin(progress * Math.PI) * 0.5);
        transient.entity.setLocalScale(scale, scale, scale);
        transient.entity.rotateLocal(0, 0, 16 * (1 - progress));
      } else if (transient.kind === 'MUZZLE_FLASH') {
        const scale = 1.25 - progress * 0.72;
        transient.entity.setLocalScale(scale, scale, scale);
      } else if (transient.kind === 'HEAVY_SHOCK_RING') {
        const scale = transient.baseScale * (0.42 + progress * 1.25);
        transient.entity.setLocalScale(scale, 0.018, scale);
      } else if (transient.kind === 'UNIT_DEATH_DUST' || transient.kind === 'BUILDING_DUST') {
        const scale = transient.baseScale * (0.72 + progress * 1.35);
        const position = transient.entity.getPosition();
        transient.entity.setPosition(position.x, position.y + 0.025, position.z);
        transient.entity.setLocalScale(scale, scale * (0.38 + progress * 0.32), scale);
      } else if (transient.kind === 'BUILDING_SMOKE') {
        const scale = transient.baseScale * (0.66 + progress * 1.12);
        const position = transient.entity.getPosition();
        transient.entity.setPosition(position.x, position.y + 0.035, position.z);
        transient.entity.setLocalScale(scale, scale * (1.08 + progress * 0.38), scale);
      } else if ((transient.kind === 'UNIT_DEATH_SHARD' || transient.kind === 'BUILDING_DEBRIS') && transient.velocity) {
        const position = transient.entity.getPosition();
        const velocity = transient.velocity;
        transient.entity.setPosition(
          position.x + velocity.x,
          Math.max(0.06, position.y + velocity.y),
          position.z + velocity.z,
        );
        velocity.y -= 0.055;
        velocity.x *= 0.94;
        velocity.z *= 0.94;
        if (transient.spin) transient.entity.rotateLocal(transient.spin.x, transient.spin.y, transient.spin.z);
      }
    }
  }

  private spawnHeavyShock(x: number, z: number, tick: number, force: number): void {
    if (this.lowQuality) return;
    const ring = new pc.Entity('Heavy impact shock ring');
    ring.addComponent('render', { type: 'cylinder', material: this.shockMaterial, castShadows: false });
    ring.setPosition(x, 0.075, z);
    ring.setLocalScale(0.2, 0.018, 0.2);
    this.app.root.addChild(ring);
    this.pushTransient({
      entity: ring,
      kind: 'HEAVY_SHOCK_RING',
      bornTick: tick,
      expiresTick: tick + 3,
      baseScale: Math.max(0.52, force),
    });
  }

  private pushTransient(transient: CombatTransient): void {
    while (this.transient.length >= this.maxTransient) this.transient.shift()!.entity.destroy();
    this.transient.push(transient);
  }

  private captureBuildingState(snapshot: StrategicSnapshot): void {
    for (const building of snapshot.buildings) {
      this.buildingState.set(building.id, {
        destroyed: building.destroyed,
        currentHealth: building.currentHealth,
      });
    }
  }
}
