import type { ElementId, TacticalSpellId } from '../simulation/element-types';
import { UNITS } from '../simulation/m03-content';
import type { M04Simulation } from '../simulation/m04-simulation';
import { TACTICAL_SPELLS } from '../simulation/spell-content';

const PLAYER_ID = 0;
const SPELL_ORDER: readonly TacticalSpellId[] = ['FIREBOLT', 'WATER_BURST', 'FREEZE', 'CHAIN_LIGHTNING'];
const KEY_BY_SPELL: Readonly<Record<TacticalSpellId, string>> = {
  FIREBOLT: 'R',
  WATER_BURST: 'Q',
  FREEZE: 'F',
  CHAIN_LIGHTNING: 'L',
};
const SPELL_LABELS: Readonly<Record<TacticalSpellId, string>> = {
  FIREBOLT: 'Firebolt',
  WATER_BURST: 'Water Burst',
  FREEZE: 'Freeze',
  CHAIN_LIGHTNING: 'Chain Lightning',
};

function value(milli: number): string {
  const raw = milli / 1000;
  return Number.isInteger(raw) ? String(raw) : raw.toFixed(1);
}

function elementLabel(element: ElementId): string {
  return `${element[0]}${element.slice(1).toLowerCase()}`;
}

export class ManaSystemHud {
  private elapsed = 0;
  private rendering = false;
  private lastFeedbackKey = '';
  private feedbackSeconds = 0;
  private readonly observer: MutationObserver;

  constructor(
    private readonly strategyElement: HTMLElement,
    private readonly simulation: M04Simulation,
  ) {
    this.observer = new MutationObserver(() => {
      if (!this.rendering) this.render();
    });
    this.observer.observe(strategyElement, { childList: true });
    strategyElement.addEventListener('click', this.onClick, true);
    this.render();
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    this.feedbackSeconds = Math.max(0, this.feedbackSeconds - deltaSeconds);
    if (this.elapsed < 0.1) return;
    this.elapsed = 0;
    this.render();
  }

  destroy(): void {
    this.observer.disconnect();
    this.strategyElement.removeEventListener('click', this.onClick, true);
    this.strategyElement.querySelector('.mana-system-hint')?.remove();
  }

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('button[data-action="train-elementalist-v2"]')
      : null;
    if (!target || target.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const element = target.dataset.element as ElementId | undefined;
    if (!element || !this.simulation.attunements.has(PLAYER_ID, element)) return;
    const producer = this.strategyElement.querySelector<HTMLButtonElement>(
      '.producer-select button.active[data-action="select-producer"]',
    );
    const buildingId = Number(producer?.dataset.value);
    const message = this.strategyElement.querySelector<HTMLElement>('.strategy-message');
    if (!Number.isSafeInteger(buildingId) || buildingId <= 0) {
      if (message) message.textContent = 'Select a completed Arcane Tower before training an Elementalist.';
      return;
    }

    this.simulation.enqueueStrategicCommand({
      targetTick: this.simulation.snapshot().tick + 1,
      playerId: PLAYER_ID,
      type: 'TRAIN',
      buildingId,
      unitType: 'ELEMENTALIST',
      elementalistAlignment: element,
    });
    if (message) message.textContent = `Queued ${elementLabel(element)} Elementalist at Arcane Tower #${buildingId}.`;
  };

  private renderElementalistTrainingControls(attuned: ReadonlySet<ElementId>): void {
    const generic = this.strategyElement.querySelector<HTMLButtonElement>(
      'button[data-action="train"][data-value="ELEMENTALIST"]',
    );
    if (!generic) return;

    const definition = UNITS.ELEMENTALIST;
    const replacements = [...attuned].map((element) => {
      const button = document.createElement('button');
      button.dataset.action = 'train-elementalist-v2';
      button.dataset.element = element;
      button.disabled = generic.disabled;
      button.title = `${elementLabel(element)} alignment is immutable for this Elementalist.`;
      button.innerHTML = `${elementLabel(element)} Elementalist<small>${definition.cost.material}M${definition.cost.mana ? ` · ${definition.cost.mana}A` : ''} · P${definition.population}</small>`;
      return button;
    });
    generic.replaceWith(...replacements);
  }

