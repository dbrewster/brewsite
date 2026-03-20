// DEBT: Split this file — extract exit/enter helpers to transitionHelpers.ts, resolveTheme to themeResolver.ts
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
import { blendOpacity, blendVec3, lerp, validateNVSRect, validateNVSPosition } from '@brewsite/core';
import { defaultDiagramTheme } from './themes/enterprise';
import { resolveDiagramTheme } from './themeRegistry';
import { resolveLayout, resolveLayoutWithGroups, computeBounds } from './compiler/layoutAlgorithms';
import { routeEdges, routeEdgesYDown } from './compiler/edgeRouter';
import { compileNode, compileEdge } from './compiler/nodeCompiler';
import { buildNodeDefaults, buildGroupDefaults } from './compiler/defaultsCompiler';
import { optimizeSharedFlowTrunks } from './compiler/edgeRenderOptimizer';
import { compileGroup, resolveGroupBoundsMap } from './compiler/groupCompiler';
import { normalizeToViewport } from './compiler/normalizeToViewport';
import { buildThemeRenderConfig, compileExitConfig, compileEnterConfig } from './compiler/themeResolver';
import { resolveEffectiveLayout, resolveGroupLayouts, resolveThemeLayoutDefaults } from './compiler/layoutResolver';
import type { ResolvedLayout } from './compiler/layoutResolver';
import {
  blendDiagramNodes,
  buildLiveNodeMaps,
  rerouteLiveEdges,
  blendDiagramEdges,
} from './compiler/transitionHelpers';

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

// ─── Theme Resolution ─────────────────────────────────────────────────────────

/**
 * Resolves a DiagramThemeName string, DiagramTheme object, or undefined
 * to a concrete DiagramTheme. Unknown string names fall back to the default (enterprise) theme
 * with a console.warn.
 */
function resolveTheme(
  raw: DiagramTheme | undefined,
  fallback: DiagramTheme,
): DiagramTheme {
  if (raw === undefined) return fallback;
  if (typeof raw === 'string') {
    // Resolve from the registry — falls back to 'default' (enterprise aesthetic) if not registered.
    return resolveDiagramTheme(raw, 'dark');
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
  fallbackTheme: DiagramTheme = defaultDiagramTheme,
  onWarn?: DiagramWarnFn,
): DiagramState {
  const theme: DiagramTheme = resolveTheme(dsl.theme, fallbackTheme);

  // Polygon shapes rendered as N-sided prisms inscribed in r = min(w, h) / 2.
  // When w ≠ h, the geometry doesn't fill the AABB on the wider axis.
  // Sizes are clamped to [min, min] before layout so spacing, normalization,
  // edge routing, and rendering all agree on the node's actual extent.
  const POLYGON_SHAPES = new Set([
    'circle', 'triangle', 'pentagon', 'hexagon', 'heptagon',
    'octagon', 'nonagon', 'decagon',
  ]);

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
    const rawSize = node.size ?? theme.node.defaultSize;
    const thickness = node.thickness ?? nd.thickness;
    // Clamp polygon shapes to inscribed-circle extent BEFORE layout so that
    // layout spacing, normalization, and rendering all use the same sizes.
    const shape = node.shape ?? nd.shape;
    const size: readonly [number, number] = POLYGON_SHAPES.has(shape)
      ? [Math.min(rawSize[0], rawSize[1]), Math.min(rawSize[0], rawSize[1])]
      : rawSize;
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
      : Math.max(0, groupDefaults.borderWidth);
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

  // Compile nodes with diagram-unit positions (temporary pre-normalization form).
  // Override the compiled size with the shape-clamped size from sizeMap so that
  // normalization, routing, and rendering all use consistent dimensions.
  const nodesPreNorm = dsl.nodes.map((node) => {
    const positionFromMap = positions.get(node.id);
    const positionInherited = positionFromMap === undefined;
    const position: readonly [number, number, number] = positionFromMap ?? [0, 0, 0];
    const groupId = node.groupId ?? groupMap.get(node.id);
    const compiled = compileNode(node, position, groupId, theme, positionInherited);
    const clampedSize = sizeMap.get(node.id);
    return clampedSize ? { ...compiled, size: clampedSize } : compiled;
  });

  // ─── Normalization ─────────────────────────────────────────────────────────
  // Convert layout positions/sizes to [0..1] NVS with center + uniform-scale-to-fit + Y-flip.
  // All layout modes (including ManualLayout) go through the same normalizeToViewport path.
  const { normalizedPositions, normalizedSizes, normalizedGroups, scaleFactor } =
    normalizeToViewport(nodesPreNorm, groupBoundsMap, theme.node.defaultSize);

  // Apply normalized positions/sizes to nodes.
  // Polygon shapes were already clamped to [min, min] in the sizeMap above,
  // so normalizedSizes already reflects the inscribed-circle extent.
  const nodes = nodesPreNorm
    .map((node) => ({
      ...node,
      position: normalizedPositions.get(node.id) ?? node.position,
      size: normalizedSizes.get(node.id) ?? node.size,
      // Normalize node thickness to NVS fraction using the deterministic factor.
      // The renderer multiplies by uniformWorldW to convert to world units.
      thickness: node.thickness * scaleFactor,
    }))
    .sort((a, b) => a.position[2] - b.position[2]);

  // Build normalized size map including depth (thickness) for edge routing.
  // Sizes are already shape-corrected (polygon → inscribed circle) from the
  // pre-layout clamping, so no additional adjustment is needed here.
  const normalizedSizeWithDepthMap = new Map<string, readonly [number, number, number]>();
  for (const [id, norm] of normalizedSizes) {
    const originalDepth = sizeWithDepthMap.get(id)?.[2] ?? 0.4;
    normalizedSizeWithDepthMap.set(id, [norm[0], norm[1], originalDepth]);
  }
  // Add group entries for edge routing — use normalized group centers as targets.
  for (const [groupId, normBounds] of normalizedGroups) {
    normalizedPositions.set(groupId, [normBounds.x + normBounds.w / 2, normBounds.y + normBounds.h / 2, 0]);
    normalizedSizeWithDepthMap.set(groupId, [normBounds.w, normBounds.h, 0.01]);
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
    // Normalize edge thickness using the deterministic factor.
    // The renderer multiplies by uniformWorldW to convert to world units.
    return { ...compiled, thickness: compiled.thickness * scaleFactor };
  });
  const edges = optimizeSharedFlowTrunks(rawEdges);

  const groups = dsl.groups
    .map((group) => {
      const bounds = normalizedGroups.get(group.id);
      if (!bounds) return null;
      const compiled = compileGroup(group, bounds, theme);
      // Normalize group borderWidth and borderHeight using the deterministic factor.
      // The renderer multiplies by uniformWorldW to convert to world units.
      return {
        ...compiled,
        borderWidth: compiled.borderWidth * scaleFactor,
        borderHeight: compiled.borderHeight * scaleFactor,
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
    nodes,
    edges,
    groups,
    exit: compileExitConfig(dsl.exit),
    enter: compileEnterConfig(dsl.enter),
    themeConfig: buildThemeRenderConfig(theme),
  };
}

// ─── Functional Transition Spec ───────────────────────────────────────────────

const lerpNVSRect = (a: NVSRect, b: NVSRect, t: number): NVSRect => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});

