# PEPEPOW Elemental Front｜TECH_ARCHITECTURE

**Canonical technical specification**  
**Architecture baseline:** V0.4 consolidated  
**Status:** READY FOR IMPLEMENTATION

---

# 1. Architecture objective

The codebase must support a mature browser RTS without requiring a rewrite when visuals become more sophisticated.

Primary architecture rule:

> **Rendering presents the simulation; rendering never owns gameplay truth.**

Three conceptual layers:

```text
Presentation
  PlayCanvas / VFX / Animation / UI / Audio
        ↓ read/events
Game Simulation
  Entities / Combat / Elements / Territory / Economy / AI / Objectives
        ↓
World Data
  Seed / Map / Terrain / Regions / POI
```

---

# 2. Technology baseline

Recommended first stack:

- TypeScript
- PlayCanvas for 3D presentation
- HTML/CSS for interface where appropriate
- Vite
- Web Workers
- automated test runner
- GitHub CI

Core simulation should remain as close as practical to pure TypeScript and not depend directly on PlayCanvas APIs.

---

# 3. Repository layout

Recommended:

```text
pepepow-elemental-front/

README.md

docs/
  PROJECT_CONTEXT.md
  GAME_DESIGN_SPEC.md
  TECH_ARCHITECTURE.md
  ROADMAP.md
  DECISIONS.md

src/
  app/
  simulation/
  components/
  systems/
  world/
    generator/
  elements/
  navigation/
  ai/
  rendering/
  input/
  ui/
  blockchain/
  replay/
  audio/
  assets/
  data/

data/
  units/
  buildings/
  spells/
  shrines/
  biomes/
  factions/
  bosses/
  events/
  audio/
  assets/

assets/
  models/
  textures/
  vfx/
  ui/
  audio/
    sfx/
    music/
  placeholders/

media/
  prompts/
    images/
    music/
  manifests/

tests/
  simulation/
  elements/
  worldgen/
  ai/
  replay/
  performance/
```

The exact folder split may be adjusted during bootstrap, but responsibilities must remain separated.

---

# 4. Simulation authority

Simulation input:
- World Seed
- Ruleset/Data
- Player Commands
- deterministic AI decisions

Simulation output:
- authoritative game state
- domain/gameplay events
- deterministic state hashes

Simulation must not directly:
- play audio
- animate models
- mutate DOM
- instantiate PlayCanvas entities
- fetch PEPEPOW data
- write leaderboard records

---

# 5. Fixed tick

Baseline:
- simulation: 10 Hz
- tick length: 100 ms
- renderer target: 60 FPS

Renderer interpolates between simulation states.

Different frame rates must not alter:
- movement outcome
- fire propagation
- combat timing
- AI decisions
- procedural generation
- replay state

---

# 6. Deterministic system order

Provisional fixed tick order:

1. Commands
2. Movement
3. Navigation changes
4. Combat
5. Status effects
6. Element simulation
7. Death/cleanup
8. Economy
9. Territory/supply
10. Fog of war
11. Tactical AI
12. Strategic AI
13. Director
14. Objectives/victory
15. State hash/debug metrics

Order changes are architectural decisions and must be documented.

---

# 7. ECS-style model

Entity:
- integer EntityID

Components may include:
- Position
- Movement
- Health
- Combat
- Vision
- Status
- Faction
- Production
- Territory
- AI
- Tags

Avoid deep inheritance chains.

Prefer composition:
- base unit + tags + modifiers + status

over:
- Warrior → FireWarrior → EliteFireWarrior → SpecialEliteFireWarrior

---

# 8. Data-driven content

Unit/building/spell/shrine/boss numerical data should live outside core logic.

Example shape:

```json
{
  "id": "vanguard",
  "hp": 180,
  "armor": 12,
  "moveSpeed": 3.6,
  "damage": 18,
  "attackInterval": 1.1,
  "population": 1,
  "materialCost": 45
}
```

Data is schema-validated at development/startup time.

