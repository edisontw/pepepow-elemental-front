# M03 — Economy & Territory Closure Report

**Status:** CLOSED  
**Date:** 2026-09-06  
**Pull request:** #2 — `M03: economy and territory foundation`  
**Final acceptance head:** `95b107e2fce0dd609a58eaf4b594a35c33f04f7e`

---

## 1. Goal

M03 turns the closed M01 systemic-combat foundation and closed M02 generated battlefield into a deterministic RTS economy and territorial-war runtime without introducing worker-spam economy, renderer authority, online dependencies, or a second simulation model.

---

## 2. Implemented scope

### Economy

- Material, Mana, and Influence authoritative resource stocks
- fixed-point milli-resource accounting to avoid floating-point economy drift
- starting resources: 300 Material / 100 Mana / 10 Influence
- passive Elemental Core income without worker units
- Material Extractors bound to M02 Material Deposits
- Mana income bound to owned M02 Mana regions
- rich/normal resource rates
- connected/disconnected throughput penalties
- one-time construction and production costs
- population usage and population cap
- deterministic production queues

### Buildings

- Elemental Core
- Barracks
- Arcane Tower
- Workshop
- Outpost
- Extractor

Building placement uses the generated M02 world, region ownership, buildability/walkability, supply state, and occupancy. Extractors explicitly use the M02 Material Deposit contract: a valid deposit must be walkable and can host its Extractor even when the general-purpose buildable flag is absent.

### Unit production

The M03 data layer now exposes the initial eight-role roster:

- Vanguard
- Spear Guard
- Ranger
- Scout
- Elementalist
- Engineer
- Golem
- Siege Construct

Each role has deterministic producer, cost, population, train-time, capture-power, and tactical spawn data. Newly produced units enter the existing M01 ECS/entity store and presentation bridge rather than a parallel army model.

### Territory and supply

- neutral/player/enemy strategic region ownership
- unit-presence capture orders using the M02 region grid
- deterministic capture progress
- contested-region state
- M02 POI capture
- +10 Influence reward on first successful POI capture
- connected territory supply graph derived from the M02 region adjacency graph
- supply cuts when an intervening owned region is lost
- disconnected Extractor/Mana throughput penalties
- connected Outposts increase population cap by +10
- Outpost specialization state:
  - Watchtower
  - Barrier Hub
  - Mana Beacon

Autonomous enemy strategy remains deferred to M05. Enemy units are only deterministic fixtures for M03 contest/supply acceptance.

### Generated battlefield runtime integration

- M02 generated 128×128 battlefield converted into the existing M01 arena/navigation contract
- generated water becomes blocked river traversal
- generated crossings remain walkable natural crossings
- generated woodland feeds vegetation/fire state
- generated player/enemy spawn locations seed tactical armies
- camera bounds scale to the generated battlefield and start at the player army
- generated terrain proxies remain presentation-only
- M01 elemental-combat commands continue to use the same tactical simulation authority

### Browser UI / debug

- M03 resource strip: Material / Mana / Influence / Population
- Build controls
- Production controls for all eight roles
- Capture Current Region
- Capture POI
- Outpost specialization controls
- territory/supply/contested/queue summary
- deterministic status messages for rejected/queued strategic actions
- dynamic strategic building presentation
- dynamically created trained-unit presentation
- M03 strategic state exposed in the debug overlay
- combined tactical + strategic state hash
- generated-world debug map tinted by territory ownership
- contested-region tint
- supplied-player-region rings
- deterministic `?block=<height>` input retained

All repository and current in-game/debug UI content remains English-only.

---

## 3. Determinism and replay safety

M03 uses a dedicated deterministic strategic command queue layered over the existing M01 tactical command stream.

Per tick, the strategic runtime processes deterministic strategic commands, advances the existing M01 simulation, advances economy, advances territory/supply state, and snapshots both layers into a combined state identity.

Strategic authoritative state included in hashing includes:

- resource stocks
- population used/cap
- region owners
- supplied regions
- contested regions
- POI owners
- buildings and completion state
- Outpost specialization
- production orders
- capture orders/progress

The M01 tactical hash implementation remains unchanged. M03 combines the tactical and strategic hashes at the M03 wrapper boundary.

---

## 4. Acceptance evidence

Final PR acceptance run for `95b107e2fce0dd609a58eaf4b594a35c33f04f7e`:

- **18 / 18 test files PASS**
- **93 / 93 tests PASS**
- M03 economy/territory suite: **5 / 5 PASS**
- M02 2,048 deterministic seed hard-invariant batch: **PASS**
- M01 regression suite: **PASS**
- strict TypeScript (`tsc --noEmit`): **PASS**
- Vite production build: **PASS**

M03 acceptance tests demonstrate:

1. **Worker-spam-free economy** — passive Core income operates without worker entities.
2. **Finite resource flow / no free-resource duplication** — construction cost is deducted once, duplicate invalid construction does not create a free second building, and passive 30-minute income remains bounded.
3. **Production queues** — Barracks construction completes deterministically and trained units enter population/ECS state at the expected completion tick.
4. **Influence/POI capture** — a POI grants the +10 Influence reward exactly once.
5. **Expansion value** — capturing remote territory, completing an Outpost, and building a remote Extractor increases strategic capacity and income.
6. **Supply cuts matter** — loss of an intermediate region disconnects a remote region, removes its Outpost population-cap contribution, and reduces remote Extractor throughput.
7. **Replay compatibility** — identical generated world + identical M03 strategic command stream produces identical combined tactical/economy state hashes and strategic snapshots.

---

## 5. Resource pacing evidence

The canonical automated 30-minute baseline is 18,000 simulation ticks at 10 Hz.

With no worker micro and no expansion, the player starts at 300 Material / 100 Mana / 10 Influence. Core income yields a deterministic 5,700 Material total after 30 minutes; Mana reaches at least 1,000 before any additional controlled-node benefit and remains within the explicit simulation upper bound used by the acceptance test.

Expansion adds Material/Mana throughput and population capacity, while supply cuts substantially reduce remote throughput. This supports the intended 25–35 minute run economy envelope without requiring a worker-production loop. Final balance tuning remains a later playtest/polish concern rather than an M03 architecture blocker.

---

## 6. Explicitly deferred beyond M03

- M04 Shrine choice/upgrade system and roguelite build layer
- M05 strategic/tactical autonomous enemy AI
- M06 full victory/defeat/boss run loop
- M07 blockchain/RPC challenge integration
- final world geometry and terrain art
- production VFX/audio and advanced UI polish
- advanced unit collision/steering
- final economy balance tuning across complete runs

---

## 7. Manual verification

The automated suite, strict TypeScript build, and browser production bundle are sufficient to close the deterministic M03 systems milestone.

One non-blocking human WebGL smoke remains useful after deployment: confirm that the generated battlefield, resource/build/production panel, newly trained units/buildings, territory-map tint, camera traversal, and M01 elemental shortcuts are visually usable together in the browser. Any presentation-only issue found there may be fixed without reopening M03 unless it reveals an authoritative simulation regression.

---

## 8. Closure decision

**M03 is CLOSED.**

Next milestone: **M04 — Roguelite Layer**.
