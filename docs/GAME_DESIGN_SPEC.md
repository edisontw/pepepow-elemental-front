# PEPEPOW Elemental Front｜GAME_DESIGN_SPEC

**Canonical gameplay specification**  
**Spec baseline:** V0.3 consolidated  
**Status:** IMPLEMENTATION BASELINE

---

# 1. Product definition

PEPEPOW Elemental Front is a **2.5D / stylized-3D browser RTS roguelite** focused on:

- procedural battlefields
- territory and supply
- army-level control
- elemental battlefield simulation
- adaptive but non-cheating enemy AI
- replayable block-height-derived challenges

The distinguishing mechanic is not elemental damage bonuses. Elements modify the world.

Examples:

- water can become ice and create a route
- heat can break that route
- wet units become more vulnerable to lightning chains
- forest fires alter movement, visibility, and territory value
- ice can reduce conductivity relative to open water
- environmental choices can help or hurt both sides

The game should repeatedly produce stories the player can explain strategically after the run.

---

# 2. Design priorities

Priority order:

1. Gameplay
2. Replayability
3. System interactions
4. AI and strategic pressure
5. Controls and readability
6. Content breadth
7. Visual polish

A visually impressive effect is not valuable if it does not improve tactical readability or game feel.

---

# 3. Target run

Standard run:

**25–35 minutes**

Expected range:

- fast aggressive run: 15–20 min
- standard: 25–35 min
- long run: around 40 min

The first meaningful exploration/combat decisions should occur within the opening minutes.

---

# 4. Five-act pacing

## Act I — Discovery | 0–5 min

Player:
- scouts
- finds nearby terrain structure
- discovers first low-risk POI
- fights first minor encounter
- sees first strategic choice

Question:
> What did this world give me?

## Act II — Commitment | 5–12 min

Player:
- takes first shrine or equivalent upgrade
- expands
- commits partially to a build direction
- starts recognizing faction and biome pressures

Question:
> Which opportunities am I going to exploit?

## Act III — Expansion | 12–20 min

Player:
- fights for mana and territory
- builds supply links
- cuts or protects outposts
- obtains secondary synergy
- encounters major raids/events

Question:
> Where is the war actually being decided?

## Act IV — Escalation | 20–27 min

Player:
- faces elite/siege pressure
- uses strategic spells
- reacts to world events
- prepares for final objective

Question:
> Do I attack, stabilize, or create a battlefield advantage now?

## Act V — Finale | 27–35 min

Player:
- attacks enemy core, boss, ritual, or final objective
- must use the systems learned during the run
- cannot simply wait indefinitely

---

# 5. Resources

The game uses three primary strategic resources.

## Material

Used for:
- units
- buildings
- repairs
- defenses

Baseline:
- Core: +3 Material/sec
- normal Extractor: +5/sec
- rich deposit: +8/sec
- disconnected resource: 40% output

## Mana

Used for:
- tactical spells
- strategic spells
- elemental units
- ultimates

Baseline:
- Core: +0.5 Mana/sec
- Mana Well: +2/sec
- empowered well: +3/sec
- disconnected well: 50% output

## Influence

Used for:
- outposts
- territorial extension
- special strategic choices

Typical gains:
- capture POI: +10
- destroy camp: +8
- protect village: +15
- boss phase/objective: +10 to +20

Influence is intentionally less passive than Material/Mana.

---

# 6. Starting state

Initial resources:

- Material: 300
- Mana: 100
- Influence: 10
- Population: 6 / 30

Starting army:
- 4 Vanguard
- 1 Ranger
- 1 Scout

Elemental Core already exists.

---

# 7. Population

- initial cap: 30
- each Outpost: +10
- later progression upgrades: +10 / +10
- intended mature run range: 60–80
- provisional hard cap: 100

The game should not require hundreds of units to feel strategic.

---

# 8. Territory and supply

Outposts form the strategic supply network.

Connected territory provides:
- normal resource throughput
- reinforcement
- healing/support functions
- population
- build radius

Disconnected territory remains usable but weakened.

