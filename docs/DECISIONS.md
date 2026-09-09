# Architecture decisions

## ADR-001 — 10 Hz fixed simulation tick

Authoritative simulation advances in 100 ms ticks. Rendering may interpolate but cannot own gameplay state.

## ADR-002 — Simulation separated from PlayCanvas

`src/simulation/` contains pure TypeScript and may not import PlayCanvas, DOM, audio, network, or presentation APIs.

## ADR-003 — Deterministic RNG only

Gameplay code uses explicit seeded streams. Uncontrolled `Math.random()` is prohibited in authoritative systems.

## ADR-004 — Stable asset and audio IDs

Presentation resolves canonical files through manifests. Asset replacement cannot require gameplay-code changes.

## ADR-005 — Gameplay ruleset identity is separate from world generation

World generation remains independently versioned as `m02-standard-v1`. Post-roadmap gameplay versions advance independently whenever authoritative combat/control semantics change. Runtime data/code, replay/state hashes, challenge identity, and required regression tests must adopt a new gameplay version together without changing established M02 world generation or Golden Block hashes.

## ADR-006 — Elementalist alignment and spell authority use composition

Keep one `ELEMENTALIST` archetype. Each fielded Elementalist has one immutable elemental alignment chosen from the player's current Attunements at training time. Tactical casts are authorized by one deterministic valid local aligned caster. Strategic casts are player-level actions authorized through the supplied spell network. Player/UI commands may identify the semantic spell and target but may not supply authoritative Mana cost, cooldown, radius, or resolver parameters.

## ADR-007 — Static target roles and dynamic elemental states remain separate

Unit/building role tags such as `LIGHT`, `HEAVY`, `METAL`, `BUILDING`, `ARCANE`, `SUPPORT`, and `SIEGE` are data-driven static or structure-derived roles. `WET`, `CHILLED`, `FROZEN`, `BURNING`, and `CONDUCTIVE` are derived from authoritative status/environment state. Tags enable readable preferred-target logic without introducing a hidden universal armor table.

## ADR-008 — Formation is semantic MOVE metadata, not a hidden stat stance

Player formation choice is carried on the authoritative `MOVE` command. Simulation computes orientation, role ordering, formation slots, unique walkable destinations, and paths at command execution time. UI does not calculate authoritative per-unit offsets. `LINE`, `COLUMN`, and `SPREAD` differ through spatial behavior only; no hidden formation damage, defense, or movement percentage bonuses are introduced. MOVE without formation metadata remains the closed-system compact-grid migration path. Because this changes authoritative movement outcomes, Phase 3 advances gameplay/replay identity to `ef-standard-v3` / `ef-replay-v3` while world generation remains `m02-standard-v1`.
