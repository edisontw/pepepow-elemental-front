# Elemental Front — Priority A/B Final Art Prompts

**Status:** CANONICAL MANUAL-GENERATION PROMPT PACK  
**Runtime fallback:** Current manifest GLBs remain playable until an asset is manually approved and uploaded.  
**Runtime format:** GLB preferred; transparent sprite/impostor output is an approved intermediate option for ordinary units.  
**Repository and UI language:** English.

This file defines the final-art generation contract. Generate one asset at a time. Do not generate eight independent directions and treat them as one canonical unit. Use one approved source design for every turnaround, sprite view, or 3D conversion.

## Shared style lock

Use this paragraph in every prompt:

> Arcane-Industrial Frontier, premium stylized 3D strategy game asset, futuristic semi-realistic cartoon with grounded military construction, late-medieval field engineering, elemental crystal technology, weathered dark steel, iron, stone, timber, leather, sparse brass, broad readable shapes, strong silhouette from an elevated 2.5D RTS camera, medium-detail PBR surfaces, restrained emissive accents, cinematic studio lighting from upper left, physically plausible construction, no franchise imitation, no text, no letters, no logos, no watermark, no UI, no contact sheet, no extra characters.

Team ownership and elemental identity are separate:

- team color is replaceable on shield faces, shoulder plates, banners, roof trims, and large armor plates;
- Fire, Water, Ice, and Lightning are represented by engineered focus materials and controlled emissive accents;
- never recolor the entire character to communicate an element.

Global negative prompt:

> no modern firearm, no tank, no spaceship, no cyberpunk neon, no hologram clutter, no generic robot army, no ornate fantasy costume overload, no Victorian gear clutter, no anime or chibi proportions, no tiny unreadable ornament, no readable runes, no symbols, no logo, no watermark.

## Generation order

1. `unit.vanguard`
2. `unit.elementalist.base`
3. `unit.elementalist.fire`
4. `unit.elementalist.water`
5. `unit.elementalist.ice`
6. `unit.elementalist.lightning`
7. `building.elemental-core`
8. `unit.spear-guard`
9. `unit.ranger`
10. `unit.scout`
11. `unit.engineer`
12. `building.barracks`
13. `building.arcane-tower`
14. `building.workshop`
15. `building.outpost`
16. `building.extractor`
17. `building.mana-well`

Approve the base Elementalist before generating its four alignment variants. Approve the Core before generating its construction or damaged states.

## Output modes

### A. GLB reference mode — preferred for hero assets

Generate a single isolated asset on a neutral matte ground in three-quarter view from slightly above. Preserve a clean silhouette, visible feet or foundation, and clear team-color replacement zones. This image is a modeling reference, not a final texture sheet.

### B. Turnaround mode — required before 3D conversion

Use the approved single-asset design as the reference. Generate front, left three-quarter, right three-quarter, rear, and side views of exactly the same asset, aligned to the same scale and neutral lighting. Keep armor seams, weapon length, elemental focus, proportions, and team-color panels identical across views. Do not add alternate equipment.

### C. 2.5D impostor mode — approved for ordinary units

Generate a transparent-background eight-direction turntable derived from the approved design. Keep the camera at the same elevated RTS angle, with identical lighting direction and ground contact. Use a clean alpha background and no shadow baked into the silhouette. The runtime may add a separate soft ground shadow and team-color overlay.

## Priority A prompts

### `unit.vanguard`

> A disciplined human Vanguard infantry soldier, medium-heavy frontline defender, broad asymmetric rectangular-kite shield as the dominant silhouette, compact single-handed arming blade, enclosed practical helmet with narrow visor, layered dark-steel cuirass over leather and cloth, reinforced boots, stable wide stance. Reserve a large replaceable team-color panel on the shield face and a smaller shoulder plate. No active elemental glow. [Shared style lock]

### `unit.elementalist.base`

> A human battlefield Elementalist as a military specialist, armored field coat over practical light plate, compact hood or helmet, modular two-handed focus staff with a large empty mechanical socket, reinforced gauntlets, small mana reservoir at the belt, no ceremonial robes, no oversized hat, neutral faint mana glow only. Reserve a team-color chest sash and shoulder plate. [Shared style lock]

