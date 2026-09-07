import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { GeneratedWorld } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';

function material(color: pc.Color, emissive: pc.Color): pc.StandardMaterial {
  const result = new pc.StandardMaterial();
  result.diffuse = color;
  result.emissive = emissive;
  result.emissiveIntensity = 1.45;
  result.gloss = 0.4;
  result.update();
  return result;
}

function primitive(
  parent: pc.Entity,
  type: 'box' | 'cylinder' | 'sphere',
  name: string,
  y: number,
  scale: readonly [number, number, number],
  renderMaterial: pc.Material,
): void {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type, material: renderMaterial });
  entity.setLocalPosition(0, y, 0);
  entity.setLocalScale(scale[0], scale[1], scale[2]);
  parent.addChild(entity);
}

export class ResourceRenderBridge {
  private readonly entities: pc.Entity[] = [];
  private readonly materialDeposit = material(new pc.Color(0.72, 0.48, 0.18), new pc.Color(0.28, 0.11, 0.015));
  private readonly materialAccent = material(new pc.Color(0.98, 0.76, 0.3), new pc.Color(0.52, 0.25, 0.03));
  private readonly manaDeposit = material(new pc.Color(0.35, 0.25, 0.68), new pc.Color(0.16, 0.07, 0.42));
  private readonly manaAccent = material(new pc.Color(0.67, 0.48, 1), new pc.Color(0.34, 0.13, 0.72));

  constructor(app: pc.Application, world: GeneratedWorld) {
    for (const resource of world.resources) {
      const position = worldCellToSimulationPosition(world, resource.cell);
      const root = new pc.Entity(`${resource.type === 'MATERIAL' ? 'Material Deposit' : 'Mana Spring'} ${resource.id}`);
      root.setPosition(position.x / WORLD_UNITS_PER_METER, 0.025, position.z / WORLD_UNITS_PER_METER);
      const scale = resource.rich ? 1.2 : 1;
      if (resource.type === 'MATERIAL') {
        primitive(root, 'cylinder', 'Deposit Base', 0.16 * scale, [0.72 * scale, 0.24 * scale, 0.72 * scale], this.materialDeposit);
        primitive(root, 'sphere', 'Ore Marker', 0.58 * scale, [0.38 * scale, 0.48 * scale, 0.38 * scale], this.materialAccent);
      } else {
        primitive(root, 'cylinder', 'Mana Base', 0.12 * scale, [0.58 * scale, 0.18 * scale, 0.58 * scale], this.manaDeposit);
        primitive(root, 'box', 'Mana Crystal', 0.68 * scale, [0.28 * scale, 0.9 * scale, 0.28 * scale], this.manaAccent);
        root.setEulerAngles(0, 45, 0);
      }
      app.root.addChild(root);
      this.entities.push(root);
    }
  }

  destroy(): void {
    for (const entity of this.entities) entity.destroy();
    this.entities.length = 0;
    this.materialDeposit.destroy();
    this.materialAccent.destroy();
    this.manaDeposit.destroy();
    this.manaAccent.destroy();
  }
}
