# PEPEPOW Elemental Front｜PROJECT_CONTEXT

**Project status:** M00 CLOSED → M01 IN PROGRESS  
**Current canonical spec level:** Game Design V0.3 + Technical Architecture V0.4  
**Primary development environment:** ChatGPT Work with `@site`  
**Primary repository:** `edisontw/pepepow-elemental-front`  
**M00 source snapshot on GitHub:** `05557b249774064603b8eeb7960472fe2f1a4f42`  
**Working title:** PEPEPOW Elemental Front｜元素戰線

---

## 1. Project in one paragraph

PEPEPOW Elemental Front is a browser-first 2.5D / stylized-3D real-time strategy roguelite built around **procedurally generated battlefields, systemic elemental warfare, territory control, and PEPEPOW block-height-derived deterministic world seeds**. The player controls both an army and the battlefield state. Fire, water, ice, and lightning must alter terrain, navigation, visibility, conductivity, and tactical opportunities rather than acting only as damage types.

Target run length is approximately **25–35 minutes**. The game should create memorable emergent situations in which map layout, elemental interactions, AI behavior, and player adaptation combine into a different strategic story each run.

---

## 2. Canonical files

These four files are the only design/architecture sources that agents should treat as canonical:

1. `PROJECT_CONTEXT.md` — current state, locked decisions, latest milestone, handoff.
2. `GAME_DESIGN_SPEC.md` — gameplay rules, systems, initial balance baseline.
3. `TECH_ARCHITECTURE.md` — software architecture, deterministic simulation, Work/asset workflow.
4. `ROADMAP.md` — milestone order, scope, acceptance criteria, status.

Do **not** revive or independently maintain V0.1 / V0.2 / V0.3 / V0.4 documents after repository creation. Their useful content has been consolidated into the canonical files above.

Git history becomes the record of past decisions.

---

## 3. Source of truth policy

Before repository creation:

> ChatGPT Project canonical files are the temporary source of truth.

After repository creation:

> The GitHub repository is the final source of truth.

ChatGPT Work should always read the latest repository versions of the canonical files before substantial work.

When a milestone closes, update at minimum:

- current milestone
- latest main commit
- systems completed
- known issues
- locked decisions changed, if any
- next exact task
- explicit “do not redo” notes

Do not let separate Work sessions maintain divergent private plans.

---

## 4. Locked product decisions

The following are considered locked unless playtesting produces strong evidence to change them:

- Browser-first game.
- Desktop-first controls and performance target.
- 2.5D / stylized 3D RTS presentation.
- One run approximately 25–35 minutes.
- Gameplay and replayability before visual polish.
- First complete elemental set: **Fire / Water / Ice / Lightning**.
- Terrain state must affect navigation and combat.
- PEPEPOW block height is a deterministic world-seed input.
- Blockchain connectivity must never be required to play a local/practice run.
- Procedural maps must pass deterministic validation.
- AI uses imperfect information and its own fog-of-war knowledge.
- Simulation is authoritative and separated from rendering.
- Initial simulation target: 10 Hz fixed tick.
- Gameplay data is data-driven.
- Gameplay RNG may not use uncontrolled randomness.
- Replay architecture is command-stream based.
- M01 begins from production-oriented architecture; no disposable prototype branch.
- PvP, NFTs, wallet requirement, mobile-first optimization, huge campaigns, and large civilization rosters are explicitly deferred.

---

## 5. Core gameplay identity

The project must not collapse into “a traditional RTS with magic”.

The core identity is:

> **A procedural RTS in which the battlefield itself can be manipulated.**

Key player questions should include:

- Should I freeze this river to create a crossing?
- Should I melt it while the enemy is on it?
- Is it worth making an area wet before using lightning?
- Should I burn a forest and sacrifice cover to cut off a route?
- Which region should I control for supply and mana?
- Is this run’s generated map telling me to build differently from my previous run?

Terrain and elemental state should matter at least as much as conventional unit counters.

---

## 6. Signature interaction

M01 must eventually prove the following sequence works clearly and reliably:

1. River blocks ordinary traversal.
2. Player freezes the river.
3. Units cross using the new ice navigation state.
4. Enemy follows onto the ice.
5. Heat/fire damages or melts the ice.
6. Units entering water receive `Wet`.
7. Lightning uses conductivity and chains efficiently through wet/water-connected targets.

This sequence is the first signature test for the entire project.

If it is technically correct but not enjoyable or readable, M01 is not complete.

---

## 7. Run structure

Target run pacing:

- 0–5 min: Discovery
- 5–12 min: Commitment / first build direction
- 12–20 min: Expansion and supply conflict
- 20–27 min: Escalation
- 27–35 min: Finale / boss / major objective

Indicative timing targets:

- first combat: 2–4 min
- first shrine: 3–6 min
- first meaningful expansion: 5–8 min
- second elemental dimension / synergy: 8–14 min
- first major battle: 10–15 min
- major world event: 14–22 min
- final objective / boss: 24–30 min

---

## 8. Initial content target

For the first mature alpha, the target envelope is:

- 3 biomes
- 4 core elements
- 8 primary unit roles
- 6 core buildings
- approximately 24 shrine types/locations
- approximately 60–80 upgrade effects
- 3 enemy archetypes/factions
- 3 bosses
- approximately 8 world events
- 3 victory-mode families
- 60–80 normal population cap range
- Standard procedural map: 128×128 logical cells

