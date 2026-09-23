# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00–M08 CLOSED → Post-Roadmap Phase 2 CLOSED → Phase 3 Formation Slice CLOSED → Phase 4 Hero-Lite Progression CLOSED → Visual Production ongoing  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**Original roadmap:** COMPLETE  
**Current authoritative gameplay ruleset:** `ef-standard-v17`
**Current replay format:** `ef-replay-v17`
**World-generation ruleset:** `m02-standard-v1`  
**Latest closure report:** `docs/POST_ROADMAP_PHASE4_CLOSURE_REPORT.md`

---

## 1. Source of truth

GitHub `main` is the only source of truth.

Always read this file first.

For the active gameplay redesign, read next:

- `docs/POST_ROADMAP_PHASE4_HERO_LITE_PROGRESSION_PLAN.md`

For the current visual-production pass, also read:

- `docs/VISUAL_IMPLEMENTATION_BRIEF.md`

For unit art/animation work, also read:

- `docs/UNIT_ART_ANIMATION_UPGRADE_PLAN.md`
- `docs/UNIT_ANIMATION_IMPLEMENTATION_NOTES.md`

Then read only task-relevant sections of:

1. `docs/GAME_DESIGN_SPEC.md`
2. `docs/TECH_ARCHITECTURE.md`
3. `docs/ROADMAP.md`

Post-roadmap authoritative supplements:

- `docs/POST_ROADMAP_GAMEPLAY_REDESIGN_SPEC.md` — historical redesign baseline; Phase 2 and part of Phase 3 have since been adopted into authoritative runtime contracts;
- `docs/POST_ROADMAP_PHASE1_IMPLEMENTATION_CONTRACT.md` — frozen element-authority contract adopted by Phase 2;
- `docs/POST_ROADMAP_PHASE2_CLOSURE_REPORT.md` — Phase 2 implementation record;
- `docs/POST_ROADMAP_PHASE3_ARMY_CONTROL_CONTRACT.md` — frozen Phase 3 formation/control contract;
- `docs/POST_ROADMAP_PHASE3_CLOSURE_REPORT.md` — Phase 3 formation-slice implementation record.

For formations and army control, the post-roadmap redesign + Phase 3 contract supersede the historical percentage-bonus formation wording in `GAME_DESIGN_SPEC.md` section 14. Active formations use spatial behavior, not hidden formation stat buffs.

All repository content and current in-game/debug UI remain English-only.

---

## 2. Locked architecture

Preserve unless a demonstrated requirement explicitly changes it:

- browser-first, desktop-first RTS;
- authoritative pure-TypeScript simulation independent from PlayCanvas presentation;
- fixed simulation target: 10 Hz / 100 ms tick;
- ECS-style integer entity IDs and composition;
- deterministic gameplay RNG only;
- deterministic system ordering;
- command-stream replay and deterministic state hashes;
- renderer/UI consume authoritative state but never own gameplay truth;
- Block Height is deterministic input rather than an online dependency;
- local/practice play must not require blockchain RPC;
- gameplay/replay identity changes whenever authoritative gameplay semantics change.

Current version separation:

- world generation: `m02-standard-v1`;
- gameplay / Block Challenge / score-proof: `ef-standard-v17`;
- replay: `ef-replay-v17`.

M02 Golden Blocks, world-generation identity, and the 2,048-seed regression remain unchanged by post-roadmap gameplay redesign.

Presentation-only replacement of UI, sprites, models, materials, animations, terrain dressing, particles, decals, lighting, camera feedback, or audio hooks does not require a gameplay/replay version bump.

---

## 3. CLOSED baseline

### Original M00–M08

Repository/bootstrap, deterministic simulation, combat/navigation/element interactions, procedural battlefield, economy/territory, roguelite progression, Enemy War AI, full-run objectives/replay, PEPEPOW Block Challenge, and combat/visual/audio/UX polish are historically CLOSED.

Do not reopen M00–M08 unless a concrete regression is demonstrated or a later explicit product decision changes behavior.

Known deferred infrastructure issue:

- browser live-height retrieval may fail because of external endpoint/CORS behavior; Manual and Official challenge paths remain available.

### Post-Roadmap Phase 2 — Element Authority

Phase 2 remains CLOSED and is carried forward under v10:

- exactly two distinct starting Elemental Attunements;
- one immutable Fire / Water / Ice / Lightning alignment per completed Elementalist;
- only Attuned alignments may be trained;
- semantic `CAST_TACTICAL` / `CAST_STRATEGIC` commands;
- deterministic local Tactical caster selection;
- caster-local Tactical cooldowns;
- Core / Arcane Tower / connected `MANA_BEACON` Strategic network;
- player-global Strategic cooldowns;
- static combat-role tags separated from dynamic elemental/status tags;
- ally-safe direct Tactical effects and faction-agnostic environmental persistence;
- Attunement-aware Shrine eligibility;
- Attunements/alignment/cooldowns/Strategic zones included in authoritative state/replay identity.

Legacy `CAST` remains only for closed-system regression/internal boss migration paths.

---

## 4. Post-Roadmap Phase 3 — Formation Slice CLOSED

Active player formation set:

- `LINE` — wide frontage and mixed/ranged firing-line identity;
- `COLUMN` — narrow footprint for roads, bridges, and chokepoints;
- `SPREAD` — larger overall footprint and spacing against chain/AOE pressure.

