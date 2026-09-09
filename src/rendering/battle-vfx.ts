import * as pc from 'playcanvas';

type Tint = readonly [number, number, number];
interface Spark {
  x: number; y: number; z: number;
  dx: number; dy: number; dz: number;
  born: number; life: number; color: Tint; beam: boolean;
}

export const ELEMENT_TINTS = {
  FIRE: [1, .30, .035], WATER: [.08, .85, .75],
  ICE: [.64, .9, 1], LIGHTNING: [.77, .48, 1],
} as const;

/** Fixed-capacity transient buffer. All sparks and segmented arcs share one draw. */
export class BattleVfx {
  private readonly sparks: Spark[] = [];
  private readonly free: Spark[] = [];
  private readonly mesh: pc.Mesh;
  private readonly material = new pc.StandardMaterial();
  private readonly entity = new pc.Entity('Combat sparks and arcs');
  private readonly positions: Float32Array;
  private readonly colors: Uint8Array;
  private readonly capacity = 192;

  constructor(app: pc.Application) {
    this.positions = new Float32Array(this.capacity * 18);
    this.colors = new Uint8Array(this.capacity * 24);
    for (let i = 0; i < this.capacity; i++) this.free.push({ x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, born: 0, life: 1, color: [1, 1, 1], beam: false });
    this.material.useLighting = false;
    this.material.diffuse = new pc.Color(0, 0, 0);
    this.material.emissive = new pc.Color(1, 1, 1);
    this.material.emissiveVertexColor = true;
    this.material.opacityVertexColor = true;
    this.material.blendType = pc.BLEND_ADDITIVEALPHA;
    this.material.depthWrite = false;
    this.material.cull = pc.CULLFACE_NONE;
    this.material.update();
    this.mesh = new pc.Mesh(app.graphicsDevice);
    this.mesh.clear(true, false, this.capacity * 6);
    this.mesh.setPositions(this.positions);
    this.mesh.setColors32(this.colors);
    this.mesh.update(pc.PRIMITIVE_TRIANGLES);
    this.entity.addComponent('render', { meshInstances: [new pc.MeshInstance(this.mesh, this.material)], castShadows: false });
    this.entity.enabled = false;
    app.root.addChild(this.entity);
  }

  burst(x: number, y: number, z: number, color: Tint, tick: number, count = 8, force = 1): void {
    for (let i = 0; i < count && this.free.length; i++) {
      const spark = this.free.pop()!;
      const angle = i * 2.39996 + tick * .71;
      Object.assign(spark, { x, y, z, dx: Math.cos(angle) * force, dy: (.45 + (i % 3) * .3) * force, dz: Math.sin(angle) * force, born: tick, life: 5 + i % 4, color, beam: false });
      this.sparks.push(spark);
    }
  }

  bolt(start: pc.Vec3, end: pc.Vec3, tick: number): void {
    let prior = start.clone();
    for (let i = 1; i <= 7 && this.free.length; i++) {
      const t = i / 7;
      const next = new pc.Vec3().lerp(start, end, t);
      if (i < 7) { next.x += Math.sin(i * 17 + tick) * .26; next.y += Math.cos(i * 11) * .21; }
      const spark = this.free.pop()!;
      Object.assign(spark, { x: prior.x, y: prior.y, z: prior.z, dx: next.x - prior.x, dy: next.y - prior.y, dz: next.z - prior.z, born: tick, life: 2.5, color: ELEMENT_TINTS.LIGHTNING, beam: true });
      this.sparks.push(spark);
      prior = next;
    }
  }

  sync(tick: number, alpha: number): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i]!;
      if (tick + alpha - spark.born >= spark.life) {
        this.free.push(spark);
        this.sparks.splice(i, 1);
      }
    }
    this.entity.enabled = this.sparks.length > 0;
    if (!this.entity.enabled) return;
    let vertex = 0;
    for (const s of this.sparks) {
      const age = Math.max(0, tick + alpha - s.born) / s.life;
      const travel = s.beam ? 0 : age * 1.6;
      const x = s.x + s.dx * travel, y = s.y + s.dy * travel - (s.beam ? 0 : age * age * .65), z = s.z + s.dz * travel;
      const trail = s.beam ? 1 : -.14;
      const end = [x + s.dx * trail, y + s.dy * trail, z + s.dz * trail];
      const width = (s.beam ? .045 : .035) * (1 - age * .5);
      const points = [[x-width,y,z], [x+width,y,z], [end[0]!+width,end[1]!,end[2]!], [x-width,y,z], [end[0]!+width,end[1]!,end[2]!], [end[0]!-width,end[1]!,end[2]!]];
      for (const point of points) {
        this.positions.set(point, vertex * 3);
        this.colors.set([s.color[0]*255, s.color[1]*255, s.color[2]*255, (1-age)*255], vertex * 4);
        vertex++;
      }
    }
    this.mesh.setPositions(this.positions, 3, vertex);
    this.mesh.setColors32(this.colors, vertex);
    this.mesh.update(pc.PRIMITIVE_TRIANGLES);
  }

  destroy(): void {
    this.entity.destroy();
    this.mesh.destroy();
    this.material.destroy();
  }
}

/** Thin hollow ground marker; shared by selection and elemental ripples. */
export function ringMesh(device: pc.GraphicsDevice): pc.Mesh {
  return pc.createTorus(device, { ringRadius: .48, tubeRadius: .018, segments: 32, sides: 4 });
}
