from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)


# --- Forest massing: keep the high density, but break the planted-row look into
# deterministic clustered pockets with internal openings and stronger height tiers.
path = Path('src/rendering/generated-world-render-bridge.ts')
s = path.read_text()
s = replace_once(
    s,
    """        const neighbors = sameBiomeNeighborCount(this.world, x, z, BiomeType.WOODLAND);\n        const variant = hashByte(x, z, this.world.identity.masterSeed + 211);\n        const dense = neighbors >= 6;\n        if (dense && (variant > 196 || groveCount >= 132)) continue;\n        if (!dense && (neighbors < 3 || variant > 142 || edgeCount >= 42)) continue;\n\n        const jitterX = ((hashByte(x, z, 223) / 255) - 0.5) * 1.05;\n        const jitterZ = ((hashByte(x, z, 227) / 255) - 0.5) * 1.05;\n        const scale = (dense ? 1.0 : 0.76) + (hashByte(x, z, 229) / 255) * (dense ? 0.3 : 0.2);""",
    """        const neighbors = sameBiomeNeighborCount(this.world, x, z, BiomeType.WOODLAND);\n        const variant = hashByte(x, z, this.world.identity.masterSeed + 211);\n        const dense = neighbors >= 6;\n        // Coarse deterministic cluster noise creates dense woodland pockets separated\n        // by small openings, instead of accepting nearly every cell in visible rows.\n        const patchX = Math.floor((x + ((z & 1) * 2)) / 5);\n        const patchZ = Math.floor(z / 4);\n        const cluster = hashByte(patchX, patchZ, this.world.identity.masterSeed + 239);\n        const opening = hashByte(x, z, this.world.identity.masterSeed + 241);\n        const clusterLimit = cluster < 86 ? 246 : cluster < 168 ? 214 : cluster < 226 ? 156 : 88;\n        if (opening > clusterLimit) continue;\n        if (dense && (variant > 228 || groveCount >= 132)) continue;\n        if (!dense && (neighbors < 3 || variant > 188 || edgeCount >= 42)) continue;\n\n        const jitterX = ((hashByte(x, z, 223) / 255) - 0.5) * 1.72;\n        const jitterZ = ((hashByte(x, z, 227) / 255) - 0.5) * 1.72;\n        const scale = (dense ? 0.96 : 0.72) + (hashByte(x, z, 229) / 255) * (dense ? 0.31 : 0.23);""",
    'forest cluster gating',
)
s = replace_once(
    s,
    """      const x = Math.cos(angle) * ring * scale;\n      const z = Math.sin(angle) * ring * 0.78 * scale;\n      const treeScale = scale * (0.82 + ((variant + index * 41) % 46) / 100);\n      const height = 1.3 + ((variant + index * 29) % 76) / 100;""",
    """      const radialJitter = 0.82 + ((variant + index * 53) % 37) / 100;\n      const x = Math.cos(angle) * ring * radialJitter * scale;\n      const z = Math.sin(angle) * ring * (0.68 + ((variant + index * 17) % 24) / 100) * scale;\n      const tier = (variant + index * 17) % 7;\n      const tierScale = tier < 2 ? 1.18 : tier < 5 ? 0.96 : 0.74;\n      const treeScale = scale * tierScale * (0.78 + ((variant + index * 41) % 34) / 100);\n      const height = 1.18 + ((variant + index * 29) % 78) / 100;""",
    'forest height tiers',
)
s = replace_once(
    s,
    """        new pc.Vec3(0.72 * treeScale, 0.66 * treeScale, 0.64 * treeScale),""",
    """        new pc.Vec3(0.66 * treeScale, 0.72 * treeScale, 0.59 * treeScale),""",
    'forest lower crown silhouette',
)
s = replace_once(
    s,
    """      if (index < (dense ? 5 : 3)) {""",
    """      if (index < (dense ? 6 : 3)) {""",
    'forest upper crown count',
)
s = replace_once(
    s,
    """            x + Math.cos(angle + 0.8) * 0.12 * treeScale,\n            (height + 0.6) * treeScale,\n            z + Math.sin(angle + 0.8) * 0.1 * treeScale,\n          ),\n          new pc.Vec3(0.48 * treeScale, 0.55 * treeScale, 0.43 * treeScale),""",
    """            x + Math.cos(angle + 0.8) * (0.11 + (index % 3) * 0.045) * treeScale,\n            (height + 0.58 + (index % 2) * 0.11) * treeScale,\n            z + Math.sin(angle + 0.8) * (0.09 + (index % 2) * 0.04) * treeScale,\n          ),\n          new pc.Vec3(0.45 * treeScale, 0.58 * treeScale, 0.4 * treeScale),""",
    'forest upper crown variation',
)
s = replace_once(
    s,
    """      if (dense && index < 3) {""",
    """      if (dense && index < 4) {""",
    'forest side crown count',
)
s = replace_once(
    s,
    """    const understoryCount = dense ? 6 : 4;\n    for (let index = 0; index < understoryCount; index += 1) {\n      const angle = index * 2.05 + variant * 0.043;\n      addChildPrimitive(\n        root,\n        'sphere',\n        'Forest Understory',\n        new pc.Vec3(Math.cos(angle) * 0.9 * scale, 0.105 * scale, Math.sin(angle) * 0.7 * scale),\n        new pc.Vec3(0.44 * scale, 0.17 * scale, 0.31 * scale),\n        this.understoryMaterial,\n      );\n    }""",
    """    const understoryCount = dense ? 7 : 4;\n    for (let index = 0; index < understoryCount; index += 1) {\n      const angle = index * 2.05 + variant * 0.043;\n      const radius = (0.52 + ((variant + index * 31) % 55) / 100) * scale;\n      const shrubScale = 0.78 + ((variant + index * 19) % 36) / 100;\n      addChildPrimitive(\n        root,\n        'sphere',\n        'Forest Understory',\n        new pc.Vec3(Math.cos(angle) * radius, 0.1 * scale, Math.sin(angle) * radius * 0.72),\n        new pc.Vec3(0.42 * shrubScale * scale, 0.16 * shrubScale * scale, 0.3 * shrubScale * scale),\n        this.understoryMaterial,\n      );\n    }""",
    'forest understory irregularity',
)
path.write_text(s)


