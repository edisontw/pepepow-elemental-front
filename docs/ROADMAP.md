# PEPEPOW Elemental Front — ROADMAP

**Canonical milestone roadmap**  
**Current status:** M00 CLOSED → M01 CLOSED → M02 CLOSED → M03 OPEN

---

# 1. Roadmap rule

Milestones are completed in order unless a documented dependency requires a small exception.

Normal flow:

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

Each milestone follows:

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

---

# 2. M00 — Repository Bootstrap

**Status:** CLOSED  
**Goal:** Create the permanent development foundation with minimal overhead.

## Scope

- create GitHub repository
- add canonical docs
- TypeScript
- PlayCanvas integration
- Vite
- basic test framework
- CI
- minimal page/scene
- initial directory layout
- blank RTS-camera shell
- simulation module shell separated from renderer
- debug overlay shell
- asset/audio manifest conventions
- placeholder asset convention

## Acceptance criteria

- repository builds locally/in target environment
- CI passes
- browser page/scene loads
- PlayCanvas renderer boots
- TypeScript simulation module boots independently
- one deterministic RNG smoke test exists
- canonical docs committed
- asset status convention documented
- `main` is runnable

Closure: `docs/milestones/M00_CLOSURE_REPORT.md`.

---

# 3. M01 — Systemic Combat Foundation

**Status:** CLOSED  
**Goal:** Prove that controlling units plus changing elemental terrain is enjoyable and technically reliable.

## Scope

Controls:
- pan/zoom
- click and drag selection
- control groups
- move
- attack
- stop

Initial units:
- Vanguard
- Ranger
- Elementalist
- Golem

Fixed test arena:
- ground
- forest
- river/water
- chokepoint
- ice-capable crossing area

Core systems:
- fixed 10 Hz simulation
- movement/pathfinding
- combat
- statuses
- Fire / Water / Ice / Lightning
- Wet / Burning / Frozen / Chilled
- conductivity
- dynamic navigation
- fog-of-war baseline
- deterministic RNG, command queue, state hash, replay smoke
- debug overlay

## Signature test

```text
River blocked
→ Freeze river
→ units cross
→ enemy follows
→ heat/fire weakens ice
→ ice breaks/melts
→ enemy becomes Wet
→ lightning chains through conductive targets
```

## Acceptance criteria

- 40 units stable in arena
- selection and orders usable
- no severe pathing deadlocks
- Fire spreads under defined rules
- Water applies Wet
- Water can freeze into walkable ice
- Fire/heat can reverse the ice state
- nav updates locally
- Lightning chaining reflects conductivity
- signature interaction is readable
- same command replay produces matching state hashes
- performance is acceptable
- no gameplay dependency on final visuals

Human WebGL playtest on 2026-09-06: **PASS**.

Closure: `docs/milestones/M01_CLOSURE_REPORT.md`.

---

# 4. M02 — Procedural Battlefield

**Status:** CLOSED  
**Goal:** Any valid Block Height can generate a deterministic, strategically playable battlefield.

## Scope

- master seed / ruleset identity
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
- large seed-batch tests
- minimal generated-world debug visualization

## Acceptance criteria

- same block + ruleset → same world
- visual RNG changes do not change gameplay placement
- player always has viable expansion
- objectives reachable
- resources valid
- no illegal overlaps
- deterministic retries reproduce
- large seed batch passes hard invariants
- generated regions/routes are strategically legible
- debug visualization can show generated region/route/world structure
- required TypeScript, tests, build, and CI pass

## Closure evidence

- implementation merged to main: `c26eecf5b324bd3e9ac4a09ca571a5522450ce21`
- PR CI: **17 files / 88 tests PASS**
- M02 large batch: **2,048 deterministic seeds PASS** with zero hard-invariant failures
- strict TypeScript: PASS
- production build: PASS
- existing M01 regression suite: PASS
- Golden Block fixed-hash regression set exists
- generated-world browser debug map exists

Closure: `docs/milestones/M02_CLOSURE_REPORT.md`.

---

# 5. M03 — Economy & Territory

**Status:** OPEN  
**Goal:** Turn the systemic battlefield into a functioning RTS economy and territorial war.

## Scope

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

Units:
- expand toward the full initial eight-role roster where needed

## Acceptance criteria

- player can build a working economy without worker spam
- expansion is strategically valuable
- supply cuts matter
- disconnected penalties work
- enemy/neutral territory can be contested
- no infinite/free resource bugs
- resource pacing reaches intended timing targets
- 25–35 minute run economy appears plausible in simulation/playtest
- economy/territory state preserves determinism and replay compatibility

---

# 6. M04 — Roguelite Layer

**Status:** OPEN  
**Goal:** Make different generated runs produce different builds and meaningful adaptation.

## Scope

- Shrines
- three-choice upgrade UI
- tags/modifiers/triggers
- Fire upgrade set
- Water upgrade set
- Ice upgrade set
- Lightning upgrade set
- mixed-element upgrades
- world-event framework
- run-level max Mana progression
- early synergy detection

Target content envelope:
- approximately 24 shrine types/locations
- approximately 60–80 upgrade effects eventually

Do not implement all content before the generic system works.

