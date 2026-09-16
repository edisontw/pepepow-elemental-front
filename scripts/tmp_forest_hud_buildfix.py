from pathlib import Path

path = Path('src/ui/context-inspector.ts')
s = path.read_text()
old = """function formatSpeed(unitType: UnitArchetype): string {\n  const worldUnitsPerSecond = UNITS[unitType].spawn.speedPerTick * TICKS_PER_SECOND;\n  return (worldUnitsPerSecond / WORLD_UNITS_PER_METER).toFixed(1);\n}\n\n"""
if old not in s:
    raise SystemExit('missing formatSpeed helper')
path.write_text(s.replace(old, '', 1))
