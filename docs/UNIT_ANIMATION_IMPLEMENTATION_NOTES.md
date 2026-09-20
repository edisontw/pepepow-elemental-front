# Unit animation implementation notes — 2.5D impostor production path

Status: all eleven player-side unit visuals use the committed five-action pack through 55 generated WebP atlases. Manual WebGL/FPS acceptance is pending; GLB remains the enemy/neutral and compatibility fallback.

## Current production decision

The default unit-art path is now:

```text
canonical character art
→ 8-direction consistent character
→ Idle / Move / Attack / Hit / Death
→ WebP sprite / atlas
→ PlayCanvas billboard / impostor
```

For Elementalists, add `Cast` where useful.

The prior Blender / reconstruction / rigging / skinned-GLB route is no longer the default production path and must not be treated as a hard gate for standard unit art.

## Existing GLB runtime work

The following work remains valid as compatibility/fallback infrastructure:

- `unit-animation-profile.ts` defines presentation-only `IDLE / MOVE / ATTACK / CAST / HIT / DEATH` states and canonical clip names.
- `unit-animation-controller.ts` binds embedded GLB animation tracks, loops Idle/Move, plays Attack/Cast/Hit as one-shots, persists Death, cross-fades safely, and tolerates missing clips.
- `animated-unit-render-bridge.ts` derives animation intent only from authoritative snapshots: movement delta, `nextAttackTick`, cast result, health delta and alive/dead state.
- Root motion is not used. Simulation interpolation owns world X/Z and presentation facing remains subordinate to the facing resolver.
- Build-time protection for promoted GLBs remains useful and should not be removed merely because GLB is no longer the primary final-art route.

This infrastructure may remain in the repository for fallback, experiments, buildings, future special units, or alternate quality paths. It is not the authoritative standard-unit production requirement.

## Previous U1 Vanguard GLB proof slice

The reproducible Vanguard generator embedded five canonical rotation-only clips:

- `Idle`
- `Move`
- `Attack`
- `Hit`
- `Death`

It also exported `ModelRoot` and `WeaponTip` nodes. That asset remains a rigid-node fallback and technical proof only. It is not final Vanguard art and no longer defines the production route.

Validation previously completed:

- U0 CI run `35134006893`: tests PASS, production build PASS.
- U1 CI run `35134213700`: tests PASS, production build PASS.
- Pages run `35134213840`: deployment PASS.
- Automated animation-state tests cover priority, Frozen locomotion suppression, canonical Vanguard clip names and one-shot classification.

These results document working fallback infrastructure only; they do not create a requirement to finish a skinned Vanguard GLB.

## Retired 3D production attempt — 2026-09-17

Historical record:

- all 28 source-manifest entries were verified against the uploaded archive;
- Vanguard modeling inputs were derived under `media/unit-production/vanguard/`;
- the available to3D service returned HTTP 400 and produced no mesh/job ID;
- Blender, `bpy`, and local reconstruction models were unavailable in that environment.

Under the previous plan this became a production hard gate. Under the current plan it is **not a hard gate** because final standard-unit production no longer depends on a reconstructed mesh, topology, skin, skeleton, or animated GLB.

Do not resume that path by default.

## Active runtime contract — 2026-09-19

- Source: `public/assets/impostors/<slug>/<action>/<direction>_<frame>.webp`.
- Build: `npm run art:atlases`; Python 3 + Pillow 11.3.0.
- Output: `public/assets/impostor-atlases/<slug>/<action>.webp` plus manifest.
- One 1568×1040 RGBA atlas per action; eight columns × four rows; 192×256
  unscaled frames with two-pixel extruded gutters. Every source pixel is verified
  after lossless encoding. Canonical source direction-major order is unchanged.
- `impostor-atlas.ts` maps the refreshed action pack through one shared
  browser-calibrated eight-view source order; uploads explicitly retain `flipY=false`.
- **Direction contract is LOCKED by manual browser acceptance (2026-09-20).**
  The accepted animated runtime-to-source mapping is
  `[6, 1, 4, 3, 2, 5, 0, 7]`.
- Exact slot contract:
  | Runtime slot | Source index | Source stem |
  | ---: | ---: | --- |
  | 0 | 6 | `right` |
  | 1 | 1 | `front_left` |
  | 2 | 4 | `rear` |
  | 3 | 3 | `rear_left` |
  | 4 | 2 | `left` |
  | 5 | 5 | `rear_right` |
  | 6 | 0 | `front` |
  | 7 | 7 | `front_right` |
- This table remains the authoritative runtime direction contract. Source stems
  are asset filenames, not screen-space movement names. Do not derive a replacement
  mapping from intuition about `front/rear/left/right`.
