import * as pc from 'playcanvas';
import type { UnitRenderBridge } from '../rendering/unit-render-bridge';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { TacticalSpellId } from '../simulation/element-types';
import type { FormationId } from '../simulation/formation';
import type { M04Simulation } from '../simulation/m04-simulation';
import type { EntitySnapshot } from '../simulation/simulation';
import { SelectionState } from './selection-state';

const DRAG_THRESHOLD = 6;
const DOUBLE_CLICK_MS = 350;
const UNIT_PICK_RADIUS = 54;

export class UnitControls {
  private readonly selection = new SelectionState();
  private pointerId: number | null = null;
  private startClientX = 0;
  private startClientY = 0;
  private currentClientX = 0;
  private currentClientY = 0;
  private hoverClientX: number | null = null;
  private hoverClientY: number | null = null;
  private formation: FormationId = 'LINE';
  private lastClickEntityId: number | null = null;
  private lastClickTimeMs = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: pc.CameraComponent,
    private readonly simulation: M04Simulation,
    private readonly bridge: UnitRenderBridge,
    private readonly selectionBox: HTMLElement,
  ) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    this.renderFormationMode();
  }

  get selectedCount(): number {
    return this.selection.ids.length;
  }

  get selectedUnits(): readonly EntitySnapshot[] {
    const selected = new Set(this.selection.ids);
    return this.simulation.snapshot().entities.filter((entity) => selected.has(entity.id));
  }

  get activeFormation(): FormationId {
    return this.formation;
  }

  moveSelectionTo(targetX: number, targetZ: number): void {
    if (this.selection.ids.length === 0) return;
    this.simulation.enqueueCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: 0,
      type: 'MOVE',
      entityIds: this.selection.ids,
      targetX,
      targetZ,
      formation: this.formation,
    });
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
    this.hoverClientX = event.clientX;
    this.hoverClientY = event.clientY;
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
    const bounds = this.canvas.getBoundingClientRect();
    if (
      event.clientX >= bounds.left
      && event.clientX <= bounds.right
      && event.clientY >= bounds.top
      && event.clientY <= bounds.bottom
    ) {
      this.hoverClientX = event.clientX;
      this.hoverClientY = event.clientY;
    }
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
      const entityId = this.bridge.pickSingle(this.camera, end.x, end.y, UNIT_PICK_RADIUS);
      if (entityId !== null && this.bridge.isControllable(entityId)) {
        const doubleClick = entityId === this.lastClickEntityId && event.timeStamp - this.lastClickTimeMs <= DOUBLE_CLICK_MS;
        if (doubleClick) {
          this.selectSameTypeOnScreen(entityId, event.shiftKey);
          this.lastClickEntityId = null;
          this.lastClickTimeMs = Number.NEGATIVE_INFINITY;
        } else {
          this.selection.select([entityId], event.shiftKey ? 'TOGGLE' : 'REPLACE');
          this.lastClickEntityId = entityId;
          this.lastClickTimeMs = event.timeStamp;
        }
      } else if (!event.shiftKey) {
        this.selection.select([], 'REPLACE');
        this.lastClickEntityId = null;
        this.lastClickTimeMs = Number.NEGATIVE_INFINITY;
      }
    } else {
      this.selection.select(this.bridge.pickBox(
        this.camera,
        Math.min(start.x, end.x), Math.min(start.y, end.y),
        Math.max(start.x, end.x), Math.max(start.y, end.y),
      ), event.shiftKey ? 'ADD' : 'REPLACE');
      this.lastClickEntityId = null;
      this.lastClickTimeMs = Number.NEGATIVE_INFINITY;
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

    if (!event.repeat && event.code === 'KeyZ') {
      this.setFormation('LINE');
      return;
    }
    if (!event.repeat && event.code === 'KeyC') {
      this.setFormation('COLUMN');
      return;
    }
    if (!event.repeat && event.code === 'KeyV') {
      this.setFormation('SPREAD');
      return;
    }

    if (!event.repeat && event.code === 'KeyR') {
      this.castTacticalAtHover('FIREBOLT');
      return;
    }
    if (!event.repeat && event.code === 'KeyQ') {
      this.castTacticalAtHover('WATER_BURST');
      return;
    }
    if (!event.repeat && event.code === 'KeyF') {
      this.castTacticalAtHover('FREEZE');
      return;
    }

    if (event.code === 'KeyL' && !event.repeat) {
      if (this.hoverClientX === null || this.hoverClientY === null) return;
      const screen = this.toCanvasCoordinates(this.hoverClientX, this.hoverClientY);
      const targetId = this.bridge.pickSingle(this.camera, screen.x, screen.y, UNIT_PICK_RADIUS);
      if (targetId === null || !this.bridge.isEnemy(targetId)) return;
      this.simulation.enqueueCommand({
        targetTick: this.simulation.snapshot().tick + 1,
        playerId: 0,
        type: 'CAST_TACTICAL',
        spellId: 'CHAIN_LIGHTNING',
        candidateCasterIds: this.selection.ids,
        target: { kind: 'ENTITY', entityId: targetId },
      });
      return;
    }

    if ((event.code !== 'KeyX' && event.code !== 'KeyS') || event.repeat || this.selection.ids.length === 0) return;
    this.simulation.enqueueCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: 0,
      type: 'STOP',
      entityIds: this.selection.ids,
    });
  };

  private setFormation(formation: FormationId): void {
    this.formation = formation;
    this.renderFormationMode();
  }

  private renderFormationMode(): void {
    const element = document.getElementById('formation-mode');
    if (!element) return;
    const label = this.formation === 'LINE' ? 'Line' : this.formation === 'COLUMN' ? 'Column' : 'Spread';
    element.textContent = `Formation: ${label}`;
    element.dataset.formation = this.formation;
  }

  private selectSameTypeOnScreen(entityId: number, add: boolean): void {
    const snapshot = this.simulation.snapshot();
    const clicked = snapshot.entities.find((entity) => entity.id === entityId && entity.playerId === 0 && entity.alive);
    if (!clicked) return;
    const onScreen = new Set(this.bridge.pickBox(this.camera, 0, 0, this.canvas.width, this.canvas.height));
    const sameType = snapshot.entities
      .filter((entity) => entity.playerId === 0 && entity.alive && entity.archetype === clicked.archetype && onScreen.has(entity.id))
      .map((entity) => entity.id);
    this.selection.select(sameType, add ? 'ADD' : 'REPLACE');
  }

  private castTacticalAtHover(spellId: Exclude<TacticalSpellId, 'CHAIN_LIGHTNING'>): void {
    const target = this.hoverWorldPoint();
    if (!target) return;
    this.simulation.enqueueCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: 0,
      type: 'CAST_TACTICAL',
      spellId,
      candidateCasterIds: this.selection.ids,
      target: { kind: 'POINT', x: target.x, z: target.z },
    });
  }

  private renderSelected(): void {
    this.bridge.setSelected(new Set(this.selection.ids));
  }

  private readonly onContextMenu = (event: MouseEvent): void => { event.preventDefault(); };

  private enqueueContextOrder(clientX: number, clientY: number): void {
    if (this.selection.ids.length === 0) return;
    const screen = this.toCanvasCoordinates(clientX, clientY);
    const picked = this.bridge.pickSingle(this.camera, screen.x, screen.y, UNIT_PICK_RADIUS);
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
    const target = this.worldPointFromClient(clientX, clientY);
    if (!target) return;
    this.moveSelectionTo(target.x, target.z);
  }

  private hoverWorldPoint(): { x: number; z: number } | null {
    if (this.hoverClientX === null || this.hoverClientY === null) return null;
    return this.worldPointFromClient(this.hoverClientX, this.hoverClientY);
  }

  private worldPointFromClient(clientX: number, clientY: number): { x: number; z: number } | null {
    const screen = this.toCanvasCoordinates(clientX, clientY);
    const near = this.camera.screenToWorld(screen.x, screen.y, this.camera.nearClip);
    const far = this.camera.screenToWorld(screen.x, screen.y, this.camera.farClip);
    const verticalDelta = far.y - near.y;
    if (Math.abs(verticalDelta) < 0.000_001) return null;
    const distance = -near.y / verticalDelta;
    if (distance < 0 || distance > 1) return null;
    const worldX = near.x + (far.x - near.x) * distance;
    const worldZ = near.z + (far.z - near.z) * distance;
    return {
      x: Math.round(worldX * WORLD_UNITS_PER_METER),
      z: Math.round(worldZ * WORLD_UNITS_PER_METER),
    };
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
    const match = /^Digit([0-9])$/.exec(code);
    return match?.[1] !== undefined ? Number(match[1]) : null;
  }
}
