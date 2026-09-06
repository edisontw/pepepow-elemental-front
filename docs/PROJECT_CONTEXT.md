# PEPEPOW Elemental Front｜PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 CLOSED → M02 OPEN  
**Current canonical spec level:** Game Design V0.3 + Technical Architecture V0.4  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`  
**M01 automated closure implementation:** `f278bf326375ad45848b96cbf5008e4beb7b6bef`  
**M01 final human-readability fix:** `d5624d9a68fc594a8eb43f9566f3ab9d69b91ae0`  
**M01 closure report:** `docs/milestones/M01_CLOSURE_REPORT.md`  
**Working title:** PEPEPOW Elemental Front｜元素戰線

---

## 1. Project identity

PEPEPOW Elemental Front is a browser-first desktop RTS roguelite built around **procedurally generated battlefields and systemic elemental warfare**.

Core identity:

> **A procedural RTS in which the battlefield itself can be manipulated.**

Fire, Water, Ice, and Lightning must change terrain, traversal, visibility, conductivity, and tactical opportunities rather than act only as damage types.

Target run length: approximately **25–35 minutes**.

---

## 2. Canonical files and source of truth

These four files are canonical:

1. `docs/PROJECT_CONTEXT.md` — current state and exact handoff.
2. `docs/GAME_DESIGN_SPEC.md` — gameplay rules and balance baseline.
3. `docs/TECH_ARCHITECTURE.md` — deterministic simulation/software architecture.
4. `docs/ROADMAP.md` — milestone scope and acceptance criteria.

After repository creation:

> **GitHub main is the final source of truth.**

Historical milestone/slice detail belongs in `docs/milestones/`; do not keep expanding this file with duplicated implementation history.

Before substantial work, read this file first, then only the relevant sections/files needed for the current task.

---

## 3. Locked product / architecture decisions

Do not change these without strong playtest or technical evidence:

- Browser-first, desktop-first.
- Stylized 2.5D / 3D RTS presentation.
- Simulation is authoritative; PlayCanvas is presentation/input only.
- Fixed simulation target: **10 Hz / 100 ms tick**.
- Authoritative gameplay state remains pure TypeScript.
- Integer `EntityID` and ECS-style composition.
- Deterministic RNG only; no uncontrolled `Math.random()` in gameplay paths.
- Independent RNG streams for logically independent systems.
- Command-stream replay plus canonical state hashes.
- Gameplay data should remain data-driven.
- Terrain state must affect navigation and combat.
- PEPEPOW block height is a deterministic world-seed input.
- Blockchain/RPC connectivity must never be required for local/practice play.
- AI eventually uses imperfect information and its own fog-of-war knowledge.
- PvP, NFTs, wallet requirements, mobile-first optimization, huge campaigns, and large civilization rosters remain deferred.
- Do not replace closed architecture with a disposable prototype.

---

## 4. M01 — Systemic Combat Foundation

**Status: CLOSED — 2026-09-06**

M01 established the permanent systemic-combat baseline:

- 40-unit handcrafted arena.
- Vanguard, Ranger, Elementalist, Golem archetypes.
- click/drag/Shift selection, control groups, MOVE / ATTACK / STOP.
- deterministic A* navigation and dynamic nav versioning.
- HP/combat/death/order semantics.
- Fire / Water / Ice / Lightning.
- Wet / Burning / Chilled / Frozen.
- conductivity-driven deterministic Chain Lightning.
- Water → Ice walkability and Fire/heat → Water reversal.
- melt-under-unit without teleport; Water occupant becomes Wet.
- deterministic forest ignition/spread/consumption.
- per-player fog-of-war baseline.
- authoritative state hash and command replay.
- FPS-independent deterministic tests.
- debug overlay for simulation/nav/terrain/status/fog/selection/hash state.

Canonical signature interaction passes:

```text
River blocked
→ Freeze river
→ units cross
→ enemy follows
→ Fire melts Ice
→ unit remains in Water and becomes Wet
→ Lightning chains via conductivity
```

Automated closure baseline:

- TypeScript PASS
- Vitest: **16 files / 75 tests PASS**
- Production build PASS
- GitHub CI PASS
- 40-unit deterministic/deadlock smoke PASS
- performance smoke: **181.3 ms / 420 ticks = 0.432 ms/tick** in the closure run

Human WebGL playtest on GitHub Pages:

- controls/usability PASS
- 40-unit WebGL renderer PASS
- elemental signature/readability PASS
- Wet readability initially too subtle; fixed with larger cyan halo + overhead beacon and retested PASS
- milestone fun question PASS: elemental battlefield mechanic is worth continuing

Do **not** redo M01 or reopen its architecture merely because a later milestone needs an extension. Extend the existing systems narrowly.

---

## 5. Known non-blocking technical debt

These do not reopen M01:

- PlayCanvas production bundle is roughly 520 KB gzip and still triggers the existing size warning.
- Unit-vs-unit collision/advanced steering is not a mature system yet.
- Enemy autonomous strategy/tactical AI is deferred to later roadmap work.
- Placeholder primitive presentation remains intentional until later visual polish.
- Advanced spell UX, mana/cooldowns, polished VFX/audio, weather, steam, and complex terrain wetness are deferred.

Only address these when required by a later milestone or demonstrated performance/gameplay need.

---

## 6. Deployment / verification workflow

GitHub Pages is configured through `.github/workflows/deploy-pages.yml`.

Playable URL:

`https://edisontw.github.io/pepepow-elemental-front/`

