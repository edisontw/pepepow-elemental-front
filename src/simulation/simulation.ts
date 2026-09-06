import { DeterministicRng } from './random';

export const SIMULATION_HZ = 10;
export const TICK_MS = 1000 / SIMULATION_HZ;

export interface SimulationSnapshot {
  tick: number;
  elapsedMs: number;
  rngState: number;
  smokeValue: number;
}

export class Simulation {
  private readonly rng: DeterministicRng;
  private tick = 0;
  private smokeValue = 0;

  constructor(readonly seed: string) {
    this.rng = new DeterministicRng(seed);
  }

  step(): SimulationSnapshot {
    this.tick += 1;
    this.smokeValue = this.rng.nextUint32();
    return this.snapshot();
  }

  snapshot(): SimulationSnapshot {
    return {
      tick: this.tick,
      elapsedMs: this.tick * TICK_MS,
      rngState: this.rng.snapshot(),
      smokeValue: this.smokeValue,
    };
  }
}
