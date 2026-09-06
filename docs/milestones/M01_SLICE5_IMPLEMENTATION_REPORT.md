# M01 Slice 5 — Deterministic Fire / Burning Foundation

**Status:** IMPLEMENTATION COMPLETE  
**M01 status:** IN_PROGRESS  
**Implementation commit:** `f278bf326375ad45848b96cbf5008e4beb7b6bef`

## Delivered

- Added authoritative vegetation eligibility and Burning age typed arrays to the existing terrain grid.
- Rasterized the two handcrafted forest patches; non-Ground overlaps are not flammable.
- Added deterministic FIRE ignition, fixed N/E/S/W propagation every 3 ticks, a 9-tick burn lifetime, vegetation consumption, and +10 heat per active tick.
- Preserved the existing FIRE heat/ice-durability/melt behavior.
- Water and Ice prevent ignition; Water or a Wet occupant extinguishes an active cell under the minimal M01 rule.
- Added vegetation/Burning state to the canonical hash.
- Added minimal orange cell markers, forest FIRE debug targeting, and Burning/consumed debug counts.

## Verification

- TypeScript: PASS
- Vitest: 12 files / 60 tests PASS
- Production build: PASS
- Deterministic spread integration: PASS
- Replay and render-FPS independence: PASS
- Existing elemental signature regression: PASS

## Intentional limits

No unit Burning DoT, smoke, steam, wind/weather, heat diffusion, persistent terrain wetness, polished VFX, audio, procedural generation, or M02 work was added. Controlled-browser WebGL smoke and the existing bundle-size warning remain unchanged and non-blocking for this slice.

## Next action

Run the M01 Closure Gap Audit. Keep M01 `IN_PROGRESS`; do not start M02.
