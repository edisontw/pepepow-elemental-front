# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 CLOSED → M04 CLOSED → M05 CLOSED → M06 CLOSED → M07 CLOSED → M08 IN_PROGRESS  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**Current milestone:** M08 — Combat & Visual Polish  
**Latest merged main baseline:** `18e9ccba42b57e4262508093ee650aa2117d907c`  
**M08 pre-closure report:** `docs/milestones/M08_CLOSURE_REPORT.md`

---

## 1. Source of truth

GitHub `main` is the only source of truth.

Canonical files:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/GAME_DESIGN_SPEC.md`
3. `docs/TECH_ARCHITECTURE.md`
4. `docs/ROADMAP.md`

Historical milestone detail belongs under `docs/milestones/`. Do not reconstruct or redo CLOSED milestones from chat history.

All repository content and current in-game/debug UI remain English-only for now.

---

## 2. Locked architecture

Preserve unless a demonstrated technical requirement explicitly changes it:

- browser-first, desktop-first RTS
- authoritative pure-TypeScript simulation independent from PlayCanvas presentation
- fixed simulation target: 10 Hz / 100 ms tick
- ECS-style integer entity IDs and composition
- deterministic gameplay RNG only; no uncontrolled `Math.random()` in authoritative paths
- independent deterministic RNG streams; visual RNG must not perturb gameplay
- command-stream replay and deterministic state hashes
- deterministic system ordering
- renderer/UI consume authoritative state but never own gameplay truth
- Block Height remains deterministic input rather than an online dependency
- local/practice play must not require blockchain RPC
- stable challenge/replay identity must change when authoritative gameplay semantics change

M02 world generation retains its own stable `m02-standard-v1` world-generation ruleset. The current complete Challenge/replay/score-proof gameplay ruleset is being corrected at M08 pre-closure to `m08-standard-v1` so post-M07 gameplay changes cannot silently reuse an older competitive identity.

---

## 3. CLOSED milestone baseline

### M00 — Repository Bootstrap
Tooling, PlayCanvas/Vite, CI, tests, fixed-tick shell, deterministic RNG smoke, debug foundation, and asset conventions.

### M01 — Systemic Combat Foundation
Selection/control groups, commands, navigation, combat, fog, elemental state/interactions, replay, and tactical hashes.

### M02 — Procedural Battlefield
128×128 deterministic battlefield, isolated RNG streams, elevation/hydrology/biomes, regions/routes, resources, POIs, spawns, boss/objective sites, validation/retries, Golden Blocks, and 2,048-seed regression.

### M03 — Economy & Territory
Material / Mana / Influence, buildings, construction/production, population, territory, supply, capture, strategic commands/hashes, and economy UI.

### M04 — Roguelite Layer
Shrines, deterministic upgrades, modifiers/triggers, elemental/mixed paths, run Mana progression, synergies, events, hashing, and UI.

### M05 — Enemy War
Fog-bounded AI knowledge, Utility actions, factions/difficulty, Director behavior, logistics, hashing, and debug presentation.

### M06 — Full Run
Discovery → Finale lifecycle, Destroy/Boss Hunt, bosses, Core Critical, score/result, replay packet/playback verification, retry/next, terrain presentation, and live minimap.

### M07 — PEPEPOW Block Challenge
BlockSource boundary, Manual/RPC/Official sources, shareable Block Challenge identity/code, Official manifest, replay-backed score proof, deterministic verification, local verified leaderboard, and graceful network failure. M07 browser live-height/CORS issue remains explicitly deferred.

Do not reopen M00–M07 unless a concrete regression is demonstrated or a later product decision explicitly changes their architecture.

---

## 4. M08 implementation state

**Status:** IN_PROGRESS — FINAL HUMAN WEBGL PRESENTATION SMOKE PENDING after the pre-closure identity correction merges and deploys.

Operator direction on 2026-09-08:

> Finish the original roadmap first. Broader game-design and gameplay adjustments will be handled later.

Therefore do not start another broad gameplay redesign during M08 closure.

M08 implementation PRs #22–#35 now cover:

- all eight unit archetype silhouettes and strategic building silhouettes
- selection/team/health/facing readability
- ranged projectiles, attack/hit/death feedback
- deterministic visual-only environment props
- Fire, Water, Ice, steam, Lightning and boss elemental feedback
- compact player-facing HUD hierarchy
- interactive minimap and central battlefield usability
- economy/production/POI/resource-site player-facing clarity accumulated during correction passes
- procedural event-driven combat/elemental SFX
- low-volume procedural ambient bed
- boss/finale telegraphs and phase-dependent lighting
- stable manual HUD icon asset IDs and canonical prompts
- future Gemini background music slot marked for manual generation/upload

PR #35 (`M08: finish roadmap presentation pass`) merged as `18e9ccba42b57e4262508093ee650aa2117d907c`.

Automated evidence at that baseline:

- 44 test files / 197 tests PASS
- M02 2,048-seed regression PASS
- strict TypeScript PASS
- production build PASS
- main CI #156 PASS
- GitHub Pages #56 PASS

---

## 5. M08 pre-closure technical identity correction

M08 correction PRs introduced deterministic authoritative gameplay changes after M07. The old system reused the M02 world-generation version string as the competitive Challenge/replay ruleset, which is no longer semantically sufficient.

The pre-closure correction must remain narrow:

- keep M02 world-generation identity and Golden Blocks unchanged;
- define current complete gameplay Challenge ruleset as `m08-standard-v1`;
- use it in Block Challenge identity, replay packets, official challenge support, and score-proof verification;
- continue binding exact world with block height + world gameplay hash + generation attempt;
- reject obsolete/unsupported competitive rulesets rather than silently replaying them under changed gameplay semantics;
- rerun full challenge/replay/score-proof regression, TypeScript, production build, main CI and Pages.

This is a deterministic identity/versioning fix, not gameplay tuning.

---

## 6. Explicitly deferred post-roadmap work

Do not treat these as M08 closure blockers unless a concrete runtime regression makes the game unusable:

- deeper elemental role/counterplay redesign
- forest / river / bridge / crossing strategic-value tuning
- broader combat target/structure-assault redesign
- economy, territory, AI, progression and balance tuning
- final manual art replacement
- final licensed/approved SFX replacement
- user-supplied Gemini background music
- PEPEPOW browser live-height/CORS integration

These become a post-roadmap tuning backlog after M08 closes.

---

## 7. Exact next action

Complete and merge the narrow M08 competitive identity correction, with all automated checks green.

Then request exactly one concise human WebGL presentation smoke:

1. page boots and battlefield interaction works;
2. Fire / Water / Ice / Lightning effects remain readable;
3. camera impact pulse is restrained and non-disorienting;
4. Boss Hunt boss/orbit/ability telegraph is visible;
5. audio unlock, combat/element cues, faint ambience, and `M` mute work;
6. HUD/minimap/results remain readable without blocking central play.

If the operator reports PASS:

- finalize `docs/milestones/M08_CLOSURE_REPORT.md` as CLOSED;
- update `docs/ROADMAP.md` to M08 CLOSED;
- update this file to roadmap-complete/post-roadmap-tuning status;
- do not automatically begin redesign work until the next explicit direction.
