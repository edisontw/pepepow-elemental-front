# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00–M08 CLOSED → Post-Roadmap Phase 2 CLOSED  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**Original roadmap:** COMPLETE  
**Current authoritative gameplay ruleset:** `ef-standard-v2`  
**Current replay format:** `ef-replay-v2`  
**World-generation ruleset:** `m02-standard-v1`  
**Phase 2 closure report:** `docs/POST_ROADMAP_PHASE2_CLOSURE_REPORT.md`

---

## 1. Source of truth

GitHub `main` is the only source of truth.

Canonical files:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/GAME_DESIGN_SPEC.md`
3. `docs/TECH_ARCHITECTURE.md`
4. `docs/ROADMAP.md`

Post-roadmap authoritative supplements:

- `docs/POST_ROADMAP_GAMEPLAY_REDESIGN_SPEC.md` — approved redesign direction
- `docs/POST_ROADMAP_PHASE1_IMPLEMENTATION_CONTRACT.md` — frozen element-authority contract adopted by Phase 2
- `docs/POST_ROADMAP_PHASE2_CLOSURE_REPORT.md` — implementation and validation record

Final-art prompt reference:

- `media/prompts/images/POST_ROADMAP_UNIT_BUILDING_ART_PROMPTS.md`

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
- challenge/replay identity changes whenever authoritative gameplay semantics change

Ruleset separation is now:

- world generation: `m02-standard-v1`
- gameplay / Block Challenge / score-proof ruleset: `ef-standard-v2`
- replay format: `ef-replay-v2`

M02 Golden Blocks, world-generation identity, and the 2,048-seed regression remain unchanged by the post-roadmap gameplay redesign.

---

## 3. CLOSED original-roadmap baseline

### M00–M02
Repository/bootstrap, deterministic simulation foundation, unit control/combat/navigation/elemental interactions, and the 128×128 deterministic procedural battlefield.

### M03–M04
Material / Mana / Influence economy, buildings, production, territory/supply/capture, Shrines, upgrades, synergies, events, and authoritative strategic/roguelite hashing.

### M05–M06
Fog-bounded Enemy War AI/logistics and the complete Discovery → Finale run lifecycle, including Destroy/Boss Hunt, bosses, Core Critical, score/results, replay, and minimap.

### M07–M08
PEPEPOW Block Challenge identity/verification/leaderboard plus combat, environment, HUD, audio, visual polish, building placement, Rally Points, clearer economy/POIs, Mana spell rules, auto-aggro, and resource-site defenses.

Original-roadmap final M08 baseline remains historically CLOSED. Do not reopen M00–M08 unless a concrete regression is demonstrated or a later product decision explicitly changes their behavior.

Known deferred infrastructure issue:

- browser live-height retrieval may fail because of external endpoint / CORS behavior; Manual and Official challenge paths remain available.

---

## 4. Post-roadmap Phase 2 — CLOSED

Phase 2 adopts the frozen Phase 1 implementation contract into authoritative runtime behavior.

Current element-authority model:

- standard player state starts with exactly two distinct Elemental Attunements;
- Attunement is authoritative run state, not a separate elemental stockpile resource;
- one `ELEMENTALIST` archetype is retained;
- every completed Elementalist has one immutable Fire / Water / Ice / Lightning alignment chosen at training time;
- only currently Attuned alignments may be trained;
- player-facing Tactical spells use semantic `CAST_TACTICAL` commands;
- Tactical spell authority requires a valid local aligned Elementalist;
- deterministic caster selection is independent of UI selection order;
- Tactical cooldowns belong to caster + spell;
- player-facing Strategic spells use semantic `CAST_STRATEGIC` commands;
- Strategic spells use Elemental Core / Arcane Tower / connected `MANA_BEACON` Outpost relay infrastructure;
- Strategic cooldowns belong to player + spell and do not reset when anchors change;
- static combat-role tags and dynamic elemental/status tags are separate;
- conductivity is derived from authoritative target/terrain state, including `METAL` and Wet effects;
- direct Tactical damage/control is ally-safe, while persistent environmental consequences remain faction-agnostic;
- Strategic persistent zones are authoritative and hashed;
- Shrine upgrade eligibility respects current Attunements;
- legacy M08 `CAST` remains only for closed-system regression/internal boss migration paths;
- player Elementalist production UI exposes Attuned alignment choices;
- Tactical R / Q / F / L input now routes through v2 semantic spell authority.

Phase 2 competitive identity:

- `ef-standard-v2` is ACTIVE;
- `ef-replay-v2` is ACTIVE;
- starting Attunements are recorded in replay headers;
- Attunements, Elementalist alignments, Tactical/Strategic cooldowns, and active Strategic zones participate in authoritative state hashing;
- the existing Official Challenge ID `m08-roadmap` is retained for link continuity while its active ruleset is `ef-standard-v2`;
- world generation remains `m02-standard-v1`.

Final Phase 2 automated validation:

- **51 test files / 212 tests PASS**
- M02 **2,048-seed regression PASS**
- strict TypeScript PASS
- production build PASS
- validated implementation CI: **#191 / run `34369956229` PASS**

See `docs/POST_ROADMAP_PHASE2_CLOSURE_REPORT.md` for the detailed acceptance record.

---

## 5. Remaining post-roadmap work

Do not bundle all remaining redesign work into one change. The next gameplay work should stabilize player control/readability before broad balance tuning.

Priority sequence:

1. formation and army-control redesign;
2. group movement / spacing / selection ergonomics;
3. clearer unit-role differentiation under the new elemental authority model;
4. Tactical targeting and preview UX refinement;
5. Strategic spell casting UI and spell-network/relay readability;
6. then unit-role, economy, territory, terrain, and AI elemental balance tuning;
7. progression/reward tuning, including later third-Attunement paths;
8. final manually approved art replacement;
9. final approved/licensed SFX replacement and user-supplied background music;
10. deferred PEPEPOW browser live-height/CORS integration and bundle optimization.

Explicitly still deferred from Phase 2:

- fourth-element reward content;
- ultimate-spell redesign;
- advanced AI elemental combo optimization;
- M02 world-generation changes.

---

## 6. Next-work rule

For the next gameplay phase:

1. start from latest GitHub `main`;
2. read this file first;
3. read only relevant sections of `GAME_DESIGN_SPEC.md`, `TECH_ARCHITECTURE.md`, and the post-roadmap redesign/Phase 1 contract;
4. preserve `ef-standard-v2` semantics unless the next change truly modifies authoritative competitive behavior, in which case version identity must change deliberately;
5. keep `m02-standard-v1` world generation and Golden Blocks unchanged;
6. preserve the pure-TypeScript deterministic simulation and command/replay/hash architecture;
7. do not reopen CLOSED M00–M08 or redo Phase 2;
8. keep final-art/audio replacement separable from gameplay correctness;
9. require deterministic/regression tests before WebGL acceptance.

The immediate next formal work point is **post-roadmap army control and combat-readability redesign**, beginning with formation/group-control behavior and then spell-targeting/relay UX.
