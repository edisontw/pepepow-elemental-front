# PEPEPOW Elemental Front — Unit Art & Animation Upgrade Plan

**Status:** ACTIVE — execution plan  
**Scope:** final unit art, rigging, animation, action timing, combat feedback integration, LOD, and browser-performance safeguards  
**Authority:** presentation only; no gameplay, simulation, navigation, replay, AI, or deterministic-state changes  
**Primary target:** raise unit presentation to the quality level of the upgraded battlefield while preserving RTS readability and the existing authoritative ruleset

---

## 1. Mission

Upgrade the current unit presentation from static/faceted runtime models and legacy directional impostor behavior to a **production-quality animated stylized-3D RTS unit system** consistent with the current Arcane-Industrial Frontier environment.

The visual target is the current approved concept direction:

- weathered dark steel, leather, cloth, timber, restrained brass;
- teal team-color surfaces clearly separated from elemental materials;
- strong top-down/elevated silhouettes;
- human-scale soldiers for infantry roles;
- engineered elemental equipment for Elementalists;
- heavy stone/metal construction for Golem and Siege Construct;
- readable motion and combat timing at normal RTS zoom;
- no floating/sliding appearance during movement;
- visible attack, cast, hit, and death actions rather than projectile-only feedback.

The target is not to reproduce a concept image literally at close-up cinematic fidelity. The target is to preserve its silhouette, material language, equipment identity, and character while producing a browser-friendly rigged asset readable at approximately 64–128 projected pixels.

---

## 2. Source-of-truth and read order

GitHub `main` is the only source of truth.

