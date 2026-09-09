# PEPEPOW Elemental Front — Post-Roadmap Gameplay Redesign Spec

**Status:** DESIGN BASELINE / NOT YET AUTHORITATIVE RUNTIME RULES  
**Scope:** post-M08 gameplay redesign direction  
**Runtime authority:** none until explicitly adopted into `GAME_DESIGN_SPEC.md`, runtime data, and a new gameplay ruleset version  
**Visual companion:** `media/prompts/images/POST_ROADMAP_UNIT_BUILDING_ART_PROMPTS.md`

---

## 1. Purpose

This document defines the first deliberate gameplay redesign direction after the original M00–M08 roadmap was completed.

The redesign focuses on the areas intentionally left open after M08:

- deeper Fire / Water / Ice / Lightning roles and counterplay
- elemental acquisition and progression
- tactical versus strategic spell ownership
- Mana decision pressure
- combat target identity and structure assault
- clearer unit battlefield roles
- army control and spell usability
- AI implications of the redesigned elemental layer

The goal is not to imitate a specific classic RTS. The target identity combines:

- territory and expansion pressure associated with classic economy RTS play;
- sharp unit-role readability associated with competitive RTS design;
- readable battlefield spell control without becoming hero-centric or excessively micro-heavy.

The project-specific differentiator remains:

> **Elements change the battlefield. They are not merely damage colors.**

---

## 2. Design principles

### 2.1 Strategic decisions over action density

The player should win because of:

- positioning;
- route control;
- scouting;
- elemental preparation;
- timing;
- target selection;
- economy and territory decisions.

The game should not require high APM simply because several spellcasters are present.

### 2.2 Keep the existing three-resource economy

Retain:

- `Material`
- `Mana`
- `Influence`

Do not add separate Fire / Water / Ice / Lightning stockpile resources.

Element choice should be a **technology / commitment decision**, not another mining layer.

### 2.3 Sharpen the current roster before expanding it

The current eight player unit archetypes are enough to support a deeper first redesign pass:

- Vanguard
- Spear Guard
- Ranger
- Scout
- Elementalist
- Engineer
- Golem
- Siege Construct

Do not add new unit types merely to create apparent depth. First ensure each existing unit answers a distinct battlefield question.

### 2.4 Environmental consequences remain meaningful

Direct spell targeting may be ally-safe at baseline for usability, but persistent battlefield consequences should normally be faction-agnostic.

Examples:

- burning terrain harms whoever occupies it;
- collapsing ice threatens both sides;
- steam or visibility loss affects both sides;
- altered navigation applies to everyone.

This preserves tactical risk without turning every cast into a friendly-fire trap.

---

## 3. Elemental access — Attunement

### 3.1 Starting choice

At the beginning of a standard run, the player chooses **two starting Elemental Attunements** from:

- Fire
- Water
- Ice
- Lightning

The standard opening should not assume immediate access to all four elements.

### 3.2 What an Attunement unlocks

An Attunement should unlock or enable the corresponding package of content:

- Elementalist alignment;
- Tactical spell access;
- related Shrine upgrade pool;
- related mixed-element synergy eligibility;
- selected structure or relay interactions where appropriate.

### 3.3 Mid-run progression

Later rewards may offer choices such as:

- deepen an existing Attunement;
- unlock a third Attunement;
- unlock a dual-element synergy;
- improve the spell network;
- improve caster reliability or survivability.

Full four-element access should be unusual rather than the default run state.

### 3.4 Design reason

Attunement creates run identity.

Examples:

- Water + Lightning emphasizes setup and burst chains;
- Water + Ice emphasizes route manipulation and control;
- Fire + Ice emphasizes terrain denial and counter-control;
- Fire + Lightning emphasizes forced movement and punishing exposed targets.

The important difference is not a flat elemental damage bonus. It is the set of battlefield options the player chose to bring into the run.

---

## 4. Spell ownership model

Split spells into two clear layers.

### 4.1 Tactical spells

Tactical spells are delivered primarily through **Elementalists**.

Expected properties:

- local battlefield range;
- low to medium Mana cost;
- short to medium cooldown;
- frequent use during ordinary engagements;
- clear dependence on caster position and safety.

Counterplay:

- pressure, zone, or kill Elementalists;
- force the caster out of range;
- interrupt the setup before the spell gains full value.

