import { describe, expect, it } from 'vitest';
import { M04Simulation } from '../../src/simulation/m04-simulation';
import { generateWorld } from '../../src/world/generator';
import { WorldCellFlag, type GeneratedWorld } from '../../src/world/world-definition';
import { worldCellToSimulationPosition } from '../../src/world/world-arena';

function playerSpawnRegion(world: GeneratedWorld): number {
  const spawn = world.spawns.find((candidate) => candidate.id === 'PLAYER');
  if (!spawn) throw new Error('Missing player spawn.');
  return spawn.regionId;
}

function buildableCell(world: GeneratedWorld, regionId: number): { x: number; z: number } {
  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const index = z * world.width + x;
      if (world.regionByCell[index] !== regionId) continue;
      if (((world.flags[index] ?? 0) & WorldCellFlag.BUILDABLE) !== 0) return { x, z };
    }
  }
  throw new Error('No buildable player-spawn cell.');
}

describe('post-roadmap Elementalist alignment', () => {
  it('rejects non-Attuned training and preserves immutable alignment on production completion', () => {
    const world = generateWorld(1_000_000);
    const simulation = new M04Simulation(world, { playerManaRules: true });
    const cell = buildableCell(world, playerSpawnRegion(world));
    const position = worldCellToSimulationPosition(world, cell);

    simulation.enqueueStrategicCommand({
      targetTick: 1,
      playerId: 0,
      type: 'BUILD',
      buildingType: 'ARCANE_TOWER',
      targetX: position.x,
      targetZ: position.z,
    });
    for (let tick = 0; tick < 351; tick += 1) simulation.step();

    const tower = simulation.strategy.snapshot().buildings.find((building) => building.type === 'ARCANE_TOWER' && building.playerId === 0);
    expect(tower?.completed).toBe(true);
    if (!tower) throw new Error('Arcane Tower did not complete.');

    simulation.enqueueStrategicCommand({
      targetTick: 352,
      playerId: 0,
      type: 'TRAIN',
      buildingId: tower.id,
      unitType: 'ELEMENTALIST',
      elementalistAlignment: 'ICE',
    });
    simulation.step();
    expect(simulation.strategy.snapshot().productionQueue.some((order) => order.unitType === 'ELEMENTALIST')).toBe(false);

    simulation.enqueueStrategicCommand({
      targetTick: 353,
      playerId: 0,
      type: 'TRAIN',
      buildingId: tower.id,
      unitType: 'ELEMENTALIST',
      elementalistAlignment: 'FIRE',
    });
    simulation.step();
    expect(simulation.snapshot().elementalAuthority.pendingProductionAlignments).toHaveLength(1);

    for (let tick = 0; tick < 220; tick += 1) simulation.step();
    const aligned = simulation.snapshot().elementalAuthority.alignedElementalists;
    expect(aligned).toHaveLength(1);
    expect(aligned[0]?.element).toBe('FIRE');
    const entityId = aligned[0]!.entityId;
    expect(simulation.entities.setElementalAlignment(entityId, 'WATER')).toBe(false);
    expect(simulation.entities.elementalAlignments.get(entityId)?.element).toBe('FIRE');
  });
});
