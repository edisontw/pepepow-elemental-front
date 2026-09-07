import { M01_ARENA, type ArenaDefinition } from './arena';
import type { ChainLightningCommand, GameCommand } from './commands';
import { CommandQueue } from './commands';
import type { EntityID, UnitArchetype } from './components';
import { forestAllowsDetection } from './elemental-battlefield-rules';
import {
  FIRE_IMPACT_DAMAGE,
  HEAVY_ICE_STRESS_PER_TICK,
  ICE_SPEED_PERMILLE,
  WATER_PUSH_CELLS,
  WATER_WET_DURATION_TICKS,
} from './elemental-tactics';
import { EntityStore } from './entity-store';
import { NavigationGrid, type GridCell, type WalkabilityChange } from './navigation';
import { DeterministicRng } from './random';
import { computeStateHash } from './state-hash';
import { buildLightningChain, lightningDamage } from './lightning';
import { SurfaceType, TerrainState, type TerrainCounts, type TerrainEffect, type TerrainEffectId } from './terrain-state';
import { VisibilityState, type VisibilityCounts } from './visibility-state';

export const SIMULATION_HZ = 10;
export const TICK_MS = 1000 / SIMULATION_HZ;
export const CHILLED_DURATION_TICKS = 20;
export const FROZEN_DURATION_TICKS = 10;

const HEAVY_ICE_ARCHETYPES: ReadonlySet<UnitArchetype> = new Set(['GOLEM', 'SIEGE_CONSTRUCT']);

export interface SimulationSnapshot {
  tick: number;
  elapsedMs: number;
  rngState: number;
  smokeValue: number;
  stateHash: string;
  queuedCommandCount: number;
  navVersion: number;
  navDirty: boolean;
  activeAttackOrders: number;
  wetUnitCount: number;
  chilledUnitCount: number;
  frozenUnitCount: number;
  visibility: VisibilityCounts;
  terrain: TerrainCounts;
  lastTerrainEffect: TerrainEffectId | null;
  lastTerrainEffectTick: number;
  lastLightningChain: readonly EntityID[];
  burningCells: readonly { column: number; row: number }[];
  entities: readonly EntitySnapshot[];
}

export interface EntitySnapshot {
  id: EntityID;
  archetype: UnitArchetype;
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
  wet: boolean;
  wetTicks: number;
  chilledTicks: number;
  frozenTicks: number;
  visibleToPlayer: boolean;
}

export class Simulation {
  readonly entities = new EntityStore();
  readonly navigation: NavigationGrid;
  readonly terrain: TerrainState;
  readonly visibility: VisibilityState;
  private readonly rng: DeterministicRng;
  private readonly commandQueue = new CommandQueue();
  private tick = 0;
  private smokeValue = 0;
  private pendingTerrainEffects: TerrainEffect[] = [];
  private pendingLightningCasts: ChainLightningCommand[] = [];
  private lastTerrainEffect: TerrainEffectId | null = null;
  private lastTerrainEffectTick = -1;
  private lastLightningChain: EntityID[] = [];

  constructor(readonly seed: string, readonly arena: ArenaDefinition = M01_ARENA) {
    this.rng = new DeterministicRng(seed);
    this.terrain = new TerrainState(arena.traversal);
    this.navigation = new NavigationGrid(arena.traversal);
    for (const spawn of arena.units) this.entities.createUnit(spawn);
    this.visibility = new VisibilityState(arena.traversal, arena.units.map((spawn) => spawn.playerId));
    this.visibility.update(this.entities, this.navigation);
  }

  enqueueCommand(command: GameCommand): void { this.commandQueue.enqueue(command); }

  step(): SimulationSnapshot {
    this.tick += 1;
    this.advanceTimedStatuses();
    this.processCommands();
    this.updateMovementAndNavigation();
    this.updateIceStress();
    this.updateCombat();
    this.updateTerrainEffects();
    this.updateBurning();
    this.synchronizeEnvironmentalStatuses();
    this.resolveLightningCasts();
    this.cleanupDeaths();
    this.visibility.update(this.entities, this.navigation);
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
      stateHash: computeStateHash(this.tick, rngState, this.navigation.navVersion, this.entities, this.terrain, this.visibility),
      queuedCommandCount: this.commandQueue.size,
      navVersion: this.navigation.navVersion,
      navDirty: false,
      activeAttackOrders: entities.filter((entity) => entity.alive && entity.attackTargetEntityId !== null).length,
      wetUnitCount: entities.filter((entity) => entity.alive && entity.wet).length,
      chilledUnitCount: entities.filter((entity) => entity.alive && entity.chilledTicks > 0).length,
      frozenUnitCount: entities.filter((entity) => entity.alive && entity.frozenTicks > 0).length,
      visibility: this.visibility.counts(0),
      terrain: this.terrain.counts(),
      lastTerrainEffect: this.lastTerrainEffect,
      lastTerrainEffectTick: this.lastTerrainEffectTick,
      lastLightningChain: [...this.lastLightningChain],
      burningCells: this.terrain.burningCells(),
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
    const status = this.entities.statuses.get(entityId);
    const archetype = this.entities.archetypes.get(entityId);
    if (!position || !movement || !faction || !selectable || !health || !combat || !status || !archetype) {
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
      wet: status.wet, wetTicks: status.wetTicks, chilledTicks: status.chilledTicks, frozenTicks: status.frozenTicks,
      visibleToPlayer: faction.playerId === 0 || (
        this.visibility.isWorldVisible(0, position.x, position.z, this.navigation)
        && forestAllowsDetection(entityId, 0, this.entities, this.terrain, this.navigation)
      ),
    };
  }

