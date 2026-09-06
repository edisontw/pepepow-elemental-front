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
    const nextTick = super.snapshot().tick + 1;
    this.stopIllegalHiddenPursuit(nextTick);
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

  private stopIllegalHiddenPursuit(targetTick: number): void {
    const rememberedById = new Map(this.enemyWar.snapshot().lastKnownPlayerUnits.map((unit) => [unit.entityId, unit]));
    for (const entityId of this.entities.entityIds()) {
      if (!this.entities.hasUnit(entityId) || this.entities.factions.get(entityId)?.playerId !== 1) continue;
      const combat = this.entities.combat.get(entityId);
      const targetEntityId = combat?.targetEntityId;
      if (targetEntityId === null || targetEntityId === undefined) continue;
      if (this.entities.factions.get(targetEntityId)?.playerId !== 0) continue;
      const targetPosition = this.entities.positions.get(targetEntityId);
      if (targetPosition && this.visibility.isWorldVisible(1, targetPosition.x, targetPosition.z, this.navigation)) continue;
      const remembered = rememberedById.get(targetEntityId);
      if (remembered) {
        this.enqueueCommand({
          type: 'MOVE',
          targetTick,
          playerId: 1,
          entityIds: [entityId],
          targetX: remembered.x,
          targetZ: remembered.z,
        });
      } else {
        this.enqueueCommand({ type: 'STOP', targetTick, playerId: 1, entityIds: [entityId] });
      }
    }
  }
}
