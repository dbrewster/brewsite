// Pure compilation pipeline for DiagramCanvas.
// No Three.js. No React. No side effects.

import type { DiagramState, DiagramEdgeStyle, DiagramArrowVariant, DiagramWarnFn } from '../types';
import type {
  DiagramCanvasDSL,
  DiagramCanvasState,
  DiagramPipeDSL,
  DiagramPipeState,
  PipeRoutingAlgorithm,
  PipeLandingAlgorithm,
} from './types';
import type { InputActionSpec, NVSRect } from '@brewsite/core';
import { DIAGRAM_PIPE_DEFAULT_COLOR } from './types';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { blendNumber, blendOpacity, blendVec3 } from '@brewsite/core';
import { applyDiagramEnter, applyDiagramExit } from '../compile';
import { blendDiagramNodes, buildLiveNodeMaps, rerouteLiveEdges, blendDiagramEdges } from '../compiler/transitionHelpers';
import { sideAttachmentPoint, routePipe, rerouteLivePipes, nodeNvsToCanvasLocal } from './compiler/pipeRouter';

const lerpNum = (a: number, b: number, t: number): number => a + (b - a) * t;

// ─── Defaults ────────────────────────────────────────────────────────────────

const PIPE_DEFAULTS = {
  style: 'solid' as DiagramEdgeStyle,
  arrowStart: 'none' as DiagramArrowVariant,
  arrowEnd: 'open' as DiagramArrowVariant,
  color: DIAGRAM_PIPE_DEFAULT_COLOR,
  thickness: 0.08,
  opacity: 1,
};

const DEFAULT_PIPE_ROUTING: PipeRoutingAlgorithm = 'curved';
const DEFAULT_PIPE_LANDING: PipeLandingAlgorithm = 'sides';

// ─── Pipe routing ─────────────────────────────────────────────────────────────

type Vec3 = readonly [number, number, number];

// nodeNvsToCanvasLocal, sideAttachmentPoint, routePipe, DEFAULT_CANVAS_ASPECT live in canvas/compiler/pipeRouter.ts

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
 * With pipeLanding='sides' (default), attaches to the left or right face of
 * each node based on which side faces the target diagram, routing around the
 * front-face icons and labels.
 *
 * Emits console.warn for unresolvable references and returns a pipe with
 * empty controlPoints (rendered as invisible) rather than throwing.
 */
