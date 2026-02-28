// Edge routing utilities extracted from compile.ts.
// Pure functions only — no Three.js, no React.

import type {
  DiagramEdgePort,
  EdgeLandingAlgorithm,
  EdgeRoutingAlgorithm,
} from '../types';

export type FaceId = 'left' | 'right' | 'top' | 'bottom' | 'front' | 'back';
export type Vec3 = readonly [number, number, number];
export type NodeDimensions = readonly [number, number, number];

type EdgeRoutingInput = {
  id?: string;
  from: string;
  to: string;
  routing?: EdgeRoutingAlgorithm;
  fromPort?: DiagramEdgePort;
  toPort?: DiagramEdgePort;
  thickness?: number;
};

const EDGE_EPSILON = 0.1;
const MIN_PORT_PITCH = 0.35;
const PORT_SPACING_FACTOR = 3.0;
const PORT_MARGIN_FACTOR = 1.5;
const OBSTACLE_PADDING = 0.2;
const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scaleVec = (v: Vec3, scalar: number): Vec3 => [v[0] * scalar, v[1] * scalar, v[2] * scalar];

export function getFaceCenter(pos: Vec3, size: NodeDimensions, face: FaceId): Vec3 {
  const [x, y, z] = pos;
  const [w, h, d] = size;
  switch (face) {
    case 'left':   return [x - w / 2, y,         z];
    case 'right':  return [x + w / 2, y,         z];
    case 'top':    return [x,         y + h / 2, z];
    case 'bottom': return [x,         y - h / 2, z];
    case 'front':  return [x,         y,         z + d / 2];
    case 'back':   return [x,         y,         z - d / 2];
  }
}

const directionSign = (value: number): number => (value >= 0 ? 1 : -1);

const computePortCount = (span: number, thickness: number): number => {
  const pitch = Math.max(MIN_PORT_PITCH, thickness * PORT_SPACING_FACTOR);
  const margin = thickness * PORT_MARGIN_FACTOR;
  const available = Math.max(0, span - margin * 2);
  return Math.max(1, Math.floor(available / pitch));
};

const resolvePortOffset = (index: number, count: number, span: number): number => {
  if (count <= 1) return 0;
  const step = span / (count - 1);
  return -span / 2 + step * index;
};

const resolvePortCountForFace = (
  face: FaceId,
  size: NodeDimensions,
  thickness: number,
): number => {
  const [w, h] = size;
  if (face === 'front' || face === 'back') {
    const pitch = Math.max(MIN_PORT_PITCH, thickness * PORT_SPACING_FACTOR);
    return w >= pitch * 2 ? 2 : 1;
  }
  if (face === 'top' || face === 'bottom') return computePortCount(w, thickness);
  if (face === 'left' || face === 'right') return computePortCount(h, thickness);
  return 1;
};



const buildCenterOutOrder = (count: number): number[] => {
  if (count <= 1) return [0];
  const order: number[] = [];
  const midRight = Math.floor(count / 2);
  const midLeft = count % 2 === 0 ? midRight - 1 : midRight;
  order.push(midLeft);
  if (midRight !== midLeft) order.push(midRight);
  let step = 1;
  while (order.length < count) {
    const left = midLeft - step;
    const right = midRight + step;
    if (left >= 0) order.push(left);
    if (order.length >= count) break;
    if (right < count) order.push(right);
    step += 1;
  }
  return order;
};

