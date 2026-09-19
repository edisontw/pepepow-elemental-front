import * as pc from 'playcanvas';
import { BiomeType, TerrainType, type GeneratedWorld } from '../world/world-definition';
import manifest from '../../data/assets/manifest.json';

/** B0: bridge owns surfaces; shared atlas is loaded through the existing registry.
 * World-space mapping cannot swim with camera movement. No simulation state writes.
 */
export class TerrainMaterialSet {
  private readonly asset: pc.Asset;
  private readonly control: pc.Texture;
  private disposed = false;

  constructor(app: pc.Application, world: GeneratedWorld, surfaces: readonly [pc.StandardMaterial, number][]) {
    const pixels = new Uint8Array(world.width * world.height * 4);
    for (let z = 0; z < world.height; z++) for (let x = 0; x < world.width; x++) {
      let wood = 0, rock = 0, wet = 0, n = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const xx = Math.max(0, Math.min(world.width - 1, x + dx));
        const zz = Math.max(0, Math.min(world.height - 1, z + dz));
        const i = zz * world.width + xx;
        wood += world.biome[i] === BiomeType.WOODLAND ? 1 : 0;
        rock += world.biome[i] === BiomeType.HIGHLANDS ? 1 : 0;
        wet += world.terrain[i] === TerrainType.WATER ? 1 : 0;
        n++;
      }
      const i = (z * world.width + x) * 4;
      pixels[i] = wood / n * 255;
      pixels[i + 1] = rock / n * 255;
      pixels[i + 2] = Math.min(255, wet / n * 380);
      pixels[i + 3] = world.moisture[z * world.width + x] ?? 128;
    }
    this.control = new pc.Texture(app.graphicsDevice, {
      name: 'Environment material weights', width: world.width, height: world.height,
      format: pc.PIXELFORMAT_RGBA8, mipmaps: false,
      minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      levels: [pixels],
    });
    const path = manifest.entries.find(e => e.id === 'environment.terrain.atlas')!.path;
    this.asset = new pc.Asset('environment.terrain.atlas', 'texture', { url: `${import.meta.env.BASE_URL}${path}` });
    this.asset.once('load', () => {
      if (this.disposed) return;
      const atlas = this.asset.resource as pc.Texture;
      atlas.addressU = atlas.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
      atlas.anisotropy = 4;
      // ImageBitmap ignores unpack flipping: use top-left UVs everywhere.
      atlas.flipY = false;
      for (const [material, tile] of surfaces) {
        material.diffuseMap = atlas;
        material.setParameter('environmentControl', this.control);
        material.setParameter('environmentSize', [world.width, world.height]);
        material.setParameter('environmentTile', tile);
        material.getShaderChunks('glsl').set('diffusePS', TERRAIN_DIFFUSE);
        material.update();
      }
    });
    this.asset.once('error', () => console.warn('Environment terrain atlas unavailable; retaining vertex-color surface.'));
    app.assets.add(this.asset);
    app.assets.load(this.asset);
    this.app = app;
  }
  private readonly app: pc.Application;
  destroy(): void {
    this.disposed = true;
    this.asset.unload();
    this.app.assets.remove(this.asset);
    this.control.destroy();
  }
}

// Mirrored local coordinates eliminate hard tile-wrap seams. Dual scales and a
// continuous world-space blend suppress the repeated mirrored pattern at RTS zoom.
const TERRAIN_DIFFUSE = `
uniform sampler2D environmentControl;
uniform vec2 environmentSize;
uniform float environmentTile;
vec3 groundTile(float tile, vec2 p) {
    vec2 q = abs(fract(p * 0.5) * 2.0 - 1.0);
    q = mix(vec2(0.018), vec2(0.982), q);
    vec2 uv = (vec2(mod(tile, 4.0), floor(tile / 4.0)) + q) / vec2(4.0, 2.0);
    return {STD_DIFFUSE_TEXTURE_DECODE}(texture2DBias({STD_DIFFUSE_TEXTURE_NAME}, uv, textureBias)).rgb;
}
void getAlbedo() {
    vec2 p = vPositionW.xz;
    float broad = 0.5 + 0.5 * sin(p.x * 0.21 + sin(p.y * 0.17)) * cos(p.y * 0.23);
    vec2 uv = p / 3.6;
    if (environmentTile < 0.0) {
        vec4 weights = texture2D(environmentControl, (p + floor(environmentSize * 0.5)) / environmentSize);
        vec3 meadow = mix(groundTile(0.0, uv), groundTile(1.0, uv * 0.73 + 0.31), broad * (0.18 + (1.0 - weights.a) * 0.4));
        meadow = mix(meadow, groundTile(7.0, uv * 0.57), 0.2 * broad);
        vec3 surface = mix(meadow, groundTile(3.0, uv), weights.r * 0.94);
        surface = mix(surface, groundTile(6.0, uv * 0.8), weights.g * 0.82);
        surface = mix(surface, groundTile(5.0, uv), weights.b * 0.8);
        dAlbedo = surface * (0.67 + broad * 0.14);
    } else {
        dAlbedo = groundTile(environmentTile, uv) * (0.70 + broad * 0.08);
        if (environmentTile == 4.0) dAlbedo *= 0.88;
    }
}
`;
