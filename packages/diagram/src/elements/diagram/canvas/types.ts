// Contract layer for DiagramCanvas and DiagramPipe.
// No runtime imports, no Three.js, no React.

import type { DiagramState, DiagramEdgeStyle, DiagramArrowVariant, DiagramTheme } from '../types';
import type { InputActionSpec, NVSRect } from '@brewsite/core';

/** Default pipe color used by compile.ts and documented on the DSL. */
export const DIAGRAM_PIPE_DEFAULT_COLOR = '#3d5a9a';

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

  /**
   * NVS bounds — authoritative for scissor rect and aspect ratio.
   * Fullscreen: { x: 0, y: 0, w: 1, h: 1 }.
   * Always present; filled with defaults by compileCanvas().
   */
  readonly nvsBounds: NVSRect;

  /**
   * Pitch tilt in radians applied to the diagram group geometry.
   * Negative = top edge tilts away from viewer. Default: 0.
   */
  readonly tilt: number;

  /** World-space uniform geometry scale. Default: 1. */
  readonly scale: number;

  /**
   * Fractional framing inset for the auto-fit private camera. Default: 0.1.
   */
  readonly padding: number;

  /**
   * Optional focus center in canvas-local space (XY).
   * When provided, focusAll() uses this as the camera look-at target
   * instead of the geometry bounding box center.
   */
  readonly focusCenter?: readonly [number, number] | readonly [number, number, number];

  /** All child diagram states, in declaration order. */
  readonly diagrams: ReadonlyArray<DiagramState>;

  /** All cross-diagram pipe states. */
  readonly pipes: ReadonlyArray<DiagramPipeState>;

  /**
   * Default input actions derived from theme.input at compile time.
   * Consumed by DiagramCanvasWidget.getDefaultInputActions() at runtime.
   */
  readonly defaultInputActions?: ReadonlyArray<InputActionSpec>;
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

/**
 * Pipe routing algorithm for cross-diagram pipes within a canvas.
 * 'curved'   — CatmullRom arc through 3D canvas space (default)
 * 'straight' — direct line between side-face attachment points
 */
export type PipeRoutingAlgorithm = 'curved' | 'straight';

/**
 * Pipe attachment strategy for cross-diagram connectors.
 * 'sides'        — attach to left or right face based on relative diagram X position (default)
 * 'nearest-face' — use the same nearest-face logic as intra-diagram edges
 */
export type PipeLandingAlgorithm = 'sides' | 'nearest-face';

/** Raw DSL props from <DiagramCanvas> in the NVS model. */
export interface DiagramCanvasDSL {
  readonly id: string;

  // ── Placement (NVS coordinates, top-left origin) ──────────────────────────
  /** NVS x-coordinate of the canvas left edge [0, 1]. Default: 0 */
  readonly x?: number;
  /** NVS y-coordinate of the canvas top edge [0, 1]. Default: 0 */
  readonly y?: number;
  /** NVS width of the canvas [0, 1]. Default: 1 */
  readonly w?: number;
  /** NVS height of the canvas [0, 1]. Default: 1 */
  readonly h?: number;

  // ── Geometry ──────────────────────────────────────────────────────────────
  /**
   * Pitch tilt applied to the diagram group geometry in radians.
   * Negative values tilt the top edge away from the viewer (typical 3D effect).
   * Default: 0 (flat, facing camera).
   */
  readonly tilt?: number;
  /**
   * World-space uniform geometry scale. The auto-fit private camera responds
   * naturally — larger geometry, camera backs up proportionally. Default: 1.
   */
  readonly scale?: number;
  /**
   * Fractional framing inset for the auto-fit private camera around the content
   * bounding box. 0 = tight crop, 0.1 = 10% margin. Default: 0.1.
   */
  readonly padding?: number;

  // ── Other ─────────────────────────────────────────────────────────────────
  /** Canvas-level theme. Propagated as default theme to all child diagrams. */
  readonly theme?: DiagramTheme;
  /** Cross-diagram pipe routing algorithm. Default: 'curved'. */
  readonly pipeRouting?: PipeRoutingAlgorithm;
  /** Pipe attachment strategy. Default: 'sides'. */
  readonly pipeLanding?: PipeLandingAlgorithm;
  /** Optional default focus center in canvas-local space (XY). */
  readonly focusCenter?: readonly [number, number] | readonly [number, number, number];
  /**
   * Default input actions derived from theme.input at compile time.
   * Consumed by DiagramCanvasWidget.getDefaultInputActions() at runtime.
   * Undefined when no theme.input is configured on the canvas.
   */
  readonly defaultInputActions?: ReadonlyArray<InputActionSpec>;
}
