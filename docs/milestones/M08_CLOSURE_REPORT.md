# M08 — Combat & Visual Polish Closure Report

**Status:** IN_PROGRESS — FINAL HUMAN WEBGL PRESENTATION SMOKE PENDING  
**Roadmap milestone:** M08 — Combat & Visual Polish  
**Pre-closure baseline:** `18e9ccba42b57e4262508093ee650aa2117d907c`  
**Playable deployment:** `https://edisontw.github.io/pepepow-elemental-front/`

## 1. Closure position

The original M08 roadmap implementation is complete enough for final browser acceptance. Broader gameplay/design tuning identified during M08 playtesting is intentionally deferred until after roadmap completion by operator decision on 2026-09-08.

M08 must not be marked CLOSED until:

1. competitive ruleset identity is corrected so post-M07 authoritative gameplay changes do not silently reuse the old challenge ruleset identity;
2. the resulting branch passes full regression, TypeScript, and production build;
3. merged `main` CI and Pages deployment pass;
4. one concise human WebGL presentation smoke passes.

## 2. Implemented roadmap surfaces

### Combat presentation

- project-level procedural silhouettes for all eight unit archetypes
- distinct strategic building silhouettes
- facing/readability improvements
- selection and health presentation
- ranged projectile presentation
- attack, hit, death, and destruction feedback
- restrained camera impact pulse
- readable boss/finale ability telegraphing

### Elemental VFX

- Fire / Burning layered markers
- Water Burst visible impact rings
- Freeze / ice-formation crack flashes
- ice overlay and melt/steam transition feedback
- Lightning impact nodes and chain beams
- boss elemental ability shockwave language
- environmental reaction presentation based on authoritative state

### Environment

- deterministic visual-only biome props
- woodland trees, rocks, reeds, terrain accents
- generated terrain materials and dynamic ice presentation
- phase-dependent lighting/ambient tone
- presentation-only visual derivation isolated from gameplay RNG

### UI / minimap / challenge presentation

- player-facing HUD hierarchy with debug UI hidden by default
- central battlefield reclaimed from oversized panels
- contextual command/production controls
- interactive minimap camera movement and unit orders
- POI landmarks and ownership readability
- resource-site health/defense presentation
- Block Challenge, replay, score-proof, and results information retained
- stable manual HUD icon asset IDs and canonical prompts

### Audio

- event-driven procedural combat and elemental SFX placeholders
- attack / hit / death / Fire / Water / Ice / Lightning cues
- browser-safe audio unlock and `M` mute
- low-volume procedural battlefield ambient bed
- audio manifest now distinguishes development placeholders from future final assets
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

PR #35 automated acceptance:

- 44 test files / 197 tests PASS
- M02 2,048-seed hard-invariant regression PASS
- strict TypeScript PASS
- production build PASS
- post-merge main CI #156 PASS
- GitHub Pages #56 PASS

## 4. Competitive identity pre-closure correction

M08 correction PRs introduced deterministic authoritative gameplay changes after M07, including elemental tactical behavior, economy/territory behavior, Mana rules, auto-aggro, and destructible/fortified resource sites.

The old implementation reused the M02 world-generation ruleset string (`m02-standard-v1`) as the Block Challenge/replay competitive ruleset. That would allow different gameplay semantics to share the same competitive Ruleset Version.

Pre-closure correction:

- retain `m02-standard-v1` as the stable world-generation ruleset so M02 Golden Blocks and established battlefield generation remain unchanged;
- introduce `m08-standard-v1` as the current complete Challenge/replay/score-proof gameplay ruleset;
- Block Challenge identity, replay packets, official challenge support, and deterministic score verification use the gameplay ruleset;
- world gameplay hash + generation attempt continue to bind the exact generated battlefield;
- the featured official entry becomes `M08 Roadmap Challenge` on the same verified PEPEPOW block.

This is a versioning/verification correction, not another gameplay redesign.

## 5. Explicitly deferred post-roadmap tuning

The following are not M08 closure blockers unless they manifest as a concrete broken runtime regression:

- deeper Fire / Water / Ice / Lightning role and counterplay redesign
- forest / river / bridge / crossing strategic-value tuning
- broader combat targeting and structure-assault redesign
- economy, territorial pacing, AI, and balance tuning
- progression/reward rebalance
- replacement of procedural geometry with manually approved final art
- replacement of procedural SFX/ambience with approved external/final audio
- user-supplied Gemini background music
- deferred M07 PEPEPOW browser live-height/CORS integration

## 6. Final human WebGL smoke

After pre-closure CI and deployment pass, verify only roadmap presentation/runtime integrity:

- page boots and the battlefield remains interactable;
- Fire / Water / Ice / Lightning presentation remains visible and understandable at normal zoom;
- visible heavy impacts/deaths produce restrained, non-disorienting camera feedback;
- Boss Hunt shows boss silhouette/orbit language and ability shockwave telegraph;
- audio unlocks after first interaction, combat/element cues plus faint ambience are audible, and `M` mute works;
- HUD, minimap, and results/challenge presentation remain readable without blocking the battlefield.

A PASS on this smoke is the final human gate before changing this report to CLOSED and updating `ROADMAP.md` / `PROJECT_CONTEXT.md`.
