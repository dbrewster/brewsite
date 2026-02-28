// Declarative DSL surface for diagram authoring. No Three.js. No compiler internals.

import React from 'react';
import type { DiagramNodeShape, DiagramIconVariant } from './shapes/shapeVariants';
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
  LayoutAlignment,
  LayoutDisconnected,
  LayoutPadding,
  DiagramGroupEdgeLightsDSL,
  DiagramNodeMouseHandler,
  DiagramGroupMouseHandler,
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
   * Geometry shape. Determines the 3D prism rendered for this node.
   * Default: 'rectangle'. Combine with icon to overlay an SVG on the front face.
   */
  shape?: DiagramNodeShape;
  /**
   * SVG icon overlaid on the node's front face.
   * Accepts any DiagramIconVariant namespace:
   * flow:*, ui:*, tech:*, security:*, data:*, net:*, aws:*, gcp:*, azure:*, custom:*.
   * `custom:*` values are reserved for custom resolver integrations and resolve
   * to no icon by default unless your runtime provides a mapping.
   * To support `custom:my-icon`, add a resolver mapping (for example in
   * `resolveIconUrl`) from that token to a public SVG URL.
   * If omitted, no icon is rendered regardless of shape.
   */
  icon?: DiagramIconVariant;
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
  /** Enables/disables front-face emissive contribution. */
  emissive?: boolean;
  /** Emissive color (CSS hex). Default: node `color`. */
  emissiveColor?: string;
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
  /** Runtime mouse-enter handler for this node. */
  onMouseEnter?: DiagramNodeMouseHandler;
  /** Runtime mouse-leave handler for this node. */
  onMouseLeave?: DiagramNodeMouseHandler;
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
  /** ID of the source node. Must exactly match a sibling `<DiagramNode id="...">`. */
  from: string;
  /** ID of the destination node. Must exactly match a sibling `<DiagramNode id="...">`. */
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
 * `from` and `to` must match `<DiagramNode id="...">` values in the same
 * parent `<Diagram>`.
 * Unresolvable endpoints are compiled as hidden edges (no control points).
 * Must be a direct or indirect child of <Diagram>.
 */
export function DiagramEdge(_props: DiagramEdgeProps): null {
  return null;
}

// ─── <DiagramGroup> ───────────────────────────────────────────────────────────

export interface DiagramGroupProps {
  /** Unique ID within the diagram */
  id: string;
  /** Group header label (optional) */
  label?: string;
  /**
   * Group visual variant. Default: 'boundary'.
   * - 'boundary'  — outlined rectangular region.
   * - 'cluster'   — shaded container region.
   * - 'swimlane'  — lane container with divider (`orientation` applies only here).
   * - 'container' — borderless region (`borderStyle` is ignored and forced to 'none').
   */
  variant?: DiagramGroupVariant;
  /** Swimlane orientation (only for variant='swimlane'). Default: 'vertical' */
  orientation?: DiagramOrientation;
  /** Fill color (CSS hex). Default: '#1a1d2e' */
  color?: string;
  /** Border color (CSS hex). Default: '#3a4060' */
  borderColor?: string;
  /** Border line style. Default: 'solid' */
  borderStyle?: 'solid' | 'dashed' | 'none';
  /** Fill opacity [0–1]. Default: 0.08 */
  fillOpacity?: number;
  /** Border opacity [0–1]. Default: 0.6 */
  borderOpacity?: number;
  /** Border emissive color (CSS hex). Default: borderColor */
  borderEmissiveColor?: string;
  /** Border emissive intensity [0–1+]. Default: 0 */
  borderEmissiveIntensity?: number;
  /** Runtime mouse-enter handler for this group. */
  onMouseEnter?: DiagramGroupMouseHandler;
  /** Runtime mouse-leave handler for this group. */
  onMouseLeave?: DiagramGroupMouseHandler;
  /** Optional point lights distributed clockwise around the group border. */
  edgeLights?: DiagramGroupEdgeLightsDSL;
  /**
   * Child <DiagramNode> and <DiagramGroup> elements that belong to this group.
   * Group bounds are computed from the union of child node positions + sizes.
   * Nested <DiagramGroup> children establish sub-groups with their own layout.
   */
  children?: React.ReactNode;
}

