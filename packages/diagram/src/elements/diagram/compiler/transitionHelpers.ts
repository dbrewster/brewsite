// Shared node/edge blending utilities for diagram transition specs.
// Used by both functionalDiagramTransitionSpec and functionalDiagramCanvasTransitionSpec.

import type { DiagramNodeState, DiagramEdgeState } from '../types';
import type { EdgeRoutingAlgorithm, EdgeLandingAlgorithm } from '../types';
import { blendOpacity, blendVec3 } from '@brewsite/core';
import { routeEdges } from './edgeRouter';

type Vec3 = readonly [number, number, number];
type NodeDimensions = readonly [number, number, number];

const toMutableVec3 = (v: Vec3): [number, number, number] => [v[0], v[1], v[2]];

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
): {
  positions: Map<string, Vec3>;
  sizes: Map<string, NodeDimensions>;
} {
  const positions = new Map<string, Vec3>();
  const sizes = new Map<string, NodeDimensions>();
  nodes.forEach((n) => {
    positions.set(n.id, n.position);
    sizes.set(n.id, [n.size[0], n.size[1], n.depth]);
  });
  return { positions, sizes };
}

export function rerouteLiveEdges(
  toEdges: ReadonlyArray<DiagramEdgeState>,
  fromEdges: ReadonlyArray<DiagramEdgeState>,
  toEdgeIds: Set<string>,
  livePositions: Map<string, Vec3>,
  liveSizes: Map<string, NodeDimensions>,
  defaultRouting?: EdgeRoutingAlgorithm,
  defaultLanding?: EdgeLandingAlgorithm,
): Map<string, ReadonlyArray<Vec3>> {
  const edgesForRouting = toEdges.map((e) => ({
    id: e.id,
    from: e.fromId,
    to: e.toId,
    routing: e.routing,
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
      fromPort: e.fromPort,
      toPort: e.toPort,
      thickness: e.thickness,
    }));
  return routeEdges(
    [...edgesForRouting, ...fadingEdgesForRouting],
    livePositions,
    liveSizes,
    defaultRouting,
    defaultLanding,
  );
}

export function blendDiagramEdges(
  fromEdges: ReadonlyArray<DiagramEdgeState>,
  toEdges: ReadonlyArray<DiagramEdgeState>,
  liveControlPoints: Map<string, ReadonlyArray<Vec3>>,
  t: number,
): { blended: DiagramEdgeState[]; fading: DiagramEdgeState[] } {
  const fromEdgeMap = new Map(fromEdges.map((edge) => [edge.id, edge]));
  const toEdgeIds = new Set(toEdges.map((edge) => edge.id));

  const blended = toEdges.map((toEdge) => {
    const fromEdge = fromEdgeMap.get(toEdge.id);
    return {
      ...toEdge,
      opacity: fromEdge
        ? blendOpacity(fromEdge.opacity, toEdge.opacity, t) ?? toEdge.opacity
        : blendOpacity(0, toEdge.opacity, t) ?? toEdge.opacity,
      controlPoints: liveControlPoints.get(toEdge.id) ?? toEdge.controlPoints,
    };
  });

  const fading = fromEdges
    .filter((edge) => !toEdgeIds.has(edge.id))
    .map((edge) => ({
      ...edge,
      opacity: blendOpacity(edge.opacity, 0, t) ?? 0,
      controlPoints: liveControlPoints.get(edge.id) ?? edge.controlPoints,
    }));

  return { blended, fading };
}
