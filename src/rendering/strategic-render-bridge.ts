import * as pc from 'playcanvas';
import { VisualAssetLibrary, type VisualModel } from './visual-asset-library';
import { BuildingImpostorLibrary, type BuildingImpostorHandle } from './building-impostor-library';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { NavigationGrid } from '../simulation/navigation';
import type { VisibilityState } from '../simulation/visibility-state';
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
  impostor: BuildingImpostorHandle | null;
  modelId: string;
  parts: readonly BuildingPartPresentation[];
  footprint: pc.Entity;
  beacon: pc.Entity;
  rally: pc.Entity;
  healthBack: pc.Entity;
  healthBar: pc.Entity;
  defenseStem: pc.Entity;
  defenseHead: pc.Entity;
  constructionFrame: pc.Entity;
  constructionLift: pc.Entity;
  constructionSpark: pc.Entity;
  productionRig: pc.Entity;
  productionRotor: pc.Entity;
  productionCore: pc.Entity;
  productionPulse: pc.Entity;
  wasCompleted: boolean;
  completedAtTick: number;
  activeProductionOrderId: number | null;
  productionCompletedAtTick: number;
  wasDestroyed: boolean;
  destroyedAtTick: number;
  collapsePitch: number;
  collapseRoll: number;
}

function createMaterial(color: pc.Color, emissive?: pc.Color, opacity = 1): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.gloss = 0.34;
  material.opacity = opacity;
  if (emissive) {
    material.emissive = emissive;
    material.emissiveIntensity = 1.45;
  }
  if (opacity < 1) {
    material.blendType = pc.BLEND_ADDITIVEALPHA;
    material.depthWrite = false;
    material.cull = pc.CULLFACE_NONE;
  }
  material.update();
  return material;
}

function constructionProgress(building: StrategicBuilding, tick: number): number {
  if (building.destroyed) return 0;
  if (building.completed) return 1;
  const duration = BUILDINGS[building.type].buildTicks;
  if (duration <= 0) return 1;
  const startTick = building.completeTick - duration;
  return Math.max(0, Math.min(1, (tick - startTick) / duration));
}

function constructionScale(building: StrategicBuilding, tick: number): number {
  if (building.destroyed) return 0.3;
  return 0.18 + constructionProgress(building, tick) * 0.82;
}

function isResourceSite(building: StrategicBuilding): boolean {
  return building.type === 'EXTRACTOR' || building.type === 'MANA_WELL';
}

export class StrategicRenderBridge {
  private readonly entities = new Map<number, BuildingPresentation>();
  private readonly networkEntities: pc.Entity[] = [];
  private readonly buildingImpostors: BuildingImpostorLibrary;
  private networkKey = '';
  private readonly playerMaterial = createMaterial(new pc.Color(0.16, 0.58, 0.5), new pc.Color(0.01, 0.15, 0.1));
  private readonly playerAccentMaterial = createMaterial(new pc.Color(0.48, 0.96, 0.86), new pc.Color(0.04, 0.54, 0.4));
  private readonly enemyMaterial = createMaterial(new pc.Color(0.64, 0.14, 0.12), new pc.Color(0.16, 0.01, 0.01));
  private readonly enemyAccentMaterial = createMaterial(new pc.Color(1, 0.45, 0.16), new pc.Color(0.62, 0.08, 0.01));
  private readonly constructionMaterial = createMaterial(new pc.Color(0.46, 0.43, 0.3), new pc.Color(0.08, 0.07, 0.03));
  private readonly destroyedMaterial = createMaterial(new pc.Color(0.12, 0.13, 0.13), new pc.Color(0.018, 0.018, 0.018));
  private readonly workMaterial = createMaterial(new pc.Color(.94, .66, .22), new pc.Color(.25, .12, .02));
  private readonly workGlowMaterial = createMaterial(
    new pc.Color(.98, .76, .30),
    new pc.Color(.72, .32, .035),
    .56,
  );
  private readonly networkMaterial = createMaterial(new pc.Color(0.18, 0.78, 0.7), new pc.Color(0.04, 0.42, 0.32));
  private readonly healthBackMaterial = createMaterial(new pc.Color(0.035, 0.045, 0.045));

