# M08 — Combat & Visual Polish Closure Report

**Status:** CLOSED  
**Roadmap milestone:** M08 — Combat & Visual Polish  
**Final gameplay/presentation runtime baseline:** `e12011b379555cde733a1c815594067185fd3024`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`

## 1. Closure decision

M08 is CLOSED after completion of the original roadmap scope, competitive ruleset identity correction, full automated regression, successful production deployment, and final operator WebGL presentation smoke.

Broader gameplay/design tuning identified during M08 playtesting is intentionally deferred until after roadmap completion. It is not silently treated as solved by this closure.

## 2. Implemented roadmap surfaces

### Combat presentation

- project-level procedural silhouettes for all eight unit archetypes
- distinct strategic building silhouettes
- facing, team, selection, health, and target readability
- ranged projectile presentation
- attack, hit, death, and destruction feedback
- restrained camera impact feedback
- readable boss/finale telegraphing

### Elemental VFX

- Fire / Burning layered markers
- Water Burst impact feedback
- Freeze / ice-formation and crack feedback
- ice overlay and melt / steam transition feedback
- Lightning impact nodes and chain beams
- boss elemental shockwave language
- environmental reaction presentation derived from authoritative state

### Environment

- deterministic visual-only biome props
- woodland trees, rocks, reeds, and terrain accents
- generated terrain materials and dynamic ice presentation
- phase-dependent lighting / ambient tone
- presentation-only visual derivation isolated from gameplay RNG

### UI / minimap / challenge presentation

- player-facing HUD hierarchy with debug UI hidden by default
- central battlefield reclaimed from oversized panels
- contextual command and production controls
- interactive minimap camera movement and unit orders
- POI landmarks and ownership readability
- resource-site health / defense presentation
- Block Challenge, replay, score-proof, and results information retained
- stable manual HUD icon asset IDs and canonical prompts

### Audio

- event-driven procedural combat and elemental SFX placeholders
- attack / hit / death / Fire / Water / Ice / Lightning cues
- browser-safe audio unlock and `M` mute
- low-volume procedural battlefield ambient bed
- audio manifest distinguishes development placeholders from future final assets
- user-supplied Gemini background music remains `NEEDS_MANUAL_GENERATION` and is not a closure dependency

## 3. M08 implementation PRs

- PR #22 — visual readability foundation
- PR #23 — deterministic environment readability
- PR #24 — elemental combat feedback
- PR #25 — player-facing HUD hierarchy
- PR #26 — event-driven audio feedback foundation
- PR #27 — gameplay UX correction gate A
- PR #28 — gameplay correction gate B
- PR #29 — economy, territory, and production UX correction
- PR #30 — elemental tactical jobs
- PR #31 — stable command UI, parallel construction, Rally Points
- PR #32 — expansion clarity and Mana Wells
- PR #33 — visible/actionable POIs
- PR #34 — Mana, encounter auto-aggro, and resource defense
- PR #35 — roadmap presentation completion pass
- PR #36 — competitive ruleset identity correction

## 4. Competitive identity correction

M08 correction PRs introduced deterministic authoritative gameplay changes after M07. Reusing the M02 world-generation ruleset string as the competitive Challenge/replay ruleset would therefore have allowed different gameplay semantics to share one competitive identity.

Final rule:

- `m02-standard-v1` remains the stable world-generation ruleset; M02 Golden Blocks and established world generation are unchanged;
- `m08-standard-v1` is the current complete Challenge / replay / score-proof gameplay ruleset;
- Block Challenge identity, replay packets, official challenge support, and deterministic score verification use the gameplay ruleset;
- exact generated battlefield identity remains bound through block height, world gameplay hash, and generation attempt;
- unsupported competitive rulesets are rejected rather than silently interpreted under changed gameplay semantics.

This was a versioning and verification correction, not another gameplay redesign.

## 5. Final automated evidence

PR #36 and merged main verification:

- final runtime baseline: `e12011b379555cde733a1c815594067185fd3024`
- **45 test files / 198 tests PASS**
- M02 **2,048-seed hard-invariant regression PASS**
- Challenge / replay / score-proof suites PASS
- strict TypeScript PASS
- production build PASS
- merged main CI run `34251355341` / CI #158: **PASS**
- GitHub Pages run `34251355381` / Pages #57: **PASS**

The production build retains a non-blocking Vite chunk-size warning for the current monolithic client bundle. It is performance/packaging debt, not an M08 correctness failure.

## 6. Final human WebGL acceptance

Final operator presentation smoke: **PASS**.

Accepted checks:

- page boots and battlefield interaction works;
- Fire / Water / Ice / Lightning presentation is visible at normal play scale;
- combat / heavy-impact feedback remains restrained enough for play;
- Boss Hunt presentation and ability telegraphing remain visible;
- audio unlock / combat-element cues / ambience / `M` mute remain usable;
- HUD, minimap, and challenge/results presentation remain readable without a new blocking layout regression.

This satisfies the final human gate for the original M08 roadmap.

## 7. Explicit post-roadmap backlog

The following remain intentionally open for later product/gameplay work and are not implied to be solved by M08 closure:

- deeper Fire / Water / Ice / Lightning role and counterplay redesign
- forest / river / bridge / crossing strategic-value tuning
- broader combat targeting and structure-assault redesign
- economy and territorial pacing
- AI behavior and balance tuning
- progression / reward rebalance
- further Mana-system design and tuning
- final manual art replacement
- final licensed / approved SFX replacement
- user-supplied Gemini background music
- deferred M07 PEPEPOW browser live-height / CORS integration
- client bundle code-splitting / size optimization

## 8. Closure

**M08 — Combat & Visual Polish: CLOSED.**

The original M00–M08 roadmap is complete. Future work should begin from the current `main` runtime and treat the items above as a post-roadmap product/design backlog rather than reopening completed milestone implementation history.