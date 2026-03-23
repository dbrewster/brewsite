// Shared trunk trimming — identifies edges sharing a leading path segment
// from the same source node, and trims the shorter edge's shared prefix
// so only the longest edge renders the trunk.

import type { DiagramEdgePathCommand, DiagramEdgePathState, DiagramEdgeState } from '../../types';

// ─── Constants ──────────────────────────────────────────────────────────────

const EPSILON = 1e-6;
const TRUNK_NEARNESS_TOLERANCE = 0.005;

// ─── Vec3 helpers (used for command manipulation) ───────────────────────────

type Vec3 = readonly [number, number, number];

const pointsEqual = (a: Vec3, b: Vec3): boolean =>
  Math.abs(a[0] - b[0]) < EPSILON &&
  Math.abs(a[1] - b[1]) < EPSILON &&
  Math.abs(a[2] - b[2]) < EPSILON;

const planarPointsEqual = (a: Vec3, b: Vec3): boolean =>
  Math.abs(a[0] - b[0]) < TRUNK_NEARNESS_TOLERANCE &&
  Math.abs(a[1] - b[1]) < TRUNK_NEARNESS_TOLERANCE;

// ─── Tangent extraction ─────────────────────────────────────────────────────

const tangentFromCommand = (
  command: DiagramEdgePathCommand | undefined,
  kind: 'start' | 'end',
): Vec3 | undefined => {
  if (!command) return undefined;
  if (command.kind === 'line') {
    const start = kind === 'start' ? command.from : command.to;
    const end = kind === 'start' ? command.to : command.from;
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    return [dx / len, dy / len, dz / len];
  }
  const start = kind === 'start' ? command.p0 : command.p3;
  const handle = kind === 'start' ? command.p1 : command.p2;
  const dx = kind === 'start' ? handle[0] - start[0] : start[0] - handle[0];
  const dy = kind === 'start' ? handle[1] - start[1] : start[1] - handle[1];
  const dz = kind === 'start' ? handle[2] - start[2] : start[2] - handle[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  return [dx / len, dy / len, dz / len];
};

// ─── Axis detection ─────────────────────────────────────────────────────────

const axisForVector = (
  dx: number,
  dy: number,
  dz: number,
): 'x' | 'y' | 'z' | null => {
  if (Math.abs(dy) < EPSILON && Math.abs(dz) < EPSILON && Math.abs(dx) > EPSILON) return 'x';
  if (Math.abs(dx) < EPSILON && Math.abs(dz) < EPSILON && Math.abs(dy) > EPSILON) return 'y';
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON && Math.abs(dz) > EPSILON) return 'z';
  return null;
};

// ─── Control point extraction ───────────────────────────────────────────────

const commandsToControlPoints = (
  commands: ReadonlyArray<DiagramEdgePathCommand>,
): ReadonlyArray<Vec3> => {
  const points: Vec3[] = [];
  const pushUnique = (point: Vec3): void => {
    const last = points[points.length - 1];
    if (!last || !pointsEqual(last, point)) points.push(point);
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
};

/** Extract path vertices (start/end of each command, skipping cubic control points). */
const commandsToPathVertices = (
  commands: ReadonlyArray<DiagramEdgePathCommand>,
): ReadonlyArray<Vec3> => {
  const points: Vec3[] = [];
  const pushUnique = (point: Vec3): void => {
    const last = points[points.length - 1];
    if (!last || !pointsEqual(last, point)) points.push(point);
  };
  for (const command of commands) {
    if (command.kind === 'line') {
      pushUnique(command.from as Vec3);
      pushUnique(command.to as Vec3);
      continue;
    }
    pushUnique(command.p0 as Vec3);
    pushUnique(command.p3 as Vec3);
  }
  return points;
};

/** Deduplicate vertices that are planar-equal (ignoring Z). */
const commandsToPlanarControlPoints = (
  commands: ReadonlyArray<DiagramEdgePathCommand>,
): ReadonlyArray<Vec3> => {
  const points = commandsToPathVertices(commands);
  const planarPoints: Vec3[] = [];
  for (const point of points) {
    const last = planarPoints[planarPoints.length - 1];
    if (!last || !planarPointsEqual(last, point)) {
      planarPoints.push(point);
    }
  }
  return planarPoints;
};

// ─── 2D planar distance (XY only) ──────────────────────────────────────────

const planarSegmentLength = (from: Vec3, to: Vec3): number =>
  Math.hypot(to[0] - from[0], to[1] - from[1]);

const computePlanarPathLength = (edge: DiagramEdgeState): number => {
  const points = commandsToPlanarControlPoints(edge.path.commands);
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += planarSegmentLength(points[i - 1]!, points[i]!);
  }
  return length;
};

