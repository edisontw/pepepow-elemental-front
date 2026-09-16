# Environment asset production — B0–B5

Status: implementation complete; manual screen acceptance pending (cloud browser reports WebGL not supported).

## B0 integration

`scene.ts` → `GeneratedWorldRenderBridge` owns surfaces and crossings.
`ResourceRenderBridge` → `EnvironmentDetailLayer` owns forest and prop art.
Both asset loaders reuse `data/assets/manifest.json`, `pc.Asset`, and Vite BASE_URL.
No authoritative simulation, navigation, replay, world-generation, or ruleset changes.

## Original art and runtime paths

Created with built-in ImageGen for this repository; no third-party art or new dependency.
WebP encoding uses ImageMagick (quality 86 ground / 88 transparent art), preserving alpha.

- `assets/environment/terrain/frontier-ground-atlas.webp`: 4 × 2 materials:
  meadow, dry grass, soil, needles/moss, road, wet mud, scree, flower meadow.
- `assets/environment/trees/conifer-atlas.webp`: 3 × 2:
  Tall Fir A/B, Medium Spruce/Pine, Sapling, Hazel Shrub.
- `assets/environment/props/frontier-props-atlas.webp`: 4 × 3:
  upright/broken marker, cross, wall, fence/broken fence, supplies/barrel,
  timber/stump, boulders, deadwood, scrub/flowers, roadside sign.

Art prompt specifications: original Arcane-Industrial Frontier, polished stylized
realistic hand-painted diffuse surfaces; olive greens, mossy stone, worn timber,
restrained highlights. Terrain: orthographic overhead full-bleed material sheet,
no labels, shadows, or perspective. Trees/props: separate padded transparent
cutouts in equal grid cells, consistent elevated orthographic camera and soft
upper-left illumination; jagged authored silhouettes, no toy primitive forms.

## Representation and safeguards

B1: world-space dual-scale atlas sampling, mirrored tile interiors, interpolated
biome/wetness control texture, material-treated soil aprons/road core/ruts/shoulders.
Vertex-color terrain is retained if the atlas fails to load.

B2/B3: fixed-camera 2.5D environment impostors (an existing supported runtime
format). Six distinct tree archetypes; visual-only seeded placement, core/edge
hierarchy, pocket clearings and road/site setbacks. Ruin, village, settlement,
resource and roadside kits share a second atlas. This is not a rotatable 3D forest.

B4: restrained baked lighting and soft batched contact shadows. Ground wetness
and woodland floor provide value separation without a post-processing dependency.

B5: 12-metre spatial batches, depth-writing alpha test, per-cell visibility inside
batches, frustum culling, reduced density in `?quality=low`, no environment shadow
casters, no per-frame geometry regeneration, explicit teardown of meshes,
materials, textures and registry assets. Old primitive woodland/highland/scatter
paths and the per-frame legacy forest suppression scan were removed.
Missing optional sprite atlases omit dressing instead of adding substitute cones.

## Validation and remaining gate

Strict TypeScript and production build PASS. Targeted placement test PASS:
repeatability, source-data preservation, water/road exclusion, valid fog cell
mapping, all six tree classes, and low-quality count reduction.
The build script regenerates unrelated unit GLBs; these are not part of this change.

Manual acceptance must inspect normal and low quality at gameplay zoom: ground
scale/seams, canopy gaps, contact anchoring, roads, ruin/village context, selection
and fog readability, plus target-device FPS. Do not claim reference-quality visual
acceptance solely from build/test success. Hard gate 4 applies if WebGL is unavailable.

Cloud browser smoke: live Pages shell loads, but graphics initialization fails with
`WebGL not supported` in this browser. This is hard gate 4; no visual/FPS PASS claimed.
