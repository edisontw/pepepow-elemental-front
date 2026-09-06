import { describe, expect, it } from 'vitest';
import { FixedTickRunner } from '../../src/simulation/fixed-tick-runner';
import { Simulation } from '../../src/simulation/simulation';

function runSchedule(schedule: number[]): ReturnType<Simulation['snapshot']> {
  const simulation = new Simulation('fixed-tick-smoke');
  const runner = new FixedTickRunner(simulation);
  for (const milliseconds of schedule) runner.advance(milliseconds);
  return simulation.snapshot();
}

describe('FixedTickRunner', () => {
  it('produces the same authoritative state across render schedules', () => {
    const fastFrames = Array.from({ length: 60 }, () => 1000 / 60);
    const lowFrames = Array.from({ length: 10 }, () => 100);
    const unevenFrames = [40, 125, 10, 225, 50, 175, 75, 100, 200];
    expect(runSchedule(fastFrames)).toEqual(runSchedule(unevenFrames));
    expect(runSchedule(fastFrames)).toEqual(runSchedule(lowFrames));
  });
});
