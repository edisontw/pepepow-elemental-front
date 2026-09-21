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


## Elemental + ambience extension — 2026-09-22

Additional licensing authorities:

- 80 CC0 RPG SFX — https://opengameart.org/content/80-cc0-rpg-sfx — rubberduck — Creative Commons CC0.
- 40 CC0 water / splash / slime SFX — https://opengameart.org/content/40-cc0-water-splash-slime-sfx — rubberduck — Creative Commons CC0.
- 30 CC0 SFX loops — https://opengameart.org/content/30-cc0-sfx-loops — rubberduck — Creative Commons CC0.
- Sci-fi Sounds — https://kenney.nl/assets/sci-fi-sounds — Kenney — Creative Commons CC0.
- Impact Sounds — https://kenney.nl/assets/impact-sounds — Kenney — Creative Commons CC0.

| Purpose | Original file(s) | Source |
|---|---|---|
| Fire spell | `spell_fire_01.ogg`, `spell_fire_02.ogg` | 80 CC0 RPG SFX |
| Water burst | `splash_03.ogg`, `splash_05.ogg` | 40 CC0 water / splash / slime SFX |
| Ice crystallization | `impactGlass_light_000.ogg` | Kenney Impact Sounds |
| Ice fracture | `impactGlass_heavy_000.ogg` | Kenney Impact Sounds |
| Chain lightning | `laserSmall_000.ogg`, `laserSmall_001.ogg` | Kenney Sci-fi Sounds |
| Battlefield ambient bed | `ambient_01.ogg` | 30 CC0 SFX loops |
| Distant industrial bed | `machine_02.ogg` | 30 CC0 SFX loops |

The runtime layers these samples with restrained procedural synthesis. This is intentional: the recorded/transient material provides physical texture, while the procedural layer preserves clear Fire / Water / Ice / Lightning differentiation at RTS scale. Battlefield ambience loops at low gain and remains presentation-only.

The Kenney ice and lightning source files were byte-checked against independent public GitHub mirrors before inclusion. The OpenGameArt pack pages above are the licensing authority for the rubberduck source files.


## Radio command voice extension — 2026-09-22

Additional unmodified Kenney Voiceover Pack clips:

| Command | Original file | Runtime use |
|---|---|---|
| Attack Move | `war_go_go_go.ogg` | Short urgent advance acknowledgement |
| Hold Position | `hold.ogg` | Dedicated hold acknowledgement |

Both files are from the same official Kenney Voiceover Pack source already listed above and are CC0. Their Git blob SHAs were independently matched between two public mirrors before inclusion.

The runtime applies a presentation-only radio chain to command voices: high-pass and low-pass filtering, moderate compression, a very short synthetic radio click/static cue, and temporary ambience ducking so spoken orders stay intelligible. The source OGG files remain unmodified in the repository.

`war_go_go_go.ogg` is an independent Kenney CC0 recording. It is not a Counter-Strike asset and no Counter-Strike audio was imported.
