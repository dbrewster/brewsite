// A* Manhattan routing with obstacle avoidance on a 2D visibility graph.

import type { Vec2, Rect2D } from './routingTypes';
import type { Obstacle } from './obstacleModel';

// ─── Exported types ──────────────────────────────────────────────────────────

/** Result of the orthogonal routing pass. */
export type OrthogonalRouteResult = {
  readonly waypoints: ReadonlyArray<Vec2>;
  readonly punctures: ReadonlyArray<{ obstacleId: string; direction: string }>;
  readonly bendCount: number;
  readonly pathLength: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const EPSILON = 1e-6;

// ─── Direction helpers ───────────────────────────────────────────────────────

type Direction2D = 'N' | 'S' | 'E' | 'W';

const manhattanDistance = (a: Vec2, b: Vec2): number =>
  Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);

const axisAligned = (a: Vec2, b: Vec2): boolean =>
  Math.abs(a[0] - b[0]) < EPSILON || Math.abs(a[1] - b[1]) < EPSILON;

const directionBetween = (a: Vec2, b: Vec2): Direction2D | null => {
  if (Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON) return null;
  if (Math.abs(a[0] - b[0]) < EPSILON) return b[1] > a[1] ? 'N' : 'S';
  if (Math.abs(a[1] - b[1]) < EPSILON) return b[0] > a[0] ? 'E' : 'W';
  return null;
};

const oppositeDirection = (dir: Direction2D): Direction2D => {
  switch (dir) {
    case 'N': return 'S';
    case 'S': return 'N';
    case 'E': return 'W';
    case 'W': return 'E';
  }
};

// ─── Geometry helpers ────────────────────────────────────────────────────────

const pointStrictlyInsideRect = (point: Vec2, rect: Rect2D): boolean =>
  point[0] > rect.left + EPSILON &&
  point[0] < rect.right - EPSILON &&
  point[1] > rect.bottom + EPSILON &&
  point[1] < rect.top - EPSILON;

const rangesOverlap = (a0: number, a1: number, b0: number, b1: number): boolean =>
  Math.max(Math.min(a0, a1), Math.min(b0, b1)) < Math.min(Math.max(a0, a1), Math.max(b0, b1)) - EPSILON;

const segmentIntersectsRect2D = (
  start: Vec2,
  end: Vec2,
  rect: Rect2D,
): boolean => {
  if (!axisAligned(start, end)) return true;
  if (Math.abs(start[0] - end[0]) < EPSILON) {
    const x = start[0];
    if (x <= rect.left + EPSILON || x >= rect.right - EPSILON) return false;
    return rangesOverlap(start[1], end[1], rect.bottom, rect.top);
  }
  const y = start[1];
  if (y <= rect.bottom + EPSILON || y >= rect.top - EPSILON) return false;
  return rangesOverlap(start[0], end[0], rect.left, rect.right);
};

const segmentAllowedByCorridor = (
  start: Vec2,
  end: Vec2,
  corridor: Rect2D,
): boolean => {
  if (!axisAligned(start, end)) return false;
  if (Math.abs(start[0] - end[0]) < EPSILON) {
    const x = start[0];
    return x >= corridor.left - EPSILON &&
      x <= corridor.right + EPSILON &&
      Math.min(start[1], end[1]) >= corridor.bottom - EPSILON &&
      Math.max(start[1], end[1]) <= corridor.top + EPSILON;
  }
  const y = start[1];
  return y >= corridor.bottom - EPSILON &&
    y <= corridor.top + EPSILON &&
    Math.min(start[0], end[0]) >= corridor.left - EPSILON &&
    Math.max(start[0], end[0]) <= corridor.right + EPSILON;
};

const segmentAllowedByAnyCorridor = (
  start: Vec2,
  end: Vec2,
  corridors: ReadonlyArray<Rect2D>,
): boolean => corridors.some((corridor) => segmentAllowedByCorridor(start, end, corridor));

// ─── Segment assessment ──────────────────────────────────────────────────────

type SegmentAssessment = {
  readonly blocked: boolean;
  readonly penalty: number;
  readonly punctures: ReadonlyArray<{
    readonly obstacleId: string;
    readonly direction: string;
  }>;
};

