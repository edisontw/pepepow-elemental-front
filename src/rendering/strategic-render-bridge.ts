import * as pc from 'playcanvas';
import { VisualAssetLibrary, type VisualModel } from './visual-asset-library';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import { BUILDINGS } from '../simulation/m03-content';
import type { StrategicBuilding, StrategicSnapshot } from '../simulation/strategic-state';
import { buildingVisualProfile, type BuildingVisualMaterialRole } from './building-visual-profile';

interface BuildingPartPresentation {
  entity: pc.Entity;
  role: BuildingVisualMaterialRole;
}

interface BuildingPresentation {
  root: pc.Entity;
  model: VisualModel | null;
  parts: readonly BuildingPartPresentation[];
  footprint: pc.Entity;
  beacon: pc.Entity;
  rally: pc.Entity;
  healthBack: pc.Entity;
  healthBar: pc.Entity;
  defenseStem: pc.Entity;
  defenseHead: pc.Entity;
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

function constructionScale(building: StrategicBuilding, tick: number): number {
  if (building.destroyed) return 0.3;
  if (building.completed) return 1;
  const duration = BUILDINGS[building.type].buildTicks;
  if (duration <= 0) return 1;
  const startTick = building.completeTick - duration;
  const progress = Math.max(0, Math.min(1, (tick - startTick) / duration));
  return 0.18 + progress * 0.82;
}

function isResourceSite(building: StrategicBuilding): boolean {
  return building.type === 'EXTRACTOR' || building.type === 'MANA_WELL';
}

export class StrategicRenderBridge {
  private readonly entities = new Map<number, BuildingPresentation>();
  private readonly playerMaterial = createMaterial(new pc.Color(0.16, 0.58, 0.5), new pc.Color(0.01, 0.15, 0.1));
  private readonly playerAccentMaterial = createMaterial(new pc.Color(0.48, 0.96, 0.86), new pc.Color(0.04, 0.54, 0.4));
  private readonly enemyMaterial = createMaterial(new pc.Color(0.64, 0.14, 0.12), new pc.Color(0.16, 0.01, 0.01));
  private readonly enemyAccentMaterial = createMaterial(new pc.Color(1, 0.45, 0.16), new pc.Color(0.62, 0.08, 0.01));
  private readonly constructionMaterial = createMaterial(new pc.Color(0.46, 0.43, 0.3), new pc.Color(0.08, 0.07, 0.03));
  private readonly destroyedMaterial = createMaterial(new pc.Color(0.12, 0.13, 0.13), new pc.Color(0.018, 0.018, 0.018));
  private readonly workMaterial = createMaterial(new pc.Color(.94, .66, .22), new pc.Color(.25, .12, .02));
  private readonly healthBackMaterial = createMaterial(new pc.Color(0.035, 0.045, 0.045));

  constructor(private readonly app: pc.Application, private readonly visualAssets: VisualAssetLibrary) {}

  sync(snapshot: StrategicSnapshot, tick = 0): void {
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
      presentation.root.setLocalScale(1, constructionScale(building, tick), 1);
      for (const part of presentation.parts) {
        if (!part.entity.render) continue;
        part.entity.render.material = building.destroyed
          ? this.destroyedMaterial
          : building.completed
            ? this.materialFor(building.playerId, part.role)
            : this.constructionMaterial;
      }
      if (presentation.footprint.render) {
        presentation.footprint.render.material = building.destroyed
          ? this.destroyedMaterial
          : building.completed
            ? this.materialFor(building.playerId, 'ACCENT')
            : this.constructionMaterial;
      }
      if (presentation.beacon.render) {
        presentation.beacon.render.material = building.completed
          ? this.materialFor(building.playerId, 'ACCENT')
          : this.constructionMaterial;
      }
      presentation.beacon.enabled = building.type !== 'ELEMENTAL_CORE' && !building.destroyed;

      const profile = buildingVisualProfile(building.type);
      const model = presentation.model;
      if (model?.entity) {
        model.reactor?.setLocalEulerAngles(0, tick * 2.5, 0);
        model.orbit?.setLocalEulerAngles(22, -tick * 1.5, 15);
        for (const render of model.entity.findComponents('render') as pc.RenderComponent[]) {
          if (building.destroyed) for (const mesh of render.meshInstances) mesh.material = this.destroyedMaterial;
        }
      }
      const order = snapshot.productionQueue.find((entry) => entry.buildingId === building.id && entry.startTick <= tick && entry.completeTick > tick);
      const working = !building.completed || order !== undefined;
      const showHealth = !building.destroyed && (working || isResourceSite(building) || building.currentHealth < building.maxHealth);
      presentation.healthBack.enabled = showHealth;
      presentation.healthBar.enabled = showHealth;
      if (showHealth) {
        const ratio = !building.completed
          ? Math.max(0, Math.min(1, (tick - building.completeTick + BUILDINGS[building.type].buildTicks) / Math.max(1, BUILDINGS[building.type].buildTicks)))
          : order ? Math.max(0, Math.min(1, (tick - order.startTick) / Math.max(1, order.durationTicks)))
          : Math.max(0, Math.min(1, building.currentHealth / Math.max(1, building.maxHealth)));
        const width = Math.max(1.25, profile.footprint * 1.15);
        const y = profile.height + 0.72;
        presentation.healthBack.setLocalPosition(0, y, 0);
        presentation.healthBack.setLocalScale(width, 0.095, 0.13);
        presentation.healthBar.setLocalPosition(-(1 - ratio) * width * 0.5, y + 0.012, 0);
        presentation.healthBar.setLocalScale(width * ratio, 0.062, 0.09);
        if (presentation.healthBar.render) {
          presentation.healthBar.render.material = working ? this.workMaterial : this.materialFor(building.playerId, 'ACCENT');
        }
      }

      const fortified = isResourceSite(building)
        && building.completed
        && !building.destroyed
        && building.resourceDefenseLevel > 0;
      presentation.defenseStem.enabled = fortified;
      presentation.defenseHead.enabled = fortified;
      if (fortified) {
        presentation.defenseStem.setLocalPosition(0, profile.height + 0.38, 0);
        presentation.defenseHead.setLocalPosition(0, profile.height + 0.82, 0);
        if (presentation.defenseStem.render) presentation.defenseStem.render.material = this.materialFor(building.playerId, 'BASE');
        if (presentation.defenseHead.render) presentation.defenseHead.render.material = this.materialFor(building.playerId, 'ACCENT');
      }

      const showRally = building.playerId === 0
        && building.completed
        && !building.destroyed
        && building.rallyPointX !== null
        && building.rallyPointZ !== null;
      presentation.rally.enabled = showRally;
      if (showRally && building.rallyPointX !== null && building.rallyPointZ !== null) {
        presentation.rally.setLocalPosition(
          (building.rallyPointX - building.x) / WORLD_UNITS_PER_METER,
          0.055,
          (building.rallyPointZ - building.z) / WORLD_UNITS_PER_METER,
        );
      }
    }
    for (const [buildingId, presentation] of [...this.entities]) {
      if (active.has(buildingId)) continue;
      this.visualAssets.release(presentation.model);
      presentation.root.destroy();
      this.entities.delete(buildingId);
    }
  }

