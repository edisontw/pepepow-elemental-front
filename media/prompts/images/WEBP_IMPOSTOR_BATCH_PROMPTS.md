# Elemental Front — Batch WebP Impostor Source-Sheet Prompts

**Status:** ACTIVE MANUAL-GENERATION BATCH PACK  
**Scope:** all player unit visual variants  
**Runtime authority:** presentation only  
**Repository/UI language:** English

This pack is optimized for generating all eight-direction unit source sheets first, then performing one manual binary upload batch.

## Critical terminology

In this file, **eight-direction sheet** means a character turntable / sprite-impostor source sheet.

It does **not** mean a radar chart, wind rose, compass chart, statistical diagram, infographic, or data visualization.

Generate exactly one game character or construct repeated in eight directional views.

## Shared source-sheet contract

Use this block for every unit below:

> Create one premium stylized 3D RTS **character eight-direction turntable source sheet**, not a chart and not an infographic. Show exactly the same single game unit in eight consistent directional views, arranged as a clean 4 columns x 2 rows grid. Cell order is fixed: top row = FRONT, FRONT-LEFT, LEFT, REAR-LEFT; bottom row = REAR, REAR-RIGHT, RIGHT, FRONT-RIGHT. Do not print those direction names or any other text in the image. Every cell must preserve exactly the same armor, weapon, body proportions, equipment, materials, camera elevation, apparent scale, feet baseline, and lighting. Elevated 2.5D RTS camera, approximately 30-35 degrees downward, near-orthographic perspective. Full body visible in every cell. Neutral transparent background if supported; otherwise flat removable neutral background. No ground plane, no baked contact shadow, no environment, no extra characters, no alternate equipment, no pose redesign between views. Idle-ready stance only. Arcane-Industrial Frontier visual language: late-medieval military readability, early-industrial field engineering, elemental crystal technology, weathered dark steel, iron, leather, stone where appropriate, sparse brass, broad readable shapes, medium-detail PBR surfaces, restrained emissive accents, premium strategy-game production quality. Team ownership zones must remain visually separate from elemental glow. No franchise imitation, no modern firearm, no tank, no spaceship, no generic sci-fi robot army, no cyberpunk neon, no ornate fantasy costume overload, no anime/chibi proportions, no readable runes, no symbols, no logo, no watermark, no UI, no chart, no radar plot, no wind rose, no compass diagram, no labels.

### Source-sheet layout

```text
[ front ] [ front-left ] [ left ] [ rear-left ]
[ rear  ] [ rear-right ] [ right ] [ front-right ]
```

The labels above document crop order only; they must not appear in generated art.

## Batch set

Generate these 11 source sheets before manual upload:

1. `unit.vanguard` -> slug `vanguard`
2. `unit.elementalist.fire` -> slug `elementalist-fire`
3. `unit.elementalist.water` -> slug `elementalist-water`
4. `unit.elementalist.ice` -> slug `elementalist-ice`
5. `unit.elementalist.lightning` -> slug `elementalist-lightning`
6. `unit.spear-guard` -> slug `spear-guard`
7. `unit.ranger` -> slug `ranger`
8. `unit.scout` -> slug `scout`
9. `unit.engineer` -> slug `engineer`
10. `unit.golem` -> slug `golem`
11. `unit.siege-construct` -> slug `siege-construct`

The neutral Elementalist base is a design reference, not a separate runtime combat alignment, so it is not part of the 11 runtime impostor sets.

## Unit-specific prompt blocks

Append exactly one of the following descriptions after the shared source-sheet contract.

### 1. `unit.vanguard`

> A disciplined human Vanguard infantry soldier, medium-heavy frontline defender. Dominant silhouette: broad asymmetric rectangular-kite shield and compact one-handed arming blade. Practical enclosed helmet with narrow visor, layered dark-steel cuirass over leather and cloth, reinforced boots, stable wide stance. Reserve a large neutral replaceable team-color panel on the shield face and a smaller shoulder plate. No active elemental glow. Clearly human, not robotic.

### 2. `unit.elementalist.fire`

> A human battlefield Elementalist military specialist using the canonical Elementalist body: armored field coat over practical light plate, compact hood or helmet, reinforced gauntlets, small mana reservoir at the belt, modular two-handed focus staff. Fire alignment changes only the engineered focus: black heat-shielded forge lens with ember-orange core, triangular vents, heat-cracked ceramic on one gauntlet, restrained heat distortion. Keep the costume mostly dark neutral military materials; do not recolor the whole body red. The staff orientation and hand placement must remain identical across all eight views.

### 3. `unit.elementalist.water`

> Use exactly the same canonical human Elementalist body, silhouette, clothing, armor, staff length, hand placement, and proportions as the other aligned Elementalists. Water alignment changes only the engineered focus: circular pressure ring around a suspended blue-green translucent fluid reservoir, smooth curved fittings, one glass channel on the forearm, subtle contained-fluid glow. Do not recolor the whole costume blue.

### 4. `unit.elementalist.ice`

