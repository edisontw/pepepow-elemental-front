---
name: elemental-front-webp-impostor-pipeline
description: Produce, QA, normalize, package, integrate, and validate canonical eight-direction animated WebP unit impostors for PEPEPOW Elemental Front.
---

# Elemental Front Animated WebP Impostor Pipeline

Use this skill for player-unit 2.5D animated impostor production and integration.

This workflow is presentation-only. Never change simulation, gameplay rules, deterministic state, replay identity, navigation, combat authority, or world generation to make art fit.

## 1. Mandatory read order

Read only:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/UNIT_ART_ANIMATION_UPGRADE_PLAN.md`
3. `docs/UNIT_ANIMATION_IMPLEMENTATION_NOTES.md`
4. `docs/UNIT_IMPOSTOR_ASSET_SPEC.md`
5. `media/prompts/images/WEBP_IMPOSTOR_BATCH_PROMPTS.md` when generation is required
6. this skill
7. only task-relevant rendering files after binary upload

GitHub `main` is the only source of truth. Repository and in-game UI remain English-only.

## 2. Authoritative production path

```text
canonical character art
→ identity lock
→ 8-direction Idle anchors
→ directional QA + LOCK
→ Move animation
→ QA + LOCK
→ Attack animation
→ QA + LOCK
→ Hit animation
→ QA + LOCK
→ Death animation
→ QA + LOCK
→ deterministic frame extraction / normalization
→ 192×256 RGBA WebP frames / atlas + metadata
→ manual GitHub upload
→ runtime integration
→ WebGL acceptance
```

Elementalists add `Cast` between Attack and Hit.

The minimum standard-unit vocabulary is:

```text
Idle
Move
Attack
Hit
Death
```

## 3. Anti-loop rule

Image generation is nondeterministic and must not be allowed to loop.

Hard rules:

- Never ask the image model to generate all five actions in one request.
- Work on exactly one action at a time.
- Never regenerate an action that has passed QA unless a concrete defect is later identified.
- Never regenerate the full eight-direction set merely because one direction failed.
- If one direction/frame fails, repair only that direction/frame where possible.
- Maximum two repair generations for the same failed target in one pass. If it still fails, stop at `WAITING_FOR_ART_REPAIR` and report the exact defect.
- Do not silently restart from canonical art after an accepted identity lock.
- Do not use image generation for cropping, scale normalization, baseline alignment, filename ordering, WebP conversion, or atlas packing. Those steps must be deterministic scripts/tools.

## 4. Identity lock gate

Before animation production, establish one accepted Vanguard/target-unit identity.

The lock must preserve:

- helmet/head design;
- armor/clothing proportions;
- weapon and shield/staff dimensions;
- weapon handedness;
- asymmetric equipment landmarks;
- team-color surfaces;
- camera elevation/projection character;
- material/lighting language.

Once accepted, later actions must derive from this identity. Do not redesign the unit during Move/Attack/Hit/Death generation.

## 5. Canonical direction order

Every action requires exactly eight genuine observer views in this canonical asset order:

```text
0  00-front
1  01-front-left
2  02-left
3  03-rear-left
4  04-rear
5  05-rear-right
6  06-right
7  07-front-right
```

Direction names describe camera/observer position around the unit.

No final direction may be mirrored, substituted, duplicated, or replaced with a nearby cardinal view.

Use the stable asymmetric landmark (shield side, sword hand, staff fitting, backpack, quiver, etc.) to verify left/right and diagonals.

### Screen-movement mapping warning

Do not confuse screen movement labels with observer-view asset labels.

Under the fixed RTS camera, translate human reports through the shared runtime mapping before modifying art or code. Never fix a reported diagonal issue by swapping files until the movement heading, selected frame index, and loaded filename have been verified.

## 6. Per-action generation gates

### A1 — Idle

Purpose: establish the eight-direction identity anchors and subtle breathing/weight-shift loop.

Target: 3–4 frames per direction.

Requirements:

- same character/equipment in all directions;
- minimal motion;
- stable feet and baseline;
- no world displacement;
- no dramatic weapon movement.

After Idle QA passes, lock the eight directional identity anchors. Later actions must reference them.

### A2 — Move

Target: 4–6 frames per direction.

Requirements:

- grounded armored walk/jog;
- clear leg/weight change;
- in-place animation only;
- no camera drift;
- same shield/sword dimensions and handedness as locked Idle.

### A3 — Attack

Target: 4–6 frames per direction.

Required readable phases:

```text
anticipation → strike/contact → recovery
```

The renderer may align a designated contact/release frame to authoritative combat timing, but sprite motion never changes simulation timing.

### A4 — Hit

Target: 2–3 frames per direction.

Requirements:

- brief impact response;
- no equipment mutation;
- no large displacement;
- fast recovery to authoritative next state.

### A5 — Death

Target: 5–6 frames per direction.

Requirements:

- readable collapse;
- final pose remains stable;
- no gameplay displacement;
- keep equipment recognizable throughout the fall.

### Elementalist Cast

Target: 4–6 frames per direction.

Keep elemental effect intensity restrained in baked art; runtime VFX owns the main spell effect.

## 7. QA before accepting any action

An action passes only when all eight directions satisfy:

- exactly eight genuine directions are present;
- front/rear and left/right are correct;
- all four diagonals are distinct and correctly oriented;
- same identity, weapon hand, equipment, and shield/staff side;
- no unexpected costume/armor mutation;
- camera elevation and projection remain coherent;
- no direction-specific dramatic relighting;
- apparent body scale is consistent;
- feet/ground contact remains in a stable vertical region;
- frames form a plausible motion sequence rather than unrelated poses;
- no text, labels, borders, logos, scenery, or baked contact shadow;
- transparent background is preferred and alpha edges are usable.

If one direction/action fails, repair only the failed target. Do not restart accepted actions.

## 8. Deterministic frame preparation

After an action passes visual QA, use deterministic tooling for frame preparation.

Final per-frame contract:

- `192×256` pixels;
- RGBA WebP with transparency;
- one shared scale policy for the whole unit/action family;
- stable horizontal pivot;
- shared lower foot baseline;
- transparent safety padding;
- no baked contact shadow;
- no mirroring/rotation/remapping during crop/export.

Do not independently rescale each direction to fill the canvas.

Recommended working tree:

```text
art/impostor-source/<slug>/<Action>/<direction>/frame-00.png
art/impostor-source/<slug>/<Action>/<direction>/frame-01.png
...
```

Recommended output tree:

```text
art/impostor-upload/public/assets/impostors/<slug>/<action>/<direction>/00.webp
art/impostor-upload/public/assets/impostors/<slug>/<action>/<direction>/01.webp
...
```

Exact runtime layout may instead use a packed atlas if the renderer/metadata contract requires it. Preserve explicit action, direction, frame order, timing, loop state, pivot, and optional contact/release frame metadata.

## 9. Frame-count policy

Do not inflate frame counts merely because generation can produce more images.

Use the smallest sequence that reads clearly at RTS scale:

```text
Idle   3–4
Move   4–6
Attack 4–6
Hit    2–3
Death  5–6
Cast   4–6 (Elementalists only)
```

Fewer coherent frames are preferred over many inconsistent frames.

## 10. Runtime ownership

Sprite animation is presentation-only.

Simulation remains authoritative for:

- world X/Z translation;
- facing/heading;
- movement state;
- attack/cast outcome and timing;
- damage;
- target selection;
- health/death state;
- replay/hash identity.

Recommended presentation priority:

```text
DEATH > HIT > CAST/ATTACK > MOVE > IDLE
```

Movement animation is in-place. Root motion is forbidden.

## 11. Vanguard vertical-slice gate

Do not mass-produce the roster until Vanguard passes the full animated pipeline.

Vanguard acceptance requires:

- canonical identity preserved;
- all eight observer directions correct;
- Idle / Move / Attack / Hit / Death all visibly distinct;
- no distracting scale pulse between directions/actions;
- stable baseline and pivot;
- broad asymmetric teal shield remains readable;
- compact one-handed sword remains consistent;
- selection ring, health bar, fog, Wet/Freeze overlays, and VFX remain readable;
- one manual WebGL acceptance pass succeeds.

After Vanguard passes, recommended roster order is:

```text
shared Elementalist family
→ Spear Guard
→ Ranger
→ Scout
→ Engineer
→ Golem
→ Siege Construct
```

## 12. Manual binary upload gate

Binary assets may be packaged locally for manual upload.

After the user uploads them, verify GitHub `main` directly before changing runtime integration. User confirmation alone is not binary verification.

Do not integrate known-bad directions or incomplete actions.

## 13. Runtime integration

After Vanguard assets are verified:

1. use the existing directional impostor renderer where practical;
2. support per-action frame timing and loop/non-loop behavior;
3. preserve the established shared eight-direction heading resolver;
4. keep GLB presentation as compatibility fallback during migration;
5. keep billboard camera-facing behavior independent of unit facing;
6. do not introduce per-unit direction remaps as a first response to bad source art;
7. use metadata for action/direction/frame selection, timing, pivot, optional contact/release frame, and optional per-view correction only when demonstrated necessary.

If a human WebGL report finds a direction mismatch after canonical asset QA, instrument movement delta, heading, selected frame index, and loaded filename before changing mapping.

## 14. Narrow validation

For presentation-only work:

1. run targeted impostor/action/mapping tests;
2. run TypeScript/build once at the end of a coherent batch;
3. allow normal CI/Pages deployment;
4. perform one short manual WebGL acceptance pass.

Do not rerun broad simulation/replay/world-generation regressions unless authoritative gameplay code changed or a concrete regression requires them.

## 15. Gate states

Use exactly these states when stopping:

- `WAITING_FOR_IDENTITY_LOCK`
- `READY_FOR_IDLE`
- `READY_FOR_MOVE`
- `READY_FOR_ATTACK`
- `READY_FOR_HIT`
- `READY_FOR_DEATH`
- `WAITING_FOR_ART_REPAIR`
- `READY_FOR_FRAME_PREP`
- `WAITING_FOR_MANUAL_UPLOAD`
- `READY_FOR_RUNTIME_INTEGRATION`
- `WAITING_FOR_WEBGL_ACCEPTANCE`
- `COMPLETE`

At a gate, report the exact completed actions and the one next required action. Do not loop on already accepted work.

## 16. Completion criteria

The animated impostor pipeline is complete only when:

- Vanguard first, then the intended roster, has coherent eight-direction animated action assets;
- frames are deterministically normalized and exported to browser-friendly WebP/atlas assets;
- metadata explicitly preserves action, direction, frame timing, loop state, and anchor information;
- uploaded binaries are verified on GitHub `main`;
- runtime action selection follows authoritative state without root motion;
- targeted tests and build pass;
- Pages deployment passes;
- manual WebGL acceptance confirms direction, animation readability, scale, grounding, billboard behavior, overlays, and performance.