export function getFacePortAnchor(
  pos: Vec3,
  size: NodeDimensions,
  face: FaceId,
  portIndex: number,
  portCount: number,
  targetPos: Vec3,
): Vec3 {
  const [x, y, z] = pos;
  const [w, h, d] = size;
  const dx = targetPos[0] - x;
  const dy = targetPos[1] - y;
  const dz = targetPos[2] - z;
  const sx = directionSign(dx);
  const useVerticalOffset = Math.abs(dy) > Math.abs(dz) * 0.5;
  const useHorizontalOffset = Math.abs(dx) > Math.abs(dz) * 0.5;
  const yOffset = useVerticalOffset ? (dy > 0 ? h / 2 : -h / 2) : 0;

  switch (face) {
    case 'front':
      return portCount === 1
        ? [x, y + yOffset, z + d / 2]
        : [x + (useHorizontalOffset ? (portIndex === 0 ? -1 : 1) * w / 2 : 0), y + yOffset, z + d / 2];
    case 'back':
      return portCount === 1
        ? [x, y + yOffset, z - d / 2]
        : [x + (useHorizontalOffset ? (portIndex === 0 ? -1 : 1) * w / 2 : 0), y + yOffset, z - d / 2];
    case 'top': {
      const span = w;
      const offset = resolvePortOffset(portIndex, portCount, span);
      return [x + offset, y + h / 2, z];
    }
    case 'bottom': {
      const span = w;
      const offset = resolvePortOffset(portIndex, portCount, span);
      return [x + offset, y - h / 2, z];
    }
    case 'left': {
      const span = h;
      const offset = resolvePortOffset(portIndex, portCount, span);
      return [x - w / 2, y + offset, z];
    }
    case 'right': {
      const span = h;
      const offset = resolvePortOffset(portIndex, portCount, span);
      return [x + w / 2, y + offset, z];
    }
    default:
      return getFaceCenter(pos, size, face);
  }
}

export function getFaceNormal(face: FaceId): Vec3 {
  switch (face) {
    case 'left':   return [-1,  0,  0];
    case 'right':  return [ 1,  0,  0];
    case 'top':    return [ 0,  1,  0];
    case 'bottom': return [ 0, -1,  0];
    case 'front':  return [ 0,  0,  1];
    case 'back':   return [ 0,  0, -1];
  }
}

function portToFace(port: DiagramEdgePort): FaceId {
  return port as FaceId;
}

/** nearest-face: pick face by dominant delta-vector direction. */
export function nearestFace(origin: Vec3, target: Vec3): FaceId {
  const dx = target[0] - origin[0];
  const dy = target[1] - origin[1];
  const dz = target[2] - origin[2];
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const adz = Math.abs(dz);
  if (ady >= adx * 0.7 && ady >= adz * 0.7) return dy >= 0 ? 'top' : 'bottom';
  if (adx >= adz) return dx >= 0 ? 'right' : 'left';
  return dz >= 0 ? 'front' : 'back';
}

/** shortest-path: enumerate all 36 face-pair combos, pick minimum distance. */
function shortestPathFaces(
  srcPos: Vec3, srcSize: NodeDimensions,
  dstPos: Vec3, dstSize: NodeDimensions,
): { srcFace: FaceId; dstFace: FaceId } {
  const faces: FaceId[] = ['left', 'right', 'top', 'bottom', 'front', 'back'];
  let minDist = Infinity;
  let best: { srcFace: FaceId; dstFace: FaceId } = { srcFace: 'right', dstFace: 'left' };
  for (const sf of faces) {
    const sc = getFaceCenter(srcPos, srcSize, sf);
    for (const df of faces) {
      const dc = getFaceCenter(dstPos, dstSize, df);
      const dist = Math.sqrt(
        (dc[0] - sc[0]) ** 2 + (dc[1] - sc[1]) ** 2 + (dc[2] - sc[2]) ** 2,
      );
      if (dist < minDist) { minDist = dist; best = { srcFace: sf, dstFace: df }; }
    }
  }
  return best;
}

export function resolveFaces(
  srcPos: Vec3, srcSize: NodeDimensions,
  dstPos: Vec3, dstSize: NodeDimensions,
  landing: EdgeLandingAlgorithm,
  fromPort?: DiagramEdgePort,
  toPort?: DiagramEdgePort,
): { srcFace: FaceId; dstFace: FaceId } {
  if (fromPort && toPort) {
    return { srcFace: portToFace(fromPort), dstFace: portToFace(toPort) };
  }
  if (fromPort || toPort) {
    const sf = fromPort ? portToFace(fromPort) : nearestFace(srcPos, dstPos);
    const df = toPort ? portToFace(toPort) : nearestFace(dstPos, srcPos);
    return { srcFace: sf, dstFace: df };
  }
  if (landing === 'shortest-path') return shortestPathFaces(srcPos, srcSize, dstPos, dstSize);
  if (landing === 'center') return { srcFace: nearestFace(srcPos, dstPos), dstFace: nearestFace(dstPos, srcPos) };
  return {
    srcFace: nearestFace(srcPos, dstPos),
    dstFace: nearestFace(dstPos, srcPos),
  };
}

