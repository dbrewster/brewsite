import type { FlowObstacle, Rect2D } from './flowObstacleModel';

type Vec3 = readonly [number, number, number];
type Direction2D = 'N' | 'S' | 'E' | 'W';

export type FlowVisibilityRoute = {
  readonly waypoints: ReadonlyArray<Vec3>;
  readonly usedUnderpass: boolean;
  readonly punctures: ReadonlyArray<{
    readonly obstacleId: string;
    readonly obstacleKind: 'node' | 'group';
  }>;
  readonly routeKind: 'direct' | 'clean-orthogonal' | 'underpass' | 'puncture-fallback';
  readonly obstacleIds: readonly string[];
  readonly acuteTurnCount: number;
  readonly reversalCount: number;
  readonly orthogonalDeviationPenalty: number;
  readonly groupIngressPenalty: number;
};

type SegmentAssessment = {
  readonly blocked: boolean;
  readonly penalty: number;
  readonly punctures: ReadonlyArray<{
    readonly obstacleId: string;
    readonly obstacleKind: 'node' | 'group';
  }>;
};

type SearchMode = 'clean' | 'puncture';

type FlowVisibilityInput = {
  readonly start: Vec3;
  readonly end: Vec3;
  readonly planeZ: number;
  readonly obstacles: ReadonlyArray<FlowObstacle>;
  readonly sourceOwningGroupIds: ReadonlySet<string>;
  readonly destinationOwningGroupIds: ReadonlySet<string>;
  readonly turnPenalty: number;
  readonly punchthroughPenalty: number;
  readonly underpassPenalty: number;
  readonly underpassDepth: number;
  readonly underpassClearance: number;
  readonly allowUnderpass: boolean;
};

const EPSILON = 1e-6;

const manhattanDistance = (a: Vec3, b: Vec3): number =>
  Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) + Math.abs(b[2] - a[2]);

const axisAligned = (a: Vec3, b: Vec3): boolean =>
  Math.abs(a[0] - b[0]) < EPSILON || Math.abs(a[1] - b[1]) < EPSILON;

