# Building art — Frontier v3

Original built-in ImageGen artwork for Elemental Front, generated 2026-10-04.
Existing committed building sprites supplied as camera/function references. No third-party game art.

## Runtime assets

| Building | Path | Visible height | Baseline |
| --- | --- | --- | --- |
| Elemental Core | `public/assets/buildings/elemental-core/building-frontier-v3.webp` | 430px | 492px |
| Barracks | `public/assets/buildings/barracks/building-frontier-v3.webp` | 320px | 492px |
| Workshop | `public/assets/buildings/workshop/building-frontier-v3.webp` | 319px (width-limited) | 492px |

All images are 512×512 RGBA WebP, quality 92. Prepared using the existing
`scripts/art/build_building_impostors.py` normalization function; no background
keying or hand-painted substitutions. Original `building.webp` files remain.
Source images were generated with built-in ImageGen; the Core prompt below
summarizes the production brief, and the Barracks/Workshop prompts are complete.

## Integration

Stable manifest IDs are retained. Versioned file paths and the updated asset
revision select v3 for these three completed player buildings. Foot padding is
removed from the plane offset so the image baseline sits on the building root.
Mipmaps reduce distant texture shimmer. Baked identity motifs replace old attached
primitive ornaments once the new sprite is ready; failure fallback retains them.
Other building art and faction rendering remain on their existing paths.

## Prompts

### Elemental Core

Use case: stylized-concept. Transparent 2.5D RTS Elemental Core. Redesign the existing reference with a broad octagonal warm limestone foundation, heavy gunmetal buttresses, a central cyan reactor within brass engineering rings, four empty elemental sockets, modest command hall and fortified entrance. Desaturated teal ownership panels, worn walnut timber, restrained brass, upper-left daylight, broad readable forms. Keep the elevated orthographic camera. No scene, people, text, logos, ground island or watermark; true alpha.

### Barracks

Use case: stylized-concept. Production transparent 2.5D RTS sprite: one fortified BARRACKS, an infantry drill hall for Elemental Front's Arcane-Industrial Frontier. Existing barracks reference defines camera only. Significantly redesign into LOW, BROAD PRACTICAL MILITARY HALL with one broad open dark troop-exit gate, large shield-shaped plaque with no symbol above the gate, two modest teal pennants, timber weapon racks beside the gate, compact stone forecourt within its base silhouette. Thick warm ivory limestone lower walls, exposed worn walnut upper timber beams, broad muted terracotta roof planes with desaturated teal faction trim, dark gunmetal braces and restrained weathered brass fittings. NO crystal reactor, NO tall tower, NO glowing crystals on corners. Distinguish clearly from headquarters and factory through warm terracotta roof and low clean military silhouette. Premium painterly realistic 3D game art, coherent broad sunlight and shadows, soft daylight from upper left, bright readable stone edges, natural worn timber, clean alpha edges. Elevated orthographic three-quarter camera same reference, show front gate and right wall; no perspective distortion. Readable at 100 pixels tall, moderate broad forms, not tiny rivet clutter. Center complete building with generous transparent padding, flat base, no ground island, no scenery, no people, text, logo, watermark. Genuinely transparent background.

### Workshop

Use case: stylized-concept. Production transparent 2.5D RTS sprite: one heavy WORKSHOP, building Engineers, Golems, Siege Constructs for Elemental Front's Arcane-Industrial Frontier. Reference defines elevated orthographic three-quarter camera only, front bay and right wall visible. Significantly redesign into BROAD ASYMMETRIC INDUSTRIAL MILITARY WORKSHOP, large open service bay wide enough for a construct, unmistakable thick timber-and-dark-steel overhead GANTRY CRANE attached to right side with a big suspended hook, warm amber forge visible inside left bay, one restrained broad exhaust stack, ONE mechanically plausible large exposed side gear. Wide stepped warm limestone foundation, crafted dark walnut beam structure, broad slate-grey corrugated-looking metal roof panels with desaturated teal ownership trim, dark gunmetal machinery, worn brass hinges. Strong big shapes: roof lower than central chimney, side crane clearly breaks silhouette. Clear amber furnace contrasts with blue HQ reactor. No giant blue crystal tower, no corner crystal lamps, no sci-fi, no steampunk clutter. Premium painterly realistic 3D game art, upper-left daylight, convincing matte materials and broad highlights, lighter stone facings, natural timber grain, clean silhouette readable at 100 pixels tall. Center entire building and crane with generous transparent padding, flat base, no terrain island, floor rectangle, people, scenery, text, logo or watermark. Real alpha transparent background.

## Validation

Normalized dimensions/alpha/padding checked. Targeted asset/profile tests,
TypeScript and production build are the technical checks. Runtime source and
simulation are separate: no gameplay, pathing or replay changes. Cloud browser
WebGL remains unavailable; in-game silhouette, foot contact, normal/low quality
and target-device FPS need visual acceptance.