# --- Secondary environment forest accents: de-regularize positions and mix tall,
# medium, and small trees so the extra density reads as natural depth rather than rows.
path = Path('src/rendering/environment-detail-layer.ts')
s = path.read_text()
s = replace_once(
    s,
    """        const neighbors = sameBiomeNeighborCount(this.world, x, z, BiomeType.WOODLAND);\n        const variant = hashByte(this.world, x, z, 901);\n        if (neighbors < 3 || variant > 238) continue;\n\n        const root = new pc.Entity(`Forest Depth Accent ${x},${z}`);\n        const base = worldPosition(this.world, x, z);\n        const jitterX = (hashByte(this.world, x, z, 907) / 255 - 0.5) * 0.95;\n        const jitterZ = (hashByte(this.world, x, z, 911) / 255 - 0.5) * 0.95;""",
    """        const neighbors = sameBiomeNeighborCount(this.world, x, z, BiomeType.WOODLAND);\n        const variant = hashByte(this.world, x, z, 901);\n        const patch = hashByte(this.world, Math.floor(x / 5), Math.floor(z / 4), 887);\n        const opening = hashByte(this.world, x, z, 889);\n        const openingLimit = patch < 96 ? 250 : patch < 188 ? 220 : 148;\n        if (neighbors < 3 || variant > 242 || opening > openingLimit) continue;\n\n        const root = new pc.Entity(`Forest Depth Accent ${x},${z}`);\n        const base = worldPosition(this.world, x, z);\n        const jitterX = (hashByte(this.world, x, z, 907) / 255 - 0.5) * 1.62;\n        const jitterZ = (hashByte(this.world, x, z, 911) / 255 - 0.5) * 1.62;""",
    'detail forest cluster gating',
)
s = replace_once(
    s,
    """          const angle = tree * 2.39996 + variant * 0.019;\n          const radius = tree === 0 ? 0.1 : 0.42 + tree * 0.09;\n          const tx = Math.cos(angle) * radius;\n          const tz = Math.sin(angle) * radius * 0.78;\n          const size = 0.9 + (hashByte(this.world, x + tree, z, 919) / 255) * 0.55;\n          const trunkHeight = 1.05 + size * 0.58;""",
    """          const angle = tree * 2.39996 + variant * 0.019;\n          const radius = tree === 0 ? 0.08 : 0.3 + ((variant + tree * 37) % 74) / 100;\n          const tx = Math.cos(angle) * radius;\n          const tz = Math.sin(angle) * radius * (0.62 + ((variant + tree * 13) % 30) / 100);\n          const tier = (variant + tree * 11) % 6;\n          const tierScale = tier < 2 ? 1.16 : tier < 4 ? 0.96 : 0.76;\n          const size = tierScale * (0.9 + (hashByte(this.world, x + tree, z, 919) / 255) * 0.42);\n          const trunkHeight = 1.02 + size * 0.62;""",
    'detail forest tree tiers',
)
path.write_text(s)


# --- Context inspector: show only the three high-value combat stats for a unit.
path = Path('src/ui/context-inspector.ts')
s = path.read_text()
s = replace_once(
    s,
    """        <div class=\"context-stat\"><small>Damage</small><b>${unit.attackDamage}</b></div>\n        <div class=\"context-stat\"><small>Range</small><b>${formatMetres(unit.attackRange)} m</b></div>\n        <div class=\"context-stat\"><small>Attack cycle</small><b>${attackCycleSeconds.toFixed(1)} s</b></div>\n        <div class=\"context-stat\"><small>Move speed</small><b>${formatSpeed(unit.archetype)} m/s</b></div>\n        <div class=\"context-stat\"><small>Population</small><b>${definition.population}</b></div>\n        <div class=\"context-stat\"><small>Capture</small><b>${(definition.capturePowerTenths / 10).toFixed(1)}</b></div>""",
    """        <div class=\"context-stat\"><small>Damage</small><b>${unit.attackDamage}</b></div>\n        <div class=\"context-stat\"><small>Range</small><b>${formatMetres(unit.attackRange)} m</b></div>\n        <div class=\"context-stat\"><small>Attack cycle</small><b>${attackCycleSeconds.toFixed(1)} s</b></div>""",
    'compact unit stats',
)
path.write_text(s)


