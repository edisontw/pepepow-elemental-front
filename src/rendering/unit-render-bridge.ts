import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { EntityID } from '../simulation/components';
import type { EntitySnapshot, SimulationSnapshot } from '../simulation/simulation';

interface UnitPresentation {
  body: pc.Entity;
  selection: pc.Entity;
  healthBar: pc.Entity;
  wetMarker: pc.Entity;
  coldMarker: pc.Entity;
}

function snapshotMap(snapshot: SimulationSnapshot): Map<EntityID, EntitySnapshot> {
  return new Map(snapshot.entities.map((entity) => [entity.id, entity]));
}

export class UnitRenderBridge {
  private readonly units = new Map<EntityID, UnitPresentation>();
  private latest = new Map<EntityID, EntitySnapshot>();
  private readonly screenPosition = new pc.Vec3();
  private readonly wetMaterial = new pc.StandardMaterial();
  private readonly chilledMaterial = new pc.StandardMaterial();
  private readonly frozenMaterial = new pc.StandardMaterial();

  constructor(
    app: pc.Application,
    initialSnapshot: SimulationSnapshot,
    unitMaterials: { player: pc.Material; enemyMelee: pc.Material; enemyRanged: pc.Material },
    selectionMaterial: pc.Material,
    healthMaterial: pc.Material,
  ) {
    this.wetMaterial.diffuse = new pc.Color(0.08, 0.78, 1);
    this.wetMaterial.emissive = new pc.Color(0.02, 0.25, 0.4);
    this.wetMaterial.update();
    this.chilledMaterial.diffuse = new pc.Color(0.42, 0.78, 1);
    this.chilledMaterial.emissive = new pc.Color(0.04, 0.18, 0.32);
    this.chilledMaterial.update();
    this.frozenMaterial.diffuse = new pc.Color(0.72, 0.94, 1);
    this.frozenMaterial.emissive = new pc.Color(0.14, 0.42, 0.55);
    this.frozenMaterial.update();
    for (const unit of initialSnapshot.entities) {
      const body = new pc.Entity(`Unit ${unit.id}`);
      const material = unit.playerId === 0
        ? unitMaterials.player
        : unit.archetype === 'RANGER' ? unitMaterials.enemyRanged : unitMaterials.enemyMelee;
      const bodyType = unit.archetype === 'VANGUARD' ? 'capsule' : unit.archetype === 'ELEMENTALIST' ? 'cylinder' : 'box';
      body.addComponent('render', { type: bodyType, material });
      const bodyScale = unit.archetype === 'GOLEM' ? 1.25 : unit.archetype === 'ELEMENTALIST' ? 0.68 : unit.archetype === 'RANGER' ? 0.9 : 0.72;
      body.setLocalScale(bodyScale, unit.archetype === 'GOLEM' ? 1.55 : 1.15, bodyScale);
      app.root.addChild(body);

      const selection = new pc.Entity(`Selection ${unit.id}`);
      selection.addComponent('render', { type: 'cylinder', material: selectionMaterial });
      selection.setLocalScale(1.2, 0.035, 1.2);
      selection.enabled = false;
      app.root.addChild(selection);
      const healthBar = new pc.Entity(`Health ${unit.id}`);
      healthBar.addComponent('render', { type: 'box', material: healthMaterial });
      app.root.addChild(healthBar);
      const wetMarker = new pc.Entity(`Wet ${unit.id}`);
      wetMarker.addComponent('render', { type: 'cylinder', material: this.wetMaterial });
      wetMarker.setLocalScale(0.92, 0.025, 0.92);
      wetMarker.enabled = false;
      app.root.addChild(wetMarker);
      const coldMarker = new pc.Entity(`Cold ${unit.id}`);
      coldMarker.addComponent('render', { type: 'box', material: this.chilledMaterial });
      coldMarker.setLocalScale(0.82, 0.08, 0.82);
      coldMarker.enabled = false;
      app.root.addChild(coldMarker);
      this.units.set(unit.id, { body, selection, healthBar, wetMarker, coldMarker });
    }
    this.sync(initialSnapshot, initialSnapshot, 1);
  }

  sync(previous: SimulationSnapshot, current: SimulationSnapshot, alpha: number): void {
    this.latest = snapshotMap(current);
    const previousById = snapshotMap(previous);
    for (const unit of current.entities) {
      const presentation = this.units.get(unit.id);
      if (!presentation) continue;
      const presented = unit.alive && unit.visibleToPlayer;
      presentation.body.enabled = presented;
      presentation.selection.enabled = presented && presentation.selection.enabled;
      presentation.healthBar.enabled = presented;
      presentation.wetMarker.enabled = presented && unit.wet;
      presentation.coldMarker.enabled = presented && (unit.chilledTicks > 0 || unit.frozenTicks > 0);
      if (presentation.coldMarker.render) {
        presentation.coldMarker.render.material = unit.frozenTicks > 0 ? this.frozenMaterial : this.chilledMaterial;
      }
      if (!presented) continue;
      const prior = previousById.get(unit.id) ?? unit;
      const x = pc.math.lerp(prior.x, unit.x, alpha) / WORLD_UNITS_PER_METER;
      const z = pc.math.lerp(prior.z, unit.z, alpha) / WORLD_UNITS_PER_METER;
      presentation.body.setPosition(x, 0.78, z);
      presentation.selection.setPosition(x, 0.07, z);
      presentation.wetMarker.setPosition(x, 0.115, z);
      presentation.coldMarker.setPosition(x, 1.5, z);
      const healthRatio = unit.currentHealth / unit.maxHealth;
      presentation.healthBar.setPosition(x - (1 - healthRatio) * 0.55, 2.05, z);
      presentation.healthBar.setLocalScale(1.1 * healthRatio, 0.11, 0.12);
    }
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
      camera.worldToScreen(presentation.body.getPosition(), this.screenPosition);
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
      camera.worldToScreen(presentation.body.getPosition(), this.screenPosition);
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
    for (const presentation of this.units.values()) {
      presentation.body.destroy();
      presentation.selection.destroy();
      presentation.healthBar.destroy();
      presentation.wetMarker.destroy();
      presentation.coldMarker.destroy();
    }
    this.units.clear();
    this.wetMaterial.destroy();
    this.chilledMaterial.destroy();
    this.frozenMaterial.destroy();
  }
}
