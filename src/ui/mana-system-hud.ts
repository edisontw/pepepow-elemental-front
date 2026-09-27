import type { ElementId, TacticalSpellId } from '../simulation/element-types';
import { UNITS } from '../simulation/m03-content';
import type { M04Simulation } from '../simulation/m04-simulation';
import { TACTICAL_SPELLS } from '../simulation/spell-content';
import { tacticalSpellReadiness } from '../input/tactical-caster-candidates';

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
    private readonly tacticalElement: HTMLElement,
    private readonly tacticalHint: HTMLElement,
    private readonly simulation: M04Simulation,
    private readonly requestTacticalSpell: (spellId: TacticalSpellId) => void,
  ) {
    this.observer = new MutationObserver(() => {
      if (!this.rendering) this.render();
    });
    this.observer.observe(strategyElement, { childList: true });
    strategyElement.addEventListener('click', this.onClick, true);
    tacticalElement.addEventListener('click', this.onTacticalClick);
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
    this.tacticalElement.removeEventListener('click', this.onTacticalClick);
    this.strategyElement.querySelector('.mana-system-hint')?.remove();
  }

  private readonly onTacticalClick = (event: MouseEvent): void => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('button[data-tactical-spell]')
      : null;
    if (!button || button.disabled) return;
    const spellId = button.dataset.tacticalSpell as TacticalSpellId | undefined;
    if (!spellId || !TACTICAL_SPELLS[spellId]) return;
    event.preventDefault();
    this.requestTacticalSpell(spellId);
    const spell = TACTICAL_SPELLS[spellId];
    this.tacticalHint.textContent = spell.targetMode === 'HOSTILE_ENTITY'
      ? `${SPELL_LABELS[spellId]} armed · click a visible enemy · Esc cancel.`
      : `${SPELL_LABELS[spellId]} armed · click a visible battlefield point · Esc cancel.`;
  };

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
      const spells = SPELL_ORDER.filter((spellId) => attuned.has(TACTICAL_SPELLS[spellId].element)).map((spellId) => {
        const spell = TACTICAL_SPELLS[spellId];
        const readiness = tacticalSpellReadiness(snapshot, PLAYER_ID, spellId);
        const remaining = readiness.cooldownTicks;
        const available = readiness.alignedCasterCount > 0
          && readiness.readyCasterCount > 0
          && readiness.enoughMana;
        const state = readiness.alignedCasterCount === 0
          ? 'No caster'
          : readiness.readyCasterCount === 0 && remaining !== null
            ? `${(remaining / 10).toFixed(1)}s`
            : !readiness.enoughMana
              ? 'Low Mana'
              : 'Ready';
        const fill = remaining === null ? 0 : Math.round(100 * (1 - Math.min(1, remaining / spell.cooldownTicks)));
        return `<button class="tactical-spell-button" data-tactical-spell="${spellId}" data-element="${spell.element}" data-available="${available}" ${available ? '' : 'disabled'} title="Global Tactical control. A legal aligned Elementalist is resolved automatically by range, cooldown, distance, then EntityID."><kbd>${KEY_BY_SPELL[spellId]}</kbd><b>${SPELL_LABELS[spellId]}</b><small>${value(spell.manaCostMilli)} Mana · ${state}</small><i style="--ready:${fill}%"></i></button>`;
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
            : result.status === 'NO_CASTER'
              ? `No living aligned caster for ${resultLabel}.`
              : `No valid caster in range or valid target for ${resultLabel}.`}</strong>`
        : '';
      const attunementLabel = [...attuned].map(elementLabel).join(' + ');

      if (snapshot.elementalMana.enabled) {
        this.tacticalElement.innerHTML = spells || '<small class="tactical-empty">Train an aligned Elementalist to unlock Tactical controls.</small>';
        if (this.feedbackSeconds > 0 && result) {
          this.tacticalHint.textContent = result.status === 'NO_MANA'
            ? `Not enough Mana for ${resultLabel}.`
            : result.status === 'COOLDOWN'
              ? `${resultLabel}: all aligned casters are cooling down.`
              : result.status === 'NO_CASTER'
                ? `No living aligned caster is available for ${resultLabel}.`
                : `${resultLabel}: target unavailable or outside every ready caster's range.`;
        } else {
          this.tacticalHint.textContent = `${attunementLabel || 'No attunements'} · click spell then target, or quick-cast with R / Q / F / L.`;
        }
        hint.innerHTML = `<small>Global Tactical controls use any legal aligned Elementalist automatically.</small>${feedback}`;
      } else {
        this.tacticalElement.innerHTML = '<small class="tactical-empty">Tactical authority activates in Enemy War / full runs.</small>';
        this.tacticalHint.textContent = 'Mana economy active.';
        hint.innerHTML = '<small>Mana economy active. Full spell authority activates in Enemy War / full runs.</small>';
      }
    } finally {
      this.rendering = false;
    }
  }
}
