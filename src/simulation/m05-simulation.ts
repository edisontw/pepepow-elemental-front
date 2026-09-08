import { acquireEncounterTargets } from './auto-aggro';
import { EnemyLogisticsState, type EnemyLogisticsSnapshot } from './enemy-logistics-state';
import { EnemyWarState, type EnemyWarSnapshot } from './enemy-war-state';
import type { EnemyDifficulty, EnemyFaction } from './m05-content';
import { M04Simulation, type M04SimulationOptions, type M04SimulationSnapshot } from './m04-simulation';
import type { GeneratedWorld } from '../world/world-definition';

export interface M05SimulationOptions extends M04SimulationOptions {
  faction?: EnemyFaction;
  difficulty?: EnemyDifficulty;
}

export interface M05SimulationSnapshot extends M04SimulationSnapshot {
  enemyWar: EnemyWarSnapshot;
  enemyLogistics: EnemyLogisticsSnapshot;
}

export class M05Simulation extends M04Simulation {
  readonly enemyWar: EnemyWarState;
  readonly enemyLogistics: EnemyLogisticsState;

  constructor(generatedWorld: GeneratedWorld, options: M05SimulationOptions = {}) {
    super(generatedWorld, { ...options, playerManaRules: options.playerManaRules ?? true });
    this.enemyWar = new EnemyWarState(
      generatedWorld,
      this.entities,
      this.navigation,
      this.visibility,
      options.faction,
      options.difficulty,
    );
    this.enemyLogistics = new EnemyLogisticsState(generatedWorld, this.enemyWar.faction);
  }

  override step(): M05SimulationSnapshot {
    const nextTick = super.snapshot().tick + 1;
    this.stopIllegalHiddenPursuit(nextTick);
    acquireEncounterTargets(this.entities, this.navigation, this.visibility, this.terrain, nextTick);
    const frame = super.step();
    const strategic = this.strategy.snapshot();
    this.enemyWar.advance(frame.tick, strategic, {
      enqueueCommand: (command) => this.enqueueCommand(command),
      enqueueStrategicCommand: (command) => this.enqueueStrategicCommand(command),
    });
    this.enemyLogistics.advance(
      frame.tick,
      strategic,
      (command) => this.enqueueStrategicCommand(command),
    );
    return this.snapshot();
  }

  override snapshot(): M05SimulationSnapshot {
    const base = super.snapshot();
    const enemyWar = this.enemyWar.snapshot();
    const enemyLogistics = this.enemyLogistics.snapshot();
    return {
      ...base,
      stateHash: `${base.stateHash}:${enemyWar.stateHash}:${enemyLogistics.stateHash}`,
      enemyWar,
      enemyLogistics,
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
