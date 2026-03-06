// Pure transformation pipeline: DiagramDSL → DiagramState.
// No Three.js. No React. No side effects.

import type {
  DiagramDSL,
  DiagramState,
  DiagramNodeState,
  DiagramEdgeState,
  DiagramEasing,
  DiagramTheme,
  DiagramWarnFn,
} from './types';
import type { FunctionalTransitionSpec, NVSRect } from '@brewsite/core';
import { blendOpacity, blendVec3 } from '@brewsite/core';
import { darkGlassTheme } from './themes/darkGlass';
import { resolveLayout, resolveLayoutWithGroups, computeBounds } from './compiler/layoutAlgorithms';
import { routeEdges } from './compiler/edgeRouter';
import { buildNodeDefaults, buildGroupDefaults, compileNode, compileEdge } from './compiler/nodeCompiler';
import { compileGroup, resolveGroupBoundsMap } from './compiler/groupCompiler';
import type { GroupBounds } from './compiler/groupCompiler';
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

// ─── Normalization Post-Pass ───────────────────────────────────────────────────

type RawPosition = readonly [number, number, number];
type RawSize = readonly [number, number];

/**
 * Converts all node positions and sizes from diagram-unit Cartesian space
 * to [0..1] NVS space after layout algorithms have assigned absolute positions.
 *
 * Also normalizes group bounds from diagram units to [0..1] NVS.
 *
 * The Y axis is FLIPPED: Cartesian +Y (up) → NVS y=0 (top).
 *
 * @param nodes     Node list with diagram-unit positions (Cartesian Y-up)
 * @param groups    Group bounds map in diagram units (GroupBounds.y = Cartesian bottom)
 * @param padding   The resolved padding in diagram units (used for bounding-box expansion)
 * @returns         Normalized positions, sizes, and group bounds in [0..1] NVS
 */
function normalizeToViewport(
  nodes: ReadonlyArray<{ id: string; position: RawPosition; size: RawSize }>,
  groups: Map<string, GroupBounds>,
  padding: number,
): {
  normalizedPositions: Map<string, RawPosition>;
  normalizedSizes: Map<string, RawSize>;
  normalizedGroups: Map<string, GroupBounds>;
} {
  // Step 1: Compute bounding box of all node outer edges
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const [px, py] = node.position;
    const [sw, sh] = node.size;
    minX = Math.min(minX, px - sw / 2);
    maxX = Math.max(maxX, px + sw / 2);
    minY = Math.min(minY, py - sh / 2);
    maxY = Math.max(maxY, py + sh / 2);
  }

  // Degenerate case: no nodes
  if (!Number.isFinite(minX)) {
    return {
      normalizedPositions: new Map(),
      normalizedSizes: new Map(),
      normalizedGroups: new Map(),
    };
  }

  // Step 2: Expand by padding
  const spanX = (maxX - minX) + 2 * padding;
  const spanY = (maxY - minY) + 2 * padding;
  const originX = minX - padding;
  const originY = minY - padding;  // BOTTOM of diagram in Cartesian Y-up

  // Guard against degenerate diagrams (single node with zero size)
  const safeSpanX = spanX > 0 ? spanX : 1;
  const safeSpanY = spanY > 0 ? spanY : 1;

  // Step 3: Normalize node positions (with Y-flip: Cartesian Y-up → NVS Y-down)
  const normalizedPositions = new Map<string, RawPosition>();
  const normalizedSizes = new Map<string, RawSize>();
  for (const node of nodes) {
    const [px, py, pz] = node.position;
    const [sw, sh] = node.size;
    const nx = (px - originX) / safeSpanX;
    const ny = 1 - (py - originY) / safeSpanY;   // Y-flip: Cartesian up → NVS down
    normalizedPositions.set(node.id, [nx, ny, pz]);
    normalizedSizes.set(node.id, [sw / safeSpanX, sh / safeSpanY]);
  }

  // Step 4: Normalize group bounds
  // GroupBounds.y is Cartesian BOTTOM (Y-up) pre-normalization.
  // After Y-flip, NVS top = 1 - (Cartesian top - originY) / safeSpanY
  const normalizedGroups = new Map<string, GroupBounds>();
  for (const [groupId, bounds] of groups) {
    const nvsX = (bounds.x - originX) / safeSpanX;
    const cartesianTop = bounds.y + bounds.h;
    const nvsY = 1 - (cartesianTop - originY) / safeSpanY;  // Y-flip: Cartesian top → NVS top
    const nvsW = bounds.w / safeSpanX;
    const nvsH = bounds.h / safeSpanY;
    const [pt, pr, pb, pl] = bounds.padding;
    normalizedGroups.set(groupId, {
      x: nvsX,
      y: nvsY,
      w: nvsW,
      h: nvsH,
      padding: [pt / safeSpanY, pr / safeSpanX, pb / safeSpanY, pl / safeSpanX],
      titleGap: bounds.titleGap / safeSpanY,
    });
  }

  return { normalizedPositions, normalizedSizes, normalizedGroups };
}

