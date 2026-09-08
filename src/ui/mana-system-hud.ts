import { ELEMENTAL_SPELLS, type ElementalCastEffectId } from '../simulation/m04-content';
import type { M04Simulation } from '../simulation/m04-simulation';

const PLAYER_ID = 0;
const SPELL_ORDER: readonly ElementalCastEffectId[] = ['FIRE', 'WATER', 'FREEZE', 'CHAIN_LIGHTNING'];
const KEY_BY_SPELL: Readonly<Record<ElementalCastEffectId, string>> = {
  FIRE: 'R',
  WATER: 'Q',
  FREEZE: 'F',
  CHAIN_LIGHTNING: 'L',
  HEAT: 'H',
};

function value(milli: number): string {
  const raw = milli / 1000;
  return Number.isInteger(raw) ? String(raw) : raw.toFixed(1);
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
    this.strategyElement.querySelector('.mana-system-hint')?.remove();
  }

  private render(): void {
    if (this.rendering) return;
    this.rendering = true;
    try {
      const snapshot = this.simulation.snapshot();
      const mana = snapshot.elementalMana.players[PLAYER_ID];
      if (!mana) return;
      const manaCell = this.strategyElement.querySelector<HTMLElement>('.resource-strip b:nth-child(2)');
      const resourceKey = this.strategyElement.querySelector<HTMLElement>('.resource-key');
      if (!manaCell || !resourceKey) return;

      manaCell.innerHTML = `${value(mana.currentManaMilli)}/${value(mana.maxManaMilli)} <span>Mana</span>`;
      manaCell.title = 'Shared Mana: used by elemental spells, Arcane buildings, and Mana-cost units. Mana Wells recharge it.';

      let hint = this.strategyElement.querySelector<HTMLElement>('.mana-system-hint');
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'mana-system-hint';
        resourceKey.insertAdjacentElement('afterend', hint);
      }

      const spells = SPELL_ORDER.map((effectId) => {
        const spell = ELEMENTAL_SPELLS[effectId];
        const cooldown = mana.cooldownTicks[effectId] ?? 0;
        const cooldownLabel = cooldown > 0 ? ` · ${(cooldown / 10).toFixed(1)}s` : '';
        return `<span><kbd>${KEY_BY_SPELL[effectId]}</kbd>${spell.label} ${value(spell.manaCostMilli)}${cooldownLabel}</span>`;
      }).join('');

      const result = snapshot.elementalMana.lastCastResult;
      const feedbackKey = result ? `${result.tick}:${result.effectId}:${result.status}` : '';
      if (result && result.status !== 'CAST' && feedbackKey !== this.lastFeedbackKey) {
        this.lastFeedbackKey = feedbackKey;
        this.feedbackSeconds = 2.5;
      }
      const feedback = this.feedbackSeconds > 0 && result
        ? `<strong>${result.status === 'NO_MANA' ? `Not enough Mana for ${ELEMENTAL_SPELLS[result.effectId].label}.` : `${ELEMENTAL_SPELLS[result.effectId].label} is cooling down.`}</strong>`
        : '';

      hint.innerHTML = snapshot.elementalMana.enabled
        ? `<div>${spells}</div><small>Mana Well +2/s · Rich +3/s · Core +0.5/s · Shrines/upgrades raise Max Mana.</small>${feedback}`
        : '<small>Mana economy active. Full spell Mana rules activate in Enemy War / full runs.</small>';
    } finally {
      this.rendering = false;
    }
  }
}
