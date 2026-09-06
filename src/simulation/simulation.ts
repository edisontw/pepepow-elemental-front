import { M01_ARENA, type ArenaDefinition } from './arena';
import type { GameCommand } from './commands';
import { CommandQueue } from './commands';
import type { EntityID } from './components';
import { EntityStore } from './entity-store';
import { NavigationGrid } from './navigation';
import { DeterministicRng } from './random';
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
  navVersion: number;
  activeAttackOrders: number;
  entities: readonly EntitySnapshot[];
}

export interface EntitySnapshot {
  id: EntityID;
  archetype: 'VANGUARD' | 'RANGER';
  x: number;
  z: number;
  playerId: number;
  selectionRadius: number;
  targetX: number | null;
  targetZ: number | null;
  path: readonly { x: number; z: number }[];
  pathIndex: number;
  pathNavVersion: number;
  currentHealth: number;
  maxHealth: number;
  alive: boolean;
  attackDamage: number;
  attackIntervalTicks: number;
  attackRange: number;
  nextAttackTick: number;
  attackTargetEntityId: EntityID | null;
}

export class Simulation {
  readonly entities = new EntityStore();
  readonly navigation: NavigationGrid;
  private readonly rng: DeterministicRng;
  private readonly commandQueue = new CommandQueue();
  private tick = 0;
  private smokeValue = 0;

  constructor(readonly seed: string, readonly arena: ArenaDefinition = M01_ARENA) {
    this.rng = new DeterministicRng(seed);
    this.navigation = new NavigationGrid(arena.traversal);
    for (const spawn of arena.units) this.entities.createUnit(spawn);
  }

  enqueueCommand(command: GameCommand): void { this.commandQueue.enqueue(command); }

  step(): SimulationSnapshot {
    this.tick += 1;
    this.processCommands();
    this.updateMovementAndNavigation();
    this.updateCombat();
    this.cleanupDeaths();
    this.smokeValue = this.rng.nextUint32();
    return this.snapshot();
  }

  snapshot(): SimulationSnapshot {
    const rngState = this.rng.snapshot();
    const entities = this.entities.entityIds().map((entityId) => this.entitySnapshot(entityId));
    return {
      tick: this.tick,
      elapsedMs: this.tick * TICK_MS,
      rngState,
      smokeValue: this.smokeValue,
      stateHash: computeStateHash(this.tick, rngState, this.navigation.navVersion, this.entities),
      queuedCommandCount: this.commandQueue.size,
      navVersion: this.navigation.navVersion,
      activeAttackOrders: entities.filter((entity) => entity.alive && entity.attackTargetEntityId !== null).length,
      entities,
    };
  }

  private entitySnapshot(entityId: EntityID): EntitySnapshot {
    const position = this.entities.positions.get(entityId);
    const movement = this.entities.movements.get(entityId);
    const faction = this.entities.factions.get(entityId);
    const selectable = this.entities.selectables.get(entityId);
    const health = this.entities.health.get(entityId);
    const combat = this.entities.combat.get(entityId);
    const archetype = this.entities.archetypes.get(entityId);
    if (!position || !movement || !faction || !selectable || !health || !combat || !archetype) {
      throw new Error(`Entity ${entityId} is missing a required M01 component.`);
    }
    return {
      id: entityId, archetype, x: position.x, z: position.z, playerId: faction.playerId,
      selectionRadius: selectable.radius, targetX: movement.targetX, targetZ: movement.targetZ,
      path: movement.path.map((point) => ({ ...point })), pathIndex: movement.pathIndex,
      pathNavVersion: movement.pathNavVersion, currentHealth: health.current, maxHealth: health.max,
      alive: health.alive, attackDamage: combat.attackDamage,
      attackIntervalTicks: combat.attackIntervalTicks, attackRange: combat.attackRange,
      nextAttackTick: combat.nextAttackTick, attackTargetEntityId: combat.targetEntityId,
    };
  }

  private processCommands(): void {
    for (const command of this.commandQueue.drainForTick(this.tick)) {
      const validIds = command.entityIds.filter((entityId) => (
        this.entities.hasUnit(entityId) && this.entities.factions.get(entityId)?.playerId === command.playerId
      ));
      if (command.type === 'STOP') {
        for (const entityId of validIds) this.clearOrders(entityId);
      } else if (command.type === 'MOVE') {
        const offsets = formationOffsets(validIds.length);
        validIds.forEach((entityId, index) => {
          const offset = offsets[index];
          if (!offset) return;
          const combat = this.entities.combat.get(entityId)!;
          combat.targetEntityId = null;
          combat.pursuitTargetCellKey = null;
          this.assignPath(entityId, command.targetX + offset.x, command.targetZ + offset.z);
        });
      } else if (this.isValidAttackTarget(command.targetEntityId, command.playerId)) {
        for (const entityId of validIds) {
          const combat = this.entities.combat.get(entityId)!;
          combat.targetEntityId = command.targetEntityId;
          combat.pursuitTargetCellKey = null;
          combat.nextAttackTick = this.tick;
          this.clearMovement(entityId);
        }
      }
    }
  }

  private updateMovementAndNavigation(): void {
    for (const entityId of this.entities.entityIds()) {
      if (!this.entities.hasUnit(entityId)) continue;
      const combat = this.entities.combat.get(entityId)!;
      if (combat.targetEntityId !== null) this.updatePursuit(entityId, combat.targetEntityId);
      this.moveAlongPath(entityId);
    }
  }

