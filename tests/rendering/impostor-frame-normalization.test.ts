import { describe, expect, it } from 'vitest';
import {
  ELEMENTALIST_SCREEN_FRONT_RIGHT_SCALE,
  ELEMENTALIST_SCREEN_FRONT_RIGHT_VIEW_FRAME,
  ELEMENTALIST_SCREEN_REAR_RIGHT_SCALE,
  ELEMENTALIST_SCREEN_REAR_RIGHT_VIEW_FRAME,
  ELEMENTALIST_VIEW_FRAME_SCALES,
  ELEMENTALIST_WATER_SCREEN_FRONT_RIGHT_SCALE,
  ELEMENTALIST_WATER_VIEW_FRAME_SCALES,
  unitImpostorFrameScale,
} from '../../src/rendering/impostor-frame-normalization';

const STANDARD_ELEMENTALIST_IDS = [
  'unit.elementalist.fire',
  'unit.elementalist.ice',
  'unit.elementalist.lightning',
] as const;

describe('Elementalist impostor frame normalization', () => {
  it('maps the player screen-right diagonals to the correct runtime view frames', () => {
    expect(ELEMENTALIST_SCREEN_FRONT_RIGHT_VIEW_FRAME).toBe(1);
    expect(ELEMENTALIST_SCREEN_REAR_RIGHT_VIEW_FRAME).toBe(3);
  });

  it('keeps the shared eight-view normalization for Fire, Ice, and Lightning', () => {
    expect(ELEMENTALIST_VIEW_FRAME_SCALES).toEqual([
      1,
      ELEMENTALIST_SCREEN_FRONT_RIGHT_SCALE,
      1,
      ELEMENTALIST_SCREEN_REAR_RIGHT_SCALE,
      1,
      1,
      1,
      1,
    ]);

    for (const id of STANDARD_ELEMENTALIST_IDS) {
      for (let frame = 0; frame < 8; frame += 1) {
        expect(unitImpostorFrameScale(id, frame)).toBe(ELEMENTALIST_VIEW_FRAME_SCALES[frame]);
      }
    }
  });

  it('uses a stronger Front-Right correction only for Water', () => {
    expect(ELEMENTALIST_WATER_SCREEN_FRONT_RIGHT_SCALE)
      .toBeGreaterThan(ELEMENTALIST_SCREEN_FRONT_RIGHT_SCALE);
    expect(ELEMENTALIST_WATER_VIEW_FRAME_SCALES).toEqual([
      1,
      ELEMENTALIST_WATER_SCREEN_FRONT_RIGHT_SCALE,
      1,
      ELEMENTALIST_SCREEN_REAR_RIGHT_SCALE,
      1,
      1,
      1,
      1,
    ]);

    for (let frame = 0; frame < 8; frame += 1) {
      expect(unitImpostorFrameScale('unit.elementalist.water', frame))
        .toBe(ELEMENTALIST_WATER_VIEW_FRAME_SCALES[frame]);
    }
  });

  it('does not enlarge Water Rear-Right or the opposite runtime diagonal', () => {
    expect(unitImpostorFrameScale('unit.elementalist.water', ELEMENTALIST_SCREEN_REAR_RIGHT_VIEW_FRAME))
      .toBe(ELEMENTALIST_SCREEN_REAR_RIGHT_SCALE);
    expect(unitImpostorFrameScale('unit.elementalist.water', 7)).toBe(1);
  });

  it('does not resize other unit impostors', () => {
    for (const id of ['unit.vanguard', 'unit.ranger', 'unit.engineer']) {
      for (let frame = 0; frame < 8; frame += 1) expect(unitImpostorFrameScale(id, frame)).toBe(1);
    }
  });
});
