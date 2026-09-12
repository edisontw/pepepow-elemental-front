# PEPEPOW Elemental Front — Canonical Unit Impostor Asset Spec

**Status:** CANONICAL — WebP unit impostor production  
**Scope:** player-unit visual assets only  
**Runtime authority:** presentation only  
**Repository/UI language:** English

This specification defines the clean eight-direction source-art and export contract for unit impostors. It supersedes the previous asset-recovery approach that treated per-unit frame remaps, direction fallbacks, mirrored substitutions, or repeated cardinal frames as an acceptable primary asset solution.

Existing runtime workarounds may remain temporarily until replacement binaries are uploaded and verified. New art must not be designed around those workarounds.

For the current approved WebP production path, this file also supersedes the older general recommendation in `docs/VISUAL_IMPLEMENTATION_BRIEF.md` to avoid independently generated directional art. The eight views are permitted only when they are generated as one controlled canonical set using the identity, camera, landmark, crop, and QA rules below.

---

## 1. Canonical runtime visual sets

The simulation has eight unit archetypes, with `ELEMENTALIST` expanding into four immutable visual alignments. The complete replacement batch therefore contains eleven visual slugs.

| Runtime visual | Asset slug |
| --- | --- |
| Vanguard | `vanguard` |
| Spear Guard | `spear-guard` |
| Ranger | `ranger` |
| Scout | `scout` |
| Elementalist — Fire | `elementalist-fire` |
| Elementalist — Ice | `elementalist-ice` |
| Elementalist — Lightning | `elementalist-lightning` |
| Elementalist — Water | `elementalist-water` |
| Engineer | `engineer` |
| Golem | `golem` |
| Siege Construct | `siege-construct` |

The neutral Elementalist concept is a design reference only and is not a runtime impostor set.

---

## 2. Canonical direction order and filenames

Each visual slug requires exactly eight genuine source views and exactly eight final WebP files. No final direction may be synthesized by mirroring, substituting another direction, or reusing a cardinal view.

Direction names describe **camera position around the unit**, not the apparent left/right direction the character happens to point on the 2D image.

| Index | Final filename | Canonical observer view |
| ---: | --- | --- |
| 0 | `00-front.webp` | camera directly in front of the unit; front face/armor visible |
| 1 | `01-front-left.webp` | camera at the unit's front-left quarter; front + anatomical left side visible |
| 2 | `02-left.webp` | camera directly on the unit's anatomical left side |
| 3 | `03-rear-left.webp` | camera at the unit's rear-left quarter; rear + anatomical left side visible |
| 4 | `04-rear.webp` | camera directly behind the unit |
| 5 | `05-rear-right.webp` | camera at the unit's rear-right quarter; rear + anatomical right side visible |
| 6 | `06-right.webp` | camera directly on the unit's anatomical right side |
| 7 | `07-front-right.webp` | camera at the unit's front-right quarter; front + anatomical right side visible |

A stable asymmetric landmark must be preserved across all eight views: shield side, weapon hand, quiver, backpack, staff fitting, shoulder plate, maintenance platform, or another unit-specific feature. This landmark is the primary QA check against accidental mirroring or left/right inversion.

---

## 3. Raw generation contract

Generate **eight individual raw images per visual slug**. Do not generate one 4x2 source sheet for the canonical batch.

Preferred raw source:

- PNG with alpha;
- square 1024×1024 or larger;
- one unit only;
- complete unit and all essential equipment visible;
- no cropping at the canvas edge;
- no text, labels, UI, logo, watermark, border, or direction arrow;
- transparent background preferred;
- if transparency is unavailable, use one flat, uniform, high-contrast removable background color;
- no environment or scenery;
- no baked ground plane and **no baked contact shadow**;
- no motion blur or depth-of-field blur;
- neutral idle-ready pose;
- identical equipment, handedness, proportions, materials, and pose family in all eight directions.

The art-production prompt pack is `media/prompts/images/WEBP_IMPOSTOR_BATCH_PROMPTS.md`.

### Camera

- elevated 2.5D RTS camera;
- approximately 30–35° downward pitch;
- near-orthographic / long-lens perspective with minimal distortion;
- identical pitch, focal character, camera distance, and framing intent across all eight views;
- camera orbits around the unit in exact 45° increments; the unit design itself does not mutate between views.

### Lighting

Use a camera-independent studio/world light rig so the material lighting remains coherent while the camera orbits:

- broad key light from world upper-left/front;
- weak cool fill from the opposite side;
- restrained rim separation only when needed;
- no direction-specific dramatic relighting;
- elemental emissive accents remain local and restrained.

