import { TICK_MS, type Simulation, type SimulationSnapshot } from './simulation';

export interface TickFrame {
  snapshot: SimulationSnapshot;
  interpolationAlpha: number;
  ticksProcessed: number;
}

export class FixedTickRunner {
  private accumulatorMs = 0;

  constructor(
    private readonly simulation: Simulation,
    private readonly maxTicksPerFrame = 5,
  ) {}

  advance(frameMs: number): TickFrame {
    this.accumulatorMs += Math.min(Math.max(frameMs, 0), 250);
    let ticksProcessed = 0;

    while (this.accumulatorMs >= TICK_MS && ticksProcessed < this.maxTicksPerFrame) {
      this.simulation.step();
      this.accumulatorMs -= TICK_MS;
      ticksProcessed += 1;
    }

    if (ticksProcessed === this.maxTicksPerFrame && this.accumulatorMs >= TICK_MS) {
      this.accumulatorMs %= TICK_MS;
    }

    return {
      snapshot: this.simulation.snapshot(),
      interpolationAlpha: this.accumulatorMs / TICK_MS,
      ticksProcessed,
    };
  }
}
