// Contract layer for DiagramCanvas and DiagramPipe.
// No runtime imports, no Three.js, no React.

import type { DiagramState, DiagramEdgeStyle, DiagramArrowVariant } from '../types';

/**
 * Compiled state of a single cross-diagram pipe (tube connector).
 * Control points are in canvas-local space.
 * Produced by compilePipe() from DiagramPipeDSL.
 */
export interface DiagramPipeState {
  readonly id: string;
  /** ID of the diagram containing the source node */
  readonly fromDiagramId: string;
  /** ID of the source node within fromDiagramId */
  readonly fromNodeId: string;
  /** ID of the diagram containing the destination node */
  readonly toDiagramId: string;
  /** ID of the destination node within toDiagramId */
  readonly toNodeId: string;
  readonly label: string | undefined;
  readonly style: DiagramEdgeStyle;
  readonly arrowStart: DiagramArrowVariant;
  readonly arrowEnd: DiagramArrowVariant;
  readonly color: string;
  readonly thickness: number;
  readonly opacity: number;
  /**
   * CatmullRom control points in canvas-local space.
   * Computed at compile time from the endpoint node positions and diagram transforms.
   */
  readonly controlPoints: ReadonlyArray<readonly [number, number, number]>;
}

/**
 * Fully compiled state of a DiagramCanvas.
 * Owns all child diagram states and cross-diagram pipes.
 * Consumed by DiagramCanvasWidget and DiagramCanvasRenderer.
 */
export interface DiagramCanvasState {
  readonly id: string;
  /** Canvas world-space position. Default: [0, 0, 0] */
  readonly position: readonly [number, number, number];
  /** Canvas world-space Euler XYZ rotation in radians. Default: [0, 0, 0] */
  readonly rotation: readonly [number, number, number];
  /** Canvas uniform scale. Default: 1 */
  readonly scale: number;
  /** All child diagram states, in declaration order. */
  readonly diagrams: ReadonlyArray<DiagramState>;
  /** All cross-diagram pipe states. */
  readonly pipes: ReadonlyArray<DiagramPipeState>;
}

/** Raw DSL props from <DiagramPipe> before compile.ts applies defaults. */
export interface DiagramPipeDSL {
  /**
   * Auto-generated from "fromDiagramId-fromNodeId--toDiagramId-toNodeId" if omitted.
   */
  readonly id?: string;
  /**
   * Dot-notation reference to the source node: "diagramId.nodeId"
   * The diagramId must match a <Diagram id="..."> inside the same <DiagramCanvas>.
   */
  readonly from: string;
  /** Dot-notation reference to the destination node: "diagramId.nodeId" */
  readonly to: string;
  readonly label?: string;
  readonly style?: DiagramEdgeStyle;
  readonly arrowStart?: DiagramArrowVariant;
  readonly arrowEnd?: DiagramArrowVariant;
  readonly color?: string;
  readonly thickness?: number;
  readonly opacity?: number;
}

/** Raw DSL props from <DiagramCanvas> before compile.ts applies defaults. */
export interface DiagramCanvasDSL {
  readonly id: string;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
}
