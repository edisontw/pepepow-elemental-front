# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 CLOSED → M04 CLOSED → M05 IN_PROGRESS — HUMAN WEBGL ACCEPTANCE PENDING  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**Latest M05 deployed runtime baseline:** `144a93b8e73f1885f266a0981166056d9d8f8aaf`  
**M05 pre-closure report:** `docs/milestones/M05_CLOSURE_REPORT.md`

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

Preferred modifier order from `TECH_ARCHITECTURE.md`:

```text
base
→ unit modifier
→ upgrade/shrine modifier
→ terrain modifier
→ status modifier
→ final value
```

Ordering must remain deterministic.

---

## 3. CLOSED milestone baseline

### M00 — Repository Bootstrap

CLOSED. Tooling, PlayCanvas/Vite, tests, CI, fixed-tick shell, deterministic RNG smoke, debug foundation, and asset conventions are permanent.

Closure: `docs/milestones/M00_CLOSURE_REPORT.md`.

### M01 — Systemic Combat Foundation

CLOSED. Permanent tactical baseline includes selection/control groups, MOVE / ATTACK / STOP, deterministic navigation, combat, fog, Fire / Water / Ice / Lightning, Wet / Burning / Chilled / Frozen, dynamic navigation, command replay, and tactical state hashes.

Closure: `docs/milestones/M01_CLOSURE_REPORT.md`.

### M02 — Procedural Battlefield

CLOSED. Permanent world baseline includes deterministic block/ruleset identity, isolated RNG streams, 128×128 typed-array world data, elevation/hydrology/biomes, 12 strategic regions and route graph, resources, POIs including Shrines, player/enemy spawns, objective/boss areas, validation/quality/retry, Golden Blocks, 2,048-seed regression coverage, and generated-world debug visualization.

Closure: `docs/milestones/M02_CLOSURE_REPORT.md`.

### M03 — Economy & Territory

CLOSED. Permanent strategic baseline includes Material / Mana / Influence, passive Core economy, six building types, deterministic construction/production queues, eight-role unit production data, population, capture, territory, supply graph, disconnected penalties, Outpost specialization, strategic command queue/hash, and browser build/resource/capture UI.

Closure: `docs/milestones/M03_CLOSURE_REPORT.md`.

### M04 — Roguelite Layer

CLOSED. Permanent roguelite baseline includes generated Shrines, deterministic three-choice upgrades, generic modifier/trigger content, Fire/Water/Ice/Lightning/mixed paths, run Mana progression, synergy detection, world events, authoritative M04 hashing, and browser Shrine/upgrade/event HUD.

Final M04 runtime baseline: `7547469bb773d9edbb777bf83e879fca91c03e31`.

Closure: `docs/milestones/M04_CLOSURE_REPORT.md`.

---

## 4. Current milestone — M05 Enemy War

**Status: IN_PROGRESS — HUMAN WEBGL ACCEPTANCE PENDING**

Goal:

> Create a fair but strategically active opponent that produces pressure without cheating.

### Implemented

- deterministic enemy blackboard constrained by enemy fog visibility
- last-known player-unit memory with deterministic confidence decay
- legal region / POI / territory / supply / visible-building knowledge
- strategic Utility AI: SCOUT / EXPAND / DEFEND / RAID / ATTACK / CONTEST_POI / REGROUP
- tactical execution through existing MOVE / ATTACK commands
- strategic execution through existing CAPTURE commands
- hidden-target pursuit guard: AI stops live entity tracking after the target leaves legal enemy visibility and can only use remembered position
- Iron Legion / Flame Cult / Wild Horde behavior weights
- Casual / Standard / Hard profiles based on decision tempo, memory, and thresholds rather than raw combat-stat multipliers
- Director pressure curve
- recovery windows
- anti-turtle response
- fair enemy production logistics through existing M03 resources, BUILD / TRAIN, population, build times, train times, and producer-local spawning
- faction-specific producer/unit cycles
- M05 deterministic hash integration
- browser debug overlay for faction, difficulty, intent, pressure, visible/remembered information, known supply, decisions, and AI hash
- deterministic browser playtest query parameters: `faction=iron|flame|wild` and `difficulty=casual|standard|hard`

