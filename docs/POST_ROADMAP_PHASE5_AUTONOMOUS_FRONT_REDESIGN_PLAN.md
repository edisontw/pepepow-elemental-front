# PEPEPOW Elemental Front — Post-Roadmap Phase 5 Autonomous Front Redesign Plan

**Status:** ACTIVE — P5-A1 IMPLEMENTED / playtest gate; P5-A2 not started  
**Date:** 2026-09-26  
**Baseline gameplay identity:** `ef-standard-v24`  
**Baseline replay identity:** `ef-replay-v24`  
**Current implemented identity after P5-A1 refinement:** `ef-standard-v26` / `ef-replay-v26`  
**World generation:** `m02-standard-v1` remains unchanged  
**Primary mode working name:** `COMMAND` / **Command Mode**  
**Existing direct-control mode working name:** `CLASSIC` / **Classic Mode**

---

## 1. Why Phase 5 exists

Elemental Front is approaching a playable visual and systemic baseline, but the current player experience still inherits too much traditional RTS interaction cost.

The main problems are not missing features. They are friction and diluted focus:

- the player must repeatedly select units, move the camera, issue movement/combat orders, manage production, and inspect multiple fronts;
- elemental spells are the game's strongest identity, yet Tactical casting currently requires the player to select an aligned Elementalist before casting;
- Extractor and Mana Well construction mostly converts a captured resource location into passive income and creates little additional decision value;
- formation and control-group systems are useful for expert RTS play but raise the baseline mechanical burden;
- veteran progression, procedural terrain, elemental simulation, POIs, neutral camps, Enemy War AI, and deterministic replay already create enough strategic depth that the game does not need high APM as its primary difficulty source.

Phase 5 therefore changes the product target from:

> a traditional RTS with increasing automation

to:

> a low-friction autonomous strategy game in which the player decides intent, composition, development, and elemental intervention while units execute routine battlefield actions.

The governing rule is:

> **Automate execution, never automate the interesting decision.**

---

## 2. Product goals

Phase 5 should make the game:

1. easy to understand without RTS experience;
2. playable without fast mouse movement or constant camera management;
3. interesting to watch because squads execute visible plans on their own;
4. strategically deep through army composition, region choices, veteran preservation, terrain, elemental interactions, and later doctrine choices;
5. deterministic and replayable under the existing simulation architecture;
6. compatible with the existing procedural battlefield and visual-production investment;
7. suitable for short, repeatable browser runs without becoming an idle game or a passive auto-battler.

Initial target run length is **15–25 minutes**, subject to playtest rather than a hard implementation constraint.

---

## 3. What Phase 5 is not

Phase 5 is not:

- a full rewrite;
- a removal of the deterministic 10 Hz simulation;
- a replacement for procedural world generation;
- a pure auto-battler where the player only watches;
- a worker-economy game;
- an automation-programming game where new players must author if/then rules;
- a requirement to delete current RTS controls;
- a reason to discard existing unit art, buildings, combat, Enemy War AI, XP, Shrines, POIs, Tower Defense, replay, or Block Challenge systems.

Classic direct control remains available during the redesign. Command Mode becomes the primary experimental product direction only after a playable prototype demonstrates that it is more engaging.

---

## 4. Core player verbs

The target Command Mode reduces normal play to four categories of meaningful decisions.

### 4.1 Where — Front Orders

The player assigns a squad one of three primary missions:

- **Advance** — move toward a selected region, POI, objective, or front; fight encountered threats and establish local control;
- **Guard** — defend a selected location or region, intercept nearby threats, and avoid long pursuit;
- **Regroup** — disengage and return to a safe supplied Core/Outpost location for recovery, reinforcement, and reorganization.

The player chooses the objective. The squad AI chooses routine pathing, target acquisition, local spacing, and combat execution.

Do not add Hunt, Support, Reserve, Explore, Patrol, Escort, or other mission types to the first slice. Add a new mission only if playtest demonstrates a decision that cannot be expressed clearly with Advance / Guard / Regroup.

### 4.2 Who — Army Composition

The player decides what each squad contains.

