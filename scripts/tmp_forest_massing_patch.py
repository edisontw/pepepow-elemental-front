from pathlib import Path

path = Path('src/rendering/generated-world-render-bridge.ts')
s = path.read_text()
replacements = [
    ("""    for (let z = 2; z < this.world.height - 2; z += 2) {
      const stagger = (Math.floor(z / 2) & 1) === 0 ? 0 : 1;
      for (let x = 2 + stagger; x < this.world.width - 2; x += 2) {
        if (groveCount >= 72 && edgeCount >= 24) return;""",
     """    for (let z = 2; z < this.world.height - 2; z += 1) {
      for (let x = 2; x < this.world.width - 2; x += 1) {
        if (groveCount >= 132 && edgeCount >= 42) return;"""),
    ("""        if (dense && (variant > 218 || groveCount >= 72)) continue;
        if (!dense && (neighbors < 3 || variant > 154 || edgeCount >= 24)) continue;""",
     """        if (dense && (variant > 196 || groveCount >= 132)) continue;
        if (!dense && (neighbors < 3 || variant > 142 || edgeCount >= 42)) continue;"""),
    ("""        const scale = (dense ? 1.12 : 0.82) + (hashByte(x, z, 229) / 255) * (dense ? 0.34 : 0.22);""",
     """        const scale = (dense ? 1.0 : 0.76) + (hashByte(x, z, 229) / 255) * (dense ? 0.3 : 0.2);"""),
    ("""    const lobes = dense ? 10 + (variant % 3) : 5 + (variant % 2);""",
     """    const lobes = dense ? 10 + (variant % 4) : 5 + (variant % 3);"""),
    ("""      const ring = dense
        ? index < 2 ? 0.18 : index < 6 ? 0.62 : 0.96
        : index < 2 ? 0.32 : 0.68;""",
     """      const ring = dense
        ? index < 2 ? 0.16 : index < 6 ? 0.64 : 1.04
        : index < 2 ? 0.28 : 0.72;"""),
    ("""      const treeScale = scale * (0.72 + ((variant + index * 41) % 42) / 100);
      const height = 1.0 + ((variant + index * 29) % 58) / 100;""",
     """      const treeScale = scale * (0.82 + ((variant + index * 41) % 46) / 100);
      const height = 1.3 + ((variant + index * 29) % 76) / 100;"""),
    ("""      if (index < (dense ? 4 : 3)) {
        addChildPrimitive(
          root,
          'cylinder',
          'Forest Trunk',
          new pc.Vec3(x, 0.35 * treeScale, z),
          new pc.Vec3(0.085 * treeScale, 0.78 * treeScale, 0.085 * treeScale),
          this.trunkMaterial,
        );
      }""",
     """      if (index < (dense ? 7 : 4)) {
        addChildPrimitive(
          root,
          'cylinder',
          'Forest Trunk',
          new pc.Vec3(x, 0.5 * treeScale, z),
          new pc.Vec3(0.09 * treeScale, 1.06 * treeScale, 0.09 * treeScale),
          this.trunkMaterial,
        );
      }"""),
    ("""        new pc.Vec3(0.75 * treeScale, 0.58 * treeScale, 0.67 * treeScale),""",
     """        new pc.Vec3(0.72 * treeScale, 0.66 * treeScale, 0.64 * treeScale),"""),
    ("""      if (index < (dense ? 3 : 2)) {""",
     """      if (index < (dense ? 5 : 3)) {"""),
    ("""            (height + 0.48) * treeScale,""",
     """            (height + 0.6) * treeScale,"""),
    ("""          new pc.Vec3(0.5 * treeScale, 0.52 * treeScale, 0.45 * treeScale),""",
     """          new pc.Vec3(0.48 * treeScale, 0.55 * treeScale, 0.43 * treeScale),"""),
    ("""    const understoryCount = dense ? 4 : 3;""",
     """    const understoryCount = dense ? 6 : 4;"""),
]
for old, new in replacements:
    if old not in s:
        raise SystemExit(f'missing generated-world snippet: {old[:100]!r}')
    s = s.replace(old, new, 1)

