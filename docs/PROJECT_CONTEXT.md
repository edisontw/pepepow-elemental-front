# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 CLOSED → M04 CLOSED → M05 CLOSED → M06 IN_PROGRESS — HUMAN WEBGL ACCEPTANCE PENDING  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**Final M05 runtime baseline:** `7e0e5082d1e0c1ed44d8546f0031d45f4a3899a6`  
**M06 deployed runtime baseline:** `c7ec126efce64e8411c1398c0a789f1963b85546`  
**M06 implementation PR:** #14 — MERGED  
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

Closure: `docs/milestones/M00_CLOSURE_REPORT.md`.

### M01 — Systemic Combat Foundation

CLOSED. Permanent tactical baseline includes selection/control groups, MOVE / ATTACK / STOP, deterministic navigation, combat, fog, Fire / Water / Ice / Lightning, Wet / Burning / Chilled / Frozen, dynamic navigation, command replay, and tactical state hashes.

Closure: `docs/milestones/M01_CLOSURE_REPORT.md`.

### M02 — Procedural Battlefield

CLOSED. Permanent world baseline includes deterministic block/ruleset identity, isolated RNG streams, 128×128 typed-array world data, elevation/hydrology/biomes, strategic regions/routes, resources, POIs/Shrines, player/enemy spawns, objective/boss areas, validation/quality/retry, Golden Blocks, 2,048-seed regression coverage, and generated-world debug visualization.

Closure: `docs/milestones/M02_CLOSURE_REPORT.md`.

### M03 — Economy & Territory

CLOSED. Permanent strategic baseline includes Material / Mana / Influence, Core economy, six building types, deterministic construction/production, eight-role production data, population, capture, territory, supply, disconnected penalties, Outpost specialization, strategic command/hash, and browser economy/build UI.

Closure: `docs/milestones/M03_CLOSURE_REPORT.md`.

### M04 — Roguelite Layer

CLOSED. Permanent roguelite baseline includes Shrines, deterministic three-choice upgrades, generic modifiers/triggers, elemental/mixed paths, run Mana progression, synergies, deterministic world events, M04 hashing, and browser Shrine/upgrade/event HUD.

Closure: `docs/milestones/M04_CLOSURE_REPORT.md`.

### M05 — Enemy War

CLOSED. Do not redo.

Permanent enemy-war baseline includes fog-bounded last-known-information AI, Utility actions, tactical/strategic execution through existing command paths, hidden-target pursuit cutoff, Iron Legion / Flame Cult / Wild Horde behavior, Casual / Standard / Hard tempo/intelligence profiles, Director pressure/recovery/anti-turtle behavior, fair BUILD/TRAIN logistics, M05 hashing, and browser AI debug state.

Final M05 verification:

- final runtime `7e0e5082d1e0c1ed44d8546f0031d45f4a3899a6`
- 24 test files / 121 tests: PASS
- M02 2,048-seed regression: PASS
- main CI `34037645488`: PASS
- Pages `34037645465`: PASS
- human WebGL acceptance 2026-09-06: PASS

Closure: `docs/milestones/M05_CLOSURE_REPORT.md`.

---

## 4. Current milestone — M06 Full Run

**Status: IN_PROGRESS — HUMAN WEBGL ACCEPTANCE PENDING**

Goal:

> Complete the first deterministic start-to-finish game loop using the systems already proven in M01–M05.

### Implemented and merged in PR #14