Do not silently accept malformed data.

---

# 9. Tags and modifiers

Core tags may include:

```text
LIGHT
HEAVY
METAL
RANGED
ELEMENTAL
BUILDING
WET
FROZEN
BURNING
CONDUCTIVE
```

Use generic triggers/modifiers wherever possible.

Example:

```text
condition: target has WET
modifier: lightningDamage × 1.25
```

Preferred stat pipeline:

```text
base
→ unit modifier
→ upgrade/shrine modifier
→ terrain modifier
→ status modifier
→ final value
```

Ordering must be deterministic.

---

# 10. Deterministic RNG

Gameplay code must not call uncontrolled `Math.random()`.

Use explicit deterministic RNG streams.

Master input:

```text
project namespace
+ ruleset version
+ PEPEPOW block height
```

Derived streams:

- terrain
- river
- biome
- region
- resource
- POI
- shrine
- enemy
- event
- boss
- visual

Visual randomness must not perturb gameplay randomness.

---

# 11. Deterministic numeric policy

Where replay-critical, prefer:
- integer
- fixed-point
- deterministic bounded math

Avoid relying on accumulated free-running floating-point integration for authoritative state.

Candidate coordinate representation:
- integer millimeters
or
- fixed 1/1000 meter units

Typed arrays should be used heavily for world-grid state.

---

# 12. World grid

Standard:
- 128 × 128 logical cells

Recommended arrays:

```text
elevation      Int16Array
temperature    Int16Array
wetness        Uint8Array
vegetation     Uint8Array
terrainType    Uint8Array
conductivity   Uint8Array
flags          Uint16Array
```

Avoid allocating thousands of per-cell JavaScript objects.

---

# 13. Terrain flags

Potential bit flags:

- WALKABLE
- WATER
- ICE
- FOREST
- BURNING
- HIGH_GROUND
- BLOCKED
- BUILDABLE
- MUD
- SHALLOW

Flags may combine.

---

# 14. Active-cell elemental updates

Do not scan the full world at high frequency for every element.

Suggested frequencies:
- combat/status: 10 Hz
- fire propagation: 2 Hz
- temperature: 2 Hz
- wetness: 2 Hz
- strategic AI: 0.2–1 Hz
- director: 0.2 Hz

Use:
- active cell sets
- dirty regions
- local neighbor updates

---

# 15. Dynamic navigation

Terrain changes must alter navigation.

Example:

```text
Water: non-walkable
→ Freeze
Ice: walkable
→ Heat
Broken ice: water / unsafe
```

When a cell changes navigation:
- mark local nav chunk dirty
- increment `navVersion`
- invalidate only affected paths

Do not rebuild the entire map for local terrain changes.

---

# 16. Navigation hierarchy

Preferred three-level approach:

```text
Strategic Region Graph
→ coarse route
→ local navigation
```

Large groups should use:
- shared coarse path
- formation/local steering

Flow fields may be introduced where group movement benefits.

Avoid independent full-map A* for every unit.

---

# 17. Pathfinding worker

Pathfinding can use Web Worker.

Every job includes:
- job ID
- request tick
- entity/group reference
- nav version/dependencies

Worker results are queued and applied only at controlled simulation boundaries.

An asynchronous worker may not mutate authoritative simulation state directly.

---

# 18. Spatial indexing

Combat and element queries should use a spatial hash/grid.

Candidate bucket:
- approximately 8 m × 8 m

Use it for:
- target search
- area spells
- lightning chaining
- proximity effects
- collision/avoidance candidate gathering

Avoid O(N²) unit scans.

---

# 19. Player command architecture

UI/input produces `GameCommand`.

Initial command types:
- MOVE
- ATTACK
- STOP
- CAST
- BUILD
- CAPTURE
- FORMATION

Illustrative:

```json
{
  "tick": 1254,
  "player": 0,
  "type": "MOVE",
  "entities": [12, 18, 21],
  "target": [64000, 38000]
}
```

Simulation validates all commands.

