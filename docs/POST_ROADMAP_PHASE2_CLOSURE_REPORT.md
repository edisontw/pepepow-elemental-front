# PEPEPOW Elemental Front — Post-Roadmap Phase 2 Closure Report

**Phase:** Element access and caster authority  
**Status:** CLOSED  
**Implementation branch / PR:** `phase2-element-authority` / #40  
**Validated implementation head:** `5b8437a0ed77e81c1375c9c6887c6d82aabc1587`  
**Implementation validation:** CI #191 / run `34369956229` — PASS  
**Canonical-docs PR validation:** CI #193 / run `34370468837` — PASS

---

## 1. Scope completed

Phase 2 adopts the frozen `POST_ROADMAP_PHASE1_IMPLEMENTATION_CONTRACT.md` as authoritative runtime behavior.

Implemented:

- exactly two distinct starting Elemental Attunements per standard player state;
- authoritative per-player Attunement state;
- one `ELEMENTALIST` archetype with immutable Fire / Water / Ice / Lightning alignment selected at training time;
- non-Attuned Elementalist training rejection;
- aligned Elementalist production bookkeeping through delayed completion;
- semantic `CAST_TACTICAL` and `CAST_STRATEGIC` commands;
- authoritative Tactical / Strategic spell metadata;
- deterministic Tactical caster selection independent of UI selection order;
- caster-local Tactical cooldowns;
- player-global Strategic spell cooldowns;
- Elemental Core / Arcane Tower / connected Mana Beacon Outpost Strategic spell anchors;
- deterministic Strategic anchor selection and range validation;
- static combat-role tags and dynamic elemental/status tags;
- derived conductivity including `METAL`, Wet and terrain state;
- ally-safe direct Tactical damage/control with faction-agnostic persistent environmental consequences;
- persistent Strategic spell zones included in authoritative state;
- Shrine upgrade eligibility filtered by current Attunements;
- player Tactical hotkeys routed through semantic v2 commands;
- Attuned Elementalist training choices exposed in the production UI;
- Mana HUD updated for Attunements, aligned casters and caster-local cooldowns.

Legacy `CAST` remains only for closed-system regression/internal boss migration paths.

---

## 2. Competitive identity

Phase 2 activates:

- gameplay/challenge ruleset: `ef-standard-v2`
- replay format: `ef-replay-v2`

Unchanged:

- world generation ruleset: `m02-standard-v1`
- M02 deterministic world generation and Golden Block semantics
- Block Height as deterministic input

Replay v2 records starting Attunements and preserves aligned training plus semantic spell commands. Attunement, Elementalist alignment, Tactical/Strategic cooldowns and active Strategic zones participate in authoritative hashing.

The existing Official Challenge ID `m08-roadmap` is retained for link continuity, but its active gameplay ruleset is upgraded to `ef-standard-v2`.

---

## 3. Automated acceptance

Final validated implementation run:

- 51 test files PASS
- 212 tests PASS
- M02 2,048-seed regression PASS
- strict TypeScript PASS
- production Vite build PASS
- CI #191 / `34369956229` PASS

The canonical-docs PR head was subsequently revalidated by CI #193 / `34370468837`, with tests and production build PASS.

Phase 2 minimum acceptance is covered by dedicated tests for:

- Attunement validation and unlock rules;
- Elementalist alignment and immutable production result;
- deterministic Tactical caster authority;
- invalid-cast Mana/cooldown safety;
- Tactical caster-local cooldowns;
- Strategic player-global cooldowns and relay legality;
- static/dynamic target tags;
- replay v2 Attunement identity and deterministic playback;
- challenge ruleset identity separation from M02 world generation.

All unaffected CLOSED M00–M08 regression tests pass.

---

## 4. Explicitly not included

Phase 2 does not attempt:

- formation redesign;
- broad unit-stat rebalance;
- advanced enemy elemental combo optimization;
- fourth-Attunement reward content;
- ultimate-spell redesign;
- final art/audio replacement;
- M02 world-generation changes.

---

## 5. Next formal work point

With elemental authority stable, the next post-roadmap work should focus on **army control and combat readability**, especially:

1. formation / group-movement redesign;
2. clearer unit-role differentiation under the new elemental authority model;
3. Tactical spell targeting/preview UX refinement;
4. Strategic spell casting UI and relay readability;
5. subsequent unit/economy/terrain balance only after those control changes are testable.

Do not reopen M00–M08 or redesign the deterministic simulation architecture without a concrete regression or explicit product decision.