- Manual browser QA later on 2026-09-20 identified a source-pack exception: the
  four Elementalists, Engineer, Golem, and Siege Construct have only the cardinal
  `left` / `right` source stems mirrored. Those seven slugs therefore use
  source-file calibration `[2, 1, 4, 3, 6, 5, 0, 7]`. Front/rear, all four
  diagonals, the heading resolver, and runtime slot semantics remain unchanged.
- Do not change the shared runtime direction contract or reuse the legacy static
  diagonal swap for this correction. Future fixes must verify the loaded runtime
  slot/source stem before changing source calibration.
- The legacy static-turnaround diagonal swap remains separate and is not reused
  for the animated five-action atlases.
- One texture per loaded config/action; immutable UV materials shared across units.
  Idle loads once per instantiated player-side config; actions load only on use.
  Missing actions retain directional Idle; failed requests are cached to avoid retries.
  Late async completions after library disposal never allocate GPU resources.
- Existing action timing, distance-driven Move, one-shot priority, scale, baseline,
  and velocity-derived presentation facing are unchanged.
- All 1,760 source frames stay committed for reproducible rebuilding; build output
  excludes their action directories. No Blender or art regeneration is required.
- Resume only at manual eight-direction/control/animation/FPS acceptance. See
  `RTS_CONTROL_AUTOMATION_RUNTIME_PASS.md`.

## Historical production checklist (runtime implementation now complete)

### 1. Restore/productionize the directional impostor path

Use the existing directional WebP renderer as the starting point where practical.

Required runtime behavior:

- shared eight-direction mapping across all units;
- animation-state selection for Idle / Move / Attack / Cast / Hit / Death;
- per-action frame timing and loop/non-loop behavior;
- stable world anchor and foot baseline;
- authoritative simulation continues to own movement, facing, attack/cast outcome, health, and death;
- GLB path remains available as a safe fallback during migration.

### 2. Use the canonical Vanguard design as the first vertical slice

The canonical Vanguard art/reference package remains authoritative for identity.

Produce one coherent eight-direction Vanguard set and verify before animation expansion:

- same apparent height and mass;
- same helmet/armor design;
- same shield shape/size;
- same sword length;
- stable foot baseline/pivot;
- correct front/rear/left/right/diagonal mapping.

Do not average alternates into the canonical design.

### 3. Produce the minimum animation set

Required:

- `Idle`
- `Move`
- `Attack`
- `Hit`
- `Death`

For each action, preserve character identity and directional consistency. Animation is presentation-only and must not move the authoritative world position.

### 4. Normalize before atlas packing

Before export:

- correct any per-direction scale drift;
- normalize foot baseline and pivot;
- verify weapon/shield reach;
- remove background cleanly;
- inspect alpha edges for dark/black fringe;
- verify the same direction convention as the runtime.

Per-view normalization is acceptable when needed. Do not relabel a correct direction merely to hide a scale problem.

### 5. Export WebP atlas + metadata

Preferred deliverable:

- WebP atlas/sprite sheet with alpha;
- metadata for action, direction, frame order, frame timing, loop state, pivot/ground anchor;
- optional release/contact frame and projectile/focus offset;
- optional per-view scale correction only where necessary.

Use a stable asset path/ID and avoid creating many independent runtime texture/material instances.

### 6. Integrate and validate at RTS zoom

Run only targeted rendering/direction/atlas tests plus one build at the end of a coherent batch.

Manual acceptance should check:

- directional correctness during actual movement;
- stable apparent size in all eight directions;
- grounded movement;
- distinct Attack/Hit/Death readability;
- team-color readability;
- selection ring, health bar, fog, Wet/Freeze overlays, and VFX layering;
- target-device performance when available.

### 7. Continue the roster only after Vanguard passes

Recommended order:

```text
Vanguard
→ shared Elementalist family
→ Spear Guard → Ranger → Scout → Engineer
→ Golem → Siege Construct
```

Elemental effects remain runtime VFX. Scout uses hand crossbow + dagger as already established.

## Hard-gate rule

The following are **not** hard gates anymore:

- no Blender executable;
- failed image-to-3D service;
- unavailable local reconstruction model;
- no retopology/UV tool;
- no auto-rigger;
- no skinned GLB.

A real hard gate is limited to missing/ambiguous canonical art that prevents a coherent eight-direction set, required external paid generation/approval, materially different unresolved art directions, or final manual WebGL/FPS acceptance.

See `docs/UNIT_ART_ANIMATION_UPGRADE_PLAN.md` for the authoritative execution plan.