Unit archetypes retain their differentiated jobs:

- Vanguard / Spear Guard — frontline;
- Ranger — ranged pressure;
- Scout — reconnaissance;
- Elementalist — elemental combat authority;
- Engineer — repair / engineering support;
- Golem — heavy frontline;
- Siege Construct — structure pressure.

The long-term interface may provide simple preset squad templates plus advanced composition editing. The first prototype may reuse existing units without a full squad-builder UI.

### 4.3 How — Doctrine

Doctrine is a later strategic layer that changes how a squad or army interprets its mission.

The baseline concept is preset-first:

- Balanced;
- Aggressive;
- Defensive;
- elemental presets such as Storm / Frost / Wildfire only after the underlying behavior is proven.

New players must never be required to construct automation rules.

An Advanced Doctrine editor is explicitly deferred. If it is ever added, it should expose only a small number of high-value priorities rather than a general scripting language.

### 4.4 When — Elemental Intervention

The player remains responsible for decisive elemental actions.

Routine elemental basic attacks and status application may be automatic, but the player chooses when and where important elemental intervention happens.

This preserves the defining gameplay identity:

- Water creates Wet conditions or changes terrain state;
- Ice controls movement and can freeze water;
- Lightning exploits conductivity and Wet targets;
- Fire changes vegetation, heat, smoke, and terrain risk.

Elemental play must become easier to access, not more automated to the point of invisibility.

---

## 5. Squad model

### 5.1 First-slice squad authority

A squad is a persistent player-facing grouping of existing combat entities.

The initial implementation should favor a thin orchestration layer over creating a second combat simulation.

A squad should own:

- stable squad ID;
- member entity IDs;
- current Front Order;
- target region / point / objective;
- regroup destination when applicable;
- optional later doctrine ID.

Existing entity-level movement, combat, pathfinding, XP, health, elemental state, and animation remain authoritative.

### 5.2 Advance behavior

Advance means:

1. travel toward the assigned destination;
2. use normal autonomous combat behavior against relevant local threats;
3. resume the mission after local combat;
4. stop or transition into local control behavior when the objective is reached;
5. never require repeated MOVE / ATTACK_MOVE orders from the player.

Advance is not blind forced movement.

### 5.3 Guard behavior

Guard means:

1. remain within a bounded defense envelope around the assigned location;
2. engage threats entering that envelope;
3. pursue only within a bounded leash;
4. return to the guard location after combat;
5. avoid converting into an uncontrolled cross-map chase.

### 5.4 Regroup behavior

Regroup means:

1. disengage from ordinary local combat where legal;
2. travel toward a safe supplied recovery point;
3. use existing Core recovery and later Outpost support where applicable;
4. restore squad organization;
5. become eligible for reinforcement only in a safe/supplied state.

Regroup is a meaningful player decision, not a hidden low-HP automation.

The player must be able to choose to keep a damaged squad in the field.

---

## 6. Element system redesign

### 6.1 Problem

Current Tactical casting exposes the implementation detail of caster selection to the player.

The current authoritative system already supports:

- Elemental Attunements;
- aligned Elementalists;
- semantic `CAST_TACTICAL` commands;
- caster-local cooldowns;
- deterministic caster selection;
- spell range and target validation.

Phase 5 should use those systems to remove selection friction rather than replace Elementalist authority.

### 6.2 Global Element Bar

Command Mode should expose attuned Tactical elements from a persistent battlefield control.

Target interaction:

```text
choose available spell
→ choose battlefield target
→ simulation resolves a legal aligned caster
→ cast or return a clear failure reason
```

The player must not need to select the Elementalist entity first.

### 6.3 Caster authority remains meaningful

Elementalists are not reduced to cosmetic amplifiers.

A Tactical spell still requires an eligible aligned Elementalist unless a future spell explicitly defines another authority source.

Caster position, range, cooldown, survival, and alignment therefore remain strategically meaningful.

The difference is that the simulation resolves the caster from eligible player units rather than requiring the player to manually select it.

### 6.4 Deterministic automatic caster resolution