UI-disabled states are not security/gameplay authority.

---

# 20. Replay

Replay header:
- gameVersion
- rulesetVersion
- blockHeight
- worldSeed
- difficulty
- commander/loadout if applicable

Body:
- command stream

Add deterministic state hashes periodically, for example every 300 ticks.

Replay verification:
- same initial inputs
- same commands
- same hash checkpoints

Any divergence is a bug.

---

# 21. Save game

Replay and save are separate concepts.

Save snapshot contains:
- current tick
- world arrays
- entities/components
- resources
- RNG stream states
- AI blackboards
- director state
- objective state

A save may optionally continue with command history for debugging.

---

# 22. Rendering bridge

Each authoritative entity may map to a presentation object.

Renderer reads:
- previous simulation position
- current simulation position
- current visual state

Renderer interpolates.

Renderer never writes movement/combat outcomes back into simulation.

---

# 23. Gameplay-to-presentation events

Simulation may emit:

- UNIT_CREATED
- COMBAT_HIT
- UNIT_DIED
- SPELL_CAST
- STATUS_APPLIED
- ICE_BROKE
- LIGHTNING_CHAIN
- BUILDING_DESTROYED
- TERRITORY_CAPTURED
- BOSS_PHASE_CHANGED

Presentation responds with:
- animation
- particles
- sound
- camera response
- decals
- UI feedback

This separation is required so visuals can later become much more sophisticated without changing gameplay logic.

---

# 24. AI architecture

Three layers:

## Tactical AI
- local target choice
- retreat
- spacing
- formation behavior
- hazard reaction

## Strategic AI
- EXPAND
- DEFEND
- RAID
- ATTACK
- CONTEST_POI
- REGROUP

## Director
- pacing
- pressure target
- event activation
- elite/boss timing

Do not collapse these into one monolithic AI loop.

---

# 25. AI information model

AI blackboard may store:
- last-known enemy positions
- last seen tick
- estimated army strength
- known resources/POIs
- threat map
- owned territory
- current strategic objective

AI must not directly read hidden player positions.

Information confidence decays over time.

---

# 26. Procedural world generator

Generator should behave like:

```text
generateWorld(seed, rules) → WorldDefinition
```

Pipeline:

```text
Master Seed
→ Elevation
→ Hydrology
→ Biome
→ Strategic Regions
→ Route Graph
→ Resources
→ POIs
→ Player Spawn
→ Enemy
→ Boss/Objectives
→ Validator
```

Same seed + same rules → same result.

---

# 27. Deterministic retries

If validation fails, do not mutate the public block height.

Use derived attempt streams:

```text
masterSeed + generationAttempt(0..N)
```

The same block/ruleset must deterministically choose the same successful attempt.

---

# 28. PEPEPOW adapter

Define an interface such as `BlockSource`.

Implementations:

## ManualBlockSource
- accepts manually supplied height
- available from earliest relevant development

## PepepowRpcBlockSource
- obtains real network block data later

Simulation receives a block/seed input and does not care how it was obtained.

If RPC is unavailable:
- manual/practice mode remains playable
- cached/known block may be used where appropriate

---

# 29. Version separation

Track independently:

- Game Version
- Ruleset Version
- Data Version
- Renderer/Asset Version where useful

Competitive/daily challenge identity should bind primarily to:

```text
Block Height + Ruleset Version
```

Visual asset replacement must not silently change gameplay determinism.

---

# 30. Debug tools

From M01 onward provide a debug overlay.

Useful information:
- FPS
- simulation tick
- entity count
- active fire cells
- dirty nav chunks
- path jobs
- AI state
- region graph
- fog
- territory
- supply
- state hash

Developer commands may include:

```text
spawn vanguard 10
mana 500
cast fire
fog off
ai pause
win
lose
```

Testing must not require replaying a 30-minute run for every subsystem.

---

# 31. Performance baseline

Target first mature alpha:

