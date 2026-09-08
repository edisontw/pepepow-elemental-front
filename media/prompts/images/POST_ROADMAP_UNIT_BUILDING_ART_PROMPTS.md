# Post-Roadmap Unit & Building Final-Art Prompts

**Status:** DRAFT VISUAL DIRECTION / MANUAL GENERATION REFERENCE  
**Scope:** player units, core buildings, and shared faction visual language  
**Runtime authority:** none; gameplay remains defined by canonical design/runtime files until separately revised  

These prompts are intended to produce high-quality concept references for later manually approved game assets. They do not replace runtime models by themselves.

---

## 1. Chosen visual direction — Arcane-Industrial Frontier

The project should not become a pure historical medieval RTS and should not become a pure robot / science-fiction RTS.

Use a distinct hybrid language:

- late-medieval military readability
- early-industrial field engineering
- elemental crystal / arcane power technology
- fortified frontier architecture
- practical war machines rather than futuristic vehicles
- human-scale infantry for readability and identity
- constructs and siege machines reserved for heavy mechanical roles

The result should feel like a civilization that learned to weaponize Fire, Water, Ice, and Lightning through engineered magical infrastructure.

Avoid copying the visual identity of Age of Empires, StarCraft, Warcraft, Warhammer, or any other existing franchise.

---

## 2. Shared rendering language

Use this shared language in every prompt unless a specific prompt overrides it:

> High-quality stylized 3D game asset concept for a 2.5D RTS, strong readable silhouette from an elevated gameplay camera, medium-detail PBR materials, broad shapes before small details, restrained surface wear, physically coherent construction, weathered dark steel, iron, stone, timber, leather, sparse brass, ceramic electrical insulators, elemental crystal technology, slightly exaggerated proportions for RTS readability, grounded military design, premium strategy-game production quality, single isolated asset, neutral matte ground, soft studio lighting from upper left, three-quarter isometric view from slightly above, no environment clutter, no text, no letters, no logos, no watermark, no UI, no contact sheet, no multiple views.

### RTS readability rules

- The asset must remain recognizable when rendered small on screen.
- Prefer one or two dominant silhouette features per unit or building.
- Do not hide the role behind decorative detail.
- Weapons must be large enough to identify the combat role immediately.
- Avoid thin filigree, tiny antennae, fragile ornaments, or excessive cables.
- Building entrances, production bays, towers, and resource interfaces must remain legible from above.
- Unit feet / bases must read clearly against terrain.

### Team-color rule

Reserve approximately 10–20% of the visible surface for replaceable team-color zones:

- shoulder plates
- shield panels
- cloth tabs
- building roof trims
- large armor plates
- banners without symbols or text

Team color must not be carried by elemental glow. Element colors communicate gameplay state; team colors communicate ownership.

### Element-material rule

Use elemental motifs as engineered materials, not costume recolors.

**Fire**
- ember-orange core light
- black heat-cracked ceramic
- triangular vents
- forged iron heat shields

**Water**
- blue-green translucent channels
- smooth curved pressure vessels
- glass-like reservoirs
- flowing ring motifs

**Ice**
- pale cyan-white crystalline facets
- silver-white metal framing
- thick angular prism geometry
- frosted surfaces

**Lightning**
- violet-white electrical glow
- ivory ceramic insulators
- dark conductive rods
- forked electrode geometry

Elemental attachments should normally occupy only a minority of the unit or building silhouette.

### Global negative prompt

> no modern firearms, no assault rifles, no tanks, no spaceships, no cyberpunk neon, no futuristic hologram clutter, no generic humanoid robot army, no ornate high-fantasy costume overload, no Victorian steampunk gear clutter, no anime proportions, no chibi proportions, no photoreal portrait rendering, no franchise imitation, no readable runes or text, no logos, no watermark, no contact sheet, no multiple characters, no background scene, no tiny unreadable ornament.

---

# 3. Player unit concepts

## `unit.vanguard`

Canonical concept filename: `concept-unit-vanguard.webp`  
Recommended aspect ratio: `1:1`

**Prompt**

A disciplined frontline Vanguard infantry soldier from the Arcane-Industrial Frontier faction, medium-heavy human infantry, broad asymmetric rectangular-kite shield as the dominant silhouette, compact single-handed arming blade with a subtly arcane forged edge, enclosed practical helmet with narrow visor, layered dark-steel cuirass over leather and cloth, heavy shoulder plate, reinforced boots, stable wide stance, minimal ornament, obvious defensive frontline role, team-color shield face and shoulder panel, restrained elemental-compatible sockets on belt and armor but no active elemental glow, strong triangular silhouette, clearly human rather than robotic, premium stylized 3D RTS game asset, use the shared rendering language.

