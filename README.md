# PEPEPOW Elemental Front

A deterministic 2.5D browser RTS roguelite built with TypeScript, PlayCanvas, and Vite.

The project centers on procedurally generated battlefields, systemic elemental warfare, territory control, and ruleset-bound block-height world generation. Rendering presents authoritative simulation/world state and does not own gameplay truth.

## Current milestone state

- M00 — Repository Bootstrap: **CLOSED**
- M01 — Systemic Combat Foundation: **CLOSED**
- M02 — Procedural Battlefield: **CLOSED**
- M03 — Economy & Territory: **OPEN**

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

The browser build currently includes the M01 systemic-combat arena and the M02 generated-world debug visualization. A deterministic manual battlefield can be selected with:

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
