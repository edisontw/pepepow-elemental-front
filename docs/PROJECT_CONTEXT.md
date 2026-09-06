# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 OPEN  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**M02 implementation merged to main:** `c26eecf5b324bd3e9ac4a09ca571a5522450ce21`  
**M02 closure report:** `docs/milestones/M02_CLOSURE_REPORT.md`

---

## 1. Source of truth

GitHub `main` is the final source of truth.

Canonical files:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/GAME_DESIGN_SPEC.md`
3. `docs/TECH_ARCHITECTURE.md`
4. `docs/ROADMAP.md`

Historical milestone detail belongs in `docs/milestones/`. Do not rebuild context from old chat history when repository state is available.

---

## 2. Locked architecture

Do not change these without demonstrated technical or playtest need:

- browser-first, desktop-first RTS
- authoritative pure-TypeScript simulation independent from PlayCanvas presentation
- fixed simulation target: 10 Hz / 100 ms tick
- ECS-style integer entity IDs and composition
- deterministic gameplay RNG only; no uncontrolled `Math.random()` in authoritative paths
- logically independent deterministic RNG streams
- command-stream replay and deterministic state hashes
- typed-array/grid-oriented world data where practical
- terrain state can change navigation and combat
- block height is a deterministic seed input, not an online dependency
- local/practice play must not require blockchain RPC
- gameplay remains data-driven where practical
- renderer may read gameplay state but may not own gameplay truth

All repository content and in-game/debug UI are English-only for now.

---

## 3. Closed milestones

### M00 — Repository Bootstrap

CLOSED. Tooling, PlayCanvas/Vite, tests, CI, fixed-tick simulation shell, deterministic RNG smoke, debug foundation, and asset conventions are established.

### M01 — Systemic Combat Foundation

CLOSED. Do not redo.

Permanent baseline includes:

- 40-unit systemic arena
- selection, control groups, MOVE / ATTACK / STOP
- deterministic A* navigation and dynamic nav updates
- combat, death, statuses, and fog baseline
- Fire / Water / Ice / Lightning
- Wet / Burning / Chilled / Frozen
- Water → Ice walkability and Fire/heat → Water reversal
- conductivity-driven deterministic lightning chaining
- deterministic forest fire
- command replay and authoritative state hashes
- debug overlay and human-tested WebGL signature interaction

Closure: `docs/milestones/M01_CLOSURE_REPORT.md`.

### M02 — Procedural Battlefield

CLOSED. Do not redo.

Permanent baseline includes:

- ruleset-bound `WorldIdentity` from namespace + ruleset version + block height
- independent deterministic worldgen RNG streams
- 128×128 typed-array generated-world model
- elevation, hydrology, crossings, biome/moisture
- 12 strategic regions and connected route graph
- Material/Mana resources and POIs
- player/enemy spawns
- objective and boss areas
- hard-invariant validator
- battlefield quality score
- deterministic generation retry
- gameplay hash isolated from visual RNG
- Golden Block regression set
- 2,048-seed automated hard-invariant batch
- minimal generated-world debug visualization and `?block=<height>` manual input

M02 PR acceptance: **17 files / 88 tests PASS**, TypeScript PASS, production build PASS, large seed batch PASS.

Closure: `docs/milestones/M02_CLOSURE_REPORT.md`.

---

## 4. Current milestone — M03 Economy & Territory

**Status: OPEN**

Goal:

> Turn the systemic battlefield into a functioning RTS economy and territorial war without weakening determinism or simulation authority.

M03 scope from `ROADMAP.md`:

Resources:
- Material
- Mana
- Influence

Buildings:
- Elemental Core
- Barracks
- Arcane Tower
- Workshop
- Outpost
- Extractor

Systems:
- population
- production queues
- capture
- territory
- supply graph
- connected/disconnected penalties
- outpost specialization
- resource UI
- basic build UI
- expansion toward the initial eight-role unit roster where genuinely required

M03 acceptance must demonstrate:

- working economy without worker-spam dependency
- strategically valuable expansion
- meaningful supply cuts and disconnected penalties
- contestable enemy/neutral territory
- no infinite/free-resource bugs
- plausible resource pacing toward a 25–35 minute run
- deterministic/replay-safe economy and territory state

---

## 5. M03 implementation constraints

- Extend the M01 ECS/simulation and M02 generated-world data; do not replace them.
- Use generated M02 resources, regions, routes, and spawn locations as the world foundation.
- Do not begin M04 shrine/roguelite implementation beyond interfaces genuinely required by M03.
- Do not begin M05 autonomous strategic AI beyond minimal fixtures needed to test territory/economy interactions.
- Keep economy, capture, territory, and supply authoritative in pure TypeScript.
- Rendering/UI should consume state through presentation bridges only.
- Preserve deterministic ordering, replay/hash behavior, and explicit RNG streams.
- Prefer targeted tests while developing and one full regression pass at milestone closure.
- Do not reopen M00, M01, or M02 unless a failing regression demonstrates a real dependency defect.

---

## 6. Known non-blocking debt

- PlayCanvas bundle size warning remains known and does not block systems milestones.
- Unit-vs-unit collision/advanced steering is not mature.
- Procedural terrain is still debug/proxy presentation rather than polished world geometry.
- Enemy autonomous strategy remains deferred to M05.
- Advanced spell UX, polished VFX/audio, weather, steam, and complex terrain wetness remain later work.
- PEPEPOW RPC integration remains deferred to M07; manual deterministic block input is sufficient now.

---

## 7. Next exact action

Begin M03 at milestone level.

First establish deterministic economy/territory data and commands on top of the existing generated battlefield, then implement resource flow, buildings/production, capture/territory, and the supply graph with targeted automated tests. Continue autonomously through M03 acceptance rather than stopping after each small subsystem.

At M03 closure:

1. run final automated acceptance
2. create `docs/milestones/M03_CLOSURE_REPORT.md`
3. mark M03 CLOSED and M04 OPEN in `docs/ROADMAP.md`
4. compact this file to the M04 handoff
5. commit/push final state and verify CI/deployment as applicable