export function routeEdgeCurved(
  srcPos: Vec3, srcSize: NodeDimensions, srcFace: FaceId,
  dstPos: Vec3, dstSize: NodeDimensions, dstFace: FaceId,
  srcAnchor?: Vec3,
  dstAnchor?: Vec3,
): ReadonlyArray<Vec3> {
  const srcCenter = srcAnchor ?? getFaceCenter(srcPos, srcSize, srcFace);
  const dstCenter = dstAnchor ?? getFaceCenter(dstPos, dstSize, dstFace);
  const srcNormal = getFaceNormal(srcFace);
  const dstNormal = getFaceNormal(dstFace);

  const start = addVec(srcCenter, scaleVec(srcNormal, EDGE_EPSILON));
  const end   = addVec(dstCenter, scaleVec(dstNormal, EDGE_EPSILON));

  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const dir: Vec3 = dist > 0 ? [dx / dist, dy / dist, dz / dist] : [1, 0, 0];
  const srcAlign = srcNormal[0] * dir[0] + srcNormal[1] * dir[1] + srcNormal[2] * dir[2];
  const dstAlign = dstNormal[0] * -dir[0] + dstNormal[1] * -dir[1] + dstNormal[2] * -dir[2];
  if (dist < 6 && srcAlign > 0.85 && dstAlign > 0.85) {
    return [start, end];
  }
  const handle = Math.max(0.6, Math.min(6, dist * 0.35));
  const c1 = addVec(start, scaleVec(srcNormal, handle));
  const c2 = addVec(end, scaleVec(dstNormal, handle));
  return [start, c1, c2, end];
}

export function routeEdgeStraight(
  srcPos: Vec3, srcSize: NodeDimensions, srcFace: FaceId,
  dstPos: Vec3, dstSize: NodeDimensions, dstFace: FaceId,
  srcAnchor?: Vec3,
  dstAnchor?: Vec3,
): ReadonlyArray<Vec3> {
  const start = addVec(srcAnchor ?? getFaceCenter(srcPos, srcSize, srcFace), scaleVec(getFaceNormal(srcFace), EDGE_EPSILON));
  const end   = addVec(dstAnchor ?? getFaceCenter(dstPos, dstSize, dstFace), scaleVec(getFaceNormal(dstFace), EDGE_EPSILON));
  return [start, end];
}

/** Deterministic hash for an edge ID (for reproducible "organic" variation). */
const hashStr = (s: string): number =>
  s.split('').reduce((acc, c) => (Math.imul(acc, 31) + c.charCodeAt(0)) | 0, 0x9e3779b9);

export function routeEdgeOrganic(
  srcPos: Vec3, srcSize: NodeDimensions, srcFace: FaceId,
  dstPos: Vec3, dstSize: NodeDimensions, dstFace: FaceId,
  edgeId: string,
  srcAnchor?: Vec3,
  dstAnchor?: Vec3,
): ReadonlyArray<Vec3> {
  const base = routeEdgeCurved(srcPos, srcSize, srcFace, dstPos, dstSize, dstFace, srcAnchor, dstAnchor);
  const seed = Math.abs(hashStr(edgeId));
  const offset = ((seed % 1000) / 1000 - 0.5) * 1.6;

  const [p0, p1, p2, p3] = base;
  if (!p1 || !p2 || !p3) return base;
  const midX = (p1[0] + p2[0]) / 2;
  const midY = (p1[1] + p2[1]) / 2;
  const midZ = (p1[2] + p2[2]) / 2;

  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len;
  const perpY =  dx / len;

  const mid: Vec3 = [midX + perpX * offset, midY + perpY * offset, midZ];
  return [p0, p1, mid, p2, p3];
}

