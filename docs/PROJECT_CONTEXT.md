# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 CLOSED → M04 CLOSED → M05 CLOSED → M06 CLOSED → M07 CLOSED → M08 IN_PROGRESS  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**Current milestone:** M08 — Combat & Visual Polish  
**Latest M07 gameplay runtime baseline:** `672e2368d5b719b6f172e8f8df1e5a3671a3a69a`  
**M07 closure report:** `docs/milestones/M07_CLOSURE_REPORT.md`

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

Do not change these without a demonstrated technical or playtest need:

- browser-first, desktop-first RTS
- authoritative pure-TypeScript simulation independent from PlayCanvas presentation
- fixed simulation target: 10 Hz / 100 ms tick
- ECS-style integer entity IDs and composition
- deterministic gameplay RNG only; no uncontrolled `Math.random()` in authoritative paths
- logically independent deterministic RNG streams; visual RNG must not perturb gameplay
- command-stream replay and deterministic state hashes
- integer/fixed-point arithmetic where replay-critical
- typed-array/grid-oriented world data where practical
- deterministic system ordering
- renderer/UI consume simulation state but never own gameplay truth
- block height is a deterministic seed input, not an online dependency
- local/practice play must not require blockchain RPC
- data-driven content with validated authoring structures where practical
- generic tags/modifiers/triggers are preferred over deep inheritance or one-off effect logic

Preferred deterministic modifier order:

```text
base
→ unit modifier
→ upgrade/shrine modifier
→ terrain modifier
→ status modifier
→ final value
```

M08 presentation work must not alter gameplay hashes, replay command semantics, world generation, combat timing, AI decisions, challenge identity, or score verification.

---

## 3. CLOSED permanent gameplay baseline

### M00 — Repository Bootstrap
Tooling, PlayCanvas/Vite, CI, tests, fixed-tick shell, deterministic RNG smoke, debug foundation, and asset conventions.

### M01 — Systemic Combat Foundation
Selection/control groups, MOVE / ATTACK / STOP, navigation, combat, fog, Fire / Water / Ice / Lightning, Wet / Burning / Chilled / Frozen, dynamic navigation, replay, and tactical state hashes.

### M02 — Procedural Battlefield
Deterministic Block Height + Ruleset identity, isolated RNG streams, 128×128 typed-array world data, elevation/hydrology/biomes, regions/routes, resources, POIs/Shrines, spawns, objective/boss sites, validation/retries, Golden Blocks, and 2,048-seed regression coverage.

### M03 — Economy & Territory
Material / Mana / Influence, buildings, construction/production, population, capture, territory, supply, penalties, Outpost specialization, strategic commands/hashes, and economy/build UI.

### M04 — Roguelite Layer
Shrines, deterministic three-choice upgrades, generic modifiers/triggers, elemental/mixed paths, run Mana progression, synergies, deterministic world events, hashing, and Shrine/upgrade/event UI.

### M05 — Enemy War
Fog-bounded last-known-information AI, Utility actions, faction behaviors, Casual / Standard / Hard profiles, Director pressure/recovery/anti-turtle behavior, fair logistics, hashing, and AI debug presentation.

### M06 — Full Run
Discovery → Finale lifecycle, Destroy/Boss Hunt, bosses, Core Critical, deterministic score/result, replay packet/playback verification, Retry/Next, terrain presentation, and live minimap.

### M07 — PEPEPOW Block Challenge
CLOSED on 2026-09-07. Permanent baseline includes:

- `BlockSource` application boundary
- Manual, PEPEPOW RPC, and Official sources
- deterministic `block-challenge-v1` identity
- Block Height + Ruleset Version identity surfaced in UI
- `BC1-XXXXXXXX` challenge code
- canonical share links
- Official/Daily manifest architecture
- featured `M07 Official Launch` at block `4,950,628`
- Current / Recent block-source controls
- replay-backed `m07-score-v1` score proof
- deterministic score verification by world regeneration + replay
- local verified leaderboard behind `ChallengeLeaderboardGateway`
- no wallet requirement

M07 final automated verification:

- PR #16–#19 merged
- PR #19 final suite: 30 test files / 156 tests PASS
- M02 2,048-seed regression PASS
- M01–M06 regressions PASS
- strict TypeScript / production build PASS
- post-merge main CI `34097801085` PASS
- GitHub Pages `34097800904` PASS

