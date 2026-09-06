# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 CLOSED → M04 OPEN  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**M03 acceptance head:** `95b107e2fce0dd609a58eaf4b594a35c33f04f7e`  
**M03 closure report:** `docs/milestones/M03_CLOSURE_REPORT.md`

---

## 1. Source of truth

GitHub `main` is the final source of truth.

Canonical files:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/GAME_DESIGN_SPEC.md`
3. `docs/TECH_ARCHITECTURE.md`
4. `docs/ROADMAP.md`

Historical milestone detail belongs in `docs/milestones/`. Do not reconstruct closed milestones from chat history when repository state is available.

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

## 3. Closed milestone baseline

### M00 — Repository Bootstrap

CLOSED. Tooling, PlayCanvas/Vite, tests, CI, fixed-tick shell, deterministic RNG smoke, debug foundation, and asset conventions are established.

### M01 — Systemic Combat Foundation

CLOSED. Permanent tactical baseline includes selection/control groups, MOVE / ATTACK / STOP, deterministic navigation, combat, fog, Fire / Water / Ice / Lightning, Wet / Burning / Chilled / Frozen, dynamic navigation, command replay, and tactical state hashes. Do not redo.

Closure: `docs/milestones/M01_CLOSURE_REPORT.md`.

### M02 — Procedural Battlefield

CLOSED. Permanent world baseline includes deterministic block/ruleset identity, independent worldgen RNG streams, 128×128 typed-array world data, elevation/hydrology/biomes, 12 strategic regions and route graph, Material/Mana resources, POIs including Shrines, player/enemy spawns, objective/boss areas, validation/quality/retry, Golden Blocks, 2,048-seed regression coverage, and generated-world debug visualization. Do not redo.

Closure: `docs/milestones/M02_CLOSURE_REPORT.md`.

### M03 — Economy & Territory

CLOSED. Do not redo.

Permanent baseline now includes:

- generated M02 battlefield as the active M01-compatible tactical arena
- Material / Mana / Influence fixed-point stocks
- passive Core economy without worker spam
- Elemental Core / Barracks / Arcane Tower / Workshop / Outpost / Extractor
- deterministic construction and production queues
- eight-role production data: Vanguard, Spear Guard, Ranger, Scout, Elementalist, Engineer, Golem, Siege Construct
- population and Outpost population-cap expansion
- region and POI capture
- one-time POI Influence rewards
- territory ownership and contested state
- supply graph based on M02 region adjacency
- disconnected resource/population penalties
- Outpost specialization state
- strategic command queue and strategic hash combined with the unchanged M01 tactical hash
- resource/build/production/capture browser UI
- dynamic trained-unit and building presentation
- territory/supply debug visualization

Final M03 PR acceptance: **18 files / 93 tests PASS**, M03 **5 / 5 PASS**, M02 2,048-seed regression PASS, M01 regressions PASS, strict TypeScript PASS, production build PASS.

Closure: `docs/milestones/M03_CLOSURE_REPORT.md`.

---

## 4. Current milestone — M04 Roguelite Layer

**Status: OPEN**

Goal:

> Make different generated runs produce different builds and meaningful adaptation while keeping upgrades deterministic, data-driven, and replay-safe.

M04 scope from `ROADMAP.md`:

- Shrines
- deterministic three-choice upgrade UI
- generic tags / modifiers / triggers
- Fire upgrade set
- Water upgrade set
- Ice upgrade set
- Lightning upgrade set
- mixed-element upgrades
- world-event framework
- run-level max Mana progression
- early synergy detection

Target content envelope is eventually approximately 24 Shrine types/locations and 60–80 upgrade effects, but **do not author the full content set before the generic system is proven**.

M04 acceptance must demonstrate:

- upgrades can be authored mostly as data
- deterministic Shrine choices can be reproduced from the same run inputs
- a three-choice decision changes authoritative gameplay state
- several distinct build paths can emerge
- different seeds can encourage different choices without perturbing unrelated RNG
- no single mandatory upgrade path is structurally baked into the system
- upgrades preserve replay/state-hash determinism

---

## 5. M04 implementation constraints

- Extend M01 combat, M02 world/POIs, and M03 strategic runtime; replace none of them.
- Use existing M02 `SHRINE` POIs as the first interaction locations rather than generating a second Shrine-location model.
- Introduce deterministic Shrine/upgrade choice RNG isolated from worldgen visual randomness and unrelated gameplay streams.
- Choice identity must be replayable from stable inputs such as ruleset/run identity, Shrine identity, and deterministic visit/choice state.
- Keep upgrade ownership, tags, modifiers, triggers, Mana progression, and synergy state authoritative in pure TypeScript.
- Prefer generic modifier/effect descriptors and deterministic ordering over effect-specific inheritance trees.
- UI may present choices and enqueue commands; it may not directly mutate upgrade state.
- Include acquired upgrades and any replay-relevant Shrine choice state in authoritative hashing.
- Do not begin M05 autonomous strategic AI except minimal deterministic fixtures required to exercise M04 effects.
- Do not implement M06 victory/boss run completion, M07 RPC, or M08 polish during M04.
- Use targeted tests while developing, then one full regression pass at closure.
- Do not reopen M00–M03 unless a failing regression proves a real dependency defect.

---

## 6. Known non-blocking debt

- PlayCanvas bundle size warning remains known and does not block systems milestones.
- Unit-vs-unit collision/advanced steering is not mature.
- Procedural terrain remains proxy/debug presentation rather than final world geometry.
- Enemy autonomous strategy remains deferred to M05.
- Final economy balance requires later full-run playtesting.
- Advanced spell UX, polished VFX/audio, weather, steam, and complex terrain wetness remain later work.
- PEPEPOW RPC integration remains deferred to M07; manual deterministic block input is sufficient.
- One non-blocking human WebGL smoke of the combined M03 generated battlefield + strategic UI remains useful after deployment.

---

## 7. Next exact action

Begin M04 at milestone level, not as repeated micro-handoffs.

First implement the generic deterministic upgrade/Shrine data model and authoritative command/state flow. Then wire M02 Shrine POIs to a deterministic three-choice interaction, apply a small representative set of Fire/Water/Ice/Lightning/mixed effects through generic tags/modifiers/triggers, include upgrade state in replay/hash verification, and only then expand content enough to prove several distinct build paths.

At M04 closure:

1. run final automated acceptance and full M01–M03 regressions
2. create `docs/milestones/M04_CLOSURE_REPORT.md`
3. mark M04 CLOSED and M05 OPEN in `docs/ROADMAP.md`
4. compact this file to the M05 handoff
5. commit/push final state and verify CI/deployment
