import * as pc from 'playcanvas';
import { UnitControls } from '../input/unit-controls';
import { WORLD_UNITS_PER_METER, type ArenaZone } from '../simulation/arena';
import type { TickFrame } from '../simulation/fixed-tick-runner';
import type { Simulation } from '../simulation/simulation';
import { RtsCamera } from './rts-camera';
import { UnitRenderBridge } from './unit-render-bridge';

function createMaterial(color: pc.Color, emissive?: pc.Color, opacity = 1): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.metalness = 0.05;
  material.gloss = 0.35;
  material.opacity = opacity;
  if (opacity < 1) material.blendType = pc.BLEND_NORMAL;
  if (emissive) {
    material.emissive = emissive;
    material.emissiveIntensity = 1.3;
  }
  material.update();
  return material;
}

function addPrimitive(
  app: pc.Application,
  type: 'box' | 'capsule' | 'cylinder' | 'plane',
  name: string,
  position: pc.Vec3,
  scale: pc.Vec3,
  material: pc.Material,
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type, material });
  entity.setPosition(position);
  entity.setLocalScale(scale);
  app.root.addChild(entity);
  return entity;
}

function metres(value: number): number {
  return value / WORLD_UNITS_PER_METER;
}

function renderZone(app: pc.Application, zone: ArenaZone, materials: Record<string, pc.Material>): void {
  const position = new pc.Vec3(metres(zone.centerX), 0.025, metres(zone.centerZ));
  const scale = new pc.Vec3(metres(zone.width), 1, metres(zone.depth));
  if (zone.kind === 'NORMAL_GROUND') {
    addPrimitive(app, 'plane', 'Normal Ground', pc.Vec3.ZERO, scale, materials.ground!);
  } else if (zone.kind === 'RIVER') {
    addPrimitive(app, 'plane', 'River', position, scale, materials.river!);
  } else if (zone.kind === 'FREEZABLE_CROSSING') {
    position.y = 0.045;
    addPrimitive(app, 'plane', 'Future Freezable Crossing', position, scale, materials.crossing!);
  } else if (zone.kind === 'NATURAL_CROSSING') {
    position.y = 0.08;
    addPrimitive(app, 'box', 'Natural Crossing', position, new pc.Vec3(scale.x, 0.12, scale.z), materials.bridge!);
  } else if (zone.kind === 'FOREST') {
    addPrimitive(app, 'box', `Forest Floor ${zone.id}`, new pc.Vec3(position.x, 0.08, position.z), new pc.Vec3(scale.x, 0.12, scale.z), materials.forest!);
    for (let index = 0; index < 7; index += 1) {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = position.x + (column - 1) * (scale.x / 3.8);
      const z = position.z + (row - 1) * (scale.z / 3.4);
      addPrimitive(app, 'cylinder', 'Forest Tree', new pc.Vec3(x, 0.75, z), new pc.Vec3(0.35, 1.4, 0.35), materials.trunk!);
      addPrimitive(app, 'capsule', 'Forest Canopy', new pc.Vec3(x, 1.65, z), new pc.Vec3(0.9, 1.15, 0.9), materials.canopy!);
    }
  } else if (zone.kind === 'CHOKEPOINT') {
    const halfGap = 1.5;
    const wallWidth = scale.x / 2 - halfGap;
    addPrimitive(app, 'box', 'Chokepoint West Wall', new pc.Vec3(position.x - (scale.x + halfGap * 2) / 4, 0.65, position.z), new pc.Vec3(wallWidth, 1.3, scale.z), materials.rock!);
    addPrimitive(app, 'box', 'Chokepoint East Wall', new pc.Vec3(position.x + (scale.x + halfGap * 2) / 4, 0.65, position.z), new pc.Vec3(wallWidth, 1.3, scale.z), materials.rock!);
  } else if (zone.kind === 'BLOCKED_TERRAIN') {
    addPrimitive(app, 'box', `Blocked Terrain ${zone.id}`, new pc.Vec3(position.x, 0.65, position.z), new pc.Vec3(scale.x, 1.3, scale.z), materials.rock!);
  }
}

