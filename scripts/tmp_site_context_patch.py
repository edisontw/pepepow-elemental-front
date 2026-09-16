from pathlib import Path


def patch_file(path_str: str, replacements: list[tuple[str, str, str]]) -> None:
    path = Path(path_str)
    text = path.read_text()
    for old, new, label in replacements:
        count = text.count(old)
        if count != 1:
            raise SystemExit(f'{path_str} / {label}: expected one match, got {count}')
        text = text.replace(old, new, 1)
    path.write_text(text)


patch_file('src/rendering/environment-detail-layer.ts', [
    (
        'const maxGroups = this.lowQuality ? 8 : 18;',
        'const maxGroups = this.lowQuality ? 9 : 22;',
        'highland group cap',
    ),
    (
        'if (variant > 182) continue;',
        'if (variant > 204) continue;',
        'highland density gate',
    ),
    (
        "        root.setEulerAngles(0, variant * 1.13, 0);\n        addPrimitive(root, 'box', 'Highland Accent Rock A', [-0.28, 0.15, 0.02], [0.72, 0.29, 0.38], this.rockDarkMaterial, [8, 16, 8]);",
        "        root.setEulerAngles(0, variant * 1.13, 0);\n        addPrimitive(root, 'cylinder', 'Highland Scree Bed', [0, -0.004, 0], [1.02, 0.012, 0.68], this.highlandFloorMaterial);\n        addPrimitive(root, 'box', 'Highland Accent Rock A', [-0.28, 0.15, 0.02], [0.72, 0.29, 0.38], this.rockDarkMaterial, [8, 16, 8]);",
        'highland scree grounding',
    ),
    (
        'const count = this.lowQuality ? 1 : 2;',
        'const count = this.lowQuality ? 1 : 3;',
        'settlement service count',
    ),
    (
        "        addPrimitive(root, 'cylinder', 'Service Ground Wear', [0, 0, 0], [0.82, 0.012, 0.62], this.settlementFloorMaterial);",
        "        addPrimitive(root, 'cylinder', 'Service Ground Wear', [0, 0, 0], [0.9, 0.012, 0.68], this.settlementFloorMaterial);\n        if (!this.lowQuality) addPrimitive(root, 'cylinder', 'Service Track Wear', [0.38, 0.001, -0.28], [0.62, 0.009, 0.34], variant < 128 ? this.mudMaterial : this.plainsFloorMaterial);",
        'settlement service grounding',
    ),
])