# --- HUD layout authority: minimap -> compact inspector -> Element Tactics.
path = Path('src/layout.css')
s = path.read_text()
s = replace_once(
    s,
    """#app #elemental-jobs {\n  top: 15.45rem;""",
    """#app #elemental-jobs {\n  top: 25.25rem;""",
    'desktop tactics position',
)
s = replace_once(
    s,
    """/* Keep contextual unit/building details in the open center lane instead of\n   covering either persistent side HUD. The inspector injects a late runtime\n   style block, so these placement constraints intentionally use !important. */\n.context-inspector {\n  left: 50% !important;\n  right: auto !important;\n  bottom: .55rem !important;\n  width: min(25rem, calc(100vw - 39rem)) !important;\n  max-width: 25rem !important;\n  transform: translateX(-50%);\n  z-index: 9 !important;\n}""",
    """/* Compact right-side context stack: minimap -> unit/building inspector -> tactics.\n   The inspector injects a late runtime style block, so placement and compact sizing\n   intentionally use !important here as the final layout authority. */\n.context-inspector {\n  top: 15.45rem !important;\n  right: .55rem !important;\n  bottom: auto !important;\n  left: auto !important;\n  width: 13.35rem !important;\n  max-width: calc(100vw - 1.1rem) !important;\n  max-height: 9.2rem !important;\n  padding: .52rem .58rem .56rem !important;\n  overflow-x: hidden !important;\n  overflow-y: auto !important;\n  transform: none !important;\n  z-index: 9 !important;\n}\n\n.context-inspector .context-kicker {\n  font-size: .48rem !important;\n  letter-spacing: .11em !important;\n}\n\n.context-inspector h3 {\n  margin: .08rem 0 .12rem !important;\n  font-size: .76rem !important;\n  line-height: 1.15 !important;\n}\n\n.context-inspector .context-subtitle {\n  margin-bottom: .28rem !important;\n  font-size: .54rem !important;\n  line-height: 1.28 !important;\n}\n\n.context-inspector .context-health {\n  height: .24rem !important;\n  margin: .26rem 0 .16rem !important;\n}\n\n.context-inspector .context-stats {\n  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;\n  gap: .22rem !important;\n  margin: .32rem 0 .08rem !important;\n}\n\n.context-inspector .context-stat {\n  padding: .24rem .28rem !important;\n}\n\n.context-inspector .context-stat small {\n  font-size: .42rem !important;\n  letter-spacing: .055em !important;\n}\n\n.context-inspector .context-stat b {\n  font-size: .56rem !important;\n}\n\n.context-inspector .context-production {\n  margin-top: .38rem !important;\n  padding-top: .34rem !important;\n}\n\n.context-inspector .context-actions {\n  gap: .22rem !important;\n}\n\n.context-inspector button {\n  min-height: 1.7rem !important;\n  padding: .24rem .32rem !important;\n  font-size: .52rem !important;\n}""",
    'right-side inspector stack',
)
s = replace_once(
    s,
    """  .context-inspector {\n    width: min(23rem, calc(100vw - 36rem)) !important;\n  }""",
    """  .context-inspector {\n    width: 13.35rem !important;\n  }""",
    '1280 inspector width',
)
s = replace_once(
    s,
    """  #app #elemental-jobs { top: 13.6rem; width: 11.5rem; padding: .5rem; }""",
    """  #app #elemental-jobs { top: 22.75rem; width: 11.5rem; padding: .5rem; }""",
    '1100 tactics position',
)
s = replace_once(
    s,
    """  .context-inspector {\n    width: min(21rem, calc(100vw - 30rem)) !important;\n  }""",
    """  .context-inspector {\n    top: 13.6rem !important;\n    width: 11.5rem !important;\n    max-height: 8.55rem !important;\n  }""",
    '1100 inspector',
)
s = replace_once(
    s,
    """@media (max-width: 900px) {\n  #app #camera-help { display: none; }\n  .context-inspector {\n    width: min(22rem, calc(100vw - 18rem)) !important;\n  }\n}""",
    """@media (max-width: 900px) {\n  #app #camera-help { display: none; }\n  .context-inspector {\n    right: .55rem !important;\n    width: 11.5rem !important;\n  }\n}""",
    '900 inspector',
)
s = replace_once(
    s,
    """  .context-inspector {\n    top: .5rem !important;\n    bottom: auto !important;\n    width: min(22rem, calc(100vw - 12rem)) !important;\n  }""",
    """  .context-inspector {\n    top: 12.35rem !important;\n    right: .5rem !important;\n    bottom: auto !important;\n    left: auto !important;\n    width: 10.5rem !important;\n    max-height: 8.4rem !important;\n  }""",
    '800 inspector',
)
path.write_text(s)
