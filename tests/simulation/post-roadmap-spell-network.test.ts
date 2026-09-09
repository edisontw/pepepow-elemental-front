import { describe, expect, it } from 'vitest';
import { M04Simulation } from '../../src/simulation/m04-simulation';
import type { StrategicSnapshot } from '../../src/simulation/strategic-state';
import { generateWorld } from '../../src/world/generator';
import { worldCellToSimulationPosition } from '../../src/world/world-arena';

describe('post-roadmap Strategic spell network', () => {
  it('uses a supplied Mana Beacon relay and loses reach when that relay is disconnected', () => {
    const world = generateWorld(4_950_628);
    const simulation = new M04Simulation(world, { playerManaRules: true });
    const strategic = simulation.strategy.snapshot();
    const core = strategic.buildings.find((building) => building.playerId === 0 && building.type === 'ELEMENTAL_CORE')!;

    let target = { x: core.x, z: core.z };
    for (let z = 0; z < world.height; z += 8) {
      for (let x = 0; x < world.width; x += 8) {
        const candidate = worldCellToSimulationPosition(world, { x, z });
        const dx = candidate.x - core.x;
        const dz = candidate.z - core.z;
        if (dx * dx + dz * dz > 30_000 * 30_000) {
          target = candidate;
          break;
        }
      }
      if (target.x !== core.x || target.z !== core.z) break;
    }

    const scoutId = simulation.entities.entityIds().find((entityId) => (
      simulation.entities.factions.get(entityId)?.playerId === 0
      && simulation.entities.archetypes.get(entityId) === 'SCOUT'
    ))!;
    const scoutPosition = simulation.entities.positions.get(scoutId)!;
    scoutPosition.x = target.x;
    scoutPosition.z = target.z;
    simulation.visibility.update(simulation.entities, simulation.navigation);

    const relay = {
      ...core,
      id: 999,
      type: 'OUTPOST' as const,
      specialization: 'MANA_BEACON' as const,
      x: target.x,
      z: target.z,
      regionId: core.regionId,
    };
    const withRelay: StrategicSnapshot = {
      ...strategic,
      buildings: [...strategic.buildings, relay],
    };
    expect(simulation.spellAuthority.selectStrategicAnchor(
      0, 'DELUGE', { kind: 'POINT', ...target }, 1, withRelay,
      simulation.attunements, simulation.visibility, simulation.navigation,
    )).toBe(999);

    const disconnected: StrategicSnapshot = {
      ...withRelay,
      suppliedRegions: { ...withRelay.suppliedRegions, 0: [] },
    };
    expect(simulation.spellAuthority.selectStrategicAnchor(
      0, 'DELUGE', { kind: 'POINT', ...target }, 1, disconnected,
      simulation.attunements, simulation.visibility, simulation.navigation,
    )).toBeNull();
  });

  it('keeps Strategic cooldown global per player and spell', () => {
    const simulation = new M04Simulation(generateWorld(4_950_628), { playerManaRules: true });
    expect(simulation.spellAuthority.strategicReady(0, 'DELUGE', 100)).toBe(true);
    simulation.spellAuthority.startStrategicCooldown(0, 'DELUGE', 100);
    expect(simulation.spellAuthority.strategicReady(0, 'DELUGE', 649)).toBe(false);
    expect(simulation.spellAuthority.strategicReady(0, 'DELUGE', 650)).toBe(true);
    expect(simulation.spellAuthority.strategicReady(1, 'DELUGE', 101)).toBe(true);
  });
});
