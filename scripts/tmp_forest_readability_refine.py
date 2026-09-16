from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)


# Main forest masses: keep the requested high woodland density, but protect routes,
# introduce more internal gaps, and reduce the uniform wall-of-canopy effect.
path = Path('src/rendering/generated-world-render-bridge.ts')
s = path.read_text()
s = replace_once(
    s,
    """  private isNearStrategicSite(x: number, z: number, radius: number): boolean {\n    const sites: GridPoint[] = [\n      ...this.world.spawns.map((spawn) => spawn.cell),\n      ...this.world.resources.map((resource) => resource.cell),\n      ...this.world.pois.map((poi) => poi.cell),\n      this.world.objective.cell,\n      this.world.boss.cell,\n    ];\n    return sites.some((site) => Math.abs(site.x - x) <= radius && Math.abs(site.z - z) <= radius);\n  }\n\n  private renderForestMasses(): void {""",
    """  private isNearStrategicSite(x: number, z: number, radius: number): boolean {\n    const sites: GridPoint[] = [\n      ...this.world.spawns.map((spawn) => spawn.cell),\n      ...this.world.resources.map((resource) => resource.cell),\n      ...this.world.pois.map((poi) => poi.cell),\n      this.world.objective.cell,\n      this.world.boss.cell,\n    ];\n    return sites.some((site) => Math.abs(site.x - x) <= radius && Math.abs(site.z - z) <= radius);\n  }\n\n  private isNearRoute(x: number, z: number, radius: number): boolean {\n    for (let dz = -radius; dz <= radius; dz += 1) {\n      for (let dx = -radius; dx <= radius; dx += 1) {\n        const nx = x + dx;\n        const nz = z + dz;\n        if (!inBounds(this.world, nx, nz)) continue;\n        if (((this.world.flags[cellIndex(this.world, nx, nz)] ?? 0) & WorldCellFlag.ROUTE) !== 0) return true;\n      }\n    }\n    return false;\n  }\n\n  private renderForestMasses(): void {""",
    'route proximity helper',
)
s = replace_once(
    s,
    """        const index = cellIndex(this.world, x, z);\n        if (this.world.terrain[index] !== TerrainType.GROUND || this.world.biome[index] !== BiomeType.WOODLAND) continue;\n        if (this.isNearStrategicSite(x, z, 2)) continue;\n\n        const neighbors = sameBiomeNeighborCount(this.world, x, z, BiomeType.WOODLAND);\n        const variant = hashByte(x, z, this.world.identity.masterSeed + 211);\n        const dense = neighbors >= 6;""",
    """        const index = cellIndex(this.world, x, z);\n        const flags = this.world.flags[index] ?? 0;\n        if (this.world.terrain[index] !== TerrainType.GROUND || this.world.biome[index] !== BiomeType.WOODLAND) continue;\n        if ((flags & WorldCellFlag.ROUTE) !== 0 || this.isNearStrategicSite(x, z, 2)) continue;\n\n        const neighbors = sameBiomeNeighborCount(this.world, x, z, BiomeType.WOODLAND);\n        const variant = hashByte(x, z, this.world.identity.masterSeed + 211);\n        const routeEdge = this.isNearRoute(x, z, 1);\n        const dense = neighbors >= 6 && !routeEdge;""",
    'route-aware forest classification',
)
s = replace_once(
    s,
    """        const clusterLimit = cluster < 86 ? 246 : cluster < 168 ? 214 : cluster < 226 ? 156 : 88;\n        if (opening > clusterLimit) continue;\n        if (dense && (variant > 228 || groveCount >= 132)) continue;\n        if (!dense && (neighbors < 3 || variant > 188 || edgeCount >= 42)) continue;\n\n        const jitterX = ((hashByte(x, z, 223) / 255) - 0.5) * 1.72;\n        const jitterZ = ((hashByte(x, z, 227) / 255) - 0.5) * 1.72;\n        const scale = (dense ? 0.96 : 0.72) + (hashByte(x, z, 229) / 255) * (dense ? 0.31 : 0.23);""",
    """        const clusterLimit = cluster < 86 ? 238 : cluster < 168 ? 204 : cluster < 226 ? 148 : 72;\n        if (opening > clusterLimit) continue;\n        if (dense && (variant > 224 || groveCount >= 124)) continue;\n        if (!dense && (neighbors < 3 || variant > (routeEdge ? 94 : 178) || edgeCount >= 44)) continue;\n\n        const jitterX = ((hashByte(x, z, 223) / 255) - 0.5) * (routeEdge ? 1.05 : 1.68);\n        const jitterZ = ((hashByte(x, z, 227) / 255) - 0.5) * (routeEdge ? 1.05 : 1.68);\n        const baseScale = (dense ? 0.94 : 0.7) + (hashByte(x, z, 229) / 255) * (dense ? 0.29 : 0.21);\n        const scale = baseScale * (routeEdge ? 0.72 : 1);""",
    'forest gap and route buffer',
)
s = replace_once(
    s,
    """    const lobes = dense ? 10 + (variant % 4) : 5 + (variant % 3);""",
    """    const lobes = dense ? 8 + (variant % 4) : 4 + (variant % 3);""",
    'forest lobe count',
)
s = replace_once(
    s,
    """      const crownWidth = tier < 2 ? 0.62 : tier < 5 ? 0.7 : 0.76;\n      const crownHeight = tier < 2 ? 0.76 : tier < 5 ? 0.67 : 0.58;\n      const crownDepth = tier < 2 ? 0.56 : tier < 5 ? 0.63 : 0.69;""",
    """      const crownVariance = 0.9 + ((variant + index * 47) % 23) / 100;\n      const crownWidth = (tier < 2 ? 0.6 : tier < 5 ? 0.68 : 0.74) * crownVariance;\n      const crownHeight = (tier < 2 ? 0.78 : tier < 5 ? 0.66 : 0.56) * (1.08 - (crownVariance - 0.9) * 0.45);\n      const crownDepth = (tier < 2 ? 0.54 : tier < 5 ? 0.61 : 0.67) * (0.94 + ((variant + index * 19) % 17) / 100);""",
    'canopy proportion variation',
)
s = replace_once(
    s,
    """      const canopyMaterial = index % 3 === 0\n        ? this.canopyLightMaterial\n        : index % 3 === 1\n          ? this.canopyMidMaterial\n          : this.canopyDarkMaterial;""",
    """      const canopyTone = (variant + index * 31) % 7;\n      const canopyMaterial = canopyTone < 2\n        ? this.canopyDarkMaterial\n        : canopyTone < 6\n          ? this.canopyMidMaterial\n          : this.canopyLightMaterial;""",
    'canopy color distribution',
)
path.write_text(s)


