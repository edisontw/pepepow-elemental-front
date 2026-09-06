import { TICK_MS, type Simulation, type SimulationSnapshot } from './simulation';

export interface TickFrame {
  previousSnapshot: SimulationSnapshot;
  snapshot: SimulationSnapshot;
  interpolationAlpha: number;
  ticksProcessed: number;
}

export class FixedTickRunner {
  private accumulatorMs = 0;
  private previousSnapshot: SimulationSnapshot;

  constructor(
    private readonly simulation: Simulation,
    private readonly maxTicksPerFrame = 10,
  ) {
    this.previousSnapshot = simulation.snapshot();
  }

  advance(frameMs: number): TickFrame {
    this.accumulatorMs += Math.max(frameMs, 0);
    let ticksProcessed = 0;

    while (this.accumulatorMs >= TICK_MS && ticksProcessed < this.maxTicksPerFrame) {
      this.previousSnapshot = this.simulation.snapshot();
      this.simulation.step();
      this.accumulatorMs -= TICK_MS;
      ticksProcessed += 1;
    }

    return {
      previousSnapshot: this.previousSnapshot,
      snapshot: this.simulation.snapshot(),
      interpolationAlpha: this.accumulatorMs / TICK_MS,
      ticksProcessed,
    };
  }
}
