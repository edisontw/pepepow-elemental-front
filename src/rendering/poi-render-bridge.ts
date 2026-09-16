import * as pc from 'playcanvas';
import type { RtsCamera } from './rts-camera';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import { VisibilityLevel } from '../simulation/visibility-state';
import type { StrategicSnapshot } from '../simulation/strategic-state';
import type { GeneratedWorld, PointOfInterest } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';
import { poiOwnershipState, poiVisualProfile, type PoiOwnershipState } from './poi-visual-profile';

interface PoiPresentation {
  poi: PointOfInterest;
  root: pc.Entity;
  ownershipBase: pc.Entity;
  beacon: pc.Entity;
  pickAnchor: pc.Entity;
  ownership: PoiOwnershipState;
}

function createMaterial(
  color: pc.Color,
  emissive?: pc.Color,
  opacity = 1,
  emissiveIntensity = 0.55,
  gloss = 0.26,
): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.gloss = gloss;
  material.metalness = 0.02;
  material.opacity = opacity;
  if (opacity < 1) {
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
    material.cull = pc.CULLFACE_NONE;
  }
  if (emissive) {
    material.emissive = emissive;
    material.emissiveIntensity = emissiveIntensity;
  }
  material.update();
  return material;
}

function addPrimitive(
  parent: pc.Entity,
  type: 'box' | 'cylinder' | 'sphere',
  name: string,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  material: pc.Material,
  rotation: readonly [number, number, number] = [0, 0, 0],
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type, material, castShadows: false, receiveShadows: false });
  entity.setLocalPosition(position[0], position[1], position[2]);
  entity.setLocalScale(scale[0], scale[1], scale[2]);
  entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
  parent.addChild(entity);
  return entity;
}

export class PoiRenderBridge {
  private readonly presentations = new Map<string, PoiPresentation>();
  private readonly screenPosition = new pc.Vec3();

  private readonly neutralOwnershipMaterial = createMaterial(
    new pc.Color(0.48, 0.5, 0.46),
    new pc.Color(0.025, 0.028, 0.022),
    0.68,
    0.28,
    0.16,
  );
  private readonly playerOwnershipMaterial = createMaterial(
    new pc.Color(0.12, 0.52, 0.43),
    new pc.Color(0.015, 0.19, 0.15),
    0.72,
    0.42,
    0.2,
  );
  private readonly enemyOwnershipMaterial = createMaterial(
    new pc.Color(0.56, 0.18, 0.15),
    new pc.Color(0.18, 0.018, 0.012),
    0.72,
    0.42,
    0.2,
  );

  private readonly siteGroundMaterial = createMaterial(new pc.Color(0.255, 0.235, 0.175), undefined, 1, 0, 0.055);
  private readonly stoneBaseMaterial = createMaterial(new pc.Color(0.28, 0.29, 0.27), undefined, 1, 0, 0.12);
  private readonly stoneLightMaterial = createMaterial(new pc.Color(0.44, 0.44, 0.4), undefined, 1, 0, 0.16);
  private readonly timberMaterial = createMaterial(new pc.Color(0.29, 0.18, 0.085), undefined, 1, 0, 0.12);
  private readonly darkTimberMaterial = createMaterial(new pc.Color(0.18, 0.105, 0.052), undefined, 1, 0, 0.08);
  private readonly clothMaterial = createMaterial(new pc.Color(0.36, 0.25, 0.15), undefined, 1, 0, 0.12);

  private readonly shrineMaterial = createMaterial(
    new pc.Color(0.38, 0.31, 0.56),
    new pc.Color(0.065, 0.035, 0.16),
    1,
    0.5,
    0.3,
  );
  private readonly campMaterial = createMaterial(
    new pc.Color(0.47, 0.31, 0.16),
    new pc.Color(0.02, 0.008, 0.002),
    1,
    0.22,
    0.14,
  );
  private readonly villageMaterial = createMaterial(
    new pc.Color(0.55, 0.48, 0.34),
    new pc.Color(0.02, 0.014, 0.006),
    1,
    0.22,
    0.16,
  );
  private readonly ruinMaterial = createMaterial(
    new pc.Color(0.36, 0.37, 0.35),
    new pc.Color(0.012, 0.012, 0.011),
    1,
    0.2,
    0.13,
  );

