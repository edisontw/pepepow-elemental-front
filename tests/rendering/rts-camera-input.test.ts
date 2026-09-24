import { afterEach, expect, it, vi } from 'vitest';
import type * as pc from 'playcanvas';
import { RtsCamera } from '../../src/rendering/rts-camera';

class ElementStub {}
class HtmlElementStub extends ElementStub {}

afterEach(() => vi.unstubAllGlobals());

it('captures middle-button drag before battlefield controls and pans the camera', () => {
  const windowEvents = new Map<string, (event: any) => void>();
  const canvasEvents = new Map<string, (event: any) => void>();
  const addWindow = vi.fn((name: string, fn: (event: any) => void) => windowEvents.set(name, fn));
  const removeWindow = vi.fn();
  vi.stubGlobal('window', { addEventListener: addWindow, removeEventListener: removeWindow });
  vi.stubGlobal('Element', ElementStub);
  vi.stubGlobal('HTMLElement', HtmlElementStub);
  vi.stubGlobal('document', {
    elementFromPoint: () => canvas,
    getElementById: () => null,
    querySelector: () => null,
  });

  const classList = { add: vi.fn(), remove: vi.fn() };
  const canvas = {
    addEventListener: vi.fn((name: string, fn: (event: any) => void) => canvasEvents.set(name, fn)),
    removeEventListener: vi.fn(),
    classList,
    setPointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
    releasePointerCapture: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, right: 800, top: 0, bottom: 600 }),
  } as unknown as HTMLCanvasElement;
  const entity = {
    setPosition: vi.fn(),
    lookAt: vi.fn(),
  } as unknown as pc.Entity;

  const camera = new RtsCamera(entity, canvas, { halfWidth: 50, halfDepth: 50 });
  expect(addWindow).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);

  const down = {
    button: 1,
    target: canvas,
    altKey: false,
    pointerId: 7,
    clientX: 100,
    clientY: 100,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  };
  windowEvents.get('pointerdown')!(down);
  expect(down.preventDefault).toHaveBeenCalled();
  expect(down.stopImmediatePropagation).toHaveBeenCalled();
  expect(classList.add).toHaveBeenCalledWith('camera-pan-active');

  const setPositionBeforeMove = (entity.setPosition as ReturnType<typeof vi.fn>).mock.calls.length;
  windowEvents.get('pointermove')!({
    clientX: 140,
    clientY: 120,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  });
  expect((entity.setPosition as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(setPositionBeforeMove);

  const aux = { button: 1, preventDefault: vi.fn() };
  canvasEvents.get('auxclick')!(aux);
  expect(aux.preventDefault).toHaveBeenCalled();

  windowEvents.get('pointerup')!({
    pointerId: 7,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  });
  expect(classList.remove).toHaveBeenCalledWith('camera-pan-active');

  camera.destroy();
  expect(removeWindow).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
});