---

## `unit.spear-guard`

Canonical concept filename: `concept-unit-spear-guard.webp`  
Recommended aspect ratio: `1:1`

**Prompt**

A Spear Guard designed specifically to stop heavy units and charges, armored human infantry with an extra-long two-handed pike as the dominant silhouette, thick reinforced spear head, grounding spike and metal counterweight at the rear, small forearm brace plate rather than a large shield, forward-braced low stance, heavier greaves and chest protection than the Vanguard, broad shoulder armor but narrow body profile, weapon clearly much longer than the unit height, visual language suggesting anti-construct and anti-heavy combat, team-color upper-arm plates and cloth waist tab, practical military design, premium stylized 3D RTS game asset, use the shared rendering language.

---

## `unit.ranger`

Canonical concept filename: `concept-unit-ranger.webp`  
Recommended aspect ratio: `1:1`

**Prompt**

A mobile Ranger marksman for a stylized elemental RTS, human ranged infantry wearing light layered armor, split field cloak, hooded or low-profile helmet, compact engineered recurved arc-bow with thick readable limbs and a mechanical tension housing, large visible quiver, no firearm, no futuristic energy rifle, silhouette defined by bow arc and cloak rather than heavy armor, leather and muted steel materials, practical forest camouflage shapes without realistic camouflage print, team-color shoulder strip and cloak clasp, agile grounded stance, clearly more fragile and mobile than frontline infantry, premium stylized 3D RTS game asset, use the shared rendering language.

---

## `unit.scout`

Canonical concept filename: `concept-unit-scout.webp`  
Recommended aspect ratio: `1:1`

**Prompt**

A fast reconnaissance Scout for an arcane-industrial frontier army, lightly armored human skirmisher, long-legged agile silhouette, compact hand crossbow or very short scout bow, folded signal beacon and optical field lens mounted on a shoulder harness, small satchel with map tools, narrow shoulder plates, short split cloak, minimal armor mass, no mount, no motorcycle, no modern firearm, posture suggesting speed and observation rather than direct combat, team-color scarf tab and beacon casing, immediately readable as vision / spotting / raiding specialist, premium stylized 3D RTS game asset, use the shared rendering language.

---

## `unit.elementalist.base`

Canonical concept filename: `concept-unit-elementalist-base.webp`  
Recommended aspect ratio: `1:1`

**Prompt**

A battlefield Elementalist designed as a military specialist rather than a traditional fantasy wizard, human caster wearing an armored field coat over practical light plate, compact helmet or hood, modular two-handed focus staff with a large empty mechanical socket at the top, reinforced gauntlets, small mana reservoir at the belt, restrained geometric arcane components integrated into practical equipment, slim silhouette distinct from the Engineer, no flowing ceremonial robes, no oversized fantasy hat, no spell effect except a faint neutral mana glow, team-color chest sash and shoulder plate, premium stylized 3D RTS game asset, use the shared rendering language.

### Fire-aligned Elementalist variant

Canonical concept filename: `concept-unit-elementalist-fire.webp`

Use the base Elementalist body and silhouette. Replace the staff focus with a black heat-shielded forge lens containing an ember-orange core, triangular vent geometry, faint heat distortion, small heat-cracked ceramic plates on one gauntlet. Do not recolor the whole costume red. Keep team color separate from the orange Fire glow.

### Water-aligned Elementalist variant

Canonical concept filename: `concept-unit-elementalist-water.webp`

Use the base Elementalist body and silhouette. Replace the staff focus with a circular pressure-ring focus around a suspended blue-green translucent fluid reservoir, smooth curved fittings, glass channel on one forearm, subtle moving-fluid impression. Do not recolor the whole costume blue. Keep team color separate from Water glow.

### Ice-aligned Elementalist variant

Canonical concept filename: `concept-unit-elementalist-ice.webp`

Use the base Elementalist body and silhouette. Replace the staff focus with a thick forked pale-cyan crystal prism held in silver-white braces, frost collecting only on the focus and one gauntlet, strong angular geometry, no delicate snowflake ornament. Keep team color separate from Ice glow.

### Lightning-aligned Elementalist variant

Canonical concept filename: `concept-unit-elementalist-lightning.webp`

Use the base Elementalist body and silhouette. Replace the staff focus with twin dark electrode forks separated by ivory ceramic insulators, restrained violet-white electrical arcs between the forks, small conductor plates on one forearm, no full-body electricity. Keep team color separate from Lightning glow.

---

## `unit.engineer`

Canonical concept filename: `concept-unit-engineer.webp`  
Recommended aspect ratio: `1:1`

