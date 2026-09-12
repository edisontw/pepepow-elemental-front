export interface PresentationFacingResolution {
  yawDegrees: number;
  baseYawDegrees: number;
}

/**
 * Movement direction owns facing while a unit is travelling. Combat aim may
 * rotate a stationary unit, but must not replace travel-facing every attack tick.
 */
export function resolvePresentationFacing(
  movementYawDegrees: number | null,
  combatYawDegrees: number | null,
  baseYawDegrees: number,
): PresentationFacingResolution {
  const activeYawDegrees = movementYawDegrees ?? combatYawDegrees;
  const yawDegrees = activeYawDegrees ?? baseYawDegrees;
  return { yawDegrees, baseYawDegrees: yawDegrees };
}
