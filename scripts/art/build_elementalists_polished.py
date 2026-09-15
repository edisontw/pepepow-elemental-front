"""Generate polished Elementalist GLBs for PEPEPOW Elemental Front.

Presentation-only assets. Keeps the rigid runtime animation contract:
LegL, LegR, Weapon. Team color remains independent from elemental materials.
"""
from pathlib import Path
from build_specialist_polished import Model, common_legs, MATERIALS

OUT = Path(__file__).resolve().parents[2] / 'public/assets/models'

MATERIALS.update({
    'FIELD_COAT': {'color': (.09, .11, .12, 1), 'metallic': .02, 'roughness': .88},
    'FIRE': {'color': (.90, .38, .08, 1), 'metallic': .10, 'roughness': .45},
    'EMBER': {'color': (.98, .68, .18, 1), 'metallic': .18, 'roughness': .28},
    'WATER': {'color': (.08, .55, .70, 1), 'metallic': .04, 'roughness': .32},
    'FOAM': {'color': (.64, .88, .94, 1), 'metallic': .02, 'roughness': .25},
    'ICE': {'color': (.73, .91, .98, 1), 'metallic': .04, 'roughness': .16},
    'FROST': {'color': (.55, .76, .88, 1), 'metallic': .08, 'roughness': .22},
    'LIGHTNING': {'color': (.44, .32, .82, 1), 'metallic': .10, 'roughness': .34},
    'SPARK': {'color': (.78, .88, 1.0, 1), 'metallic': .08, 'roughness': .18},
})


def mage_base(name: str) -> Model:
    m = Model(name)
    common_legs(m, hip_x=.15, y0=.58, armored=False)

    # Practical armored field coat; elemental identity is deliberately not a costume recolor.
    m.lathe((0, 0, 0), [(.52, .21), (.76, .27), (1.10, .25)], 'FIELD_COAT', 10, depth=.68)
    m.wedge((0, .96, .05), (.52, .40, .25), 'STEEL', 'Body', .68)
    m.box((0, .78, .02), (.54, .08, .30), 'LEATHER')
    m.wedge((0, .55, .18), (.26, .54, .045), 'TEAM', 'Body', .42)
    for sign in (-1, 1):
        m.wedge((sign*.10, .45, -.08), (.16, .58, .16), 'FIELD_COAT', 'Body', .30, z_skew=-.06)

    # Compact hood / helmet and neutral shoulder protection.
    m.lathe((0, 0, 0), [(1.10, .17), (1.30, .20), (1.46, .11)], 'DARK', 10, depth=.82)
    m.box((0, 1.36, .18), (.16, .12, .045), 'DARK')
    for sign in (-1, 1):
        m.box((sign*.31, 1.00, .04), (.14, .22, .16), 'STEEL')
    m.box((-.20, 1.08, .16), (.11, .22, .03), 'TEAM')

    # Neutral belt reservoir keeps all four variants recognizably the same class.
    m.box((.24, .69, -.02), (.14, .20, .12), 'BRASS')
    return m


def build_fire() -> Model:
    m = mage_base('Elemental Front Fire Elementalist polished prototype')
    # One heat-cracked gauntlet and small heat-shield pack only.
    m.box((.34, .91, .06), (.14, .24, .15), 'FIRE')
    m.box((.22, 1.02, -.12), (.20, .28, .16), 'DARK')
    m.box((.22, 1.05, -.20), (.11, .10, .04), 'FIRE')
    m.wedge((.22, 1.25, -.13), (.12, .17, .13), 'BRASS', 'Body', .32)

    m.pivots['Weapon'] = [-.39, .98, .16]
    m.box((0, -.15, 0), (.06, .82, .06), 'WOOD', 'Weapon')
    m.box((0, .28, 0), (.15, .12, .13), 'DARK', 'Weapon')
    # Forge-lens fork / vents.
    for x in (-.09, .09):
        m.box((x, .40, 0), (.035, .22, .035), 'BRASS', 'Weapon')
    m.lathe((0, .39, 0), [(-.055, .09), (.055, .09)], 'EMBER', 8, 'Weapon', depth=.55)
    m.wedge((0, .52, 0), (.16, .12, .14), 'FIRE', 'Weapon', .20)
    return m