Connection rules:
- Outpost links are graph-based
- provisional maximum link distance: 30 m
- hostile territorial control can cut a connection
- supply evaluation updates at a lower frequency than combat

Disconnected penalties:
- Material resource output: 40%
- Mana resource output: 50%
- reinforcement disabled
- local support reduced/disabled as implemented

The intent is to make raids, flanks, and chokepoints meaningful.

---

# 9. Territory radii

Provisional:
- Elemental Core influence radius: 24 m
- Outpost influence radius: 18 m

Overlapping hostile influence creates `Contested` territory.

Contested area:
- blocks major construction
- reduces resource efficiency
- slows capture

---

# 10. Capture

Baseline:
- normal unit: 1 capture power
- Scout: 0.5
- Vanguard: 1.5
- base capture time: 20 sec
- group acceleration capped at ×3

---

# 11. Buildings

First core set:

## Elemental Core

- HP: 5000
- Armor: 30
- main base
- baseline income
- spell anchor
- base population

Critical state:
- once per run
- when HP reaches zero, enter 30-second critical period
- repair to 10% HP to recover
- otherwise defeat

## Barracks

- HP: 1200
- Armor: 18
- Material: 250
- Build: 35 sec

Produces:
- Vanguard
- Spear Guard
- Ranger
- Scout

## Arcane Tower

- HP: 900
- Armor: 12
- Material: 220
- Mana: 40
- Build: 35 sec

Produces:
- Elementalist

Local passive:
- +10% nearby Mana regeneration
- non-stacking baseline

## Workshop

- HP: 1300
- Armor: 22
- Material: 350
- Build: 50 sec

Produces:
- Engineer
- Golem
- Siege Construct

## Outpost

- HP: 1000
- Armor: 20
- Material: 180
- Influence: 10
- Build: 30 sec
- +10 Population

Provides:
- territory
- supply
- vision

Optional upgrade:
- Watchtower
- Barrier Hub
- Mana Beacon

Only one primary Outpost specialization at baseline.

## Extractor

- HP: 500
- Armor: 8
- Material: 100
- Build: 18 sec

Must be placed on Material Deposit.

---

# 12. Unit stat model

Common fields:

- HP
- Armor
- Move Speed
- Attack Damage
- Attack Interval
- Attack Range
- Population
- Material Cost
- Mana Cost
- Training Time
- Vision
- Mass
- Tags

Armor baseline formula:

```text
finalDamage = rawDamage × 100 / (100 + Armor)
```

---

# 13. Unit baseline

## Vanguard

- HP 180
- Armor 12
- Move 3.6
- Damage 18
- Interval 1.1 s
- Melee
- Pop 1
- Material 45
- Train 12 s
- Vision 8
- Mass 1.0

Role:
- frontline
- capture
- cheap defense

## Spear Guard

- HP 220
- Armor 18
- Move 3.1
- Damage 20
- Interval 1.35 s
- Range 2.2 m
- Pop 2
- Material 75
- Train 18 s

Traits:
- +60% damage vs Heavy
- -15% incoming projectile damage in frontal/defensive condition

## Ranger

- HP 110
- Armor 4
- Move 3.5
- Damage 17
- Interval 1.4 s
- Range 10 m
- Pop 1
- Material 65
- Train 16 s

Forest traits:
- harder to detect
- first-attack bonus baseline +25%

## Scout

- HP 80
- Armor 0
- Move 5.5
- Damage 8
- Interval 1.2 s
- Range 6 m
- Pop 1
- Material 40
- Train 9 s
- Vision 15

Role:
- reconnaissance
- POI discovery
- spotting
- supply-line raid

## Elementalist

- HP 100
- Armor 3
- Move 3.2
- Damage 14
- Interval 1.5 s
- Range 9 m
- Pop 2
- Material 70
- Mana 25
- Train 22 s

Basic attack behavior varies by elemental alignment:
- Fire → Burn
- Ice → Chill/Slow
- Lightning → small chain
- Water → Wet

## Engineer

