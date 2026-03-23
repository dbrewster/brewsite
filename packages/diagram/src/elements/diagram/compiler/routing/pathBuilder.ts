// Path command generation: 4 profile builders + arc rounding + Z assignment.

import type { DiagramEdgePathCommand } from '../../types';
import type { Vec2, Vec3 } from './routingTypes';
import {
  addVec2,
  subVec2,
  scaleVec2,
  lengthVec2,
  normalizeVec2,
  dotVec2,
  clamp,
  vec3,
} from './routingTypes';

// ─── Types ──────────────────────────────────────────────────────────────────

/** 2D path command — line or cubic Bezier, XY only. */
export type PathCommand2D =
  | { kind: 'line'; from: Vec2; to: Vec2 }
  | { kind: 'cubic'; p0: Vec2; p1: Vec2; p2: Vec2; p3: Vec2 };

// ─── Constants ──────────────────────────────────────────────────────────────

const EPSILON = 1e-6;

/** Bezier arc approximation constant for 90° arcs. */
const ARC_KAPPA = 0.5522847498307936;

// ─── Internal helpers ───────────────────────────────────────────────────────

const vec2Equal = (a: Vec2, b: Vec2): boolean =>
  Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON;

const isAxisAligned2D = (v: Vec2): boolean =>
  Math.abs(v[0]) < EPSILON || Math.abs(v[1]) < EPSILON;

/**
 * Snap a near-cardinal Vec2 to the exact cardinal axis it dominates.
 * Prevents floating-point residual from being amplified by handle length.
 */
const snapToCardinal2D = (v: Vec2): Vec2 => {
  if (Math.abs(v[0]) >= Math.abs(v[1])) {
    return [v[0] < 0 ? -1 : 1, 0];
  }
  return [0, v[1] < 0 ? -1 : 1];
};

/**
 * Remove axis-aligned direction reversals from a point sequence.
 * A reversal occurs when three consecutive colinear points form a
 * go-and-come-back pattern.
 */
const eliminateAxisReversals2D = (points: Vec2[]): Vec2[] => {
  if (points.length < 3) return points;
  const result: Vec2[] = [points[0]!];
  for (let i = 1; i < points.length; i += 1) {
    const prev = result[result.length - 1]!;
    const curr = points[i]!;
    const next = i < points.length - 1 ? points[i + 1] : undefined;
    if (!next) {
      if (!vec2Equal(prev, curr)) result.push(curr);
      continue;
    }
    const sameY = Math.abs(prev[1] - curr[1]) < EPSILON && Math.abs(curr[1] - next[1]) < EPSILON;
    if (sameY) {
      const dxPrevCurr = curr[0] - prev[0];
      const dxCurrNext = next[0] - curr[0];
      if (dxPrevCurr * dxCurrNext < -EPSILON) continue;
    }
    const sameX = Math.abs(prev[0] - curr[0]) < EPSILON && Math.abs(curr[0] - next[0]) < EPSILON;
    if (sameX) {
      const dyPrevCurr = curr[1] - prev[1];
      const dyCurrNext = next[1] - curr[1];
      if (dyPrevCurr * dyCurrNext < -EPSILON) continue;
    }
    if (!vec2Equal(prev, curr)) result.push(curr);
  }
  return result;
};

/**
 * Collapse micro-segments shorter than the turn radius.
 * Prevents tiny asymmetric arcs at turns.
 */
const collapseShortLegs2D = (points: Vec2[], minLength: number): Vec2[] => {
  if (points.length < 4) return points;
  const result: Vec2[] = [points[0]!];
  let i = 1;
  while (i < points.length - 1) {
    const prev = result[result.length - 1]!;
    const current = points[i]!;
    const next = points[i + 1]!;
    const legLength = lengthVec2(subVec2(next, current));
    const incomingLength = lengthVec2(subVec2(current, prev));
    if (
      legLength < minLength &&
      legLength < incomingLength * 0.3 &&
      i + 1 < points.length - 1
    ) {
      result.push(current);
      i += 2;
      continue;
    }
    result.push(current);
    i += 1;
  }
  if (points.length > 1) {
    result.push(points[points.length - 1]!);
  }
  return result;
};