const samePlanarDirection = (
  fromA: Vec3, toA: Vec3,
  fromB: Vec3, toB: Vec3,
): boolean => {
  const dxA = toA[0] - fromA[0];
  const dyA = toA[1] - fromA[1];
  const dxB = toB[0] - fromB[0];
  const dyB = toB[1] - fromB[1];
  const lenA = Math.hypot(dxA, dyA);
  const lenB = Math.hypot(dxB, dyB);
  if (lenA <= EPSILON || lenB <= EPSILON) return false;
  return (
    Math.abs(dxA / lenA - dxB / lenB) <= TRUNK_NEARNESS_TOLERANCE &&
    Math.abs(dyA / lenA - dyB / lenB) <= TRUNK_NEARNESS_TOLERANCE
  );
};

const pointAlongSegment = (from: Vec3, to: Vec3, planarDistance: number): Vec3 => {
  const segmentLength = planarSegmentLength(from, to);
  if (segmentLength <= EPSILON) return to;
  const t = planarDistance / segmentLength;
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];
};

// ─── Shared leading distance computation ────────────────────────────────────

const computeSharedLeadingPlanarDistance = (
  follower: DiagramEdgeState,
  leader: DiagramEdgeState,
): number => {
  const followerPoints = commandsToPlanarControlPoints(follower.path.commands);
  const leaderPoints = commandsToPlanarControlPoints(leader.path.commands);
  const followerStart = followerPoints[0];
  const leaderStart = leaderPoints[0];
  if (!followerStart || !leaderStart || !planarPointsEqual(followerStart, leaderStart)) {
    return 0;
  }

  let followerIndex = 0;
  let leaderIndex = 0;
  let followerFrom = followerStart;
  let leaderFrom = leaderStart;
  let sharedDistance = 0;

  while (followerIndex < followerPoints.length - 1 && leaderIndex < leaderPoints.length - 1) {
    const followerTo = followerPoints[followerIndex + 1]!;
    const leaderTo = leaderPoints[leaderIndex + 1]!;
    const followerLen = planarSegmentLength(followerFrom, followerTo);
    const leaderLen = planarSegmentLength(leaderFrom, leaderTo);

    if (followerLen <= EPSILON) {
      followerIndex += 1;
      followerFrom = followerTo;
      continue;
    }
    if (leaderLen <= EPSILON) {
      leaderIndex += 1;
      leaderFrom = leaderTo;
      continue;
    }
    if (!planarPointsEqual(followerFrom, leaderFrom)) break;
    if (!samePlanarDirection(followerFrom, followerTo, leaderFrom, leaderTo)) break;

    const overlap = Math.min(followerLen, leaderLen);
    sharedDistance += overlap;

    if (Math.abs(followerLen - overlap) <= EPSILON) {
      followerIndex += 1;
      followerFrom = followerTo;
    } else {
      followerFrom = pointAlongSegment(followerFrom, followerTo, overlap);
    }

    if (Math.abs(leaderLen - overlap) <= EPSILON) {
      leaderIndex += 1;
      leaderFrom = leaderTo;
    } else {
      leaderFrom = pointAlongSegment(leaderFrom, leaderTo, overlap);
    }
  }

  return sharedDistance;
};

// ─── Depth-only segment detection ───────────────────────────────────────────

const commandMovesOnlyInDepth = (command: DiagramEdgePathCommand): boolean => {
  if (command.kind === 'line') {
    return (
      Math.abs(command.to[0] - command.from[0]) <= EPSILON &&
      Math.abs(command.to[1] - command.from[1]) <= EPSILON &&
      Math.abs(command.to[2] - command.from[2]) > EPSILON
    );
  }
  return (
    Math.abs(command.p3[0] - command.p0[0]) <= EPSILON &&
    Math.abs(command.p3[1] - command.p0[1]) <= EPSILON &&
    Math.abs(command.p3[2] - command.p0[2]) > EPSILON
  );
};

