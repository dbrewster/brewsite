// Pure compilation pipeline for DiagramCanvas.
// No Three.js. No React. No side effects.

import type { DiagramState, DiagramEdgeStyle, DiagramArrowVariant } from '../types';
import type {
  DiagramCanvasDSL,
  DiagramCanvasState,
  DiagramPipeDSL,
  DiagramPipeState,
} from './types';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { blendNumber, blendOpacity, blendVec3 } from '@brewsite/core';
import { applyDiagramEnter, applyDiagramExit, routeEdges } from '../compile';

// ─── Defaults ────────────────────────────────────────────────────────────────

const PIPE_DEFAULTS = {
  style: 'solid' as DiagramEdgeStyle,
  arrowStart: 'none' as DiagramArrowVariant,
  arrowEnd: 'open' as DiagramArrowVariant,
  color: '#667788',
  thickness: 0.08,
  opacity: 1,
};

// ─── Pipe routing ─────────────────────────────────────────────────────────────

type Vec3 = readonly [number, number, number];

/**
 * Transforms a node's diagram-local position to canvas-local space.
 * Applies diagram position offset and uniform scale.
 * Note: this approximation ignores diagram rotation (adequate for v1 where
 * diagrams are typically axis-aligned within the canvas).
 */
function nodeToCanvasSpace(
  nodeLocalPos: Vec3,
  diagramPos: Vec3,
  diagramScale: number,
): Vec3 {
  return [
    nodeLocalPos[0] * diagramScale + diagramPos[0],
    nodeLocalPos[1] * diagramScale + diagramPos[1],
    nodeLocalPos[2] * diagramScale + diagramPos[2],
  ];
}

/**
 * Routes a cross-diagram pipe between two canvas-local endpoints.
 * Uses a simple arc (elevated at the midpoint) to prevent pipes from cutting
 * through diagram geometry.
 */
export function routePipe(from: Vec3, to: Vec3): ReadonlyArray<Vec3> {
  const dist = Math.sqrt(
    (to[0] - from[0]) ** 2 +
    (to[1] - from[1]) ** 2 +
    (to[2] - from[2]) ** 2,
  );
  // Arc height: 15% of the 3D distance, minimum 0.5 canvas units
  const arcH = Math.max(0.5, dist * 0.15);
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2 + arcH;
  const midZ = (from[2] + to[2]) / 2;
  const ctrl1: Vec3 = [
    from[0] + (midX - from[0]) * 0.5,
    from[1] + (midY - from[1]) * 0.5,
    from[2] + (midZ - from[2]) * 0.5,
  ];
  const ctrl2: Vec3 = [
    midX + (to[0] - midX) * 0.5,
    midY + (to[1] - midY) * 0.5,
    midZ + (to[2] - midZ) * 0.5,
  ];
  return [from, ctrl1, ctrl2, to];
}

/**
 * Parses a dot-notation reference "diagramId.nodeId" into its components.
 * Returns null if the format is invalid.
 */
function parsePipeRef(ref: string): { diagramId: string; nodeId: string } | null {
  const dot = ref.indexOf('.');
  if (dot <= 0 || dot === ref.length - 1) return null;
  return { diagramId: ref.slice(0, dot), nodeId: ref.slice(dot + 1) };
}

// ─── compilePipe ─────────────────────────────────────────────────────────────

/**
 * Compiles a single DiagramPipeDSL into a DiagramPipeState.
 * Resolves the from/to node positions from the compiled diagram states and
 * routes the pipe in canvas-local space.
 *
 * Emits console.warn for unresolvable references and returns a pipe with
 * empty controlPoints (rendered as invisible) rather than throwing.
 */
export function compilePipe(
  dsl: DiagramPipeDSL,
  diagrams: ReadonlyArray<DiagramState>,
  index: number,
): DiagramPipeState {
  const autoId = `pipe-${dsl.from.replace('.', '-')}--${dsl.to.replace('.', '-')}-${index}`;
  const id = dsl.id ?? autoId;

  const fromRef = parsePipeRef(dsl.from);
  const toRef = parsePipeRef(dsl.to);

  let controlPoints: ReadonlyArray<Vec3> = [];

  if (!fromRef || !toRef) {
    console.warn(
      `DiagramCanvas compilePipe: invalid dot-notation reference in pipe "${id}". ` +
        'Expected "diagramId.nodeId" format.',
    );
  } else {
    const fromDiagram = diagrams.find((d) => d.id === fromRef.diagramId);
    const toDiagram = diagrams.find((d) => d.id === toRef.diagramId);
    const fromNode = fromDiagram?.nodes.find((n) => n.id === fromRef.nodeId);
    const toNode = toDiagram?.nodes.find((n) => n.id === toRef.nodeId);

    if (!fromDiagram || !fromNode) {
      console.warn(
        `DiagramCanvas compilePipe: cannot resolve from="${dsl.from}" in pipe "${id}".`,
      );
    } else if (!toDiagram || !toNode) {
      console.warn(
        `DiagramCanvas compilePipe: cannot resolve to="${dsl.to}" in pipe "${id}".`,
      );
    } else {
      const fromWorld = nodeToCanvasSpace(
        fromNode.position,
        fromDiagram.position,
        fromDiagram.scale,
      );
      const toWorld = nodeToCanvasSpace(
        toNode.position,
        toDiagram.position,
        toDiagram.scale,
      );
      controlPoints = routePipe(fromWorld, toWorld);
    }
  }

  return {
    id,
    fromDiagramId: fromRef?.diagramId ?? '',
    fromNodeId: fromRef?.nodeId ?? '',
    toDiagramId: toRef?.diagramId ?? '',
    toNodeId: toRef?.nodeId ?? '',
    label: dsl.label,
    style: dsl.style ?? PIPE_DEFAULTS.style,
    arrowStart: dsl.arrowStart ?? PIPE_DEFAULTS.arrowStart,
    arrowEnd: dsl.arrowEnd ?? PIPE_DEFAULTS.arrowEnd,
    color: dsl.color ?? PIPE_DEFAULTS.color,
    thickness: dsl.thickness ?? PIPE_DEFAULTS.thickness,
    opacity: dsl.opacity ?? PIPE_DEFAULTS.opacity,
    controlPoints,
  };
}