### Ground shadow policy

Final WebP frames contain **no baked ground/contact shadow**. Runtime presentation owns the contact shadow. This prevents an orbiting baked shadow from revealing inconsistent light direction or moving with the billboard.

---

## 4. Final frame contract

Every final file must be:

- `192×256` pixels;
- RGBA WebP with transparency;
- lossless WebP export preferred;
- transparent background outside the unit silhouette;
- no baked contact shadow;
- no mirrored or duplicated direction;
- canonical filename exactly as defined above.

### Crop and anchor rules

Cropping must be content-aware but must **not** rescale each direction independently.

For each visual slug:

1. remove/confirm the background on all eight source images;
2. compute the visible alpha bounds for all eight views;
3. calculate **one shared scale factor** from the largest bounds in that eight-view set;
4. apply that same scale factor to all eight directions;
5. horizontally center the visible bounds;
6. align the lowest visible unit/equipment pixel to one shared baseline near the bottom of the canvas;
7. retain transparent safety padding on every side;
8. never rotate, mirror, warp, or direction-remap during crop/export.

This shared-scale rule prevents front, side, and diagonal frames from visibly pulsing in size during direction switching.

### Apparent-scale classes

Canvas occupancy is a packing rule, not gameplay/world scale. Runtime plane dimensions remain responsible for actual in-world size.

- ordinary human units: fit essential silhouette within roughly 86–90% canvas width and 88–92% canvas height;
- Spear Guard / Elementalists: allow slightly larger packing bounds so long pike/staff geometry does not make the body unnecessarily tiny;
- Golem: allow up to roughly 94% width/height;
- Siege Construct: prioritize width, up to roughly 96% canvas width, while preserving all four wheels and the complete chassis.

All eight directions of the same slug must use the same scale and baseline.

---

## 5. Visual language

All units use the established **Arcane-Industrial Frontier** language:

- late-medieval military readability;
- early-industrial field engineering;
- elemental crystal / arcane power technology;
- weathered dark steel, iron, leather, stone where appropriate, sparse brass;
- broad readable silhouettes before small detail;
- medium-detail stylized PBR surfaces;
- slightly exaggerated proportions for RTS readability;
- human infantry remains clearly human;
- constructs and siege machinery remain heavy engineered objects rather than futuristic robots/vehicles.

Ownership and element identity remain separate:

- replaceable team-color zones communicate faction ownership;
- Fire / Water / Ice / Lightning materials and emissive accents communicate elemental alignment/state.

Do not bake a single faction color across the entire unit.

---

## 6. Canonical local staging layout

Raw inputs are local working files and are intentionally not committed:

```text
art/impostor-source/
  <slug>/
    00-front.png
    01-front-left.png
    02-left.png
    03-rear-left.png
    04-rear.png
    05-rear-right.png
    06-right.png
    07-front-right.png
```

The conversion script writes a manual-upload tree:

```text
art/impostor-upload/
  public/assets/impostors/
    <slug>/
      00-front.webp
      01-front-left.webp
      02-left.webp
      03-rear-left.webp
      04-rear.webp
      05-rear-right.webp
      06-right.webp
      07-front-right.webp
```

Both staging roots are ignored by Git. Final approved binaries are manually uploaded into the matching repository paths under `public/assets/impostors/`.

---

## 7. Asset QA gate before upload

A visual set is upload-ready only when all eight directions pass:

- same unit identity and equipment;
- same weapon handedness and asymmetric landmarks;
- genuine front, rear, left, right, and four diagonal views;
- no mirror-derived view;
- no duplicated view;
- no missing/empty file;
- same camera elevation and projection character;
- same pose family;
- no direction-specific size jump;
- feet/chassis share a stable baseline after export;
- alpha edges are clean at 100% and at RTS scale;
- no baked shadow, scenery, text, or watermark.

If one direction fails, regenerate that direction using the accepted set as visual reference. Do not compensate with runtime remapping.

---

## 8. Integration gate

Do not alter runtime direction mapping while the replacement batch is incomplete.

After all eleven directories have eight valid replacement files on GitHub `main`:

1. verify all 88 binaries are present and non-empty;
2. replace temporary per-asset source-order/fallback mappings with one canonical identity asset order;
3. retain only mathematically necessary camera-relative heading selection and hysteresis;
4. keep billboard camera-facing behavior independent of unit facing;
5. run narrow mapping/path tests plus one TypeScript/build pass;
6. perform one final WebGL all-direction readability check.

A per-asset remap is then considered a defect signal, not the default production mechanism.
