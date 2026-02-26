// Pure transformation pipeline: DiagramDSL → DiagramState.
// No Three.js. No React. No side effects.

import type {
  DiagramDSL,
  DiagramState,
  DiagramNodeDSL,
  DiagramNodeState,
  DiagramEdgeDSL,
  DiagramEdgeState,
  DiagramGroupDSL,
  DiagramGroupState,
  DiagramPivot,
  DiagramEasing,
  DiagramExitDSL,
  DiagramEnterDSL,
  DiagramExitConfig,
  DiagramEnterConfig,
} from './types';
import { resolveIconUrl } from './shapes/iconRegistry';
import { deriveColor } from './math/colorUtils';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { blendNumber, blendOpacity, blendVec3 } from '@brewsite/core';

/**
 * Maps a linear t ∈ [0,1] through the given easing curve.
 * Used by exitFn / enterFn to apply per-diagram transition curves.
 */
function applyEasing(t: number, easing: DiagramEasing): number {
  switch (easing) {
    case 'linear': return t;
    case 'ease': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'ease-in': return t * t;
    case 'ease-out': return t * (2 - t);
    case 'spring': {
      // Damped spring: overshoots then settles. k=10, omega=20.
      const s = 1 - Math.pow(2, -10 * t) * Math.cos(20 * t * (Math.PI / 3));
      return Math.max(0, Math.min(1, s));
    }
    default: return t;
  }
}

// ─── Defaults ────────────────────────────────────────────────────────────────

// NOTE: sideColor and borderColor are NOT in NODE_DEFAULTS because they are
// derived from `color` at compile time using deriveColor(). If the author
// provides explicit sideColor/borderColor, those values are used directly.
// If not, compileNode() calls deriveColor(dsl.color, -0.15) for sideColor
// and deriveColor(dsl.color, +0.25) for borderColor.
const DEFAULT_COLOR = '#2a2d3e';
const NODE_DEFAULTS = {
  shape: 'flow:rect' as const,
  size: [4, 2] as [number, number],
  // 0.6 gives a clearly readable 3D face from the default 25° elevated camera
  // without looking too thick. Stays close to the plan's "0.4 for standard
  // nodes" intent while being visually impactful for demos.
  depth: 0.6,
  color: DEFAULT_COLOR,
  // sideColor:  derived from color — see compileNode()
  // borderColor: derived from color — see compileNode()
  metalness: 0.15,
  roughness: 0.65,
  labelColor: '#ffffff',
  sublabelColor: '#a0a8c0',
  opacity: 1,
  clickable: false,
  enabled: true,
  iconScale: 0.6,
};

const EDGE_DEFAULTS = {
  style: 'solid' as const,
  arrowStart: 'none' as const,
  arrowEnd: 'open' as const,
  color: '#555e7a',
  // 0.08 renders as a clearly visible 3D tube at the default camera distance.
  // 0.04 was sub-pixel at the former camera distance of 100 units.
  thickness: 0.08,
  opacity: 1,
};

const GROUP_DEFAULTS = {
  variant: 'boundary' as const,
  orientation: 'vertical' as const,
  color: '#1a1d2e',
  borderColor: '#3a4060',
  borderStyle: 'solid' as const,
  fillOpacity: 0.08,
  borderOpacity: 0.6,
};

const GROUP_PADDING = 1.5; // diagram units — space around node bounds within a group

const EDGE_EPSILON = 0.1;

const edgeIdFor = (edge: DiagramEdgeDSL, index: number): string =>
  edge.id ?? `${edge.from}-${edge.to}-${index}`;

// ─── Layout Algorithms ───────────────────────────────────────────────────────

/**
 * Assigns [x, y, z] positions to nodes that have no explicit position.
 * For the 'grid' layout, places nodes left-to-right in rows of ~4 nodes.
 * For the 'hierarchical' layout, performs a topological sort on edges and assigns
 * depth levels as Y-axis bands.
 * For 'manual', all nodes must have explicit positions — throws on missing position.
 */
