import type * as pc from 'playcanvas';
import type { SimulationSnapshot } from '../simulation/simulation';

export function cameraFeedbackImpulse(previous: SimulationSnapshot, current: SimulationSnapshot): number {
  if (current.tick === previous.tick) return 0;
  const previousById = new Map(previous.entities.map((entity) => [entity.id, entity]));
  let visibleDeaths = 0;
  let visibleHeavyHits = 0;
  for (const entity of current.entities) {
    const prior = previousById.get(entity.id);
    if (!prior || !prior.alive || (!prior.visibleToPlayer && prior.playerId !== 0)) continue;
    if (!entity.alive) visibleDeaths += 1;
    else if (prior.currentHealth - entity.currentHealth >= Math.max(20, Math.floor(prior.maxHealth * 0.15))) visibleHeavyHits += 1;
  }
  if (visibleDeaths > 0) return Math.min(1, 0.55 + visibleDeaths * 0.12);
  if (visibleHeavyHits > 0) return Math.min(0.7, 0.25 + visibleHeavyHits * 0.08);
  if (current.lastLightningChain.length > 1) return 0.28;
  return 0;
}

export class CameraFeedback {
  private pulseTick = -1;
  private pulseStrength = 0;

  constructor(
    private readonly camera: pc.CameraComponent,
    private readonly baseFov = 48,
  ) {}

  sync(previous: SimulationSnapshot, current: SimulationSnapshot, alpha: number): void {
    if (current.tick !== previous.tick) {
      const impulse = cameraFeedbackImpulse(previous, current);
      if (impulse > 0) {
        this.pulseTick = current.tick;
        this.pulseStrength = impulse;
      }
    }
    const age = current.tick - this.pulseTick + alpha;
    if (this.pulseTick < 0 || age < 0 || age > 3) {
      this.camera.fov = this.baseFov;
      return;
    }
    const progress = Math.max(0, Math.min(1, age / 3));
    this.camera.fov = this.baseFov - Math.sin(progress * Math.PI) * 1.25 * this.pulseStrength;
  }

  destroy(): void {
    this.camera.fov = this.baseFov;
  }
}