const stripInitialDepthOnlySegments = (
  commands: ReadonlyArray<DiagramEdgePathCommand>,
): DiagramEdgePathCommand[] => {
  let startIndex = 0;
  while (startIndex < commands.length && commandMovesOnlyInDepth(commands[startIndex]!)) {
    startIndex += 1;
  }
  return commands.slice(startIndex);
};

// ─── Turn collapse ──────────────────────────────────────────────────────────

const collapseInitialTurnIntoJunction = (
  commands: ReadonlyArray<DiagramEdgePathCommand>,
): DiagramEdgePathCommand[] => {
  const first = commands[0];
  if (!first) return [...commands];

  if (first.kind === 'cubic') {
    const incomingAxis = axisForVector(
      first.p1[0] - first.p0[0],
      first.p1[1] - first.p0[1],
      first.p1[2] - first.p0[2],
    );
    const outgoingAxis = axisForVector(
      first.p3[0] - first.p2[0],
      first.p3[1] - first.p2[1],
      first.p3[2] - first.p2[2],
    );
    if (!incomingAxis || !outgoingAxis || incomingAxis === outgoingAxis) return [...commands];

    const junction: Vec3 = incomingAxis === 'x'
      ? [first.p3[0], first.p0[1], first.p0[2]]
      : incomingAxis === 'y'
        ? [first.p0[0], first.p3[1], first.p0[2]]
        : [first.p0[0], first.p0[1], first.p3[2]];
    const collapsed: DiagramEdgePathCommand[] = [];
    if (!pointsEqual(junction, first.p3 as Vec3)) {
      collapsed.push({ kind: 'line', from: junction, to: first.p3 });
    }
    collapsed.push(...commands.slice(1));
    return collapsed;
  }

  if (commands.length < 2) return [...commands];

  const second = commands[1];
  if (!second || first.kind !== 'line' || second.kind !== 'cubic') return [...commands];
  if (!pointsEqual(first.to as Vec3, second.p0 as Vec3)) return [...commands];

  const incomingAxis = axisForVector(
    first.to[0] - first.from[0],
    first.to[1] - first.from[1],
    first.to[2] - first.from[2],
  );
  const outgoingAxis = axisForVector(
    second.p3[0] - second.p2[0],
    second.p3[1] - second.p2[1],
    second.p3[2] - second.p2[2],
  );
  if (!incomingAxis || !outgoingAxis || incomingAxis === outgoingAxis) return [...commands];

  const junction: Vec3 = incomingAxis === 'x'
    ? [second.p3[0], second.p0[1], second.p0[2]]
    : incomingAxis === 'y'
      ? [second.p0[0], second.p3[1], second.p0[2]]
      : [second.p0[0], second.p0[1], second.p3[2]];

  const collapsed: DiagramEdgePathCommand[] = [];
  if (!pointsEqual(junction, second.p3 as Vec3)) {
    collapsed.push({ kind: 'line', from: junction, to: second.p3 });
  }
  collapsed.push(...commands.slice(2));
  return collapsed;
};

/** Normalize trimmed branch commands: strip depth-only stubs and collapse leading turns. */
const normalizeTrimmedBranchCommands = (
  commands: ReadonlyArray<DiagramEdgePathCommand>,
): DiagramEdgePathCommand[] => {
  let normalized = stripInitialDepthOnlySegments(commands);
  normalized = collapseInitialTurnIntoJunction(normalized);
  normalized = stripInitialDepthOnlySegments(normalized);
  normalized = collapseInitialTurnIntoJunction(normalized);
  return normalized;
};

// ─── Eligibility checks ────────────────────────────────────────────────────

const canShareRenderedTrunk = (edge: DiagramEdgeState): boolean =>
  edge.routing === 'flow' &&
  edge.path.commands.length >= 1 &&
  edge.arrowStart === 'none' &&
  edge.style === 'solid';

const sameRenderSignature = (a: DiagramEdgeState, b: DiagramEdgeState): boolean =>
  a.color === b.color &&
  a.thickness === b.thickness &&
  a.opacity === b.opacity &&
  a.style === b.style &&
  a.flow === b.flow &&
  a.flowColor === b.flowColor;

// ─── Leading run detection ──────────────────────────────────────────────────

