import { describe, expect, it } from 'vitest';
import {
  IMPOSTOR_ANIMATION_ACTIONS,
  IMPOSTOR_ANIMATION_ASSET_REVISION,
  IMPOSTOR_MOVE_CYCLE_DISTANCE_METRES,
  animatedImpostorFrameFiles,
  impostorAnimationDurationSeconds,
  impostorMoveElapsedSeconds,
  impostorAnimationFrame,
  impostorAnimationMaterialIndex,
  isLoopingImpostorAnimation,
} from '../../src/rendering/impostor-animation';

const revision = `?v=${encodeURIComponent(IMPOSTOR_ANIMATION_ASSET_REVISION)}`;
const unitSlugs = [
  'vanguard',
  'elementalist-fire',
  'elementalist-ice',
  'elementalist-lightning',
  'elementalist-water',
  'engineer',
  'golem',
  'ranger',
  'scout',
  'siege-construct',
  'spear-guard',
] as const;

describe('animated unit impostor assets', () => {
  it('builds five 8-direction x 4-frame action sets for the full 11-unit roster', () => {
    expect(unitSlugs).toHaveLength(11);
    for (const slug of unitSlugs) {
      for (const action of IMPOSTOR_ANIMATION_ACTIONS) {
        expect(animatedImpostorFrameFiles(slug, action)).toHaveLength(32);
      }
    }
  });

  it('uses the browser-calibrated eight-direction source order', () => {
    const files = animatedImpostorFrameFiles('vanguard', 'IDLE');
    expect(files.slice(0, 4)).toEqual([
      `assets/impostors/vanguard/idle/right_00.webp${revision}`,
      `assets/impostors/vanguard/idle/right_01.webp${revision}`,
      `assets/impostors/vanguard/idle/right_02.webp${revision}`,
      `assets/impostors/vanguard/idle/right_03.webp${revision}`,
    ]);
    expect(files.slice(4, 8)).toEqual([
      `assets/impostors/vanguard/idle/front_left_00.webp${revision}`,
      `assets/impostors/vanguard/idle/front_left_01.webp${revision}`,
      `assets/impostors/vanguard/idle/front_left_02.webp${revision}`,
      `assets/impostors/vanguard/idle/front_left_03.webp${revision}`,
    ]);
    expect(files.slice(8, 12)).toEqual([
      `assets/impostors/vanguard/idle/rear_00.webp${revision}`,
      `assets/impostors/vanguard/idle/rear_01.webp${revision}`,
      `assets/impostors/vanguard/idle/rear_02.webp${revision}`,
      `assets/impostors/vanguard/idle/rear_03.webp${revision}`,
    ]);
    expect(files.slice(16, 20)).toEqual([
      `assets/impostors/vanguard/idle/left_00.webp${revision}`,
      `assets/impostors/vanguard/idle/left_01.webp${revision}`,
      `assets/impostors/vanguard/idle/left_02.webp${revision}`,
      `assets/impostors/vanguard/idle/left_03.webp${revision}`,
    ]);
    expect(files.slice(24, 28)).toEqual([
      `assets/impostors/vanguard/idle/front_00.webp${revision}`,
      `assets/impostors/vanguard/idle/front_01.webp${revision}`,
      `assets/impostors/vanguard/idle/front_02.webp${revision}`,
      `assets/impostors/vanguard/idle/front_03.webp${revision}`,
    ]);
    expect(files.slice(12, 16)).toEqual([
      `assets/impostors/vanguard/idle/rear_left_00.webp${revision}`,
      `assets/impostors/vanguard/idle/rear_left_01.webp${revision}`,
      `assets/impostors/vanguard/idle/rear_left_02.webp${revision}`,
      `assets/impostors/vanguard/idle/rear_left_03.webp${revision}`,
    ]);
    expect(files.slice(20, 24)).toEqual([
      `assets/impostors/vanguard/idle/rear_right_00.webp${revision}`,
      `assets/impostors/vanguard/idle/rear_right_01.webp${revision}`,
      `assets/impostors/vanguard/idle/rear_right_02.webp${revision}`,
      `assets/impostors/vanguard/idle/rear_right_03.webp${revision}`,
    ]);
    expect(files.slice(28, 32)).toEqual([
      `assets/impostors/vanguard/idle/front_right_00.webp${revision}`,
      `assets/impostors/vanguard/idle/front_right_01.webp${revision}`,
      `assets/impostors/vanguard/idle/front_right_02.webp${revision}`,
      `assets/impostors/vanguard/idle/front_right_03.webp${revision}`,
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

  it('advances Move from actual travel distance and restarts on a planted contact frame', () => {
    const quarterCycle = IMPOSTOR_MOVE_CYCLE_DISTANCE_METRES / 4;
    expect(impostorAnimationFrame('MOVE', impostorMoveElapsedSeconds(0))).toBe(0);
    expect(impostorAnimationFrame('MOVE', impostorMoveElapsedSeconds(quarterCycle * 1.01))).toBe(1);
    expect(impostorAnimationFrame('MOVE', impostorMoveElapsedSeconds(quarterCycle * 2.01))).toBe(2);
    expect(impostorAnimationFrame('MOVE', impostorMoveElapsedSeconds(quarterCycle * 3.01))).toBe(3);
    expect(impostorAnimationFrame('MOVE', impostorMoveElapsedSeconds(IMPOSTOR_MOVE_CYCLE_DISTANCE_METRES))).toBe(0);
  });

  it('uses short readable one-shot durations at the 10 Hz presentation boundary', () => {
    expect(impostorAnimationDurationSeconds('ATTACK')).toBeCloseTo(1 / 3, 5);
    expect(impostorAnimationDurationSeconds('HIT')).toBeCloseTo(0.25, 5);
    expect(impostorAnimationDurationSeconds('DEATH')).toBeCloseTo(0.5, 5);
  });
});
