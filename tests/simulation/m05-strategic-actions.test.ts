import { describe, expect, it } from 'vitest';
import type { GameCommand } from '../../src/simulation/commands';
import type { M03Command } from '../../src/simulation/m03-commands';
import { M05Simulation } from '../../src/simulation/m05-simulation';
import { generateWorld } from '../../src/world/generator';
import { worldCellToSimulationPosition } from '../../src/world/world-arena';

function recorder() {
  const tactical: GameCommand[] = [];
  const strategic: M03Command[] = [];
  return {
    tactical,
    strategic,
    sink: {
      enqueueCommand: (command: GameCommand) => tactical.push(command),
      enqueueStrategicCommand: (command: M03Command) => strategic.push(command),
    },
  };
}

describe('M05 strategic action execution', () => {
  it('Flame Cult can turn legally observed player supply into a RAID move + capture order', () => {
    const world = generateWorld(1_000_000);
    const simulation = new M05Simulation(world, { faction: 'FLAME_CULT', difficulty: 'STANDARD' });
    const strategic = simulation.strategy.snapshot();
    const playerSpawn = world.spawns.find((spawn) => spawn.id === 'PLAYER');
    expect(playerSpawn).toBeDefined();
    if (!playerSpawn) return;
    expect(strategic.regionOwners[playerSpawn.regionId]).toBe(0);
    expect(strategic.suppliedRegions[0]).toContain(playerSpawn.regionId);

    const enemyIds = simulation.entities.entityIds().filter((entityId) => simulation.entities.factions.get(entityId)?.playerId === 1);
    const playerIds = simulation.entities.entityIds().filter((entityId) => simulation.entities.factions.get(entityId)?.playerId === 0);
    const observer = enemyIds[0];
    const observedPlayer = playerIds[0];
    expect(observer).toBeDefined();
    expect(observedPlayer).toBeDefined();
    if (observer === undefined || observedPlayer === undefined) return;

    for (const entityId of enemyIds.slice(1)) simulation.entities.health.get(entityId)!.alive = false;
    for (const entityId of playerIds.slice(1)) simulation.entities.health.get(entityId)!.alive = false;
    const center = worldCellToSimulationPosition(world, world.regions[playerSpawn.regionId]!.center);
    Object.assign(simulation.entities.positions.get(observer)!, center);
    Object.assign(simulation.entities.positions.get(observedPlayer)!, center);
    simulation.visibility.update(simulation.entities, simulation.navigation);

    const recorded = recorder();
    simulation.enemyWar.advance(1, strategic, recorded.sink);
    recorded.tactical.length = 0;
    recorded.strategic.length = 0;
    simulation.enemyWar.advance(3001, strategic, recorded.sink);

    const snapshot = simulation.enemyWar.snapshot();
    expect(snapshot.director.antiTurtleActive).toBe(true);
    expect(snapshot.knownPlayerSuppliedRegions).toContain(playerSpawn.regionId);
    expect(snapshot.currentDecision?.action).toBe('RAID');
    expect(snapshot.currentDecision?.targetRegionId).toBe(playerSpawn.regionId);
    expect(recorded.tactical.some((command) => command.type === 'MOVE' && command.playerId === 1)).toBe(true);
    expect(recorded.strategic.some((command) => (
      command.type === 'CAPTURE'
      && command.playerId === 1
      && command.targetRegionId === playerSpawn.regionId
    ))).toBe(true);
  });

  it('Iron Legion issues a REGROUP move to its Core when badly damaged and outmatched away from home', () => {
    const world = generateWorld(1_000_777);
    const simulation = new M05Simulation(world, { faction: 'IRON_LEGION', difficulty: 'STANDARD' });
    const strategic = simulation.strategy.snapshot();
    const enemySpawn = world.spawns.find((spawn) => spawn.id === 'ENEMY');
    const playerSpawn = world.spawns.find((spawn) => spawn.id === 'PLAYER');
    expect(enemySpawn).toBeDefined();
    expect(playerSpawn).toBeDefined();
    if (!enemySpawn || !playerSpawn) return;

    const neutralRegion = world.regions.find((region) => (
      region.id !== enemySpawn.regionId
      && region.id !== playerSpawn.regionId
      && strategic.regionOwners[region.id] === -1
    ));
    expect(neutralRegion).toBeDefined();
    if (!neutralRegion) return;

    const enemyIds = simulation.entities.entityIds().filter((entityId) => simulation.entities.factions.get(entityId)?.playerId === 1);
    const playerIds = simulation.entities.entityIds().filter((entityId) => simulation.entities.factions.get(entityId)?.playerId === 0);
    const survivor = enemyIds[0];
    expect(survivor).toBeDefined();
    if (survivor === undefined) return;
    for (const entityId of enemyIds.slice(1)) simulation.entities.health.get(entityId)!.alive = false;
    simulation.entities.health.get(survivor)!.current = 10;

    const contact = worldCellToSimulationPosition(world, neutralRegion.center);
    Object.assign(simulation.entities.positions.get(survivor)!, contact);
    for (const entityId of playerIds) Object.assign(simulation.entities.positions.get(entityId)!, contact);
    simulation.visibility.update(simulation.entities, simulation.navigation);

    const recorded = recorder();
    simulation.enemyWar.advance(1, strategic, recorded.sink);
    const snapshot = simulation.enemyWar.snapshot();
    expect(snapshot.currentDecision?.action).toBe('REGROUP');
    expect(snapshot.currentDecision?.targetRegionId).toBe(enemySpawn.regionId);

    const corePosition = worldCellToSimulationPosition(world, world.regions[enemySpawn.regionId]!.center);
    const regroupMove = recorded.tactical.find((command) => command.type === 'MOVE' && command.playerId === 1);
    expect(regroupMove).toBeDefined();
    if (!regroupMove || regroupMove.type !== 'MOVE') return;
    expect(regroupMove.targetX).toBe(corePosition.x);
    expect(regroupMove.targetZ).toBe(corePosition.z);
  });
});
