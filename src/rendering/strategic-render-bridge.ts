import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { StrategicBuilding, StrategicSnapshot } from '../simulation/strategic-state';

function createMaterial(color: pc.Color, emissive?: pc.Color): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.gloss = 0.28;
  if (emissive) {
    material.emissive = emissive;
    material.emissiveIntensity = 1.15;
  }
  material.update();
  return material;
}

export class StrategicRenderBridge {
  private readonly entities = new Map<number, pc.Entity>();
  private readonly playerMaterial = createMaterial(new pc.Color(0.2, 0.7, 0.58), new pc.Color(0.02, 0.2, 0.13));
  private readonly enemyMaterial = createMaterial(new pc.Color(0.72, 0.18, 0.14), new pc.Color(0.2, 0.02, 0.01));
  private readonly constructionMaterial = createMaterial(new pc.Color(0.52, 0.48, 0.3));

  constructor(private readonly app: pc.Application) {}

  sync(snapshot: StrategicSnapshot): void {
    const active = new Set<number>();
    for (const building of snapshot.buildings) {
      active.add(building.id);
      let entity = this.entities.get(building.id);
      if (!entity) {
        entity = this.createBuilding(building);
        this.entities.set(building.id, entity);
      }
      entity.setPosition(
        building.x / WORLD_UNITS_PER_METER,
        this.heightFor(building) / 2,
        building.z / WORLD_UNITS_PER_METER,
      );
      entity.setLocalScale(this.scaleFor(building));
      if (entity.render) {
        entity.render.material = building.completed
          ? (building.playerId === 0 ? this.playerMaterial : this.enemyMaterial)
          : this.constructionMaterial;
      }
    }
    for (const [buildingId, entity] of [...this.entities]) {
      if (active.has(buildingId)) continue;
      entity.destroy();
      this.entities.delete(buildingId);
    }
  }

  destroy(): void {
    for (const entity of this.entities.values()) entity.destroy();
    this.entities.clear();
    this.playerMaterial.destroy();
    this.enemyMaterial.destroy();
    this.constructionMaterial.destroy();
  }

  private createBuilding(building: StrategicBuilding): pc.Entity {
    const entity = new pc.Entity(`${building.type} ${building.id}`);
    const type = building.type === 'ELEMENTAL_CORE' || building.type === 'OUTPOST' ? 'cylinder' : 'box';
    entity.addComponent('render', {
      type,
      material: building.completed
        ? (building.playerId === 0 ? this.playerMaterial : this.enemyMaterial)
        : this.constructionMaterial,
    });
    this.app.root.addChild(entity);
    return entity;
  }

  private heightFor(building: StrategicBuilding): number {
    if (!building.completed) return 0.5;
    if (building.type === 'ELEMENTAL_CORE') return 3.4;
    if (building.type === 'OUTPOST') return 2.2;
    if (building.type === 'EXTRACTOR') return 1.2;
    return 1.8;
  }

  private scaleFor(building: StrategicBuilding): pc.Vec3 {
    const height = this.heightFor(building);
    if (building.type === 'ELEMENTAL_CORE') return new pc.Vec3(3.4, height, 3.4);
    if (building.type === 'OUTPOST') return new pc.Vec3(2.2, height, 2.2);
    if (building.type === 'EXTRACTOR') return new pc.Vec3(1.5, height, 1.5);
    return new pc.Vec3(2.4, height, 2.4);
  }
}
