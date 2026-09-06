import { describe, expect, it } from 'vitest';
import { ENEMY_FACTIONS, scoreEnemyActions } from '../../src/simulation/m05-content';
import { M05Simulation } from '../../src/simulation/m05-simulation';
import { generateWorld } from '../../src/world/generator';
import { worldCellToSimulationPosition } from '../../src/world/world-arena';

describe('M05 imperfect-information tactical boundaries', () => {
  it('drops live ATTACK pursuit when the target leaves enemy vision and follows only last-known position', () => {
    const world = generateWorld(1_000_666);
    const simulation = new M05Simulation(world, { faction: 'IRON_LEGION', difficulty: 'STANDARD' });
    const playerId = simulation.entities.entityIds().find((entityId) => simulation.entities.factions.get(entityId)?.playerId === 0);
    const enemyId = simulation.entities.entityIds().find((entityId) => simulation.entities.factions.get(entityId)?.playerId === 1);
    expect(playerId).toBeDefined();
    expect(enemyId).toBeDefined();
    if (playerId === undefined || enemyId === undefined) return;

    const enemyPosition = simulation.entities.positions.get(enemyId)!;
    const playerPosition = simulation.entities.positions.get(playerId)!;
    playerPosition.x = enemyPosition.x + 500;
    playerPosition.z = enemyPosition.z;
    simulation.visibility.update(simulation.entities, simulation.navigation);
    expect(simulation.visibility.isWorldVisible(1, playerPosition.x, playerPosition.z, simulation.navigation)).toBe(true);

    simulation.enqueueCommand({ type: 'ATTACK', targetTick: 1, playerId: 1, entityIds: [enemyId], targetEntityId: playerId });
    simulation.step();
    const remembered = simulation.enemyWar.snapshot().lastKnownPlayerUnits.find((unit) => unit.entityId === playerId);
    expect(remembered).toBeDefined();
    expect(simulation.entities.combat.get(enemyId)?.targetEntityId).toBe(playerId);
    if (!remembered) return;

    const playerSpawn = world.spawns.find((spawn) => spawn.id === 'PLAYER');
    expect(playerSpawn).toBeDefined();
    if (!playerSpawn) return;
    const hidden = worldCellToSimulationPosition(world, playerSpawn.cell);
    playerPosition.x = hidden.x;
    playerPosition.z = hidden.z;
    simulation.visibility.update(simulation.entities, simulation.navigation);
    expect(simulation.visibility.isWorldVisible(1, hidden.x, hidden.z, simulation.navigation)).toBe(false);

    simulation.step();
    expect(simulation.entities.combat.get(enemyId)?.targetEntityId).toBeNull();
    const movement = simulation.entities.movements.get(enemyId);
    expect(movement?.targetX).not.toBe(hidden.x);
    expect(movement?.targetZ).not.toBe(hidden.z);
  });

  it('raises REGROUP utility under heavy damage, disadvantage, and recovery instead of forcing aggression', () => {
    const scores = scoreEnemyActions({
      ownStrength: 300,
      knownPlayerStrength: 900,
      visiblePlayerUnits: 1,
      ownRegionCount: 1,
      neutralFrontierCount: 0,
      threatenedOwnRegions: 1,
      knownPlayerSuppliedRegions: 0,
      contestablePoiCount: 0,
      unknownRegionCount: 0,
      damagedArmyPermille: 800,
      directorPressure: 20,
      recoveryActive: true,
      antiTurtleActive: false,
    }, ENEMY_FACTIONS.IRON_LEGION);
    expect(scores.REGROUP).toBeGreaterThan(scores.ATTACK);
  });
});
