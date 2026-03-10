import type { FlowObstacle } from './flowObstacleModel';

type Vec3 = readonly [number, number, number];

export type FlowVisibilityRoute = {
  readonly waypoints: ReadonlyArray<Vec3>;
  readonly usedUnderpass: boolean;
  readonly punctures: ReadonlyArray<{
    readonly obstacleId: string;
    readonly obstacleKind: 'node' | 'group';
  }>;
  readonly routeKind: 'direct' | 'visibility' | 'underpass' | 'puncture-fallback';
  readonly obstacleIds: readonly string[];
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

const length2D = (a: Vec3, b: Vec3): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

const length3D = (a: Vec3, b: Vec3): number => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

const normalize2D = (a: Vec3, b: Vec3): readonly [number, number] => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < EPSILON) return [0, 0];
  return [dx / len, dy / len];
};

const turnMagnitude = (prev: Vec3 | null, current: Vec3, next: Vec3): number => {
  if (!prev) return 0;
  const a = normalize2D(prev, current);
  const b = normalize2D(current, next);
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]));
  return 1 - dot;
};

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

const segmentIntersectsRect2D = (
  start: Vec3,
  end: Vec3,
  rect: FlowObstacle['rect'],
): boolean => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  let t0 = 0;
  let t1 = 1;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < EPSILON) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  if (!clip(-dx, start[0] - rect.left)) return false;
  if (!clip(dx, rect.right - start[0])) return false;
  if (!clip(-dy, start[1] - rect.bottom)) return false;
  if (!clip(dy, rect.top - start[1])) return false;

  if (t0 > t1) return false;
  return t1 > EPSILON && t0 < 1 - EPSILON;
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
  let penalty = 0;
  const punctures: Array<{
    obstacleId: string;
    obstacleKind: 'node' | 'group';
  }> = [];

  for (const obstacle of obstacles) {
    if (!segmentIntersectsRect2D(start, end, obstacle.rect)) continue;
    const softOwned =
      obstacle.kind === 'group' &&
      (sourceOwningGroupIds.has(obstacle.id) || destinationOwningGroupIds.has(obstacle.id));
    if (softOwned) {
      continue;
    }

    if (obstacle.hard && !allowHardPuncture) {
      return { blocked: true, penalty: Infinity, punctures: [] };
    }
    if (!obstacle.hard && !allowSoftPuncture) {
      return { blocked: true, penalty: Infinity, punctures: [] };
    }
    penalty += obstacle.hard
      ? punchthroughPenalty
      : punchthroughPenalty;
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
  const vertices: Vec3[] = [start, end];
  const vertexKeys = new Set<string>([
    `${start[0].toFixed(6)}:${start[1].toFixed(6)}:${start[2].toFixed(6)}`,
    `${end[0].toFixed(6)}:${end[1].toFixed(6)}:${end[2].toFixed(6)}`,
  ]);
  const pushUnique = (point: Vec3): void => {
    const key = `${point[0].toFixed(6)}:${point[1].toFixed(6)}:${point[2].toFixed(6)}`;
    if (vertexKeys.has(key)) return;
    vertexKeys.add(key);
    vertices.push(point);
  };

  for (const obstacle of obstacles) {
    const { left, right, top, bottom } = obstacle.rect;
    pushUnique([left, top, planeZ]);
    pushUnique([left, bottom, planeZ]);
    pushUnique([right, top, planeZ]);
    pushUnique([right, bottom, planeZ]);
    if (obstacle.kind === 'group') {
      pushUnique([(left + right) / 2, top, planeZ]);
      pushUnique([(left + right) / 2, bottom, planeZ]);
      pushUnique([left, (top + bottom) / 2, planeZ]);
      pushUnique([right, (top + bottom) / 2, planeZ]);
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
  return path.reverse();
};

const searchVisibilityRoute = (
  input: FlowVisibilityInput,
  allowSoftPuncture: boolean,
  allowHardPuncture: boolean,
): FlowVisibilityRoute | null => {
  const vertices = buildCandidateVertices(input.start, input.end, input.planeZ, input.obstacles);
  const searchMode: SearchMode = allowSoftPuncture || allowHardPuncture ? 'puncture' : 'clean';
  const startIndex = 0;
  const endIndex = 1;
  const frontier = new MinQueue<string>();
  frontier.push(`-1:${startIndex}`, 0);
  const costs = new Map<string, number>([['-1:0', 0]]);
  const previous = new Map<string, { prevKey: string | null; vertexIndex: number }>([
    ['-1:0', { prevKey: null, vertexIndex: startIndex }],
  ]);
  const punctureByState = new Map<string, FlowVisibilityRoute['punctures']>([['-1:0', []]]);
  const segmentAssessmentCache = new Map<string, SegmentAssessment>();
  const adjacency = new Map<number, number[]>();

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

  const getNeighbors = (vertexIndex: number): number[] => {
    const cached = adjacency.get(vertexIndex);
    if (cached) return cached;
    const neighbors: number[] = [];
    for (let nextIndex = 0; nextIndex < vertices.length; nextIndex += 1) {
      if (nextIndex === vertexIndex) continue;
      const assessment = assessSegmentByIndex(vertexIndex, nextIndex);
      if (!assessment.blocked) neighbors.push(nextIndex);
    }
    adjacency.set(vertexIndex, neighbors);
    return neighbors;
  };

  while (frontier.size > 0) {
    const currentKey = frontier.pop()!;
    const [prevIndexRaw, currentIndexRaw] = currentKey.split(':');
    const prevIndex = Number(prevIndexRaw);
    const currentIndex = Number(currentIndexRaw);
    const current = vertices[currentIndex]!;
    const prev = prevIndex >= 0 ? vertices[prevIndex] ?? null : null;
    const currentBest = costs.get(currentKey);
    if (currentBest === undefined) continue;

    if (currentIndex === endIndex) {
      const waypoints = reconstructPath(previous, currentKey, vertices);
      const punctures = dedupePunctures(punctureByState.get(currentKey) ?? []);
      const routeKind = punctures.length === 0
        ? (waypoints.length <= 2 ? 'direct' : 'visibility')
        : 'puncture-fallback';
      return {
        waypoints,
        usedUnderpass: false,
        punctures,
        routeKind,
        obstacleIds: punctures.map((puncture) => puncture.obstacleId),
      };
    }

    for (const nextIndex of getNeighbors(currentIndex)) {
      const next = vertices[nextIndex]!;
      const assessment = assessSegmentByIndex(currentIndex, nextIndex);

      const nextKey = `${currentIndex}:${nextIndex}`;
      const baseCost = currentBest;
      const turnCost = turnMagnitude(prev, current, next) * input.turnPenalty;
      const cost = baseCost + length2D(current, next) + assessment.penalty + turnCost;
      if (cost >= (costs.get(nextKey) ?? Infinity)) continue;

      costs.set(nextKey, cost);
      previous.set(nextKey, { prevKey: currentKey, vertexIndex: nextIndex });
      punctureByState.set(nextKey, dedupePunctures([
        ...(punctureByState.get(currentKey) ?? []),
        ...assessment.punctures,
      ]));
      frontier.push(nextKey, cost);
    }
  }

  return null;
};

const buildUnderpassRoute = (
  input: FlowVisibilityInput,
): FlowVisibilityRoute => {
  const clearanceZ = input.planeZ - Math.max(input.underpassDepth, input.underpassClearance);
  const startDir = normalize2D(input.start, input.end);
  const endDir: readonly [number, number] = [-startDir[0], -startDir[1]];
  const startLift: Vec3 = [
    input.start[0] + startDir[0] * input.underpassClearance,
    input.start[1] + startDir[1] * input.underpassClearance,
    clearanceZ,
  ];
  const endLift: Vec3 = [
    input.end[0] + endDir[0] * input.underpassClearance,
    input.end[1] + endDir[1] * input.underpassClearance,
    clearanceZ,
  ];

  return {
    waypoints: [input.start, startLift, endLift, input.end],
    usedUnderpass: true,
    punctures: [],
    routeKind: 'underpass',
    obstacleIds: [],
  };
};

const routeCost = (
  route: FlowVisibilityRoute,
  input: FlowVisibilityInput,
): number => {
  let cost = 0;
  for (let i = 1; i < route.waypoints.length; i += 1) {
    cost += length3D(route.waypoints[i - 1]!, route.waypoints[i]!);
  }
  for (let i = 1; i < route.waypoints.length - 1; i += 1) {
    cost += turnMagnitude(route.waypoints[i - 1]!, route.waypoints[i]!, route.waypoints[i + 1]!) * input.turnPenalty;
  }
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
      const routeOrder = ['direct', 'visibility', 'underpass', 'puncture-fallback'] as const;
      return routeOrder.indexOf(a.routeKind) - routeOrder.indexOf(b.routeKind);
    });

  if (candidates[0]) return candidates[0];

  return {
    waypoints: [input.start, input.end],
    usedUnderpass: false,
    punctures: [],
    routeKind: 'direct',
    obstacleIds: [],
  };
}
