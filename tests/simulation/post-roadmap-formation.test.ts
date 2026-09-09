import { describe, expect, it } from 'vitest';
import { WORLD_UNITS_PER_METER, M01_ARENA } from '../../src/simulation/arena';
import { EntityStore } from '../../src/simulation/entity-store';
import {
  formationDestinations,
  formationRoleRank,
  formationSlots,
  type FormationId,
} from '../../src/simulation/formation';
import { NavigationGrid } from '../../src/simulation/navigation';
import { Simulation, formationOffsets } from '../../src/simulation/simulation';
import type { UnitArchetype } from '../../src/simulation/components';

const M = WORLD_UNITS_PER_METER;

function navigation(blocked = false): NavigationGrid {
  return new NavigationGrid({
    originX: -20 * M,
    originZ: -20 * M,
    cellSize: M,
    columns: 40,
    rows: 40,
    initialNavVersion: 1,
    patches: blocked ? [{ id: 'center-block', kind: 'BLOCKED_TERRAIN', minColumn: 18, maxColumn: 22, minRow: 28, maxRow: 32 }] : [],
    freezableWaterPatches: [],
    vegetationPatches: [],
  });
}

function mixedEntities(): { entities: EntityStore; ids: number[] } {
  const entities = new EntityStore();
  const archetypes: UnitArchetype[] = [
    'RANGER', 'ELEMENTALIST',
    'VANGUARD', 'GOLEM', 'SPEAR_GUARD', 'VANGUARD',
    'GOLEM', 'SPEAR_GUARD', 'VANGUARD', 'GOLEM',
  ];
  const ids = archetypes.map((archetype, index) => entities.createUnit({
    archetype,
    playerId: 0,
    x: (-4 + (index % 5) * 2) * M,
    z: (-8 + Math.floor(index / 5) * 2) * M,
    speedPerTick: 300,
    selectionRadius: 700,
    maxHealth: 100,
    attackDamage: 10,
    attackIntervalTicks: 10,
    attackRange: M,
  }));
  return { entities, ids };
}

function destinationMap(destinations: readonly { entityId: number; x: number; z: number }[]): Map<number, string> {
  return new Map(destinations.map((destination) => [destination.entityId, `${destination.x},${destination.z}`]));
}

function footprint(slots: readonly { lateral: number; depth: number }[]): number {
  const lateral = slots.map((slot) => slot.lateral);
  const depth = slots.map((slot) => slot.depth);
  return (Math.max(...lateral) - Math.min(...lateral)) * (Math.max(...depth) - Math.min(...depth));
}

function planned(formation: FormationId, blocked = false) {
  const { entities, ids } = mixedEntities();
  const nav = navigation(blocked);
  return { entities, ids, nav, destinations: formationDestinations(ids, formation, 0, 10 * M, entities, nav) };
}

describe('post-roadmap Phase 3 formation movement', () => {
  it('gives Line, Column, and Spread distinct deterministic layouts with a larger Spread footprint', () => {
    const line = formationSlots('LINE', 10);
    const column = formationSlots('COLUMN', 10);
    const spread = formationSlots('SPREAD', 10);
    expect(line).not.toEqual(column);
    expect(line).not.toEqual(spread);
    expect(column).not.toEqual(spread);
    expect(footprint(spread)).toBeGreaterThan(footprint(line));
    expect(footprint(spread)).toBeGreaterThan(footprint(column));
  });

  it('is independent of selected entity input order and reserves unique walkable cells', () => {
    const { entities, ids } = mixedEntities();
    const nav = navigation();
    const first = formationDestinations(ids, 'LINE', 0, 10 * M, entities, nav);
    const second = formationDestinations([...ids].reverse(), 'LINE', 0, 10 * M, entities, nav);
    expect(destinationMap(first)).toEqual(destinationMap(second));
    const keys = first.map((destination) => nav.cellKey(nav.worldToCell(destination.x, destination.z)));
    expect(new Set(keys).size).toBe(first.length);
  });

  it('places frontline roles ahead of rear/support roles in a multi-row Line', () => {
    const { entities, destinations } = planned('LINE');
    const frontZ = destinations
      .filter((destination) => formationRoleRank(entities.archetypes.get(destination.entityId)!) === 0)
      .map((destination) => destination.z);
    const rearZ = destinations
      .filter((destination) => formationRoleRank(entities.archetypes.get(destination.entityId)!) === 2)
      .map((destination) => destination.z);
    expect(frontZ).toHaveLength(8);
    expect(rearZ).toHaveLength(2);
    expect(Math.min(...frontZ)).toBeGreaterThan(Math.max(...rearZ));
  });

  it('resolves blocked desired slots deterministically without duplicate destinations', () => {
    const first = planned('SPREAD', true);
    const second = planned('SPREAD', true);
    expect(first.destinations).toEqual(second.destinations);
    expect(first.destinations).toHaveLength(first.ids.length);
    const keys = first.destinations.map((destination) => first.nav.cellKey(first.nav.worldToCell(destination.x, destination.z)));
    expect(new Set(keys).size).toBe(first.ids.length);
    expect(first.destinations.every((destination) => first.nav.isWalkable(first.nav.worldToCell(destination.x, destination.z)))).toBe(true);
  });

  it('preserves the historical compact-grid target resolution for MOVE commands without formation metadata', () => {
    const simulation = new Simulation('phase3-legacy-move', M01_ARENA);
    const ids = simulation.snapshot().entities.filter((entity) => entity.playerId === 0).slice(0, 4).map((entity) => entity.id);
    const targetX = -10 * M;
    const targetZ = 0;
    const offsets = formationOffsets(ids.length);
    const expected = new Map(ids.map((entityId, index) => {
      const offset = offsets[index]!;
      const cell = simulation.navigation.resolveWalkableTarget(simulation.navigation.worldToCell(targetX + offset.x, targetZ + offset.z));
      if (!cell) throw new Error('Expected a walkable legacy destination.');
      const world = simulation.navigation.cellToWorld(cell);
      return [entityId, `${world.x},${world.z}`] as const;
    }));
    simulation.enqueueCommand({ targetTick: 1, playerId: 0, type: 'MOVE', entityIds: ids, targetX, targetZ });
    const frame = simulation.step();
    const actual = new Map(frame.entities.filter((entity) => ids.includes(entity.id)).map((entity) => [entity.id, `${entity.targetX},${entity.targetZ}`]));
    expect(actual).toEqual(expected);
  });

  it('produces different authoritative MOVE targets for Line and Column', () => {
    const execute = (formation: FormationId) => {
      const simulation = new Simulation(`phase3-${formation}`, M01_ARENA);
      const ids = simulation.snapshot().entities.filter((entity) => entity.playerId === 0).slice(0, 8).map((entity) => entity.id);
      simulation.enqueueCommand({
        targetTick: 1,
        playerId: 0,
        type: 'MOVE',
        entityIds: ids,
        targetX: -8 * M,
        targetZ: 8 * M,
        formation,
      });
      return simulation.step().entities
        .filter((entity) => ids.includes(entity.id))
        .map((entity) => [entity.id, entity.targetX, entity.targetZ]);
    };
    expect(execute('LINE')).not.toEqual(execute('COLUMN'));
  });
});