export function resolveLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: 'manual' | 'grid' | 'hierarchical',
  spacing: [number, number],
): Map<string, readonly [number, number, number]> {
  const positions = new Map<string, readonly [number, number, number]>();
  const missing: DiagramNodeDSL[] = [];

  nodes.forEach((node) => {
    if (node.position) {
      positions.set(node.id, node.position);
    } else {
      missing.push(node);
    }
  });

  if (layout === 'manual') {
    if (missing.length > 0) {
      throw new Error('Diagram layout is manual but one or more nodes are missing positions.');
    }
    return positions;
  }

  if (missing.length === 0) {
    return positions;
  }

  const maxWidth = Math.max(
    ...missing.map((node) => (node.size ?? NODE_DEFAULTS.size)[0]),
  );
  const maxHeight = Math.max(
    ...missing.map((node) => (node.size ?? NODE_DEFAULTS.size)[1]),
  );

  if (layout === 'grid') {
    const cols = 4;
    missing.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * (maxWidth + spacing[0]);
      const y = -row * (maxHeight + spacing[1]);
      const z = node.position?.[2] ?? 0;
      positions.set(node.id, [x, y, z]);
    });
    return positions;
  }

  const nodeIds = nodes.map((node) => node.id);
  const inDegree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const adjacency = new Map<string, string[]>();

  edges.forEach((edge) => {
    const from = edge.from;
    const to = edge.to;
    if (!adjacency.has(from)) {
      adjacency.set(from, []);
    }
    adjacency.get(from)!.push(to);
    if (inDegree.has(to)) {
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
    }
  });

  const queue: string[] = [];
  inDegree.forEach((count, id) => {
    if (count === 0) {
      queue.push(id);
    }
  });

  const level = new Map<string, number>();
  const visitQueue = queue.length > 0 ? queue : [...nodeIds];

  while (visitQueue.length > 0) {
    const current = visitQueue.shift()!;
    const currentLevel = level.get(current) ?? 0;
    const neighbors = adjacency.get(current) ?? [];
    neighbors.forEach((next) => {
      const nextLevel = Math.max(level.get(next) ?? 0, currentLevel + 1);
      level.set(next, nextLevel);
      if (queue.length > 0) {
        const nextDegree = (inDegree.get(next) ?? 1) - 1;
        inDegree.set(next, nextDegree);
        if (nextDegree <= 0) {
          visitQueue.push(next);
        }
      } else if (!visitQueue.includes(next)) {
        visitQueue.push(next);
      }
    });
  }

  nodes.forEach((node) => {
    if (!level.has(node.id)) {
      level.set(node.id, 0);
    }
  });

  const levels = new Map<number, DiagramNodeDSL[]>();
  missing.forEach((node) => {
    const l = level.get(node.id) ?? 0;
    if (!levels.has(l)) {
      levels.set(l, []);
    }
    levels.get(l)!.push(node);
  });

  levels.forEach((levelNodes, l) => {
    const count = levelNodes.length;
    const totalWidth = count * maxWidth + (count - 1) * spacing[0];
    const startX = -totalWidth / 2 + maxWidth / 2;
    levelNodes.forEach((node, index) => {
      const x = startX + index * (maxWidth + spacing[0]);
      const y = -l * (maxHeight + spacing[1]);
      const z = node.position?.[2] ?? 0;
      positions.set(node.id, [x, y, z]);
    });
  });

  return positions;
}

/**
 * Computes the bounding box of a set of nodes (resolved positions + sizes).
 * Used by compileDiagram for the overall bounds and by compileGroup for group bounds.
 */
