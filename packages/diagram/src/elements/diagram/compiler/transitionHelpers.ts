// Shared node/edge blending utilities for diagram transition specs.
// Used by both functionalDiagramTransitionSpec and functionalDiagramCanvasTransitionSpec.

import type { DiagramNodeState, DiagramEdgeState, DiagramGroupState } from '../types';
import type { EdgeRoutingAlgorithm, EdgeLandingAlgorithm } from '../types';
import { blendOpacity, blendVec3 } from '@brewsite/core';
import { routeEdges, routeEdgesYDown } from './edgeRouter';
import { optimizeSharedFlowTrunks } from './edgeRenderOptimizer';
import { GROUP_BORDER_PX_TO_UNITS } from './diagramRenderConstants';

type Vec3 = readonly [number, number, number];
type NodeDimensions = readonly [number, number, number];

const toMutableVec3 = (v: Vec3): [number, number, number] => [v[0], v[1], v[2]];

/** Linear interpolation for a single number. */
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

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
      };
    }
    return {
      ...toNode,
      position: blendVec3(toMutableVec3(fromNode.position), toMutableVec3(toNode.position), t) ?? toNode.position,
      opacity: blendOpacity(fromNode.opacity, toNode.opacity, t) ?? toNode.opacity,
      // Interpolate geometric properties to prevent snapping when scenes have
      // different safeSpan values (different NVS normalization denominators).
      size: [
        lerp(fromNode.size[0], toNode.size[0], t),
        lerp(fromNode.size[1], toNode.size[1], t),
      ] as readonly [number, number],
      thickness: lerp(fromNode.thickness, toNode.thickness, t),
    };
  });

  const fading = fromNodes
    .filter((node) => !toNodeIds.has(node.id))
    .map((node) => ({
      ...node,
      opacity: blendOpacity(node.opacity, 0, t) ?? 0,
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
      : Math.max(0, group.borderWidth * GROUP_BORDER_PX_TO_UNITS);
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
): ReturnType<typeof routeEdgesYDown> {
  const edgesForRouting = toEdges.map((e) => ({
    id: e.id,
    from: e.fromId,
    to: e.toId,
    routing: e.routing,
    flowTurnRadius: e.flowTurnRadius,
    flowFaceStub: e.flowFaceStub,
    flowBundleStrength: e.flowBundleStrength,
    flowTargetApproachBias: e.flowTargetApproachBias,
    allowUnderpass: e.allowUnderpass,
    fromPort: e.fromPort,
    toPort: e.toPort,
    thickness: e.thickness,
  }));
  const fadingEdgesForRouting = fromEdges
    .filter((e) => !toEdgeIds.has(e.id))
    .map((e) => ({
      id: e.id,
      from: e.fromId,
      to: e.toId,
      routing: e.routing,
      flowTurnRadius: e.flowTurnRadius,
      flowFaceStub: e.flowFaceStub,
      flowBundleStrength: e.flowBundleStrength,
      flowTargetApproachBias: e.flowTargetApproachBias,
      allowUnderpass: e.allowUnderpass,
      fromPort: e.fromPort,
      toPort: e.toPort,
      thickness: e.thickness,
    }));
  return routeEdgesYDown(
    [...edgesForRouting, ...fadingEdgesForRouting],
    livePositions,
    liveSizes,
    defaultRouting,
    defaultLanding,
    undefined,
    undefined,
    undefined,
    groupIds,
    obstacleGroupIds,
  );
}

export function blendDiagramEdges(
  fromEdges: ReadonlyArray<DiagramEdgeState>,
  toEdges: ReadonlyArray<DiagramEdgeState>,
  liveRoutes: ReturnType<typeof routeEdges>,
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