export function routeEdgeOrthogonal(
  srcPos: Vec3, srcSize: NodeDimensions, srcFace: FaceId,
  dstPos: Vec3, dstSize: NodeDimensions, dstFace: FaceId,
  srcAnchor?: Vec3,
  dstAnchor?: Vec3,
): ReadonlyArray<Vec3> {
  const isH = (f: FaceId) => f === 'left' || f === 'right';
  const isV = (f: FaceId) => f === 'top' || f === 'bottom';

  if (!isH(srcFace) && !isV(srcFace)) {
    return routeEdgeCurved(srcPos, srcSize, srcFace, dstPos, dstSize, dstFace);
  }
  if (!isH(dstFace) && !isV(dstFace)) {
    return routeEdgeCurved(srcPos, srcSize, srcFace, dstPos, dstSize, dstFace);
  }

  const stub = 0.8;
  const ce = 0.12;
  const srcCenter = srcAnchor ?? getFaceCenter(srcPos, srcSize, srcFace);
  const dstCenter = dstAnchor ?? getFaceCenter(dstPos, dstSize, dstFace);
  const sn = getFaceNormal(srcFace);
  const dn = getFaceNormal(dstFace);

  const [sx, sy, sz] = [srcCenter[0] + sn[0] * EDGE_EPSILON, srcCenter[1] + sn[1] * EDGE_EPSILON, srcCenter[2] + sn[2] * EDGE_EPSILON];
  const [ex, ey, ez] = [dstCenter[0] + dn[0] * EDGE_EPSILON, dstCenter[1] + dn[1] * EDGE_EPSILON, dstCenter[2] + dn[2] * EDGE_EPSILON];
  const [g1x, g1y, g1z] = [sx + sn[0] * stub, sy + sn[1] * stub, sz + sn[2] * stub];
  const [g2x, g2y, g2z] = [ex + dn[0] * stub, ey + dn[1] * stub, ez + dn[2] * stub];
  const midZ = (g1z + g2z) * 0.5;

  const start: Vec3 = [sx, sy, sz];
  const end: Vec3   = [ex, ey, ez];

  const sign = (a: number, b: number) => (b > a ? 1 : -1);

  if (isH(srcFace) && isH(dstFace)) {
    const cx = (g1x + g2x) / 2;
    return [
      start,
      [g1x, g1y, g1z],
      [cx - ce * sign(cx, g1x), g1y, midZ],
      [cx, g1y, midZ],
      [cx, g1y + ce * sign(g1y, g2y), midZ],
      [cx, g2y, midZ],
      [cx + ce * sign(cx, g2x), g2y, midZ],
      [g2x, g2y, g2z],
      end,
    ];
  }

  if (isV(srcFace) && isV(dstFace)) {
    const cy = (g1y + g2y) / 2;
    return [
      start,
      [g1x, g1y, g1z],
      [g1x, cy - ce * sign(cy, g1y), midZ],
      [g1x, cy, midZ],
      [g1x + ce * sign(g1x, g2x), cy, midZ],
      [g2x, cy, midZ],
      [g2x, cy + ce * sign(cy, g2y), midZ],
      [g2x, g2y, g2z],
      end,
    ];
  }

  const cx = g2x, cy = g1y;
  return [
    start,
    [g1x, g1y, g1z],
    [cx - ce * sign(cx, g1x), cy, midZ],
    [cx, cy, midZ],
    [cx, cy + ce * sign(cy, g2y), midZ],
    [g2x, g2y, g2z],
    end,
  ];
}

function routeOneEdge(
  edgeId: string,
  fromPos: Vec3, fromSize: NodeDimensions,
  toPos: Vec3, toSize: NodeDimensions,
  routing: EdgeRoutingAlgorithm,
  landing: EdgeLandingAlgorithm,
  fromPort?: DiagramEdgePort,
  toPort?: DiagramEdgePort,
  fromAnchor?: Vec3,
  toAnchor?: Vec3,
): ReadonlyArray<Vec3> {
  if (landing === 'center') {
    const sn = getFaceNormal(nearestFace(fromPos, toPos));
    const dn = getFaceNormal(nearestFace(toPos, fromPos));
    const start = addVec(fromPos, scaleVec(sn, EDGE_EPSILON));
    const end   = addVec(toPos,   scaleVec(dn, EDGE_EPSILON));
    if (routing === 'straight') return [start, end];
    const dist = Math.sqrt((toPos[0]-fromPos[0])**2 + (toPos[1]-fromPos[1])**2 + (toPos[2]-fromPos[2])**2);
    const stub = Math.max(0.25, Math.min(1.6, dist * 0.22));
    return [start, addVec(start, scaleVec(sn, stub)), addVec(end, scaleVec(dn, stub)), end];
  }

  const { srcFace, dstFace } = resolveFaces(fromPos, fromSize, toPos, toSize, landing, fromPort, toPort);

  switch (routing) {
    case 'straight':    return routeEdgeStraight(fromPos, fromSize, srcFace, toPos, toSize, dstFace, fromAnchor, toAnchor);
    case 'orthogonal':  return routeEdgeOrthogonal(fromPos, fromSize, srcFace, toPos, toSize, dstFace, fromAnchor, toAnchor);
    case 'organic':     return routeEdgeOrganic(fromPos, fromSize, srcFace, toPos, toSize, dstFace, edgeId, fromAnchor, toAnchor);
    case 'curved':
    default:            return routeEdgeCurved(fromPos, fromSize, srcFace, toPos, toSize, dstFace, fromAnchor, toAnchor);
  }
}

