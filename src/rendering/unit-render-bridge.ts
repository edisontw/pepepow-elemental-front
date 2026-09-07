import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { EntityID } from '../simulation/components';
import type { EntitySnapshot, SimulationSnapshot } from '../simulation/simulation';
import { unitVisualProfile, type UnitProjectileStyle } from './unit-visual-profile';

interface UnitPresentation {
  root: pc.Entity;
  selection: pc.Entity;
  healthBack: pc.Entity;
  healthBar: pc.Entity;
  wetMarker: pc.Entity;
  wetBeacon: pc.Entity;
  coldMarker: pc.Entity;
  hitFlash: pc.Entity;
  deathMarker: pc.Entity;
  hitFlashUntilTick: number;
  deathUntilTick: number;
}

interface ProjectilePresentation {
  entity: pc.Entity;
  style: UnitProjectileStyle;
  startTick: number;
  durationTicks: number;
  start: pc.Vec3;
  end: pc.Vec3;
}

function snapshotMap(snapshot: SimulationSnapshot): Map<EntityID, EntitySnapshot> {
  return new Map(snapshot.entities.map((entity) => [entity.id, entity]));
}

function createMaterial(color: pc.Color, emissive?: pc.Color, opacity = 1): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.gloss = 0.42;
  material.opacity = opacity;
  if (opacity < 1) material.blendType = pc.BLEND_NORMAL;
  if (emissive) {
    material.emissive = emissive;
    material.emissiveIntensity = 1.7;
  }
  material.update();
  return material;
}

function metres(value: number): number {
  return value / WORLD_UNITS_PER_METER;
}

export class UnitRenderBridge {
  private readonly units = new Map<EntityID, UnitPresentation>();
  private latest = new Map<EntityID, EntitySnapshot>();
  private readonly screenPosition = new pc.Vec3();
  private readonly projectiles: ProjectilePresentation[] = [];
  private readonly wetMaterial = createMaterial(new pc.Color(0.04, 0.82, 1), new pc.Color(0.03, 0.55, 0.85), 0.82);
  private readonly chilledMaterial = createMaterial(new pc.Color(0.42, 0.78, 1), new pc.Color(0.04, 0.18, 0.32), 0.82);
  private readonly frozenMaterial = createMaterial(new pc.Color(0.72, 0.94, 1), new pc.Color(0.14, 0.42, 0.55), 0.82);
  private readonly playerAccentMaterial = createMaterial(new pc.Color(0.52, 0.96, 0.9), new pc.Color(0.08, 0.58, 0.48));
  private readonly enemyAccentMaterial = createMaterial(new pc.Color(1, 0.57, 0.22), new pc.Color(0.7, 0.14, 0.03));
  private readonly healthBackMaterial = createMaterial(new pc.Color(0.045, 0.055, 0.055));
  private readonly hitMaterial = createMaterial(new pc.Color(1, 0.86, 0.36), new pc.Color(1, 0.32, 0.06), 0.72);
  private readonly deathMaterial = createMaterial(new pc.Color(0.38, 0.4, 0.42), new pc.Color(0.12, 0.12, 0.12), 0.58);
  private readonly playerProjectileMaterial = createMaterial(new pc.Color(0.56, 1, 0.94), new pc.Color(0.06, 0.72, 0.6));
  private readonly enemyProjectileMaterial = createMaterial(new pc.Color(1, 0.52, 0.18), new pc.Color(0.82, 0.1, 0.02));
  private lastFeedbackTick = -1;

  constructor(
    private readonly app: pc.Application,
    initialSnapshot: SimulationSnapshot,
    private readonly unitMaterials: { player: pc.Material; enemyMelee: pc.Material; enemyRanged: pc.Material },
    private readonly selectionMaterial: pc.Material,
    private readonly healthMaterial: pc.Material,
  ) {
    for (const unit of initialSnapshot.entities) this.createPresentation(unit);
    this.sync(initialSnapshot, initialSnapshot, 1);
  }

