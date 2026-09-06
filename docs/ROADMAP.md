# PEPEPOW Elemental Front｜ROADMAP

**Canonical milestone roadmap**  
**Current status:** M00 CLOSED → M01 IN_PROGRESS

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

## Work/@site rule

Use ChatGPT Work + `@site`.

M00 should not turn into a long infrastructure project.

Parallel agents may help with:
- repository/tooling
- test/CI
- scene/bootstrap

but only when their file scopes do not conflict.

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
- `PROJECT_CONTEXT.md` updated with latest main SHA

## Explicit non-goals

- no procedural map
- no polished art
- no full combat
- no blockchain RPC
- no boss
- no final audio

## Closure output

Create concise M00 closure report in repository and mark M00 CLOSED.

---

# 3. M01 — Systemic Combat Foundation

**Status:** IN_PROGRESS  
**Goal:** Prove that controlling units plus changing elemental terrain is enjoyable and technically reliable.

## Scope

### Controls
- pan/zoom
- limited camera rotation if needed
- click select
- drag select
- shift/control-group basics
- move
- attack
- stop

### Initial units
Use at least:
- Vanguard
- Ranger
- Elementalist
- Golem

### Test arena
Fixed handcrafted arena containing:
- ground
- forest
- river/water
- chokepoint
- ice-capable crossing area

### Core systems
- fixed 10 Hz simulation
- movement/pathfinding
- combat
- statuses
- Fire
- Water
- Ice
- Lightning
- Wet
- Burning
- Frozen/Chilled
- conductivity
- dynamic navigation
- fog-of-war baseline

### Determinism
- deterministic RNG
- command queue
- state hash
- basic replay smoke test

### Debug
- entity count
- sim tick
- terrain flags
- active elemental cells
- nav dirty state
- selected unit state

## Signature test

Must work:

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

## Asset policy

Use primitives/placeholders freely.

If agents create ugly or inconsistent art:
- do not block M01
- create canonical image prompt
- keep placeholder
- mark `NEEDS_MANUAL_GENERATION`

No repeated expensive regeneration loops.

## Closure question

> Is the elemental battlefield mechanic already fun enough to justify the rest of the game?

If no, do not advance by adding content.

---

# 4. M02 — Procedural Battlefield

**Status:** OPEN  
**Goal:** Any valid Block Height can generate a deterministic, strategically playable battlefield.

## Scope

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

## Acceptance criteria

- same block + ruleset → same world
- visual RNG changes do not change gameplay placement
- player always has viable expansion
- objectives reachable
- resources valid
- no illegal overlaps
- large seed batch passes hard invariants
- generated regions are strategically legible
- debug visualization can show region/route structure

## Testing target

Automated generation over a large seed set, eventually thousands to 10,000+ as performance permits.

## Visual policy

Generated terrain may use simple materials and proxy props.

Polished biome art is deferred.

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
- expand toward full initial 8-role roster

## Acceptance criteria

- player can build a working economy without worker spam
- expansion is strategically valuable
- supply cuts matter
- disconnected penalties work
- enemy/neutral territory can be contested
- no infinite/free resource bugs
- resource pacing reaches intended timing targets
- 25–35 minute run economy appears plausible in simulation/playtest

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

### Combat presentation
- final/project-level unit visual language
- animation
- attacks
- hit reactions
- deaths
- projectiles
- camera feedback
- readable telegraphs

### Elemental VFX
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

### Environment
- biome materials
- props
- terrain blending
- weather
- lighting
- post-processing
- fog/atmosphere

### UI
- final HUD direction
- iconography
- minimap polish
- results/challenge presentation

### Audio
- final/polished SFX set
- ambient loops
- user-supplied Gemini background music
- mixing
- transitions

---

# 11. M08 visual-production workflow

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

Do not repeatedly regenerate the same low-quality asset inside Work.

---

# 12. M08 background-music workflow

Background music is generated separately by the user in Gemini.

Project work should prepare music briefs/prompts such as:
- main menu
- exploration low intensity
- escalation
- battle
- boss
- victory/defeat

Each brief should define:
- mood
- instrumentation
- energy
- BPM range if useful
- duration
- loopability
- transition requirements

User uploads chosen final music to GitHub.

Work agents integrate only the canonical files.

---

# 13. SFX acquisition workflow

SFX can use suitable public/licensed sources.

Before `FINAL`:
- confirm license/provenance
- normalize/trim if needed
- assign stable audio ID
- document source
- store compliant final file

Important SFX should be auditioned for:
- clarity
- impact
- frequency masking
- repetition fatigue
- consistency with other effects

---

# 14. Agent strategy by milestone

Use multiple agents primarily when work is separable.

Good parallelization:
- engine/bootstrap vs CI
- worldgen module vs validator tests
- AI strategic layer vs debug visualization
- data definitions vs schema validation
- SFX sourcing vs audio manifest
- different independent visual prompt batches

Poor parallelization:
- two agents modifying the same simulation core
- multiple agents “reviewing everything”
- parallel redesign of locked architecture
- multiple agents regenerating the same image repeatedly

Coordinator integrates and verifies repository state.

---

# 15. Token-budget discipline

At every milestone:

Prefer:
- exact task scopes
- test-driven handoffs
- concise agent summaries
- reading only relevant canonical sections
- targeted code inspection

Avoid:
- broad redundant audits
- long narrative reports when tests suffice
- excessive screenshot/image iteration
- rewriting stable docs without new decisions

Token efficiency is not permission to skip verification. It is a requirement to verify more selectively.

---

# 16. Cross-milestone quality gates

No milestone can close with:
- failing required tests
- known determinism break
- corrupted canonical docs
- broken main build
- placeholder accidentally marked final
- unclear licensed external media provenance once intended for release

---

# 17. Current next action

M00 is CLOSED. Begin M01 with the fixed handcrafted arena, pure-TypeScript entity/command foundation, placeholder-unit selection and movement, state hashing, and replay smoke coverage. Do not start procedural world generation.
