// Shape-aware edge endpoint snapping — adjusts edge path first/last points
// to lie on the actual polygon/circle surface instead of the AABB boundary.
// Pure functions only — no Three.js, no React.

import type { DiagramEdgePathCommand, DiagramEdgePathState } from '../types';
import type { DiagramNodeShape } from '../shapes/shapeVariants';

type Vec3 = readonly [number, number, number];

// ─── Shape side count mapping ────────────────────────────────────────────────

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

// ─── Polygon boundary projection ─────────────────────────────────────────────

/**
 * Projects a 2D point onto the boundary of a regular N-gon centered at (cx, cy)
 * with circumradius r, first vertex at angle −π/2 (top).
 *
 * Returns the boundary point along the ray from center to (px, py).
 * If the input point is at the center, returns the top vertex.
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
  // Rotate to polygon space: first vertex at -π/2 → rotate by +π/2
  const rotated = ((angle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const sectorAngle = (Math.PI * 2) / sides;
  const sectorOffset = rotated % sectorAngle;
  const halfSector = sectorAngle / 2;
  const delta = Math.abs(sectorOffset - halfSector);
  const apothem = r * Math.cos(Math.PI / sides);
  const edgeDist = apothem / Math.cos(Math.min(delta, halfSector - 1e-9));

  // Project to polygon boundary along the ray from center
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
      // Circle — use exact circle projection
      return projectOntoCircleBoundary(px, py, cx, cy, r);
    }
    return projectOntoPolygonBoundary(px, py, cx, cy, r, sides);
  }

  if (shape === 'diamond') {
    // Diamond = rotated square. Boundary at angle θ: distance = r / (|cos θ| + |sin θ|)
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

// ─── Path command endpoint adjustment ────────────────────────────────────────

type NodeShapeInfo = {
  readonly position: readonly [number, number, number];
  readonly size: readonly [number, number];
  readonly shape: DiagramNodeShape;
};

/**
 * Compute the front-face Z for a node. The node front face is at position[2]
 * (Z = 0 in local space). Edge endpoints at side-face Z (z - depth/2) cause
 * visible gaps when the diagram has tilt because the tube is rendered behind
 * the visible front face. Moving the endpoint to front-face Z ensures the
 * tube visually connects to the polygon surface.
 */
function frontFaceZ(node: NodeShapeInfo): number {
  return node.position[2];
}

function adjustCommandStart(
  cmd: DiagramEdgePathCommand,
  node: NodeShapeInfo,
): DiagramEdgePathCommand {
  const start = cmd.kind === 'line' ? cmd.from : cmd.p0;
  const [sx, sy] = snapToShapeBoundary(
    start[0], start[1],
    node.position[0], node.position[1],
    node.size, node.shape,
  );
  const sz = frontFaceZ(node);

  const dx = sx - start[0];
  const dy = sy - start[1];
  const dz = sz - start[2];
  const changed = Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6 || Math.abs(dz) > 1e-6;

  if (!changed) return cmd;

  if (cmd.kind === 'line') {
    return { kind: 'line', from: [sx, sy, sz], to: cmd.to };
  }
  // For cubic: move p0 and adjust p1 (first control point) by the same delta
  // to preserve the exit tangent direction.
  return {
    kind: 'cubic',
    p0: [sx, sy, sz],
    p1: [cmd.p1[0] + dx, cmd.p1[1] + dy, cmd.p1[2] + dz],
    p2: cmd.p2,
    p3: cmd.p3,
  };
}

function adjustCommandEnd(
  cmd: DiagramEdgePathCommand,
  node: NodeShapeInfo,
): DiagramEdgePathCommand {
  const end = cmd.kind === 'line' ? cmd.to : cmd.p3;
  const [ex, ey] = snapToShapeBoundary(
    end[0], end[1],
    node.position[0], node.position[1],
    node.size, node.shape,
  );
  const ez = frontFaceZ(node);

  const dx = ex - end[0];
  const dy = ey - end[1];
  const dz = ez - end[2];
  const changed = Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6 || Math.abs(dz) > 1e-6;

  if (!changed) return cmd;

  if (cmd.kind === 'line') {
    return { kind: 'line', from: cmd.from, to: [ex, ey, ez] };
  }
  // For cubic: move p3 and adjust p2 (second control point) by the same delta
  // to preserve the entry tangent direction.
  return {
    kind: 'cubic',
    p0: cmd.p0,
    p1: cmd.p1,
    p2: [cmd.p2[0] + dx, cmd.p2[1] + dy, cmd.p2[2] + dz],
    p3: [ex, ey, ez],
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Adjusts edge path endpoints to snap to the actual shape boundary
 * (polygon/circle surface) instead of the rectangular AABB boundary.
 *
 * The edge routing pipeline uses rectangular bounding boxes for all shapes.
 * For polygon shapes (hexagon, octagon, circle, etc.), the actual rendered
 * geometry is inscribed within the AABB. This function projects the first
 * and last path points onto the shape surface so edges visually connect
 * to the node geometry.
 *
 * Rectangle/square shapes are unchanged (AABB matches geometry).
 */
export function snapEdgePathToShapeBoundaries(
  path: DiagramEdgePathState,
  sourceNode: NodeShapeInfo | undefined,
  destinationNode: NodeShapeInfo | undefined,
): DiagramEdgePathState {
  const commands = path.commands;
  if (commands.length === 0) return path;

  const adjusted = [...commands];

  // Adjust first command start point for source shape.
  // For polygon/circle shapes: snaps XY to the shape surface.
  // For all shapes: brings Z to the front face (Z=0) to eliminate
  // the visual gap caused by side-face Z offset with tilt.
  if (sourceNode) {
    adjusted[0] = adjustCommandStart(adjusted[0]!, sourceNode);
  }

  // Adjust last command end point for destination shape.
  if (destinationNode) {
    const lastIdx = adjusted.length - 1;
    adjusted[lastIdx] = adjustCommandEnd(adjusted[lastIdx]!, destinationNode);
  }

  return { ...path, commands: adjusted };
}