  sync(previous: SimulationSnapshot, current: SimulationSnapshot, alpha: number): void {
    this.latest = snapshotMap(current);
    const previousById = snapshotMap(previous);
    if (current.tick !== this.lastFeedbackTick) {
      this.detectCombatFeedback(previousById, current);
      this.lastFeedbackTick = current.tick;
    }

    for (const unit of current.entities) {
      let presentation = this.units.get(unit.id);
      if (!presentation) presentation = this.createPresentation(unit);
      const profile = unitVisualProfile(unit.archetype);
      const presented = unit.alive && unit.visibleToPlayer;
      presentation.root.enabled = presented;
      presentation.selection.enabled = presented && presentation.selection.enabled;
      presentation.healthBack.enabled = presented;
      presentation.healthBar.enabled = presented;
      presentation.wetMarker.enabled = presented && unit.wet;
      presentation.wetBeacon.enabled = presented && unit.wet;
      presentation.coldMarker.enabled = presented && (unit.chilledTicks > 0 || unit.frozenTicks > 0);
      presentation.hitFlash.enabled = presented && current.tick <= presentation.hitFlashUntilTick;
      presentation.deathMarker.enabled = !unit.alive && current.tick <= presentation.deathUntilTick;
      if (presentation.coldMarker.render) {
        presentation.coldMarker.render.material = unit.frozenTicks > 0 ? this.frozenMaterial : this.chilledMaterial;
      }

      const prior = previousById.get(unit.id) ?? unit;
      const x = pc.math.lerp(prior.x, unit.x, alpha) / WORLD_UNITS_PER_METER;
      const z = pc.math.lerp(prior.z, unit.z, alpha) / WORLD_UNITS_PER_METER;
      if (presented) {
        presentation.root.setPosition(x, 0, z);
        const deltaX = unit.x - prior.x;
        const deltaZ = unit.z - prior.z;
        if (deltaX !== 0 || deltaZ !== 0) {
          presentation.root.setEulerAngles(0, Math.atan2(deltaX, deltaZ) * 180 / Math.PI, 0);
        }
      }

      const statusY = Math.max(0.18, profile.height * 0.08);
      presentation.selection.setPosition(x, 0.055, z);
      presentation.wetMarker.setPosition(x, statusY, z);
      presentation.wetBeacon.setPosition(x, profile.height + 0.52, z);
      presentation.coldMarker.setPosition(x, profile.height * 0.72, z);
      presentation.hitFlash.setPosition(x, profile.height * 0.52, z);
      if (presentation.deathMarker.enabled) {
        presentation.deathMarker.setPosition(metres(prior.x), 0.18, metres(prior.z));
        const remaining = Math.max(0, presentation.deathUntilTick - current.tick);
        const scale = 0.52 + remaining * 0.08;
        presentation.deathMarker.setLocalScale(scale, 0.08, scale);
      }

      if (!presented) continue;
      const healthRatio = unit.currentHealth / Math.max(1, unit.maxHealth);
      const healthWidth = Math.max(1.05, profile.selectionScale * 1.05);
      const healthY = profile.height + 0.34;
      presentation.healthBack.setPosition(x, healthY, z);
      presentation.healthBack.setLocalScale(healthWidth, 0.11, 0.14);
      presentation.healthBar.setPosition(x - (1 - healthRatio) * healthWidth * 0.5, healthY + 0.012, z);
      presentation.healthBar.setLocalScale(healthWidth * healthRatio, 0.075, 0.1);
    }

    this.updateProjectiles(current.tick, alpha);
  }

  setSelected(entityIds: ReadonlySet<EntityID>): void {
    for (const [entityId, presentation] of this.units) {
      presentation.selection.enabled = entityIds.has(entityId) && this.latest.get(entityId)?.alive === true;
    }
  }

  pickSingle(camera: pc.CameraComponent, screenX: number, screenY: number, maxDistance = 24): EntityID | null {
    let bestId: EntityID | null = null;
    let bestDistanceSquared = maxDistance * maxDistance;
    for (const [entityId, presentation] of this.units) {
      const state = this.latest.get(entityId);
      if (!state?.alive || !state.visibleToPlayer) continue;
      camera.worldToScreen(presentation.root.getPosition(), this.screenPosition);
      if (this.screenPosition.z < 0) continue;
      const deltaX = this.screenPosition.x - screenX;
      const deltaY = this.screenPosition.y - screenY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      if (distanceSquared <= bestDistanceSquared) {
        bestDistanceSquared = distanceSquared;
        bestId = entityId;
      }
    }
    return bestId;
  }

  pickBox(camera: pc.CameraComponent, left: number, top: number, right: number, bottom: number): EntityID[] {
    const selected: EntityID[] = [];
    for (const [entityId, presentation] of this.units) {
      const state = this.latest.get(entityId);
      if (!state?.alive || state.playerId !== 0) continue;
      camera.worldToScreen(presentation.root.getPosition(), this.screenPosition);
      if (
        this.screenPosition.z >= 0
        && this.screenPosition.x >= left
        && this.screenPosition.x <= right
        && this.screenPosition.y >= top
        && this.screenPosition.y <= bottom
      ) {
        selected.push(entityId);
      }
    }
    return selected.sort((first, second) => first - second);
  }