export function compilePipe(
  dsl: DiagramPipeDSL,
  diagrams: ReadonlyArray<DiagramState>,
  index: number,
  routing: PipeRoutingAlgorithm = DEFAULT_PIPE_ROUTING,
  landing: PipeLandingAlgorithm = DEFAULT_PIPE_LANDING,
  onWarn?: DiagramWarnFn,
  canvasAspect: number = 16 / 9,
): DiagramPipeState {
  const autoId = `pipe-${dsl.from.replace('.', '-')}--${dsl.to.replace('.', '-')}-${index}`;
  const id = dsl.id ?? autoId;

  const fromRef = parsePipeRef(dsl.from);
  const toRef = parsePipeRef(dsl.to);

  let controlPoints: ReadonlyArray<Vec3> = [];

  if (!fromRef || !toRef) {
    const bad = !fromRef ? dsl.from : dsl.to;
    onWarn?.(
      'INVALID_PIPE_REF',
      `<DiagramPipe id="${id}">: "${bad}" is not valid dot notation. ` +
        `Expected "diagramId.nodeId" (e.g. "frontend.api"). ` +
        `Both diagramId and nodeId must be non-empty.`,
    );
  } else {
    const fromDiagram = diagrams.find((d) => d.id === fromRef.diagramId);
    const toDiagram = diagrams.find((d) => d.id === toRef.diagramId);
    const fromNode = fromDiagram?.nodes.find((n) => n.id === fromRef.nodeId);
    const toNode = toDiagram?.nodes.find((n) => n.id === toRef.nodeId);

    if (!fromDiagram || !fromNode) {
      const missingPart = !fromDiagram ? `diagram "${fromRef.diagramId}"` : `node "${fromRef.nodeId}" in diagram "${fromRef.diagramId}"`;
      onWarn?.(
        'MISSING_PIPE_ENDPOINT',
        `<DiagramPipe id="${id}"> from="${dsl.from}": could not resolve ${missingPart}. ` +
          `Check that the diagram id and node id both exactly match a child <Diagram id="..."> ` +
          `and its <DiagramNode id="...">.`,
      );
    } else if (!toDiagram || !toNode) {
      const missingPart = !toDiagram ? `diagram "${toRef.diagramId}"` : `node "${toRef.nodeId}" in diagram "${toRef.diagramId}"`;
      onWarn?.(
        'MISSING_PIPE_ENDPOINT',
        `<DiagramPipe id="${id}"> to="${dsl.to}": could not resolve ${missingPart}. ` +
          `Check that the diagram id and node id both exactly match a child <Diagram id="..."> ` +
          `and its <DiagramNode id="...">.`,
      );
    } else {
      if (landing === 'sides') {
        // Side-based attachment: exit from the left or right face of each node,
        // determined by which side faces the target diagram. This routes around
        // icons and labels on the front (+Z) face.
        const fromAttach = sideAttachmentPoint(
          fromNode.position,
          fromNode.size,
          fromNode.thickness,
          fromDiagram.viewportBounds,
          fromDiagram.tiltRotation,
          canvasAspect,
          nodeNvsToCanvasLocal(toNode.position, toDiagram.viewportBounds, toDiagram.tiltRotation, canvasAspect),
        );
        const toAttach = sideAttachmentPoint(
          toNode.position,
          toNode.size,
          toNode.thickness,
          toDiagram.viewportBounds,
          toDiagram.tiltRotation,
          canvasAspect,
          nodeNvsToCanvasLocal(fromNode.position, fromDiagram.viewportBounds, fromDiagram.tiltRotation, canvasAspect),
        );
        controlPoints = routePipe(fromAttach.point, toAttach.point, fromAttach.normal, toAttach.normal, routing);
      } else {
        // 'nearest-face': use node centers (legacy behaviour)
        const fromWorld = nodeNvsToCanvasLocal(fromNode.position, fromDiagram.viewportBounds, fromDiagram.tiltRotation, canvasAspect);
        const toWorld   = nodeNvsToCanvasLocal(toNode.position,   toDiagram.viewportBounds,   toDiagram.tiltRotation,   canvasAspect);
        controlPoints = routePipe(fromWorld, toWorld, undefined, undefined, routing);
      }
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
  onWarn?: DiagramWarnFn,
  defaultInputActions?: ReadonlyArray<InputActionSpec>,
  canvasAspect?: number,
): DiagramCanvasState {
  const pipeRouting = dsl.pipeRouting ?? DEFAULT_PIPE_ROUTING;
  const pipeLanding = dsl.pipeLanding ?? DEFAULT_PIPE_LANDING;

  const nvsBounds: NVSRect = {
    x: dsl.x ?? 0,
    y: dsl.y ?? 0,
    w: dsl.w ?? 1,
    h: dsl.h ?? 1,
  };

  if (process.env.NODE_ENV !== 'production') {
    const { x, y, w, h } = nvsBounds;
    if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1 || y + h > 1) {
      console.error(
        `[DiagramCanvas] nvsBounds out of [0..1]: ${JSON.stringify(nvsBounds)}. ` +
          `DiagramCanvas id="${dsl.id}". All components must satisfy: ` +
          `x≥0, y≥0, w>0, h>0, x+w≤1, y+h≤1.`,
      );
    }
  }

  const ENGINE_ASPECT_DEFAULT = 16 / 9;
  const effectiveCanvasAspect = canvasAspect ?? (nvsBounds.w / nvsBounds.h) * ENGINE_ASPECT_DEFAULT;

  const compiledPipes = pipes.map((pipe, index) =>
    compilePipe(pipe, diagrams, index, pipeRouting, pipeLanding, onWarn, effectiveCanvasAspect),
  );

  return {
    id: dsl.id,
    nvsBounds,
    tilt: dsl.tilt ?? 0,
    scale: dsl.scale ?? 1,
    padding: dsl.padding ?? 0.1,
    focusCenter: dsl.focusCenter,
    diagrams,
    pipes: compiledPipes,
    defaultInputActions,
  };
}

// ─── Functional Transition Spec ───────────────────────────────────────────────

const toMut = (v: readonly [number, number, number]): [number, number, number] =>
  [v[0], v[1], v[2]];

/**
 * Functional transition spec for DiagramCanvasState.
 * Uses ctx.t for all properties (zero behavior change from old scalar-t path).
 * Scene authors may add <Transition channels={['opacity']} ...> children to the
 * <DiagramCanvas> DSL element to activate per-channel window/ease control.
 */
export const functionalDiagramCanvasTransitionSpec: FunctionalTransitionSpec<DiagramCanvasState> = {
  exitFn: (from) => (ctx) => ({
    ...from,
    diagrams: from.diagrams.map((d) => applyDiagramExit(d, ctx.t)),
    pipes: from.pipes.map((p) => ({
      ...p,
      opacity: blendOpacity(p.opacity, 0, ctx.t) ?? 0,
    })),
  }),

  enterFn: (to) => (ctx) => ({
    ...to,
    diagrams: to.diagrams.map((d) => applyDiagramEnter(d, ctx.t)),
    pipes: to.pipes.map((p) => ({
      ...p,
      opacity: blendOpacity(0, p.opacity, ctx.t) ?? p.opacity,
    })),
  }),

  interpolateFn: (from, to) => (ctx) => {
    const t = ctx.t;
    const fromDiagramMap = new Map(from.diagrams.map((d) => [d.id, d]));
    const fromPipeMap = new Map(from.pipes.map((p) => [p.id, p]));
    const toPipeIds = new Set(to.pipes.map((p) => p.id));

    const interpolatedDiagrams = to.diagrams.map((toDiagram) => {
      const fromDiagram = fromDiagramMap.get(toDiagram.id);
      if (!fromDiagram) {
        return applyDiagramEnter(toDiagram, t);
      }
      const { blended, fading } = blendDiagramNodes(fromDiagram.nodes, toDiagram.nodes, t);
      const { positions, sizes } = buildLiveNodeMaps([...blended, ...fading]);
      const toEdgeIds = new Set(toDiagram.edges.map((e) => e.id));
      const livePoints = rerouteLiveEdges(toDiagram.edges, fromDiagram.edges, toEdgeIds, positions, sizes);
      const { blended: blendedEdges, fading: fadingEdges } = blendDiagramEdges(
        fromDiagram.edges,
        toDiagram.edges,
        livePoints,
        t,
      );

      return {
        ...toDiagram,
        viewportBounds: {
          x: lerpNum(fromDiagram.viewportBounds.x, toDiagram.viewportBounds.x, t),
          y: lerpNum(fromDiagram.viewportBounds.y, toDiagram.viewportBounds.y, t),
          w: lerpNum(fromDiagram.viewportBounds.w, toDiagram.viewportBounds.w, t),
          h: lerpNum(fromDiagram.viewportBounds.h, toDiagram.viewportBounds.h, t),
        },
        tiltRotation: blendVec3(toMut(fromDiagram.tiltRotation), toMut(toDiagram.tiltRotation), t) ?? toDiagram.tiltRotation,
        nodes: [...blended, ...fading],
        edges: [...blendedEdges, ...fadingEdges],
      };
    });

    const fadingDiagrams = from.diagrams
      .filter((d) => !to.diagrams.some((td) => td.id === d.id))
      .map((d) => applyDiagramExit(d, t));

    const ENGINE_ASPECT_DEFAULT = 16 / 9;
    const canvasAspect = (to.nvsBounds.w / to.nvsBounds.h) * ENGINE_ASPECT_DEFAULT;

    const livePipePoints = rerouteLivePipes(
      [...to.pipes, ...from.pipes.filter((p) => !toPipeIds.has(p.id))],
      [...interpolatedDiagrams, ...fadingDiagrams],
      DEFAULT_PIPE_ROUTING,
      DEFAULT_PIPE_LANDING,
      canvasAspect,
    );

    const blendedPipes = to.pipes.map((toPipe) => {
      const fromPipe = fromPipeMap.get(toPipe.id);
      return {
        ...toPipe,
        opacity: fromPipe
          ? blendOpacity(fromPipe.opacity, toPipe.opacity, t) ?? toPipe.opacity
          : blendOpacity(0, toPipe.opacity, t) ?? toPipe.opacity,
        controlPoints: livePipePoints.get(toPipe.id) ?? toPipe.controlPoints,
      };
    });
    const fadingPipes = from.pipes
      .filter((p) => !toPipeIds.has(p.id))
      .map((p) => ({
        ...p,
        opacity: blendOpacity(p.opacity, 0, t) ?? 0,
        controlPoints: livePipePoints.get(p.id) ?? p.controlPoints,
      }));

    return {
      ...to,
      tilt: blendNumber(from.tilt, to.tilt, t) ?? to.tilt,
      scale: blendNumber(from.scale, to.scale, t) ?? to.scale,
      padding: blendNumber(from.padding, to.padding, t) ?? to.padding,
      nvsBounds: {
        x: lerpNum(from.nvsBounds.x, to.nvsBounds.x, t),
        y: lerpNum(from.nvsBounds.y, to.nvsBounds.y, t),
        w: lerpNum(from.nvsBounds.w, to.nvsBounds.w, t),
        h: lerpNum(from.nvsBounds.h, to.nvsBounds.h, t),
      },
      diagrams: [...interpolatedDiagrams, ...fadingDiagrams],
      pipes: [...blendedPipes, ...fadingPipes],
    };
  },
};
