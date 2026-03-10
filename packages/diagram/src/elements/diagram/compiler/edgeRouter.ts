// Edge routing utilities extracted from compile.ts.
// Pure functions only — no Three.js, no React.

import type {
  DiagramEdgePathDebug,
  DiagramEdgePathState,
  DiagramEdgePort,
  DiagramWarnFn,
  EdgeLandingAlgorithm,
  EdgeRoutingAlgorithm,
} from '../types';
import { routeCurvedWithEndpointNormals } from './curveKernel';
import {
  buildLegacyEdgePath,
  commandsToControlPoints,
} from './flowPathBuilder';
import {
  routeFlowEdge,
  type FlowRouteResult,
} from './flowRouter';

export type FaceId = 'left' | 'right' | 'top' | 'bottom' | 'front' | 'back';
export type Vec3 = readonly [number, number, number];
export type NodeDimensions = readonly [number, number, number];

type EdgeRoutingInput = {
  id?: string;
  from: string;
  to: string;
  routing?: EdgeRoutingAlgorithm;
  flowTurnRadius?: number;
  flowFaceStub?: number;
  flowBundleStrength?: number;
  flowTargetApproachBias?: number;
  allowUnderpass?: boolean;
  fromPort?: DiagramEdgePort;
  toPort?: DiagramEdgePort;
  thickness?: number;
};

export type FlowRoutingConfig = {
  readonly flowTurnRadius: number;
  readonly flowFaceStub: number;
  readonly flowBundleStrength: number;
  readonly flowObstaclePadding: number;
  readonly flowTargetApproachBias: number;
  readonly flowUnderpassDepth: number;
  readonly flowUnderpassClearance: number;
  readonly flowTurnPenalty: number;
  readonly flowPunchthroughPenalty: number;
  readonly flowUnderpassPenalty: number;
};

export type EdgeRouteState = {
  readonly path: DiagramEdgePathState;
  readonly controlPoints: ReadonlyArray<Vec3>;
  readonly pathDebug?: DiagramEdgePathDebug;
};

const mirrorVecY = (v: Vec3): Vec3 => [v[0], -v[1], v[2]];

const mirrorPathCommandY = (command: DiagramEdgePathState['commands'][number]): DiagramEdgePathState['commands'][number] => {
  if (command.kind === 'line') {
    return {
      kind: 'line',
      from: mirrorVecY(command.from),
      to: mirrorVecY(command.to),
    };
  }
  return {
    kind: 'cubic',
    p0: mirrorVecY(command.p0),
    p1: mirrorVecY(command.p1),
    p2: mirrorVecY(command.p2),
    p3: mirrorVecY(command.p3),
  };
};

const mirrorEdgeRouteStateY = (state: EdgeRouteState): EdgeRouteState => ({
  path: {
    ...state.path,
    commands: state.path.commands.map(mirrorPathCommandY),
    startTangent: mirrorVecY(state.path.startTangent),
    endTangent: mirrorVecY(state.path.endTangent),
  },
  controlPoints: state.controlPoints.map(mirrorVecY),
  pathDebug: state.pathDebug,
});

export const DEFAULT_FLOW_ROUTING_CONFIG: FlowRoutingConfig = {
  flowTurnRadius: 0.035,
  flowFaceStub: 0.05,
  flowBundleStrength: 1.0,
  flowObstaclePadding: 0.025,
  flowTargetApproachBias: 1.35,
  flowUnderpassDepth: 0.08,
  flowUnderpassClearance: 0.03,
  flowTurnPenalty: 0.45,
  flowPunchthroughPenalty: 500,
  flowUnderpassPenalty: 60,
};

const EDGE_EPSILON = 0.012;    // was 0.06 — 6% NVS was too large for dense layouts
const MIN_PORT_PITCH = 0.05;   // was 0.35 — 35% NVS port pitch made multi-port faces impossible
const PORT_SPACING_FACTOR = 3.0;
const PORT_MARGIN_FACTOR = 1.5;
const OBSTACLE_PADDING = 0.03; // was 0.20 — 20% NVS expanded every node obstacle by its full width
const END_TOUCH_TOLERANCE_T = 0.03;
type RoutingWeights = {
  face: {
    penetration: number;
    obstacleHits: number;
    alignment: number;
    direction: number;
    nearEdge: number;
    nearEdgePower: number;
    nearestFaceBias: number;
    length: number;
  };
  port: {
    target: number;
    centerAttraction: number;
    edgeRepulsion: number;
    edgeRepulsionPower: number;
    maxEdgeNormalized: number;
    load: number;
  };
};

const ROUTING_WEIGHTS: RoutingWeights = {
  face: {
    penetration: 10_000,
    obstacleHits: 1_000,
    alignment: 100,
    direction: 400,
    nearEdge: 320,
    nearEdgePower: 3,
    nearestFaceBias: 10,
    length: 1,
  },
  port: {
    target: 80,
    centerAttraction: 120,
    edgeRepulsion: 600,
    edgeRepulsionPower: 8,
    maxEdgeNormalized: 0.82,
    load: 1_000,
  },
};

const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scaleVec = (v: Vec3, scalar: number): Vec3 => [v[0] * scalar, v[1] * scalar, v[2] * scalar];
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const lengthVec = (v: Vec3): number => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
const normalizeVec = (v: Vec3): Vec3 => {
  const len = lengthVec(v);
  if (len <= 1e-9) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
};
const dotVec = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

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

const oddifyPortCount = (count: number): number => (
  count % 2 === 0 ? count + 1 : count
);
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

function nearestFaceForNode(origin: Vec3, target: Vec3, size: NodeDimensions): FaceId {
  const dx = target[0] - origin[0];
  const dy = target[1] - origin[1];
  const dz = target[2] - origin[2];
  const halfW = Math.max(0.001, size[0] * 0.5);
  const halfH = Math.max(0.001, size[1] * 0.5);
  const halfD = Math.max(0.001, size[2] * 0.5);

  const nx = Math.abs(dx) / halfW;
  const ny = Math.abs(dy) / halfH;
  const nz = Math.abs(dz) / halfD;

  if (ny >= nx && ny >= nz) return dy >= 0 ? 'top' : 'bottom';
  if (nx >= nz) return dx >= 0 ? 'right' : 'left';
  return dz >= 0 ? 'front' : 'back';
}

function nearestFaceForNodePair(
  origin: Vec3,
  target: Vec3,
  originSize: NodeDimensions,
  targetSize: NodeDimensions,
): FaceId {
  const face = nearestFaceForNode(origin, target, originSize);
  if (face === 'front' || face === 'back') {
    return target[0] >= origin[0] ? 'right' : 'left';
  }
  void targetSize;
  return face;
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
    const sf = fromPort ? portToFace(fromPort) : nearestFaceForNodePair(srcPos, dstPos, srcSize, dstSize);
    const df = toPort ? portToFace(toPort) : nearestFaceForNodePair(dstPos, srcPos, dstSize, srcSize);
    return { srcFace: sf, dstFace: df };
  }
  if (landing === 'shortest-path') return shortestPathFaces(srcPos, srcSize, dstPos, dstSize);
  if (landing === 'center') {
    return {
      srcFace: nearestFaceForNodePair(srcPos, dstPos, srcSize, dstSize),
      dstFace: nearestFaceForNodePair(dstPos, srcPos, dstSize, srcSize),
    };
  }
  return {
    srcFace: nearestFaceForNodePair(srcPos, dstPos, srcSize, dstSize),
    dstFace: nearestFaceForNodePair(dstPos, srcPos, dstSize, srcSize),
  };
}

