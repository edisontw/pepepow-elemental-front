import { describe, expect, it } from 'vitest';
import { cameraFeedbackImpulse } from '../../src/rendering/camera-feedback';
import { Simulation } from '../../src/simulation/simulation';

describe('M08 camera feedback', () => {
  it('stays neutral when the visible battlefield has no impact event', () => {
    const simulation = new Simulation('m08-camera-neutral');
    const previous = simulation.snapshot();
    const current = simulation.step();
    expect(cameraFeedbackImpulse(previous, current)).toBe(0);
  });

  it('produces a restrained impulse for a visible death', () => {
    const simulation = new Simulation('m08-camera-death');
    const previous = simulation.snapshot();
    const current = simulation.step();
    const target = current.entities.find((entity) => entity.visibleToPlayer) ?? current.entities[0]!;
    const withDeath = {
      ...current,
      entities: current.entities.map((entity) => entity.id === target.id
        ? { ...entity, alive: false, currentHealth: 0, visibleToPlayer: true }
        : entity),
    };
    expect(cameraFeedbackImpulse(previous, withDeath)).toBeGreaterThan(0);
    expect(cameraFeedbackImpulse(previous, withDeath)).toBeLessThanOrEqual(1);
  });
});
