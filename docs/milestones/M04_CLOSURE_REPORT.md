# M04 — Roguelite Layer Closure Report

**Status:** CLOSED  
**Human WebGL acceptance:** PASS — 2026-09-06  
**Primary implementation PR:** #5  
**Playtest-readability follow-up PR:** #6  
**Final pre-closure runtime baseline:** `7547469bb773d9edbb777bf83e879fca91c03e31`

---

## 1. Goal

M04 set out to make generated runs produce different deterministic build paths through Shrines, upgrades, world events, Mana progression, and early synergy detection without replacing the CLOSED M01–M03 foundations.

That goal is satisfied for the milestone scope.

---

## 2. Permanent implementation delivered

M04 adds an authoritative pure-TypeScript roguelite layer on top of the existing tactical, generated-world, and strategic runtimes.

Permanent baseline now includes:

- existing M02 `SHRINE` POIs as the canonical Shrine locations
- authoritative `ACTIVATE_SHRINE` and `CHOOSE_SHRINE_UPGRADE` commands
- deterministic three-choice Shrine offers
- Shrine-choice RNG identity isolated from visual RNG and unrelated gameplay streams
- data-authored upgrade definitions using generic `MODIFIER` and `TRIGGER` effects
- representative Fire, Water, Ice, Lightning, and mixed-element upgrade paths
- run-level maximum Mana progression
- early mixed-element synergy detection
- deterministic world-event scheduling and event modifiers
- M04 state hashing covering acquired upgrades, open Shrine choices, resolved Shrines, synergies, Mana progression, and event schedule
- M04 hash integration with the existing tactical + strategic deterministic hash chain
- upgrade effects connected to the current elemental runtime through Fire / Heat / Freeze radius modifiers and Lightning trigger behavior
- browser Shrine/upgrade/event HUD that enqueues commands rather than mutating gameplay state directly
- generated Shrine region locator for practical browser playtesting

The full target envelope of approximately 24 Shrine types/locations and 60–80 effects remains future content expansion. M04 intentionally proved the generic system first rather than authoring the full eventual content set.

---

## 3. Acceptance criteria

### Upgrades can be authored mostly as data

**PASS.**

The initial catalog is expressed through data definitions containing IDs, tags, descriptions, generic modifier effects, and generic trigger effects rather than upgrade-specific inheritance trees.

### Three-choice decisions alter play

**PASS.**

Shrine resolution presents exactly three deterministic choices. Chosen upgrades alter authoritative state and current elemental mechanics, including effect radii, Lightning trigger behavior, and maximum Mana.

### Several distinct build paths emerge

**PASS for M04 scope.**

Representative Fire, Water, Ice, Lightning, and mixed-element paths exist, with mixed tags and early synergy detection supporting cross-element builds.

### Different seeds encourage different choices

**PASS structurally.**

Shrine choices are generated from stable run/Shrine identity and deterministic state while remaining isolated from visual RNG. Different run identities can therefore produce different deterministic offers without perturbing unrelated streams.

### No dominant mandatory upgrade path is structurally baked in

**PASS for the initial system.**

The framework supports multiple elemental and mixed paths and does not hard-code one required upgrade chain. Full balance dominance remains a later full-run tuning concern as the content catalog expands.

### Upgrades preserve determinism and replay compatibility

**PASS.**

M04 authoritative state and command ordering are hashed, and tests cover deterministic choice reproduction, visual-RNG isolation, command ordering, modifier/trigger evaluation, world-event determinism, and combined state-hash reproduction/divergence.

---

## 4. Automated verification

Implementation and regression verification passed before closure.

Evidence:

- implementation PR #5 CI: PASS
- implementation merged to `main`: `95ad699f96a29d6461ed337ff8c1120a8b8876c8`
- Shrine locator PR #6 CI: PASS
- final pre-closure runtime `main`: `7547469bb773d9edbb777bf83e879fca91c03e31`
- final runtime main CI run `34033548041`: **SUCCESS**
- final runtime GitHub Pages run `34033548064`: **SUCCESS**
- `npm test`: PASS
- strict TypeScript / production Vite build: PASS
- M01–M03 regressions remain green through the repository CI suite

Known PlayCanvas bundle-size warning remains non-blocking.

---

## 5. Human WebGL acceptance

Human browser playtest on 2026-09-06: **PASS**.

Validated flow:

```text
Locate generated Shrine region
→ capture Shrine POI
→ open Shrine
→ exactly three upgrade choices appear
→ choose one
→ acquired-upgrade state updates
→ Shrine resolution count updates
→ Max Mana / build feedback remains readable
```

This satisfies the final human-only usability requirement for M04 closure.

---

## 6. Deferred beyond M04

The following are not M04 blockers and remain intentionally deferred:

- full 60–80-upgrade content envelope
- deeper balance tuning across complete 25–35 minute runs
- autonomous enemy strategic behavior and faction personalities — M05
- final victory/boss/full-run structure — M06
- PEPEPOW RPC/challenge layer — M07
- final VFX/audio/environment/UI polish — M08
- advanced unit collision/steering and other known pre-existing technical debt

---

## 7. Closure decision

**M04 — Roguelite Layer is CLOSED.**

The generic roguelite architecture is deterministic, data-driven, replay/hash compatible, integrated with the existing generated Shrines and elemental runtime, deployed successfully, and human-verified in WebGL.

The next milestone is **M05 — Enemy War**.
