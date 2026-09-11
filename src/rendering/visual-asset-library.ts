import * as pc from 'playcanvas';
import manifest from '../../data/assets/manifest.json';
import { stableImpostorFrameForHeading } from './impostor-frame';
import { SCREEN_FACING_TURNAROUND_FRAME_REMAP, impostorFrameFiles, remapImpostorFrame } from './impostor-frame-assets';
import {
  VANGUARD_IMPOSTOR_FRAME_FILES,
  VANGUARD_IMPOSTOR_FRAME_REMAP,
  VANGUARD_IMPOSTOR_HEADING_OFFSET_DEGREES,
} from './vanguard-impostor-frames';
import {
  ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES,
  ELEMENTALIST_FIRE_IMPOSTOR_FRAME_REMAP,
  ELEMENTALIST_FIRE_IMPOSTOR_HEADING_OFFSET_DEGREES,
} from './elementalist-fire-impostor-frames';
import {
  RANGER_IMPOSTOR_FRAME_FILES,
  RANGER_IMPOSTOR_FRAME_REMAP,
  RANGER_IMPOSTOR_HEADING_OFFSET_DEGREES,
} from './ranger-impostor-frames';

interface ImpostorConfig {
  id: string;
  label: string;
  frameFiles: readonly string[];
  frameRemap: readonly number[];
  headingOffsetDegrees: number;
  width: number;
  height: number;
  shadowX: number;
  shadowZ: number;
}

const REVERSED_SIDE_FRAME_REMAP = [0, 7, 6, 5, 4, 3, 2, 1] as const;

const IMPOSTOR_CONFIGS = new Map<string, ImpostorConfig>([
  ['unit.vanguard', {
    id: 'unit.vanguard',
    label: 'Vanguard',
    frameFiles: VANGUARD_IMPOSTOR_FRAME_FILES,
    frameRemap: VANGUARD_IMPOSTOR_FRAME_REMAP,
    headingOffsetDegrees: VANGUARD_IMPOSTOR_HEADING_OFFSET_DEGREES,
    width: 1.27,
    height: 1.9,
    shadowX: 0.92,
    shadowZ: 0.64,
  }],
  ['unit.elementalist.fire', {
    id: 'unit.elementalist.fire',
    label: 'Fire Elementalist',
    frameFiles: ELEMENTALIST_FIRE_IMPOSTOR_FRAME_FILES,
    frameRemap: ELEMENTALIST_FIRE_IMPOSTOR_FRAME_REMAP,
    headingOffsetDegrees: ELEMENTALIST_FIRE_IMPOSTOR_HEADING_OFFSET_DEGREES,
    width: 1.72,
    height: 2.3,
    shadowX: 0.86,
    shadowZ: 0.62,
  }],
  ['unit.elementalist.water', {
    id: 'unit.elementalist.water',
    label: 'Water Elementalist',
    frameFiles: impostorFrameFiles('elementalist-water'),
    frameRemap: SCREEN_FACING_TURNAROUND_FRAME_REMAP,
    headingOffsetDegrees: 0,
    width: 1.72,
    height: 2.3,
    shadowX: 0.86,
    shadowZ: 0.62,
  }],
  ['unit.elementalist.ice', {
    id: 'unit.elementalist.ice',
    label: 'Ice Elementalist',
    frameFiles: impostorFrameFiles('elementalist-ice'),
    frameRemap: SCREEN_FACING_TURNAROUND_FRAME_REMAP,
    headingOffsetDegrees: 0,
    width: 1.72,
    height: 2.3,
    shadowX: 0.86,
    shadowZ: 0.62,
  }],
  ['unit.elementalist.lightning', {
    id: 'unit.elementalist.lightning',
    label: 'Lightning Elementalist',
    frameFiles: impostorFrameFiles('elementalist-lightning'),
    frameRemap: SCREEN_FACING_TURNAROUND_FRAME_REMAP,
    headingOffsetDegrees: 0,
    width: 1.72,
    height: 2.3,
    shadowX: 0.86,
    shadowZ: 0.62,
  }],
  ['unit.spear-guard', {
    id: 'unit.spear-guard',
    label: 'Spear Guard',
    frameFiles: impostorFrameFiles('spear-guard'),
    frameRemap: SCREEN_FACING_TURNAROUND_FRAME_REMAP,
    headingOffsetDegrees: 0,
    width: 1.65,
    height: 2.2,
    shadowX: 0.86,
    shadowZ: 0.62,
  }],
  ['unit.ranger', {
    id: 'unit.ranger',
    label: 'Ranger',
    frameFiles: RANGER_IMPOSTOR_FRAME_FILES,
    frameRemap: RANGER_IMPOSTOR_FRAME_REMAP,
    headingOffsetDegrees: RANGER_IMPOSTOR_HEADING_OFFSET_DEGREES,
    width: 1.18,
    height: 1.56,
    shadowX: 0.72,
    shadowZ: 0.52,
  }],
  ['unit.scout', {
    id: 'unit.scout',
    label: 'Scout',
    frameFiles: impostorFrameFiles('scout'),
    frameRemap: SCREEN_FACING_TURNAROUND_FRAME_REMAP,
    headingOffsetDegrees: 0,
    width: 0.96,
    height: 1.24,
    shadowX: 0.64,
    shadowZ: 0.46,
  }],
  ['unit.engineer', {
    id: 'unit.engineer',
    label: 'Engineer',
    frameFiles: impostorFrameFiles('engineer'),
    frameRemap: SCREEN_FACING_TURNAROUND_FRAME_REMAP,
    headingOffsetDegrees: 0,
    width: 1.22,
    height: 1.58,
    shadowX: 0.78,
    shadowZ: 0.56,
  }],
  ['unit.golem', {
    id: 'unit.golem',
    label: 'Golem',
    frameFiles: impostorFrameFiles('golem'),
    frameRemap: REVERSED_SIDE_FRAME_REMAP,
    headingOffsetDegrees: 0,
    width: 2.05,
    height: 2.46,
    shadowX: 1.28,
    shadowZ: 0.9,
  }],
  ['unit.siege-construct', {
    id: 'unit.siege-construct',
    label: 'Siege Construct',
    frameFiles: impostorFrameFiles('siege-construct'),
    frameRemap: REVERSED_SIDE_FRAME_REMAP,
    headingOffsetDegrees: 0,
    // Keep the 192x256 source frame near its native aspect. The prior
    // 2.55x1.82 plane stretched this wide vehicle almost 2x horizontally,
    // making the elevated turnaround read like a flattened top view.
    width: 2.25,
    height: 3.0,
    shadowX: 1.45,
    shadowZ: 1.0,
  }],
]);

