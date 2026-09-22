import * as pc from 'playcanvas';
import { VisualAssetLibrary, type VisualModel } from './visual-asset-library';
import { BuildingImpostorLibrary, type BuildingImpostorHandle } from './building-impostor-library';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { NavigationGrid } from '../simulation/navigation';
import type { VisibilityState } from '../simulation/visibility-state';
import { BUILDINGS } from '../simulation/m03-content';
import type { StrategicBuilding, StrategicSnapshot } from '../simulation/strategic-state';
import {
  buildingDamagePresentation,
  buildingVisualProfile,
  type BuildingVisualMaterialRole,
  type BuildingVisualProfile,
} from './building-visual-profile';

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
  identityMarker: pc.Entity;
  rally: pc.Entity;
  lastRallyX: number | null;
  lastRallyZ: number | null;
  rallyChangedAtTick: number;
  healthBack: pc.Entity;
  healthBar: pc.Entity;
  defenseStem: pc.Entity;
  defenseHead: pc.Entity;
  constructionFrame: pc.Entity;
  constructionLift: pc.Entity;
  constructionSpark: pc.Entity;
  constructionLoad: pc.Entity;
  damageCrackA: pc.Entity;
  damageCrackB: pc.Entity;
  damageSmokeA: pc.Entity;
  damageSmokeB: pc.Entity;
  damageEmber: pc.Entity;
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

interface RelayLinkPresentation {
  root: pc.Entity;
  core: pc.Entity;
  halo: pc.Entity;
  pulses: readonly pc.Entity[];
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  distance: number;
  phase: number;
}

interface RelayAnchorPresentation {
  root: pc.Entity;
  ring: pc.Entity;
  core: pc.Entity;
  halo: pc.Entity;
  radius: number;
  coreY: number;
  strength: number;
  phase: number;
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

const RALLY_HINT_TICKS = 18;

function createOverlayMaterial(color: pc.Color, opacity: number): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.opacity = opacity;
  material.blendType = pc.BLEND_NORMAL;
  material.depthWrite = false;
  material.cull = pc.CULLFACE_NONE;
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

function isStrategicAnchor(building: StrategicBuilding, supplied: ReadonlySet<number>): boolean {
  if (building.type === 'ELEMENTAL_CORE') return true;
  if (!supplied.has(building.regionId)) return false;
  if (building.type === 'ARCANE_TOWER') return true;
  return building.type === 'OUTPOST' && building.specialization === 'MANA_BEACON';
}

export class StrategicRenderBridge {
  private readonly entities = new Map<number, BuildingPresentation>();
  private readonly networkLinks: RelayLinkPresentation[] = [];
  private readonly networkAnchors: RelayAnchorPresentation[] = [];
  private readonly buildingImpostors: BuildingImpostorLibrary;
  private networkKey = '';
  private readonly playerMaterial = createMaterial(new pc.Color(0.16, 0.58, 0.5), new pc.Color(0.01, 0.15, 0.1));
  private readonly playerAccentMaterial = createMaterial(new pc.Color(0.48, 0.96, 0.86), new pc.Color(0.04, 0.54, 0.4));
  private readonly enemyMaterial = createMaterial(new pc.Color(0.64, 0.14, 0.12), new pc.Color(0.16, 0.01, 0.01));
  private readonly enemyAccentMaterial = createMaterial(new pc.Color(1, 0.45, 0.16), new pc.Color(0.62, 0.08, 0.01));
  private readonly constructionMaterial = createMaterial(new pc.Color(0.46, 0.43, 0.3), new pc.Color(0.08, 0.07, 0.03));
  private readonly destroyedMaterial = createMaterial(new pc.Color(0.12, 0.13, 0.13), new pc.Color(0.018, 0.018, 0.018));
  private readonly damageCrackMaterial = createMaterial(new pc.Color(0.09, 0.085, 0.075));
  private readonly damageSmokeMaterial = createOverlayMaterial(new pc.Color(0.16, 0.17, 0.17), 0.42);
  private readonly damageEmberMaterial = createMaterial(
    new pc.Color(0.82, 0.34, 0.08),
    new pc.Color(0.58, 0.09, 0.01),
    0.72,
  );
  private readonly workMaterial = createMaterial(new pc.Color(.94, .66, .22), new pc.Color(.25, .12, .02));
  private readonly identityMaterial = createMaterial(new pc.Color(.70, .55, .28));
  private readonly arcaneIdentityMaterial = createMaterial(new pc.Color(.52, .40, .78));
  private readonly coreIdentityMaterial = createMaterial(new pc.Color(.36, .72, .68));
  private readonly rallyMaterial = createOverlayMaterial(new pc.Color(.42, .72, .64), .20);
  private readonly workGlowMaterial = createMaterial(
    new pc.Color(.78, .56, .20),
    new pc.Color(.18, .07, .01),
    .26,
  );
  private readonly networkMaterial = createMaterial(
    new pc.Color(0.18, 0.78, 0.7),
    new pc.Color(0.04, 0.42, 0.32),
    .72,
  );
  private readonly networkGlowMaterial = createMaterial(
    new pc.Color(.42, 1, .9),
    new pc.Color(.10, .86, .68),
    .34,
  );
  private readonly networkPulseMaterial = createMaterial(
    new pc.Color(.78, 1, .94),
    new pc.Color(.24, 1, .78),
    .92,
  );
  private readonly healthBackMaterial = createMaterial(new pc.Color(0.035, 0.045, 0.045));