export function computeBounds(
  nodeIds: ReadonlyArray<string>,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number]>,
): { x: number; y: number; w: number; h: number; minZ: number; maxZ: number } {
  if (nodeIds.length === 0) {
    return { x: 0, y: 0, w: 0, h: 0, minZ: 0, maxZ: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  nodeIds.forEach((id) => {
    const position = positions.get(id);
    const size = sizes.get(id);
    if (!position || !size) {
      return;
    }
    const [x, y, z] = position;
    const [w, h] = size;
    minX = Math.min(minX, x - w / 2);
    maxX = Math.max(maxX, x + w / 2);
    minY = Math.min(minY, y - h / 2);
    maxY = Math.max(maxY, y + h / 2);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { x: 0, y: 0, w: 0, h: 0, minZ: 0, maxZ: 0 };
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, minZ, maxZ };
}

/**
 * Computes the translation to apply to ALL node positions so that the declared
 * pivot point of the diagram maps to local [0, 0, 0].
 * bounds is the raw bounding box BEFORE the offset is applied.
 *
 * In Three.js / BrewSite diagram space, Y increases upward:
 *   bounds.y        = bottom edge (most negative Y)
 *   bounds.y + h    = top edge (most positive Y)
 *   bounds.x        = left edge
 *   bounds.x + w    = right edge
 */
function compilePivotOffset(
  bounds: { x: number; y: number; w: number; h: number },
  pivot: DiagramPivot,
): readonly [number, number, number] {
  switch (pivot) {
    case 'center': return [-(bounds.x + bounds.w / 2), -(bounds.y + bounds.h / 2), 0];
    case 'top-left': return [-bounds.x, -(bounds.y + bounds.h), 0];
    case 'top-right': return [-(bounds.x + bounds.w), -(bounds.y + bounds.h), 0];
    case 'bottom-left': return [-bounds.x, -bounds.y, 0];
    case 'bottom-right': return [-(bounds.x + bounds.w), -bounds.y, 0];
    default: return [0, 0, 0];
  }
}

// ─── Edge Routing ─────────────────────────────────────────────────────────────

type Vec3 = readonly [number, number, number];

type NodeDimensions = readonly [number, number, number];

const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scaleVec = (v: Vec3, scalar: number): Vec3 => [v[0] * scalar, v[1] * scalar, v[2] * scalar];
const toMutableVec3 = (v: Vec3): [number, number, number] => [v[0], v[1], v[2]];

const faceFromTo = (
  origin: Vec3,
  target: Vec3,
  size: NodeDimensions,
): { center: Vec3; normal: Vec3 } => {
  const delta: Vec3 = [target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]];
  const absX = Math.abs(delta[0]);
  const absY = Math.abs(delta[1]);
  const absZ = Math.abs(delta[2]);

  // Prefer top/bottom (Y-axis) faces unless the connection is clearly more
  // horizontal. The 0.6 threshold means: only use a side face when the
  // horizontal component exceeds 67% of the vertical. This gives architecture
  // diagrams the natural "data flows downward" look for most connections while
  // still routing side-to-side for genuinely horizontal edges.
  let maxAxis: number;
  if (absY >= absX * 0.6 && absY >= absZ * 0.6) {
    maxAxis = 1; // Y-face: top or bottom
  } else if (absX >= absZ) {
    maxAxis = 0; // X-face: left or right
  } else {
    maxAxis = 2; // Z-face: front or back
  }

  const sign = delta[maxAxis] >= 0 ? 1 : -1;

  let normal: Vec3 = [0, 0, 0];
  let offset: Vec3 = [0, 0, 0];

  if (maxAxis === 0) {
    normal = [sign, 0, 0];
    offset = [sign * size[0] / 2, 0, 0];
  } else if (maxAxis === 1) {
    normal = [0, sign, 0];
    offset = [0, sign * size[1] / 2, 0];
  } else {
    normal = [0, 0, sign];
    offset = [0, 0, sign * size[2] / 2];
  }

  return { center: addVec(origin, offset), normal };
};

/**
 * Routes edges between node face centers, computing Bezier-style control points.
 */
export function routeEdges(
  edges: ReadonlyArray<DiagramEdgeDSL>,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, NodeDimensions>,
): Map<string, ReadonlyArray<readonly [number, number, number]>> {
  const result = new Map<string, ReadonlyArray<readonly [number, number, number]>>();

  edges.forEach((edge, index) => {
    const id = edgeIdFor(edge, index);
    if (edge.from === edge.to) {
      result.set(id, []);
      return;
    }

    const fromPos = positions.get(edge.from);
    const toPos = positions.get(edge.to);
    const fromSize = sizes.get(edge.from);
    const toSize = sizes.get(edge.to);

    if (!fromPos || !toPos || !fromSize || !toSize) {
      console.warn(`Diagram routeEdges: missing node(s) for edge ${edge.from} -> ${edge.to}`);
      const start = fromPos ?? [0, 0, 0];
      const end = toPos ?? [0, 0, 0];
      result.set(id, [start, end]);
      return;
    }

    const fromFace = faceFromTo(fromPos, toPos, fromSize);
    const toFace = faceFromTo(toPos, fromPos, toSize);

    const start = addVec(fromFace.center, scaleVec(fromFace.normal, EDGE_EPSILON));
    const end = addVec(toFace.center, scaleVec(toFace.normal, EDGE_EPSILON));

    // Compute the 3-D distance between face exit/entry points and use a
    // fraction of it as stub length.  Clamping prevents crossing on short edges.
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const dist3d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const stub = Math.min(1.2, dist3d * 0.3);

    // Add perpendicular guide points in the face-normal direction so the curve
    // exits/enters perpendicular to each face rather than at an angle.
    const guide1 = addVec(start, scaleVec(fromFace.normal, stub));
    const guide2 = addVec(end, scaleVec(toFace.normal, stub));

    result.set(id, [start, guide1, guide2, end]);
  });

  return result;
}

// ─── Node / Edge / Group Compilation ─────────────────────────────────────────

/**
 * Compiles a single node DSL into a fully resolved DiagramNodeState.
 * Applies defaults, resolves icon URL, and assigns groupId from parent group.
 */
export function compileNode(
  dsl: DiagramNodeDSL,
  position: readonly [number, number, number],
  groupId: string | undefined,
): DiagramNodeState {
  const shape = dsl.shape ?? NODE_DEFAULTS.shape;
  const color = dsl.color ?? NODE_DEFAULTS.color;
  const sideColor = dsl.sideColor ?? deriveColor(color, -0.15);
  const borderColor = dsl.borderColor ?? deriveColor(color, 0.25);

  return {
    id: dsl.id,
    // Ghost/partial-update nodes omit label — fall back to '' so render.ts
    // always receives a string. mergeSnapshot carries forward the real label
    // from the previous scene's state when this DiagramWidget span transitions.
    label: dsl.label ?? '',
    sublabel: dsl.sublabel,
    shape,
    position,
    size: dsl.size ?? NODE_DEFAULTS.size,
    depth: dsl.depth ?? NODE_DEFAULTS.depth,
    color,
    sideColor,
    borderColor,
    metalness: dsl.metalness ?? NODE_DEFAULTS.metalness,
    roughness: dsl.roughness ?? NODE_DEFAULTS.roughness,
    labelColor: dsl.labelColor ?? NODE_DEFAULTS.labelColor,
    sublabelColor: dsl.sublabelColor ?? NODE_DEFAULTS.sublabelColor,
    opacity: dsl.opacity ?? NODE_DEFAULTS.opacity,
    clickable: dsl.clickable ?? NODE_DEFAULTS.clickable,
    enabled: dsl.enabled ?? NODE_DEFAULTS.enabled,
    iconUrl: resolveIconUrl(shape),
    iconScale: dsl.iconScale ?? NODE_DEFAULTS.iconScale,
    groupId,
  };
}

/**
 * Compiles a single edge DSL into a DiagramEdgeState.
 * Applies defaults and attaches computed control points.
 * Auto-generates an id from `${from}-${to}` if not provided.
 */
export function compileEdge(
  dsl: DiagramEdgeDSL,
  controlPoints: ReadonlyArray<readonly [number, number, number]>,
  index: number,
): DiagramEdgeState {
  return {
    id: edgeIdFor(dsl, index),
    fromId: dsl.from,
    toId: dsl.to,
    label: dsl.label,
    style: dsl.style ?? EDGE_DEFAULTS.style,
    arrowStart: dsl.arrowStart ?? EDGE_DEFAULTS.arrowStart,
    arrowEnd: dsl.arrowEnd ?? EDGE_DEFAULTS.arrowEnd,
    color: dsl.color ?? EDGE_DEFAULTS.color,
    thickness: dsl.thickness ?? EDGE_DEFAULTS.thickness,
    controlPoints,
    opacity: dsl.opacity ?? EDGE_DEFAULTS.opacity,
  };
}

/**
 * Compiles a single group DSL into a DiagramGroupState.
 * Computes bounds from the union of all member node positions + sizes + padding.
 */
export function compileGroup(
  dsl: DiagramGroupDSL,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number]>,
): DiagramGroupState {
  const bounds = computeBounds(dsl.nodeIds, positions, sizes);
  const padding = GROUP_PADDING;

  return {
    id: dsl.id,
    label: dsl.label,
    variant: dsl.variant ?? GROUP_DEFAULTS.variant,
    orientation: dsl.orientation ?? GROUP_DEFAULTS.orientation,
    bounds: {
      x: bounds.x - padding,
      y: bounds.y - padding,
      w: bounds.w + padding * 2,
      h: bounds.h + padding * 2,
      padding,
    },
    color: dsl.color ?? GROUP_DEFAULTS.color,
    borderColor: dsl.borderColor ?? GROUP_DEFAULTS.borderColor,
    borderStyle: dsl.borderStyle ?? GROUP_DEFAULTS.borderStyle,
    fillOpacity: dsl.fillOpacity ?? GROUP_DEFAULTS.fillOpacity,
    borderOpacity: dsl.borderOpacity ?? GROUP_DEFAULTS.borderOpacity,
  };
}

function compileExitConfig(dsl: DiagramExitDSL | undefined): DiagramExitConfig | null {
  if (!dsl) return null;
  return {
    to: dsl.to,
    fade: dsl.fade ?? true,
    scaleTo: dsl.scaleTo,
    easing: dsl.easing ?? 'ease',
  };
}

function compileEnterConfig(dsl: DiagramEnterDSL | undefined): DiagramEnterConfig | null {
  if (!dsl) return null;
  return {
    from: dsl.from,
    fade: dsl.fade ?? true,
    scaleFrom: dsl.scaleFrom,
    easing: dsl.easing ?? 'ease',
  };
}

// ─── Top-Level Compilation ────────────────────────────────────────────────────

/**
 * Full diagram compilation pipeline. Called by the compiler registry handler.
 */
export function compileDiagram(dsl: DiagramDSL): DiagramState {
  const layout = dsl.layout ?? 'grid';
  const layoutSpacing: [number, number] = [
    dsl.layoutSpacing?.[0] ?? 2,
    dsl.layoutSpacing?.[1] ?? 2,
  ];

  const groupMap = new Map<string, string>();
  dsl.groups.forEach((group) => {
    group.nodeIds.forEach((nodeId) => {
      if (groupMap.has(nodeId) && groupMap.get(nodeId) !== group.id) {
        console.warn(`Diagram compileDiagram: node ${nodeId} assigned to multiple groups.`);
      }
      groupMap.set(nodeId, group.id);
    });
  });

  const positions = resolveLayout(dsl.nodes, dsl.edges, layout, layoutSpacing);

  const sizeMap = new Map<string, readonly [number, number]>();
  const sizeWithDepthMap = new Map<string, readonly [number, number, number]>();

  dsl.nodes.forEach((node) => {
    const size = node.size ?? NODE_DEFAULTS.size;
    const depth = node.depth ?? NODE_DEFAULTS.depth;
    sizeMap.set(node.id, size);
    sizeWithDepthMap.set(node.id, [size[0], size[1], depth]);
  });

  // ── NEW: Pivot offset ───────────────────────────────────────────────────
  // Compute raw bounds from the layout-assigned positions, then derive the
  // pivot offset and apply it to every position in the map.
  const pivot: DiagramPivot = dsl.pivot ?? 'center';
  const rawBounds = computeBounds(
    dsl.nodes.map((n) => n.id),
    positions,
    sizeMap,
  );
  const [ox, oy, oz] = compilePivotOffset(rawBounds, pivot);
  if (ox !== 0 || oy !== 0 || oz !== 0) {
    for (const [id, pos] of positions) {
      positions.set(id, [pos[0] + ox, pos[1] + oy, pos[2] + oz]);
    }
  }
  // ── END pivot offset ────────────────────────────────────────────────────

  const controlPointsMap = routeEdges(dsl.edges, positions, sizeWithDepthMap);

  const nodes = dsl.nodes
    .map((node) => {
      const position = positions.get(node.id) ?? [0, 0, 0];
      const groupId = node.groupId ?? groupMap.get(node.id);
      return compileNode(node, position, groupId);
    })
    .sort((a, b) => a.position[2] - b.position[2]);

  const edges = dsl.edges.map((edge, index) => {
    const id = edgeIdFor(edge, index);
    const controlPoints = controlPointsMap.get(id) ?? [];
    return compileEdge(edge, controlPoints, index);
  });

  const groups = dsl.groups.map((group) => compileGroup(group, positions, sizeMap));

  const bounds = computeBounds(
    dsl.nodes.map((node) => node.id),
    positions,
    sizeMap,
  );

  return {
    id: dsl.id,
    nodes,
    edges,
    groups,
    bounds,
    position: dsl.position ?? [0, 0, 0],
    rotation: dsl.rotation ?? [0, 0, 0],
    scale: dsl.scale ?? 1,
    pivot,
    exit: compileExitConfig(dsl.exit),
    enter: compileEnterConfig(dsl.enter),
  };
}

// ─── Functional Transition Spec ───────────────────────────────────────────────

const lerpNum = (a: number, b: number, t: number): number => a + (b - a) * t;

const lerpVec3 = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): readonly [number, number, number] => [
  lerpNum(a[0], b[0], t),
  lerpNum(a[1], b[1], t),
  lerpNum(a[2], b[2], t),
];

