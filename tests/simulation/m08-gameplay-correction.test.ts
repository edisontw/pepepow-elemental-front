import { describe, expect, it } from 'vitest';
import { M06Simulation } from '../../src/simulation/m06-simulation';
import { generateWorld } from '../../src/world/generator';

function placePlayerArmyAtEnemyCore(simulation: M06Simulation, damage: number): void {
  const core = simulation.run.snapshot().enemyCore;
  for (const entity of simulation.snapshot().entities) {
    if (!entity.alive || entity.playerId !== 0) continue;
    const position = simulation.entities.positions.get(entity.id);
    const combat = simulation.entities.combat.get(entity.id);
    if (position) {
      position.x = core.x;
      position.z = core.z;
    }
    if (combat) {
      combat.attackDamage = damage;
      combat.attackIntervalTicks = 1;
    }
  }
}

describe('M08 gameplay correction gate', () => {
  it('allows a Destroy rush to damage and destroy the enemy Core before the timed Finale', () => {
    const simulation = new M06Simulation(generateWorld(1_000_080), {
      mode: 'DESTROY',
      pace: 'STANDARD',
      difficulty: 'CASUAL',
    });
    expect(simulation.run.snapshot().finaleUnlocked).toBe(false);
    placePlayerArmyAtEnemyCore(simulation, 10_000);

    const final = simulation.step();
    expect(final.run.finaleUnlocked).toBe(false);
    expect(final.run.outcome).toBe('VICTORY');
    expect(final.run.enemyCore).toMatchObject({ currentHealth: 0, state: 'DESTROYED' });
    expect(final.run.result?.reason).toBe('ENEMY_CORE_DESTROYED');
  }, 15_000);
});
