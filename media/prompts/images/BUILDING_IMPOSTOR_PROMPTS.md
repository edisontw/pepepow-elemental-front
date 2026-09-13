# Elemental Front - Canonical Building Impostor Prompts

**Status:** CANONICAL MANUAL-GENERATION PACK  
**Scope:** seven player building impostors  
**Runtime authority:** presentation only

Use with `docs/BUILDING_IMPOSTOR_ASSET_SPEC.md`.

## Shared production block

Append this intent to every building prompt:

> Generate ONE isolated final-quality building asset for PEPEPOW Elemental Front, a stylized 2.5D RTS using the Arcane-Industrial Frontier visual language. Fixed three-quarter isometric RTS camera, approximately 30-35 degrees downward, near-orthographic perspective, same camera yaw and elevation for the complete building set, whole footprint visible, generous safety margin, centered on a square 1024x1024 or larger canvas, transparent background preferred, no environment scene. Premium strategy-game production quality with broad readable silhouettes, medium-detail stylized PBR materials, weathered dark steel, fortified stone, structural timber where appropriate, restrained brass, engineered mana/crystal technology, believable construction, strong elevated-camera readability. Reserve clear teal-green team-color roof/armor panels for player ownership; team color must remain separate from neutral cyan/blue-violet mana glow or elemental technology. Soft upper-left studio/world light, restrained highlights, no giant baked ground shadow. No text, labels, readable runes, logo, watermark, UI, frame, units, people, extra buildings, background terrain, sci-fi holograms, modern industrial machinery, tank styling, ornate high-fantasy castle decoration, steampunk gear clutter, or franchise imitation.

The entire seven-building batch must share the same camera, lighting, faction materials, team-color treatment, scale logic, and rendering style.

## 1. Elemental Core - `elemental-core`

> The central Elemental Core headquarters and visual anchor for the entire faction. Compact fortified citadel around a large neutral mana reactor. Broad circular-to-octagonal stone foundation, heavy dark-steel buttresses, central suspended luminous crystal core protected inside two thick engineered ring structures, four substantial socket pylons arranged around the upper structure for elemental modules, fortified entrance clearly readable from the camera-facing side, modest command superstructure, strong symmetrical silhouette, large but restrained teal-green team-color roof/armor panels. Powerful frontier headquarters, not a cathedral and not futuristic. The central reactor and ring system must be the dominant identifying feature at RTS zoom. Apply the shared production block.

## 2. Barracks - `barracks`

> Fortified infantry Barracks. Low broad drill hall with thick stone lower walls, dark-steel roof framing, one large clearly readable unit exit gate facing the camera-facing side, two stout reinforced roof/entry structures, compact enclosed training-yard cues integrated into the footprint, shield-like armor plates used only as simple geometry, practical mass-infantry production architecture. Teal-green team-color roof trim and gate plates. Must look sturdier and more military than the Arcane Tower and less industrial than the Workshop. No castle keep. Apply the shared production block.

## 3. Arcane Tower - `arcane-tower`

> Arcane Tower for elemental research, training, and strategic spell relay. Tall but broad-based fortified stone-and-steel tower, large suspended neutral crystal prism near the top, thick circular focusing ring, four modular attachment sockets around the ring, visible ceramic insulators and restrained mana conduits, narrow protected doorway, strong vertical silhouette, teal-green team-color cap and ring armor plates. Magical technology must read as engineered infrastructure rather than a wizard spire. The prism plus focusing ring must remain visible at RTS zoom. Apply the shared production block.

## 4. Workshop - `workshop`

> Heavy military Workshop for Engineers, Golems, and Siege Constructs. Broad asymmetrical reinforced stone base, very large open service bay sized for heavy constructs, thick overhead gantry crane as the dominant silhouette feature, compact forge housing, reinforced side doors, one restrained exhaust stack, armor racks and repair frames expressed as broad readable forms. Teal-green team-color service-bay frame and roof plates. Heavy industrial frontier engineering without modern factory styling and without decorative gear clutter. Apply the shared production block.

## 5. Outpost - `outpost`

> Compact territorial Outpost. Small octagonal fortified blockhouse with low stone walls, dark-steel corner armor, raised central beacon mast carrying a neutral crystal signal lamp, broad teal-green ownership panels clearly visible from above, one protected gate, subtle attachment points for future defensive or relay specialization. The elevated beacon is the dominant silhouette and must read as a territory/supply node rather than a full base. Apply the shared production block.

## 6. Extractor - `extractor`

> Material Extractor built directly around a mineral deposit. Low radial industrial structure clamped around a large faceted amber-gold ore/construction-crystal outcrop that remains clearly visible from above, three heavy extraction arms, stone-and-steel anchor pads, compact hopper/conveyor housing, open center around the deposit, utilitarian vulnerable silhouette rather than fortress architecture, teal-green machine housing panels. It must immediately read as a resource-site machine and remain clearly distinct from the Mana Well. No oil derrick. Apply the shared production block.

## 7. Mana Well - `mana-well`

> Fortified Mana Well around a naturally luminous blue-violet mana source in the ground. Circular stone containment basin with a clearly visible glowing center, three curved steel siphon arms arching over the well, thick translucent mana channels leading into a compact condenser reservoir, ceramic insulation, low defensive rim, teal-green outer armor panels. The luminous basin plus three siphon arms must create the identifying silhouette. It must read as an engineered resource installation, not a decorative magical fountain. Apply the shared production block.

## Review rule

Approve `elemental-core` first. Treat it as the style anchor for the remaining six. If Core camera, scale, silhouette, materials, or team-color balance are wrong, regenerate Core before continuing the batch.