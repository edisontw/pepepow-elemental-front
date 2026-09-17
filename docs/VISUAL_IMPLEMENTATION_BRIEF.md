# PEPEPOW Elemental Front — Visual Implementation Brief

**Status:** ACTIVE — Post-Roadmap Visual Production Pass  
**Scope:** UI, units, buildings, battlefield/environment, animation, combat feedback, and elemental VFX  
**Runtime authority:** presentation only; authoritative gameplay remains defined by the current ruleset and simulation contracts

---

## 1. Purpose

This document is the short production constraint for the current visual pass.

The goal is to move the playable build from prototype presentation toward a polished modern stylized RTS while preserving gameplay semantics, deterministic simulation, replay identity, and browser performance.

For this pass, prefer implementation over additional design documentation.

---

## 2. Read order for Work

For visual-production tasks, read only:

1. `docs/PROJECT_CONTEXT.md`
2. this file
3. `docs/UNIT_ART_ANIMATION_UPGRADE_PLAN.md` when unit art/animation is involved
4. the specific runtime files being changed
5. `media/prompts/images/POST_ROADMAP_UNIT_BUILDING_ART_PROMPTS.md` only when unit/building art direction is relevant
6. other canonical documents only when a concrete ambiguity requires them

Do not repeatedly reread the full roadmap, historical closure reports, or obsolete implementation history.

GitHub `main` is the only source of truth.

Repository content and in-game/debug UI remain English-only.

---

## 3. Locked boundaries

Do not change authoritative gameplay merely to improve presentation.

Preserve:

- pure-TypeScript authoritative simulation separated from PlayCanvas presentation;
- fixed 10 Hz simulation and render interpolation;
- deterministic gameplay RNG, command replay, and state hashes;
- `m02-standard-v1` world generation;
- current gameplay/replay identity unless a separately approved gameplay change requires a version bump;
- stable asset IDs / manifest-driven replacement.

Presentation may freely improve:

- sprites, impostors, models, and materials;
- animation;
- particles, trails, beams, decals, shaders, and lighting;
- UI layout and styling;
- camera feedback;
- audio hooks and visual timing;
- terrain and environment dressing.

Rendering presents simulation truth; it does not invent gameplay outcomes.

---

## 4. Visual direction

The active visual language is **Arcane-Industrial Frontier**.

Use:

- late-medieval military readability;
- early-industrial field engineering;
- elemental crystal / arcane power technology;
- fortified frontier architecture;
- practical war machines rather than futuristic vehicles;
- human-scale infantry for ordinary troops;
- constructs and heavy machinery for Golem / Siege roles;
- strong silhouettes readable from an elevated RTS camera;
- broad forms before small detail;
- restrained materials and emissive elemental accents.

Avoid:

- direct imitation of Age of Empires, StarCraft, Warcraft, Warhammer, or another franchise;
- generic sci-fi robot armies;
- modern firearms, tanks, cyberpunk neon, or hologram clutter;
- ornate high-fantasy costume overload;
- detail that disappears at normal gameplay zoom.

Ownership and element identity must remain separate:

- team color = faction ownership;
- elemental glow/material/VFX = Fire / Water / Ice / Lightning state or alignment.

The existing unit/building concept specification remains:

- `media/prompts/images/POST_ROADMAP_UNIT_BUILDING_ART_PROMPTS.md`

---

## 5. Production priority

Work in coherent visual slices rather than replacing the entire game at once.

### Priority A — vertical slice

1. polished HUD / command-card visual baseline;
2. Vanguard presentation;
3. Elementalist presentation, including clear alignment identity;
4. Elemental Core presentation;
5. core combat feedback and Fire / Water / Ice / Lightning VFX.

### Priority B — expand the language

- Barracks, Arcane Tower, Workshop, Outpost, Extractor, Mana Well;
- Ranger, Scout, Engineer, Spear Guard;
- battlefield terrain materials, water, forest, ice, resources, and major props;
- construction and production feedback;
- Strategic spell and relay/network readability.

### Priority C — heavy polish

- Golem and Siege Construct;
- advanced destruction / construction states;
- final atlas/LOD/quality-setting pass;
- remaining high-value environment and VFX polish.

Do not block a coherent slice waiting for every final asset.

---

## 6. Unit and building asset pipeline

### Units — authoritative production path

Standard combat units use a **high-quality 2.5D animated impostor pipeline** as the primary production and runtime target.

```text
canonical character art
→ 8-direction consistent character
→ Idle / Move / Attack / Hit / Death
→ WebP sprite / atlas
→ PlayCanvas billboard / impostor
```

Elementalists may add `Cast`.

Requirements:

- all eight views must preserve one canonical identity;
- use the shared runtime direction convention;
- normalize scale, pivot, and foot baseline across views/actions;
- verify front/rear and diagonals before animation production;
- pack final frames into browser-friendly WebP atlases with explicit metadata;
- simulation remains authoritative for movement, facing, attack/cast results, health, and death.

Do not make Blender modeling, retopology, UV work, rigging, skinning, or animated GLB export a prerequisite for standard unit production.

A true-3D intermediate may be used privately as an optional art-generation aid if it is genuinely efficient, but it is not a required repository deliverable and must not become the default Work pipeline.

Existing GLB unit assets and animation plumbing may remain as compatibility fallbacks or experiments. They do not define final-art acceptance.

### Buildings and non-character assets

GLB remains appropriate for buildings and other assets where true 3D materially improves the elevated RTS presentation and is efficient to author/runtime-render.

Use stable manifest asset IDs and browser-friendly geometry/material budgets. Building animation may remain restrained and mechanical.

