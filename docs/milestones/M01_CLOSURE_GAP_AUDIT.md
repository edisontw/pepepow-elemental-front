# M01 Closure Gap Audit

**Audit result:** AUTOMATED ACCEPTANCE COMPLETE
**Formal milestone status:** IN_PROGRESS — MANUAL WEBGL PLAYTEST PENDING
**Closure implementation:** `f278bf326375ad45848b96cbf5008e4beb7b6bef`

## ROADMAP acceptance criteria

| Criterion | Classification | Evidence / remaining action |
|---|---|---|
| 40 units stable in arena | Satisfied automatically | Production arena has 40 units; closure stress proves deterministic convergence and safe positions. |
| Selection and orders usable | Manual/WebGL-only verification | Click/drag/Shift selection, groups, MOVE/ATTACK/STOP are implemented; human input usability requires WebGL. |
| No severe pathing deadlocks | Satisfied automatically | Both 40-unit factions cross the single natural crossing and reach exact resolved destinations. |
| Fire spreads under defined rules | Satisfied automatically | Fixed N/E/S/W forest spread, lifetime, heat, consumption, Water/Wet suppression, integration tests. |
| Water applies Wet | Satisfied automatically | Authoritative per-tick Water → Wet synchronization and tests. |
| Water freezes into walkable ice | Satisfied automatically | Threshold transition, nav update, traversal, replay tests. |
| Fire/heat reverses ice | Satisfied automatically | Durability degradation and Ice → Water tests, including FIRE identity. |
| Nav updates locally | Satisfied automatically | Batched changed-cell updates and one nav-version bump per transition tick. |
| Lightning reflects conductivity | Satisfied automatically | Integer conductivity priority, damage/range, chain, replay tests. |
| Signature interaction readable | Logic satisfied; manual visual gate | Full automated sequence passes; visual readability requires WebGL playtest. |
| Replay hashes match | Satisfied automatically | Terrain, Burning, fog, status, entity, combat, path, nav, and RNG state are hashed; replay/FPS tests pass. |
| Performance acceptable | Simulation satisfied; renderer manual | 40-unit simulation is well inside the 5,000 ms/420-tick gate; WebGL renderer performance remains manual. |
| No dependency on final visuals | Satisfied automatically | Gameplay authority remains pure TypeScript; presentation uses replaceable primitives/materials. |

## Additional M01 scope

Satisfied: four initial archetypes, fixed 10 Hz simulation, combat, Wet/Burning/Chilled/Frozen, fog baseline, deterministic commands/RNG/hash/replay, debug fields, pan/zoom, Shift selection, and control groups. Limited camera rotation remains optional and was not needed by automated evidence.

## Explicitly deferred beyond M01

- collision/occupancy/steering and autonomous AI
- unit Burning DoT and generic buff framework
- persistent terrain wetness, full hydrology, diffusion, smoke, steam, wind, and weather
- mana, cooldown, cast-range, line-of-sight, and full fog validation for spells
- armor pipeline and bespoke Elementalist/Golem abilities
- polished VFX, animation, audio, final assets, and code splitting
- procedural generation and all M02 work

## True remaining closure gates

One WebGL-capable human playtest must verify input usability, elemental readability, 40-unit rendering performance, and the ROADMAP closure question. The controlled Work browser cannot perform this test. No workaround should be attempted.