const assessSegment = (
  start: Vec2,
  end: Vec2,
  obstacles: ReadonlyArray<Obstacle>,
  punchthroughPenalty: number,
  allowSoftPuncture: boolean,
  allowHardPuncture: boolean,
): SegmentAssessment => {
  if (!axisAligned(start, end)) {
    return { blocked: true, penalty: Infinity, punctures: [] };
  }

  let penalty = 0;
  const punctures: Array<{ obstacleId: string; direction: string }> = [];

  for (const obstacle of obstacles) {
    if (!segmentIntersectsRect2D(start, end, obstacle.expandedRect)) continue;

    // Owning groups are transparent — edges that start or end inside
    // the group pass through freely. The stub controls the exit point.
    if (obstacle.ownsEndpoint) continue;

    if (obstacle.hard && !allowHardPuncture) {
      return { blocked: true, penalty: Infinity, punctures: [] };
    }
    if (!obstacle.hard && !allowSoftPuncture) {
      return { blocked: true, penalty: Infinity, punctures: [] };
    }

    penalty += obstacle.hard ? punchthroughPenalty : punchthroughPenalty * 0.85;
    punctures.push({
      obstacleId: obstacle.id,
      direction: obstacle.kind,
    });
  }

  return {
    blocked: false,
    penalty,
    punctures: dedupePunctures(punctures),
  };
};

// ─── Path utilities ──────────────────────────────────────────────────────────

const dedupePunctures = (
  punctures: ReadonlyArray<{ readonly obstacleId: string; readonly direction: string }>,
): ReadonlyArray<{ obstacleId: string; direction: string }> => {
  const seen = new Set<string>();
  const unique: Array<{ obstacleId: string; direction: string }> = [];
  for (const puncture of punctures) {
    const key = `${puncture.direction}:${puncture.obstacleId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ obstacleId: puncture.obstacleId, direction: puncture.direction });
  }
  return unique;
};

const compressWaypoints = (waypoints: ReadonlyArray<Vec2>): ReadonlyArray<Vec2> => {
  if (waypoints.length <= 2) return waypoints;
  const compressed: Vec2[] = [waypoints[0]!];
  for (let i = 1; i < waypoints.length - 1; i += 1) {
    const prev = compressed[compressed.length - 1]!;
    const current = waypoints[i]!;
    const next = waypoints[i + 1]!;
    const inDir = directionBetween(prev, current);
    const outDir = directionBetween(current, next);
    if (inDir && outDir && inDir === outDir) continue;
    compressed.push(current);
  }
  compressed.push(waypoints[waypoints.length - 1]!);
  return compressed;
};

// ─── Priority queue ──────────────────────────────────────────────────────────

class MinQueue<T> {
  private readonly items: Array<{ priority: number; value: T }> = [];

  push(value: T, priority: number): void {
    this.items.push({ value, priority });
    this.bubbleUp(this.items.length - 1);
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0]!;
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return top.value;
  }

  get size(): number {
    return this.items.length;
  }

  private bubbleUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.items[parent]!.priority <= this.items[current]!.priority) break;
      [this.items[parent], this.items[current]] = [this.items[current]!, this.items[parent]!];
      current = parent;
    }
  }

  private bubbleDown(index: number): void {
    let current = index;
    while (true) {
      const left = current * 2 + 1;
      const right = left + 1;
      let smallest = current;
      if (left < this.items.length && this.items[left]!.priority < this.items[smallest]!.priority) smallest = left;
      if (right < this.items.length && this.items[right]!.priority < this.items[smallest]!.priority) smallest = right;
      if (smallest === current) break;
      [this.items[current], this.items[smallest]] = [this.items[smallest]!, this.items[current]!];
      current = smallest;
    }
  }
}

// ─── Visibility graph construction ───────────────────────────────────────────

const buildCandidateVertices = (
  start: Vec2,
  end: Vec2,
  obstacles: ReadonlyArray<Obstacle>,
): Vec2[] => {
  const xs = new Set<number>([start[0], end[0]]);
  const ys = new Set<number>([start[1], end[1]]);

  for (const obstacle of obstacles) {
    xs.add(obstacle.expandedRect.left);
    xs.add(obstacle.expandedRect.right);
    ys.add(obstacle.expandedRect.bottom);
    ys.add(obstacle.expandedRect.top);
    for (const corridor of obstacle.allowedCorridors) {
      xs.add(corridor.left);
      xs.add(corridor.right);
      ys.add(corridor.bottom);
      ys.add(corridor.top);
    }
  }

  // Add midpoint Y values between adjacent obstacle rows. This gives the
  // A* router balanced routing options between obstacles instead of forcing
  // horizontal runs to hug obstacle boundaries. It prevents splits from
  // occurring right next to a node or visible group edge.
  const baseYs = [...ys].sort((a, b) => a - b);
  for (let i = 0; i < baseYs.length - 1; i++) {
    const gap = baseYs[i + 1]! - baseYs[i]!;
    if (gap > EPSILON * 2) {
      ys.add((baseYs[i]! + baseYs[i + 1]!) / 2);
    }
  }

  // Same for X — balanced vertical routing segments between obstacles.
  const baseXs = [...xs].sort((a, b) => a - b);
  for (let i = 0; i < baseXs.length - 1; i++) {
    const gap = baseXs[i + 1]! - baseXs[i]!;
    if (gap > EPSILON * 2) {
      xs.add((baseXs[i]! + baseXs[i + 1]!) / 2);
    }
  }

  const vertices: Vec2[] = [start, end];
  const seen = new Set<string>([
    `${start[0].toFixed(6)}:${start[1].toFixed(6)}`,
    `${end[0].toFixed(6)}:${end[1].toFixed(6)}`,
  ]);

  const sortedX = [...xs].sort((a, b) => a - b);
  const sortedY = [...ys].sort((a, b) => a - b);

  for (const x of sortedX) {
    for (const y of sortedY) {
      const point: Vec2 = [x, y];
      const inside = obstacles.some((obstacle) =>
        !obstacle.ownsEndpoint &&
        pointStrictlyInsideRect(point, obstacle.expandedRect) &&
        !obstacle.allowedCorridors.some((corridor) => pointStrictlyInsideRect(point, corridor)),
      );
      if (inside) continue;
      const key = `${x.toFixed(6)}:${y.toFixed(6)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      vertices.push(point);
    }
  }

  return vertices;
};