### 4.2 Strategic spells

Strategic spells are army-level powers routed through a **spell network** rather than belonging to one mobile unit.

Valid anchor classes may include:

- Elemental Core;
- Arcane Tower;
- upgraded and connected Outpost relay.

Expected properties:

- high Mana cost;
- long cooldown;
- large battlefield footprint;
- stricter infrastructure or territory requirements;
- meaningful counterplay through raids and supply disruption.

A player under sustained territorial pressure should not retain identical strategic-casting reach as a player with an intact network.

### 4.3 Mana remains the primary limiter

Cooldowns prevent spam, but Mana remains the primary opportunity-cost resource.

The recurring decision should be:

> Spend Mana now for immediate tempo, or preserve it for the next decisive engagement?

---

## 5. Element identity matrix

Each element needs four things:

1. a tactical job;
2. preferred targets;
3. valuable setup conditions;
4. meaningful counterplay.

---

## 6. Fire

**Primary verbs:** burn, deny, melt, force movement.

### Preferred targets

- clustered infantry;
- forest cover;
- frozen crossings;
- static defenses;
- slow or entrenched forces;
- congested structure approaches.

### Core effects

- Burning status;
- terrain ignition;
- heat accumulation;
- smoke / vision pressure where supported;
- accelerated ice durability loss;
- persistent positional denial.

### Tactical identity

Fire should create bad ground.

Its strongest value is often indirect:

- force defenders out of cover;
- remove forest concealment;
- cut off a retreat route;
- collapse an enemy-created ice crossing;
- make a siege position unsustainable.

### Counterplay

- Water extinguishes fires and cleanses Burn pressure;
- wet terrain reduces ignition value;
- mobile spread formations reduce area-denial efficiency.

Fire must not become a universal high-damage answer.

---

## 7. Water

**Primary verbs:** wet, prepare, cleanse, displace, enable.

### Preferred targets

- burning areas;
- light formations;
- choke approaches;
- areas intended for Lightning or Ice follow-up;
- allied groups under Fire pressure.

### Core effects

- Wet status;
- extinguish Burn and burning terrain;
- controlled displacement of light units;
- terrain preparation for conductivity or freezing;
- selective sustain synergies through upgrades.

### Tactical identity

Water is the strongest **setup element**.

It should often feel incomplete when used alone and powerful when the player planned the next action.

Examples:

- Water → Lightning chain opportunity;
- Water → Ice control or bridge creation;
- Water → extinguish a Fire denial zone and reopen a route.

### Counterplay

- Wet decays over time;
- heat accelerates removal;
- Water has lower direct lethality than Fire or Lightning;
- poor follow-up reduces its value.

---

## 8. Ice

**Primary verbs:** slow, freeze, hold, block, bridge.

### Preferred targets

- Wet units;
- river crossings;
- chokepoints;
- pursuit lanes;
- retreat lanes;
- aggressive melee fronts.

### Core effects

- Chill / strong slow;
- Frozen under stronger setup conditions;
- water-to-ice route creation;
- temporary bridge creation;
- route denial;
- lower conductivity than open water;
- defensive time-buying.

### Tactical identity

Ice should create major spatial decisions.

The most memorable Ice plays should include:

- creating an unexpected crossing;
- stopping an advancing army long enough to regroup;
- sealing a flank;
- freezing a pursuit route;
- deliberately changing the conductivity state of a water zone.

### Counterplay

- Fire accelerates melting;
- heavy units stress ice routes;
- unstable ice creates risk for the player who relies on it;
- Ice should have limited finishing power without support.

---

## 9. Lightning

**Primary verbs:** punish, burst, chain, disrupt, overload.

### Preferred targets

- Wet clusters;
- metal or mechanical units;
- support units;
- Elementalists;
- selected relay / tower infrastructure;
- dense backlines.

### Core effects

- burst damage;
- conductivity-weighted chains;
- interruption or overload on selected target classes;
- anti-support pressure;
- strong finishing value.

### Tactical identity

Lightning should reward preparation and target quality rather than indiscriminate casting.

The player should feel a large difference between:

- casting into a dry, spread formation;
- casting into a Wet, conductive cluster with valuable support targets.

### Counterplay

- spread formation;
- avoid standing in conductive terrain;
- deny Water setup;
- convert water to lower-conductivity ice where useful;
- pressure exposed Lightning casters.