Current player bindings:

- `Z` Line;
- `C` Column;
- `V` Spread;
- `A`, then left-click a destination: Attack Move (Esc/right-click cancels targeting);
- `H` Hold Position;
- `S` or `X` Stop;
- arrow keys / edge pan / drag: camera (WASD retired to avoid A/S command conflicts);
- `Ctrl+0..9` assign control group;
- `0..9` recall control group;
- double-click a controllable unit to select currently on-screen friendly units of the same archetype.

Formation authority:

- player right-click MOVE carries the semantic formation ID;
- simulation computes orientation from group centroid → destination at execution tick;
- authoritative orientation uses a deterministic integer 8-direction basis;
- simulation performs role-aware slot ordering, not UI;
- frontline classes (`GOLEM`, `SPEAR_GUARD`, `VANGUARD`) receive leading slots before flex/rear-support classes when rows permit;
- formation slots reserve unique walkable destination cells when alternatives exist;
- blocked slots use deterministic canonical BFS resolution;
- formations do not grant hidden percentage damage/defense/movement buffs;
- MOVE without formation metadata preserves the historical compact-grid migration/regression path;
- replay v3 preserves semantic formation MOVE commands and reproduces identical outcomes.

Phase 3 validation:

- **52 test files / 221 tests PASS**;
- M02 **2,048-seed regression PASS**;
- strict TypeScript PASS;
- production build PASS;
- implementation CI **#208 / run `34374155010` PASS**.

The existing Official Challenge ID `m08-roadmap` is retained for link continuity. Phase 3 closed under `ef-standard-v3`; the active challenge identity has since advanced with Phase 4.

---

## 5. Explicit gameplay deferrals

The completed formation slice intentionally does not yet include:

- `Tab` subgroup cycling;
- persistent `GUARD` escort/follow relationship;
- drag-to-set formation facing;
- advanced crowd steering / flow-field avoidance beyond the bounded v17 local separation pass;
- Tactical spell targeting/preview UI;
- Strategic spell relay/network visualization;
- broad unit/economy/terrain/AI rebalance.

These are post-roadmap gameplay/control follow-up items, not missing M00–M08 work.

During the current visual-production pass, keep these gameplay items deferred unless the user explicitly requests them. Visual/UI readability for existing authoritative behavior may be improved without adopting deferred gameplay semantics.

---

## 6. Current formal work point — Phase 4 + Visual Production

Phase 4 hero-lite gameplay redesign is **CLOSED** as a feature milestone. P4-A–P4-E originally closed under `ef-standard-v7` / `ef-replay-v7`; post-closure pacing shipped as v8, automatic POI securing as v9, RTS control/automation shipped as v10, forced-Move disengage shipped as v11, and Scout vision advances the active identity to `ef-standard-v12` / `ef-replay-v12`. The active work point remains visual production and bounded gameplay/control follow-up.

### Tower Defense vertical slice

- `TOWER_DEFENSE` is a separate deterministic run mode introduced in v13; current run authority is `ef-standard-v17` / `ef-replay-v17`.
- It clears the usual starting enemy force, allows 30 seconds to prepare, then sends seven escalating waves from the enemy approach toward the player Core.
- The live HUD exposes the current wave, next hostile composition, countdown, and hostile count.
- Existing construction, production, units, spells, and Core recovery remain the first playable defense kit.
- v14 fixes a wave-path regression: Tower Defense assault units no longer receive an identical MOVE every fixed tick, which had repeatedly recentered A* paths and could stall them before the Core.
- Dedicated Tower Defense Core-assault intent now owns enemy wave movement; generic Enemy War unit orders do not override that assault path.
- v15 changes Tower Defense assault movement from blind forced-Move behavior to tactical assault behavior: wave units retaliate when attacked, temporarily fight local player defenders, then resume the Core objective.
- v15 path planning treats living Neutral Camp guardians as temporary hazard zones and deterministically routes waves around their aggro radius where a safe route exists; neutral encounters remain optional rather than accidental wave targets.

Primary scope:

1. polished UI / HUD / command-card visual baseline;
2. refined unit presentation and animation;
3. refined building presentation and construction/production feedback;
4. battlefield terrain, water, forest, ice, resources, POIs, and environment dressing;
5. combat feedback, projectiles, hit/death/destruction presentation;
6. Fire / Water / Ice / Lightning Tactical and Strategic VFX readability;
7. browser-friendly asset, material, VFX, atlas/LOD, and draw-call optimization.

Visual direction:

- **Arcane-Industrial Frontier**;
- 2.5D / stylized-3D RTS presentation;
- strong elevated-camera silhouettes;
- team color communicates ownership;
- elemental material/glow/VFX communicates elemental identity/state;
- **standard combat units use high-quality 2.5D animated impostors as the authoritative final-art path**;
- GLB remains appropriate for buildings and other assets where true 3D materially improves the RTS view.

### Authoritative standard-unit production path

```text
canonical character art
→ 8-direction consistent character
→ Idle / Move / Attack / Hit / Death
→ WebP sprite / atlas
→ PlayCanvas billboard / impostor
```

Elementalists may add `Cast`.

This replaces the previous Blender-first / rigged animated-GLB production target for standard units.

Implications:

- do not require Blender, mesh reconstruction, retopology, UV work, rigging, skinning, or animated GLB export for standard unit completion;
- prioritize canonical identity, eight-direction consistency, action readability, scale/pivot/foot-baseline normalization, alpha quality, atlas efficiency, and runtime integration;
- a true-3D intermediate is optional only when it is genuinely efficient as an art-generation aid;
- existing unit GLBs and animation plumbing remain compatibility fallbacks/experiments, not final-art authority;
- a failed image-to-3D/Blender toolchain is not a unit-production hard gate.

Canonical production constraints:

- `docs/VISUAL_IMPLEMENTATION_BRIEF.md`
- `docs/UNIT_ART_ANIMATION_UPGRADE_PLAN.md`

Existing concept reference:

- `media/prompts/images/POST_ROADMAP_UNIT_BUILDING_ART_PROMPTS.md`

Rules for current work:

- start from latest GitHub `main`;
- do not redo closed milestones or the completed Phase 2 / Phase 3 formation authority;
- preserve `m02-standard-v1` world generation;
- preserve deterministic command/replay/hash architecture;
- do not change authoritative gameplay merely to improve appearance;
- prefer coherent vertical slices over many tiny handoffs;
- use stable asset IDs / manifest paths;
- keep repository and in-game UI English-only.

### Visual production implementation baseline

Priority A/B implementation is complete; manual WebGL acceptance remains pending.

- Legacy/fallback manifest-loaded original GLBs exist for Vanguard, four aligned Elementalists, and other units/buildings. They remain useful compatibility assets and technical baselines, but standard-unit final art is now targeted at animated 2.5D impostors.
- Existing GLB named-node/embedded animation plumbing for movement, attack/cast, hit/death, and reactor motion remains valid fallback infrastructure and does not need to be deleted.
- Gunmetal/brass HUD, construction/army categories, selected-army health, selected-caster Tactical readiness, and in-world work progress.
- Hollow selection/Wet rings, freeze shell, Water ripples, segmented Lightning, and pooled single-draw combat sparks; 192-spark/64-projectile/96-transient caps.
- TypeScript/build and targeted rendering tests have passed for the implemented baseline. Work browser may report `WebGL not supported`; automated visual acceptance must not be claimed when WebGL is unavailable.
- Priority B is implemented: additional unit/building fallbacks and pulsing resource-site markers. Strategic relay links, river material highlights, terrain shadow-pass suppression, and a high-DPI pixel-ratio cap are also in `main`.
- Terrain/environment depth integration is in `main`: denser forest grouping and ground contact, richer river-bank wet/mud/grass transitions, and route-aligned shoulder/verge dressing. This remains presentation-only and does not change world generation or gameplay authority.
- Canonical AI final-art prompts are available at `media/prompts/images/VISUAL_PRODUCTION_PRIORITY_A_B_PROMPTS.md`.
- All eleven player-side unit visuals now use five-action directional atlases generated from the committed pack. Next gate: manual WebGL/FPS acceptance; no art regeneration required.

### Unit-production decision — 2026-09-17

The previous true-3D unit-production attempt is retired as the default route.

Historical record:

- canonical package checksums and derived Vanguard modeling inputs remain under `media/unit-production/`;
- the to3D attempt failed with HTTP 400 and produced no mesh/job ID;
- GLB animation playback/fallback work remains in the repository.

Current decision:

- those 3D artifacts are historical/reference/fallback material only;
- do not resume Blender-first modeling by default;
- use the canonical art to build coherent eight-direction animated WebP atlases;
- preserve one shared runtime direction convention across the roster; manual browser
  validation on 2026-09-20 **LOCKED** the accepted base runtime-to-source mapping
  at `[6, 1, 4, 3, 2, 5, 0, 7]`; do not reinterpret it from filename semantics;
- follow-up browser QA plus the fixed-camera pan transform **locks the actual
  screen movement slots** at
  `0=down, 1=down-right, 2=right, 3=up-right, 4=up, 5=up-left, 6=left, 7=down-left`;
  this supersedes earlier contradictory cardinal-pair notes;
- the four Elementalists, Engineer, Golem, Scout, and Spear Guard use
  `[6, 1, 0, 3, 2, 5, 4, 7]`, correcting only screen right/left slots `2/6`;
- Siege Construct uses `[6, 1, 1, 3, 2, 5, 7, 7]`: its exact side source art
  has a foreshortened/missing-looking cannon barrel, and manual QA confirmed the
  first substitute pair was mirrored; screen right/left now use the corrected
  full-barrel `front_left/front_right` views;
- Spear Guard keeps the accepted `[6, 1, 0, 3, 2, 5, 4, 7]` direction map.
  Because its pike silhouette disappears at RTS scale in runtime slots
  `2/4/5/6`, those views add only the Weapon subtree from the existing fallback
  GLB as a presentation overlay; gameplay/facing authority and sprite body art
  are unchanged;
- fix scale drift with per-view normalization where necessary rather than relabeling directions;
- see `docs/UNIT_ANIMATION_IMPLEMENTATION_NOTES.md` for the exact active resume contract.

### POI capture simplification — 2026-09-19

Manual `Capture POI` is retired.

Current POI authority:

- POI ownership and the +10 Influence reward remain;
- player/AI units automatically begin securing an eligible POI when they are within **5 m** of the landmark;
- automatic POI threshold is **900 capture-tenths**: one Vanguard is roughly 6 seconds; multiple units accelerate up to the existing capture-power cap;
- leaving the POI pauses progress; returning resumes it;
- opposing factions simultaneously within range pause securing rather than allowing hidden progress;
- Neutral Camps remain blocked until all Ancient Sentinels are cleared;
- the old manual POI `CAPTURE` command is rejected; `CAPTURE` remains only for Region territory authority;
- Enemy War `CONTEST_POI` now moves units to the actual landmark and relies on the same automatic presence rule as the player;
- the left-panel Capture POI button/hint controller is removed; world POI tooltips show automatic securing state/progress;
- these authoritative semantics advance gameplay/replay identity to `ef-standard-v9` / `ef-replay-v9`;
- world generation remains `m02-standard-v1`.

### Post-closure progression tuning — 2026-09-19

Phase 4 remains closed as a feature milestone, but explicit playtest feedback justified a bounded balance revision:

- Level 2–5 cumulative XP thresholds: **50 / 120 / 220 / 350**;
- Neutral Camp guardians: **3 per camp**;
- Neutral Camp clear reward: **150 XP** shared among nearby participants;
- normal combat-kill XP formula and veteran stat bonuses remain unchanged;
- a focused 2–3 unit raiding group can now reach Level 2 from one camp, while a six-unit army receives 25 XP each and remains Level 1 after one camp;
- the active run HUD is reduced to two compact Core/Target bars; phase/time/difficulty/mode move to the minimap-side metadata line;
- this authoritative balance revision advances identity to `ef-standard-v8` / `ef-replay-v8`; world generation remains `m02-standard-v1`.

### Battlefield lighting / contrast tuning — 2026-09-20

The 2026-09-19 anti-darkness recalibration is superseded by a brighter daylight/contrast pass based on manual browser feedback:

- normal ambient light is lifted to approximately 0.16–0.175, with normal directional sun intensity at 1.08;
- the normal sun is warmer and brighter, while Escalation / Finale retain cooler mood separation at 1.02 / 0.94 rather than becoming gloomy;
- terrain atlas grading lifts grass/ground midtones modestly and gives dirt-road tiles an additional readability lift without flattening local variation;
- explored fog darkening is reduced from alpha 104 to 92; unexplored fog remains strongly obscuring at 230;
- environment atlas emissive is approximately 0.80–0.82, player unit impostors approximately 0.80–0.81, and building impostors approximately 0.90–0.91 so foreground silhouettes stay readable against the brighter battlefield;
- shadow/contact cues and forest density are preserved; this is a grading/lighting pass rather than a density or geometry rewrite;
- this pass is presentation-only and does not change `ef-standard-v12`, `ef-replay-v12`, or `m02-standard-v1`.

### Visual / UX optimization — 2026-09-19 (pre-atlas history)

The following frame-loader baseline was superseded by the atlas runtime below; camera and environment scheduling remain:

- animated unit impostors now request only **one high-priority preview frame per unique unit config** for first paint instead of eight directional previews;
- the remaining seven direction previews hydrate after the scene becomes interactive;
- Move / Attack / Hit / Death frame sets hydrate sequentially at low network priority; full Idle remains deferred;
- forest / prop environment dressing is delayed about 0.5 seconds so terrain, units, UI, and camera controls become interactive first;
- unit sprite emissive level, environment-atlas emissive level, terrain albedo, ambient light, and sun intensity were reduced to move the battlefield away from the previous washed-out / overly white presentation;
- camera edge-pan margin increased to 48 px with faster panning;
- edge pan now uses the unobstructed battlefield boundary beside the left/right HUD rather than the hidden browser-canvas edge behind panels;
- middle-drag and Space/Alt + left-drag remain available; `Home` recenters on the starting base;
- these changes are presentation/UX-only and do not change the active gameplay/replay/world-generation identities.
- automated build/Pages validation is required, but final brightness/load-time/camera feel still requires manual browser acceptance.

### RTS Control + Automation + Runtime Optimization — v10

- True eight-neighbor A*: cardinal/diagonal integer costs 10/14, octile heuristic,
  stable N/E/S/W/NE/SE/SW/NW expansion, no diagonal corner cutting.
- Cardinal BFS destination/formation-slot resolution is retained. Dynamic repaths
  recenter within the current cell before traversing a new edge.
- Attack Move stores each formation destination, uses existing visibility/forest-aware
  nearest-distance/EntityID acquisition, engages, then resumes. No stat bonuses.
- Hold Position cancels travel, acquires only within normal attack range, never pursues,
  and persists until another order. Stop retains its existing normal-aggro behavior.
- Order mode and saved destinations are state-hashed. Core-order replacement executes
  at the command tick for matching live/replay behavior. Replay/challenge identity is v10.
- Secured eligible Shrines offer three deterministic Attunement-filtered choices
  automatically, in stable Shrine-id order. The panel compacts after selection even
  while hovered. Additional secured Shrines queue; Region capture remains unchanged.
- 55 lossless 32-frame atlases replace 1,760 animated frame requests. All eleven
  units retain shared runtime direction semantics, dimensions, baseline and action
  timings; the screen-horizontal correction group, Siege Construct's corrected
  full-barrel horizontal-view override, and Spear Guard's weapon-only overlay do
  not change authoritative facing behavior.
- Only instantiated player-side unit configs load Idle. Other actions load on demand;
  textures/materials are shared by config/action and disposed on library teardown.
- Build: `npm run art:atlases` (Python/Pillow); originals remain committed inputs.
  Deployment omits the 1,760 raw action frames. Worldgen remains `m02-standard-v1`.
