# PEPEPOW Elemental Front — Post-Roadmap Phase 3 Army-Control Contract

**Status:** FROZEN IMPLEMENTATION CONTRACT  
**Scope:** formation movement, destination spacing, player formation selection, basic selection ergonomics, competitive identity  
**Runtime authority:** NOT ACTIVE until the Phase 3 implementation/tests land together  

---

## 1. Purpose

Phase 2 established elemental authority. Phase 3 now improves army control without turning the game into high-APM unit micromanagement.

The first authoritative Phase 3 slice focuses on **how a selected army moves as a group**. It does not perform a broad unit-stat rebalance and does not redesign world generation.

The design baseline remains:

- familiar RTS selection and contextual orders;
- formation meaning comes from spatial behavior, not hidden percentage bonuses;
- deterministic simulation owns movement targets;
- UI chooses a formation mode but never computes authoritative per-unit destinations.

---

## 2. Player-facing formation set

The first runtime set is:

```ts
export const FORMATION_IDS = ['LINE', 'COLUMN', 'SPREAD'] as const;
export type FormationId = typeof FORMATION_IDS[number];
```

### LINE

- wide frontage;
- default player formation;
- good for mixed armies and ranged firing lines;
- up to 8 slots per row before adding depth.

### COLUMN

- narrow footprint;
- intended for roads, bridges and chokepoints;
- one column for very small groups, otherwise two columns.

### SPREAD

- larger lateral and longitudinal separation;
- intended as counterplay to chain and area effects;
- occupies materially more terrain.

`GUARD` remains approved by the redesign spec but is **not** part of this first slice because it requires a persistent escort/follow relationship rather than a destination layout. It is a follow-up army-control command, not a hidden fourth move pattern.

---

## 3. MOVE command extension

Extend `MOVE` semantically:

```ts
export interface MoveCommand extends EntityCommandBase {
  type: 'MOVE';
  targetX: number;
  targetZ: number;
  formation?: FormationId;
}
```

Rules:

- player-facing right-click MOVE always supplies the currently selected formation;
- missing `formation` preserves the historical compact-grid behavior for closed-system regression/internal AI migration paths;
- formation IDs are normalized/validated by the authoritative command queue;
- UI never supplies individual slot coordinates;
- replay stores the semantic formation choice, not presentation-only geometry.

---

## 4. Deterministic orientation

Formation orientation is computed by simulation from:

1. normalized selected entity IDs;
2. integer group centroid at command execution time;
3. requested destination.

The forward direction uses one of eight deterministic compass bases. No free-running floating-point angle is stored in authoritative state.

Canonical basis scale = 1000:

- N `(0, 1000)`
- NE `(707, 707)`
- E `(1000, 0)`
- SE `(707, -707)`
- S `(0, -1000)`
- SW `(-707, -707)`
- W `(-1000, 0)`
- NW `(-707, 707)`

Dominant-axis classification is deterministic. If centroid equals target, default forward is North.

The perpendicular basis is `(-forwardZ, forwardX)`.

---

## 5. Formation dimensions

All spacing is integer simulation world units.

Initial values:

| Formation | Lateral spacing | Depth spacing | Width rule |
| --- | ---: | ---: | --- |
| LINE | 1.8 m | 1.8 m | up to 8 columns |
| COLUMN | 1.7 m | 1.8 m | 1 column for <=4, otherwise 2 |
| SPREAD | 3.2 m | 3.2 m | near-square grid |

These values intentionally exceed the common 1.4 m light-unit diameter and create visible formation differences without introducing hidden combat modifiers.

---

## 6. Role-aware slot assignment

Formation slot assignment is deterministic and uses **spatial role only**, not stat bonuses.

Priority groups:

### Front

- `GOLEM`
- `SPEAR_GUARD`
- `VANGUARD`

### Flex

- `SCOUT`

### Rear/support

- `RANGER`
- `ELEMENTALIST`
- `ENGINEER`
- `SIEGE_CONSTRUCT`

Within the same role class, order by EntityID.

Slots are ordered front-to-back and then center-out laterally. This keeps frontline mass toward the leading rows and vulnerable/support units toward rear rows while remaining deterministic.

This is not a hard combat lock: terrain/path resolution may alter final reachable cells.

---

## 7. Walkable unique destination slots