For a requested Tactical cast, the simulation should deterministically choose among eligible aligned casters using a documented stable rule.

Candidate factors may include:

1. target legality and range;
2. spell cooldown readiness;
3. stable distance ordering;
4. EntityID tie-break.

UI selection order must not affect the result.

Invalid cast attempts must not consume Mana or cooldown.

### 6.5 Strategic spells

Strategic spells already use network/anchor authority and should remain separate from local Tactical casting.

Phase 5 should simplify their targeting UI where useful but not merge Tactical and Strategic authority into one hidden system.

---

## 7. Resource-site redesign

### 7.1 Problem

The current Extractor / Mana Well loop adds construction actions but relatively little strategic choice after control of the resource location has already been established.

### 7.2 First-slice rule

In Command Mode:

- securing an eligible Material resource site begins baseline Material production automatically;
- securing an eligible Mana site begins baseline Mana production automatically;
- the player does not need to place an Extractor or Mana Well merely to activate baseline income.

Material and Mana remain separate strategic resources.

Influence also remains unchanged in the first prototype.

### 7.3 Development choice — later slice

After the automatic-site prototype is proven, a controlled resource site may offer a simple development choice such as:

- **Exploit** — higher throughput, higher strategic exposure / threat;
- **Fortify** — lower throughput, stronger local defense / recovery / reinforcement utility.

Exact values and threat semantics are deferred until the basic automatic-site loop is playable.

### 7.4 Existing structures

Do not delete Extractor / Mana Well implementation immediately.

Classic Mode and historical replay paths may continue using them.

Command Mode may initially bypass manual construction while reusing their resource accounting and site ownership logic where practical.

---

## 8. Buildings and territorial development

Phase 5 should reduce free-placement burden without erasing the visual identity of a growing base.

Long-term direction:

- Elemental Core remains a physical structure;
- Outposts remain the primary territorial/supply nodes;
- Barracks, Arcane Tower, and Workshop remain recognizable structures;
- Command Mode may attach development choices to Core/Outpost sites and place resulting production structures into deterministic local slots.

Example:

```text
secure expansion
→ choose Military / Arcane / Engineering development
→ structure appears in a valid deterministic local slot
```

This is preferable to turning every building into an invisible menu modifier.

This development-slot system is not part of the first prototype.

---

## 9. Production and reinforcement

### 9.1 Preserve veteran value

Automatic reinforcement must not make combat losses invisible.

A damaged squad may continue operating below full strength.

Replacement units should normally arrive only when the player chooses Regroup or the squad is otherwise safely supplied.

### 9.2 Veteran progression

Existing Level 1–5 XP progression remains valuable and should become more visible under Command Mode.

The intended decision is:

> press the advantage with a damaged veteran squad, or regroup and preserve it?

Replacement units still enter at baseline progression unless a later upgrade explicitly changes this.

### 9.3 Auto Reinforce

A later optional Auto Reinforce setting may fill missing squad slots when the squad is safely regrouped and resources permit.

It must not silently replace casualties in active combat.

---

## 10. Camera and battlefield awareness

### 10.1 Event Navigator

The player should not need to continuously search the map for important events.

Add a compact event list for events such as:

- battle started;
- guarded front under attack;
- Outpost threatened;
- Shrine secured;
- neutral camp cleared;
- veteran critically damaged;
- major objective exposed.

Selecting an event smoothly focuses the camera on that location.

### 10.2 No forced camera jumps

Command Mode must not automatically steal the camera during normal play.

A separate optional **Cinematic Follow** mode may track important action only when explicitly enabled.

### 10.3 Minimap

The existing minimap remains important as a strategic command surface.

Future Command Mode work should favor region/front selection from the minimap rather than requiring precise world-space clicks for every order.

---

## 11. Time controls and accessibility

Single-player Command Mode should support:

- Pause;
- 1×;
- 2×.

Optional pause triggers may later include:

- upgrade choice;
- major attack;
- veteran critical state.

Simulation speed controls must preserve deterministic gameplay outcomes for the same command timeline.

Score systems must not reward real-world input speed if Pause is available.

