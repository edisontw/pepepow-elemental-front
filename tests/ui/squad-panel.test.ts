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

function simulationStub(squad: SquadSnapshot, additionalSquads: SquadSnapshot[] = []): M06Simulation {
  return {
    snapshot: vi.fn(() => ({
      tick: 12,
      squads: {
        squads: [squad, ...additionalSquads],
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
      rosterLocked: true,
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
    expect(element.innerHTML).toContain('COMMAND MODE');
    expect(element.innerHTML).not.toContain('P5-A1');

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
  it('cancels an armed front order when selecting a different squad', () => {
    vi.stubGlobal('window', new EventTarget());
    const squad: SquadSnapshot = {
      id: 1, playerId: 0, memberEntityIds: [1], rosterLocked: true,
      currentOrder: null, targetX: null, targetZ: null,
      regroupDestinationX: null, regroupDestinationZ: null,
      regroupState: 'NONE', guardTargetEntityId: null,
    };
    const second = { ...squad, id: 2, memberEntityIds: [2] };
    const element = new FakePanelElement();
    const canvas = new FakeCanvas();
    const simulation = simulationStub(squad, [second]);
    const panel = new SquadPanel(
      element as unknown as HTMLElement, simulation,
      canvas as unknown as HTMLCanvasElement,
      () => ({ x: 1000, z: 2000 }), () => true,
    );
    const click = (action: string, squadId: string) => {
      const button = { dataset: { action, squadId } };
      (panel as unknown as { onClick: (event: unknown) => void }).onClick({
        target: { closest: () => button },
      });
    };
    click('advance', '1');
    expect(element.innerHTML).toContain('Advance: click a battlefield destination');
    click('select-squad', '2');
    expect(element.innerHTML).toContain('Squad 2 selected.');
    expect(canvas.classList.toggle).toHaveBeenLastCalledWith('front-order-targeting', false);
    expect(simulation.enqueueSquadOrder).not.toHaveBeenCalled();
    panel.destroy();
  });

  it('cancels targeting if the selected squad disappears before battlefield targeting', () => {
    vi.stubGlobal('window', new EventTarget());
    const squad: SquadSnapshot = {
      id: 1, playerId: 0, memberEntityIds: [1], rosterLocked: true,
      currentOrder: null, targetX: null, targetZ: null,
      regroupDestinationX: null, regroupDestinationZ: null,
      regroupState: 'NONE', guardTargetEntityId: null,
    };
    const other = { ...squad, id: 2, memberEntityIds: [2] };
    const squads = [squad, other];
    const element = new FakePanelElement();
    const canvas = new FakeCanvas();
    const simulation = simulationStub(squad, [other]);
    vi.mocked(simulation.snapshot).mockImplementation(() => ({
      tick: 12,
      squads: { squads, stateHash: 'squad-test' },
    }) as ReturnType<M06Simulation['snapshot']>);
    const panel = new SquadPanel(
      element as unknown as HTMLElement, simulation,
      canvas as unknown as HTMLCanvasElement,
      () => ({ x: 1000, z: 2000 }), () => true,
    );
    (panel as unknown as { onClick: (event: unknown) => void }).onClick({
      target: { closest: () => ({ dataset: { action: 'advance', squadId: '1' } }) },
    });
    expect(element.innerHTML).toContain('Advance: click a battlefield destination');

    squads.shift();
    panel.update(0.13);
    expect(element.innerHTML).toContain('Front Order targeting cancelled: squad unavailable.');
    expect(element.innerHTML).toContain('Squad 2');
    expect(canvas.classList.toggle).toHaveBeenLastCalledWith('front-order-targeting', false);
    expect(simulation.enqueueSquadOrder).not.toHaveBeenCalled();
    panel.destroy();
  });


  it('does not redirect a pending battlefield order when its squad disappears before refresh', () => {
    vi.stubGlobal('window', new EventTarget());
    const squad: SquadSnapshot = {
      id: 1, playerId: 0, memberEntityIds: [1], rosterLocked: true,
      currentOrder: null, targetX: null, targetZ: null,
      regroupDestinationX: null, regroupDestinationZ: null,
      regroupState: 'NONE', guardTargetEntityId: null,
    };
    const other = { ...squad, id: 2, memberEntityIds: [2] };
    const squads = [squad, other];
    const simulation = simulationStub(squad, [other]);
    vi.mocked(simulation.snapshot).mockImplementation(() => ({
      tick: 12,
      squads: { squads, stateHash: 'squad-test' },
    }) as ReturnType<M06Simulation['snapshot']>);
    const element = new FakePanelElement();
    const canvas = new FakeCanvas();
    const panel = new SquadPanel(
      element as unknown as HTMLElement, simulation,
      canvas as unknown as HTMLCanvasElement,
      () => ({ x: 1000, z: 2000 }), () => true,
    );
    (panel as unknown as { onClick: (event: unknown) => void }).onClick({
      target: { closest: () => ({ dataset: { action: 'advance', squadId: '1' } }) },
    });
    squads.shift();
    const preventDefault = vi.fn();
    const stopImmediatePropagation = vi.fn();
    (panel as unknown as {
      onBattlefieldPointerDown: (event: unknown) => void;
    }).onBattlefieldPointerDown({
      button: 0, clientX: 10, clientY: 20, preventDefault, stopImmediatePropagation,
    });
    expect(simulation.enqueueSquadOrder).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(element.innerHTML).toContain('Front Order targeting cancelled: squad unavailable.');
    expect(canvas.classList.toggle).toHaveBeenLastCalledWith('front-order-targeting', false);
    panel.destroy();
  });

  it('does not enqueue a front order for invalid battlefield coordinates', () => {
    vi.stubGlobal('window', new EventTarget());
    const squad: SquadSnapshot = {
      id: 1, playerId: 0, memberEntityIds: [1], rosterLocked: true,
      currentOrder: null, targetX: null, targetZ: null,
      regroupDestinationX: null, regroupDestinationZ: null,
      regroupState: 'NONE', guardTargetEntityId: null,
    };
    const simulation = simulationStub(squad);
    const element = new FakePanelElement();
    const canvas = new FakeCanvas();
    const screenToPosition = vi.fn(() => ({ x: Number.NaN, z: 2000 }));
    const panel = new SquadPanel(
      element as unknown as HTMLElement, simulation,
      canvas as unknown as HTMLCanvasElement,
      screenToPosition, () => true,
    );
    (panel as unknown as { onClick: (event: unknown) => void }).onClick({
      target: { closest: () => ({ dataset: { action: 'advance', squadId: '1' } }) },
    });
    const preventDefault = vi.fn();
    const stopImmediatePropagation = vi.fn();
    const pointerDown = (panel as unknown as {
      onBattlefieldPointerDown: (event: unknown) => void;
    }).onBattlefieldPointerDown;
    pointerDown({ button: 0, clientX: 10, clientY: 20, preventDefault, stopImmediatePropagation });
    expect(simulation.enqueueSquadOrder).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(element.innerHTML).toContain('Invalid battlefield destination.');
    expect(canvas.classList.toggle).toHaveBeenLastCalledWith('front-order-targeting', true);

    screenToPosition.mockReturnValue({ x: 1000, z: Number.POSITIVE_INFINITY });
    pointerDown({ button: 0, clientX: 10, clientY: 20, preventDefault, stopImmediatePropagation });
    expect(simulation.enqueueSquadOrder).not.toHaveBeenCalled();

    screenToPosition.mockReturnValue({ x: 1000, z: 2000 });
    pointerDown({ button: 0, clientX: 10, clientY: 20, preventDefault, stopImmediatePropagation });
    expect(simulation.enqueueSquadOrder).toHaveBeenCalledTimes(1);
    expect(simulation.enqueueSquadOrder).toHaveBeenCalledWith(
      expect.objectContaining({ order: 'ADVANCE', squadId: 1, targetX: 1000, targetZ: 2000 }),
    );
    expect(preventDefault).toHaveBeenCalledTimes(3);
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(3);
    panel.destroy();
  });

  it('cancels an armed front order on battlefield right click without issuing a move', () => {
    vi.stubGlobal('window', new EventTarget());
    const squad: SquadSnapshot = {
      id: 1, playerId: 0, memberEntityIds: [1], rosterLocked: true,
      currentOrder: null, targetX: null, targetZ: null,
      regroupDestinationX: null, regroupDestinationZ: null,
      regroupState: 'NONE', guardTargetEntityId: null,
    };
    const simulation = simulationStub(squad);
    const element = new FakePanelElement();
    const canvas = new FakeCanvas();
    const panel = new SquadPanel(
      element as unknown as HTMLElement, simulation,
      canvas as unknown as HTMLCanvasElement,
      () => ({ x: 1000, z: 2000 }), () => true,
    );
    (panel as unknown as { onClick: (event: unknown) => void }).onClick({
      target: { closest: () => ({ dataset: { action: 'guard', squadId: '1' } }) },
    });
    const preventDefault = vi.fn();
    const stopImmediatePropagation = vi.fn();
    (panel as unknown as {
      onBattlefieldPointerDown: (event: unknown) => void;
    }).onBattlefieldPointerDown({
      button: 2, clientX: 10, clientY: 20, preventDefault, stopImmediatePropagation,
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(simulation.enqueueSquadOrder).not.toHaveBeenCalled();
    expect(canvas.classList.toggle).toHaveBeenLastCalledWith('front-order-targeting', false);
    expect(element.innerHTML).toContain('Front Order targeting cancelled.');
    panel.destroy();
  });

  it('ignores stale squad buttons without issuing orders to a fallback squad', () => {
    vi.stubGlobal('window', new EventTarget());
    const squad: SquadSnapshot = {
      id: 2, playerId: 0, memberEntityIds: [2], rosterLocked: true,
      currentOrder: null, targetX: null, targetZ: null,
      regroupDestinationX: null, regroupDestinationZ: null,
      regroupState: 'NONE', guardTargetEntityId: null,
    };
    const simulation = simulationStub(squad);
    const element = new FakePanelElement();
    const canvas = new FakeCanvas();
    const panel = new SquadPanel(
      element as unknown as HTMLElement, simulation,
      canvas as unknown as HTMLCanvasElement,
      () => ({ x: 1000, z: 2000 }), () => true,
    );
    (panel as unknown as { onClick: (event: unknown) => void }).onClick({
      target: { closest: () => ({ dataset: { action: 'regroup', squadId: '1' } }) },
    });
    expect(simulation.enqueueSquadOrder).not.toHaveBeenCalled();
    expect(element.innerHTML).not.toContain('Squad 2: Regroup ordered.');
    panel.destroy();
  });
});
