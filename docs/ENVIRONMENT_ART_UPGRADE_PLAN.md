# PEPEPOW Elemental Front — Environment Art Upgrade Plan

**Status:** ACTIVE — agent execution plan  
**Scope:** reference-quality terrain, forest, roads, environment assets, themed dressing, lighting/depth, and browser-performance safeguards  
**Authority:** presentation only; no gameplay, navigation, world-generation, replay, or deterministic-simulation changes

---

## 1. Mission

Upgrade the live battlefield from a procedural prototype look to a **production-quality stylized RTS environment** that approaches the richness, grounding, and scene composition of the current screen target while remaining recognizably **PEPEPOW Elemental Front / Arcane-Industrial Frontier**.

The target is **not** to imitate another game's exact assets. The target qualities are:

- layered meadow / soil / woodland-floor surfaces instead of broad flat color zones;
- believable dirt roads with worn centers, shoulders, grass encroachment, and irregular edges;
- asset-backed stylized conifer woodland with canopy hierarchy, understory, forest floor, and readable gaps;
- authored-looking ruin / gravefield, village-edge, roadside, resource, and rocky-edge micro-scenes;
- stronger contact, depth, shadow, and lighting cohesion;
- normal RTS gameplay readability at the existing elevated camera;
- browser-friendly reuse, batching, instancing, and quality fallbacks.

This plan supersedes further attempts to reach the target by merely adding more primitive cones, spheres, boxes, or generic prop scatter.

---

## 2. Read order for the executing agent

Read only what is needed, in this order:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/VISUAL_IMPLEMENTATION_BRIEF.md`
3. `docs/RTS_SCREEN_TARGET_REFERENCE.md`
4. this file
5. only the runtime / asset files directly touched by the implementation

GitHub `main` is the only source of truth.

Do not reopen M00–M08, Post-Roadmap Phase 2, or Phase 3. Do not redesign gameplay systems for presentation reasons.

Repository content and in-game/debug UI remain English-only.

---

## 3. Current visual diagnosis

The current live battlefield has already moved beyond the original round-canopy forest mass, but the screen still reads as a prototype because:

- the main ground is dominated by broad vertex-color regions;
- meadow / highland / woodland differences are visible as large color fields rather than textured natural surfaces;
- roads still read primarily as smooth colored bands;
- current conifers are generated from primitive geometry and therefore lack authored foliage mass, silhouette variation, and material richness;
- ground dressing is too small and sparse to carry the scene at normal gameplay zoom;
- props often appear as isolated objects sitting on the ground rather than a coherent site;
- contact/shadow/depth integration is weaker than the target reference.

Therefore, **the next pass must be asset-driven rather than primitive-driven**.

---

## 4. Locked boundaries

Preserve all of the following:

- pure-TypeScript authoritative simulation separated from PlayCanvas presentation;
- 10 Hz authoritative simulation and render interpolation;
- deterministic gameplay RNG, command replay, and state hashes;
- `m02-standard-v1` world generation;
- current gameplay/replay identity;
- current navigation and terrain semantics;
- existing unit/building selection readability;
- existing team-color versus elemental-identity separation;
- browser-first desktop RTS target.

Presentation-only deterministic placement may use world identity / cell coordinates / presentation hashes, but must never consume gameplay RNG or mutate authoritative state.

Do **not** add new gameplay terrain types, POI types, resource semantics, cover rules, movement modifiers, or pathing obstacles as part of this plan.

---

## 5. Architecture target

Keep the existing rendering split, but make responsibilities explicit.

### `src/rendering/generated-world-render-bridge.ts`

Owns the large-scale battlefield surface:

- base ground mesh and UVs;
- large-scale grass / soil / highland / woodland-floor material treatment;
- water and shoreline surface;
- road base, shoulder, rut, and crossing treatment;
- biome tint / moisture / elevation color modulation;
- large-scale transition overlays where useful.

It should no longer own the primary forest tree art.

### `src/rendering/environment-detail-layer.ts`

Owns deterministic asset-backed dressing:

- tree and shrub placement;
- forest-edge composition and clearings;
- forest-floor local accents;
- roadside dressing;
- settlement-edge service props;
- ruins / gravefield dressing;
- resource / POI surroundings;
- river-bank and highland accents.

Primitive geometry should remain only as a low-cost fallback or minor accent, not the main environment art.

### Add when useful

Prefer narrow new modules rather than expanding one file indefinitely:

- `src/rendering/terrain-material-set.ts` — shared ground/road material and texture setup;
- `src/rendering/environment-asset-library.ts` — environment GLB / impostor / texture manifest loading and shared materials;
- `src/rendering/environment-placement-system.ts` — deterministic visual-only archetype selection, density, edge rules, and quality-tier decisions.

Do not create these modules merely for architecture purity; create them when they materially simplify the implementation.

---

## 6. Asset policy

### Preferred sources

Use, in order of preference:

1. original assets generated inside this repository;
2. original assets generated through an approved AI/art pipeline and committed to the repository;
3. third-party assets only if their license is clearly compatible and documented in-repo.

Do not silently introduce unclear-license assets.

### Runtime formats

Prefer:

- GLB for reusable 3D environment assets;
- WebP / PNG for textures, decals, atlas sheets, or impostors;
- compressed web-friendly textures where the existing build supports them.

### Asset organization

Use stable paths and IDs. Recommended structure:

```text
public/assets/environment/
  terrain/
  trees/
  shrubs/
  rocks/
  ruins/
  settlement/
  roadside/
