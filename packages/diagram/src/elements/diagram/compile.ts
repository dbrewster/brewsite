// Pure transformation pipeline: DiagramDSL → DiagramState.
// No Three.js. No React. No side effects.

import type {
  DiagramDSL,
  DiagramState,
  DiagramNodeState,
  DiagramEdgeState,
  DiagramPivot,
  DiagramEasing,
  DiagramTheme,
} from './types';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { blendNumber, blendOpacity, blendVec3 } from '@brewsite/core';
import { darkGlassTheme } from './themes/darkGlass';
import { resolveLayout, resolveLayoutWithGroups, computeBounds } from './compiler/layoutAlgorithms';
import { routeEdges } from './compiler/edgeRouter';
import { buildNodeDefaults, buildGroupDefaults, compileNode, compileEdge } from './compiler/nodeCompiler';
import { compileGroup, resolveGroupBoundsMap } from './compiler/groupCompiler';
import { buildThemeRenderConfig, compileExitConfig, compileEnterConfig } from './compiler/themeResolver';
import { resolveEffectiveLayout, resolveGroupLayouts, resolveThemeLayoutDefaults } from './compiler/layoutResolver';
import type { ResolvedLayout } from './compiler/layoutResolver';
import {
  blendDiagramNodes,
  buildLiveNodeMaps,
  rerouteLiveEdges,
  blendDiagramEdges,
} from './compiler/transitionHelpers';

// Keep in sync with GroupRenderer border width conversion.
const GROUP_BORDER_PX_TO_UNITS = 0.4;
// Keep in sync with GroupRenderer group Z placement.
const GROUP_RENDER_Z = -0.6;

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
      const s = 1 - Math.pow(2, -10 * t) * Math.cos(20 * t * (Math.PI / 3));
      return Math.max(0, Math.min(1, s));
    }
    default: return t;
  }
}

function groupDepth(
  group: { id: string; parentId?: string },
  allGroups: ReadonlyArray<{ id: string; parentId?: string }>,
): number {
  if (!group.parentId) return 0;
  const groupById = new Map(allGroups.map((g) => [g.id, g]));
  let depth = 0;
  let cursor = groupById.get(group.parentId);
  while (cursor) {
    depth += 1;
    if (!cursor.parentId) break;
    cursor = groupById.get(cursor.parentId);
  }
  return depth;
}

/**
 * Computes the translation to apply to ALL node positions so that the declared
 * pivot point of the diagram maps to local [0, 0, 0].
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

/**
 * Full diagram compilation pipeline. Called by the compiler registry handler.
 */