- HP 120
- Armor 8
- Move 3.3
- Damage 9
- Pop 1
- Material 65
- Train 18 s

Functions:
- repair
- temporary bridge
- barrier
- outpost construction/support

## Golem

- HP 600
- Armor 35
- Move 2.3
- Damage 42
- Interval 1.8 s
- Pop 5
- Material 220
- Mana 60
- Train 40 s
- Mass 5.0

Role:
- heavy frontline

## Siege Construct

- HP 320
- Armor 15
- Move 1.8
- Damage vs Unit 25
- Damage vs Building 110
- Interval 3.0 s
- Range 14 m
- Minimum range 4 m
- Pop 5
- Material 260
- Mana 20
- Train 45 s

Role:
- structure and objective pressure
- vulnerable when caught at close range

---

# 14. Formations

Initial formation set:

## Line
- ranged effectiveness +10%
- slower turning

## Column
- movement +10%
- defense -10%

## Defensive
- knockback resistance +50%
- movement -15%

Formation micro should remain secondary to strategic control.

---

# 15. Terrain combat

## High Ground
- increased vision
- projectile advantage
- harder to attack efficiently from below

## Forest
- reduced visibility
- reduced ranged consistency
- ambush opportunities
- flammable

## Mud
- movement penalty
- stronger heavy-unit penalty

## Ice
- fast traversal potential
- turning/stability risk
- can fail under heat/stress

## Water
- movement penalty or blocked by depth
- increases conductivity

---

# 16. Elemental state model

Terrain cells may track:

- temperature
- wetness
- vegetation
- burning
- frozen/ice durability
- conductivity
- terrain flags

Units may receive:

- Wet
- Burning
- Frozen
- Chilled
- Conductive

The system is a gameplay abstraction, not a physical-fluid simulation.

---

# 17. Temperature

Reference:
- 0 = neutral baseline
- Fire may add +40 to +100
- Ice may add -40 to -100

Thresholds:
- <= -70: Frozen candidate
- >= +70: ignition possible

Temperature trends back toward local baseline over time.

---

# 18. Wetness

Range:
- 0–100

Thresholds:
- >= 40: Wet
- >= 80: Very Wet

Baseline decay:
- approximately 2/sec before biome/weather modifiers

Heat accelerates evaporation.

---

# 19. Burning

Ignition baseline:

```text
temperature >= 70
AND vegetation sufficient
AND wetness < 40
```

Burning terrain:
- increases nearby heat
- consumes vegetation
- can spread

Baseline burning unit damage:
- 8 damage/sec before modifiers

Spread should depend on:
- vegetation
- moisture
- wind when later implemented
- temperature
- deterministic propagation logic

---

# 20. Ice

Water may freeze when sufficiently cold.

Reference:
- water freeze threshold near -60 cell temperature baseline
- ice durability baseline: 100

Heat reduces durability.

Heavy units add stress.

Important design outcome:
- ice is a route and a risk
- ice is not merely a cosmetic surface

---

# 21. Conductivity

Reference values:

- Dry terrain: 0.2
- Wet terrain: 0.7
- Water: 1.0
- Ice: 0.4
- Metal unit: 0.8
- Wet unit: 0.9

Lightning target propagation should prefer higher conductivity, not only geometric proximity.

---

# 22. Core interactions

## Fire × Water
- extinguishes burning
- strong heat + water may create steam
- steam reduces vision

## Fire × Ice
- accelerates melting
- broken ice can drop/slow/wet units
- heavy units are more at risk

## Water × Lightning
- Wet target: +25% lightning damage baseline
- shallow-water chains: +50% jump range baseline

## Ice × Lightning
- ice is less conductive than water
- freezing an area can therefore reduce some lightning opportunities

## Fire × Lightning
- no mandatory direct damage synergy
- lightning may ignite very dry vegetation under defined rules

## Water × Ice
- water + cold → ice
- ice + heat → water

Not every interaction should be a positive combo. Counterplay and risk are required.

---

# 23. Spell slots

Suggested active loadout:

