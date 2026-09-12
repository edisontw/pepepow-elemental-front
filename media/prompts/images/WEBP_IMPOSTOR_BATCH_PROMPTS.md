# Elemental Front — Canonical Eight-Direction Unit Impostor Prompts

**Status:** CANONICAL MANUAL-GENERATION PACK  
**Scope:** all player unit visual variants  
**Runtime authority:** presentation only  
**Repository/UI language:** English

Use this file with `docs/UNIT_IMPOSTOR_ASSET_SPEC.md`.

The clean production rule is now:

> **Generate eight individual canonical direction images for each visual slug. Do not generate a 4x2 source sheet. Do not design around runtime remaps or fallback directions.**

Each unit below has one master prompt. Run that master prompt eight times, appending exactly one canonical view block from section 2 each time. Use an accepted previous direction as an image reference when the generator supports reference images so identity, proportions, handedness, and equipment remain stable.

---

## 1. Shared production constraints

Every generation must satisfy all of these constraints:

- one isolated game unit only;
- premium stylized 3D asset presentation for an elevated 2.5D RTS;
- Arcane-Industrial Frontier visual language: late-medieval military readability, early-industrial field engineering, engineered elemental crystal technology;
- strong silhouette and broad forms readable at RTS scale;
- weathered dark steel, iron, leather, stone where appropriate, sparse brass, medium-detail stylized PBR materials;
- elevated camera, approximately 30–35° downward pitch;
- near-orthographic / long-lens perspective with minimal perspective distortion;
- complete body/chassis and all essential equipment visible with generous safety margin;
- centered composition on a square 1024×1024 or larger source image;
- transparent background preferred; otherwise one flat uniform removable background color;
- no ground plane and no baked contact shadow;
- neutral idle-ready pose, not an attack/action pose;
- preserve the same pose family, body proportions, equipment geometry, handedness, team-color zones, camera elevation, apparent scale, and lighting across all eight images;
- team-color zones remain visually separate from elemental glow;
- no text, labels, symbols, logos, UI, borders, arrows, watermark, scenery, or extra characters.

### Global negative / constraint notes

> No mirror-generated opposite view, no duplicated direction, no changed weapon hand, no changed shield side, no changed quiver/backpack side, no alternate costume, no alternate weapon, no missing equipment, no extra limbs, no perspective/camera-height change, no close-up crop, no dramatic pose change, no ground plane, no baked shadow, no environment, no modern firearm, no assault rifle, no tank, no tracks, no spaceship, no cyberpunk neon, no futuristic hologram clutter, no generic humanoid robot army, no ornate high-fantasy costume overload, no Victorian steampunk gear clutter, no anime/chibi proportions, no photoreal portrait style, no franchise imitation, no readable runes, no lettering, no logo, no watermark.

---

## 2. Canonical view blocks

Append exactly one block to the selected unit master prompt. These labels describe **camera position around the unit**, not which way the character appears to point on screen.

### `00-front`

> CANONICAL VIEW 00 — FRONT. Place the camera directly in front of the unit so the unit's front face, chest/front armor, and front-facing equipment surfaces are visible symmetrically. This is a genuine front observer view, not a side-facing profile.

### `01-front-left`

> CANONICAL VIEW 01 — FRONT-LEFT. Orbit the camera exactly 45 degrees from front toward the unit's anatomical left side. Show a genuine front-left observer quarter view: the unit's front plus its anatomical left side. Preserve all asymmetric equipment on the same anatomical side; do not mirror the front-right image.

### `02-left`

> CANONICAL VIEW 02 — LEFT. Place the camera directly on the unit's anatomical left side, 90 degrees from front. Show the true anatomical-left profile and preserve weapon/shield/quiver/backpack handedness. Do not define this view merely as “character facing screen-left.”

### `03-rear-left`

> CANONICAL VIEW 03 — REAR-LEFT. Orbit the camera 135 degrees from front toward the unit's anatomical left side. Show a genuine rear-left observer quarter view: rear geometry plus anatomical left side. Do not mirror the rear-right image.

### `04-rear`

> CANONICAL VIEW 04 — REAR. Place the camera directly behind the unit. Show genuine rear armor, backpack, cloak, mechanism, wheel/chassis, and equipment attachment geometry as applicable. Do not reuse or mirror the front view.

### `05-rear-right`

> CANONICAL VIEW 05 — REAR-RIGHT. Orbit the camera 135 degrees from front toward the unit's anatomical right side. Show a genuine rear-right observer quarter view: rear geometry plus anatomical right side. Preserve all asymmetric landmarks; do not mirror the rear-left image.

### `06-right`

> CANONICAL VIEW 06 — RIGHT. Place the camera directly on the unit's anatomical right side, 90 degrees from front. Show the true anatomical-right profile and preserve weapon/shield/quiver/backpack handedness. Do not define this view merely as “character facing screen-right.”

