import type {
  EntityID,
  FactionComponent,
  MovementComponent,
  PositionComponent,
  SelectableComponent,
  UnitSpawn,
} from './components';

export class EntityStore {
  readonly positions = new Map<EntityID, PositionComponent>();
  readonly movements = new Map<EntityID, MovementComponent>();
  readonly factions = new Map<EntityID, FactionComponent>();
  readonly selectables = new Map<EntityID, SelectableComponent>();

  private nextEntityId = 1;

  createUnit(spawn: UnitSpawn): EntityID {
    const entityId = this.nextEntityId;
    this.nextEntityId += 1;
    this.positions.set(entityId, { x: Math.round(spawn.x), z: Math.round(spawn.z) });
    this.movements.set(entityId, {
      speedPerTick: Math.round(spawn.speedPerTick),
      targetX: null,
      targetZ: null,
    });
    this.factions.set(entityId, { playerId: spawn.playerId });
    this.selectables.set(entityId, { radius: Math.round(spawn.selectionRadius) });
    return entityId;
  }

  hasUnit(entityId: EntityID): boolean {
    return this.positions.has(entityId)
      && this.movements.has(entityId)
      && this.factions.has(entityId)
      && this.selectables.has(entityId);
  }

  entityIds(): EntityID[] {
    return [...this.positions.keys()].sort((left, right) => left - right);
  }
}
