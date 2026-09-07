import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { StrategicBuilding, StrategicSnapshot } from '../simulation/strategic-state';
import { buildingVisualProfile, type BuildingVisualMaterialRole } from './building-visual-profile';

interface BuildingPartPresentation {
  entity: pc.Entity;
  role: BuildingVisualMaterialRole;
}

interface BuildingPresentation {
  root: pc.Entity;
  parts: readonly BuildingPartPresentation[];
}

function createMaterial(color: pc.Color, emissive?: pc.Color): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.gloss = 0.34;
  if (emissive) {
    material.emissive = emissive;
    material.emissiveIntensity = 1.45;
  }
  material.update();
  return material;
}

export class StrategicRenderBridge {
  private readonly entities = new Map<number, BuildingPresentation>();
  private readonly playerMaterial = createMaterial(new pc.Color(0.16, 0.58, 0.5), new pc.Color(0.01, 0.15, 0.1));
  private readonly playerAccentMaterial = createMaterial(new pc.Color(0.48, 0.96, 0.86), new pc.Color(0.04, 0.54, 0.4));
  private readonly enemyMaterial = createMaterial(new pc.Color(0.64, 0.14, 0.12), new pc.Color(0.16, 0.01, 0.01));
  private readonly enemyAccentMaterial = createMaterial(new pc.Color(1, 0.45, 0.16), new pc.Color(0.62, 0.08, 0.01));
  private readonly constructionMaterial = createMaterial(new pc.Color(0.46, 0.43, 0.3), new pc.Color(0.08, 0.07, 0.03));

  constructor(private readonly app: pc.Application) {}

  sync(snapshot: StrategicSnapshot): void {
    const active = new Set<number>();
    for (const building of snapshot.buildings) {
      active.add(building.id);
      let presentation = this.entities.get(building.id);
      if (!presentation) {
        presentation = this.createBuilding(building);
        this.entities.set(building.id, presentation);
      }
      presentation.root.setPosition(
        building.x / WORLD_UNITS_PER_METER,
        0,
        building.z / WORLD_UNITS_PER_METER,
      );
      presentation.root.setLocalScale(1, building.completed ? 1 : 0.48, 1);
      for (const part of presentation.parts) {
        if (!part.entity.render) continue;
        part.entity.render.material = building.completed
          ? this.materialFor(building.playerId, part.role)
          : this.constructionMaterial;
      }
    }
    for (const [buildingId, presentation] of [...this.entities]) {
      if (active.has(buildingId)) continue;
      presentation.root.destroy();
      this.entities.delete(buildingId);
    }
  }

  destroy(): void {
    for (const presentation of this.entities.values()) presentation.root.destroy();
    this.entities.clear();
    this.playerMaterial.destroy();
    this.playerAccentMaterial.destroy();
    this.enemyMaterial.destroy();
    this.enemyAccentMaterial.destroy();
    this.constructionMaterial.destroy();
  }

  private createBuilding(building: StrategicBuilding): BuildingPresentation {
    const profile = buildingVisualProfile(building.type);
    const root = new pc.Entity(`${building.type} ${building.id}`);
    const parts: BuildingPartPresentation[] = [];
    for (const [index, part] of profile.parts.entries()) {
      const entity = new pc.Entity(`${building.type} ${building.id} Part ${index + 1}`);
      entity.addComponent('render', {
        type: part.primitive,
        material: building.completed ? this.materialFor(building.playerId, part.material) : this.constructionMaterial,
      });
      entity.setLocalPosition(part.position[0], part.position[1], part.position[2]);
      entity.setLocalScale(part.scale[0], part.scale[1], part.scale[2]);
      root.addChild(entity);
      parts.push({ entity, role: part.material });
    }
    this.app.root.addChild(root);
    return { root, parts };
  }

  private materialFor(playerId: number, role: BuildingVisualMaterialRole): pc.Material {
    if (playerId === 0) return role === 'ACCENT' ? this.playerAccentMaterial : this.playerMaterial;
    return role === 'ACCENT' ? this.enemyAccentMaterial : this.enemyMaterial;
  }
}