Do not reopen M00–M07 unless a concrete regression is demonstrated or a product decision explicitly changes their architecture.

---

## 4. Deferred M07 known issue

The deployed browser did not successfully retrieve **PEPEPOW Current** from the external live block-height endpoints during operator testing on 2026-09-07.

This was explicitly accepted as deferred and does not block M07 closure because:

- network access is not authoritative simulation state;
- Manual Block remains available;
- Official Challenge remains available;
- RPC/network failure is required to degrade gracefully rather than block play;
- the adapter already contains timeout, failover, parser, and manual-fallback logic.

Likely future investigation:

- browser CORS behavior / response headers
- endpoint/proxy options
- whether live height should refresh per run, periodically, daily, or by another policy

Do not spend M08 visual-polish work on this issue unless it is deliberately reopened separately.

---

## 5. Current milestone — M08 Combat & Visual Polish

**Status: IN_PROGRESS**

Goal:

> Upgrade the proven deterministic game into a visually and aurally coherent project-level experience without destabilizing gameplay.

M08 scope from `ROADMAP.md`:

Combat presentation:
- project-level unit visual language
- animation
- attacks
- hit reactions
- deaths
- projectiles
- camera feedback
- readable telegraphs

Elemental VFX:
- fire
- steam
- freezing
- ice cracking
- water impact
- lightning chaining
- storm
- meteor
- smoke
- environmental reaction

Environment:
- biome materials
- props
- terrain blending
- weather
- lighting
- post-processing
- fog/atmosphere

UI:
- final HUD direction
- iconography
- minimap polish
- results/challenge presentation

Audio:
- polished SFX
- ambient loops
- user-supplied Gemini background music
- mixing/transitions

---

## 6. M08 production rules

Presentation first; simulation changes require separate justification.

Required boundaries:

- visual effects must consume simulation events/state rather than create gameplay outcomes
- use visual-only RNG or deterministic visual derivation; never consume authoritative gameplay RNG
- preserve existing replay/state-hash results for identical command streams
- never make final art asset availability a gameplay dependency
- placeholder/procedural geometry is acceptable while mechanics/readability are validated
- any manually generated final image asset gets a stable asset ID/filename and canonical prompt under `media/prompts/images/`
- mark manual-art placeholders `NEEDS_MANUAL_GENERATION`; never mark placeholder art `FINAL`
- user will generate background music separately in Gemini and upload it later
- external SFX must have documented provenance/license before being treated as final
- keep bundle-size debt visible; do not solve it by destabilizing the runtime during early M08 polish

---

## 7. M08 first-pass priority

Begin with a presentation-only gap audit of current main and prioritize improvements with the highest gameplay readability per implementation cost.

Recommended order:

1. **Unit/building silhouette + team readability**
   - clearer role silhouettes and scale hierarchy
   - player/enemy/neutral distinction
   - selection/health/target feedback

2. **Combat feedback foundation**
   - projectile presentation where attacks currently read as instant
   - impact flashes/hit reactions
   - death/dissolve or destruction feedback
   - readable attack/ability telegraphs
   - restrained camera feedback

3. **Elemental VFX readability**
   - Fire/Burning
   - Wet/Water
   - Freeze/Ice cracking/melt
   - Lightning chains/conductivity
   - boss storm/meteor effects

4. **Environment pass**
   - biome materials and terrain blending
   - props with non-gameplay visual placement
   - lighting/fog/atmosphere
   - weather only if it remains presentation-only

5. **HUD/minimap/results polish**
   - reduce debug feel
   - improve information hierarchy
   - preserve all challenge/replay verification information

6. **Audio foundation**
   - event-driven SFX interface
   - placeholder/licensed SFX with provenance
   - ambient/mixing hooks
   - background music integration only after user-provided files exist

---

## 8. Exact next action

Audit current `src/rendering/`, `src/ui/`, existing CSS, asset manifests, and simulation event/state surfaces.

Then implement the first M08 presentation slice as a coherent browser-visible pass rather than isolated microchanges. Prefer procedural/material/UI improvements that do not require final image assets.

For any final-art need discovered during that pass, create stable asset IDs + canonical prompts and continue using placeholders; do not stop implementation waiting for manual generation.

After the first coherent visual pass:

- run full tests + TypeScript + build
- deploy to Pages
- request one concise human WebGL readability check
- continue autonomously through the remaining M08 categories unless a real gameplay/design decision requires operator input.
