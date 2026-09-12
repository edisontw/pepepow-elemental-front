import type { UnitArchetype } from './components';
import { UNITS } from './m03-content';
import type { M06Simulation } from './m06-simulation';

const PLAYER_ID = 0;

const VISUAL_QA_ARCHETYPES: readonly UnitArchetype[] = [
  'VANGUARD',
  'SPEAR_GUARD',
  'RANGER',
  'SCOUT',
  'ELEMENTALIST',
  'ENGINEER',
  'GOLEM',
  'SIEGE_CONSTRUCT',
];

const QA_SPAWN_OFFSETS = [
  { column: -3, row: -1 },
  { column: 3, row: -1 },
  { column: -3, row: 2 },
  { column: 3, row: 2 },
  { column: 0, row: 4 },
] as const;

/**
 * Development-only visual QA helper. It adds one instance of each missing player
 * archetype beside the existing starting army without changing the canonical
 * arena roster used by simulations, challenges, or replay identity.
 */
export function addMissingVisualQaUnits(simulation: M06Simulation): void {
  const playerEntityIds = simulation.entities.entityIds().filter((entityId) => (
    simulation.entities.hasUnit(entityId)
    && simulation.entities.factions.get(entityId)?.playerId === PLAYER_ID
  ));
  const anchorId = playerEntityIds[0];
  const anchorPosition = anchorId === undefined ? undefined : simulation.entities.positions.get(anchorId);
  if (!anchorPosition) return;

  const present = new Set<UnitArchetype>();
  for (const entityId of playerEntityIds) {
    const archetype = simulation.entities.archetypes.get(entityId);
    if (archetype) present.add(archetype);
  }

  const navigation = simulation.navigation;
  const anchorCell = navigation.worldToCell(anchorPosition.x, anchorPosition.z);
  const reserved = new Set<string>();
  for (const entityId of simulation.entities.entityIds()) {
    const position = simulation.entities.positions.get(entityId);
    if (!position) continue;
    reserved.add(navigation.cellKey(navigation.worldToCell(position.x, position.z)));
  }

  let spawnSlot = 0;
  for (const archetype of VISUAL_QA_ARCHETYPES) {
    if (present.has(archetype)) continue;
    const offset = QA_SPAWN_OFFSETS[spawnSlot % QA_SPAWN_OFFSETS.length]!;
    const target = {
      column: anchorCell.column + offset.column,
      row: anchorCell.row + offset.row,
    };
    const cell = navigation.resolveWalkableTargetAvoiding(target, reserved);
    if (!cell) continue;
    reserved.add(navigation.cellKey(cell));

    const position = navigation.cellToWorld(cell);
    const definition = UNITS[archetype];
    const entityId = simulation.entities.createUnit({
      archetype,
      playerId: PLAYER_ID,
      x: position.x,
      z: position.z,
      ...definition.spawn,
    });
    if (archetype === 'ELEMENTALIST') {
      simulation.entities.setElementalAlignment(entityId, simulation.attunements.starting(PLAYER_ID)[0]);
    }
    present.add(archetype);
    spawnSlot += 1;
  }

  simulation.visibility.update(simulation.entities, navigation);
}
