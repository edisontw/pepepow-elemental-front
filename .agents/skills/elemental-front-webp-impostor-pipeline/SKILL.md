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
- expected runtime height/selection scale from the unit visual profile;
- source-sheet direction convention, source-frame remap, and any true heading/yaw offset required by that asset.

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
- canonical **observer-side** direction set:
  1. front — camera in front of the character;
  2. front-left — camera moved toward the character's anatomical left side;
  3. left — camera on the character's anatomical left side;
  4. rear-left — camera behind and to the character's anatomical left;
  5. rear — camera behind the character;
  6. rear-right — camera behind and to the character's anatomical right;
  7. right — camera on the character's anatomical right side;
  8. front-right — camera moved toward the character's anatomical right side.

**Do not describe `left` / `right` only as the direction the character should point on the sheet.** Image generators often interpret `left view` as "character facing screen-left", which is the opposite observer-side view. This failure makes front/rear look correct while swapping every left/right pair.

For asymmetric units, explicitly preserve a stable landmark such as weapon hand, shield, shoulder plate, backpack, or staff. Use that landmark to verify which anatomical side the camera is actually seeing.

If no approved source exists and an image-generation tool is available, generate once per explicit art task and inspect the result. If generation is unavailable, requires a user-side UI action, or produces an unusable result, set:

`WAITING_FOR_IMAGE_GENERATION`

Then provide the exact prompt/source contract and stop. Do not loop on generation attempts.

## 5. Frame preparation

Once an approved source is available:

1. confirm the source view order visually; never infer the order only from filenames or prompt labels;
2. use asymmetric equipment/landmarks to distinguish observer-left from screen-facing-left;
3. crop the eight directions;
4. remove the background cleanly;
5. normalize all frames to one transparent canvas and consistent feet/ground baseline;
6. preserve apparent character scale across directions;
7. export WebP with alpha;
8. create a preview/contact sheet for QA when useful.

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

The filenames describe the intended canonical observer-side runtime views. If the approved source sheet visually follows a different convention, either normalize the files before upload or record an explicit per-asset source-frame remap. Do not silently assume the labels are correct.

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
- derive the canonical observer-side view from the unit heading relative to the fixed RTS camera azimuth;
- use the canonical frame progression listed above;
- add a small angular hysteresis around frame boundaries to prevent chatter;
- support a narrow per-impostor `headingOffsetDegrees` for a true rotational calibration error;
- support a narrow per-impostor source-frame remap when the uploaded sheet's left/right convention or ordering differs from the canonical observer-side convention;
- keep presentation logic renderer-side only.

Reference implementation files from the current shared Vanguard / Elementalist path:

```text
src/rendering/impostor-frame.ts
src/rendering/impostor-frame-assets.ts
src/rendering/vanguard-impostor-frames.ts
src/rendering/elementalist-fire-impostor-frames.ts
src/rendering/visual-asset-library.ts
src/rendering/unit-render-bridge.ts
public/assets/impostors/vanguard/
public/assets/impostors/elementalist-fire/
```

Before copying unit-specific code for another unit, check whether the existing narrow generic helper and per-asset calibration fields cover it. Do not perform a broad rendering refactor solely for cleanup.

## 8. Direction-mapping and calibration rules

For the current fixed RTS camera, convert the camera observer angle into unit-local view space. The canonical runtime view progression is:

```text
0 front
1 front-left observer view
2 left observer view
3 rear-left observer view
4 rear
5 rear-right observer view
6 right observer view
7 front-right observer view
```

The important distinction is **observer side**, not which way the character appears to point on the 2D contact sheet.

Before changing code, audit all eight headings explicitly. Use screen-projected movement plus asymmetric equipment to decide whether the visible frame is correct.

Diagnostic rules:

