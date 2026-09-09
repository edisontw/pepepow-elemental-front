# PEPEPOW Elemental Front — Post-Roadmap Phase 1 Implementation Contract

**Status:** FROZEN IMPLEMENTATION CONTRACT  
**Scope:** Attunement, Elementalist alignment, Tactical / Strategic spell authority, target tags, gameplay ruleset identity  
**Runtime authority:** NOT ACTIVE until Phase 2 code/data/tests adopt this contract  
**Supersedes for the redesign implementation:** ambiguous portions of `POST_ROADMAP_GAMEPLAY_REDESIGN_SPEC.md` only; CLOSED M00–M08 runtime remains `m08-standard-v1` until Phase 2 lands.

---

## 1. Frozen decisions

1. A standard run starts with **exactly two distinct Elemental Attunements**.
2. Elements are `FIRE`, `WATER`, `ICE`, `LIGHTNING`.
3. Attunement is authoritative per-player run state. It is not a stockpile resource.
4. A fielded `ELEMENTALIST` has exactly one immutable elemental alignment.
5. Elementalist alignment is chosen in the `TRAIN` command and must be currently Attuned.
6. Each alignment owns one core Tactical spell.
7. Tactical spells require a valid local aligned Elementalist; one cast spends one Mana cost and uses one deterministic caster.
8. Strategic spells are player-level powers delivered through a valid spell-network anchor; their cooldown is per player + spell, not per anchor.
9. `MANA_BEACON` is the upgraded Outpost specialization that acts as the initial Outpost Strategic relay. No new Outpost specialization is required for Phase 2.
10. Direct Tactical damage/control is ally-safe by default; persistent terrain/environment consequences remain faction-agnostic.
11. Static combat-role tags and dynamic status/environment tags are separate concepts.
12. The first authoritative redesign ruleset version is **`ef-standard-v2`**.
13. World generation remains **`m02-standard-v1`**.
14. Existing legacy `CAST` semantics remain available only for closed-system regression and internal/boss effects during migration; player-facing v2 casts use new semantic spell commands.

---

## 2. Core shared types

Recommended canonical TypeScript shape:

```ts
export const ELEMENT_IDS = ['FIRE', 'WATER', 'ICE', 'LIGHTNING'] as const;
export type ElementId = typeof ELEMENT_IDS[number];

export type TacticalSpellId =
  | 'FIREBOLT'
  | 'WATER_BURST'
  | 'FREEZE'
  | 'CHAIN_LIGHTNING';

export type StrategicSpellId =
  | 'INFERNO'
  | 'DELUGE'
  | 'BLIZZARD'
  | 'THUNDERSTORM';

export type SpellId = TacticalSpellId | StrategicSpellId;
export type SpellLayer = 'TACTICAL' | 'STRATEGIC';

export type StaticTargetTag =
  | 'LIGHT'
  | 'HEAVY'
  | 'METAL'
  | 'RANGED'
  | 'ELEMENTAL'
  | 'BUILDING'
  | 'FORTIFIED'
  | 'ARCANE'
  | 'SUPPORT'
  | 'SIEGE';

export type DynamicTargetTag =
  | 'WET'
  | 'CHILLED'
  | 'FROZEN'
  | 'BURNING'
  | 'CONDUCTIVE';

export type TargetTag = StaticTargetTag | DynamicTargetTag;

export type SpellTarget =
  | { kind: 'POINT'; x: number; z: number }
  | { kind: 'ENTITY'; entityId: EntityID };
```

All coordinate values entering authoritative commands are normalized to safe integers in simulation world units.

---

## 3. Attunement state

### 3.1 State shape

```ts
export interface PlayerAttunementState {
  playerId: PlayerID;
  starting: readonly [ElementId, ElementId];
  unlocked: readonly ElementId[];
}
```

Rules:

- `starting` contains exactly two distinct values.
- `unlocked` is unique and stored in canonical element order: `FIRE`, `WATER`, `ICE`, `LIGHTNING`.
- the two starting elements are always members of `unlocked`;
- standard opening count = 2;
- normal mid-run cap = 3;
- absolute representable cap = 4;
- a fourth Attunement requires an explicitly tagged exceptional reward; it is never granted by ordinary progression;
- Attunement has no rank field. “Deepen an Attunement” is represented by Shrine/modifier upgrades, not by a parallel hidden rank system.

