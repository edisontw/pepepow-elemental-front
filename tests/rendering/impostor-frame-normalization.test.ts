import { describe, expect, it } from 'vitest';
import {
  ELEMENTALIST_FRONT_RIGHT_SCALE,
  ELEMENTALIST_FRONT_RIGHT_VIEW_FRAME,
  unitImpostorFrameScale,
} from '../../src/rendering/impostor-frame-normalization';

const ELEMENTALIST_IDS = [
  'unit.elementalist.fire',
  'unit.elementalist.water',
  'unit.elementalist.ice',
  'unit.elementalist.lightning',
] as const;

describe('Elementalist impostor frame normalization', () => {
  it('compensates only the shared Front-Right view for aligned Elementalists', () => {
    for (const id of ELEMENTALIST_IDS) {
      for (let frame = 0; frame < 8; frame += 1) {
        const expected = frame === ELEMENTALIST_FRONT_RIGHT_VIEW_FRAME ? ELEMENTALIST_FRONT_RIGHT_SCALE : 1;
        expect(unitImpostorFrameScale(id, frame)).toBe(expected);
      }
    }
  });

  it('does not resize other unit impostors', () => {
    for (const id of ['unit.vanguard', 'unit.ranger', 'unit.engineer']) {
      for (let frame = 0; frame < 8; frame += 1) expect(unitImpostorFrameScale(id, frame)).toBe(1);
    }
  });
});