const directionBetween = (a: Vec3, b: Vec3): Direction2D | null => {
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

const pointStrictlyInsideRect = (point: Vec3, rect: Rect2D): boolean =>
  point[0] > rect.left + EPSILON &&
  point[0] < rect.right - EPSILON &&
  point[1] > rect.bottom + EPSILON &&
  point[1] < rect.top - EPSILON;

const rangesOverlap = (a0: number, a1: number, b0: number, b1: number): boolean =>
  Math.max(Math.min(a0, a1), Math.min(b0, b1)) < Math.min(Math.max(a0, a1), Math.max(b0, b1)) - EPSILON;

const segmentIntersectsRect2D = (
  start: Vec3,
  end: Vec3,
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
  start: Vec3,
  end: Vec3,
  corridor: Rect2D | undefined,
): boolean => {
  if (!corridor) return false;
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
  start: Vec3,
  end: Vec3,
  corridors: ReadonlyArray<Rect2D>,
): boolean => corridors.some((corridor) => segmentAllowedByCorridor(start, end, corridor));

const dedupePunctures = (
  punctures: ReadonlyArray<{
    readonly obstacleId: string;
    readonly obstacleKind: 'node' | 'group';
  }>,
): ReadonlyArray<{
  readonly obstacleId: string;
  readonly obstacleKind: 'node' | 'group';
}> => {
  const seen = new Set<string>();
  const unique: Array<{
    obstacleId: string;
    obstacleKind: 'node' | 'group';
  }> = [];
  for (const puncture of punctures) {
    const key = `${puncture.obstacleKind}:${puncture.obstacleId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(puncture);
  }
  return unique;
};

const compressWaypoints = (waypoints: ReadonlyArray<Vec3>): ReadonlyArray<Vec3> => {
  if (waypoints.length <= 2) return waypoints;
  const compressed: Vec3[] = [waypoints[0]!];
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

const analyzeWaypoints = (waypoints: ReadonlyArray<Vec3>): Pick<
  FlowVisibilityRoute,
  'acuteTurnCount' | 'reversalCount' | 'orthogonalDeviationPenalty'
> => {
  let acuteTurnCount = 0;
  let reversalCount = 0;
  let orthogonalDeviationPenalty = 0;
  for (let i = 1; i < waypoints.length - 1; i += 1) {
    const a = waypoints[i - 1]!;
    const b = waypoints[i]!;
    const c = waypoints[i + 1]!;
    const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const bc: Vec3 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
    const abLen = Math.hypot(ab[0], ab[1], ab[2]) || 1;
    const bcLen = Math.hypot(bc[0], bc[1], bc[2]) || 1;
    const dot = (ab[0] * bc[0] + ab[1] * bc[1] + ab[2] * bc[2]) / (abLen * bcLen);
    if (Math.abs(ab[0]) > EPSILON && Math.abs(ab[1]) > EPSILON) orthogonalDeviationPenalty += 1000;
    if (Math.abs(bc[0]) > EPSILON && Math.abs(bc[1]) > EPSILON) orthogonalDeviationPenalty += 1000;
    if (dot > -0.707 && dot < 0.707) {
      continue;
    }
    if (dot > 0.707) {
      acuteTurnCount += 1;
    } else if (dot < -0.95) {
      reversalCount += 1;
    }
  }
  return { acuteTurnCount, reversalCount, orthogonalDeviationPenalty };
};

const computeGroupIngressPenalty = (
  waypoints: ReadonlyArray<Vec3>,
  obstacles: ReadonlyArray<FlowObstacle>,
): number => {
  if (waypoints.length < 2) return 0;
  const end = waypoints[waypoints.length - 1]!;
  const approach = waypoints[waypoints.length - 2]!;
  let penalty = 0;
  for (const obstacle of obstacles) {
    if (obstacle.kind !== 'group') continue;
    if (end[0] >= obstacle.rawRect.left - EPSILON && end[0] <= obstacle.rawRect.right + EPSILON &&
        end[1] >= obstacle.rawRect.bottom - EPSILON && end[1] <= obstacle.rawRect.top + EPSILON) {
      // End point lies on or inside the group boundary; discourage long runs across the top body.
      if (Math.abs(end[1] - obstacle.rawRect.top) < EPSILON) {
        const horizontalApproach = Math.abs(end[0] - approach[0]);
        penalty += horizontalApproach;
      }
    }
  }
  return penalty;
};

const assessSegment = (
  start: Vec3,
  end: Vec3,
  obstacles: ReadonlyArray<FlowObstacle>,
  sourceOwningGroupIds: ReadonlySet<string>,
  destinationOwningGroupIds: ReadonlySet<string>,
  punchthroughPenalty: number,
  allowSoftPuncture: boolean,
  allowHardPuncture: boolean,
): SegmentAssessment => {
  if (!axisAligned(start, end)) {
    return { blocked: true, penalty: Infinity, punctures: [] };
  }

  let penalty = 0;
  const punctures: Array<{
    obstacleId: string;
    obstacleKind: 'node' | 'group';
  }> = [];

  for (const obstacle of obstacles) {
    if (!segmentIntersectsRect2D(start, end, obstacle.expandedRect)) continue;
    const softOwned =
      obstacle.kind === 'group' &&
      (sourceOwningGroupIds.has(obstacle.id) || destinationOwningGroupIds.has(obstacle.id));
    if (softOwned && segmentAllowedByAnyCorridor(start, end, obstacle.allowedCorridors)) {
      continue;
    }

    if (obstacle.hard && !allowHardPuncture) {
      return { blocked: true, penalty: Infinity, punctures: [] };
    }
    if (!obstacle.hard && !allowSoftPuncture) {
      return { blocked: true, penalty: Infinity, punctures: [] };
    }

    penalty += obstacle.hard ? punchthroughPenalty : punchthroughPenalty * 0.85;
    punctures.push({
      obstacleId: obstacle.id,
      obstacleKind: obstacle.kind,
    });
  }

  return {
    blocked: false,
    penalty,
    punctures: dedupePunctures(punctures),
  };
};

const buildCandidateVertices = (
  start: Vec3,
  end: Vec3,
  planeZ: number,
  obstacles: ReadonlyArray<FlowObstacle>,
): Vec3[] => {
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

  const vertices: Vec3[] = [start, end];
  const seen = new Set<string>([
    `${start[0].toFixed(6)}:${start[1].toFixed(6)}`,
    `${end[0].toFixed(6)}:${end[1].toFixed(6)}`,
  ]);

  const sortedX = [...xs].sort((a, b) => a - b);
  const sortedY = [...ys].sort((a, b) => a - b);
  for (const x of sortedX) {
    for (const y of sortedY) {
      const point: Vec3 = [x, y, planeZ];
      const inside = obstacles.some((obstacle) =>
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

const reconstructPath = (
  previous: Map<string, { prevKey: string | null; vertexIndex: number }>,
  stateKey: string,
  vertices: ReadonlyArray<Vec3>,
): ReadonlyArray<Vec3> => {
  const path: Vec3[] = [];
  let cursor: string | null = stateKey;
  while (cursor) {
    const state = previous.get(cursor);
    if (!state) break;
    path.push(vertices[state.vertexIndex]!);
    cursor = state.prevKey;
  }
  return compressWaypoints(path.reverse());
};

const searchVisibilityRoute = (
  input: FlowVisibilityInput,
  allowSoftPuncture: boolean,
  allowHardPuncture: boolean,
): FlowVisibilityRoute | null => {
  const vertices = buildCandidateVertices(input.start, input.end, input.planeZ, input.obstacles);
  const startIndex = 0;
  const endIndex = 1;
  const searchMode: SearchMode = allowSoftPuncture || allowHardPuncture ? 'puncture' : 'clean';
  const frontier = new MinQueue<string>();
  frontier.push(`none:${startIndex}`, 0);
  const costs = new Map<string, number>([[`none:${startIndex}`, 0]]);
  const previous = new Map<string, { prevKey: string | null; vertexIndex: number }>([
    [`none:${startIndex}`, { prevKey: null, vertexIndex: startIndex }],
  ]);
  const punctureByState = new Map<string, FlowVisibilityRoute['punctures']>([[`none:${startIndex}`, []]]);
  const segmentAssessmentCache = new Map<string, SegmentAssessment>();

  const assessSegmentByIndex = (fromIndex: number, toIndex: number): SegmentAssessment => {
    const key = fromIndex < toIndex
      ? `${searchMode}:${fromIndex}:${toIndex}`
      : `${searchMode}:${toIndex}:${fromIndex}`;
    const cached = segmentAssessmentCache.get(key);
    if (cached) return cached;
    const assessment = assessSegment(
      vertices[fromIndex]!,
      vertices[toIndex]!,
      input.obstacles,
      input.sourceOwningGroupIds,
      input.destinationOwningGroupIds,
      input.punchthroughPenalty,
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
      const metrics = analyzeWaypoints(waypoints);
      const routeKind = punctures.length === 0
        ? (waypoints.length <= 2 ? 'direct' : 'clean-orthogonal')
        : 'puncture-fallback';
      return {
        waypoints,
        usedUnderpass: false,
        punctures,
        routeKind,
        obstacleIds: punctures.map((puncture) => puncture.obstacleId),
        ...metrics,
        groupIngressPenalty: computeGroupIngressPenalty(waypoints, input.obstacles),
      };
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
            ? input.turnPenalty * 5
            : input.turnPenalty;
      const nextKey = `${nextDir}:${nextIndex}`;
      const nextCost =
        currentBest +
        manhattanDistance(current, next) +
        segmentAssessment.penalty +
        turnCost;
      if (nextCost >= (costs.get(nextKey) ?? Infinity)) continue;

      costs.set(nextKey, nextCost);
      previous.set(nextKey, { prevKey: currentKey, vertexIndex: nextIndex });
      punctureByState.set(nextKey, dedupePunctures([
        ...(punctureByState.get(currentKey) ?? []),
        ...segmentAssessment.punctures,
      ]));
      frontier.push(nextKey, nextCost + manhattanDistance(next, input.end));
    }
  }

  return null;
};

const buildUnderpassRoute = (
  input: FlowVisibilityInput,
): FlowVisibilityRoute => {
  const clearanceZ = input.planeZ - Math.max(input.underpassDepth, input.underpassClearance);
  const waypoints: Vec3[] = [
    input.start,
    [input.start[0], input.start[1], clearanceZ],
    [input.end[0], input.start[1], clearanceZ],
    [input.end[0], input.end[1], clearanceZ],
    input.end,
  ];
  const compressed = compressWaypoints(waypoints);
  const metrics = analyzeWaypoints(compressed);
  return {
    waypoints: compressed,
    usedUnderpass: true,
    punctures: [],
    routeKind: 'underpass',
    obstacleIds: [],
    ...metrics,
    groupIngressPenalty: computeGroupIngressPenalty(compressed, input.obstacles),
  };
};

const routeCost = (
  route: FlowVisibilityRoute,
  input: FlowVisibilityInput,
): number => {
  let cost = 0;
  for (let i = 1; i < route.waypoints.length; i += 1) {
    cost += manhattanDistance(route.waypoints[i - 1]!, route.waypoints[i]!);
  }
  cost += route.acuteTurnCount * 10000;
  cost += route.reversalCount * 5000;
  cost += route.orthogonalDeviationPenalty;
  cost += route.groupIngressPenalty * 100;
  cost += route.punctures.length * input.punchthroughPenalty;
  if (route.usedUnderpass) cost += input.underpassPenalty;
  return cost;
};

export function findFlowVisibilityRoute(input: FlowVisibilityInput): FlowVisibilityRoute {
  const cleanRoute = searchVisibilityRoute(input, false, false);
  const punctureRoute = searchVisibilityRoute(input, true, true);
  const underpassRoute = input.allowUnderpass ? buildUnderpassRoute(input) : null;
  const candidates = [cleanRoute, underpassRoute, punctureRoute]
    .filter((candidate): candidate is FlowVisibilityRoute => candidate !== null)
    .sort((a, b) => {
      const costDelta = routeCost(a, input) - routeCost(b, input);
      if (Math.abs(costDelta) > EPSILON) return costDelta;
      const routeOrder = ['direct', 'clean-orthogonal', 'underpass', 'puncture-fallback'] as const;
      return routeOrder.indexOf(a.routeKind) - routeOrder.indexOf(b.routeKind);
    });

  if (candidates[0]) return candidates[0];

  return {
    waypoints: [input.start, input.end],
    usedUnderpass: false,
    punctures: [],
    routeKind: 'direct',
    obstacleIds: [],
    acuteTurnCount: 0,
    reversalCount: 0,
    orthogonalDeviationPenalty: 0,
    groupIngressPenalty: 0,
  };
}
