import * as pc from 'playcanvas';
import type { VisibilityState } from '../simulation/visibility-state';
import type { GeneratedWorld } from '../world/world-definition';
import { fogCornerAlpha, visibilityFingerprint } from './fog-visual-state';

function worldOrigin(cellCount: number): number {
  return -Math.floor(cellCount / 2);
}

export class FogOfWarRenderBridge {
  private readonly mesh: pc.Mesh;
  private readonly material: pc.StandardMaterial;
  private readonly entity: pc.Entity;
  private lastFingerprint = -1;

  constructor(
    app: pc.Application,
    private readonly world: GeneratedWorld,
    private readonly visibility: VisibilityState,
  ) {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const originX = worldOrigin(world.width);
    const originZ = worldOrigin(world.height);
    const columns = world.width + 1;

    for (let z = 0; z <= world.height; z += 1) {
      for (let x = 0; x <= world.width; x += 1) {
        positions.push(originX + x, 0.092, originZ + z);
        normals.push(0, 1, 0);
      }
    }
    for (let z = 0; z < world.height; z += 1) {
      for (let x = 0; x < world.width; x += 1) {
        const topLeft = z * columns + x;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + columns;
        const bottomRight = bottomLeft + 1;
        indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
      }
    }

    this.mesh = new pc.Mesh(app.graphicsDevice);
    this.mesh.setPositions(positions);
    this.mesh.setNormals(normals);
    this.mesh.setIndices(indices);
    this.mesh.setColors32(new Array((world.width + 1) * (world.height + 1) * 4).fill(0));
    this.mesh.update(pc.PRIMITIVE_TRIANGLES, false);

    this.material = new pc.StandardMaterial();
    this.material.name = 'FOG_OF_WAR';
    this.material.diffuse = new pc.Color(1, 1, 1);
    this.material.diffuseVertexColor = true;
    this.material.emissive = new pc.Color(1, 1, 1);
    this.material.emissiveVertexColor = true;
    this.material.useLighting = false;
    this.material.opacityVertexColor = true;
    this.material.blendType = pc.BLEND_NORMAL;
    this.material.depthWrite = false;
    this.material.cull = pc.CULLFACE_NONE;
    this.material.update();

    this.entity = new pc.Entity('Battlefield Fog of War');
    this.entity.addComponent('render', {
      meshInstances: [new pc.MeshInstance(this.mesh, this.material)],
      castShadows: false,
      receiveShadows: false,
    });
    app.root.addChild(this.entity);
    this.sync();
  }

  sync(): void {
    const cells = this.visibility.cellsForPlayer(0);
    if (!cells) return;
    const fingerprint = visibilityFingerprint(cells);
    if (fingerprint === this.lastFingerprint) return;
    this.lastFingerprint = fingerprint;

    const colors: number[] = [];
    for (let z = 0; z <= this.world.height; z += 1) {
      for (let x = 0; x <= this.world.width; x += 1) {
        const alpha = fogCornerAlpha(cells, this.world.width, this.world.height, x, z);
        const exploredBlend = alpha / 255;
        colors.push(
          Math.round(7 + exploredBlend * 2),
          Math.round(18 + exploredBlend * 5),
          Math.round(21 + exploredBlend * 7),
          alpha,
        );
      }
    }
    this.mesh.setColors32(colors);
    this.mesh.update(pc.PRIMITIVE_TRIANGLES, false);
  }

  destroy(): void {
    this.entity.destroy();
    this.mesh.destroy();
    this.material.destroy();
  }
}