const fadeNodesOut = (
  nodes: ReadonlyArray<DiagramNodeState>,
  t: number,
): ReadonlyArray<DiagramNodeState> =>
  nodes.map((n) => ({ ...n, opacity: blendOpacity(n.opacity, 0, t) ?? 0 }));

const fadeNodesIn = (
  nodes: ReadonlyArray<DiagramNodeState>,
  t: number,
): ReadonlyArray<DiagramNodeState> =>
  nodes.map((n) => ({ ...n, opacity: blendOpacity(0, n.opacity, t) ?? n.opacity }));

const fadeEdgesOut = (
  edges: ReadonlyArray<DiagramEdgeState>,
  t: number,
): ReadonlyArray<DiagramEdgeState> =>
  edges.map((e) => ({ ...e, opacity: blendOpacity(e.opacity, 0, t) ?? 0 }));

const fadeEdgesIn = (
  edges: ReadonlyArray<DiagramEdgeState>,
  t: number,
): ReadonlyArray<DiagramEdgeState> =>
  edges.map((e) => ({ ...e, opacity: blendOpacity(0, e.opacity, t) ?? e.opacity }));

/**
 * Applies the diagram's exit config to produce the state at exit progress t.
 * t=0: diagram at declared state; t=1: diagram at exit target (hidden/moved).
 */
