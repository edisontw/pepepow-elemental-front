import * as pc from 'playcanvas';
import { BattleVfx } from './battle-vfx';
import { VisualAssetLibrary } from './visual-asset-library';
import { AudioFeedback } from '../audio/audio-feedback';
import { MinimapControls } from '../input/minimap-controls';
import { UnitControls } from '../input/unit-controls';
import { WORLD_UNITS_PER_METER, type ArenaZone } from '../simulation/arena';
import type { TickFrame } from '../simulation/fixed-tick-runner';
import { M03Simulation } from '../simulation/m03-simulation';
import type { M04Simulation } from '../simulation/m04-simulation';
import { M06Simulation } from '../simulation/m06-simulation';
import type { EntitySnapshot } from '../simulation/simulation';
import { CameraFeedback } from './camera-feedback';
import { ElementalRenderBridge } from './elemental-render-bridge';
import { GeneratedWorldRenderBridge } from './generated-world-render-bridge';
import { PoiRenderBridge } from './poi-render-bridge';
import { ResourceRenderBridge } from './resource-render-bridge';
import { RtsCamera } from './rts-camera';
import { RunRenderBridge } from './run-render-bridge';
import { StrategicRenderBridge } from './strategic-render-bridge';
import { TerritoryRenderBridge } from './territory-render-bridge';
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