// ─── Path reconstruction ─────────────────────────────────────────────────────

const reconstructPath = (
  previous: Map<string, { prevKey: string | null; vertexIndex: number }>,
  stateKey: string,
  vertices: ReadonlyArray<Vec2>,
): ReadonlyArray<Vec2> => {
  const path: Vec2[] = [];
  let cursor: string | null = stateKey;
  while (cursor) {
    const state = previous.get(cursor);
    if (!state) break;
    path.push(vertices[state.vertexIndex]!);
    cursor = state.prevKey;
  }
  return compressWaypoints(path.reverse());
};

// ─── A* search ───────────────────────────────────────────────────────────────

const searchVisibilityRoute = (
  start: Vec2,
  end: Vec2,
  obstacles: ReadonlyArray<Obstacle>,
  approachDirection: Direction2D,
  turnPenalty: number,
  punchthroughPenalty: number,
  allowSoftPuncture: boolean,
  allowHardPuncture: boolean,
): OrthogonalRouteResult | null => {
  const vertices = buildCandidateVertices(start, end, obstacles);
  const startIndex = 0;
  const endIndex = 1;

  const frontier = new MinQueue<string>();
  frontier.push(`none:${startIndex}`, 0);

  const costs = new Map<string, number>([[`none:${startIndex}`, 0]]);
  const previous = new Map<string, { prevKey: string | null; vertexIndex: number }>([
    [`none:${startIndex}`, { prevKey: null, vertexIndex: startIndex }],
  ]);
  const punctureByState = new Map<string, ReadonlyArray<{ obstacleId: string; direction: string }>>([
    [`none:${startIndex}`, []],
  ]);

  const segmentAssessmentCache = new Map<string, SegmentAssessment>();
  const searchMode = allowSoftPuncture || allowHardPuncture ? 'puncture' : 'clean';

  const assessSegmentByIndex = (fromIndex: number, toIndex: number): SegmentAssessment => {
    const key = fromIndex < toIndex
      ? `${searchMode}:${fromIndex}:${toIndex}`
      : `${searchMode}:${toIndex}:${fromIndex}`;
    const cached = segmentAssessmentCache.get(key);
    if (cached) return cached;
    const assessment = assessSegment(
      vertices[fromIndex]!,
      vertices[toIndex]!,
      obstacles,
      punchthroughPenalty,
      allowSoftPuncture,
      allowHardPuncture,
    );
    segmentAssessmentCache.set(key, assessment);
    return assessment;
  };

  while (frontier.size > 0) {
    const currentKey = frontier.pop()!;
    const [prevDirRaw, currentIndexRaw] = currentKey.split(':');
    const currentIndex = Number(currentIndexRaw);
    const current = vertices[currentIndex]!;
    const prevDir = prevDirRaw === 'none' ? null : prevDirRaw as Direction2D;
    const currentBest = costs.get(currentKey);
    if (currentBest === undefined) continue;

    if (currentIndex === endIndex) {
      const waypoints = reconstructPath(previous, currentKey, vertices);
      const punctures = dedupePunctures(punctureByState.get(currentKey) ?? []);
      const bendCount = countBends(waypoints);
      const pathLength = computePathLength(waypoints);
      return { waypoints, punctures, bendCount, pathLength };
    }

    for (let nextIndex = 0; nextIndex < vertices.length; nextIndex += 1) {
      if (nextIndex === currentIndex) continue;
      const next = vertices[nextIndex]!;
      if (!axisAligned(current, next)) continue;

      const segmentAssessment = assessSegmentByIndex(currentIndex, nextIndex);
      if (segmentAssessment.blocked) continue;

      const nextDir = directionBetween(current, next);
      if (!nextDir) continue;

      const turnCost = prevDir === null
        ? 0
        : prevDir === nextDir
          ? 0
          : oppositeDirection(prevDir) === nextDir
            ? turnPenalty * 5
            : turnPenalty;

      const nextKey = `${nextDir}:${nextIndex}`;

      // Tiny bonus for arriving at the end with the correct approach direction.
      const endAlignBonus =
        nextIndex === endIndex &&
        nextDir === approachDirection
          ? 1e-6
          : 0;

      const nextCost =
        currentBest +
        manhattanDistance(current, next) +
        segmentAssessment.penalty +
        turnCost -
        endAlignBonus;

      if (nextCost >= (costs.get(nextKey) ?? Infinity)) continue;

      costs.set(nextKey, nextCost);
      previous.set(nextKey, { prevKey: currentKey, vertexIndex: nextIndex });
      punctureByState.set(nextKey, dedupePunctures([
        ...(punctureByState.get(currentKey) ?? []),
        ...segmentAssessment.punctures,
      ]));
      frontier.push(nextKey, nextCost + manhattanDistance(next, end));
    }
  }

  return null;
};