## Acceptance criteria

- upgrades can be authored mostly as data
- three-choice decisions alter play
- at least several distinct build paths emerge
- different seeds encourage different choices
- no dominant mandatory upgrade path
- upgrades do not break determinism/replays

---

# 7. M05 — Enemy War

**Status:** OPEN  
**Goal:** Create a fair but strategically active opponent that produces pressure without cheating.

## Scope

- tactical AI
- strategic Utility AI
- AI blackboard
- AI fog/imperfect information
- scouting
- expansion
- raid
- defend
- attack
- regroup
- POI contest
- territory/supply awareness
- Director pressure curve
- recovery windows
- anti-turtle response

Enemy archetypes:
- Iron Legion
- Flame Cult
- Wild Horde

## Acceptance criteria

- AI cannot see hidden current player state
- AI uses last-known information
- AI can make imperfect but plausible decisions
- AI can raid supply
- AI can retreat/regroup
- factions feel behaviorally distinct
- difficulty changes intelligence/tempo more than raw stat cheating
- no arbitrary unit spawning beside player base

---

# 8. M06 — Full Run

**Status:** OPEN  
**Goal:** Complete the first start-to-finish game loop.

## Scope

- final objective framework
- boss framework
- victory
- defeat
- Core Critical State
- score
- results screen
- replay playback
- next-block/retry flow
- event pacing integration

Bosses:
- Frost Titan
- Storm Colossus
- Infernal Behemoth

Initial victory families:
- Destroy
- Boss Hunt
- one additional objective mode if ready

## Acceptance criteria

A player can:

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

Target standard duration:
- approximately 25–35 minutes

Playtest should answer:
- Were there meaningful decisions throughout?
- Could the player explain the loss?
- Did the run produce a memorable systemic event?
- Did the next seed feel worth trying?

---

# 9. M07 — PEPEPOW Block Challenge

**Status:** OPEN  
**Goal:** Turn deterministic world generation into a shareable PEPEPOW challenge system.

## Scope

- ManualBlockSource polished
- PEPEPOW block fetch adapter
- current/recent block selection as designed
- deterministic Block Challenge identity
- Ruleset Version display
- shareable block challenge
- Daily/Official Block concept
- leaderboard interface
- score submission architecture
- replay/state-hash verification framework
- graceful RPC failure

## Acceptance criteria

- manual block mode always works
- RPC failure never prevents practice play
- same block/ruleset reproduces challenge
- score identifies exact ruleset
- challenge can be shared
- leaderboard does not depend solely on client-reported final score if verification is implemented

## Explicit non-goal

No wallet requirement unless later separately approved.

---

# 10. M08 — Combat & Visual Polish

**Status:** OPEN  
**Goal:** Upgrade a proven game into a visually and aurally refined game without destabilizing gameplay.

This milestone starts only after M01–M07 gameplay is sufficiently healthy.

## Scope

Combat presentation:
- final/project-level unit visual language
- animation
- attacks
- hit reactions
- deaths
- projectiles
- camera feedback
- readable telegraphs

Elemental VFX:
- fire
- steam
- freezing
- ice cracking
- water impact
- lightning chaining
- storm
- meteor
- smoke
- environmental reaction

Environment:
- biome materials
- props
- terrain blending
- weather
- lighting
- post-processing
- fog/atmosphere

UI:
- final HUD direction
- iconography
- minimap polish
- results/challenge presentation

Audio:
- final/polished SFX set
- ambient loops
- user-supplied Gemini background music
- mixing
- transitions

---

# 11. Visual and audio production policy

AI/agents may create development assets, but final art can be produced manually.

For any asset that is not worth refining in Work:

1. assign stable asset ID and filename
2. keep functional placeholder
3. create canonical prompt under `media/prompts/images/`
4. mark `NEEDS_MANUAL_GENERATION`
5. continue development
6. user manually generates final asset
7. user uploads to GitHub
8. change status to `FINAL`

Background music is generated separately by the user in Gemini. SFX may use suitable public/licensed sources with documented provenance.

---

# 12. Agent and token discipline

Use multiple agents only when work is genuinely separable.

Prefer:
- exact task scopes
- test-driven handoffs
- concise agent summaries
- reading only relevant canonical sections
- targeted code inspection
- one full regression pass at milestone closure

Avoid:
- broad redundant audits
- long narrative reports when tests suffice
- excessive screenshot/image iteration
- rewriting stable docs without new decisions
- multiple agents modifying the same simulation core
- parallel redesign of locked architecture

Token efficiency is not permission to skip verification.

---

# 13. Cross-milestone quality gates

No milestone can close with:
- failing required tests
- known determinism break
- corrupted canonical docs
- broken main build
- placeholder accidentally marked final
- unclear licensed external media provenance once intended for release

---

# 14. Current next action

M00, M01, and M02 are CLOSED. Begin **M03 — Economy & Territory** on top of the existing M01 simulation and M02 generated-world foundation.

Start with deterministic economy/territory state and commands, then implement resource flow, buildings and production, capture/territory, and supply connectivity with targeted tests. Do not redo M01/M02 or begin M04/M05 systems beyond interfaces genuinely required for M03.
