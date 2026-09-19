import * as pc from 'playcanvas';
import manifest from '../../data/assets/manifest.json';

/** Same stable manifest/Asset registry convention as VisualAssetLibrary. */
export class EnvironmentAssetLibrary {
  private readonly registered: pc.Asset[] = [];
  private readonly materials: pc.StandardMaterial[] = [];
  private disposed = false;
  constructor(private readonly app: pc.Application) {}

  load(sheet: 'trees' | 'props'): Promise<pc.StandardMaterial | null> {
    const id = `environment.${sheet}.atlas`;
    const entry = manifest.entries.find(e => e.id === id);
    if (!entry) return Promise.resolve(null);
    return new Promise(resolve => {
      const asset = new pc.Asset(id, 'texture', { url: `${import.meta.env.BASE_URL}${entry.path}` });
      asset.once('load', () => {
        if (this.disposed) { resolve(null); return; }
        const texture = asset.resource as pc.Texture;
        texture.addressU = texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        texture.anisotropy = 2;
        // Match top-left UVs for both ImageBitmap and HTMLImageElement.
        texture.flipY = false;
        const material = new pc.StandardMaterial();
        material.name = id;
        // Baked diffuse art, like existing unit impostors. Alpha test writes depth
        // and avoids sorted transparent forest fields. Vertex alpha owns per-cell fog.
        material.useLighting = false;
        material.emissive = new pc.Color(0.78, 0.8, 0.74);
        material.emissiveMap = texture;
        material.opacityMap = texture;
        material.opacityMapChannel = 'a';
        material.opacityVertexColor = true;
        material.alphaTest = 0.32;
        material.cull = pc.CULLFACE_NONE;
        material.update();
        this.materials.push(material);
        resolve(material);
      });
      asset.once('error', () => { console.warn(`Environment atlas unavailable: ${id}; optional dressing omitted.`); resolve(null); });
      this.registered.push(asset);
      this.app.assets.add(asset);
      this.app.assets.load(asset);
    });
  }
  destroy(): void {
    this.disposed = true;
    for (const material of this.materials) material.destroy();
    for (const asset of this.registered) { asset.unload(); this.app.assets.remove(asset); }
  }
}
