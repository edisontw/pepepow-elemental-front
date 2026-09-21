import * as pc from 'playcanvas';
import { RTS_CAMERA_YAW_DEGREES } from './impostor-frame';

const DEFAULT_MIN_DISTANCE = 12;
const DEFAULT_MAX_DISTANCE = 46;
const DEFAULT_DISTANCE = 28;
const EDGE_SCROLL_MARGIN_PX = 48;
const EDGE_SCROLL_SPEED_MULTIPLIER = 1.75;
const HUD_EDGE_GAP_PX = 8;

export interface RtsCameraOptions {
  halfWidth?: number;
  halfDepth?: number;
  targetX?: number;
  targetZ?: number;
  minDistance?: number;
  maxDistance?: number;
  initialDistance?: number;
}

export class RtsCamera {
  private readonly target = new pc.Vec3(0, 0, 0);
  private readonly pressedKeys = new Set<string>();
  private readonly halfWidth: number;
  private readonly halfDepth: number;
  private readonly minDistance: number;
  private readonly maxDistance: number;
  private readonly homeX: number;
  private readonly homeZ: number;
  private distance: number;
  private yaw = RTS_CAMERA_YAW_DEGREES;
  private pitch = -48;
  private dragging = false;
  private pointerInsideCanvas = false;
  private pointerX = 0;
  private pointerY = 0;