function renderZone(app: pc.Application, zone: ArenaZone, materials: Record<string, pc.Material>): pc.Entity | null {
  const position = new pc.Vec3(metres(zone.centerX), 0, metres(zone.centerZ));
  const scale = new pc.Vec3(metres(zone.width), 1, metres(zone.depth));
  if (zone.kind === 'NORMAL_GROUND') {
    addPrimitive(app, 'plane', 'Normal Ground', position, scale, materials.ground!);
  } else if (zone.kind === 'RIVER') {
    position.y = 0.035;
    addPrimitive(app, 'plane', 'River', position, scale, materials.river!);
  } else if (zone.kind === 'FREEZABLE_CROSSING') {
    position.y = 0.046;
    return addPrimitive(app, 'plane', 'Freezable Water Test', position, scale, materials.ice!);
  } else if (zone.kind === 'NATURAL_CROSSING') {
    position.y = 0.055;
    addPrimitive(app, 'box', 'Natural Crossing', position, new pc.Vec3(scale.x, 0.08, scale.z), materials.bridge!);
  } else if (zone.kind === 'FOREST') {
    addPrimitive(app, 'box', `Forest Floor ${zone.id}`, new pc.Vec3(position.x, 0.018, position.z), new pc.Vec3(scale.x, 0.025, scale.z), materials.forest!);
    for (let index = 0; index < 5; index += 1) {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = position.x + (column - 1) * Math.min(scale.x / 3.8, 1.4);
      const z = position.z + (row - 0.5) * Math.min(scale.z / 3.4, 1.2);
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
  return null;
}

export interface SceneShell {
  app: pc.Application;
  camera: RtsCamera;
  get selectedCount(): number;
  get selectedUnits(): readonly EntitySnapshot[];
  screenToSimulationPosition(clientX: number, clientY: number): { x: number; z: number } | null;
  sync(frame: TickFrame): void;
  destroy(): void;
}

export function createSceneShell(
  canvas: HTMLCanvasElement,
  simulation: M04Simulation,
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
    ice: createMaterial(new pc.Color(0.58, 0.88, 0.96), new pc.Color(0.12, 0.34, 0.42), 0.82),
    bridge: createMaterial(new pc.Color(0.45, 0.32, 0.18)),
    forest: createMaterial(new pc.Color(0.08, 0.24, 0.10)),
    trunk: createMaterial(new pc.Color(0.22, 0.13, 0.07)),
    canopy: createMaterial(new pc.Color(0.08, 0.34, 0.13)),
    rock: createMaterial(new pc.Color(0.27, 0.29, 0.27)),
  };

  const generatedWorldBridge = simulation instanceof M03Simulation
    ? new GeneratedWorldRenderBridge(app, simulation.generatedWorld, simulation.terrain)
    : null;
  const resourceBridge = simulation instanceof M03Simulation
    ? new ResourceRenderBridge(app, simulation.generatedWorld)
    : null;
  const territoryBridge = simulation instanceof M03Simulation
    ? new TerritoryRenderBridge(app, simulation.generatedWorld)
    : null;
  if (simulation instanceof M03Simulation) territoryBridge?.sync(simulation.strategy.snapshot());
  let freezablePatch: pc.Entity | null = null;
  if (!generatedWorldBridge) {
    for (const zone of simulation.arena.zones) {
      const rendered = renderZone(app, zone, materials);
      if (zone.kind === 'FREEZABLE_CROSSING') freezablePatch = rendered;
    }
    if (freezablePatch) freezablePatch.enabled = false;
  }

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
  const initialSnapshot = simulation.snapshot();
  const initialPlayer = initialSnapshot.entities.find((entity) => entity.playerId === 0 && entity.alive);
  const arenaSpanMetres = Math.max(simulation.arena.width, simulation.arena.depth) / WORLD_UNITS_PER_METER;
  const generatedCamera = simulation instanceof M03Simulation
    ? {
      initialDistance: pc.math.clamp(arenaSpanMetres * 0.34, 40, 56),
      maxDistance: pc.math.clamp(arenaSpanMetres * 0.7, 64, 96),
    }
    : {};
  const camera = new RtsCamera(cameraEntity, canvas, {
    halfWidth: simulation.arena.width / (2 * WORLD_UNITS_PER_METER),
    halfDepth: simulation.arena.depth / (2 * WORLD_UNITS_PER_METER),
    targetX: initialPlayer ? metres(initialPlayer.x) : 0,
    targetZ: initialPlayer ? metres(initialPlayer.z) : 0,
    ...generatedCamera,
  });
  const cameraComponent = cameraEntity.camera;
  if (!cameraComponent) throw new Error('RTS camera component failed to initialize.');
  const cameraFeedback = new CameraFeedback(cameraComponent, 48);

  const screenToSimulationPosition = (clientX: number, clientY: number): { x: number; z: number } | null => {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const screenX = ((clientX - bounds.left) / bounds.width) * canvas.width;
    const screenY = ((clientY - bounds.top) / bounds.height) * canvas.height;
    const near = cameraComponent.screenToWorld(screenX, screenY, cameraComponent.nearClip);
    const far = cameraComponent.screenToWorld(screenX, screenY, cameraComponent.farClip);
    const verticalDelta = far.y - near.y;
    if (Math.abs(verticalDelta) < 0.000_001) return null;
    const distance = -near.y / verticalDelta;
    if (distance < 0 || distance > 1) return null;
    return {
      x: Math.round((near.x + (far.x - near.x) * distance) * WORLD_UNITS_PER_METER),
      z: Math.round((near.z + (far.z - near.z) * distance) * WORLD_UNITS_PER_METER),
    };
  };

  const unitMaterials = {
    player: createMaterial(new pc.Color(0.18, 0.68, 0.61), new pc.Color(0.02, 0.2, 0.16)),
    enemyMelee: createMaterial(new pc.Color(0.78, 0.18, 0.15), new pc.Color(0.24, 0.02, 0.01)),
    enemyRanged: createMaterial(new pc.Color(0.82, 0.43, 0.12), new pc.Color(0.22, 0.08, 0.01)),
  };
  const selectionMaterial = createMaterial(new pc.Color(0.96, 0.78, 0.2), new pc.Color(0.55, 0.32, 0.03));
  const healthMaterial = createMaterial(new pc.Color(0.18, 0.9, 0.25), new pc.Color(0.03, 0.2, 0.04));
  const battleVfx = new BattleVfx(app);
  const visualAssets = new VisualAssetLibrary(app);
  const bridge = new UnitRenderBridge(app, initialSnapshot, unitMaterials, selectionMaterial, healthMaterial, visualAssets, battleVfx);
  const elementalBridge = new ElementalRenderBridge(app, simulation.terrain, initialSnapshot, battleVfx);
  const audioFeedback = new AudioFeedback();
  const poiBridge = simulation instanceof M03Simulation
    ? new PoiRenderBridge(app, simulation.generatedWorld, cameraComponent, camera, canvas)
    : null;
  if (simulation instanceof M03Simulation) poiBridge?.sync(simulation.strategy.snapshot());
  const controls = new UnitControls(canvas, cameraComponent, simulation, bridge, selectionBox);
  const minimapCanvas = document.getElementById('world-debug-canvas');
  const minimapControls = simulation instanceof M03Simulation && minimapCanvas instanceof HTMLCanvasElement
    ? new MinimapControls(minimapCanvas, simulation.generatedWorld, camera, controls)
    : null;
  const strategicBridge = simulation instanceof M03Simulation ? new StrategicRenderBridge(app, visualAssets) : null;
  if (simulation instanceof M03Simulation) strategicBridge?.sync(simulation.strategy.snapshot(), initialSnapshot.tick);
  const runBridge = simulation instanceof M06Simulation ? new RunRenderBridge(app) : null;
  if (simulation instanceof M06Simulation) runBridge?.sync(simulation.run.snapshot(), initialSnapshot.tick, 0);

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
    get selectedUnits(): readonly EntitySnapshot[] {
      return controls.selectedUnits;
    },
    screenToSimulationPosition,
    sync(frame: TickFrame): void {
      bridge.sync(frame.previousSnapshot, frame.snapshot, frame.interpolationAlpha);
      elementalBridge.sync(frame.previousSnapshot, frame.snapshot, frame.interpolationAlpha);
      cameraFeedback.sync(frame.previousSnapshot, frame.snapshot, frame.interpolationAlpha);
      audioFeedback.sync(frame.previousSnapshot, frame.snapshot);
      controls.syncSelection();
      if (simulation instanceof M03Simulation) {
        const strategicSnapshot = simulation.strategy.snapshot();
        strategicBridge?.sync(strategicSnapshot, frame.snapshot.tick);
        territoryBridge?.sync(strategicSnapshot);
        poiBridge?.sync(strategicSnapshot);
      }
      if (simulation instanceof M06Simulation) {
        runBridge?.sync(simulation.run.snapshot(), frame.snapshot.tick, frame.interpolationAlpha);
        const phase = simulation.run.snapshot().phase;
        const finale = phase === 'FINALE';
        app.scene.ambientLight = finale
          ? new pc.Color(0.17, 0.19, 0.24)
          : phase === 'ESCALATION'
            ? new pc.Color(0.19, 0.22, 0.23)
            : new pc.Color(0.2, 0.25, 0.23);
        if (light.light) {
          light.light.intensity = finale ? 1.2 : phase === 'ESCALATION' ? 1.34 : 1.45;
          light.light.color = finale
            ? new pc.Color(0.78, 0.84, 0.96)
            : new pc.Color(0.9, 0.94, 0.84);
        }
      }
      battleVfx.sync(frame.snapshot.tick, frame.interpolationAlpha);
      generatedWorldBridge?.sync(frame.snapshot.navVersion, frame.snapshot.terrain.ice);
      if (freezablePatch?.render) {
        const frozen = frame.snapshot.terrain.ice > 0;
        freezablePatch.enabled = frozen;
        if (frozen) freezablePatch.render.material = materials.ice!;
      }
    },
    destroy(): void {
      window.removeEventListener('resize', onResize);
      minimapControls?.destroy();
      controls.destroy();
      poiBridge?.destroy();
      audioFeedback.destroy();
      cameraFeedback.destroy();
      bridge.destroy();
      elementalBridge.destroy();
      strategicBridge?.destroy();
      territoryBridge?.destroy();
      runBridge?.destroy();
      resourceBridge?.destroy();
      generatedWorldBridge?.destroy();
      camera.destroy();
      battleVfx.destroy();
      visualAssets.destroy();
      app.destroy();
    },
  };
}