### 3.2 Run-start ownership

The player chooses the starting pair **before simulation tick 1**. This is run setup, not a combat command.

The pair is recorded in the replay header so replay construction can recreate identical initial state. It does **not** become part of the Block Challenge code: different legal Attunement choices are strategic choices within the same block/ruleset challenge.

Enemy players use the same state shape and may not receive implicit all-element access. Enemy starting Attunements must be selected by deterministic faction/loadout rules when Phase 2 implements AI use of the system.

### 3.3 Shrine eligibility

For Shrine/upgrades:

- a pure-element upgrade is eligible only if its element is Attuned;
- a `MIXED` upgrade is eligible only if **all non-`MIXED` element tags** on that upgrade are Attuned;
- a future third-element unlock must use an explicit unlock reward/effect rather than silently adding an element because an upgrade mentions it;
- existing Material / Mana / Influence economy remains unchanged.

---

## 4. Elementalist alignment

### 4.1 Entity component

Keep one `UnitArchetype` value: `ELEMENTALIST`.

Add composition rather than four inherited archetypes:

```ts
export interface ElementalAlignmentComponent {
  element: ElementId;
}
```

Rules:

- required for every completed `ELEMENTALIST`;
- absent for non-Elementalists;
- immutable for the lifetime of the unit under `ef-standard-v2`;
- hashed and replay-critical.

### 4.2 Training command

Extend training semantically:

```ts
export interface TrainCommand extends StrategicCommandBase {
  type: 'TRAIN';
  buildingId: number;
  unitType: UnitArchetype;
  elementalistAlignment?: ElementId;
}
```

Validation:

- `ELEMENTALIST` requires `elementalistAlignment`;
- non-Elementalist units reject `elementalistAlignment`;
- the producing building must still be a valid completed `ARCANE_TOWER`;
- the requested alignment must exist in the training player's current Attunements at command execution time;
- the production order stores the alignment so delayed completion cannot lose the original legal choice;
- alignment is written to the spawned entity at production completion.

### 4.3 Alignment package

| Alignment | Basic-attack secondary identity | Tactical spell |
| --- | --- | --- |
| `FIRE` | Burn pressure | `FIREBOLT` |
| `WATER` | Wet setup | `WATER_BURST` |
| `ICE` | Chill / slow | `FREEZE` |
| `LIGHTNING` | small conductivity-aware chain/disruption | `CHAIN_LIGHTNING` |

The basic attack remains lower-value than the signature Tactical spell and must not turn Elementalists into primary conventional DPS units.

---

## 5. Static target-tag assignment

Tags are data attached to archetype/building definitions and derived at runtime. Do not duplicate immutable tag arrays per entity unless profiling later justifies it.

### 5.1 Units

| Unit | Static tags |
| --- | --- |
| `VANGUARD` | `LIGHT` |
| `SPEAR_GUARD` | `LIGHT` |
| `RANGER` | `LIGHT`, `RANGED` |
| `SCOUT` | `LIGHT`, `RANGED`, `SUPPORT` |
| `ELEMENTALIST` | `LIGHT`, `RANGED`, `ELEMENTAL`, `ARCANE`, `SUPPORT` |
| `ENGINEER` | `LIGHT`, `SUPPORT` |
| `GOLEM` | `HEAVY`, `METAL` |
| `SIEGE_CONSTRUCT` | `HEAVY`, `METAL`, `RANGED`, `SIEGE` |

`LIGHT` and `HEAVY` are mutually exclusive baseline mass classes.

### 5.2 Buildings

| Building/state | Static/derived tags |
| --- | --- |
| `ELEMENTAL_CORE` | `BUILDING`, `FORTIFIED`, `ARCANE` |
| `BARRACKS` | `BUILDING` |
| `ARCANE_TOWER` | `BUILDING`, `ARCANE` |
| `WORKSHOP` | `BUILDING` |
| `OUTPOST` | `BUILDING` |
| `OUTPOST + MANA_BEACON` | add `ARCANE` |
| `EXTRACTOR` | `BUILDING` |
| `MANA_WELL` | `BUILDING`, `ARCANE` |
| resource building with defense upgrade | add `FORTIFIED` |

