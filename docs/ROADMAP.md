# PEPEPOW Elemental Front — ROADMAP

**Canonical milestone roadmap**  
**Current status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 CLOSED → M04 CLOSED → M05 CLOSED → M06 CLOSED → M07 CLOSED → M08 CLOSED  
**Active post-roadmap work:** Phase 5 — Autonomous Front Redesign, design approved; P5-A is the next implementation experiment

---

# 1. Roadmap rule

The original project roadmap was completed in milestone order:

```text
M00 Repository Bootstrap
→ M01 Systemic Combat Foundation
→ M02 Procedural Battlefield
→ M03 Economy & Territory
→ M04 Roguelite Layer
→ M05 Enemy War
→ M06 Full Run
→ M07 PEPEPOW Block Challenge
→ M08 Combat & Visual Polish
```

Milestone lifecycle:

```text
Implement
→ Automated Tests
→ Playtest/Verification
→ Tune
→ Closure Report
→ Update PROJECT_CONTEXT
→ Next Milestone
```

Status vocabulary:
- OPEN
- IN_PROGRESS
- BLOCKED
- CLOSED

The M00–M08 roadmap is complete and remains historical. Post-roadmap Phase 5 Autonomous Front Redesign is now the approved active product-design direction; it does not reopen the original milestone sequence.

---

# 2. M00 — Repository Bootstrap

**Status:** CLOSED  
**Goal:** Create the permanent development foundation with minimal overhead.

Delivered:
- TypeScript + PlayCanvas + Vite browser foundation
- fixed-tick simulation shell separated from rendering
- deterministic RNG smoke coverage
- RTS camera shell, debug foundation, tests, CI, asset/audio conventions

Closure: `docs/milestones/M00_CLOSURE_REPORT.md`.

---

# 3. M01 — Systemic Combat Foundation

**Status:** CLOSED  
**Goal:** Prove unit control plus elemental terrain interactions on a deterministic simulation core.

Delivered:
- selection, control groups, MOVE / ATTACK / STOP
- movement, pathfinding, combat, fog
- Fire / Water / Ice / Lightning
- Wet / Burning / Chilled / Frozen
- conductivity and dynamic navigation
- deterministic command replay and state hashing
- 40-unit stability and human WebGL acceptance

Closure: `docs/milestones/M01_CLOSURE_REPORT.md`.

---

# 4. M02 — Procedural Battlefield

**Status:** CLOSED  
**Goal:** Generate a deterministic, strategically playable battlefield from Block Height + world-generation ruleset identity.

Delivered:
- isolated deterministic RNG streams
- elevation, hydrology, biome, regions, route graph, crossings/chokepoints
- resources, POIs, Shrines, spawns, boss/objective sites
- validation, deterministic retry, Golden Blocks
- 2,048-seed hard-invariant regression
- stable world-generation ruleset: `m02-standard-v1`

Closure: `docs/milestones/M02_CLOSURE_REPORT.md`.

---

# 5. M03 — Economy & Territory

**Status:** CLOSED  
**Goal:** Turn the battlefield into a functioning RTS economy and territorial war.

Delivered:
- Material / Mana / Influence economy
- Elemental Core, Barracks, Arcane Tower, Workshop, Outpost, resource buildings
- population, construction, production, territory, supply, capture
- strategic commands / hashes and browser economy UI

Later M08 corrections improved player-facing expansion, Mana Wells, parallel construction, Rally Points, resource-site defense, and related UX without reopening M03.

Closure: `docs/milestones/M03_CLOSURE_REPORT.md`.

---

# 6. M04 — Roguelite Layer

**Status:** CLOSED  
**Goal:** Make generated runs produce different builds and meaningful adaptation.

Delivered:
- Shrines and deterministic three-choice upgrade flow
- data-authored modifiers / triggers
- Fire / Water / Ice / Lightning / mixed upgrade paths
- run-level Mana progression
- synergy detection and deterministic world events
- Shrine / upgrade / event UI

Closure: `docs/milestones/M04_CLOSURE_REPORT.md`.

---

# 7. M05 — Enemy War

**Status:** CLOSED  
**Goal:** Create a fair but strategically active opponent without omniscient cheating.

Delivered:
- fog-bounded AI knowledge and last-known information
- scouting, expansion, raid, defend, attack, regroup, POI contest
- supply-aware logistics and fair production
- Iron Legion / Flame Cult / Wild Horde behavioral differences
- difficulty and Director pressure/recovery behavior
- deterministic AI state / hashes

