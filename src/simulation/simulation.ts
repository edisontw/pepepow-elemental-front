import { DeterministicRng } from './random';
import { M01_ARENA, type ArenaDefinition } from './arena';
import type { GameCommand } from './commands';
import { CommandQueue } from './commands';
import type { EntityID } from './components';
import { EntityStore } from './entity-store';
import { computeStateHash } from './state-hash';

export const SIMULATION_HZ = 10;
export const TICK_MS = 1000 / SIMULATION_HZ;

export interface SimulationSnapshot {
  tick: number;
  elapsedMs: number;
  rngState: number;
  smokeValue: number;
  stateHash: string;
  queuedCommandCount: number;
  entities: readonly EntitySnapshot[];
}

export interface EntitySnapshot {
  id: EntityID;
  x: number;
  z: number;
  playerId: number;
  selectionRadius: number;
  targetX: number | null;
  targetZ: number | null;
}

export class Simulation {
  readonly entities = new EntityStore();

  private readonly rng: DeterministicRng;
  private readonly commandQueue = new CommandQueue();
  private tick = 0;
  private smokeValue = 0;

  constructor(
    readonly seed: string,
    readonly arena: ArenaDefinition = M01_ARENA,
  ) {
    this.rng = new DeterministicRng(seed);
    for (const spawn of arena.units) this.entities.createUnit(spawn);
  }

  enqueueCommand(command: GameCommand): void {
    this.commandQueue.enqueue(command);
  }

  step(): SimulationSnapshot {
    this.tick += 1;
    this.processCommands();
    this.updateMovement();
    this.smokeValue = this.rng.nextUint32();
    return this.snapshot();
  }

  snapshot(): SimulationSnapshot {
    const rngState = this.rng.snapshot();
    return {
      tick: this.tick,
      elapsedMs: this.tick * TICK_MS,
      rngState,
      smokeValue: this.smokeValue,
      stateHash: computeStateHash(this.tick, rngState, this.entities),
      queuedCommandCount: this.commandQueue.size,
      entities: this.entities.entityIds().map((entityId) => {
        const position = this.entities.positions.get(entityId);
        const movement = this.entities.movements.get(entityId);
        const faction = this.entities.factions.get(entityId);
        const selectable = this.entities.selectables.get(entityId);
        if (!position || !movement || !faction || !selectable) {
          throw new Error(`Entity ${entityId} is missing a required M01 component.`);
        }
        return {
          id: entityId,
          x: position.x,
          z: position.z,
          playerId: faction.playerId,
          selectionRadius: selectable.radius,
          targetX: movement.targetX,
          targetZ: movement.targetZ,
        };
      }),
    };
  }

  private processCommands(): void {
    for (const command of this.commandQueue.drainForTick(this.tick)) {
      const validIds = command.entityIds.filter((entityId) => (
        this.entities.hasUnit(entityId)
        && this.entities.factions.get(entityId)?.playerId === command.playerId
      ));
      if (command.type === 'STOP') {
        for (const entityId of validIds) this.stopEntity(entityId);
        continue;
      }
      const offsets = formationOffsets(validIds.length);
      validIds.forEach((entityId, index) => {
        const movement = this.entities.movements.get(entityId);
        const offset = offsets[index];
        if (!movement || !offset) return;
        movement.targetX = command.targetX + offset.x;
        movement.targetZ = command.targetZ + offset.z;
      });
    }
  }

  private updateMovement(): void {
    for (const entityId of this.entities.entityIds()) {
      const position = this.entities.positions.get(entityId);
      const movement = this.entities.movements.get(entityId);
      if (!position || !movement || movement.targetX === null || movement.targetZ === null) continue;
      const deltaX = movement.targetX - position.x;
      const deltaZ = movement.targetZ - position.z;
      const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
      if (distance <= movement.speedPerTick) {
        position.x = movement.targetX;
        position.z = movement.targetZ;
        this.stopEntity(entityId);
        continue;
      }
      position.x += Math.round((deltaX * movement.speedPerTick) / distance);
      position.z += Math.round((deltaZ * movement.speedPerTick) / distance);
    }
  }

  private stopEntity(entityId: EntityID): void {
    const movement = this.entities.movements.get(entityId);
    if (!movement) return;
    movement.targetX = null;
    movement.targetZ = null;
  }
}

function formationOffsets(unitCount: number): Array<{ x: number; z: number }> {
  if (unitCount <= 1) return unitCount === 1 ? [{ x: 0, z: 0 }] : [];
  const spacing = 1400;
  const columns = Math.ceil(Math.sqrt(unitCount));
  const rows = Math.ceil(unitCount / columns);
  return Array.from({ length: unitCount }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      x: Math.round((column - (columns - 1) / 2) * spacing),
      z: Math.round((row - (rows - 1) / 2) * spacing),
    };
  });
}
