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
  private readonly environmentDetails: EnvironmentDetailLayer;

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
  private readonly timber = material(
    new pc.Color(0.27, 0.16, 0.075),
    new pc.Color(0.004, 0.002, 0.001),
    1,
    0.18,
    0.1,
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

  private readonly manaStone = material(
    new pc.Color(0.18, 0.2, 0.24),
    new pc.Color(0.008, 0.009, 0.018),
    1,
    0.3,
    0.2,
  );
  private readonly manaAccent = material(
    new pc.Color(0.34, 0.3, 0.58),
    new pc.Color(0.07, 0.035, 0.18),
    1,
    0.58,
    0.34,
  );
  private readonly manaCore = material(
    new pc.Color(0.48, 0.53, 0.72),
    new pc.Color(0.1, 0.11, 0.27),
    1,
    0.64,
    0.42,
  );
  private readonly manaPulse = material(
    new pc.Color(0.31, 0.27, 0.54),
    new pc.Color(0.07, 0.03, 0.18),
    0.08,
    0.38,
    0.06,
  );

  constructor(app: pc.Application, world: GeneratedWorld) {
    this.environmentDetails = new EnvironmentDetailLayer(app, world);
    for (const [index, resource] of world.resources.entries()) {
      const position = worldCellToSimulationPosition(world, resource.cell);
      const root = new pc.Entity(`${resource.type === 'MATERIAL' ? 'Material Deposit' : 'Mana Spring'} ${resource.id}`);
      root.setPosition(position.x / WORLD_UNITS_PER_METER, 0.025, position.z / WORLD_UNITS_PER_METER);
      const scale = resource.rich ? 1.18 : 1;

      primitive(root, 'cylinder', 'Resource Ground Footprint', [0, 0.028, 0], [1.16 * scale, 0.028, 1.0 * scale], this.groundFootprint);
      primitive(root, 'sphere', 'Resource Ground Stone A', [-0.77 * scale, 0.08, 0.2 * scale], [0.23 * scale, 0.12 * scale, 0.18 * scale], this.stoneDark);
      primitive(root, 'sphere', 'Resource Ground Stone B', [0.72 * scale, 0.07, -0.3 * scale], [0.19 * scale, 0.1 * scale, 0.15 * scale], this.stoneLight);
      primitive(root, 'sphere', 'Resource Ground Stone C', [0.26 * scale, 0.055, 0.74 * scale], [0.16 * scale, 0.08 * scale, 0.13 * scale], this.stoneDark);

      if (resource.type === 'MATERIAL') {
        primitive(root, 'sphere', 'Ore Outcrop A', [-0.23 * scale, 0.28 * scale, 0.02], [0.6 * scale, 0.44 * scale, 0.5 * scale], this.materialRock, [7, 18, 4]);
        primitive(root, 'sphere', 'Ore Outcrop B', [0.34 * scale, 0.22 * scale, -0.15 * scale], [0.48 * scale, 0.34 * scale, 0.4 * scale], this.stoneDark, [-5, -21, 8]);
        primitive(root, 'box', 'Ore Vein A', [-0.28 * scale, 0.43 * scale, 0.05], [0.16 * scale, 0.5 * scale, 0.14 * scale], this.materialOre, [12, 26, 16]);
        primitive(root, 'box', 'Ore Vein B', [0.22 * scale, 0.34 * scale, -0.16 * scale], [0.13 * scale, 0.4 * scale, 0.12 * scale], this.materialOre, [-8, -20, -11]);
        primitive(root, 'sphere', 'Ore Nodule', [0.35 * scale, 0.21 * scale, 0.23 * scale], [0.2 * scale, 0.14 * scale, 0.17 * scale], this.materialOre);
        primitive(root, 'cylinder', 'Mine Stake', [-0.64 * scale, 0.3 * scale, -0.4 * scale], [0.055 * scale, 0.55 * scale, 0.055 * scale], this.timber);
        primitive(root, 'box', 'Mine Crate', [-0.49 * scale, 0.13 * scale, -0.46 * scale], [0.28 * scale, 0.23 * scale, 0.25 * scale], this.timber, [0, 18, 0]);
        primitive(root, 'cylinder', 'Mine Gantry Left', [-0.63 * scale, 0.47 * scale, 0.38 * scale], [0.055 * scale, 0.82 * scale, 0.055 * scale], this.timber, [0, 0, -4]);
        primitive(root, 'cylinder', 'Mine Gantry Right', [0.58 * scale, 0.43 * scale, 0.35 * scale], [0.055 * scale, 0.74 * scale, 0.055 * scale], this.timber, [0, 0, 5]);
        primitive(root, 'box', 'Mine Gantry Beam', [-0.03 * scale, 0.78 * scale, 0.37 * scale], [1.3 * scale, 0.065 * scale, 0.075 * scale], this.timber, [0, 0, 2]);
        primitive(root, 'sphere', 'Ore Chip A', [-0.82 * scale, 0.055, -0.02], [0.13 * scale, 0.07 * scale, 0.1 * scale], this.materialOre);
        primitive(root, 'sphere', 'Ore Chip B', [0.74 * scale, 0.048, 0.23 * scale], [0.11 * scale, 0.06 * scale, 0.09 * scale], this.materialOre);
      } else {
        primitive(root, 'cylinder', 'Mana Stone Basin', [0, 0.085 * scale, 0], [0.88 * scale, 0.12 * scale, 0.88 * scale], this.manaStone);
        for (let ring = 0; ring < 4; ring += 1) {
          const angle = ring * Math.PI * 0.5 + 0.35;
          primitive(
            root,
            'box',
            `Mana Ring Stone ${ring + 1}`,
            [Math.cos(angle) * 0.7 * scale, 0.12 * scale, Math.sin(angle) * 0.7 * scale],
            [0.34 * scale, 0.18 * scale, 0.22 * scale],
            ring % 2 === 0 ? this.stoneDark : this.stoneLight,
            [5, ring * 27, ring % 2 === 0 ? 6 : -5],
          );
        }
        primitive(root, 'box', 'Mana Crystal A', [-0.23 * scale, 0.48 * scale, 0.04], [0.19 * scale, 0.78 * scale, 0.19 * scale], this.manaAccent, [0, 32, 10]);
        primitive(root, 'box', 'Mana Crystal B', [0.24 * scale, 0.4 * scale, -0.12 * scale], [0.16 * scale, 0.61 * scale, 0.16 * scale], this.manaAccent, [0, -26, -9]);
        primitive(root, 'box', 'Mana Crystal C', [0.07 * scale, 0.32 * scale, 0.28 * scale], [0.13 * scale, 0.47 * scale, 0.13 * scale], this.manaCore, [0, 10, 16]);
        primitive(root, 'box', 'Mana Shard A', [-0.46 * scale, 0.18 * scale, -0.25 * scale], [0.09 * scale, 0.27 * scale, 0.09 * scale], this.manaAccent, [0, 18, 22]);
        primitive(root, 'box', 'Mana Shard B', [0.47 * scale, 0.16 * scale, 0.31 * scale], [0.085 * scale, 0.24 * scale, 0.085 * scale], this.manaAccent, [0, -21, -16]);
        primitive(root, 'sphere', 'Mana Core', [0, 0.83 * scale, 0], [0.13 * scale, 0.13 * scale, 0.13 * scale], this.manaCore);
        primitive(root, 'box', 'Mana Outer Shard A', [-0.83 * scale, 0.18 * scale, 0.12], [0.08 * scale, 0.28 * scale, 0.08 * scale], this.manaAccent, [0, 21, 17]);
        primitive(root, 'box', 'Mana Outer Shard B', [0.72 * scale, 0.16 * scale, -0.46 * scale], [0.07 * scale, 0.24 * scale, 0.07 * scale], this.manaCore, [0, -17, -14]);
        primitive(root, 'box', 'Mana Outer Shard C', [0.35 * scale, 0.13 * scale, 0.74 * scale], [0.065 * scale, 0.2 * scale, 0.065 * scale], this.manaAccent, [0, 9, 20]);
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
    this.environmentDetails.sync(visibility);
    for (const [index, presentation] of this.entities.entries()) {
      const level = visibility?.[presentation.cellIndex] ?? VisibilityLevel.VISIBLE;
      presentation.root.enabled = level !== VisibilityLevel.UNEXPLORED;
      presentation.marker.enabled = level === VisibilityLevel.VISIBLE;
      const scale = resourcePulseScale(presentation.rich, tick, index);
      presentation.marker.setLocalScale(scale[0], scale[1], scale[2]);
    }
  }

  destroy(): void {
    this.environmentDetails.destroy();
    for (const entity of this.entities) entity.root.destroy();
    this.entities.length = 0;
    this.groundFootprint.destroy();
    this.stoneDark.destroy();
    this.stoneLight.destroy();
    this.timber.destroy();
    this.materialRock.destroy();
    this.materialOre.destroy();
    this.materialPulse.destroy();
    this.manaStone.destroy();
    this.manaAccent.destroy();
    this.manaCore.destroy();
    this.manaPulse.destroy();
  }
}
