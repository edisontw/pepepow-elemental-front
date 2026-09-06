# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 CLOSED → M04 CLOSED → M05 OPEN  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**Latest M04 runtime baseline:** `7547469bb773d9edbb777bf83e879fca91c03e31`  
**M04 closure report:** `docs/milestones/M04_CLOSURE_REPORT.md`

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

Human WebGL acceptance confirmed all six starting units are visible and usable on the generated battlefield.

Closure: `docs/milestones/M03_CLOSURE_REPORT.md`.

### M04 — Roguelite Layer

CLOSED. Do not redo.

Permanent baseline now includes:

- existing M02 `SHRINE` POIs as canonical Shrine locations
- authoritative `ACTIVATE_SHRINE` / `CHOOSE_SHRINE_UPGRADE` commands
- deterministic three-choice Shrine offers
- Shrine-choice RNG identity isolated from visual RNG and unrelated gameplay streams
- generic data-authored `MODIFIER` / `TRIGGER` effects
- representative Fire / Water / Ice / Lightning / mixed upgrade catalog
- run-level maximum Mana progression
- early mixed-element synergy detection
- deterministic world-event schedule and event modifiers
- M04 authoritative hash state integrated with the tactical + strategic hash chain
- upgrade effects wired to Fire / Heat / Freeze radius and Lightning trigger behavior
- browser Shrine/upgrade/event HUD
- generated Shrine region locator for practical playtesting

Implementation PR #5 merged to `main` at `95ad699f96a29d6461ed337ff8c1120a8b8876c8`.

Playtest-readability PR #6 merged at `7547469bb773d9edbb777bf83e879fca91c03e31`.

Final pre-closure runtime verification:

- main CI run `34033548041`: PASS
- Pages deployment run `34033548064`: PASS
- human WebGL Shrine three-choice flow on 2026-09-06: PASS

Closure: `docs/milestones/M04_CLOSURE_REPORT.md`.

---

## 4. Current milestone — M05 Enemy War

**Status: OPEN**

Goal:

> Create a fair but strategically active opponent that produces pressure without cheating.

M05 scope from `ROADMAP.md`:

- tactical AI
- strategic Utility AI
- AI blackboard
- AI fog / imperfect information
- scouting
- expansion
- raid
- defend
- attack
- regroup
- POI contest
- territory / supply awareness
- Director pressure curve
- recovery windows
- anti-turtle response

Enemy archetypes:

- Iron Legion
- Flame Cult
- Wild Horde

M05 acceptance must demonstrate:

- AI cannot see hidden current player state
- AI uses last-known information
- AI can make imperfect but plausible decisions
- AI can raid supply
- AI can retreat / regroup
- factions feel behaviorally distinct
- difficulty changes intelligence / tempo more than raw stat cheating
- no arbitrary unit spawning beside the player base

---

## 5. M05 implementation constraints

- Extend the existing M01 tactical, M02 generated-world, M03 economy/territory, and M04 roguelite runtimes; replace none of them.
- Keep enemy decision state authoritative and deterministic where replay-relevant.
- AI knowledge must be derived from legal visibility / last-known information rather than directly reading hidden live player state.
- Use existing region adjacency, territory, supply, POI, unit, building, and fog data instead of creating parallel world abstractions.
- Prefer a deterministic Utility AI / blackboard structure over large one-off scripted branches.
- Separate tactical execution from strategic intent so later faction/difficulty tuning does not destabilize core simulation ordering.
- Difficulty should primarily alter decision quality, timing, priorities, scouting, and recovery behavior rather than hidden stat multipliers or cheating information.
- Do not implement M06 victory/boss/full-run completion, M07 RPC/challenge systems, or M08 polish during M05 except minimal fixtures genuinely required to exercise enemy behavior.
- Use targeted tests during development, then one full regression pass at milestone closure.
- Do not reopen M00–M04 unless a failing regression proves a real dependency defect.

---

## 6. Known non-blocking debt

- PlayCanvas bundle-size warning remains known and non-blocking.
- Unit-vs-unit collision / advanced steering is not mature.
- Procedural terrain remains proxy/debug presentation rather than final world geometry.
- Final economy and upgrade balance require later full-run playtesting.
- Full 60–80-upgrade content envelope is intentionally deferred beyond the generic M04 proof.
- Advanced spell UX, polished VFX/audio, weather, steam, and complex terrain wetness remain later work.
- PEPEPOW RPC integration remains deferred to M07; manual deterministic block input is sufficient.

---

## 7. Next exact action

Begin M05 at milestone level, not as repeated micro-handoffs.

Start by defining a deterministic enemy knowledge/blackboard model that only receives legally observable or last-known information. Then add a minimal strategic Utility AI over the existing region / supply / POI graph with a small action set such as scout, defend, expand, raid, attack, and regroup. Prove determinism, imperfect-information boundaries, and one end-to-end enemy decision loop before expanding faction personalities or Director pacing.

At M05 closure:

1. run final automated acceptance and full M01–M04 regressions
2. perform the required human WebGL smoke for enemy behavior/readability
3. create `docs/milestones/M05_CLOSURE_REPORT.md`
4. mark M05 CLOSED and M06 OPEN in `docs/ROADMAP.md`
5. compact this file to the M06 handoff
6. verify final CI and Pages deployment
