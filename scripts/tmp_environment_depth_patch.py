from pathlib import Path
import re

path = Path('src/rendering/environment-detail-layer.ts')
text = path.read_text()


def rep(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, got {count}')
    text = text.replace(old, new, 1)


def sub(pattern: str, replacement: str, label: str) -> None:
    global text
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, got {count}')
    text = updated


sub(
    r'(function directionToTerrain\(world: GeneratedWorld, x: number, z: number, terrain: TerrainType\): readonly \[number, number\] \{.*?\n\})\n\nfunction isNearSite',
    r'''\1

function directionToRoute(world: GeneratedWorld, x: number, z: number): readonly [number, number] {
  for (const [dx, dz] of ORTHOGONAL_NEIGHBORS) {
    const nx = x + dx;
    const nz = z + dz;
    if (!inBounds(world, nx, nz)) continue;
    if (((world.flags[cellIndex(world, nx, nz)] ?? 0) & WorldCellFlag.ROUTE) !== 0) return [dx, dz];
  }
  return [0, 1];
}

function isNearSite''',
    'route direction helper',
)

rep('const maxGroups = this.lowQuality ? 18 : 38;', 'const maxGroups = this.lowQuality ? 20 : 46;', 'forest group cap')
rep('if (neighbors < 4 || variant > 212) continue;', 'if (neighbors < 4 || variant > 228) continue;', 'forest density gate')
sub(
    r'(root\.setPosition\(base\.x \+ jitterX, 0\.022, base\.z \+ jitterZ\);\n\s*root\.setEulerAngles\(0, variant \* 1\.37, 0\);)\n\n(\s*const treeCount = this\.lowQuality \? 2 \+ \(variant % 2\) : 3 \+ \(variant % 3\);)',
    r'''\1

        const contactScale = 0.92 + (variant / 255) * 0.34;
        addPrimitive(root, 'cylinder', 'Forest Floor Contact', [0, -0.004, 0], [1.45 * contactScale, 0.012, 1.02 * contactScale], this.woodlandFloorMaterial);
        if (!this.lowQuality) {
          addPrimitive(root, 'cylinder', 'Forest Leaf Litter', [0.22, -0.002, -0.12], [0.92 * contactScale, 0.009, 0.68 * contactScale], this.mudMaterial);
        }

\2''',
    'forest contact patches',
)
rep(
    "        addPrimitive(root, 'sphere', 'Forest Accent Understory B', [0.46, 0.075, -0.28], [0.31, 0.11, 0.24], this.undergrowthMaterial);",
    "        addPrimitive(root, 'sphere', 'Forest Accent Understory B', [0.46, 0.075, -0.28], [0.31, 0.11, 0.24], this.undergrowthMaterial);\n        if (!this.lowQuality) addPrimitive(root, 'sphere', 'Forest Accent Understory C', [0.08, 0.065, -0.56], [0.28, 0.09, 0.21], this.undergrowthMaterial);",
    'forest understory',
)

rep('const maxGroups = this.lowQuality ? 12 : 26;', 'const maxGroups = this.lowQuality ? 14 : 34;', 'river group cap')
rep('if (variant > 176) continue;', 'if (variant > 208) continue;', 'river density gate')
rep(
    "        addPrimitive(root, 'cylinder', 'River Mud Shelf', [0, 0.004, 0.24], [0.82, 0.012, 0.42], this.mudMaterial);",
    "        addPrimitive(root, 'cylinder', 'River Mud Shelf', [0, 0.004, 0.23], [0.98, 0.012, 0.48], this.mudMaterial);\n        addPrimitive(root, 'cylinder', 'River Wet Edge', [0, 0.006, 0.45], [0.76, 0.009, 0.17], this.woodlandFloorMaterial);",
    'river bank contact',
)
rep(
    '        const reedCount = this.lowQuality ? 3 : 5;',
    "        if (!this.lowQuality) addPrimitive(root, 'sphere', 'River Bank Grass', [0.38, 0.05, -0.12], [0.27, 0.08, 0.19], this.undergrowthMaterial);\n        const reedCount = this.lowQuality ? 3 : 5;",
    'river bank grass',
)

sub(
    r'(private renderRouteEdges\(\): void \{\n\s*)const maxGroups = this\.lowQuality \? 8 : 18;',
    r'\1const maxGroups = this.lowQuality ? 10 : 26;',
    'route group cap',
)
rep('if (variant > 118) continue;', 'if (variant > 154) continue;', 'route density gate')
sub(
    r'(const root = new pc\.Entity\(`Route Edge Accent \$\{x\},\$\{z\}`\);\n\s*const base = worldPosition\(this\.world, x, z\);)\n\s*root\.setPosition\(base\.x, 0\.024, base\.z\);\n\s*root\.setEulerAngles\(0, variant \* 1\.41, 0\);',
    r'''\1
        const [routeDx, routeDz] = directionToRoute(this.world, x, z);
        root.setPosition(base.x, 0.024, base.z);
        root.setEulerAngles(0, Math.atan2(routeDx, routeDz) * 180 / Math.PI + ((variant % 13) - 6), 0);
        addPrimitive(root, 'cylinder', 'Route Shoulder Wear', [0, -0.004, 0.12], [0.76, 0.01, 0.31], variant < 96 ? this.mudMaterial : this.plainsFloorMaterial);''',
    'route alignment and shoulder',
)
rep(
    "        addPrimitive(root, 'sphere', 'Route Verge Grass', [-0.2, 0.05, 0.18], [0.23, 0.08, 0.16], this.dryGrassMaterial);",
    "        addPrimitive(root, 'sphere', 'Route Verge Grass', [-0.24, 0.05, 0.18], [0.28, 0.08, 0.18], this.dryGrassMaterial);\n        if (!this.lowQuality && (variant & 3) === 0) addPrimitive(root, 'sphere', 'Route Verge Scrub', [0.32, 0.055, 0.25], [0.22, 0.09, 0.16], this.undergrowthMaterial);",
    'route verge dressing',
)

path.write_text(text)