/**
 * Declares a visual grouping container (boundary, cluster, swimlane, or container).
 * Direct children that are <DiagramNode> elements are assigned to this group.
 */
export function DiagramGroup(_props: DiagramGroupProps): null {
  return null;
}

// ─── <GridLayout> ─────────────────────────────────────────────────────────────

export interface GridLayoutProps {
  /** Number of grid columns, or 'auto' (default 4). Rows expand as needed. */
  columns?: number | 'auto';
  /** Gap between node footprints [colGap, rowGap]. Default: [2, 2] */
  spacing?: [number, number];
  /** Per-node margin [h, v] expanding each node's footprint. Default: 0 */
  margin?: number | [number, number];
  /** Padding inside group boundary boxes. Default: 1.5 (all sides) */
  groupPadding?: LayoutPadding;
  /** Gap between group title and content. Default: 0.75 */
  titleGap?: number;
  /** Row alignment. Default: 'left' */
  alignment?: LayoutAlignment;
  /** Disconnected node placement. Default: 'next-to' */
  disconnected?: LayoutDisconnected;
}

/**
 * Declares a grid auto-layout for the parent <Diagram> or <DiagramGroup>.
 * Must be a direct child of <Diagram> or <DiagramGroup>. At most one layout
 * element per container. Cascades with parent layouts of the same kind.
 */
export function GridLayout(_props: GridLayoutProps): null {
  return null;
}

// ─── <HierarchicalLayout> ─────────────────────────────────────────────────────

export interface HierarchicalLayoutProps {
  /** Layout axis direction. Default: 'top-down' */
  direction?: 'top-down' | 'left-right';
  /** Gap between node footprints [colGap, rowGap]. Default: [2, 2] */
  spacing?: [number, number];
  /** Per-node margin [h, v] expanding each node's footprint. Default: 0 */
  margin?: number | [number, number];
  /** Padding inside group boundary boxes. Default: 1.5 (all sides) */
  groupPadding?: LayoutPadding;
  /** Gap between group title and content. Default: 0.75 */
  titleGap?: number;
  /** Level alignment. Default: 'center' */
  alignment?: LayoutAlignment;
  /** Disconnected node placement. Default: 'next-to' */
  disconnected?: LayoutDisconnected;
}

/**
 * Declares a topological (edge-driven) auto-layout for the parent
 * <Diagram> or <DiagramGroup>. Must be a direct child of either container.
 * At most one layout element per container. Cascades with parent layouts
 * of the same kind.
 */
export function HierarchicalLayout(_props: HierarchicalLayoutProps): null {
  return null;
}

// ─── <ManualLayout> ───────────────────────────────────────────────────────────

export interface ManualLayoutProps {
  /** Padding inside group boundary boxes. Default: 1.5 (all sides) */
  groupPadding?: LayoutPadding;
  /** Gap between group title and content. Default: 0.75 */
  titleGap?: number;
}

/**
 * Declares that all node positions are manually specified.
 * Non-ghost nodes (those with a label) that lack an explicit position
 * will throw a compile-time error.
 */
export function ManualLayout(_props: ManualLayoutProps): null {
  return null;
}

// ─── <Diagram> ────────────────────────────────────────────────────────────────

export interface DiagramProps {
  /** Unique diagram ID. Must be stable across scenes. */
  id: string;
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
   *
   * @example
   * import { darkGlassTheme, lightMinimalTheme, enterpriseTheme, neonCyberTheme } from '@brewsite/diagram';
   */
  theme?: DiagramTheme;
  children?: React.ReactNode;
}

/**
 * A standalone 3D diagram element with nodes, edges, groups, and layout.
 *
 * Use <Diagram> for single-diagram scenes where no cross-diagram connectors
 * are required.
 *
 * Use <DiagramCanvas> when multiple diagrams need pipes/connections between them.
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
