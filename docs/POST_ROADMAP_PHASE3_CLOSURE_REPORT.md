# PEPEPOW Elemental Front — Post-Roadmap Phase 3 Closure Report

**Phase:** Army control and formation movement  
**Status:** CLOSED — pending merge of PR #41  
**Implementation branch:** `phase3-army-control`  
**Validated implementation head:** `d46c12234967bb4e503696d6443d8d57873f2722`  
**Validation:** CI #208 / run `34374155010` — PASS

---

## 1. Scope completed

Phase 3 implements the first army-control slice from `POST_ROADMAP_GAMEPLAY_REDESIGN_SPEC.md` and the frozen `POST_ROADMAP_PHASE3_ARMY_CONTROL_CONTRACT.md`.

Implemented:

- semantic `LINE`, `COLUMN`, and `SPREAD` formation identity on player `MOVE` commands;
- deterministic formation orientation derived from the group centroid and destination;
- integer eight-direction formation basis rather than free-running authoritative angles;
- formation-specific lateral/depth spacing;
- deterministic spatial role ordering that puts frontline classes ahead of rear/support classes without hidden stat bonuses;
- unique walkable destination-cell reservation within each formation MOVE;
- deterministic blocked-slot resolution through canonical BFS neighbor order;
- historical MOVE commands without formation metadata retain the previous compact-grid behavior for regression/internal migration paths;
- player formation selection: `Z` Line, `C` Column, `V` Spread;
- player right-click MOVE commands carry the selected formation to simulation authority;
- control groups now support `0..9` consistently;
- double-clicking a controllable unit selects currently on-screen friendly units of the same archetype;
- `S` is now a Stop alias while `X` remains supported;
- control/help UI displays formation mode and current key bindings.

Explicitly not included in this slice:

- Attack Move;
- Hold position;
- subgroup cycling;
- persistent Guard/follow relations;
- drag-to-set formation facing;
- local collision/separation steering during transit.

---

## 2. Competitive identity

Phase 3 activates:

- gameplay/challenge ruleset: `ef-standard-v3`
- replay format: `ef-replay-v3`

Unchanged:

- world-generation ruleset: `m02-standard-v1`
- M02 Golden Blocks and world gameplay hashes
- Block Height as deterministic input
- Phase 2 Attunement / Elementalist / spell authority semantics

Replay v3 preserves semantic formation MOVE commands. Formation geometry itself is resolved at the authoritative execution tick from current entity state, so replays reproduce the same destinations and final hashes.

The existing Official Challenge ID `m08-roadmap` remains for link continuity while its active gameplay ruleset advances to `ef-standard-v3`.

---

## 3. Automated acceptance

Final validated implementation run:

- 52 test files PASS
- 221 tests PASS
- M02 2,048-seed regression PASS
- strict TypeScript PASS
- production Vite build PASS
- CI #208 / `34374155010` PASS

Dedicated Phase 3 coverage proves:

- Line / Column / Spread have distinct deterministic layouts;
- Spread has the intended larger overall footprint while Line retains the wider frontage identity;
- selected-entity input order cannot change slot assignment;
- destination cells are unique when alternatives exist;
- frontline role classes occupy leading rows before rear/support classes;
- blocked desired slots resolve deterministically;
- legacy MOVE retains historical compact-grid target resolution;
- semantic formation MOVE changes authoritative destinations;
- control group zero works with the existing normalized selection model;
- replay v3 records and replays formation MOVE to `MATCH`;
- `ef-standard-v3` remains separate from `m02-standard-v1` world generation.

All unaffected CLOSED M00–M08 and Phase 2 regression tests pass.

---

## 4. Architecture decision

Formation selection is semantic command metadata, not a persistent per-unit buff or presentation-owned offset list.

Simulation owns:

- orientation;
- role ordering;
- slot generation;
- walkable unique destination resolution;
- path assignment.

UI owns only the player's currently selected formation mode and sends that semantic choice with the next MOVE command.

No hidden formation damage/defense/movement percentage bonuses are introduced.

---

## 5. Next formal work point

Continue Phase 3 army-control follow-up before broad balance tuning:

1. `A` Attack Move with authoritative acquisition behavior;
2. `H` Hold with explicit movement/acquisition constraints;
3. `Tab` subgroup cycling for mixed selections;
4. persistent `GUARD` relation for protecting support/high-value units;
5. Tactical spell targeting/preview UX;
6. Strategic spell relay/network readability;
7. only then broad unit-role/economy/terrain/AI balance tuning.

Do not reopen M00–M08, redo Phase 2, or change `m02-standard-v1` world generation without a separate explicit product decision.
