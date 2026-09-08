import type { EntitySnapshot } from '../simulation/simulation';
import { CAPTURE_BASE_TICKS } from '../simulation/m03-content';
import { M03Simulation } from '../simulation/m03-simulation';
import type { PointOfInterest } from '../world/world-definition';
import { poiVisualProfile } from '../rendering/poi-visual-profile';

const PLAYER_ID = 0;
const CAPTURE_THRESHOLD_TENTHS = CAPTURE_BASE_TICKS * 10;

interface SelectedPoiContext {
  regionId: number | null;
  poi: PointOfInterest | null;
  alreadyControlled: PointOfInterest | null;
}

function selectedPoiContext(
  simulation: M03Simulation,
  units: readonly EntitySnapshot[],
): SelectedPoiContext {
  const unit = units.find((candidate) => candidate.playerId === PLAYER_ID && candidate.alive);
  if (!unit) return { regionId: null, poi: null, alreadyControlled: null };
  const cell = simulation.navigation.worldToCell(unit.x, unit.z);
  const world = simulation.generatedWorld;
  if (cell.column < 0 || cell.row < 0 || cell.column >= world.width || cell.row >= world.height) {
    return { regionId: null, poi: null, alreadyControlled: null };
  }
  const regionId = world.regionByCell[cell.row * world.width + cell.column];
  if (regionId === undefined) return { regionId: null, poi: null, alreadyControlled: null };
  const snapshot = simulation.strategy.snapshot();
  const regionPois = world.pois.filter((candidate) => candidate.regionId === regionId);
  return {
    regionId,
    poi: regionPois.find((candidate) => snapshot.poiOwners[candidate.id] !== PLAYER_ID) ?? null,
    alreadyControlled: regionPois.find((candidate) => snapshot.poiOwners[candidate.id] === PLAYER_ID) ?? null,
  };
}

export class PoiCaptureHint {
  private elapsed = 0;
  private lastOwnedCount: number;
  private toastSeconds = 0;

  constructor(
    private readonly strategyElement: HTMLElement,
    private readonly simulation: M03Simulation,
    private readonly selectedUnits: () => readonly EntitySnapshot[],
  ) {
    this.lastOwnedCount = this.playerOwnedPoiCount();
    this.render();
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    this.toastSeconds = Math.max(0, this.toastSeconds - deltaSeconds);
    const ownedCount = this.playerOwnedPoiCount();
    if (ownedCount > this.lastOwnedCount) this.toastSeconds = 5;
    this.lastOwnedCount = ownedCount;
    if (this.elapsed < 0.15) return;
    this.elapsed = 0;
    this.render();
  }

  destroy(): void {
    this.strategyElement.querySelector('.poi-capture-hint')?.remove();
    this.strategyElement.querySelector('.poi-capture-toast')?.remove();
  }

  private render(): void {
    const territory = this.strategyElement.querySelector<HTMLElement>('.territory-info');
    const captureButton = territory?.querySelector<HTMLButtonElement>('button[data-action="capture-poi"]');
    if (!territory || !captureButton) return;

    let hint = territory.querySelector<HTMLElement>('.poi-capture-hint');
    if (!hint) {
      hint = document.createElement('small');
      hint.className = 'poi-capture-hint';
      territory.appendChild(hint);
    }

    const units = this.selectedUnits().filter((unit) => unit.playerId === PLAYER_ID && unit.alive);
    const context = selectedPoiContext(this.simulation, units);
    const snapshot = this.simulation.strategy.snapshot();
    const active = context.poi
      ? snapshot.captureOrders.find((order) => order.playerId === PLAYER_ID && order.targetPoiId === context.poi?.id)
      : undefined;

    if (units.length === 0 || context.regionId === null) {
      captureButton.disabled = true;
      captureButton.textContent = 'Capture POI (+10 Influence)';
      hint.textContent = 'POI: move any player unit into a marked POI region. Any unit type can capture; multiple units capture faster.';
    } else if (context.poi) {
      const label = poiVisualProfile(context.poi.type).label;
      if (active) {
        const percent = Math.max(0, Math.min(100, Math.round((active.progressTenths * 100) / CAPTURE_THRESHOLD_TENTHS)));
        captureButton.disabled = true;
        captureButton.textContent = `Capturing ${label} · ${percent}%`;
        hint.textContent = `${label} · Region ${context.regionId + 1} · capture in progress · +10 Influence on completion.`;
      } else {
        const owner = snapshot.poiOwners[context.poi.id];
        captureButton.disabled = false;
        captureButton.textContent = `Capture ${label} (+10 Influence)`;
        hint.textContent = `${label} · Region ${context.regionId + 1} · ${owner === undefined ? 'Unclaimed' : 'Enemy controlled'} · selected units can capture now.`;
      }
    } else if (context.alreadyControlled) {
      const label = poiVisualProfile(context.alreadyControlled.type).label;
      captureButton.disabled = true;
      captureButton.textContent = 'POI already controlled';
      hint.textContent = `${label} · Region ${context.regionId + 1} · controlled. Move to another white/red POI marker for more Influence.`;
    } else {
      captureButton.disabled = true;
      captureButton.textContent = 'Capture POI (+10 Influence)';
      hint.textContent = `Region ${context.regionId + 1} has no POI. Use the main-map landmarks or minimap POI symbols to find one.`;
    }

    let toast = this.strategyElement.querySelector<HTMLElement>('.poi-capture-toast');
    if (this.toastSeconds > 0) {
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'poi-capture-toast';
        this.strategyElement.prepend(toast);
      }
      toast.textContent = 'POI SECURED · +10 INFLUENCE · NEXT OUTPOST FUNDED';
    } else {
      toast?.remove();
    }
  }

  private playerOwnedPoiCount(): number {
    return Object.values(this.simulation.strategy.snapshot().poiOwners)
      .filter((owner) => owner === PLAYER_ID).length;
  }
}
