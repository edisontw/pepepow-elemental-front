# Audio CC0 provenance

This file records the production audio clips introduced by the 2026-09-22 audio asset replacement pass.

## Licensing authority

The authoritative source and license are the official Kenney asset pages:

- Impact Sounds — https://kenney.nl/assets/impact-sounds — Creative Commons CC0 1.0 Universal.
- RPG Audio — https://kenney.nl/assets/rpg-audio — Creative Commons CC0 1.0 Universal.
- Interface Sounds — https://kenney.nl/assets/interface-sounds — Creative Commons CC0 1.0 Universal.
- Voiceover Pack — https://kenney.nl/assets/voiceover-pack — Creative Commons CC0 1.0 Universal.

Attribution is not required by CC0, but the manifest retains Kenney attribution and the original filenames for provenance.

## Included unmodified clips

| Purpose | Original file(s) | Pack |
|---|---|---|
| Weapon release / attack | `drawKnife1.ogg`, `drawKnife2.ogg` | RPG Audio |
| Unit hit | `impactMetal_light_000.ogg`, `impactMetal_light_001.ogg` | Impact Sounds |
| Unit death / fall | `impactMetal_medium_000.ogg`, `impactMetal_medium_001.ogg` | Impact Sounds |
| Core / structure impact | `impactPlate_heavy_000.ogg`, `impactPlate_heavy_001.ogg` | Impact Sounds |
| Command confirmation | `confirmation_001.ogg`, `confirmation_002.ogg` | Interface Sounds |
| Army movement | `footstep00.ogg`, `footstep01.ogg` | RPG Audio |
| Move voice | `go.ogg` | Voiceover Pack |
| Attack voice | `war_target_engaged.ogg` | Voiceover Pack |
| Selection / hold voice | `ready.ogg` | Voiceover Pack |

The files are stored under `public/audio/` and are not re-encoded.

## Intake verification

Because the connected GitHub workflow was used to move binary assets into this repository, selected source bytes were checked against independent public GitHub mirrors. Matching Git blob SHAs were confirmed for representative Impact, RPG Audio, Interface Sounds, and all three selected voice clips before inclusion. The mirrors are byte-transport checks only; they are not the licensing authority.

Runtime resolves these files through stable IDs in `data/audio/manifest.json`. Missing or not-yet-decoded samples fall back to the existing procedural audio or browser speech presentation and never affect simulation authority.
