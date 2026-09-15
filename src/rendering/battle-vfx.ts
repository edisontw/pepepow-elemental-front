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

const ELEMENT_ACCENTS = {
  FIRE: [1, .72, .12],
  WATER: [.58, .96, 1],
  ICE: [.88, .98, 1],
  LIGHTNING: [.88, .95, 1],
} as const satisfies Record<Exclude<SparkFlavor, 'GENERIC'>, Tint>;

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

function brighten(color: Tint, amount: number): Tint {
  return [
    color[0] + (1 - color[0]) * amount,
    color[1] + (1 - color[1]) * amount,
    color[2] + (1 - color[2]) * amount,
  ];
}

/** Fixed-capacity transient buffer. All sparks, impact signatures, and segmented arcs share one draw. */
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
      const angle = i * 2.39996 + tick * .71;
      const radialVariation = .72 + (i % 4) * .11;
      let speed = 1.55;
      let vertical = .45 + (i % 3) * .3;
      let life = 5 + i % 4;
      let width = .035 + (i % 2) * .009;
      let gravity = .65;
      let trail = .14;
      let fadePower = 1;
      let sparkColor: Tint = color;

      if (flavor === 'FIRE') {
        speed = 1.30 + (i % 3) * .18;
        vertical = .74 + (i % 4) * .24;
        life = 6 + i % 4;
        width = .047 + (i % 2) * .013;
        gravity = .38;
        trail = .26;
        fadePower = .76;
        if (i % 3 === 0) sparkColor = ELEMENT_ACCENTS.FIRE;
      } else if (flavor === 'WATER') {
        speed = 1.82 + (i % 3) * .15;
        vertical = .24 + (i % 4) * .18;
        life = 4 + i % 3;
        width = .041 + (i % 2) * .009;
        gravity = .88;
        trail = .13;
        fadePower = 1.18;
        if (i % 4 === 0) sparkColor = ELEMENT_ACCENTS.WATER;
      } else if (flavor === 'ICE') {
        speed = 1.42 + (i % 4) * .15;
        vertical = .70 + (i % 3) * .29;
        life = 5 + i % 3;
        width = .05 + (i % 2) * .013;
        gravity = .30;
        trail = .31;
        fadePower = .88;
        if (i % 2 === 0) sparkColor = ELEMENT_ACCENTS.ICE;
      } else if (flavor === 'LIGHTNING') {
        speed = 2.2;
        vertical = .26 + (i % 2) * .20;
        life = 2.35 + (i % 2) * .55;
        width = .052;
        gravity = .05;
        trail = .23;
        fadePower = 1.65;
        if (i % 2 === 0) sparkColor = ELEMENT_ACCENTS.LIGHTNING;
      }

      this.pushParticle(
        x,
        y,
        z,
        Math.cos(angle) * force * radialVariation,
        vertical * force,
        Math.sin(angle) * force * radialVariation,
        tick,
        life,
        sparkColor,
        width,
        speed,
        gravity,
        trail,
        fadePower,
      );
    }

    if (flavor !== 'GENERIC') this.spawnElementSignature(x, y, z, flavor, color, tick, force);
    else if (force >= .42) this.spawnPhysicalImpactSignature(x, y, z, color, tick, force);
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

      this.pushBeam(prior.x, prior.y, prior.z, dx, dy, dz, tick, 2.15, [0.30, .62, 1], .084, 1.7);
      this.pushBeam(prior.x, prior.y, prior.z, dx, dy, dz, tick, 2.55, ELEMENT_ACCENTS.LIGHTNING, .034, 1.34);

      if (i === 2 || i === 4 || i === 6) {
        const branchAngle = tick * .37 + i * 1.91;
        const branchLength = .30 + (i % 4) * .045;
        this.pushBeam(
          next.x,
          next.y,
          next.z,
          Math.cos(branchAngle) * branchLength,
          .10 + (i % 2) * .08,
          Math.sin(branchAngle) * branchLength,
          tick,
          1.5,
          ELEMENT_TINTS.LIGHTNING,
          .028,
          1.75,
        );
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
      const width = Math.max(.003, s.width * (1 - age * .60));
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

  private spawnPhysicalImpactSignature(
    x: number,
    y: number,
    z: number,
    color: Tint,
    tick: number,
    force: number,
  ): void {
    const groundY = Math.max(.045, Math.min(.16, y * .2));
    const heavy = force >= .95;
    const medium = force >= .68;
    const accent = brighten(color, heavy ? .58 : medium ? .42 : .3);
    const rayCount = heavy ? 5 : medium ? 4 : 3;
    const rayRadius = (heavy ? .70 : medium ? .48 : .30) * Math.max(.82, force);

    for (let i = 0; i < rayCount && this.free.length; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + tick * .23;
      const length = rayRadius * (.76 + (i % 3) * .12);
      this.pushBeam(
        x,
        groundY + .025,
        z,
        Math.cos(angle) * length,
        .045 + (i % 2) * .035,
        Math.sin(angle) * length,
        tick,
        heavy ? 1.85 : 1.45,
        i % 2 === 0 ? accent : color,
        heavy ? .052 : .036,
        1.28,
      );
    }

    if (medium) {
      const segments = heavy ? 8 : 6;
      const radius = (heavy ? .62 : .42) * Math.max(.9, force);
      for (let i = 0; i < segments && this.free.length; i++) {
        const angleA = (i / segments) * Math.PI * 2 + tick * .11;
        const angleB = ((i + 1) / segments) * Math.PI * 2 + tick * .11;
        const startX = x + Math.cos(angleA) * radius;
        const startZ = z + Math.sin(angleA) * radius;
        const endX = x + Math.cos(angleB) * radius;
        const endZ = z + Math.sin(angleB) * radius;
        this.pushBeam(
          startX,
          groundY,
          startZ,
          endX - startX,
          .01,
          endZ - startZ,
          tick,
          heavy ? 1.65 : 1.35,
          accent,
          heavy ? .032 : .024,
          1.48,
        );
      }
    }

    const fragmentCount = heavy ? 5 : medium ? 3 : 2;
    for (let i = 0; i < fragmentCount && this.free.length; i++) {
      const angle = tick * .31 + i * 2.17;
      const outward = (heavy ? .58 : medium ? .40 : .26) * (.86 + (i % 2) * .18);
      this.pushParticle(
        x,
        groundY + .06,
        z,
        Math.cos(angle) * outward,
        (heavy ? .72 : medium ? .54 : .38) + i * .06,
        Math.sin(angle) * outward,
        tick,
        heavy ? 4.8 : medium ? 3.8 : 3.0,
        i % 2 === 0 ? accent : color,
        heavy ? .055 : .040,
        heavy ? 1.25 : 1.10,
        heavy ? .82 : .92,
        heavy ? .24 : .18,
        1.1,
      );
    }
  }

  private spawnElementSignature(
    x: number,
    y: number,
    z: number,
    flavor: Exclude<SparkFlavor, 'GENERIC'>,
    color: Tint,
    tick: number,
    force: number,
  ): void {
    const groundY = Math.max(.045, Math.min(.18, y * .22));

    if (flavor === 'FIRE') {
      for (let i = 0; i < 6 && this.free.length; i++) {
        const angle = (i / 6) * Math.PI * 2 + tick * .13;
        const radius = (.42 + (i % 2) * .09) * force;
        this.pushBeam(x, groundY, z, Math.cos(angle) * radius, .015, Math.sin(angle) * radius, tick, 1.7, color, .04, 1.22);
      }
      for (let i = 0; i < 3 && this.free.length; i++) {
        const angle = tick * .41 + i * 2.09;
        this.pushParticle(x, groundY + .04, z, Math.cos(angle) * .12, .92 + i * .14, Math.sin(angle) * .12, tick, 4.5, ELEMENT_ACCENTS.FIRE, .042, 1.15, .16, .18, .72);
      }
      return;
    }

    if (flavor === 'WATER') {
      for (let ring = 0; ring < 2; ring++) {
        const spokes = ring === 0 ? 8 : 6;
        const radius = (ring === 0 ? .54 : .32) * force;
        for (let i = 0; i < spokes && this.free.length; i++) {
          const angle = (i / spokes) * Math.PI * 2 + tick * .08 + ring * .27;
          this.pushBeam(x, groundY + ring * .018, z, Math.cos(angle) * radius, 0, Math.sin(angle) * radius, tick, 1.65 + ring * .25, ring === 0 ? color : ELEMENT_ACCENTS.WATER, ring === 0 ? .035 : .025, 1.32);
        }
      }
      return;
    }

    if (flavor === 'ICE') {
      for (let i = 0; i < 7 && this.free.length; i++) {
        const angle = (i / 7) * Math.PI * 2 + tick * .11;
        const radius = (.28 + (i % 3) * .07) * force;
        this.pushBeam(
          x,
          groundY,
          z,
          Math.cos(angle) * radius,
          .20 + (i % 2) * .12,
          Math.sin(angle) * radius,
          tick,
          2.0,
          i % 2 === 0 ? ELEMENT_ACCENTS.ICE : color,
          .045,
          1.12,
        );
      }
      return;
    }

    for (let i = 0; i < 5 && this.free.length; i++) {
      const angle = (i / 5) * Math.PI * 2 + tick * .19;
      const radius = (.36 + (i % 2) * .09) * force;
      const midX = x + Math.cos(angle) * radius * .55;
      const midZ = z + Math.sin(angle) * radius * .55;
      this.pushBeam(x, groundY + .03, z, midX - x, .08 + (i % 2) * .05, midZ - z, tick, 1.25, color, .052, 1.65);
      this.pushBeam(midX, groundY + .11, midZ, Math.cos(angle + .34) * radius * .45, -.05, Math.sin(angle + .34) * radius * .45, tick, 1.25, ELEMENT_ACCENTS.LIGHTNING, .026, 1.72);
    }
  }

  private pushParticle(
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    born: number,
    life: number,
    color: Tint,
    width: number,
    speed: number,
    gravity: number,
    trail: number,
    fadePower: number,
  ): void {
    const spark = this.free.pop();
    if (!spark) return;
    Object.assign(spark, {
      x, y, z, dx, dy, dz, born, life, color,
      beam: false,
      width, speed, gravity, trail, fadePower,
    });
    this.sparks.push(spark);
  }

  private pushBeam(
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    born: number,
    life: number,
    color: Tint,
    width: number,
    fadePower: number,
  ): void {
    const spark = this.free.pop();
    if (!spark) return;
    Object.assign(spark, {
      x, y, z, dx, dy, dz, born, life, color,
      beam: true,
      width,
      speed: 0,
      gravity: 0,
      trail: 1,
      fadePower,
    });
    this.sparks.push(spark);
  }
}

/** Thin hollow ground marker; shared by selection and elemental ripples. */
export function ringMesh(device: pc.GraphicsDevice): pc.Mesh {
  return pc.createTorus(device, { ringRadius: .48, tubeRadius: .018, segments: 32, sides: 4 });
}