// ─── compileDiagram ───────────────────────────────────────────────────────────

/**
 * Full diagram compilation pipeline. Called by the compiler registry handler.
 * Produces DiagramState with all positions/sizes normalized to [0..1] NVS.
 */
export function compileDiagram(
  dsl: DiagramDSL,
  fallbackTheme: DiagramTheme = darkGlassTheme,
  onWarn?: DiagramWarnFn,
): DiagramState {
  const theme: DiagramTheme = dsl.theme ?? fallbackTheme;

  const layoutDefaults = resolveThemeLayoutDefaults(theme.layout);
  const rootLayout: ResolvedLayout = resolveEffectiveLayout(dsl.layout, undefined, layoutDefaults);
  const groupLayouts = resolveGroupLayouts(dsl.groups, rootLayout, layoutDefaults);
  const groupChildrenOrders = new Map<string, ReadonlyArray<string>>(
    dsl.groups.map((g) => [g.id, g.childrenOrder ?? []]),
  );

  const groupMap = new Map<string, string>();
  dsl.groups.forEach((group) => {
    group.nodeIds.forEach((nodeId) => {
      if (groupMap.has(nodeId) && groupMap.get(nodeId) !== group.id) {
        onWarn?.(
          'DUPLICATE_GROUP_MEMBERSHIP',
          `Diagram "${dsl.id}": node "${nodeId}" assigned to multiple groups. Only the last assignment applies.`,
        );
      }
      groupMap.set(nodeId, group.id);
    });
  });

  const nd = buildNodeDefaults(theme);
  const sizeMap = new Map<string, readonly [number, number]>();
  const sizeWithDepthMap = new Map<string, readonly [number, number, number]>();
  dsl.nodes.forEach((node) => {
    const size = node.size ?? nd.size;
    const thickness = node.thickness ?? nd.thickness;
    sizeMap.set(node.id, size);
    sizeWithDepthMap.set(node.id, [size[0], size[1], thickness]);
  });

  // Run layout algorithm → positions in diagram units (Cartesian Y-up for auto-layouts)
  const positions = resolveLayoutWithGroups(
    dsl.nodes,
    dsl.edges,
    dsl.groups,
    rootLayout,
    groupLayouts,
    sizeWithDepthMap,
    onWarn,
    dsl.childrenOrder ?? [],
    groupChildrenOrders,
  );

  // Compute group bounds in diagram units (Cartesian Y-up, GroupBounds.y = bottom)
  const groupBoundsMap = resolveGroupBoundsMap(dsl.groups, positions, sizeWithDepthMap, groupLayouts);

  const groupDefaults = buildGroupDefaults(theme);
  const groupDslById = new Map(dsl.groups.map((group) => [group.id, group]));
  // Add group centers to positions for edge routing (diagram units)
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
    positions.set(groupId, [centerX, centerY, GROUP_RENDER_Z]);
    sizeWithDepthMap.set(groupId, [
      bounds.w + borderCenterInset * 2,
      bounds.h + borderCenterInset * 2,
      groupBorderHeight,
    ]);
  });

  // Compile nodes with diagram-unit positions (temporary pre-normalization form)
  const nodesPreNorm = dsl.nodes.map((node) => {
    const positionFromMap = positions.get(node.id);
    const positionInherited = positionFromMap === undefined;
    const position: readonly [number, number, number] = positionFromMap ?? [0, 0, 0];
    const groupId = node.groupId ?? groupMap.get(node.id);
    return compileNode(node, position, groupId, theme, positionInherited);
  });

  // ─── Normalization ─────────────────────────────────────────────────────────
  // Convert diagram-unit positions/sizes to [0..1] NVS.
  // ManualLayout nodes are ALREADY authored in [0..1] NVS — skip normalization
  // to prevent double-normalization of [0..1] values against a [0..1] bounding box.
  let normalizedPositions: Map<string, RawPosition>;
  let normalizedSizes: Map<string, RawSize>;
  let normalizedGroups: Map<string, GroupBounds>;

  if (rootLayout.kind !== 'manual') {
    // Auto-layout: normalize diagram-unit positions to [0..1] NVS.
    const resolvedPadding = (rootLayout as ResolvedLayout).groupPadding[0];
    ({ normalizedPositions, normalizedSizes, normalizedGroups } = normalizeToViewport(
      nodesPreNorm,
      groupBoundsMap,
      resolvedPadding,
    ));
  } else {
    // ManualLayout: positions are [0..1] NVS as authored. Pass through unchanged.
    // GroupBounds.y in ManualLayout = NVS top edge (smallest Y in Y-down space).
    normalizedPositions = new Map(nodesPreNorm.map((n) => [n.id, n.position]));
    normalizedSizes = new Map(nodesPreNorm.map((n) => [n.id, n.size]));
    normalizedGroups = groupBoundsMap;
  }

  // Apply normalized positions/sizes to nodes
  const nodes = nodesPreNorm
    .map((node) => ({
      ...node,
      position: normalizedPositions.get(node.id) ?? node.position,
      size: normalizedSizes.get(node.id) ?? node.size,
    }))
    .sort((a, b) => a.position[2] - b.position[2]);

  // Build normalized size map including depth (thickness) for edge routing
  const normalizedSizeWithDepthMap = new Map<string, readonly [number, number, number]>();
  for (const [id, norm] of normalizedSizes) {
    const originalDepth = sizeWithDepthMap.get(id)?.[2] ?? 0.4;
    normalizedSizeWithDepthMap.set(id, [norm[0], norm[1], originalDepth]);
  }
  // Add group entries for edge routing — use normalized group centers as targets.
  // For ManualLayout, sizeWithDepthMap already has the border-center inset baked in;
  // use that pre-computed size so edge endpoints land on the border centerline.
  for (const [groupId, normBounds] of normalizedGroups) {
    normalizedPositions.set(groupId, [normBounds.x + normBounds.w / 2, normBounds.y + normBounds.h / 2, -0.6]);
    const preNorm = rootLayout.kind === 'manual' ? sizeWithDepthMap.get(groupId) : undefined;
    normalizedSizeWithDepthMap.set(groupId, preNorm ?? [normBounds.w, normBounds.h, 0.01]);
  }

  // Route edges with normalized positions (routing math is scale-invariant)
  const edgesForRouting = dsl.edges.map((edge) => ({
    ...edge,
    thickness: edge.thickness ?? theme.edge.defaultThickness,
  }));
  const normalizedControlPointsMap = routeEdges(
    edgesForRouting,
    normalizedPositions,
    normalizedSizeWithDepthMap,
    theme.edge.routing,
    theme.edge.landing,
    onWarn,
  );

  const edges = dsl.edges.map((edge, index) => {
    const id = edge.id ?? `${edge.from}-${edge.to}-${index}`;
    const controlPoints = normalizedControlPointsMap.get(id) ?? [];
    return compileEdge(edge, controlPoints, index, theme);
  });

  const groups = dsl.groups
    .map((group) => {
      const bounds = normalizedGroups.get(group.id);
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

  return {
    id: dsl.id,
    viewportBounds: dsl.viewportBounds ?? { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: dsl.tilt ?? [0, 0, 0],
    nodes,
    edges,
    groups,
    exit: compileExitConfig(dsl.exit),
    enter: compileEnterConfig(dsl.enter),
    themeConfig: buildThemeRenderConfig(theme),
  };
}

// ─── Functional Transition Spec ───────────────────────────────────────────────

const lerpNum = (a: number, b: number, t: number): number => a + (b - a) * t;

const lerpNVSRect = (a: NVSRect, b: NVSRect, t: number): NVSRect => ({
  x: lerpNum(a.x, b.x, t),
  y: lerpNum(a.y, b.y, t),
  w: lerpNum(a.w, b.w, t),
  h: lerpNum(a.h, b.h, t),
});

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
 * Translates viewportBounds center toward config.to in NVS space.
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

  // Translate viewportBounds center toward config.to in NVS space
  let viewportBounds = diagram.viewportBounds;
  if (config.to) {
    const cx = diagram.viewportBounds.x + diagram.viewportBounds.w / 2;
    const cy = diagram.viewportBounds.y + diagram.viewportBounds.h / 2;
    const tx = cx + (config.to[0] - cx) * et;
    const ty = cy + (config.to[1] - cy) * et;
    viewportBounds = {
      x: tx - diagram.viewportBounds.w / 2,
      y: ty - diagram.viewportBounds.h / 2,
      w: diagram.viewportBounds.w,
      h: diagram.viewportBounds.h,
    };
  }

  const nodes = config.fade ? fadeNodesOut(diagram.nodes, et) : diagram.nodes;
  const edges = config.fade ? fadeEdgesOut(diagram.edges, et) : diagram.edges;
  return { ...diagram, viewportBounds, nodes, edges };
}

/**
 * Applies the diagram's enter config to produce the state at enter progress t.
 * Translates viewportBounds center from config.from toward its declared position.
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

  // Translate viewportBounds center from config.from to declared viewportBounds
  let viewportBounds = diagram.viewportBounds;
  if (config.from) {
    const targetCX = diagram.viewportBounds.x + diagram.viewportBounds.w / 2;
    const targetCY = diagram.viewportBounds.y + diagram.viewportBounds.h / 2;
    const tx = config.from[0] + (targetCX - config.from[0]) * et;
    const ty = config.from[1] + (targetCY - config.from[1]) * et;
    viewportBounds = {
      x: tx - diagram.viewportBounds.w / 2,
      y: ty - diagram.viewportBounds.h / 2,
      w: diagram.viewportBounds.w,
      h: diagram.viewportBounds.h,
    };
  }

  const nodes = config.fade ? fadeNodesIn(diagram.nodes, et) : diagram.nodes;
  const edges = config.fade ? fadeEdgesIn(diagram.edges, et) : diagram.edges;
  return { ...diagram, viewportBounds, nodes, edges };
}

/**
 * Functional transition spec for DiagramState.
 * Blends viewportBounds and tiltRotation. Node positions in [0..1] NVS are
 * blended by blendDiagramNodes; edges are re-routed from live node positions.
 */
export const functionalDiagramTransitionSpec: FunctionalTransitionSpec<DiagramState> = {
  exitFn: (from) => (ctx) => applyDiagramExit(from, ctx.t),
  enterFn: (to) => (ctx) => applyDiagramEnter(to, ctx.t),
  interpolateFn: (from, to) => (ctx) => {
    const t = ctx.t;
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
      viewportBounds: lerpNVSRect(from.viewportBounds, to.viewportBounds, t),
      tiltRotation: blendVec3(
        [from.tiltRotation[0], from.tiltRotation[1], from.tiltRotation[2]],
        [to.tiltRotation[0], to.tiltRotation[1], to.tiltRotation[2]],
        t,
      ) ?? to.tiltRotation,
      nodes: [...blended, ...fading],
      edges: [...blendedEdges, ...fadingEdges],
    };
  },
};

export { resolveLayout, computeBounds, routeEdges };
export { compileNode, compileEdge } from './compiler/nodeCompiler';
export { compileGroup } from './compiler/groupCompiler';
