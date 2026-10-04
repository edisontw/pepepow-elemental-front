import * as pc from 'playcanvas';

/** Grade baked character lighting without flattening armor or elemental highlights. */
export const UNIT_EMISSIVE = `
uniform vec3 material_emissive;
uniform float material_emissiveIntensity;
void getEmission() {
    dEmission = material_emissive * material_emissiveIntensity;
#ifdef STD_EMISSIVE_TEXTURE
    vec3 art = {STD_EMISSIVE_TEXTURE_DECODE}(texture2DBias({STD_EMISSIVE_TEXTURE_NAME}, {STD_EMISSIVE_TEXTURE_UV}, textureBias)).{STD_EMISSIVE_TEXTURE_CHANNEL};
    float luminance = dot(art, vec3(0.2126, 0.7152, 0.0722));
    // Lift deep armor detail, strengthen midtone separation, retain bright focus colors.
    vec3 graded = max(vec3(0.0), (art - vec3(0.18)) * 1.08 + vec3(0.195));
    graded = mix(vec3(dot(graded, vec3(0.2126, 0.7152, 0.0722))), graded, 1.06);
    dEmission *= mix(graded, art, smoothstep(0.65, 0.95, luminance));
#endif
#ifdef STD_EMISSIVE_VERTEX
    dEmission *= saturate(vVertexColor.{STD_EMISSIVE_VERTEX_CHANNEL});
#endif
}
`;

export function applyUnitArtMaterial(material: pc.StandardMaterial): void {
  material.emissiveIntensity = 1.08;
  material.getShaderChunks('glsl').set('emissivePS', UNIT_EMISSIVE);
}

/** One shared radial opacity texture; no per-unit allocation or additional draw. */
export function createUnitContactShadow(device: pc.GraphicsDevice): pc.Texture {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
    const fade = Math.max(0, 1 - radius * radius);
    pixels[(y * size + x) * 4 + 3] = Math.round(255 * fade * fade);
  }
  const texture = new pc.Texture(device, {
    name: 'UNIT_CONTACT_SHADOW', width: size, height: size,
    format: pc.PIXELFORMAT_RGBA8, mipmaps: false,
    minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  (texture.lock() as Uint8Array).set(pixels);
  texture.unlock();
  return texture;
}
