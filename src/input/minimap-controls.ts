import type { RtsCamera } from '../rendering/rts-camera';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { GeneratedWorld, PointOfInterest } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';
import type { UnitControls } from './unit-controls';

function poiLabel(poi: PointOfInterest): string {
  if (poi.type === 'SHRINE') return 'Shrine';
  if (poi.type === 'NEUTRAL_CAMP') return 'Neutral Camp';
  if (poi.type === 'VILLAGE') return 'Village';
  return 'Ancient Ruin';
}

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
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 0) {
      event.preventDefault();
      const poi = this.poiAtPointer(event.clientX, event.clientY);
      if (poi) {
        this.draggingCamera = false;
        const position = worldCellToSimulationPosition(this.world, poi.cell);
        this.camera.focusAt(
          position.x / WORLD_UNITS_PER_METER,
          position.z / WORLD_UNITS_PER_METER,
        );
        return;
      }
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
    if (this.draggingCamera) {
      this.focusCamera(event.clientX, event.clientY);
      return;
    }
    const poi = this.poiAtPointer(event.clientX, event.clientY);
    this.canvas.classList.toggle('poi-hover', poi !== null);
    this.canvas.title = poi
      ? `${poiLabel(poi)} · Region ${poi.regionId + 1} · click to focus`
      : 'Left click / drag: camera · Right click: move selected units';
  };

  private readonly onPointerLeave = (): void => {
    this.canvas.classList.remove('poi-hover');
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

  private poiAtPointer(clientX: number, clientY: number): PointOfInterest | null {
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const localX = clientX - bounds.left;
    const localY = clientY - bounds.top;
    let best: PointOfInterest | null = null;
    let bestDistanceSquared = 9 * 9;
    for (const poi of this.world.pois) {
      const x = ((poi.cell.x + 0.5) / this.world.width) * bounds.width;
      const y = ((poi.cell.z + 0.5) / this.world.height) * bounds.height;
      const dx = x - localX;
      const dy = y - localY;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > bestDistanceSquared) continue;
      bestDistanceSquared = distanceSquared;
      best = poi;
    }
    return best;
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
