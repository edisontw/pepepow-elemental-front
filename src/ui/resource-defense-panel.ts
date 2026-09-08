import { RESOURCE_DEFENSE_UPGRADE } from '../simulation/m03-content';
import type { M03Simulation } from '../simulation/m03-simulation';

const PLAYER_ID = 0;

function label(value: string): string {
  return value.split('_').map((word) => word[0] + word.slice(1).toLowerCase()).join(' ');
}

export class ResourceDefensePanel {
  private elapsed = 0;
  private rendering = false;
  private readonly observer: MutationObserver;

  constructor(
    private readonly strategyElement: HTMLElement,
    private readonly simulation: M03Simulation,
  ) {
    this.observer = new MutationObserver(() => {
      if (!this.rendering) this.render();
    });
    this.observer.observe(strategyElement, { childList: true });
    strategyElement.addEventListener('click', this.onClick);
    this.render();
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    if (this.elapsed < 0.2) return;
    this.elapsed = 0;
    this.render();
  }

  destroy(): void {
    this.observer.disconnect();
    this.strategyElement.removeEventListener('click', this.onClick);
    this.strategyElement.querySelector('.resource-defense-section')?.remove();
  }

  private readonly onClick = (event: MouseEvent): void => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('button[data-resource-action="fortify"]')
      : null;
    if (!button || button.disabled) return;
    const buildingId = Number(button.dataset.buildingId);
    if (!Number.isSafeInteger(buildingId) || buildingId <= 0) return;
    this.simulation.enqueueStrategicCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: PLAYER_ID,
      type: 'UPGRADE_RESOURCE_DEFENSE',
      buildingId,
    });
    this.render();
  };

  private render(): void {
    if (this.rendering) return;
    this.rendering = true;
    try {
      const buildSection = this.strategyElement.querySelector<HTMLElement>('.strategy-section');
      if (!buildSection) return;
      let section = this.strategyElement.querySelector<HTMLElement>('.resource-defense-section');
      if (!section) {
        section = document.createElement('div');
        section.className = 'strategy-section resource-defense-section';
        buildSection.insertAdjacentElement('afterend', section);
      }

      const snapshot = this.simulation.strategy.snapshot();
      const stock = snapshot.resources[PLAYER_ID];
      const sites = snapshot.buildings.filter((building) => (
        building.playerId === PLAYER_ID
        && building.completed
        && (building.type === 'EXTRACTOR' || building.type === 'MANA_WELL')
      ));
      if (!stock || sites.length === 0) {
        section.innerHTML = '<strong>Resource Defense</strong><small>Completed Extractors and Mana Wells can be attacked. Build one to unlock a small Guard Tower upgrade.</small>';
        return;
      }

      const cost = RESOURCE_DEFENSE_UPGRADE.cost;
      const rows = sites.map((building) => {
        const supplied = snapshot.suppliedRegions[PLAYER_ID]?.includes(building.regionId) === true;
        const affordable = stock.materialMilli >= cost.material * 1000 && stock.manaMilli >= cost.mana * 1000;
        const canFortify = !building.destroyed && building.resourceDefenseLevel === 0 && supplied && affordable;
        const status = building.destroyed
          ? 'Destroyed · rebuild on resource node'
          : building.resourceDefenseLevel > 0
            ? `Guard Tower · ${building.currentHealth}/${building.maxHealth} HP`
            : `${building.currentHealth}/${building.maxHealth} HP`;
        const action = building.destroyed
          ? ''
          : building.resourceDefenseLevel > 0
            ? '<em>Fortified</em>'
            : `<button data-resource-action="fortify" data-building-id="${building.id}" ${canFortify ? '' : 'disabled'}>Fortify · ${cost.material} Material + ${cost.mana} Mana</button>`;
        return `<div class="resource-defense-row"><span><b>${label(building.type)} #${building.id}</b><small>${status}</small></span>${action}</div>`;
      }).join('');

      section.innerHTML = `<strong>Resource Defense</strong><small>Harvesters are enemy targets. Fortification adds +${RESOURCE_DEFENSE_UPGRADE.bonusHealth} HP and a short-range automatic Guard Tower.</small><div class="resource-defense-list">${rows}</div>`;
    } finally {
      this.rendering = false;
    }
  }
}
