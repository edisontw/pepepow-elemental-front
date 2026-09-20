# RTS Control + Automation + Runtime Optimization Pass

Shipped baseline identity: `ef-standard-v10` / `ef-replay-v10`; current gameplay identity is `ef-standard-v11` / `ef-replay-v11`.
World generation remains `m02-standard-v1`; all historical milestone closures remain closed.

## Implemented contract

- Eight-neighbor A* uses 10/14 integer costs, octile heuristic, stable neighbor/tie ordering,
  and requires both flank cells to be walkable for diagonals. Formation destination BFS
  remains cardinal and role-aware. Repath starts at the current cell center.
- A then click (including minimap destination) issues semantic formation Attack Move.
  Visibility/forest-aware nearest-target selection uses EntityID ties. Each unit keeps its
  destination through combat and resumes after target death/loss. H holds ground using
  normal attack range/cadence; S/X returns to ordinary Stop/aggro. No hidden bonuses.
- v11 follow-up: normal MOVE is forced disengage while its destination remains active.
  It clears the current combat target and ignores automatic encounter acquisition until
  arrival or cancellation. S/X cancels the move; ordinary auto-aggro resumes next tick.
- Mode/destination are hashed; Core-order replacement executes at the command tick.
  Existing velocity-derived facing and shared art direction mapping remain unchanged.
- Secured Shrines automatically present deterministic eligible choices. Pending Shrines
  queue by id; resolved ones cannot reopen. Choices use the actual starting Attunements.
  The panel compacts after selection even when hovered. Region capture is unchanged.
- Atlas builder reads all 1,760 committed WebPs and pixel-verifies 55 lossless atlases.
  Canonical frames occupy 192×256 cells plus two-pixel gutters, eight columns/four rows.
  Runtime uses explicit unflipped UVs, original scale/baseline and action timing.
- Each encountered player-side config loads Idle once; other actions load on demand.
  Shared immutable UV materials reference one texture per action, across all units.
  Failures keep Idle/fallback and do not retry each frame. Teardown destroys resources;
  pending loads cannot recreate resources after teardown. Raw frames stay in git but are
  removed from the deployment output. No art generation or Blender work.

## Verification

- Full local suite: 78 files / 309 tests; 308 passed, one stale official-manifest
  identity failed. The manifest was corrected to v10 and its five tests passed on
  targeted rerun. No broad suite was repeated locally.
- Additional keyboard-targeting regression passed (one test); focused control/replay
  rerun passed (seven tests), including per-tick source/replay hash equivalence.
- M02 Golden Blocks and 2,048-seed regression passed in the full run.
- Strict TypeScript and production build passed. Final output contains 55 atlas
  images and zero raw animation frames; all 1,760 source frames remain committed.
- Atlas builder losslessly decoded/pixel-verified every packed frame. Runtime tests
  cover shared textures, demand loading, failure caching and async teardown.
- Existing Vite large-chunk advisory remains; this pass does not claim FPS acceptance.
- GitHub CI/Pages status is attached to the implementation commit.

## Manual acceptance gate

Status: **WAITING_FOR_WEBGL_ACCEPTANCE**. Cloud WebGL verification is not claimed.

On the deployed Pages build, inspect:

1. Single unit and Line/Column/Spread movement in eight directions; diagonal travel should
   face its actual velocity. Check bridge/wall corners and freeze/melt rerouting.
2. A then click: engage and resume destination. H: stand still and fire only in range;
   moving enemies should not pull units away. S/X and subsequent orders release Hold.
3. Secure a Shrine: three choices appear automatically. Select one: panel compacts;
   queued Shrines appear in stable order, with no extra activation click.
4. All eleven unit visuals: Idle/Move/Attack/Hit/Death in eight directions, unchanged
   size/ground baseline, no atlas tile bleeding/flips, overlays and fog still correct.
5. Cold-load responsiveness and FPS with a large army. Network should show action-atlas
   URLs only for encountered configs/actions, no 32-request frame bursts per action.
   Record target device/browser and FPS; automation does not establish visual performance.