Read in this order:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/VISUAL_IMPLEMENTATION_BRIEF.md`
3. this file
4. only the runtime files directly touched by the implementation
5. `media/prompts/images/VISUAL_PRODUCTION_PRIORITY_A_B_PROMPTS.md` when final unit art generation is involved
6. `docs/TECH_ARCHITECTURE.md` only for rendering/simulation separation and performance constraints
7. `docs/GAME_DESIGN_SPEC.md` only for unit roles and attack identities

Do not reopen M00–M08 or post-roadmap gameplay authority.

Repository content and current in-game/debug UI remain English-only.

---

## 3. Current diagnosis

The environment is now substantially more sophisticated than the units. The main remaining visual mismatch is therefore unit presentation.

Current runtime characteristics:

- the player-unit directional WebP impostor path still exists, but is disabled as the primary runtime path;
- units primarily use manifest-loaded GLB fallback models;
- current GLBs are low-detail faceted baseline assets marked `NEEDS_MANUAL_GENERATION`;
- movement is presented mainly through simple named-node leg rotation plus procedural root bob;
- attack/cast presentation is driven by simple weapon-node rotation and combat VFX rather than authored character animation;
- hit and death use renderer-side procedural recoil/fall effects;
- the simulation already provides authoritative movement, attack timing, cast timing, health/state, facing, and death information needed to drive proper presentation.

This means the next quality step is **not** another eight-direction sprite pass and not more procedural bobbing. It is a rigged/skinned animated GLB pipeline with renderer-side state selection.

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
- stable manifest asset IDs.

### Non-negotiable animation rule

**Animation must never own authoritative translation, rotation, attack timing, damage, projectile timing, target selection, or death state.**

The renderer may visually anticipate and follow an authoritative action, but the simulation remains the source of truth.

### Root-motion rule

Final gameplay unit clips must use **in-place animation**.

Do not use animation root motion for movement. Unit world position continues to come from interpolated simulation coordinates.

This prevents:

- drift;
- replay divergence;
- unit/path desynchronization;
- visible snapping after clip completion;
- animation-speed dependence on frame rate.

---

## 5. Target unit pipeline

Preferred production path:

```text
approved concept
→ consistent turnaround / orthographic references
→ clean 3D mesh
→ retopology / UV / PBR materials
→ shared or role-specific skeleton
→ skin weights
→ small authored animation set
→ GLB with embedded clips
→ stable manifest ID
→ runtime animation controller
→ combat/VFX timing integration
→ LOD/performance pass
```

Concept images are art-direction references, not runtime assets by themselves.

### Asset format

Preferred final format:

- GLB;
- Y-up;
- +Z forward;
- metres;
- one skeleton root;
- one or two materials for ordinary units where practical;
- shared material textures where possible;
- team-color region separable from elemental emissive region;
- animation clips embedded or loaded through the existing asset path without gameplay dependencies.

### Texture target

At normal gameplay scale, prefer:

- ordinary infantry: 512–1024 texture class;
- hero-like or visually critical units: up to 1024 where justified;
- packed ORM or equivalent channel packing where practical;
- restrained alpha usage;
- no detail that is invisible from gameplay zoom.

---

# 6. U0–U5 execution plan

The agent should execute these phases in order and continue autonomously until a hard gate is reached.

---

## U0 — Runtime animation architecture

### Goal

Create a generic renderer-side animation system before replacing many unit assets.

### U0.1 Add a presentation animation state

Introduce a presentation-only state vocabulary such as:

```text
IDLE
MOVE
ATTACK
CAST
HIT
DEATH
```

Optional later states:

```text
BUILD
REPAIR
SPECIAL
```

Do not add these states to authoritative simulation unless gameplay semantics genuinely require them in a separately approved change.

### U0.2 Animation controller

Prefer a narrow module, for example:

- `src/rendering/unit-animation-controller.ts`

Responsibilities:

- bind available clips on a loaded GLB;
- select the active presentation state from authoritative snapshot changes;
- cross-fade between locomotion states;
- play one-shot action clips;
- recover safely to Idle/Move;
- expose normalized action progress when useful for VFX release timing;
- tolerate missing clips and use a safe fallback.

Do not place gameplay logic inside the controller.

### U0.3 State priority

Recommended presentation priority:

```text
DEATH
> HIT
> CAST / ATTACK
> MOVE
> IDLE
```

Use short controlled interruption rules. For example, a hit reaction may be visually reduced during a major cast rather than completely destroying action readability.

### U0.4 Movement animation

Movement state is derived from authoritative positional delta / movement truth.

Required behavior:

- root world translation remains interpolated simulation position;
- walk/run clip plays in place;
- animation playback speed may scale visually with movement speed within safe bounds;
- feet should appear planted enough to avoid skating;
- no full-body sinusoidal root bounce as the primary locomotion effect.

### U0.5 Facing

Keep the current presentation-facing logic.

The animated model turns to the authoritative/presentation-facing yaw; the animation system does not independently rotate the unit toward targets.

### U0.6 Legacy fallback

Current procedural-node GLB motion and directional WebP code may remain only as fallback paths during migration.

Do not remove a working fallback until the corresponding final animated asset is stable.

### U0 acceptance

- one test unit can switch Idle ↔ Move without changing simulation state;
- one-shot Attack can play and return to locomotion;
- Hit and Death can override correctly;
- animation failure does not break the unit renderer;
- no gameplay/replay/state-hash code changes;
- TypeScript/build passes.

---

## U1 — Vanguard vertical slice

### Goal

Prove the complete final-art pipeline with one common frontline unit before scaling to the entire roster.

### U1.1 Art target

Use the approved Vanguard visual direction:

- human infantry;
- medium-heavy dark-steel armor;
- broad asymmetric rectangular/kite shield as the primary silhouette;
- compact one-handed sword;
- teal replaceable team-color shield/shoulder surfaces;
- practical enclosed helmet;
- weathered leather and cloth;
- no elemental glow.

The generated concept direction shown during the current visual pass should be treated as the quality target for silhouette/material language, not as a requirement for close-up polygon density.

### U1.2 Required clips

Minimum Vanguard animation set:

- `Idle` — subtle breathing, shield weight, weapon readiness;
- `Move` — grounded armored walk/jog appropriate to simulation speed;
- `Attack` — sword wind-up → strike → recovery;
- `Hit` — short readable impact response;
- `Death` — authored fall/collapse with no gameplay displacement.

Optional:

- `AttackAlt` for light variation if the asset budget permits.

### U1.3 Motion requirements

The Vanguard must no longer read as a rigid object sliding across the terrain.

At normal RTS zoom:

- legs clearly alternate;
- hips/torso show restrained weight transfer;
- shield has secondary inertia;
- sword arm anticipates before release;
- feet remain visually close to the terrain;
- movement does not produce excessive vertical bob.

### U1.4 Combat release timing

The authoritative attack still determines whether and when damage occurs.

Presentation should align the visible strike with the authoritative attack event as closely as practical. If the simulation event is only available at tick resolution, use renderer-side clip phase mapping without delaying or changing damage.

### U1.5 Readability

At gameplay zoom, the player should distinguish:

- idle stance;
- moving stance;
- attacking unit;
- recently hit unit;
- dying/dead unit.

### U1 acceptance

- final Vanguard replaces the fallback at stable ID `unit.vanguard`;
- idle/move/attack/hit/death are visibly distinct;
- no foot sliding severe enough to read as floating;
- no root-motion drift;
- shield/team-color panel is readable;
- selection ring, health bar, Wet/Freeze overlays, and fog remain readable;
- short manual WebGL acceptance passes before copying the pipeline to the full roster.

---

## U2 — Elementalist family

### Goal

Create one reusable human caster body/skeleton/animation language and derive Fire, Water, Ice, and Lightning variants from it.

### U2.1 Shared body

The four Elementalists should share, where practical:

- body proportions;
- skeleton;
- locomotion clips;
- hit/death clips;
- base material layout;
- team-color zones.

Elemental identity should come from:

- staff focus;
- gauntlet/focus attachments;
- controlled emissive materials;
- cast VFX;
- small pose differences only where they materially improve readability.

Do not recolor the entire costume per element.

### U2.2 Required clips

Minimum:

- `Idle`;
- `Move`;
- `Attack` or basic ranged-cast release;
- `Cast` for Tactical/Strategic spell presentation;
- `Hit`;
- `Death`.

### U2.3 Cast structure

Recommended cast visual timing:

```text
anticipation
→ focus charge
→ staff/hand release pose
→ spell VFX launch/activation
→ recovery
```

The VFX release should visually coincide with the authoritative cast event. Do not delay the gameplay result to wait for animation.

### U2.4 Element-specific visual language

**Fire**
- ember/forge focus;
- heat vent glow;
- restrained sparks/heat haze;
- decisive forward release.

**Water**
- pressure ring / fluid reservoir;
- smooth circular motion;
- compressed burst release.

**Ice**
- crystal prism focus;
- angular braced pose;
- frost growth/shard release.

**Lightning**
- electrode forks and ceramic insulators;
- short charged anticipation;
- sharp release with branching arc onset.

### U2 acceptance

- all four variants preserve one recognizable Elementalist silhouette family;
- each element reads from gameplay zoom through focus/emissive/VFX rather than costume recolor;
- shared animation set reduces production/runtime cost;
- Tactical cast readability is improved without changing spell authority;
- all four use the same stable manifest IDs currently present in `data/assets/manifest.json`.

---

## U3 — Specialist and heavy-unit expansion

### Goal

Apply the proven animated GLB pipeline to the remaining roster while giving each unit a role-specific attack silhouette.

### U3.1 Spear Guard

Visual identity:

- long pike;
- reinforced greaves;
- narrow defensive body profile.

Required attack:

- brace / draw back;
- forward thrust;
- recover.

The pike tip must remain readable and should not sweep through the body because of poor rigging.

### U3.2 Ranger

Visual identity:

- engineered recurved bow;
- readable bow arc;
- quiver;
- light field armor/cloth.

Required attack:

- reach/nock;
- draw;
- brief aim;
- release;
- recovery.

Projectile presentation should start at the visible release phase.

### U3.3 Scout

Visual identity:

- lighter silhouette;
- reconnaissance optics;
- compact bow/crossbow;
- map/signal equipment.

Required movement:

- faster/lighter gait than Vanguard.

Required attack:

- quick aim/release with shorter anticipation than Ranger.

### U3.4 Engineer

Visual identity:

- broad utility backpack;
- repair gauntlet/tools;
- compact field hammer.

Minimum clips:

- Idle;
- Move;
- Attack;
- Repair/Work presentation if current authoritative actions expose enough state;
- Hit;
- Death.

Do not invent gameplay repair/construction behavior in rendering.

### U3.5 Golem

Visual identity:

- large armored construct;
- heavy stone/metal mass;
- readable central reactor;
- teal ownership plates separated from reactor glow.

Motion:

- slow weighted locomotion;
- heavy attack anticipation;
- strong impact recovery;
- reduced high-frequency motion.

### U3.6 Siege Construct

Treat the Siege Construct as a machine rather than a humanoid infantry rig.

Preferred animation channels:

- wheel/track/axle motion;
- suspension/body settling;
- weapon elevation/traverse if compatible with existing facing authority;
- firing recoil;
- reload/reset motion;
- destruction state.

Its animation architecture may be a mechanical clip/node system rather than the same humanoid skeleton used by infantry.

### U3 acceptance

Every unit role must be identifiable through silhouette and motion at gameplay zoom:

- Vanguard = shielded frontline;
- Spear Guard = pike anti-heavy;
- Ranger = deliberate bow ranged unit;
- Scout = fast reconnaissance skirmisher;
- Elementalist = staff caster;
- Engineer = tool/support specialist;
- Golem = heavy frontline construct;
- Siege Construct = long-range structure-pressure machine.

---

## U4 — Combat timing, VFX, and impact integration

### Goal

Make combat read as one coherent action rather than separate model motion and projectile effects.

### U4.1 Action layering

For ranged attacks and spells, use:

```text
anticipation
→ release pose
→ muzzle/cast flash
→ projectile / beam / elemental motion
→ impact
→ target hit reaction
→ short residue/status cue
```

For melee:

```text
anticipation
→ strike
→ contact window
→ impact VFX / hit reaction
→ recovery
```

### U4.2 Renderer-only event mapping

Use existing authoritative snapshot transitions/events to derive presentation triggers.

Examples:

- `nextAttackTick` advancement → attack occurred;
- cast result at current tick → cast animation/VFX;
- health delta → hit feedback;
- alive → dead transition → death animation;
- movement delta → Move state;
- Frozen → locomotion suppressed/pose locked or frozen overlay.

Do not modify simulation timing merely to make an animation easier.

### U4.3 Projectile launch point

Where the rig permits, use attachment/bone positions such as:

- `WeaponTip`;
- `BowRelease`;
- `StaffFocus`;
- `SiegeMuzzle`.

Fallback safely to the current unit-center offset if the attachment is absent.

### U4.4 Hit response

Prefer a combination of:

- short authored hit animation;
- existing renderer-side positional recoil only when subtle;
- impact flash/sparks;
- status-specific overlay.

Avoid stacking large procedural recoil on top of an authored hit clip.

### U4.5 Death

Death should transition from active animation to an authored one-shot and then remain stable until renderer cleanup.

No death animation may move the authoritative unit to another gameplay cell.

### U4 acceptance

- a Vanguard melee strike visibly connects with target feedback;
- Ranger/Scout projectile launch reads from weapon release;
- Elementalist cast motion and elemental VFX read as one action;
- Siege Construct firing has clear anticipation/recoil/impact hierarchy;
- no duplicate or contradictory procedural motion remains obvious.

---

## U5 — LOD, quality tiers, and browser performance

### Goal

Keep the mature-alpha visual target practical at approximately 100 active units / 200 total entities.

### U5.1 Animation LOD

Recommended tiers:

**Near / primary gameplay view**
- full skinned animation;
- normal clip update rate;
- full attachment/VFX behavior.

**Mid distance**
- full model with reduced animation update frequency where visually acceptable;
- simplified secondary motion;
- reduced minor VFX.

**Far / low quality**
- lower update frequency, frozen secondary bones, simplified model, or directional impostor fallback if profiling proves useful.

The existing eight-direction WebP assets may be retained as an optional **far-distance/low-quality LOD**, not as the primary animation system.

### U5.2 Skeleton budget

Prefer compact skeletons.

Ordinary infantry does not need cinematic facial rigs, finger rigs, cloth simulation, or dozens of decorative bones.

Prioritize bones for:

- pelvis/spine;
- head;
- arms/hands;
- legs/feet;
- weapon/shield/staff attachments;
- only high-value secondary equipment.

### U5.3 Material/draw-call budget

Prefer:

- one or two material slots per ordinary unit;
- shared faction/team material strategy;
- texture reuse across Elementalist family where practical;
- no per-unit unique material clones except where necessary for team/element presentation;
- restrained transparency.

### U5.4 Shadows

Use shadow casting selectively.

If full unit shadows become too expensive:

- retain soft contact/blob shadows;
- limit real-time casters by quality/distance;
- avoid sacrificing unit animation quality for expensive shadow maps.

### U5.5 Off-screen and hidden units

Do not spend full animation/VFX update cost on:

- fog-hidden units;
- off-screen units;
- distant units whose clip phase is visually irrelevant.

Any throttling must remain presentation-only.

### U5 acceptance

- no obvious animation-system memory leak during repeated unit creation/destruction;
- animation/VFX resources are released on scene teardown;
- normal and `?quality=low` remain usable;
- 100-unit target-device manual FPS check is performed when available;
- low-quality mode reduces animation/rendering cost without changing gameplay;
- no replay/state hash changes are introduced.

---

# 7. Recommended implementation modules

Use existing architecture where practical rather than broad refactoring.

Primary files likely involved:

- `src/rendering/unit-render-bridge.ts`
- `src/rendering/visual-asset-library.ts`
- `src/rendering/battle-vfx.ts`
- `data/assets/manifest.json`

Recommended narrow additions when useful:

- `src/rendering/unit-animation-controller.ts`
- `src/rendering/unit-animation-profile.ts`

Potential responsibilities:

### `unit-animation-controller.ts`

Runtime clip binding, transition/cross-fade, one-shot state, playback speed, completion/fallback handling.

### `unit-animation-profile.ts`

Data-only presentation mapping, for example:

```text
unit.vanguard
  idle: Idle
  move: Move
  attack: Attack
  hit: Hit
  death: Death