```

Do not store generation-only source files in runtime folders if they are not required by the game.

---

# 7. Execution phases

The agent should execute these phases autonomously in order. Do not stop after every phase unless a hard gate is reached.

---

## Phase B0 — Baseline and asset-path audit

Before editing:

- inspect the current environment render path from `scene.ts` into `GeneratedWorldRenderBridge`, `ResourceRenderBridge`, and `EnvironmentDetailLayer`;
- confirm which current primitive woodland paths remain active after the latest main commit;
- inspect the existing asset manifest / loader conventions used for unit and building final-art replacement;
- reuse those conventions where practical rather than creating a parallel incompatible loader;
- identify any existing texture/material helpers that can be shared.

Do not perform a broad repository audit.

### B0 exit condition

A narrow implementation plan exists in code comments / working notes and the agent knows the exact asset loading path, surface mesh path, and environment-detail integration points.

---

## Phase B1 — Textured ground and road foundation

This is the highest-priority phase. The screen should improve substantially even before final tree art is complete.

### B1.1 Ground texture set

Create or integrate a coherent stylized terrain set with at least:

- meadow / grass base;
- lighter or drier grass variation;
- exposed soil / dirt;
- woodland floor / needles / moss;
- road dirt;
- wet mud / river-edge ground;
- rocky / highland ground.

A small atlas is preferred when it reduces material count without making implementation fragile.

Texture detail must be sized for normal RTS zoom, not close-up inspection.

### B1.2 Ground mesh support

Upgrade the generated ground surface so textures are actually visible at gameplay scale.

Required behavior:

- UVs or another stable mapping are present;
- texture repetition is broken by deterministic scale/offset/rotation or overlay variation where practical;
- existing biome tint, moisture, and elevation modulation can remain as secondary color variation;
- large areas no longer read as single flat colors;
- transitions remain visually soft enough to avoid obvious map-sized rectangular blocks.

Do not replace world-generation biome data. This is presentation only.

### B1.3 Road treatment

Roads must read as worn routes, not painted ribbons.

Required layers:

- readable dirt core;
- slightly darker / compressed wheel wear or rut cues;
- irregular shoulder;
- grass encroachment / verge breakup;
- restrained stones / scrub at selected edges;
- softer junction and approach transitions.

Roads must remain immediately readable for navigation.

### B1 acceptance

At normal gameplay zoom:

- open grass has visible material texture and at least two scales of variation;
- woodland ground is darker / denser than meadow even before trees are considered;
- highland ground is materially distinct without becoming a flat gray zone;
- roads read as dirt infrastructure with edge transition rather than beige bands;
- no obvious texture seams or severe UV stretching dominate the screen;
- units, selection circles, build footprints, and spell footprints remain clear.

---

## Phase B2 — Asset-backed stylized conifer forest

Replace primitive trees as the primary forest art.

### B2.1 Minimum forest kit

Provide at least these reusable archetypes:

- Tall Fir A;
- Tall Fir B;
- Medium Conifer A;
- Medium Conifer B;
- Small Conifer / Sapling;
- Shrub / broadleaf accent;
- optional forest-floor clump or fallen-log cluster.

A single tree repeatedly scaled and rotated is not sufficient.

### B2.2 Preferred representation

Use a hybrid approach when practical:

- near / edge trees: low-poly 3D GLB assets;
- dense internal woodland: instanced low-poly assets or lightweight impostor/clump assets;
- low-quality mode: simplified tree count / cheaper representation.

If the runtime or asset toolchain cannot support hybrid representation cleanly, prefer reusable low-poly GLBs with aggressive instancing over many independent primitives.

### B2.3 Forest composition rules

Use deterministic visual-only placement to create:

- dense core with more tall trees;
- middle layer with medium conifers;
- edge layer with saplings, shrubs, rocks, and gaps;
- irregular jagged forest boundaries;
- road setbacks and occasional protruding tree pockets;
- several deliberate clearings / pocket gaps;
- visible forest-floor material under and around tree groups.

Avoid:

- uniform rows;
- repeated identical tree spacing;
- solid wall silhouettes;
- circular blob masses;
- trees touching or obscuring main roads excessively;
- tree density that hides units or selection state.

### B2 acceptance

At normal gameplay zoom:

- the forest reads immediately as a stylized conifer woodland;
- tall / medium / small canopy hierarchy is visible;
- the boundary is irregular rather than a straight strip or blob;
- canopy has readable gaps and internal height variation;
- forest floor is visibly integrated with the trees;
- repeated primitive cone/cylinder construction is no longer the dominant visual impression.

---

## Phase B3 — Authored environment prop kits

Create small reusable prop families and replace the most visible primitive placeholders.

### B3.1 Ruin / gravefield kit

Use around `ANCIENT_RUIN` sites:

- upright grave / ruin marker;
- broken marker;
- small stone cross or equivalent ruin silhouette;
- broken masonry / wall fragment;
- dead branch / deadwood;
- darker soil / sparse weed context.

Keep the tone restrained and compatible with the Arcane-Industrial Frontier setting.

### B3.2 Village / settlement-edge kit

Use near `VILLAGE` and settlement areas:

- fence segment;
- broken fence;
- crate / supply stack;
- barrel or container;
- stacked timber;
- stump / work debris;
- cart or small service silhouette if cheap enough.

### B3.3 Woodland / roadside / rocky-edge kit

Provide:

- boulder cluster;
- small rock scatter;
- fallen trunk;
- scrub clump;
- flower / grass clump;
- optional road marker or worn post.

### B3.4 Resource / POI context

Resource and POI surroundings should look deliberately occupied rather than isolated markers on empty ground.

Use appropriate combinations of:

- disturbed soil;
- stakes;
- rocks / crystal chips;
- service debris;
- ruins / fragments;
- low vegetation clearing.

Do not obscure the resource itself.

### B3 acceptance

- ruins read as a coherent micro-scene before labels are read;
- village edges feel serviced / inhabited;
- resource nodes have a clear footprint and surrounding context;
- prop density remains secondary to units and gameplay markers;
- repeated props share materials / atlases where practical.

---

## Phase B4 — Lighting, grounding, and depth cohesion

After B1–B3, improve scene integration rather than simply increasing object count.

Priorities:

- restrained contact-shadow / ambient-occlusion impression under trees, rocks, and major props;
- coherent directional-light color and intensity;
- forest interiors slightly darker than open meadow without hiding gameplay state;
- subtle distance/depth separation if available at low cost;
- shoreline / wet-ground value changes;
- avoid pitch-black forest masses and avoid washed-out terrain.

Do not add expensive full-screen post-processing merely to simulate quality.

### B4 acceptance

- trees and props look grounded rather than pasted onto the surface;
- forest, meadow, roads, and structures share one lighting language;
- normal gameplay markers remain high-contrast enough to scan quickly;
- the scene gains depth without reducing tactical readability.

---

## Phase B5 — Performance and cleanup

The final environment must respect the existing browser target.

Required safeguards:

- reuse materials;
- use atlases where practical;
- instance repeated environment meshes where practical;
- keep shadow casters restrained;
- reduce tiny props at distance / low quality;
- retain or improve `?quality=low` behavior;
- avoid large transparent-overdraw fields;
- avoid per-frame regeneration of static environment art;
- destroy GPU resources correctly on scene teardown.

Remove or disable obsolete primitive environment paths once the replacement is stable. Do not keep both full-quality systems active and pay for both.

### B5 acceptance

- TypeScript/build passes;
- no fatal browser/WebGL errors in a short smoke test when browser access is available;
- environment assets appear in the live scene;
- low-quality mode remains usable;
- no obvious duplicated forest systems or legacy decorative layers remain active;
- no gameplay/replay/world-generation code was changed.

---

# 8. Hard gates

The agent should continue autonomously until one of these conditions is reached:

1. a required binary art asset cannot be generated, committed, or loaded with the available toolchain;
2. an asset-format limitation requires user approval of a new pipeline or dependency;
3. a visual choice genuinely requires manual selection between materially different art directions;
4. WebGL/manual visual acceptance is the only remaining blocker.

If a hard gate is reached:

- finish all non-blocked runtime plumbing first;
- leave stable manifest IDs / paths and fallbacks ready;
- document exactly which asset(s) or manual acceptance are missing;
- do not substitute a large new primitive-geometry pass for missing final art.

---

# 9. Agent execution policy

The executing agent should:

- work from latest `main`;
- implement in coherent batches rather than tiny handoffs;
- keep gameplay untouched;
- prefer original reusable assets over runtime primitive construction;
- use current asset-loader conventions when practical;
- make commits by coherent visual slice;
- run TypeScript/build once at the end of each meaningful implementation batch;
- run only targeted tests directly affected by rendering/asset code;
- avoid broad deterministic/replay/AI/worldgen regression suites for presentation-only work;
- use one short browser smoke when available;
- inspect the deployed GitHub Pages result after successful deployment when browser access is available;
- stop only at a hard gate or when the acceptance criteria below are met.

Do not spend time producing long closure reports.

---

# 10. Recommended commit slices

The exact commit count may vary, but prefer scopes similar to:

1. `visual: add textured terrain and dirt road material foundation`
2. `visual: replace primitive woodland with asset-backed conifer kit`
3. `visual: add authored ruin settlement and roadside prop kits`
4. `visual: unify environment grounding lighting and quality tiers`
5. `perf: batch and cull repeated environment assets`

Do not split trivial code edits into separate commits.

---

# 11. Final screen acceptance

The environment upgrade is successful when the normal gameplay screen satisfies all of the following:

### Surface

- no large area reads as a single flat color;
- meadow contains grass/value/soil variation visible from gameplay zoom;
- woodland floor is visibly darker and denser;
- highland ground has rocky/scree texture and value breakup;
- shoreline / wet edges have an integrated transition.

### Roads

- road core, rut/wear, shoulder, and verge are distinguishable;
- road edges are irregular and partially reclaimed by grass;
- roads visually connect settlements and strategic spaces without appearing like painted grid bands.

### Forest

- conifers are the dominant tree language;
- at least three height/shape classes are clearly visible;
- forest core, edge, understory, and floor read as separate layers;
- clearings and irregular boundaries are visible;
- forest does not read as spheres, uniform cones, or a solid green wall.

### Themed areas

- ruin / gravefield areas read as deliberate locations;
- settlement edges contain coherent service clutter;
- resource/POI surroundings contain contextual ground/prop treatment;
- roadside and rocky edges have restrained authored accents.

### Cohesion

- environment assets share one stylized material and lighting language;
- buildings and units still dominate gameplay attention;
- team color and elemental identity remain unaffected;
- selection rings, critical-health cues, build footprints, roads, and spell footprints remain easy to read.

### Technical

- environment remains presentation-only;
- world-generation identity remains `m02-standard-v1`;
- no replay/gameplay version bump is required;
- build passes;
- browser target remains viable through reuse, instancing, culling, LOD/quality reduction, and restrained shadows.

---

# 12. Completion response for the agent

Keep the final response short and operational. Report only:

- commits / changed files;
- which B phases were completed;
- quick validation result;
- deployment result if checked;
- remaining hard gate, if any.

Do not restate the full plan.