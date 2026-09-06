# M06 — Full Run Closure Gap Audit

**Status:** IN_PROGRESS — FINAL STANDARD WEBGL RUN PENDING  
**Implementation PR:** #14  
**Presentation fix PR:** #15  
**Runtime baseline:** `fb2a0fb1129287413803aa9cee3e2906a5ef22a3`  
**PR #15 CI:** `34044796173` — PASS  
**Post-merge main CI:** `34044869076` — PASS  
**GitHub Pages:** `34044869041` — PASS  
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

**PASS — implemented, automated, and human smoke accepted.**

The generated enemy Core becomes the finale target. Player combat units in legal assault range apply deterministic structure damage and can produce `VICTORY / ENEMY_CORE_DESTROYED`.

Human WebGL Destroy smoke on 2026-09-06: **PASS**. The deployed runtime showed the M06 Destroy HUD, entered the smoke Finale, allowed the enemy Core to be destroyed through the assault-radius flow, and displayed the Victory result/score screen.

### Boss Hunt victory family

**PASS — implemented, automated, and human smoke accepted.**

The generated boss site is reused. Frost Titan, Storm Colossus, and Infernal Behemoth are selected deterministically and modify the battlefield through existing Freeze, Lightning, Fire, and Heat command paths. Boss defeat produces `VICTORY / BOSS_DEFEATED`.

Human WebGL Boss Hunt smoke on 2026-09-06: **PASS**. The deployed runtime showed the Boss Hunt HUD, entered the smoke Finale, displayed the generated boss marker and perceptible elemental battlefield behavior, allowed boss HP to be reduced through combat proximity, and displayed the Victory result/score screen after boss defeat.

### Defeat and Core Critical State

**PASS — authoritative logic automated; browser readability to be observed if naturally encountered.**

The player Core has one authoritative critical recovery window per run. First zero HP enters a 300-tick / 30-second Critical State. Nearby Engineers repair it toward the required 10% recovery threshold. Expiry or a later zero-HP event produces defeat.

Automated M06 coverage verifies Critical entry, Engineer recovery, and final defeat. Human closure does not require adding a production debug cheat or deliberately forcing this rare state. If Core Critical occurs during the final standard run, its countdown, recovery communication, and defeat explainability must be readable.

### Score and results

**PASS for Destroy + Boss Hunt smoke; automated coverage complete.**

Final results contain outcome, reason, duration, and deterministic score components for victory, time, army survival, territory, objectives, resource efficiency, and elemental style. Destroy and Boss Hunt smoke both confirmed the deployed result/score presentation is visible.

### Replay playback and verification

**PASS — implemented, automated, and human playback accepted.**

External GAME / STRATEGIC / ROGUELITE commands are recorded with exact block/ruleset/world/faction/difficulty/mode identity. Playback reuses the same M06 simulation. Replay commands are injected at their authoritative target tick so upgrade/status-dependent CAST semantics are evaluated at the correct run state. Checkpoint verification reports `MATCH` when the replay reaches the expected state hash and `DIVERGED` when the command stream is altered.

Human WebGL replay acceptance on 2026-09-06: **PASS**. `Replay Last` replayed the completed Boss Hunt smoke run and reached `REPLAY MATCH` on the deployed runtime.

### Retry / next-block flow

**PASS — implemented and human browser accepted.**

The results UI provides Retry Block, Next Block, Replay Last, and mode switching. Human WebGL acceptance on 2026-09-06 confirmed that Retry Block reloads the same block/run options and Next Block advances the block height while retaining the run options.

### Generated terrain and minimap presentation

**PASS — presentation fix merged, deployed, and human accepted.**

Human WebGL acceptance identified that the generated terrain presentation was incomplete, the river looked incorrect, and the displayed battlefield map did not behave as a correct live minimap.

Root-cause audit found presentation-only drift from the authoritative M02 world:

- generated water was presented through M01-style per-row proxy zones rather than directly from authoritative generated cells;
- ground and river proxy planes were coplanar, producing a z-fighting risk;
- the largest water strip received an additional always-present freezable-water presentation overlay;
- generated Woodland presentation was truncated and Highlands were not presented;
- the battlefield map showed static spawn markers rather than live unit positions.

PR #15 fixed presentation without modifying authoritative simulation, navigation, RNG, replay, economy, roguelite, enemy-war, or scoring rules. Generated 3D terrain now reads `GeneratedWorld.terrain` / `biome` directly, dynamic Ice reflects `TerrainState.surface`, and the minimap receives live player units, visible enemy units, Core markers, Ice, and burning state. Minimap coordinate regression coverage verifies exact world/simulation alignment across deterministic blocks 0, 42, and 1,000,000.

PR #15 CI `34044796173`: **PASS**. Post-merge main CI `34044869076`: **PASS**. GitHub Pages `34044869041`: **PASS**.

Human WebGL re-acceptance on 2026-09-06: **PASS**. The deployed terrain/river presentation was accepted, the minimap matched the battlefield layout, and moving player units were reflected by live minimap markers.

### Event pacing integration

**Implemented / automated; experiential acceptance pending final standard run.**

The two deterministic M04 world events are integrated into the standard M06 run at approximately 14 and 19 minutes, before the canonical 27-minute time-based finale gate. Human playtest must still confirm that the events are readable and meaningfully affect decisions.

### Standard run pacing

**Mechanically bounded; final human start-to-finish acceptance pending.**

Standard phase boundaries follow the canonical five-act timing: Discovery 0–5 minutes, Commitment 5–12, Expansion 12–20, Escalation 20–27, and the time-based Finale from 27 minutes. Momentum can unlock the finale from 15 minutes onward after sufficient territory, Shrines, and completed non-Core buildings, supporting the documented fast-aggressive run range while preserving the standard approximately 25–35 minute target.

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

### A. Smoke completion flow

Current status:

- Run HUD visible and updates phase/time/Core/objective health — **PASS**
- Finale becomes available — **PASS**
- Destroy reaches a visible result screen — **PASS**
- Boss Hunt reaches a visible result screen — **PASS**
- Score breakdown readable — **PASS**
- Boss Hunt displays a visible boss and perceptible elemental battlefield effects — **PASS**
- Replay Last starts playback and eventually displays `REPLAY MATCH` — **PASS**
- Retry Block reloads the same block — **PASS**
- Next Block advances the block height — **PASS**
- Generated terrain / river presentation matches the authoritative world without visible overlap artifacts — **PASS**
- Live minimap tracks moving player units on the same terrain layout — **PASS**

### B. Core Critical readability

Authoritative mechanics are fully automated and PASS. No artificial trigger is required for closure. If Core Critical naturally occurs during the final standard run, verify:

- Core Critical is clearly visible;
- countdown is understandable;
- Engineer recovery communication is understandable if recovery occurs;
- final defeat is explainable if the Core is lost.

### C. Standard start-to-finish run — FINAL BLOCKER

Complete at least one normal-pace run and judge:

- meaningful decisions throughout;
- loss explainability if defeated;
- at least one memorable/readable systemic event;
- whether the next seed feels worth trying;
- overall duration plausibly within the approximately 25–35 minute standard target, allowing the documented faster momentum path when earned.

---

## 6. Current closure decision

**M06 is not yet CLOSED.**

Destroy smoke, Boss Hunt smoke, deterministic replay playback, Retry Block, Next Block, and the corrected generated terrain/live minimap are human-accepted. Automated Core Critical behavior is complete. The only remaining M06 closure blocker is one human standard start-to-finish run on the deployed runtime.