# Secondary forest depth accents should support the canopy rather than doubling the
# same dense wall. Pull them away from roads and lower their count slightly.
path = Path('src/rendering/environment-detail-layer.ts')
s = path.read_text()
s = replace_once(
    s,
    """    const maxGroups = this.lowQuality ? 34 : 92;""",
    """    const maxGroups = this.lowQuality ? 28 : 72;""",
    'forest depth group cap',
)
s = replace_once(
    s,
    """        if ((flags & WorldCellFlag.ROUTE) !== 0 || isNearSite(this.world, x, z, 2)) continue;""",
    """        if ((flags & WorldCellFlag.ROUTE) !== 0 || touchesRoute(this.world, x, z) || isNearSite(this.world, x, z, 2)) continue;""",
    'forest depth route buffer',
)
s = replace_once(
    s,
    """        const openingLimit = patch < 96 ? 250 : patch < 188 ? 220 : 148;""",
    """        const openingLimit = patch < 96 ? 238 : patch < 188 ? 204 : 138;""",
    'forest depth clearings',
)
s = replace_once(
    s,
    """        const treeCount = this.lowQuality ? 3 + (variant % 2) : 5 + (variant % 3);""",
    """        const treeCount = this.lowQuality ? 3 + (variant % 2) : 4 + (variant % 3);""",
    'forest depth tree count',
)
s = replace_once(
    s,
    """          const canopyMaterial = tree % 3 === 0\n            ? this.canopyLightMaterial\n            : tree % 3 === 1\n              ? this.canopyMidMaterial\n              : this.canopyDarkMaterial;""",
    """          const canopyTone = (variant + tree * 29) % 7;\n          const canopyMaterial = canopyTone < 2\n            ? this.canopyDarkMaterial\n            : canopyTone < 6\n              ? this.canopyMidMaterial\n              : this.canopyLightMaterial;""",
    'forest accent color distribution',
)
path.write_text(s)
