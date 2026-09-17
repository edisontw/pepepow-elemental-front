import { describe, expect, it, vi } from 'vitest';
import type * as pc from 'playcanvas';
import { UnitAnimationController } from '../../src/rendering/unit-animation-controller';

function fixture() {
  const layer = {
    activeStateDuration: 1, activeStateCurrentTime: 0,
    transition: vi.fn(),
  };
  const anim = { baseLayer: layer, speed: 1, playing: false, assignAnimation: vi.fn() };
  const root = { anim } as unknown as pc.Entity;
  const app = { assets: { find: () => ({ resource: {
    animations: ['Idle', 'Move', 'Attack', 'Hit', 'Death'].map(name => ({ resource: { name } })),
  } }) } } as unknown as pc.Application;
  const controller = new UnitAnimationController(app);
  const intent = { tick: 1, moving: false, frozen: false, attack: false, cast: false, hit: false, dead: false };
  return { layer, anim, controller, root, intent };
}

describe('embedded unit clip playback', () => {
  it('restarts repeated attacks once per new authoritative tick', () => {
    const f = fixture();
    const attack = { ...f.intent, attack: true };
    f.controller.sync('unit.vanguard', f.root, attack);
    f.layer.transition.mockClear();
    f.controller.sync('unit.vanguard', f.root, attack);
    expect(f.layer.transition).not.toHaveBeenCalled();
    f.controller.sync('unit.vanguard', f.root, { ...attack, tick: 2 });
    expect(f.layer.transition).toHaveBeenCalledOnce();
    expect(f.layer.transition.mock.calls[0]?.[0]).toBe('Attack');
  });

  it('applies locomotion speed on entry and recovers after a one-shot', () => {
    const f = fixture();
    const moving = { ...f.intent, moving: true, movePlaybackRate: 1.25 };
    f.controller.sync('unit.vanguard', f.root, moving);
    expect(f.anim.speed).toBe(1.25);
    f.controller.sync('unit.vanguard', f.root, { ...moving, tick: 2, hit: true });
    expect(f.anim.speed).toBe(1);
    f.layer.activeStateCurrentTime = 1;
    f.controller.sync('unit.vanguard', f.root, { ...moving, tick: 3 });
    expect(f.controller.state).toBe('MOVE');
    expect(f.anim.speed).toBe(1.25);
  });

  it('does not restart a death clip on subsequent frames', () => {
    const f = fixture();
    f.controller.sync('unit.vanguard', f.root, { ...f.intent, dead: true });
    f.layer.transition.mockClear();
    f.controller.sync('unit.vanguard', f.root, { ...f.intent, tick: 2, dead: true });
    expect(f.controller.state).toBe('DEATH');
    expect(f.layer.transition).not.toHaveBeenCalled();
  });
});