type LeadingRun = {
  readonly start: Vec3;
  readonly end: Vec3;
  readonly direction: Vec3;
  readonly length: number;
  readonly axis: 'x' | 'y';
  readonly anchor: number;
};

function getLeadingRun(edge: DiagramEdgeState): LeadingRun | null {
  const points = commandsToControlPoints(edge.path.commands);
  if (points.length < 2) return null;

  const start = points[0]!;
  let axis: 'x' | 'y' | undefined;
  let directionSign = 0;
  let anchor = 0;
  let totalLength = 0;
  let currentEnd = start;

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1]!;
    const current = points[i]!;
    const dx = current[0] - previous[0];
    const dy = current[1] - previous[1];

    if (Math.abs(dx) <= EPSILON && Math.abs(dy) <= EPSILON) {
      currentEnd = current;
      continue;
    }

    const segAxis: 'x' | 'y' | null =
      Math.abs(dx) > EPSILON && Math.abs(dy) <= TRUNK_NEARNESS_TOLERANCE
        ? 'x'
        : Math.abs(dy) > EPSILON && Math.abs(dx) <= TRUNK_NEARNESS_TOLERANCE
          ? 'y'
          : null;
    if (!segAxis) break;

    const segDelta = segAxis === 'x' ? dx : dy;
    const segSign = segDelta >= 0 ? 1 : -1;
    const segAnchor = segAxis === 'x' ? previous[1] : previous[0];
    const segEndAnchor = segAxis === 'x' ? current[1] : current[0];

    if (!axis) {
      axis = segAxis;
      directionSign = segSign;
      anchor = segAnchor;
    }

    if (
      segAxis !== axis ||
      segSign !== directionSign ||
      Math.abs(segAnchor - anchor) > TRUNK_NEARNESS_TOLERANCE ||
      Math.abs(segEndAnchor - anchor) > TRUNK_NEARNESS_TOLERANCE
    ) {
      break;
    }

    totalLength += Math.abs(segDelta);
    currentEnd = current;
  }

  if (!axis || totalLength <= EPSILON) return null;

  return {
    start,
    end: currentEnd,
    direction: axis === 'x' ? [directionSign, 0, 0] : [0, directionSign, 0],
    length: totalLength,
    axis,
    anchor,
  };
}

function getAxisValue(point: Vec3, axis: LeadingRun['axis']): number {
  switch (axis) {
    case 'x': return point[0];
    case 'y': return point[1];
  }
}

function runsShareLine(a: LeadingRun, b: LeadingRun): boolean {
  return (
    a.axis === b.axis &&
    Math.abs(a.anchor - b.anchor) <= TRUNK_NEARNESS_TOLERANCE &&
    Math.abs(a.direction[0] - b.direction[0]) <= TRUNK_NEARNESS_TOLERANCE &&
    Math.abs(a.direction[1] - b.direction[1]) <= TRUNK_NEARNESS_TOLERANCE &&
    Math.abs(a.direction[2] - b.direction[2]) <= TRUNK_NEARNESS_TOLERANCE
  );
}

function computeSharedLeadingDistance(
  follower: LeadingRun,
  leader: LeadingRun,
): number {
  if (!runsShareLine(follower, leader)) return 0;

  const followerStart = getAxisValue(follower.start, follower.axis);
  const followerEnd = getAxisValue(follower.end, follower.axis);
  const leaderStart = getAxisValue(leader.start, leader.axis);
  const leaderEnd = getAxisValue(leader.end, leader.axis);
  const leaderMin = Math.min(leaderStart, leaderEnd) - TRUNK_NEARNESS_TOLERANCE;
  const leaderMax = Math.max(leaderStart, leaderEnd) + TRUNK_NEARNESS_TOLERANCE;

  if (followerStart < leaderMin || followerStart > leaderMax) return 0;

  if (followerEnd >= followerStart) {
    const overlapEnd = Math.min(followerEnd, leaderEnd);
    return overlapEnd > followerStart + EPSILON ? overlapEnd - followerStart : 0;
  }

  const overlapEnd = Math.max(followerEnd, leaderEnd);
  return overlapEnd < followerStart - EPSILON ? followerStart - overlapEnd : 0;
}

// ─── Edge trimming ──────────────────────────────────────────────────────────