  constructor(private readonly app: pc.Application, private readonly visualAssets: VisualAssetLibrary) {
    this.buildingImpostors = new BuildingImpostorLibrary(app);
  }

  sync(snapshot: StrategicSnapshot, tick = 0, visibility?: VisibilityState, navigation?: NavigationGrid): void {
    const active = new Set<number>();
    for (const building of snapshot.buildings) {
      active.add(building.id);
      let presentation = this.entities.get(building.id);
      if (!presentation) {
        presentation = this.createBuilding(building);
        this.entities.set(building.id, presentation);
      }

      if (building.completed && !presentation.wasCompleted) presentation.completedAtTick = tick;
      presentation.wasCompleted = building.completed;
      if (building.destroyed && !presentation.wasDestroyed) presentation.destroyedAtTick = tick;
      presentation.wasDestroyed = building.destroyed;

      const worldX = building.x / WORLD_UNITS_PER_METER;
      const worldZ = building.z / WORLD_UNITS_PER_METER;
      if (building.destroyed) {
        const elapsed = presentation.destroyedAtTick < 0 ? 99 : Math.max(0, tick - presentation.destroyedAtTick);
        const collapse = Math.max(0, Math.min(1, elapsed / 6));
        const eased = 1 - (1 - collapse) * (1 - collapse);
        const settle = Math.sin(collapse * Math.PI) * 0.035;
        presentation.root.setPosition(worldX, -eased * 0.12, worldZ);
        presentation.root.setLocalScale(1 + settle, 1 - eased * 0.62, 1 + settle);
        presentation.root.setEulerAngles(
          presentation.collapsePitch * eased,
          0,
          presentation.collapseRoll * eased,
        );
      } else {
        presentation.root.setPosition(worldX, 0, worldZ);
        presentation.root.setLocalScale(1, constructionScale(building, tick), 1);
        presentation.root.setEulerAngles(0, 0, 0);
      }

      presentation.root.enabled = building.playerId === 0
        || visibility === undefined
        || navigation === undefined
        || visibility.isWorldVisible(0, building.x, building.z, navigation);
      for (const part of presentation.parts) {
        if (!part.entity.render) continue;
        part.entity.render.material = building.destroyed
          ? this.destroyedMaterial
          : building.completed
            ? this.materialFor(building.playerId, part.role)
            : this.constructionMaterial;
      }
      presentation.footprint.enabled = !building.destroyed;
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
      presentation.beacon.enabled = building.type !== 'ELEMENTAL_CORE'
        && !building.destroyed
        && presentation.impostor?.entity == null;

      const profile = buildingVisualProfile(building.type);
      const buildProgress = constructionProgress(building, tick);
      const constructing = !building.completed && !building.destroyed;
      const constructionCompletionAge = presentation.completedAtTick < 0
        ? 99
        : Math.max(0, tick - presentation.completedAtTick);
      presentation.constructionFrame.enabled = constructing;
      presentation.constructionSpark.enabled = constructing;
      presentation.constructionLift.enabled = constructing || constructionCompletionAge < 4;
      if (constructing) {
        const buildHeight = Math.max(0.26, profile.height * (0.22 + buildProgress * 0.72));
        const orbit = tick * 0.38 + building.id * 1.17;
        const sparkRadius = profile.footprint * (0.30 + buildProgress * 0.10);
        presentation.constructionLift.setLocalPosition(0, buildHeight, 0);
        presentation.constructionLift.setLocalScale(
          profile.footprint * (0.62 + buildProgress * 0.18),
          0.024,
          profile.footprint * (0.62 + buildProgress * 0.18),
        );
        presentation.constructionLift.setLocalEulerAngles(0, tick * 5 + building.id * 13, 0);
        presentation.constructionSpark.setLocalPosition(
          Math.cos(orbit) * sparkRadius,
          buildHeight + 0.12 + Math.sin(tick * 0.8) * 0.045,
          Math.sin(orbit) * sparkRadius,
        );
        const sparkScale = 0.09 + Math.abs(Math.sin(tick * 0.9 + building.id)) * 0.07;
        presentation.constructionSpark.setLocalScale(sparkScale, sparkScale, sparkScale);
      } else if (constructionCompletionAge < 4) {
        const completionProgress = Math.max(0, Math.min(1, constructionCompletionAge / 4));
        const pulseScale = profile.footprint * (0.78 + completionProgress * 0.72);
        presentation.constructionLift.setLocalPosition(0, 0.11, 0);
        presentation.constructionLift.setLocalScale(pulseScale, 0.022, pulseScale);
        presentation.constructionLift.setLocalEulerAngles(0, tick * 8, 0);
      }

      const modelIds: Readonly<Record<string, string>> = {
        ELEMENTAL_CORE: 'building.elemental-core.debug',
        BARRACKS: 'building.barracks',
        ARCANE_TOWER: 'building.arcane-tower',
        WORKSHOP: 'building.workshop',
        OUTPOST: 'building.outpost',
        EXTRACTOR: 'building.extractor',
        MANA_WELL: 'building.mana-well',
      };
      const modelId = modelIds[building.type] ?? '';
      const useImpostor = building.playerId === 0 && building.completed && !building.destroyed;
      const presentationModelId = modelId ? `${modelId}:${useImpostor ? 'webp' : 'glb'}` : '';
      if (modelId && presentation.modelId !== presentationModelId) {
        this.visualAssets.release(presentation.model);
        this.buildingImpostors.release(presentation.impostor);
        presentation.model = null;
        presentation.impostor = null;
        for (const part of presentation.parts) part.entity.enabled = true;

        if (useImpostor) {
          const expectedModelId = presentationModelId;
          presentation.impostor = this.buildingImpostors.attach(
            presentation.root,
            presentation.parts.map((part) => part.entity),
            modelId,
            () => {
              if (presentation!.modelId !== expectedModelId) return;
              presentation!.model = this.visualAssets.attach(
                presentation!.root,
                presentation!.parts.map((part) => part.entity),
                modelId,
                building.playerId,
              );
            },
          );
        } else {
          presentation.model = this.visualAssets.attach(
            presentation.root,
            presentation.parts.map((part) => part.entity),
            modelId,
            building.playerId,
          );
        }
        presentation.modelId = presentationModelId;
      }

      const order = snapshot.productionQueue.find(
        (entry) => entry.buildingId === building.id && entry.startTick <= tick && entry.completeTick > tick,
      );
      if (order) presentation.activeProductionOrderId = order.id;
      else if (presentation.activeProductionOrderId !== null) {
        presentation.productionCompletedAtTick = tick;
        presentation.activeProductionOrderId = null;
      }
      const productionCompletionAge = presentation.productionCompletedAtTick < 0
        ? 99
        : Math.max(0, tick - presentation.productionCompletedAtTick);
      const producing = building.completed && !building.destroyed && order !== undefined;
      const productionRelease = !building.destroyed && productionCompletionAge < 3;
      presentation.productionRig.enabled = producing || productionRelease;
      if (producing && order) {
        const progress = Math.max(0, Math.min(1, (tick - order.startTick) / Math.max(1, order.durationTicks)));
        const heavyOrder = order.unitType === 'GOLEM' || order.unitType === 'SIEGE_CONSTRUCT';
        const arcaneOrder = order.unitType === 'ELEMENTALIST';
        const rigHeight = profile.height * (heavyOrder ? 0.68 : 0.74);
        const phase = tick * (arcaneOrder ? 0.58 : 0.42) + building.id * 0.73;
        const pulse = 0.5 + 0.5 * Math.sin(phase * 2.1);
        presentation.productionRig.setLocalPosition(0, rigHeight, 0);
        presentation.productionRotor.setLocalEulerAngles(
          arcaneOrder ? 24 : 0,
          tick * (heavyOrder ? 10 : arcaneOrder ? 24 : 17),
          arcaneOrder ? 18 : 0,
        );
        const rotorScale = (heavyOrder ? 0.92 : 0.72) + pulse * 0.10;
        presentation.productionRotor.setLocalScale(rotorScale, rotorScale, rotorScale);
        const coreScale = (heavyOrder ? 0.18 : 0.14) + pulse * (heavyOrder ? 0.09 : 0.07);
        presentation.productionCore.setLocalScale(coreScale, coreScale, coreScale);
        presentation.productionCore.setLocalPosition(0, 0.08 + Math.sin(phase) * 0.04, 0);
        const ringScale = profile.footprint * (0.30 + progress * 0.18 + pulse * 0.04);
        presentation.productionPulse.setLocalPosition(0, -rigHeight + 0.10, 0);
        presentation.productionPulse.setLocalScale(ringScale, 0.025, ringScale);
        presentation.productionPulse.setLocalEulerAngles(0, tick * 6, 0);
      } else if (productionRelease) {
        const release = Math.max(0, Math.min(1, productionCompletionAge / 3));
        presentation.productionRig.setLocalPosition(0, profile.height * 0.72, 0);
        presentation.productionRotor.setLocalEulerAngles(18 * (1 - release), tick * 28, 12 * (1 - release));
        presentation.productionRotor.setLocalScale(0.78 + release * 0.24, 0.78 + release * 0.24, 0.78 + release * 0.24);
        const coreScale = 0.30 * (1 - release) + 0.05;
        presentation.productionCore.setLocalScale(coreScale, coreScale, coreScale);
        presentation.productionCore.setLocalPosition(0, 0.12 + release * 0.24, 0);
        const ringScale = profile.footprint * (0.46 + release * 0.42);
        presentation.productionPulse.setLocalPosition(0, -profile.height * 0.72 + 0.10, 0);
        presentation.productionPulse.setLocalScale(ringScale, 0.02, ringScale);
      }

      const model = presentation.model;
      if (model?.entity) {
        if (!building.destroyed) {
          const workMultiplier = producing ? 2.1 : constructing ? 1.45 : 1;
          model.reactor?.setLocalEulerAngles(0, tick * 2.5 * workMultiplier, 0);
          model.orbit?.setLocalEulerAngles(22, -tick * 1.5 * workMultiplier, 15);
        }
        for (const render of model.entity.findComponents('render') as pc.RenderComponent[]) {
          if (building.destroyed) for (const mesh of render.meshInstances) mesh.material = this.destroyedMaterial;
        }
      }

      const working = !building.completed || order !== undefined;
      const showHealth = !building.destroyed && (working || isResourceSite(building) || building.currentHealth < building.maxHealth);
      presentation.healthBack.enabled = showHealth;
      presentation.healthBar.enabled = showHealth;
      if (showHealth) {
        const ratio = !building.completed
          ? buildProgress
          : order ? Math.max(0, Math.min(1, (tick - order.startTick) / Math.max(1, order.durationTicks)))
          : Math.max(0, Math.min(1, building.currentHealth / Math.max(1, building.maxHealth)));
        const width = Math.max(1.25, profile.footprint * 1.15);
        const y = profile.height + 0.72;
        presentation.healthBack.setLocalPosition(0, y, 0);
        presentation.healthBack.setLocalScale(width, 0.095, 0.13);
        presentation.healthBar.setLocalPosition(-(1 - ratio) * width * 0.5, y + 0.04, 0);
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
      this.buildingImpostors.release(presentation.impostor);
      presentation.root.destroy();
      this.entities.delete(buildingId);
    }
    this.syncNetwork(snapshot);
  }

  destroy(): void {
    for (const entity of this.networkEntities) entity.destroy();
    this.networkEntities.length = 0;
    for (const presentation of this.entities.values()) {
      this.visualAssets.release(presentation.model);
      this.buildingImpostors.release(presentation.impostor);
      presentation.root.destroy();
    }
    this.buildingImpostors.destroy();
    this.workMaterial.destroy();
    this.workGlowMaterial.destroy();
    this.networkMaterial.destroy();
    this.entities.clear();
    this.playerMaterial.destroy();
    this.playerAccentMaterial.destroy();
    this.enemyMaterial.destroy();
    this.enemyAccentMaterial.destroy();
    this.constructionMaterial.destroy();
    this.destroyedMaterial.destroy();
    this.healthBackMaterial.destroy();
  }

  private syncNetwork(snapshot: StrategicSnapshot): void {
    const anchors = snapshot.buildings
      .filter((building) => building.playerId === 0 && building.completed && !building.destroyed)
      .filter((building) => ['ELEMENTAL_CORE', 'OUTPOST', 'ARCANE_TOWER', 'MANA_WELL'].includes(building.type))
      .sort((a, b) => a.id - b.id);
    const key = anchors.map((building) => `${building.id}:${building.x}:${building.z}`).join('|');
    if (key === this.networkKey) return;
    this.networkKey = key;
    for (const entity of this.networkEntities) entity.destroy();
    this.networkEntities.length = 0;
    if (anchors.length < 2) return;

    const connected = [anchors[0]!];
    const remaining = anchors.slice(1);
    while (remaining.length > 0) {
      let bestIndex = 0;
      let bestParent = connected[0]!;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index]!;
        for (const parent of connected) {
          const dx = candidate.x - parent.x;
          const dz = candidate.z - parent.z;
          const distance = dx * dx + dz * dz;
          if (distance < bestDistance || (distance === bestDistance && candidate.id < remaining[bestIndex]!.id)) {
            bestIndex = index;
            bestParent = parent;
            bestDistance = distance;
          }
        }
      }
      const child = remaining.splice(bestIndex, 1)[0]!;
      connected.push(child);
      this.addNetworkLink(bestParent, child);
    }
  }

  private addNetworkLink(from: StrategicBuilding, to: StrategicBuilding): void {
    const fromX = from.x / WORLD_UNITS_PER_METER;
    const fromZ = from.z / WORLD_UNITS_PER_METER;
    const toX = to.x / WORLD_UNITS_PER_METER;
    const toZ = to.z / WORLD_UNITS_PER_METER;
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.1) return;
    const link = new pc.Entity(`Strategic Relay ${from.id}-${to.id}`);
    link.addComponent('render', { type: 'box', material: this.networkMaterial });
    link.setPosition((fromX + toX) * 0.5, 0.14, (fromZ + toZ) * 0.5);
    link.setLocalScale(0.075, 0.045, distance);
    link.setEulerAngles(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
    this.app.root.addChild(link);
    this.networkEntities.push(link);
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

    const constructionFrame = new pc.Entity(`${building.type} ${building.id} Construction Frame`);
    const half = profile.footprint * 0.46;
    const frameHeight = Math.max(0.65, profile.height * 0.82);
    const scaffoldPosts: readonly (readonly [number, number])[] = [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ];
    for (const [index, position] of scaffoldPosts.entries()) {
      const [x, z] = position;
      const post = new pc.Entity(`${building.type} ${building.id} Scaffold Post ${index + 1}`);
      post.addComponent('render', { type: 'box', material: this.constructionMaterial, castShadows: false });
      post.setLocalPosition(x, frameHeight * 0.5, z);
      post.setLocalScale(0.055, frameHeight, 0.055);
      constructionFrame.addChild(post);
    }
    const scaffoldBeams: readonly (readonly [number, number, number, number])[] = [
      [0, -half, profile.footprint * 0.92, 0.055],
      [0, half, profile.footprint * 0.92, 0.055],
      [-half, 0, 0.055, profile.footprint * 0.92],
      [half, 0, 0.055, profile.footprint * 0.92],
    ];
    for (const [index, beamSpec] of scaffoldBeams.entries()) {
      const [x, z, sx, sz] = beamSpec;
      const beam = new pc.Entity(`${building.type} ${building.id} Scaffold Beam ${index + 1}`);
      beam.addComponent('render', { type: 'box', material: this.workMaterial, castShadows: false });
      beam.setLocalPosition(x, frameHeight * 0.82, z);
      beam.setLocalScale(sx, 0.045, sz);
      constructionFrame.addChild(beam);
    }
    constructionFrame.enabled = !building.completed && !building.destroyed;
    root.addChild(constructionFrame);

    const constructionLift = new pc.Entity(`${building.type} ${building.id} Construction Lift`);
    constructionLift.addComponent('render', { type: 'cylinder', material: this.workGlowMaterial, castShadows: false });
    constructionLift.enabled = !building.completed && !building.destroyed;
    root.addChild(constructionLift);

    const constructionSpark = new pc.Entity(`${building.type} ${building.id} Construction Spark`);
    constructionSpark.addComponent('render', { type: 'sphere', material: this.workMaterial, castShadows: false });
    constructionSpark.enabled = !building.completed && !building.destroyed;
    root.addChild(constructionSpark);

    const productionRig = new pc.Entity(`${building.type} ${building.id} Production Rig`);
    const productionRotor = new pc.Entity(`${building.type} ${building.id} Production Rotor`);
    const rotorA = new pc.Entity(`${building.type} ${building.id} Production Arm A`);
    rotorA.addComponent('render', { type: 'box', material: this.workMaterial, castShadows: false });
    rotorA.setLocalScale(profile.footprint * 0.42, 0.035, 0.055);
    productionRotor.addChild(rotorA);
    const rotorB = new pc.Entity(`${building.type} ${building.id} Production Arm B`);
    rotorB.addComponent('render', { type: 'box', material: this.workMaterial, castShadows: false });
    rotorB.setLocalScale(0.055, 0.035, profile.footprint * 0.42);
    productionRotor.addChild(rotorB);
    productionRig.addChild(productionRotor);

    const productionCore = new pc.Entity(`${building.type} ${building.id} Production Core`);
    productionCore.addComponent('render', { type: 'sphere', material: this.workGlowMaterial, castShadows: false });
    productionRig.addChild(productionCore);

    const productionPulse = new pc.Entity(`${building.type} ${building.id} Production Pulse`);
    productionPulse.addComponent('render', { type: 'cylinder', material: this.workGlowMaterial, castShadows: false });
    productionRig.addChild(productionPulse);
    productionRig.enabled = false;
    root.addChild(productionRig);

    const collapseAngle = building.id * 2.399963229728653;
    this.app.root.addChild(root);
    return {
      root,
      model: null,
      impostor: null,
      modelId: '',
      parts,
      footprint,
      beacon,
      rally,
      healthBack,
      healthBar,
      defenseStem,
      defenseHead,
      constructionFrame,
      constructionLift,
      constructionSpark,
      productionRig,
      productionRotor,
      productionCore,
      productionPulse,
      wasCompleted: building.completed,
      completedAtTick: -1,
      activeProductionOrderId: null,
      productionCompletedAtTick: -1,
      wasDestroyed: building.destroyed,
      destroyedAtTick: -1,
      collapsePitch: Math.cos(collapseAngle) * 15,
      collapseRoll: Math.sin(collapseAngle) * 15,
    };
  }

  private materialFor(playerId: number, role: BuildingVisualMaterialRole): pc.Material {
    if (playerId === 0) return role === 'ACCENT' ? this.playerAccentMaterial : this.playerMaterial;
    return role === 'ACCENT' ? this.enemyAccentMaterial : this.enemyMaterial;
  }
}
