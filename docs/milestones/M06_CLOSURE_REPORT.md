# M06 — Full Run Closure Report

**Status:** CLOSED  
**Closure date:** 2026-09-06  
**Implementation PR:** #14  
**Presentation correction PR:** #15  
**Final deployed runtime baseline:** `fb2a0fb1129287413803aa9cee3e2906a5ef22a3`

---

## 1. Closure decision

M06 — Full Run is **CLOSED**.

The first deterministic start-to-finish game loop is implemented, automated verification is green, the corrected runtime is deployed, and the required human WebGL acceptance is complete.

M00–M05 remain CLOSED. M07 — PEPEPOW Block Challenge is now the active milestone.

---

## 2. Permanent M06 baseline

M06 connects the permanent M01–M05 systems into one authoritative run lifecycle without creating a parallel gameplay stack.

Permanent baseline includes:

- authoritative `M06Simulation` extending M05
- deterministic phases: Discovery / Commitment / Expansion / Escalation / Finale / Complete
- standard phase timing 0–5 / 5–12 / 12–20 / 20–27 / 27+ minutes
- time-based standard Finale gate at 27:00
- optional momentum Finale unlock from 15:00 after the required territory, Shrine, and building progress
- Destroy victory using the generated enemy Core
- Boss Hunt victory using the generated boss site
- deterministic Frost Titan / Storm Colossus / Infernal Behemoth selection
- boss actions routed through existing Freeze / Lightning / Fire / Heat systems
- player Core HP/Armor and one-time 30-second Core Critical State
- nearby Engineer recovery to the canonical 10% Core-health threshold
- deterministic victory / defeat / result reasons
- deterministic score breakdown
- M06 run state included in the authoritative state hash
- versioned replay packets with exact block/ruleset/world/faction/difficulty/mode/pace identity
- external GAME / STRATEGIC / ROGUELITE command recording
- authoritative-tick replay injection
- replay `MATCH` / `DIVERGED` verification
- Retry Block / Next Block / Replay Last flow
- M04 world events integrated at approximately 14 and 19 minutes
- browser Full Run HUD, objective health, Critical countdown, results/score, replay status, and boss marker

---

## 3. Presentation correction retained from PR #15

Human acceptance exposed presentation drift between the authoritative M02 world and the generated 3D battlefield/minimap. PR #15 corrected presentation only; authoritative gameplay rules were not changed.

The permanent corrected presentation baseline is:

- generated terrain reads authoritative `GeneratedWorld.terrain` / `biome` cells directly
- no M01-style coplanar generated ground/river proxy overlap
- no duplicate always-visible freezable-water overlay
- complete generated Woodland and Highlands presentation
- dynamic Ice only where `TerrainState.surface` is ICE
- live minimap aligned to the generated world
- live player-unit markers
- enemy-unit markers only when `visibleToPlayer`
- separate Core markers
- live Ice and burning minimap state
- coordinate regression coverage across deterministic blocks 0, 42, and 1,000,000

---

## 4. Automated verification

PR #14:

- CI `34041915124` — PASS
- 25 test files / 130 tests — PASS
- M06 focused suite 9/9 — PASS
- M02 2,048-seed hard-invariant regression — PASS
- M01–M05 regressions — PASS
- strict TypeScript — PASS
- production Vite build — PASS

PR #15:

- PR CI `34044796173` — PASS
- post-merge main CI `34044869076` — PASS
- GitHub Pages `34044869041` — PASS

No known determinism break, required-test failure, or broken production build remains at closure.

---

## 5. Human WebGL acceptance

The deployed runtime passed the required human acceptance sequence:

- Destroy smoke completion — PASS
- Boss Hunt smoke completion — PASS
- score/result readability — PASS
- visible boss and perceptible elemental battlefield behavior — PASS
- Replay Last reaches `REPLAY MATCH` — PASS
- Retry Block reloads the same block/run options — PASS
- Next Block advances block height while retaining run options — PASS
- corrected terrain / river presentation — PASS
- live minimap alignment — PASS
- moving player-unit minimap markers — PASS
- final normal-pace start-to-finish run checklist — PASS

The final standard-run PASS closes the experiential gate covering the requested full-run questions as a whole. No exact outcome or duration is asserted beyond that accepted checklist.

Core Critical entry, Engineer recovery, and final defeat are covered by automated M06 tests. Closure did not require adding a production cheat or artificially forcing that rare state.

---

## 6. Deferred work

The following were explicitly not required for M06 closure:

- optional third victory family / Objective Control
- PEPEPOW RPC block fetching
- Daily / Official Block challenge
- leaderboard and score submission architecture
- remote replay verification service
- wallet functionality
- final environment/unit art, animation, VFX, audio, weather, and broad UI polish
- advanced collision/steering
- full 60–80-upgrade content envelope

PEPEPOW challenge/network-facing work moves to M07. Final combat/visual/audio polish remains M08+.

---

## 7. Handoff

M07 must preserve the M06 deterministic run and replay identity. In particular:

- simulation must not fetch PEPEPOW data directly
- Block Height + Ruleset Version remain the primary challenge identity
- manual/practice mode must work without RPC
- RPC failure must not prevent local play
- challenge, score, and replay identity must remain reproducible
- no wallet requirement is introduced without separate approval

Canonical next action is defined in `docs/PROJECT_CONTEXT.md` and `docs/ROADMAP.md`.
