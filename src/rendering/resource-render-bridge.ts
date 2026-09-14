import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { GeneratedWorld } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';

const RESOURCE_PULSE_BASE_SCALE = 0.68;
const RESOURCE_PULSE_HEIGHT = 0.018;

type PrimitiveType = 'box' | 'cylinder' | 'sphere';

function material(
  color: pc.Color,
  emissive: pc.Color,
  opacity = 1,
  emissiveIntensity = 0.78,
): pc.StandardMaterial {
  const result = new pc.StandardMaterial();
  result.diffuse = color;
  result.emissive = emissive;
  result.emissiveIntensity = emissiveIntensity;
  result.gloss = 0.32;
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

  private readonly groundFootprint = material(
    new pc.Color(0.2, 0.19, 0.14),
    new pc.Color(0.008, 0.006, 0.003),
    1,
    0.35,
  );
  private readonly rubble = material(
    new pc.Color(0.39, 0.37, 0.31),
    new pc.Color(0.008, 0.007, 0.005),
    1,
    0.25,
  );

  private readonly materialDeposit = material(
    new pc.Color(0.35, 0.27, 0.18),
    new pc.Color(0.025, 0.014, 0.005),
    1,
    0.45,
  );
  private readonly materialAccent = material(
    new pc.Color(0.82, 0.56, 0.21),
    new pc.Color(0.18, 0.075, 0.01),
    1,
    0.72,
  );
  private readonly materialPulse = material(
    new pc.Color(0.73, 0.46, 0.14),
    new pc.Color(0.16, 0.055, 0.008),
    0.14,
    0.55,
  );

  private readonly manaDeposit = material(
    new pc.Color(0.18, 0.21, 0.31),
    new pc.Color(0.018, 0.022, 0.07),
    1,
    0.55,
  );
  private readonly manaAccent = material(
    new pc.Color(0.43, 0.35, 0.76),
    new pc.Color(0.12, 0.055, 0.29),
    1,
    0.76,
  );
  private readonly manaCore = material(
    new pc.Color(0.58, 0.64, 0.88),
    new pc.Color(0.15, 0.17, 0.42),
    1,
    0.82,
  );
  private readonly manaPulse = material(
    new pc.Color(0.37, 0.29, 0.68),
    new pc.Color(0.11, 0.05, 0.3),
    0.14,
    0.58,
  );

  constructor(app: pc.Application, world: GeneratedWorld) {
    for (const [index, resource] of world.resources.entries()) {
      const position = worldCellToSimulationPosition(world, resource.cell);
      const root = new pc.Entity(`${resource.type === 'MATERIAL' ? 'Material Deposit' : 'Mana Spring'} ${resource.id}`);
      root.setPosition(position.x / WORLD_UNITS_PER_METER, 0.025, position.z / WORLD_UNITS_PER_METER);
      const scale = resource.rich ? 1.18 : 1;

      primitive(root, 'cylinder', 'Resource Ground Footprint', [0, 0.035, 0], [1.08 * scale, 0.035, 0.94 * scale], this.groundFootprint);
      primitive(root, 'sphere', 'Resource Rubble A', [-0.72 * scale, 0.08, 0.18 * scale], [0.2 * scale, 0.12 * scale, 0.16 * scale], this.rubble);
      primitive(root, 'sphere', 'Resource Rubble B', [0.68 * scale, 0.07, -0.28 * scale], [0.16 * scale, 0.1 * scale, 0.14 * scale], this.rubble);
      primitive(root, 'sphere', 'Resource Rubble C', [0.22 * scale, 0.06, 0.7 * scale], [0.14 * scale, 0.08 * scale, 0.12 * scale], this.rubble);

      if (resource.type === 'MATERIAL') {
        primitive(root, 'cylinder', 'Ore Basin', [0, 0.11 * scale, 0], [0.84 * scale, 0.16 * scale, 0.72 * scale], this.materialDeposit);
        primitive(root, 'box', 'Ore Chunk A', [-0.3 * scale, 0.46 * scale, 0.05], [0.46 * scale, 0.64 * scale, 0.38 * scale], this.materialAccent, [12, 28, 18]);
        primitive(root, 'box', 'Ore Chunk B', [0.24 * scale, 0.39 * scale, -0.16 * scale], [0.38 * scale, 0.53 * scale, 0.34 * scale], this.materialAccent, [-8, -18, -12]);
        primitive(root, 'sphere', 'Ore Nodule', [0.2 * scale, 0.27 * scale, 0.25 * scale], [0.34 * scale, 0.26 * scale, 0.3 * scale], this.materialAccent);
        primitive(root, 'box', 'Ore Chip A', [-0.48 * scale, 0.17 * scale, -0.34 * scale], [0.18 * scale, 0.22 * scale, 0.15 * scale], this.materialAccent, [4, 16, 20]);
        primitive(root, 'box', 'Ore Chip B', [0.45 * scale, 0.15 * scale, 0.33 * scale], [0.15 * scale, 0.2 * scale, 0.14 * scale], this.materialAccent, [-6, -24, 8]);
      } else {
        primitive(root, 'cylinder', 'Mana Basin', [0, 0.09 * scale, 0], [0.82 * scale, 0.14 * scale, 0.82 * scale], this.manaDeposit);
        primitive(root, 'box', 'Mana Crystal A', [-0.27 * scale, 0.45 * scale, 0.06], [0.22 * scale, 0.7 * scale, 0.22 * scale], this.manaAccent, [0, 35, 12]);
        primitive(root, 'box', 'Mana Crystal B', [0.24 * scale, 0.37 * scale, -0.14 * scale], [0.19 * scale, 0.56 * scale, 0.19 * scale], this.manaAccent, [0, -28, -10]);
        primitive(root, 'box', 'Mana Crystal C', [0.09 * scale, 0.31 * scale, 0.27 * scale], [0.16 * scale, 0.44 * scale, 0.16 * scale], this.manaAccent, [0, 12, 18]);
        primitive(root, 'box', 'Mana Shard A', [-0.48 * scale, 0.17 * scale, -0.28 * scale], [0.11 * scale, 0.24 * scale, 0.11 * scale], this.manaAccent, [0, 18, 24]);
        primitive(root, 'box', 'Mana Shard B', [0.48 * scale, 0.15 * scale, 0.32 * scale], [0.1 * scale, 0.21 * scale, 0.1 * scale], this.manaAccent, [0, -22, -18]);
        primitive(root, 'sphere', 'Mana Core', [0, 0.76 * scale, 0], [0.18 * scale, 0.18 * scale, 0.18 * scale], this.manaCore);
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
