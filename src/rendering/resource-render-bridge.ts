import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import { VisibilityLevel } from '../simulation/visibility-state';
import type { GeneratedWorld } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';
import { EnvironmentDetailLayer } from './environment-detail-layer';

const RESOURCE_PULSE_BASE_SCALE = 0.68;
const RESOURCE_PULSE_HEIGHT = 0.018;

type PrimitiveType = 'box' | 'cylinder' | 'sphere';

function material(
  color: pc.Color,
  emissive: pc.Color,
  opacity = 1,
  emissiveIntensity = 0.5,
  gloss = 0.24,
): pc.StandardMaterial {
  const result = new pc.StandardMaterial();
  result.diffuse = color;
  result.emissive = emissive;
  result.emissiveIntensity = emissiveIntensity;
  result.gloss = gloss;
  result.metalness = 0;
  result.opacity = opacity;
  if (opacity < 1) {
    result.blendType = pc.BLEND_NORMAL;
    result.depthWrite = false;
    result.cull = pc.CULLFACE_NONE;
  }
  result.update();
  return result;
}

function primitive(
  parent: pc.Entity,
  type: PrimitiveType,
  name: string,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  renderMaterial: pc.Material,
  rotation: readonly [number, number, number] = [0, 0, 0],
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', {
    type,
    material: renderMaterial,
    castShadows: false,
    receiveShadows: false,
  });
  entity.setLocalPosition(position[0], position[1], position[2]);
  entity.setLocalScale(scale[0], scale[1], scale[2]);
  entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
  parent.addChild(entity);
  return entity;
}

export function resourcePulseScale(rich: boolean, tick: number, index: number): readonly [number, number, number] {
  const pulse = 1 + Math.sin(tick * 0.14 + index * 1.7) * (rich ? 0.1 : 0.055);
  const footprint = RESOURCE_PULSE_BASE_SCALE * (rich ? 1.2 : 1) * pulse;
  return [footprint, RESOURCE_PULSE_HEIGHT, footprint];
}

export class ResourceRenderBridge {
  private readonly entities: { root: pc.Entity; marker: pc.Entity; rich: boolean; cellIndex: number }[] = [];
  private environmentDetails: EnvironmentDetailLayer | null = null;
  private latestVisibility: Uint8Array | undefined;
  private disposed = false;

  private readonly groundFootprint = material(
    new pc.Color(0.17, 0.16, 0.12),
    new pc.Color(0.004, 0.003, 0.002),
    1,
    0.2,
    0.1,
  );
  private readonly stoneDark = material(
    new pc.Color(0.27, 0.27, 0.24),
    new pc.Color(0.004, 0.004, 0.003),
    1,
    0.18,
    0.16,
  );
  private readonly stoneLight = material(
    new pc.Color(0.4, 0.39, 0.34),
    new pc.Color(0.006, 0.005, 0.004),
    1,
    0.18,
    0.18,
  );
  private readonly materialRock = material(
    new pc.Color(0.33, 0.29, 0.23),
    new pc.Color(0.008, 0.006, 0.004),
    1,
    0.24,
    0.17,
  );
  private readonly materialOre = material(
    new pc.Color(0.64, 0.43, 0.16),
    new pc.Color(0.09, 0.035, 0.004),
    1,
    0.5,
    0.38,
  );
  private readonly materialPulse = material(
    new pc.Color(0.58, 0.38, 0.13),
    new pc.Color(0.09, 0.03, 0.004),
    0.08,
    0.34,
    0.06,
  );

  private readonly manaPulse = material(
    new pc.Color(0.24, 0.28, 0.42),
    new pc.Color(0.025, 0.035, 0.08),
    0.08,
    0.28,
    0.06,
  );