- See `docs/RTS_CONTROL_AUTOMATION_RUNTIME_PASS.md` for acceptance and validation.

### Forced Move disengage — v11

- Normal MOVE now has explicit forced-disengage behavior while a destination is active.
- MOVE clears combat pursuit and suppresses automatic encounter target acquisition until
  arrival or cancellation, so melee units can be pulled away from enemies.
- ATTACK_MOVE, HOLD, and explicit ATTACK retain their existing combat semantics.
- S/X Stop cancels travel and restores ordinary idle auto-aggro on the following tick.
- This authoritative gameplay correction advances challenge/replay identity to
  `ef-standard-v11` / `ef-replay-v11`; world generation remains `m02-standard-v1`.

- Status: `WAITING_FOR_WEBGL_ACCEPTANCE`; no cloud WebGL/FPS claim.


### Scout vision + diagonal presentation correction — v12

- Scout fog-of-war vision now uses the design-spec 15 m radius; ordinary unit vision remains 9 m.
- This affects authoritative visibility, target information, and enemy-memory boundaries, so challenge/replay identity advances to `ef-standard-v12` / `ef-replay-v12`.
- Final browser validation found all four diagonal animated views 180 degrees opposite while all four cardinals were correct. The shared animated source order is corrected to `[6, 1, 4, 3, 2, 5, 0, 7]`; this part is presentation-only.
- World generation remains `m02-standard-v1`.



### Forest mass expansion pass — 2026-09-20

- Generated `WOODLAND` remains the authoritative forest/cover footprint and still receives the densest core/edge/understory treatment.
- A separate deterministic presentation-only coarse noise mask now creates several macro wooded regions across otherwise suitable ground, ranked per battlefield so forest mass targets about **30% of eligible sampled ground** and is capped near one third where composition allows.
- Macro groves use tall/medium canopy cores, sapling/shrub edges, deadwood/scrub understory, and wider low-profile open-ground dressing so the battlefield no longer reads as mostly empty grassland.
- Two-cell route setbacks plus larger spawn/base, POI, resource, objective, and boss clearances preserve movement corridors and important battle space.
- `?quality=low` keeps the same macro composition but substantially thins tree/understory placement.
- The macro mask is rendering data only: authoritative terrain flags, forest cover semantics, navigation, fog authority, world generation, replay, `ef-standard-v12`, `ef-replay-v12`, and `m02-standard-v1` remain unchanged.


### Construction / production UX pass — 2026-09-21

- edge-pan now activates only when the pointer is actually over the battlefield canvas surface; HUD/button interaction no longer moves the camera merely because the pointer is near the screen edge;
- Construction and Recruit controls use compact scan-friendly cards with stable short codes and role/cost summaries;
- building codes are presentation-only: `CORE / BRK / ARC / WRK / OUT / EXT / MANA`;
- completed player buildings gain restrained roofline identity markers with distinct silhouettes so Barracks, Arcane Tower, Workshop, Outpost, Extractor, and Mana Well are easier to distinguish at RTS zoom;
- Recruit cards no longer require manually matching the currently selected producer type: a compatible supplied producer is selected automatically, while a manually selected compatible producer remains preferred;
- normal click queues one unit; Shift-click queues up to five units, bounded by current resources and population;
- clicking a production building still opens its local production context, now positioned beside rather than over the left command panel;
- this pass changes presentation/input ergonomics only. Authoritative TRAIN/BUILD commands, economy, production timing, replay semantics, `ef-standard-v15`, `ef-replay-v15`, and `m02-standard-v1` are unchanged.


### Construction / army UI cleanup — 2026-09-21

- left command cards now use full English building and unit names; compact `BRK / ARC / WRK / VAN / RNG`-style badges are removed from build/recruit UI;
- Army order is Recruit first, Preferred Production Building second, then active queue/army summary and Resource Defense;
- player building identity stays on the battlefield through small attached gate/shield, orb, tools/gear, beacon/banner, pump/drill, and well/orb ornaments rather than floating text or UI abbreviations;
- persistent strategic relay ground lines/rings and completed-building highlight discs are suppressed; Rally Point feedback is now a short, faint confirmation cue rather than an always-on marker;
- these changes are presentation/UI only and do not alter TRAIN/BUILD rules, economy, replay semantics, `ef-standard-v15`, `ef-replay-v15`, or `m02-standard-v1`.

### Core combat presentation + command audio pass — 2026-09-22

- objective attacks against either Elemental Core now drive the same Attack animation intent as ordinary unit attacks, including GLB fallback animation controllers;
- Core attacks now receive the normal melee/ranged presentation path: slash/thrust or muzzle flash, projectile/tracer, and stronger structure-impact bursts;
- audio cue derivation now recognizes objective attacks and Core health impacts instead of depending only on `attackTargetEntityId`;
- procedural combat audio adds filtered impact-noise layers and a dedicated low structure-hit response;
- player MOVE / ATTACK_MOVE / ATTACK / HOLD / STOP orders emit restrained command acknowledgement audio; browser speech synthesis supplies low-volume English placeholder acknowledgements when available;
- the audio manifest records the new procedural/voice placeholders; final recorded assets must retain explicit redistribution-safe license/provenance metadata;
- presentation/audio only: attack timing, damage, commands, replay semantics, `ef-standard-v15`, `ef-replay-v15`, and `m02-standard-v1` are unchanged.

