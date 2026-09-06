import { describe, expect, it } from 'vitest';
import { DeterministicRng } from '../../src/simulation/random';

describe('DeterministicRng', () => {
  it('repeats the same sequence for the same seed', () => {
    const first = new DeterministicRng('elemental-front:smoke');
    const second = new DeterministicRng('elemental-front:smoke');
    const firstSequence = Array.from({ length: 16 }, () => first.nextUint32());
    const secondSequence = Array.from({ length: 16 }, () => second.nextUint32());
    expect(firstSequence).toEqual(secondSequence);
  });

  it('keeps derived streams isolated', () => {
    const master = new DeterministicRng('block:123456');
    const terrain = master.derive('terrain');
    const visual = master.derive('visual');
    expect(terrain.nextUint32()).not.toBe(visual.nextUint32());
  });
});
