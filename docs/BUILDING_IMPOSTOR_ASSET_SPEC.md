# PEPEPOW Elemental Front - Building Impostor Asset Spec

**Status:** ACTIVE VISUAL-PRODUCTION CONTRACT  
**Scope:** player building presentation only  
**Gameplay authority:** unchanged

## 1. Goal

Replace the current faceted building GLB look with high-quality static isometric WebP building impostors while keeping the existing GLB/primitive models as safe fallback.

Buildings are stationary and use the fixed elevated RTS camera, so unlike units they require **one canonical view per building**, not eight directions.

This pipeline is intended to move the live screen toward `docs/RTS_SCREEN_TARGET_REFERENCE.md` quickly while preserving browser performance.

## 2. Canonical roster

The first complete batch contains seven buildings:

```text
elemental-core
barracks
arcane-tower
workshop
outpost
extractor
mana-well
```

Canonical runtime paths:

```text
public/assets/buildings/elemental-core/building.webp
public/assets/buildings/barracks/building.webp
public/assets/buildings/arcane-tower/building.webp
public/assets/buildings/workshop/building.webp
public/assets/buildings/outpost/building.webp
public/assets/buildings/extractor/building.webp
public/assets/buildings/mana-well/building.webp
```

## 3. Source-image contract

Generate one isolated final-quality building image for each slug.

Required source characteristics:

- square source canvas, preferably 1024x1024 or larger;
- transparent background preferred;
- fixed three-quarter isometric RTS view;
- camera elevated approximately 30-35 degrees downward;
- near-orthographic / long-lens perspective with low distortion;
- building centered with generous transparent safety margin;
- whole footprint visible;
- front / primary entrance visually readable;
- same light direction and material language across the full seven-building set;
- Arcane-Industrial Frontier architecture;
- dark steel, stone, timber, restrained brass, engineered mana/crystal technology;
- team-color zones baked for the current player presentation, visually distinct from elemental/mana glow;
- broad forms before small detail;
- no scenery beyond tightly attached functional props;
- no text, labels, logos, UI, frame, watermark, extra buildings, units, or characters.

Do not generate different viewpoints for one building. The set must look like one faction photographed by the same fixed RTS camera.

## 4. Shadow and grounding

Preferred final source has **no large baked terrain shadow**. A small soft local contact shadow directly beneath structural overhangs is acceptable if it is subtle and remains inside the building footprint.

Runtime should continue to own selection footprints, rally markers, health/progress bars, strategic links, and gameplay-state overlays.

## 5. Output contract

Normalize each final building to transparent lossless WebP:

- canvas: `512x512`;
- alpha: required;
- color space: sRGB;
- one file named `building.webp` per slug;
- visible building bottom aligned consistently across the batch;
- consistent apparent scale based on authoritative building footprint, not on filling the canvas;
- do not stretch non-uniformly.

Approximate relative footprint ordering must remain obvious:

```text
Elemental Core > Workshop > Barracks > Outpost / Arcane Tower > Extractor / Mana Well
```

The Elemental Core may be taller and visually dominant, but it must not obscure nearby units or UI overlays at normal gameplay zoom.

## 6. Runtime behavior

When a valid building WebP exists:

1. load the WebP presentation for player-owned completed buildings;
2. keep the billboard plane fixed to the shared RTS camera yaw convention;
3. anchor the sprite bottom edge to the authoritative building origin;
4. hide primitive fallback parts after successful image load;
5. retain selection footprint, construction/production progress, rally, defense markers, resource-site cues, and strategic-network links;
6. preserve current GLB/primitive fallback if the WebP is missing or corrupt;
7. never change simulation, footprint authority, build rules, health, production, pathing, or replay state to fit the art.

Construction states may temporarily remain on the current primitive/GLB path until a dedicated construction-state visual pass is approved.

Enemy buildings may remain on the recolorable GLB/primitive path until neutral/masked building art exists. Do not simply tint the whole player WebP red.

## 7. Visual acceptance

A building batch passes only when:

- every building reads clearly at normal RTS zoom;
- all seven share camera, lighting, material, and faction language;
- buildings are grounded and not visibly floating;
- apparent scale matches gameplay footprint;
- player ownership color is visible but not dominant;
- mana/element glow remains separate from team ownership;
- no building covers selection or progress feedback;
- no obvious rectangular alpha fringe appears;
- no fatal load errors occur;
- missing WebP safely falls back to current presentation.

## 8. Production order

Generate and approve in this order:

1. Elemental Core - establishes the faction architecture and scale anchor;
2. Barracks - establishes ordinary production-building language;
3. Arcane Tower - establishes vertical arcane infrastructure;
4. Workshop - establishes heavy industrial language;
5. Outpost - establishes territorial / beacon language;
6. Extractor - establishes material-resource machinery;
7. Mana Well - establishes mana-resource machinery.

Do not generate the remaining six from unrelated visual styles after Core approval. Use the approved Core and latest accepted building as style references when the image generator supports references.

## 9. Manual upload gate

After generation and normalization, upload the seven files to the exact canonical paths under `public/assets/buildings/`.

Do not remove GLB fallback assets.

After upload, verify all seven binaries on GitHub `main`, then complete runtime integration and one WebGL visual acceptance pass.