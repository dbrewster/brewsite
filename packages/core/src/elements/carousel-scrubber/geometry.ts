// Pure shape generators and geometry math for carousel scrubber tray footprints.

/**
 * A 2D point in the shape plane.
 * Before Three.js conversion, x maps to world X and y maps to shape Y.
 */
export type ShapePoint = { x: number; y: number };

/** Which footprint shape to use for the tray. */
export type TrayShapeKind = 'ellipse' | 'parabolic' | 'roundedRect';

/** Resolved parameters for tray geometry creation. */
export type TrayGeometryParams = {
  shapeKind: TrayShapeKind;
  worldWidth: number;
  zDepth: number;
  trayDepth: number;
  zStep: number;
  childCount: number;
  bevelRadius: number;
  bevelSegments: number;
};

/**
 * ============================================================================
 * COORDINATE MAPPING AFTER -pi/2 X ROTATION
 * ============================================================================
 *
 * After ExtrudeGeometry rotation by -pi/2 around X:
 *   Shape X     ->  World X   (unchanged)
 *   Shape Y     ->  World -Z  (positive shape Y = AWAY from camera)
 *   Extrusion Z ->  World Y   (up)
 *
 * CRITICAL CONSEQUENCE FOR SHAPE GENERATORS:
 * To make edges recede from camera (negative world Z), use POSITIVE
 * shape Y values for the back edge. The parabolic shape's k*x^2 term
 * is positive at the edges, which after rotation becomes negative
 * world Z — correctly receding from the camera. If you negate the
 * parabola sign, the tray will bow TOWARD the camera instead of away.
 * ============================================================================
 */
export const SHAPE_TO_WORLD_COORDINATE_DOC = 'Shape Y -> World -Z after -pi/2 X rotation';

/**
 * Computes the maximum Z depth for a linear carousel's full possible path.
 *
 * In a linear carousel, items fan out symmetrically from center. The farthest
 * item from center is at distance = ceil((childCount - 1) / 2). Each distance
 * step recedes by zStep. The tray must cover this full range so that ALL
 * item positions sit on the tray regardless of which item is active.
 *
 * @param childCount Total number of items in the carousel.
 * @param zStep Z-depth per distance step.
 * @returns The maximum Z depth the parabola must reach at its edges.
 */
/**
 * Computes the maximum Z depth for a linear carousel's full possible path,
 * capped to produce a visually balanced tray that sits underneath the items
 * rather than forming a deep bowl around them.
 *
 * The raw depth is `ceil((childCount-1)/2) * zStep`. This is capped at
 * `zStep * 2.5` — deep enough to clearly follow the carousel's curvature
 * while staying shallow enough to read as a platform, not a bowl.
 */
export function computeLinearMaxDepth(childCount: number, zStep: number): number {
  if (childCount <= 1 || zStep <= 0) return 0;
  const maxDistance = Math.ceil((childCount - 1) / 2);
  const rawDepth = maxDistance * zStep;
  // Cap: the tray follows the curve but stays platform-like.
  // 2.5× zStep means items 2+ steps away recede past the tray edge,
  // which is fine — the tray is a visual anchor, not a container.
  return Math.min(rawDepth, zStep * 2.5);
}

/**
 * Determines which shape kind to use based on carousel state.
 * Ring carousels use elliptical footprint; linear carousels with zStep
 * use parabolic; flat linear carousels use rounded rectangle.
 */
export function resolveTrayShapeKind(isRing: boolean, zStep: number): TrayShapeKind {
  if (isRing) return 'ellipse';
  if (zStep > 0) return 'parabolic';
  return 'roundedRect';
}

/**
 * Generates an ellipse outline as a point array.
 * The ellipse is centered at the origin with semi-axes along X and Y.
 * Points form a closed loop (first point repeated at end).
 *
 * @param semiX - Semi-axis along X.
 * @param semiY - Semi-axis along Y (maps to Z after rotation).
 * @param segments - Number of segments for the approximation.
 */
export function generateEllipsePoints(semiX: number, semiY: number, segments = 64): ShapePoint[] {
  const points: ShapePoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({ x: Math.cos(angle) * semiX, y: Math.sin(angle) * semiY });
  }
  return points;
}

/**
 * Generates a rounded rectangle outline as a point array.
 * Centered at the origin with half-extents halfW (X) and halfZ (Y).
 * Corner radius is computed internally for a platform-like appearance.
 *
 * @param halfW - Half-width along X.
 * @param halfZ - Half-depth along Y (maps to Z after rotation).
 */
export function generateRoundedRectPoints(halfW: number, halfZ: number): ShapePoint[] {
  const r = Math.min(halfZ * 0.45, halfW * 0.15, 0.5);
  const points: ShapePoint[] = [];

  // Bottom edge: left to right
  points.push({ x: -halfW + r, y: -halfZ });
  points.push({ x: halfW - r, y: -halfZ });

  // Bottom-right corner (quadratic approximation with midpoint)
  points.push({ x: halfW, y: -halfZ + r });

  // Right edge
  points.push({ x: halfW, y: halfZ - r });

  // Top-right corner
  points.push({ x: halfW - r, y: halfZ });

  // Top edge: right to left
  points.push({ x: -halfW + r, y: halfZ });

  // Top-left corner
  points.push({ x: -halfW, y: halfZ - r });

  // Left edge
  points.push({ x: -halfW, y: -halfZ + r });

  // Close back to start
  points.push({ x: -halfW + r, y: -halfZ });

  return points;
}