### 5.3 Dynamic tags

- `WET`, `CHILLED`, `FROZEN`, `BURNING` derive from authoritative status state.
- `CONDUCTIVE` is derived, not stored as a free boolean. For v2 targeting/UI, treat effective conductivity `>= 700 / 1000` as `CONDUCTIVE`.
- `METAL` remains a static material identity even when the unit is dry.

Tags guide preferred jobs and modifiers. They do not create a hidden universal armor table.

---

## 6. Spell metadata schema

Use one data definition for legality/cost/cooldown/preview metadata while deterministic resolvers implement effect logic.

```ts
export type SpellTargetMode = 'POINT_AREA' | 'HOSTILE_ENTITY';
export type FactionPolicy = 'HOSTILE_ONLY' | 'ALL_FACTIONS';

export interface TacticalSpellDefinition {
  id: TacticalSpellId;
  layer: 'TACTICAL';
  element: ElementId;
  manaCostMilli: number;
  cooldownTicks: number;
  castRange: number;
  targetMode: SpellTargetMode;
  radius: number;
  impactFactionPolicy: FactionPolicy;
  persistentFactionPolicy: FactionPolicy;
  preferredTargetTags: readonly TargetTag[];
  preview: 'AREA' | 'AREA_WITH_TERRAIN' | 'CHAIN';
  resolver: TacticalSpellId;
}

export interface StrategicSpellDefinition {
  id: StrategicSpellId;
  layer: 'STRATEGIC';
  element: ElementId;
  manaCostMilli: number;
  cooldownTicks: number;
  durationTicks: number;
  radius: number;
  targetMode: 'POINT_AREA';
  persistentFactionPolicy: 'ALL_FACTIONS';
  preferredTargetTags: readonly TargetTag[];
  preview: 'AREA_WITH_TERRAIN';
  resolver: StrategicSpellId;
}
```

All distance/radius fields are stored in integer simulation world units using `WORLD_UNITS_PER_METER`.

---

## 7. Frozen Tactical metadata

The v2 starting numbers intentionally return to deliberate spell timing rather than the M08 debug-like key-spam cadence.

| Spell | Element | Mana | Cooldown | Range | Radius/target | Preferred targets |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `FIREBOLT` | Fire | 20 | 5 s / 50 ticks | 10 m | 2.5 m area | clustered/static positions; `SUPPORT`; terrain/ice denial |
| `WATER_BURST` | Water | 20 | 6 s / 60 ticks | 9 m | 3.5 m area | burning areas; `LIGHT`; setup zones |
| `FREEZE` | Ice | 25 | 7 s / 70 ticks | 9 m | 3.0 m area | `WET`; pursuit/retreat lanes; water cells |
| `CHAIN_LIGHTNING` | Lightning | 35 | 8 s / 80 ticks | 10 m to initial target | hostile entity; 4 additional jumps baseline | `WET`, `CONDUCTIVE`, `METAL`, `SUPPORT`, `ELEMENTAL` |

Effect baseline retained from the canonical design/current elemental implementation where compatible:

- `FIREBOLT`: 50 impact damage baseline; Burn pressure; terrain ignition/heat resolver.
- `WATER_BURST`: Wet application; extinguish; push hostile `LIGHT` units; current displacement baseline may remain 2 cells pending balance.
- `FREEZE`: strong cold; Chill/Freeze eligibility; water-to-ice transition.
- `CHAIN_LIGHTNING`: 55 base damage; conductivity-weighted deterministic chaining; Wet retains +25% damage and +50% jump-range baseline.

Direct Tactical damage/control is `HOSTILE_ONLY`. Terrain state created or changed by a cast subsequently affects all factions through normal environmental rules.

Cooldown authority is **per caster + Tactical spell**.

---

## 8. Frozen Strategic metadata

Each base Attunement has one Strategic spell so no starting element package is structurally incomplete.