type FacePair = { srcFace: FaceId; dstFace: FaceId };

function routeOneEdgeWithFaces(
  edgeId: string,
  fromPos: Vec3,
  fromSize: NodeDimensions,
  toPos: Vec3,
  toSize: NodeDimensions,
  routing: EdgeRoutingAlgorithm,
  srcFace: FaceId,
  dstFace: FaceId,
): ReadonlyArray<Vec3> {
  switch (routing) {
    case 'straight':
      return routeEdgeStraight(fromPos, fromSize, srcFace, toPos, toSize, dstFace);
    case 'orthogonal':
      return routeEdgeOrthogonal(fromPos, fromSize, srcFace, toPos, toSize, dstFace);
    case 'organic':
      return routeEdgeOrganic(fromPos, fromSize, srcFace, toPos, toSize, dstFace, edgeId);
    case 'curved':
    default:
      return routeEdgeCurved(fromPos, fromSize, srcFace, toPos, toSize, dstFace);
  }
}

type ObstacleRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function computeObstacleRects(
  positions: Map<string, Vec3>,
  sizes: Map<string, NodeDimensions>,
  fromId: string,
  toId: string,
): ObstacleRect[] {
  const rects: ObstacleRect[] = [];
  positions.forEach((pos, id) => {
    if (id === fromId || id === toId) return;
    const size = sizes.get(id);
    if (!size) return;
    const halfW = size[0] / 2 + OBSTACLE_PADDING;
    const halfH = size[1] / 2 + OBSTACLE_PADDING;
    rects.push({
      left: pos[0] - halfW,
      right: pos[0] + halfW,
      bottom: pos[1] - halfH,
      top: pos[1] + halfH,
    });
  });
  return rects;
}

function segmentIntersectsRect2D(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: ObstacleRect,
): boolean {
  const pointInside = (x: number, y: number): boolean =>
    x >= rect.left && x <= rect.right && y >= rect.bottom && y <= rect.top;
  if (pointInside(x1, y1) || pointInside(x2, y2)) return true;

  const segMinX = Math.min(x1, x2);
  const segMaxX = Math.max(x1, x2);
  const segMinY = Math.min(y1, y2);
  const segMaxY = Math.max(y1, y2);
  if (segMaxX < rect.left || segMinX > rect.right || segMaxY < rect.bottom || segMinY > rect.top) return false;

  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0;
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

  if (!clip(-dx, x1 - rect.left)) return false;
  if (!clip(dx, rect.right - x1)) return false;
  if (!clip(-dy, y1 - rect.bottom)) return false;
  if (!clip(dy, rect.top - y1)) return false;
  return t0 <= t1;
}

function polylineObstacleHits(points: ReadonlyArray<Vec3>, obstacles: ReadonlyArray<ObstacleRect>): number {
  if (points.length < 2 || obstacles.length === 0) return 0;
  let hits = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p1 = points[i];
    const p2 = points[i + 1];
    for (const rect of obstacles) {
      if (segmentIntersectsRect2D(p1[0], p1[1], p2[0], p2[1], rect)) hits += 1;
    }
  }
  return hits;
}

function polylineLength(points: ReadonlyArray<Vec3>): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    len += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return len;
}