- 4 Tactical
- 2 Strategic
- 1 Ultimate

Exact hotkeys are implementation/UI details.

Mana is the primary opportunity-cost limiter; cooldowns mainly prevent spam.

---

# 24. Tactical spells

## Firebolt
- Mana 20
- Cooldown 5 s
- Radius 2.5 m
- Damage 50
- Burn 5 s

## Freeze
- Mana 25
- Cooldown 7 s
- Radius 3 m
- strong cold application
- can slow/freeze/water-to-ice

## Chain Lightning
- Mana 35
- Cooldown 8 s
- Damage 55
- Chains 4
- Base jump 4 m
- Wet: +50% jump range and +25% damage baseline

## Water Burst
- Mana 20
- Cooldown 6 s
- Radius 3.5 m
- Wet
- extinguish
- push light units

---

# 25. Strategic spells

## Blizzard
- Mana 120
- Cooldown 60 s
- Duration 12 s
- Radius 10 m
- cold accumulation
- slow
- water freeze
- vision reduction

## Thunderstorm
- Mana 140
- Cooldown 70 s
- Duration 10 s
- Radius 12 m
- wet terrain
- periodic lightning
- conductivity pressure

## Inferno
- Mana 130
- Cooldown 65 s
- Duration 12 s
- Radius 10 m
- heat/fire spread/smoke

---

# 26. Ultimates

## Meteor
- Mana 250
- Cast delay 4 s
- Radius 7 m
- central damage 350
- leaves burning crater

## Absolute Zero
- Mana 250
- Radius 12 m
- Duration 8 s
- extreme cold control

## Supercell
- Mana 275
- Duration 15 s
- large storm effect

---

# 27. Mana pool

- initial max: 250
- each Shrine: +20 max baseline
- provisional max: 500

The player should routinely face the decision:
> Spend mana now or preserve it for the next major engagement?

---

# 28. Shrine / roguelite system

A Shrine offers three choices.

The player normally acquires approximately:
- 4–7 meaningful upgrades per run

Upgrades should primarily:
- alter rules
- create synergy
- create risk/reward
- enable alternate tactical behavior

Avoid filling the pool with small generic damage increments.

---

# 29. Example upgrade families

Fire:
- longer Burn
- faster ignition
- controlled allied-fire resistance
- wildfire spread
- scorch armor
- mana from burning enemies

Water:
- longer Wet
- greater push
- healing on wet ground
- stronger steam
- conductivity synergy
- stronger Mana Wells

Ice:
- easier freezing
- brittle/shatter behavior
- allied speed on ice
- slower melt
- frost armor
- stronger Blizzard/whiteout

Lightning:
- more chains
- bonus vs metal
- conductive fields
- storm mobility
- self-grounding
- mana return on wet kills

Mixed:
- thermal shock
- electrolysis
- steam engine
- black ice
- flash freeze

Implementation should use tags/triggers/modifiers rather than hand-coded bespoke logic whenever possible.

---

# 30. Map baseline

Standard map:
- 128 × 128 logical cells
- provisional 2 m × 2 m logical cell scale
- approximately 256 m × 256 m play area

Alternative later:
- Small: 96 × 96
- Large: 160 × 160

Standard is the balance target.

---

# 31. Strategic regions

Each standard map should form approximately:
- 8–14 recognizable Strategic Regions

Examples:
- North Ridge
- Frozen Lake
- Central Valley
- Ancient Forest
- Eastern Ruins
- Volcanic Basin

Regions must be strategically legible rather than indistinct noise.

---

# 32. Terrain distribution target

Standard map starting envelope:

- Open ground: 35–50%
- Forest: 15–25%
- Water: 8–15%
- High ground: 10–20%
- Difficult terrain: 5–15%

Biome rules may shift these values.

---

# 33. Rivers and chokepoints

Standard baseline:
- 0–2 major rivers
- 0–3 minor streams
- major river should normally offer at least 2 natural crossings

Meaningful chokepoints:
- approximately 3–7 per standard map
- minimum traversable width: 3 logical cells
- major routes commonly 4–10 cells wide

