# PEPEPOW Elemental Front — Unit Art & Animation Upgrade Plan

**Status:** ACTIVE — execution plan  
**Scope:** final unit art, directional animation, action timing, combat feedback integration, atlas/runtime optimization, and browser-performance safeguards  
**Authority:** presentation only; no gameplay, simulation, navigation, replay, AI, or deterministic-state changes  
**Primary target:** raise unit presentation to the quality level of the upgraded battlefield while preserving RTS readability and the existing authoritative ruleset

---

## 1. Mission

Upgrade combat-unit presentation to a **high-quality 2.5D animated impostor system** consistent with the Arcane-Industrial Frontier environment.

The authoritative production flow is:

```text
canonical character art
→ 8-direction consistent character
→ Idle / Move / Attack / Hit / Death
→ WebP sprite / atlas
→ PlayCanvas billboard / impostor
```

For Elementalists, add `Cast` where useful.

This is the default and authoritative unit-art path. A Blender-first modeling, rigging, skinning, or animated-GLB pipeline is **not** the default production target for standard combat units.

At the current RTS camera distance and projected unit size, a polished 2.5D impostor can preserve the approved character design more reliably than a low-cost true-3D reconstruction while also reducing content-production risk and browser rendering cost.

The visual target remains:

- weathered dark steel, leather, cloth, timber, and restrained brass;
- teal team-color surfaces clearly separated from elemental identity;
- strong elevated-camera silhouettes;
- human-scale soldiers for infantry roles;
- engineered elemental equipment for Elementalists;
- heavy stone/metal construction for Golem and Siege Construct;
- readable movement and combat timing at normal RTS zoom;
- stable scale and foot grounding across all directions;
- visible attack, cast, hit, and death actions rather than projectile-only feedback.

The target is not cinematic close-up fidelity. The target is a coherent character that remains convincing and readable at approximately 64–128 projected pixels.

---

## 2. Source of truth and read order

GitHub `main` is the only source of truth.

