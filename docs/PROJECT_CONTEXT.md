# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 CLOSED → M04 CLOSED → M05 CLOSED → M06 CLOSED → M07 OPEN  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**Final M06 deployed runtime baseline:** `fb2a0fb1129287413803aa9cee3e2906a5ef22a3`  
**M06 closure report:** `docs/milestones/M06_CLOSURE_REPORT.md`  
**Current milestone:** M07 — PEPEPOW Block Challenge

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

---

## 3. CLOSED permanent gameplay baseline

### M00 — Repository Bootstrap
Tooling, PlayCanvas/Vite, CI, tests, fixed-tick shell, deterministic RNG smoke, debug foundation, and asset conventions are permanent.

### M01 — Systemic Combat Foundation
Selection/control groups, MOVE / ATTACK / STOP, navigation, combat, fog, Fire / Water / Ice / Lightning, Wet / Burning / Chilled / Frozen, dynamic navigation, replay, and tactical state hashes are permanent.

### M02 — Procedural Battlefield
Deterministic Block Height + Ruleset identity, isolated RNG streams, 128×128 typed-array world data, elevation/hydrology/biomes, regions/routes, resources, POIs/Shrines, spawns, objective/boss sites, validation/retries, Golden Blocks, and 2,048-seed regression coverage are permanent.

### M03 — Economy & Territory
Material / Mana / Influence, buildings, construction/production, population, capture, territory, supply, penalties, Outpost specialization, strategic commands/hashes, and economy/build UI are permanent.

### M04 — Roguelite Layer
Shrines, deterministic three-choice upgrades, generic modifiers/triggers, elemental/mixed paths, run Mana progression, synergies, deterministic world events, hashing, and Shrine/upgrade/event UI are permanent.

### M05 — Enemy War
Fog-bounded last-known-information AI, Utility actions, faction behaviors, Casual / Standard / Hard profiles, Director pressure/recovery/anti-turtle behavior, fair logistics, hashing, and AI debug presentation are permanent.

### M06 — Full Run
CLOSED on 2026-09-06. Permanent baseline includes:

- authoritative `M06Simulation` extending M05
- Discovery / Commitment / Expansion / Escalation / Finale / Complete lifecycle
- standard 0–5 / 5–12 / 12–20 / 20–27 / 27+ timing
- 27:00 time Finale plus earned momentum Finale from 15:00
- Destroy and Boss Hunt victory families
- Frost Titan / Storm Colossus / Infernal Behemoth
- Core Critical State and Engineer recovery
- deterministic victory/defeat/results/score
- M06 state-hash integration
- exact-identity replay packets and `MATCH` / `DIVERGED` verification
- Retry Block / Next Block / Replay Last
- world-event pacing around 14 and 19 minutes
- generated terrain presentation aligned to authoritative world cells
- corrected river presentation and dynamic Ice
- live minimap aligned to world/simulation state

Final M06 verification:

- implementation PR #14 — merged
- terrain/minimap correction PR #15 — merged
- final deployed runtime `fb2a0fb1129287413803aa9cee3e2906a5ef22a3`
- PR #14 CI `34041915124` — PASS
- PR #14 suite: 25 test files / 130 tests — PASS
- M06 focused 9/9 — PASS
- M02 2,048-seed regression — PASS
- PR #15 CI `34044796173` — PASS
- post-merge main CI `34044869076` — PASS
- Pages `34044869041` — PASS
- human Destroy / Boss Hunt / score / replay / Retry / Next / terrain / minimap acceptance — PASS
- final human normal-pace start-to-finish run checklist — PASS

Do not reopen M06 unless a concrete regression is demonstrated.

---

## 4. Current milestone — M07 PEPEPOW Block Challenge

**Status: OPEN**

Goal:

> Turn the deterministic Block Height world/run identity into a shareable PEPEPOW challenge system without making network access authoritative gameplay state.

Canonical architecture from `TECH_ARCHITECTURE.md`:

```text
BlockSource
├─ ManualBlockSource
└─ PepepowRpcBlockSource
```

Simulation receives block/seed input and must not care how it was obtained.

Competitive/challenge identity binds primarily to:

```text
Block Height + Ruleset Version
```

M07 scope:

- polish/manualize the existing manual block source
- introduce the PEPEPOW block fetch adapter behind the source boundary
- support current/recent block selection as designed
- define deterministic Block Challenge identity
- expose Ruleset Version clearly
- make challenges shareable
- define Daily / Official Block flow
- define leaderboard interface
- define score submission architecture
- extend replay/state-hash verification framework for challenge use
- handle RPC failure gracefully

M07 acceptance:

- manual block mode always works
- RPC failure never prevents practice play
- same block/ruleset reproduces the same challenge
- score identifies exact ruleset/challenge identity
- challenge can be shared
- leaderboard must not rely solely on client-reported final score if verification is implemented

Explicit non-goal: **no wallet requirement unless separately approved later**.

---

## 5. M07 implementation constraints

Preserve these boundaries:

- no network fetch inside authoritative simulation
- no PEPEPOW RPC dependency for local/practice play
- no change to world determinism for a fixed Block Height + Ruleset Version
- no visual asset/version change may alter challenge gameplay identity
- existing M06 replay must remain reproducible
- score/challenge metadata should identify exact ruleset and block
- RPC/cache/source metadata may be presentation/application state, not simulation truth
- graceful network failure must fall back to manual/practice behavior rather than boot failure
- do not begin M08 art/VFX/audio polish as a substitute for M07 work

---

## 6. Deferred work / non-M07 blockers

M08+:

- final combat/unit/environment art
- animation
- polished VFX/audio
- weather/atmosphere
- final minimap/HUD polish
- user-supplied Gemini background music integration/mixing

Other deferred items:

- optional third M06 victory family / Objective Control
- advanced collision/steering
- full 60–80-upgrade content envelope
- wallet functionality unless separately approved

Known non-blocking debt:

- PlayCanvas bundle-size warning
- unit-vs-unit collision / advanced steering is not mature
- generated terrain is authoritative cell-aligned prototype geometry, not final environment art
- balance remains subject to later broader playtesting

---

## 7. Next exact action

Start M07 at the application boundary, not inside simulation:

1. audit the current query-param/manual Block Height path and replay header identity;
2. formalize a small `BlockSource` contract with `ManualBlockSource` as the baseline implementation;
3. define a versioned deterministic `BlockChallengeIdentity` centered on Block Height + Ruleset Version, with enough world/run metadata for exact reproduction;
4. surface that identity in the browser/results/replay flow and add tests proving same identity reproduces the same world/run inputs;
5. then add `PepepowRpcBlockSource` behind the interface with graceful failure/fallback;
6. only after the source/identity boundary is stable, proceed to share links, Daily/Official Block, leaderboard/score submission, and remote verification interfaces.

Do not redo M00–M06 and do not require a wallet.