export function applyDiagramExit(diagram: DiagramState, t: number): DiagramState {
  const config = diagram.exit;
  if (!config) {
    return {
      ...diagram,
      nodes: fadeNodesOut(diagram.nodes, t),
      edges: fadeEdgesOut(diagram.edges, t),
    };
  }
  const et = applyEasing(t, config.easing);
  let position = diagram.position;
  if (config.to) {
    position = lerpVec3(diagram.position, config.to, et);
  }
  let scale = diagram.scale;
  if (config.scaleTo !== undefined) {
    scale = lerpNum(diagram.scale, config.scaleTo, et);
  }
  const nodes = config.fade ? fadeNodesOut(diagram.nodes, et) : diagram.nodes;
  const edges = config.fade ? fadeEdgesOut(diagram.edges, et) : diagram.edges;
  return { ...diagram, position, scale, nodes, edges };
}

/**
 * Applies the diagram's enter config to produce the state at enter progress t.
 * t=0: diagram at enter source (hidden/offscreen); t=1: diagram at declared state.
 */
export function applyDiagramEnter(diagram: DiagramState, t: number): DiagramState {
  const config = diagram.enter;
  if (!config) {
    return {
      ...diagram,
      nodes: fadeNodesIn(diagram.nodes, t),
      edges: fadeEdgesIn(diagram.edges, t),
    };
  }
  const et = applyEasing(t, config.easing);
  let position = diagram.position;
  if (config.from) {
    position = lerpVec3(config.from, diagram.position, et);
  }
  let scale = diagram.scale;
  if (config.scaleFrom !== undefined) {
    scale = lerpNum(config.scaleFrom, diagram.scale, et);
  }
  const nodes = config.fade ? fadeNodesIn(diagram.nodes, et) : diagram.nodes;
  const edges = config.fade ? fadeEdgesIn(diagram.edges, et) : diagram.edges;
  return { ...diagram, position, scale, nodes, edges };
}

