# M05 — Enemy War Closure Report

**Status:** CLOSED  
**Human WebGL acceptance:** PASS — 2026-09-06  
**Primary implementation PR:** #8  
**Acceptance-hardening PR:** #9  
**Fair enemy logistics PR:** #10  
**Pre-closure documentation PR:** #11  
**Playtest-readability PR:** #12  
**Final runtime baseline:** `7e0e5082d1e0c1ed44d8546f0031d45f4a3899a6`

---

## 1. Goal

M05 set out to create a fair but strategically active opponent that produces pressure without cheating, while extending rather than replacing the CLOSED M01–M04 systems.

That goal is satisfied for the milestone scope.

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
- deterministic browser playtest query parameters: `faction=iron|flame|wild` and `difficulty=casual|standard|hard`

---

## 3. Acceptance criteria

### AI cannot see hidden current player state

**PASS.**

Automated tests prove hidden player units and hidden player-owned regions are not learned from authoritative live state alone. Direct enemy ATTACK pursuit is also severed when the target leaves legal enemy visibility.

### AI uses last-known information

**PASS.**

Visible player units enter the enemy blackboard with position, region, strength, last-seen tick, and confidence. After leaving visibility, their current live position is no longer followed; remembered information decays deterministically.

### AI can make imperfect but plausible decisions

**PASS.**

The AI chooses among scouting, expansion, defense, raids, attacks, POI contests, and regrouping using only legal knowledge plus deterministic utility scoring. Human WebGL acceptance confirmed the resulting enemy behavior is plausible/readable enough for the M05 milestone.

### AI can raid supply

**PASS.**

End-to-end acceptance proves legally observed player supply can produce a RAID decision and issue the existing MOVE + CAPTURE command path toward the selected player-supplied region.

### AI can retreat / regroup

**PASS.**

End-to-end acceptance proves a badly damaged and outmatched enemy force can choose REGROUP and issue a MOVE toward its own Core region.

### Factions feel behaviorally distinct

**PASS.**

Faction weights and production profiles are materially distinct: Iron Legion favors stronger defense/heavier line composition, Flame Cult favors raids/attacks and Elementalist production, and Wild Horde emphasizes scouting/raiding with faster/light unit preferences. Human WebGL acceptance passed the faction-behavior/readability gate.

### Difficulty changes intelligence / tempo more than raw stat cheating

**PASS.**

Casual, Standard, and Hard use different decision intervals, memory decay, and minimum action scores. Tests verify enemy unit health, attack damage, and attack range remain unchanged between difficulty profiles.

### No arbitrary unit spawning beside the player base

**PASS.**

Enemy reinforcements require normal M03 producer construction, resource payment, population validation, production queue timing, and producer-local spawning. No arbitrary beside-base spawning path is used.

---

## 4. Automated verification

Implementation and regression verification passed before closure.

Evidence:

- PR #8 — Enemy War core: merged
- PR #9 — RAID / REGROUP end-to-end acceptance: merged
- PR #10 — fair enemy production logistics: merged
- automated gameplay baseline `main`: `144a93b8e73f1885f266a0981166056d9d8f8aaf`
- main CI run `34036742615`: **SUCCESS**
- GitHub Pages run `34036742620`: **SUCCESS**
- final automated suite: **24 test files / 121 tests PASS**
- strict TypeScript / production Vite build: PASS
- M02 2,048-seed hard-invariant regression: PASS
- M01–M04 regression tests remain green

The final browser-readability follow-up PR #12 merged at `7e0e5082d1e0c1ed44d8546f0031d45f4a3899a6`.

Final runtime verification after PR #12:

- main CI run `34037645488`: **SUCCESS**
- GitHub Pages run `34037645465`: **SUCCESS**

Known PlayCanvas bundle-size warning remains non-blocking.

---

## 5. Human WebGL acceptance

Human browser playtest on 2026-09-06: **PASS**.

The deployed M05 runtime was accepted after the enemy debug state was surfaced for practical browser verification. The acceptance covered the M05 behavior/readability gate, including active enemy intent, fair imperfect-information behavior, faction distinction, and absence of visibly arbitrary beside-base spawning.

This satisfies the final human-only requirement for M05 closure.

---

## 6. Deferred beyond M05

The following are not M05 blockers and remain intentionally deferred:

- final victory / defeat and full-run completion — M06
- bosses and finale objective framework — M06
- complete 25–35 minute balance tuning — M06 and later playtesting
- PEPEPOW RPC/challenge systems — M07
- final combat/VFX/audio/environment/UI polish — M08
- advanced unit collision/steering and other known pre-existing technical debt

---

## 7. Closure decision

**M05 — Enemy War is CLOSED.**

The enemy-war architecture is deterministic, fog-bounded, last-known-information driven, strategically active, faction/difficulty aware, integrated with the existing economy/territory command paths, able to produce legitimate reinforcements without spawn cheating, regression-safe, deployed successfully, and human-verified in WebGL.

The next milestone is **M06 — Full Run**.