### `07-front-right`

> CANONICAL VIEW 07 — FRONT-RIGHT. Orbit the camera exactly 45 degrees from front toward the unit's anatomical right side. Show a genuine front-right observer quarter view: the unit's front plus its anatomical right side. Preserve all asymmetric equipment on the same anatomical side; do not mirror the front-left image.

Save/rename the raw source using the matching index and direction name, preferably as PNG, before conversion.

---

# 3. Unit master prompts

## 1. Vanguard — `vanguard`

**Stable landmarks:** shield remains on the same arm; sword remains on the same hand; asymmetric shield/shoulder geometry must never flip.

**Master prompt**

> Generate ONE isolated canonical directional render of the exact same Vanguard used throughout this eight-view set. A disciplined human Vanguard frontline defender in the Arcane-Industrial Frontier faction: medium-heavy human infantry; broad asymmetric rectangular-kite shield as the dominant silhouette; compact one-handed arming blade with a subtly arcane forged edge; practical enclosed helmet with narrow visor; layered weathered dark-steel cuirass over leather and cloth; one heavier shoulder plate; reinforced boots; stable wide idle-ready stance; minimal ornament; large replaceable team-color panel on the shield face and a smaller shoulder panel; restrained neutral arcane-compatible sockets but no active elemental glow. Strong triangular defensive silhouette, clearly human rather than robotic. Premium stylized 3D 2.5D RTS asset, broad readable shapes, medium-detail PBR materials. Keep shield side, sword hand, armor asymmetry, proportions, stance, camera pitch, apparent scale, and lighting identical to the other seven directions. Full body and full shield/weapon visible, transparent background preferred, no ground plane, no baked contact shadow. Apply all shared production constraints and global negative notes. Append one canonical view block from section 2.

## 2. Spear Guard — `spear-guard`

**Stable landmarks:** pike head/counterweight orientation, hand order on shaft, forearm brace side.

**Master prompt**

> Generate ONE isolated canonical directional render of the exact same Spear Guard used throughout this eight-view set. Human anti-heavy Spear Guard infantry designed to stop constructs and charges; dominant silhouette is an extra-long two-handed pike clearly longer than the unit height, with thick reinforced spear head, rear grounding spike and heavy counterweight; small forearm brace plate rather than a large shield; heavier greaves and chest protection than the Vanguard; broad shoulder armor with a comparatively narrow body profile; practical forward-braced but neutral idle-ready stance; team-color upper-arm plates and cloth waist tab; no active elemental glow. The pike must remain fully visible and geometrically identical in every direction and must not make the human body unreadably tiny in frame. Premium stylized 3D 2.5D RTS asset, weathered dark steel/leather, broad readable shapes. Keep hand order, pike geometry, brace side, proportions, camera pitch, apparent scale, and lighting identical to the other seven directions. Transparent background preferred, no ground plane, no baked contact shadow. Apply all shared production constraints and global negative notes. Append one canonical view block from section 2.

## 3. Ranger — `ranger`

**Stable landmarks:** bow hand/draw hand, quiver side, cloak split and clasp.

**Master prompt**

> Generate ONE isolated canonical directional render of the exact same Ranger used throughout this eight-view set. Mobile human Ranger marksman for an elemental RTS; light layered armor; split practical field cloak; low-profile hood or helmet; compact engineered recurved arc-bow with thick readable limbs and a mechanical tension housing; large clearly visible quiver; leather and muted steel materials; agile grounded idle-ready stance; silhouette defined by the bow arc and cloak rather than heavy armor; team-color shoulder strip and cloak clasp; no firearm, no energy rifle, no active elemental glow. Premium stylized 3D 2.5D RTS asset with strong small-scale readability. Keep bow hand, draw hand, quiver side, cloak geometry, proportions, camera pitch, apparent scale, and lighting identical to the other seven directions. Full bow and quiver visible, transparent background preferred, no ground plane, no baked contact shadow. Apply all shared production constraints and global negative notes. Append one canonical view block from section 2.

## 4. Scout — `scout`

**Stable landmarks:** compact weapon side, beacon position, optical lens side, satchel side.

**Master prompt**

> Generate ONE isolated canonical directional render of the exact same Scout used throughout this eight-view set. Fast human reconnaissance Scout for an Arcane-Industrial Frontier army; long-legged lightly armored silhouette; compact hand crossbow or very short scout bow; folded signal beacon and optical field lens mounted on a shoulder harness; small map-tool satchel; narrow shoulder plates; short split cloak; minimal armor mass; posture communicates speed and observation rather than frontline combat; team-color scarf tab and beacon casing; no mount, motorcycle, firearm, or active elemental glow. Premium stylized 3D 2.5D RTS asset with an immediately readable scouting silhouette. Keep weapon side, beacon/lens/satchel positions, proportions, camera pitch, apparent scale, and lighting identical to the other seven directions. Full body/equipment visible, transparent background preferred, no ground plane, no baked contact shadow. Apply all shared production constraints and global negative notes. Append one canonical view block from section 2.