patch_file('src/rendering/poi-render-bridge.ts', [
    (
        "  private readonly stoneBaseMaterial = createMaterial(new pc.Color(0.28, 0.29, 0.27), undefined, 1, 0, 0.12);\n  private readonly stoneLightMaterial = createMaterial(new pc.Color(0.44, 0.44, 0.4), undefined, 1, 0, 0.16);",
        "  private readonly siteGroundMaterial = createMaterial(new pc.Color(0.255, 0.235, 0.175), undefined, 1, 0, 0.055);\n  private readonly stoneBaseMaterial = createMaterial(new pc.Color(0.28, 0.29, 0.27), undefined, 1, 0, 0.12);\n  private readonly stoneLightMaterial = createMaterial(new pc.Color(0.44, 0.44, 0.4), undefined, 1, 0, 0.16);",
        'poi site ground material',
    ),
    (
        "      this.enemyOwnershipMaterial,\n      this.stoneBaseMaterial,",
        "      this.enemyOwnershipMaterial,\n      this.siteGroundMaterial,\n      this.stoneBaseMaterial,",
        'poi destroy site ground material',
    ),
    (
        "    addPrimitive(\n      root,\n      'cylinder',\n      `${profile.label} Stone Apron`,",
        "    addPrimitive(\n      root,\n      'cylinder',\n      `${profile.label} Ground Wear A`,\n      [0, 0.012, 0],\n      [1.92, 0.018, 1.58],\n      this.siteGroundMaterial,\n    );\n    addPrimitive(\n      root,\n      'cylinder',\n      `${profile.label} Ground Wear B`,\n      [0.48, 0.014, -0.28],\n      [0.92, 0.016, 0.62],\n      this.siteGroundMaterial,\n      [0, 18, 0],\n    );\n\n    addPrimitive(\n      root,\n      'cylinder',\n      `${profile.label} Stone Apron`,",
        'poi layered ground context',
    ),
    (
        "      addPrimitive(root, 'box', 'Shrine Fallen Tablet', [0.58, 0.09, 0.5], [0.38, 0.12, 0.22], this.stoneLightMaterial, [9, 31, 14]);\n      return;",
        "      addPrimitive(root, 'box', 'Shrine Fallen Tablet', [0.58, 0.09, 0.5], [0.38, 0.12, 0.22], this.stoneLightMaterial, [9, 31, 14]);\n      addPrimitive(root, 'box', 'Shrine Threshold', [0, 0.075, -0.84], [0.72, 0.11, 0.28], this.stoneBaseMaterial, [0, 0, 0]);\n      return;",
        'shrine threshold',
    ),
    (
        "      addPrimitive(root, 'box', 'Camp Bedroll', [0.45, 0.07, -0.5], [0.48, 0.1, 0.25], this.clothMaterial, [0, -22, 0]);\n      addPrimitive(root, 'cylinder', 'Camp Fire Ring', [-0.15, 0.055, 0.63], [0.3, 0.05, 0.3], this.stoneLightMaterial);",
        "      addPrimitive(root, 'box', 'Camp Bedroll', [0.45, 0.07, -0.5], [0.48, 0.1, 0.25], this.clothMaterial, [0, -22, 0]);\n      addPrimitive(root, 'box', 'Camp Shelter Base', [-0.48, 0.17, 0.38], [0.62, 0.28, 0.46], this.campMaterial, [0, 24, 0]);\n      addPrimitive(root, 'box', 'Camp Shelter Canopy', [-0.48, 0.38, 0.38], [0.72, 0.1, 0.54], this.clothMaterial, [0, 24, 9]);\n      addPrimitive(root, 'cylinder', 'Camp Fire Ring', [-0.15, 0.055, 0.63], [0.3, 0.05, 0.3], this.stoneLightMaterial);",
        'camp shelter silhouette',
    ),
    (
        "      addPrimitive(root, 'box', 'Village Store', [-0.68, 0.2, -0.42], [0.48, 0.36, 0.42], this.timberMaterial, [0, 18, 0]);\n      addPrimitive(root, 'box', 'Village Roof', [-0.68, 0.45, -0.42], [0.56, 0.12, 0.5], this.darkTimberMaterial, [0, 18, 8]);\n      addPrimitive(root, 'cylinder', 'Village Barrel', [0.62, 0.13, 0.48], [0.14, 0.24, 0.14], this.darkTimberMaterial);\n      addPrimitive(root, 'box', 'Village Bench', [0.58, 0.11, -0.48], [0.46, 0.1, 0.16], this.timberMaterial, [0, -15, 0]);",
        "      addPrimitive(root, 'box', 'Village Store', [-0.68, 0.2, -0.42], [0.48, 0.36, 0.42], this.timberMaterial, [0, 18, 0]);\n      addPrimitive(root, 'box', 'Village Roof', [-0.68, 0.45, -0.42], [0.56, 0.12, 0.5], this.darkTimberMaterial, [0, 18, 8]);\n      addPrimitive(root, 'box', 'Village Shed', [0.62, 0.17, 0.24], [0.4, 0.3, 0.35], this.villageMaterial, [0, -16, 0]);\n      addPrimitive(root, 'box', 'Village Shed Roof', [0.62, 0.38, 0.24], [0.48, 0.1, 0.43], this.darkTimberMaterial, [0, -16, -8]);\n      addPrimitive(root, 'box', 'Village Market Table', [0.05, 0.13, -0.7], [0.56, 0.12, 0.32], this.timberMaterial, [0, 7, 0]);\n      addPrimitive(root, 'cylinder', 'Village Barrel', [0.86, 0.13, -0.34], [0.14, 0.24, 0.14], this.darkTimberMaterial);\n      addPrimitive(root, 'box', 'Village Bench', [0.45, 0.11, -0.48], [0.46, 0.1, 0.16], this.timberMaterial, [0, -15, 0]);",
        'village cluster silhouette',
    ),
    (
        "    addPrimitive(root, 'box', 'Ruin Broken Block B', [0.48, 0.055, -0.5], [0.28, 0.11, 0.22], this.stoneBaseMaterial, [-4, -27, 6]);",
        "    addPrimitive(root, 'box', 'Ruin Broken Block B', [0.48, 0.055, -0.5], [0.28, 0.11, 0.22], this.stoneBaseMaterial, [-4, -27, 6]);\n    addPrimitive(root, 'box', 'Ruin Broken Wall', [-0.2, 0.22, -0.68], [0.7, 0.42, 0.16], this.ruinMaterial, [5, 12, 3]);",
        'ruin wall silhouette',
    ),
])