  private processCommands(): void {
    for (const command of this.commandQueue.drainForTick(this.tick)) {
      if (command.type === 'CAST') {
        if (command.effectId === 'CHAIN_LIGHTNING') {
          this.pendingLightningCasts.push(command);
          continue;
        }
        this.pendingTerrainEffects.push({
          effectId: command.effectId,
          targetX: command.targetX,
          targetZ: command.targetZ,
          radius: command.radius,
          sourcePlayerId: command.playerId,
        });
        this.lastTerrainEffect = command.effectId;
        this.lastTerrainEffectTick = this.tick;
        continue;
      }
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
      else this.validateMovementPath(entityId);
      this.moveAlongPath(entityId);
    }
  }

  private validateMovementPath(entityId: EntityID): void {
    const position = this.entities.positions.get(entityId)!;
    const movement = this.entities.movements.get(entityId)!;
    if (movement.pathNavVersion === this.navigation.navVersion || movement.targetX === null || movement.targetZ === null) return;
    if (!this.navigation.isWalkable(this.navigation.worldToCell(position.x, position.z))) {
      this.clearMovement(entityId);
      return;
    }
    const targetX = movement.targetX;
    const targetZ = movement.targetZ;
    this.assignPath(entityId, targetX, targetZ);
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
    const status = this.entities.statuses.get(entityId);
    if (status?.frozenTicks) return;
    const waypoint = movement.path[movement.pathIndex]!;
    const deltaX = waypoint.x - position.x;
    const deltaZ = waypoint.z - position.z;
    const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
    let speedPerTick = status?.chilledTicks ? Math.max(1, Math.floor(movement.speedPerTick / 2)) : movement.speedPerTick;
    if (this.terrain.surfaceAt(this.navigation.worldToCell(position.x, position.z)) === SurfaceType.ICE) {
      speedPerTick = Math.max(1, Math.floor((speedPerTick * ICE_SPEED_PERMILLE) / 1000));
    }
    if (distance <= speedPerTick) {
      position.x = waypoint.x;
      position.z = waypoint.z;
      movement.pathIndex += 1;
      if (movement.pathIndex >= movement.path.length) this.clearMovement(entityId);
      return;
    }
    position.x += Math.round((deltaX * speedPerTick) / distance);
    position.z += Math.round((deltaZ * speedPerTick) / distance);
  }

  private updateIceStress(): void {
    const changes: WalkabilityChange[] = [];
    for (const entityId of this.entities.entityIds()) {
      if (!this.entities.hasUnit(entityId)) continue;
      const archetype = this.entities.archetypes.get(entityId);
      if (!archetype || !HEAVY_ICE_ARCHETYPES.has(archetype)) continue;
      const position = this.entities.positions.get(entityId);
      if (!position) continue;
      const cell = this.navigation.worldToCell(position.x, position.z);
      const change = this.terrain.stressIce(cell, HEAVY_ICE_STRESS_PER_TICK);
      if (change) changes.push(change);
    }
    if (changes.length > 0) this.navigation.applyWalkabilityChanges(changes);
  }

  private updateCombat(): void {
    for (const entityId of this.entities.entityIds()) {
      if (!this.entities.hasUnit(entityId)) continue;
      if (this.entities.statuses.get(entityId)?.frozenTicks) continue;
      const combat = this.entities.combat.get(entityId)!;
      const targetId = combat.targetEntityId;
      if (targetId === null || !this.entities.hasUnit(targetId) || !this.areHostile(entityId, targetId)) continue;
      if (!this.inAttackRange(entityId, targetId, combat.attackRange) || this.tick < combat.nextAttackTick) continue;
      const health = this.entities.health.get(targetId)!;
      health.current = Math.max(0, health.current - combat.attackDamage);
      combat.nextAttackTick = this.tick + combat.attackIntervalTicks;
    }
  }

  private updateTerrainEffects(): void {
    if (this.pendingTerrainEffects.length === 0) return;
    const effects = this.pendingTerrainEffects;
    const changes = this.terrain.applyEffects(effects);
    this.applyUnitElementalEffects(effects);
    this.pendingTerrainEffects = [];
    this.navigation.applyWalkabilityChanges(changes);
  }