export function compileDiagram(
  dsl: DiagramDSL,
  fallbackTheme: DiagramTheme = darkGlassTheme,
): DiagramState {
  const theme: DiagramTheme = dsl.theme ?? fallbackTheme;

  const layoutDefaults = resolveThemeLayoutDefaults(theme.layout);
  const rootLayout: ResolvedLayout = resolveEffectiveLayout(dsl.layout, undefined, layoutDefaults);
  const groupLayouts = resolveGroupLayouts(dsl.groups, rootLayout, layoutDefaults);

  const groupMap = new Map<string, string>();
  dsl.groups.forEach((group) => {
    group.nodeIds.forEach((nodeId) => {
      if (groupMap.has(nodeId) && groupMap.get(nodeId) !== group.id) {
        console.warn(`Diagram compileDiagram: node ${nodeId} assigned to multiple groups.`);
      }
      groupMap.set(nodeId, group.id);
    });
  });

  const nd = buildNodeDefaults(theme);
  const sizeMap = new Map<string, readonly [number, number]>();
  const sizeWithDepthMap = new Map<string, readonly [number, number, number]>();
  dsl.nodes.forEach((node) => {
    const size = node.size ?? nd.size;
    const depth = node.depth ?? nd.depth;
    sizeMap.set(node.id, size);
    sizeWithDepthMap.set(node.id, [size[0], size[1], depth]);
  });

  const positions = resolveLayoutWithGroups(
    dsl.nodes,
    dsl.edges,
    dsl.groups,
    rootLayout,
    groupLayouts,
    sizeWithDepthMap,
  );

  const pivot: DiagramPivot = dsl.pivot ?? 'center';
  const rawBounds = computeBounds(
    dsl.nodes.map((n) => n.id),
    positions,
    sizeWithDepthMap,
  );
  const [ox, oy, oz] = compilePivotOffset(rawBounds, pivot);
  if (ox !== 0 || oy !== 0 || oz !== 0) {
    for (const [id, pos] of positions) {
      positions.set(id, [pos[0] + ox, pos[1] + oy, pos[2] + oz]);
    }
  }

  const groupBoundsMap = resolveGroupBoundsMap(dsl.groups, positions, sizeWithDepthMap, groupLayouts);
  const groupDefaults = buildGroupDefaults(theme);
  const groupDslById = new Map(dsl.groups.map((group) => [group.id, group]));
  groupBoundsMap.forEach((bounds, groupId) => {
    if (bounds.w === 0 && bounds.h === 0) return;
    const centerX = bounds.x + bounds.w / 2;
    const centerY = bounds.y + bounds.h / 2;
    const groupDsl = groupDslById.get(groupId);
    const variant = groupDsl?.variant ?? groupDefaults.variant;
    const borderStyle = variant === 'container'
      ? 'none'
      : (groupDsl?.borderStyle ?? groupDefaults.borderStyle);
    const borderWidthUnits = borderStyle === 'none'
      ? 0
      : Math.max(0, groupDefaults.borderWidth * GROUP_BORDER_PX_TO_UNITS);
    const borderCenterInset = borderWidthUnits * 0.5;
    const groupBorderHeight = borderStyle === 'none'
      ? 0.01
      : Math.max(0.01, groupDefaults.borderHeight);
    // Route edges to the rendered group depth, not z=0, so group-target edges
    // visually terminate into the 3D border frame.
    positions.set(groupId, [centerX, centerY, GROUP_RENDER_Z]);
    // Route edges to the centerline of the rendered border frame (not its outer edge),
    // so tube centers visually hit the middle of the frame thickness.
    sizeWithDepthMap.set(groupId, [
      bounds.w + borderCenterInset * 2,
      bounds.h + borderCenterInset * 2,
      groupBorderHeight,
    ]);
  });

  const edgesForRouting = dsl.edges.map((edge) => ({
    ...edge,
    thickness: edge.thickness ?? theme.edge.defaultThickness,
  }));
  const controlPointsMap = routeEdges(
    edgesForRouting,
    positions,
    sizeWithDepthMap,
    theme.edge.routing,
    theme.edge.landing,
  );

  const nodes = dsl.nodes
    .map((node) => {
      const positionFromMap = positions.get(node.id);
      const positionInherited = positionFromMap === undefined;
      const position: readonly [number, number, number] = positionFromMap ?? [0, 0, 0];
      const groupId = node.groupId ?? groupMap.get(node.id);
      return compileNode(node, position, groupId, theme, positionInherited);
    })
    .sort((a, b) => a.position[2] - b.position[2]);

  const edges = dsl.edges.map((edge, index) => {
    const id = edge.id ?? `${edge.from}-${edge.to}-${index}`;
    const controlPoints = controlPointsMap.get(id) ?? [];
    return compileEdge(edge, controlPoints, index, theme);
  });

  const groups = dsl.groups
    .map((group) => {
      const bounds = groupBoundsMap.get(group.id);
      if (!bounds) return null;
      return compileGroup(group, bounds, theme);
    })
    .filter((group): group is NonNullable<typeof group> => !!group)
    .sort((a, b) => {
      const depthA = groupDepth(a, dsl.groups);
      const depthB = groupDepth(b, dsl.groups);
      if (depthA !== depthB) return depthA - depthB;
      const areaA = a.bounds.w * a.bounds.h;
      const areaB = b.bounds.w * b.bounds.h;
      return areaB - areaA;
    });

  const bounds = computeBounds(
    dsl.nodes.map((node) => node.id),
    positions,
    sizeWithDepthMap,
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
    themeConfig: buildThemeRenderConfig(theme),
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

export const functionalDiagramTransitionSpec: FunctionalTransitionSpec<DiagramState> = {
  exitFn: (from) => (t) => applyDiagramExit(from, t),
  enterFn: (to) => (t) => applyDiagramEnter(to, t),
  interpolateFn: (from, to) => (t) => {
    const { blended, fading } = blendDiagramNodes(from.nodes, to.nodes, t);
    const { positions, sizes } = buildLiveNodeMaps([...blended, ...fading]);
    const toEdgeIds = new Set(to.edges.map((e) => e.id));
    const liveControlPoints = rerouteLiveEdges(
      to.edges,
      from.edges,
      toEdgeIds,
      positions,
      sizes,
    );
    const { blended: blendedEdges, fading: fadingEdges } = blendDiagramEdges(
      from.edges,
      to.edges,
      liveControlPoints,
      t,
    );

    return {
      ...to,
      position: blendVec3([from.position[0], from.position[1], from.position[2]], [to.position[0], to.position[1], to.position[2]], t) ?? to.position,
      rotation: blendVec3([from.rotation[0], from.rotation[1], from.rotation[2]], [to.rotation[0], to.rotation[1], to.rotation[2]], t) ?? to.rotation,
      scale: blendNumber(from.scale, to.scale, t) ?? to.scale,
      nodes: [...blended, ...fading],
      edges: [...blendedEdges, ...fadingEdges],
    };
  },
};

export { resolveLayout, computeBounds, routeEdges };
export { compileNode, compileEdge } from './compiler/nodeCompiler';
export { compileGroup } from './compiler/groupCompiler';