/** Deduplicate consecutive equal points. */
const dedup = (points: ReadonlyArray<Vec2>): Vec2[] =>
  points.filter((p, i, arr) => i === 0 || !vec2Equal(p, arr[i - 1]!));

/** Deterministic hash for organic variation seeding. */
const hashStr = (s: string): number =>
  s.split('').reduce((acc, c) => (Math.imul(acc, 31) + c.charCodeAt(0)) | 0, 0x9e3779b9);

// ─── Smoothstep ─────────────────────────────────────────────────────────────

/** Hermite smoothstep: 3t² - 2t³. */
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

// ─── Cumulative arc-length computation ──────────────────────────────────────

/** Compute cumulative arc-length for each point in a 2D command list. */
const cumulativeLengths2D = (commands: ReadonlyArray<PathCommand2D>): number[] => {
  const lengths: number[] = [0];
  let total = 0;
  for (const cmd of commands) {
    if (cmd.kind === 'line') {
      total += lengthVec2(subVec2(cmd.to, cmd.from));
      lengths.push(total);
    } else {
      // Approximate cubic length by chord
      total += lengthVec2(subVec2(cmd.p3, cmd.p0));
      lengths.push(total);
    }
  }
  return lengths;
};

// ─── buildFlowPath ──────────────────────────────────────────────────────────

/**
 * Build a flow path from orthogonal waypoints.
 * Every 90° turn becomes a smooth cubic Bezier arc with the given radius.
 * Straight segments become lines. No sharp corners ever emitted.
 */
export function buildFlowPath(
  waypoints: ReadonlyArray<Vec2>,
  turnRadius: number,
): ReadonlyArray<PathCommand2D> {
  const cleaned = dedup(waypoints);
  const afterReversals = eliminateAxisReversals2D(cleaned);
  const rawPoints = collapseShortLegs2D(afterReversals, turnRadius);

  if (rawPoints.length < 2) return [];

  const commands: PathCommand2D[] = [];
  let cursor = rawPoints[0]!;

  for (let i = 1; i < rawPoints.length - 1; i += 1) {
    const prev = rawPoints[i - 1]!;
    const current = rawPoints[i]!;
    const next = rawPoints[i + 1]!;
    const incoming = subVec2(current, prev);
    const outgoing = subVec2(next, current);
    const incomingLength = lengthVec2(incoming);
    const outgoingLength = lengthVec2(outgoing);

    if (incomingLength < EPSILON || outgoingLength < EPSILON) {
      if (!vec2Equal(cursor, current)) {
        commands.push({ kind: 'line', from: cursor, to: current });
      }
      cursor = current;
      continue;
    }

    const incomingDir = normalizeVec2(incoming);
    const outgoingDir = normalizeVec2(outgoing);
    const turnDot = clamp(dotVec2(scaleVec2(incomingDir, -1), outgoingDir), -1, 1);
    const turnAngle = Math.acos(turnDot);

    // Near-straight or near-reversal: no arc
    if (turnAngle < 0.08 || Math.abs(Math.PI - turnAngle) < 0.08) {
      if (!vec2Equal(cursor, current)) {
        commands.push({ kind: 'line', from: cursor, to: current });
      }
      cursor = current;
      continue;
    }

    // Non-axis-aligned segments: no arc
    if (!isAxisAligned2D(incoming) || !isAxisAligned2D(outgoing)) {
      if (!vec2Equal(cursor, current)) {
        commands.push({ kind: 'line', from: cursor, to: current });
      }
      cursor = current;
      continue;
    }

    // Compute arc radius (cap at 90% of shorter adjacent segment)
    const radiusCap = Math.min(incomingLength * 0.9, outgoingLength * 0.9);
    const radius = Math.min(turnRadius, radiusCap);
    if (radius < EPSILON) {
      if (!vec2Equal(cursor, current)) {
        commands.push({ kind: 'line', from: cursor, to: current });
      }
      cursor = current;
      continue;
    }

    const handleLength = radius * ARC_KAPPA * clamp(turnAngle / (Math.PI / 2), 0.55, 1.25);

    // Snap tangent directions to exact cardinal axes
    const snapIn = snapToCardinal2D(incoming);
    const snapOut = snapToCardinal2D(outgoing);
    const startInset: Vec2 = addVec2(current, scaleVec2(snapIn, -radius));
    const endInset: Vec2 = addVec2(current, scaleVec2(snapOut, radius));

    if (!vec2Equal(cursor, startInset)) {
      commands.push({ kind: 'line', from: cursor, to: startInset });
    }
    commands.push({
      kind: 'cubic',
      p0: startInset,
      p1: addVec2(startInset, scaleVec2(snapIn, handleLength)),
      p2: addVec2(endInset, scaleVec2(snapOut, -handleLength)),
      p3: endInset,
    });
    cursor = endInset;
  }

  const last = rawPoints[rawPoints.length - 1]!;
  if (!vec2Equal(cursor, last)) {
    commands.push({ kind: 'line', from: cursor, to: last });
  }

  return commands;
}

