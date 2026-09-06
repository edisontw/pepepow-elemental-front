import * as pc from 'playcanvas';
import type { UnitRenderBridge } from '../rendering/unit-render-bridge';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { EntitySnapshot, Simulation } from '../simulation/simulation';
import { SelectionState } from './selection-state';

const DRAG_THRESHOLD = 6;

export class UnitControls {
  private readonly selection = new SelectionState();
  private pointerId: number | null = null;
  private startClientX = 0;
  private startClientY = 0;
  private currentClientX = 0;
  private currentClientY = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: pc.CameraComponent,
    private readonly simulation: Simulation,
    private readonly bridge: UnitRenderBridge,
    private readonly selectionBox: HTMLElement,
  ) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
  }

  get selectedCount(): number {
    return this.selection.ids.length;
  }

  get selectedUnits(): readonly EntitySnapshot[] {
    const selected = new Set(this.selection.ids);
    return this.simulation.snapshot().entities.filter((entity) => selected.has(entity.id));
  }

  syncSelection(): void {
    if (this.selection.prune((entityId) => this.bridge.isControllable(entityId))) {
      this.renderSelected();
    }
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 2) {
      event.preventDefault();
      this.enqueueContextOrder(event.clientX, event.clientY);
      return;
    }
    if (event.button !== 0) return;
    this.pointerId = event.pointerId;
    this.startClientX = event.clientX;
    this.startClientY = event.clientY;
    this.currentClientX = event.clientX;
    this.currentClientY = event.clientY;
    this.canvas.setPointerCapture?.(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.currentClientX = event.clientX;
    this.currentClientY = event.clientY;
    if (this.dragDistance() < DRAG_THRESHOLD) return;
    this.renderSelectionBox();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.currentClientX = event.clientX;
    this.currentClientY = event.clientY;
    const start = this.toCanvasCoordinates(this.startClientX, this.startClientY);
    const end = this.toCanvasCoordinates(this.currentClientX, this.currentClientY);
    if (this.dragDistance() < DRAG_THRESHOLD) {
      const entityId = this.bridge.pickSingle(this.camera, end.x, end.y);
      if (entityId !== null && this.bridge.isControllable(entityId)) {
        this.selection.select([entityId], event.shiftKey ? 'TOGGLE' : 'REPLACE');
      } else if (!event.shiftKey) {
        this.selection.select([], 'REPLACE');
      }
    } else {
      this.selection.select(this.bridge.pickBox(
        this.camera,
        Math.min(start.x, end.x),
        Math.min(start.y, end.y),
        Math.max(start.x, end.x),
        Math.max(start.y, end.y),
      ), event.shiftKey ? 'ADD' : 'REPLACE');
    }
    this.renderSelected();
    this.pointerId = null;
    this.selectionBox.hidden = true;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const controlGroupSlot = this.controlGroupSlot(event.code);
    if (controlGroupSlot !== null && !event.repeat) {
      event.preventDefault();
      if (event.ctrlKey) {
        this.selection.assignControlGroup(controlGroupSlot);
      } else if (!event.altKey && !event.metaKey && this.selection.recallControlGroup(
        controlGroupSlot,
        (entityId) => this.bridge.isControllable(entityId),
      )) {
        this.renderSelected();
      }
      return;
    }

    if ((event.code === 'KeyF' || event.code === 'KeyH' || event.code === 'KeyR' || event.code === 'KeyB') && !event.repeat) {
      const targetsForest = event.code === 'KeyB';
      const targetZone = this.simulation.arena.zones.find((zone) => (
        targetsForest ? zone.kind === 'FOREST' : zone.kind === 'FREEZABLE_CROSSING'
      ));
      if (!targetZone) return;

      const effectId = event.code === 'KeyF'
        ? 'FREEZE'
        : event.code === 'KeyH'
          ? 'HEAT'
          : 'FIRE';
      const repeatCount = event.code === 'KeyB' ? 1 : 2;
      const targetTick = this.simulation.snapshot().tick + 1;

      for (let index = 0; index < repeatCount; index += 1) {
        this.simulation.enqueueCommand({
          targetTick,
          playerId: 0,
          type: 'CAST',
          effectId,
          targetX: targetZone.centerX,
          targetZ: targetZone.centerZ,
          radius: 5 * WORLD_UNITS_PER_METER,
        });
      }
      return;
    }

    if (event.code === 'KeyL' && !event.repeat) {
      const target = this.simulation.snapshot().entities.find((entity) => entity.alive && entity.playerId !== 0);
      if (!target) return;
      this.simulation.enqueueCommand({
        targetTick: this.simulation.snapshot().tick + 1,
        playerId: 0,
        type: 'CAST',
        effectId: 'CHAIN_LIGHTNING',
        targetEntityId: target.id,
      });
      return;
    }

    if (event.code !== 'KeyX' || event.repeat || this.selection.ids.length === 0) return;
    this.simulation.enqueueCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: 0,
      type: 'STOP',
      entityIds: this.selection.ids,
    });
  };

  private renderSelected(): void {
    this.bridge.setSelected(new Set(this.selection.ids));
  }

  private readonly onContextMenu = (event: MouseEvent): void => { event.preventDefault(); };

  private enqueueContextOrder(clientX: number, clientY: number): void {
    if (this.selection.ids.length === 0) return;
    const screen = this.toCanvasCoordinates(clientX, clientY);
    const picked = this.bridge.pickSingle(this.camera, screen.x, screen.y);
    if (picked !== null && this.bridge.isEnemy(picked)) {
      this.simulation.enqueueCommand({
        targetTick: this.simulation.snapshot().tick + 1,
        playerId: 0,
        type: 'ATTACK',
        entityIds: this.selection.ids,
        targetEntityId: picked,
      });
      return;
    }
    const near = this.camera.screenToWorld(screen.x, screen.y, this.camera.nearClip);
    const far = this.camera.screenToWorld(screen.x, screen.y, this.camera.farClip);
    const verticalDelta = far.y - near.y;
    if (Math.abs(verticalDelta) < 0.000_001) return;
    const distance = -near.y / verticalDelta;
    if (distance < 0 || distance > 1) return;
    const worldX = near.x + (far.x - near.x) * distance;
    const worldZ = near.z + (far.z - near.z) * distance;
    this.simulation.enqueueCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: 0,
      type: 'MOVE',
      entityIds: this.selection.ids,
      targetX: Math.round(worldX * WORLD_UNITS_PER_METER),
      targetZ: Math.round(worldZ * WORLD_UNITS_PER_METER),
    });
  }

  private toCanvasCoordinates(clientX: number, clientY: number): { x: number; y: number } {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - bounds.left) / bounds.width) * this.canvas.width,
      y: ((clientY - bounds.top) / bounds.height) * this.canvas.height,
    };
  }

  private dragDistance(): number {
    return Math.hypot(
      this.currentClientX - this.startClientX,
      this.currentClientY - this.startClientY,
    );
  }

  private renderSelectionBox(): void {
    this.selectionBox.hidden = false;
    this.selectionBox.style.left = `${Math.min(this.startClientX, this.currentClientX)}px`;
    this.selectionBox.style.top = `${Math.min(this.startClientY, this.currentClientY)}px`;
    this.selectionBox.style.width = `${Math.abs(this.currentClientX - this.startClientX)}px`;
    this.selectionBox.style.height = `${Math.abs(this.currentClientY - this.startClientY)}px`;
  }

  private controlGroupSlot(code: string): number | null {
    const match = /^Digit([1-9])$/.exec(code);
    return match?.[1] ? Number(match[1]) : null;
  }
}