Tower Defense and challenge-specific policy can be decided separately.

---

## 12. Formation and micro-control policy

Existing Line / Column / Spread formation systems remain implemented and valid.

In Command Mode they should not be required baseline interactions.

Long-term direction:

- **Auto / Balanced** is the default;
- squad AI may choose suitable spatial behavior based on route width, chokepoints, composition, and local threat;
- explicit Line / Column / Spread remain available as advanced overrides where useful.

Do not delete existing formation authority.

Classic Mode continues to expose direct formation control.

---

## 13. Mode policy

### Command Mode

The Phase 5 product direction:

- squad-level intent;
- lower APM;
- automated routine execution;
- direct elemental intervention;
- resource sites with reduced construction friction;
- event-driven camera navigation;
- veteran preservation.

### Classic Mode

The current direct-control RTS behavior:

- direct unit selection;
- MOVE / ATTACK / ATTACK_MOVE / HOLD / STOP;
- explicit formations;
- existing building/production interactions;
- current resource-structure behavior unless intentionally migrated later.

Classic Mode is not deprecated during the prototype.

The project should avoid maintaining two fully divergent simulations. Mode differences should be expressed through command/orchestration rules over shared authoritative systems whenever possible.

---

## 14. Initial playable prototype — P5-A

P5-A is deliberately small.

Implement only:

1. persistent squads with **Advance / Guard / Regroup**;
2. Tactical casting from a global element control without manually selecting the Elementalist;
3. Command Mode automatic activation of controlled Material / Mana resource sites without manual Extractor / Mana Well placement;
4. Event Navigator entries that focus the camera on important fronts/events.

Do not implement in P5-A:

- Doctrine editor;
- complex preset Doctrine behavior;
- automatic formation selection;
- Outpost development slots;
- full squad-template editor;
- advanced auto reinforcement;
- new units;
- new elements;
- new world generator;
- large visual overhaul;
- multiplayer;
- worker economy.

---

## 15. P5-A acceptance questions

The prototype should be evaluated primarily by playtest.

It succeeds only if the answers are mostly yes:

1. Can a first-time player make progress using only Advance / Guard / Regroup plus elemental intervention?
2. Does the player spend less time selecting individual units and moving the camera?
3. Are there still frequent meaningful decisions?
4. Is watching squads execute orders interesting rather than passive?
5. Does the player care when a veteran squad is damaged and decide whether to Regroup?
6. Are Fire / Water / Ice / Lightning easier to use than in v24?
7. Does Elementalist positioning still matter even though caster selection is automatic?
8. Do automatic resource sites remove busywork without removing territorial conflict?
9. Can the player understand why a squad is doing what it is doing?
10. Can the player override or redirect a bad plan quickly?

If the dominant playtest impression is "the AI is playing for me," Phase 5 must increase player-facing decisions before expanding automation.

---

## 16. Implementation principles

### 16.1 Preserve shared simulation

Prefer:

```text
Player Front Order
→ deterministic squad/orchestration layer
→ existing entity commands / combat / navigation
```

over a second autonomous combat engine.

### 16.2 Determinism

Any squad mission, automatic caster selection, resource-site activation, or reinforcement state that changes gameplay must be:

- authoritative;
- deterministic;
- replay-recorded or deterministically derived from recorded commands/state;
- state-hashed where appropriate.

### 16.3 Versioning

Documentation-only adoption of this plan did **not** change gameplay/replay identity. The pre-implementation baseline was:

- `ef-standard-v24`;
- `ef-replay-v24`;
- `m02-standard-v1`.

P5-A1 first merged under `ef-standard-v25` / `ef-replay-v25`. The multi-squad roster refinement advances the current gameplay/replay identity to:

- `ef-standard-v26`;
- `ef-replay-v26`;
- world generation remains `m02-standard-v1`.

### 16.4 World generation

Do not modify `m02-standard-v1` for P5-A.

Existing regions, routes, POIs, resource sites, camps, Shrines, objectives, and spawn rules should be reused.

---

## 17. Recommended implementation sequence

