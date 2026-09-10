export function pointToSegmentDistanceSquared(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared <= Number.EPSILON) {
    const dx = pointX - startX;
    const dy = pointY - startY;
    return dx * dx + dy * dy;
  }
  const projection = Math.max(0, Math.min(1,
    ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / lengthSquared,
  ));
  const closestX = startX + segmentX * projection;
  const closestY = startY + segmentY * projection;
  const dx = pointX - closestX;
  const dy = pointY - closestY;
  return dx * dx + dy * dy;
}