  isControllable(entityId: EntityID): boolean {
    const entity = this.latest.get(entityId);
    return entity?.alive === true && entity.playerId === 0;
  }

  isEnemy(entityId: EntityID): boolean {
    const entity = this.latest.get(entityId);
    return entity?.alive === true && entity.visibleToPlayer && entity.playerId !== 0;
  }

  destroy(): void {
    for (const presentation of this.units.values()) this.destroyPresentation(presentation);
    this.units.clear();
    for (const projectile of this.projectiles) projectile.entity.destroy();
    this.projectiles.length = 0;
    this.wetMaterial.destroy();
    this.chilledMaterial.destroy();
    this.frozenMaterial.destroy();
    this.playerAccentMaterial.destroy();
    this.enemyAccentMaterial.destroy();
    this.healthBackMaterial.destroy();
    this.hitMaterial.destroy();
    this.deathMaterial.destroy();
    this.playerProjectileMaterial.destroy();
    this.enemyProjectileMaterial.destroy();
  }

  private createPresentation(unit: EntitySnapshot): UnitPresentation {
    const root = new pc.Entity(`Unit ${unit.id}`);
    const profile = unitVisualProfile(unit.archetype);
    const teamMaterial = unit.playerId === 0
      ? this.unitMaterials.player
      : (unit.archetype === 'RANGER' || unit.archetype === 'SIEGE_CONSTRUCT')
        ? this.unitMaterials.enemyRanged
        : this.unitMaterials.enemyMelee;
    const accentMaterial = unit.playerId === 0 ? this.playerAccentMaterial : this.enemyAccentMaterial;

    for (const [index, part] of profile.parts.entries()) {
      const child = new pc.Entity(`${unit.archetype} ${unit.id} Part ${index + 1}`);
      child.addComponent('render', {
        type: part.primitive,
        material: part.material === 'TEAM' ? teamMaterial : accentMaterial,
      });
      child.setLocalPosition(part.position[0], part.position[1], part.position[2]);
      child.setLocalScale(part.scale[0], part.scale[1], part.scale[2]);
      root.addChild(child);
    }
    this.app.root.addChild(root);

    const selection = new pc.Entity(`Selection ${unit.id}`);
    selection.addComponent('render', { type: 'cylinder', material: this.selectionMaterial });
    selection.setLocalScale(profile.selectionScale, 0.035, profile.selectionScale);
    selection.enabled = false;
    this.app.root.addChild(selection);

    const healthBack = new pc.Entity(`Health Back ${unit.id}`);
    healthBack.addComponent('render', { type: 'box', material: this.healthBackMaterial });
    this.app.root.addChild(healthBack);
    const healthBar = new pc.Entity(`Health ${unit.id}`);
    healthBar.addComponent('render', { type: 'box', material: this.healthMaterial });
    this.app.root.addChild(healthBar);

    const wetMarker = new pc.Entity(`Wet Halo ${unit.id}`);
    wetMarker.addComponent('render', { type: 'cylinder', material: this.wetMaterial });
    wetMarker.setLocalScale(profile.selectionScale * 1.1, 0.045, profile.selectionScale * 1.1);
    wetMarker.enabled = false;
    this.app.root.addChild(wetMarker);
    const wetBeacon = new pc.Entity(`Wet Beacon ${unit.id}`);
    wetBeacon.addComponent('render', { type: 'sphere', material: this.wetMaterial });
    wetBeacon.setLocalScale(0.28, 0.38, 0.28);
    wetBeacon.enabled = false;
    this.app.root.addChild(wetBeacon);

    const coldMarker = new pc.Entity(`Cold ${unit.id}`);
    coldMarker.addComponent('render', { type: 'box', material: this.chilledMaterial });
    coldMarker.setLocalScale(profile.selectionScale * 0.82, 0.075, profile.selectionScale * 0.82);
    coldMarker.enabled = false;
    this.app.root.addChild(coldMarker);

    const hitFlash = new pc.Entity(`Hit Flash ${unit.id}`);
    hitFlash.addComponent('render', { type: 'sphere', material: this.hitMaterial });
    hitFlash.setLocalScale(profile.selectionScale * 0.82, profile.height * 0.52, profile.selectionScale * 0.82);
    hitFlash.enabled = false;
    this.app.root.addChild(hitFlash);

    const deathMarker = new pc.Entity(`Death Echo ${unit.id}`);
    deathMarker.addComponent('render', { type: 'cylinder', material: this.deathMaterial });
    deathMarker.enabled = false;
    this.app.root.addChild(deathMarker);

    const presentation: UnitPresentation = {
      root,
      selection,
      healthBack,
      healthBar,
      wetMarker,
      wetBeacon,
      coldMarker,
      hitFlash,
      deathMarker,
      hitFlashUntilTick: -1,
      deathUntilTick: -1,
    };
    this.units.set(unit.id, presentation);
    return presentation;
  }