function resolveFacesWithObstacleFallback(
  edgeId: string,
  fromId: string,
  toId: string,
  fromPos: Vec3,
  fromSize: NodeDimensions,
  toPos: Vec3,
  toSize: NodeDimensions,
  routing: EdgeRoutingAlgorithm,
  positions: Map<string, Vec3>,
  sizes: Map<string, NodeDimensions>,
): FacePair {
  const base = resolveFaces(fromPos, fromSize, toPos, toSize, 'nearest-face');
  const isPlanarFace = (f: FaceId): boolean => f === 'left' || f === 'right' || f === 'top' || f === 'bottom';
  if (!isPlanarFace(base.srcFace) || !isPlanarFace(base.dstFace)) {
    return base;
  }
  const dx = toPos[0] - fromPos[0];
  const dy = toPos[1] - fromPos[1];
  const vertical: FacePair = {
    srcFace: dy >= 0 ? 'top' : 'bottom',
    dstFace: dy >= 0 ? 'bottom' : 'top',
  };
  const horizontal: FacePair = {
    srcFace: dx >= 0 ? 'right' : 'left',
    dstFace: dx >= 0 ? 'left' : 'right',
  };
  const shortest = resolveFaces(fromPos, fromSize, toPos, toSize, 'shortest-path');

  const candidates: FacePair[] = [];
  const pushUnique = (pair: FacePair): void => {
    if (candidates.some((c) => c.srcFace === pair.srcFace && c.dstFace === pair.dstFace)) return;
    candidates.push(pair);
  };
  pushUnique(base);
  pushUnique(vertical);
  pushUnique(horizontal);
  pushUnique(shortest);

  const obstacles = computeObstacleRects(positions, sizes, fromId, toId);
  const scored = candidates.map((pair) => {
    const points = routeOneEdgeWithFaces(edgeId, fromPos, fromSize, toPos, toSize, routing, pair.srcFace, pair.dstFace);
    return {
      pair,
      hits: polylineObstacleHits(points, obstacles),
      length: polylineLength(points),
    };
  });

  const baseScore = scored[0];
  if (baseScore && baseScore.hits === 0) return baseScore.pair;

  const best = [...scored].sort((a, b) => {
    if (a.hits !== b.hits) return a.hits - b.hits;
    return a.length - b.length;
  })[0];
  return best?.pair ?? base;
}