The old movement system can resolve several formation offsets to the same nearest walkable cell. Phase 3 must avoid avoidable end-position stacking.

For each desired slot in deterministic assignment order:

1. convert desired world point to a navigation cell;
2. clamp the starting cell to battlefield bounds;
3. breadth-first search in canonical navigation neighbor order;
4. choose the nearest walkable cell not already reserved by another slot in this command;
5. reserve that cell;
6. convert it back to a world target;
7. pathfind normally.

If no unique walkable cell exists, fall back to the normal walkable target resolver rather than rejecting the entire command.

Reservation applies only to destination planning for that MOVE command. It is not a persistent collision/occupancy system.

---

## 8. Player input / selection ergonomics in this slice

### Formation selection

Default player formation: `LINE`.

Keyboard bindings:

- `Z` — Line
- `C` — Column
- `V` — Spread

Changing formation mode does not itself move units. The next player MOVE command carries that formation.

### Control groups

Support `Ctrl+0..9` and `0..9` recall. Existing deterministic selection normalization remains unchanged.

### Double-click same-type selection

Double-clicking a controllable unit selects all **currently on-screen controllable units of the same archetype**.

Implementation may reuse the rendering bridge's full-screen box query and filter by authoritative archetype. It must not select hidden/enemy/off-screen units.

### Deferred from this first slice

- `A` Attack Move;
- `H` Hold;
- `Tab` subgroup cycling;
- persistent Guard relationships;
- drag-to-set explicit formation facing;
- local collision/separation steering during transit.

Those remain Phase 3 follow-up controls after destination formation movement is stable.

---

## 9. Replay and competitive identity

Formation movement changes authoritative command semantics and unit destinations. Therefore Phase 3 activates a new identity only when implementation/tests land together:

```ts
CURRENT_CHALLENGE_RULESET_VERSION = 'ef-standard-v3'
M06ReplayHeader.version = 'ef-replay-v3'
```

Unchanged:

- world-generation ruleset `m02-standard-v1`;
- M02 Golden Blocks and world gameplay hashes;
- Block Height deterministic input.

Existing historical/internal MOVE commands without a formation remain parseable inside the current codebase, but new player-generated replay commands under v3 carry an explicit formation.

---

## 10. State hash

No separate persistent Formation component is required for this first slice because a formation choice is resolved into normal authoritative movement targets/paths at command execution.

The existing entity movement/path state hash therefore captures the gameplay consequence.

If later Guard/follow or persistent stance state is added, that state must be hashed explicitly.

---

## 11. Implementation map

### New

- `src/simulation/formation.ts`
- `tests/simulation/post-roadmap-formation.test.ts`

### Change

- `src/simulation/commands.ts`
- `src/simulation/navigation.ts`
- `src/simulation/simulation.ts`
- `src/input/unit-controls.ts`
- `src/input/selection-state.ts`
- `src/challenge/ruleset.ts`
- `src/simulation/m06-simulation.ts`
- replay/challenge fixtures and assertions affected by the identity bump
- `docs/PROJECT_CONTEXT.md` only after closure

---

## 12. Minimum automated acceptance

Phase 3 first slice is not complete until tests prove:

1. LINE/COLUMN/SPREAD produce distinct deterministic destinations;
2. command input order does not change slot assignment;
3. replay of the same formation MOVE produces the same final hash;
4. role ordering places frontline classes ahead of rear/support classes when enough rows exist;
5. destination resolution avoids duplicate walkable cells when alternatives exist;
6. blocked formation slots resolve deterministically;
7. legacy MOVE without formation retains historical compact-grid behavior;
8. player MOVE commands carry the selected formation;
9. control group 0 works consistently with 1..9;
10. replay/challenge identity is `ef-standard-v3` / `ef-replay-v3`;
11. M02 world-generation ruleset remains `m02-standard-v1` and 2,048-seed regression passes;
12. unaffected CLOSED-system tests, strict TypeScript and production build pass.

---

## 13. Non-goals

Do not combine this slice with:

- broad unit-stat rebalance;
- formation percentage buffs/debuffs;
- new unit archetypes;
- advanced collision avoidance / flow fields;
- Tactical spell preview implementation;
- Strategic spell relay visualization;
- Guard follow state;
- final art/audio replacement;
- M02 world-generation changes.