| Spell | Element | Mana | Cooldown | Duration | Radius | Core identity |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `INFERNO` | Fire | 130 | 65 s / 650 ticks | 12 s / 120 ticks | 10 m | heat, ignition, smoke, denial |
| `DELUGE` | Water | 110 | 55 s / 550 ticks | 10 s / 100 ticks | 11 m | heavy Wet, extinguish, conductivity setup, repeated light displacement; no permanent new water topology |
| `BLIZZARD` | Ice | 120 | 60 s / 600 ticks | 12 s / 120 ticks | 10 m | cold accumulation, slow, water freeze, visibility pressure |
| `THUNDERSTORM` | Lightning | 140 | 70 s / 700 ticks | 10 s / 100 ticks | 12 m | periodic conductivity-weighted lightning pressure |

Strategic persistent area consequences use `ALL_FACTIONS` unless a future explicitly documented exception is introduced.

Cooldown authority is **per player + Strategic spell**. Changing or losing anchors does not reset the cooldown.

---

## 9. Strategic spell network

Valid v2 anchors:

```ts
export type StrategicAnchorClass =
  | 'ELEMENTAL_CORE'
  | 'ARCANE_TOWER'
  | 'MANA_BEACON_OUTPOST';
```

Initial network reach:

| Anchor | Reach |
| --- | ---: |
| Elemental Core | 24 m |
| Arcane Tower | 22 m |
| connected Outpost with `MANA_BEACON` | 18 m |

Anchor legality:

- owned by casting player;
- completed and not destroyed;
- Core is valid while active;
- Arcane Tower and Mana Beacon Outpost must be in a currently supplied region;
- the target point must be currently visible to the casting player;
- the target point must be inside at least one legal anchor's reach;
- the player must have the spell's element Attuned;
- sufficient shared Mana and completed cooldown are required.

Anchor selection is automatic and deterministic: among legal anchors covering the target, choose smallest squared distance to the target, then smallest building ID. The player does not micro-select a relay for ordinary casting.

---

## 10. New v2 spell commands

Keep existing legacy `CAST` for migration/internal regression only. Player-facing v2 uses:

```ts
export interface CastTacticalSpellCommand extends CommandBase {
  type: 'CAST_TACTICAL';
  spellId: TacticalSpellId;
  candidateCasterIds: readonly EntityID[];
  target: SpellTarget;
}

export interface CastStrategicSpellCommand extends CommandBase {
  type: 'CAST_STRATEGIC';
  spellId: StrategicSpellId;
  target: Extract<SpellTarget, { kind: 'POINT' }>;
}
```

Normalization:

- candidate caster IDs: unique, positive safe integers, ascending;
- point coordinates: rounded safe integers;
- entity target ID: positive safe integer;
- radius, Mana cost, cooldown and effect identity come from authoritative spell data, never from UI command payload.

This removes the current ability for a command to supply its own radius/effect parameters under v2 player semantics.

---

## 11. Deterministic Tactical caster selection

For `CAST_TACTICAL`:

1. filter `candidateCasterIds` to alive units owned by `playerId`;
2. require archetype `ELEMENTALIST`;
3. require alignment matching the spell element;
4. require spell element currently Attuned;
5. require that caster's spell cooldown is ready;
6. require target legality/visibility;
7. require target within cast range;
8. sort valid casters by squared distance to the target, then EntityID;
9. choose the first caster;
10. spend one Mana cost;
11. start only that caster's cooldown;
12. resolve one cast.

If no caster is valid, Mana is not spent and no cooldown changes.

This is authoritative simulation logic; UI selection order cannot affect the outcome.

---

## 12. Replay, hash and challenge identity

### Ruleset

```ts
export const CURRENT_CHALLENGE_RULESET_VERSION = 'ef-standard-v2' as const;
```

Do not change `M02_STANDARD_RULES.rulesetVersion`.

### Replay

The replay format must be bumped when v2 commands/state become authoritative:

```ts
version: 'ef-replay-v2'
startingAttunements: readonly [ElementId, ElementId]
```

Replay entries must preserve:

- aligned `TRAIN` commands;
- `CAST_TACTICAL`;
- `CAST_STRATEGIC`;
- future Attunement unlock decisions.

### Hashing

The authoritative hash chain must include at minimum:

- player Attunement sets;
- Elementalist alignment by entity ID;
- Tactical cooldown state by caster/spell;
- Strategic cooldown state by player/spell;
- any active Strategic spell persistent-zone state;
- existing terrain/status changes created by spell resolvers.

