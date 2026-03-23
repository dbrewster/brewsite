// Shared node/edge blending utilities for diagram transition specs.
// Used by both functionalDiagramTransitionSpec and functionalDiagramCanvasTransitionSpec.

import type { DiagramNodeState, DiagramEdgeState, DiagramGroupState } from '../types';
import type { EdgeRoutingAlgorithm, EdgeLandingAlgorithm } from '../types';
import { blendOpacity, blendVec3, copyVec3, lerp } from '@brewsite/core';
import { routeEdges } from './routing/edgeRouter';
import type { EdgeRoutingInput } from './routing/edgeRouter';
import type { NodeRect, FlowConfig, EdgeRouteResult, SideId } from './routing/routingTypes';
import { DEFAULT_FLOW_CONFIG } from './routing/routingTypes';
import { optimizeSharedFlowTrunks } from './routing/trunkOptimizer';

type Vec3 = readonly [number, number, number];
type NodeDimensions = readonly [number, number, number];

export function blendDiagramNodes(
  fromNodes: ReadonlyArray<DiagramNodeState>,
  toNodes: ReadonlyArray<DiagramNodeState>,
  t: number,
): { blended: DiagramNodeState[]; fading: DiagramNodeState[] } {
  const fromNodeMap = new Map(fromNodes.map((node) => [node.id, node]));
  const toNodeIds = new Set(toNodes.map((node) => node.id));

  const blended = toNodes.map((toNode) => {
    const fromNode = fromNodeMap.get(toNode.id);
    if (!fromNode) {
      return {
        ...toNode,
        opacity: blendOpacity(0, toNode.opacity, t) ?? toNode.opacity,
        emissiveIntensity: lerp(0, toNode.emissiveIntensity, t),
      };
    }
    // Use fromNode as the base for t < 0.5, toNode for t >= 0.5.
    // Non-interpolated fields (label, sublabel, color, shape, icon) come from
    // the base. Previously `...toNode` was always used, which made the incoming
    // scene's text/color appear for the entire transition — even at t=0 when
    // the outgoing scene should be fully visible.
    const base = t < 0.5 ? fromNode : toNode;
    return {
      ...base,
      position: blendVec3(copyVec3(fromNode.position), copyVec3(toNode.position), t) ?? toNode.position,
      opacity: blendOpacity(fromNode.opacity, toNode.opacity, t) ?? toNode.opacity,
      size: [
        lerp(fromNode.size[0], toNode.size[0], t),
        lerp(fromNode.size[1], toNode.size[1], t),
      ] as readonly [number, number],
      thickness: lerp(fromNode.thickness, toNode.thickness, t),
      // Emissive / highlight — interpolate so glow fades smoothly between scenes
      emissiveIntensity: lerp(fromNode.emissiveIntensity, toNode.emissiveIntensity, t),
      emissive: fromNode.emissive || toNode.emissive,
      emissiveColor: t < 0.5 ? fromNode.emissiveColor : toNode.emissiveColor,
    };
  });

  const fading = fromNodes
    .filter((node) => !toNodeIds.has(node.id))
    .map((node) => ({
      ...node,
      opacity: blendOpacity(node.opacity, 0, t) ?? 0,
      emissiveIntensity: lerp(node.emissiveIntensity, 0, t),
    }));

  return { blended, fading };
}

export function buildLiveNodeMaps(
  nodes: ReadonlyArray<DiagramNodeState>,
  groups: ReadonlyArray<DiagramGroupState> = [],
): {
  positions: Map<string, Vec3>;
  sizes: Map<string, NodeDimensions>;
  groupIds: Set<string>;
  obstacleGroupIds: Set<string>;
} {
  const positions = new Map<string, Vec3>();
  const sizes = new Map<string, NodeDimensions>();
  const groupIds = new Set<string>();
  const obstacleGroupIds = new Set<string>();
  nodes.forEach((n) => {
    positions.set(n.id, n.position);
    sizes.set(n.id, [n.size[0], n.size[1], n.thickness]);
  });
  groups.forEach((group) => {
    const borderWidthUnits = group.borderStyle === 'none'
      ? 0
      : Math.max(0, group.borderWidth);
    const borderCenterInset = borderWidthUnits * 0.5;
    const groupDepth = group.borderStyle === 'none'
      ? 0.01
      : Math.max(0.01, group.borderHeight);
    positions.set(group.id, [
      group.bounds.x + group.bounds.w / 2,
      group.bounds.y + group.bounds.h / 2,
      0,
    ]);
    sizes.set(group.id, [
      group.bounds.w + borderCenterInset * 2,
      group.bounds.h + borderCenterInset * 2,
      groupDepth,
    ]);
    groupIds.add(group.id);
    if (group.variant !== 'container') {
      obstacleGroupIds.add(group.id);
    }
  });
  return { positions, sizes, groupIds, obstacleGroupIds };
}

