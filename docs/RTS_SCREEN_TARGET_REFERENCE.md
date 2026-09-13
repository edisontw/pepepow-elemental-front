# PEPEPOW Elemental Front - RTS Screen Target Reference

**Status:** ACTIVE REFERENCE  
**Scope:** target in-game presentation quality for the current visual production pass  
**Authority:** presentation only; gameplay authority remains unchanged

## 1. Purpose

This file captures the current target for the playable in-game screen so future work can continue quickly without rereading long design history.

Use it as a **quality compass**, not as a request to imitate another game's exact assets, layout, or art direction.

## 2. Core target

Target a **polished modern RTS screen** with the maturity, readability, and completeness of a high-quality settlement-management / army-control game screen.

The result must remain recognizably **PEPEPOW Elemental Front** and use the existing **Arcane-Industrial Frontier** visual language.

Target qualities:

- immediately readable at a glance;
- clearly a finished RTS rather than a prototype;
- visually rich but not cluttered;
- coherent across HUD, battlefield, buildings, units, effects, and environment;
- optimized for elevated-camera gameplay rather than close-up beauty shots;
- clear ownership, economy, build options, army state, objectives, terrain navigation, selected entity state, and progress/activity.

## 3. Screen-quality pillars

### Mature HUD structure

Aim for a product-level screen with:

- stable top resource/status bar;
- clear objective / mission panel;
- clean build / production / info panel when relevant;
- readable selected-entity / command area;
- consistent panel styling, spacing, typography, borders, icons, hover, selected, disabled, and progress states.

### Layered battlefield presentation

The battlefield should feel intentionally composed with:

- readable grass / dirt / rock / water / ice classes;
- believable roads and circulation;
- clear shoreline, forest, rock, resource, and POI separation;
- settlement structure created by building placement and paths;
- enough dressing to feel alive without obscuring navigation or units.

### Readable building silhouettes

Every building must be recognizable from normal gameplay zoom through silhouette, roofline, footprint, machinery, magical infrastructure, entrance, service bay, tower, beacon, or extraction geometry.

### Clear unit-to-world scale

Units, buildings, roads, resources, and environment props must feel proportionally consistent. Avoid oversized units, tiny unreadable buildings, or decorative clutter that hides pathing.

### Unified materials and lighting

Use one coherent world language:

- dark steel, stone, timber, restrained brass;
- elemental crystal / mana engineering;
- team color for ownership only;
- elemental color for alignment/state only;
- restrained lighting and shadows;
- stylized realism rather than hard realism or flat cartoon presentation.

## 4. Project-specific translation

Required identity:

- Arcane-Industrial Frontier;
- stylized 2.5D RTS presentation;
- strong silhouettes from an elevated camera;
- practical military / engineering shapes;
- magical power expressed as engineered infrastructure;
- clear separation of team color and elemental identity.

Avoid direct franchise imitation, generic sci-fi armies, over-ornate fantasy architecture, detail that disappears at RTS zoom, and UI decoration that weakens scanning speed.

## 5. Execution order

### Step 1 - Building visual baseline

Priority order:

1. `building.elemental-core`
2. `building.barracks`
3. `building.arcane-tower`
4. `building.workshop`
5. `building.outpost`
6. `building.extractor`
7. `building.mana-well`

Goals: strong top-down silhouettes, clear gameplay-role readability, one coherent faction language, readable team-color placement, and restrained activity cues.

### Step 2 - Terrain and environment

Improve terrain materials, roads, forest grouping, shoreline / river edges, resource-node clarity, settlement-adjacent props, and environmental dressing.

### Step 3 - HUD and command surfaces

Raise product quality of the top bar, objective panel, build/production panels, command-card structure, selected-unit/building information, cooldowns, costs, and progress.

### Step 4 - Unit and activity polish

Continue with unit readability, selection markers, movement/attack feedback, construction/production states, idle mechanical motion, hit/death/destruction feedback.

### Step 5 - Elemental and strategic readability

Improve Fire / Water / Ice / Lightning effects, strategic relay/network readability, resource-site cues, cast timing, and impact timing.

### Step 6 - Performance-aware polish

Finish with asset optimization, material consolidation, LOD where useful, shadow discipline, transparent-overdraw control, and final browser readability/FPS checks.

## 6. Fast acceptance checklist

For each visual slice, ask:

1. Does the screen look more like a finished RTS than a prototype?
2. Can the player immediately read resources, selection, objectives, and build options?
3. Are buildings recognizable at gameplay zoom?
4. Does terrain feel layered and intentional?
5. Are team ownership and elemental identity clearly separated?
6. Is the scene richer without becoming cluttered?
7. Does the UI feel coherent across panels?
8. Does the change preserve browser performance and gameplay readability?

If several answers are no, continue polishing before moving to the next visual layer.

## 7. Fast read order for future work

For screen-presentation work, read:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/VISUAL_IMPLEMENTATION_BRIEF.md`
3. this file
4. only task-relevant runtime/art files

Do not reopen closed gameplay milestones merely to chase presentation.