### Block Challenge

Block Challenge identity continues to bind block height + ruleset version. `ef-standard-v2` therefore creates a distinct competitive/challenge identity from `m08-standard-v1` without changing M02 world generation.

---

## 13. Phase 2 implementation file map

### New files recommended

- `src/simulation/element-types.ts` — `ElementId`, spell IDs, target tags.
- `src/simulation/attunement-state.ts` — per-player Attunement authority and eligibility helpers.
- `src/simulation/spell-content.ts` — Tactical/Strategic metadata and strategic anchor constants.
- `src/simulation/spell-state.ts` — cooldown state, legality helpers, deterministic caster/anchor selection.

### Existing files to change

- `src/challenge/ruleset.ts` — bump gameplay ruleset to `ef-standard-v2` only when Phase 2 authoritative semantics land.
- `src/simulation/components.ts` — alignment component/type integration and spawn contract.
- `src/simulation/entity-store.ts` — alignment map/component storage.
- `src/simulation/m03-content.ts` — static target tags on unit/building definitions.
- `src/simulation/m03-commands.ts` — aligned Elementalist `TRAIN` payload and validation.
- `src/simulation/strategic-state.ts` — production-order alignment persistence, strategic-anchor queries, spell-network validation hooks.
- `src/simulation/commands.ts` — add semantic v2 cast commands; retain legacy `CAST` for internal migration.
- `src/simulation/simulation.ts` — Tactical spell command resolution through alignment/Mana/cooldown legality rather than raw radius/effect payload.
- `src/simulation/m04-content.ts` / `roguelite-state.ts` — use shared `ElementId`; filter Shrine eligibility by Attunements; remove player authority from legacy direct spell metadata.
- `src/simulation/m05-*` — later AI call sites use the same legality model; no all-element cheat path.
- `src/simulation/m06-simulation.ts` — replay v2 header/entries and construction-time Attunement state.
- `src/simulation/state-hash.ts` plus higher-layer hashes — include alignment/Attunement/cooldown authority.
- `src/ui/mana-system-hud.ts` / `src/ui/strategic-panel.ts` — consume authoritative spell metadata and targeting legality; no gameplay constants in UI.
- rendering/audio bridges — consume semantic spell/alignment events only; presentation remains non-authoritative.

### Tests to add/change

- `tests/simulation/post-roadmap-attunement.test.ts`
- `tests/simulation/post-roadmap-elementalist-alignment.test.ts`
- `tests/simulation/post-roadmap-spell-authority.test.ts`
- `tests/simulation/post-roadmap-target-tags.test.ts`
- `tests/simulation/post-roadmap-spell-network.test.ts`
- replay determinism coverage for differing starting Attunement pairs and aligned training;
- challenge ruleset-identity test proving `ef-standard-v2 != m08-standard-v1` while worldgen stays `m02-standard-v1`;
- retain all CLOSED M00–M08 regression tests unless a changed assertion is explicitly caused by this contract.

---

## 14. Phase 2 minimum acceptance

Phase 2 is not complete until automated tests prove:

1. exactly two distinct starting Attunements are required;
2. non-Attuned Elementalist training is rejected;
3. trained Elementalists retain immutable alignment;
4. each alignment can cast only its mapped Tactical spell;
5. multi-caster selection is deterministic independent of selection order;
6. invalid casts spend no Mana and start no cooldown;
7. Tactical cooldown is caster-local;
8. Strategic cooldown is player-global per spell;
9. Strategic cast reach changes when a relay is destroyed/disconnected;
10. static/dynamic target tags resolve deterministically;
11. replay playback reproduces Attunement, alignment and spell outcomes exactly;
12. challenge/replay identity uses `ef-standard-v2`;
13. M02 Golden Blocks/world gameplay hashes remain unchanged;
14. all unaffected CLOSED-system regression tests pass.

---

## 15. Explicit non-goals for Phase 2

Do not combine the first implementation with:

- formation redesign;
- full unit balance rewrite;
- AI combo optimization beyond basic legality;
- fourth-element reward content;
- ultimate-spell redesign;
- final art/audio replacement;
- M02 world-generation changes.

Those remain later post-roadmap phases after the new elemental authority layer is deterministic and testable.
