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

`npm run build` regenerates `public/assets/models/unit-vanguard.glb` through `scripts/art/build_vanguard_polished.py`, so CI/Pages use the embedded clips without changing gameplay or replay identity.

## Validation

- U0 CI run `35134006893`: tests PASS, production build PASS.
- U1 CI run `35134213700`: tests PASS, production build PASS.
- Pages run `35134213840`: deployment PASS.
- Automated animation-state tests cover priority, Frozen locomotion suppression, canonical Vanguard clip names and one-shot classification.

## Remaining hard gate

U1 is not complete as final art until a concept-quality Vanguard is converted to one coherent rigged/skinned GLB with in-place `Idle / Move / Attack / Hit / Death` clips and manually accepted at normal gameplay zoom. The repository runtime plumbing and stable `unit.vanguard` manifest path are ready for that replacement.
