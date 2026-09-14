import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { UnitArchetype } from '../simulation/components';
import type { M04SimulationSnapshot } from '../simulation/m04-simulation';
import type { StrategicBuilding, StrategicSnapshot } from '../simulation/strategic-state';
import type { EntitySnapshot, SimulationSnapshot } from '../simulation/simulation';
import { BattleVfx, ELEMENT_TINTS } from './battle-vfx';
import { buildingVisualProfile } from './building-visual-profile';
import { unitVisualProfile, type UnitProjectileStyle } from './unit-visual-profile';

type Tint = readonly [number, number, number];
type TransientKind =
  | 'MELEE_SLASH'
  | 'MUZZLE_FLASH'
  | 'PROJECTILE_TRACE'
  | 'SHELL_TRACE'
  | 'UNIT_DEATH_DUST'
  | 'UNIT_DEATH_SHARD'
  | 'BUILDING_DUST'
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

/**
 * Presentation-only combat layer. It derives motion and destruction cues from authoritative snapshots
 * but never changes simulation state, timings, damage, targeting, or replay identity.
 */
export class CombatPresentationPass {
  private readonly transient: CombatTransient[] = [];
  private readonly buildingState = new Map<number, BuildingVisualState>();
  private lastProcessedTick = -1;
  private readonly maxTransient = 48;

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
  private readonly smokeMaterial = createMaterial(
    new pc.Color(0.28, 0.3, 0.31),
    new pc.Color(0.02, 0.02, 0.02),
    0.38,
  );
  private readonly elementMaterials = Object.fromEntries(
    Object.entries(ELEMENT_TINTS).map(([element, tint]) => {
      const color = tintColor(tint);
      return [element, createMaterial(color, color, 0.9)];
    }),
  ) as Record<keyof typeof ELEMENT_TINTS, pc.StandardMaterial>;

  constructor(
    private readonly app: pc.Application,
    private readonly effects: BattleVfx,
    initialStrategic: StrategicSnapshot | null = null,
  ) {
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
    this.smokeMaterial.destroy();
    for (const material of Object.values(this.elementMaterials)) material.destroy();
  }

  private processUnitEvents(previous: SimulationSnapshot, current: SimulationSnapshot): void {
    const previousById = snapshotMap(previous);
    const currentById = snapshotMap(current);
    const authority = (current as Partial<M04SimulationSnapshot>).elementalAuthority;
    const alignments = new Map(authority?.alignedElementalists.map((entry) => [entry.entityId, entry.element]));

    for (const unit of current.entities) {
      const prior = previousById.get(unit.id);
      if (!prior) continue;

      if (prior.alive && !unit.alive && prior.visibleToPlayer) {
        this.spawnUnitDeath(prior, current.tick);
        continue;
      }

      if (
        !unit.alive
        || !unit.visibleToPlayer
        || unit.attackTargetEntityId === null
        || unit.nextAttackTick <= prior.nextAttackTick
      ) continue;

      const target = currentById.get(unit.attackTargetEntityId);
      if (!target || (!target.visibleToPlayer && target.playerId !== 0)) continue;
      const style = unitVisualProfile(unit.archetype).projectile;
      const alignment = alignments.get(unit.id);
      const tint = alignment ? ELEMENT_TINTS[alignment] : unit.playerId === 0
        ? ([0.42, 1, 0.86] as const)
        : ([1, 0.42, 0.12] as const);

      if (style === 'NONE') this.spawnMeleeAttack(unit, target, current.tick);
      else this.spawnRangedAttack(unit, target, style, tint, alignment ?? null, current.tick);
    }
  }

