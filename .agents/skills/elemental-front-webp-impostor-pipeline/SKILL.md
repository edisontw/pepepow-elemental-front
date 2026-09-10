---
name: elemental-front-webp-impostor-pipeline
description: Build, integrate, validate, and deploy AI-assisted eight-direction WebP unit impostors for PEPEPOW Elemental Front, with explicit stop/resume gates for image generation and manual binary upload.
---

# Elemental Front WebP Impostor Pipeline

Use this skill when replacing a unit's prototype/GLB presentation with an AI-assisted 2.5D eight-direction WebP impostor set.

This is a presentation-only workflow. Do not change simulation, gameplay rules, deterministic state, replay identity, navigation, combat authority, or world generation merely to make the art work.

## 1. Mandatory read order

Before implementation, read only:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/VISUAL_IMPLEMENTATION_BRIEF.md`
3. this skill
4. the task-relevant rendering/runtime files
5. the relevant canonical art prompt file only if new art must be generated

GitHub `main` is the only source of truth. Repository and in-game UI remain English-only.

## 2. Core rule: use gates, do not spin

Image generation and binary upload may require user action. Treat both as explicit hard gates.

Allowed workflow states:

- `READY_FOR_ART`
- `WAITING_FOR_IMAGE_GENERATION`
- `READY_FOR_FRAME_PREP`
- `WAITING_FOR_MANUAL_UPLOAD`
- `READY_FOR_RUNTIME_INTEGRATION`
- `READY_FOR_DEPLOYMENT`
- `WAITING_FOR_WEBGL_ACCEPTANCE`
- `COMPLETE`

When a hard gate is reached, stop after emitting the resume contract in section 11. Do not repeatedly retry the same external action, regenerate already-approved art, or continue as though the missing asset exists.

## 3. Inputs to resolve first

Resolve these from `main` and the user request:

- unit archetype and stable runtime asset ID;
- asset slug, e.g. `vanguard`;
- current fallback model/presentation path;
- canonical visual direction and prompt source;
- whether approved art already exists in the current conversation or repository;
- whether the art bakes a faction/team color;
- expected runtime height/selection scale from the unit visual profile.

If the user says the image is already generated, do not generate another image. Use the existing accessible image. If it is not accessible to the current tool/runtime, ask for that exact image to be attached or uploaded; do not substitute a new image.

## 4. IMAGE_GENERATION_GATE

Prefer one coherent source sheet rather than eight independently generated images.

Recommended source contract:

- one character only;
- consistent armor, weapon, silhouette, proportions, lighting, and camera elevation;
- eight views arranged in a documented 4x2 sheet;
- no text, labels, logos, decorative borders, or ground plane;
- neutral/transparent or easily removable background;
- elevated RTS-readable view, not eye-level portrait art;
- canonical direction set:
  1. front
  2. front-left
  3. left
  4. rear-left
  5. rear
  6. rear-right
  7. right
  8. front-right

If no approved source exists and an image-generation tool is available, generate once per explicit art task and inspect the result. If generation is unavailable, requires a user-side UI action, or produces an unusable result, set:

`WAITING_FOR_IMAGE_GENERATION`

Then provide the exact prompt/source contract and stop. Do not loop on generation attempts.

## 5. Frame preparation

Once an approved source is available:

1. confirm the source view order visually; never infer the order only from filenames;
2. crop the eight directions;
3. remove the background cleanly;
4. normalize all frames to one transparent canvas and consistent feet/ground baseline;
5. preserve apparent character scale across directions;
6. export WebP with alpha;
7. create a preview/contact sheet for QA when useful.

Default unit frame target unless the current asset requires otherwise:

- `192x256` transparent canvas;
- WebP quality roughly 90-94;
- no mipmaps in the current impostor runtime;
- feet aligned consistently near the lower canvas boundary with small transparent padding.

Canonical repository filenames:

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

Canonical repository directory:

```text
public/assets/impostors/<asset-slug>/
```

Do not embed final image payloads as giant TypeScript base64/data URIs. Static binary assets should live under `public/assets/`.

## 6. MANUAL_BINARY_UPLOAD_GATE

First determine whether the current GitHub/file tool can reliably upload binary WebP files.

If binary upload works, upload the eight files directly.

If binary upload is unsupported or unreliable:

1. prepare a ZIP containing the exact eight runtime files;
2. provide the exact target repository directory;
3. provide the exact filenames and tell the user not to rename them;
4. optionally add a small text README/manifest to the repository if useful;
5. set `WAITING_FOR_MANUAL_UPLOAD`;
6. stop.

Do not continue runtime integration against files that are not yet present on GitHub `main`.

When the user reports that upload is complete, verify all eight files on GitHub `main` before changing runtime code. A user confirmation alone is not sufficient verification.

## 7. Runtime integration

After all eight binary files are verified on `main`:

- load them through `import.meta.env.BASE_URL`-aware static URLs;
- retain the existing primitive/GLB fallback until all impostor materials load successfully;
- load each direction as an ordinary image/texture rather than one giant embedded payload;
- keep the image plane camera-facing;
- derive visible direction from the unit heading relative to the fixed RTS camera azimuth;
- use the canonical frame progression listed above;
- add a small angular hysteresis around frame boundaries to prevent chatter;
- keep presentation logic renderer-side only.

Reference implementation files from the Vanguard slice:

```text
src/rendering/impostor-frame.ts
src/rendering/vanguard-impostor-frames.ts
src/rendering/visual-asset-library.ts
src/rendering/unit-render-bridge.ts
public/assets/impostors/vanguard/
```

Before copying Vanguard-specific code for a second or third unit, check whether a narrow generic helper will reduce duplication. Do not perform a broad rendering refactor solely for cleanup.

## 8. Direction-mapping rules

For the current fixed RTS camera, convert the camera observer angle into unit-local view space. The established canonical mapping uses positive progression through the unit's left side:

```text
0 front
1 front-left
2 left
3 rear-left
4 rear
5 rear-right
6 right
7 front-right
```

Test all eight headings explicitly. A sign error can make front/rear appear plausible while swapping every left/right pair.

Use hysteresis rather than changing frames at the exact 22.5-degree midpoint every update. Vanguard currently uses a small presentation-only margin; preserve or tune narrowly if visual chatter remains.

## 9. Presentation polish

After direction switching is correct, tune only what is visually necessary:

- world-space height and width against the canonical unit profile;
- feet/ground anchor;
- contact shadow independent of sprite bob;
- modest motion bob appropriate for a flat sprite;
- hit/attack feedback without rotating the flat image unnaturally;
- selection ring and health/status marker alignment;
- alpha-test threshold and transparent edge quality.

If the source art has baked player/team color, do not use it for all factions. Keep an enemy GLB/fallback or provide separately approved enemy/team-neutral art until a proper recolor/mask pipeline exists.

## 10. Validation and deployment

For a presentation-only impostor change, keep validation narrow:

1. targeted mapping/URL tests;
2. TypeScript/build once;
3. open PR;
4. merge only after CI passes;
5. confirm GitHub Pages build/deploy passes;
6. set `WAITING_FOR_WEBGL_ACCEPTANCE` if visual inspection still requires the user's browser.

Do not rerun broad replay, AI, simulation, or 2,048-seed world-generation regressions unless authoritative gameplay code changed or a concrete regression demands it.

Human WebGL acceptance should check:

- the intended unit actually uses the new art;
- all eight directions correspond sensibly to movement direction;
- no left/right inversion;
- no rapid boundary flicker;
- feet remain grounded;
- scale is appropriate next to other units/buildings;
- selection and status markers remain readable;
- no obvious browser loading failure or fallback unexpectedly remaining visible.

## 11. Resume contract for a blocked gate

Whenever stopping at a gate, end with a compact block containing exactly the information needed to resume:

```text
WEBP_IMPOSTOR_RESUME
asset: <stable asset ID / archetype>
slug: <asset-slug>
state: <workflow state>
completed: <last completed step>
next: <single next action>
source_art: <accessible source or prompt path>
repo_target: public/assets/impostors/<asset-slug>/
expected_files: <8 canonical filenames>
branch_or_pr: <if any>
blocking_reason: <why automation cannot continue>
```

On the next session, read this contract plus latest GitHub `main`, verify the blocker is resolved, and continue from `next`. Do not restart the pipeline from image generation.

## 12. Failure policy

Do not claim success merely because CI passes. CI cannot prove the WebGL presentation is visually correct.

When the runtime still shows fallback art, debug in this order:

1. verify files exist on deployed/static paths;
2. verify the image binaries are valid and browser-decodable;
3. verify `BASE_URL` path construction;
4. verify the intended stable asset ID actually enters the impostor branch;
5. verify texture/material creation;
6. verify plane visibility/scale/alpha;
7. only then investigate mapping/polish.

Do not repeatedly modify loaders before validating the binary asset itself.

## 13. Completion criteria

Mark `COMPLETE` only when:

- all eight final WebP frames are present on `main`;
- runtime uses them through stable static paths;
- mapping tests and build pass;
- Pages deployment passes;
- human WebGL acceptance confirms direction, scale, grounding, and readability are acceptable;
- any baked-team-color limitation is explicitly documented.

This WebP path is a fast 2.5D production option, not a replacement for the preferred long-term GLB pipeline when skeletal animation, dynamic lighting, team recoloring, attachment points, or continuous 3D rotation become important.