/**
 * Generates a closed parabolic tray outline as a point array.
 *
 * The front edge follows the parabolic curvature of the linear carousel
 * (items nearest the camera at center, receding at the sides). The back
 * edge runs flat at the maximum parabolic depth, closing the shape through
 * the center instead of leaving a horseshoe gap. The result is a closed
 * platform shape — like a leaf or tongue — that follows the carousel curve
 * on the front and is filled solid in the middle.
 *
 * After the -pi/2 X rotation, positive shape Y becomes negative world Z
 * (away from camera). The parabola k*x^2 is positive at the edges, which
 * after rotation becomes negative world Z = receding.
 *
 * Points are returned in counterclockwise winding: front edge left-to-right,
 * right end-cap, back edge right-to-left, left end-cap.
 *
 * @param halfWidth - Half the total tray width along X.
 * @param maxDepth - Total Z depth at the edges (from computeLinearMaxDepth).
 * @param bandWidth - Thickness of the tray band in Z (front-to-back extent).
 * @param segments - Number of segments along each edge.
 */
export function generateParabolicPoints(
  halfWidth: number,
  maxDepth: number,
  bandWidth: number,
  segments = 32,
  _capSegments = 8,
): ShapePoint[] {
  const points: ShapePoint[] = [];

  // Front offset: how far the tray extends toward the camera (negative Z)
  // at x=0. Keep this modest so the tray doesn't protrude too far forward.
  const frontOffset = bandWidth * 0.5;

  // Front edge: uses a cubic power curve (|x|³) — rounder than x⁴ (which was
  // too flat) but still flatter than the original x² parabola. The cubic
  // produces a gentle rounded nose at center that transitions smoothly into
  // the steeper rise at the sides. Same endpoints as the parabola:
  // at x=0 → y = -frontOffset (closest to camera)
  // at x=±hw → y = maxDepth - frontOffset (deepest)
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = -halfWidth + t * 2 * halfWidth;
    const normalizedX = halfWidth > 0 ? x / halfWidth : 0; // [-1, 1]
    const absN = Math.abs(normalizedX);
    const z = maxDepth * (absN * absN * absN) - frontOffset;
    points.push({ x, y: z });
  }

  // Right side: straight vertical connection from front edge to back edge at
  // x = +halfWidth. No semicircle cap — eliminates the outward nubs.
  // (The front edge endpoint is already at x=+halfWidth.)
  // Just add the back edge start point at the same x.
  const backY = maxDepth + frontOffset;
  points.push({ x: halfWidth, y: backY });

  // Back edge: flat straight line at maximum depth, right-to-left.
  for (let i = segments; i >= 0; i--) {
    const t = i / segments;
    const x = -halfWidth + t * 2 * halfWidth;
    points.push({ x, y: backY });
  }

  // Left side: straight vertical connection from back edge to front edge at
  // x = -halfWidth. Mirrors the right side — no nub.
  // (The back edge end is already at x=-halfWidth. The close point below
  // reconnects to the front edge start at x=-halfWidth.)

  // Close: repeat the first point to ensure topological closure.
  if (points.length > 0) {
    points.push({ x: points[0].x, y: points[0].y });
  }

  return points;
}

/**
 * Computes the Z-axis band width for a parabolic tray.
 * The band width is the front-to-back thickness of the tray outline.
 * Kept proportional to item depth (single zStep) and world width,
 * with a floor of 1.0 to ensure the tray is always visually present.
 */
export function computeParabolicBandWidth(zStep: number, worldWidth: number): number {
  return Math.max(zStep * 0.25, worldWidth * 0.10, 1.0);
}

/**
 * Computes tray Z-depth from carousel parameters.
 *
 * Ring carousels get zStep * 1.15 (the full ring diameter + padding).
 * Linear carousels get maxDepth + bandWidth (covers the full possible path).
 * Flat carousels get a proportional depth based on world width.
 *
 * @param isRing Whether this is a ring (loop) carousel.
 * @param zStep Z-depth per distance step.
 * @param worldWidth Total tray width in world units.
 * @param childCount Number of items in the carousel (used for linear maxDepth).
 */
export function computeTrayZDepth(isRing: boolean, zStep: number, worldWidth: number, childCount: number): number {
  if (isRing && zStep > 0) {
    return zStep + zStep * 0.15;
  } else if (zStep > 0) {
    const maxDepth = computeLinearMaxDepth(childCount, zStep);
    const bandWidth = computeParabolicBandWidth(zStep, worldWidth);
    return maxDepth + bandWidth;
  } else {
    return Math.max(worldWidth * 0.25, 2.0);
  }
}

/**
 * Computes bevel radius from tray depth.
 * Clamped to avoid oversized bevels on thin trays.
 */
export function computeBevelRadius(trayDepth: number): number {
  return Math.min(0.06, trayDepth * 0.25);
}

/**
 * Computes a string key that uniquely identifies the geometry configuration.
 * Used by render.ts for change detection instead of tracking 6+ individual fields.
 */
export function computeGeometryKey(params: TrayGeometryParams): string {
  return `${params.shapeKind}|${params.worldWidth}|${params.zDepth}|${params.trayDepth}|${params.zStep}|${params.childCount}|${params.bevelRadius}|${params.bevelSegments}`;
}