export interface SceneShell {
  app: pc.Application;
  camera: RtsCamera;
  get selectedCount(): number;
  sync(frame: TickFrame): void;
  destroy(): void;
}

export function createSceneShell(
  canvas: HTMLCanvasElement,
  simulation: Simulation,
  selectionBox: HTMLElement,
): SceneShell {
  const app = new pc.Application(canvas, {
    graphicsDeviceOptions: {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    },
  });

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.scene.ambientLight = new pc.Color(0.2, 0.25, 0.23);

  const materials: Record<string, pc.Material> = {
    ground: createMaterial(new pc.Color(0.13, 0.23, 0.16)),
    river: createMaterial(new pc.Color(0.06, 0.25, 0.42), new pc.Color(0.01, 0.08, 0.16)),
    crossing: createMaterial(new pc.Color(0.24, 0.72, 0.82), new pc.Color(0.06, 0.28, 0.34), 0.58),
    bridge: createMaterial(new pc.Color(0.45, 0.32, 0.18)),
    forest: createMaterial(new pc.Color(0.08, 0.24, 0.10)),
    trunk: createMaterial(new pc.Color(0.22, 0.13, 0.07)),
    canopy: createMaterial(new pc.Color(0.08, 0.34, 0.13)),
    rock: createMaterial(new pc.Color(0.27, 0.29, 0.27)),
  };
  for (const zone of simulation.arena.zones) renderZone(app, zone, materials);

  const light = new pc.Entity('Sun');
  light.addComponent('light', {
    type: 'directional',
    color: new pc.Color(0.9, 0.94, 0.84),
    intensity: 1.45,
    castShadows: true,
  });
  light.setEulerAngles(48, 28, 0);
  app.root.addChild(light);

  const cameraEntity = new pc.Entity('RTS Camera');
  cameraEntity.addComponent('camera', {
    clearColor: new pc.Color(0.025, 0.055, 0.052),
    farClip: 500,
    fov: 48,
  });
  app.root.addChild(cameraEntity);
  const camera = new RtsCamera(cameraEntity, canvas);
  const cameraComponent = cameraEntity.camera;
  if (!cameraComponent) throw new Error('RTS camera component failed to initialize.');

  const unitMaterials = {
    player: createMaterial(new pc.Color(0.18, 0.68, 0.61), new pc.Color(0.02, 0.2, 0.16)),
    enemyMelee: createMaterial(new pc.Color(0.78, 0.18, 0.15), new pc.Color(0.24, 0.02, 0.01)),
    enemyRanged: createMaterial(new pc.Color(0.82, 0.43, 0.12), new pc.Color(0.22, 0.08, 0.01)),
  };
  const selectionMaterial = createMaterial(new pc.Color(0.96, 0.78, 0.2), new pc.Color(0.55, 0.32, 0.03));
  const healthMaterial = createMaterial(new pc.Color(0.18, 0.9, 0.25), new pc.Color(0.03, 0.2, 0.04));
  const bridge = new UnitRenderBridge(app, simulation.snapshot(), unitMaterials, selectionMaterial, healthMaterial);
  const controls = new UnitControls(canvas, cameraComponent, simulation, bridge, selectionBox);

  const onResize = (): void => {
    app.resizeCanvas();
  };
  window.addEventListener('resize', onResize);
  app.start();

  return {
    app,
    camera,
    get selectedCount(): number {
      return controls.selectedCount;
    },
    sync(frame: TickFrame): void {
      bridge.sync(frame.previousSnapshot, frame.snapshot, frame.interpolationAlpha);
    },
    destroy(): void {
      window.removeEventListener('resize', onResize);
      controls.destroy();
      bridge.destroy();
      camera.destroy();
      app.destroy();
    },
  };
}