### `unit.elementalist.fire`

> Use the approved Elementalist base body exactly. Replace only the staff focus with a black heat-shielded forge lens containing an ember-orange core, triangular vents, heat-cracked ceramic plates on one gauntlet, faint heat distortion. Keep team-color panels unchanged. Do not recolor the costume red. [Shared style lock]

### `unit.elementalist.water`

> Use the approved Elementalist base body exactly. Replace only the staff focus with a circular pressure ring around a suspended blue-green translucent fluid reservoir, smooth curved fittings, one glass channel on the forearm, subtle moving-fluid impression. Keep team-color panels unchanged. Do not recolor the costume blue. [Shared style lock]

### `unit.elementalist.ice`

> Use the approved Elementalist base body exactly. Replace only the staff focus with a thick forked pale-cyan crystal prism held in silver-white braces, frost limited to the focus and one gauntlet, strong angular geometry. Keep team-color panels unchanged. Avoid delicate snowflake ornament. [Shared style lock]

### `unit.elementalist.lightning`

> Use the approved Elementalist base body exactly. Replace only the staff focus with twin dark electrode forks separated by ivory ceramic insulators, restrained violet-white arcs between the forks, small conductor plates on one forearm. Keep team-color panels unchanged. Do not cover the whole body with electricity. [Shared style lock]

### `building.elemental-core`

> The Elemental Core headquarters, compact fortified citadel around a neutral mana reactor, broad circular-to-octagonal stone foundation, dark-steel buttresses, central suspended crystal core inside two thick rotating engineering rings, four large empty elemental socket pylons, fortified entrance visible from above, modest command tower, strong symmetrical silhouette, large replaceable team-color roof and armor panels. [Shared style lock]

## Priority B prompts

Use the same approved faction material language and team-color zones as Priority A.

- `unit.spear-guard`: human anti-heavy infantry with an extra-long two-handed pike, grounding spike, reinforced greaves, narrow body profile, forward-braced stance.
- `unit.ranger`: mobile human marksman with engineered recurved bow, readable bow arc, large quiver, split field cloak, light armor, no firearm.
- `unit.scout`: fast human reconnaissance skirmisher with compact hand crossbow or short scout bow, signal beacon, optical field lens, map satchel, minimal armor mass.
- `unit.engineer`: stocky human support specialist with repair gauntlet, compact field hammer, broad utility backpack, bridge or barrier panels, large readable tools.
- `building.barracks`: low broad fortified drill hall with one clearly visible unit exit gate, stone lower walls, dark-steel roof frame, compact training yard.
- `building.arcane-tower`: tall broad-based research and spell-relay tower with suspended neutral prism, focusing ring, four elemental sockets, ceramic insulators.
- `building.workshop`: asymmetrical heavy workshop with large construct service bay, overhead gantry crane, forge housing, repair frames, restrained exhaust stack.
- `building.outpost`: compact octagonal territorial blockhouse with raised neutral crystal beacon, broad team-color ownership panels, one protected gate.
- `building.extractor`: low radial machine clamped around an amber-gold deposit, three or four heavy extraction arms, open center preserving the visible resource outcrop.
- `building.mana-well`: circular stone containment basin around a blue-violet mana source, three curved siphon arms, visible condenser reservoir and channels.

## Approval checklist

- Role is recognizable without a label at normal RTS zoom.
- Silhouette remains readable at 64–128 px projected height.
- Same asset remains consistent across all views.
- Team-color surfaces are distinct from elemental glow.
- Infantry remains human; constructs remain heavy mechanical or stone roles.
- Buildings communicate function from above before surface detail.
- No text, logo, watermark, accidental symbols, or franchise imitation.
- The asset can be modeled or converted to GLB without inventing hidden geometry.

## Repository handoff

After manual approval, upload the selected final asset to the manifest path, change its manifest entry from `NEEDS_MANUAL_GENERATION` to `FINAL`, preserve the stable asset ID, and run the focused build plus GLB or sprite validation. Until then, the current runtime baseline remains the fallback.