export function routeEdgeCurved(
  srcPos: Vec3, srcSize: NodeDimensions, srcFace: FaceId,
  dstPos: Vec3, dstSize: NodeDimensions, dstFace: FaceId,
  srcAnchor?: Vec3,
  dstAnchor?: Vec3,
): ReadonlyArray<Vec3> {
  return routeEdgeCurvedProfile(
    srcPos,
    srcSize,
    srcFace,
    dstPos,
    dstSize,
    dstFace,
    'render',
    srcAnchor,
    dstAnchor,
  );
}

function routeEdgeCurvedProfile(
  srcPos: Vec3,
  srcSize: NodeDimensions,
  srcFace: FaceId,
  dstPos: Vec3,
  dstSize: NodeDimensions,
  dstFace: FaceId,
  profile: 'render' | 'face-scoring',
  srcAnchor?: Vec3,
  dstAnchor?: Vec3,
): ReadonlyArray<Vec3> {
  const srcCenter = srcAnchor ?? getFaceCenter(srcPos, srcSize, srcFace);
  const dstCenter = dstAnchor ?? getFaceCenter(dstPos, dstSize, dstFace);
  const srcNormal = getFaceNormal(srcFace);
  const dstNormal = getFaceNormal(dstFace);
  const srcIsSide = srcFace === 'left' || srcFace === 'right';
  const dstIsSide = dstFace === 'left' || dstFace === 'right';
  const renderProfile = profile === 'render';
  return routeCurvedWithEndpointNormals(srcCenter, dstCenter, srcNormal, dstNormal, {
    /**
     * Minimum distance below which endpoint normals are considered parallel —
     * prevents degenerate handles on nearly-coincident nodes.
     */
    epsilon: EDGE_EPSILON,
    /**
     * Minimum Bézier handle length as a fraction of node-to-node distance.
     * Prevents overly straight curves for very close nodes.
     */
    handleMin: 0.04,
    /**
     * Maximum Bézier handle length as a fraction of node-to-node distance.
     * Caps handles so long-range edges don't produce extreme loops.
     */
    handleMax: 1.1,
    /**
     * Linear scale factor mapping node-to-node distance to handle length.
     * handle = clamp(distance × handleFactor, handleMin, handleMax)
     */
    handleFactor: 0.22,
    /**
     * If true, replace the curved path with a straight line segment when the
     * src/dst faces permit it. Only allowed for top/bottom face pairs to avoid
     * visually ambiguous straight connections on side faces.
     */
    allowDirectSegment: !srcIsSide && !dstIsSide,
    /**
     * Node-to-node distance below which allowDirectSegment is applied.
     * Nodes farther apart than this always use the curved profile.
     */
    directDistanceThreshold: 0.6,
    /**
     * Dot-product alignment threshold for direct segment.
     * Both normals must point in near-opposite directions (cos(θ) > 0.97)
     * for the direct segment to engage. Prevents straight lines on diagonal faces.
     */
    directAlignmentThreshold: 0.97,
    /** Allow the source handle to exit perpendicular to a side face. */
    startPreferSide: renderProfile && srcIsSide,
    /** Allow the destination handle to exit perpendicular to a side face. */
    endPreferSide: renderProfile && dstIsSide,
    /**
     * Y-component fraction of node height below which a face-exit is treated
     * as "side-exiting" (horizontal). Prevents handle miscalculation when
     * nodes are nearly level horizontally.
     */
    sideVerticalRatioThreshold: 0.3,
    /**
     * Base vertical handle component added when a side face exits upward/downward.
     * Produces a gentle arc rather than a sharp kink for near-horizontal exits.
     */
    sideVerticalBase: 0.45,
    /**
     * Additional vertical handle component per unit of vertical node-to-node distance.
     * Scales the upward/downward arc proportionally to how far apart the nodes are.
     */
    sideVerticalFactor: 0.18,
    /**
     * Maximum vertical handle component for side-exiting faces.
     * Prevents runaway arcs on very tall diagrams.
     */
    sideVerticalMax: 3.2,
    /**
     * Minimum handle length for side-face exits when using the render profile.
     * Ensures a visible exit perpendicular to the node face even for close nodes.
     * 0 when not in render profile (routing-only pass uses shorter handles).
     */
    minSideHandle: renderProfile ? 0.12 : 0,
  });
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

/**
 * Routes an edge using the organic algorithm: a curved path with a deterministic
 * perpendicular offset applied to the cubic bezier handles.
 *
 * @param organicVariation - Scalar controlling the magnitude of the perpendicular
 *   handle offset. Sourced from `DiagramTheme.edge.organicVariation`.
 *   A pure curved path results when set to 0. The final offset is scaled relative
 *   to the routed edge span so theme values remain stable across diagram sizes.
 */
export function routeEdgeOrganic(
  srcPos: Vec3, srcSize: NodeDimensions, srcFace: FaceId,
  dstPos: Vec3, dstSize: NodeDimensions, dstFace: FaceId,
  edgeId: string,
  organicVariation: number,
  srcAnchor?: Vec3,
  dstAnchor?: Vec3,
): ReadonlyArray<Vec3> {
  const base = routeEdgeCurved(srcPos, srcSize, srcFace, dstPos, dstSize, dstFace, srcAnchor, dstAnchor);
  const seed = Math.abs(hashStr(edgeId));
  const [p0, p1, p2, p3] = base;
  if (!p1 || !p2 || !p3) return base;

  const dx = p3[0] - p0[0];
  const dy = p3[1] - p0[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const edgeScale = Math.max(0.03, Math.min(0.18, len * 0.22));
  const offset = (((seed % 1000) / 1000) - 0.5) * organicVariation * edgeScale;

  const c1: Vec3 = [p1[0] + perpX * offset * 1.15, p1[1] + perpY * offset * 1.15, p1[2]];
  const c2: Vec3 = [p2[0] - perpX * offset * 0.65, p2[1] - perpY * offset * 0.65, p2[2]];
  return [p0, c1, c2, p3];
}

export function routeEdgeOrthogonal(
  srcPos: Vec3, srcSize: NodeDimensions, srcFace: FaceId,
  dstPos: Vec3, dstSize: NodeDimensions, dstFace: FaceId,
  cornerRadius: number = 0.02,
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

  const stub = 0.12;
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
  const roundOrthogonalPolyline = (points: ReadonlyArray<Vec3>, radius: number): ReadonlyArray<Vec3> => {
    if (radius <= 0 || points.length < 3) return points;
    const rounded: Vec3[] = [points[0]!];
    for (let i = 1; i < points.length - 1; i += 1) {
      const prev = points[i - 1]!;
      const current = points[i]!;
      const next = points[i + 1]!;
      const keepEndpointCornerSharp = i === 1 || i === points.length - 2;
      const inDx = current[0] - prev[0];
      const inDy = current[1] - prev[1];
      const outDx = next[0] - current[0];
      const outDy = next[1] - current[1];
      const inLen = Math.sqrt(inDx * inDx + inDy * inDy);
      const outLen = Math.sqrt(outDx * outDx + outDy * outDy);
      const isCorner = inLen > 1e-6 && outLen > 1e-6 &&
        (Math.abs(inDx) < 1e-6) !== (Math.abs(outDx) < 1e-6);
      if (!isCorner || keepEndpointCornerSharp) {
        rounded.push(current);
        continue;
      }
      const appliedRadius = clamp(radius, 0, Math.min(inLen, outLen) * 0.45);
      const inUnitX = inDx / inLen;
      const inUnitY = inDy / inLen;
      const outUnitX = outDx / outLen;
      const outUnitY = outDy / outLen;
      rounded.push([
        current[0] - inUnitX * appliedRadius,
        current[1] - inUnitY * appliedRadius,
        current[2],
      ]);
      rounded.push([
        current[0] + outUnitX * appliedRadius,
        current[1] + outUnitY * appliedRadius,
        current[2],
      ]);
    }
    rounded.push(points[points.length - 1]!);
    return rounded;
  };

  const rawPoints: Vec3[] = isH(srcFace) && isH(dstFace)
    ? [
      start,
      [g1x, g1y, g1z],
      [(g1x + g2x) / 2, g1y, midZ],
      [(g1x + g2x) / 2, g2y, midZ],
      [g2x, g2y, g2z],
      end,
    ]
    : isV(srcFace) && isV(dstFace)
      ? [
        start,
        [g1x, g1y, g1z],
        [g1x, (g1y + g2y) / 2, midZ],
        [g2x, (g1y + g2y) / 2, midZ],
        [g2x, g2y, g2z],
        end,
      ]
      : [
        start,
        [g1x, g1y, g1z],
        [g2x, g1y, midZ],
        [g2x, g2y, g2z],
        end,
      ];

  return roundOrthogonalPolyline(rawPoints, cornerRadius);
}

function routeOneEdge(
  edgeId: string,
  fromPos: Vec3, fromSize: NodeDimensions,
  toPos: Vec3, toSize: NodeDimensions,
  routing: EdgeRoutingAlgorithm,
  landing: EdgeLandingAlgorithm,
  organicVariation: number,
  fromPort?: DiagramEdgePort,
  toPort?: DiagramEdgePort,
  fromAnchor?: Vec3,
  toAnchor?: Vec3,
  resolvedFaces?: FacePair,
): ReadonlyArray<Vec3> {
  if (landing === 'center') {
    const sn = getFaceNormal(nearestFaceForNode(fromPos, toPos, fromSize));
    const dn = getFaceNormal(nearestFaceForNode(toPos, fromPos, toSize));
    const start = addVec(fromPos, scaleVec(sn, EDGE_EPSILON));
    const end   = addVec(toPos,   scaleVec(dn, EDGE_EPSILON));
    if (routing === 'straight') return [start, end];
    const dist = Math.sqrt((toPos[0]-fromPos[0])**2 + (toPos[1]-fromPos[1])**2 + (toPos[2]-fromPos[2])**2);
    const stub = Math.max(0.25, Math.min(1.6, dist * 0.22));
    return [start, addVec(start, scaleVec(sn, stub)), addVec(end, scaleVec(dn, stub)), end];
  }

  const { srcFace, dstFace } = resolvedFaces
    ?? resolveFaces(fromPos, fromSize, toPos, toSize, landing, fromPort, toPort);

  switch (routing) {
    case 'straight':    return routeEdgeStraight(fromPos, fromSize, srcFace, toPos, toSize, dstFace, fromAnchor, toAnchor);
    case 'organic':     return routeEdgeOrganic(fromPos, fromSize, srcFace, toPos, toSize, dstFace, edgeId, organicVariation, fromAnchor, toAnchor);
    case 'flow':        return routeEdgeStraight(fromPos, fromSize, srcFace, toPos, toSize, dstFace, fromAnchor, toAnchor);
    case 'curved':
    default:            return routeEdgeCurved(fromPos, fromSize, srcFace, toPos, toSize, dstFace, fromAnchor, toAnchor);
  }
}

type FacePair = { srcFace: FaceId; dstFace: FaceId };
type FlowRouteLookup = (pair: FacePair) => FlowRouteResult;

type FlowAnchors = {
  readonly sourceAnchor?: Vec3;
  readonly destinationAnchor?: Vec3;
  readonly sourceGuide?: Vec3;
  readonly destinationGuide?: Vec3;
};

type FlowBundleConfig = {
  readonly sourceFace: FaceId;
  readonly sourceAnchor: Vec3;
  readonly sourceGuide: Vec3;
};

type FlowFanoutConfig = {
  readonly bundles: ReadonlyMap<string, FlowBundleConfig>;
  readonly sourceFaceOverrides: ReadonlyMap<string, FaceId>;
};

const resolveFlowBundleStrength = (
  edge: EdgeRoutingInput,
  flowConfig: FlowRoutingConfig,
): number => edge.flowBundleStrength ?? flowConfig.flowBundleStrength;

const resolveFlowTargetApproachBias = (
  edge: EdgeRoutingInput,
  flowConfig: FlowRoutingConfig,
): number => edge.flowTargetApproachBias ?? flowConfig.flowTargetApproachBias;

function buildFlowDestinationGuide(
  fromPos: Vec3,
  toPos: Vec3,
  destinationAnchor: Vec3,
  dstFace: FaceId,
  faceStub: number,
  targetApproachBias: number,
): Vec3 | undefined {
  if (targetApproachBias <= 0) return undefined;
  const normal = getFaceNormal(dstFace);
  const fromAnchorToSource = normalizeVec([
    fromPos[0] - destinationAnchor[0],
    fromPos[1] - destinationAnchor[1],
    fromPos[2] - destinationAnchor[2],
  ]);
  const facingSource = dotVec(normal, fromAnchorToSource);
  if (facingSource <= 0.05) return undefined;
  const dx = toPos[0] - fromPos[0];
  const dy = toPos[1] - fromPos[1];
  const dz = toPos[2] - fromPos[2];
  const span = Math.sqrt(dx * dx + dy * dy + dz * dz) || faceStub;
  const clampedBias = clamp(targetApproachBias, 0, 2);
  const maxGuideDistance = Math.max(faceStub, span * 0.28);
  const preferredDistance = Math.max(
    faceStub * (1.5 + clampedBias * 2.5),
    span * (0.06 + clampedBias * 0.12),
  );
  return addVec(destinationAnchor, scaleVec(normal, Math.min(maxGuideDistance, preferredDistance)));
}

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
  void edgeId;
  switch (routing) {
    case 'straight':
      return routeEdgeStraight(fromPos, fromSize, srcFace, toPos, toSize, dstFace);
    case 'organic':
      return routeEdgeCurvedProfile(fromPos, fromSize, srcFace, toPos, toSize, dstFace, 'face-scoring');
    case 'flow':
      return routeEdgeStraight(fromPos, fromSize, srcFace, toPos, toSize, dstFace);
    case 'curved':
    default:
      return routeEdgeCurvedProfile(fromPos, fromSize, srcFace, toPos, toSize, dstFace, 'face-scoring');
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
  fromPos: Vec3,
  toPos: Vec3,
): ObstacleRect[] {
  const rects: ObstacleRect[] = [];
  const pointInsideRect = (point: Vec3, rect: ObstacleRect): boolean =>
    point[0] >= rect.left && point[0] <= rect.right && point[1] >= rect.bottom && point[1] <= rect.top;
  positions.forEach((pos, id) => {
    if (id === fromId || id === toId) return;
    const size = sizes.get(id);
    if (!size) return;
    const halfW = size[0] / 2 + OBSTACLE_PADDING;
    const halfH = size[1] / 2 + OBSTACLE_PADDING;
    const rect: ObstacleRect = {
      left: pos[0] - halfW,
      right: pos[0] + halfW,
      bottom: pos[1] - halfH,
      top: pos[1] + halfH,
    };
    if (pointInsideRect(fromPos, rect) || pointInsideRect(toPos, rect)) return;
    rects.push(rect);
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

function polylineProjectionOvershoot(
  points: ReadonlyArray<Vec3>,
  fromPos: Vec3,
  toPos: Vec3,
): number {
  if (points.length === 0) return 0;
  const axisX = toPos[0] - fromPos[0];
  const axisY = toPos[1] - fromPos[1];
  const axisZ = toPos[2] - fromPos[2];
  const axisLenSq = axisX * axisX + axisY * axisY + axisZ * axisZ;
  if (axisLenSq <= 1e-9) return 0;

  const tolerance = 0.06;
  let overshoot = 0;
  for (const point of points) {
    const relX = point[0] - fromPos[0];
    const relY = point[1] - fromPos[1];
    const relZ = point[2] - fromPos[2];
    const t = (relX * axisX + relY * axisY + relZ * axisZ) / axisLenSq;
    if (t < -tolerance) {
      overshoot += -tolerance - t;
    } else if (t > 1 + tolerance) {
      overshoot += t - (1 + tolerance);
    }
  }
  return overshoot;
}

function segmentClipRange2D(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: ObstacleRect,
): readonly [number, number] | null {
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

  if (!clip(-dx, x1 - rect.left)) return null;
  if (!clip(dx, rect.right - x1)) return null;
  if (!clip(-dy, y1 - rect.bottom)) return null;
  if (!clip(dy, rect.top - y1)) return null;
  if (t0 > t1) return null;
  return [t0, t1];
}

function polylineRectPenetration(
  points: ReadonlyArray<Vec3>,
  rect: ObstacleRect,
  allowTouchAtStart: boolean,
  allowTouchAtEnd: boolean,
): number {
  if (points.length < 2) return 0;
  const lastSeg = points.length - 2;
  let penetration = 0;
  for (let i = 0; i <= lastSeg; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    const clipRange = segmentClipRange2D(a[0], a[1], b[0], b[1], rect);
    if (!clipRange) continue;
    let [t0, t1] = clipRange;
    if (allowTouchAtStart && i === 0 && t0 <= END_TOUCH_TOLERANCE_T) {
      t0 = Math.min(t1, END_TOUCH_TOLERANCE_T);
    }
    if (allowTouchAtEnd && i === lastSeg && t1 >= 1 - END_TOUCH_TOLERANCE_T) {
      t1 = Math.max(t0, 1 - END_TOUCH_TOLERANCE_T);
    }
    if (t1 <= t0) continue;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const segLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    penetration += segLen * (t1 - t0);
  }
  return penetration;
}

function endpointAlignmentPenalty(points: ReadonlyArray<Vec3>, srcFace: FaceId, dstFace: FaceId): number {
  if (points.length < 2) return 2;
  const start = points[0];
  const next = points[1];
  const prev = points[points.length - 2];
  const end = points[points.length - 1];
  if (!start || !next || !prev || !end) return 2;

  const srcDirX = next[0] - start[0];
  const srcDirY = next[1] - start[1];
  const srcDirZ = next[2] - start[2];
  const srcLen = Math.sqrt(srcDirX * srcDirX + srcDirY * srcDirY + srcDirZ * srcDirZ) || 1;
  const srcDir: Vec3 = [srcDirX / srcLen, srcDirY / srcLen, srcDirZ / srcLen];

  const dstInX = prev[0] - end[0];
  const dstInY = prev[1] - end[1];
  const dstInZ = prev[2] - end[2];
  const dstLen = Math.sqrt(dstInX * dstInX + dstInY * dstInY + dstInZ * dstInZ) || 1;
  const dstIn: Vec3 = [dstInX / dstLen, dstInY / dstLen, dstInZ / dstLen];

  const srcNormal = getFaceNormal(srcFace);
  const dstNormal = getFaceNormal(dstFace);
  const srcAlign = Math.max(-1, Math.min(1, srcDir[0] * srcNormal[0] + srcDir[1] * srcNormal[1] + srcDir[2] * srcNormal[2]));
  const dstAlign = Math.max(-1, Math.min(1, dstIn[0] * dstNormal[0] + dstIn[1] * dstNormal[1] + dstIn[2] * dstNormal[2]));
  return (1 - srcAlign) + (1 - dstAlign);
}

function faceDirectionPenalty(fromPos: Vec3, toPos: Vec3, srcFace: FaceId, dstFace: FaceId): number {
  const dx = toPos[0] - fromPos[0];
  const dy = toPos[1] - fromPos[1];
  const dz = toPos[2] - fromPos[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const dir: Vec3 = [dx / len, dy / len, dz / len];
  const srcNormal = getFaceNormal(srcFace);
  const dstNormal = getFaceNormal(dstFace);
  const srcToward = srcNormal[0] * dir[0] + srcNormal[1] * dir[1] + srcNormal[2] * dir[2];
  const dstToward = dstNormal[0] * -dir[0] + dstNormal[1] * -dir[1] + dstNormal[2] * -dir[2];
  // Penalize faces that point away from the opposite node.
  const srcPenalty = 1 - Math.max(0, srcToward);
  const dstPenalty = 1 - Math.max(0, dstToward);
  return srcPenalty + dstPenalty;
}

function faceNearEdgePenalty(nodePos: Vec3, nodeSize: NodeDimensions, face: FaceId, targetPos: Vec3): number {
  const span =
    face === 'top' || face === 'bottom'
      ? nodeSize[0]
      : (face === 'left' || face === 'right' ? nodeSize[1] : 0);
  if (span <= 0) return 0;
  const center = face === 'top' || face === 'bottom' ? nodePos[0] : nodePos[1];
  const target = face === 'top' || face === 'bottom' ? targetPos[0] : targetPos[1];
  const halfSpan = Math.max(0.001, span * 0.5);
  const normalized = Math.min(1, Math.abs(target - center) / halfSpan);
  return Math.pow(normalized, ROUTING_WEIGHTS.face.nearEdgePower);
}

function sourceFaceFanoutPenalty(
  fromPos: Vec3,
  fromSize: NodeDimensions,
  toPos: Vec3,
  srcFace: FaceId,
): number {
  if (srcFace === 'front' || srcFace === 'back') return 2;
  const dx = toPos[0] - fromPos[0];
  const dy = toPos[1] - fromPos[1];
  const halfW = Math.max(0.001, fromSize[0] * 0.5);
  const halfH = Math.max(0.001, fromSize[1] * 0.5);
  const prefersHorizontal =
    Math.abs(dx) >= Math.abs(dy) * 0.65 ||
    Math.abs(dx) >= halfW * 1.15;
  const prefersVertical =
    Math.abs(dy) >= Math.abs(dx) * 1.35 &&
    Math.abs(dy) >= halfH * 1.15;

  if (prefersHorizontal) {
    if (dx < 0 && srcFace === 'left') return 0;
    if (dx > 0 && srcFace === 'right') return 0;
    if (srcFace === 'top' || srcFace === 'bottom') return 1.2;
    return 0.3;
  }

  if (prefersVertical) {
    if (dy < 0 && srcFace === 'bottom') return 0;
    if (dy > 0 && srcFace === 'top') return 0;
    if (srcFace === 'left' || srcFace === 'right') return 0.9;
  }

  return 0;
}

function destinationFaceIngressPenalty(
  fromPos: Vec3,
  fromSize: NodeDimensions,
  toPos: Vec3,
  toSize: NodeDimensions,
  srcFace: FaceId,
  dstFace: FaceId,
): number {
  if (dstFace === 'front' || dstFace === 'back') return 2.5;

  const fromLeft = fromPos[0] - fromSize[0] / 2;
  const fromRight = fromPos[0] + fromSize[0] / 2;
  const fromBottom = fromPos[1] - fromSize[1] / 2;
  const fromTop = fromPos[1] + fromSize[1] / 2;
  const toLeft = toPos[0] - toSize[0] / 2;
  const toRight = toPos[0] + toSize[0] / 2;
  const toBottom = toPos[1] - toSize[1] / 2;
  const toTop = toPos[1] + toSize[1] / 2;

  const horizontalGap = Math.max(0, fromLeft - toRight, toLeft - fromRight);
  const verticalGap = Math.max(0, fromBottom - toTop, toBottom - fromTop);
  const horizontalOverlap = Math.max(0, Math.min(fromRight, toRight) - Math.max(fromLeft, toLeft));
  const verticalOverlap = Math.max(0, Math.min(fromTop, toTop) - Math.max(fromBottom, toBottom));

  if (fromPos[1] > toPos[1]) {
    const strongTopIngress =
      horizontalOverlap > 0 ||
      horizontalGap <= Math.max(0.6, Math.min(fromSize[0], toSize[0]) * 0.25);
    if (strongTopIngress) {
      if (dstFace === 'top') return 0;
      if (dstFace === 'left' || dstFace === 'right') return 1.4;
      return 2.2;
    }
  }

  if (fromPos[1] < toPos[1]) {
    const strongBottomIngress =
      horizontalOverlap > 0 ||
      horizontalGap <= Math.max(0.6, Math.min(fromSize[0], toSize[0]) * 0.25);
    if (strongBottomIngress) {
      if (dstFace === 'bottom') return 0;
      if (dstFace === 'left' || dstFace === 'right') return 1.4;
      return 2.2;
    }
  }

  if (fromPos[0] < toPos[0]) {
    const strongLeftIngress =
      verticalOverlap > 0 ||
      verticalGap <= Math.max(0.6, Math.min(fromSize[1], toSize[1]) * 0.25);
    if (strongLeftIngress) {
      if (dstFace === 'left') return 0;
      if (dstFace === 'top' || dstFace === 'bottom') return 0.8;
      return 2;
    }
  }

  if (fromPos[0] > toPos[0]) {
    const strongRightIngress =
      verticalOverlap > 0 ||
      verticalGap <= Math.max(0.6, Math.min(fromSize[1], toSize[1]) * 0.25);
    if (strongRightIngress) {
      if (dstFace === 'right') return 0;
      if (dstFace === 'top' || dstFace === 'bottom') return 0.8;
      return 2;
    }
  }

  return 0;
}

function buildFlowBundleConfigs(
  edges: ReadonlyArray<EdgeRoutingInput>,
  positions: Map<string, Vec3>,
  sizes: Map<string, NodeDimensions>,
  defaultRouting: EdgeRoutingAlgorithm,
  flowConfig: FlowRoutingConfig,
): FlowFanoutConfig {
  const outgoing = new Map<string, EdgeRoutingInput[]>();
  edges.forEach((edge, index) => {
    const routing = edge.routing ?? defaultRouting;
    if (routing !== 'flow' || edge.fromPort) return;
    const group = outgoing.get(edge.from) ?? [];
    group.push({ ...edge, id: edge.id ?? `${edge.from}-${edge.to}-${index}` });
    outgoing.set(edge.from, group);
  });

  const bundles = new Map<string, FlowBundleConfig>();
  const sourceFaceOverrides = new Map<string, FaceId>();

  outgoing.forEach((group, sourceId) => {
    if (group.length < 2) return;
    const sourcePos = positions.get(sourceId);
    const sourceSize = sizes.get(sourceId);
    if (!sourcePos || !sourceSize) return;
    const bundleStrength = group.reduce(
      (acc, edge) => Math.min(acc, resolveFlowBundleStrength(edge, flowConfig)),
      Infinity,
    );
    if (bundleStrength <= 0) return;

    let hasLeft = false;
    let hasRight = false;
    let allPositiveY = true;
    let allNegativeY = true;
    const verticalTolerance = Math.max(0.04, sourceSize[1] * 0.08);
    const edgeTargets: Array<{
      edgeId: string;
      targetPos: Vec3;
      targetSize: NodeDimensions;
      projectedDistance: number;
      preferredSideFace?: FaceId;
    }> = [];

    for (const edge of group) {
      const targetPos = positions.get(edge.to);
      const targetSize = sizes.get(edge.to);
      if (!targetPos || !targetSize) return;
      if (targetPos[0] < sourcePos[0] - sourceSize[0] * 0.1) hasLeft = true;
      if (targetPos[0] > sourcePos[0] + sourceSize[0] * 0.1) hasRight = true;
      const dy = targetPos[1] - sourcePos[1];
      if (dy <= verticalTolerance) allPositiveY = false;
      if (dy >= -verticalTolerance) allNegativeY = false;
    }

    if (!hasLeft || !hasRight) return;
    if (!allPositiveY && !allNegativeY) return;

    const sourceFace: FaceId = allPositiveY ? 'top' : 'bottom';
    const sourceNormal = getFaceNormal(sourceFace);
    const sourceAnchor: Vec3 = [
      sourcePos[0] + sourceNormal[0] * sourceSize[0] * 0.5,
      sourcePos[1] + sourceNormal[1] * sourceSize[1] * 0.5,
      sourcePos[2] + sourceNormal[2] * sourceSize[2] * 0.5,
    ];

    for (const edge of group) {
      const targetPos = positions.get(edge.to);
      const targetSize = sizes.get(edge.to);
      if (!targetPos || !targetSize) continue;
      const projectedDistance = sourceNormal[1] * (targetPos[1] - sourceAnchor[1]);
      if (projectedDistance <= 0) continue;
      const preferredSideFace = targetPos[0] < sourcePos[0] - sourceSize[0] * 0.1
        ? 'left'
        : (
          targetPos[0] > sourcePos[0] + sourceSize[0] * 0.1
            ? 'right'
            : undefined
        );
      edgeTargets.push({
        edgeId: edge.id ?? '',
        targetPos,
        targetSize,
        projectedDistance,
        preferredSideFace,
      });
    }

    if (edgeTargets.length < 2) return;
    edgeTargets.sort((a, b) => a.projectedDistance - b.projectedDistance);
    const minProjectedDistance = edgeTargets[0]?.projectedDistance ?? Infinity;
    const rowSeparationThreshold = Math.max(sourceSize[1] * 1.25, flowConfig.flowFaceStub * 6);
    const fartherTargets = edgeTargets.filter((entry) => entry.projectedDistance > minProjectedDistance + rowSeparationThreshold);
    const bundleTargets = fartherTargets.length >= 2 ? fartherTargets : edgeTargets;
    const nearestProjectedDistance = bundleTargets[0]?.projectedDistance ?? Infinity;
    const availableRun = Number.isFinite(nearestProjectedDistance)
      ? nearestProjectedDistance
      : Math.max(sourceSize[1], flowConfig.flowFaceStub * 3);
    const guideFraction = clamp(0.15 + clamp(bundleStrength, 0, 1.5) * 0.35, 0.15, 0.65);
    const guideDistance = Math.max(
      flowConfig.flowFaceStub * 1.25,
      Math.min(availableRun * guideFraction, availableRun - Math.max(0.025, flowConfig.flowFaceStub * 0.5)),
    );
    const bundleConfig: FlowBundleConfig = {
      sourceFace,
      sourceAnchor,
      sourceGuide: addVec(sourceAnchor, scaleVec(sourceNormal, guideDistance)),
    };
    bundleTargets.forEach((entry) => {
      const edgeId = entry.edgeId || `${sourceId}-${entry.targetPos.join(',')}`;
      bundles.set(edgeId, bundleConfig);
    });

    if (fartherTargets.length >= 2) {
      const bundledIds = new Set(bundleTargets.map((entry) => entry.edgeId));
      edgeTargets.forEach((entry) => {
        if (bundledIds.has(entry.edgeId)) return;
        if (!entry.preferredSideFace) return;
        sourceFaceOverrides.set(entry.edgeId, entry.preferredSideFace);
      });
    }
  });

  return {
    bundles,
    sourceFaceOverrides,
  };
}

function resolveFacesByCost(
  edgeId: string,
  fromId: string,
  toId: string,
  fromPos: Vec3,
  fromSize: NodeDimensions,
  toPos: Vec3,
  toSize: NodeDimensions,
  routing: EdgeRoutingAlgorithm,
  lockedSrcFace: FaceId | undefined,
  lockedDstFace: FaceId | undefined,
  positions: Map<string, Vec3>,
  sizes: Map<string, NodeDimensions>,
  flowConfig: FlowRoutingConfig,
  flowTargetApproachBias: number,
  getFlowRoute: FlowRouteLookup,
): FacePair {
  const base = resolveFaces(fromPos, fromSize, toPos, toSize, 'nearest-face', lockedSrcFace, lockedDstFace);
  const faces: readonly FaceId[] = ['left', 'right', 'top', 'bottom'];
  const absDx = Math.abs(toPos[0] - fromPos[0]);
  const absDy = Math.abs(toPos[1] - fromPos[1]);
  const sourceDirectionalFaces: readonly FaceId[] =
    routing === 'flow'
      ? faces
      : (
        absDx >= absDy * 1.15
          ? ['left', 'right']
          : (absDy >= absDx * 1.15 ? ['top', 'bottom'] : faces)
      );
  const destinationDirectionalFaces: readonly FaceId[] = faces;
  const srcCandidates = lockedSrcFace ? [lockedSrcFace] : [...sourceDirectionalFaces];
  const dstCandidates = lockedDstFace ? [lockedDstFace] : [...destinationDirectionalFaces];
  const candidates: FacePair[] = [];
  for (const srcFace of srcCandidates) {
    for (const dstFace of dstCandidates) {
      candidates.push({ srcFace, dstFace });
    }
  }

  const obstacles = computeObstacleRects(positions, sizes, fromId, toId, fromPos, toPos);
  const fromRect: ObstacleRect = {
    left: fromPos[0] - fromSize[0] / 2,
    right: fromPos[0] + fromSize[0] / 2,
    bottom: fromPos[1] - fromSize[1] / 2,
    top: fromPos[1] + fromSize[1] / 2,
  };
  const toRect: ObstacleRect = {
    left: toPos[0] - toSize[0] / 2,
    right: toPos[0] + toSize[0] / 2,
    bottom: toPos[1] - toSize[1] / 2,
    top: toPos[1] + toSize[1] / 2,
  };

  if (routing === 'flow') {
    const scored = candidates.map((pair) => {
      const routed = getFlowRoute(pair);
      const points = routed.controlPoints;
      const turnCount = routed.path.commands.filter((command) => command.kind === 'cubic').length;
      const puncturePenalty = routed.path.punctures.length * flowConfig.flowPunchthroughPenalty;
      const underpassPenalty = routed.path.usedUnderpass ? flowConfig.flowUnderpassPenalty : 0;
      const sourcePenetration = polylineRectPenetration(points, fromRect, true, false);
      const targetPenetration = polylineRectPenetration(points, toRect, false, true);
      const hits = polylineObstacleHits(points, obstacles);
      const alignmentPenalty = endpointAlignmentPenalty(points, pair.srcFace, pair.dstFace);
      const directionPenalty = faceDirectionPenalty(fromPos, toPos, pair.srcFace, pair.dstFace);
      const nearEdgePenalty =
        faceNearEdgePenalty(fromPos, fromSize, pair.srcFace, toPos) +
        faceNearEdgePenalty(toPos, toSize, pair.dstFace, fromPos);
      const fanoutPenalty = sourceFaceFanoutPenalty(fromPos, fromSize, toPos, pair.srcFace);
      const ingressPenalty = destinationFaceIngressPenalty(
        fromPos,
        fromSize,
        toPos,
        toSize,
        pair.srcFace,
        pair.dstFace,
      );
      const baseBias = pair.srcFace === base.srcFace && pair.dstFace === base.dstFace ? 0 : 1;
      const length = polylineLength(points);
      const projectionOvershoot = polylineProjectionOvershoot(points, fromPos, toPos);
      const blockerPenalty =
        (sourcePenetration + targetPenetration) * ROUTING_WEIGHTS.face.penetration +
        hits * ROUTING_WEIGHTS.face.obstacleHits +
        puncturePenalty +
        underpassPenalty;
      const heuristicPenalty =
        alignmentPenalty * ROUTING_WEIGHTS.face.alignment +
        directionPenalty * ROUTING_WEIGHTS.face.direction +
        nearEdgePenalty * ROUTING_WEIGHTS.face.nearEdge +
        fanoutPenalty * 180 +
        ingressPenalty * 220 * (1 + flowTargetApproachBias * 1.6) +
        baseBias * ROUTING_WEIGHTS.face.nearestFaceBias;
      return {
        pair,
        totalScore:
          blockerPenalty +
          heuristicPenalty +
          length * 120 +
          turnCount * flowConfig.flowTurnPenalty * 90 +
          projectionOvershoot * 1800,
      };
    });

    scored.sort((a, b) => a.totalScore - b.totalScore);
    return scored[0]?.pair ?? base;
  }
  const scored = candidates.map((pair) => {
    const points = routeOneEdgeWithFaces(
      edgeId,
      fromPos,
      fromSize,
      toPos,
      toSize,
      routing,
      pair.srcFace,
      pair.dstFace,
    );
    const sourcePenetration = polylineRectPenetration(points, fromRect, true, false);
    const targetPenetration = polylineRectPenetration(points, toRect, false, true);
    const hits = polylineObstacleHits(points, obstacles);
    const alignmentPenalty = endpointAlignmentPenalty(points, pair.srcFace, pair.dstFace);
    const directionPenalty = faceDirectionPenalty(fromPos, toPos, pair.srcFace, pair.dstFace);
    const nearEdgePenalty =
      faceNearEdgePenalty(fromPos, fromSize, pair.srcFace, toPos) +
      faceNearEdgePenalty(toPos, toSize, pair.dstFace, fromPos);
    const baseBias = pair.srcFace === base.srcFace && pair.dstFace === base.dstFace ? 0 : 1;
    const length = polylineLength(points);
    const totalScore =
      (sourcePenetration + targetPenetration) * ROUTING_WEIGHTS.face.penetration +
      hits * ROUTING_WEIGHTS.face.obstacleHits +
      alignmentPenalty * ROUTING_WEIGHTS.face.alignment +
      directionPenalty * ROUTING_WEIGHTS.face.direction +
      nearEdgePenalty * ROUTING_WEIGHTS.face.nearEdge +
      baseBias * ROUTING_WEIGHTS.face.nearestFaceBias +
      length * ROUTING_WEIGHTS.face.length;
    return {
      pair,
      totalScore,
    };
  });

  const best = [...scored].sort((a, b) => a.totalScore - b.totalScore)[0];
  return best?.pair ?? base;
}

export function routeEdges(
  edges: ReadonlyArray<EdgeRoutingInput>,
  positions: Map<string, Vec3>,
  sizes: Map<string, NodeDimensions>,
  defaultRouting: EdgeRoutingAlgorithm = 'curved',
  defaultLanding: EdgeLandingAlgorithm = 'nearest-face',
  onWarn?: DiagramWarnFn,
  organicVariation: number = 1.6,
  flowConfig: FlowRoutingConfig = DEFAULT_FLOW_ROUTING_CONFIG,
): Map<string, EdgeRouteState> {
  type EdgeFaceInfo = {
    id: string;
    from: string;
    to: string;
    routing: EdgeRoutingAlgorithm;
    flowTargetApproachBias: number;
    srcFace: FaceId;
    dstFace: FaceId;
    thickness: number;
  };

  const faceInfo: EdgeFaceInfo[] = [];
  const faceInfoById = new Map<string, EdgeFaceInfo>();
  const faceGroups = new Map<string, EdgeFaceInfo[]>();
  const flowRouteCache = new Map<string, FlowRouteResult>();
  const resolvedThickness = (edge: EdgeRoutingInput): number => edge.thickness ?? 0.06;
  const flowFanout = buildFlowBundleConfigs(
    edges,
    positions,
    sizes,
    defaultRouting,
    flowConfig,
  );
  const flowBundles = flowFanout.bundles;
  const flowSourceFaceOverrides = flowFanout.sourceFaceOverrides;

  const addToGroup = (nodeId: string, face: FaceId, info: EdgeFaceInfo): void => {
    const key = `${nodeId}:${face}`;
    const group = faceGroups.get(key) ?? [];
    group.push(info);
    faceGroups.set(key, group);
  };

  const getFlowRoute = (
    edgeId: string,
    edge: EdgeRoutingInput,
    fromPos: Vec3,
    fromSize: NodeDimensions,
    toPos: Vec3,
    toSize: NodeDimensions,
      pair: FacePair,
      anchors?: FlowAnchors,
  ): FlowRouteResult => {
    const sourceAnchorKey = anchors?.sourceAnchor?.join(',') ?? 'center';
    const destinationAnchorKey = anchors?.destinationAnchor?.join(',') ?? 'center';
    const sourceGuideKey = anchors?.sourceGuide?.join(',') ?? 'none';
    const destinationGuideKey = anchors?.destinationGuide?.join(',') ?? 'none';
    const key = [
      edgeId,
      pair.srcFace,
      pair.dstFace,
      sourceAnchorKey,
      destinationAnchorKey,
      sourceGuideKey,
      destinationGuideKey,
      edge.flowTurnRadius ?? flowConfig.flowTurnRadius,
      edge.flowFaceStub ?? flowConfig.flowFaceStub,
      edge.allowUnderpass ?? true,
    ].join('|');
    const cached = flowRouteCache.get(key);
    if (cached) return cached;

    const routed = routeFlowEdge({
      edgeId,
      fromId: edge.from,
      toId: edge.to,
      fromPos,
      fromSize,
      toPos,
      toSize,
      srcFace: pair.srcFace,
      dstFace: pair.dstFace,
      sourceAnchor: anchors?.sourceAnchor,
      destinationAnchor: anchors?.destinationAnchor,
      sourceGuide: anchors?.sourceGuide,
      destinationGuide: anchors?.destinationGuide,
      positions,
      sizes,
      flowTurnRadius: edge.flowTurnRadius ?? flowConfig.flowTurnRadius,
      flowFaceStub: edge.flowFaceStub ?? flowConfig.flowFaceStub,
      flowObstaclePadding: flowConfig.flowObstaclePadding,
      flowUnderpassDepth: flowConfig.flowUnderpassDepth,
      flowUnderpassClearance: flowConfig.flowUnderpassClearance,
      flowTurnPenalty: flowConfig.flowTurnPenalty,
      flowPunchthroughPenalty: flowConfig.flowPunchthroughPenalty,
      flowUnderpassPenalty: flowConfig.flowUnderpassPenalty,
      allowUnderpass: edge.allowUnderpass ?? true,
      onWarn,
    });
    flowRouteCache.set(key, routed);
    return routed;
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
    const bundle = routing === 'flow' ? flowBundles.get(id) : undefined;
    const lockedSrcFace = edge.fromPort
      ? portToFace(edge.fromPort)
      : (bundle?.sourceFace ?? flowSourceFaceOverrides.get(id));
    const lockedDstFace = edge.toPort ? portToFace(edge.toPort) : undefined;
    const shouldUseCostSelection =
      (landing === 'nearest-face' && !edge.fromPort && !edge.toPort) ||
      (landing === 'port' && (!!edge.fromPort !== !!edge.toPort));
    if (shouldUseCostSelection) {
      const selected = resolveFacesByCost(
        id,
        edge.from,
        edge.to,
        fromPos,
        fromSize,
        toPos,
        toSize,
        routing,
        lockedSrcFace,
        lockedDstFace,
        positions,
        sizes,
        flowConfig,
        resolveFlowTargetApproachBias(edge, flowConfig),
        (pair) => getFlowRoute(id, edge, fromPos, fromSize, toPos, toSize, pair, {
          sourceAnchor: bundle?.sourceAnchor,
          destinationAnchor: getFaceCenter(toPos, toSize, pair.dstFace),
          sourceGuide: bundle?.sourceGuide,
          destinationGuide: buildFlowDestinationGuide(
            fromPos,
            toPos,
            getFaceCenter(toPos, toSize, pair.dstFace),
            pair.dstFace,
            edge.flowFaceStub ?? flowConfig.flowFaceStub,
            resolveFlowTargetApproachBias(edge, flowConfig),
          ),
        }),
      );
      srcFace = selected.srcFace;
      dstFace = selected.dstFace;
    }
    // Face switching is handled later using anchor intersections; no pre-swap here.
    const info: EdgeFaceInfo = {
      id,
      from: edge.from,
      to: edge.to,
      routing,
      flowTargetApproachBias: resolveFlowTargetApproachBias(edge, flowConfig),
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
    const hasFlow = group.some((g) => g.routing === 'flow');
    const isPlanarFace = face === 'top' || face === 'bottom' || face === 'left' || face === 'right';
    const baseCount = resolvePortCountForFace(face, size, maxThickness);
    const count = hasFlow && isPlanarFace
      ? Math.max(oddifyPortCount(baseCount), 3)
      : baseCount;
    facePortCount.set(key, count);

    const axis = face === 'left' || face === 'right' ? 'y' : 'x';
    const span = axis === 'x' ? size[0] : size[1];
    const step = count > 1 ? span / (count - 1) : 0;
    const centerIndex = (count - 1) / 2;
    const allIndices = [...Array(count).keys()];
    const loads = new Array(count).fill(0);

    const withIdeal = group.map((info) => {
      const target = info.from === nodeId ? positions.get(info.to) : positions.get(info.from);
      const targetAxis = axis === 'x' ? (target?.[0] ?? pos[0]) : (target?.[1] ?? pos[1]);
      const centerAxis = axis === 'x' ? pos[0] : pos[1];
      const offset = Math.max(-span / 2, Math.min(span / 2, targetAxis - centerAxis));
      const idealIndex = count <= 1 ? 0 : (offset + span / 2) / step;
      return { info, idealIndex };
    }).sort((a, b) => {
      const ac = Math.abs(a.idealIndex - centerIndex);
      const bc = Math.abs(b.idealIndex - centerIndex);
      if (ac !== bc) return ac - bc;
      return a.idealIndex - b.idealIndex;
    });

    withIdeal.forEach(({ info, idealIndex }) => {
      const target = info.from === nodeId ? positions.get(info.to) : positions.get(info.from);
      const side = info.from === nodeId ? 'from' : 'to';
      const faceNormal = getFaceNormal(face);
      const isFlow = info.routing === 'flow';
      const targetApproachBias = isFlow ? info.flowTargetApproachBias : 0;
      const maxCenterDist = Math.max(1, centerIndex);
      const candidateIndices = allIndices.filter((idx) => {
        if (isFlow) return true;
        const normEdgeDist = Math.abs(idx - centerIndex) / maxCenterDist;
        return normEdgeDist <= ROUTING_WEIGHTS.port.maxEdgeNormalized;
      });
      const indices = candidateIndices.length > 0 ? candidateIndices : allIndices;
      const turnPenaltyForIndex = (idx: number): number => {
        if (!target) return 0;
        const anchor = getFacePortAnchor(pos, size, face, idx, count, target);
        const routeVec = side === 'from'
          ? normalizeVec([
            target[0] - anchor[0],
            target[1] - anchor[1],
            target[2] - anchor[2],
          ])
          : normalizeVec([
            anchor[0] - target[0],
            anchor[1] - target[1],
            anchor[2] - target[2],
          ]);
        const alignment = Math.max(0, dotVec(routeVec, faceNormal));
        return (1 - alignment) * (isFlow ? 480 * (1 + targetApproachBias) : 260);
      };
      const isVerticalTopBottomIngress =
        isFlow &&
        !!target &&
        side === 'to' &&
        (face === 'top' || face === 'bottom') &&
        ((face === 'top' && target[1] > pos[1] + 0.5) ||
          (face === 'bottom' && target[1] < pos[1] - 0.5));
      const isVerticalSideEgress =
        isFlow &&
        !!target &&
        side === 'from' &&
        (face === 'left' || face === 'right') &&
        Math.abs(target[1] - pos[1]) > 0.5;
      const outwardEdgeIndex = pos[0] >= 0 ? allIndices[allIndices.length - 1] ?? 0 : allIndices[0] ?? 0;
      const verticalEdgeIndex = (target?.[1] ?? pos[1]) >= pos[1]
        ? allIndices[allIndices.length - 1] ?? 0
        : allIndices[0] ?? 0;
      const centerSlotIndex = allIndices[Math.round(centerIndex)] ?? 0;
      const horizontalOffset = Math.abs((target?.[0] ?? pos[0]) - pos[0]);
      const adjustedIdealIndex = isVerticalTopBottomIngress
        ? (
          horizontalOffset > size[0] * 0.08
            ? outwardEdgeIndex
            : centerSlotIndex
        )
        : (
          isVerticalSideEgress
            ? idealIndex * 0.2 + verticalEdgeIndex * 0.8
            : idealIndex
        );
      const outwardBiasForIndex = (idx: number): number => {
        if (!isFlow || !target) return 0;
        if (face !== 'top' && face !== 'bottom') return 0;

        const verticalDelta = target[1] - pos[1];
        const isVerticalEntry =
          (face === 'top' && verticalDelta > 0.5) ||
          (face === 'bottom' && verticalDelta < -0.5);
        if (!isVerticalEntry) return 0;
        if (horizontalOffset <= size[0] * 0.08) return 0;

        const outwardSign = pos[0] >= 0 ? 1 : -1;
        const offsetFromCenter = idx - centerIndex;
        const normalizedOffset = maxCenterDist > 0 ? offsetFromCenter / maxCenterDist : 0;
        return -normalizedOffset * outwardSign * 520;
      };
      const chosen = [...allIndices].sort((a, b) => {
        const targetWeight = isFlow
          ? ROUTING_WEIGHTS.port.target * (2.2 + targetApproachBias * 0.85)
          : ROUTING_WEIGHTS.port.target;
        const centerWeight = isFlow
          ? ROUTING_WEIGHTS.port.centerAttraction * Math.max(0.05, 0.12 - targetApproachBias * 0.03)
          : ROUTING_WEIGHTS.port.centerAttraction;
        const loadWeight = isFlow ? ROUTING_WEIGHTS.port.load * 0.35 : ROUTING_WEIGHTS.port.load;
        const normEdgeDistA = Math.abs(a - centerIndex) / maxCenterDist;
        const normEdgeDistB = Math.abs(b - centerIndex) / maxCenterDist;
        const edgePenaltyA =
          Math.pow(normEdgeDistA, ROUTING_WEIGHTS.port.edgeRepulsionPower) *
          ROUTING_WEIGHTS.port.edgeRepulsion;
        const edgePenaltyB =
          Math.pow(normEdgeDistB, ROUTING_WEIGHTS.port.edgeRepulsionPower) *
          ROUTING_WEIGHTS.port.edgeRepulsion;
        const sa =
          Math.abs(a - adjustedIdealIndex) * targetWeight +
          Math.abs(a - centerIndex) * centerWeight +
          edgePenaltyA +
          turnPenaltyForIndex(a) +
          outwardBiasForIndex(a) +
          loads[a] * loadWeight;
        const sb =
          Math.abs(b - adjustedIdealIndex) * targetWeight +
          Math.abs(b - centerIndex) * centerWeight +
          edgePenaltyB +
          turnPenaltyForIndex(b) +
          outwardBiasForIndex(b) +
          loads[b] * loadWeight;
        return sa - sb;
      }).find((idx) => indices.includes(idx)) ?? 0;
      loads[chosen] += 1;
      facePortIndex.set(`${info.id}:${nodeId}:${side}`, chosen);
    });
  });

  const result = new Map<string, EdgeRouteState>();

  edges.forEach((edge, index) => {
    const id = edge.id ?? `${edge.from}-${edge.to}-${index}`;
    if (edge.from === edge.to) {
      result.set(id, {
        path: {
          commands: [],
          startTangent: [0, 0, 0],
          endTangent: [0, 0, 0],
          usedUnderpass: false,
          punctures: [],
        },
        controlPoints: [],
      });
      return;
    }

    const fromPos  = positions.get(edge.from);
    const toPos    = positions.get(edge.to);
    const fromSize = sizes.get(edge.from);
    const toSize   = sizes.get(edge.to);

    if (!fromPos || !toPos || !fromSize || !toSize) {
      const missingId = !fromPos || !fromSize ? edge.from : edge.to;
      onWarn?.(
        'MISSING_EDGE_ENDPOINT',
        `<DiagramEdge from="${edge.from}" to="${edge.to}">: node "${missingId}" not found. ` +
          `Check that "${missingId}" exactly matches a sibling <DiagramNode id="${missingId}"> ` +
          `in the same <Diagram>.`,
      );
      result.set(id, {
        path: {
          commands: [],
          startTangent: [0, 0, 0],
          endTangent: [0, 0, 0],
          usedUnderpass: false,
          punctures: [],
        },
        controlPoints: [],
      });
      return;
    }

    const routing = edge.routing ?? defaultRouting;
    const landing = (edge.fromPort || edge.toPort) ? 'port' : defaultLanding;
    const bundle = routing === 'flow' ? flowBundles.get(id) : undefined;
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
      : (bundle?.sourceAnchor ?? getFacePortAnchor(fromPos, fromSize, srcFace, fromPortIndex, fromPortCount, toPos));
    const toAnchor = edge.toPort
      ? undefined
      : getFacePortAnchor(toPos, toSize, dstFace, toPortIndex, toPortCount, fromPos);
    const destinationGuide = routing === 'flow' && toAnchor
      ? buildFlowDestinationGuide(
        fromPos,
        toPos,
        toAnchor,
        dstFace,
        edge.flowFaceStub ?? flowConfig.flowFaceStub,
        resolveFlowTargetApproachBias(edge, flowConfig),
      )
      : undefined;

    if (routing === 'flow') {
      const flowResult = getFlowRoute(
        id,
        edge,
        fromPos,
        fromSize,
        toPos,
        toSize,
        { srcFace, dstFace },
        {
          sourceAnchor: fromAnchor,
          destinationAnchor: toAnchor,
          sourceGuide: bundle?.sourceGuide,
          destinationGuide,
        },
      );
      result.set(id, flowResult);
      return;
    }

    const controlPoints = routeOneEdge(
      id,
      fromPos,
      fromSize,
      toPos,
      toSize,
      routing,
      landing,
      organicVariation,
      edge.fromPort,
      edge.toPort,
      fromAnchor,
      toAnchor,
      { srcFace, dstFace },
    );
    const path = buildLegacyEdgePath(
      controlPoints,
      getFaceNormal(srcFace),
      scaleVec(getFaceNormal(dstFace), -1),
    );
    result.set(id, {
      path,
      controlPoints: commandsToControlPoints(path.commands),
    });
  });

  return result;
}

export function routeEdgesYDown(
  edges: ReadonlyArray<EdgeRoutingInput>,
  positions: Map<string, Vec3>,
  sizes: Map<string, NodeDimensions>,
  defaultRouting: EdgeRoutingAlgorithm = 'curved',
  defaultLanding: EdgeLandingAlgorithm = 'nearest-face',
  onWarn?: DiagramWarnFn,
  organicVariation: number = 1.6,
  flowConfig: FlowRoutingConfig = DEFAULT_FLOW_ROUTING_CONFIG,
): Map<string, EdgeRouteState> {
  const mirroredPositions = new Map<string, Vec3>();
  positions.forEach((pos, id) => {
    mirroredPositions.set(id, mirrorVecY(pos));
  });

  const routed = routeEdges(
    edges,
    mirroredPositions,
    sizes,
    defaultRouting,
    defaultLanding,
    onWarn,
    organicVariation,
    flowConfig,
  );

  const mirroredResult = new Map<string, EdgeRouteState>();
  routed.forEach((state, id) => {
    mirroredResult.set(id, mirrorEdgeRouteStateY(state));
  });
  return mirroredResult;
}
