# M08 — Elemental Tactical Jobs

**Status:** IMPLEMENTED FOR CORRECTION GATE C  
**Scope:** gameplay-role correction inside M08 before further visual/audio polish

## Product rule

Elements are not four interchangeable damage buttons. Each element must answer a different battlefield question and must remain useful even when its preferred terrain feature is absent.

The four player-facing tactical jobs are locked as:

| Element | Tactical job | Primary battlefield question |
| --- | --- | --- |
| Fire | Deny / clear cover | Where should the enemy be unable to remain, hide, or retreat? |
| Water | Set up / displace | Which units should be moved, made Wet, or prepared for a combo? |
| Ice | Control / create route | Where should movement stop, slow, or gain a temporary alternate route? |
| Lightning | Punish Wet clumps | Which conductive group should be executed after setup? |

## Fire — deny / clear cover

Fire must not depend on a remote decorative forest.

Runtime role:
- Fire deals immediate impact damage to hostile units in the target area.
- Flammable woodland ignites and becomes persistent hazardous ground.
- Units that remain on burning vegetation take deterministic damage over time.
- Intact woodland provides close-range concealment; burning it removes that concealment.
- Fire/Heat breaks temporary ice routes.

Tactical choice:
- preserve woodland for concealment, or burn it to expose/deny the position;
- preserve an ice crossing, or remove it to cut pursuit/retreat.

Fire therefore remains useful on open ground while woodland adds a terrain-specific second job.

## Water — set up / displace

Water is intentionally not a raw-damage spell.

Runtime role:
- Water Burst applies timed Wet on ground as well as in natural water.
- Water Burst pushes light units away from the impact point.
- Golem and Siege Construct are Wet but resist the push.
- Water extinguishes active burning cells and cools heated terrain.
- Wet increases Lightning damage and conductive chain reach.
- Standing in natural water refreshes Wet.

Tactical choice:
- disrupt formation or peel a light unit away;
- extinguish a route/position that Fire is denying;
- deliberately prepare a Lightning chain.

## Ice — control / create route

Ice must not duplicate the purpose of permanent natural bridges.

Runtime role:
- Freeze Chills dry units and Freezes units that are already Wet/Chilled.
- A strong Freeze turns freezable water into walkable ice in one tactical cast.
- Ice grants a movement-speed bonus while traversed.
- This creates an alternate temporary crossing at a player-chosen point instead of forcing use of an existing bridge.
- Fire/Heat can immediately melt the crossing back to blocked Water.
- Heavy Golem/Siege traversal stresses ice durability and can break it.

Tactical choice:
- use the safe permanent bridge, or create a faster/riskier route elsewhere;
- cross, flank, escape, or cut an enemy route by melting it afterward.

## Lightning — punish Wet clumps

Lightning is the execution element rather than a generic area spell.

Runtime role:
- Chain Lightning prefers more conductive targets.
- Dry-ground base damage is 55.
- Wet targets take the established +25% damage baseline.
- Dry chain range is 4 m; Wet/Water chain range is 6 m.
- Up to four additional jumps are allowed.
- Water is highly conductive; Ice is deliberately less conductive than Water.

Tactical choice:
- Lightning is strongest after Water or against units committed to natural water.
- Freezing water can improve mobility/control while reducing some Lightning opportunities.

## Forest cover rule

Woodland now has a reason to occupy rather than existing only as fuel:
- intact woodland conceals hostile units from long-range unit detection inside otherwise visible fog;
- ordinary units are revealed at close range;
- Ranger/Scout require even closer detection;
- active burning removes concealment immediately.

This rule is deterministic and presentation-independent. It gives Fire a concrete cover-clearing purpose.

## Player controls for this gate

- `R` — Fire
- `Q` — Water Burst
- `F` — Freeze / Ice
- `L` — Chain Lightning on hovered enemy
- `H` — Heat/melt test control retained temporarily

The normal HUD displays the four tactical jobs in a compact panel near the minimap so the battlefield center remains clear.

## Interaction loop

Canonical tactical sequence:

```text
Water Burst
→ Wet + displacement
→ Freeze for hard control
or
→ Lightning for conductive punishment
```

Canonical terrain sequence:

```text
Blocked river
→ Freeze at a chosen crossing point
→ temporary fast ice route
→ cross / flank
→ Fire or Heat removes the route
```

Canonical cover sequence:

```text
Enemy uses intact woodland concealment
→ Fire exposes the woodland
→ burning ground denies continued occupation
```

Not every interaction is a positive combo. The player must sometimes choose between mobility, concealment, conductivity, and denial.

## Explicitly not included in this correction gate

The tactical jobs are implemented here. Full spell-economy productionization remains a separate pass:
- final Mana spending/cooldown UI and balance;
- strategic spells and ultimates;
- final VFX assets and final licensed SFX;
- deeper forest ranged-accuracy/first-volley bonuses.

Those items must preserve the tactical jobs defined above rather than redefining them.
