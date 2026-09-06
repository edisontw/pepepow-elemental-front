import type { GameCommand, TerrainCastCommand } from './commands';
import type { M04Command } from './m04-commands';
import { M04CommandQueue } from './m04-commands';
import { M03Simulation, type M03SimulationSnapshot } from './m03-simulation';
import { RogueliteState, type RogueliteSnapshot } from './roguelite-state';
import type { ModifierStat } from './m04-content';
import type { GeneratedWorld } from '../world/world-definition';

export interface M04SimulationSnapshot extends M03SimulationSnapshot {
  roguelite: RogueliteSnapshot;
}

function radiusModifierStat(effectId: TerrainCastCommand['effectId']): ModifierStat {
  if (effectId === 'FIRE') return 'FIRE_RADIUS_PERMILLE';
  if (effectId === 'HEAT') return 'HEAT_RADIUS_PERMILLE';
  return 'FREEZE_RADIUS_PERMILLE';
}

export class M04Simulation extends M03Simulation {
  readonly roguelite: RogueliteState;
  private readonly rogueliteCommands = new M04CommandQueue();

  constructor(generatedWorld: GeneratedWorld) {
    super(generatedWorld);
    this.roguelite = new RogueliteState(generatedWorld);
  }

  enqueueRogueliteCommand(command: M04Command): void {
    this.rogueliteCommands.enqueue(command);
  }

  override enqueueCommand(command: GameCommand): void {
    if (command.type !== 'CAST') {
      super.enqueueCommand(command);
      return;
    }

    if (command.effectId !== 'CHAIN_LIGHTNING') {
      const additivePermille = this.roguelite.modifier(command.playerId, radiusModifierStat(command.effectId));
      const radius = Math.max(0, Math.round((command.radius * (1000 + additivePermille)) / 1000));
      super.enqueueCommand({ ...command, radius });
      return;
    }

    super.enqueueCommand(command);
    let extraCasts = this.roguelite.trigger(command.playerId, 'CAST_CHAIN_LIGHTNING', 'EXTRA_LIGHTNING_CAST');
    if (this.entities.statuses.get(command.targetEntityId)?.wet === true) {
      extraCasts += this.roguelite.trigger(command.playerId, 'CAST_CHAIN_LIGHTNING_ON_WET_TARGET', 'EXTRA_LIGHTNING_CAST');
    }
    for (let index = 0; index < Math.min(3, extraCasts); index += 1) super.enqueueCommand(command);
  }

  override step(): M04SimulationSnapshot {
    const nextTick = super.snapshot().tick + 1;
    const strategic = this.strategy.snapshot();
    for (const command of this.rogueliteCommands.drainForTick(nextTick)) {
      this.roguelite.processCommand(command, strategic, nextTick);
    }
    const frame = super.step();
    this.roguelite.advance(frame.tick);
    return this.snapshot();
  }

  override snapshot(): M04SimulationSnapshot {
    const base = super.snapshot();
    const roguelite = this.roguelite.snapshot();
    return {
      ...base,
      stateHash: `${base.stateHash}:${roguelite.stateHash}`,
      queuedCommandCount: base.queuedCommandCount + this.rogueliteCommands.size,
      roguelite,
    };
  }
}