interface ImpostorHandle {
  billboard: pc.Entity;
  plane: pc.Entity;
  shadow: pc.Entity;
  materials: readonly pc.StandardMaterial[];
  frameRemap: readonly number[];
  headingOffsetDegrees: number;
  viewFrame: number;
  update: () => void;
}

interface ImpostorResources {
  materials: pc.StandardMaterial[];
  textures: pc.Texture[];
  promise: Promise<readonly pc.StandardMaterial[] | null> | null;
}

export interface VisualModel {
  entity: pc.Entity | null;
  legL: pc.GraphNode | null;
  legR: pc.GraphNode | null;
  weapon: pc.GraphNode | null;
  reactor: pc.GraphNode | null;
  orbit: pc.GraphNode | null;
  impostor: ImpostorHandle | null;
  released: boolean;
}

/** One load per stable ID, shared geometry/materials, safe primitive fallback. */
export class VisualAssetLibrary {
  private readonly assets = new Map<string, Promise<pc.ContainerResource | null>>();
  private readonly registered: pc.Asset[] = [];
  private readonly teamMaterials = new Map<string, pc.StandardMaterial>();
  private readonly impostorResources = new Map<string, ImpostorResources>();
  private readonly impostorUpdates = new Set<() => void>();
  private readonly impostorShadowMaterial: pc.StandardMaterial;
  private disposed = false;

  constructor(private readonly app: pc.Application) {
    this.impostorShadowMaterial = new pc.StandardMaterial();
    this.impostorShadowMaterial.name = 'IMPOSTOR_SHADOW';
    this.impostorShadowMaterial.useLighting = false;
    this.impostorShadowMaterial.diffuse = new pc.Color(0.02, 0.025, 0.025);
    this.impostorShadowMaterial.opacity = 0.24;
    this.impostorShadowMaterial.blendType = pc.BLEND_NORMAL;
    this.impostorShadowMaterial.depthWrite = false;
    this.impostorShadowMaterial.cull = pc.CULLFACE_NONE;
    this.impostorShadowMaterial.update();
  }

