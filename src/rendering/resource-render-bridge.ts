import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { GeneratedWorld } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';

const RESOURCE_PULSE_BASE_SCALE = 0.82;
const RESOURCE_PULSE_HEIGHT = 0.018;

type PrimitiveType = 'box' | 'cylinder' | 'sphere';

function material(color: pc.Color, emissive: pc.Color, opacity = 1): pc.StandardMaterial {
  const result = new pc.StandardMaterial();
  result.diffuse = color;
  result.emissive = emissive;
  result.emissiveIntensity = 1.45;
  result.gloss = 0.4;
  result.opacity = opacity;
  if (opacity < 1) {
    result.blendType = pc.BLEND_NORMAL;
    result.depthWrite = false;
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
  private readonly entities: { root: pc.Entity; marker: pc.Entity; rich: boolean }[] = [];
  private readonly groundFootprint = material(new pc.Color(0.19, 0.17, 0.12), new pc.Color(0.018, 0.012, 0.006));
  private readonly rubble = material(new pc.Color(0.37, 0.35, 0.29), new pc.Color(0.015, 0.012, 0.008));
  private readonly materialDeposit = material(new pc.Color(0.38, 0.29, 0.19), new pc.Color(0.08, 0.045, 0.012));
  private readonly materialAccent = material(new pc.Color(0.98, 0.69, 0.22), new pc.Color(0.52, 0.22, 0.025));
  private readonly materialPulse = material(new pc.Color(0.94, 0.58, 0.14), new pc.Color(0.5, 0.2, 0.02), 0.2);
  private readonly manaDeposit = material(new pc.Color(0.17, 0.2, 0.34), new pc.Color(0.045, 0.055, 0.16));
  private readonly manaAccent = material(new pc.Color(0.56, 0.43, 1), new pc.Color(0.27, 0.12, 0.72));
  private readonly manaCore = material(new pc.Color(0.7, 0.76, 1), new pc.Color(0.22, 0.25, 0.85));
  private readonly manaPulse = material(new pc.Color(0.48, 0.34, 1), new pc.Color(0.25, 0.11, 0.72), 0.2);

  constructor(app: pc.Application, world: GeneratedWorld) {
    for (const [index, resource] of world.resources.entries()) {
      const position = worldCellToSimulationPosition(world, resource.cell);
      const root = new pc.Entity(`${resource.type === 'MATERIAL' ? 'Material Deposit' : 'Mana Spring'} ${resource.id}`);
      root.setPosition(position.x / WORLD_UNITS_PER_METER, 0.025, position.z / WORLD_UNITS_PER_METER);
      const scale = resource.rich ? 1.18 : 1;

      primitive(root, 'cylinder', 'Resource Ground Footprint', [0, 0.035, 0], [1.05 * scale, 0.035, 0.92 * scale], this.groundFootprint);
      primitive(root, 'sphere', 'Resource Rubble A', [-0.72 * scale, 0.08, 0.18 * scale], [0.2 * scale, 0.12 * scale, 0.16 * scale], this.rubble);
      primitive(root, 'sphere', 'Resource Rubble B', [0.68 * scale, 0.07, -0.28 * scale], [0.16 * scale, 0.1 * scale, 0.14 * scale], this.rubble);
      primitive(root, 'sphere', 'Resource Rubble C', [0.22 * scale, 0.06, 0.7 * scale], [0.14 * scale, 0.08 * scale, 0.12 * scale], this.rubble);

      if (resource.type === 'MATERIAL') {
        primitive(root, 'cylinder', 'Ore Basin', [0, 0.11 * scale, 0], [0.82 * scale, 0.16 * scale, 0.7 * scale], this.materialDeposit);
        primitive(root, 'box', 'Ore Chunk A', [-0.3 * scale, 0.48 * scale, 0.05], [0.46 * scale, 0.68 * scale, 0.38 * scale], this.materialAccent, [12, 28, 18]);
        primitive(root, 'box', 'Ore Chunk B', [0.24 * scale, 0.4 * scale, -0.16 * scale], [0.38 * scale, 0.56 * scale, 0.34 * scale], this.materialAccent, [-8, -18, -12]);
        primitive(root, 'sphere', 'Ore Nodule', [0.2 * scale, 0.27 * scale, 0.25 * scale], [0.34 * scale, 0.26 * scale, 0.3 * scale], this.materialAccent);
        primitive(root, 'box', 'Ore Chip A', [-0.48 * scale, 0.17 * scale, -0.34 * scale], [0.18 * scale, 0.22 * scale, 0.15 * scale], this.materialAccent, [4, 16, 20]);
        primitive(root, 'box', 'Ore Chip B', [0.45 * scale, 0.15 * scale, 0.33 * scale], [0.15 * scale, 0.2 * scale, 0.14 * scale], this.materialAccent, [-6, -24, 8]);
      } else {
        primitive(root, 'cylinder', 'Mana Basin', [0, 0.09 * scale, 0], [0.8 * scale, 0.14 * scale, 0.8 * scale], this.manaDeposit);
        primitive(root, 'box', 'Mana Crystal A', [-0.27 * scale, 0.48 * scale, 0.06], [0.22 * scale, 0.78 * scale, 0.22 * scale], this.manaAccent, [0, 35, 12]);
        primitive(root, 'box', 'Mana Crystal B', [0.24 * scale, 0.39 * scale, -0.14 * scale], [0.19 * scale, 0.62 * scale, 0.19 * scale], this.manaAccent, [0, -28, -10]);
        primitive(root, 'box', 'Mana Crystal C', [0.09 * scale, 0.32 * scale, 0.27 * scale], [0.16 * scale, 0.48 * scale, 0.16 * scale], this.manaAccent, [0, 12, 18]);
        primitive(root, 'box', 'Mana Shard A', [-0.48 * scale, 0.17 * scale, -0.28 * scale], [0.11 * scale, 0.26 * scale, 0.11 * scale], this.manaAccent, [0, 18, 24]);
        primitive(root, 'box', 'Mana Shard B', [0.48 * scale, 0.15 * scale, 0.32 * scale], [0.1 * scale, 0.22 * scale, 0.1 * scale], this.manaAccent, [0, -22, -18]);
        primitive(root, 'sphere', 'Mana Core', [0, 0.9 * scale, 0], [0.2 * scale, 0.2 * scale, 0.2 * scale], this.manaCore);
      }

      const marker = primitive(
        root,
        'cylinder',
        'Resource Pulse',
        [0, 0.022, 0],
        [1, RESOURCE_PULSE_HEIGHT, 1],
        resource.type === 'MATERIAL' ? this.materialPulse : this.manaPulse,
      );
      const initialPulseScale = resourcePulseScale(resource.rich, 0, index);
      marker.setLocalScale(initialPulseScale[0], initialPulseScale[1], initialPulseScale[2]);
      app.root.addChild(root);
      this.entities.push({ root, marker, rich: resource.rich });
    }
  }

  sync(tick: number): void {
    for (const [index, presentation] of this.entities.entries()) {
      const scale = resourcePulseScale(presentation.rich, tick, index);
      presentation.marker.setLocalScale(scale[0], scale[1], scale[2]);
    }
  }

  destroy(): void {
    for (const entity of this.entities) entity.root.destroy();
    this.entities.length = 0;
    this.groundFootprint.destroy();
    this.rubble.destroy();
    this.materialDeposit.destroy();
    this.materialAccent.destroy();
    this.materialPulse.destroy();
    this.manaDeposit.destroy();
    this.manaAccent.destroy();
    this.manaCore.destroy();
    this.manaPulse.destroy();
  }
}
