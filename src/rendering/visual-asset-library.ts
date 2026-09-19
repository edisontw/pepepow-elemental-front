import * as pc from 'playcanvas';
import manifest from '../../data/assets/manifest.json';
import { RTS_CAMERA_YAW_DEGREES, stableImpostorFrameForHeading } from './impostor-frame';
import {
  IMPOSTOR_ANIMATION_ACTIONS,
  animatedImpostorFrameFiles,
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
    if (
      viewFrame === impostor.viewFrame
      && animationFrame === impostor.animationFrame
      && sample.action === previousAction
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

    const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load ${config.label} impostor frame: ${url}`));
      image.src = url;
    });

    const filesByAction = Object.fromEntries(
      IMPOSTOR_ANIMATION_ACTIONS.map((action) => [
        action,
        animatedImpostorFrameFiles(config.slug, action),
      ]),
    ) as Record<ImpostorAnimationAction, readonly string[]>;
    const framesPerAction = filesByAction.IDLE.length;
    const framesPerDirection = 4;

    const createFrameMaterial = (
      action: ImpostorAnimationAction,
      frame: number,
      image: HTMLImageElement,
    ): pc.StandardMaterial => {
      const texture = new pc.Texture(this.app.graphicsDevice, {
        name: `${config.id}.impostor.${action.toLowerCase()}.${frame}`,
        mipmaps: false,
        srgb: true,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      });
      texture.setSource(image);
      resources!.textures.push(texture);

      const material = new pc.StandardMaterial();
      material.name = `${config.id.toUpperCase().replaceAll('.', '_')}_IMPOSTOR_${action}_${frame}`;
      material.useLighting = false;
      // Baked sprite art should sit inside the battlefield lighting range rather
      // than rendering at display-white emissive intensity.
      material.emissive = new pc.Color(0.82, 0.81, 0.77);
      material.emissiveMap = texture;
      material.opacityMap = texture;
      material.opacityMapChannel = 'a';
      material.alphaTest = 0.12;
      material.cull = pc.CULLFACE_NONE;
      material.update();
      resources!.materials.push(material);
      return material;
    };

    const nearestLoadedImage = (
      images: readonly (HTMLImageElement | null)[],
      frame: number,
    ): HTMLImageElement | null => {
      const direct = images[frame];
      if (direct) return direct;
      const localFrame = frame % framesPerDirection;
      const viewStart = frame - localFrame;
      for (let distance = 1; distance < framesPerDirection; distance += 1) {
        const previous = images[viewStart + ((localFrame - distance + framesPerDirection) % framesPerDirection)];
        if (previous) return previous;
        const next = images[viewStart + ((localFrame + distance) % framesPerDirection)];
        if (next) return next;
      }
      return null;
    };

    const loadActionImages = async (
      action: ImpostorAnimationAction,
    ): Promise<readonly (HTMLImageElement | null)[]> => {
      const files = filesByAction[action];
      const results = await Promise.allSettled(
        files.map((path) => loadImage(`${import.meta.env.BASE_URL}${path}`)),
      );
      const images = results.map((result) => result.status === 'fulfilled' ? result.value : null);
      const missing = results
        .map((result, frame) => result.status === 'rejected' ? files[frame] : null)
        .filter((path): path is string => path !== null);
      if (missing.length > 0) {
        console.warn(
          `${config.label} ${action.toLowerCase()} impostor has ${missing.length} missing/corrupt frame(s); using local fallback.`,
          missing,
        );
      }
      return images;
    };

    // Fast first paint: load only frame 00 for all eight directions (~1/20 of
    // the previous 160-frame startup request set). All actions temporarily share
    // those direction-correct preview materials while animation frames hydrate.
    const previewFiles = filesByAction.IDLE.filter((_, frame) => frame % framesPerDirection === 0);
    resources.promise = Promise.allSettled(
      previewFiles.map((path) => loadImage(`${import.meta.env.BASE_URL}${path}`)),
    ).then((previewResults) => {
      if (this.disposed) return null;
      const previewImages = previewResults.map((result) => result.status === 'fulfilled' ? result.value : null);
      const globalFallback = previewImages.find((image): image is HTMLImageElement => image !== null);
      if (!globalFallback) throw new Error(`No ${config.label} impostor preview frames could be loaded.`);

      const previewByView = previewImages.map((image) => image ?? globalFallback);
      const previewMaterialsByView = previewByView.map((image, view) =>
        createFrameMaterial('IDLE', view * framesPerDirection, image),
      );
      const previewMaterials = Array.from({ length: framesPerAction }, (_, frame) =>
        previewMaterialsByView[Math.floor(frame / framesPerDirection)]!,
      );
      const actionMaterials: Record<ImpostorAnimationAction, readonly pc.StandardMaterial[]> = {
        IDLE: previewMaterials,
        MOVE: previewMaterials,
        ATTACK: previewMaterials,
        HIT: previewMaterials,
        DEATH: previewMaterials,
      };

      const hydrateAction = async (action: ImpostorAnimationAction): Promise<void> => {
        if (this.disposed) return;
        const images = await loadActionImages(action);
        if (this.disposed || !images.some((image) => image !== null)) return;

        const materials: pc.StandardMaterial[] = [];
        for (let frame = 0; frame < framesPerAction; frame += 1) {
          const view = Math.floor(frame / framesPerDirection);
          const image = nearestLoadedImage(images, frame)
            ?? previewByView[view]
            ?? globalFallback;
          materials.push(createFrameMaterial(action, frame, image));
        }
        actionMaterials[action] = materials;
      };

      const hydratePriorityActions = async (): Promise<void> => {
        // Idle already has one direction-correct preview frame per view. Load
        // gameplay-readable actions first; full Idle is deliberately deferred.
        for (const action of ['MOVE', 'ATTACK', 'HIT', 'DEATH'] as const) {
          await hydrateAction(action);
          if (this.disposed) return;
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        }
      };

      window.setTimeout(() => { void hydratePriorityActions(); }, 250);
      // Full breathing/weight-shift Idle is cosmetic. Keep the static preview
      // for the opening seconds and only hydrate it after the battlefield has
      // already become interactive.
      window.setTimeout(() => { void hydrateAction('IDLE'); }, 12_000);
      return actionMaterials;
    }).catch((error: unknown) => {
      console.warn(`${config.label} animated impostor preview load failed; using fallback geometry.`, error);
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
