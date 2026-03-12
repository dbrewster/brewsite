// Pure transformation pipeline: DiagramDSL → DiagramState.
// No Three.js. No React. No side effects.

import type {
  DiagramDSL,
  DiagramState,
  DiagramNodeState,
  DiagramEdgeState,
  DiagramEasing,
  DiagramTheme,
  DiagramThemeName,
  DiagramWarnFn,
} from './types';
import type { FunctionalTransitionSpec, NVSRect } from '@brewsite/core';
import { blendOpacity, blendVec3, validateNVSRect, validateNVSPosition } from '@brewsite/core';
import { darkGlassTheme } from './themes/darkGlass';
import { DIAGRAM_THEMES } from './themes/index';
import { resolveLayout, resolveLayoutWithGroups, computeBounds } from './compiler/layoutAlgorithms';
import { routeEdges, routeEdgesYDown } from './compiler/edgeRouter';
import { compileNode, compileEdge } from './compiler/nodeCompiler';
import { buildNodeDefaults, buildGroupDefaults } from './compiler/defaultsCompiler';
import { optimizeSharedFlowTrunks } from './compiler/edgeRenderOptimizer';
import { compileGroup, resolveGroupBoundsMap } from './compiler/groupCompiler';
import type { GroupBounds } from './compiler/groupCompiler';
import { normalizeToViewport } from './compiler/normalizeToViewport';
import type { NormalizeToViewportResult } from './compiler/normalizeToViewport';
import { buildThemeRenderConfig, compileExitConfig, compileEnterConfig } from './compiler/themeResolver';
import { resolveEffectiveLayout, resolveGroupLayouts, resolveThemeLayoutDefaults } from './compiler/layoutResolver';
import type { ResolvedLayout } from './compiler/layoutResolver';
import {
  blendDiagramNodes,
  buildLiveNodeMaps,
  rerouteLiveEdges,
  blendDiagramEdges,
} from './compiler/transitionHelpers';
import { GROUP_BORDER_PX_TO_UNITS, GROUP_RENDER_Z } from './compiler/diagramRenderConstants';

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

// ─── Theme Resolution ─────────────────────────────────────────────────────────

/**
 * Resolves a DiagramThemeName string, DiagramTheme object, or undefined
 * to a concrete DiagramTheme. Unknown string names fall back to darkGlassTheme
 * with a console.warn.
 */