// ─── compileCanvas ───────────────────────────────────────────────────────────

/**
 * Two-pass compilation for DiagramCanvas.
 * Pass 1: diagrams are already compiled (caller provides compiled DiagramState[]).
 * Pass 2: compile DiagramPipe elements using node positions from pass 1.
 *
 * This function is called by the DiagramCanvas compiler handler in handlers.ts
 * after it has compiled all child Diagram elements via compileDiagram().
 */
export function compileCanvas(
  dsl: DiagramCanvasDSL,
  diagrams: ReadonlyArray<DiagramState>,
  pipes: ReadonlyArray<DiagramPipeDSL>,
): DiagramCanvasState {
  const compiledPipes = pipes.map((pipe, index) => compilePipe(pipe, diagrams, index));

  return {
    id: dsl.id,
    position: dsl.position ?? [0, 0, 0],
    rotation: dsl.rotation ?? [0, 0, 0],
    scale: dsl.scale ?? 1,
    diagrams,
    pipes: compiledPipes,
  };
}

// ─── Functional Transition Spec ───────────────────────────────────────────────

const toMut = (v: readonly [number, number, number]): [number, number, number] =>
  [v[0], v[1], v[2]];

export const functionalDiagramCanvasTransitionSpec: FunctionalTransitionSpec<DiagramCanvasState> = {
  exitFn: (from) => (t) => ({
    ...from,
    diagrams: from.diagrams.map((d) => applyDiagramExit(d, t)),
    pipes: from.pipes.map((p) => ({
      ...p,
      opacity: blendOpacity(p.opacity, 0, t) ?? 0,
    })),
  }),

  enterFn: (to) => (t) => ({
    ...to,
    diagrams: to.diagrams.map((d) => applyDiagramEnter(d, t)),
    pipes: to.pipes.map((p) => ({
      ...p,
      opacity: blendOpacity(0, p.opacity, t) ?? p.opacity,
    })),
  }),

  interpolateFn: (from, to) => (t) => {
    const fromDiagramMap = new Map(from.diagrams.map((d) => [d.id, d]));
    const fromPipeMap = new Map(from.pipes.map((p) => [p.id, p]));
    const toPipeIds = new Set(to.pipes.map((p) => p.id));

    const interpolatedDiagrams = to.diagrams.map((toDiagram) => {
      const fromDiagram = fromDiagramMap.get(toDiagram.id);
      if (!fromDiagram) {
        return applyDiagramEnter(toDiagram, t);
      }
      const fromNodeMap = new Map(fromDiagram.nodes.map((n) => [n.id, n]));
      const toNodeIds = new Set(toDiagram.nodes.map((n) => n.id));
      const toEdgeIds = new Set(toDiagram.edges.map((e) => e.id));

      const blendedNodes = toDiagram.nodes.map((toNode) => {
        const fromNode = fromNodeMap.get(toNode.id);
        if (!fromNode) {
          return { ...toNode, opacity: blendOpacity(0, toNode.opacity, t) ?? toNode.opacity };
        }
        return {
          ...toNode,
          position: blendVec3(toMut(fromNode.position), toMut(toNode.position), t) ?? toNode.position,
          opacity: blendOpacity(fromNode.opacity, toNode.opacity, t) ?? toNode.opacity,
        };
      });
      const fadingNodes = fromDiagram.nodes
        .filter((n) => !toNodeIds.has(n.id))
        .map((n) => ({ ...n, opacity: blendOpacity(n.opacity, 0, t) ?? 0 }));

      // Re-route edges using live interpolated node positions (same strategy as
      // functionalDiagramTransitionSpec.interpolateFn) so tubes track moving nodes.
      const livePositions = new Map<string, readonly [number, number, number]>();
      const liveSizes = new Map<string, readonly [number, number, number]>();
      [...blendedNodes, ...fadingNodes].forEach((n) => {
        livePositions.set(n.id, n.position);
        liveSizes.set(n.id, [n.size[0], n.size[1], n.depth]);
      });
      const allEdgeDSLs = [
        ...toDiagram.edges.map((e) => ({ id: e.id, from: e.fromId, to: e.toId })),
        ...fromDiagram.edges
          .filter((e) => !toEdgeIds.has(e.id))
          .map((e) => ({ id: e.id, from: e.fromId, to: e.toId })),
      ];
      const liveEdgePoints = routeEdges(allEdgeDSLs, livePositions, liveSizes);

      const fromEdgeMap = new Map(fromDiagram.edges.map((e) => [e.id, e]));
      const blendedEdges = toDiagram.edges.map((toEdge) => {
        const fromEdge = fromEdgeMap.get(toEdge.id);
        return {
          ...toEdge,
          opacity: fromEdge
            ? blendOpacity(fromEdge.opacity, toEdge.opacity, t) ?? toEdge.opacity
            : blendOpacity(0, toEdge.opacity, t) ?? toEdge.opacity,
          controlPoints: liveEdgePoints.get(toEdge.id) ?? toEdge.controlPoints,
        };
      });
      const fadingEdges = fromDiagram.edges
        .filter((e) => !toEdgeIds.has(e.id))
        .map((e) => ({
          ...e,
          opacity: blendOpacity(e.opacity, 0, t) ?? 0,
          controlPoints: liveEdgePoints.get(e.id) ?? e.controlPoints,
        }));

      return {
        ...toDiagram,
        position: blendVec3(toMut(fromDiagram.position), toMut(toDiagram.position), t) ?? toDiagram.position,
        rotation: blendVec3(toMut(fromDiagram.rotation), toMut(toDiagram.rotation), t) ?? toDiagram.rotation,
        scale: blendNumber(fromDiagram.scale, toDiagram.scale, t) ?? toDiagram.scale,
        nodes: [...blendedNodes, ...fadingNodes],
        edges: [...blendedEdges, ...fadingEdges],
      };
    });

    const fadingDiagrams = from.diagrams
      .filter((d) => !to.diagrams.some((td) => td.id === d.id))
      .map((d) => applyDiagramExit(d, t));

    // Build canvas-local node position map from ALL interpolated + fading diagrams.
    // Used to re-route cross-diagram pipes so they track moving endpoint nodes.
    const canvasNodePosMap = new Map<string, readonly [number, number, number]>();
    for (const diagram of [...interpolatedDiagrams, ...fadingDiagrams]) {
      for (const node of diagram.nodes) {
        const canvasPos: readonly [number, number, number] = [
          node.position[0] * diagram.scale + diagram.position[0],
          node.position[1] * diagram.scale + diagram.position[1],
          node.position[2] * diagram.scale + diagram.position[2],
        ];
        canvasNodePosMap.set(`${diagram.id}.${node.id}`, canvasPos);
      }
    }

    const blendedPipes = to.pipes.map((toPipe) => {
      const fromPipe = fromPipeMap.get(toPipe.id);
      // Re-route pipe using live canvas-space endpoint positions.
      const fromPos = canvasNodePosMap.get(`${toPipe.fromDiagramId}.${toPipe.fromNodeId}`);
      const toPos = canvasNodePosMap.get(`${toPipe.toDiagramId}.${toPipe.toNodeId}`);
      const liveControlPoints = (fromPos && toPos)
        ? routePipe(fromPos, toPos)
        : toPipe.controlPoints;
      return {
        ...toPipe,
        opacity: fromPipe
          ? blendOpacity(fromPipe.opacity, toPipe.opacity, t) ?? toPipe.opacity
          : blendOpacity(0, toPipe.opacity, t) ?? toPipe.opacity,
        controlPoints: liveControlPoints,
      };
    });
    const fadingPipes = from.pipes
      .filter((p) => !toPipeIds.has(p.id))
      .map((p) => {
        const fromPos = canvasNodePosMap.get(`${p.fromDiagramId}.${p.fromNodeId}`);
        const toPos = canvasNodePosMap.get(`${p.toDiagramId}.${p.toNodeId}`);
        const liveControlPoints = (fromPos && toPos) ? routePipe(fromPos, toPos) : p.controlPoints;
        return { ...p, opacity: blendOpacity(p.opacity, 0, t) ?? 0, controlPoints: liveControlPoints };
      });

    return {
      ...to,
      position: blendVec3(toMut(from.position), toMut(to.position), t) ?? to.position,
      rotation: blendVec3(toMut(from.rotation), toMut(to.rotation), t) ?? to.rotation,
      scale: blendNumber(from.scale, to.scale, t) ?? to.scale,
      diagrams: [...interpolatedDiagrams, ...fadingDiagrams],
      pipes: [...blendedPipes, ...fadingPipes],
    };
  },
};