---

## 10. Interaction rules

### 10.1 Positive setups

#### Water → Lightning

- Wet increases Lightning value;
- chain selection should prefer high-conductivity targets;
- shallow water may extend propagation opportunities.

#### Water → Ice

- Wet or water prepares stronger freezing opportunities;
- water terrain can become temporary navigation.

#### Fire → route denial against Ice

- Fire can weaken or collapse enemy-created frozen routes;
- this interaction should matter especially for Heavy units.

#### Control → Ranger / Siege follow-up

Elemental control should create conventional-army opportunities.

Examples:

- Ice slows targets for Ranger focus;
- Fire forces units out of cover into ranged lanes;
- Water displacement exposes a formation;
- Lightning removes support protecting a Siege Construct target.

### 10.2 Counters and anti-synergies

Not every pairing is beneficial.

Important examples:

- Water counters Fire;
- Fire counters Ice stability;
- Ice can reduce Lightning opportunity by replacing open water with lower-conductivity terrain;
- Water without follow-up intentionally trades direct lethality for setup value.

This prevents the elemental system from degenerating into a universal combo stack.

---

## 11. Elementalist redesign

### 11.1 Shared chassis, explicit alignment

Keep one base archetype — `Elementalist` — but create explicit elemental alignments:

- Fire Elementalist;
- Water Elementalist;
- Ice Elementalist;
- Lightning Elementalist.

All alignments may share a common baseline class for:

- survivability;
- movement;
- population;
- general attack range.

They differ in:

- basic-attack secondary state;
- Tactical spell;
- preferred army partners;
- preferred terrain and target conditions.

### 11.2 Alignment choice

Recommended default direction:

- choose alignment at training time from currently unlocked Attunements.

Alternative retained for later evaluation:

- train a neutral apprentice and align at an Arcane Tower.

A fielded Elementalist should **not** freely switch among all four elements during combat.

### 11.3 Multi-caster usability

When multiple selected Elementalists can perform the requested cast:

- use one valid local caster by default;
- choose deterministically using defined priority rules;
- spend one spell cost;
- do not make every selected caster duplicate the cast unless the player explicitly queues repeated casts.

This is important for low-friction army control.

---

## 12. Army controls

Retain familiar RTS expectations where possible.

### Core controls

- left-click selection;
- drag-box selection;
- Shift add / remove selection;
- `Ctrl+1..0` control groups;
- double-click visible same-type selection;
- right-click contextual order;
- `A` Attack Move;
- `S` Stop;
- `H` Hold;
- `Tab` subgroup cycling inside mixed selections.

### Design constraint

Do not create depth by giving every line unit a large active-ability kit.

Recommended ability density:

- ordinary line unit: zero or one simple active;
- specialist: one signature active at most;
- Elementalist: one core Tactical spell plus elemental attack identity;
- Strategic spells: separate command layer.

The player should spend attention on army decisions, not on maintaining eight simultaneous mini-spellbooks.

---

## 13. Spell targeting UX

Targeting preview is a gameplay requirement.

Before confirmation, the game should communicate what the cast is expected to affect.

### Examples

#### Fire

Preview:

- impact / denial area;
- flammable terrain where meaningful;
- existing ice likely to be affected.

#### Water Burst

Preview:

- area;
- likely light-unit displacement direction;
- relevant fires to be extinguished.

#### Freeze

Preview:

- cast area;
- water cells expected to become ice;
- Wet units eligible for stronger control.

#### Chain Lightning

Preview:

- initial target;
- likely chain nodes or chain envelope;
- conductivity-sensitive opportunities.

### Confirmation model

Recommended:

1. press spell hotkey;
2. targeting preview appears;
3. left click confirms;
4. right click or `Esc` cancels.

---

## 14. Formation redesign

Formations should emphasize spatial behavior over opaque percentage modifiers.

Recommended practical set:

### Line

- wide frontage;
- useful for ranged firing lines;
- less convenient in narrow terrain.

### Column

- narrow pathing footprint;
- useful for roads, bridges, and chokepoints;
- vulnerable to line-facing area effects.

### Spread

- increased spacing;
- useful against chain and area effects;
- occupies more terrain and is less compact for focused pushes.

### Guard