No generated map should depend on a single accidental one-cell path.

---

# 34. Spawn guarantee

Player spawn region should guarantee:
- one Material source
- one reasonable expansion route
- one low-risk POI

Mana does not need to be safe or nearby.

The map should be asymmetrical and strategically uneven, but not unsolvable.

---

# 35. Standard POI envelope

Indicative:
- Material Deposits: 8–12
- Mana Wells: 4–7
- Shrines: 5–8
- Neutral Camps: 4–7
- Villages: 1–3
- Ancient Ruins: 1–3
- Major Objective: 1
- Boss Area: 1

---

# 36. Procedural generation pipeline

```text
Block Height
→ ruleset-aware deterministic seed
→ elevation
→ hydrology
→ biome
→ strategic regions
→ route/chokepoint graph
→ resources
→ POIs
→ player spawn
→ enemy territory
→ boss/objective
→ validator
→ accepted battlefield
```

The same Block Height + same Ruleset Version must yield the same battlefield.

---

# 37. Validator

Hard failures:
- player trapped
- boss/objective unreachable
- no usable Material
- no viable expansion
- invalid POI overlap
- impossible traversal state

Quality checks:
- excessive water
- poor route diversity
- uninteresting region graph
- excessive chokepoints
- weak strategic resource distribution

Failed generation retries must remain deterministic.

---

# 38. Enemy archetypes

## Iron Legion
Identity:
- armor
- formation
- siege
- frontal pressure

Approximate army mix:
- Vanguard 20%
- Spear 30%
- Ranged 20%
- Heavy 20%
- Siege 10%

## Flame Cult
Identity:
- aggression
- fire
- terrain destruction
- supply pressure

Approximate:
- Fast melee 30%
- Fire ranged 30%
- Elementalist 20%
- Heavy 10%
- Siege 10%

## Wild Horde
Identity:
- speed
- swarm
- ambush
- flanking

Approximate:
- Fast melee 40%
- Ranged 20%
- Scout 20%
- Heavy 20%

---

# 39. AI principles

AI has:
- Tactical layer
- Strategic layer
- Director layer

AI must:
- scout
- remember last-known information
- evaluate routes/objectives
- raid supply
- defend valuable territory
- retreat/regroup when appropriate

AI must not:
- see through fog
- receive arbitrary free armies
- teleport reinforcements
- use impossible knowledge

---

# 40. Strategic AI action set

Initial actions:
- EXPAND
- DEFEND
- RAID
- ATTACK
- CONTEST_POI
- REGROUP

Illustrative attack evaluation:

```text
0.30 ArmyAdvantage
+ 0.20 ObjectiveValue
+ 0.15 SupplyWeakness
+ 0.15 TerrainAdvantage
+ 0.10 SpellReadiness
+ 0.10 InformationConfidence
```

Exact weights are tunable balance parameters.

---

# 41. Director pressure

Director evaluates at low frequency.

Pressure inputs:
- player army
- economy
- territory
- losses
- game time
- objective progress

Reference pressure curve:
- 0–5 min: 15
- 5–10: 25
- 10–15: 40
- 15–20: 55
- 20–25: 70
- 25–30: 85
- 30+: 95

Pressure range:
- 0–100

Director may influence:
- raid intent
- enemy expansion
- event timing
- elite activation
- boss activation

It should not directly cheat raw combat statistics.

---

# 42. Recovery and anti-turtle

Recovery:
- if approximately >25% army value lost in 60 sec, temporarily reduce pressure
- intended breathing window: ~45–90 sec

Anti-turtle:
- if player remains static for ~5 min while strong and resource-rich, increase objective/enemy expansion pressure
- do not simply spawn an unfair army beside the base

---

# 43. World events

Initial families include:
- Blizzard
- Heat Wave
- Thunderstorm
- Mana Surge
- Earth Tremor
- later additional variants

Typical run:
- 2–4 minor events
- 1–2 major events

Important events should telegraph approximately 20–40 sec before impact.

