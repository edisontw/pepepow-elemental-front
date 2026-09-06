import { EnemyWarState, type EnemyWarSnapshot } from './enemy-war-state';
import type { EnemyDifficulty, EnemyFaction } from './m05-content';
import { M04Simulation, type M04SimulationSnapshot } from './m04-simulation';
import type { GeneratedWorld } from '../world/world-definition';

export interface M05SimulationOptions {
  faction?: EnemyFaction;
  difficulty?: EnemyDifficulty;
}

export interface M05SimulationSnapshot extends M04SimulationSnapshot {
  enemyWar: EnemyWarSnapshot;
}

export class M05Simulation extends M04Simulation {
  readonly enemyWar: EnemyWarState;

  constructor(generatedWorld: GeneratedWorld, options: M05SimulationOptions = {}) {
    super(generatedWorld);
    this.enemyWar = new EnemyWarState(
      generatedWorld,
      this.entities,
      this.navigation,
      this.visibility,
      options.faction,
      options.difficulty,
    );
  }

  override step(): M05SimulationSnapshot {
    const frame = super.step();
    this.enemyWar.advance(frame.tick, this.strategy.snapshot(), {
      enqueueCommand: (command) => this.enqueueCommand(command),
      enqueueStrategicCommand: (command) => this.enqueueStrategicCommand(command),
    });
    return this.snapshot();
  }

  override snapshot(): M05SimulationSnapshot {
    const base = super.snapshot();
    const enemyWar = this.enemyWar.snapshot();
    return {
      ...base,
      stateHash: `${base.stateHash}:${enemyWar.stateHash}`,
      enemyWar,
    };
  }
}
