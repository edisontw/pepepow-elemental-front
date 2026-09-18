import { describe, expect, it } from 'vitest';
import {
  IMPOSTOR_ANIMATION_ACTIONS,
  IMPOSTOR_ANIMATION_ASSET_REVISION,
  animatedImpostorFrameFiles,
  impostorAnimationDurationSeconds,
  impostorAnimationFrame,
  impostorAnimationMaterialIndex,
  isLoopingImpostorAnimation,
} from '../../src/rendering/impostor-animation';

const revision = `?v=${encodeURIComponent(IMPOSTOR_ANIMATION_ASSET_REVISION)}`;

describe('animated unit impostor assets', () => {
  it('builds five 8-direction x 4-frame action sets', () => {
    for (const action of IMPOSTOR_ANIMATION_ACTIONS) {
      expect(animatedImpostorFrameFiles('vanguard', action)).toHaveLength(32);
    }
  });

  it('keeps the fixed-camera diagonal calibration in runtime view order', () => {
    const files = animatedImpostorFrameFiles('vanguard', 'IDLE');
    expect(files.slice(0, 4)).toEqual([
      `assets/impostors/vanguard/idle/front_00.webp${revision}`,
      `assets/impostors/vanguard/idle/front_01.webp${revision}`,
      `assets/impostors/vanguard/idle/front_02.webp${revision}`,
      `assets/impostors/vanguard/idle/front_03.webp${revision}`,
    ]);
    expect(files.slice(4, 8)).toEqual([
      `assets/impostors/vanguard/idle/front_right_00.webp${revision}`,
      `assets/impostors/vanguard/idle/front_right_01.webp${revision}`,
      `assets/impostors/vanguard/idle/front_right_02.webp${revision}`,
      `assets/impostors/vanguard/idle/front_right_03.webp${revision}`,
    ]);
    expect(files.slice(12, 16)).toEqual([
      `assets/impostors/vanguard/idle/rear_right_00.webp${revision}`,
      `assets/impostors/vanguard/idle/rear_right_01.webp${revision}`,
      `assets/impostors/vanguard/idle/rear_right_02.webp${revision}`,
      `assets/impostors/vanguard/idle/rear_right_03.webp${revision}`,
    ]);
    expect(files.slice(28, 32)).toEqual([
      `assets/impostors/vanguard/idle/front_left_00.webp${revision}`,
      `assets/impostors/vanguard/idle/front_left_01.webp${revision}`,
      `assets/impostors/vanguard/idle/front_left_02.webp${revision}`,
      `assets/impostors/vanguard/idle/front_left_03.webp${revision}`,
    ]);
  });

  it('maps runtime view and animation frame into the 32-frame material table', () => {
    expect(impostorAnimationMaterialIndex(0, 0)).toBe(0);
    expect(impostorAnimationMaterialIndex(1, 0)).toBe(4);
    expect(impostorAnimationMaterialIndex(7, 3)).toBe(31);
    expect(impostorAnimationMaterialIndex(8, 4)).toBe(0);
  });

  it('loops locomotion but clamps one-shot actions to their final frame', () => {
    expect(isLoopingImpostorAnimation('IDLE')).toBe(true);
    expect(isLoopingImpostorAnimation('MOVE')).toBe(true);
    expect(isLoopingImpostorAnimation('ATTACK')).toBe(false);
    expect(impostorAnimationFrame('MOVE', 0)).toBe(0);
    expect(impostorAnimationFrame('MOVE', 0.5)).toBe(0);
    expect(impostorAnimationFrame('ATTACK', 10)).toBe(3);
    expect(impostorAnimationFrame('HIT', 10)).toBe(3);
    expect(impostorAnimationFrame('DEATH', 10)).toBe(3);
  });

  it('uses short readable one-shot durations at the 10 Hz presentation boundary', () => {
    expect(impostorAnimationDurationSeconds('ATTACK')).toBeCloseTo(1 / 3, 5);
    expect(impostorAnimationDurationSeconds('HIT')).toBeCloseTo(0.25, 5);
    expect(impostorAnimationDurationSeconds('DEATH')).toBeCloseTo(0.5, 5);
  });
});
