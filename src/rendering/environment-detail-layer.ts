import * as pc from 'playcanvas';
import { VisibilityLevel } from '../simulation/visibility-state';
import type { GeneratedWorld } from '../world/world-definition';
import { EnvironmentAssetLibrary } from './environment-asset-library';
import { environmentPlacements, type EnvironmentPlacement } from './environment-placement-system';

interface Batch {
  entity: pc.Entity;
  mesh: pc.Mesh;
  colors: number[];
  placements: EnvironmentPlacement[];
  visible: boolean[];
  shadow: boolean;
}

/** Static, spatially batched atlas geometry. No per-object entities or per-frame
 * placement work. Each quad keeps its own cell visibility inside the batch.
 */
export class EnvironmentDetailLayer {
  private readonly assets: EnvironmentAssetLibrary;
  private readonly batches: Batch[] = [];
  private readonly shadowMaterial: pc.StandardMaterial;
  private visibility?: Uint8Array;
  private disposed = false;
  constructor(private readonly app: pc.Application, world: GeneratedWorld) {
    this.assets = new EnvironmentAssetLibrary(app);
    const low = new URLSearchParams(window.location.search).get('quality')?.toLowerCase() === 'low';
    const placements = environmentPlacements(world, low);
    this.shadowMaterial = new pc.StandardMaterial();
    this.shadowMaterial.name = 'Environment contact';
    this.shadowMaterial.useLighting = false;
    this.shadowMaterial.diffuse = new pc.Color(0.035, 0.045, 0.025);
    this.shadowMaterial.opacityVertexColor = true;
    this.shadowMaterial.blendType = pc.BLEND_NORMAL;
    this.shadowMaterial.depthWrite = false;
    this.shadowMaterial.cull = pc.CULLFACE_NONE;
    this.shadowMaterial.update();
    for (const sheet of ['trees', 'props'] as const) {
      void this.assets.load(sheet).then(material => {
        if (!material || this.disposed) return;
        const groups = new Map<string, EnvironmentPlacement[]>();
        for (const p of placements.filter(p => p.sheet === sheet)) {
          const key = `${Math.floor(p.x / 12)}:${Math.floor(p.z / 12)}`;
          const group = groups.get(key) ?? [];
          group.push(p); groups.set(key, group);
        }
        for (const group of groups.values()) {
          this.build(group, material, false);
          this.build(group, this.shadowMaterial, true);
        }
        this.sync(this.visibility);
      });
    }
  }

  sync(visibility?: Uint8Array): void {
    this.visibility = visibility;
    for (const batch of this.batches) {
      let dirty = false, any = false;
      for (let i = 0; i < batch.placements.length; i++) {
        const visible = (visibility?.[batch.placements[i]!.cell] ?? VisibilityLevel.UNEXPLORED) !== VisibilityLevel.UNEXPLORED;
        any ||= visible;
        if (batch.visible[i] === visible) continue;
        batch.visible[i] = visible; dirty = true;
        const count = batch.shadow ? 17 : 4;
        for (let v = 0; v < count; v++) batch.colors[(i * count + v) * 4 + 3] = visible ? (batch.shadow ? (v === 0 ? 82 : 0) : 255) : 0;
      }
      batch.entity.enabled = any;
      if (dirty) { batch.mesh.setColors32(batch.colors); batch.mesh.update(pc.PRIMITIVE_TRIANGLES); }
    }
  }

  destroy(): void {
    this.disposed = true;
    for (const batch of this.batches) { batch.entity.destroy(); batch.mesh.destroy(); }
    this.batches.length = 0;
    this.assets.destroy();
    this.shadowMaterial.destroy();
  }

  private build(placements: EnvironmentPlacement[], material: pc.Material, shadow: boolean): void {
    const positions: number[] = [], normals: number[] = [], uv: number[] = [], colors: number[] = [], indices: number[] = [];
    // Fixed camera yaw 45, pitch -48. Baked art has elevation, so upright cards
    // use a partial tilt for ground depth while retaining convincing tree height.
    const right = [Math.SQRT1_2, 0, -Math.SQRT1_2];
    const up = [-0.28, 0.918, -0.28];
    for (const p of placements) {
      const base = positions.length / 3;
      if (shadow) {
        positions.push(p.x, 0.019, p.z);
        normals.push(0, 1, 0); colors.push(255, 255, 255, 0); uv.push(0.5, 0.5);
        for (let v = 0; v < 16; v++) {
          const a = v / 16 * Math.PI * 2;
          positions.push(p.x + Math.cos(a) * p.width * 0.31, 0.019, p.z + Math.sin(a) * p.width * 0.23);
          normals.push(0, 1, 0); colors.push(255, 255, 255, 0); uv.push(0, 0);
          indices.push(base, base + 1 + v, base + 1 + (v + 1) % 16);
        }
      } else {
        const columns = p.sheet === 'trees' ? 3 : 4, rows = p.sheet === 'trees' ? 2 : 3;
        for (const [sx, sy] of [[-0.5, 0], [0.5, 0], [-0.5, 1], [0.5, 1]]) {
          // Small transparent bottom padding sits below the terrain contact point.
          const y = (sy! - 0.04) * p.height;
          positions.push(p.x + right[0]! * sx! * p.width + up[0]! * y, 0.025 + up[1]! * y, p.z + right[2]! * sx! * p.width + up[2]! * y);
          normals.push(0.65, 0.39, 0.65);
          const u = p.flip ? 0.5 - sx! : sx! + 0.5;
          uv.push((p.frame % columns + 0.008 + u * 0.984) / columns, 1 - (Math.floor(p.frame / columns) + 0.008 + (1 - sy!) * 0.984) / rows);
          colors.push(255, 255, 255, 0);
        }
        indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      }
    }
    const mesh = new pc.Mesh(this.app.graphicsDevice);
    mesh.setPositions(positions); mesh.setNormals(normals); mesh.setUvs(0, uv); mesh.setColors32(colors); mesh.setIndices(indices); mesh.update(pc.PRIMITIVE_TRIANGLES);
    const entity = new pc.Entity(shadow ? 'Environment contact batch' : `Environment ${placements[0]!.sheet} batch`);
    entity.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: false, receiveShadows: false });
    entity.enabled = false;
    this.app.root.addChild(entity);
    this.batches.push({ entity, mesh, colors, placements, visible: placements.map(() => false), shadow });
  }
}
