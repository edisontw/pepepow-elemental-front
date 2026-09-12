---
name: elemental-front-webp-impostor-pipeline
description: Produce, normalize, manually upload, integrate, and validate canonical eight-direction WebP unit impostors for PEPEPOW Elemental Front.
---

# Elemental Front Canonical WebP Impostor Pipeline

Use this skill for player-unit WebP impostor production and integration.

This workflow is presentation-only. Do not change simulation, gameplay rules, deterministic state, replay identity, navigation, combat authority, or world generation to make art fit.

## 1. Mandatory read order

Read only:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/UNIT_IMPOSTOR_ASSET_SPEC.md`
3. `media/prompts/images/WEBP_IMPOSTOR_BATCH_PROMPTS.md` when art must be generated
4. this skill
5. only task-relevant rendering files after binary upload

GitHub `main` is the only source of truth. Repository and in-game UI remain English-only.

For the current approved WebP workflow, `docs/UNIT_IMPOSTOR_ASSET_SPEC.md` is the canonical asset-production contract and overrides older source-sheet / derived-from-3D recommendations for these eleven impostor sets.

## 2. Core rule: asset first, integration second

Do not repair bad source art with direction remaps, mirrored substitutions, repeated cardinal frames, or fallback directions.

The required order is:

1. audit the complete target visual roster;
2. generate all canonical raw directional images;
3. visually reject/regenerate inconsistent directions;
4. normalize/crop/export locally;
5. manually upload the complete replacement batch;
6. verify all binaries on GitHub `main`;
7. only then simplify/integrate runtime mapping;
8. perform narrow automated checks and one final WebGL visual acceptance pass.

Existing remaps/fallbacks are historical compatibility code only until replacement art is uploaded. They are not a production template.

## 3. Canonical visual roster

The complete batch contains eleven visual slugs:

```text
vanguard
spear-guard
ranger
scout
elementalist-fire
elementalist-ice
elementalist-lightning
elementalist-water
engineer
golem
siege-construct
```

Each slug requires exactly eight genuine directional frames:

```text
00-front.webp
01-front-left.webp
02-left.webp
03-rear-left.webp
04-rear.webp
05-rear-right.webp
06-right.webp
07-front-right.webp
```

Direction semantics are observer/camera positions around the unit. Never infer left/right only from which way a character appears to point on a 2D image. Use asymmetric equipment landmarks to verify anatomical side.

## 4. IMAGE_GENERATION_GATE

Generate **eight individual raw images per slug**, not one 4x2 contact sheet.

Use:

- `docs/UNIT_IMPOSTOR_ASSET_SPEC.md`
- `media/prompts/images/WEBP_IMPOSTOR_BATCH_PROMPTS.md`

Recommended sequence per slug:

1. generate and approve `00-front` as the identity anchor;
2. generate the other seven directions using the accepted front image as a visual reference when supported;
3. compare stable asymmetric landmarks across all eight;
4. reject any mirrored, duplicated, missing, or mutated direction before crop/export.

Do not use runtime code to compensate for a failed direction.

A source set is ready only when all eight images preserve the same unit identity, equipment, handedness, camera elevation, pose family, proportions, and lighting.

## 5. Local frame preparation

Use the repository tool:

```bash
python -m pip install -r scripts/art/requirements-impostors.txt
python scripts/art/build_unit_impostors.py --init
```

Put canonical raw sources under:

```text
art/impostor-source/<slug>/
```

Use the canonical direction basename. PNG with alpha is preferred; WebP/JPEG inputs are accepted when a flat removable background is required.

Build all eleven sets:

```bash
python scripts/art/build_unit_impostors.py --clean
```

The converter:

- removes a transparent or flat keyed background;
- computes alpha bounds for all eight views of one slug;
- derives one shared scale factor for that whole set;
- keeps all eight directions at that same scale;
- horizontally centers the visible bounds;
- aligns a shared lower baseline;
- exports `192x256` transparent lossless WebP;
- never mirrors, rotates, remaps, or substitutes a direction;
- validates exact filenames, dimensions, transparency, and non-empty output.

For sources that already have correct alpha and must not use key removal:

```bash
python scripts/art/build_unit_impostors.py --background transparent --clean
```

For a known flat source background:

```bash
python scripts/art/build_unit_impostors.py --background '#00FF00' --clean
```

The upload tree is:

```text
art/impostor-upload/public/assets/impostors/<slug>/
```

Validate an already built batch with:

```bash
python scripts/art/build_unit_impostors.py --check-only
```

## 6. MANUAL_BINARY_UPLOAD_GATE

The user manually uploads the output directories into:

```text
public/assets/impostors/<slug>/
```

Do not change runtime integration while any of the 88 required binaries is missing, empty, incorrectly named, or known to contain a bad direction.

After the user reports upload completion, verify GitHub `main` directly. User confirmation alone is not binary verification.

Required gate:

- 11 directories;
- 8 canonical WebP files in each directory;
- 88 files total;
- every file non-empty;
- no temporary alternate filename required.

## 7. Runtime integration after upload

Only after the complete binary gate passes:

1. audit `src/rendering/impostor-frame-assets.ts` and `src/rendering/visual-asset-library.ts`;
2. remove temporary Engineer/Water/Golem/Siege source-order workarounds that are no longer required;
3. remove Fire diagonal fallback mapping when the replacement Fire set is verified;
4. converge all eleven assets on canonical identity frame order wherever the new art permits;
5. retain camera-relative heading selection, billboard camera-facing behavior, and angular hysteresis;
6. keep presentation code renderer-side only;
7. do not rotate the billboard plane itself merely to express unit facing;
8. do not preserve a per-asset remap simply because the old asset needed it;
9. once the canonical batch is verified, all eleven runtime variants must load frames directly through `impostorFrameFiles(slug)` and use the same frame-selection path; do not reintroduce per-unit runtime remaps, heading offsets, or specialized direction modules;
10. keep billboard orientation independent from unit-root facing: set billboard world yaw from the shared `RTS_CAMERA_YAW_DEGREES` convention rather than reading the parent Euler Y angle and counter-rotating a child;
11. never use Euler decomposition of the rotating unit root as billboard compensation, because equivalent quaternion rotations can decompose into different Euler triples and break the rear half of the eight-direction cycle;
12. if a human WebGL check still reports a direction mismatch after canonical assets pass QA, instrument the selected unit's movement delta, world heading, chosen frame index, and filename before changing assets or introducing a remap.

A new per-asset remap is acceptable only if a mathematically necessary runtime convention is proven after canonical assets pass visual QA. It must not be the first response to bad source art.

## 8. Narrow validation

For presentation-only integration:

1. update/add targeted canonical-path and mapping tests;
2. run those targeted tests;
3. run TypeScript/build once;
4. let CI/Pages deploy normally;
5. perform one final human WebGL all-direction check.

Do not rerun broad simulation/replay/world-generation suites unless authoritative gameplay code changed or a concrete regression requires them.

Final WebGL acceptance checks:

- each of the eleven intended visual variants uses the replacement art;
- all eight headings show the matching genuine direction;
- front/rear and left/right are not inverted;
- no direction duplicates another direction;
- no frame-size pulsing;
- feet/chassis remain grounded;
- billboard remains camera-facing;
- scale is readable beside other units/buildings;
- selection, health, and status presentation remains readable;
- no unexpected GLB/primitive fallback remains due to load failure.

## 9. Gate states

Use these states when a task must stop for user action:

- `WAITING_FOR_IMAGE_GENERATION`
- `READY_FOR_FRAME_PREP`
- `WAITING_FOR_MANUAL_UPLOAD`
- `READY_FOR_RUNTIME_INTEGRATION`
- `WAITING_FOR_WEBGL_ACCEPTANCE`
- `COMPLETE`

At a gate, provide only the exact missing action and paths needed to resume. Do not loop on already completed steps.

## 10. Completion criteria

Mark the pipeline complete only when:

- all 88 canonical replacement WebP binaries are present on GitHub `main`;
- temporary art-recovery remaps/fallbacks are removed where no longer needed;
- runtime uses canonical static paths;
- targeted mapping/path tests and build pass;
- Pages deployment passes;
- one human WebGL check confirms direction, scale, grounding, billboard behavior, and readability.
