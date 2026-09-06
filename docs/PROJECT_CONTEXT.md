# PEPEPOW Elemental Front — PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 CLOSED → M04 IN_PROGRESS  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**M03 implementation acceptance head:** `95b107e2fce0dd609a58eaf4b594a35c33f04f7e`  
**M03 post-closure runtime baseline:** `455cbcb015b48e36b2bf570721d90cb6b5512280`  
**M03 closure report:** `docs/milestones/M03_CLOSURE_REPORT.md`  
**M04 implementation PR:** `#5` — `m04-roguelite-layer`

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
- generated-battlefield camera scaling and deterministic starting formations kept outside the Elemental Core footprint

Final M03 implementation PR acceptance: **18 files / 93 tests PASS**, M03 **5 / 5 PASS**, M02 2,048-seed regression PASS, M01 regressions PASS, strict TypeScript PASS, production build PASS.

Post-closure WebGL usability hotfix baseline: `455cbcb015b48e36b2bf570721d90cb6b5512280`. Follow-up automated verification reached **19 files / 96 tests PASS**, and the human browser smoke on 2026-09-06 confirmed all six starting player units are visible around the Core: **PASS**.

Closure: `docs/milestones/M03_CLOSURE_REPORT.md`.

---

## 4. Current milestone — M04 Roguelite Layer

**Status: IN_PROGRESS — IMPLEMENTATION PR #5**

Goal:

> Make different generated runs produce different builds and meaningful adaptation while keeping upgrades deterministic, data-driven, and replay-safe.

Implemented on `m04-roguelite-layer`:

- authoritative pure-TypeScript `RogueliteState` layered on the existing M03 simulation
- existing M02 `SHRINE` POIs used as the interaction locations
- deterministic `ACTIVATE_SHRINE` / `CHOOSE_SHRINE_UPGRADE` command queue
- deterministic three-choice Shrine offers using a Shrine-specific RNG identity isolated from visual RNG
- generic data-authored `MODIFIER` / `TRIGGER` effect descriptors
- representative Fire / Water / Ice / Lightning / mixed-element upgrade catalog
- run-level maximum Mana progression state: base 250 +20 per resolved Shrine plus upgrade/event modifiers
- early mixed-element synergy detection
- deterministic world-event schedule and event modifiers
- acquired upgrades, open Shrine choices, resolved Shrines, synergies, Mana progression, and event schedule included in M04 state hashing
- M04 combined state hash appended to the existing tactical + strategic hash chain
- upgrade modifiers wired to Fire / Heat / Freeze effect radius and Lightning trigger behavior
- desktop Shrine/upgrade/event HUD that only enqueues authoritative commands
- M04 tests covering content validation, deterministic choices, visual-RNG isolation, Shrine ownership gating, generic modifier/trigger evaluation, synergy detection, world-event determinism, command ordering, and combined state-hash divergence/reproduction

Initial PR CI run `34033184883` on implementation head `ab157f35ee76d5196290de4cc164dc170670e233`: **PASS** for `npm test` and production `npm run build`.

M04 remains IN_PROGRESS until the final branch/main CI state is green, deployment succeeds, and human WebGL smoke confirms the three-choice Shrine flow is usable and materially understandable in-browser.

M04 scope from `ROADMAP.md` remains:

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

---

## 7. Next exact action

Finish M04 as one milestone-level cycle:

1. confirm PR #5 final CI after canonical-doc updates
2. merge the tested implementation to `main`
3. confirm GitHub Pages deployment of the M04 runtime
4. run a minimal human WebGL smoke: capture a Shrine POI, open it, verify exactly three choices, choose one, and confirm the acquired upgrade / Max Mana / synergy feedback is readable
5. if the human smoke passes and no authoritative regression appears, create `docs/milestones/M04_CLOSURE_REPORT.md`, mark M04 CLOSED / M05 OPEN, compact this file to the M05 handoff, and verify final CI/deployment