  private detectCombatFeedback(previousById: Map<EntityID, EntitySnapshot>, current: SimulationSnapshot): void {
    const currentById = snapshotMap(current);
    for (const unit of current.entities) {
      const prior = previousById.get(unit.id);
      const presentation = this.units.get(unit.id) ?? this.createPresentation(unit);
      if (!prior) continue;

      if (prior.alive && prior.currentHealth > unit.currentHealth && prior.visibleToPlayer) {
        presentation.hitFlashUntilTick = current.tick + 1;
      }
      if (prior.alive && !unit.alive && prior.visibleToPlayer) {
        presentation.deathUntilTick = current.tick + 6;
      }

      if (
        !unit.alive
        || !unit.visibleToPlayer
        || unit.attackTargetEntityId === null
        || unit.nextAttackTick <= prior.nextAttackTick
      ) continue;
      const profile = unitVisualProfile(unit.archetype);
      if (profile.projectile === 'NONE') continue;
      const target = currentById.get(unit.attackTargetEntityId);
      if (!target || (!target.visibleToPlayer && target.playerId !== 0)) continue;
      this.spawnProjectile(unit, target, profile.projectile, current.tick);
    }
  }

  private spawnProjectile(
    attacker: EntitySnapshot,
    target: EntitySnapshot,
    style: UnitProjectileStyle,
    tick: number,
  ): void {
    const entity = new pc.Entity(`${style} ${attacker.id} → ${target.id}`);
    entity.addComponent('render', {
      type: style === 'BOLT' ? 'box' : 'sphere',
      material: attacker.playerId === 0 ? this.playerProjectileMaterial : this.enemyProjectileMaterial,
    });
    if (style === 'BOLT') entity.setLocalScale(0.12, 0.12, 0.52);
    else if (style === 'SHELL') entity.setLocalScale(0.3, 0.3, 0.3);
    else entity.setLocalScale(0.24, 0.24, 0.24);

    const attackerProfile = unitVisualProfile(attacker.archetype);
    const targetProfile = unitVisualProfile(target.archetype);
    const start = new pc.Vec3(metres(attacker.x), attackerProfile.height * 0.62, metres(attacker.z));
    const end = new pc.Vec3(metres(target.x), targetProfile.height * 0.5, metres(target.z));
    entity.setPosition(start);
    const deltaX = end.x - start.x;
    const deltaZ = end.z - start.z;
    if (deltaX !== 0 || deltaZ !== 0) entity.setEulerAngles(0, Math.atan2(deltaX, deltaZ) * 180 / Math.PI, 0);
    this.app.root.addChild(entity);
    this.projectiles.push({
      entity,
      style,
      startTick: tick,
      durationTicks: style === 'SHELL' ? 3 : 2,
      start,
      end,
    });
  }

  private updateProjectiles(tick: number, alpha: number): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index]!;
      const progress = Math.max(0, Math.min(1, (tick - projectile.startTick + alpha) / projectile.durationTicks));
      if (progress >= 1) {
        projectile.entity.destroy();
        this.projectiles.splice(index, 1);
        continue;
      }
      const x = pc.math.lerp(projectile.start.x, projectile.end.x, progress);
      const z = pc.math.lerp(projectile.start.z, projectile.end.z, progress);
      let y = pc.math.lerp(projectile.start.y, projectile.end.y, progress);
      if (projectile.style === 'SHELL') y += Math.sin(progress * Math.PI) * 1.25;
      else if (projectile.style === 'ORB') y += Math.sin(progress * Math.PI) * 0.24;
      projectile.entity.setPosition(x, y, z);
    }
  }

  private destroyPresentation(presentation: UnitPresentation): void {
    presentation.root.destroy();
    presentation.selection.destroy();
    presentation.healthBack.destroy();
    presentation.healthBar.destroy();
    presentation.wetMarker.destroy();
    presentation.wetBeacon.destroy();
    presentation.coldMarker.destroy();
    presentation.hitFlash.destroy();
    presentation.deathMarker.destroy();
  }
}