upper_anchor = """      if (index < (dense ? 5 : 3)) {
        addChildPrimitive(
          root,
          'sphere',
          'Forest Upper Crown',
          new pc.Vec3(
            x + Math.cos(angle + 0.8) * 0.12 * treeScale,
            (height + 0.6) * treeScale,
            z + Math.sin(angle + 0.8) * 0.1 * treeScale,
          ),
          new pc.Vec3(0.48 * treeScale, 0.55 * treeScale, 0.43 * treeScale),
          index % 2 === 0 ? this.canopyDarkMaterial : this.canopyMidMaterial,
        );
      }
"""
upper_replacement = upper_anchor + """      if (dense && index < 3) {
        addChildPrimitive(
          root,
          'sphere',
          'Forest Side Crown',
          new pc.Vec3(
            x + Math.cos(angle - 0.95) * 0.34 * treeScale,
            (height + 0.18) * treeScale,
            z + Math.sin(angle - 0.95) * 0.27 * treeScale,
          ),
          new pc.Vec3(0.42 * treeScale, 0.39 * treeScale, 0.38 * treeScale),
          index % 2 === 0 ? this.canopyMidMaterial : this.canopyLightMaterial,
        );
      }
"""
if upper_anchor not in s:
    raise SystemExit('missing upper crown anchor')
s = s.replace(upper_anchor, upper_replacement, 1)
path.write_text(s)

path = Path('src/rendering/environment-detail-layer.ts')
s = path.read_text()
replacements = [
    ("""    const maxGroups = this.lowQuality ? 20 : 46;""",
     """    const maxGroups = this.lowQuality ? 34 : 92;"""),
    ("""    for (let z = 2; z < this.world.height - 2 && groups < maxGroups; z += 3) {
      const stagger = (Math.floor(z / 3) & 1) === 0 ? 0 : 1;
      for (let x = 2 + stagger; x < this.world.width - 2 && groups < maxGroups; x += 3) {""",
     """    for (let z = 2; z < this.world.height - 2 && groups < maxGroups; z += 2) {
      const stagger = (Math.floor(z / 2) & 1) === 0 ? 0 : 1;
      for (let x = 2 + stagger; x < this.world.width - 2 && groups < maxGroups; x += 2) {"""),
    ("""        if (neighbors < 4 || variant > 228) continue;""",
     """        if (neighbors < 3 || variant > 238) continue;"""),
    ("""        const treeCount = this.lowQuality ? 2 + (variant % 2) : 3 + (variant % 3);""",
     """        const treeCount = this.lowQuality ? 3 + (variant % 2) : 5 + (variant % 3);"""),
    ("""          const size = 0.78 + (hashByte(this.world, x + tree, z, 919) / 255) * 0.42;
          const trunkHeight = 0.86 + size * 0.44;""",
     """          const size = 0.9 + (hashByte(this.world, x + tree, z, 919) / 255) * 0.55;
          const trunkHeight = 1.05 + size * 0.58;"""),
    ("""          addPrimitive(root, 'cylinder', `Forest Accent Trunk ${tree + 1}`, [tx, trunkHeight * 0.43, tz], [0.065 * size, trunkHeight * 0.82, 0.065 * size], tree % 2 === 0 ? this.trunkMaterial : this.barkLightMaterial);""",
     """          addPrimitive(root, 'cylinder', `Forest Accent Trunk ${tree + 1}`, [tx, trunkHeight * 0.47, tz], [0.07 * size, trunkHeight * 0.9, 0.07 * size], tree % 2 === 0 ? this.trunkMaterial : this.barkLightMaterial);"""),
    ("""          addPrimitive(root, 'sphere', `Forest Accent Crown ${tree + 1}`, [tx, trunkHeight + 0.22 * size, tz], [0.48 * size, 0.61 * size, 0.43 * size], canopyMaterial);""",
     """          addPrimitive(root, 'sphere', `Forest Accent Crown ${tree + 1}`, [tx, trunkHeight + 0.3 * size, tz], [0.5 * size, 0.68 * size, 0.45 * size], canopyMaterial);"""),
    ("""          if (!this.lowQuality && (tree === 0 || (tree === 1 && variant > 112))) {""",
     """          if (!this.lowQuality && (tree < 2 || (tree === 2 && variant > 112))) {"""),
    ("""            addPrimitive(root, 'sphere', `Forest Accent Upper Crown ${tree + 1}`, [tx + 0.08 * size, trunkHeight + 0.72 * size, tz - 0.04 * size], [0.31 * size, 0.36 * size, 0.28 * size], tree === 0 ? this.canopyMidMaterial : this.canopyLightMaterial);""",
     """            addPrimitive(root, 'sphere', `Forest Accent Upper Crown ${tree + 1}`, [tx + 0.1 * size, trunkHeight + 0.86 * size, tz - 0.05 * size], [0.34 * size, 0.42 * size, 0.3 * size], tree === 0 ? this.canopyMidMaterial : this.canopyLightMaterial);"""),
]
for old, new in replacements:
    if old not in s:
        raise SystemExit(f'missing detail-layer snippet: {old[:100]!r}')
    s = s.replace(old, new, 1)
path.write_text(s)
