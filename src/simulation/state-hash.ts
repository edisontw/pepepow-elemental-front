import type { EntityID } from './components';
import type { EntityStore } from './entity-store';
import type { TerrainState } from './terrain-state';

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

export function computeStateHash(tick: number, rngState: number, navVersion: number, entities: EntityStore, terrain: TerrainState): string {
  let hash = FNV_OFFSET;
  hash = hashInteger(hash, tick);
  hash = hashInteger(hash, rngState);
  hash = hashInteger(hash, navVersion);

  for (let index = 0; index < terrain.surface.length; index += 1) {
    hash = hashInteger(hash, terrain.surface[index]!);
    hash = hashInteger(hash, terrain.temperature[index]!);
    hash = hashInteger(hash, terrain.iceDurability[index]!);
    hash = hashInteger(hash, terrain.freezable[index]!);
  }

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
  const health = entities.health.get(entityId);
  const combat = entities.combat.get(entityId);
  const status = entities.statuses.get(entityId);
  if (!position || !movement || !faction || !selectable || !health || !combat || !status) {
    throw new Error(`Entity ${entityId} is missing a required M01 component.`);
  }

  let result = hashInteger(hash, entityId);
  result = hashInteger(result, position.x);
  result = hashInteger(result, position.z);
  result = hashInteger(result, movement.speedPerTick);
  result = hashInteger(result, movement.targetX ?? NULL_TARGET);
  result = hashInteger(result, movement.targetZ ?? NULL_TARGET);
  result = hashInteger(result, movement.pathIndex);
  result = hashInteger(result, movement.pathNavVersion);
  result = hashInteger(result, movement.path.length);
  for (const waypoint of movement.path) {
    result = hashInteger(result, waypoint.x);
    result = hashInteger(result, waypoint.z);
  }
  result = hashInteger(result, faction.playerId);
  result = hashInteger(result, selectable.radius);
  result = hashInteger(result, health.current);
  result = hashInteger(result, health.max);
  result = hashInteger(result, health.alive ? 1 : 0);
  result = hashInteger(result, status.wet ? 1 : 0);
  result = hashInteger(result, combat.attackDamage);
  result = hashInteger(result, combat.attackIntervalTicks);
  result = hashInteger(result, combat.attackRange);
  result = hashInteger(result, combat.nextAttackTick);
  result = hashInteger(result, combat.targetEntityId ?? NULL_TARGET);
  if (combat.pursuitTargetCellKey === null) return hashInteger(result, NULL_TARGET);
  result = hashInteger(result, combat.pursuitTargetCellKey.length);
  for (const codePoint of combat.pursuitTargetCellKey) result = hashInteger(result, codePoint.charCodeAt(0));
  return result;
}