// ─── buildCurvedPath ────────────────────────────────────────────────────────

/**
 * Build a curved path (single Bezier S-curve) between two anchors.
 * For a straight shot (no intermediate waypoints), emits a single cubic.
 * For paths with multiple turns, smooths the waypoints into a spline.
 */
export function buildCurvedPath(
  sourceAnchor: Vec2,
  destAnchor: Vec2,
  sourceNormal: Vec2,
  destNormal: Vec2,
  waypoints: ReadonlyArray<Vec2>,
  options?: { handleFactor?: number; handleMin?: number; handleMax?: number },
): ReadonlyArray<PathCommand2D> {
  const handleFactor = options?.handleFactor ?? 0.28;
  const handleMin = options?.handleMin ?? 0.04;
  const handleMax = options?.handleMax ?? 1.1;

  const src = sourceAnchor;
  const dst = destAnchor;
  const delta = subVec2(dst, src);
  const dist = lengthVec2(delta);

  if (dist < EPSILON) {
    return [{ kind: 'line', from: src, to: dst }];
  }

  const srcNorm = normalizeVec2(sourceNormal);
  const dstNorm = normalizeVec2(destNormal);

  // Check alignment for potential direct segment
  if (waypoints.length <= 1) {
    const dir = normalizeVec2(delta);
    const startAlign = dotVec2(srcNorm, dir);
    const endAlign = dotVec2(dstNorm, scaleVec2(dir, -1));
    const srcIsSide = Math.abs(srcNorm[0]) > Math.abs(srcNorm[1]);
    const dstIsSide = Math.abs(dstNorm[0]) > Math.abs(dstNorm[1]);

    // Direct segment for well-aligned, short, non-side edges
    if (
      !srcIsSide && !dstIsSide &&
      dist < 0.6 &&
      startAlign > 0.97 &&
      endAlign > 0.97
    ) {
      return [{ kind: 'line', from: src, to: dst }];
    }
  }

  // Compute handle lengths
  const baseHandle = clamp(dist * handleFactor, handleMin, handleMax);
  let startHandle = baseHandle;
  let endHandle = baseHandle;

  // Boost handles for side exits with large vertical delta
  const verticalDelta = Math.abs(delta[1]);
  const horizontalDelta = Math.abs(delta[0]);
  const srcIsSide = Math.abs(srcNorm[0]) > Math.abs(srcNorm[1]);
  const dstIsSide = Math.abs(dstNorm[0]) > Math.abs(dstNorm[1]);

  if (srcIsSide && verticalDelta > horizontalDelta * 0.3) {
    startHandle = Math.max(startHandle, Math.min(3.2, 0.45 + verticalDelta * 0.18));
  }
  if (dstIsSide && verticalDelta > horizontalDelta * 0.3) {
    endHandle = Math.max(endHandle, Math.min(3.2, 0.45 + verticalDelta * 0.18));
  }

  // Anti-parallel normal boost
  const dotNormals = dotVec2(srcNorm, dstNorm);
  if (dotNormals < -0.3) {
    startHandle = clamp(startHandle * 1.0, handleMin, handleMax);
    endHandle = clamp(endHandle * 1.0, handleMin, handleMax);
  }

  const c1 = addVec2(src, scaleVec2(srcNorm, startHandle));
  const c2 = addVec2(dst, scaleVec2(dstNorm, endHandle));

  return [{ kind: 'cubic', p0: src, p1: c1, p2: c2, p3: dst }];
}

