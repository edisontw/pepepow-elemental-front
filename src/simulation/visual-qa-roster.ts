import type { UnitArchetype } from './components';
import { ELEMENT_IDS, type ElementId } from './element-types';
import { UNITS } from './m03-content';
import type { M06Simulation } from './m06-simulation';

const PLAYER_ID = 0;

interface VisualQaUnitSpec {
  archetype: UnitArchetype;
  element?: ElementId;
}

const VISUAL_QA_UNITS: readonly VisualQaUnitSpec[] = [
  { archetype: 'VANGUARD' },
  { archetype: 'SPEAR_GUARD' },
  { archetype: 'RANGER' },
  { archetype: 'SCOUT' },
  { archetype: 'ELEMENTALIST', element: 'FIRE' },
  { archetype: 'ELEMENTALIST', element: 'WATER' },
  { archetype: 'ELEMENTALIST', element: 'ICE' },
  { archetype: 'ELEMENTALIST', element: 'LIGHTNING' },
  { archetype: 'ENGINEER' },
  { archetype: 'GOLEM' },
  { archetype: 'SIEGE_CONSTRUCT' },
];

const QA_SPAWN_OFFSETS = [
  { column: -4, row: -2 },
  { column: 0, row: -2 },
  { column: 4, row: -2 },
  { column: -4, row: 1 },
  { column: 0, row: 1 },
  { column: 4, row: 1 },
  { column: -4, row: 4 },
  { column: 0, row: 4 },
  { column: 4, row: 4 },
  { column: -2, row: 6 },
  { column: 2, row: 6 },
] as const;

function qaUnitKey(archetype: UnitArchetype, element?: ElementId): string {
  return archetype === 'ELEMENTALIST' ? `${archetype}:${element ?? 'UNALIGNED'}` : archetype;
}

/**
 * Development-only visual QA helper. It adds one instance of each missing player
 * visual unit beside the existing starting army without changing the canonical
 * arena roster used by simulations, challenges, or replay identity. Elementalists
 * deliberately include all four visual alignments, even when an alignment is not
 * among the player's two gameplay Attunements, so presentation assets can be QA'd.
 */
export function addMissingVisualQaUnits(simulation: M06Simulation): void {
  const playerEntityIds = simulation.entities.entityIds().filter((entityId) => (
    simulation.entities.hasUnit(entityId)
    && simulation.entities.factions.get(entityId)?.playerId === PLAYER_ID
  ));
  const anchorId = playerEntityIds[0];
  const anchorPosition = anchorId === undefined ? undefined : simulation.entities.positions.get(anchorId);
  if (!anchorPosition) return;

  const present = new Set<string>();
  for (const entityId of playerEntityIds) {
    const archetype = simulation.entities.archetypes.get(entityId);
    if (!archetype) continue;
    if (archetype === 'ELEMENTALIST') {
      const element = simulation.entities.elementalAlignments.get(entityId)?.element;
      if (element) present.add(qaUnitKey(archetype, element));
      continue;
    }
    present.add(qaUnitKey(archetype));
  }

  const navigation = simulation.navigation;
  const anchorCell = navigation.worldToCell(anchorPosition.x, anchorPosition.z);
  const reserved = new Set<string>();
  for (const entityId of simulation.entities.entityIds()) {
    const position = simulation.entities.positions.get(entityId);
    if (!position) continue;
    reserved.add(navigation.cellKey(navigation.worldToCell(position.x, position.z)));
  }
  for (const building of simulation.strategy.snapshot().buildings) {
    if (building.destroyed) continue;
    reserved.add(navigation.cellKey(navigation.worldToCell(building.x, building.z)));
  }

  let spawnSlot = 0;
  for (const spec of VISUAL_QA_UNITS) {
    const key = qaUnitKey(spec.archetype, spec.element);
    if (present.has(key)) continue;

    const offset = QA_SPAWN_OFFSETS[spawnSlot % QA_SPAWN_OFFSETS.length]!;
    const target = {
      column: anchorCell.column + offset.column,
      row: anchorCell.row + offset.row,
    };
    const cell = navigation.resolveWalkableTargetAvoiding(target, reserved);
    if (!cell) continue;
    reserved.add(navigation.cellKey(cell));

    const position = navigation.cellToWorld(cell);
    const definition = UNITS[spec.archetype];
    const entityId = simulation.entities.createUnit({
      archetype: spec.archetype,
      playerId: PLAYER_ID,
      x: position.x,
      z: position.z,
      ...definition.spawn,
    });
    if (spec.archetype === 'ELEMENTALIST' && spec.element) {
      simulation.entities.setElementalAlignment(entityId, spec.element);
    }
    present.add(key);
    spawnSlot += 1;
  }

  simulation.visibility.update(simulation.entities, navigation);
}

export const VISUAL_QA_ELEMENTALIST_ALIGNMENTS: readonly ElementId[] = ELEMENT_IDS;
