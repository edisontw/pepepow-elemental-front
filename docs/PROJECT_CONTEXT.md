# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00–M08 CLOSED → Post-Roadmap Phase 2 CLOSED → Phase 3 Formation Slice CLOSED → Phase 4 Hero-Lite Progression ACTIVE (P4-B Neutral Camps / XP Foundation) + Visual Production ongoing  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**Original roadmap:** COMPLETE  
**Current authoritative gameplay ruleset:** `ef-standard-v5`  
**Current replay format:** `ef-replay-v5`  
**World-generation ruleset:** `m02-standard-v1`  
**Latest closure report:** `docs/POST_ROADMAP_PHASE3_CLOSURE_REPORT.md`

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
- gameplay / Block Challenge / score-proof: `ef-standard-v5`;
- replay: `ef-replay-v5`.

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

Phase 2 remains CLOSED and is carried forward under v5:

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
- `S` or `X` Stop;
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

- `A` Attack Move;
- `H` Hold Position;
- `Tab` subgroup cycling;
- persistent `GUARD` escort/follow relationship;
- drag-to-set formation facing;
- advanced local collision/separation steering during transit;
- Tactical spell targeting/preview UI;
- Strategic spell relay/network visualization;
- broad unit/economy/terrain/AI rebalance.

These are post-roadmap gameplay/control follow-up items, not missing M00–M08 work.

During the current visual-production pass, keep these gameplay items deferred unless the user explicitly requests them. Visual/UI readability for existing authoritative behavior may be improved without adopting deferred gameplay semantics.

---

## 6. Current formal work point — Phase 4 + Visual Production

The active work point is **Phase 4 hero-lite gameplay redesign alongside the ongoing high-quality presentation production pass**. Phase 4 P4-A completed objective combat and Core recovery. P4-B is active with deterministic neutral camps, neutral combat, XP accumulation, camp-clear rewards, and capture gating; later slices add Level 1–5 veteran progression and veteran UI. The visual pass continues in parallel with a darker, higher-contrast battlefield target.

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
- Next unit-art step: restore/productionize the animated directional impostor path and complete Vanguard as the 2.5D vertical slice before mass-producing the roster.

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
- preserve the shared direction convention and previously corrected diagonal/rear mappings;
- fix scale drift with per-view normalization where necessary rather than relabeling directions;
- see `docs/UNIT_ANIMATION_IMPLEMENTATION_NOTES.md` for the exact active resume contract.

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


---

## 7. Phase 4 Hero-Lite Progression — ACTIVE

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

P4-B active rules:

- the 5 existing generated `NEUTRAL_CAMP` POIs spawn deterministic neutral Ancient Sentinel guards;
- neutral faction authority uses player ID 2 and participates in normal combat without joining either army economy;
- guards are leashed to their camp instead of pursuing across the map;
- guarded Neutral Camps cannot be captured until all guards are defeated;
- clearing a camp distributes 120 XP deterministically among nearby participating units of the winning local faction;
- unit `experience` and `neutralCampId` are authoritative, snapshot-visible, and state-hashed;
- gameplay/replay identity is `ef-standard-v5` / `ef-replay-v5`;
- world generation remains `m02-standard-v1`.

Next Phase 4 slices:

1. deterministic Level 1–5 progression from accumulated XP;
2. veteran stat scaling and level-up feedback;
3. veteran UI/readability;
4. balance and replay validation.