- Standard 128×128 map
- approximately 100 active units
- approximately 200 total entities
- 60 FPS rendering target
- 10 Hz simulation

Provisional simulation budget:
- average < 5 ms per simulation tick on target desktop hardware

Avoid hot-loop allocations and uncontrolled garbage collection.

---

# 32. Test layers

## Unit tests
Examples:
- armor
- wetness thresholds
- freeze threshold
- modifier order
- mana costs

## Simulation tests
Examples:
- deterministic unit combat
- status application
- terrain transition sequences

## Worldgen tests
Run large seed batches and assert:
- reachability
- resource availability
- valid spawn
- no illegal overlap

## Replay tests
Same seed + command stream:
- identical state hashes

## Performance tests
Test:
- 50 / 100 / 200 units
- 100 / 500 / 1000 active elemental cells

---

# 33. Golden block tests

Maintain a set of fixed block-height fixtures.

Uses:
- worldgen regression
- route regression
- balance comparisons
- screenshot/reference tests later

Do not depend only on a handful of manually attractive maps.

---

# 34. ChatGPT Work + @site operating model

Primary implementation is expected in **ChatGPT Work using `@site` and multiple agents**.

The coordinating Work session should:
- read `PROJECT_CONTEXT.md` first
- decompose work by module
- delegate independent tasks
- require tests for system changes
- integrate only after checking the actual repository diff/state
- update canonical files only when the source-of-truth decision actually changes

Agent prompts should state:
- exact task
- exact permitted files
- acceptance criteria
- non-goals
- no broad refactor unless required
- do not redo closed milestones

Agents should return concise summaries. Do not use long prose as a substitute for repository changes/tests.

---

# 35. Token-efficiency policy for agent development

Large-agent Work sessions can consume excessive tokens. This project therefore treats token efficiency as an engineering constraint.

Prefer:
- narrow file scopes
- targeted test runs
- exact failure reproduction
- short closure reports
- reusing canonical context
- incremental commits

Avoid:
- repeated full-repo narration
- repeated rereading of obsolete V0.x docs
- “review everything” loops after every small change
- multiple agents independently solving the same problem
- repeated image generation attempts to chase aesthetics during systems milestones

A small, verified change is better than a broad speculative audit.

---

# 36. Visual asset pipeline

Visual quality will be pursued seriously later, but early development must not be blocked by asset production.

Asset classes:
- gameplay-critical readability asset
- temporary placeholder
- generated development asset
- final polished asset

Each asset should eventually have a manifest entry.

Recommended fields:

```text
id
type
canonicalFilename
usage
dimensions/aspectRatio
status
promptRef
source
license
notes
```

Recommended statuses:
- PLACEHOLDER
- NEEDS_MANUAL_GENERATION
- READY_FOR_REVIEW
- FINAL
- REPLACE

---

# 37. Image generation policy

Work agents may generate temporary images when this is genuinely efficient.

However:

> Do not repeatedly spend agent/token budget trying to perfect visual assets during systems development.

If quality is poor or regeneration becomes wasteful:

1. keep a functional placeholder
2. write a canonical production prompt
3. mark asset `NEEDS_MANUAL_GENERATION`
4. use a stable final filename/path
5. continue gameplay development
6. user later manually generates the polished image
7. user uploads it to GitHub
8. final file replaces placeholder without code changes

Canonical prompts should specify where relevant:
- exact subject
- art direction
- camera
- composition
- aspect ratio
- transparent/opaque background
- prohibited text
- prohibited collage/contact-sheet behavior
- required/forbidden objects
- filename
- intended in-game use

The prompt file is a production specification, not decorative prose.

---

# 38. Asset replacement rule

Gameplay code must reference:
- stable asset ID
or
- stable manifest path

not transient generation outputs.

Replacing:
- placeholder → final texture
- simple unit → polished model
- temporary icon → final icon

must not require gameplay-logic edits.

---

# 39. Sound-effects policy

SFX may use:
- public sound libraries
- openly licensed sources
- other legally usable high-enough-quality resources

