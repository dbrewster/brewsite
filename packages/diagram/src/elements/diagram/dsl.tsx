// Declarative DSL surface for diagram authoring. No Three.js. No compiler internals.

import React from 'react';
import type { DiagramShapeVariant } from './shapes/shapeVariants';
import type {
  DiagramEdgeStyle,
  DiagramArrowVariant,
  DiagramGroupVariant,
  DiagramOrientation,
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
  /** Surface metalness [0–1]. Default: 0.15 */
  metalness?: number;
  /** Surface roughness [0–1]. Default: 0.65 */
  roughness?: number;
  /** Label text color (CSS hex). Default: '#ffffff' */
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
  /** Edge color (CSS hex). Default: '#555e7a' */
  color?: string;
  /** Tube radius in diagram units. Default: 0.04 */
  thickness?: number;
  /** Edge opacity [0–1]. Default: 1 */
  opacity?: number;
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