> Use exactly the same canonical human Elementalist body, silhouette, clothing, armor, staff length, hand placement, and proportions as the other aligned Elementalists. Ice alignment changes only the engineered focus: thick forked pale-cyan crystal prism held in silver-white braces, frost limited to the focus and one gauntlet, strong angular geometry. Avoid snowflake ornament and do not recolor the whole costume cyan.

### 5. `unit.elementalist.lightning`

> Use exactly the same canonical human Elementalist body, silhouette, clothing, armor, staff length, hand placement, and proportions as the other aligned Elementalists. Lightning alignment changes only the engineered focus: twin dark electrode forks separated by ivory ceramic insulators, restrained violet-white arcs between the forks, small conductor plates on one forearm. No full-body electricity and no purple costume recolor.

### 6. `unit.spear-guard`

> Human anti-heavy Spear Guard infantry. Dominant silhouette: an extra-long two-handed pike clearly longer than the unit height, reinforced spear head, rear grounding spike and counterweight. Small forearm brace instead of a large shield, heavier greaves and chest protection, narrow armored body profile, forward-braced practical stance. Team-color zones on upper-arm plates and waist tab. No elemental glow.

### 7. `unit.ranger`

> Mobile human Ranger marksman. Dominant silhouette: thick readable engineered recurved bow arc and large visible quiver. Light layered armor, split field cloak, low-profile hood or helmet, leather and muted steel, agile grounded stance. No firearm and no energy rifle. Team-color zone on shoulder strip and cloak clasp. No active elemental glow.

### 8. `unit.scout`

> Fast human reconnaissance Scout. Long-legged lightly armored silhouette, compact hand crossbow or very short scout bow, folded signal beacon, optical field lens on shoulder harness, small map satchel, narrow shoulder plates, short split cloak. Posture communicates speed and observation rather than frontline combat. No mount, motorcycle, or firearm. Team-color zone on scarf tab and beacon casing.

### 9. `unit.engineer`

> Stocky human frontline Engineer support specialist. Reinforced medium-light armor, broad utility backpack with folded bridge/barrier panels, one large mechanical repair gauntlet, compact forged field hammer, visible clamps and cable reels as large readable forms, practical protective helmet and sturdy boots. No firearm. Team-color zone on backpack plate and shoulder panel. Silhouette must be clearly distinct from the Elementalist.

### 10. `unit.golem`

> Massive battlefield Golem with about two and a half times the visual mass of human infantry. Arcane construct made from huge dark stone blocks bound by forged iron armor bands, broad shoulders, oversized forearms, short thick legs, low head embedded in torso, one large neutral arcane core recessed behind protective metal ribs. Heavy and conductive appearance. No cockpit, no pilot, no humanoid robot face, no sleek science-fiction plating. Team-color armor plates on both shoulders.

### 11. `unit.siege-construct`

> Low elongated unmanned Siege Construct on four very large reinforced spoked wheels. Central heavy torsion-and-arcane bombard mechanism with thick counterweighted arms and a neutral glowing focusing chamber, folded stabilizer outriggers, exposed mechanical middle section, armored front plate, rear maintenance platform. Team-color side armor panels. Must read as long-range anti-building machinery without resembling a modern cannon, tank, tracked vehicle, or sci-fi turret. Keep the whole vehicle fully visible in all eight views and preserve wheel count and mechanism geometry exactly.

## Generation consistency rules

- Generate one source sheet per unit/variant, not eight independent images.
- Keep all four aligned Elementalists on the same base body and staff dimensions.
- Weapon handedness must not flip between left/right views.
- Rear views must show genuine rear geometry, not a mirrored front.
- Left/right diagonal views must be geometrically plausible continuations of front/rear views.
- Maintain the same elevated camera angle for every sheet.
- Favor silhouette consistency over fine ornament.
- If a sheet has duplicated, mirrored, missing, or anatomically inconsistent views, regenerate that sheet before crop/export.

## Crop/export contract after approval

For every approved source sheet, crop/export to transparent `192x256` WebP frames in this exact order:

```text
00-front.webp
01-front-left.webp
02-left.webp
03-rear-left.webp
04-rear.webp
05-rear-right.webp
06-right.webp
07-front-right.webp
```

Target directory:

```text
public/assets/impostors/<slug>/
```

Do not rename the eight runtime files.

## Batch manual-upload target directories

```text
public/assets/impostors/vanguard/
public/assets/impostors/elementalist-fire/
public/assets/impostors/elementalist-water/
public/assets/impostors/elementalist-ice/
public/assets/impostors/elementalist-lightning/
public/assets/impostors/spear-guard/
public/assets/impostors/ranger/
public/assets/impostors/scout/
public/assets/impostors/engineer/
public/assets/impostors/golem/
public/assets/impostors/siege-construct/
```

After the complete manual upload, verify all eight files for every intended slug on GitHub `main` before runtime integration. Runtime integration may then be performed as one coherent presentation batch with narrow mapping/URL tests and one final TypeScript/build pass.