def build_water() -> Model:
    m = mage_base('Elemental Front Water Elementalist polished prototype')
    # Glass channel / pressure vessel on one forearm and compact reservoir.
    m.box((.34, .92, .06), (.12, .24, .13), 'WATER')
    m.box((.22, 1.02, -.12), (.17, .30, .15), 'FOAM')
    m.box((.22, 1.02, -.20), (.08, .22, .04), 'WATER')

    m.pivots['Weapon'] = [-.40, .98, .14]
    m.box((0, -.15, 0), (.06, .82, .06), 'WOOD', 'Weapon')
    m.ring((0, .40, 0), .14, .028, 'FOAM', 'Weapon', vertical=True, segments=18, sides=5)
    m.lathe((0, .40, 0), [(-.06, .08), (.06, .08)], 'WATER', 8, 'Weapon', depth=.60)
    m.box((0, .23, 0), (.10, .09, .09), 'BRASS', 'Weapon')
    return m


def build_ice() -> Model:
    m = mage_base('Elemental Front Ice Elementalist polished prototype')
    # Frost limited to one gauntlet and focus braces.
    m.box((.34, .92, .06), (.13, .24, .14), 'FROST')
    m.box((.22, 1.02, -.12), (.16, .28, .14), 'STEEL')
    for y, s in [(1.18, .10), (1.04, .08)]:
        pts=[(.17, y-.06, -.13), (.22, y+.10, -.13), (.27, y-.06, -.13), (.22, y-.01, -.23)]
        m.prism_path(pts, thickness=.025, material='ICE', name='Body', axis='x')

    m.pivots['Weapon'] = [-.39, 1.00, .16]
    m.box((0, -.15, 0), (.055, .84, .055), 'WOOD', 'Weapon')
    for x in (-.06, .06):
        pts=[(x-.03,.27,0),(x,.53,0),(x+.03,.27,0),(x,.12,-.08)]
        m.prism_path(pts, thickness=.03, material='ICE', name='Weapon', axis='x')
    m.box((0, .18, 0), (.12, .08, .08), 'EDGE', 'Weapon')
    return m


def build_lightning() -> Model:
    m = mage_base('Elemental Front Lightning Elementalist polished prototype')
    # One conductor forearm and ceramic-insulator pack.
    m.box((.34, .92, .06), (.13, .24, .14), 'LIGHTNING')
    m.box((.22, 1.02, -.12), (.17, .30, .14), 'BRASS')
    m.box((.13, 1.02, -.12), (.04, .24, .04), 'SPARK')
    m.box((.31, 1.02, -.12), (.04, .24, .04), 'SPARK')

    m.pivots['Weapon'] = [-.40, .98, .14]
    m.box((0, -.15, 0), (.055, .82, .055), 'WOOD', 'Weapon')
    m.box((0, .24, 0), (.10, .10, .10), 'BRASS', 'Weapon')
    for x in (-.06, .06):
        m.box((x, .42, 0), (.026, .26, .026), 'DARK', 'Weapon')
        m.box((x, .31, 0), (.05, .05, .05), 'SPARK', 'Weapon')
    m.box((0, .55, 0), (.16, .03, .03), 'LIGHTNING', 'Weapon')
    m.lathe((0, .39, 0), [(-.05, .07), (.05, .07)], 'LIGHTNING', 8, 'Weapon', depth=.50)
    return m


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    build_fire().export(OUT / 'unit-elementalist-fire.glb')
    build_water().export(OUT / 'unit-elementalist-water.glb')
    build_ice().export(OUT / 'unit-elementalist-ice.glb')
    build_lightning().export(OUT / 'unit-elementalist-lightning.glb')
