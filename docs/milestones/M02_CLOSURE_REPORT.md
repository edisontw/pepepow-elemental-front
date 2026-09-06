# M02 Closure Report — Procedural Battlefield

**Status:** CLOSED  
**Closure date:** 2026-09-06  
**Implementation merged to main:** `c26eecf5b324bd3e9ac4a09ca571a5522450ce21`  
**Implementation PR:** #1 — M02: deterministic procedural battlefield

## Goal

M02 establishes a deterministic, strategically valid procedural battlefield definition for a standard 128×128 logical-cell world while preserving the existing authoritative simulation/rendering separation from M01.

## Completed systems

- ruleset-bound `WorldIdentity` derived from project namespace, ruleset version, and block height
- independent deterministic RNG streams for elevation, hydrology, biome, region, route, resources, POIs, spawns, enemy, boss, and visual presentation
- pure TypeScript generated-world data model using typed arrays for grid state
- deterministic elevation generation
- deterministic major-river, stream, and natural-crossing generation
- biome/moisture generation with Plains, Woodland, and Highlands classifications
- 12 strategically legible regions with deterministic names and centers
- connected strategic route graph with route widths, cycles, and crossing-aware routing
- Material and Mana resource placement
- Shrine, Neutral Camp, Village, and Ancient Ruin POI placement
- player and enemy spawn placement
- objective and boss-area placement
- hard-invariant world validator
- battlefield quality score
- deterministic generation retry
- canonical gameplay hash that excludes visual-only randomness
- Golden Block regression fixtures
- large deterministic seed-batch regression
- browser debug map for terrain, routes, regions, resources, POIs, spawns, objective, boss, generation attempt, quality, and gameplay hash
- manual block-height debug input through `?block=<height>` with an offline-safe default

## Acceptance evidence

### Determinism

- same block height + same ruleset reproduces the same gameplay hash and world data
- ruleset version is part of world identity
- visual RNG uses a separate stream and changing the visual salt does not alter gameplay placement or gameplay hash
- generation attempts are explicit deterministic inputs
- retry regression fixture reproduces the same successful attempt and hash

### Hard invariants

The validator rejects or reports:

- missing or invalid player/enemy spawns
- unreachable enemy, objective, or boss area
- invalid Material/Mana counts
- resources or POIs on invalid cells
- missing nearby starting Material
- missing low-risk starting POI
- missing viable expansion Material in another reachable region
- illegal placement overlap
- inadequate crossing capacity
- invalid strategic-region count
- disconnected region graph
- insufficient route connectivity

### Strategic structure

Standard generated worlds provide:

- 12 strategic regions
- connected route graph with multiple cycles
- robust natural crossing capacity rather than a single one-cell path
- 10 Material nodes
- 5 Mana nodes
- 6 Shrines plus neutral camps, villages, and ruins
- separated player/enemy territory and distinct objective/boss locations

### Automated verification

Pull request CI run `34023725126` passed after the strict-build cleanup:

- `npm ci` — PASS
- Vitest — **17 files / 88 tests PASS**
- M02 large batch — **2,048 deterministic block seeds PASS** with zero hard-invariant failures
- `tsc --noEmit` — PASS
- Vite production build — PASS
- existing M01 deterministic/systemic-combat regressions — PASS

The large M02 seed-batch test completed in approximately 10.5 seconds on the GitHub Actions runner. The local pre-PR audit observed quality scores remaining above the configured acceptance floor across the same 2,048-seed range.

## Golden Blocks

The first M02 Golden Block set contains these fixed block heights:

- `0`
- `1`
- `42`
- `1000`
- `123456`
- `9999999`

Their expected gameplay hashes are locked in `tests/worldgen/worldgen.test.ts` and will detect unintended world-generation changes.

## Debug visualization

The existing M01 WebGL systemic arena remains available. M02 adds a separate lightweight 2D generated-world debug panel that shows:

- biome/terrain structure
- water and crossings
- strategic route graph
- numbered strategic regions
- Material/Mana resources
- POIs
- player/enemy spawns
- objective and boss area
- block height, ruleset, retry attempt, quality score, and gameplay hash

This keeps M02 visualization presentation-only; generated gameplay truth remains pure TypeScript world data.

## Deferred beyond M02

The following remain intentionally outside M02:

- resource income and spending
- buildings and production queues
- territory ownership and capture
- supply connectivity and disconnected penalties
- outpost specialization
- economy/build UI
- autonomous enemy strategic behavior
- polished procedural terrain meshes and biome art
- PEPEPOW RPC/network block retrieval

These belong to M03 or later milestones.

## Closure decision

M02 acceptance criteria are satisfied by deterministic regression coverage, large-seed hard-invariant validation, successful production build/CI, and the minimal generated-world debug visualization. No M01 architecture redesign was required.

**Next milestone:** M03 — Economy & Territory.