  constructor(
    private readonly entity: pc.Entity,
    private readonly canvas: HTMLCanvasElement,
    options: RtsCameraOptions = {},
  ) {
    this.halfWidth = Math.max(4, options.halfWidth ?? 24);
    this.halfDepth = Math.max(4, options.halfDepth ?? 24);
    this.minDistance = Math.max(4, options.minDistance ?? DEFAULT_MIN_DISTANCE);
    this.maxDistance = Math.max(this.minDistance, options.maxDistance ?? DEFAULT_MAX_DISTANCE);
    this.distance = pc.math.clamp(options.initialDistance ?? DEFAULT_DISTANCE, this.minDistance, this.maxDistance);
    this.homeX = pc.math.clamp(options.targetX ?? 0, -this.halfWidth, this.halfWidth);
    this.homeZ = pc.math.clamp(options.targetZ ?? 0, -this.halfDepth, this.halfDepth);
    this.target.x = this.homeX;
    this.target.z = this.homeZ;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onCanvasPointerMove);
    canvas.addEventListener('pointerleave', this.onCanvasPointerLeave);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    this.applyTransform();
  }

  update(deltaSeconds: number): void {
    const speed = 12 * deltaSeconds * (this.distance / DEFAULT_DISTANCE);
    let localX = 0;
    let localZ = 0;
    if (this.isPressed('ArrowLeft')) localX -= speed;
    if (this.isPressed('ArrowRight')) localX += speed;
    if (this.isPressed('ArrowUp')) localZ -= speed;
    if (this.isPressed('ArrowDown')) localZ += speed;

    if (this.pointerInsideCanvas && !this.dragging) {
      const bounds = this.battlefieldViewportBounds();
      const edgeSpeed = speed * EDGE_SCROLL_SPEED_MULTIPLIER;
      if (this.pointerX >= bounds.left && this.pointerX <= bounds.left + EDGE_SCROLL_MARGIN_PX) localX -= edgeSpeed;
      else if (this.pointerX <= bounds.right && this.pointerX >= bounds.right - EDGE_SCROLL_MARGIN_PX) localX += edgeSpeed;
      if (this.pointerY >= bounds.top && this.pointerY <= bounds.top + EDGE_SCROLL_MARGIN_PX) localZ -= edgeSpeed;
      else if (this.pointerY <= bounds.bottom && this.pointerY >= bounds.bottom - EDGE_SCROLL_MARGIN_PX) localZ += edgeSpeed;
    }

    if (localX !== 0 || localZ !== 0) this.pan(localX, localZ);
  }

  focusAt(worldXMetres: number, worldZMetres: number): void {
    this.target.x = pc.math.clamp(worldXMetres, -this.halfWidth, this.halfWidth);
    this.target.z = pc.math.clamp(worldZMetres, -this.halfDepth, this.halfDepth);
    this.applyTransform();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onCanvasPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onCanvasPointerLeave);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu', this.preventContextMenu);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Home' && !event.repeat) {
      event.preventDefault();
      this.focusAt(this.homeX, this.homeZ);
      return;
    }
    if (event.code === 'Space') event.preventDefault();
    this.pressedKeys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.distance = pc.math.clamp(this.distance + event.deltaY * 0.018, this.minDistance, this.maxDistance);
    this.applyTransform();
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const alternateLeftDrag = event.button === 0 && (event.altKey || this.isPressed('Space'));
    if (event.button !== 1 && !alternateLeftDrag) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.dragging = true;
    this.pointerInsideCanvas = false;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.canvas.classList.add('camera-pan-active');
    this.canvas.setPointerCapture?.(event.pointerId);
  };

  private readonly onCanvasPointerMove = (event: PointerEvent): void => {
    if (this.dragging) return;
    this.pointerInsideCanvas = true;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
  };

  private readonly onCanvasPointerLeave = (): void => {
    if (!this.dragging) this.pointerInsideCanvas = false;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) {
      const bounds = this.canvas.getBoundingClientRect();
      const insideBounds = event.clientX >= bounds.left
        && event.clientX <= bounds.right
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom;
      this.pointerInsideCanvas = insideBounds && this.pointerHitsBattlefieldSurface(event.clientX, event.clientY);
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const deltaX = event.clientX - this.pointerX;
    const deltaY = event.clientY - this.pointerY;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.pan(-deltaX * 0.03, -deltaY * 0.03);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.dragging) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.dragging = false;
    this.canvas.classList.remove('camera-pan-active');
    if (this.canvas.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture?.(event.pointerId);
  };

  private readonly preventContextMenu = (event: MouseEvent): void => event.preventDefault();

  private isPressed(...keys: string[]): boolean {
    return keys.some((key) => this.pressedKeys.has(key));
  }

  private pointerHitsBattlefieldSurface(clientX: number, clientY: number): boolean {
    const hit = document.elementFromPoint(clientX, clientY);
    return hit === this.canvas || (hit instanceof Element && this.canvas.contains(hit));
  }

  private battlefieldViewportBounds(): { left: number; right: number; top: number; bottom: number } {
    const canvasBounds = this.canvas.getBoundingClientRect();
    let left = canvasBounds.left;
    let right = canvasBounds.right;
    let top = canvasBounds.top;

    const strategyPanel = document.getElementById('strategy-panel');
    if (strategyPanel && strategyPanel.getClientRects().length > 0) {
      const rect = strategyPanel.getBoundingClientRect();
      if (rect.right > left && rect.left < right) left = Math.min(right, rect.right + HUD_EDGE_GAP_PX);
    }

    for (const id of ['world-debug', 'context-inspector', 'elemental-jobs']) {
      const element = document.getElementById(id) ?? document.querySelector(`.${id}`);
      if (!(element instanceof HTMLElement) || element.getClientRects().length === 0) continue;
      const rect = element.getBoundingClientRect();
      if (rect.left < right && rect.right > left) right = Math.max(left, rect.left - HUD_EDGE_GAP_PX);
    }

    const runPanel = document.getElementById('run-panel');
    if (runPanel && runPanel.getClientRects().length > 0) {
      const rect = runPanel.getBoundingClientRect();
      if (rect.bottom > top && rect.top < canvasBounds.bottom) {
        top = Math.min(canvasBounds.bottom, rect.bottom + HUD_EDGE_GAP_PX);
      }
    }

    return {
      left,
      right,
      top,
      bottom: canvasBounds.bottom,
    };
  }

  private pan(localX: number, localZ: number): void {
    const yawRadians = this.yaw * pc.math.DEG_TO_RAD;
    this.target.x += localX * Math.cos(yawRadians) + localZ * Math.sin(yawRadians);
    this.target.z += -localX * Math.sin(yawRadians) + localZ * Math.cos(yawRadians);
    this.target.x = pc.math.clamp(this.target.x, -this.halfWidth, this.halfWidth);
    this.target.z = pc.math.clamp(this.target.z, -this.halfDepth, this.halfDepth);
    this.applyTransform();
  }

  private applyTransform(): void {
    const yawRadians = this.yaw * pc.math.DEG_TO_RAD;
    const pitchRadians = this.pitch * pc.math.DEG_TO_RAD;
    const horizontalDistance = this.distance * Math.cos(pitchRadians);
    this.entity.setPosition(
      this.target.x + Math.sin(yawRadians) * horizontalDistance,
      this.target.y - Math.sin(pitchRadians) * this.distance,
      this.target.z + Math.cos(yawRadians) * horizontalDistance,
    );
    this.entity.lookAt(this.target);
  }
}