  constructor(app: pc.Application, world: GeneratedWorld) {
    // Forest/prop dressing is presentation-only and can be relatively expensive
    // to place/batch on large generated maps. Let terrain, units and controls
    // become interactive first, then add environmental dressing shortly after.
    window.setTimeout(() => {
      if (this.disposed) return;
      this.environmentDetails = new EnvironmentDetailLayer(app, world);
      this.environmentDetails.sync(this.latestVisibility);
    }, 500);
    for (const [index, resource] of world.resources.entries()) {
      const position = worldCellToSimulationPosition(world, resource.cell);
      const root = new pc.Entity(`${resource.type === 'MATERIAL' ? 'Material Deposit' : 'Mana Spring'} ${resource.id}`);
      root.setPosition(position.x / WORLD_UNITS_PER_METER, 0.025, position.z / WORLD_UNITS_PER_METER);
      const scale = resource.rich ? 1.18 : 1;

      primitive(root, 'cylinder', 'Resource Disturbed Ground A', [0, 0.012, 0], [1.65 * scale, 0.015, 1.36 * scale], this.groundFootprint);
      primitive(root, 'cylinder', 'Resource Disturbed Ground B', [0.48 * scale, 0.014, -0.36 * scale], [0.76 * scale, 0.013, 0.52 * scale], this.groundFootprint, [0, 18, 0]);
      primitive(root, 'cylinder', 'Resource Ground Footprint', [0, 0.028, 0], [1.16 * scale, 0.028, 1.0 * scale], this.groundFootprint);
      primitive(root, 'sphere', 'Resource Ground Stone A', [-0.77 * scale, 0.08, 0.2 * scale], [0.23 * scale, 0.12 * scale, 0.18 * scale], this.stoneDark);
      primitive(root, 'sphere', 'Resource Ground Stone B', [0.72 * scale, 0.07, -0.3 * scale], [0.19 * scale, 0.1 * scale, 0.15 * scale], this.stoneLight);
      primitive(root, 'sphere', 'Resource Ground Stone C', [0.26 * scale, 0.055, 0.74 * scale], [0.16 * scale, 0.08 * scale, 0.13 * scale], this.stoneDark);

      if (resource.type === 'MATERIAL') {
        primitive(root, 'sphere', 'Ore Outcrop A', [-0.23 * scale, 0.28 * scale, 0.02], [0.6 * scale, 0.44 * scale, 0.5 * scale], this.materialRock, [7, 18, 4]);
        primitive(root, 'sphere', 'Ore Outcrop B', [0.34 * scale, 0.22 * scale, -0.15 * scale], [0.48 * scale, 0.34 * scale, 0.4 * scale], this.stoneDark, [-5, -21, 8]);
        primitive(root, 'sphere', 'Ore Nodule', [0.35 * scale, 0.21 * scale, 0.23 * scale], [0.2 * scale, 0.14 * scale, 0.17 * scale], this.materialOre);
        primitive(root, 'sphere', 'Ore Chip A', [-0.82 * scale, 0.055, -0.02], [0.13 * scale, 0.07 * scale, 0.1 * scale], this.materialOre);
        primitive(root, 'sphere', 'Ore Chip B', [0.74 * scale, 0.048, 0.23 * scale], [0.11 * scale, 0.06 * scale, 0.09 * scale], this.materialOre);
      } else {
        // Mana remains readable through the subdued pulse and the atlas shrub
        // accent. The former stacked purple/black box kit read as placeholder
        // geometry from the elevated camera.
      }

      const marker = primitive(
        root,
        'cylinder',
        'Resource Pulse',
        [0, 0.018, 0],
        [1, RESOURCE_PULSE_HEIGHT, 1],
        resource.type === 'MATERIAL' ? this.materialPulse : this.manaPulse,
      );
      const initialPulseScale = resourcePulseScale(resource.rich, 0, index);
      marker.setLocalScale(initialPulseScale[0], initialPulseScale[1], initialPulseScale[2]);
      app.root.addChild(root);
      this.entities.push({
        root,
        marker,
        rich: resource.rich,
        cellIndex: resource.cell.z * world.width + resource.cell.x,
      });
    }
  }

  sync(tick: number, visibility?: Uint8Array): void {
    this.latestVisibility = visibility;
    this.environmentDetails?.sync(visibility);
    for (const [index, presentation] of this.entities.entries()) {
      const level = visibility?.[presentation.cellIndex] ?? VisibilityLevel.VISIBLE;
      presentation.root.enabled = level !== VisibilityLevel.UNEXPLORED;
      presentation.marker.enabled = level === VisibilityLevel.VISIBLE;
      const scale = resourcePulseScale(presentation.rich, tick, index);
      presentation.marker.setLocalScale(scale[0], scale[1], scale[2]);
    }
  }

  destroy(): void {
    this.disposed = true;
    this.environmentDetails?.destroy();
    this.environmentDetails = null;
    for (const entity of this.entities) entity.root.destroy();
    this.entities.length = 0;
    this.groundFootprint.destroy();
    this.stoneDark.destroy();
    this.stoneLight.destroy();
    this.materialRock.destroy();
    this.materialOre.destroy();
    this.materialPulse.destroy();
    this.manaPulse.destroy();
  }
}