/**
 * Reroute live edges using the new 2D routing pipeline.
 * External signature preserved — callers pass Vec3/NodeDimensions maps.
 * Internal implementation converts to NodeRect and calls the new routeEdges().
 */
export function rerouteLiveEdges(
  toEdges: ReadonlyArray<DiagramEdgeState>,
  fromEdges: ReadonlyArray<DiagramEdgeState>,
  toEdgeIds: Set<string>,
  livePositions: Map<string, Vec3>,
  liveSizes: Map<string, NodeDimensions>,
  groupIds: ReadonlySet<string>,
  obstacleGroupIds: ReadonlySet<string>,
  defaultRouting?: EdgeRoutingAlgorithm,
  defaultLanding?: EdgeLandingAlgorithm,
): Map<string, EdgeRouteResult> {
  // Convert Vec3/NodeDimensions to NodeRect
  const nodeRects = new Map<string, NodeRect>();
  for (const [id, pos] of livePositions) {
    const size = liveSizes.get(id);
    if (!size) continue;
    nodeRects.set(id, {
      id, cx: pos[0], cy: pos[1], hw: size[0] / 2, hh: size[1] / 2,
      z: pos[2], depth: size[2],
    });
  }

  // Map routing profile names.
  const profileMap: Record<string, 'flow' | 'curved' | 'straight' | 'organic'> = {
    flow: 'flow',
    curved: 'curved',
    straight: 'straight',
    organic: 'organic',
  };

  // Build edge routing inputs from DiagramEdgeState
  const edgesForRouting: EdgeRoutingInput[] = [
    ...toEdges,
    ...fromEdges.filter((e) => !toEdgeIds.has(e.id)),
  ].map((e) => ({
    id: e.id,
    fromId: e.fromId,
    toId: e.toId,
    profile: profileMap[e.routing] ?? (profileMap[defaultRouting ?? 'curved'] ?? 'curved'),
    fromPort: e.fromPort as SideId | undefined,
    toPort: e.toPort as SideId | undefined,
    thickness: e.thickness,
  }));

  return routeEdges(edgesForRouting, nodeRects, groupIds, obstacleGroupIds, DEFAULT_FLOW_CONFIG);
}

export function blendDiagramEdges(
  fromEdges: ReadonlyArray<DiagramEdgeState>,
  toEdges: ReadonlyArray<DiagramEdgeState>,
  liveRoutes: Map<string, EdgeRouteResult>,
  t: number,
): { blended: DiagramEdgeState[]; fading: DiagramEdgeState[] } {
  const fromEdgeMap = new Map(fromEdges.map((edge) => [edge.id, edge]));
  const toEdgeIds = new Set(toEdges.map((edge) => edge.id));

  const blendedRaw = toEdges.map((toEdge) => {
    const fromEdge = fromEdgeMap.get(toEdge.id);
    return {
      ...toEdge,
      opacity: fromEdge
        ? blendOpacity(fromEdge.opacity, toEdge.opacity, t) ?? toEdge.opacity
        : blendOpacity(0, toEdge.opacity, t) ?? toEdge.opacity,
      path: liveRoutes.get(toEdge.id)?.path ?? toEdge.path,
      controlPoints: liveRoutes.get(toEdge.id)?.controlPoints ?? toEdge.controlPoints,
      pathDebug: liveRoutes.get(toEdge.id)?.pathDebug ?? toEdge.pathDebug,
    };
  });

  const fadingRaw = fromEdges
    .filter((edge) => !toEdgeIds.has(edge.id))
    .map((edge) => ({
      ...edge,
      opacity: blendOpacity(edge.opacity, 0, t) ?? 0,
      path: liveRoutes.get(edge.id)?.path ?? edge.path,
      controlPoints: liveRoutes.get(edge.id)?.controlPoints ?? edge.controlPoints,
      pathDebug: liveRoutes.get(edge.id)?.pathDebug ?? edge.pathDebug,
    }));

  const optimized = optimizeSharedFlowTrunks([...blendedRaw, ...fadingRaw]);
  const optimizedById = new Map(optimized.map((edge) => [edge.id, edge]));
  const blended = blendedRaw.map((edge) => optimizedById.get(edge.id) ?? edge);
  const fading = fadingRaw.map((edge) => optimizedById.get(edge.id) ?? edge);

  return { blended, fading };
}
