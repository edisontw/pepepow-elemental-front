const DIRECTION_COUNT = 8;
const DIRECTION_STEP_DEGREES = 360 / DIRECTION_COUNT;

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

/**
 * Direction order: front, front-left, left, rear-left, rear, rear-right, right, front-right.
 * cameraYaw is the world azimuth from which the fixed RTS camera observes the unit.
 * Positive frame progression moves around the unit's left side, so convert the
 * observer azimuth into unit-local view space as heading - cameraYaw.
 */
export function impostorFrameForHeading(headingDegrees: number, cameraYawDegrees = 45): number {
  const relative = normalizeDegrees(headingDegrees - cameraYawDegrees);
  return Math.round(relative / DIRECTION_STEP_DEGREES) % DIRECTION_COUNT;
}

export function impostorAtlasOffset(frame: number): readonly [number, number] {
  const normalized = ((Math.round(frame) % DIRECTION_COUNT) + DIRECTION_COUNT) % DIRECTION_COUNT;
  const column = normalized % 4;
  const row = Math.floor(normalized / 4);
  return [column * 0.25, row === 0 ? 0.5 : 0] as const;
}
