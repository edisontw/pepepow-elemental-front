# M01 — Systemic Combat Foundation Closure Report

**Status:** CLOSED  
**Automated acceptance:** COMPLETE  
**Human WebGL playtest:** PASS  
**Closure implementation:** `f278bf326375ad45848b96cbf5008e4beb7b6bef`  
**Final readability fix:** `d5624d9a68fc594a8eb43f9566f3ab9d69b91ae0`

## Completed

M01 provides authoritative fixed-tick unit control, deterministic navigation/combat/replay, four initial unit archetypes, Water/Wet/Ice/Fire/Burning/Lightning/Chilled/Frozen interactions, local dynamic navigation, conductivity-based chains, per-player fog baseline, control groups, debug/state-hash coverage, and a 40-unit handcrafted arena.

The complete signature interaction is proven both automatically and in a WebGL-capable browser:

```text
blocked Water → Freeze → cross → enemy follows → FIRE melts Ice
→ unit remains in Water and becomes Wet → conductivity-driven Lightning chain
```

## Automated verification baseline

- TypeScript: PASS
- Vitest: 16 files / 75 tests PASS
- Production build: PASS
- Targeted subsystem/integration tests: PASS
- 40-unit exact-convergence/deadlock smoke: PASS
- 40-unit replay and render-FPS independence: PASS
- 40-unit performance gate: PASS — 181.3 ms / 420 ticks (0.432 ms/tick) in the closure implementation run
- GitHub CI for automated closure: run `34020239510` — SUCCESS
- GitHub CI after final Wet-readability presentation fix: run `34022042249` — SUCCESS
- GitHub Pages deployment after final fix: run `34022042271` — SUCCESS

## Human WebGL verification — 2026-09-06

The production GitHub Pages build was tested in a WebGL-capable desktop browser.

PASS:

- camera and RTS controls usable
- movement and STOP usable
- click/drag/Shift selection and control-group basics usable
- MOVE / ATTACK / STOP behavior usable
- FREEZE visibly creates an ice crossing
- FIRE visibly reverses Ice back to Water
- melt-under-unit preserves position rather than teleporting
- Water correctly applies `Wet`
- Lightning visibly damages/chains through targets
- forest Fire/Burning is visible
- 40-unit WebGL renderer performance acceptable
- elemental battlefield mechanic judged worth continuing into M02

During the playtest, Wet state was logically correct but its original presentation was too subtle. The presentation-only marker was strengthened in `d5624d9a68fc594a8eb43f9566f3ab9d69b91ae0` with a larger cyan halo plus an overhead beacon. Human retest: PASS.

Developer controls were also clarified for reliable M01 verification: FREEZE and FIRE/melt were made one-step test actions, forest burn received a separate control, and the on-screen help was updated. These changes did not alter authoritative simulation semantics.

## Closure decision

All M01 acceptance criteria in `docs/ROADMAP.md` are now satisfied, including the human-facing readability, usability, renderer-performance, and milestone fun gates.

**M01 — Systemic Combat Foundation is CLOSED.**

M02 — Procedural Battlefield may now begin. M01 systems are a closed baseline and must not be reimplemented or broadly redesigned without a demonstrated regression or a new canonical requirement.
