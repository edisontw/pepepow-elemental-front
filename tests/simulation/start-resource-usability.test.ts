import { describe, expect, it } from 'vitest';
import { M03Simulation } from '../../src/simulation/m03-simulation';
import { generateWorld } from '../../src/world/generator';
import { worldCellToSimulationPosition } from '../../src/world/world-arena';

describe('default-block starting resource usability', () => {
  it('offers a player-start Material Deposit that accepts an Extractor', () => {
    const world = generateWorld(1_000_000);
    const simulation = new M03Simulation(world);
    const playerSpawn = world.spawns.find((spawn) => spawn.id === 'PLAYER');
    expect(playerSpawn).toBeDefined();
    const material = world.resources.find((resource) => (
      resource.type === 'MATERIAL' && resource.regionId === playerSpawn!.regionId
    ));
    expect(material).toBeDefined();
    const position = worldCellToSimulationPosition(world, material!.cell);
    expect(simulation.strategy.processCommand({
      targetTick: 1,
      playerId: 0,
      type: 'BUILD',
      buildingType: 'EXTRACTOR',
      targetX: position.x,
      targetZ: position.z,
      resourceNodeId: material!.id,
    }, 1)).toBe(true);
  });
});