  private readonly tooltip: HTMLDivElement;
  private hoveredPoiId: string | null = null;
  private latestPoiOwners: Readonly<Record<string, number>> = {};

  constructor(
    private readonly app: pc.Application,
    private readonly world: GeneratedWorld,
    private readonly cameraComponent: pc.CameraComponent,
    private readonly camera: RtsCamera,
    private readonly canvas: HTMLCanvasElement,
  ) {
    for (const poi of world.pois) this.createPresentation(poi);
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'poi-hover-tooltip';
    this.tooltip.hidden = true;
    document.body.appendChild(this.tooltip);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointerdown', this.onPointerDown);
  }

  sync(snapshot: StrategicSnapshot, visibility?: Uint8Array): void {
    this.latestPoiOwners = snapshot.poiOwners;
    for (const presentation of this.presentations.values()) {
      const cellIndex = presentation.poi.cell.z * this.world.width + presentation.poi.cell.x;
      const level = visibility?.[cellIndex] ?? VisibilityLevel.VISIBLE;
      presentation.root.enabled = level !== VisibilityLevel.UNEXPLORED;
      presentation.ownershipBase.enabled = level === VisibilityLevel.VISIBLE;
      presentation.beacon.enabled = level === VisibilityLevel.VISIBLE;
      presentation.pickAnchor.enabled = level === VisibilityLevel.VISIBLE;
      const ownership = poiOwnershipState(snapshot.poiOwners[presentation.poi.id]);
      if (ownership === presentation.ownership) continue;
      presentation.ownership = ownership;
      const material = this.ownershipMaterial(ownership);
      if (presentation.ownershipBase.render) presentation.ownershipBase.render.material = material;
      if (presentation.beacon.render) presentation.beacon.render.material = material;
    }
    if (this.hoveredPoiId !== null) {
      const hovered = this.presentations.get(this.hoveredPoiId);
      if (!hovered?.pickAnchor.enabled) {
        this.hoveredPoiId = null;
        this.tooltip.hidden = true;
        this.canvas.classList.remove('poi-hover');
      } else {
        this.updateTooltipContent(this.hoveredPoiId);
      }
    }
  }

  destroy(): void {
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.tooltip.remove();
    for (const presentation of this.presentations.values()) presentation.root.destroy();
    this.presentations.clear();

    for (const material of [
      this.neutralOwnershipMaterial,
      this.playerOwnershipMaterial,
      this.enemyOwnershipMaterial,
      this.siteGroundMaterial,
      this.stoneBaseMaterial,
      this.stoneLightMaterial,
      this.timberMaterial,
      this.darkTimberMaterial,
      this.clothMaterial,
      this.shrineMaterial,
      this.campMaterial,
      this.villageMaterial,
      this.ruinMaterial,
    ]) material.destroy();
  }

  private createPresentation(poi: PointOfInterest): void {
    const profile = poiVisualProfile(poi.type);
    const position = worldCellToSimulationPosition(this.world, poi.cell);
    const root = new pc.Entity(`POI ${profile.label} ${poi.id}`);
    root.setPosition(
      position.x / WORLD_UNITS_PER_METER,
      0.025,
      position.z / WORLD_UNITS_PER_METER,
    );

    addPrimitive(
      root,
      'cylinder',
      `${profile.label} Ground Wear A`,
      [0, 0.012, 0],
      [1.92, 0.018, 1.58],
      this.siteGroundMaterial,
    );
    addPrimitive(
      root,
      'cylinder',
      `${profile.label} Ground Wear B`,
      [0.48, 0.014, -0.28],
      [0.92, 0.016, 0.62],
      this.siteGroundMaterial,
      [0, 18, 0],
    );

    addPrimitive(
      root,
      'cylinder',
      `${profile.label} Stone Apron`,
      [0, 0.035, 0],
      [1.34, 0.04, 1.16],
      this.stoneBaseMaterial,
    );

    const landmarkMaterial = this.landmarkMaterial(poi.type);
    for (const [index, part] of profile.landmark.entries()) {
      addPrimitive(
        root,
        part.primitive,
        `${profile.label} Part ${index + 1}`,
        part.position,
        part.scale,
        landmarkMaterial,
      );
    }
    this.addLandmarkDressing(root, poi);

    const ownershipBase = addPrimitive(
      root,
      'cylinder',
      `${profile.label} Ownership Marker`,
      [0, 0.052, 0],
      [0.82, 0.025, 0.82],
      this.neutralOwnershipMaterial,
    );
    const beacon = addPrimitive(
      root,
      'sphere',
      `${profile.label} Beacon`,
      [0, 1.76, 0],
      [0.105, 0.105, 0.105],
      this.neutralOwnershipMaterial,
    );

    const pickAnchor = new pc.Entity(`${profile.label} Pick Anchor`);
    pickAnchor.setLocalPosition(0, 1.05, 0);
    root.addChild(pickAnchor);
    this.app.root.addChild(root);
    this.presentations.set(poi.id, {
      poi,
      root,
      ownershipBase,
      beacon,
      pickAnchor,
      ownership: 'NEUTRAL',
    });
  }

