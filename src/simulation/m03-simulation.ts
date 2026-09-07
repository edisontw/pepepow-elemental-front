import { applyBurningUnitDamage } from './elemental-battlefield-rules';
import type { M03Command } from './m03-commands';
import { M03CommandQueue } from './m03-commands';
import { Simulation, type SimulationSnapshot } from './simulation';
import { StrategicState, type StrategicSnapshot } from './strategic-state';
import type { GeneratedWorld } from '../world/world-definition';
import { generatedWorldToArena } from '../world/world-arena';

export interface M03SimulationSnapshot extends SimulationSnapshot {
  strategic: StrategicSnapshot;
}

export class M03Simulation extends Simulation {
  readonly strategy: StrategicState;
  private readonly strategicCommands = new M03CommandQueue();

  constructor(readonly generatedWorld: GeneratedWorld) {
    super(
      `pepepow:${generatedWorld.identity.rulesetVersion}:${generatedWorld.identity.blockHeight}:${generatedWorld.generationAttempt}`,
      generatedWorldToArena(generatedWorld),
    );
    this.strategy = new StrategicState(generatedWorld, this.entities, this.navigation);
  }

  enqueueStrategicCommand(command: M03Command): void {
    this.strategicCommands.enqueue(command);
  }

  override step(): M03SimulationSnapshot {
    const nextTick = super.snapshot().tick + 1;
    for (const command of this.strategicCommands.drainForTick(nextTick)) {
      this.strategy.processCommand(command, nextTick);
    }
    super.step();
    applyBurningUnitDamage(this.entities, this.terrain, this.navigation, nextTick);
    this.strategy.advanceEconomy(nextTick);
    this.strategy.advanceTerritory();
    this.visibility.update(this.entities, this.navigation);
    return this.snapshot();
  }

  override snapshot(): M03SimulationSnapshot {
    const base = super.snapshot();
    const strategic = this.strategy.snapshot();
    return {
      ...base,
      stateHash: `${base.stateHash}:${strategic.stateHash}`,
      queuedCommandCount: base.queuedCommandCount + this.strategicCommands.size,
      strategic,
    };
  }
}