  private spawnMeleeAttack(attacker: EntitySnapshot, target: EntitySnapshot, tick: number): void {
    const start = entityPoint(attacker, 0.48);
    const end = entityPoint(target, 0.48);
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
      heavy ? 9 : 5,
      heavy ? 0.85 : 0.54,
    );
  }

  private spawnRangedAttack(
    attacker: EntitySnapshot,
    target: EntitySnapshot,
    style: UnitProjectileStyle,
    tint: Tint,
    element: keyof typeof ELEMENT_TINTS | null,
    tick: number,
  ): void {
    const attackerProfile = unitVisualProfile(attacker.archetype);
    const targetProfile = unitVisualProfile(target.archetype);
    const start = new pc.Vec3(metres(attacker.x), attackerProfile.height * 0.66, metres(attacker.z));
    const end = new pc.Vec3(metres(target.x), targetProfile.height * 0.48, metres(target.z));
    const yaw = yawBetween(start, end);
    const material = element ? this.elementMaterials[element]
      : attacker.playerId === 0 ? this.playerEnergy : this.enemyEnergy;

    const muzzle = new pc.Entity(`Muzzle flash ${attacker.id}`);
    muzzle.setPosition(start);
    muzzle.setEulerAngles(0, yaw, 0);
    const muzzleCore = new pc.Entity('Muzzle core');
    muzzleCore.addComponent('render', { type: 'sphere', material, castShadows: false });
    muzzleCore.setLocalPosition(0, 0, 0.18);
    muzzleCore.setLocalScale(style === 'SHELL' ? 0.26 : 0.18, style === 'SHELL' ? 0.2 : 0.14, style === 'SHELL' ? 0.34 : 0.24);
    muzzle.addChild(muzzleCore);
    const muzzleCross = new pc.Entity('Muzzle cross');
    muzzleCross.addComponent('render', { type: 'box', material, castShadows: false });
    muzzleCross.setLocalPosition(0, 0, 0.22);
    muzzleCross.setLocalScale(style === 'SHELL' ? 0.42 : 0.3, 0.035, 0.055);
    muzzleCross.setLocalEulerAngles(0, 0, 45);
    muzzle.addChild(muzzleCross);
    this.app.root.addChild(muzzle);
    this.pushTransient({
      entity: muzzle,
      kind: 'MUZZLE_FLASH',
      bornTick: tick,
      expiresTick: tick + 1,
      baseScale: 1,
    });

    const trace = new pc.Entity(`${style} tracer ${attacker.id}`);
    trace.setPosition(start);
    trace.setEulerAngles(0, yaw, 0);
    if (style === 'ORB') {
      const core = new pc.Entity('Orb tracer core');
      core.addComponent('render', { type: 'sphere', material, castShadows: false });
      core.setLocalScale(0.23, 0.23, 0.23);
      trace.addChild(core);
      const halo = new pc.Entity('Orb tracer halo');
      halo.addComponent('render', { type: 'sphere', material, castShadows: false });
      halo.setLocalScale(0.35, 0.12, 0.35);
      trace.addChild(halo);
    } else if (style === 'SHELL') {
      const shell = new pc.Entity('Shell tracer body');
      shell.addComponent('render', { type: 'sphere', material, castShadows: false });
      shell.setLocalScale(0.28, 0.24, 0.34);
      trace.addChild(shell);
      const smoke = new pc.Entity('Shell smoke streak');
      smoke.addComponent('render', { type: 'box', material: this.smokeMaterial, castShadows: false });
      smoke.setLocalPosition(0, 0, -0.42);
      smoke.setLocalScale(0.12, 0.1, 0.72);
      trace.addChild(smoke);
    } else {
      const bolt = new pc.Entity('Bolt tracer core');
      bolt.addComponent('render', { type: 'box', material, castShadows: false });
      bolt.setLocalScale(0.055, 0.055, 0.66);
      trace.addChild(bolt);
      const trail = new pc.Entity('Bolt tracer trail');
      trail.addComponent('render', { type: 'box', material, castShadows: false });
      trail.setLocalPosition(0, 0, -0.48);
      trail.setLocalScale(0.035, 0.035, 0.52);
      trace.addChild(trail);
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
      impactForce: style === 'SHELL' ? 0.95 : style === 'ORB' ? 0.68 : 0.52,
    });

    this.effects.burst(start.x, start.y, start.z, tint, tick, style === 'SHELL' ? 5 : 3, style === 'SHELL' ? 0.42 : 0.28);
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
    this.effects.burst(x, Math.max(0.45, profile.height * 0.35), z, [1, 0.58, 0.2], tick, 5, 0.46);
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

    const debrisCount = Math.min(9, Math.max(5, Math.round(profile.footprint * 2.2)));
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
            transient.kind === 'SHELL_TRACE' ? 11 : 6,
            transient.impactForce ?? 0.58,
          );
        }
        transient.entity.destroy();
        this.transient.splice(index, 1);
        continue;
      }

      if ((transient.kind === 'PROJECTILE_TRACE' || transient.kind === 'SHELL_TRACE') && transient.start && transient.end) {
        const ease = progress * progress * (3 - 2 * progress);
        const x = pc.math.lerp(transient.start.x, transient.end.x, ease);
        const z = pc.math.lerp(transient.start.z, transient.end.z, ease);
        let y = pc.math.lerp(transient.start.y, transient.end.y, ease);
        if (transient.kind === 'SHELL_TRACE') y += Math.sin(progress * Math.PI) * 1.18;
        else y += Math.sin(progress * Math.PI) * 0.12;
        transient.entity.setPosition(x, y, z);
        transient.entity.setLocalScale(1 + Math.sin(progress * Math.PI) * 0.14, 1 + Math.sin(progress * Math.PI) * 0.14, 1);
      } else if (transient.kind === 'MELEE_SLASH') {
        const scale = transient.baseScale * (0.72 + Math.sin(progress * Math.PI) * 0.5);
        transient.entity.setLocalScale(scale, scale, scale);
        transient.entity.rotateLocal(0, 0, 16 * (1 - progress));
      } else if (transient.kind === 'MUZZLE_FLASH') {
        const scale = 1.25 - progress * 0.72;
        transient.entity.setLocalScale(scale, scale, scale);
      } else if (transient.kind === 'UNIT_DEATH_DUST' || transient.kind === 'BUILDING_DUST') {
        const scale = transient.baseScale * (0.72 + progress * 1.35);
        const position = transient.entity.getPosition();
        transient.entity.setPosition(position.x, position.y + 0.025, position.z);
        transient.entity.setLocalScale(scale, scale * (0.38 + progress * 0.32), scale);
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