patch_file('src/rendering/resource-render-bridge.ts', [
    (
        "      const scale = resource.rich ? 1.18 : 1;\n\n      primitive(root, 'cylinder', 'Resource Ground Footprint', [0, 0.028, 0], [1.16 * scale, 0.028, 1.0 * scale], this.groundFootprint);",
        "      const scale = resource.rich ? 1.18 : 1;\n\n      primitive(root, 'cylinder', 'Resource Disturbed Ground A', [0, 0.012, 0], [1.65 * scale, 0.015, 1.36 * scale], this.groundFootprint);\n      primitive(root, 'cylinder', 'Resource Disturbed Ground B', [0.48 * scale, 0.014, -0.36 * scale], [0.76 * scale, 0.013, 0.52 * scale], this.groundFootprint, [0, 18, 0]);\n      primitive(root, 'cylinder', 'Resource Ground Footprint', [0, 0.028, 0], [1.16 * scale, 0.028, 1.0 * scale], this.groundFootprint);",
        'resource layered ground context',
    ),
    (
        "        primitive(root, 'box', 'Mine Gantry Beam', [-0.03 * scale, 0.78 * scale, 0.37 * scale], [1.3 * scale, 0.065 * scale, 0.075 * scale], this.timber, [0, 0, 2]);",
        "        primitive(root, 'box', 'Mine Gantry Beam', [-0.03 * scale, 0.78 * scale, 0.37 * scale], [1.3 * scale, 0.065 * scale, 0.075 * scale], this.timber, [0, 0, 2]);\n        primitive(root, 'box', 'Mine Service Timber A', [-0.28 * scale, 0.055, -0.68 * scale], [0.08 * scale, 0.07 * scale, 0.82 * scale], this.timber, [0, 12, 0]);\n        primitive(root, 'box', 'Mine Service Timber B', [0.08 * scale, 0.052, -0.7 * scale], [0.07 * scale, 0.065 * scale, 0.7 * scale], this.timber, [0, 12, 0]);",
        'material deposit service timbers',
    ),
    (
        "        primitive(root, 'cylinder', 'Mana Stone Basin', [0, 0.085 * scale, 0], [0.88 * scale, 0.12 * scale, 0.88 * scale], this.manaStone);",
        "        primitive(root, 'cylinder', 'Mana Stone Basin', [0, 0.085 * scale, 0], [0.88 * scale, 0.12 * scale, 0.88 * scale], this.manaStone);\n        primitive(root, 'box', 'Mana Channel A', [-0.72 * scale, 0.055, 0.05], [0.62 * scale, 0.07 * scale, 0.12 * scale], this.manaStone, [0, 18, 0]);\n        primitive(root, 'box', 'Mana Channel B', [0.62 * scale, 0.052, -0.36 * scale], [0.54 * scale, 0.065 * scale, 0.11 * scale], this.manaStone, [0, -27, 0]);",
        'mana spring channels',
    ),
])