### CC0 production audio replacement pass — 2026-09-22

- selected unmodified Kenney CC0 OGG clips replace procedural-only combat hit/release/death, Core-impact, command-confirmation, and army-footstep presentation while retaining procedural layers as safe fallback/accent;
- movement audio is deliberately bounded to one low-volume army-march cue rather than one footstep per moving unit, preventing RTS-scale audio spam;
- player selection, MOVE / ATTACK_MOVE, explicit ATTACK, HOLD, and STOP now prefer real CC0 command voices (`ready`, `go`, `war_target_engaged`) with browser speech synthesis only as load/failure fallback;
- all active production clips resolve through stable IDs in `data/audio/manifest.json`; official Kenney source pages, CC0 licensing, original filenames, and intake notes are recorded in `docs/AUDIO_CC0_PROVENANCE.md`;
- elemental spell and battlefield ambient audio remain procedural placeholders for a later focused replacement pass;
- presentation/audio only: simulation, combat cadence/damage, movement authority, replay identity, `ef-standard-v15`, `ef-replay-v15`, and `m02-standard-v1` are unchanged.

### Elemental skills + battlefield ambience audio pass — 2026-09-22

- Fire, Water, Ice, and Lightning event cues now use redistribution-safe CC0 OGG samples as the primary physical layer while retaining reduced procedural synthesis for elemental identity and load/failure fallback;
- Fire uses CC0 fantasy fire-spell samples; Water uses short CC0 splash variants; Ice uses light/heavy glass transients for crystallization/fracture; Lightning uses short Kenney sci-fi energy transients beneath the existing high-frequency chain signature;
- battlefield ambience now adds two low-gain looped CC0 beds after browser audio unlock: a neutral ambient bed plus a quieter distant machine texture matching the Arcane-Industrial Frontier direction;
- ambient loops, spell samples, combat samples, movement, and recorded command voices all resolve through stable IDs in `data/audio/manifest.json`; licensing/provenance is recorded in `docs/AUDIO_CC0_PROVENANCE.md`;
- original third-party game clips such as Counter-Strike radio commands are not ingested; any future classic-game-style command pass should use original or clearly licensed recordings with similar pacing rather than copied assets;
- presentation/audio only: element rules/effects, combat, simulation, replay semantics, `ef-standard-v15`, `ef-replay-v15`, and `m02-standard-v1` are unchanged.

### Classic radio command voice pass — 2026-09-22

- command acknowledgements now use a dedicated presentation-only radio processing chain with band-limited EQ, moderate compression, a short radio click/static cue, and temporary ambience ducking;
- normal Move retains Kenney `go.ogg`; Attack Move now uses the independent CC0 `war_go_go_go.ogg`; explicit Attack keeps `war_target_engaged.ogg`; Hold Position now uses `hold.ogg`; unit selection keeps `ready.ogg`;
- Stop intentionally uses only a short radio click rather than assigning an inaccurate spoken phrase;
- all recorded command clips are unmodified Kenney Voiceover Pack CC0 assets; no Counter-Strike or other proprietary game audio is included;
- command voice cooldown remains bounded, so rapid RTS input does not create overlapping speech spam;
- presentation/audio only: command semantics, simulation, replay authority, `ef-standard-v15`, `ef-replay-v15`, and `m02-standard-v1` are unchanged.

### Priority C combat impact / destruction polish — 2026-09-22

- Golem and Siege Construct now receive distinct heavy-attack body impulse plus bounded ground-shock/release feedback; Siege shell impacts also receive a short impact ring rather than reading like ordinary ranged fire.
- completed strategic buildings now derive presentation-only health tiers from authoritative health: damaged structures gain visible crack cues, while critical structures add restrained smoke/ember layers; Elemental Core, Arcane Tower, and Barracks receive slightly stronger readability emphasis.
- construction presentation adds a second scaffold tier and a rising assembly/load mass alongside the existing progress ring and spark, so unfinished buildings read as actively assembled rather than vertically scaled final art.
- destruction retains the deterministic collapse pose but adds layered dust, smoke, debris, and a short heavy impact ring; transient counts remain capped.
- `?quality=low` now also reduces combat/destruction transient capacity, removes secondary construction sparks/smoke/embers/heavy shock rings, and lowers destruction debris count in addition to the existing antialias/shadow/environment reductions.
- this pass is presentation-only: simulation, damage, construction timing, pathing, replay semantics, `ef-standard-v15`, `ef-replay-v15`, and `m02-standard-v1` are unchanged.
- manual Standard/Tower Defense WebGL/FPS acceptance remains the final gate and must not be marked complete from non-WebGL automation.

### Final runtime presentation optimization — 2026-09-22