export function routeEdges(
  edges: ReadonlyArray<EdgeRoutingInput>,
  positions: Map<string, Vec3>,
  sizes: Map<string, NodeDimensions>,
  defaultRouting: EdgeRoutingAlgorithm = 'curved',
  defaultLanding: EdgeLandingAlgorithm = 'nearest-face',
): Map<string, ReadonlyArray<Vec3>> {
  type EdgeFaceInfo = {
    id: string;
    from: string;
    to: string;
    srcFace: FaceId;
    dstFace: FaceId;
    thickness: number;
  };

  const faceInfo: EdgeFaceInfo[] = [];
  const faceInfoById = new Map<string, EdgeFaceInfo>();
  const faceGroups = new Map<string, EdgeFaceInfo[]>();
  const resolvedThickness = (edge: EdgeRoutingInput): number => edge.thickness ?? 0.06;

  const addToGroup = (nodeId: string, face: FaceId, info: EdgeFaceInfo): void => {
    const key = `${nodeId}:${face}`;
    const group = faceGroups.get(key) ?? [];
    group.push(info);
    faceGroups.set(key, group);
  };

  edges.forEach((edge, index) => {
    const id = edge.id ?? `${edge.from}-${edge.to}-${index}`;
    const fromPos  = positions.get(edge.from);
    const toPos    = positions.get(edge.to);
    const fromSize = sizes.get(edge.from);
    const toSize   = sizes.get(edge.to);
    if (!fromPos || !toPos || !fromSize || !toSize) return;
    const landing = (edge.fromPort || edge.toPort) ? 'port' : defaultLanding;
    const routing = edge.routing ?? defaultRouting;
    let { srcFace, dstFace } = resolveFaces(fromPos, fromSize, toPos, toSize, landing, edge.fromPort, edge.toPort);
    if (!edge.fromPort && !edge.toPort && landing === 'nearest-face') {
      const selected = resolveFacesWithObstacleFallback(
        id,
        edge.from,
        edge.to,
        fromPos,
        fromSize,
        toPos,
        toSize,
        routing,
        positions,
        sizes,
      );
      srcFace = selected.srcFace;
      dstFace = selected.dstFace;
    }
    // Face switching is handled later using anchor intersections; no pre-swap here.
    const info: EdgeFaceInfo = {
      id,
      from: edge.from,
      to: edge.to,
      srcFace,
      dstFace,
      thickness: resolvedThickness(edge),
    };
    faceInfo.push(info);
    faceInfoById.set(id, info);
    if (!edge.fromPort) addToGroup(edge.from, srcFace, info);
    if (!edge.toPort) addToGroup(edge.to, dstFace, info);
  });

  const facePortIndex = new Map<string, number>();
  const facePortCount = new Map<string, number>();

  faceGroups.forEach((group, key) => {
    const [nodeId, face] = key.split(':') as [string, FaceId];
    const pos = positions.get(nodeId);
    const size = sizes.get(nodeId);
    if (!pos || !size) return;

    const maxThickness = group.reduce((acc, g) => Math.max(acc, g.thickness), 0.06);
    const count = resolvePortCountForFace(face, size, maxThickness);
    facePortCount.set(key, count);

    const axis = face === 'left' || face === 'right' ? 'y' : 'x';
    const sorted = [...group].sort((a, b) => {
      const targetA = a.from === nodeId ? positions.get(a.to) : positions.get(a.from);
      const targetB = b.from === nodeId ? positions.get(b.to) : positions.get(b.from);
      const va = (axis === 'x' ? targetA?.[0] : targetA?.[1]) ?? 0;
      const vb = (axis === 'x' ? targetB?.[0] : targetB?.[1]) ?? 0;
      return va - vb;
    });

    const portOrder = buildCenterOutOrder(count);
    sorted.forEach((info, index) => {
      const portIndex = count <= 1 ? 0 : portOrder[Math.min(count - 1, index)] ?? 0;
      const side = info.from === nodeId ? 'from' : 'to';
      facePortIndex.set(`${info.id}:${nodeId}:${side}`, portIndex);
    });
  });

  const result = new Map<string, ReadonlyArray<Vec3>>();

  edges.forEach((edge, index) => {
    const id = edge.id ?? `${edge.from}-${edge.to}-${index}`;
    if (edge.from === edge.to) {
      result.set(id, []);
      return;
    }

    const fromPos  = positions.get(edge.from);
    const toPos    = positions.get(edge.to);
    const fromSize = sizes.get(edge.from);
    const toSize   = sizes.get(edge.to);

    if (!fromPos || !toPos || !fromSize || !toSize) {
      console.warn(`Diagram routeEdges: missing node(s) for edge ${edge.from} -> ${edge.to}`);
      result.set(id, [fromPos ?? [0, 0, 0], toPos ?? [0, 0, 0]]);
      return;
    }

    const routing = edge.routing ?? defaultRouting;
    const landing = (edge.fromPort || edge.toPort) ? 'port' : defaultLanding;
    const info = faceInfoById.get(id);
    const srcFace = info?.srcFace ?? resolveFaces(fromPos, fromSize, toPos, toSize, landing, edge.fromPort, edge.toPort).srcFace;
    const dstFace = info?.dstFace ?? resolveFaces(fromPos, fromSize, toPos, toSize, landing, edge.fromPort, edge.toPort).dstFace;
    const fromKey = `${edge.from}:${srcFace}`;
    const toKey = `${edge.to}:${dstFace}`;
    const fromPortCount = facePortCount.get(fromKey) ?? 1;
    const toPortCount = facePortCount.get(toKey) ?? 1;
    const fromPortIndex = facePortIndex.get(`${id}:${edge.from}:from`) ?? 0;
    const toPortIndex = facePortIndex.get(`${id}:${edge.to}:to`) ?? 0;
    const fromAnchor = edge.fromPort
      ? undefined
      : getFacePortAnchor(fromPos, fromSize, srcFace, fromPortIndex, fromPortCount, toPos);
    const toAnchor = edge.toPort
      ? undefined
      : getFacePortAnchor(toPos, toSize, dstFace, toPortIndex, toPortCount, fromPos);

    result.set(id, routeOneEdge(
      id, fromPos, fromSize, toPos, toSize,
      routing, landing, edge.fromPort, edge.toPort, fromAnchor, toAnchor,
    ));
  });

  return result;
}
