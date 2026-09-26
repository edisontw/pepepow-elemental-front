import { M06Simulation, type M06SquadCommand } from '../simulation/m06-simulation';
import type { FrontOrder, SquadSnapshot } from '../simulation/squad-state';

const PLAYER_ID = 0;

export class SquadPanel {
  private elapsed = 0;
  private activeSquadId: number | null = null;
  private armedOrder: Extract<FrontOrder, 'ADVANCE' | 'GUARD'> | null = null;
  private message = 'Select a squad, then assign its front objective.';

  constructor(
    private readonly element: HTMLElement,
    private readonly simulation: M06Simulation,
    private readonly battlefieldCanvas: HTMLCanvasElement,
    private readonly screenToSimulationPosition: (clientX: number, clientY: number) => { x: number; z: number } | null,
    private readonly selectUnits: (entityIds: readonly number[], focusCamera?: boolean) => boolean,
  ) {
    this.element.addEventListener('click', this.onClick);
    this.battlefieldCanvas.addEventListener('pointerdown', this.onBattlefieldPointerDown, true);
    window.addEventListener('keydown', this.onKeyDown);
    this.render();
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    if (this.elapsed < 0.12) return;
    this.elapsed = 0;
    this.render();
  }

  destroy(): void {
    this.element.removeEventListener('click', this.onClick);
    this.battlefieldCanvas.removeEventListener('pointerdown', this.onBattlefieldPointerDown, true);
    window.removeEventListener('keydown', this.onKeyDown);
    this.setArmedOrder(null);
  }

  private playerSquads(): readonly SquadSnapshot[] {
    return this.simulation.snapshot().squads.squads.filter((squad) => squad.playerId === PLAYER_ID);
  }

  private activeSquad(): SquadSnapshot | null {
    const squads = this.playerSquads();
    if (this.activeSquadId === null || !squads.some((squad) => squad.id === this.activeSquadId)) {
      this.activeSquadId = squads[0]?.id ?? null;
    }
    return squads.find((squad) => squad.id === this.activeSquadId) ?? null;
  }

  private readonly onClick = (event: Event): void => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const squadId = Number(button.dataset.squadId ?? this.activeSquadId);
    if (!Number.isSafeInteger(squadId) || squadId <= 0) return;
    this.activeSquadId = squadId;
    const squad = this.activeSquad();
    if (!squad) return;

    if (action === 'select-squad') {
      this.selectUnits(squad.memberEntityIds, true);
      this.message = `Squad ${squad.id} selected.`;
    } else if (action === 'advance') {
      this.setArmedOrder('ADVANCE');
    } else if (action === 'guard') {
      this.setArmedOrder('GUARD');
    } else if (action === 'regroup') {
      this.setArmedOrder(null);
      this.enqueueOrder({ order: 'REGROUP', squadId: squad.id });
      this.message = `Squad ${squad.id}: Regroup ordered.`;
    }
    this.render();
  };

  private readonly onBattlefieldPointerDown = (event: PointerEvent): void => {
    if (this.armedOrder === null || event.button !== 0) return;
    const squad = this.activeSquad();
    if (!squad) return;
    const target = this.screenToSimulationPosition(event.clientX, event.clientY);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const order = this.armedOrder;
    this.enqueueOrder({ order, squadId: squad.id, targetX: target.x, targetZ: target.z });
    this.message = `Squad ${squad.id}: ${this.label(order)} objective assigned.`;
    this.setArmedOrder(null);
    this.render();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape' || this.armedOrder === null) return;
    this.setArmedOrder(null);
    this.message = 'Front Order targeting cancelled.';
    this.render();
  };

  private enqueueOrder(order: {
    order: FrontOrder;
    squadId: number;
    targetX?: number;
    targetZ?: number;
  }): void {
    const command: M06SquadCommand = {
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: PLAYER_ID,
      type: 'SET_FRONT_ORDER',
      squadId: order.squadId,
      order: order.order,
      ...(order.order === 'REGROUP' ? {} : { targetX: order.targetX, targetZ: order.targetZ }),
    };
    this.simulation.enqueueSquadOrder(command);
  }

  private setArmedOrder(order: Extract<FrontOrder, 'ADVANCE' | 'GUARD'> | null): void {
    this.armedOrder = order;
    this.battlefieldCanvas.classList.toggle('front-order-targeting', order !== null);
    if (order !== null) this.message = `${this.label(order)}: click a battlefield destination · Esc cancel.`;
  }

  private label(order: FrontOrder): string {
    return order.charAt(0) + order.slice(1).toLowerCase();
  }

  private orderText(squad: SquadSnapshot): string {
    if (squad.currentOrder === null) return 'No Front Order';
    if (squad.currentOrder === 'REGROUP') return `Regroup · ${squad.regroupState.toLowerCase()}`;
    return `${this.label(squad.currentOrder)} · ${Math.round((squad.targetX ?? 0) / 1000)}, ${Math.round((squad.targetZ ?? 0) / 1000)} m`;
  }

  private render(): void {
    const squads = this.playerSquads();
    const active = this.activeSquad();
    this.element.innerHTML = `
      <div class="squad-title">COMMAND MODE · P5-A1</div>
      <div class="squad-list">
        ${squads.map((squad) => {
          const alive = squad.memberEntityIds.filter((id) => this.simulation.entities.hasUnit(id)).length;
          return `<button data-action="select-squad" data-squad-id="${squad.id}" aria-pressed="${squad.id === active?.id}">
            <strong>Squad ${squad.id}</strong><span>${alive}/${squad.memberEntityIds.length}</span><small>${this.orderText(squad)}</small>
          </button>`;
        }).join('')}
      </div>
      <div class="squad-orders">
        <button data-action="advance" ${active ? '' : 'disabled'}>Advance</button>
        <button data-action="guard" ${active ? '' : 'disabled'}>Guard</button>
        <button data-action="regroup" ${active ? '' : 'disabled'}>Regroup</button>
      </div>
      <small class="squad-message">${this.message}</small>
    `;
  }
}