- static presentation bridges whose inputs only change on the authoritative 10 Hz simulation tick (strategic buildings, territory, POIs, resources, generated-world presentation, and fog) are now tick-gated instead of being redundantly resynchronized at render-frame rate;
- the scene caches the current strategic snapshot between ticks and avoids per-frame run-lighting color allocations; Run interpolation and combat/unit presentation remain render-rate;
- player WebP impostors now share one PlayCanvas update dispatcher instead of one `update` listener per rendered unit, and fog-hidden/disabled unit roots skip billboard/material/shadow-position work entirely;
- UnitRenderBridge caches snapshot lookup maps and elemental alignment maps per simulation tick instead of rebuilding them every render frame;
- AnimatedUnitRenderBridge no longer performs redundant GLB animation-controller work for player units already owned by the final WebP impostor path; enemy/neutral/compatibility GLB handling remains intact;
- `?quality=low` now also halves the shared BattleVfx particle/beam buffer from 192 to 96 in addition to the Priority C transient shedding and existing pixel-ratio/antialias reductions;
- these changes are presentation/runtime optimization only: simulation cadence, movement/facing authority, combat, fog authority, replay/state hashes, `ef-standard-v15`, `ef-replay-v15`, and `m02-standard-v1` are unchanged;
- automated CI can validate TypeScript/tests/build, but final Standard + Tower Defense WebGL/FPS acceptance remains a manual browser gate.

### Neutral Sentinel melee presentation correction — 2026-09-22

- Neutral Camp Ancient Sentinels remain melee guardians implemented with the Golem archetype and an authoritative **1.35 m** attack range;
- acquiring an ATTACK target while still outside melee range no longer produces a false Attack animation;
- both the base unit presentation and the neutral/enemy GLB animation layer now require the live unit target to be inside its authoritative attack range before treating an attack-timer advance as a visible attack event;
- pursuit remains movement-only until contact; damage timing, Sentinel stats, leash/aggro rules, simulation, replay semantics, `ef-standard-v15`, `ef-replay-v15`, and `m02-standard-v1` are unchanged.

### Melee contact / Neutral Sentinel pursuit correction — v16 — 2026-09-22

- authoritative melee pursuit now closes the final sub-cell gap when attacker and target occupy the same 1 m navigation cell but their exact positions remain outside attack range; this removes the empty-A* stall observed with the **1.35 m** Neutral Sentinel reach;
- direct `ATTACK` target acquisition preserves immediate attack readiness without advancing `nextAttackTick` by itself, so acquiring/pursuing a target is no longer misread as a completed attack event;
- combat presentation also verifies live unit attack range before spawning melee slash / heavy-shock feedback, preventing the large floating yellow cross/slash from appearing while the Sentinel is still approaching;
- Sentinel stats remain unchanged: Golem-based guardian, 1.35 m attack range, 8 m aggro radius, 12 m camp leash;
- this changes authoritative pursuit/state semantics and therefore advances gameplay/replay identity to `ef-standard-v16` / `ef-replay-v16`; world generation remains `m02-standard-v1`.

### Unit contact / deterministic local separation — v17 — 2026-09-23

- living combat units now carry an authoritative ground-contact `bodyRadius` separate from presentation/selection radius;
- canonical radii are intentionally smaller than sprite silhouettes and represent feet/chassis occupancy, so weapons, staffs, pikes, and cannon barrels do not inflate collision size;
- after the normal deterministic movement pass, nearby living units are resolved through 2 m spatial buckets and at most three fixed relaxation passes rather than an O(N²) scan;
- overlapping bodies are separated only into walkable terrain; stationary, Hold, and otherwise anchored units are preferred anchors while actively moving units yield, with EntityID ordering providing deterministic tie-breaking;
- hostile melee pursuit still uses the existing attack-range authority, but body separation prevents attacker and target centers from collapsing into the same position; canonical melee radii are sized so contact remains inside existing melee reach;
- body radius is included in snapshots/state hashes, and the replay/challenge identity advances to `ef-standard-v17` / `ef-replay-v17`;
- compact MOVE plus Line/Column formation spacing is aligned to a 2 m minimum slot grid so authoritative destinations do not immediately recreate unit-body overlap after arrival;
- building footprints, unit-vs-building blocking, production exit slots, and full flow-field/crowd steering remain follow-up work; world generation remains `m02-standard-v1`.

### Low-health awareness / Army panel pass — 2026-09-22

- persistent in-world health bars are removed from combat units to reduce visual clutter; unit health remains authoritative and unchanged;
- the Army view lists player units at or below **60% HP**, sorted from lowest health upward, with compact percentage meters and direct click-to-select + camera focus;
- battlefield critical-health feedback is intentionally restrained: player units at or below **35% HP** receive only a faint, slow pulsing ground ring rather than a bright warning or overhead bar;
- veteran pips remain visible but are anchored independently above the unit instead of being positioned relative to a health bar;
- this is presentation/UI only: health values, damage, healing, selection authority, simulation, replay semantics, `ef-standard-v15`, `ef-replay-v15`, and `m02-standard-v1` are unchanged.

### Token-efficient validation policy

For presentation-only batches:

- do not rerun broad deterministic/replay/AI/worldgen regressions unless authoritative gameplay code changed or a concrete regression requires them;
- run TypeScript/build once at the end of a coherent batch;
- run only directly relevant targeted tests when necessary;
- perform one short browser/WebGL smoke when available;
- fix obvious local blockers, then stop;
- avoid repeated full-repo audits, exhaustive visual inspection, repeated verification of unchanged systems, and long closure reports;
- do not spend Work tokens on iterative Blender modeling/rigging for standard units.

After the visual-production pass reaches a satisfactory baseline, resume the deferred post-roadmap army-control / targeting / balance work only when explicitly requested.

### Environment art upgrade B0–B5 (2026-09-17)

- Asset-driven runtime implementation is complete; manual visual/FPS acceptance is pending.
- Three original WebP atlases provide eight ground materials, six tree archetypes,
  and twelve ruin/settlement/roadside props. Environment art now uses spatially
  batched fixed-camera impostors, soft contact shadows, per-cell fog and low-quality thinning.