## 5. Fire Elementalist — `elementalist-fire`

**Stable landmarks:** same base Elementalist body as all other alignments; same staff length and hand placement; Fire focus geometry must not migrate or flip.

**Master prompt**

> Generate ONE isolated canonical directional render of the exact same FIRE-ALIGNED ELEMENTALIST used throughout this eight-view set. Human battlefield Elementalist military specialist, not a traditional wizard: canonical Elementalist body with armored field coat over practical light plate, compact hood or helmet, reinforced gauntlets, small mana reservoir at belt, and one modular two-handed focus staff. Fire alignment changes the engineered focus, not the entire costume: black heat-shielded forge lens containing an ember-orange core, triangular vent geometry, faint restrained heat distortion, small heat-cracked ceramic plates on one gauntlet. Keep the clothing mostly dark neutral military materials; do not recolor the body red. Team-color chest/shoulder zones remain separate from orange Fire glow. No large free-floating flame effect. Premium stylized 3D 2.5D RTS asset. Keep staff length, hand placement, body, focus geometry, gauntlet asymmetry, proportions, camera pitch, apparent scale, and lighting identical to the other seven Fire directions. Transparent background preferred, no ground plane, no baked contact shadow. Apply all shared production constraints and global negative notes. Append one canonical view block from section 2.

## 6. Ice Elementalist — `elementalist-ice`

**Stable landmarks:** same base Elementalist body and staff dimensions; forked prism orientation and frosted-gauntlet side stay fixed.

**Master prompt**

> Generate ONE isolated canonical directional render of the exact same ICE-ALIGNED ELEMENTALIST used throughout this eight-view set. Use the canonical human battlefield Elementalist body: armored field coat over practical light plate, compact hood or helmet, reinforced gauntlets, small mana reservoir at belt, modular two-handed focus staff. Ice alignment changes only the engineered focus: thick forked pale-cyan crystal prism held in silver-white braces, restrained frost limited to the focus and one gauntlet, strong angular prism geometry. No delicate snowflake ornament and no full-costume cyan recolor. Team-color chest/shoulder zones remain separate from Ice glow. Premium stylized 3D 2.5D RTS asset. Keep staff length, hand placement, body, prism geometry, frosted-gauntlet side, proportions, camera pitch, apparent scale, and lighting identical to the other seven Ice directions and consistent with the other Elementalist alignments. Transparent background preferred, no ground plane, no baked contact shadow. Apply all shared production constraints and global negative notes. Append one canonical view block from section 2.

## 7. Lightning Elementalist — `elementalist-lightning`

**Stable landmarks:** same base Elementalist body and staff dimensions; electrode fork orientation, insulators, conductor-plate side stay fixed.

**Master prompt**

> Generate ONE isolated canonical directional render of the exact same LIGHTNING-ALIGNED ELEMENTALIST used throughout this eight-view set. Use the canonical human battlefield Elementalist body: armored field coat over practical light plate, compact hood or helmet, reinforced gauntlets, small mana reservoir at belt, modular two-handed focus staff. Lightning alignment changes only the engineered focus: twin dark electrode forks separated by ivory ceramic insulators, very restrained violet-white electrical arcs only between the forks, small conductor plates on one forearm. No full-body electricity and no purple costume recolor. Team-color chest/shoulder zones remain separate from Lightning glow. Premium stylized 3D 2.5D RTS asset. Keep staff length, hand placement, body, electrode/insulator geometry, conductor-plate side, proportions, camera pitch, apparent scale, and lighting identical to the other seven Lightning directions and consistent with the other Elementalist alignments. Transparent background preferred, no ground plane, no baked contact shadow. Apply all shared production constraints and global negative notes. Append one canonical view block from section 2.

## 8. Water Elementalist — `elementalist-water`

**Stable landmarks:** same base Elementalist body and staff dimensions; pressure ring/reservoir geometry and forearm glass-channel side stay fixed.

**Master prompt**

> Generate ONE isolated canonical directional render of the exact same WATER-ALIGNED ELEMENTALIST used throughout this eight-view set. Use the canonical human battlefield Elementalist body: armored field coat over practical light plate, compact hood or helmet, reinforced gauntlets, small mana reservoir at belt, modular two-handed focus staff. Water alignment changes only the engineered focus: circular pressure ring surrounding a suspended blue-green translucent fluid reservoir, smooth curved fittings, one glass-like fluid channel on a forearm, subtle contained-fluid glow. Do not recolor the entire costume blue. Team-color chest/shoulder zones remain separate from Water glow. No large splash effect around the body. Premium stylized 3D 2.5D RTS asset. Keep staff length, hand placement, body, pressure-ring/reservoir geometry, forearm-channel side, proportions, camera pitch, apparent scale, and lighting identical to the other seven Water directions and consistent with the other Elementalist alignments. Transparent background preferred, no ground plane, no baked contact shadow. Apply all shared production constraints and global negative notes. Append one canonical view block from section 2.