  constructor(
    private readonly app: pc.Application,
    private readonly visualAssets: VisualAssetLibrary,
    private readonly lowQuality = false,
  ) {
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
      const useCompletedPlayerImpostor = building.playerId === 0
        && building.completed
        && !building.destroyed;
      presentation.footprint.enabled = !building.destroyed && !building.completed;
      if (presentation.footprint.render) {
        presentation.footprint.render.material = this.constructionMaterial;
      }
      if (presentation.beacon.render) {
        presentation.beacon.render.material = building.completed
          ? this.materialFor(building.playerId, 'ACCENT')
          : this.constructionMaterial;
      }
      presentation.beacon.enabled = false;

      const profile = buildingVisualProfile(building.type);
      const showIdentityMarker = building.playerId === 0 && building.completed && !building.destroyed;
      presentation.identityMarker.enabled = showIdentityMarker;
      if (showIdentityMarker) {
        const attachedHeight = Math.max(0.62, profile.height * 0.78);
        presentation.identityMarker.setLocalPosition(0, attachedHeight, -profile.footprint * 0.08);
        presentation.identityMarker.setLocalScale(0.78, 0.78, 0.78);
        presentation.identityMarker.setLocalEulerAngles(0, 0, 0);
      }
      const buildProgress = constructionProgress(building, tick);
      const constructing = !building.completed && !building.destroyed;
      const constructionCompletionAge = presentation.completedAtTick < 0
        ? 99
        : Math.max(0, tick - presentation.completedAtTick);
      presentation.constructionFrame.enabled = constructing;
      presentation.constructionSpark.enabled = constructing && !this.lowQuality;
      presentation.constructionLoad.enabled = constructing;
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
        presentation.constructionLoad.setLocalPosition(0, Math.max(0.16, buildHeight * 0.56), 0);
        presentation.constructionLoad.setLocalScale(
          profile.footprint * (0.24 + buildProgress * 0.22),
          Math.max(0.12, profile.height * (0.08 + buildProgress * 0.12)),
          profile.footprint * (0.18 + buildProgress * 0.15),
        );
        presentation.constructionLoad.setLocalEulerAngles(0, 18 + building.id * 7, 0);
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
      const useImpostor = useCompletedPlayerImpostor;
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

      const damage = buildingDamagePresentation(building.currentHealth, building.maxHealth, building.destroyed);
      const damageEmphasis = building.type === 'ELEMENTAL_CORE'
        ? 1.3
        : building.type === 'ARCANE_TOWER'
          ? 1.18
          : building.type === 'BARRACKS'
            ? 1.12
            : 1;
      const damaged = damage.tier === 'DAMAGED' || damage.tier === 'CRITICAL';
      const critical = damage.tier === 'CRITICAL';
      presentation.damageCrackA.enabled = damaged;
      presentation.damageCrackB.enabled = damage.crackCount >= 2;
      presentation.damageSmokeA.enabled = critical;
      presentation.damageSmokeB.enabled = critical && !this.lowQuality;
      presentation.damageEmber.enabled = critical && !this.lowQuality;
      if (damaged) {
        const crackScale = profile.footprint * 0.38 * damageEmphasis;
        presentation.damageCrackA.setLocalPosition(
          profile.footprint * 0.13,
          Math.max(0.46, profile.height * 0.44),
          -profile.footprint * 0.32,
        );
        presentation.damageCrackA.setLocalScale(crackScale, 0.045, 0.055);
        presentation.damageCrackA.setLocalEulerAngles(0, 18, 28);
        if (damage.crackCount >= 2) {
          presentation.damageCrackB.setLocalPosition(
            -profile.footprint * 0.18,
            Math.max(0.62, profile.height * 0.62),
            profile.footprint * 0.28,
          );
          presentation.damageCrackB.setLocalScale(crackScale * 0.82, 0.04, 0.05);
          presentation.damageCrackB.setLocalEulerAngles(0, -24, -34);
        }
      }
      if (critical) {
        const phase = tick * 0.21 + building.id * 0.77;
        const pulse = 0.5 + 0.5 * Math.sin(phase);
        const smokeScale = (0.40 + pulse * 0.09) * damageEmphasis;
        presentation.damageSmokeA.setLocalPosition(
          profile.footprint * 0.14,
          profile.height * (0.70 + pulse * 0.035),
          -profile.footprint * 0.06,
        );
        presentation.damageSmokeA.setLocalScale(smokeScale, smokeScale * 1.28, smokeScale);
        if (!this.lowQuality) {
          presentation.damageSmokeB.setLocalPosition(
            -profile.footprint * 0.20,
            profile.height * (0.57 + (1 - pulse) * 0.045),
            profile.footprint * 0.10,
          );
          presentation.damageSmokeB.setLocalScale(smokeScale * 0.72, smokeScale, smokeScale * 0.72);
          const emberScale = (0.11 + pulse * 0.055) * damageEmphasis;
          presentation.damageEmber.setLocalPosition(
            profile.footprint * 0.10,
            Math.max(0.48, profile.height * 0.43),
            -profile.footprint * 0.18,
          );
          presentation.damageEmber.setLocalScale(emberScale, emberScale, emberScale);
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

      const rallyChanged = building.rallyPointX !== presentation.lastRallyX
        || building.rallyPointZ !== presentation.lastRallyZ;
      if (rallyChanged) {
        presentation.lastRallyX = building.rallyPointX;
        presentation.lastRallyZ = building.rallyPointZ;
        presentation.rallyChangedAtTick = tick;
      }
      const rallyAge = presentation.rallyChangedAtTick < 0
        ? RALLY_HINT_TICKS
        : Math.max(0, tick - presentation.rallyChangedAtTick);
      const showRally = building.playerId === 0
        && building.completed
        && !building.destroyed
        && building.rallyPointX !== null
        && building.rallyPointZ !== null
        && rallyAge < RALLY_HINT_TICKS;
      presentation.rally.enabled = showRally;
      if (showRally && building.rallyPointX !== null && building.rallyPointZ !== null) {
        const fade = 1 - rallyAge / RALLY_HINT_TICKS;
        const scale = 0.36 + fade * 0.22;
        presentation.rally.setLocalPosition(
          (building.rallyPointX - building.x) / WORLD_UNITS_PER_METER,
          0.045,
          (building.rallyPointZ - building.z) / WORLD_UNITS_PER_METER,
        );
        presentation.rally.setLocalScale(scale, 0.018, scale);
      }
    }
    for (const [buildingId, presentation] of [...this.entities]) {
      if (active.has(buildingId)) continue;
      this.visualAssets.release(presentation.model);
      this.buildingImpostors.release(presentation.impostor);
      presentation.root.destroy();
      this.entities.delete(buildingId);
    }
    this.syncNetwork(snapshot, tick);
  }

  destroy(): void {
    this.clearNetwork();
    for (const presentation of this.entities.values()) {
      this.visualAssets.release(presentation.model);
      this.buildingImpostors.release(presentation.impostor);
      presentation.root.destroy();
    }
    this.buildingImpostors.destroy();
    this.workMaterial.destroy();
    this.identityMaterial.destroy();
    this.arcaneIdentityMaterial.destroy();
    this.coreIdentityMaterial.destroy();
    this.workGlowMaterial.destroy();
    this.rallyMaterial.destroy();
    this.networkMaterial.destroy();
    this.networkGlowMaterial.destroy();
    this.networkPulseMaterial.destroy();
    this.entities.clear();
    this.playerMaterial.destroy();
    this.playerAccentMaterial.destroy();
    this.enemyMaterial.destroy();
    this.enemyAccentMaterial.destroy();
    this.constructionMaterial.destroy();
    this.destroyedMaterial.destroy();
    this.damageCrackMaterial.destroy();
    this.damageSmokeMaterial.destroy();
    this.damageEmberMaterial.destroy();
    this.healthBackMaterial.destroy();
  }

  private syncNetwork(snapshot: StrategicSnapshot, tick: number): void {
    const supplied = new Set(snapshot.suppliedRegions[0] ?? []);
    const anchors = snapshot.buildings
      .filter((building) => building.playerId === 0 && building.completed && !building.destroyed)
      .filter((building) => isStrategicAnchor(building, supplied))
      .sort((left, right) => {
        const leftCore = left.type === 'ELEMENTAL_CORE' ? 0 : 1;
        const rightCore = right.type === 'ELEMENTAL_CORE' ? 0 : 1;
        return leftCore - rightCore || left.id - right.id;
      });
    const key = anchors
      .map((building) => `${building.id}:${building.type}:${building.specialization ?? '-'}:${building.regionId}:${building.x}:${building.z}`)
      .join('|');
    if (key !== this.networkKey) {
      this.networkKey = key;
      this.clearNetwork();
      for (const building of anchors) this.addNetworkAnchor(building);

      if (anchors.length >= 2) {
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
    }
    this.updateNetwork(tick);
    // Strategic relay authority remains unchanged, but persistent ground cyan
    // guides are suppressed. Future contextual targeting UI may re-enable them
    // only while the network is actively being inspected or used.
    for (const link of this.networkLinks) link.root.enabled = false;
    for (const anchor of this.networkAnchors) anchor.root.enabled = false;
  }

  private clearNetwork(): void {
    for (const link of this.networkLinks) link.root.destroy();
    this.networkLinks.length = 0;
    for (const anchor of this.networkAnchors) anchor.root.destroy();
    this.networkAnchors.length = 0;
  }

  private addNetworkAnchor(building: StrategicBuilding): void {
    const profile = buildingVisualProfile(building.type);
    const radius = Math.max(.48, profile.footprint * .46);
    const strength = building.type === 'ELEMENTAL_CORE'
      ? 1.25
      : building.type === 'ARCANE_TOWER'
        ? 1
        : .84;
    const root = new pc.Entity(`Strategic Anchor ${building.id}`);
    root.setPosition(
      building.x / WORLD_UNITS_PER_METER,
      0,
      building.z / WORLD_UNITS_PER_METER,
    );

    const ring = new pc.Entity(`Strategic Anchor ${building.id} Ring`);
    ring.addComponent('render', { type: 'cylinder', material: this.networkGlowMaterial, castShadows: false });
    ring.setLocalPosition(0, .075, 0);
    ring.setLocalScale(radius, .018, radius);
    root.addChild(ring);

    const coreY = profile.height + .38;
    const halo = new pc.Entity(`Strategic Anchor ${building.id} Halo`);
    halo.addComponent('render', { type: 'sphere', material: this.networkGlowMaterial, castShadows: false });
    halo.setLocalPosition(0, coreY, 0);
    halo.setLocalScale(.24 * strength, .10 * strength, .24 * strength);
    root.addChild(halo);

    const core = new pc.Entity(`Strategic Anchor ${building.id} Core`);
    core.addComponent('render', { type: 'sphere', material: this.networkPulseMaterial, castShadows: false });
    core.setLocalPosition(0, coreY, 0);
    core.setLocalScale(.11 * strength, .11 * strength, .11 * strength);
    root.addChild(core);

    this.app.root.addChild(root);
    this.networkAnchors.push({
      root,
      ring,
      core,
      halo,
      radius,
      coreY,
      strength,
      phase: building.id * .619,
    });
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

    const root = new pc.Entity(`Strategic Relay ${from.id}-${to.id}`);
    const midpointX = (fromX + toX) * .5;
    const midpointZ = (fromZ + toZ) * .5;
    const yaw = Math.atan2(dx, dz) * 180 / Math.PI;

    const halo = new pc.Entity(`Strategic Relay ${from.id}-${to.id} Halo`);
    halo.addComponent('render', { type: 'box', material: this.networkGlowMaterial, castShadows: false });
    halo.setLocalPosition(midpointX, .135, midpointZ);
    halo.setLocalScale(.13, .018, distance);
    halo.setLocalEulerAngles(0, yaw, 0);
    root.addChild(halo);

    const core = new pc.Entity(`Strategic Relay ${from.id}-${to.id} Core`);
    core.addComponent('render', { type: 'box', material: this.networkMaterial, castShadows: false });
    core.setLocalPosition(midpointX, .145, midpointZ);
    core.setLocalScale(.045, .028, distance);
    core.setLocalEulerAngles(0, yaw, 0);
    root.addChild(core);

    const pulses: pc.Entity[] = [];
    for (let index = 0; index < 3; index += 1) {
      const pulse = new pc.Entity(`Strategic Relay ${from.id}-${to.id} Pulse ${index + 1}`);
      pulse.addComponent('render', { type: 'sphere', material: this.networkPulseMaterial, castShadows: false });
      pulse.setLocalScale(.09, .09, .09);
      root.addChild(pulse);
      pulses.push(pulse);
    }

    this.app.root.addChild(root);
    this.networkLinks.push({
      root,
      core,
      halo,
      pulses,
      fromX,
      fromZ,
      toX,
      toZ,
      distance,
      phase: ((from.id * 31 + to.id * 17) % 97) / 97,
    });
  }

  private updateNetwork(tick: number): void {
    for (const anchor of this.networkAnchors) {
      const wave = .5 + .5 * Math.sin(tick * .22 + anchor.phase);
      const ringScale = anchor.radius * (1 + wave * .11);
      anchor.ring.setLocalScale(ringScale, .018, ringScale);
      anchor.ring.setLocalEulerAngles(0, tick * (2.2 + anchor.strength), 0);
      anchor.core.setLocalPosition(0, anchor.coreY + Math.sin(tick * .18 + anchor.phase) * .06, 0);
      const coreScale = (.095 + wave * .045) * anchor.strength;
      anchor.core.setLocalScale(coreScale, coreScale, coreScale);
      const haloScale = (.20 + wave * .09) * anchor.strength;
      anchor.halo.setLocalScale(haloScale, haloScale * .42, haloScale);
    }

    for (const link of this.networkLinks) {
      const wave = .5 + .5 * Math.sin(tick * .17 + link.phase * Math.PI * 2);
      link.core.setLocalScale(.045 + wave * .012, .028, link.distance);
      link.halo.setLocalScale(.12 + wave * .04, .018, link.distance);
      for (let index = 0; index < link.pulses.length; index += 1) {
        const pulse = link.pulses[index]!;
        const raw = tick * .036 + link.phase + index / link.pulses.length;
        const progress = raw - Math.floor(raw);
        const x = pc.math.lerp(link.fromX, link.toX, progress);
        const z = pc.math.lerp(link.fromZ, link.toZ, progress);
        const y = .18 + Math.sin(progress * Math.PI) * .055;
        pulse.setLocalPosition(x, y, z);
        const scale = .065 + Math.sin(progress * Math.PI) * .045;
        pulse.setLocalScale(scale, scale, scale);
      }
    }
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

    const identityMarker = this.createIdentityMarker(building, profile);
    identityMarker.enabled = building.playerId === 0 && building.completed && !building.destroyed;
    root.addChild(identityMarker);

    const rally = new pc.Entity(`${building.type} ${building.id} Rally Point`);
    rally.addComponent('render', {
      type: 'cylinder',
      material: this.rallyMaterial,
      castShadows: false,
    });
    rally.setLocalScale(0.58, 0.018, 0.58);
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

      const midBeam = new pc.Entity(`${building.type} ${building.id} Scaffold Mid Beam ${index + 1}`);
      midBeam.addComponent('render', { type: 'box', material: this.constructionMaterial, castShadows: false });
      midBeam.setLocalPosition(x, frameHeight * 0.46, z);
      midBeam.setLocalScale(sx, 0.038, sz);
      constructionFrame.addChild(midBeam);
    }
    constructionFrame.enabled = !building.completed && !building.destroyed;
    root.addChild(constructionFrame);

    const constructionLift = new pc.Entity(`${building.type} ${building.id} Construction Lift`);
    constructionLift.addComponent('render', { type: 'cylinder', material: this.workGlowMaterial, castShadows: false });
    constructionLift.enabled = !building.completed && !building.destroyed;
    root.addChild(constructionLift);

    const constructionSpark = new pc.Entity(`${building.type} ${building.id} Construction Spark`);
    constructionSpark.addComponent('render', { type: 'sphere', material: this.workMaterial, castShadows: false });
    constructionSpark.enabled = !building.completed && !building.destroyed && !this.lowQuality;
    root.addChild(constructionSpark);

    const constructionLoad = new pc.Entity(`${building.type} ${building.id} Construction Load`);
    constructionLoad.addComponent('render', { type: 'box', material: this.constructionMaterial, castShadows: false });
    constructionLoad.enabled = !building.completed && !building.destroyed;
    root.addChild(constructionLoad);

    const damageCrackA = new pc.Entity(`${building.type} ${building.id} Damage Crack A`);
    damageCrackA.addComponent('render', { type: 'box', material: this.damageCrackMaterial, castShadows: false });
    damageCrackA.enabled = false;
    root.addChild(damageCrackA);

    const damageCrackB = new pc.Entity(`${building.type} ${building.id} Damage Crack B`);
    damageCrackB.addComponent('render', { type: 'box', material: this.damageCrackMaterial, castShadows: false });
    damageCrackB.enabled = false;
    root.addChild(damageCrackB);

    const damageSmokeA = new pc.Entity(`${building.type} ${building.id} Damage Smoke A`);
    damageSmokeA.addComponent('render', { type: 'sphere', material: this.damageSmokeMaterial, castShadows: false });
    damageSmokeA.enabled = false;
    root.addChild(damageSmokeA);

    const damageSmokeB = new pc.Entity(`${building.type} ${building.id} Damage Smoke B`);
    damageSmokeB.addComponent('render', { type: 'sphere', material: this.damageSmokeMaterial, castShadows: false });
    damageSmokeB.enabled = false;
    root.addChild(damageSmokeB);

    const damageEmber = new pc.Entity(`${building.type} ${building.id} Damage Ember`);
    damageEmber.addComponent('render', { type: 'sphere', material: this.damageEmberMaterial, castShadows: false });
    damageEmber.enabled = false;
    root.addChild(damageEmber);

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
      identityMarker,
      rally,
      lastRallyX: building.rallyPointX,
      lastRallyZ: building.rallyPointZ,
      rallyChangedAtTick: -1,
      healthBack,
      healthBar,
      defenseStem,
      defenseHead,
      constructionFrame,
      constructionLift,
      constructionSpark,
      constructionLoad,
      damageCrackA,
      damageCrackB,
      damageSmokeA,
      damageSmokeB,
      damageEmber,
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

  private createIdentityMarker(building: StrategicBuilding, profile: BuildingVisualProfile): pc.Entity {
    const root = new pc.Entity(`${building.type} ${building.id} Identity Marker`);
    const material = profile.marker === 'CORE'
      ? this.coreIdentityMaterial
      : profile.marker === 'ORB' || profile.marker === 'WELL'
        ? this.arcaneIdentityMaterial
        : this.identityMaterial;
    const add = (
      name: string,
      type: 'box' | 'cylinder' | 'sphere',
      position: readonly [number, number, number],
      scale: readonly [number, number, number],
      yaw = 0,
    ): pc.Entity => {
      const part = new pc.Entity(`${building.type} ${building.id} Identity ${name}`);
      part.addComponent('render', { type, material, castShadows: false });
      part.setLocalPosition(position[0], position[1], position[2]);
      part.setLocalScale(scale[0], scale[1], scale[2]);
      if (yaw !== 0) part.setLocalEulerAngles(0, yaw, 0);
      root.addChild(part);
      return part;
    };

    if (profile.marker === 'CORE') {
      add('Core', 'sphere', [0, 0, 0], [0.18, 0.18, 0.18]);
      add('North Ray', 'box', [0, 0, -0.23], [0.08, 0.07, 0.28]);
      add('South Ray', 'box', [0, 0, 0.23], [0.08, 0.07, 0.28]);
      add('East Ray', 'box', [0.23, 0, 0], [0.28, 0.07, 0.08]);
      add('West Ray', 'box', [-0.23, 0, 0], [0.28, 0.07, 0.08]);
    } else if (profile.marker === 'GATE') {
      add('Left Post', 'box', [-0.23, 0, 0], [0.10, 0.10, 0.56]);
      add('Right Post', 'box', [0.23, 0, 0], [0.10, 0.10, 0.56]);
      add('Lintel', 'box', [0, 0, -0.23], [0.56, 0.10, 0.10]);
      add('Shield', 'cylinder', [0, 0.08, 0.06], [0.17, 0.035, 0.17]);
    } else if (profile.marker === 'ORB') {
      add('Core', 'sphere', [0, 0, 0], [0.20, 0.20, 0.20]);
      add('North', 'sphere', [0, 0, -0.34], [0.08, 0.08, 0.08]);
      add('East', 'sphere', [0.34, 0, 0], [0.08, 0.08, 0.08]);
      add('South', 'sphere', [0, 0, 0.34], [0.08, 0.08, 0.08]);
      add('West', 'sphere', [-0.34, 0, 0], [0.08, 0.08, 0.08]);
    } else if (profile.marker === 'TOOLS') {
      add('Tool A', 'box', [0, 0, 0], [0.10, 0.10, 0.72], 45);
      add('Tool B', 'box', [0, 0, 0], [0.10, 0.10, 0.72], -45);
      add('Hub', 'cylinder', [0, 0.06, 0], [0.15, 0.05, 0.15]);
      add('Gear North', 'box', [0, 0.05, -0.22], [0.08, 0.06, 0.14]);
      add('Gear South', 'box', [0, 0.05, 0.22], [0.08, 0.06, 0.14]);
      add('Gear East', 'box', [0.22, 0.05, 0], [0.14, 0.06, 0.08]);
      add('Gear West', 'box', [-0.22, 0.05, 0], [0.14, 0.06, 0.08]);
    } else if (profile.marker === 'BEACON') {
      add('Stem', 'cylinder', [0, 0.18, 0], [0.10, 0.38, 0.10]);
      add('Head', 'sphere', [0, 0.46, 0], [0.16, 0.16, 0.16]);
      add('Crossbar', 'box', [0, 0.20, 0], [0.52, 0.08, 0.08]);
      add('Banner', 'box', [0.18, 0.28, 0], [0.28, 0.30, 0.055]);
    } else if (profile.marker === 'PUMP') {
      add('Pump', 'cylinder', [0, 0, 0], [0.20, 0.12, 0.20]);
      add('Arm', 'box', [0.28, 0.03, 0], [0.48, 0.08, 0.10]);
      add('Valve', 'sphere', [-0.24, 0.03, 0], [0.11, 0.11, 0.11]);
      add('Drill', 'cylinder', [0.50, -0.01, 0], [0.08, 0.22, 0.08]);
    } else {
      add('Well', 'cylinder', [0, 0, 0], [0.34, 0.07, 0.34]);
      add('Mana', 'sphere', [0, 0.16, 0], [0.17, 0.17, 0.17]);
      add('Axis', 'box', [0, 0.03, 0], [0.54, 0.06, 0.08], 45);
    }

    return root;
  }

  private materialFor(playerId: number, role: BuildingVisualMaterialRole): pc.Material {
    if (playerId === 0) return role === 'ACCENT' ? this.playerAccentMaterial : this.playerMaterial;
    return role === 'ACCENT' ? this.enemyAccentMaterial : this.enemyMaterial;
  }
}