  private addLandmarkDressing(root: pc.Entity, poi: PointOfInterest): void {
    if (poi.type === 'SHRINE') {
      for (let index = 0; index < 4; index += 1) {
        const angle = index * Math.PI * 0.5 + Math.PI * 0.25;
        addPrimitive(
          root,
          'box',
          `Shrine Boundary Stone ${index + 1}`,
          [Math.cos(angle) * 0.88, 0.13, Math.sin(angle) * 0.7],
          [0.24, 0.22, 0.18],
          index % 2 === 0 ? this.stoneLightMaterial : this.stoneBaseMaterial,
          [5, index * 24, index % 2 === 0 ? 7 : -6],
        );
      }
      addPrimitive(root, 'box', 'Shrine Fallen Tablet', [0.58, 0.09, 0.5], [0.38, 0.12, 0.22], this.stoneLightMaterial, [9, 31, 14]);
      addPrimitive(root, 'box', 'Shrine Threshold', [0, 0.075, -0.84], [0.72, 0.11, 0.28], this.stoneBaseMaterial, [0, 0, 0]);
      return;
    }

    if (poi.type === 'NEUTRAL_CAMP') {
      addPrimitive(root, 'box', 'Camp Crate', [-0.68, 0.14, -0.32], [0.34, 0.27, 0.3], this.timberMaterial, [0, 18, 0]);
      addPrimitive(root, 'cylinder', 'Camp Barrel', [0.56, 0.15, 0.42], [0.16, 0.28, 0.16], this.darkTimberMaterial);
      addPrimitive(root, 'box', 'Camp Bedroll', [0.45, 0.07, -0.5], [0.48, 0.1, 0.25], this.clothMaterial, [0, -22, 0]);
      addPrimitive(root, 'box', 'Camp Shelter Base', [-0.48, 0.17, 0.38], [0.62, 0.28, 0.46], this.campMaterial, [0, 24, 0]);
      addPrimitive(root, 'box', 'Camp Shelter Canopy', [-0.48, 0.38, 0.38], [0.72, 0.1, 0.54], this.clothMaterial, [0, 24, 9]);
      addPrimitive(root, 'cylinder', 'Camp Fire Ring', [-0.15, 0.055, 0.63], [0.3, 0.05, 0.3], this.stoneLightMaterial);
      return;
    }

    if (poi.type === 'VILLAGE') {
      addPrimitive(root, 'box', 'Village Store', [-0.68, 0.2, -0.42], [0.48, 0.36, 0.42], this.timberMaterial, [0, 18, 0]);
      addPrimitive(root, 'box', 'Village Roof', [-0.68, 0.45, -0.42], [0.56, 0.12, 0.5], this.darkTimberMaterial, [0, 18, 8]);
      addPrimitive(root, 'box', 'Village Shed', [0.62, 0.17, 0.24], [0.4, 0.3, 0.35], this.villageMaterial, [0, -16, 0]);
      addPrimitive(root, 'box', 'Village Shed Roof', [0.62, 0.38, 0.24], [0.48, 0.1, 0.43], this.darkTimberMaterial, [0, -16, -8]);
      addPrimitive(root, 'box', 'Village Market Table', [0.05, 0.13, -0.7], [0.56, 0.12, 0.32], this.timberMaterial, [0, 7, 0]);
      addPrimitive(root, 'cylinder', 'Village Barrel', [0.86, 0.13, -0.34], [0.14, 0.24, 0.14], this.darkTimberMaterial);
      addPrimitive(root, 'box', 'Village Bench', [0.45, 0.11, -0.48], [0.46, 0.1, 0.16], this.timberMaterial, [0, -15, 0]);
      return;
    }

    addPrimitive(root, 'box', 'Ruin Fallen Column', [0.58, 0.1, 0.34], [0.22, 0.18, 0.78], this.ruinMaterial, [18, 32, 72]);
    addPrimitive(root, 'box', 'Ruin Broken Block A', [-0.55, 0.09, 0.44], [0.42, 0.18, 0.28], this.stoneLightMaterial, [8, 21, 11]);
    addPrimitive(root, 'box', 'Ruin Broken Block B', [0.48, 0.055, -0.5], [0.28, 0.11, 0.22], this.stoneBaseMaterial, [-4, -27, 6]);
    addPrimitive(root, 'box', 'Ruin Broken Wall', [-0.2, 0.22, -0.68], [0.7, 0.42, 0.16], this.ruinMaterial, [5, 12, 3]);
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const presentation = this.pick(event.clientX, event.clientY);
    this.hoveredPoiId = presentation?.poi.id ?? null;
    this.canvas.classList.toggle('poi-hover', presentation !== null);
    if (!presentation) {
      this.tooltip.hidden = true;
      return;
    }
    this.updateTooltipContent(presentation.poi.id);
    this.tooltip.hidden = false;
    this.tooltip.style.left = `${event.clientX + 14}px`;
    this.tooltip.style.top = `${event.clientY + 14}px`;
  };