  destroy(): void {
    for (const presentation of this.entities.values()) { this.visualAssets.release(presentation.model); presentation.root.destroy(); }
    this.workMaterial.destroy();
    this.entities.clear();
    this.playerMaterial.destroy();
    this.playerAccentMaterial.destroy();
    this.enemyMaterial.destroy();
    this.enemyAccentMaterial.destroy();
    this.constructionMaterial.destroy();
    this.destroyedMaterial.destroy();
    this.healthBackMaterial.destroy();
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

    const footprint = new pc.Entity(`${building.type} ${building.id} Footprint`);
    footprint.addComponent('render', {
      type: 'cylinder',
      material: building.completed ? this.materialFor(building.playerId, 'ACCENT') : this.constructionMaterial,
    });
    footprint.setLocalPosition(0, 0.035, 0);
    footprint.setLocalScale(profile.footprint * 1.18, 0.035, profile.footprint * 1.18);
    root.addChild(footprint);

    const beacon = new pc.Entity(`${building.type} ${building.id} Beacon`);
    beacon.addComponent('render', {
      type: 'sphere',
      material: building.completed ? this.materialFor(building.playerId, 'ACCENT') : this.constructionMaterial,
    });
    beacon.setLocalPosition(0, profile.height + 0.42, 0);
    beacon.setLocalScale(0.24, 0.24, 0.24);
    beacon.enabled = building.type !== 'ELEMENTAL_CORE';
    root.addChild(beacon);

    const rally = new pc.Entity(`${building.type} ${building.id} Rally Point`);
    rally.addComponent('render', {
      type: 'cylinder',
      material: this.materialFor(building.playerId, 'ACCENT'),
    });
    rally.setLocalScale(0.72, 0.035, 0.72);
    rally.enabled = false;
    root.addChild(rally);

    const healthBack = new pc.Entity(`${building.type} ${building.id} Health Back`);
    healthBack.addComponent('render', { type: 'box', material: this.healthBackMaterial });
    healthBack.enabled = false;
    root.addChild(healthBack);

    const healthBar = new pc.Entity(`${building.type} ${building.id} Health`);
    healthBar.addComponent('render', { type: 'box', material: this.materialFor(building.playerId, 'ACCENT') });
    healthBar.enabled = false;
    root.addChild(healthBar);

    const defenseStem = new pc.Entity(`${building.type} ${building.id} Guard Tower Stem`);
    defenseStem.addComponent('render', { type: 'cylinder', material: this.materialFor(building.playerId, 'BASE') });
    defenseStem.setLocalScale(0.16, 0.55, 0.16);
    defenseStem.enabled = false;
    root.addChild(defenseStem);

    const defenseHead = new pc.Entity(`${building.type} ${building.id} Guard Tower Head`);
    defenseHead.addComponent('render', { type: 'box', material: this.materialFor(building.playerId, 'ACCENT') });
    defenseHead.setLocalScale(0.62, 0.18, 0.2);
    defenseHead.enabled = false;
    root.addChild(defenseHead);

    this.app.root.addChild(root);
    const model = building.type === 'ELEMENTAL_CORE'
      ? this.visualAssets.attach(root, parts.map((part) => part.entity), 'building.elemental-core.debug', building.playerId) : null;
    return { root, model, parts, footprint, beacon, rally, healthBack, healthBar, defenseStem, defenseHead };
  }

  private materialFor(playerId: number, role: BuildingVisualMaterialRole): pc.Material {
    if (playerId === 0) return role === 'ACCENT' ? this.playerAccentMaterial : this.playerMaterial;
    return role === 'ACCENT' ? this.enemyAccentMaterial : this.enemyMaterial;
  }
}