---

## 7. Combat and elemental VFX language

Replace prototype geometry-only feedback with layered, readable effects.

A strong attack may combine:

```text
anticipation / wind-up
→ release frame / pose
→ projectile / beam / weapon motion
→ trail
→ impact
→ hit reaction
→ short-lived residue / decal / status cue
→ sound and restrained camera feedback
```

Element identity:

- **Fire:** ember core, heat, flame trail, sparks, smoke, scorch, persistent burning readability;
- **Water:** compressed burst, splash, expanding ring, droplets, Wet sheen/marker, steam when appropriate;
- **Ice:** frost expansion, crystalline shards, angular freeze shell/readability, crack/break mist;
- **Lightning:** segmented emissive bolt, readable chains, impact flash, small branches/arcs, conductivity-aware target sequence.

Strategic spells should use a clear gameplay-footprint layer first, then primary effect, secondary particles, residue/decal, sound, and camera feedback.

Do not use particle count as a substitute for readable timing and shape.

---

## 8. UI direction

The UI should feel like the same Arcane-Industrial Frontier product without overwhelming the battlefield.

Priorities:

- strong hierarchy;
- fast RTS scanning;
- clear selected-unit / building state;
- readable resources and population;
- clear production and construction progress;
- clear Tactical versus Strategic spell grouping;
- obvious cooldown, Mana cost, target legality, and cast state;
- compact command surfaces rather than large decorative panels;
- consistent icon, border, spacing, typography, hover, disabled, active, and selected states.

UI polish must not hide information required for gameplay.

Existing final-icon prompts may be reused where useful:

- `media/prompts/images/M08_UI_ICON_PROMPTS.md`

---

## 9. Battlefield and environment direction

Improve terrain without reducing navigational readability.

The player must still immediately read:

- walkable versus blocked terrain;
- water versus ice;
- forest / cover areas;
- elevation and chokepoints;
- resources and POIs;
- owned / contested strategic space where shown.

Prefer reusable materials, decals, instanced props, and visual-only deterministic dressing over large numbers of unique expensive objects.

Environmental detail must not obscure units, selection markers, spell footprints, or routes.

---

## 10. Browser performance constraints

Maintain the mature-alpha target of roughly 100 active units, roughly 200 total entities, and a 60 FPS rendering target on the intended desktop browser class.

For unit impostors, prefer:

- shared WebP atlases and materials across instances;
- bounded atlas dimensions and predictable texture memory;
- reduced update rate for distant/off-screen/fog-hidden units;
- optional lower-resolution/animation-sampling quality tiers;
- soft contact/blob shadows instead of expensive per-unit real-time shadows;
- restrained transparent overdraw.

For buildings/environment, prefer:

- shared materials and texture atlases where practical;
- sensible mesh complexity;
- LOD/instancing for repeated or expensive assets;
- restrained shadow casters;
- compressed textures suitable for web delivery.

For VFX, prefer:

- pooled transient effects;
- bounded particle counts;
- readable timing and shape over brute-force particle density.

Avoid:

- film-quality geometry invisible at RTS scale;
- many unique materials/textures per repeated unit;
- thousands of overlapping transparent particles;
- expensive full-screen effects that obscure tactical information;
- visual randomness that perturbs gameplay RNG;
- token-intensive 3D production steps that do not materially improve the normal gameplay view.

Visual sophistication should come primarily from silhouette, directional consistency, animation, materials, lighting, timing, layering, and impact feedback.

---

## 11. Work token and validation policy

Token efficiency is an explicit constraint for this pass.

During implementation:

- act autonomously within the boundaries above;
- use narrow file scopes;
- do not perform broad refactors unless required by a concrete blocker;
- do not repeatedly narrate the repository state;
- do not generate long audit or closure reports;
- do not ask for handoff after every small visual change;
- prefer a coherent implementation batch over many tiny checkpoints;
- do not default to Blender/mesh/rigging iteration for standard unit art.

Validation for presentation-only changes is intentionally light:

1. run TypeScript/build once at the end of a coherent batch;
2. run only directly relevant targeted tests when code behavior changed;
3. perform one short browser/WebGL smoke when available;
4. confirm no fatal error and that the changed presentation is visible/readable;
5. fix obvious local blockers, then stop.

Do **not** rerun broad deterministic, replay, AI, or 2,048-seed world-generation regressions for presentation-only changes unless authoritative gameplay code was actually changed or a concrete regression requires them.

Do not spend Work tokens on repeated verification of unchanged systems or exhaustive visual inspection.

---

## 12. Completion report

Keep the final Work response short:

- changed files;
- visual result implemented;
- quick validation result;
- known follow-up items only if material.

Do not produce a long milestone narrative for routine visual-production work.

---

## 13. Existing GLB baseline notes

The repository already contains original faceted GLB fallbacks for several units/buildings and animation/runtime experiments. Preserve them where useful for compatibility and fallback behavior.

For standard combat units, these assets are no longer the final production target. Do not interpret `NEEDS_MANUAL_GENERATION`, GLB clip plumbing, model generators, or previous rigging notes as a requirement to finish a true-3D character pipeline.

Buildings may continue to use GLB where appropriate.

---

## 14. Environment implementation notes

The asset-driven environment pass remains valid and independent of the unit representation decision.

- environment presentation may use textured meshes, impostors, decals, and other efficient rendering techniques;
- gameplay, navigation, `m02-standard-v1`, replay, and deterministic simulation remain unchanged;
- manual WebGL/FPS acceptance remains the final visual-performance gate where automated browser rendering is unavailable.