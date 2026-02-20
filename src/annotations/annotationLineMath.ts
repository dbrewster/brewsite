/**
 * Annotation line drawing mathematics.
 */

export type LineIntersection2D = {
  visible: boolean;
  x: number;
  y: number;
};

export const computeLineIntersection2D = (
  targetX: number,
  targetY: number,
  halfWidth: number,
  halfHeight: number,
): LineIntersection2D => {
  const absX = Math.abs(targetX);
  const absY = Math.abs(targetY);
  if (absX <= halfWidth && absY <= halfHeight) {
    return { visible: false, x: 0, y: 0 };
  }
  const scale = Math.max(absX / halfWidth, absY / halfHeight);
  return {
    visible: true,
    x: targetX / scale,
    y: targetY / scale,
  };
};
