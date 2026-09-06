import * as pc from 'playcanvas';
import { RtsCamera } from './rts-camera';

function createMaterial(color: pc.Color, emissive?: pc.Color): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.metalness = 0.05;
  material.gloss = 0.35;
  if (emissive) {
    material.emissive = emissive;
    material.emissiveIntensity = 1.3;
  }
  material.update();
  return material;
}

function addPrimitive(
  app: pc.Application,
  type: 'box' | 'cylinder' | 'plane',
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

export interface SceneShell {
  app: pc.Application;
  camera: RtsCamera;
  destroy(): void;
}

export function createSceneShell(canvas: HTMLCanvasElement): SceneShell {
  const app = new pc.Application(canvas, {
    graphicsDeviceOptions: {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    },
  });

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.scene.ambientLight = new pc.Color(0.18, 0.24, 0.23);

  const ground = createMaterial(new pc.Color(0.10, 0.19, 0.17));
  addPrimitive(app, 'plane', 'Debug Ground', pc.Vec3.ZERO, new pc.Vec3(50, 1, 50), ground);

  const coreMaterial = createMaterial(
    new pc.Color(0.12, 0.44, 0.38),
    new pc.Color(0.03, 0.24, 0.19),
  );
  addPrimitive(app, 'cylinder', 'Core Placeholder', new pc.Vec3(0, 1, 0), new pc.Vec3(2.8, 2, 2.8), coreMaterial);

  const markerMaterial = createMaterial(new pc.Color(0.30, 0.40, 0.37));
  for (const [x, z] of [[-9, -5], [8, -7], [-7, 8], [10, 6]] as const) {
    addPrimitive(app, 'box', 'Shell Marker', new pc.Vec3(x, 0.35, z), new pc.Vec3(1.4, 0.7, 1.4), markerMaterial);
  }

  const light = new pc.Entity('Sun');
  light.addComponent('light', {
    type: 'directional',
    color: new pc.Color(0.88, 0.95, 0.90),
    intensity: 1.4,
    castShadows: true,
  });
  light.setEulerAngles(45, 35, 0);
  app.root.addChild(light);

  const cameraEntity = new pc.Entity('RTS Camera');
  cameraEntity.addComponent('camera', {
    clearColor: new pc.Color(0.025, 0.055, 0.052),
    farClip: 500,
    fov: 48,
  });
  app.root.addChild(cameraEntity);
  const camera = new RtsCamera(cameraEntity, canvas);

  const onResize = (): void => {
    app.resizeCanvas();
  };
  window.addEventListener('resize', onResize);
  app.start();

  return {
    app,
    camera,
    destroy(): void {
      window.removeEventListener('resize', onResize);
      camera.destroy();
      app.destroy();
    },
  };
}