- maintain protective relationship around a selected unit or small support cluster;
- useful for Elementalist, Engineer, or Siege escort.

Avoid relying primarily on hidden `+10% / -15%` stat packages to make formations meaningful.

---

## 15. Unit-role baseline

### 15.1 Vanguard

**Role:** general frontline, capture, early map control.

Should be:

- inexpensive;
- reliable;
- useful as escort and body-blocking mass;
- adequate rather than exceptional against most ordinary threats.

Weakness:

- focused ranged fire;
- heavy area denial;
- specialist counters.

### 15.2 Spear Guard

**Role:** anti-Heavy anchor, charge denial, chokepoint defender.

Should:

- protect the army from Golem / Heavy pushes;
- reward facing or Brace-like defensive behavior;
- be slower and more specialized than Vanguard.

### 15.3 Ranger

**Role:** ranged damage and positional punishment.

Should:

- need screening;
- benefit strongly from high ground, forest positioning, and controlled enemies;
- punish units displaced, slowed, or forced out of cover.

### 15.4 Scout

**Role:** information, spotting, POI discovery, raid support.

Should not behave as merely a weaker Ranger.

Important value:

- vision;
- route discovery;
- spotting for ranged and spell play;
- supply-line harassment;
- rapid reaction to map events.

### 15.5 Elementalist

**Role:** battlefield-shaping specialist.

Should have:

- lower raw conventional DPS than dedicated combat units;
- high value through states, terrain, setup, and disruption;
- clear vulnerability when exposed.

### 15.6 Engineer

**Role:** repair, construction support, tactical infrastructure.

Important functions may include:

- repair;
- construction acceleration;
- barrier creation;
- temporary crossing support;
- relay or frontline infrastructure support.

Engineer value should come from enabling army options, not ordinary DPS.

### 15.7 Golem

**Role:** slow Heavy breakthrough unit.

Key characteristics:

- very high staying power;
- large mass;
- strong frontline pressure;
- high terrain sensitivity;
- clear vulnerability to anti-Heavy tools.

Recommended tags:

- `HEAVY`
- `METAL`

These make Spear Guard and Lightning interactions naturally readable.

### 15.8 Siege Construct

**Role:** structure and objective assault.

Should:

- be excellent against buildings and objectives;
- be mediocre against mobile armies;
- require escort;
- create commitment when fielded.

Future lever to test:

- deploy / undeploy;
- or a setup delay before peak firing performance.

---

## 16. Structure-role implications

### Elemental Core

Retain as:

- primary base;
- economy baseline;
- Strategic spell anchor;
- defeat-critical structure.

### Arcane Tower

Strengthen identity as elemental infrastructure.

Potential responsibilities:

- train or align Elementalists;
- local Mana regeneration support;
- Strategic spell relay;
- higher-tier elemental upgrade access.

### Outpost

Keep as a territory and supply node, but make it strategically valuable beyond population alone.

Potential roles:

- territory extension;
- frontline staging;
- reinforcement support;
- upgraded Strategic spell relay;
- raid target whose loss meaningfully weakens the network.

### Mana Well

Keep Mana Well focused primarily on **Mana acquisition**.

Do not make it the sole gate for elemental unlocks.

This keeps economic and technology decisions understandable.

---

## 17. Combat target classes

Future implementation should make target roles more explicit.

Useful tags or classes to evaluate include:

- `LIGHT`
- `HEAVY`
- `METAL`
- `RANGED`
- `ELEMENTAL`
- `BUILDING`
- `FORTIFIED`
- `ARCANE`
- `SUPPORT`
- `SIEGE`

The goal is not to create a complex hidden armor table. The goal is to let units and spells have obvious preferred jobs.

Examples:

- Spear Guard threatens `HEAVY`;
- Lightning prefers `WET`, conductive, and selected `METAL` targets;
- Siege Construct strongly prefers `BUILDING` / objective targets;
- Fire pressures static or congested positions;
- Scouts and Rangers gain value from information and positioning rather than universal damage bonuses.

---

## 18. AI implications

The AI should eventually understand enough of the elemental system to make intentional decisions without cheating.

Required future behaviors include:

- recognize Wet → Lightning opportunities;
- recognize Water → Ice route / control opportunities;
- use Fire against forests, crossings, and static positions;
- avoid obviously bad conductive clustering when information permits;
- protect exposed Elementalists;
- raid spell relays or Outposts when doing so reduces enemy strategic-cast reach;
- understand when a temporary ice route is valuable or dangerous.