- authoritative `M06Simulation` extending M05 rather than a parallel runtime
- deterministic run phases: Discovery / Commitment / Expansion / Escalation / Finale / Complete
- canonical standard five-act timing: 0–5 / 5–12 / 12–20 / 20–27 / 27+ minutes
- time-based standard Finale gate at 27:00
- optional momentum Finale unlock from 15:00 after sufficient territory + Shrines + completed non-Core buildings
- Destroy victory family using the generated enemy Core
- Boss Hunt victory family using the generated boss site
- Frost Titan / Storm Colossus / Infernal Behemoth deterministic boss selection
- boss battlefield actions through existing Freeze / Lightning / Fire / Heat systems
- player Core HP/Armor and one-time 30-second Core Critical State
- nearby Engineer recovery to the canonical 10% Core HP threshold
- deterministic victory / defeat / result reason
- deterministic score breakdown: victory, time, army survival, territory, objectives, resource efficiency, elemental style
- M06 run state included in the combined authoritative hash
- versioned replay packet with block/ruleset/world/faction/difficulty/mode/pace identity
- external GAME / STRATEGIC / ROGUELITE command recording
- replay commands injected at their authoritative target tick so upgrade/status-dependent CAST semantics are evaluated at the correct state
- replay checkpoint `MATCH` / altered-command `DIVERGED` verification
- local Retry Block / Next Block / Replay Last / Destroy↔Boss Hunt flow
- browser Full Run HUD, Core/target health, Critical countdown, results/score screen, replay status, and boss marker
- deterministic M04 world events paced at approximately 14 and 19 minutes before the standard Finale

### Automated and deployment verification

- PR #14 final CI `34041915124`: PASS
- final PR suite: 25 test files / 130 tests PASS
- M06 focused suite: 9 / 9 PASS
- M02 2,048-seed hard-invariant regression: PASS
- M01–M05 regressions: PASS
- strict TypeScript: PASS
- production Vite build: PASS
- merged runtime main: `c7ec126efce64e8411c1398c0a789f1963b85546`
- main CI `34042091843`: PASS
- GitHub Pages `34042091831`: PASS

Closure audit: `docs/milestones/M06_CLOSURE_GAP_AUDIT.md`.

---

## 5. Remaining M06 closure blockers

Automated implementation, merge, main CI, and Pages deployment are complete. Only human WebGL acceptance remains.

### A. Deployed smoke acceptance

Verify on the deployed runtime:

- Run HUD and objective health are readable
- smoke Destroy completion reaches a visible result screen
- smoke Boss Hunt shows a visible boss and perceptible elemental battlefield effect
- score breakdown is readable
- Retry Block reloads the same block
- Next Block advances the block height
- Replay Last reaches `REPLAY MATCH`
- Core Critical / Engineer recovery / final defeat presentation is understandable if encountered

### B. Standard start-to-finish run

Complete at least one normal-pace run and judge:

- meaningful decisions throughout
- loss explainability if defeated
- memorable systemic event
- next seed worth trying
- approximately 25–35 minute standard duration plausibility

Only after the human gate passes:

1. finalize `docs/milestones/M06_CLOSURE_REPORT.md`
2. mark M06 CLOSED in canonical docs
3. open M07 — PEPEPOW Block Challenge

Do not close M06 from automated tests alone.

---

## 6. Explicit non-goals / deferred work

Not M06 blockers:

- optional third victory family / Objective Control
- PEPEPOW RPC fetching, Daily/Official Block, leaderboard, score submission, remote replay verification — M07
- wallet requirement — not approved
- final combat/unit/environment art, animation, VFX, audio, weather, and broad UI polish — M08+
- advanced collision/steering
- full 60–80-upgrade content envelope

---

## 7. Known non-blocking debt

- PlayCanvas bundle-size warning remains known and non-blocking.
- Unit-vs-unit collision / advanced steering is not mature.
- Procedural terrain remains proxy/debug presentation rather than final world geometry.
- Final economy, AI, boss, score, and upgrade balance still require full-run playtesting.
- Advanced spell UX, polished VFX/audio, weather, steam, and complex terrain wetness remain later work.

---

## 8. Next exact action

Perform the human WebGL smoke acceptance, then complete one standard start-to-finish run as defined above. If both pass, formally close M06 and open M07.

Do not start M07 until M06 is formally CLOSED.
