# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00–M08 CLOSED → Post-Roadmap Phase 2 CLOSED → Phase 3 Formation Slice CLOSED → Visual Production Pass — Priority A IMPLEMENTED / MANUAL WEBGL PENDING  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**Original roadmap:** COMPLETE  
**Current authoritative gameplay ruleset:** `ef-standard-v3`  
**Current replay format:** `ef-replay-v3`  
**World-generation ruleset:** `m02-standard-v1`  
**Latest closure report:** `docs/POST_ROADMAP_PHASE3_CLOSURE_REPORT.md`

---

## 1. Source of truth

GitHub `main` is the only source of truth.

Always read this file first.

For the current visual-production pass, read next:

- `docs/VISUAL_IMPLEMENTATION_BRIEF.md`

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
- gameplay / Block Challenge / score-proof: `ef-standard-v3`;
- replay: `ef-replay-v3`.

M02 Golden Blocks, world-generation identity, and the 2,048-seed regression remain unchanged by post-roadmap gameplay redesign.

Presentation-only replacement of UI, models, materials, animations, terrain dressing, particles, decals, lighting, camera feedback, or audio hooks does not require a gameplay/replay version bump.

---

## 3. CLOSED baseline

### Original M00–M08

Repository/bootstrap, deterministic simulation, combat/navigation/element interactions, procedural battlefield, economy/territory, roguelite progression, Enemy War AI, full-run objectives/replay, PEPEPOW Block Challenge, and combat/visual/audio/UX polish are historically CLOSED.

Do not reopen M00–M08 unless a concrete regression is demonstrated or a later explicit product decision changes behavior.

Known deferred infrastructure issue:

- browser live-height retrieval may fail because of external endpoint/CORS behavior; Manual and Official challenge paths remain available.

### Post-Roadmap Phase 2 — Element Authority

Phase 2 remains CLOSED and active under v3:

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

The existing Official Challenge ID `m08-roadmap` is retained for link continuity; its current gameplay ruleset is `ef-standard-v3`.

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

## 6. Current formal work point — Visual Production Pass

The active work point is a **high-quality presentation production pass** before resuming broader gameplay/control follow-up.

Primary scope:

1. polished UI / HUD / command-card visual baseline;
2. refined unit presentation and animation;
3. refined building presentation and construction/production feedback;
4. battlefield terrain, water, forest, ice, resources, POIs, and environment dressing;
5. combat feedback, projectiles, hit/death/destruction presentation;
6. Fire / Water / Ice / Lightning Tactical and Strategic VFX readability;
7. browser-friendly asset, material, VFX, LOD, and draw-call optimization.

Visual direction:

- **Arcane-Industrial Frontier**;
- 2.5D / stylized-3D RTS presentation;
- strong elevated-camera silhouettes;
- team color communicates ownership;
- elemental material/glow communicates elemental identity/state;
- final or production-quality runtime models should prefer GLB unless the asset pipeline documents another format.

Canonical production constraint:

- `docs/VISUAL_IMPLEMENTATION_BRIEF.md`

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

Priority A is implemented; manual WebGL acceptance remains pending.

- Manifest-loaded original GLBs: Vanguard, four aligned Elementalists, and Elemental Core (53–123 KiB per model). Stable Core asset ID preserved.
- Named rigid-node movement, attack/cast, hit/death, and reactor motion; artist-authored skeletal animation remains a follow-up.
- Gunmetal/brass HUD, construction/army categories, selected-army health, selected-caster Tactical readiness, and in-world work progress.
- Hollow selection/Wet rings, freeze shell, Water ripples, segmented Lightning, and pooled single-draw combat sparks; 192-spark/64-projectile/96-transient caps.
- TypeScript/build and 10 targeted rendering tests pass; GLB structure checks pass. Work browser cannot boot WebGL (`WebGL not supported`); no visual or 100-unit FPS pass is claimed.
- Priority B is now implemented in the current working branch: four additional unit models, six building models, and pulsing resource-site markers. Manual WebGL acceptance remains pending.
- Next: manual Priority A/B acceptance, then Strategic network/footprint presentation, terrain material polish, and LOD. Do not reopen gameplay authority.

### Token-efficient validation policy

For presentation-only batches:

- do not rerun broad deterministic/replay/AI/worldgen regressions unless authoritative gameplay code changed or a concrete regression requires them;
- run TypeScript/build once at the end of a coherent batch;
- run only directly relevant targeted tests when necessary;
- perform one short browser/WebGL smoke when available;
- fix obvious local blockers, then stop;
- avoid repeated full-repo audits, exhaustive visual inspection, repeated verification of unchanged systems, and long closure reports.

After the visual-production pass reaches a satisfactory baseline, resume the deferred post-roadmap army-control / targeting / balance work only when explicitly requested.
