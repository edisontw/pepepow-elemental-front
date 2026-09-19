# PEPEPOW Elemental Front — Post-Roadmap Phase 4 Hero-Lite Progression Plan

**Status:** ACTIVE — P4-A/P4-B/P4-C complete; P4-D Veteran Presentation complete; P4-E next  
**World generation:** `m02-standard-v1` remains unchanged  
**Gameplay identity:** `ef-standard-v6`  
**Replay identity:** `ef-replay-v6`

## 1. Direction

Phase 4 keeps Elemental Front an RTS, but gives individual units stronger persistence and progression.

The target is **MOBA-like unit readability and growth inside an RTS army-control game**, not a direct clone of any existing MOBA.

The player should care whether a veteran Vanguard, Ranger, Elementalist, or Golem survives. Small groups should be able to explore, clear neutral threats, gain experience, recover at the Core, and return to the frontline stronger.

The redesign must preserve:

- deterministic 10 Hz simulation;
- command-stream replay;
- procedural battlefield identity;
- territory, supply, formations, elemental terrain interactions, and army control;
- browser-first performance.

## 2. Phase 4 priorities

Implementation order:

1. **Core combat correction**
2. **Core recovery / regroup loop**
3. **Neutral monster and camp combat**
4. **Individual unit XP and levels**
5. **Veteran readability / UI**
6. **Visual mood and battlefield presentation**
7. **Balance and replay migration validation**

Do not implement all progression systems in one unvalidated step.

## 3. Core combat correction

### Required rule

Proximity alone must never damage an Elemental Core.

A Core loses health only when:

1. the unit has an explicit objective-attack order;
2. the unit is inside its legal attack range;
3. its normal authoritative attack cycle reaches the damage event.

Right-clicking an enemy Core should issue the objective-attack order.

Normal MOVE near a Core must remain movement only.

Enemy AI must use the same semantic objective attack rather than receiving hidden proximity damage privileges.

Attack animation and facing should derive from the same authoritative attack event.

## 4. Core recovery

The friendly Elemental Core becomes the army's recovery point.

Baseline first-slice behavior:

- friendly living units within **8 m** of an active Core may recover health;
- baseline recovery: **2% max HP / second**;
- a unit does not heal while actively attacking;
- a unit does not heal while currently targeted by a hostile unit;
- destroyed or critical Core state disables the normal recovery aura;
- no resurrection;
- the Core itself does not gain unlimited passive regeneration; Engineer repair / critical recovery remain separate mechanics.

This creates a readable loop:

```
fight → disengage → return to Core → recover → redeploy
```

Later balancing may add an out-of-combat delay if immediate recovery proves too strong.

## 5. Hero-lite unit progression

Every normal combat unit can become a veteran.

### Level structure

Initial target:

- Level 1–5
- newly trained units start at Level 1
- level is individual, not shared globally

Avoid an 18-level MOBA-style grind. RTS armies need progression that is readable without excessive micro.

### XP sources

Preferred XP sources:

- neutral monster / camp kills;
- enemy combat-unit kills;
- assists / nearby participation;
- boss damage or boss defeat;
- selected strategic objectives.

Do not require last-hit micro. XP should be shared among nearby eligible friendly units so army positioning matters more than animation timing.

### Initial stat-growth target

Use modest deterministic integer scaling.

Provisional per level above Level 1:

- Max HP: approximately +6%
- Attack damage: approximately +4%
- optional role-specific secondary improvement later

Avoid multiplicative runaway scaling.

Level-up may restore a small amount of current HP for feedback, but must not become an emergency full heal.

### Veteran identity

Higher-level units should gain low-cost visual recognition:

- level pips / small badge;
- slightly stronger team-color trim;
- optional subtle veteran accent;
- no large glowing aura that destroys battlefield readability.

## 6. Neutral monsters and camps

Phase 4 introduces repeatable combat outside the main faction war.

Neutral encounters should use generated-world POIs / camp-capable regions where possible rather than requiring a second unrelated world generator.

Target encounter families:

- light roaming creatures;
- guarded camps;
- elemental creatures tied to biome / terrain;
- elite neutral encounters later in the run.

Rewards may include:

- XP;
- small Material rewards;
- Influence;
- temporary or shrine-related opportunities.

Neutral camps should create reasons to explore and split forces without replacing territory warfare.

## 7. Army design after progression

The intended player relationship changes from disposable anonymous mass units toward:

- small-to-medium combined-arms squads;
- several valuable veteran units;
- replaceable recruits supporting experienced survivors;
- retreat and recovery as legitimate tactical choices.

Population remains bounded. The target is not hundreds of disposable units.

Formation control stays important, but veteran survival should add another strategic layer.

## 8. Visual direction reset

The current bright, washed-out presentation is not the target.

Phase 4 visual direction:

**dark stylized battlefield + strong silhouettes + restrained magical highlights**

Avoid:

- broad white emissive surfaces;
- uniformly bright green terrain;
- washed-out "heaven" lighting;
- flat early-2000s RTS material response;
- excessive glow on ordinary units;
- low-contrast unit/background separation.

Prefer:

- deeper grass and soil midtones;
- cooler, darker distance / fog values;
- localized warm light near structures;
- clear material separation between steel, cloth, wood, stone, soil, water, and magic;
- stronger contact shadows;
- restrained elemental glow;
- high-contrast silhouettes at normal RTS zoom;
- environment variation around camps, ruins, settlements, and biome transitions.

