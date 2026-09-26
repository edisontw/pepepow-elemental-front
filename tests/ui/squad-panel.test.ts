import { afterEach, describe, expect, it, vi } from 'vitest';
import type { M06Simulation } from '../../src/simulation/m06-simulation';
import type { SquadSnapshot } from '../../src/simulation/squad-state';
import { SquadPanel } from '../../src/ui/squad-panel';

class FakePanelElement extends EventTarget {
  writes = 0;
  private html = '';

  get innerHTML(): string {
    return this.html;
  }

  set innerHTML(value: string) {
    this.html = value;
    this.writes += 1;
  }
}

class FakeCanvas extends EventTarget {
  readonly classList = {
    toggle: vi.fn(),
  };
}

function simulationStub(squad: SquadSnapshot): M06Simulation {
  return {
    snapshot: vi.fn(() => ({
      tick: 12,
      squads: {
        squads: [squad],
        stateHash: 'squad-test',
      },
    })),
    entities: {
      hasUnit: vi.fn(() => true),
    },
    enqueueSquadOrder: vi.fn(),
  } as unknown as M06Simulation;
}

describe('SquadPanel refresh stability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves the existing button DOM while the rendered state is unchanged', () => {
    vi.stubGlobal('window', new EventTarget());
    const squad: SquadSnapshot = {
      id: 1,
      playerId: 0,
      memberEntityIds: [1, 2, 3],
      currentOrder: null,
      targetX: null,
      targetZ: null,
      regroupDestinationX: null,
      regroupDestinationZ: null,
      regroupState: 'NONE',
      guardTargetEntityId: null,
    };
    const element = new FakePanelElement();
    const canvas = new FakeCanvas();
    const panel = new SquadPanel(
      element as unknown as HTMLElement,
      simulationStub(squad),
      canvas as unknown as HTMLCanvasElement,
      () => null,
      () => true,
    );

    expect(element.writes).toBe(1);

    panel.update(0.13);
    panel.update(0.13);

    expect(element.writes).toBe(1);

    squad.currentOrder = 'GUARD';
    squad.targetX = 4_000;
    squad.targetZ = 8_000;
    panel.update(0.13);

    expect(element.writes).toBe(2);
    panel.destroy();
  });
});
