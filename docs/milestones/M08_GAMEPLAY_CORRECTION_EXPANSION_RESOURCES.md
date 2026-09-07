# M08 Gameplay Correction — Expansion and Resource Clarity

Status: IN PROGRESS

This correction responds to operator playtest findings after PR #31.

## Confirmed issues

1. Outpost expansion appears to stop after the first expansion because the canonical 10 Influence starting stock is consumed by the first 10-Influence Outpost. The UI currently accepts placement without explaining the missing Influence.
2. Material Deposit has an explicit Extractor, while Mana Spring currently grants automatic regional income. This conflicts with the canonical design language, which specifies a Mana Well.
3. Watchtower / Barrier Hub / Mana Beacon are exposed as player buttons even though their baseline gameplay effects are not implemented; this creates dead controls.

## Correction

- Preserve canonical Influence pacing: Outposts still cost 180 Material + 10 Influence and POI capture still grants +10 Influence.
- Make affordability and the next Influence source visible before placement; rejected BUILD attempts must not look like successful queues.
- Add `MANA_WELL` as the explicit structure for Mana Spring harvesting.
- Material Deposit -> Extractor; Mana Spring -> Mana Well.
- Remove automatic Mana Spring income; Mana Well supplies the canonical +2/sec normal / +3/sec rich output, with the existing disconnected 50% penalty.
- Hide inactive Outpost specialization buttons until their gameplay effects exist.
- Preserve deterministic strategic commands, replay, and state hashing.

## Acceptance

- A player at 0 Influence is clearly told to capture a POI before placing the next Outpost.
- After gaining +10 Influence, chained adjacent Outpost expansion remains valid.
- Extractor can only target Material Deposit.
- Mana Well can only target Mana Spring.
- Mana income from a spring requires a completed Mana Well.
- No dead Outpost specialization buttons are visible.
- Full regression, strict TypeScript, and production build pass.