**Prompt**

A frontline Engineer for an arcane-industrial RTS army, stocky human support specialist wearing reinforced medium-light armor, broad utility backpack with folded bridge / barrier panels, large mechanical repair gauntlet on one arm and a compact forged field hammer in the other hand, visible clamps, repair tools and cable reels arranged as large readable forms rather than tiny clutter, protective practical helmet, no modern hardhat, no firearm, sturdy boots, silhouette immediately distinct from caster and combat infantry, team-color backpack plate and shoulder panel, communicates repair, construction and field engineering at a glance, premium stylized 3D RTS game asset, use the shared rendering language.

---

## `unit.golem`

Canonical concept filename: `concept-unit-golem.webp`  
Recommended aspect ratio: `1:1`

**Prompt**

A massive battlefield Golem approximately two and a half times the visual mass of a human infantry unit, arcane construct made from huge dark stone blocks bound by forged iron armor bands, broad shoulders, oversized forearms, short thick legs, low head embedded in the torso, one large neutral arcane core recessed behind protective metal ribs, visibly heavy and conductive because of substantial metal binding, no cockpit, no pilot, no humanoid robot face, no sleek science-fiction plating, slow unstoppable frontline silhouette, team-color armor plates on both shoulders, large simple forms readable from an RTS camera, premium stylized 3D game asset, use the shared rendering language.

---

## `unit.siege-construct`

Canonical concept filename: `concept-unit-siege-construct.webp`  
Recommended aspect ratio: `4:3`

**Prompt**

A long-range Siege Construct for an arcane-industrial frontier army, low elongated unmanned war machine on four very large reinforced spoked wheels, central heavy torsion-and-arcane bombard mechanism with thick counterweighted arms and a glowing neutral focusing chamber, visually capable of launching large siege projectiles without resembling a modern cannon or tank, stabilizer outriggers folded along the chassis, vulnerable exposed mechanical middle section, armored front plate, rear maintenance platform, team-color side armor panels, clear long-range anti-building purpose, broad readable silhouette from above, no gun turret, no tracks, no science-fiction vehicle styling, premium stylized 3D RTS game asset, use the shared rendering language.

---

# 4. Player building concepts

## `building.elemental-core`

Canonical concept filename: `concept-building-elemental-core.webp`  
Recommended aspect ratio: `4:3`

**Prompt**

The Elemental Core, central headquarters of an Arcane-Industrial Frontier army, a compact fortified citadel built around a large neutral mana reactor, broad circular-to-octagonal stone foundation, heavy dark-steel buttresses, central suspended crystal core inside two thick rotating engineering rings, four large empty elemental socket pylons around the upper structure designed to visually accept Fire, Water, Ice or Lightning modules later, fortified entrance facing the camera, modest command tower, strong symmetrical silhouette, large team-color roof and armor panels, powerful but not enormous cathedral scale, no readable symbols, no futuristic force-field dome, premium stylized 3D RTS building concept, use the shared rendering language.

---

## `building.barracks`

Canonical concept filename: `concept-building-barracks.webp`  
Recommended aspect ratio: `4:3`

**Prompt**

A fortified Barracks for a 2.5D arcane-industrial RTS, low broad military drill hall with thick stone lower walls, dark-steel roof framing, one large clearly visible unit exit gate, shield-shaped armor plates and training racks used only as geometric motifs, small watch platform, compact enclosed yard footprint, practical construction intended for mass infantry production, team-color roof trim and gate plates, visually sturdier than the Arcane Tower but less industrial than the Workshop, no medieval castle towers, no text, premium stylized 3D RTS building concept, use the shared rendering language.

---

## `building.arcane-tower`

Canonical concept filename: `concept-building-arcane-tower.webp`  
Recommended aspect ratio: `4:3`

**Prompt**

An Arcane Tower that functions as an elemental research, training and spell-relay building, tall but broad-based stone-and-steel tower with a large suspended neutral crystal prism near the top, thick circular focusing ring, four modular elemental attachment sockets arranged around the ring, visible ceramic insulators and restrained mana conduits, narrow protected doorway, strong vertical silhouette clearly different from all production buildings, team-color roof cap and ring armor plates, magical technology expressed as engineered hardware rather than decorative fantasy architecture, no giant wizard spire, no floating castle, premium stylized 3D RTS building concept, use the shared rendering language.

---

## `building.workshop`

Canonical concept filename: `concept-building-workshop.webp`  
Recommended aspect ratio: `4:3`

**Prompt**