Quality floor:
- no severe clipping
- no distracting noise
- no inconsistent loudness without normalization
- no obviously low-bitrate artifacts in important combat sounds

Track provenance:

```text
assetId
source
author
license
sourceReference
originalFilename
edited
finalFilename
```

Do not import sounds with unclear redistribution rights into the repository.

SFX may be edited for:
- trim
- normalization
- EQ
- layering
- looping
- format conversion

while respecting license terms.

---

# 40. Background-music policy

Background music production is external to the main Work agent loop.

Workflow:

1. Game/level design defines music brief.
2. Canonical music prompt includes:
   - scene/state
   - mood
   - intensity
   - instrumentation
   - approximate duration
   - loop requirements
   - transition needs
   - forbidden elements if any
3. User generates music separately in Gemini.
4. User reviews and manually uploads final track to GitHub.
5. Audio manifest points to the final canonical filename.

Agents should not keep generating provisional background music unless explicitly requested.

---

# 41. Audio runtime architecture

Recommended:
- stable audio IDs
- manifest-driven file paths
- buses/groups such as:
  - MASTER
  - MUSIC
  - SFX
  - UI
  - AMBIENCE

Combat systems emit semantic events; audio layer chooses the sound.

Example:

```text
Simulation: ICE_BREAK event
Audio system: select ice-break SFX variant
```

Simulation must not reference raw audio filenames.

---

# 42. Future media prompt files

The four canonical project files remain the primary context.

Production prompt files can be created later under:

```text
media/prompts/images/
media/prompts/music/
```

These are subordinate production specs, not replacements for canonical design.

Use one canonical prompt per final asset or a clearly indexed batch file.

---

# 43. CI baseline

M00 should establish CI that at least runs:
- TypeScript check/build
- unit tests
- deterministic smoke tests where available
- formatting/linting if configured

Later add:
- worldgen seed tests
- replay consistency
- performance thresholds

`main` should remain runnable.

---

# 44. Commit and milestone policy

For larger work:
- use scoped feature branches where useful
- merge only tested changes
- maintain a milestone closure commit

Every milestone closure should state:
- what is complete
- tests
- known limitations
- commit SHA
- next milestone

Do not mark completion from intent alone.

---

# 45. M01 architecture acceptance

M01 must demonstrate:

- authoritative fixed-tick simulation
- PlayCanvas presentation linked but separated
- selection/move/attack
- 20–40 units
- Fire/Water/Ice/Lightning state system
- Water → Ice navigation transition
- Fire/heat → ice degradation
- Wet status
- conductivity-based lightning chain
- deterministic behavior
- replay/hash smoke test
- debug overlay
- acceptable performance

M01 is not a graphics milestone.

---

# 46. Architecture decision record

Add `docs/DECISIONS.md` after repo creation.

Initial ADR candidates:

- ADR-001: 10 Hz fixed simulation tick
- ADR-002: simulation independent of PlayCanvas
- ADR-003: deterministic RNG only
- ADR-004: block height is a seed input, not a hard online dependency
- ADR-005: command-stream replay
- ADR-006: asset replacement via stable IDs/manifests
- ADR-007: background music manual Gemini pipeline
- ADR-008: agent token-efficiency policy

Changes to these decisions should be explicit.

---

# 47. Non-goals for current architecture

Do not design around:
- authoritative multiplayer networking
- blockchain wallet authentication
- NFT ownership
- mobile GPU baseline
- photorealistic rendering
- thousands of simultaneous units

The architecture should not block future evolution, but it should not pay current complexity for uncommitted features.

---

# 48. Final engineering principle

Build the systems so that later visual improvement can be aggressive.

The desired development path is:

```text
simple readable battlefield
→ compelling systemic combat
→ complete replayable RTS
→ richer content
→ high-quality combat animation/VFX/audio
→ refined final visual identity
```

not:

```text
expensive assets
→ impressive screenshot
→ unclear gameplay
→ architecture rewrite
```
