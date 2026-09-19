import * as pc from 'playcanvas';
import { impostorAtlasFile, impostorAtlasRect } from './impostor-atlas';
import manifest from '../../data/assets/manifest.json';
import { RTS_CAMERA_YAW_DEGREES, stableImpostorFrameForHeading } from './impostor-frame';
import {
  impostorAnimationFrame,
  impostorAnimationMaterialIndex,
  type ImpostorAnimationAction,
  type ImpostorAnimationSample,
} from './impostor-animation';

interface ImpostorConfig {
  id: string;
  label: string;
  slug: string;
  width: number;
  height: number;
  shadowX: number;
  shadowZ: number;
}

const IMPOSTOR_CONFIGS = new Map<string, ImpostorConfig>([
  ['unit.vanguard', {
    id: 'unit.vanguard',
    label: 'Vanguard',
    slug: 'vanguard',
    width: 1.27,
    height: 1.9,
    shadowX: 0.92,
    shadowZ: 0.64,
  }],
  ['unit.elementalist.fire', {
    id: 'unit.elementalist.fire',
    label: 'Fire Elementalist',
    slug: 'elementalist-fire',
    width: 1.72,
    height: 2.3,
    shadowX: 0.86,
    shadowZ: 0.62,
  }],
  ['unit.elementalist.water', {
    id: 'unit.elementalist.water',
    label: 'Water Elementalist',
    slug: 'elementalist-water',
    width: 1.72,
    height: 2.3,
    shadowX: 0.86,
    shadowZ: 0.62,
  }],
  ['unit.elementalist.ice', {
    id: 'unit.elementalist.ice',
    label: 'Ice Elementalist',
    slug: 'elementalist-ice',
    width: 1.72,
    height: 2.3,
    shadowX: 0.86,
    shadowZ: 0.62,
  }],
  ['unit.elementalist.lightning', {
    id: 'unit.elementalist.lightning',
    label: 'Lightning Elementalist',
    slug: 'elementalist-lightning',
    width: 1.72,
    height: 2.3,
    shadowX: 0.86,
    shadowZ: 0.62,
  }],
  ['unit.spear-guard', {
    id: 'unit.spear-guard',
    label: 'Spear Guard',
    slug: 'spear-guard',
    width: 1.65,
    height: 2.2,
    shadowX: 0.86,
    shadowZ: 0.62,
  }],
  ['unit.ranger', {
    id: 'unit.ranger',
    label: 'Ranger',
    slug: 'ranger',
    width: 1.18,
    height: 1.56,
    shadowX: 0.72,
    shadowZ: 0.52,
  }],
  ['unit.scout', {
    id: 'unit.scout',
    label: 'Scout',
    slug: 'scout',
    width: 0.96,
    height: 1.24,
    shadowX: 0.64,
    shadowZ: 0.46,
  }],
  ['unit.engineer', {
    id: 'unit.engineer',
    label: 'Engineer',
    slug: 'engineer',
    width: 1.22,
    height: 1.58,
    shadowX: 0.78,
    shadowZ: 0.56,
  }],
  ['unit.golem', {
    id: 'unit.golem',
    label: 'Golem',
    slug: 'golem',
    width: 2.05,
    height: 2.46,
    shadowX: 1.28,
    shadowZ: 0.9,
  }],
  ['unit.siege-construct', {
    id: 'unit.siege-construct',
    label: 'Siege Construct',
    slug: 'siege-construct',
    // Keep the 192x256 source frame near its native aspect. The prior
    // 2.55x1.82 plane stretched this wide vehicle almost 2x horizontally,
    // making the elevated turnaround read like a flattened top view.
    width: 2.25,
    height: 3.0,
    shadowX: 1.45,
    shadowZ: 1.0,
  }],
]);

type ImpostorActionMaterials = Readonly<Record<ImpostorAnimationAction, readonly pc.StandardMaterial[]>>;

