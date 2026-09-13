import * as pc from 'playcanvas';

type Tint = readonly [number, number, number];
type SparkFlavor = 'GENERIC' | 'FIRE' | 'WATER' | 'ICE' | 'LIGHTNING';

interface Spark {
  x: number; y: number; z: number;
  dx: number; dy: number; dz: number;
  born: number; life: number; color: Tint; beam: boolean;
  width: number; speed: number; gravity: number; trail: number; fadePower: number;
}

export const ELEMENT_TINTS = {
  FIRE: [1, .30, .035], WATER: [.08, .85, .75],
  ICE: [.64, .9, 1], LIGHTNING: [.77, .48, 1],
} as const;

function sameTint(left: Tint, right: Tint): boolean {
  return Math.abs(left[0] - right[0]) < .001
    && Math.abs(left[1] - right[1]) < .001
    && Math.abs(left[2] - right[2]) < .001;
}

function flavorFor(color: Tint): SparkFlavor {
  if (sameTint(color, ELEMENT_TINTS.FIRE)) return 'FIRE';
  if (sameTint(color, ELEMENT_TINTS.WATER)) return 'WATER';
  if (sameTint(color, ELEMENT_TINTS.ICE)) return 'ICE';
  if (sameTint(color, ELEMENT_TINTS.LIGHTNING)) return 'LIGHTNING';
  return 'GENERIC';
}

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
    for (let i = 0; i < this.capacity; i++) {
      this.free.push({
        x: 0, y: 0, z: 0,
        dx: 0, dy: 0, dz: 0,
        born: 0, life: 1, color: [1, 1, 1], beam: false,
        width: .035, speed: 1.6, gravity: .65, trail: .14, fadePower: 1,
      });
    }
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
    const flavor = flavorFor(color);
    for (let i = 0; i < count && this.free.length; i++) {
      const spark = this.free.pop()!;
      const angle = i * 2.39996 + tick * .71;
      const radialVariation = .72 + (i % 4) * .11;
      let speed = 1.55;
      let vertical = .45 + (i % 3) * .3;
      let life = 5 + i % 4;
      let width = .035 + (i % 2) * .009;
      let gravity = .65;
      let trail = .14;
      let fadePower = 1;

      if (flavor === 'FIRE') {
        speed = 1.35 + (i % 3) * .16;
        vertical = .68 + (i % 4) * .24;
        life = 6 + i % 4;
        width = .045 + (i % 2) * .012;
        gravity = .42;
        trail = .23;
        fadePower = .78;
      } else if (flavor === 'WATER') {
        speed = 1.8 + (i % 3) * .14;
        vertical = .28 + (i % 4) * .2;
        life = 4 + i % 3;
        width = .04 + (i % 2) * .008;
        gravity = .82;
        trail = .12;
        fadePower = 1.2;
      } else if (flavor === 'ICE') {
        speed = 1.45 + (i % 4) * .14;
        vertical = .62 + (i % 3) * .28;
        life = 5 + i % 3;
        width = .048 + (i % 2) * .012;
        gravity = .35;
        trail = .28;
        fadePower = .9;
      } else if (flavor === 'LIGHTNING') {
        speed = 2.1;
        vertical = .3 + (i % 2) * .18;
        life = 2.5 + (i % 2) * .5;
        width = .05;
        gravity = .08;
        trail = .2;
        fadePower = 1.6;
      }

      Object.assign(spark, {
        x, y, z,
        dx: Math.cos(angle) * force * radialVariation,
        dy: vertical * force,
        dz: Math.sin(angle) * force * radialVariation,
        born: tick,
        life,
        color,
        beam: false,
        width,
        speed,
        gravity,
        trail,
        fadePower,
      });
      this.sparks.push(spark);
    }

    // Elemental impacts get a restrained, deterministic ground flash so the
    // effect reads clearly from the elevated RTS camera without adding a new draw call.
    if (flavor !== 'GENERIC') {
      const spokes = flavor === 'LIGHTNING' ? 4 : 6;
      const radius = flavor === 'WATER' ? .58 : flavor === 'FIRE' ? .48 : .42;
      for (let i = 0; i < spokes && this.free.length; i++) {
        const spark = this.free.pop()!;
        const angle = (i / spokes) * Math.PI * 2 + tick * .17;
        Object.assign(spark, {
          x,
          y: Math.max(.045, y * .38),
          z,
          dx: Math.cos(angle) * radius,
          dy: 0,
          dz: Math.sin(angle) * radius,
          born: tick,
          life: flavor === 'LIGHTNING' ? 1.35 : 1.8,
          color,
          beam: true,
          width: flavor === 'LIGHTNING' ? .055 : .038,
          speed: 0,
          gravity: 0,
          trail: 1,
          fadePower: 1.35,
        });
        this.sparks.push(spark);
      }
    }
  }

  bolt(start: pc.Vec3, end: pc.Vec3, tick: number): void {
    let prior = start.clone();
    for (let i = 1; i <= 7 && this.free.length; i++) {
      const t = i / 7;
      const next = new pc.Vec3().lerp(start, end, t);
      if (i < 7) {
        next.x += Math.sin(i * 17 + tick) * .26;
        next.y += Math.cos(i * 11 + tick * .31) * .21;
        next.z += Math.sin(i * 13 + tick * .47) * .08;
      }
      const dx = next.x - prior.x;
      const dy = next.y - prior.y;
      const dz = next.z - prior.z;

      // Wide low-alpha-like halo first, then a narrow bright core. Both live in
      // the same fixed mesh, so chain lightning gains depth without another draw call.
      const halo = this.free.pop()!;
      Object.assign(halo, {
        x: prior.x, y: prior.y, z: prior.z,
        dx, dy, dz,
        born: tick, life: 2.2,
        color: [0.3, 0.62, 1] as Tint,
        beam: true,
        width: .082,
        speed: 0,
        gravity: 0,
        trail: 1,
        fadePower: 1.7,
      });
      this.sparks.push(halo);

      if (this.free.length) {
        const core = this.free.pop()!;
        Object.assign(core, {
          x: prior.x, y: prior.y, z: prior.z,
          dx, dy, dz,
          born: tick, life: 2.55,
          color: [0.82, 0.94, 1] as Tint,
          beam: true,
          width: .034,
          speed: 0,
          gravity: 0,
          trail: 1,
          fadePower: 1.35,
        });
        this.sparks.push(core);
      }
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
      const age = Math.max(0, Math.min(1, (tick + alpha - s.born) / s.life));
      const travel = s.beam ? 0 : age * s.speed * (1 - age * .12);
      const x = s.x + s.dx * travel;
      const y = s.y + s.dy * travel - (s.beam ? 0 : age * age * s.gravity);
      const z = s.z + s.dz * travel;
      const trail = s.beam ? 1 : -s.trail;
      const end = [x + s.dx * trail, y + s.dy * trail, z + s.dz * trail];
      const width = s.width * (1 - age * .58);
      const points = [
        [x - width, y, z], [x + width, y, z], [end[0]! + width, end[1]!, end[2]!],
        [x - width, y, z], [end[0]! + width, end[1]!, end[2]!], [end[0]! - width, end[1]!, end[2]!],
      ];
      const opacity = Math.max(0, Math.min(255, Math.pow(1 - age, s.fadePower) * 255));
      for (const point of points) {
        this.positions.set(point, vertex * 3);
        this.colors.set([
          Math.round(s.color[0] * 255),
          Math.round(s.color[1] * 255),
          Math.round(s.color[2] * 255),
          Math.round(opacity),
        ], vertex * 4);
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
