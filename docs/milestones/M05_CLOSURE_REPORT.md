# M05 — Enemy War Closure Report

**Status:** IN_PROGRESS — HUMAN WEBGL ACCEPTANCE PENDING  
**Human WebGL acceptance:** PENDING  
**Primary implementation PR:** #8  
**Acceptance-hardening PR:** #9  
**Fair enemy logistics PR:** #10  
**Latest deployed runtime baseline:** `144a93b8e73f1885f266a0981166056d9d8f8aaf`

---

## 1. Goal

M05 set out to create a fair but strategically active opponent that produces pressure without cheating, while extending rather than replacing the CLOSED M01–M04 systems.

The implementation and automated acceptance are complete. Milestone closure remains blocked only on the required human WebGL behavior/readability smoke.

---

## 2. Permanent implementation delivered

M05 adds deterministic enemy decision-making on top of the existing tactical, generated-world, economy/territory, and roguelite runtimes.

Permanent baseline now includes:

- authoritative enemy blackboard constrained by enemy fog visibility
- last-known player-unit memory with deterministic confidence decay
- legal region, POI, building, territory, and supply observations
- strategic Utility AI actions: `SCOUT`, `EXPAND`, `DEFEND`, `RAID`, `ATTACK`, `CONTEST_POI`, and `REGROUP`
- tactical execution through the existing authoritative MOVE / ATTACK command queue
- strategic execution through the existing M03 CAPTURE command queue
- hidden-target pursuit protection: when a player unit leaves enemy visibility, direct entity pursuit is stopped and the enemy can only move toward remembered last-known position
- three behavior profiles: Iron Legion, Flame Cult, and Wild Horde
- three difficulty profiles: Casual, Standard, and Hard
- difficulty changes decision tempo, memory behavior, and minimum action thresholds rather than raw unit combat statistics
- deterministic Director pressure curve
- recovery windows after observed player losses
- anti-turtle pressure based on observed player movement history
- deterministic enemy production logistics using the existing M03 resource, BUILD, TRAIN, population, build-time, and train-time systems
- faction-specific legitimate producer/unit cycles without free units, resource multipliers, or arbitrary spawning beside the player base
- M05 authoritative state hashes integrated with the existing combined deterministic hash chain
- browser debug rows for enemy faction, difficulty, intent, pressure, legal visible/remembered information, known supply, decision count, and AI hash
- browser query parameters for deterministic playtest setup: `faction=iron|flame|wild` and `difficulty=casual|standard|hard`

---

## 3. Acceptance criteria

### AI cannot see hidden current player state

**AUTOMATED PASS.**

Tests prove hidden player units and hidden player-owned regions are not learned from authoritative live state alone. Direct enemy ATTACK pursuit is also severed when the target leaves legal enemy visibility.

### AI uses last-known information

**AUTOMATED PASS.**

Visible player units enter the enemy blackboard with position, region, strength, last-seen tick, and confidence. After leaving visibility, their current live position is no longer followed; remembered information decays deterministically.

### AI can make imperfect but plausible decisions

**AUTOMATED STRUCTURAL PASS / HUMAN BEHAVIOR CHECK PENDING.**

The AI chooses among scouting, expansion, defense, raids, attacks, POI contests, and regrouping using only legal knowledge plus deterministic utility scoring. Human WebGL play remains required to judge whether the resulting behavior is plausibly readable in actual play.

### AI can raid supply

**AUTOMATED PASS.**

End-to-end acceptance proves legally observed player supply can produce a RAID decision and issue the existing MOVE + CAPTURE command path toward the selected player-supplied region.

### AI can retreat / regroup

**AUTOMATED PASS.**

End-to-end acceptance proves a badly damaged and outmatched enemy force can choose REGROUP and issue a MOVE toward its own Core region.

### Factions feel behaviorally distinct

**AUTOMATED STRUCTURAL PASS / HUMAN FEEL CHECK PENDING.**

Faction weights and production profiles are materially distinct: Iron Legion favors stronger defense/heavier line composition, Flame Cult strongly favors raids/attacks and Elementalist production, and Wild Horde emphasizes scouting/raiding with faster/light unit preferences. Final feel/readability requires human comparison in WebGL.

### Difficulty changes intelligence / tempo more than raw stat cheating

**AUTOMATED PASS.**

Casual, Standard, and Hard use different decision intervals, memory decay, and minimum action scores. Tests verify enemy unit health, attack damage, and attack range remain unchanged between difficulty profiles.

### No arbitrary unit spawning beside the player base

**AUTOMATED PASS.**

The initial M05 AI does not arbitrarily create units. The logistics follow-up only creates additional enemy units after normal M03 producer construction, resource payment, population validation, production queue timing, and producer-local spawning.

---

## 4. Automated verification

Final deployed implementation baseline:

- PR #8 — Enemy War core: merged
- PR #9 — RAID / REGROUP end-to-end acceptance: merged
- PR #10 — fair enemy production logistics: merged
- final runtime `main`: `144a93b8e73f1885f266a0981166056d9d8f8aaf`
- main CI run `34036742615`: **SUCCESS**
- GitHub Pages run `34036742620`: **SUCCESS**
- final CI suite: **24 test files / 121 tests PASS**
- strict TypeScript / production Vite build: PASS
- M02 2,048-seed hard-invariant regression: PASS
- M01–M04 regression tests remain green

Known PlayCanvas bundle-size warning remains non-blocking.

---

## 5. Human WebGL acceptance — pending

The final human-only smoke should use the deployed runtime and verify behavior rather than internal implementation.

Recommended minimal checks:

1. Open the standard battlefield with `?faction=iron&difficulty=hard` and confirm the debug overlay reads `M05 ENEMY WAR`, `IRON_LEGION`, and `HARD`.
2. Let the battle run and confirm enemy intent changes over time and enemy units visibly leave their starting area to scout / expand / contest rather than remaining permanently idle.
3. Move player units into enemy contact and then retreat into fog; confirm enemies do not appear to maintain perfect live tracking indefinitely.
4. Compare the same block with `faction=flame` and `faction=wild`; confirm the observed activity/intent feels meaningfully different rather than identical.
5. Confirm enemy pressure remains understandable and that no enemy unit suddenly appears beside the player base without having traveled/been produced normally.

If these checks pass, record human WebGL acceptance as PASS, change this report to CLOSED, update `ROADMAP.md` to M05 CLOSED → M06 OPEN, and compact `PROJECT_CONTEXT.md` to the M06 handoff.

---

## 6. Deferred beyond M05

The following are not M05 blockers:

- final victory / defeat and full-run completion — M06
- bosses and finale objective framework — M06
- complete 25–35 minute balance tuning — M06 and later playtesting
- PEPEPOW RPC/challenge systems — M07
- final combat/VFX/audio/environment/UI polish — M08
- advanced unit collision/steering and other known pre-existing technical debt

---

## 7. Closure decision

**M05 is not CLOSED yet.**

Implementation, automated acceptance, full regression, build, and deployment are green. The only remaining closure gate is the required human WebGL enemy-behavior/readability acceptance.