This is a target envelope, not permission to front-load content before systems work.

---

## 9. Development workflow in ChatGPT Work

Development is expected to use **ChatGPT Work + `@site` + multiple agents**.

Agents should be assigned narrow, testable work packages. The coordinating agent must prefer parallel work only where modules are sufficiently independent.

Recommended agent work-package style:

- one clear goal
- exact files/modules allowed to change
- explicit acceptance tests
- explicit non-goals
- no speculative refactors
- no duplicate implementation of already-closed systems
- return concise findings and changed-file summary

Agents should not repeatedly re-audit stable code unless a failing test or regression specifically requires it.

Token efficiency is a project constraint. Avoid spending long agent cycles on:
- repeated architecture reconsideration
- excessive re-reading of historical design documents
- repeated visual generation attempts
- broad refactors without a demonstrated gameplay or maintainability benefit

---

## 10. Visual asset policy

During system development, visuals are allowed to be temporary.

Preferred priority:

1. simple geometric placeholders
2. lightweight temporary generated asset
3. manually produced polished asset later

Do **not** burn large agent/token budgets repeatedly regenerating artwork merely to improve a placeholder.

If an AI-generated image in Work is:
- low quality
- visually inconsistent
- compositionally wrong
- expensive to regenerate
- not yet worth polishing

then retain or revert to a functional placeholder and create a **canonical image prompt** for later manual production.

Final image replacement workflow:

1. Agent identifies asset requirement.
2. Agent creates/updates canonical prompt and asset manifest entry.
3. Development uses a clearly tagged placeholder.
4. User later generates polished image manually.
5. User uploads final asset to GitHub using the canonical filename.
6. Runtime automatically replaces the placeholder through the same asset path/manifest.
7. No gameplay code should require alteration for the replacement.

All final filenames and intended aspect ratios must be stable before manual production.

---

## 11. Audio policy

### Sound effects

Sound effects may come from:
- reputable public sound libraries
- openly licensed game-audio resources
- other easy-to-obtain sources with acceptable quality

Requirements:
- quality must be adequate for a polished game
- licensing/provenance must be recorded
- avoid low-bitrate, clipped, noisy, or obviously inconsistent assets
- avoid embedding a dependency on a source that cannot legally be redistributed

Every external SFX should eventually have metadata such as:
- source
- author if required
- license
- original URL/reference
- edited status
- final filename

### Background music

Background music is **not** a Work-agent generation task by default.

Workflow:

1. Game defines required music mood, duration, loop behavior, and scene usage.
2. Canonical music prompts/briefs are prepared.
3. User generates the actual music separately in Gemini.
4. User manually uploads final audio files to GitHub.
5. Game loads them through a stable audio manifest.

Agents should not repeatedly spend tokens generating substitute background music.

---

## 12. Asset status convention

Recommended status field:

- `PLACEHOLDER`
- `NEEDS_MANUAL_GENERATION`
- `READY_FOR_REVIEW`
- `FINAL`
- `REPLACE`

A placeholder must never be mistaken for approved final art.

Recommended future asset manifest fields:

```text
id
type
canonicalFilename
usage
aspectRatio / duration
status
promptRef
source
license
notes
```

---

## 13. What not to do

Do not:

- create multiple competing game-design specs
- restart architecture after each new Work session
- use artwork quality as a reason to block gameplay milestones
- add blockchain wallet dependencies before the core game works
- make AI omniscient
- let renderer state determine game state
- hard-code large amounts of balance data into unit classes
- use `Math.random()` in deterministic gameplay paths
- implement PvP during the current roadmap
- spend milestone time on cinematic polish before systemic combat is proven
- mark a milestone CLOSED without its acceptance criteria and tests passing

---

## 14. Current state

**Design consolidation:** COMPLETE  
**Repository:** CREATED  
**M00 — Repository Bootstrap:** CLOSED  
**Current milestone:** M01 — Systemic Combat Foundation (`IN_PROGRESS`)  
**M00 closure report:** `docs/milestones/M00_CLOSURE_REPORT.md`

M00 completed the permanent TypeScript + PlayCanvas + Vite foundation, independent 10 Hz simulation shell, seeded RNG, RTS camera, debug overlay, test/CI baseline, canonical docs, and stable asset/audio manifest conventions.

Do not redo M00. M01 may extend these shells but must preserve simulation authority outside PlayCanvas.

---

## 15. Next exact action

Begin M01 with the smallest playable systemic-combat slice:

1. Add ECS-style entity/component storage and command queue in pure TypeScript.
2. Add a fixed handcrafted arena data model; do not start procedural generation.
3. Implement click/drag selection plus move/stop orders for placeholder units.
4. Add state hashing and replay smoke coverage before combat breadth.
5. Keep `main` runnable and update this handoff after the first M01 slice.

---

## 16. Handoff rule for new Work sessions

At the start of a new development session:

1. Read `PROJECT_CONTEXT.md`.
2. Read only the relevant sections of the other canonical files.
3. Inspect latest repository state/tests.
4. Do not redo CLOSED milestones.
5. Continue the exact `Next exact action`.
