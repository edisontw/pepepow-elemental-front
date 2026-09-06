# M06 — Full Run Closure Gap Audit

**Status:** IN_PROGRESS — HUMAN WEBGL ACCEPTANCE PENDING  
**Implementation PR:** #14  
**Audit date:** 2026-09-06

---

## 1. Closure principle

M06 closes only when the existing M01–M05 systems form a playable deterministic start-to-finish run and the remaining browser-only acceptance has been performed on the deployed WebGL runtime.

M00–M05 are CLOSED and are not reopened by this audit.

---

## 2. Required for M06 closure

### Authoritative full-run state

**Implemented / automated.**

The runtime now has deterministic run phases, finale gating, victory/defeat, objective state, Core Critical State, score/result state, and M06 state-hash integration on top of M05 rather than in a parallel simulation.

### Destroy victory family

**Implemented / automated.**

The generated enemy Core becomes the finale target. Player combat units in legal assault range apply deterministic structure damage and can produce `VICTORY / ENEMY_CORE_DESTROYED`.

### Boss Hunt victory family

**Implemented / automated.**

The generated boss site is reused. Frost Titan, Storm Colossus, and Infernal Behemoth are selected deterministically and modify the battlefield through existing Freeze, Lightning, Fire, and Heat command paths. Boss defeat produces `VICTORY / BOSS_DEFEATED`.

### Defeat and Core Critical State

**Implemented / automated.**

The player Core has one authoritative critical recovery window per run. First zero HP enters a 300-tick / 30-second Critical State. Nearby Engineers repair it toward the required 10% recovery threshold. Expiry or a later zero-HP event produces defeat.

### Score and results

**Implemented / automated.**

Final results contain outcome, reason, duration, and deterministic score components for victory, time, army survival, territory, objectives, resource efficiency, and elemental style.

### Replay playback and verification

**Implemented / automated.**

External GAME / STRATEGIC / ROGUELITE commands are recorded with exact block/ruleset/world/faction/difficulty/mode identity. Playback reuses the same M06 simulation. Checkpoint verification reports `MATCH` when the replay reaches the expected state hash and `DIVERGED` when the command stream is altered.

### Retry / next-block flow

**Implemented; browser interaction pending.**

The results UI provides Retry Block, Next Block, Replay Last, and mode switching. The flow is local and requires no RPC. Final button/navigation behavior remains part of WebGL acceptance.

### Event pacing integration

**Implemented / automated; experiential acceptance pending.**

The two deterministic M04 world events are integrated into the standard M06 run at approximately 14 and 19 minutes, before the standard 24-minute finale gate. Human playtest must still confirm that the events are readable and meaningfully affect decisions.

### Standard run pacing

**Mechanically bounded; human start-to-finish acceptance pending.**

Standard phase boundaries are deterministic and the time-based finale gate is 24:00, allowing the intended approximately 25–35 minute complete-run envelope once finale combat is included. Momentum can unlock the finale earlier after sufficient territory, Shrines, and completed non-Core buildings.

---

## 3. Already satisfied by CLOSED milestones

The following parts of the M06 player loop already exist and must not be rebuilt:

- Start / deterministic generated battlefield — M02
- Scout / move / fog / tactical control — M01 + M05
- Expand / capture territory — M03
- Build / economy / production — M03
- Fight / elemental systemic combat — M01
- Acquire upgrades — M04
- Enemy strategic pressure — M05
- Deterministic world events — M04, with M06 pacing integration

M06 only connects these permanent systems into the full-run lifecycle.

---

## 4. Explicitly deferred beyond M06

The following are not M06 closure blockers:

- optional third victory family / Objective Control
- PEPEPOW RPC block fetching
- Daily / Official Block challenge
- leaderboard and score submission architecture
- remote replay verification service
- wallet functionality
- final unit art, VFX, audio, animation, environment art, and broad UI polish

These remain M07/M08 or later work.

---

## 5. Remaining human WebGL acceptance

After PR #14 is merged and GitHub Pages deployment succeeds, verify the deployed runtime.

### A. Smoke completion flow

Use a smoke run to quickly verify presentation and navigation:

- Run HUD is visible and updates phase/time/Core/objective health.
- Finale becomes available.
- Destroy or Boss Hunt can reach a visible result screen.
- Score breakdown is readable.
- Retry Block reloads the same block.
- Next Block advances the block height.
- Replay Last starts playback and eventually displays `REPLAY MATCH`.
- Boss Hunt displays a visible boss and its elemental battlefield effects.

### B. Core Critical readability

Confirm in browser that:

- Core Critical is clearly visible.
- Countdown is understandable.
- moving an Engineer near the Core communicates/reaches recovery.
- final defeat is explainable.

### C. Standard start-to-finish run

Complete at least one normal-pace run and answer:

- Were there meaningful decisions throughout?
- Could the player explain the loss, if any?
- Did the run produce a memorable systemic event?
- Did the next seed feel worth trying?
- Was the overall duration plausibly within the approximately 25–35 minute target?

Only this human-only portion remains a closure blocker once final CI/build and Pages deployment are green.

---

## 6. Current closure decision

**M06 is not yet CLOSED.**

The implementation is at pre-closure stage. Automated acceptance covers the authoritative run loop; final closure requires a green final PR/main verification and human WebGL start-to-finish acceptance.