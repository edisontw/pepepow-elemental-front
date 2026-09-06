# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 CLOSED → M04 CLOSED → M05 CLOSED → M06 OPEN  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**Final M05 runtime baseline:** `7e0e5082d1e0c1ed44d8546f0031d45f4a3899a6`  
**M05 closure report:** `docs/milestones/M05_CLOSURE_REPORT.md`

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

CLOSED. Permanent world baseline includes deterministic block/ruleset identity, isolated RNG streams, 128×128 typed-array world data, elevation/hydrology/biomes, strategic regions and route graph, resources, POIs/Shrines, player/enemy spawns, objective/boss areas, validation/quality/retry, Golden Blocks, 2,048-seed regression coverage, and generated-world debug visualization.

Closure: `docs/milestones/M02_CLOSURE_REPORT.md`.

### M03 — Economy & Territory

CLOSED. Permanent strategic baseline includes Material / Mana / Influence, passive Core economy, six building types, deterministic construction/production queues, eight-role production data, population, capture, territory, supply graph, disconnected penalties, Outpost specialization, strategic command queue/hash, and browser economy/build UI.

Closure: `docs/milestones/M03_CLOSURE_REPORT.md`.

### M04 — Roguelite Layer

CLOSED. Permanent roguelite baseline includes generated Shrines, deterministic three-choice upgrades, generic modifier/trigger content, Fire/Water/Ice/Lightning/mixed paths, run Mana progression, synergy detection, deterministic world events, M04 hashing, and browser Shrine/upgrade/event HUD.

Closure: `docs/milestones/M04_CLOSURE_REPORT.md`.

### M05 — Enemy War

CLOSED. Do not redo.

Permanent enemy-war baseline includes:

- fog-bounded deterministic enemy blackboard
- last-known player-unit memory with confidence decay
- Utility AI actions: SCOUT / EXPAND / DEFEND / RAID / ATTACK / CONTEST_POI / REGROUP
- tactical/strategic execution through existing M01/M03 command paths
- hidden-target pursuit cutoff when player units leave legal enemy visibility
- Iron Legion / Flame Cult / Wild Horde behavior and production profiles
- Casual / Standard / Hard AI profiles based on tempo, memory, and thresholds rather than raw combat-stat cheating
- Director pressure, recovery windows, and anti-turtle response
- fair enemy BUILD / TRAIN logistics through existing M03 resources, population, producers, and timing
- M05 deterministic hash integration
- browser M05 debug state and deterministic faction/difficulty query parameters

Implementation/acceptance sequence: PR #8, #9, #10, #11, #12.

Final M05 verification:

- automated gameplay baseline main CI `34036742615`: PASS
- automated gameplay baseline Pages `34036742620`: PASS
- 24 test files / 121 tests: PASS
- M02 2,048-seed regression: PASS
- M01–M04 regressions: PASS
- final readability runtime `7e0e5082d1e0c1ed44d8546f0031d45f4a3899a6`
- final runtime main CI `34037645488`: PASS
- final runtime Pages `34037645465`: PASS
- human WebGL enemy-behavior/readability acceptance on 2026-09-06: PASS

Closure: `docs/milestones/M05_CLOSURE_REPORT.md`.

---

## 4. Current milestone — M06 Full Run

**Status: OPEN**

Goal:

> Complete the first deterministic start-to-finish game loop using the systems already proven in M01–M05.

M06 scope from `ROADMAP.md`:

- final objective framework
- boss framework
- victory
- defeat
- Core Critical State
- score
- results screen
- replay playback
- next-block / retry flow
- event pacing integration

Initial bosses from `GAME_DESIGN_SPEC.md`:

- Frost Titan — freezing / blizzard / ice-terrain pressure
- Storm Colossus — rain / water / lightning-node battlefield control
- Infernal Behemoth — fire / heat / charge battlefield pressure

Boss rule:

> Bosses modify the battlefield; they are not merely high-HP units.

Initial victory families:

- Destroy — destroy enemy Core
- Boss Hunt — defeat generated major boss
- Objective Control remains later/optional if ready

Core Critical State baseline from `GAME_DESIGN_SPEC.md`:

- once per run
- when player Core HP reaches zero, enter a 30-second critical period
- repair to 10% HP to recover
- otherwise defeat

Target standard run duration remains approximately 25–35 minutes, with five-act pacing from Discovery through Finale.

---

## 5. M06 implementation constraints

- Extend the existing M01–M05 authoritative runtime; do not build a parallel full-run simulation.
- Keep run state, objective progress, boss state, victory/defeat, score, and replay-relevant results deterministic and hashable.
- Reuse the existing generated major objective and boss areas rather than inventing a second world-objective model.
- Reuse existing Core/building health, commands, world events, elemental terrain, roguelite upgrades, enemy AI, territory, and supply systems wherever possible.
- Begin with the smallest complete run loop. Destroy + Boss Hunt are sufficient initial victory families; do not block M06 on optional Objective Control.
- Core Critical State must be authoritative and deterministic; UI only presents the countdown/state.
- Boss mechanics should alter battlefield conditions through existing elemental/world systems rather than rely on large hidden stat multipliers.
- Results and score should identify the deterministic run identity and final outcome, but M07 RPC/leaderboard submission is explicitly out of scope.
- Replay playback should build on the existing deterministic command stream/state-hash foundation rather than create a separate replay simulation.
- Retry / next-block flow must work locally without RPC.
- Do not begin M07 PEPEPOW Block Challenge or M08 final polish during M06 except minimal interfaces needed for the full-run loop.
- Do not reopen M00–M05 unless a concrete regression proves a dependency defect.
- Use targeted tests during development, then one full regression pass and human start-to-finish WebGL playtest before closure.

---

## 6. M06 acceptance target

A player must be able to complete this loop:

```text
Start
→ Scout
→ Expand
→ Build
→ Fight
→ Acquire upgrades
→ Respond to events
→ Enter finale
→ Win/Lose
→ See score/results
→ Replay or try another block
```

The final M06 playtest should answer:

- Were there meaningful decisions throughout?
- Could the player explain the loss?
- Did the run produce a memorable systemic event?
- Did the next seed feel worth trying?

---

## 7. Known non-blocking debt

- PlayCanvas bundle-size warning remains known and non-blocking.
- Unit-vs-unit collision / advanced steering is not mature.
- Procedural terrain remains proxy/debug presentation rather than final world geometry.
- Final economy, AI, boss, score, and upgrade balance require full-run tuning.
- Full 60–80-upgrade content envelope remains intentionally deferred beyond the generic M04 proof.
- Advanced spell UX, polished VFX/audio, weather, steam, and complex terrain wetness remain later work.
- PEPEPOW RPC integration, official challenges, and leaderboard submission remain M07.

---

## 8. Next exact action

Begin **M06 — Full Run** at milestone level, not as repeated micro-handoffs.

First define a deterministic authoritative run-state / objective framework on top of the existing M05 simulation. Prove one minimal end-to-end Destroy flow with victory, defeat/Core Critical State, results, retry, and deterministic hash/replay compatibility before adding Boss Hunt and boss battlefield mechanics.

Do not start M07 until M06 acceptance and closure are complete.