Implementation sequence:

- PR #8 — Enemy War core
- PR #9 — RAID / REGROUP end-to-end acceptance hardening
- PR #10 — fair enemy production logistics
- latest deployed main: `144a93b8e73f1885f266a0981166056d9d8f8aaf`

Final automated verification on that runtime:

- main CI run `34036742615`: PASS
- GitHub Pages run `34036742620`: PASS
- 24 test files / 121 tests: PASS
- strict TypeScript + production Vite build: PASS
- M02 2,048-seed hard-invariant regression: PASS
- M01–M04 regressions: PASS

### M05 acceptance status

Automated PASS:

- AI cannot see hidden current player state
- AI uses last-known information
- AI can raid supply through existing command queues
- AI can retreat / regroup through existing command queues
- faction behavior/production profiles are structurally distinct
- difficulty alters AI tempo/memory/thresholds without raw combat-stat cheating
- no arbitrary enemy spawning beside the player base
- fair enemy reinforcements require normal M03 resources, producers, queues, population, and timing
- deterministic combined hashes reproduce

Human-only gate still pending:

- imperfect decisions feel plausible/readable during actual WebGL play
- Iron Legion / Flame Cult / Wild Horde feel meaningfully different in browser play
- no visible behavior suggests unfair live tracking through fog
- enemy pressure is active but understandable

---

## 5. Human WebGL playtest entry points

Use the same block when comparing factions so world layout stays constant.

Examples:

```text
https://edisontw.github.io/pepepow-elemental-front/?block=1000000&faction=iron&difficulty=hard
https://edisontw.github.io/pepepow-elemental-front/?block=1000000&faction=flame&difficulty=hard
https://edisontw.github.io/pepepow-elemental-front/?block=1000000&faction=wild&difficulty=hard
```

The debug overlay should show `M05 ENEMY WAR`, the selected faction/difficulty, current enemy intent, AI pressure, visible/remembered player information, known supply, decision count, and AI hash.

Minimal human acceptance:

1. enemy units do not remain permanently idle at spawn; they scout / expand / contest / attack as information develops
2. move player units into contact, then retreat into fog; enemy behavior should not look like perfect live-position tracking
3. compare Iron / Flame / Wild on the same block and confirm the behavior feels meaningfully different
4. confirm no enemy unit suddenly appears beside the player base without normal travel/production
5. confirm overall pressure and intent remain understandable enough to call the opponent fair rather than cheating

If all five pass, M05 can be CLOSED without additional implementation unless the playtest exposes a concrete defect.

---

## 6. Known non-blocking debt

- PlayCanvas bundle-size warning remains known and non-blocking.
- Unit-vs-unit collision / advanced steering is not mature.
- Procedural terrain remains proxy/debug presentation rather than final world geometry.
- Final economy, AI, and upgrade balance require later full-run playtesting.
- Full 60–80-upgrade content envelope is intentionally deferred beyond the generic M04 proof.
- Advanced spell UX, polished VFX/audio, weather, steam, and complex terrain wetness remain later work.
- PEPEPOW RPC integration remains deferred to M07; manual deterministic block input is sufficient.

---

## 7. Next exact action

Perform the M05 human WebGL behavior/readability smoke on the deployed runtime.

Do not begin M06 yet.

After human PASS:

1. change `docs/milestones/M05_CLOSURE_REPORT.md` from pending to CLOSED and record the human acceptance
2. update `docs/ROADMAP.md` to M05 CLOSED → M06 OPEN
3. compact this file into the M06 handoff
4. run/verify final docs CI and Pages deployment
5. then begin M06 — Full Run
