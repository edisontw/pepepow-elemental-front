# PEPEPOW Elemental Front

A deterministic 2.5D browser RTS roguelite built with TypeScript, PlayCanvas, and Vite.

The project centers on procedurally generated battlefields, systemic elemental warfare, territory control, deterministic economy, roguelite adaptation, and ruleset-bound block-height world generation. Rendering presents authoritative simulation/world state and does not own gameplay truth.

## Current milestone state

- M00 — Repository Bootstrap: **CLOSED**
- M01 — Systemic Combat Foundation: **CLOSED**
- M02 — Procedural Battlefield: **CLOSED**
- M03 — Economy & Territory: **CLOSED**
- M04 — Roguelite Layer: **OPEN**

See `docs/PROJECT_CONTEXT.md` for the concise current handoff and `docs/ROADMAP.md` for milestone scope and acceptance criteria.

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

The browser build now runs the M01 systemic-combat simulation on the deterministic M02 generated battlefield and includes the M03 economy/territory runtime:

- Material / Mana / Influence
- population
- buildings and deterministic production queues
- eight-role production data
- region and POI capture
- territory/supply connectivity and disconnection penalties
- Outpost specialization state
- resource/build/production/capture controls
- dynamic strategic debug map and combined deterministic state hash

A deterministic manual battlefield can be selected with:

```text
?block=<non-negative block height>
```

No blockchain RPC is required for local/practice generation.

## Repository policy

- GitHub `main` is the source of truth.
- Authoritative gameplay/simulation remains pure TypeScript where practical.
- Gameplay determinism must not use uncontrolled `Math.random()`.
- Repository content and current game/debug UI are English-only.
- Closed milestones must not be reimplemented without a demonstrated regression or dependency defect.