  private readonly onPointerLeave = (): void => {
    this.hoveredPoiId = null;
    this.canvas.classList.remove('poi-hover');
    this.tooltip.hidden = true;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.canvas.classList.contains('build-placement-active')) return;
    const presentation = this.pick(event.clientX, event.clientY);
    if (!presentation) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const position = presentation.root.getPosition();
    this.camera.focusAt(position.x, position.z);
    this.hoveredPoiId = presentation.poi.id;
    this.updateTooltipContent(presentation.poi.id);
  };

  private pick(clientX: number, clientY: number): PoiPresentation | null {
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const screenX = ((clientX - bounds.left) / bounds.width) * this.canvas.width;
    const screenY = ((clientY - bounds.top) / bounds.height) * this.canvas.height;
    let best: PoiPresentation | null = null;
    let bestDistanceSquared = 30 * 30;
    for (const presentation of this.presentations.values()) {
      if (!presentation.root.enabled || !presentation.pickAnchor.enabled) continue;
      this.cameraComponent.worldToScreen(presentation.pickAnchor.getPosition(), this.screenPosition);
      if (this.screenPosition.z < 0) continue;
      const dx = this.screenPosition.x - screenX;
      const dy = this.screenPosition.y - screenY;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > bestDistanceSquared) continue;
      bestDistanceSquared = distanceSquared;
      best = presentation;
    }
    return best;
  }

  private updateTooltipContent(poiId: string): void {
    const presentation = this.presentations.get(poiId);
    if (!presentation) return;
    const profile = poiVisualProfile(presentation.poi.type);
    const ownership = poiOwnershipState(this.latestPoiOwners[poiId]);
    const status = ownership === 'PLAYER'
      ? 'Controlled · Influence already claimed'
      : ownership === 'ENEMY'
        ? 'Enemy controlled'
        : 'Unclaimed · Capture for +10 Influence';
    this.tooltip.textContent = `${profile.label} · Region ${presentation.poi.regionId + 1} · ${status} · Click to focus`;
  }

  private ownershipMaterial(ownership: PoiOwnershipState): pc.Material {
    if (ownership === 'PLAYER') return this.playerOwnershipMaterial;
    if (ownership === 'ENEMY') return this.enemyOwnershipMaterial;
    return this.neutralOwnershipMaterial;
  }

  private landmarkMaterial(type: PointOfInterest['type']): pc.Material {
    if (type === 'SHRINE') return this.shrineMaterial;
    if (type === 'NEUTRAL_CAMP') return this.campMaterial;
    if (type === 'VILLAGE') return this.villageMaterial;
    return this.ruinMaterial;
  }
}
