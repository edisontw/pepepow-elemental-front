from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)


# Primary woodland masses: keep density and height, but reduce exposed pole-like
# trunks and diversify crown proportions so edges read as trees rather than columns.
path = Path('src/rendering/generated-world-render-bridge.ts')
s = path.read_text()
s = replace_once(
    s,
    """      const tier = (variant + index * 17) % 7;\n      const tierScale = tier < 2 ? 1.18 : tier < 5 ? 0.96 : 0.74;\n      const treeScale = scale * tierScale * (0.78 + ((variant + index * 41) % 34) / 100);\n      const height = 1.18 + ((variant + index * 29) % 78) / 100;""",
    """      const tier = (variant + index * 17) % 7;\n      const tierScale = tier < 2 ? 1.18 : tier < 5 ? 0.96 : 0.74;\n      const treeScale = scale * tierScale * (0.78 + ((variant + index * 41) % 34) / 100);\n      const height = 1.18 + ((variant + index * 29) % 78) / 100;\n      const crownWidth = tier < 2 ? 0.62 : tier < 5 ? 0.7 : 0.76;\n      const crownHeight = tier < 2 ? 0.76 : tier < 5 ? 0.67 : 0.58;\n      const crownDepth = tier < 2 ? 0.56 : tier < 5 ? 0.63 : 0.69;\n      const crownOffsetX = (((variant + index * 13) % 17) - 8) * 0.012 * treeScale;\n      const crownOffsetZ = (((variant + index * 23) % 19) - 9) * 0.011 * treeScale;""",
    'primary crown shape variables',
)
s = replace_once(
    s,
    """          new pc.Vec3(x, 0.5 * treeScale, z),\n          new pc.Vec3(0.09 * treeScale, 1.06 * treeScale, 0.09 * treeScale),""",
    """          new pc.Vec3(x, 0.39 * treeScale, z),\n          new pc.Vec3(0.11 * treeScale, 0.82 * treeScale, 0.11 * treeScale),""",
    'primary trunk proportion',
)
s = replace_once(
    s,
    """        new pc.Vec3(x, height * treeScale, z),\n        new pc.Vec3(0.66 * treeScale, 0.72 * treeScale, 0.59 * treeScale),\n        canopyMaterial,""",
    """        new pc.Vec3(\n          x + crownOffsetX,\n          (height - (tier < 2 ? 0.08 : 0.16)) * treeScale,\n          z + crownOffsetZ,\n        ),\n        new pc.Vec3(crownWidth * treeScale, crownHeight * treeScale, crownDepth * treeScale),\n        canopyMaterial,""",
    'primary lower crown proportion',
)
path.write_text(s)


# Secondary forest depth accents: hide more of the long trunks inside the canopy,
# offset crowns from the stem axis, and give tall/medium/small trees different profiles.
path = Path('src/rendering/environment-detail-layer.ts')
s = path.read_text()
s = replace_once(
    s,
    """          const tier = (variant + tree * 11) % 6;\n          const tierScale = tier < 2 ? 1.16 : tier < 4 ? 0.96 : 0.76;\n          const size = tierScale * (0.9 + (hashByte(this.world, x + tree, z, 919) / 255) * 0.42);\n          const trunkHeight = 1.02 + size * 0.62;""",
    """          const tier = (variant + tree * 11) % 6;\n          const tierScale = tier < 2 ? 1.16 : tier < 4 ? 0.96 : 0.76;\n          const size = tierScale * (0.9 + (hashByte(this.world, x + tree, z, 919) / 255) * 0.42);\n          const trunkHeight = 1.02 + size * 0.62;\n          const crownWidth = tier < 2 ? 0.46 : tier < 4 ? 0.54 : 0.61;\n          const crownHeight = tier < 2 ? 0.72 : tier < 4 ? 0.62 : 0.52;\n          const crownDepth = tier < 2 ? 0.42 : tier < 4 ? 0.49 : 0.56;\n          const crownShiftX = (((variant + tree * 29) % 13) - 6) * 0.012 * size;\n          const crownShiftZ = (((variant + tree * 31) % 15) - 7) * 0.011 * size;""",
    'accent crown shape variables',
)
s = replace_once(
    s,
    """          addPrimitive(root, 'cylinder', `Forest Accent Trunk ${tree + 1}`, [tx, trunkHeight * 0.47, tz], [0.07 * size, trunkHeight * 0.9, 0.07 * size], tree % 2 === 0 ? this.trunkMaterial : this.barkLightMaterial);""",
    """          addPrimitive(root, 'cylinder', `Forest Accent Trunk ${tree + 1}`, [tx, trunkHeight * 0.35, tz], [0.082 * size, trunkHeight * 0.7, 0.082 * size], tree % 2 === 0 ? this.trunkMaterial : this.barkLightMaterial);""",
    'accent trunk proportion',
)
s = replace_once(
    s,
    """          addPrimitive(root, 'sphere', `Forest Accent Crown ${tree + 1}`, [tx, trunkHeight + 0.3 * size, tz], [0.5 * size, 0.68 * size, 0.45 * size], canopyMaterial);""",
    """          addPrimitive(\n            root,\n            'sphere',\n            `Forest Accent Crown ${tree + 1}`,\n            [tx + crownShiftX, trunkHeight * 0.78 + 0.38 * size, tz + crownShiftZ],\n            [crownWidth * size, crownHeight * size, crownDepth * size],\n            canopyMaterial,\n          );""",
    'accent primary crown proportion',
)
s = replace_once(
    s,
    """            addPrimitive(root, 'sphere', `Forest Accent Crown Lobe ${tree + 1}`, [tx - 0.18 * size, trunkHeight + 0.42 * size, tz + 0.08 * size], [0.33 * size, 0.38 * size, 0.3 * size], tree === 0 ? this.canopyDarkMaterial : this.canopyMidMaterial);""",
    """            addPrimitive(root, 'sphere', `Forest Accent Crown Lobe ${tree + 1}`, [tx - 0.2 * size + crownShiftX, trunkHeight * 0.82 + 0.5 * size, tz + 0.09 * size + crownShiftZ], [0.36 * size, 0.34 * size, 0.32 * size], tree === 0 ? this.canopyDarkMaterial : this.canopyMidMaterial);""",
    'accent crown lobe integration',
)
path.write_text(s)
