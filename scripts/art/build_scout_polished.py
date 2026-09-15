"""Generate the polished Scout GLB for Elemental Front.

Keeps the current rigid runtime animation contract: LegL, LegR, Weapon.
The silhouette follows the Arcane-Industrial Frontier scout brief: light armor,
compact hand crossbow, signal beacon/optic harness, map satchel, split cloak.
"""
from pathlib import Path
from build_specialist_polished import Model, common_legs

OUT = Path(__file__).resolve().parents[2] / 'public/assets/models'


def build_scout() -> Model:
    m = Model('Elemental Front Scout polished prototype')
    common_legs(m, hip_x=.15, y0=.56, armored=False)

    # Lean torso: deliberately narrower/lighter than Ranger and Engineer.
    m.lathe((0, 0, 0), [(.50, .19), (.72, .23), (.98, .20)], 'CLOTH', 10, depth=.64)
    m.wedge((0, .88, .03), (.46, .34, .21), 'LEATHER', 'Body', .72)
    m.box((0, .70, .00), (.48, .07, .25), 'LEATHER')

    # Short split cloak for motion/readability without Ranger-length fabric.
    for sign in (-1, 1):
        m.wedge((sign*.10, .48, -.11), (.15, .42, .13), 'CLOTH', 'Body', .28, z_skew=-.05)

    # Low-profile helmet + optical field lens.
    m.lathe((0, 0, 0), [(1.00, .16), (1.18, .19), (1.30, .10)], 'STEEL', 10, depth=.80)
    m.box((0, 1.17, .17), (.22, .05, .035), 'DARK')
    m.lathe((.10, 1.18, .205), [(-.025, .045), (.025, .045)], 'BRASS', 8, depth=.40)

    # Narrow shoulder guards preserve the fast/light silhouette.
    for sign in (-1, 1):
        m.box((sign*.29, 1.00, .01), (.14, .12, .18), 'EDGE')

    # Team scarf tab and beacon casing communicate ownership from above.
    m.box((-.08, 1.06, .18), (.24, .06, .03), 'TEAM')
    m.wedge((.17, .92, -.13), (.13, .24, .12), 'TEAM', 'Body', .35)

    # Signal beacon / spotting rig on the right shoulder/back.
    m.box((.31, .98, -.10), (.11, .42, .12), 'BRASS')
    m.box((.31, 1.18, -.10), (.22, .07, .12), 'EDGE')
    m.lathe((.31, 1.28, -.10), [(-.04, .06), (.04, .06)], 'TEAM', 8, depth=.60)
    m.box((.17, .92, -.18), (.04, .42, .04), 'LEATHER')

    # Map satchel and rolled survey kit.
    m.box((-.28, .72, -.02), (.20, .24, .16), 'LEATHER')
    m.box((-.28, .84, -.10), (.17, .035, .05), 'BRASS')
    m.lathe((-.34, .60, -.08), [(-.11, .045), (.11, .045)], 'CLOTH', 8, depth=.85)

    # Compact hand crossbow: visually distinct from Ranger's large arc bow.
    m.pivots['Weapon'] = [-.34, .88, .14]
    m.box((0, -.04, .20), (.07, .10, .50), 'WOOD', 'Weapon')
    m.box((0, -.04, .48), (.05, .05, .18), 'EDGE', 'Weapon')
    m.box((0, -.04, -.08), (.08, .16, .16), 'LEATHER', 'Weapon')
    m.wedge((0, .00, .20), (.62, .07, .08), 'EDGE', 'Weapon', .78)
    m.box((0, .00, .20), (.18, .12, .14), 'BRASS', 'Weapon')
    m.box((0, .07, .34), (.035, .035, .56), 'EDGE', 'Weapon')

    return m


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    build_scout().export(OUT / 'unit-scout.glb')
