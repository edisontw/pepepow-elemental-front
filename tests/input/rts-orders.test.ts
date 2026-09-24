import { afterEach, expect, it, vi } from 'vitest';
import type * as pc from 'playcanvas';
import { UnitControls } from '../../src/input/unit-controls';
import type { SelectionState } from '../../src/input/selection-state';
import type { M04Simulation } from '../../src/simulation/m04-simulation';
import type { UnitRenderBridge } from '../../src/rendering/unit-render-bridge';

class ElementStub { isContentEditable = false; tagName = 'CANVAS'; }
afterEach(() => vi.unstubAllGlobals());
it('T arms one destination, A/S stay free for camera, H emits Hold, and typing never issues commands', () => {
  const events = new Map<string, (event: unknown) => void>();
  vi.stubGlobal('window', { addEventListener: (name: string, fn: (event: unknown) => void) => events.set(name, fn), removeEventListener: vi.fn() });
  vi.stubGlobal('document', { getElementById: () => null });
  vi.stubGlobal('HTMLElement', ElementStub);
  const canvas = { style: { cursor: '' }, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as HTMLCanvasElement;
  const enqueueCommand = vi.fn();
  const controls = new UnitControls(canvas, {} as pc.CameraComponent, {
    snapshot: () => ({ tick: 4 }), enqueueCommand,
  } as unknown as M04Simulation, { clearFacingQaOverride: vi.fn() } as unknown as UnitRenderBridge, {} as HTMLElement);
  (controls as unknown as { selection: SelectionState }).selection.select([1, 2], 'REPLACE');
  const key = (code: string, target: unknown = null) => events.get('keydown')!({ code, target, repeat: false, preventDefault: vi.fn() });
  key('KeyA');
  key('KeyS');
  expect(controls.targetingAttackMove).toBe(false);
  expect(enqueueCommand).not.toHaveBeenCalled();
  key('KeyT');
  expect(controls.targetingAttackMove).toBe(true);
  expect(enqueueCommand).not.toHaveBeenCalled();
  controls.moveSelectionTo(8500, 9500);
  expect(enqueueCommand).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'ATTACK_MOVE', targetTick: 5, formation: 'LINE', targetX: 8500, targetZ: 9500 }));
  expect(controls.targetingAttackMove).toBe(false);
  key('KeyH');
  expect(enqueueCommand).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'HOLD', entityIds: [1, 2] }));
  key('KeyT'); key('Escape');
  expect(controls.targetingAttackMove).toBe(false);
  key('KeyT'); controls.cancelAttackMoveTargeting();
  controls.moveSelectionTo(7500, 6500);
  expect(enqueueCommand).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'MOVE' }));
  const input = new ElementStub(); input.tagName = 'INPUT';
  key('KeyA', input);
  expect(controls.targetingAttackMove).toBe(false);
  controls.destroy();
});