Use modern MOBA/RTS readability as a quality reference, not as a source for copied characters, maps, or assets.

## 9. Animation and asset loading

Animated impostors remain the standard combat-unit representation.

Loading policy:

1. first paint loads one direction-correct Idle preview frame per view;
2. Move / Attack / Hit / Death are prioritized;
3. full Idle animation is cosmetic and deferred;
4. distant, hidden, or never-used actions should not block interaction;
5. future atlas packing should reduce HTTP request count.

Idle animation should feel intermittent rather than mechanically looping forever.

Possible later behavior:

- long static holds;
- occasional breathing / weight-shift sequence;
- rare deterministic presentation-only flourish;
- lower animation sampling for distant units.

Presentation randomness must never affect simulation RNG.

## 10. UI implications

Selected-unit UI should eventually expose:

- unit name / archetype;
- Level;
- XP progress;
- HP;
- attack / range;
- current order;
- recovery status when inside Core healing radius.

Group selection should summarize veteran composition without listing every unit.

Example:

```
6 Units
2 × Lv3
3 × Lv2
1 × Lv1
```

## 11. Determinism and replay

Phase 4 changes authoritative combat, recovery, neutral-encounter, and progression semantics.

Version history inside Phase 4:

- P4-A Core combat / recovery shipped as `ef-standard-v4` / `ef-replay-v4`;
- P4-B Neutral Camps / XP Foundation shipped as `ef-standard-v5` / `ef-replay-v5`;
- P4-C Unit XP / Level 1–5 advances to `ef-standard-v6` / `ef-replay-v6`;
- world generation remains `m02-standard-v1`;
- XP, level, objective-attack intent, and any future neutral-monster state must be deterministic and hash-covered;
- presentation-only idle timing does not enter gameplay state.

## 12. Implementation slices

### P4-A — Core Combat + Recovery

- explicit Core attack order;
- no proximity-only Core damage;
- normal attack cadence drives Core damage;
- attack presentation faces the Core;
- Core recovery aura for safe friendly units;
- v4 gameplay/replay identity;
- targeted tests.

### P4-B — Neutral Encounter Foundation — COMPLETE

Implemented foundation:

- neutral faction uses player ID 2;
- all 5 existing generated `NEUTRAL_CAMP` POIs activate without changing world generation;
- each camp spawns two deterministic Ancient Sentinel guardians using the existing Golem art path;
- guards participate in normal combat and are attackable by right-click;
- 12 m camp leash prevents cross-map pursuit;
- camp capture remains locked until all guardians are defeated;
- each cleared camp grants 120 XP shared deterministically among nearby local participants within 14 m;
- XP is stored per unit now; Level 1–5 conversion is deferred to P4-C;
- camp state, unit XP, and camp membership are state-hashed and replay-relevant;
- guarded / cleared camp state is shown in the POI capture UI.

### P4-C — Unit XP / Level 1–5 — ACTIVE

Implemented foundation:

- all ordinary player/enemy combat units begin at Level 1;
- cumulative thresholds: Lv2 60 XP, Lv3 150 XP, Lv4 280 XP, Lv5 450 XP;
- normal combat-unit kills grant shared XP to nearby same-faction participants; the final hitter receives no exclusive reward;
- combat-kill XP is threat-weighted from the defeated archetype population cost;
- Neutral Sentinels remain camp-reward-only to avoid double dipping with the 120 XP clear reward;
- Max HP grows linearly by approximately 6% per level above Level 1;
- Attack Damage grows linearly by approximately 4% per level above Level 1;
- growth always derives from stored base stats, avoiding multiplicative runaway scaling;
- level-up restores only the added Max-HP delta;
- Level 5 caps XP at 450;
- unit snapshots expose Level; XP/base progression data are state-hashed and replay-relevant;
- selected-unit UI shows Level and XP progress; group selection summarizes counts by veteran level.

### P4-D — Veteran Presentation — COMPLETE

Implemented:

- Lv2–5 units show one to four small veteran pips above their health bar;
- Lv3+ player/enemy veterans gain a low-opacity brass ring, intentionally avoiding a large permanent aura;
- a level increase triggers one short muted-gold burst plus a brief pip pulse;
- Neutral Sentinels receive a distinct amber threat ring separate from enemy-team red;
- guarded Neutral Camps receive an amber guard seal/beacon that disappears once cleared;
- POI hover text reports remaining Sentinels while guarded and XP/capture availability after clearing;
- this slice changes presentation only and does not alter simulation, XP thresholds, stats, replay, or world generation;
- gameplay/replay identity therefore remains `ef-standard-v6` / `ef-replay-v6`.

### P4-E — Balance / Run Integration

Validate:

- snowball risk;
- retreat usefulness;
- Core-heal abuse;
- neutral-camp reward pacing;
- veteran replacement cost;
- run duration;
- boss/finale interaction;
- replay determinism.

## 13. Acceptance principles

Phase 4 is successful when:

1. moving near a Core does not damage it;
2. a visible attack event is required for Core damage;
3. retreating damaged units to the Core has clear tactical value;
4. neutral fights create meaningful optional risk/reward;
5. veteran units feel worth preserving;
6. progression does not overwhelm RTS army control;
7. the battlefield no longer reads as washed-out or visually flat;
8. deterministic replay remains reproducible.
