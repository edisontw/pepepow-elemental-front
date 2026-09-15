import type {
  CombatComponent,
  ElementalAlignmentComponent,
  EntityID,
  FactionComponent,
  HealthComponent,
  MovementComponent,
  PositionComponent,
  SelectableComponent,
  StatusComponent,
  UnitSpawn,
} from './components';
import type { ElementId } from './element-types';

export class EntityStore {
  readonly positions = new Map<EntityID, PositionComponent>();
  readonly movements = new Map<EntityID, MovementComponent>();
  readonly factions = new Map<EntityID, FactionComponent>();
  readonly selectables = new Map<EntityID, SelectableComponent>();
  readonly health = new Map<EntityID, HealthComponent>();
  readonly statuses = new Map<EntityID, StatusComponent>();
  readonly combat = new Map<EntityID, CombatComponent>();
  readonly archetypes = new Map<EntityID, UnitSpawn['archetype']>();
  readonly elementalAlignments = new Map<EntityID, ElementalAlignmentComponent>();

  private nextEntityId = 1;

  createUnit(spawn: UnitSpawn): EntityID {
    const entityId = this.nextEntityId;
    this.nextEntityId += 1;
    this.positions.set(entityId, { x: Math.round(spawn.x), z: Math.round(spawn.z) });
    this.movements.set(entityId, {
      speedPerTick: Math.round(spawn.speedPerTick),
      targetX: null,
      targetZ: null,
      path: [],
      pathIndex: 0,
      pathNavVersion: 0,
    });
    this.factions.set(entityId, { playerId: spawn.playerId });
    this.selectables.set(entityId, { radius: Math.round(spawn.selectionRadius) });
    this.health.set(entityId, { current: spawn.maxHealth, max: spawn.maxHealth, alive: true });
    this.statuses.set(entityId, { wet: false, wetTicks: 0, chilledTicks: 0, frozenTicks: 0 });
    this.combat.set(entityId, {
      attackDamage: spawn.attackDamage,
      attackIntervalTicks: spawn.attackIntervalTicks,
      attackRange: spawn.attackRange,
      nextAttackTick: 0,
      targetEntityId: null,
      pursuitTargetCellKey: null,
    });
    this.archetypes.set(entityId, spawn.archetype);
    return entityId;
  }

  setElementalAlignment(entityId: EntityID, element: ElementId): boolean {
    if (!this.hasUnit(entityId) || this.archetypes.get(entityId) !== 'ELEMENTALIST') return false;
    const existing = this.elementalAlignments.get(entityId);
    if (existing) return existing.element === element;
    this.elementalAlignments.set(entityId, { element });
    return true;
  }

  hasUnit(entityId: EntityID): boolean {
    return this.positions.has(entityId)
      && this.movements.has(entityId)
      && this.factions.has(entityId)
      && this.selectables.has(entityId)
      && this.health.get(entityId)?.alive === true
      && this.statuses.has(entityId)
      && this.combat.has(entityId);
  }

  entityIds(): EntityID[] {
    return [...this.positions.keys()].sort((left, right) => left - right);
  }
}
