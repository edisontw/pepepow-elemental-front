import { M04Simulation } from '../simulation/m04-simulation';
import { UPGRADES_BY_ID } from '../simulation/m04-content';

const PLAYER_ID = 0;

export class RoguelitePanel {
  private elapsed = 0;
  private pointerInside = false;

  constructor(
    private readonly element: HTMLElement,
    private readonly simulation: M04Simulation,
  ) {
    element.addEventListener('click', this.onClick);
    element.addEventListener('pointerenter', this.onPointerEnter);
    element.addEventListener('pointerleave', this.onPointerLeave);
    this.render();
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    if (this.elapsed < 0.2) return;
    this.elapsed = 0;
    if (this.pointerInside) return;
    this.render();
  }

  destroy(): void {
    this.element.removeEventListener('click', this.onClick);
    this.element.removeEventListener('pointerenter', this.onPointerEnter);
    this.element.removeEventListener('pointerleave', this.onPointerLeave);
  }

  private readonly onPointerEnter = (): void => {
    this.pointerInside = true;
  };

  private readonly onPointerLeave = (): void => {
    this.pointerInside = false;
    this.elapsed = 0;
    this.render();
  };

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-roguelite-action]') : null;
    if (!target || target.disabled) return;
    const action = target.dataset.rogueliteAction;
    if (action === 'activate-shrine') this.activateShrine(target.dataset.shrineId ?? '');
    if (action === 'choose-upgrade') this.chooseUpgrade(Number(target.dataset.choiceIndex));
    this.render();
  };

  private activateShrine(shrineId: string): void {
    if (shrineId === '') return;
    this.simulation.enqueueRogueliteCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: PLAYER_ID,
      type: 'ACTIVATE_SHRINE',
      shrineId,
    });
  }

  private chooseUpgrade(choiceIndex: number): void {
    const open = this.simulation.roguelite.snapshot().players[PLAYER_ID]?.openShrine;
    if (!open || !Number.isSafeInteger(choiceIndex)) return;
    this.simulation.enqueueRogueliteCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: PLAYER_ID,
      type: 'CHOOSE_SHRINE_UPGRADE',
      shrineId: open.shrineId,
      choiceIndex,
    });
  }

  private render(): void {
    const roguelite = this.simulation.roguelite.snapshot();
    const player = roguelite.players[PLAYER_ID] ?? {
      acquiredUpgradeIds: [],
      resolvedShrineIds: [],
      openShrine: null,
      maxManaMilli: 250_000,
      synergies: [],
      tagCounts: { FIRE: 0, WATER: 0, ICE: 0, LIGHTNING: 0, MIXED: 0 },
    };
    const strategic = this.simulation.strategy.snapshot();
    const shrines = this.simulation.generatedWorld.pois.filter((poi) => poi.type === 'SHRINE');
    const captured = shrines.filter((shrine) => strategic.poiOwners[shrine.id] === PLAYER_ID);
    const resolved = new Set(player.resolvedShrineIds);
    const available = captured.find((shrine) => !resolved.has(shrine.id) && player.openShrine?.shrineId !== shrine.id);
    const choices = player.openShrine?.choiceIds.map((upgradeId, index) => {
      const upgrade = UPGRADES_BY_ID[upgradeId];
      if (!upgrade) return '';
      return `
        <button class="upgrade-choice" data-roguelite-action="choose-upgrade" data-choice-index="${index}">
          <strong>${upgrade.name}</strong>
          <span>${upgrade.tags.join(' / ')}</span>
          <small>${upgrade.description}</small>
        </button>
      `;
    }).join('') ?? '';

    this.element.classList.toggle('choice-open', player.openShrine !== null);
    this.element.innerHTML = `
      <div class="roguelite-head">
        <div class="roguelite-title">PROGRESSION</div>
        <div class="roguelite-meta">
          <b>${(player.maxManaMilli / 1000).toFixed(0)} <span>Mana</span></b>
          <b>${player.acquiredUpgradeIds.length} <span>Upgrades</span></b>
          <b>${player.resolvedShrineIds.length}/${shrines.length} <span>Shrines</span></b>
        </div>
      </div>
      ${player.openShrine ? `
        <div class="roguelite-section roguelite-choice-section">
          <strong>Choose one</strong>
          <div class="upgrade-grid">${choices}</div>
        </div>
      ` : `
        <button class="shrine-open" data-roguelite-action="activate-shrine" data-shrine-id="${available?.id ?? ''}" ${available ? '' : 'disabled'}>
          ${available ? 'Open captured Shrine' : 'No Shrine available'}
        </button>
      `}
    `;
  }
}
