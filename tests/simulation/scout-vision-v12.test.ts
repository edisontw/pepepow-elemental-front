import { describe, expect, it } from 'vitest';
import type { UnitArchetype } from '../../src/simulation/components';
import { EntityStore } from '../../src/simulation/entity-store';
import { UNITS } from '../../src/simulation/m03-content';
import { NavigationGrid } from '../../src/simulation/navigation';
import {
  SCOUT_VISION_RADIUS,
  VISION_RADIUS,
  VisibilityState,
} from '../../src/simulation/visibility-state';

const traversal = {
  originX: 0,
  originZ: 0,
  cellSize: 1_000,
  columns: 32,
  rows: 32,
  initialNavVersion: 1,
  patches: [],
  freezableWaterPatches: [],
  vegetationPatches: [],
} as const;

function visibleAt(archetype: UnitArchetype, targetX: number): boolean {
  const entities = new EntityStore();
  entities.createUnit({
    archetype,
    playerId: 0,
    x: 5_000,
    z: 5_000,
    ...UNITS[archetype].spawn,
  });
  const navigation = new NavigationGrid(traversal);
  const visibility = new VisibilityState(traversal, [0]);
  visibility.update(entities, navigation);
  return visibility.isWorldVisible(0, targetX, 5_000, navigation);
}

describe('Scout vision', () => {
  it('extends Scout fog vision to 15m while ordinary units remain at 9m', () => {
    expect(VISION_RADIUS).toBe(9_000);
    expect(SCOUT_VISION_RADIUS).toBe(15_000);
    expect(visibleAt('SCOUT', 19_000)).toBe(true);
    expect(visibleAt('VANGUARD', 19_000)).toBe(false);
  });

  it('does not extend beyond the 15m Scout radius', () => {
    expect(visibleAt('SCOUT', 21_000)).toBe(false);
  });
});