// DEBT: These fade helpers duplicate logic in transitionHelpers.ts — consolidate
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
  interpolateFn: (from, to) => {
    // Memoize rerouteLiveEdges — the flow-routing algorithm (visibility graph +
    // A* search) is O(expensive) and must NOT run on every tick. We fingerprint
    // the blended position map; when positions haven't changed (common case:
    // carousel transitions where diagram content is identical across scenes),
    // the cached routing result is reused. This reduces per-tick cost from ~32ms
    // to <0.5ms for complex diagrams.
    let cachedFingerprint = '';
    let cachedRouting: ReturnType<typeof rerouteLiveEdges> | null = null;
    const toEdgeIds = new Set(to.edges.map((e) => e.id));

    return (ctx) => {
      const t = ctx.t;
      const { blended, fading } = blendDiagramNodes(from.nodes, to.nodes, t);
      const { positions, sizes, groupIds, obstacleGroupIds } = buildLiveNodeMaps([...blended, ...fading], to.groups);

      // Build a lightweight fingerprint from node positions.
      // Quantize to 4 decimal places to avoid floating-point jitter mismatches.
      let fingerprint = '';
      for (const [id, pos] of positions) {
        fingerprint += id;
        fingerprint += (pos[0] * 1e4 | 0).toString(36);
        fingerprint += (pos[1] * 1e4 | 0).toString(36);
        fingerprint += (pos[2] * 1e4 | 0).toString(36);
      }

      if (fingerprint !== cachedFingerprint || !cachedRouting) {
        cachedRouting = rerouteLiveEdges(
          to.edges,
          from.edges,
          toEdgeIds,
          positions,
          sizes,
          groupIds,
          obstacleGroupIds,
        );
        cachedFingerprint = fingerprint;
      }

      const { blended: blendedEdges, fading: fadingEdges } = blendDiagramEdges(
        from.edges,
        to.edges,
        cachedRouting,
        t,
      );

      // Use `from` as the base when t < 0.5, `to` when t >= 0.5.
      // Previously `...to` was always the base, which made non-interpolated
      // fields (groups, contentAspect, themeConfig, exit, enter) show the
      // DESTINATION scene's metadata for the entire transition block —
      // even at t=0 when the outgoing scene should be fully visible.
      const base = t < 0.5 ? from : to;
      return {
        ...base,
        z: lerp(from.z, to.z, t),
        scale: lerp(from.scale, to.scale, t),
        viewportBounds: lerpNVSRect(from.viewportBounds, to.viewportBounds, t),
        tiltRotation: blendVec3(
          [from.tiltRotation[0], from.tiltRotation[1], from.tiltRotation[2]],
          [to.tiltRotation[0], to.tiltRotation[1], to.tiltRotation[2]],
          t,
        ) ?? to.tiltRotation,
        nodes: [...blended, ...fading],
        edges: [...blendedEdges, ...fadingEdges],
      };
    };
  },
};

export { resolveLayout, computeBounds, routeEdges };
export { compileNode, compileEdge } from './compiler/nodeCompiler';
export { compileGroup } from './compiler/groupCompiler';
