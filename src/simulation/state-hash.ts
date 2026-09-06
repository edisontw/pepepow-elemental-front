import type { EntityID } from './components';
import type { EntityStore } from './entity-store';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const NULL_TARGET = -0x8000_0000;

function hashInteger(hash: number, value: number): number {
  let result = hash;
  const normalized = value | 0;
  for (let shift = 0; shift < 32; shift += 8) {
    result ^= (normalized >>> shift) & 0xff;
    result = Math.imul(result, FNV_PRIME);
  }
  return result >>> 0;
}

export function computeStateHash(tick: number, rngState: number, entities: EntityStore): string {
  let hash = FNV_OFFSET;
  hash = hashInteger(hash, tick);
  hash = hashInteger(hash, rngState);

  for (const entityId of entities.entityIds()) {
    hash = hashEntity(hash, entityId, entities);
  }

  return hash.toString(16).padStart(8, '0');
}

function hashEntity(hash: number, entityId: EntityID, entities: EntityStore): number {
  const position = entities.positions.get(entityId);
  const movement = entities.movements.get(entityId);
  const faction = entities.factions.get(entityId);
  const selectable = entities.selectables.get(entityId);
  if (!position || !movement || !faction || !selectable) {
    throw new Error(`Entity ${entityId} is missing a required M01 component.`);
  }

  let result = hashInteger(hash, entityId);
  result = hashInteger(result, position.x);
  result = hashInteger(result, position.z);
  result = hashInteger(result, movement.speedPerTick);
  result = hashInteger(result, movement.targetX ?? NULL_TARGET);
  result = hashInteger(result, movement.targetZ ?? NULL_TARGET);
  result = hashInteger(result, faction.playerId);
  return hashInteger(result, selectable.radius);
}
