# PEPEPOW Elemental Front

A deterministic 2.5D browser RTS roguelite built with TypeScript, PlayCanvas, and Vite.

The original M00–M08 roadmap is **CLOSED**. Current work is post-roadmap product and gameplay redesign; GitHub `main` remains the only source of truth.

## Project status

- M00 — Repository Bootstrap: **CLOSED**
- M01 — Systemic Combat Foundation: **CLOSED**
- M02 — Procedural Battlefield: **CLOSED**
- M03 — Economy & Territory: **CLOSED**
- M04 — Roguelite Layer: **CLOSED**
- M05 — Enemy War: **CLOSED**
- M06 — Full Run: **CLOSED**
- M07 — PEPEPOW Block Challenge: **CLOSED**
- M08 — Combat & Visual Polish: **CLOSED**

Read `docs/PROJECT_CONTEXT.md` first for the current handoff. Use `docs/GAME_DESIGN_SPEC.md`, `docs/TECH_ARCHITECTURE.md`, and `docs/ROADMAP.md` only as canonical GitHub-main documents.

## Runtime foundation

The current game includes:

- authoritative pure-TypeScript fixed-tick simulation
- deterministic command streams, replay, and state hashes
- deterministic block-height battlefield generation
- terrain, rivers, forests, regions, resources, POIs, and objectives
- Material / Mana / Influence economy and territory/supply systems
- construction, production, Rally Points, Extractors, and Mana Wells
- Fire / Water / Ice / Lightning systemic combat
- roguelite Shrines and upgrades
- fog-bounded enemy AI and multiple enemy factions
- Destroy and Boss Hunt full-run flows
- Block Challenge identity, replay-backed score proof, and local verified leaderboard support
- PlayCanvas presentation, minimap, HUD, elemental VFX, procedural SFX, and ambience

Ruleset separation:

- world generation: `m02-standard-v1`
- current complete gameplay challenge/replay identity: `m08-standard-v1`

## Development

```bash
npm install
npm run dev
```

Required verification:

```bash
npm run test
npm run build
```

## Playable deployment

GitHub Pages:

`https://edisontw.github.io/pepepow-elemental-front/`

Useful query parameters include:

```text
?block=<non-negative block height>
?mode=destroy
?mode=boss
?difficulty=casual|standard|hard
?faction=iron|flame|wild
?debug=1
```

Manual and Official challenge paths do not require live blockchain RPC. The browser live-height/CORS integration remains a deferred post-roadmap item.

## Post-roadmap work

The closed roadmap does not imply that all game design is final. Current redesign candidates include elemental roles/counterplay, forests/rivers/crossings, combat targeting, economy and territorial pacing, Mana, AI/balance, progression/rewards, final art/audio, and client bundle optimization.

Authoritative gameplay changes after `m08-standard-v1` must receive a new gameplay Ruleset Version.

## Repository policy

- GitHub `main` is the source of truth.
- Repository and current in-game/debug UI content are English-only.
- Authoritative gameplay/simulation remains independent from PlayCanvas presentation.
- Gameplay determinism must not use uncontrolled `Math.random()`.
- Rendering/UI may present simulation state but may not own gameplay truth.
- Closed milestone history is summarized by `docs/milestones/M00_CLOSURE_REPORT.md` through `M08_CLOSURE_REPORT.md`; detailed intermediate implementation history remains available in Git history and merged PRs.