  attach(parent: pc.Entity, fallback: readonly pc.Entity[], id: string, playerId: number): VisualModel {
    const handle: VisualModel = {
      entity: null,
      legL: null,
      legR: null,
      weapon: null,
      reactor: null,
      orbit: null,
      impostor: null,
      released: false,
    };

    // Current approved impostor art has baked player ownership color. Keep
    // enemy units on the recolorable GLB path until neutral/masked art exists.
    const impostorConfig = playerId === 0 ? IMPOSTOR_CONFIGS.get(id) : undefined;
    if (impostorConfig) {
      this.attachImpostor(parent, fallback, handle, impostorConfig);
      return handle;
    }

    void this.load(id).then((resource) => {
      if (!resource || this.disposed || handle.released) return;
      const entity = resource.instantiateRenderEntity();
      for (const render of entity.findComponents('render') as pc.RenderComponent[]) {
        render.castShadows = false;
        for (const mesh of render.meshInstances) {
          if (mesh.material.name !== 'TEAM') continue;
          const key = `${id}:${playerId === 0 ? 'player' : 'enemy'}`;
          let material = this.teamMaterials.get(key);
          if (!material) {
            material = (mesh.material as pc.StandardMaterial).clone();
            material.diffuse = playerId === 0 ? new pc.Color(.10, .62, .48) : new pc.Color(.78, .16, .12);
            material.update();
            this.teamMaterials.set(key, material);
          }
          mesh.material = material;
        }
      }
      parent.addChild(entity);
      for (const primitive of fallback) primitive.enabled = false;
      handle.entity = entity;
      handle.legL = entity.findByName('LegL');
      handle.legR = entity.findByName('LegR');
      handle.weapon = entity.findByName('Weapon');
      handle.reactor = entity.findByName('Reactor');
      handle.orbit = entity.findByName('Orbit');
    });
    return handle;
  }

  syncImpostor(handle: VisualModel | null, headingDegrees: number): void {
    const impostor = handle?.impostor;
    if (!impostor || impostor.materials.length !== 8) return;

    // Cancel the parent's unit heading so the image plane remains camera-facing;
    // the selected directional frame carries the visible unit orientation.
    impostor.billboard.setLocalEulerAngles(0, 45 - headingDegrees, 0);
    const viewFrame = stableImpostorFrameForHeading(
      headingDegrees + impostor.headingOffsetDegrees,
      impostor.viewFrame,
    );
    if (viewFrame === impostor.viewFrame) return;
    const sourceFrame = remapImpostorFrame(viewFrame, impostor.frameRemap);
    const material = impostor.materials[sourceFrame];
    if (impostor.plane.render && material) impostor.plane.render.material = material;
    impostor.viewFrame = viewFrame;
  }

  release(handle: VisualModel | null): void {
    if (!handle) return;
    handle.released = true;
    if (handle.impostor) {
      this.app.off('update', handle.impostor.update);
      this.impostorUpdates.delete(handle.impostor.update);
      handle.impostor.shadow.destroy();
    }
    handle.entity?.destroy();
  }

  destroy(): void {
    this.disposed = true;
    for (const update of this.impostorUpdates) this.app.off('update', update);
    for (const material of this.teamMaterials.values()) material.destroy();
    for (const resources of this.impostorResources.values()) {
      for (const material of resources.materials) material.destroy();
      for (const texture of resources.textures) texture.destroy();
    }
    this.impostorShadowMaterial.destroy();
    for (const asset of this.registered) {
      asset.unload();
      this.app.assets.remove(asset);
    }
    this.impostorUpdates.clear();
    this.teamMaterials.clear();
    this.impostorResources.clear();
    this.assets.clear();
  }

  private attachImpostor(
    parent: pc.Entity,
    fallback: readonly pc.Entity[],
    handle: VisualModel,
    config: ImpostorConfig,
  ): void {
    void this.loadImpostorMaterials(config).then((materials) => {
      if (!materials || this.disposed || handle.released) return;
      const pivot = new pc.Entity(`${config.label} Impostor Pivot`);
      const billboard = new pc.Entity(`${config.label} Impostor Billboard`);
      const plane = new pc.Entity(`${config.label} Impostor`);
      plane.addComponent('render', {
        type: 'plane',
        material: materials[0],
        castShadows: false,
        receiveShadows: false,
      });
      plane.setLocalEulerAngles(90, 0, 0);

      // Pin the sprite's bottom edge to the unit origin using the canonical
      // visual height; width is tuned to the normalized transparent frame.
      plane.setLocalPosition(0, config.height * 0.5, 0);
      plane.setLocalScale(config.width, 1, config.height);
      billboard.addChild(plane);
      pivot.addChild(billboard);
      parent.addChild(pivot);

      // Keep the contact shadow outside the bobbing unit root so it remains
      // visually attached to the terrain rather than floating with the sprite.
      const shadow = new pc.Entity(`${config.label} Impostor Shadow`);
      shadow.addComponent('render', {
        type: 'cylinder',
        material: this.impostorShadowMaterial,
        castShadows: false,
        receiveShadows: false,
      });
      shadow.setLocalScale(config.shadowX, 0.018, config.shadowZ);
      this.app.root.addChild(shadow);

      for (const primitive of fallback) primitive.enabled = false;

      const update = (): void => {
        const position = parent.getPosition();
        shadow.enabled = parent.enabled;
        shadow.setPosition(position.x, 0.022, position.z);

        // Primitive 3D units use a stronger procedural gait bob. Counter part
        // of that positive Y motion for flat sprites so they stay grounded.
        pivot.setLocalPosition(0, -Math.max(0, position.y) * 0.45, 0);
        this.syncImpostor(handle, parent.getEulerAngles().y);
      };
      handle.entity = pivot;
      handle.impostor = {
        billboard,
        plane,
        shadow,
        materials,
        frameRemap: config.frameRemap,
        headingOffsetDegrees: config.headingOffsetDegrees,
        viewFrame: -1,
        update,
      };
      this.impostorUpdates.add(update);
      this.app.on('update', update);
      update();
    });
  }

