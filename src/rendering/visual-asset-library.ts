import * as pc from 'playcanvas';
import manifest from '../../data/assets/manifest.json';
import { impostorAtlasOffset, impostorFrameForHeading } from './impostor-frame';
import { VANGUARD_IMPOSTOR_DATA_URI } from './vanguard-impostor-data';

interface ImpostorHandle {
  billboard: pc.Entity;
  plane: pc.Entity;
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
  private vanguardImpostorPromise: Promise<readonly pc.StandardMaterial[] | null> | null = null;
  private disposed = false;

  constructor(private readonly app: pc.Application) {}

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

    // Current approved Vanguard art has baked blue team panels. Use it for the
    // player only; enemy Vanguard stays on the recolorable GLB fallback.
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
    if (!impostor || this.impostorMaterials.length !== 8) return;
    impostor.billboard.setLocalEulerAngles(0, 45 - headingDegrees, 0);
    const frame = impostorFrameForHeading(headingDegrees);
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
    }
    handle.entity?.destroy();
  }

  destroy(): void {
    this.disposed = true;
    for (const update of this.impostorUpdates) this.app.off('update', update);
    for (const material of this.teamMaterials.values()) material.destroy();
    for (const material of this.impostorMaterials) material.destroy();
    for (const asset of this.registered) {
      asset.unload();
      this.app.assets.remove(asset);
    }
    this.impostorUpdates.clear();
    this.teamMaterials.clear();
    this.impostorMaterials.length = 0;
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
      plane.setLocalPosition(0, 1.03, 0);
      plane.setLocalScale(1.35, 1, 2.06);
      billboard.addChild(plane);
      pivot.addChild(billboard);
      parent.addChild(pivot);
      for (const primitive of fallback) primitive.enabled = false;

      const update = (): void => this.syncImpostor(handle, parent.getEulerAngles().y);
      handle.entity = pivot;
      handle.impostor = { billboard, plane, frame: -1, update };
      this.impostorUpdates.add(update);
      this.app.on('update', update);
      update();
    });
  }

  private loadVanguardImpostorMaterials(): Promise<readonly pc.StandardMaterial[] | null> {
    if (this.vanguardImpostorPromise) return this.vanguardImpostorPromise;
    this.vanguardImpostorPromise = new Promise<readonly pc.StandardMaterial[] | null>((resolve) => {
      const asset = new pc.Asset('unit.vanguard.impostor', 'texture', { url: VANGUARD_IMPOSTOR_DATA_URI });
      asset.once('load', () => {
        if (this.disposed) {
          resolve(null);
          return;
        }
        const texture = asset.resource as pc.Texture;
        for (let frame = 0; frame < 8; frame += 1) {
          const [offsetX, offsetY] = impostorAtlasOffset(frame);
          const material = new pc.StandardMaterial();
          material.name = `VANGUARD_IMPOSTOR_${frame}`;
          material.useLighting = false;
          material.emissive = new pc.Color(1, 1, 1);
          material.emissiveMap = texture;
          material.emissiveMapTiling.set(0.25, 0.5);
          material.emissiveMapOffset.set(offsetX, offsetY);
          material.opacityMap = texture;
          material.opacityMapChannel = 'a';
          material.opacityMapTiling.set(0.25, 0.5);
          material.opacityMapOffset.set(offsetX, offsetY);
          material.alphaTest = 0.12;
          material.cull = pc.CULLFACE_NONE;
          material.update();
          this.impostorMaterials.push(material);
        }
        resolve(this.impostorMaterials);
      });
      asset.once('error', () => {
        console.warn('Vanguard impostor unavailable; using fallback geometry.');
        resolve(null);
      });
      this.registered.push(asset);
      this.app.assets.add(asset);
      this.app.assets.load(asset);
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
