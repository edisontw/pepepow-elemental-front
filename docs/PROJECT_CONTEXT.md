# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 CLOSED → M04 CLOSED → M05 CLOSED → M06 CLOSED → M07 CLOSED → M08 CLOSED  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**Original roadmap:** COMPLETE  
**Final M08 runtime baseline:** `e12011b379555cde733a1c815594067185fd3024`  
**M08 closure report:** `docs/milestones/M08_CLOSURE_REPORT.md`

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

Preserve unless a demonstrated technical or later product requirement explicitly changes it:

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
- challenge/replay identity must change whenever authoritative gameplay semantics change

Ruleset separation is now explicit:

- world generation: `m02-standard-v1`
- current complete Challenge/replay/score-proof gameplay ruleset: `m08-standard-v1`

M02 Golden Blocks and established world generation remain unchanged by the M08 gameplay ruleset bump.

---

## 3. CLOSED milestone baseline

### M00 — Repository Bootstrap
TypeScript + PlayCanvas + Vite, CI/tests, fixed-tick shell, deterministic RNG smoke, RTS camera/debug foundation, and asset conventions.

### M01 — Systemic Combat Foundation
Selection/control groups, commands, navigation, combat, fog, elemental interactions/statuses, dynamic navigation, replay, and tactical hashes.

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
BlockSource boundary, Manual/RPC/Official sources, shareable challenge identity/code, Official manifest, replay-backed score proof, deterministic verification, local verified leaderboard, and graceful network failure.

Known deferred M07 issue:
- browser live-height retrieval may fail because of external endpoint / CORS behavior; Manual and Official challenge paths remain available.

### M08 — Combat & Visual Polish
Project-level procedural unit/building language, combat/projectile/hit/death feedback, elemental VFX, deterministic visual environment props, lighting/atmosphere, HUD/minimap/results polish, procedural event-driven SFX/ambience, and accumulated gameplay/UX correction passes.

Important M08 gameplay/UX additions now present on `main` include:
- building placement and parallel construction
- explicit production-building selection and Rally Points
- building-driven territory expansion
- Mana Wells and clearer Material/Mana extraction roles
- visible/actionable POIs and Influence expansion flow
- shared Mana spell costs/cooldowns
- encounter auto-aggro
- destructible/fortifiable Extractor and Mana Well sites
- clearer elemental tactical jobs

M08 final verification:
- **45 test files / 198 tests PASS**
- M02 **2,048-seed regression PASS**
- strict TypeScript PASS
- production build PASS
- main CI `34251355341` / CI #158 PASS
- GitHub Pages `34251355381` / Pages #57 PASS
- final operator WebGL presentation smoke: **PASS**

Do not reopen M00–M08 unless a concrete regression is demonstrated or a later product decision explicitly changes their architecture.

---

## 4. Post-roadmap status

Operator direction is to finish the original roadmap first and defer the many remaining gameplay/design adjustments until afterward. The original roadmap is now complete.

The following are intentionally unresolved product/design areas rather than milestone closure failures:

- deeper Fire / Water / Ice / Lightning role and counterplay redesign
- forest / river / bridge / crossing strategic-value tuning
- broader combat target and structure-assault redesign
- economy and territorial pacing
- Mana-system design and tuning
- AI behavior and balance
- progression / reward tuning
- final manually approved art replacement
- final approved/licensed SFX replacement
- user-supplied Gemini background music
- deferred PEPEPOW browser live-height / CORS integration
- client bundle code-splitting / size optimization

These are a post-roadmap backlog. They must not be represented as already solved merely because M08 is CLOSED.

---

## 5. Next-work rule

Do not automatically start a new implementation milestone or broad redesign from this closure commit.

For the next phase:

1. start from latest GitHub `main`;
2. define the specific product/gameplay redesign goal before changing implementation;
3. preserve deterministic architecture and existing CLOSED-system tests unless an explicit redesign requires change;
4. when authoritative gameplay semantics change, assign a new gameplay Ruleset Version rather than reusing `m08-standard-v1`;
5. keep final-art/audio replacement separable from gameplay correctness.

The original M00–M08 roadmap is complete; future work is deliberate post-roadmap product development.