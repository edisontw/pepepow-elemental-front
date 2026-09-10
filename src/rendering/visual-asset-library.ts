import * as pc from 'playcanvas';
import manifest from '../../data/assets/manifest.json';
import { stableImpostorFrameForHeading } from './impostor-frame';
import { VANGUARD_IMPOSTOR_FRAME_FILES, vanguardImpostorFrameUrl } from './vanguard-impostor-frames';

interface ImpostorHandle {
  billboard: pc.Entity;
  plane: pc.Entity;
  shadow: pc.Entity;
  frame: number;
  update: () => void;
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
  private readonly impostorMaterials: pc.StandardMaterial[] = [];
  private readonly impostorUpdates = new Set<() => void>();
  private readonly vanguardImpostorTextures: pc.Texture[] = [];
  private readonly vanguardShadowMaterial: pc.StandardMaterial;
  private vanguardImpostorPromise: Promise<readonly pc.StandardMaterial[] | null> | null = null;
  private disposed = false;

  constructor(private readonly app: pc.Application) {
    this.vanguardShadowMaterial = new pc.StandardMaterial();
    this.vanguardShadowMaterial.name = 'VANGUARD_IMPOSTOR_SHADOW';
    this.vanguardShadowMaterial.useLighting = false;
    this.vanguardShadowMaterial.diffuse = new pc.Color(0.02, 0.025, 0.025);
    this.vanguardShadowMaterial.opacity = 0.24;
    this.vanguardShadowMaterial.blendType = pc.BLEND_NORMAL;
    this.vanguardShadowMaterial.depthWrite = false;
    this.vanguardShadowMaterial.cull = pc.CULLFACE_NONE;
    this.vanguardShadowMaterial.update();
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

    // The approved Vanguard WebP set has baked blue ownership panels. Use it
    // for the player only; enemy Vanguard stays on the recolorable GLB path.
    if (id === 'unit.vanguard' && playerId === 0) {
      this.attachVanguardImpostor(parent, fallback, handle);
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
    if (!impostor || this.impostorMaterials.length !== VANGUARD_IMPOSTOR_FRAME_FILES.length) return;

    // Cancel the parent's unit heading so the image plane remains camera-facing;
    // the selected directional frame carries the visible unit orientation.
    impostor.billboard.setLocalEulerAngles(0, 45 - headingDegrees, 0);
    const frame = stableImpostorFrameForHeading(headingDegrees, impostor.frame);
    if (frame === impostor.frame) return;
    const material = this.impostorMaterials[frame];
    if (impostor.plane.render && material) impostor.plane.render.material = material;
    impostor.frame = frame;
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
    for (const material of this.impostorMaterials) material.destroy();
    for (const texture of this.vanguardImpostorTextures) texture.destroy();
    this.vanguardShadowMaterial.destroy();
    for (const asset of this.registered) {
      asset.unload();
      this.app.assets.remove(asset);
    }
    this.impostorUpdates.clear();
    this.teamMaterials.clear();
    this.impostorMaterials.length = 0;
    this.vanguardImpostorTextures.length = 0;
    this.assets.clear();
    this.vanguardImpostorPromise = null;
  }

  private attachVanguardImpostor(parent: pc.Entity, fallback: readonly pc.Entity[], handle: VisualModel): void {
    void this.loadVanguardImpostorMaterials().then((materials) => {
      if (!materials || this.disposed || handle.released) return;
      const pivot = new pc.Entity('Vanguard Impostor Pivot');
      const billboard = new pc.Entity('Vanguard Impostor Billboard');
      const plane = new pc.Entity('Vanguard Impostor');
      plane.addComponent('render', {
        type: 'plane',
        material: materials[0],
        castShadows: false,
        receiveShadows: false,
      });
      plane.setLocalEulerAngles(90, 0, 0);

      // Match the canonical Vanguard's nominal 1.9 m stature and pin the
      // sprite's bottom edge to the unit origin so feet stay planted.
      plane.setLocalPosition(0, 0.95, 0);
      plane.setLocalScale(1.27, 1, 1.9);
      billboard.addChild(plane);
      pivot.addChild(billboard);
      parent.addChild(pivot);

      // Keep the contact shadow outside the bobbing unit root so it remains
      // visually attached to the terrain rather than floating with the sprite.
      const shadow = new pc.Entity('Vanguard Impostor Shadow');
      shadow.addComponent('render', {
        type: 'cylinder',
        material: this.vanguardShadowMaterial,
        castShadows: false,
        receiveShadows: false,
      });
      shadow.setLocalScale(0.92, 0.018, 0.64);
      this.app.root.addChild(shadow);

      for (const primitive of fallback) primitive.enabled = false;

      const update = (): void => {
        const position = parent.getPosition();
        shadow.enabled = parent.enabled;
        shadow.setPosition(position.x, 0.022, position.z);

        // Primitive 3D units use a stronger procedural gait bob. Counter part
        // of that positive Y motion for the flat sprite so it reads as weight,
        // not as a card bouncing above the ground. Negative death fall remains.
        pivot.setLocalPosition(0, -Math.max(0, position.y) * 0.45, 0);
        this.syncImpostor(handle, parent.getEulerAngles().y);
      };
      handle.entity = pivot;
      handle.impostor = { billboard, plane, shadow, frame: -1, update };
      this.impostorUpdates.add(update);
      this.app.on('update', update);
      update();
    });
  }

  private loadVanguardImpostorMaterials(): Promise<readonly pc.StandardMaterial[] | null> {
    if (this.vanguardImpostorPromise) return this.vanguardImpostorPromise;

    const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load Vanguard impostor frame: ${url}`));
      image.src = url;
    });

    this.vanguardImpostorPromise = Promise.all(
      VANGUARD_IMPOSTOR_FRAME_FILES.map((_, frame) => loadImage(
        vanguardImpostorFrameUrl(frame, import.meta.env.BASE_URL),
      )),
    ).then((images) => {
      if (this.disposed) return null;

      for (const [frame, image] of images.entries()) {
        const texture = new pc.Texture(this.app.graphicsDevice, {
          name: `unit.vanguard.impostor.${frame}`,
          mipmaps: false,
          minFilter: pc.FILTER_LINEAR,
          magFilter: pc.FILTER_LINEAR,
          addressU: pc.ADDRESS_CLAMP_TO_EDGE,
          addressV: pc.ADDRESS_CLAMP_TO_EDGE,
        });
        texture.setSource(image);
        this.vanguardImpostorTextures.push(texture);

        const material = new pc.StandardMaterial();
        material.name = `VANGUARD_IMPOSTOR_${frame}`;
        material.useLighting = false;
        material.emissive = new pc.Color(1, 1, 1);
        material.emissiveMap = texture;
        material.opacityMap = texture;
        material.opacityMapChannel = 'a';
        material.alphaTest = 0.12;
        material.cull = pc.CULLFACE_NONE;
        material.update();
        this.impostorMaterials.push(material);
      }

      return this.impostorMaterials;
    }).catch((error: unknown) => {
      console.warn('Vanguard impostor frame load failed; using fallback geometry.', error);
      return null;
    });

    return this.vanguardImpostorPromise;
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