// ─── buildStraightPath ──────────────────────────────────────────────────────

/**
 * Build a straight path (direct line between anchors).
 * If the A* route has turns (obstacles in the way), falls back to buildFlowPath.
 */
export function buildStraightPath(
  sourceAnchor: Vec2,
  destAnchor: Vec2,
  waypoints: ReadonlyArray<Vec2>,
  turnRadius: number,
): ReadonlyArray<PathCommand2D> {
  // Check if waypoints form a straight line (no turns)
  const allPoints = dedup([sourceAnchor, ...waypoints, destAnchor]);
  if (allPoints.length <= 2) {
    return [{ kind: 'line', from: sourceAnchor, to: destAnchor }];
  }

  // Check for turns in waypoints
  let hasTurns = false;
  for (let i = 1; i < allPoints.length - 1; i++) {
    const prev = allPoints[i - 1]!;
    const curr = allPoints[i]!;
    const next = allPoints[i + 1]!;
    const incoming = subVec2(curr, prev);
    const outgoing = subVec2(next, curr);
    const inLen = lengthVec2(incoming);
    const outLen = lengthVec2(outgoing);
    if (inLen < EPSILON || outLen < EPSILON) continue;
    const dot = dotVec2(normalizeVec2(incoming), normalizeVec2(outgoing));
    if (dot < 0.99) {
      hasTurns = true;
      break;
    }
  }

  if (!hasTurns) {
    return [{ kind: 'line', from: sourceAnchor, to: destAnchor }];
  }

  // Obstacles forced turns — fall back to flow path
  return buildFlowPath(allPoints, turnRadius);
}

// ─── buildOrganicPath ───────────────────────────────────────────────────────

/**
 * Build an organic path (curved + deterministic hash-based perturbation).
 * Hash is derived from edgeId — same inputs always produce the same output.
 */
