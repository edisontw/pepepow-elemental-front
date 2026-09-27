import { M06Simulation, type M06SimulationSnapshot } from '../simulation/m06-simulation';
import { deriveEventNavigatorCandidates, type EventNavigatorCandidate } from './event-navigator-model';

const EVENT_TTL_TICKS = 300;
const EVENT_LIMIT = 5;

interface EventNavigatorItem extends EventNavigatorCandidate {
  createdTick: number;
}

export class EventNavigator {
  private elapsed = 0;
  private previous: M06SimulationSnapshot;
  private events: EventNavigatorItem[] = [];
  private lastMarkup = '';

  constructor(
    private readonly element: HTMLElement,
    private readonly simulation: M06Simulation,
    private readonly focusWorld: (x: number, z: number) => void,
  ) {
    this.previous = simulation.snapshot();
    element.addEventListener('click', this.onClick);
    this.render();
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    if (this.elapsed < 0.15) return;
    this.elapsed = 0;

    const current = this.simulation.snapshot();
    if (current.run.outcome !== 'IN_PROGRESS') {
      this.previous = current;
      this.events = [];
      this.render();
      return;
    }

    const candidates = deriveEventNavigatorCandidates(this.previous, current, this.simulation.generatedWorld);
    this.previous = current;

    for (const candidate of candidates) {
      this.events = this.events.filter((event) => event.key !== candidate.key);
      this.events.push({ ...candidate, createdTick: current.tick });
    }

    this.events = this.events
      .filter((event) => current.tick - event.createdTick <= EVENT_TTL_TICKS)
      .sort((left, right) => (
        right.priority - left.priority
        || right.createdTick - left.createdTick
        || left.key.localeCompare(right.key)
      ))
      .slice(0, EVENT_LIMIT);

    this.render();
  }

  destroy(): void {
    this.element.removeEventListener('click', this.onClick);
  }

  private readonly onClick = (event: MouseEvent): void => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('button[data-event-key]')
      : null;
    if (!button) return;
    const key = button.dataset.eventKey;
    const item = this.events.find((candidate) => candidate.key === key);
    if (!item) return;

    this.focusWorld(item.x, item.z);
    this.events = this.events.filter((candidate) => candidate !== item);
    this.render();
  };

  private render(): void {
    const currentTick = this.simulation.snapshot().tick;
    const markup = this.events.length === 0
      ? ''
      : `
        <div class="event-navigator-title"><b>BATTLE EVENTS</b><small>Click to focus</small></div>
        <div class="event-navigator-list">
          ${this.events.map((event) => {
            const ageSeconds = Math.max(0, Math.floor((currentTick - event.createdTick) / 10));
            return `<button data-event-key="${event.key}" data-kind="${event.kind}" title="${event.detail}">
              <span><strong>${event.label}</strong><small>${event.detail}</small></span>
              <em>${ageSeconds < 1 ? 'now' : `${ageSeconds}s`}</em>
            </button>`;
          }).join('')}
        </div>
      `;

    this.element.hidden = this.events.length === 0;
    if (markup === this.lastMarkup) return;
    this.lastMarkup = markup;
    this.element.innerHTML = markup;
  }
}