// ─── Metric helpers ──────────────────────────────────────────────────────────

const countBends = (waypoints: ReadonlyArray<Vec2>): number => {
  let bends = 0;
  for (let i = 1; i < waypoints.length - 1; i += 1) {
    const prev = waypoints[i - 1]!;
    const curr = waypoints[i]!;
    const next = waypoints[i + 1]!;
    const inDir = directionBetween(prev, curr);
    const outDir = directionBetween(curr, next);
    if (inDir && outDir && inDir !== outDir) bends += 1;
  }
  return bends;
};

const computePathLength = (waypoints: ReadonlyArray<Vec2>): number => {
  let length = 0;
  for (let i = 1; i < waypoints.length; i += 1) {
    length += manhattanDistance(waypoints[i - 1]!, waypoints[i]!);
  }
  return length;
};

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Find the shortest orthogonal (Manhattan) path from start to end,
 * avoiding obstacles, using A* on a visibility graph.
 *
 * The visibility graph vertices are obstacle corners + start/end points.
 * Edges are axis-aligned segments that don't cross hard obstacle interiors.
 */
export function routeOrthogonal(
  start: Vec2,
  end: Vec2,
  obstacles: ReadonlyArray<Obstacle>,
  approachDirection: 'N' | 'S' | 'E' | 'W',
  config: {
    turnPenalty: number;
    punchthroughPenalty: number;
  },
): OrthogonalRouteResult {
  // Degenerate: start === end → single waypoint.
  if (manhattanDistance(start, end) < EPSILON) {
    return { waypoints: [start], punctures: [], bendCount: 0, pathLength: 0 };
  }

  // Try clean route first (no punchthrough).
  const cleanRoute = searchVisibilityRoute(
    start, end, obstacles, approachDirection,
    config.turnPenalty, config.punchthroughPenalty,
    false, false,
  );

  if (cleanRoute) return cleanRoute;

  // Try punchthrough route (soft + hard allowed).
  const punctureRoute = searchVisibilityRoute(
    start, end, obstacles, approachDirection,
    config.turnPenalty, config.punchthroughPenalty,
    true, true,
  );

  if (punctureRoute) return punctureRoute;

  // Fallback: direct path (best-effort).
  const directLength = manhattanDistance(start, end);
  return {
    waypoints: [start, end],
    punctures: [],
    bendCount: 0,
    pathLength: directLength,
  };
}
