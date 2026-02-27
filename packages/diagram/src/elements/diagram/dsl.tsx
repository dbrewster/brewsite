// Declarative DSL surface for diagram authoring. No Three.js. No compiler internals.

import React from 'react';
import type { DiagramShapeVariant } from './shapes/shapeVariants';
import type {
  DiagramEdgeStyle,
  DiagramArrowVariant,
  DiagramEdgeFlow,
  DiagramGroupVariant,
  DiagramOrientation,
  DiagramPivot,
  DiagramEasing,
  SvgIcon3DStyle,
  DiagramTheme,
  EdgeRoutingAlgorithm,
  DiagramEdgePort,
} from './types';

// ─── <DiagramNode> ────────────────────────────────────────────────────────────

export interface DiagramNodeProps {
  /** Unique ID within the diagram */
  id: string;
  /**
   * Primary label text.
   * Optional for ghost/partial-update nodes in later scenes that inherit their
   * full state from the previous scene's compiled DiagramNodeState.
   * Omitting label on a node that has no prior state results in an empty label.
   */
  label?: string;
  /** Secondary label text below primary */
  sublabel?: string;
  /**
   * Shape variant. Determines both geometry type and icon asset.
   * Defaults to 'flow:rect'.
   */
  shape?: DiagramShapeVariant;
  /**
   * World-space position [x, y, z].
   * z controls depth — use for drill-down animations.
   * If omitted, auto-layout assigns a position based on declaration order.
   */
  position?: [number, number, number];
  /** Node width and height in diagram units. Default: [4, 2] */
  size?: [number, number];
  /** Physical box depth. Default: 0.4 */
  depth?: number;
  /** Face color (CSS hex). Default: '#2a2d3e' (dark slate) */
  color?: string;
  /** Side/edge color (CSS hex). Default: derives from color (darker) */
  sideColor?: string;
  /** Border outline color (CSS hex). Default: derives from color (lighter) */
  borderColor?: string;
  /** Surface metalness [0–1]. Default: from theme (darkGlass: 0.40) */
  metalness?: number;
  /** Surface roughness [0–1]. Default: from theme (darkGlass: 0.30) */
  roughness?: number;
  /** Emissive intensity on front face [0–1]. Default: from theme (darkGlass: 0.10) */
  emissiveIntensity?: number;
  /** Corner radius in diagram units for rect shapes. Default: from theme (darkGlass: 0.06) */
  cornerRadius?: number;
  /** Label text color (CSS hex). Default: from theme */
  labelColor?: string;
  /** Sublabel text color (CSS hex). Default: '#a0a8c0' */
  sublabelColor?: string;
  /** Node opacity [0–1]. Default: 1 */
  opacity?: number;
  /** Whether node responds to click/raycast. Default: false */
  clickable?: boolean;
  /** Whether node is rendered. Default: true */
  enabled?: boolean;
  /** Icon scale relative to node face [0–1]. Default: 0.6 */
  iconScale?: number;
  /**
   * 3D rendering style for the icon on this node's front face.
   * Default: 'flat' — unchanged from current behaviour.
   * 'layered' is the most visually impactful for AWS/GCP cloud icons.
   */
  iconStyle?: SvgIcon3DStyle;
  /**
   * Max Z extrusion depth for 3D icon geometry in diagram units.
   * Default: 0.15. Sensible range: 0.05–0.25.
   */
  iconDepth?: number;
}

/**
 * Declares a diagram node (shape with label).
 * Must be a direct or indirect child of <Diagram>.
 * Can be nested inside <DiagramGroup> to establish group membership.
 */
export function DiagramNode(_props: DiagramNodeProps): null {
  return null;
}

// ─── <DiagramEdge> ────────────────────────────────────────────────────────────

export interface DiagramEdgeProps {
  /** Unique ID within the diagram */
  id?: string;
  /** ID of the source node */
  from: string;
  /** ID of the destination node */
  to: string;
  /** Label displayed at edge midpoint */
  label?: string;
  /** Line visual style. Default: 'solid' */
  style?: DiagramEdgeStyle;
  /** Arrowhead at source end. Default: 'none' */
  arrowStart?: DiagramArrowVariant;
  /** Arrowhead at destination end. Default: 'open' */
  arrowEnd?: DiagramArrowVariant;
  /** Optional flow animation direction */
  flow?: DiagramEdgeFlow;
  /** Optional flow pulse color (defaults to edge color) */
  flowColor?: string;
  /** Edge color (CSS hex). Default: from theme */
  color?: string;
  /** Tube radius in diagram units. Default: from theme */
  thickness?: number;
  /** Edge opacity [0–1]. Default: 1 */
  opacity?: number;
  /**
   * Per-edge routing algorithm. Overrides the diagram theme's default routing.
   * Useful for mixing curved and orthogonal edges in the same diagram.
   */
  routing?: EdgeRoutingAlgorithm;
  /**
   * Explicit attachment port at the source node (requires landing: 'port' or
   * automatically enables port landing for this edge).
   */
  fromPort?: DiagramEdgePort;
  /**
   * Explicit attachment port at the destination node.
   */
  toPort?: DiagramEdgePort;
}