Closure: `docs/milestones/M05_CLOSURE_REPORT.md`.

---

# 8. M06 — Full Run

**Status:** CLOSED  
**Goal:** Complete the first start-to-finish game loop.

Delivered:

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
→ See score
→ Replay/try another block
```

Includes Destroy / Boss Hunt, bosses, Core Critical, score/results, replay packet/playback verification, retry / next-block flow, terrain presentation, and live minimap.

Closure: `docs/milestones/M06_CLOSURE_REPORT.md`.

---

# 9. M07 — PEPEPOW Block Challenge

**Status:** CLOSED  
**Goal:** Turn deterministic world generation into a shareable PEPEPOW challenge system.

Delivered:
- Manual / PEPEPOW RPC / Official BlockSource boundary
- deterministic Block Challenge identity and challenge code
- share links and Official/Daily manifest architecture
- replay-backed score proof and deterministic verification
- local verified leaderboard gateway
- graceful network failure with no wallet requirement

Known deferred issue:
- deployed browser live-height retrieval may fail because of external endpoint / CORS behavior; Manual and Official paths remain available.

Closure: `docs/milestones/M07_CLOSURE_REPORT.md`.

---

# 10. M08 — Combat & Visual Polish

**Status:** CLOSED  
**Goal:** Upgrade the proven deterministic game into a coherent browser RTS presentation while preserving replay/verification integrity.

Delivered:

Combat presentation:
- eight project-level procedural unit silhouettes
- strategic building silhouettes
- selection/team/health/facing readability
- attacks, projectiles, hit/death/destruction feedback
- restrained camera impact feedback
- boss/finale telegraphs

Elemental VFX:
- Fire / Burning
- Water impact
- Freeze / ice cracking / melt / steam
- Lightning chaining
- boss elemental effects and environmental reactions

Environment:
- deterministic visual-only biome props
- terrain materials and dynamic ice presentation
- lighting / atmosphere progression

UI:
- player-facing HUD hierarchy
- interactive minimap
- POI/resource-site readability
- challenge / replay / results information retained

Audio:
- event-driven procedural combat and elemental SFX placeholders
- ambient bed
- browser audio unlock and `M` mute
- final external SFX / user-supplied Gemini BGM remain later asset work

Gameplay/UX correction passes performed during M08 also added or corrected:
- building placement and parallel construction
- explicit production-building selection and Rally Points
- building-driven territory expansion
- Mana Wells and clearer resource roles
- visible/actionable POIs
- shared Mana costs/cooldowns
- encounter auto-aggro
- destructible/fortifiable Extractor and Mana Well sites
- clearer elemental tactical jobs

Competitive identity:
- world generation remains `m02-standard-v1`
- current Challenge / replay / score-proof gameplay ruleset is `m08-standard-v1`

Final closure evidence:
- final runtime baseline: `e12011b379555cde733a1c815594067185fd3024`
- **45 test files / 198 tests PASS**
- M02 **2,048-seed hard-invariant regression PASS**
- strict TypeScript PASS
- production build PASS
- main CI `34251355341` / CI #158 PASS
- GitHub Pages `34251355381` / Pages #57 PASS
- final operator WebGL presentation smoke: **PASS**

Closure: `docs/milestones/M08_CLOSURE_REPORT.md`.

---

# 11. Visual and audio production policy

AI/agents may create development assets, while manually approved final assets can replace them later.

For final-art needs:

1. assign stable asset ID and filename
2. keep a functional placeholder
3. keep canonical prompt under `media/prompts/images/`
4. mark `NEEDS_MANUAL_GENERATION`
5. continue development without blocking on manual art
6. user generates and uploads approved final asset
7. change status to `FINAL`

Background music is generated separately by the user in Gemini. External SFX intended for release require documented provenance/license.

---

# 12. Locked cross-roadmap architecture

Preserve unless a later approved redesign explicitly requires change:

- browser-first, desktop-first RTS
- authoritative pure-TypeScript simulation independent from PlayCanvas presentation
- fixed 10 Hz simulation
- deterministic gameplay RNG and independent RNG streams
- deterministic command replay / state hashes / system ordering
- renderer and UI consume authoritative state rather than owning gameplay truth
- Block Height remains deterministic input rather than a network dependency
- local/practice play must not require blockchain RPC
- challenge/replay identity must change when authoritative gameplay semantics change

---

# 13. Post-roadmap backlog

The original roadmap is CLOSED. The next phase is not automatically another implementation milestone.

Known product/design areas for later deliberate work include:
- deeper Fire / Water / Ice / Lightning role and counterplay redesign
- forest / river / bridge / crossing strategic-value tuning
- combat targeting and structure-assault redesign
- economy and territory pacing
- Mana-system design and tuning
- AI behavior and balance
- progression / reward balance
- final art replacement
- final approved/licensed SFX and Gemini background music
- PEPEPOW browser live-height / CORS integration
- client bundle code-splitting / size optimization

Do not automatically reopen M00–M08 implementation history. Start future work from current `main`, define the intended product/design goal first, and bump gameplay ruleset identity whenever authoritative semantics change.

---

# 14. Post-Roadmap Phase 5 — Autonomous Front Redesign

**Status:** ACTIVE — P5-A1 IMPLEMENTED / PLAYTEST GATE; P5-A2 NOT STARTED  
**Plan:** `docs/POST_ROADMAP_PHASE5_AUTONOMOUS_FRONT_REDESIGN_PLAN.md`

## Goal

Move the primary experimental player experience away from high-frequency traditional RTS micro toward low-friction autonomous strategy while preserving direct player agency.

Design rule:

> **Automate execution, never automate the interesting decision.**

The intended player decisions are:

- where squads act;
- how armies are composed;
- when to regroup and preserve veterans;
- when and where elemental intervention changes the battlefield;
- later, how controlled territory is developed.

Routine execution such as pathing, local target acquisition, and Tactical caster lookup may be automated.

## P5-A — first playable experiment

Only four coherent changes are approved before the next playtest gate:

### P5-A1 — Front Orders — IMPLEMENTED / PLAYTEST GATE

Introduce persistent squads with three baseline missions:

- Advance;
- Guard;
- Regroup.

Reuse existing movement, navigation, combat, recovery, and unit AI rather than building a second combat engine.

P5-A1 playtest refinement in v26: newly trained player units deterministically form additional persistent squads. A forming squad accepts up to six members; first Front Order, direct Classic control, full capacity, or a casualty locks that roster. Locked squads are not auto-replenished.

### P5-A2 — Element access simplification

Expose Tactical elemental actions without requiring manual selection of an aligned Elementalist.

The authoritative simulation still requires a legal aligned caster and deterministically resolves one based on eligibility/range/cooldown with stable tie-breaking.

Preserve:

- Attunements;
- Elementalist alignment;
- Mana;
- caster-local cooldowns;
- Tactical legality;
- Strategic spell network authority.

### P5-A3 — Automatic baseline resource sites

In Command Mode, controlling an eligible Material / Mana resource site automatically activates its baseline production.

Do not require manual Extractor / Mana Well placement merely to turn on income.

Preserve Material, Mana, Influence, territory, supply, and Classic Mode compatibility.

### P5-A4 — Event Navigator

Surface important battle/objective events in a compact navigator.

Selecting an event focuses the camera smoothly.

Do not force automatic camera jumps.

## P5-A5 — mandatory playtest gate

Do not automatically proceed to P5-B.

Evaluate whether:

- routine selection/camera burden is substantially reduced;
- Fire / Water / Ice / Lightning are easier to use;
- the player still makes frequent meaningful decisions;
- veteran preservation creates a reason to Regroup;
- autonomous squad behavior is understandable;
- player redirection remains immediate;
- the experience feels like commanding a battle rather than watching AI play.

Outcome must be one of:

- **CONTINUE**
- **REVISE**
- **STOP**

## Deferred P5-B candidates

Only after P5-A passes:

- preset Doctrines;
- automatic/balanced formation selection;
- Outpost development slots;
- squad templates;
- safe-zone Auto Reinforce;
- Resource Site Exploit / Fortify choices;
- Pause / 1× / 2×;
- Command Mode pacing/finale rebalance.

An Advanced Doctrine editor is not a baseline requirement.

## Mode policy

During the prototype:

- **Command Mode** is the new product experiment;
- **Classic Mode** retains the existing direct-control RTS interaction;
- Tower Defense remains a separate existing run mode;
- shared authoritative simulation should be reused wherever possible rather than forking into two unrelated games.

## Versioning

P5-A1 is the first authoritative Phase 5 gameplay merge.

P5-A1 first merged under v25. The current runtime after the multi-squad roster refinement is:

- gameplay: `ef-standard-v26`;
- replay: `ef-replay-v26`;
- world generation: `m02-standard-v1`.

P5-A1 persistent squads, Front Orders, and deterministic additional-squad formation are implemented. P5-A2 remains blocked on the P5-A1 playtest gate.

World generation remains `m02-standard-v1` for P5-A.