function trimEdgePathByDistance(
  edge: DiagramEdgeState,
  distance: number,
): DiagramEdgeState | null {
  if (distance <= EPSILON) return edge;
  let remaining = distance;
  const trimmedCommands: DiagramEdgePathCommand[] = [];

  for (const command of edge.path.commands) {
    if (remaining <= EPSILON) {
      trimmedCommands.push(command);
      continue;
    }

    if (commandMovesOnlyInDepth(command)) {
      continue;
    }

    if (command.kind !== 'line') {
      trimmedCommands.push(command);
      remaining = 0;
      continue;
    }

    const planarLen = planarSegmentLength(command.from as Vec3, command.to as Vec3);
    if (planarLen <= EPSILON) {
      continue;
    }

    if (planarLen <= remaining + EPSILON) {
      remaining -= planarLen;
      continue;
    }

    if (remaining > EPSILON) {
      const t = remaining / planarLen;
      trimmedCommands.push({
        kind: 'line',
        from: [
          command.from[0] + (command.to[0] - command.from[0]) * t,
          command.from[1] + (command.to[1] - command.from[1]) * t,
          command.from[2] + (command.to[2] - command.from[2]) * t,
        ],
        to: command.to,
      });
      remaining = 0;
      continue;
    }

    trimmedCommands.push(command);
  }

  if (trimmedCommands.length === 0) return null;
  const normalizedCommands = normalizeTrimmedBranchCommands(trimmedCommands);
  if (normalizedCommands.length === 0) return null;

  const trimmedPath: DiagramEdgePathState = {
    ...edge.path,
    commands: normalizedCommands,
    startTangent: tangentFromCommand(normalizedCommands[0], 'start') ?? edge.path.startTangent,
  };

  return {
    ...edge,
    path: trimmedPath,
    controlPoints: commandsToControlPoints(normalizedCommands),
    pathDebug: edge.pathDebug
      ? {
        ...edge.pathDebug,
        rankKey: edge.pathDebug.rankKey,
      }
      : edge.pathDebug,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Optimize shared flow trunks — identifies edges sharing a leading path
 * from the same source node, and trims the shorter edge's shared prefix.
 * Uses 2D (XY) path length for trimming decisions; Z is passthrough.
 */
export function optimizeSharedFlowTrunks(
  edges: ReadonlyArray<DiagramEdgeState>,
): ReadonlyArray<DiagramEdgeState> {
  const bySource = new Map<string, DiagramEdgeState[]>();
  for (const edge of edges) {
    if (!canShareRenderedTrunk(edge)) continue;
    const bucket = bySource.get(edge.fromId) ?? [];
    bucket.push(edge);
    bySource.set(edge.fromId, bucket);
  }

  const replacements = new Map<string, DiagramEdgeState>();

  bySource.forEach((sourceEdges) => {
    const leaders: DiagramEdgeState[] = [];
    const ordered = [...sourceEdges].sort((a, b) => {
      const lengthA = computePlanarPathLength(a);
      const lengthB = computePlanarPathLength(b);
      return lengthB - lengthA;
    });

    for (const edge of ordered) {
      let bestLeader: DiagramEdgeState | undefined;
      let bestSharedDistance = 0;
      const edgeRun = getLeadingRun(edge);
      const edgePlanarLength = computePlanarPathLength(edge);

      for (const leader of leaders) {
        if (!sameRenderSignature(edge, leader)) continue;
        const leaderRun = getLeadingRun(leader);
        const leaderPlanarLength = computePlanarPathLength(leader);
        if (
          sourceEdges.length > 2 &&
          leaderPlanarLength <= edgePlanarLength + TRUNK_NEARNESS_TOLERANCE
        ) {
          continue;
        }
        const shared = computeSharedLeadingPlanarDistance(edge, leader) ||
          (edgeRun && leaderRun ? computeSharedLeadingDistance(edgeRun, leaderRun) : 0);
        if (shared > bestSharedDistance) {
          bestSharedDistance = shared;
          bestLeader = leader;
        }
      }

      if (!bestLeader || bestSharedDistance <= EPSILON) {
        leaders.push(edge);
        continue;
      }

      const trimmed = trimEdgePathByDistance(edge, bestSharedDistance);
      if (trimmed) replacements.set(edge.id, trimmed);
    }
  });

  return edges.map((edge) => replacements.get(edge.id) ?? edge);
}