---

# 44. Boss baseline

## Frost Titan
- HP 8000
- Armor 35
- phases alter freezing/blizzard/ice terrain

## Storm Colossus
- HP 7000
- Armor 25
- rain/water/lightning-node battlefield control

## Infernal Behemoth
- HP 9000
- Armor 30
- fire/lava/heat/charge battlefield pressure

Boss design rule:
> Bosses modify the battlefield; they are not merely high-HP units.

Rubber-band scaling should remain small and legible.

---

# 45. Victory modes

Initial mode families:

## Destroy
Destroy enemy Core.

## Boss Hunt
Defeat generated major boss.

## Objective Control
Later support ritual/survival variants.

First implementation may begin with Destroy + Boss Hunt.

---

# 46. Fog of war

Three states:
- Unexplored
- Explored
- Visible

Explored terrain remains known, but enemy information becomes stale.

Indicative vision:
- ordinary unit: 8–10 m
- Scout: 15 m
- Tower: 18 m
- high ground: +25% baseline
- forest reduces effective visibility

Large events may telegraph beyond direct vision through smoke, glow, sound, lightning, etc.

---

# 47. Comeback design

Avoid deterministic snowballing.

Possible mechanism:
- reduced territory temporarily improves Core Mana regeneration modestly

Rules:
- comeback tools should create tactical opportunity
- they should not generate free armies or invalidate early advantages

Expansion also has increasing marginal cost; provisional Outpost costs may rise by count.

---

# 48. Difficulty

Difficulty should primarily alter:
- strategic quality
- reaction delay
- flanking/raiding skill
- elemental usage
- objective prioritization

Avoid relying primarily on:
- ×2 HP
- ×2 damage
- hidden resource cheating

---

# 49. Scoring

Daily/Block Challenge provisional score:

- Victory: 10,000
- Time: max 5,000
- Army survival: max 4,000
- Territory: max 3,000
- Objectives: max 3,000
- Resource efficiency: max 2,000
- Elemental/style chain: max 3,000

Approximate maximum target:
- 30,000

Elemental chain scoring can detect sequences such as:

```text
Freeze → Melt → Wet → Lightning
```

---

# 50. Replayability principle

Replayability should come primarily from **system combinations**, not content volume.

Sources:
- Block Height
- biome
- region graph
- resources
- shrine choices
- enemy faction/personality
- world events
- boss
- victory condition
- elemental synergies

The key replay question is:

> Does this generated battlefield force or invite a different plan?

---

# 51. Block Challenge

Same:
- PEPEPOW Block Height
- Ruleset Version

must generate the same challenge.

Potential modes:
- manual block input
- daily official block
- shareable seed/block
- leaderboard
- weekly mutations later

Blockchain is a deterministic world-input system, not mandatory wallet gating.

---

# 52. Playtest success criteria

A run is strategically healthy when:

1. the player uses a different plan on meaningfully different generated maps
2. after losing, the player can identify decisions they could improve
3. the player can describe at least one memorable systemic interaction
4. the player wants to see the next generated battlefield

If these fail, adding more models, units, or effects is not the solution.

---

# 53. Telemetry targets

Track eventually:
- game duration
- first combat
- first shrine
- first expansion
- army size/composition
- floating resources
- spell usage
- territory
- element damage/state events
- unit losses
- boss duration
- win/loss

Highest priority analytics:
1. time between meaningful decisions
2. strategy diversity between seeds
3. actual use of terrain × element interactions

---

# 54. Explicitly deferred

Do not implement before core roadmap validates the game:

- PvP
- wallet requirement
- NFT economy
- large campaign
- 20+ civilizations
- realistic AAA art direction
- mobile-first balance
- massive 200+ unit baseline
- complicated worker micro economy

---

# 55. Gameplay acceptance principle

When a design question is ambiguous, prefer the option that increases:

- battlefield readability
- meaningful adaptation
- counterplay
- emergent interaction
- deterministic reproducibility
- strategic choice

over the option that merely adds feature count.
