import * as pc from 'playcanvas';
import { type GeneratedWorld } from '../world/world-definition';
import manifest from '../../data/assets/manifest.json';
import { environmentPlacements } from './environment-placement-system';
import { terrainSurfaceControl } from './terrain-surface-control';

/** B0: bridge owns surfaces; shared atlas is loaded through the existing registry.
 * World-space mapping cannot swim with camera movement. No simulation state writes.
 */
export class TerrainMaterialSet {
  private readonly asset: pc.Asset;
  private readonly control: pc.Texture;
  private disposed = false;

  constructor(app: pc.Application, world: GeneratedWorld, surfaces: readonly [pc.StandardMaterial, number][]) {
    // Full-density composition keeps forest floors stable across quality tiers.
    const pixels = terrainSurfaceControl(world, environmentPlacements(world, false));
    const low = new URLSearchParams(window.location.search).get('quality')?.trim().toLowerCase() === 'low';
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
        material.setParameter('environmentDetail', low ? 0 : 1);
        material.getShaderChunks('glsl').set('diffusePS', TERRAIN_DIFFUSE);
        if (!low) material.getShaderChunks('glsl').set('normalMapPS', TERRAIN_NORMAL);
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

// World-space noise breaks the visible mirror-grid without moving with the camera.
// Low quality uses one atlas sample; normal uses two offset, rotated samples.
const TERRAIN_DIFFUSE = `
uniform sampler2D environmentControl;
uniform vec2 environmentSize;
uniform float environmentTile;
uniform float environmentDetail;
float groundHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float groundNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(groundHash(i), groundHash(i + vec2(1.0, 0.0)), f.x),
               mix(groundHash(i + vec2(0.0, 1.0)), groundHash(i + vec2(1.0)), f.x), f.y);
}
vec3 groundSample(float tile, vec2 p) {
    vec2 q = abs(fract(p * 0.5) * 2.0 - 1.0);
    q = mix(vec2(0.025), vec2(0.975), q);
    vec2 uv = (vec2(mod(tile, 4.0), floor(tile / 4.0)) + q) / vec2(4.0, 2.0);
    return {STD_DIFFUSE_TEXTURE_DECODE}(texture2DBias({STD_DIFFUSE_TEXTURE_NAME}, uv, textureBias)).rgb;
}
vec3 groundTile(float tile, vec2 p) {
    vec3 a = groundSample(tile, p);
    if (environmentDetail < 0.5) return a;
    vec2 rotated = mat2(0.8, -0.6, 0.6, 0.8) * p * 0.83 + vec2(3.71, 8.19);
    return mix(a, groundSample(tile, rotated), 0.25 + groundNoise(p * 0.36) * 0.5);
}
void getAlbedo() {
    vec2 p = vPositionW.xz;
    float broad = groundNoise(p * 0.085);
    float patches = groundNoise(p * 0.27 + 14.0);
    vec2 uv = p / 4.8;
    if (environmentTile < 0.0) {
        vec4 weights = texture2D(environmentControl, (p + floor(environmentSize * 0.5)) / environmentSize);
        float dry = smoothstep(0.35, 0.85, broad) * (0.18 + (1.0 - weights.a) * 0.45);
        vec3 meadow = mix(groundTile(0.0, uv), groundTile(1.0, uv * 0.73 + 0.31), dry);
        meadow = mix(meadow, groundTile(7.0, uv * 0.67), smoothstep(0.62, 0.85, patches) * 0.18);
        vec3 surface = mix(meadow, groundTile(3.0, uv), weights.r * 0.94);
        surface = mix(surface, groundTile(6.0, uv * 0.8), weights.g * 0.82);
        surface = mix(surface, groundTile(5.0, uv), weights.b * 0.8);
        // Cool forest hollows and warm dry ground: local depth, not global darkness.
        vec3 grade = mix(vec3(1.02, 1.02, 0.94), vec3(0.88, 0.97, 0.98), weights.r);
        dAlbedo = surface * grade * (0.82 + broad * 0.18);
    } else {
        dAlbedo = groundTile(environmentTile, uv) * (0.84 + broad * 0.13);
        if (environmentTile == 4.0) dAlbedo *= vec3(1.06, 1.02, 0.95);
    }
}
`;

// Small surface-normal variation gives grazing daylight material relief. No
// displacement: buildings, unit feet, crossing and picking stay on the same plane.
const TERRAIN_NORMAL = `
void getNormal() {
    vec2 p = vPositionW.xz;
    float sx = sin(p.x * 3.1 + sin(p.y * 1.7)) * 0.065;
    float sz = cos(p.y * 2.8 + sin(p.x * 1.3)) * 0.065;
    dNormalW = normalize(dVertexNormalW + vec3(sx, 0.0, sz));
}
`;