export function buildOrganicPath(
  sourceAnchor: Vec2,
  destAnchor: Vec2,
  sourceNormal: Vec2,
  destNormal: Vec2,
  waypoints: ReadonlyArray<Vec2>,
  edgeId: string,
  variation: number,
): ReadonlyArray<PathCommand2D> {
  const base = buildCurvedPath(sourceAnchor, destAnchor, sourceNormal, destNormal, waypoints);

  // Apply organic offset only to single-cubic paths (4-point Bezier)
  if (base.length !== 1 || base[0]!.kind !== 'cubic') return base;

  const cmd = base[0]!;
  if (cmd.kind !== 'cubic') return base;

  const seed = Math.abs(hashStr(edgeId));
  const dx = cmd.p3[0] - cmd.p0[0];
  const dy = cmd.p3[1] - cmd.p0[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const edgeScale = Math.max(0.03, Math.min(0.18, len * 0.22));
  const offset = (((seed % 1000) / 1000) - 0.5) * variation * edgeScale;

  const c1: Vec2 = [cmd.p1[0] + perpX * offset * 1.15, cmd.p1[1] + perpY * offset * 1.15];
  const c2: Vec2 = [cmd.p2[0] - perpX * offset * 0.65, cmd.p2[1] - perpY * offset * 0.65];

  return [{ kind: 'cubic', p0: cmd.p0, p1: c1, p2: c2, p3: cmd.p3 }];
}

// ─── assignDepth ────────────────────────────────────────────────────────────

/**
 * Convert 2D path commands to 3D by assigning Z via smoothstep interpolation.
 * When sourceZ ≈ destZ, all points get the same Z (common flat case).
 */
export function assignDepth(
  commands: ReadonlyArray<PathCommand2D>,
  sourceZ: number,
  destZ: number,
  sourceDepth: number,
  destDepth: number,
): ReadonlyArray<DiagramEdgePathCommand> {
  const sourceMidZ = sourceZ - sourceDepth / 2;
  const destMidZ = destZ - destDepth / 2;

  // Fast path: same Z for all points
  if (Math.abs(sourceMidZ - destMidZ) < EPSILON) {
    return commands.map((cmd): DiagramEdgePathCommand => {
      if (cmd.kind === 'line') {
        return {
          kind: 'line',
          from: vec3(cmd.from, sourceMidZ),
          to: vec3(cmd.to, sourceMidZ),
        };
      }
      return {
        kind: 'cubic',
        p0: vec3(cmd.p0, sourceMidZ),
        p1: vec3(cmd.p1, sourceMidZ),
        p2: vec3(cmd.p2, sourceMidZ),
        p3: vec3(cmd.p3, sourceMidZ),
      };
    });
  }

  // Compute cumulative arc-length fractions for Z interpolation
  const lengths = cumulativeLengths2D(commands);
  const totalLength = lengths[lengths.length - 1]!;

  const zAt = (cumulativeLen: number): number => {
    if (totalLength < EPSILON) return sourceMidZ;
    const t = clamp(cumulativeLen / totalLength, 0, 1);
    return sourceMidZ + (destMidZ - sourceMidZ) * smoothstep(t);
  };

  return commands.map((cmd, i): DiagramEdgePathCommand => {
    const startLen = lengths[i]!;
    const endLen = lengths[i + 1]!;

    if (cmd.kind === 'line') {
      return {
        kind: 'line',
        from: vec3(cmd.from, zAt(startLen)),
        to: vec3(cmd.to, zAt(endLen)),
      };
    }

    // For cubics, place control points at 1/3 and 2/3 of the segment arc-length
    const segLen = endLen - startLen;
    return {
      kind: 'cubic',
      p0: vec3(cmd.p0, zAt(startLen)),
      p1: vec3(cmd.p1, zAt(startLen + segLen / 3)),
      p2: vec3(cmd.p2, zAt(startLen + (segLen * 2) / 3)),
      p3: vec3(cmd.p3, zAt(endLen)),
    };
  });
}

// ─── commandsToControlPoints ────────────────────────────────────────────────

const vec3Equal = (a: Vec3, b: Vec3): boolean =>
  Math.abs(a[0] - b[0]) < EPSILON &&
  Math.abs(a[1] - b[1]) < EPSILON &&
  Math.abs(a[2] - b[2]) < EPSILON;

/**
 * Extract control points from 3D path commands (for the compiled DiagramState).
 */
export function commandsToControlPoints(
  commands: ReadonlyArray<DiagramEdgePathCommand>,
): ReadonlyArray<Vec3> {
  const points: Vec3[] = [];

  const pushUnique = (point: Vec3): void => {
    const last = points[points.length - 1];
    if (!last || !vec3Equal(last, point)) points.push(point);
  };

  for (const command of commands) {
    if (command.kind === 'line') {
      pushUnique(command.from as Vec3);
      pushUnique(command.to as Vec3);
      continue;
    }
    pushUnique(command.p0 as Vec3);
    pushUnique(command.p1 as Vec3);
    pushUnique(command.p2 as Vec3);
    pushUnique(command.p3 as Vec3);
  }

  return points;
}
