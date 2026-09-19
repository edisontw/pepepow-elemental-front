import * as pc from 'playcanvas';
import { RTS_CAMERA_YAW_DEGREES } from './impostor-frame';
import {
  buildingImpostorConfig,
  buildingImpostorFile,
  type BuildingImpostorConfig,
} from './building-impostor-assets';

interface BuildingImpostorResources {
  material: pc.StandardMaterial | null;
  texture: pc.Texture | null;
  promise: Promise<pc.StandardMaterial | null> | null;
}

export interface BuildingImpostorHandle {
  entity: pc.Entity | null;
  shadow: pc.Entity | null;
  footprint: pc.Entity | null;
  released: boolean;
}

/** Static one-view WebP presentation for completed player buildings. */
export class BuildingImpostorLibrary {
  private readonly resources = new Map<string, BuildingImpostorResources>();
  private readonly shadowMaterial: pc.StandardMaterial;
  private disposed = false;

  constructor(private readonly app: pc.Application) {
    this.shadowMaterial = new pc.StandardMaterial();
    this.shadowMaterial.name = 'BUILDING_IMPOSTOR_SHADOW';
    this.shadowMaterial.useLighting = false;
    this.shadowMaterial.diffuse = new pc.Color(0.02, 0.025, 0.025);
    this.shadowMaterial.opacity = 0.07;
    this.shadowMaterial.blendType = pc.BLEND_NORMAL;
    this.shadowMaterial.depthWrite = false;
    this.shadowMaterial.cull = pc.CULLFACE_NONE;
    this.shadowMaterial.update();
  }

  attach(
    parent: pc.Entity,
    fallback: readonly pc.Entity[],
    assetId: string,
    onUnavailable: () => void,
  ): BuildingImpostorHandle {
    const handle: BuildingImpostorHandle = {
      entity: null,
      shadow: null,
      footprint: null,
      released: false,
    };
    const config = buildingImpostorConfig(assetId);
    if (!config) {
      onUnavailable();
      return handle;
    }

    // Completed player buildings should not briefly expose their primitive
    // construction fallback while the final WebP is decoding.
    for (const primitive of fallback) primitive.enabled = false;

    void this.load(config).then((material) => {
      if (handle.released || this.disposed) return;
      if (!material) {
        for (const primitive of fallback) primitive.enabled = true;
        onUnavailable();
        return;
      }

      const pivot = new pc.Entity(`${config.label} Building Impostor Pivot`);
      const billboard = new pc.Entity(`${config.label} Building Impostor Billboard`);
      const plane = new pc.Entity(`${config.label} Building Impostor`);
      plane.addComponent('render', {
        type: 'plane',
        material,
        castShadows: false,
        receiveShadows: false,
      });
      plane.setLocalEulerAngles(90, 0, 0);
      plane.setLocalPosition(0, config.planeSize * 0.5, 0);
      plane.setLocalScale(config.planeSize, 1, config.planeSize);
      billboard.setLocalEulerAngles(0, RTS_CAMERA_YAW_DEGREES, 0);
      billboard.addChild(plane);
      pivot.addChild(billboard);
      parent.addChild(pivot);

      // Keep only a small, faint contact cue. The previous footprint-sized dark
      // oval read as a second object beneath the pre-rendered building artwork.
      const shadow = new pc.Entity(`${config.label} Building Impostor Shadow`);
      shadow.addComponent('render', {
        type: 'cylinder',
        material: this.shadowMaterial,
        castShadows: false,
        receiveShadows: false,
      });
      shadow.setLocalPosition(0, 0.018, 0);
      shadow.setLocalScale(config.shadowX * 0.62, 0.012, config.shadowZ * 0.62);
      parent.addChild(shadow);

      // The legacy strategic renderer draws a large ownership/footprint cylinder.
      // The WebP impostor already carries its own readable silhouette and shadow,
      // so keeping that cylinder creates the oversized cyan discs seen in-game.
      const footprint = parent.children.find((child) => child.name.endsWith(' Footprint')) as pc.Entity | undefined;
      if (footprint) footprint.enabled = false;

      for (const primitive of fallback) primitive.enabled = false;
      handle.entity = pivot;
      handle.shadow = shadow;
      handle.footprint = footprint ?? null;
    });

    return handle;
  }

  release(handle: BuildingImpostorHandle | null): void {
    if (!handle) return;
    handle.released = true;
    if (handle.footprint) handle.footprint.enabled = true;
    handle.entity?.destroy();
    handle.shadow?.destroy();
  }

  destroy(): void {
    this.disposed = true;
    for (const resource of this.resources.values()) {
      resource.material?.destroy();
      resource.texture?.destroy();
    }
    this.resources.clear();
    this.shadowMaterial.destroy();
  }

  private load(config: BuildingImpostorConfig): Promise<pc.StandardMaterial | null> {
    let resource = this.resources.get(config.assetId);
    if (!resource) {
      resource = { material: null, texture: null, promise: null };
      this.resources.set(config.assetId, resource);
    }
    if (resource.promise) return resource.promise;

    const url = `${import.meta.env.BASE_URL}${buildingImpostorFile(config)}`;
    resource.promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load ${config.label} building impostor: ${url}`));
      image.src = url;
    }).then((image) => {
      if (this.disposed) return null;
      const texture = new pc.Texture(this.app.graphicsDevice, {
        name: `${config.assetId}.building-impostor`,
        mipmaps: false,
        srgb: true,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      });
      texture.setSource(image);

      const material = new pc.StandardMaterial();
      material.name = `${config.assetId.toUpperCase().replaceAll('.', '_')}_BUILDING_IMPOSTOR`;
      material.useLighting = false;
      material.emissive = new pc.Color(1, 1, 1);
      material.emissiveMap = texture;
      material.opacityMap = texture;
      material.opacityMapChannel = 'a';
      material.alphaTest = 0.08;
      material.cull = pc.CULLFACE_NONE;
      material.update();

      resource!.texture = texture;
      resource!.material = material;
      return material;
    }).catch((error: unknown) => {
      console.warn(`${config.label} building impostor unavailable; using GLB fallback.`, error);
      return null;
    });

    return resource.promise;
  }
}