/**
 * Declares a directed connector between two diagram nodes.
 * Must be a direct or indirect child of <Diagram>.
 */
export function DiagramEdge(_props: DiagramEdgeProps): null {
  return null;
}

// ─── <DiagramGroup> ───────────────────────────────────────────────────────────

export interface DiagramGroupProps {
  /** Unique ID within the diagram */
  id: string;
  /** Group header label */
  label: string;
  /** Group visual variant. Default: 'boundary' */
  variant?: DiagramGroupVariant;
  /** Swimlane orientation (only for variant='swimlane'). Default: 'vertical' */
  orientation?: DiagramOrientation;
  /** Fill color (CSS hex). Default: '#1a1d2e' */
  color?: string;
  /** Border color (CSS hex). Default: '#3a4060' */
  borderColor?: string;
  /** Border line style. Default: 'solid' */
  borderStyle?: 'solid' | 'dashed';
  /** Fill opacity [0–1]. Default: 0.08 */
  fillOpacity?: number;
  /** Border opacity [0–1]. Default: 0.6 */
  borderOpacity?: number;
  /**
   * Child <DiagramNode> elements that belong to this group.
   * Group bounds are computed from the union of child node positions + sizes.
   */
  children?: React.ReactNode;
}

/**
 * Declares a visual grouping container (swimlane, boundary, or cluster).
 * Direct children that are <DiagramNode> elements are assigned to this group.
 */
export function DiagramGroup(_props: DiagramGroupProps): null {
  return null;
}

// ─── <Diagram> ────────────────────────────────────────────────────────────────

export interface DiagramProps {
  /** Unique diagram ID. Must be stable across scenes. */
  id: string;
  /**
   * Auto-layout algorithm to apply when node positions are not explicitly set.
   * 'manual' — uses only explicitly provided positions; throws if any node has no position.
   * 'grid'   — arranges nodes in a left-to-right, top-to-bottom grid.
   * 'hierarchical' — arranges nodes by dependency (edges define parent-child).
   * Default: 'grid'
   */
  layout?: 'manual' | 'grid' | 'hierarchical';
  /**
   * Spacing between nodes in diagram units when using auto-layout.
   * Default: [2, 2] (2 units horizontal, 2 units vertical gap)
   */
  layoutSpacing?: [number, number];
  /** World/parent-space position. Default: [0, 0, 0] */
  position?: [number, number, number];
  /** World/parent-space Euler XYZ rotation in radians. Default: [0, 0, 0] */
  rotation?: [number, number, number];
  /** Uniform scale. Default: 1 */
  scale?: number;
  /** Pivot point. Default: 'center' */
  pivot?: DiagramPivot;
  /**
   * Visual + behavioral theme for this diagram.
   * Overrides the canvas-level theme (if inside a DiagramCanvas).
   * Falls back to the package default (darkGlassTheme) when absent.
   * Per-node / per-edge props take precedence over all theme values.
   */
  theme?: DiagramTheme;
  children?: React.ReactNode;
}

/**
 * Root container for a 3D diagram declaration.
 * All <DiagramNode>, <DiagramEdge>, and <DiagramGroup> elements must be
 * descendants of <Diagram>.
 */
export function Diagram(_props: DiagramProps): null {
  return null;
}

// ─── <Exit> ───────────────────────────────────────────────────────────────────

export interface ExitProps {
  /**
   * Target position in parent space (canvas-local or world) at the end of the exit.
   * If absent, the diagram does not translate during exit (scale/fade only).
   */
  to?: [number, number, number];
  /**
   * If true (default), fade all node and edge opacities to 0 during exit.
   * Set false to disable the fade (translate/scale only).
   */
  fade?: boolean;
  /**
   * Target scale factor at the end of the exit. e.g., scaleTo={0} shrinks to a point.
   * If absent, scale is not animated.
   */
  scaleTo?: number;
  /**
   * Easing function. Default: 'ease' (smooth ease-in-out).
   * 'spring' produces a slight overshoot feel.
   */
  easing?: DiagramEasing;
}

/**
 * Declares exit animation for the parent <Diagram>.
 * Must be a direct child of <Diagram>. At most one <Exit> per diagram.
 * Example: <Exit to={[0, -50, 0]} fade easing="ease-out" />
 */
export function Exit(_props: ExitProps): null {
  return null;
}

// ─── <Enter> ──────────────────────────────────────────────────────────────────

export interface EnterProps {
  /**
   * Source position in parent space at the start of the enter transition.
   * If absent, the diagram enters from its declared position (scale/fade only).
   */
  from?: [number, number, number];
  /**
   * If true (default), fade all node and edge opacities from 0 during enter.
   */
  fade?: boolean;
  /**
   * Source scale factor at the start of the enter. e.g., scaleFrom={0} grows from a point.
   */
  scaleFrom?: number;
  /** Easing function. Default: 'ease'. */
  easing?: DiagramEasing;
}

/**
 * Declares enter animation for the parent <Diagram>.
 * Must be a direct child of <Diagram>. At most one <Enter> per diagram.
 * Example: <Enter from={[-50, 0, 0]} fade easing="spring" />
 */
export function Enter(_props: EnterProps): null {
  return null;
}