  private updatePursuit(entityId: EntityID, targetEntityId: EntityID): void {
    if (!this.entities.hasUnit(targetEntityId) || !this.areHostile(entityId, targetEntityId)) {
      this.clearOrders(entityId);
      return;
    }
    const combat = this.entities.combat.get(entityId)!;
    if (this.inAttackRange(entityId, targetEntityId, combat.attackRange)) {
      this.clearMovement(entityId);
      return;
    }
    const targetPosition = this.entities.positions.get(targetEntityId)!;
    const targetCell = this.navigation.worldToCell(targetPosition.x, targetPosition.z);
    const targetKey = this.navigation.cellKey(targetCell);
    const movement = this.entities.movements.get(entityId)!;
    if (combat.pursuitTargetCellKey !== targetKey || movement.pathNavVersion !== this.navigation.navVersion || movement.pathIndex >= movement.path.length) {
      combat.pursuitTargetCellKey = targetKey;
      this.assignPath(entityId, targetPosition.x, targetPosition.z);
    }
  }

  private assignPath(entityId: EntityID, targetX: number, targetZ: number): boolean {
    const position = this.entities.positions.get(entityId);
    const movement = this.entities.movements.get(entityId);
    if (!position || !movement) return false;
    const resolved = this.navigation.resolveWalkableTarget(this.navigation.worldToCell(targetX, targetZ));
    if (!resolved) { this.clearMovement(entityId); return false; }
    const path = this.navigation.findPath(this.navigation.worldToCell(position.x, position.z), resolved);
    if (!path) { this.clearMovement(entityId); return false; }
    const resolvedWorld = this.navigation.cellToWorld(resolved);
    movement.targetX = resolvedWorld.x;
    movement.targetZ = resolvedWorld.z;
    movement.path = path.map((cell) => this.navigation.cellToWorld(cell));
    movement.pathIndex = 0;
    movement.pathNavVersion = this.navigation.navVersion;
    if (movement.path.length === 0) this.clearMovement(entityId);
    return true;
  }

  private moveAlongPath(entityId: EntityID): void {
    const position = this.entities.positions.get(entityId);
    const movement = this.entities.movements.get(entityId);
    if (!position || !movement || movement.pathIndex >= movement.path.length) return;
    const waypoint = movement.path[movement.pathIndex]!;
    const deltaX = waypoint.x - position.x;
    const deltaZ = waypoint.z - position.z;
    const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
    if (distance <= movement.speedPerTick) {
      position.x = waypoint.x;
      position.z = waypoint.z;
      movement.pathIndex += 1;
      if (movement.pathIndex >= movement.path.length) this.clearMovement(entityId);
      return;
    }
    position.x += Math.round((deltaX * movement.speedPerTick) / distance);
    position.z += Math.round((deltaZ * movement.speedPerTick) / distance);
  }

  private updateCombat(): void {
    for (const entityId of this.entities.entityIds()) {
      if (!this.entities.hasUnit(entityId)) continue;
      const combat = this.entities.combat.get(entityId)!;
      const targetId = combat.targetEntityId;
      if (targetId === null || !this.entities.hasUnit(targetId) || !this.areHostile(entityId, targetId)) continue;
      if (!this.inAttackRange(entityId, targetId, combat.attackRange) || this.tick < combat.nextAttackTick) continue;
      const health = this.entities.health.get(targetId)!;
      health.current = Math.max(0, health.current - combat.attackDamage);
      combat.nextAttackTick = this.tick + combat.attackIntervalTicks;
    }
  }

  private cleanupDeaths(): void {
    for (const entityId of this.entities.entityIds()) {
      const health = this.entities.health.get(entityId);
      if (!health || !health.alive || health.current > 0) continue;
      health.alive = false;
      this.clearOrders(entityId);
    }
    for (const entityId of this.entities.entityIds()) {
      const combat = this.entities.combat.get(entityId);
      if (combat && combat.targetEntityId !== null && !this.entities.hasUnit(combat.targetEntityId)) this.clearOrders(entityId);
    }
  }

  private isValidAttackTarget(targetId: EntityID, playerId: number): boolean {
    return this.entities.hasUnit(targetId) && this.entities.factions.get(targetId)?.playerId !== playerId;
  }
  private areHostile(left: EntityID, right: EntityID): boolean {
    return this.entities.factions.get(left)?.playerId !== this.entities.factions.get(right)?.playerId;
  }
  private inAttackRange(attacker: EntityID, target: EntityID, range: number): boolean {
    const first = this.entities.positions.get(attacker)!;
    const second = this.entities.positions.get(target)!;
    const deltaX = first.x - second.x;
    const deltaZ = first.z - second.z;
    return deltaX * deltaX + deltaZ * deltaZ <= range * range;
  }
  private clearOrders(entityId: EntityID): void {
    const combat = this.entities.combat.get(entityId);
    if (combat) { combat.targetEntityId = null; combat.pursuitTargetCellKey = null; }
    this.clearMovement(entityId);
  }
  private clearMovement(entityId: EntityID): void {
    const movement = this.entities.movements.get(entityId);
    if (!movement) return;
    movement.targetX = null; movement.targetZ = null; movement.path = [];
    movement.pathIndex = 0; movement.pathNavVersion = this.navigation.navVersion;
  }
}

export function formationOffsets(unitCount: number): Array<{ x: number; z: number }> {
  if (unitCount <= 1) return unitCount === 1 ? [{ x: 0, z: 0 }] : [];
  const spacing = 1400;
  const columns = Math.ceil(Math.sqrt(unitCount));
  const rows = Math.ceil(unitCount / columns);
  return Array.from({ length: unitCount }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return { x: Math.round((column - (columns - 1) / 2) * spacing), z: Math.round((row - (rows - 1) / 2) * spacing) };
  });
}
