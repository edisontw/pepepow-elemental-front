# Unit animation implementation notes — U0/U1

Status: U0 runtime plumbing implemented; U1 Vanguard animated fallback implemented; final skinned art and manual WebGL acceptance remain pending.

## U0 runtime path

- `unit-animation-profile.ts` defines presentation-only `IDLE / MOVE / ATTACK / CAST / HIT / DEATH` states and canonical clip names.
- `unit-animation-controller.ts` binds embedded GLB animation tracks, loops Idle/Move, plays Attack/Cast/Hit as one-shots, persists Death, cross-fades safely, and tolerates missing clips.
- `animated-unit-render-bridge.ts` derives animation intent only from authoritative snapshots: movement delta, `nextAttackTick`, cast result, health delta and alive/dead state.
- Root motion is not used. Simulation interpolation still owns world X/Z and presentation facing remains subordinate to the existing facing resolver.
- The legacy directional WebP path remains disabled as the primary runtime path and can remain available for later far/low-quality LOD work.

## U1 Vanguard proof slice

The reproducible Vanguard generator now embeds five canonical rotation-only clips:

- `Idle`
- `Move`
- `Attack`
- `Hit`
- `Death`

It also exports `ModelRoot` and `WeaponTip` nodes. The current asset is intentionally still a rigid-node fallback, not the final concept-quality skinned mesh. Its purpose is to prove clip loading/state transitions and remove the full-body sinusoidal locomotion bob before the final rigged asset is introduced.

`npm run build` regenerates fallback assets only while their manifest status is `NEEDS_MANUAL_GENERATION`. Promoted assets are preserved, and a missing promoted file fails the build instead of silently creating a substitute. The guard covers Vanguard, specialists, Elementalists and heavy-unit build generators.

## Validation

- U0 CI run `35134006893`: tests PASS, production build PASS.
- U1 CI run `35134213700`: tests PASS, production build PASS.
- Pages run `35134213840`: deployment PASS.
- Automated animation-state tests cover priority, Frozen locomotion suppression, canonical Vanguard clip names and one-shot classification.

## Remaining hard gate

U1 is not complete as final art until a concept-quality Vanguard is converted to one coherent rigged/skinned GLB with in-place `Idle / Move / Attack / Hit / Death` clips and manually accepted at normal gameplay zoom. The repository runtime plumbing and stable `unit.vanguard` manifest path are ready for that replacement.

## Canonical production attempt — 2026-09-17

- Verified all 28 source-manifest entries against the uploaded archive. English-path provenance and checksums: `media/unit-production/reference-manifest.json`.
- Derived Vanguard references from the canonical turnaround using built-in image generation: `media/unit-production/vanguard/modeling-plate.jpg` and `body-reconstruction-input.jpg`. These are modeling inputs, not final meshes. The multi-view plate's side arm pose is not perfectly matched; use the canonical turnaround to resolve details. Do not submit the entire plate to single-image reconstruction.
- Submitted the isolated body input to the available to3D service (`gltf`, high quality, game usage). It returned HTTP 400, `Failed to generate 3D model`, without a job ID or output. No generated mesh, skin or final GLB exists from this attempt. Blender executable, `bpy` and local reconstruction models were not available in this environment.
- Hard gate: a functioning reconstruction/modeling toolchain must produce the actual mesh before topology, skinning, animation and final runtime replacement can proceed. This is not merely a manual WebGL gate. Do not promote the current fallback or mass-produce subsequent units.
- Fixed consecutive same-state action restart and locomotion-speed application on transition. Gameplay authority remains untouched.

### Resume contract

1. Use the committed isolated Vanguard body reference with a working reconstruction service or model the canonical design in a suitable DCC. Add the canonical sword and shield as separate attachments; the body input intentionally omits equipment.
2. Retopologize/UV as needed, use a compact humanoid skin, and provide an identity `ModelRoot` node for existing model discovery. Export metres, Y-up, +Z forward. Keep global root X/Z fixed throughout clips; local joint motion is presentation only.
3. Embed `Idle`, `Move`, `Attack`, `Hit`, `Death`; loop only locomotion. Provide `WeaponTip` when practical. Use a separate neutral-textured material named exactly `TEAM` for faction recoloring, distinct from steel/cloth. Prefer two materials and 512–1024 textures. Inspect actual triangles/draw calls before acceptance.
4. Replace `public/assets/models/unit-vanguard.glb`, retain `unit.vanguard`, and change its manifest status away from `NEEDS_MANUAL_GENERATION` (for example `READY`) in the same commit. The legacy generator will then preserve it. This status records import readiness, not manual visual acceptance.
5. Run targeted animation tests and build; inspect clip structure, silhouette, team panel, grounding, attachments and in-place motion in WebGL at RTS zoom. Check target-device FPS. Final quality and performance are not yet accepted.
6. After Vanguard acceptance, continue Golem, Siege Construct, Spear Guard, Ranger, Scout, Engineer, shared Elementalist body, then its four variants. Scout uses hand crossbow + dagger; elemental effects stay runtime VFX.