Preferred loop:

```text
GitHub implementation
→ targeted tests while developing
→ final TypeScript + full Vitest + production build
→ CI
→ GitHub Pages deployment
→ human WebGL playtest only when a milestone needs it
```

Do not repeatedly attempt controlled-browser WebGL workarounds if the environment does not support WebGL.

---

## 7. Token-efficiency rules

Token efficiency is an engineering constraint.

Prefer:

- one milestone-level mission rather than many tiny cross-chat slices
- targeted source inspection
- targeted tests during development
- one full regression pass at closure
- parallel agents only for genuinely independent modules
- concise closure reports

Avoid:

- broad repository re-audits
- rereading historical milestone reports without need
- repeated architecture reconsideration
- multiple agents modifying the same core simulation API
- repeated bundle-warning analysis
- repeated placeholder art generation
- stopping after every small subtask to request another prompt

---

## 8. Asset / audio policy

Development visuals may remain primitives/placeholders.

Asset status vocabulary:

- `PLACEHOLDER`
- `NEEDS_MANUAL_GENERATION`
- `READY_FOR_REVIEW`
- `FINAL`
- `REPLACE`

If Work-generated art is poor or token-expensive, keep a functional placeholder and create a canonical prompt for later manual generation/upload using a stable filename/path.

SFX may use suitable openly licensed/public resources, with provenance/license recorded.

Background music is generated separately by the user in Gemini; project work should prepare briefs/prompts and integrate uploaded final files rather than spend agent budget generating substitutes.

---

## 9. Current milestone — M02 Procedural Battlefield

**Status: OPEN**

Goal from `ROADMAP.md`:

> Any valid Block Height can generate a deterministic, strategically playable battlefield.

M02 scope includes:

- master seed
- independent RNG streams
- elevation
- hydrology
- biome
- strategic regions
- route graph
- river/chokepoint generation
- resources
- POIs
- player spawn
- enemy spawn
- boss/objective area
- validator
- quality score
- deterministic retry
- Golden Block regression set

M02 acceptance requires at minimum:

- same block + ruleset → same world
- visual RNG changes do not alter gameplay placement
- viable player expansion
- reachable objectives
- valid resources / no illegal overlaps
- large seed batch passes hard invariants
- strategically legible generated regions
- debug visualization of region/route structure

Do not start M03 economy/territory until M02 is CLOSED.

---

## 10. Next exact action

Start **M02 — Procedural Battlefield** as a milestone-level implementation mission, not a sequence of externally managed tiny slices.

Recommended first internal dependency order:

1. Define deterministic `WorldSeed` / ruleset identity and independent RNG stream derivation.
2. Define generated-world data model separate from PlayCanvas.
3. Build deterministic elevation + hydrology baseline.
4. Derive biome / strategic-region / route graph layers.
5. Place resources, POIs, spawns, objective/boss area.
6. Implement hard-invariant validator + quality score + deterministic retry.
7. Add Golden Block regression fixtures and large-seed batch tests.
8. Add minimal debug renderer for generated region/route structure.
9. Run full M02 automated acceptance and human readability smoke before closure.

Preserve M01 simulation authority and existing terrain/navigation/combat systems; M02 world generation should produce data consumed by them, not replace them.

---

## 11. Handoff rule for a new chat / Work session

At the start of the next session:

1. Read this `PROJECT_CONTEXT.md` from GitHub main.
2. Read only M02 in `ROADMAP.md` and relevant generation sections of `TECH_ARCHITECTURE.md` / `GAME_DESIGN_SPEC.md`.
3. Inspect current `src/simulation/random.ts`, arena/world data interfaces, terrain/navigation modules, and relevant tests.
4. Treat M00 and M01 as CLOSED.
5. Continue M02 autonomously until a real product decision, external dependency, human visual gate, or milestone closure is reached.