  private advanceTimedStatuses(): void {
    for (const entityId of this.entities.entityIds()) {
      const status = this.entities.statuses.get(entityId);
      if (!status) continue;
      status.wetTicks = Math.max(0, status.wetTicks - 1);
      status.chilledTicks = Math.max(0, status.chilledTicks - 1);
      status.frozenTicks = Math.max(0, status.frozenTicks - 1);
    }
  }

  private applyUnitElementalEffects(effects: readonly TerrainEffect[]): void {
    for (const effect of effects) {
      const radiusSquared = effect.radius * effect.radius;
      for (const entityId of this.entities.entityIds()) {
        if (!this.entities.hasUnit(entityId)) continue;
        const position = this.entities.positions.get(entityId)!;
        const deltaX = position.x - effect.targetX;
        const deltaZ = position.z - effect.targetZ;
        if (deltaX * deltaX + deltaZ * deltaZ > radiusSquared) continue;
        const status = this.entities.statuses.get(entityId)!;
        if (effect.effectId === 'FREEZE') {
          if (status.wet || status.chilledTicks > 0) {
            status.chilledTicks = 0;
            status.frozenTicks = FROZEN_DURATION_TICKS;
          } else if (status.frozenTicks === 0) {
            status.chilledTicks = CHILLED_DURATION_TICKS;
          }
          continue;
        }
        if (effect.effectId === 'WATER') {
          status.wetTicks = Math.max(status.wetTicks, WATER_WET_DURATION_TICKS);
          status.wet = true;
          this.pushLightUnit(entityId, effect.targetX, effect.targetZ);
          continue;
        }
        if (effect.effectId === 'FIRE') {
          if (effect.sourcePlayerId === undefined || this.entities.factions.get(entityId)?.playerId !== effect.sourcePlayerId) {
            const health = this.entities.health.get(entityId);
            if (health?.alive) health.current = Math.max(0, health.current - FIRE_IMPACT_DAMAGE);
          }
          status.chilledTicks = 0;
          status.frozenTicks = 0;
          continue;
        }
        status.chilledTicks = 0;
        status.frozenTicks = 0;
      }
    }
  }

  private pushLightUnit(entityId: EntityID, sourceX: number, sourceZ: number): void {
    const archetype = this.entities.archetypes.get(entityId);
    const position = this.entities.positions.get(entityId);
    const status = this.entities.statuses.get(entityId);
    if (!archetype || !position || status?.frozenTicks || HEAVY_ICE_ARCHETYPES.has(archetype)) return;
    const current = this.navigation.worldToCell(position.x, position.z);
    const deltaX = position.x - sourceX;
    const deltaZ = position.z - sourceZ;
    let direction: GridCell;
    if (Math.abs(deltaX) > Math.abs(deltaZ) && deltaX !== 0) {
      direction = { column: Math.sign(deltaX), row: 0 };
    } else if (deltaZ !== 0) {
      direction = { column: 0, row: Math.sign(deltaZ) };
    } else {
      const fallback = entityId % 4;
      direction = fallback === 0 ? { column: 1, row: 0 }
        : fallback === 1 ? { column: 0, row: 1 }
          : fallback === 2 ? { column: -1, row: 0 }
            : { column: 0, row: -1 };
    }
    for (let distance = WATER_PUSH_CELLS; distance >= 1; distance -= 1) {
      const target = {
        column: current.column + direction.column * distance,
        row: current.row + direction.row * distance,
      };
      if (!this.navigation.isWalkable(target)) continue;
      const world = this.navigation.cellToWorld(target);
      position.x = world.x;
      position.z = world.z;
      this.clearMovement(entityId);
      return;
    }
  }

  private updateBurning(): void {
    const dousedCells = new Set<number>();
    for (const entityId of this.entities.entityIds()) {
      if (this.entities.statuses.get(entityId)?.wet !== true) continue;
      const position = this.entities.positions.get(entityId);
      if (!position) continue;
      const index = this.terrain.indexOf(this.navigation.worldToCell(position.x, position.z));
      if (index !== null) dousedCells.add(index);
    }
    this.terrain.advanceBurning(dousedCells);
  }

  private synchronizeEnvironmentalStatuses(): void {
    for (const entityId of this.entities.entityIds()) {
      const position = this.entities.positions.get(entityId);
      const status = this.entities.statuses.get(entityId);
      if (!position || !status) continue;
      const cell = this.navigation.worldToCell(position.x, position.z);
      if (this.terrain.surfaceAt(cell) === SurfaceType.WATER) {
        status.wetTicks = Math.max(status.wetTicks, WATER_WET_DURATION_TICKS);
      }
      status.wet = status.wetTicks > 0;
    }
  }

  private resolveLightningCasts(): void {
    for (const cast of this.pendingLightningCasts) {
      const chain = buildLightningChain(
        cast.targetEntityId,
        cast.playerId,
        this.entities,
        this.terrain,
        this.navigation,
      );
      this.lastLightningChain = chain;
      for (const entityId of chain) {
        const health = this.entities.health.get(entityId);
        if (health) health.current = Math.max(0, health.current - lightningDamage(entityId, this.entities));
      }
    }
    this.pendingLightningCasts = [];
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
