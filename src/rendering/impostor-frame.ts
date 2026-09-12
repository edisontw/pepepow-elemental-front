const DIRECTION_COUNT = 8;
const DIRECTION_STEP_DEGREES = 360 / DIRECTION_COUNT;
const HALF_DIRECTION_STEP_DEGREES = DIRECTION_STEP_DEGREES / 2;

export const RTS_CAMERA_YAW_DEGREES = 45;

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function angularDistanceDegrees(first: number, second: number): number {
  const delta = normalizeDegrees(first - second + 180) - 180;
  return Math.abs(delta);
}

/**
 * Direction order: front, front-left, left, rear-left, rear, rear-right, right, front-right.
 * cameraYaw is the world azimuth from which the fixed RTS camera observes the unit.
 * Positive frame progression moves around the unit's left side, so convert the
 * observer azimuth into unit-local view space as heading - cameraYaw.
 */
export function impostorFrameForHeading(
  headingDegrees: number,
  cameraYawDegrees = RTS_CAMERA_YAW_DEGREES,
): number {
  const relative = normalizeDegrees(headingDegrees - cameraYawDegrees);
  return Math.round(relative / DIRECTION_STEP_DEGREES) % DIRECTION_COUNT;
}

/**
 * Keeps the current view a little beyond its exact 22.5 degree sector boundary.
 * This prevents rapid left/right frame chatter when rendered movement headings
 * hover around a discrete eight-direction threshold.
 */
export function stableImpostorFrameForHeading(
  headingDegrees: number,
  currentFrame: number,
  cameraYawDegrees = RTS_CAMERA_YAW_DEGREES,
  hysteresisDegrees = 6,
): number {
  const candidate = impostorFrameForHeading(headingDegrees, cameraYawDegrees);
  if (!Number.isInteger(currentFrame) || currentFrame < 0 || currentFrame >= DIRECTION_COUNT) return candidate;

  const relative = normalizeDegrees(headingDegrees - cameraYawDegrees);
  const currentCenter = currentFrame * DIRECTION_STEP_DEGREES;
  const keepThreshold = HALF_DIRECTION_STEP_DEGREES + Math.max(0, hysteresisDegrees);
  return angularDistanceDegrees(relative, currentCenter) <= keepThreshold ? currentFrame : candidate;
}

export function impostorAtlasOffset(frame: number): readonly [number, number] {
  const normalized = ((Math.round(frame) % DIRECTION_COUNT) + DIRECTION_COUNT) % DIRECTION_COUNT;
  const column = normalized % 4;
  const row = Math.floor(normalized / 4);
  return [column * 0.25, row === 0 ? 0.5 : 0] as const;
}