  private render(): void {
    if (this.rendering) return;
    this.rendering = true;
    try {
      const snapshot = this.simulation.snapshot();
      const mana = snapshot.elementalMana.players[PLAYER_ID];
      const authority = snapshot.elementalAuthority;
      if (!mana) return;
      const manaCell = this.strategyElement.querySelector<HTMLElement>('.resource-strip b:nth-child(2)');
      const resourceKey = this.strategyElement.querySelector<HTMLElement>('.resource-key');
      if (!manaCell || !resourceKey) return;

      manaCell.innerHTML = `${value(mana.currentManaMilli)}/${value(mana.maxManaMilli)} <span>Mana</span>`;
      manaCell.title = 'Shared Mana funds Elementalist Tactical spells, Strategic spells, Arcane buildings, and Mana-cost units.';

      let hint = this.strategyElement.querySelector<HTMLElement>('.mana-system-hint');
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'mana-system-hint';
        resourceKey.insertAdjacentElement('afterend', hint);
      }

      const attuned = new Set(authority.attunements.players[PLAYER_ID]?.unlocked ?? []);
      this.renderElementalistTrainingControls(attuned);
      const playerEntityIds = new Set(snapshot.entities.filter((entity) => entity.playerId === PLAYER_ID && entity.alive).map((entity) => entity.id));
      const aligned = authority.alignedElementalists.filter((entry) => playerEntityIds.has(entry.entityId));
      const cooldownByCasterSpell = new Map(
        authority.spells.tacticalCooldowns.map((cooldown) => [`${cooldown.casterEntityId}:${cooldown.spellId}`, cooldown.readyTick]),
      );

      const spells = SPELL_ORDER.filter((spellId) => attuned.has(TACTICAL_SPELLS[spellId].element)).map((spellId) => {
        const spell = TACTICAL_SPELLS[spellId];
        const casters = aligned.filter((entry) => entry.element === spell.element);
        const remaining = casters.length === 0
          ? null
          : Math.min(...casters.map((caster) => Math.max(0, (cooldownByCasterSpell.get(`${caster.entityId}:${spellId}`) ?? 0) - snapshot.tick)));
        const state = remaining === null
          ? ' · no caster'
          : remaining > 0
            ? ` · ${(remaining / 10).toFixed(1)}s`
            : '';
        return `<span><kbd>${KEY_BY_SPELL[spellId]}</kbd>${SPELL_LABELS[spellId]} ${value(spell.manaCostMilli)}${state}</span>`;
      }).join('');

      const result = authority.lastCastResult;
      const feedbackKey = result ? `${result.tick}:${result.layer}:${result.spellId}:${result.status}` : '';
      if (result && result.status !== 'CAST' && feedbackKey !== this.lastFeedbackKey) {
        this.lastFeedbackKey = feedbackKey;
        this.feedbackSeconds = 2.5;
      }
      const resultLabel = result?.layer === 'TACTICAL'
        ? SPELL_LABELS[result.spellId as TacticalSpellId] ?? result.spellId
        : result?.spellId ?? '';
      const feedback = this.feedbackSeconds > 0 && result
        ? `<strong>${result.status === 'NO_MANA'
          ? `Not enough Mana for ${resultLabel}.`
          : result.status === 'COOLDOWN'
            ? `${resultLabel} is cooling down.`
            : `No valid caster, target, or spell-network path for ${resultLabel}.`}</strong>`
        : '';
      const attunementLabel = [...attuned].map(elementLabel).join(' + ');

      hint.innerHTML = snapshot.elementalMana.enabled
        ? `<small>Attunements: <b>${attunementLabel || 'None'}</b></small><div>${spells || '<span>Train an aligned Elementalist to use Tactical spells.</span>'}</div><small>Train Elementalists with an Attuned alignment. Select aligned Elementalists, hover a target, then use R / Q / F / L. Cooldowns belong to the caster.</small>${feedback}`
        : '<small>Mana economy active. Full spell authority activates in Enemy War / full runs.</small>';
    } finally {
      this.rendering = false;
    }
  }
}
