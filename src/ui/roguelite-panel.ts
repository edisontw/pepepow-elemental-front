import { M04Simulation } from '../simulation/m04-simulation';
import { UPGRADES_BY_ID, WORLD_EVENTS } from '../simulation/m04-content';

const PLAYER_ID = 0;

function label(value: string): string {
  return value.split('_').map((word) => word[0] + word.slice(1).toLowerCase()).join(' ');
}

function eventName(eventId: string): string {
  return WORLD_EVENTS.find((event) => event.id === eventId)?.name ?? eventId;
}

export class RoguelitePanel {
  private elapsed = 0;
  private message = 'Capture a Shrine POI, then open it to choose one of three upgrades.';
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
    this.message = `Queued Shrine activation: ${shrineId}.`;
  }

  private chooseUpgrade(choiceIndex: number): void {
    const open = this.simulation.roguelite.snapshot().players[PLAYER_ID]?.openShrine;
    if (!open || !Number.isSafeInteger(choiceIndex)) return;
    const upgradeId = open.choiceIds[choiceIndex];
    this.simulation.enqueueRogueliteCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: PLAYER_ID,
      type: 'CHOOSE_SHRINE_UPGRADE',
      shrineId: open.shrineId,
      choiceIndex,
    });
    this.message = `Queued ${upgradeId ? UPGRADES_BY_ID[upgradeId]?.name ?? upgradeId : 'upgrade'} selection.`;
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
    const shrineRegions = shrines.map((shrine) => {
      const region = `R${shrine.regionId + 1}`;
      if (resolved.has(shrine.id)) return `${region} resolved`;
      if (strategic.poiOwners[shrine.id] === PLAYER_ID) return `${region} captured`;
      return region;
    }).join(' · ');

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

    const acquired = player.acquiredUpgradeIds.length === 0
      ? '<span class="roguelite-empty">No upgrades acquired yet.</span>'
      : player.acquiredUpgradeIds.map((upgradeId) => `<span class="upgrade-chip">${UPGRADES_BY_ID[upgradeId]?.name ?? upgradeId}</span>`).join('');

    const activeEvent = roguelite.activeWorldEvent
      ? `${eventName(roguelite.activeWorldEvent.id)} · ${Math.max(0, roguelite.activeWorldEvent.endTick - this.simulation.snapshot().tick)} ticks left`
      : 'None';
    const nextEvent = roguelite.nextWorldEvent
      ? `${eventName(roguelite.nextWorldEvent.id)} @ tick ${roguelite.nextWorldEvent.startTick}`
      : 'None scheduled';

    this.element.innerHTML = `
      <div class="roguelite-title">M04 ROGUELITE LAYER</div>
      <div class="roguelite-meta">
        <b>${(player.maxManaMilli / 1000).toFixed(0)} <span>Max Mana</span></b>
        <b>${player.acquiredUpgradeIds.length} <span>Upgrades</span></b>
        <b>${player.resolvedShrineIds.length}/${shrines.length} <span>Shrines</span></b>
      </div>
      <div class="roguelite-line">Shrine regions: ${shrineRegions || 'None'} · use numbered territory map</div>
      <div class="roguelite-line">Build: ${player.synergies.length > 0 ? player.synergies.map(label).join(' · ') : 'No detected synergy yet'}</div>
      <div class="roguelite-line">World event: ${activeEvent}</div>
      <div class="roguelite-line">Next event: ${nextEvent}</div>
      ${player.openShrine ? `
        <div class="roguelite-section"><strong>Choose one — ${player.openShrine.shrineId}</strong><div class="upgrade-grid">${choices}</div></div>
      ` : `
        <div class="roguelite-section"><strong>Shrine</strong><button class="shrine-open" data-roguelite-action="activate-shrine" data-shrine-id="${available?.id ?? ''}" ${available ? '' : 'disabled'}>
          ${available ? `Open ${available.id}` : captured.length === 0 ? 'Capture a Shrine POI first' : 'No captured unresolved Shrine'}
        </button></div>
      `}
      <div class="roguelite-section"><strong>Acquired</strong><div class="upgrade-chips">${acquired}</div></div>
      <div class="roguelite-message">${this.message}</div>
    `;
  }
}