AI decisions remain bounded by fog-of-war knowledge and deterministic rules.

---

## 19. Art and gameplay alignment

The current proposed visual direction is **Arcane-Industrial Frontier**.

Reference:

- `media/prompts/images/POST_ROADMAP_UNIT_BUILDING_ART_PROMPTS.md`

Gameplay and art should reinforce the same readability hierarchy:

- silhouette communicates unit job;
- team color communicates ownership;
- elemental glow / material communicates elemental state;
- weapons communicate attack role;
- structures communicate production / relay / resource function from an elevated camera.

Final art replacement remains separable from gameplay correctness.

---

## 20. Ruleset-version requirement

Any implementation of this redesign that changes authoritative gameplay semantics must use a **new gameplay Ruleset Version**.

Do not continue using:

- `m08-standard-v1`

The exact new version name should be assigned when the first authoritative redesign slice is adopted.

World generation remains independently versioned as required; the existing M02 generation baseline is not automatically changed by this redesign.

---

## 21. Recommended implementation sequence

### Phase 1 — Freeze the redesign contract

Finalize:

- starting Attunement count;
- Attunement unlock rules;
- Elementalist alignment rules;
- Tactical versus Strategic spell ownership;
- target tags;
- unit role expectations;
- first new gameplay Ruleset Version.

### Phase 2 — Element access and caster authority

Implement:

- run-start Attunement selection;
- aligned Elementalist training;
- deterministic caster selection;
- Tactical spell legality by alignment;
- Strategic spell anchor validation.

### Phase 3 — Control and targeting UX

Implement:

- subgroup cycling where missing;
- targeting previews;
- clear cast cancellation;
- improved command-card grouping;
- formation behavior changes.

### Phase 4 — Element interaction rebalance

Implement and tune:

- Fire denial and melting;
- Water setup / cleansing / displacement;
- Ice route and control behavior;
- Lightning conductivity / disruption behavior;
- environmental faction-agnostic consequences.

### Phase 5 — Unit, economy, and AI rebalance

Tune:

- unit costs and timings;
- Mana economy;
- structure value;
- target preferences;
- AI elemental heuristics;
- progression and Shrine pools.

### Phase 6 — Human playtest gate

Playtest specifically for:

- whether element choices create distinct runs;
- whether Water feels useful without becoming mandatory;
- whether Lightning setup is readable rather than arbitrary;
- whether Ice routes create strategic stories rather than pathfinding frustration;
- whether Fire denial remains controllable;
- whether Elementalist micro remains manageable;
- whether conventional units remain important alongside spells.

---

## 22. Acceptance criteria for adopting this redesign

This proposal should not become the new canonical gameplay baseline until the first implementation plan can answer all of the following:

1. How are the two starting Attunements selected and stored deterministically?
2. How is Elementalist alignment chosen and represented in replay state?
3. Which Tactical spell belongs to each alignment at the first implementation stage?
4. Which Strategic spell anchors are valid and how is relay connectivity checked?
5. How does the UI preview spell effects before confirmation?
6. Which new target tags are required versus merely desirable?
7. What becomes the new gameplay Ruleset Version?
8. Which existing M08 behavior is intentionally replaced and which remains unchanged?
9. What regression tests prove old architecture remains deterministic?
10. What human WebGL checks prove the new controls are understandable?

---

## 23. Current decision summary

The current proposed post-roadmap direction is:

1. Keep `Material / Mana / Influence`.
2. Start each run with two Elemental Attunements.
3. Treat Elementalists as the main Tactical spellcasters.
4. Treat Core / Arcane Tower / upgraded connected Outposts as Strategic spell infrastructure.
5. Give Fire, Water, Ice, and Lightning distinct battlefield jobs and counterplay.
6. Make environmental consequences meaningful to both factions.
7. Sharpen the current eight-unit roster before adding more units.
8. Reduce unnecessary caster micro through deterministic auto-selection and clear previews.
9. Use spatial formation behavior instead of relying on hidden stat bonuses.
10. Introduce a new gameplay Ruleset Version before any authoritative implementation is merged.

This document is the design baseline for the next implementation-planning step, not yet the authoritative live ruleset.