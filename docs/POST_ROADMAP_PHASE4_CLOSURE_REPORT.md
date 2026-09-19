# PEPEPOW Elemental Front — Post-Roadmap Phase 4 Closure Report

**Phase:** Hero-Lite Army Progression  
**Status:** CLOSED  
**Gameplay identity:** `ef-standard-v7`  
**Replay identity:** `ef-replay-v7`  
**World generation:** `m02-standard-v1` unchanged

## Scope delivered

Phase 4 added individual unit persistence and growth while preserving RTS army control.

Completed slices:

- **P4-A — Core Combat + Recovery**
  - explicit objective attack required for Elemental Core damage;
  - proximity alone does not damage a Core;
  - active friendly Core recovery zone;
  - deferred/intermittent Idle animation loading.

- **P4-B — Neutral Encounter Foundation**
  - the five existing generated `NEUTRAL_CAMP` POIs became combat encounters;
  - neutral faction `playerId = 2`;
  - deterministic Ancient Sentinel guardians;
  - local aggro/leash;
  - guarded camps block capture;
  - deterministic 120-XP camp-clear reward.

- **P4-C — Unit XP / Level 1–5**
  - individual authoritative XP;
  - cumulative thresholds: 60 / 150 / 280 / 450 XP for Lv2–Lv5;
  - nearby shared combat XP rather than last-hit ownership;
  - bounded linear veteran scaling from immutable base stats;
  - approximately +6% Max HP / +4% Attack Damage per level above Lv1;
  - selected-unit and group veteran UI.

- **P4-D — Veteran Presentation**
  - compact veteran pips;
  - restrained Lv3+ brass accent;
  - short level-up feedback;
  - distinct Neutral Sentinel threat ring;
  - guarded-camp visual state and tooltip feedback.

- **P4-E — Balance / Run Integration**
  - fixed Core-heal integer bias;
  - camp-XP pacing guardrails;
  - veteran snowball ceiling;
  - boss/finale guardrail;
  - run/replay validation.

## P4-E balance findings

### Core recovery

The original implementation applied 2 permille every 0.1 seconds but forced a minimum 1 HP heal each tick.

That caused unintended low-HP acceleration. For example:

- Vanguard max HP: 180
- minimum recovery: 1 HP/tick
- 10 ticks/sec
- effective recovery: 10 HP/sec ≈ 5.6% max HP/sec

This was materially above the intended 2%/sec.

The final implementation uses deterministic 0.5-second fixed-point pulses. Integer pulse amounts vary as needed, but the long-run rate is 2% max HP/sec without floating-point authoritative state.

Acceptance envelope:

- safe unit at 50% HP: approximately 25 seconds to full;
- no normal recovery while actively attacking;
- no normal recovery while actively targeted by a hostile unit;
- no normal recovery from a Critical/Destroyed Core.

### Neutral-camp reward pacing

The 120-XP camp reward remains unchanged.

Expected split:

- 1 participant: 120 XP;
- 2 participants: 60 XP each → Lv2;
- 3 participants: 40 XP each → remain Lv1;
- 6 participants: 20 XP each → remain Lv1.

This keeps small-squad exploration rewarding without leveling an entire starting army from one camp.

### Veteran ceiling

Final veteran scaling remains linear rather than multiplicative:

- Lv5 Max HP: approximately +24%;
- Lv5 Attack Damage: approximately +16%.

Replacement units still enter at Lv1 / 0 XP, so veteran value depends on survival.

### Boss / Finale interaction

A theoretical fully Lv5 starting squad remains above an 80-second boss TTK across current boss health/armor definitions.

Veteran progression therefore improves Finale performance without turning the boss into a trivial burst target.

Standard run phase and Finale timing remain unchanged.

## Validation

Authoritative P4-E code validation:

- **74 test files PASS**
- **296 tests PASS**
- strict TypeScript PASS
- production build PASS
- GitHub Pages build PASS

New balance guardrails cover:

- camp reward splitting;
- Core recovery time envelope;
- Lv5 stat ceiling;
- boss TTK envelope.

Existing full-run, replay, challenge identity, deterministic simulation, and world-generation tests remain green.

## Version history inside Phase 4

- P4-A: `ef-standard-v4` / `ef-replay-v4`
- P4-B: `ef-standard-v5` / `ef-replay-v5`
- P4-C/P4-D: `ef-standard-v6` / `ef-replay-v6`
- P4-E closure: `ef-standard-v7` / `ef-replay-v7`

World generation remained `m02-standard-v1` throughout.

## Remaining work outside Phase 4

Phase 4 gameplay is closed.

The following are separate workstreams and are not claimed complete by this closure:

- remaining overall battlefield brightness / washed-out visual correction;
- manual WebGL/FPS visual acceptance;
- final environment-art replacement/polish where needed;
- previously deferred army-control features such as Attack Move / Hold Position unless explicitly reopened;
- the observed four-direction-looking movement/facing issue, which still requires a dedicated presentation/control investigation.

Do not reopen P4-A–P4-E by default. Reopen only for a concrete regression, playtest evidence, or an explicit new design decision.