## 9. Engineer — `engineer`

**Stable landmarks:** repair-gauntlet side, hammer hand, backpack panels, cable/clamp layout.

**Master prompt**

> Generate ONE isolated canonical directional render of the exact same Engineer used throughout this eight-view set. Stocky human frontline Engineer support specialist; reinforced medium-light armor; broad utility backpack with folded bridge/barrier panels; one large mechanical repair gauntlet; compact forged field hammer in the opposite hand; visible clamps, repair tools, and cable reels expressed as a few large readable forms rather than tiny clutter; practical protective helmet; sturdy boots; team-color backpack plate and shoulder panel; no firearm and no active elemental glow. The silhouette must be clearly human and clearly distinct from the Elementalist and from the old geometric placeholder. Premium stylized 3D 2.5D RTS asset. Keep repair-gauntlet side, hammer hand, backpack/panel/cable geometry, proportions, camera pitch, apparent scale, and lighting identical to the other seven directions. Full body/backpack/hammer visible, transparent background preferred, no ground plane, no baked contact shadow. Apply all shared production constraints and global negative notes. Append one canonical view block from section 2.

## 10. Golem — `golem`

**Stable landmarks:** core/rib geometry, shoulder armor markings, any deliberate asymmetric damage/plate arrangement.

**Master prompt**

> Generate ONE isolated canonical directional render of the exact same Golem used throughout this eight-view set. Massive battlefield arcane construct with roughly two and a half times the visual mass of ordinary human infantry; huge dark stone blocks bound by forged iron armor bands; very broad shoulders; oversized forearms; short thick legs; low head embedded in the torso; one large neutral arcane core recessed behind protective metal ribs; visibly heavy and conductive due to substantial iron binding; simple readable forms; replaceable team-color armor plates on both shoulders. No cockpit, pilot, humanoid robot face, sleek science-fiction plating, or active elemental alignment glow. Premium stylized 3D 2.5D RTS heavy-unit asset. Keep stone block shapes, iron bands, core/ribs, shoulder plates, proportions, camera pitch, apparent scale, and lighting identical to the other seven directions. Entire construct visible with safety margin, transparent background preferred, no ground plane, no baked contact shadow. Apply all shared production constraints and global negative notes. Append one canonical view block from section 2.

## 11. Siege Construct — `siege-construct`

**Stable landmarks:** front armor vs rear maintenance platform, four-wheel count and axle locations, torsion arms, focusing chamber, outrigger geometry.

**Master prompt**

> Generate ONE isolated canonical directional render of the exact same Siege Construct used throughout this eight-view set. Low elongated unmanned Arcane-Industrial Frontier siege machine on exactly four very large reinforced spoked wheels; central heavy torsion-and-arcane bombard mechanism with thick counterweighted arms and a restrained neutral glowing focusing chamber; folded stabilizer outriggers along the chassis; vulnerable exposed mechanical middle section; distinct armored front plate; distinct rear maintenance platform; replaceable team-color side armor panels. It must read as long-range anti-building machinery without resembling a modern cannon, tank, tracked vehicle, or futuristic turret. Premium stylized 3D 2.5D RTS asset with broad mechanically coherent forms. Keep front/rear identity, exactly four wheels, axle spacing, torsion arms, focusing chamber, outriggers, maintenance platform, proportions, camera pitch, apparent scale, and lighting identical to the other seven directions. Keep the entire vehicle visible even in side/diagonal views, transparent background preferred, no ground plane, no baked contact shadow. Apply all shared production constraints and global negative notes. Append one canonical view block from section 2.

---

## 4. Generation order and acceptance

Generate all 88 raw directions before runtime integration:

1. Vanguard
2. Spear Guard
3. Ranger
4. Scout
5. Elementalist Fire
6. Elementalist Ice
7. Elementalist Lightning
8. Elementalist Water
9. Engineer
10. Golem
11. Siege Construct

For each unit, accept the front view as the identity anchor first, then create the remaining seven views using that accepted image as a reference whenever supported. If one direction mutates identity or handedness, regenerate that direction; do not repair it with mirroring or runtime remapping.

After the 88 raw images are accepted, run `scripts/art/build_unit_impostors.py` to normalize scale, crop, alpha, baseline, filename, and WebP output for the manual-upload tree.