- Removed old primitive woodland/highland/scatter paths. Gameplay, navigation,
  `m02-standard-v1`, and replay authority are unchanged.
- See `docs/ENVIRONMENT_ASSET_NOTES.md` for assets, representation and validation.
- Hard gate 4: cloud browser reports `WebGL not supported`; manual screen/FPS
  acceptance must precede declaring reference-quality completion.

### Environment art cleanup pass — 2026-09-22

- Removed the presentation-only box-heavy resource dressing: stacked mana
  crystals/channels/ring blocks and material-site crate/gantry pieces.
- Replaced repeated crate-like atlas accents around villages, spawns, and
  resource sites with rocks, shrubs, fences, and logs from the approved prop
  atlas; roads, lanes, buildings, units, and resource pulse readability remain.
- Resource values, visibility, terrain, navigation, world generation, replay,
  and gameplay/replay identities are unchanged.


---

## 7. Phase 4 Hero-Lite Progression — CLOSED

Authoritative plan:

- `docs/POST_ROADMAP_PHASE4_HERO_LITE_PROGRESSION_PLAN.md`

P4-A completed rules:

- Core proximity alone does not deal damage;
- Core damage requires an explicit objective-attack intent and the unit's normal attack cadence;
- right-clicking a visible enemy Core issues the objective attack order;
- active friendly Cores heal safe nearby friendly units within 8 m at 2% max HP/sec;
- full Idle animation loading is deferred behind gameplay-critical Move / Attack / Hit / Death frames;
- world generation remains `m02-standard-v1`;
- P4-A shipped under `ef-standard-v4` / `ef-replay-v4`.

P4-B completed rules:

- the 5 existing generated `NEUTRAL_CAMP` POIs each spawn 3 deterministic neutral Ancient Sentinel guards;
- neutral faction authority uses player ID 2 and participates in normal combat without joining either army economy;
- guards are leashed to their camp instead of pursuing across the map;
- guarded Neutral Camps cannot be captured until all guards are defeated;
- clearing a camp distributes 150 XP deterministically among nearby participating units of the winning local faction;
- unit `experience` and `neutralCampId` are authoritative, snapshot-visible, and state-hashed;
- P4-B shipped under `ef-standard-v5` / `ef-replay-v5`;
- world generation remains `m02-standard-v1`.

P4-C completed rules:

- every normal player/enemy combat unit starts at Level 1 and can progress to Level 5;
- cumulative XP thresholds are 50 / 120 / 220 / 350 XP for Levels 2 / 3 / 4 / 5;
- normal combat-unit kills grant deterministic shared XP to nearby same-faction participants; no last-hit ownership is required;
- Neutral Sentinels do not also grant per-kill XP, avoiding double rewards on top of the 150 XP camp-clear pool;
- each level above Level 1 adds approximately +6% Max HP and +4% Attack Damage using deterministic integer scaling;
- stat growth is linear from the unit's original base stats, not multiplicative from the current level;
- level-up restores only the newly added Max-HP delta rather than performing a full heal;
- XP is capped at the Level-5 threshold;
- selected-unit UI shows Level and XP-to-next-level; group selection summarizes veteran composition by level;
- P4-C shipped under `ef-standard-v6` / `ef-replay-v6`;
- world generation remains `m02-standard-v1`.

P4-D completed presentation:

- Lv2–5 units show 1–4 compact veteran pips above the health bar;
- Lv3+ non-neutral units gain a restrained brass ground accent rather than a large glowing aura;
- level-up produces one short muted-gold burst and a brief pip pulse;
- Neutral Sentinels use a distinct amber threat ring;
- guarded Neutral Camps show a low-brightness amber guard seal/beacon;
- Neutral Camp hover text reports remaining Sentinel count and changes to cleared/reward state after the encounter;
- no new unit animation frames or replacement art are required;
- P4-D is presentation-only, so gameplay/replay identity remains `ef-standard-v6` / `ef-replay-v6`.

P4-E completed balance/run integration:

- Core recovery was quantitatively corrected to an actual long-run 2% max HP/sec using deterministic 0.5-second fixed-point pulses;
- the prior per-tick `Math.max(1, ...)` implementation was removed because it unintentionally healed low-HP units at up to ~5.6%/sec;
- a unit at 50% HP now requires about 25 seconds of safe Core recovery to return to full health;
- one 150-XP camp promotes a focused two- or three-unit squad to Lv2, while a full six-unit group remains below Lv2 from one camp;
- Level-5 scaling remains bounded at approximately +24% Max HP and +16% Attack Damage;
- a fully Lv5 starting squad retains an estimated 80+ second theoretical boss TTK across all current boss armor/health profiles, preventing veteran progression from trivializing Finale bosses;
- standard run duration/finale gates remain unchanged;
- deterministic replay/state-hash coverage remains intact;
- P4-E originally closed under `ef-standard-v7` / `ef-replay-v7`; post-closure pacing tuning advances the active identity to `ef-standard-v8` / `ef-replay-v8`;
- validation: 74 test files / 296 tests PASS; strict TypeScript and production build PASS; Pages build PASS.

Phase 4 gameplay is closed. Remaining battlefield brightness/art-quality work belongs to Visual Production and is not claimed complete here.
