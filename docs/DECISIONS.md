# Architecture decisions

## ADR-001 — 10 Hz fixed simulation tick

Authoritative simulation advances in 100 ms ticks. Rendering may interpolate but cannot own gameplay state.

## ADR-002 — Simulation separated from PlayCanvas

`src/simulation/` contains pure TypeScript and may not import PlayCanvas, DOM, audio, network, or presentation APIs.

## ADR-003 — Deterministic RNG only

Gameplay code uses explicit seeded streams. Uncontrolled `Math.random()` is prohibited in authoritative systems.

## ADR-004 — Stable asset and audio IDs

Presentation resolves canonical files through manifests. Asset replacement cannot require gameplay-code changes.