/**
 * Functional transition spec for DiagramState.
 * Used by DiagramWidget as its transitionSpec — evaluated by the runtime at
 * tick.blockProgress for infinite easing fidelity with no oversampling overhead.
 */
export const functionalDiagramTransitionSpec: FunctionalTransitionSpec<DiagramState> = {
  exitFn: (from) => (t) => applyDiagramExit(from, t),
  enterFn: (to) => (t) => applyDiagramEnter(to, t),
  interpolateFn: (from, to) => (t) => {
    const fromNodeMap = new Map(from.nodes.map((node) => [node.id, node]));
    const fromEdgeMap = new Map(from.edges.map((edge) => [edge.id, edge]));
    const toNodeIds = new Set(to.nodes.map((node) => node.id));
    const toEdgeIds = new Set(to.edges.map((edge) => edge.id));

    const blendedNodes = to.nodes.map((toNode) => {
      const fromNode = fromNodeMap.get(toNode.id);
      if (!fromNode) {
        return {
          ...toNode,
          opacity: blendOpacity(0, toNode.opacity, t) ?? toNode.opacity,
        };
      }
      return {
        ...toNode,
        position: blendVec3(toMutableVec3(fromNode.position), toMutableVec3(toNode.position), t) ?? toNode.position,
        opacity: blendOpacity(fromNode.opacity, toNode.opacity, t) ?? toNode.opacity,
      };
    });

    const fadingNodes = from.nodes
      .filter((node) => !toNodeIds.has(node.id))
      .map((node) => ({
        ...node,
        opacity: blendOpacity(node.opacity, 0, t) ?? 0,
      }));

    const blendedEdges = to.edges.map((toEdge) => {
      const fromEdge = fromEdgeMap.get(toEdge.id);
      if (!fromEdge) {
        return {
          ...toEdge,
          opacity: blendOpacity(0, toEdge.opacity, t) ?? toEdge.opacity,
        };
      }
      return {
        ...toEdge,
        opacity: blendOpacity(fromEdge.opacity, toEdge.opacity, t) ?? toEdge.opacity,
        controlPoints: toEdge.controlPoints.map((point, index) => {
          const fromPoint = fromEdge.controlPoints[index] ?? point;
          return blendVec3(toMutableVec3(fromPoint), toMutableVec3(point), t) ?? point;
        }),
      };
    });

    const fadingEdges = from.edges
      .filter((edge) => !toEdgeIds.has(edge.id))
      .map((edge) => ({
        ...edge,
        opacity: blendOpacity(edge.opacity, 0, t) ?? 0,
      }));

    return {
      ...to,
      position: blendVec3(toMutableVec3(from.position), toMutableVec3(to.position), t) ?? to.position,
      rotation: blendVec3(toMutableVec3(from.rotation), toMutableVec3(to.rotation), t) ?? to.rotation,
      scale: blendNumber(from.scale, to.scale, t) ?? to.scale,
      nodes: [...blendedNodes, ...fadingNodes],
      edges: [...blendedEdges, ...fadingEdges],
    };
  },
};
