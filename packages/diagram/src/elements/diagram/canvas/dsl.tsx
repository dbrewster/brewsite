// Declarative DSL surface for DiagramCanvas and DiagramPipe. No Three.js.

import React from 'react';
import type { DiagramEdgeStyle, DiagramArrowVariant, DiagramTheme } from '../types';
import type { PipeRoutingAlgorithm, PipeLandingAlgorithm } from './types';

export interface DiagramCanvasProps {
  /**
   * Unique ID for this canvas.
   * When using `diagramPlugin()`, a `DiagramCanvasWidget` is automatically
   * created for this ID during scene compilation.
   */
  id: string;
  // ── Placement ──────────────────────────────────────────────────────────────
  /** NVS x-coordinate of the canvas left edge [0, 1]. Default: 0 */
  x?: number;
  /** NVS y-coordinate of the canvas top edge [0, 1]. Default: 0 */
  y?: number;
  /** NVS width of the canvas [0, 1]. Default: 1 */
  w?: number;
  /** NVS height of the canvas [0, 1]. Default: 1 */
  h?: number;
  // ── Geometry ───────────────────────────────────────────────────────────────
  /**
   * Pitch tilt applied to the diagram group geometry in radians.
   * Negative values tilt the top edge away from the viewer (typical 3D effect).
   * Default: 0 (flat, facing camera).
   */
  tilt?: number;
  /**
   * Uniform scale for the entire canvas group.
   * All child diagram positions, scales, and pipe thicknesses scale with this.
   * Default: 1
   */
  scale?: number;
  /**
   * Fractional framing inset for the auto-fit private camera around the content
   * bounding box. 0 = tight crop, 0.1 = 10% margin. Default: 0.1.
   */
  padding?: number;
  // ── Other ──────────────────────────────────────────────────────────────────
  /**
   * Canvas-level theme. Acts as the fallback theme for all child `<Diagram>`
   * elements that do not specify their own `theme` prop.
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
   * Optional canvas-local center used when canvas focus action targets the full
   * canvas (for example Cmd+click empty area).
   */
  focusCenter?: readonly [number, number] | readonly [number, number, number];
  children?: React.ReactNode;
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