unit.elementalist.fire
  idle: Idle
  move: Move
  attack: Attack
  cast: Cast
  hit: Hit
  death: Death
```

Do not hard-code animation behavior separately in many unit branches inside `UnitRenderBridge` if one profile table can express it.

---

# 8. Asset naming contract

Recommended clip names:

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

Use consistent capitalization across all GLBs.

Recommended optional attachment/node names:

```text
WeaponTip
BowRelease
StaffFocus
SiegeMuzzle
Shield
Reactor
```

Do not require every node for every unit. Missing optional nodes must degrade safely.

---

# 9. Concept-to-3D guidance

The newly generated unit concepts are sufficiently strong to define art direction, but converting them into final gameplay units still requires a controlled 3D step.

For each selected concept:

1. lock one design;
2. create front / rear / side / three-quarter turnaround references from the same design;
3. build or generate one coherent 3D model from those references;
4. manually check silhouette and equipment consistency;
5. simplify geometry for RTS scale;
6. create clean UV/material regions;
7. rig and skin;
8. author the minimal animation set;
9. export GLB;
10. validate at normal camera distance before spending time on close-up details.

Do not create eight independent AI images and attempt to infer animation between them. That route recreates the current inconsistency problem.

---

# 10. Visual acceptance targets

At normal gameplay zoom, a successful unit upgrade should produce all of the following:

### Grounding

- feet appear connected to terrain;
- locomotion does not look like a static image sliding;
- heavy units feel heavier than Scouts/Rangers;
- contact shadows reinforce rather than replace locomotion.

### Silhouette

- role is readable before fine material details;
- weapons and major equipment remain visible from above;
- teal ownership surfaces do not overwhelm the body;
- elemental emissive accents remain distinct from team color.

### Animation

- Idle is alive but restrained;
- Move has believable weight transfer;
- Attack has anticipation, release, recovery;
- Cast is readable before the spell VFX dominates;
- Hit is brief and directional enough to register;
- Death is clear and stable.

### Combat

- projectile launch origin matches the weapon/focus where practical;
- melee contact and target response appear connected;
- elemental attack identity remains readable;
- VFX does not hide unit silhouette or selection state.

### RTS readability

- selected unit remains easy to identify;
- health/status indicators remain readable;
- fog and battlefield clutter do not swallow units;
- animation does not introduce exaggerated motion that makes targeting visually noisy.

---

# 11. Validation policy

This is a presentation-only pass.

For each coherent implementation batch:

1. run TypeScript/build once;
2. run only directly relevant rendering/animation tests;
3. validate GLB structure/clip names where automated validation exists;
4. perform one short browser/WebGL smoke when available;
5. manually inspect normal gameplay zoom rather than close-up asset beauty alone;
6. fix obvious blockers and stop.

Do not rerun broad deterministic/replay/AI/world-generation suites unless authoritative gameplay code changed or a concrete regression requires them.

Suggested targeted tests:

- animation profile resolution;
- missing-clip fallback;
- one-shot → locomotion recovery;
- death-state persistence;
- model teardown/release;
- projectile attachment fallback;
- unchanged presentation facing behavior.

---

# 12. Hard gates

Continue autonomously until one of these conditions is reached:

1. a required final rigged GLB cannot be generated or imported with the available toolchain;
2. the chosen 3D-generation/rigging workflow requires a new dependency, external service, or user approval;
3. concept selection genuinely requires choosing between materially different art directions;
4. manual WebGL visual/FPS acceptance is the only remaining blocker.

If a hard gate occurs:

- finish all non-blocked runtime animation plumbing first;
- leave stable manifest IDs and fallback behavior intact;
- document the exact asset or approval required;
- do not replace the missing final asset with another large procedural primitive pass;
- do not return to static eight-direction WebP as the primary solution merely to avoid the gate.

---

# 13. Recommended commit slices

Prefer coherent slices such as:

1. `visual: add generic unit animation controller`
2. `visual: integrate animated Vanguard vertical slice`
3. `visual: add shared Elementalist animation family`
4. `visual: animate specialist combat roles`
5. `visual: integrate heavy unit and siege animation`
6. `visual: synchronize combat release and impact presentation`
7. `perf: add unit animation lod and quality tiers`

Do not split trivial edits into separate commits.

---

# 14. Execution priority

Recommended production order:

```text
U0 runtime controller
→ U1 Vanguard full vertical slice
→ manual screen acceptance
→ U2 Elementalist family
→ U3 Ranger / Scout / Spear Guard / Engineer
→ U3 Golem / Siege Construct
→ U4 combat/VFX synchronization
→ U5 LOD / performance cleanup
```

The first decisive gate is the Vanguard vertical slice. If Vanguard does not look grounded, readable, and convincingly animated at gameplay zoom, do not mass-produce the same pipeline across the roster.

---

# 15. Definition of success

The upgrade is successful when the normal gameplay screen no longer shows a quality gap where the battlefield appears production-oriented but combat units still read as static placeholders.

Specifically:

- common infantry visibly walk rather than float;
- every combat role visibly performs its attack;
- Elementalists visibly cast;
- hit and death reactions are integrated with combat feedback;
- Golem and Siege Construct have appropriately heavy/mechanical motion;
- final unit silhouettes and materials match the Arcane-Industrial Frontier concept direction;
- the renderer remains subordinate to authoritative simulation;
- browser performance remains compatible with the mature-alpha target;
- legacy WebP impostors, if retained, serve only as fallback/LOD rather than the main quality path.