interface ImpostorHandle {
  root: pc.Entity;
  billboard: pc.Entity;
  plane: pc.Entity;
  shadow: pc.Entity;
  materials: ImpostorActionMaterials;
  configId: string;
  baseWidth: number;
  baseHeight: number;
  facingYawDegrees: number;
  viewFrame: number;
  animationFrame: number;
  animationSample: ImpostorAnimationSample;
  update: () => void;
}

interface ImpostorResources {
  materials: pc.StandardMaterial[];
  textures: pc.Texture[];
  promise: Promise<ImpostorActionMaterials | null> | null;
  requestAction?: (action: ImpostorAnimationAction) => void;
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
  // Keep the current player-side boundary, but use the same five-action
  // animated WebP runtime for every configured production unit.
  private readonly useAnimatedUnitImpostors = true;
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

    const impostorConfig = this.useAnimatedUnitImpostors && playerId === 0
      ? IMPOSTOR_CONFIGS.get(id)
      : undefined;
    if (impostorConfig) {
      // Do not flash the old green primitive model while the WebP action set is
      // decoding. Restore it only if the animated impostor cannot load at all.
      for (const primitive of fallback) primitive.enabled = false;
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
          const allegiance = playerId === 0 ? 'player' : playerId === 2 ? 'neutral' : 'enemy';
          const key = `${id}:${allegiance}`;
          let material = this.teamMaterials.get(key);
          if (!material) {
            material = (mesh.material as pc.StandardMaterial).clone();
            material.diffuse = playerId === 0
              ? new pc.Color(.10, .62, .48)
              : playerId === 2
                ? new pc.Color(.44, .36, .22)
                : new pc.Color(.78, .16, .12);
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

  syncImpostor(
    handle: VisualModel | null,
    headingDegrees: number,
    animationSample?: ImpostorAnimationSample,
  ): void {
    const impostor = handle?.impostor;
    if (!impostor) return;

    // Every canonical WebP unit follows exactly the same presentation path:
    // unit heading selects one of eight observer-side views, while the plane
    // itself remains camera-facing in world space.
    impostor.facingYawDegrees = headingDegrees;
    const previousAction = impostor.animationSample.action;
    if (animationSample) impostor.animationSample = animationSample;
    impostor.billboard.setEulerAngles(0, RTS_CAMERA_YAW_DEGREES, 0);

    const viewFrame = stableImpostorFrameForHeading(headingDegrees, impostor.viewFrame);
    const sample = impostor.animationSample;
    const animationFrame = impostorAnimationFrame(sample.action, sample.elapsedSeconds);
    this.impostorResources.get(impostor.configId)?.requestAction?.(sample.action);
    if (
      viewFrame === impostor.viewFrame
      && animationFrame === impostor.animationFrame
      && sample.action === previousAction
      && impostor.plane.render?.material === impostor.materials[sample.action][impostorAnimationMaterialIndex(viewFrame, animationFrame)]
    ) return;

    const actionMaterials = impostor.materials[sample.action] ?? impostor.materials.IDLE;
    const materialIndex = impostorAnimationMaterialIndex(viewFrame, animationFrame);
    const material = actionMaterials[materialIndex] ?? impostor.materials.IDLE[materialIndex];
    if (impostor.plane.render && material) impostor.plane.render.material = material;

    // The uploaded pack already shares one scale factor and one foot baseline
    // across every direction/action. Do not reintroduce old per-view scale hacks.
    impostor.plane.setLocalPosition(0, impostor.baseHeight * 0.5, 0);
    impostor.plane.setLocalScale(impostor.baseWidth, 1, impostor.baseHeight);
    impostor.viewFrame = viewFrame;
    impostor.animationFrame = animationFrame;
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
      if (this.disposed || handle.released) return;
      if (!materials) {
        for (const primitive of fallback) primitive.enabled = true;
        return;
      }
      const pivot = new pc.Entity(`${config.label} Impostor Pivot`);
      const billboard = new pc.Entity(`${config.label} Impostor Billboard`);
      const plane = new pc.Entity(`${config.label} Impostor`);
      plane.addComponent('render', {
        type: 'plane',
        material: materials.IDLE[0],
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
        const facingYawDegrees = handle.impostor?.facingYawDegrees ?? parent.getEulerAngles().y;
        this.syncImpostor(handle, facingYawDegrees);
      };
      const initialFacingYaw = parent.getEulerAngles().y;
      handle.entity = pivot;
      handle.impostor = {
        root: parent,
        billboard,
        plane,
        shadow,
        materials,
        configId: config.id,
        baseWidth: config.width,
        baseHeight: config.height,
        facingYawDegrees: initialFacingYaw,
        viewFrame: -1,
        animationFrame: -1,
        animationSample: { action: 'IDLE', elapsedSeconds: 0 },
        update,
      };
      this.impostorUpdates.add(update);
      this.app.on('update', update);
      update();
    });
  }

  private loadImpostorMaterials(config: ImpostorConfig): Promise<ImpostorActionMaterials | null> {
    let resources = this.impostorResources.get(config.id);
    if (!resources) {
      resources = { materials: [], textures: [], promise: null };
      this.impostorResources.set(config.id, resources);
    }
    if (resources.promise) return resources.promise;

    const loadImage = (
      url: string,
      priority: 'high' | 'low' | 'auto' = 'auto',
    ): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = priority;
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load ${config.label} impostor frame: ${url}`));
      image.src = url;
    });

    const actionMaterials = {} as Record<ImpostorAnimationAction, readonly pc.StandardMaterial[]>;
    const requests = new Map<ImpostorAnimationAction, Promise<readonly pc.StandardMaterial[] | null>>();
    const loadAction = (action: ImpostorAnimationAction): Promise<readonly pc.StandardMaterial[] | null> => {
      const existing = requests.get(action);
      if (existing) return existing;
      if (this.disposed) return Promise.resolve(null);
      const promise = loadImage(
        `${import.meta.env.BASE_URL}${impostorAtlasFile(config.slug, action)}`,
        action === 'IDLE' ? 'high' : 'auto',
      ).then((image) => {
        if (this.disposed) return null;
        const texture = new pc.Texture(this.app.graphicsDevice, {
          name: `${config.id}.atlas.${action}`, mipmaps: false, srgb: true, flipY: false,
          minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR,
          addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
        });
        texture.setSource(image);
        resources!.textures.push(texture);
        const materials = Array.from({ length: 32 }, (_, index) => {
          const rect = impostorAtlasRect(index);
          const material = new pc.StandardMaterial();
          material.name = `${config.id}.atlas.${action}.${index}`;
          material.useLighting = false;
          material.emissive = new pc.Color(0.75, 0.74, 0.70);
          material.emissiveMap = texture;
          material.opacityMap = texture;
          material.emissiveMapTiling.set(rect.width, rect.height);
          material.opacityMapTiling.set(rect.width, rect.height);
          material.emissiveMapOffset.set(rect.x, rect.y);
          material.opacityMapOffset.set(rect.x, rect.y);
          material.opacityMapChannel = 'a';
          material.alphaTest = 0.12;
          material.cull = pc.CULLFACE_NONE;
          material.update();
          resources!.materials.push(material);
          return material;
        });
        actionMaterials[action] = materials;
        return materials;
      }).catch((error: unknown) => {
        // Cache failures too: never retry every render frame or resurrect disposed resources.
        console.warn(`${config.label} ${action} atlas unavailable; using Idle/fallback.`, error);
        return null;
      });
      requests.set(action, promise);
      return promise;
    };
    resources.promise = loadAction('IDLE').then((idle) => {
      if (!idle || this.disposed) return null;
      for (const action of ['MOVE', 'ATTACK', 'HIT', 'DEATH'] as const) actionMaterials[action] = idle;
      // Only the encountered action is loaded, once per unit config; no roster preload.
      resources!.requestAction = (action) => { void loadAction(action); };
      return actionMaterials;
    });

    return resources.promise!;
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