A heavy Workshop used to build Engineers, Golems and Siege Constructs, broad asymmetrical industrial military structure with reinforced stone base, large open service bay, thick overhead gantry crane, forge housing, heavy side doors sized for constructs, one restrained exhaust stack, visible large gears only where mechanically plausible, stacked armor plates and repair frames as major shapes, no steampunk clutter, no modern factory, team-color service-bay frame and roof plates, strongest visual cues are the large construct door and crane, premium stylized 3D RTS building concept, use the shared rendering language.

---

## `building.outpost`

Canonical concept filename: `concept-building-outpost.webp`  
Recommended aspect ratio: `4:3`

**Prompt**

A compact territorial Outpost for an arcane-industrial frontier army, small octagonal fortified blockhouse with low stone walls, dark-steel corner armor, raised central beacon mast with a neutral crystal signal lamp, broad team-color ownership panels visible from above, one protected gate, attachment points for later Watchtower, Barrier Hub or Mana Beacon specialization, designed to read as a supply / territory node rather than a full base, modest footprint, clear elevated beacon silhouette, no giant castle, no text, premium stylized 3D RTS building concept, use the shared rendering language.

---

## `building.extractor`

Canonical concept filename: `concept-building-extractor.webp`  
Recommended aspect ratio: `4:3`

**Prompt**

A Material Extractor that visibly must be built directly on a mineral deposit, low radial industrial structure clamped around a large faceted amber-gold ore / construction-crystal outcrop, three heavy mechanical extraction arms, stone-and-steel anchor pads, compact conveyor or hopper module, open center so the resource deposit remains visible from above, vulnerable utilitarian silhouette rather than fortress architecture, team-color machine housing panels, no floating crystals, no modern oil derrick, no text, premium stylized 3D RTS building concept, use the shared rendering language.

---

## `building.mana-well`

Canonical concept filename: `concept-building-mana-well.webp`  
Recommended aspect ratio: `4:3`

**Prompt**

A fortified Mana Well installation built around a naturally luminous blue-violet mana source in the ground, circular stone containment basin with a clearly visible glowing center, three curved steel siphon arms arching over the well, thick glass-like mana channels leading into a compact condenser reservoir, ceramic insulation and restrained arcane engineering, low defensive rim, team-color outer armor plates, obvious resource-site structure rather than a generic tower, visually distinct from the Material Extractor, no wizard fountain ornament, no text, premium stylized 3D RTS building concept, use the shared rendering language.

---

# 5. Construction-state reference

Canonical concept filename: `concept-building-construction-state.webp`  
Recommended aspect ratio: `4:3`

**Prompt**

A single Arcane-Industrial Frontier RTS building shown approximately forty percent complete during active construction, final foundation and major structural silhouette already readable, thick temporary timber-and-steel scaffolding, exposed stone courses, incomplete armor panels, a few suspended assembly components held by practical gantry frames, restrained neutral mana-assisted construction glow at connection points, no workers required in the image, no magical instant summoning, visibly vulnerable unfinished state, no text, no progress bar, premium stylized 3D RTS building concept, use the shared rendering language.

Purpose: establish a visual language for construction progress that can later be adapted to every building without relying only on HUD bars.

---

# 6. Generation workflow

Generate one asset per image.

Recommended sequence:

1. Vanguard
2. Spear Guard
3. Ranger
4. Scout
5. Elementalist base
6. four Elementalist alignment variants
7. Engineer
8. Golem
9. Siege Construct
10. Elemental Core
11. Barracks
12. Arcane Tower
13. Workshop
14. Outpost
15. Extractor
16. Mana Well
17. construction-state reference

Do not generate contact sheets during the approval stage. Review silhouette, role readability, faction consistency and element/team-color separation one image at a time.

After a concept is manually approved:

- keep the approved image as visual reference;
- create or commission the corresponding 3D model separately;
- preserve existing stable runtime asset IDs where they already exist;
- use GLB for final runtime models unless the asset pipeline later documents another format;
- do not replace deterministic gameplay behavior while replacing presentation assets.

---

# 7. Acceptance checklist for every approved concept

A concept is not final merely because it looks attractive. It must pass all of the following:

- role is recognizable without reading a label;
- silhouette remains recognizable at normal RTS camera scale;
- it belongs to the same Arcane-Industrial Frontier faction as the other assets;
- team-color surfaces are obvious and separate from elemental glow;
- elemental motifs communicate engineered battlefield technology rather than costume recolor;
- infantry remains human and readable;
- heavy constructs remain visually distinct from infantry;
- buildings communicate function from shape before detail;
- no obvious imitation of another game franchise;
- no text, letters, logos, watermarks or accidental symbols;
- geometry is plausible enough to become a 3D model;
- decorative detail does not overwhelm gameplay readability.