### P5-A1 — Squad order foundation — IMPLEMENTED / PLAYTEST GATE

Implemented initially under `ef-standard-v25` / `ef-replay-v25` and refined under `ef-standard-v26` / `ef-replay-v26`; P5-A2 remains intentionally unstarted until playtest.

- persistent squad state;
- squad creation from existing starting army;
- deterministic additional squads for later trained player units, with six-member forming rosters that lock on first Front Order, direct Classic control, full capacity, or casualty;
- no casualty replacement into locked squads; later recruits create the next squad instead;
- Advance;
- Guard;
- Regroup;
- compact squad status UI;
- replay/hash coverage.

### P5-A2 — Element access simplification

- persistent global Tactical element controls;
- deterministic eligible-caster search;
- clear range/cooldown/no-caster feedback;
- no manual Elementalist selection requirement;
- preserve Mana and caster-local cooldown semantics.

### P5-A3 — Resource-site activation

- Command Mode site ownership drives baseline income;
- manual resource-building placement bypassed in Command Mode;
- supply/disconnection semantics adapted coherently;
- Classic behavior preserved.

### P5-A4 — Event Navigator

- battle/front/objective event feed;
- click/tap to smooth camera focus;
- no forced camera stealing;
- presentation-only where possible.

### P5-A5 — Playtest and decision gate

Do not automatically continue into P5-B.

Run a real playable evaluation first.

Decision:

- **CONTINUE** — autonomous execution feels better and still leaves meaningful decisions;
- **REVISE** — too passive or unclear; adjust Front Orders / element access / resource loop;
- **STOP** — retain useful simplifications but do not convert the primary mode.

---

## 18. Deferred P5-B possibilities

Only after P5-A passes:

- preset Doctrines;
- automatic formation selection;
- deterministic Outpost development slots;
- squad templates;
- safe-zone Auto Reinforce;
- Resource Site Exploit / Fortify choice;
- broader Event Navigator;
- Pause / 1× / 2×;
- Command Mode pacing and finale rebalance.

These are possibilities, not approved implementation scope.

---

## 19. Reuse map

Existing systems should be reused as follows:

| Existing system | Phase 5 role |
| --- | --- |
| Unit MOVE / ATTACK / ATTACK_MOVE / HOLD / STOP | low-level execution primitives |
| Formations | advanced override / future auto-formation input |
| Enemy War tactical behavior | reference and reusable autonomous-combat patterns |
| Fire / Water / Ice / Lightning simulation | primary distinguishing gameplay |
| Elemental Attunements | preserved |
| Elementalist alignment/cooldowns | preserved caster authority |
| Neutral Camps | autonomous expedition encounters / veteran progression |
| POI auto securing | retained low-friction territory behavior |
| Level 1–5 XP | veteran preservation layer |
| Core recovery | Regroup destination / recovery loop |
| Material / Mana / Influence | retained for first prototype |
| Extractor / Mana Well | Classic compatibility; Command baseline activation bypass |
| Outposts / supply | territorial backbone |
| Barracks / Arcane Tower / Workshop | retained; later slot-based development candidate |
| Tower Defense | separate existing mode |
| Replay / state hash | preserved and extended |
| Block Challenge | preserved; Command scoring policy deferred |
| Unit animation / visual assets | preserved |

---

## 20. UX target

A new player should be able to understand the basic loop without memorizing RTS hotkeys:

```text
Observe
→ select a squad
→ Advance / Guard / Regroup
→ watch the front develop
→ intervene with elements
→ secure a site / camp / Shrine
→ choose upgrades
→ preserve veterans
→ redirect fronts
→ reach the final objective
```

The game may retain depth for experienced players, but mastery should come primarily from better decisions, composition, timing, terrain understanding, and elemental combinations rather than faster selection mechanics.

---

## 21. Design gate

Phase 5 is now the active product-design direction.

However, only P5-A is approved as the next implementation experiment.

Do not treat deferred P5-B ideas as requirements.

Do not remove Classic Mode or historical systems until P5-A playtesting demonstrates that the Command Mode loop is clearly stronger.
