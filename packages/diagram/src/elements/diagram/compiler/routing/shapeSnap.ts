// XY-only polygon/circle endpoint snap — adjusts edge path first/last points
// to lie on the actual shape boundary instead of the AABB boundary.

import type { DiagramEdgePathCommand } from '../../types';
import type { DiagramNodeShape } from '../../shapes/shapeVariants';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Shape info needed for endpoint snapping. */
export type ShapeInfo = {
  readonly cx: number;
  readonly cy: number;
  readonly size: readonly [number, number];
  readonly shape: DiagramNodeShape;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const EPSILON = 1e-6;

// ─── Shape side count mapping ───────────────────────────────────────────────

const POLYGON_SIDE_COUNT: Partial<Record<DiagramNodeShape, number>> = {
  circle: 64,
  triangle: 3,
  pentagon: 5,
  hexagon: 6,
  heptagon: 7,
  octagon: 8,
  nonagon: 9,
  decagon: 10,
};

// ─── Polygon boundary projection ────────────────────────────────────────────

/**
 * Projects a 2D point onto the boundary of a regular N-gon centered at (cx, cy)
 * with circumradius r, first vertex at angle −π/2 (top).
 * Returns the boundary point along the ray from center to (px, py).
 */
function projectOntoPolygonBoundary(
  px: number, py: number,
  cx: number, cy: number,
  r: number, sides: number,
): [number, number] {
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1e-9) return [cx, cy - r]; // fallback: top vertex

  const angle = Math.atan2(dy, dx);
  const rotated = ((angle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const sectorAngle = (Math.PI * 2) / sides;
  const sectorOffset = rotated % sectorAngle;
  const halfSector = sectorAngle / 2;
  const delta = Math.abs(sectorOffset - halfSector);
  const apothem = r * Math.cos(Math.PI / sides);
  const edgeDist = apothem / Math.cos(Math.min(delta, halfSector - 1e-9));

  return [cx + (dx / dist) * edgeDist, cy + (dy / dist) * edgeDist];
}

/**
 * Projects a 2D point onto a circle boundary centered at (cx, cy) with radius r.
 */
function projectOntoCircleBoundary(
  px: number, py: number,
  cx: number, cy: number,
  r: number,
): [number, number] {
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1e-9) return [cx, cy - r]; // fallback: top
  return [cx + (dx / dist) * r, cy + (dy / dist) * r];
}

/**
 * Projects a point onto the shape boundary, returning [x, y].
 * For rectangle/square, returns the original point (no adjustment needed).
 */
function snapToShapeBoundary(
  px: number, py: number,
  cx: number, cy: number,
  size: readonly [number, number],
  shape: DiagramNodeShape,
): [number, number] {
  const r = Math.min(size[0], size[1]) / 2;
  const sides = POLYGON_SIDE_COUNT[shape];

  if (sides !== undefined) {
    if (sides >= 64) {
      return projectOntoCircleBoundary(px, py, cx, cy, r);
    }
    return projectOntoPolygonBoundary(px, py, cx, cy, r, sides);
  }

  if (shape === 'diamond') {
    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-9) return [cx, cy - r];
    const hw = size[0] / 2;
    const hh = size[1] / 2;
    const ax = Math.abs(dx / hw);
    const ay = Math.abs(dy / hh);
    const scale = 1 / Math.max(ax + ay, 1e-9);
    return [cx + dx * scale, cy + dy * scale];
  }

  // Rectangle, square, and other shapes: no adjustment
  return [px, py];
}

// ─── Path command endpoint adjustment ───────────────────────────────────────

function adjustCommandStart(
  cmd: DiagramEdgePathCommand,
  node: ShapeInfo,
): DiagramEdgePathCommand {
  const start = cmd.kind === 'line' ? cmd.from : cmd.p0;
  const [sx, sy] = snapToShapeBoundary(
    start[0], start[1],
    node.cx, node.cy,
    node.size, node.shape,
  );

  const dx = sx - start[0];
  const dy = sy - start[1];
  const changed = Math.abs(dx) > EPSILON || Math.abs(dy) > EPSILON;
  if (!changed) return cmd;

  if (cmd.kind === 'line') {
    return { kind: 'line', from: [sx, sy, start[2]], to: cmd.to };
  }
  // For cubic: move p0 and adjust p1 by the same delta to preserve exit tangent
  return {
    kind: 'cubic',
    p0: [sx, sy, cmd.p0[2]],
    p1: [cmd.p1[0] + dx, cmd.p1[1] + dy, cmd.p1[2]],
    p2: cmd.p2,
    p3: cmd.p3,
  };
}

function adjustCommandEnd(
  cmd: DiagramEdgePathCommand,
  node: ShapeInfo,
): DiagramEdgePathCommand {
  const end = cmd.kind === 'line' ? cmd.to : cmd.p3;
  const [ex, ey] = snapToShapeBoundary(
    end[0], end[1],
    node.cx, node.cy,
    node.size, node.shape,
  );

  const dx = ex - end[0];
  const dy = ey - end[1];
  const changed = Math.abs(dx) > EPSILON || Math.abs(dy) > EPSILON;
  if (!changed) return cmd;

  if (cmd.kind === 'line') {
    return { kind: 'line', from: cmd.from, to: [ex, ey, end[2]] };
  }
  // For cubic: move p3 and adjust p2 by the same delta to preserve entry tangent
  return {
    kind: 'cubic',
    p0: cmd.p0,
    p1: cmd.p1,
    p2: [cmd.p2[0] + dx, cmd.p2[1] + dy, cmd.p2[2]],
    p3: [ex, ey, cmd.p3[2]],
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Snap the first/last points of a path to the actual polygon/circle boundary.
 * XY only — Z is already correct from assignDepth().
 * Rectangle/square shapes: no adjustment (AABB matches geometry).
 */
export function snapEndpointsToShape(
  commands: ReadonlyArray<DiagramEdgePathCommand>,
  sourceShape: ShapeInfo | undefined,
  destShape: ShapeInfo | undefined,
): ReadonlyArray<DiagramEdgePathCommand> {
  if (commands.length === 0) return commands;

  const adjusted = [...commands];

  if (sourceShape) {
    adjusted[0] = adjustCommandStart(adjusted[0]!, sourceShape);
  }

  if (destShape) {
    const lastIdx = adjusted.length - 1;
    adjusted[lastIdx] = adjustCommandEnd(adjusted[lastIdx]!, destShape);
  }

  return adjusted;
}