function resolveTheme(
  raw: DiagramThemeName | DiagramTheme | undefined,
  fallback: DiagramTheme,
): DiagramTheme {
  if (raw === undefined) return fallback;
  if (typeof raw === 'string') {
    const named = DIAGRAM_THEMES[raw];
    if (!named) {
      console.warn(`[Diagram] Unknown theme name "${raw}" — falling back to darkGlass.`);
      return fallback;
    }
    return named;
  }
  return raw;
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
  const theme: DiagramTheme = resolveTheme(dsl.theme, fallbackTheme);

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
    const size = node.size ?? theme.node.defaultSize;
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
    theme.node.defaultSize,
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
    positions.set(groupId, [centerX, centerY, 0]);
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
  let contentAspect: number;
  // safeSpanX: the diagram's horizontal extent in content units.
  // Used to normalize thickness-type values (edge tube radius, group border width)
  // from diagram-content-units to [0..1] NVS fractions.
  // For ManualLayout, content is already in NVS (span = 1).
  let safeSpanX: number;

  if (rootLayout.kind !== 'manual') {
    // Auto-layout: normalize diagram-unit positions to [0..1] NVS.
    const resolvedPadding = (rootLayout as ResolvedLayout).groupPadding[0];
    ({ normalizedPositions, normalizedSizes, normalizedGroups, contentAspect, safeSpanX } = normalizeToViewport(
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
    // ManualLayout positions are already in NVS fractions — no AR correction needed.
    contentAspect = 1.0;
    safeSpanX = 1;
  }

  // Warn when a ManualLayout diagram contains a node whose size dimension exceeds 1.5 —
  // this almost always means an AutoLayout diagram-unit value was authored by mistake.
  // (ManualLayout nodes are [0..1] NVS fractions; [4, 2] is never a valid NVS fraction.)
  if (rootLayout.kind === 'manual' && onWarn) {
    for (const node of nodesPreNorm) {
      const [w, h] = node.size;
      if (w > 1.5 || h > 1.5) {
        onWarn(
          'MANUAL_LAYOUT_NODE_SIZE_SUSPICIOUS',
          `Diagram "${dsl.id}": node "${node.id}" has size [${w.toFixed(2)}, ${h.toFixed(2)}] in a ManualLayout diagram. ` +
          `ManualLayout sizes should be [0..1] NVS fractions. Did you mean to use an auto-layout?`,
        );
      }
    }
  }

  // Apply normalized positions/sizes to nodes
  const nodes = nodesPreNorm
    .map((node) => ({
      ...node,
      position: normalizedPositions.get(node.id) ?? node.position,
      size: normalizedSizes.get(node.id) ?? node.size,
      // Normalize node Z-depth from diagram-content-units to NVS fraction.
      // The renderer multiplies by uniformWorldW to convert to world units.
      thickness: node.thickness / safeSpanX,
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
    normalizedPositions.set(groupId, [normBounds.x + normBounds.w / 2, normBounds.y + normBounds.h / 2, 0]);
    const preNorm = rootLayout.kind === 'manual' ? sizeWithDepthMap.get(groupId) : undefined;
    normalizedSizeWithDepthMap.set(groupId, preNorm ?? [normBounds.w, normBounds.h, 0.01]);
  }

  // Route edges with normalized positions (routing math is scale-invariant)
  const edgesForRouting = dsl.edges.map((edge) => ({
    ...edge,
    thickness: edge.thickness ?? theme.edge.defaultThickness,
  }));
  const normalizedEdgeRoutes = routeEdgesYDown(
    edgesForRouting,
    normalizedPositions,
    normalizedSizeWithDepthMap,
    theme.edge.routing,
    theme.edge.landing,
    onWarn,
    theme.edge.organicVariation,
    {
      flowTurnRadius: theme.edge.flowTurnRadius,
      flowFaceStub: theme.edge.flowFaceStub,
      flowBundleStrength: theme.edge.flowBundleStrength,
      flowObstaclePadding: theme.edge.flowObstaclePadding,
      flowTargetApproachBias: theme.edge.flowTargetApproachBias,
      flowUnderpassDepth: theme.edge.flowUnderpassDepth,
      flowUnderpassClearance: theme.edge.flowUnderpassClearance,
      flowTurnPenalty: theme.edge.flowTurnPenalty,
      flowPunchthroughPenalty: theme.edge.flowPunchthroughPenalty,
      flowUnderpassPenalty: theme.edge.flowUnderpassPenalty,
    },
    new Set(normalizedGroups.keys()),
    new Set(
      dsl.groups
        .filter((group) => (group.variant ?? groupDefaults.variant) !== 'container')
        .map((group) => group.id),
    ),
  );

  const rawEdges = dsl.edges.map((edge, index) => {
    const id = edge.id ?? `${edge.from}-${edge.to}-${index}`;
    const route = normalizedEdgeRoutes.get(id);
    const compiled = compileEdge(
      edge,
      route?.path ?? {
        commands: [],
        startTangent: [0, 0, 0],
        endTangent: [0, 0, 0],
        usedUnderpass: false,
        punctures: [],
      },
      route?.controlPoints ?? [],
      index,
      theme,
      route?.pathDebug,
    );
    // Normalize edge thickness from diagram-content-units to NVS fraction.
    // The renderer multiplies by uniformWorldW to convert to world units,
    // keeping tube radius proportional to the diagram's rendered size.
    return { ...compiled, thickness: compiled.thickness / safeSpanX };
  });
  const edges = optimizeSharedFlowTrunks(rawEdges);

  const groups = dsl.groups
    .map((group) => {
      const bounds = normalizedGroups.get(group.id);
      if (!bounds) return null;
      const compiled = compileGroup(group, bounds, theme);
      // Normalize group borderWidth and borderHeight from diagram-content-units
      // to NVS fraction. The renderer multiplies by uniformWorldW to convert
      // to world units, keeping the border proportional to the diagram's size.
      return {
        ...compiled,
        borderWidth: compiled.borderWidth / safeSpanX,
        borderHeight: compiled.borderHeight / safeSpanX,
      };
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

  const viewportBounds: NVSRect = {
    x: dsl.x ?? 0,
    y: dsl.y ?? 0,
    w: dsl.w ?? 1,
    h: dsl.h ?? 1,
  };

  if (process.env.NODE_ENV !== 'production') {
    validateNVSRect(viewportBounds, `<Diagram id="${dsl.id}">`);
    for (const node of nodes) {
      validateNVSPosition(node.position, `<Diagram id="${dsl.id}"> node "${node.id}"`);
    }
    for (const edge of edges) {
      for (const pt of edge.controlPoints) {
        if (pt[0] < -0.05 || pt[0] > 1.05 || pt[1] < -0.05 || pt[1] > 1.05) {
          console.warn(
            `[NVS] <Diagram id="${dsl.id}"> edge "${edge.id}" has control point ` +
            `[${pt[0].toFixed(3)}, ${pt[1].toFixed(3)}] outside [0..1]. ` +
            `Edge may render outside viewportBounds.`,
          );
        }
      }
    }
  }

  return {
    id: dsl.id,
    viewportBounds,
    tiltRotation: [dsl.tilt ?? 0, 0, 0],
    z: dsl.z ?? 0,
    scale: dsl.scale ?? 1,
    contentAspect,
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
    const { positions, sizes, groupIds, obstacleGroupIds } = buildLiveNodeMaps([...blended, ...fading], to.groups);
    const toEdgeIds = new Set(to.edges.map((e) => e.id));
    const liveControlPoints = rerouteLiveEdges(
      to.edges,
      from.edges,
      toEdgeIds,
      positions,
      sizes,
      groupIds,
      obstacleGroupIds,
    );
    const { blended: blendedEdges, fading: fadingEdges } = blendDiagramEdges(
      from.edges,
      to.edges,
      liveControlPoints,
      t,
    );

    return {
      ...to,
      z: lerpNum(from.z, to.z, t),
      scale: lerpNum(from.scale, to.scale, t),
      contentAspect: to.contentAspect,  // structural property — pass through, do not lerp
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