Read in this order:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/VISUAL_IMPLEMENTATION_BRIEF.md`
3. this file
4. `docs/UNIT_ANIMATION_IMPLEMENTATION_NOTES.md` when touching the current unit renderer
5. only runtime files directly involved in the implementation
6. `media/prompts/images/VISUAL_PRODUCTION_PRIORITY_A_B_PROMPTS.md` when final unit art generation is involved
7. `docs/TECH_ARCHITECTURE.md` only for rendering/simulation separation and performance constraints
8. `docs/GAME_DESIGN_SPEC.md` only for unit roles and attack identities

Do not reopen M00–M08 or post-roadmap gameplay authority.

Repository content and current in-game/debug UI remain English-only.

---

## 3. Current diagnosis

The environment is substantially more sophisticated than the units. Unit presentation is therefore the main remaining visual mismatch.

Current runtime characteristics:

- the repository already contains a directional WebP impostor path that previously proved workable;
- current primary unit rendering uses low-detail manifest-loaded GLB fallbacks and procedural/embedded animation plumbing;
- those GLBs remain useful compatibility fallbacks and technical experiments, but they are not the final-art production direction;
- the simulation already provides authoritative movement, attack timing, cast timing, health/state, facing, and death information required to drive presentation;
- prior eight-direction work established the importance of shared direction mapping, per-view normalization, stable foot baselines, and consistent scale.

The next quality step is therefore to **restore and productionize the directional impostor path**, not to continue spending production budget on mesh reconstruction, retopology, skinning, Blender authoring, or animated-GLB cleanup.

---

## 4. Locked architecture boundaries

Preserve all of the following:

- pure-TypeScript authoritative simulation separated from PlayCanvas presentation;
- 10 Hz authoritative simulation with render interpolation;
- deterministic gameplay RNG and command replay;
- current gameplay/replay identity;
- `m02-standard-v1` world generation;
- current movement, attack, damage, spell, status, death, and formation semantics;
- existing team-color versus elemental-identity separation;
- browser-first desktop RTS target;
- stable asset IDs and manifest-driven replacement where applicable.

### Non-negotiable presentation rule

**Sprite animation must never own authoritative translation, facing, attack timing, damage, projectile timing, target selection, cast result, or death state.**

The renderer selects and displays frames based on simulation truth. Presentation may visually anticipate/follow an action but must not alter gameplay.

### Movement rule

World X/Z position continues to come from interpolated simulation coordinates.

A directional Move animation must animate the character **within the frame**. It must not move the billboard independently through the world.

### Facing rule

The existing presentation-facing resolver remains authoritative for visual direction selection. All units must share the same eight-direction convention unless a documented exception is required.

---

## 5. Authoritative unit production pipeline

### 5.1 Canonical art

Each unit begins from one approved canonical character design.

Canonical art defines:

- silhouette;
- armor/clothing/material language;
- equipment;
- ownership surfaces;
- elemental focus where relevant;
- proportions and distinguishing features.

Alternates may be used for provenance or detail reference only. Do not average materially different alternate designs into the canonical identity.

### 5.2 Eight-direction set

Produce one coherent eight-direction set using the repository's established direction convention.

Required properties:

- same character identity in all directions;
- same apparent body height and mass;
- consistent weapon/shield/staff dimensions;
- consistent armor and accessory placement;
- stable ground/foot baseline;
- no accidental costume or equipment mutations between views;
- front/rear and diagonal mapping verified before animation production.

Do not accept eight unrelated generations merely because each image looks good in isolation.

### 5.3 Animation vocabulary

Default minimum set:

```text
Idle
Move
Attack
Hit
Death
```

For Elementalists:

```text
Idle
Move
Attack
Cast
Hit
Death
```

Additional states such as `Repair`, `Work`, or `Special` are optional and must reflect already-authoritative gameplay state.

### 5.4 Atlas output

Preferred final unit runtime assets:

- lossless or high-quality WebP with alpha;
- sprite sheets / atlases rather than many tiny independent files where practical;
- explicit metadata for action, direction, frame count, timing, pivot, and foot baseline;
- consistent frame canvas/pivot policy within a unit family;
- trimmed transparent bounds only when runtime metadata preserves stable grounding;
- no black matte/fringe around alpha edges.

Atlas packing must not alter the canonical directional order.

### 5.5 Runtime representation

Preferred runtime representation:

- PlayCanvas camera-facing billboard / impostor;
- direction selected from presentation-facing yaw;
- animation state selected from authoritative snapshot transitions;
- stable world-space anchor at the unit's ground position;
- shared atlas/material resources across instances;
- optional soft contact shadow under the unit;
- selection rings, health bars, fog, Wet/Freeze overlays, and VFX layered independently.

Existing GLB unit assets may remain as compatibility fallback or experimental alternate representation. Do not require them for final unit-art acceptance.

---

# 6. I0–I5 execution plan

Execute these phases in order and continue autonomously until a hard gate is reached.

---

## I0 — Restore the production impostor runtime

### Goal

Make the directional WebP path a robust primary unit presentation path again without changing simulation authority.

### Required work

- reuse the existing directional sprite/impostor renderer where practical instead of replacing it wholesale;
- preserve the already-correct shared eight-direction mapping;
- support state selection for Idle / Move / Attack / Cast / Hit / Death;
- support per-action frame timing and looping rules;
- preserve authoritative movement interpolation and presentation facing;
- keep the current GLB path as a safe fallback during migration;
- tolerate missing optional actions without crashing.

### Recommended state priority

```text
DEATH
> HIT
> CAST / ATTACK
> MOVE
> IDLE
```

### I0 acceptance

- one test unit can switch Idle ↔ Move without simulation changes;
- one-shot Attack can play and recover to Idle/Move;
- Hit and Death override correctly;
- direction changes use the established mapping;
- atlas/frame failure degrades safely;
- no gameplay/replay/state-hash code changes;
- TypeScript/build passes.

---

## I1 — Vanguard vertical slice

### Goal

Prove the complete 2.5D final-art pipeline with Vanguard before scaling to the roster.

### Art target

- human infantry;
- medium-heavy dark-steel armor;
- broad asymmetric rectangular/kite shield as the primary silhouette;
- compact one-handed sword;
- teal replaceable team-color shield/shoulder surfaces;
- practical enclosed helmet;
- weathered leather and cloth;
- no elemental glow.

### Required actions

- `Idle` — restrained breathing/weight shift;
- `Move` — grounded armored walk/jog;
- `Attack` — readable sword anticipation → strike → recovery;
- `Hit` — short readable impact response;
- `Death` — clear collapse with no gameplay displacement.

### Directional consistency

Before acceptance, compare all eight directions for:

- apparent height;
- body/armor mass;
- shield size;
- sword length;
- foot baseline;
- horizontal center/pivot;
- front/rear/diagonal mapping.

Per-view normalization is allowed when needed to remove generation-scale drift.

### Combat timing

The authoritative attack determines whether and when damage occurs. The visible attack frame should align with that event as closely as practical without delaying gameplay.

### I1 acceptance

- Vanguard uses the production WebP atlas/impostor path at normal quality;
- all eight directions read as the same character;
- Idle/Move/Attack/Hit/Death are visibly distinct;
- no direction shrinks/grows enough to be distracting;
- no obvious foot-baseline jump between directions;
- shield/team-color panel remains readable;
- selection ring, health bar, Wet/Freeze overlays, VFX, and fog remain readable;
- one short manual WebGL acceptance passes before mass production.

---

## I2 — Elementalist family

### Goal

Create one coherent caster family and derive Fire, Water, Ice, and Lightning variants without losing directional consistency.

Shared characteristics where practical:

- body proportions;
- robe/armor language;
- locomotion timing;
- hit/death timing;
- team-color zones;
- staff/body scale.

Elemental identity should come from:

- staff/focus design;
- restrained elemental accents;
- runtime cast VFX;
- small pose differences when useful.

Do not recolor the entire costume per element.

Required actions:

- Idle;
- Move;
- Attack/basic ranged release;
- Cast;
- Hit;
- Death.

All four Elementalists must use the same direction convention and normalization policy. The previously corrected diagonal/rear direction mapping remains the baseline and must not regress.

---

## I3 — Specialist and heavy-unit expansion

Apply the proven impostor pipeline to:

- Spear Guard;
- Ranger;
- Scout;
- Engineer;
- Golem;
- Siege Construct.

Role-specific motion must remain readable at gameplay zoom:

- Vanguard = shielded frontline;
- Spear Guard = pike brace/thrust;
- Ranger = deliberate bow draw/release;
- Scout = fast hand-crossbow skirmisher;
- Engineer = tool/support specialist;
- Elementalist = staff caster;
- Golem = slow heavy construct;
- Siege Construct = mechanical long-range pressure unit.

For Golem and Siege Construct, sprite animation may depict mechanical movement rather than humanoid motion. A skeleton is not required because final runtime output is still the impostor atlas.

---

## I4 — Combat timing, VFX, and impact integration

### Goal

Make sprite motion and runtime VFX read as one coherent action.

For ranged attacks and spells:

```text
anticipation
→ release frame
→ projectile / beam / elemental motion
→ impact
→ target hit reaction
→ short residue/status cue
```

For melee:

```text
anticipation
→ strike/contact frame
→ impact VFX / hit reaction
→ recovery
```

Use existing authoritative snapshot transitions/events to derive presentation triggers.

Examples:

- attack tick/state transition → Attack animation;
- cast result → Cast animation/VFX;
- health delta → Hit;
- alive → dead → Death;
- movement delta → Move;
- Frozen → locomotion suppressed/frozen presentation.

Do not modify simulation timing merely to make an animation easier.

Projectile origin may use a per-unit/per-direction metadata offset when useful; fall back safely to the current unit-center offset.

---

## I5 — Atlas, LOD, quality tiers, and browser performance

### Goal

Keep the mature-alpha target practical at approximately 100 active units / 200 total entities.

Prefer:

- one atlas/material per unit or unit family where practical;
- shared textures across instances;
- frame-rate throttling for distant/off-screen/fog-hidden units;
- smaller atlas resolution or reduced animation sampling in low-quality mode where needed;
- soft contact/blob shadows instead of expensive per-unit real-time shadows;
- no full animation/VFX update cost for invisible units;
- bounded texture memory and predictable atlas dimensions.

The 2.5D impostor representation is the primary performance path, not merely a far-distance fallback.

### I5 acceptance

- no obvious sprite/atlas resource leak during repeated creation/destruction;
- normal and `?quality=low` remain usable;
- 100-unit target-device manual FPS check is performed when available;
- low-quality mode reduces presentation cost without changing gameplay;
- no replay/state-hash changes are introduced.

---

# 7. Direction convention and normalization contract

All units should use one shared direction vocabulary and mapping already established by the current renderer/tests.

Do not hand-invert directions per unit unless a verified source asset requires it.

Before committing a new unit:

1. verify front and rear;
2. verify left/right;
3. verify all four diagonals;
4. compare apparent scale across all directions;
5. compare foot baseline/pivot;
6. compare major equipment reach;
7. test movement direction in runtime, not only static asset inspection.

If a direction appears too large/small despite correct mapping, fix the asset or apply documented per-view normalization rather than swapping direction labels.

---

# 8. Asset naming and metadata contract

Recommended action names:

```text
Idle
Move
Attack
Cast
Hit
Death
Repair
Special
```

Recommended metadata per action/direction:

- frame rectangle/index;
- duration or FPS;
- loop/non-loop;
- pivot/ground anchor;
- optional release/contact frame;
- optional projectile/focus offset;
- optional per-view scale normalization only when necessary.

Use consistent capitalization and direction ordering across all units.

---

# 9. Art-generation guidance

The canonical unit concepts define art direction. Final gameplay sprites should stay faithful to them.

For each unit:

1. lock one canonical design;
2. establish a coherent eight-direction character set;
3. visually QC identity and scale before animating;
4. generate/author Idle / Move / Attack / Hit / Death (and Cast where relevant);
5. normalize pivots and per-view scale;
6. remove background cleanly and verify alpha edges;
7. pack to WebP atlas;
8. integrate metadata/runtime state mapping;
9. validate at normal RTS camera distance.

A true 3D intermediate may be used privately as an optional art-generation aid if it is genuinely efficient, but it is **not required**, is **not a repository deliverable**, and must not become a token-intensive Blender/rigging task by default.

Do not block progress on topology, UVs, skin weights, skeletons, or GLB clip authoring when a high-quality directional sprite result can satisfy the gameplay presentation target.

---

# 10. Visual acceptance targets

### Grounding

- feet/body appear connected to terrain;
- pivot is stable across actions and directions;
- movement does not look like a static image sliding;
- contact shadows reinforce grounding.

### Silhouette

- role is readable before fine details;
- weapons and major equipment remain visible from above;
- teal ownership surfaces do not overwhelm the body;
- elemental accents remain distinct from team color.

### Animation

- Idle is alive but restrained;
- Move has readable motion and weight;
- Attack has anticipation, release, recovery;
- Cast is readable before VFX dominates;
- Hit is brief and clear;
- Death is distinct and stable.

### Direction consistency

- all eight directions are the same character;
- front/rear/diagonal mapping is correct;
- no abrupt scale changes;
- no baseline jumping;
- mirrored or asymmetric equipment remains logically consistent.

### Combat and RTS readability

- projectile/cast release visually aligns with the action;
- melee contact and target response appear connected;
- selected unit remains easy to identify;
- health/status indicators remain readable;
- fog and battlefield clutter do not swallow units;
- animation does not introduce exaggerated visual noise.

---

# 11. Validation policy

This is a presentation-only pass.

For each coherent implementation batch:

1. run TypeScript/build once;
2. run only directly relevant renderer/direction/atlas tests;
3. validate atlas metadata and missing-asset fallback where automated validation exists;
4. perform one short browser/WebGL smoke when available;
5. manually inspect normal gameplay zoom rather than close-up art alone;
6. fix obvious blockers and stop.

Do not rerun broad deterministic/replay/AI/world-generation suites unless authoritative gameplay code changed or a concrete regression requires them.

Suggested targeted tests:

- direction mapping;
- action-state priority;
- one-shot → locomotion recovery;
- death-state persistence;
- missing-atlas/action fallback;
- asset teardown/release;
- unchanged presentation-facing behavior.

---

# 12. Hard gates

Continue autonomously until one of these conditions is reached:

1. the canonical design or eight-direction source set is missing and cannot be reconstructed consistently from available approved art;
2. final art generation requires an external paid service or explicit user approval not already available;
3. concept selection genuinely requires choosing between materially different art directions;
4. manual WebGL visual/FPS acceptance is the only remaining blocker.

A missing Blender executable, missing rigging service, failed image-to-3D service, or unavailable 3D reconstruction model is **not** a hard gate for this production plan.

If a hard gate occurs:

- finish all non-blocked impostor runtime plumbing first;
- leave stable asset IDs and fallback behavior intact;
- document the exact art/approval required;
- do not replace missing final art with another large primitive or low-quality 3D pass;
- do not restart a Blender-first pipeline merely to avoid the gate.

---

# 13. Recommended commit slices

Prefer coherent slices such as:

1. `visual: restore animated impostor unit runtime`
2. `visual: integrate Vanguard impostor vertical slice`
3. `visual: add shared Elementalist impostor family`
4. `visual: animate specialist unit impostors`
5. `visual: integrate heavy unit impostors`
6. `visual: synchronize sprite actions and combat effects`
7. `perf: optimize unit atlases and animation updates`

Do not split trivial edits into separate commits.

---

# 14. Execution priority

Recommended production order:

```text
I0 impostor runtime
→ I1 Vanguard full vertical slice and screen acceptance
→ shared Elementalist family
→ Spear Guard → Ranger → Scout → Engineer
→ Golem → Siege Construct
→ I4 combat/VFX synchronization
→ I5 atlas/performance cleanup
```

The first decisive gate is the Vanguard vertical slice. If Vanguard does not look grounded, consistent, readable, and convincingly animated at gameplay zoom, do not mass-produce the same pipeline across the roster.

---

# 15. Non-goals

The following are not default goals of this plan:

- Blender-first character modeling;
- manual topology cleanup for standard units;
- UV/PBR production as a prerequisite for unit art;
- humanoid rigging and skin-weight cleanup;
- embedded animated GLB delivery for every unit;
- spending large Work-token budgets on iterative 3D reconstruction;
- pursuing true-3D fidelity that is not visible at normal RTS scale.

Existing GLB infrastructure may remain for compatibility, experiments, buildings, or future special cases. It is not the authoritative standard-unit production requirement.

---

# 16. Definition of success

The upgrade is successful when the normal gameplay screen no longer shows a quality gap where the battlefield appears production-oriented but combat units still read as placeholders.

Specifically:

- every standard combat unit has a coherent eight-direction identity;
- common infantry visibly animate rather than slide as static sprites;
- every combat role visibly performs its attack;
- Elementalists visibly cast;
- hit and death reactions are integrated with combat feedback;
- heavy units have appropriately weighted/mechanical motion;
- unit silhouettes and materials match the Arcane-Industrial Frontier concept direction;
- the renderer remains subordinate to authoritative simulation;
- browser performance remains compatible with the mature-alpha target;
- **high-quality 2.5D animated impostors are the primary unit presentation path**.