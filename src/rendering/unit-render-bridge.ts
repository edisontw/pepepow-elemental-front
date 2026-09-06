import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { EntityID } from '../simulation/components';
import type { EntitySnapshot, SimulationSnapshot } from '../simulation/simulation';

interface UnitPresentation {
  body: pc.Entity;
  selection: pc.Entity;
}

function snapshotMap(snapshot: SimulationSnapshot): Map<EntityID, EntitySnapshot> {
  return new Map(snapshot.entities.map((entity) => [entity.id, entity]));
}

export class UnitRenderBridge {
  private readonly units = new Map<EntityID, UnitPresentation>();
  private readonly screenPosition = new pc.Vec3();

  constructor(
    app: pc.Application,
    initialSnapshot: SimulationSnapshot,
    unitMaterial: pc.Material,
    selectionMaterial: pc.Material,
  ) {
    for (const unit of initialSnapshot.entities) {
      const body = new pc.Entity(`Unit ${unit.id}`);
      body.addComponent('render', { type: 'capsule', material: unitMaterial });
      body.setLocalScale(0.72, 1.15, 0.72);
      app.root.addChild(body);

      const selection = new pc.Entity(`Selection ${unit.id}`);
      selection.addComponent('render', { type: 'cylinder', material: selectionMaterial });
      selection.setLocalScale(1.2, 0.035, 1.2);
      selection.enabled = false;
      app.root.addChild(selection);
      this.units.set(unit.id, { body, selection });
    }
    this.sync(initialSnapshot, initialSnapshot, 1);
  }

  sync(previous: SimulationSnapshot, current: SimulationSnapshot, alpha: number): void {
    const previousById = snapshotMap(previous);
    for (const unit of current.entities) {
      const presentation = this.units.get(unit.id);
      if (!presentation) continue;
      const prior = previousById.get(unit.id) ?? unit;
      const x = pc.math.lerp(prior.x, unit.x, alpha) / WORLD_UNITS_PER_METER;
      const z = pc.math.lerp(prior.z, unit.z, alpha) / WORLD_UNITS_PER_METER;
      presentation.body.setPosition(x, 0.78, z);
      presentation.selection.setPosition(x, 0.07, z);
    }
  }

  setSelected(entityIds: ReadonlySet<EntityID>): void {
    for (const [entityId, presentation] of this.units) {
      presentation.selection.enabled = entityIds.has(entityId);
    }
  }

  pickSingle(camera: pc.CameraComponent, screenX: number, screenY: number, maxDistance = 24): EntityID | null {
    let bestId: EntityID | null = null;
    let bestDistanceSquared = maxDistance * maxDistance;
    for (const [entityId, presentation] of this.units) {
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

  destroy(): void {
    for (const presentation of this.units.values()) {
      presentation.body.destroy();
      presentation.selection.destroy();
    }
    this.units.clear();
  }
}
