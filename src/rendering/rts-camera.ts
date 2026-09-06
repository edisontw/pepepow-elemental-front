import * as pc from 'playcanvas';

const MIN_DISTANCE = 12;
const MAX_DISTANCE = 46;

export class RtsCamera {
  private readonly target = new pc.Vec3(0, 0, 0);
  private readonly pressedKeys = new Set<string>();
  private distance = 28;
  private yaw = 45;
  private pitch = -48;
  private dragging = false;
  private pointerX = 0;
  private pointerY = 0;

  constructor(
    private readonly entity: pc.Entity,
    private readonly canvas: HTMLCanvasElement,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    this.applyTransform();
  }

  update(deltaSeconds: number): void {
    const speed = 12 * deltaSeconds * (this.distance / 28);
    let localX = 0;
    let localZ = 0;
    if (this.isPressed('KeyA', 'ArrowLeft')) localX -= speed;
    if (this.isPressed('KeyD', 'ArrowRight')) localX += speed;
    if (this.isPressed('KeyW', 'ArrowUp')) localZ -= speed;
    if (this.isPressed('KeyS', 'ArrowDown')) localZ += speed;
    if (localX !== 0 || localZ !== 0) this.pan(localX, localZ);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu', this.preventContextMenu);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.pressedKeys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.distance = pc.math.clamp(this.distance + event.deltaY * 0.018, MIN_DISTANCE, MAX_DISTANCE);
    this.applyTransform();
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 1 && event.button !== 2) return;
    this.dragging = true;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.canvas.setPointerCapture?.(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    const deltaX = event.clientX - this.pointerX;
    const deltaY = event.clientY - this.pointerY;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.pan(-deltaX * 0.025, -deltaY * 0.025);
  };

  private readonly onPointerUp = (): void => {
    this.dragging = false;
  };

  private readonly preventContextMenu = (event: MouseEvent): void => event.preventDefault();

  private isPressed(...keys: string[]): boolean {
    return keys.some((key) => this.pressedKeys.has(key));
  }

  private pan(localX: number, localZ: number): void {
    const yawRadians = this.yaw * pc.math.DEG_TO_RAD;
    this.target.x += localX * Math.cos(yawRadians) + localZ * Math.sin(yawRadians);
    this.target.z += -localX * Math.sin(yawRadians) + localZ * Math.cos(yawRadians);
    this.target.x = pc.math.clamp(this.target.x, -24, 24);
    this.target.z = pc.math.clamp(this.target.z, -24, 24);
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
