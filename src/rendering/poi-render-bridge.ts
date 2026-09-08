import * as pc from 'playcanvas';
import type { RtsCamera } from './rts-camera';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
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

function createMaterial(color: pc.Color, emissive?: pc.Color, opacity = 1): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.gloss = 0.42;
  material.metalness = 0.04;
  material.opacity = opacity;
  if (opacity < 1) material.blendType = pc.BLEND_NORMAL;
  if (emissive) {
    material.emissive = emissive;
    material.emissiveIntensity = 1.35;
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
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type, material });
  entity.setLocalPosition(position[0], position[1], position[2]);
  entity.setLocalScale(scale[0], scale[1], scale[2]);
  parent.addChild(entity);
  return entity;
}

export class PoiRenderBridge {
  private readonly presentations = new Map<string, PoiPresentation>();
  private readonly screenPosition = new pc.Vec3();
  private readonly neutralOwnershipMaterial = createMaterial(
    new pc.Color(0.76, 0.78, 0.72),
    new pc.Color(0.16, 0.17, 0.14),
  );
  private readonly playerOwnershipMaterial = createMaterial(
    new pc.Color(0.2, 0.82, 0.7),
    new pc.Color(0.03, 0.5, 0.4),
  );
  private readonly enemyOwnershipMaterial = createMaterial(
    new pc.Color(0.92, 0.29, 0.23),
    new pc.Color(0.5, 0.04, 0.025),
  );
  private readonly shrineMaterial = createMaterial(
    new pc.Color(0.62, 0.46, 0.9),
    new pc.Color(0.27, 0.12, 0.55),
  );
  private readonly campMaterial = createMaterial(
    new pc.Color(0.66, 0.42, 0.19),
    new pc.Color(0.22, 0.08, 0.02),
  );
  private readonly villageMaterial = createMaterial(
    new pc.Color(0.78, 0.7, 0.5),
    new pc.Color(0.18, 0.13, 0.06),
  );
  private readonly ruinMaterial = createMaterial(
    new pc.Color(0.5, 0.51, 0.48),
    new pc.Color(0.12, 0.12, 0.11),
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

  sync(snapshot: StrategicSnapshot): void {
    this.latestPoiOwners = snapshot.poiOwners;
    for (const presentation of this.presentations.values()) {
      const ownership = poiOwnershipState(snapshot.poiOwners[presentation.poi.id]);
      if (ownership === presentation.ownership) continue;
      presentation.ownership = ownership;
      const material = this.ownershipMaterial(ownership);
      if (presentation.ownershipBase.render) presentation.ownershipBase.render.material = material;
      if (presentation.beacon.render) presentation.beacon.render.material = material;
    }
    if (this.hoveredPoiId !== null) this.updateTooltipContent(this.hoveredPoiId);
  }

  destroy(): void {
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.tooltip.remove();
    for (const presentation of this.presentations.values()) presentation.root.destroy();
    this.presentations.clear();
    this.neutralOwnershipMaterial.destroy();
    this.playerOwnershipMaterial.destroy();
    this.enemyOwnershipMaterial.destroy();
    this.shrineMaterial.destroy();
    this.campMaterial.destroy();
    this.villageMaterial.destroy();
    this.ruinMaterial.destroy();
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
    const ownershipBase = addPrimitive(
      root,
      'cylinder',
      `${profile.label} Ownership Ring`,
      [0, 0.055, 0],
      [1.18, 0.055, 1.18],
      this.neutralOwnershipMaterial,
    );
    const beacon = addPrimitive(
      root,
      'sphere',
      `${profile.label} Beacon`,
      [0, 1.95, 0],
      [0.22, 0.22, 0.22],
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
