import type { RtsCamera } from '../rendering/rts-camera';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { GeneratedWorld } from '../world/world-definition';
import type { UnitControls } from './unit-controls';

export class MinimapControls {
  private draggingCamera = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly world: GeneratedWorld,
    private readonly camera: RtsCamera,
    private readonly units: UnitControls,
  ) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 0) {
      event.preventDefault();
      this.draggingCamera = true;
      this.focusCamera(event.clientX, event.clientY);
      this.canvas.setPointerCapture?.(event.pointerId);
      return;
    }
    if (event.button === 2) {
      event.preventDefault();
      const target = this.simulationPosition(event.clientX, event.clientY);
      this.units.moveSelectionTo(target.x, target.z);
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.draggingCamera) return;
    this.focusCamera(event.clientX, event.clientY);
  };

  private readonly onPointerUp = (): void => {
    this.draggingCamera = false;
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private focusCamera(clientX: number, clientY: number): void {
    const target = this.simulationPosition(clientX, clientY);
    this.camera.focusAt(
      target.x / WORLD_UNITS_PER_METER,
      target.z / WORLD_UNITS_PER_METER,
    );
  }

  private simulationPosition(clientX: number, clientY: number): { x: number; z: number } {
    const bounds = this.canvas.getBoundingClientRect();
    const fractionX = Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(1, bounds.width)));
    const fractionZ = Math.max(0, Math.min(1, (clientY - bounds.top) / Math.max(1, bounds.height)));
    const spanX = this.world.width * WORLD_UNITS_PER_METER;
    const spanZ = this.world.height * WORLD_UNITS_PER_METER;
    const originX = -Math.floor(spanX / 2);
    const originZ = -Math.floor(spanZ / 2);
    return {
      x: Math.round(originX + fractionX * spanX),
      z: Math.round(originZ + fractionZ * spanZ),
    };
  }
}
