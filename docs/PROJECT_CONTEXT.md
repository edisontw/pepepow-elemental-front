# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 CLOSED → M04 CLOSED → M05 CLOSED → M06 IN_PROGRESS — FINAL STANDARD WEBGL RUN PENDING  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**Final M05 runtime baseline:** `7e0e5082d1e0c1ed44d8546f0031d45f4a3899a6`  
**Current M06 deployed runtime baseline:** `fb2a0fb1129287413803aa9cee3e2906a5ef22a3`  
**M06 implementation PR:** #14 — MERGED  
**M06 terrain/minimap fix PR:** #15 — MERGED  
**M06 closure gap audit:** `docs/milestones/M06_CLOSURE_GAP_AUDIT.md`

---

## 1. Source of truth

GitHub `main` is the final source of truth.

Canonical files:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/GAME_DESIGN_SPEC.md`
3. `docs/TECH_ARCHITECTURE.md`
4. `docs/ROADMAP.md`

Historical milestone detail belongs in `docs/milestones/`. Do not reconstruct CLOSED milestones from chat history when repository state is available.

All repository content and current in-game/debug UI are English-only for now.

---

## 2. Locked architecture

Do not change these without demonstrated technical or playtest need:

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

---

## 3. CLOSED milestone baseline

### M00 — Repository Bootstrap
CLOSED. Tooling, PlayCanvas/Vite, tests, CI, fixed-tick simulation shell, deterministic RNG smoke, debug foundation, and asset conventions are permanent.

### M01 — Systemic Combat Foundation
CLOSED. Selection/control groups, MOVE / ATTACK / STOP, deterministic navigation, combat, fog, elemental interactions, dynamic navigation, replay, and tactical state hashes are permanent.

### M02 — Procedural Battlefield
CLOSED. Deterministic block/ruleset identity, isolated RNG streams, 128×128 typed-array world data, elevation/hydrology/biomes, regions/routes, resources, POIs/Shrines, spawns, objective/boss sites, validation/quality/retry, Golden Blocks, and 2,048-seed regression coverage are permanent.

### M03 — Economy & Territory
CLOSED. Material / Mana / Influence, Core economy, buildings, construction/production, population, capture, territory, supply, penalties, Outpost specialization, strategic commands/hashes, and browser economy/build UI are permanent.

### M04 — Roguelite Layer
CLOSED. Shrines, deterministic three-choice upgrades, generic modifiers/triggers, elemental/mixed paths, run Mana progression, synergies, world events, hashing, and browser Shrine/upgrade/event HUD are permanent.

### M05 — Enemy War
CLOSED. Fog-bounded last-known-information AI, Utility actions, faction behaviors, Casual / Standard / Hard profiles, Director pressure/recovery/anti-turtle behavior, fair logistics, hashing, and browser AI debug state are permanent.

Final M05 verification:

- runtime `7e0e5082d1e0c1ed44d8546f0031d45f4a3899a6`
- 24 test files / 121 tests PASS
- M02 2,048-seed regression PASS
- main CI `34037645488` PASS
- Pages `34037645465` PASS
- human WebGL acceptance 2026-09-06 PASS

---

## 4. Current milestone — M06 Full Run

**Status: IN_PROGRESS — FINAL STANDARD WEBGL RUN PENDING**

Goal:

> Complete the first deterministic start-to-finish game loop using the systems already proven in M01–M05.

### Implemented in PR #14

- authoritative `M06Simulation` extending M05
- deterministic phases: Discovery / Commitment / Expansion / Escalation / Finale / Complete
- canonical standard timing: 0–5 / 5–12 / 12–20 / 20–27 / 27+ minutes
- standard Finale time gate at 27:00
- optional momentum Finale unlock from 15:00 after sufficient territory + Shrines + completed non-Core buildings
- Destroy victory family using enemy Core
- Boss Hunt victory family using generated boss site
- Frost Titan / Storm Colossus / Infernal Behemoth deterministic boss selection
- boss abilities routed through existing Freeze / Lightning / Fire / Heat systems
- player Core HP/Armor and one-time 30-second Core Critical State
- nearby Engineer recovery to 10% Core HP
- deterministic victory / defeat / result reason
- deterministic score breakdown
- M06 run state included in authoritative hash
- versioned replay packet with exact run/world identity
- external GAME / STRATEGIC / ROGUELITE command recording
- replay commands injected at their authoritative target tick
- replay checkpoint `MATCH` / altered-command `DIVERGED`
- Retry Block / Next Block / Replay Last / Destroy↔Boss Hunt flow
- browser Full Run HUD, objective health, Critical countdown, results/score, replay status, and boss marker
- M04 world events paced at approximately 14 and 19 minutes before the 27-minute standard Finale

### Presentation correction in PR #15

Human WebGL testing exposed generated terrain / river / minimap presentation drift. PR #15 corrected presentation only; authoritative gameplay rules were not changed.

Permanent presentation baseline now includes:

- generated 3D battlefield reads authoritative `GeneratedWorld.terrain` / `biome` cells directly
- no M01-style coplanar ground/river proxy overlap on generated worlds
- no duplicate always-visible freezable-water overlay
- complete generated Woodland and Highlands presentation
- dynamic Ice overlays only where `TerrainState.surface` is actually ICE
- live minimap aligned to the same generated world
- moving player-unit markers
- enemy-unit markers only when `visibleToPlayer`
- separate player/enemy Core markers
- live Ice and burning minimap state
- minimap coordinate regression coverage across deterministic blocks 0, 42, and 1,000,000

### Automated / deployment verification

PR #14:

- CI `34041915124` PASS
- 25 test files / 130 tests PASS
- M06 focused suite 9/9 PASS
- M02 2,048-seed hard-invariant regression PASS
- strict TypeScript PASS
- production Vite build PASS

PR #15:

- PR CI `34044796173` PASS
- post-merge main CI `34044869076` PASS
- GitHub Pages `34044869041` PASS
- deployed runtime baseline `fb2a0fb1129287413803aa9cee3e2906a5ef22a3`

---

## 5. Human WebGL acceptance completed

On 2026-09-06 the deployed runtime passed:

- Destroy smoke completion — PASS
- Boss Hunt smoke completion — PASS
- score/result readability — PASS
- visible boss + elemental battlefield behavior — PASS
- Replay Last → `REPLAY MATCH` — PASS
- Retry Block — PASS
- Next Block — PASS
- corrected generated terrain / river presentation — PASS
- live minimap battlefield alignment — PASS
- moving player markers on minimap — PASS

Core Critical authoritative mechanics are automated and PASS. Human closure does not require a production debug cheat or deliberately forcing the state. If Core Critical naturally occurs during the final standard run, its countdown/recovery/defeat presentation should be judged for readability.

---

## 6. ONLY remaining M06 closure blocker

Complete one normal-pace start-to-finish run on the deployed runtime and judge:

- meaningful decisions throughout
- loss explainability if defeated
- at least one memorable/readable systemic event
- whether the next seed feels worth trying
- duration plausibly consistent with the approximately 25–35 minute standard target, allowing the documented faster momentum path when earned
- Core Critical readability if it naturally occurs

Recommended final acceptance URL:

`https://edisontw.github.io/pepepow-elemental-front/?block=1000000&pace=standard&mode=destroy&difficulty=standard`

If the final standard run passes:

1. create/finalize `docs/milestones/M06_CLOSURE_REPORT.md`
2. mark M06 CLOSED in canonical docs
3. update `docs/ROADMAP.md` to M06 CLOSED → M07 OPEN
4. only then begin M07 — PEPEPOW Block Challenge

Do not start M07 before formal M06 closure.

---

## 7. Explicit deferred work / non-blockers

Not M06 blockers:

- optional third victory family / Objective Control
- PEPEPOW RPC fetching, Daily/Official Block, leaderboard, score submission, remote replay verification — M07
- wallet requirement — not approved
- final combat/unit/environment art, animation, VFX, audio, weather, and broad UI polish — M08+
- advanced collision/steering
- full 60–80-upgrade content envelope

Known non-blocking debt:

- PlayCanvas bundle-size warning
- unit-vs-unit collision / advanced steering is not mature
- generated terrain is authoritative cell-aligned presentation but still prototype geometry rather than final environment art
- economy, AI, boss, score, and upgrade balance remain subject to full-run playtesting
- advanced spell UX, polished VFX/audio, weather, steam, and complex terrain wetness remain later work

---

## 8. Next exact action

Run the final standard start-to-finish WebGL acceptance using the URL above. If it passes, formally close M06 and open M07.