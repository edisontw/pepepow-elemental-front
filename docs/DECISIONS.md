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


## ADR-009 — Phase 4 uses explicit objective attacks and hero-lite veteran progression

Core damage is no longer inferred from proximity. A Core can only take unit damage from an explicit objective-attack intent resolved through the attacker's normal range and attack cadence. Active Cores provide deterministic recovery to safe nearby friendly units. Phase 4 will extend individual units with deterministic XP / Level 1–5 veteran progression and neutral-monster rewards while retaining RTS army control. These authoritative changes advance gameplay/replay identity to `ef-standard-v4` / `ef-replay-v4`; world generation remains `m02-standard-v1`.


## ADR-010 — Neutral camps become deterministic combat encounters before veteran levels

Phase 4 P4-B activates the five existing generated `NEUTRAL_CAMP` POIs without changing `m02-standard-v1`. A neutral faction (`playerId = 2`) owns deterministic Ancient Sentinel guards that use normal combat authority and a bounded camp leash. Guarded camps cannot be captured. Clearing a camp distributes a fixed 120 XP pool deterministically among nearby participants of the locally prevailing non-neutral faction. Unit XP is authoritative and state-hashed now; Level 1–5 thresholds/stat scaling remain P4-C. These authoritative additions advance gameplay/replay identity to `ef-standard-v5` / `ef-replay-v5`.


## ADR-011 — Veteran progression uses bounded linear integer scaling

Phase 4 P4-C converts per-unit XP into deterministic Level 1–5 veteran progression. Cumulative thresholds are 60 / 150 / 280 / 450 XP for Levels 2–5. Normal combat-unit kills share XP among nearby same-faction participants so last-hit micro is not required; Neutral Sentinels remain covered by the existing camp-clear XP pool rather than granting a second kill reward. Each level above Level 1 applies approximately +6% Max HP and +4% Attack Damage from immutable stored base stats, using deterministic integer rounding. Level-up restores only the newly added Max-HP delta, and XP caps at the Level-5 threshold. These authoritative semantics advance gameplay/replay identity to `ef-standard-v6` / `ef-replay-v6`; world generation remains `m02-standard-v1`.


## ADR-012 — Core recovery uses fixed-point pulses and Phase 4 closes under v7

P4-E balance validation found that the original `2 permille per tick` implementation combined with a minimum `1 HP` heal unintentionally accelerated low-HP units; a 180-HP Vanguard could recover at roughly 5.6% max HP/sec. Core recovery now resolves as deterministic 0.5-second fixed-point pulses whose long-run rate is 2% max HP/sec, keeping half-to-full recovery near 25 seconds without adding floating-point simulation state. Neutral-camp reward (120 XP), Level 1–5 thresholds, and veteran stat scaling remain unchanged because balance guardrails show bounded progression: one camp levels a two-unit squad but not a three-unit group, Level 5 remains approximately +24% HP / +16% damage, and current Finale bosses retain an 80+ second theoretical TTK against a fully Lv5 starting squad. This authoritative balance correction advances gameplay/replay identity to `ef-standard-v7` / `ef-replay-v7`; `m02-standard-v1` remains unchanged. Phase 4 gameplay is closed after P4-E validation.


## ADR-013 — Faster veteran pacing and denser neutral camps advance gameplay to v8

Post-closure playtest feedback showed that individual unit leveling was perceptibly too slow and neutral encounters felt under-populated. The current cumulative veteran thresholds are therefore reduced from 60 / 150 / 280 / 450 XP to **50 / 120 / 220 / 350 XP**, while each Neutral Camp increases from two to **three Ancient Sentinels** and the deterministic camp-clear pool increases from 120 to **150 XP**. Sentinel kills still do not grant a second per-kill XP reward. A focused three-unit group now receives 50 XP each and reaches Level 2 from one clear; a six-unit group receives 25 XP each and remains Level 1, preserving an anti-snowball bound. Veteran stat scaling and ordinary combat-kill XP remain unchanged. These authoritative balance changes advance gameplay/replay identity to `ef-standard-v8` / `ef-replay-v8`; `m02-standard-v1` remains unchanged.


## ADR-014 — POI ownership is presence-driven; manual capture UI is retired

The previous POI loop required a player to move units into a POI's strategic region, then press `Capture POI`, then wait for the existing capture progress. The second command added micro without a new decision, and the old region-based test meant units did not have to be physically near the landmark. POI ownership and its +10 Influence reward are retained, but authority is now derived automatically from actual unit proximity: one eligible faction within 5 m advances capture, absence pauses, simultaneous opposing presence pauses, and guarded Neutral Camps block progress until cleared. Region territory CAPTURE remains a command because it still represents strategic territory authority. Enemy `CONTEST_POI` now moves to the landmark and uses the same presence rule. These semantics advance gameplay/replay identity to `ef-standard-v9` / `ef-replay-v9`; `m02-standard-v1` remains unchanged.
