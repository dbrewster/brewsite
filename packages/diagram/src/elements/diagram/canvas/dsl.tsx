// Declarative DSL surface for DiagramCanvas and DiagramPipe. No Three.js.

import React from 'react';
import type { DiagramEdgeStyle, DiagramArrowVariant, DiagramTheme } from '../types';
import type { PipeRoutingAlgorithm, PipeLandingAlgorithm } from './types';

export interface DiagramCanvasProps {
  /**
   * Unique ID for this canvas. The DiagramCanvasWidget must be registered
   * with this exact id in widgetSetup.ts.
   */
  id: string;
  /** World-space position of the canvas group origin. Default: [0, 0, 0] */
  position?: [number, number, number];
  /** World-space Euler XYZ rotation in radians. Default: [0, 0, 0] */
  rotation?: [number, number, number];
  /**
   * Uniform scale for the entire canvas group.
   * All child diagram positions, scales, and pipe thicknesses scale with this.
   * Default: 1
   */
  scale?: number;
  /**
   * Canvas-level theme. Acts as the default theme for all child <Diagram>
   * elements. Each child can override with its own `theme` prop.
   * Falls back to darkGlassTheme when absent.
   *
   * @example
   * import { darkGlassTheme, lightMinimalTheme, enterpriseTheme, neonCyberTheme } from '@brewsite/diagram';
   */
  theme?: DiagramTheme;
  /**
   * Pipe routing algorithm for cross-diagram connectors. Default: 'curved'.
   */
  pipeRouting?: PipeRoutingAlgorithm;
  /**
   * Pipe attachment strategy. Default: 'sides' (left/right face based on
   * relative diagram X position — routes around front-face icons/labels).
   */
  pipeLanding?: PipeLandingAlgorithm;
  /**
   * Optional world-space center used when canvas focus action targets the full
   * canvas (for example Cmd+click empty area).
   */
  focusCenter?: [number, number] | [number, number, number];
  children?: React.ReactNode;
}

/**
 * Root container for a multi-diagram composition.
 * Provides a shared world-space transform and enables cross-diagram pipes.
 * Child <Diagram> elements use canvas-local coordinates.
 * Child <DiagramPipe> elements connect nodes across child diagrams.
 *
 * Compilation: two-pass (diagrams first, then pipes).
 * Rendering: single DiagramCanvasWidget owns all child diagrams and pipes.
 *
 * Example:
 *   <DiagramCanvas id="system" scale={0.01}>
 *     <Diagram id="frontend" position={[-600, 0, 0]}>...</Diagram>
 *     <Diagram id="backend" position={[600, 0, 0]}>...</Diagram>
 *     <DiagramPipe from="frontend.api" to="backend.gateway" />
 *   </DiagramCanvas>
 */
export function DiagramCanvas(_props: DiagramCanvasProps): null {
  return null;
}

export interface DiagramPipeProps {
  /**
   * Auto-generated id if omitted: "from--to" (dots replaced by dashes).
   */
  id?: string;
  /**
   * Source node in dot notation: "diagramId.nodeId"
   * The diagramId must match a <Diagram id="..."> sibling inside this canvas.
   */
  from: string;
  /**
   * Destination node in dot notation: "diagramId.nodeId"
   */
  to: string;
  /** Optional label at the pipe midpoint. */
  label?: string;
  /** Line visual style. Default: 'solid' */
  style?: DiagramEdgeStyle;
  /** Arrowhead at source. Default: 'none' */
  arrowStart?: DiagramArrowVariant;
  /** Arrowhead at destination. Default: 'open' */
  arrowEnd?: DiagramArrowVariant;
  /** Pipe color (CSS hex). Default: DIAGRAM_PIPE_DEFAULT_COLOR */
  color?: string;
  /** Tube radius in canvas units. Default: 0.08 */
  thickness?: number;
  /** Opacity [0–1]. Default: 1 */
  opacity?: number;
}

/**
 * Declares a tube connector between nodes in two different <Diagram> elements
 * inside the same <DiagramCanvas>.
 * Must be a direct child of <DiagramCanvas>.
 *
 * Routing: CatmullRom arc in canvas-local space, computed at compile time.
 * The pipe is rendered by DiagramCanvasWidget alongside the diagram tubes.
 */
export function DiagramPipe(_props: DiagramPipeProps): null {
  return null;
}