- if every direction is rotated by the same amount, use the per-asset `headingOffsetDegrees` calibration;
- if front and rear are correct but all left/right and diagonal pairs are swapped, this is not a yaw-offset problem — the source azimuth convention is reversed;
- for the common screen-facing AI turnaround convention, the canonical observer-side-to-source remap is:

```text
[0, 7, 6, 5, 4, 3, 2, 1]
```

- do not "fix" a left/right-pair swap with a 180-degree yaw offset;
- do not rename or rewrite binary files through a text-only connector merely to normalize order; use an explicit source-frame remap or a proper binary-safe file operation;
- keep hysteresis in canonical view-frame space, then apply the source-frame remap afterward. Storing the remapped source index as the hysteresis state can create incorrect boundary behavior.

Use hysteresis rather than changing frames at the exact 22.5-degree midpoint every update. Vanguard currently uses a small presentation-only margin; preserve or tune narrowly if visual chatter remains.

## 9. Presentation polish

After direction switching is correct, tune only what is visually necessary:

- world-space height and width against the canonical unit profile;
- feet/ground anchor;
- contact shadow independent of sprite bob;
- modest motion bob appropriate for a flat sprite;
- keep flat impostor planes camera-facing during attack/cast feedback rather than tilting the card like a 3D mesh;
- make attack/cast facing overrides win briefly over movement heading when a visible release occurs;
- spawn projectiles slightly in front of the unit toward the target rather than from the exact body center;
- for elemental casts, make release tint, projectile, impact, and persistent terrain/status VFX agree on element identity;
- selection ring and health/status marker alignment;
- alpha-test threshold and transparent edge quality.

If a point-target spell does not expose its target in a presentation-safe snapshot, prefer a renderer-side visual inference from visible authoritative outcomes over adding gameplay state solely for VFX. Keep the fallback graceful when no reliable visual target can be inferred.

If the source art has baked player/team color, do not use it for all factions. Keep an enemy GLB/fallback or provide separately approved enemy/team-neutral art until a proper recolor/mask pipeline exists.

## 10. Validation and deployment

For a presentation-only impostor change, keep validation narrow:

1. targeted mapping/remap/URL tests;
2. TypeScript/build once;
3. open PR;
4. merge only after CI passes;
5. confirm GitHub Pages build/deploy passes;
6. set `WAITING_FOR_WEBGL_ACCEPTANCE` if visual inspection still requires the user's browser.

Do not rerun broad replay, AI, simulation, or 2,048-seed world-generation regressions unless authoritative gameplay code changed or a concrete regression demands it.

Human WebGL acceptance should check:

- the intended unit actually uses the new art;
- command movement through all eight world headings and confirm the visible body orientation agrees with screen-projected travel;
- front/rear are correct and every left/right pair is not inverted;
- no rapid boundary flicker;
- attack/cast facing visibly turns toward the release target when applicable;
- projectile release direction agrees with facing;
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

When the art loads but direction feels wrong, debug in this order:

1. verify the fixed camera observer azimuth;
2. verify unit root heading convention;
3. compare front and rear first;
4. compare the left/right side pair using an asymmetric landmark;
5. distinguish uniform yaw offset from reversed source azimuth/order;
6. apply per-asset yaw offset or frame remap as appropriate;
7. retest all eight headings with hysteresis enabled.

Do not repeatedly modify loaders before validating the binary asset itself.

## 13. Completion criteria

Mark `COMPLETE` only when:

- all eight final WebP frames are present on `main`;
- runtime uses them through stable static paths;
- source direction convention has been visually audited and any remap/yaw calibration is explicit;
- mapping/remap tests and build pass;
- Pages deployment passes;
- human WebGL acceptance confirms all-eight direction, scale, grounding, attack/cast facing, projectile direction, and readability are acceptable;
- any baked-team-color limitation is explicitly documented.

This WebP path is a fast 2.5D production option, not a replacement for the preferred long-term GLB pipeline when skeletal animation, dynamic lighting, team recoloring, attachment points, or continuous 3D rotation become important.
