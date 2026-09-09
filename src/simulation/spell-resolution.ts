import { effectiveConductivity } from './conductivity';
import type { EntityStore } from './entity-store';
import { UNITS } from './m03-content';
import type { NavigationGrid } from './navigation';
import {
  FIRE_IMPACT_DAMAGE,
  WATER_PUSH_CELLS,
  WATER_WET_DURATION_TICKS,
} from './elemental-tactics';
import { CHILLED_DURATION_TICKS, FROZEN_DURATION_TICKS } from './simulation';
import { lightningDamage } from './lightning';
import { SurfaceType, type TerrainEffectId, type TerrainState } from './terrain-state';
import type { FactionPolicy } from './spell-content';

function inRadius(position: { x: number; z: number }, x: number, z: number, radiusSquared: number): boolean {
  const dx = position.x - x;
  const dz = position.z - z;
  return dx * dx + dz * dz <= radiusSquared;
}

function clearMovement(entityId: number, entities: EntityStore, navigation: NavigationGrid): void {
  const movement = entities.movements.get(entityId);
  if (!movement) return;
  movement.targetX = null;
  movement.targetZ = null;
  movement.path = [];
  movement.pathIndex = 0;
  movement.pathNavVersion = navigation.navVersion;
}

function pushLightUnit(
  entityId: number,
  sourceX: number,
  sourceZ: number,
  entities: EntityStore,
  navigation: NavigationGrid,
): void {
  const archetype = entities.archetypes.get(entityId);
  const position = entities.positions.get(entityId);
  const status = entities.statuses.get(entityId);
  if (!archetype || !position || status?.frozenTicks || !UNITS[archetype].tags.includes('LIGHT')) return;
  const current = navigation.worldToCell(position.x, position.z);
  const deltaX = position.x - sourceX;
  const deltaZ = position.z - sourceZ;
  let direction: { column: number; row: number };
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
    if (!navigation.isWalkable(target)) continue;
    const world = navigation.cellToWorld(target);
    position.x = world.x;
    position.z = world.z;
    clearMovement(entityId, entities, navigation);
    return;
  }
}

export function applyV2TerrainPulse(
  effectId: Extract<TerrainEffectId, 'FIRE' | 'WATER' | 'FREEZE' | 'HEAT'>,
  sourcePlayerId: number,
  factionPolicy: FactionPolicy,
  targetX: number,
  targetZ: number,
  radius: number,
  entities: EntityStore,
  terrain: TerrainState,
  navigation: NavigationGrid,
): void {
  const changes = terrain.applyEffects([{ effectId, targetX, targetZ, radius, sourcePlayerId }]);
  navigation.applyWalkabilityChanges(changes);
  const radiusSquared = radius * radius;

  for (const entityId of entities.entityIds()) {
    if (!entities.hasUnit(entityId)) continue;
    if (factionPolicy === 'HOSTILE_ONLY' && entities.factions.get(entityId)?.playerId === sourcePlayerId) continue;
    const position = entities.positions.get(entityId);
    const status = entities.statuses.get(entityId);
    if (!position || !status || !inRadius(position, targetX, targetZ, radiusSquared)) continue;

    if (effectId === 'FREEZE') {
      if (status.wet || status.chilledTicks > 0) {
        status.chilledTicks = 0;
        status.frozenTicks = FROZEN_DURATION_TICKS + 1;
      } else if (status.frozenTicks === 0) {
        status.chilledTicks = CHILLED_DURATION_TICKS + 1;
      }
      continue;
    }

    if (effectId === 'WATER') {
      status.wetTicks = Math.max(status.wetTicks, WATER_WET_DURATION_TICKS + 1);
      status.wet = true;
      pushLightUnit(entityId, targetX, targetZ, entities, navigation);
      continue;
    }

    if (effectId === 'FIRE') {
      const surface = terrain.surfaceAt(navigation.worldToCell(position.x, position.z));
      if (surface === SurfaceType.GROUND || surface === SurfaceType.NATURAL_CROSSING) {
        const health = entities.health.get(entityId);
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

export function applyThunderstormPulse(
  targetX: number,
  targetZ: number,
  radius: number,
  entities: EntityStore,
  terrain: TerrainState,
  navigation: NavigationGrid,
): number | null {
  const radiusSquared = radius * radius;
  const candidates: { id: number; conductivity: number; distanceSquared: number }[] = [];
  for (const entityId of entities.entityIds()) {
    if (!entities.hasUnit(entityId)) continue;
    const position = entities.positions.get(entityId);
    if (!position) continue;
    const dx = position.x - targetX;
    const dz = position.z - targetZ;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared > radiusSquared) continue;
    candidates.push({
      id: entityId,
      conductivity: effectiveConductivity(entityId, entities, terrain, navigation),
      distanceSquared,
    });
  }
  candidates.sort((left, right) => (
    right.conductivity - left.conductivity
    || left.distanceSquared - right.distanceSquared
    || left.id - right.id
  ));
  const target = candidates[0];
  if (!target) return null;
  const health = entities.health.get(target.id);
  if (health?.alive) health.current = Math.max(0, health.current - lightningDamage(target.id, entities));
  return target.id;
}