  private loadImpostorMaterials(config: ImpostorConfig): Promise<readonly pc.StandardMaterial[] | null> {
    let resources = this.impostorResources.get(config.id);
    if (!resources) {
      resources = { materials: [], textures: [], promise: null };
      this.impostorResources.set(config.id, resources);
    }
    if (resources.promise) return resources.promise;

    const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load ${config.label} impostor frame: ${url}`));
      image.src = url;
    });

    resources.promise = Promise.allSettled(
      config.frameFiles.map((path) => loadImage(`${import.meta.env.BASE_URL}${path}`)),
    ).then((results) => {
      if (this.disposed) return null;

      const loadedImages = results.map((result) => result.status === 'fulfilled' ? result.value : null);
      const loadedCount = loadedImages.filter((image): image is HTMLImageElement => image !== null).length;
      if (loadedCount === 0) throw new Error(`No ${config.label} impostor frames could be loaded.`);

      if (loadedCount !== loadedImages.length) {
        const missing = results
          .map((result, frame) => result.status === 'rejected' ? config.frameFiles[frame] : null)
          .filter((path): path is string => path !== null);
        console.warn(`${config.label} impostor has ${missing.length} missing/corrupt frame(s); using nearest valid directional frame.`, missing);
      }

      const nearestLoadedImage = (frame: number): HTMLImageElement => {
        const direct = loadedImages[frame];
        if (direct) return direct;
        for (let distance = 1; distance < loadedImages.length; distance += 1) {
          const previous = loadedImages[(frame - distance + loadedImages.length) % loadedImages.length];
          if (previous) return previous;
          const next = loadedImages[(frame + distance) % loadedImages.length];
          if (next) return next;
        }
        return loadedImages.find((image): image is HTMLImageElement => image !== null)!;
      };

      for (let frame = 0; frame < loadedImages.length; frame += 1) {
        const image = nearestLoadedImage(frame);
        const texture = new pc.Texture(this.app.graphicsDevice, {
          name: `${config.id}.impostor.${frame}`,
          mipmaps: false,
          srgb: true,
          minFilter: pc.FILTER_LINEAR,
          magFilter: pc.FILTER_LINEAR,
          addressU: pc.ADDRESS_CLAMP_TO_EDGE,
          addressV: pc.ADDRESS_CLAMP_TO_EDGE,
        });
        texture.setSource(image);
        resources.textures.push(texture);

        const material = new pc.StandardMaterial();
        material.name = `${config.id.toUpperCase().replaceAll('.', '_')}_IMPOSTOR_${frame}`;
        material.useLighting = false;
        material.emissive = new pc.Color(1, 1, 1);
        material.emissiveMap = texture;
        material.opacityMap = texture;
        material.opacityMapChannel = 'a';
        material.alphaTest = 0.12;
        material.cull = pc.CULLFACE_NONE;
        material.update();
        resources.materials.push(material);
      }

      return resources.materials;
    }).catch((error: unknown) => {
      console.warn(`${config.label} impostor frame load failed; using fallback geometry.`, error);
      return null;
    });

    return resources.promise;
  }

  private load(id: string): Promise<pc.ContainerResource | null> {
    const existing = this.assets.get(id);
    if (existing) return existing;
    const entry = manifest.entries.find((candidate) => candidate.id === id);
    if (!entry || !entry.path.endsWith('.glb')) return Promise.resolve(null);
    const promise = new Promise<pc.ContainerResource | null>((resolve) => {
      const asset = new pc.Asset(id, 'container', { url: `${import.meta.env.BASE_URL}${entry.path}` });
      asset.once('load', () => resolve(asset.resource as pc.ContainerResource));
      asset.once('error', () => {
        console.warn(`Visual asset unavailable: ${id}; using fallback.`);
        resolve(null);
      });
      this.registered.push(asset);
      this.app.assets.add(asset);
      this.app.assets.load(asset);
    });
    this.assets.set(id, promise);
    return promise;
  }
}
