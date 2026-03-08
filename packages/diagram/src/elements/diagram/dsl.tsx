// Declarative DSL surface for diagram authoring. No Three.js. No compiler internals.

import React from 'react';
import type { DiagramNodeShape, DiagramIconVariant } from './shapes/shapeVariants';
import type {
  DiagramEdgeStyle,
  DiagramArrowVariant,
  DiagramEdgeFlow,
  DiagramGroupVariant,
  DiagramOrientation,
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
  DiagramNodeGlowConfig,
} from './types';
import type { NVSRect } from '@brewsite/core';

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
   * Node position in diagram viewport space [x, y, z].
   * x ∈ [0..1]: 0 = left edge of diagram viewport, 1 = right edge.
   * y ∈ [0..1]: 0 = top edge, 1 = bottom edge (Y is DOWN, NVS convention).
   * z: depth layering in diagram canvas units (positive = closer to camera).
   *
   * When using `<GridLayout>`, `<HierarchicalLayout>`, or `<FlowLayout>`, omit
   * this prop — the layout engine assigns positions automatically and normalizes
   * them to [0..1]. Only specify `position` explicitly when using `<ManualLayout>`.
   *
   * For ManualLayout: authored positions must be in [0..1] NVS space.
   * To place at screen center: position={[0.5, 0.5, 0]}.
   * Values outside [0..1] render off-screen.
   *
   * If omitted and layout is manual, this is a ghost node (see `DiagramNode`
   * component documentation for ghost node behavior).
   */
  position?: [number, number, number];
  /**
   * Node size [width, height].
   * For AutoLayout (GridLayout, HierarchicalLayout, FlowLayout): diagram units.
   * The layout algorithm normalizes positions+sizes to [0..1] NVS at compile time.
   * Default: [4, 2] (diagram units — from theme.node.defaultSize).
   *
   * For ManualLayout: [0..1] NVS fractions of the diagram viewport.
   * Example: [0.15, 0.08] = 15% wide, 8% tall of the canvas.
   * ManualLayout consumers MUST always specify an explicit size.
   * The [4, 2] default is in diagram units and is NOT safe for ManualLayout.
   */
  size?: [number, number];
  /**
   * Physical thickness of the 3D prism box in diagram units — how far it protrudes
   * toward the camera. NOT z-axis depth layering (use `position[2]` for that).
   * Default: from theme (darkGlass: 0.4).
   */
  thickness?: number;
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
  /**
   * Node glow (emissive) override.
   * - Omit: inherit from theme (default)
   * - `true`: enable with theme-default intensity and color
   * - `false`: disable glow regardless of theme
   * - object: `{ intensity?: number; color?: string }` for full control
   *
   * @example
   * <DiagramNode id="api" glow={{ intensity: 0.4, color: '#00ffaa' }} />
   * <DiagramNode id="db" glow={false} />  // suppress theme glow
   */
  glow?: boolean | DiagramNodeGlowConfig;
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
  /** Icon scale relative to node face [0–1]. Default: from theme (defaultIconScale, typically 0.6) */
  iconScale?: number;
  /**
   * 3D rendering style for the icon on this node's front face.
   * Default: 'flat' — unchanged from current behaviour.
   * 'layered' is the most visually impactful for AWS/GCP cloud icons.
   */
  iconStyle?: SvgIcon3DStyle;
  /**
   * Override for 3D icon extrusion depth as a fraction of node thickness [0..1].
   * 0.5 = icon extends 50% of node.thickness in Z (coordinate-system-invariant).
   * Default: from theme (defaultIconDepthFactor, typically 0.5).
   * Sensible range: 0.2–0.8. Values > 1.0 cause the icon to protrude beyond the node face.
   */
  iconDepthFactor?: number;
  /** Runtime mouse-enter handler for this node. */
  onMouseEnter?: DiagramNodeMouseHandler;
  /** Runtime mouse-leave handler for this node. */
  onMouseLeave?: DiagramNodeMouseHandler;
}

/**
 * Declares a diagram node (shape with label).
 * Must be a direct or indirect child of <Diagram>.
 * Can be nested inside <DiagramGroup> to establish group membership.
 *
 * ### Ghost Nodes
 *
 * When `label` is omitted, this node is a **ghost node** — it inherits its
 * visual identity (label, sublabel, shape, icon, size) from the matching node
 * in the previous scene. Ghost nodes enable drill-down animations where a prior
 * scene's diagram appears as faded context behind the new focal point.
 *
 * To make a node appear as a ghost:
 * - Omit the `label` prop entirely (do NOT pass `label=""`).
 * - Optionally set `opacity` to reduce visual weight (e.g., `opacity={0.3}`).
 * - In a manual-layout diagram, also omit `position` — it will be inherited.
 *
 * @example
 * // Scene 1: full diagram with named nodes
 * <DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" size={[4, 2]} />
 *
 * // Scene 2: api appears as ghost context (no label = inherit identity from Scene 1)
 * <DiagramNode id="api" opacity={0.3} />
 * // ↑ inherits label, icon, shape, size from Scene 1; only opacity changes
 *
 * Contrast with an intentionally labelless node (NOT a ghost):
 * // This node has a label — it is an empty string, not absent.
 * <DiagramNode id="cdn" label="" size={[3, 2]} color="#1a3d5c" />
 * // ↑ fully-declared node, no inheritance from prior scenes
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
  /** Per-group override for title label text color. Falls back to theme.group.defaultLabelColor. */
  labelColor?: string;
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

// ─── <FlowLayout> ─────────────────────────────────────────────────────────────

export interface FlowLayoutProps {
  /**
   * Primary layout axis direction.
   * 'top-down'   — items stacked vertically (decreasing Y). Default.
   * 'left-right' — items stacked horizontally (increasing X).
   */
  direction?: 'top-down' | 'left-right';
  /**
   * Edge-to-edge gap between adjacent items in diagram units. Default: 2.
   */
  gap?: number;
  /** Padding inside group boundary boxes. Default: 1.5 (all sides) */
  groupPadding?: LayoutPadding;
  /** Gap between group title and content area. Default: 1 */
  titleGap?: number;
}

/**
 * Declares a sequential flow auto-layout for the parent <Diagram> or <DiagramGroup>.
 * Places all direct children in a single line in their JSX declaration order.
 * Items are positioned along the direction axis with edge-to-edge gap spacing.
 * Secondary axis (cross-axis) position is always 0 — items are center-aligned.
 * Must be a direct child of <Diagram> or <DiagramGroup>. At most one layout
 * element per container. Cascades with parent layouts of the same kind.
 *
 * @example
 * <Diagram id="pipeline">
 *   <FlowLayout direction="top-down" gap={2} />
 *   <DiagramNode id="input" label="Input" />
 *   <DiagramGroup id="processing">
 *     <GridLayout columns={3} />
 *     <DiagramNode id="p1" label="Step 1" />
 *   </DiagramGroup>
 *   <DiagramNode id="output" label="Output" />
 * </Diagram>
 */
export function FlowLayout(_props: FlowLayoutProps): null {
  return null;
}

// ─── <Diagram> ────────────────────────────────────────────────────────────────

export interface DiagramProps {
  /** Unique diagram ID. Must be stable across scenes. */
  id: string;
  /**
   * Viewport bounds within the parent DiagramCanvas's NVS region.
   * { x, y, w, h } in [0..1] fractions of the canvas NVS region.
   * Default: { x: 0, y: 0, w: 1, h: 1 } (full canvas).
   *
   * For side-by-side diagrams:
   *   left:  viewportBounds={{ x: 0,   y: 0, w: 0.5, h: 1 }}
   *   right: viewportBounds={{ x: 0.5, y: 0, w: 0.5, h: 1 }}
   */
  viewportBounds?: NVSRect;
  /**
   * 3D tilt rotation in Euler XYZ radians for dramatic perspective effects.
   * Default: [0, 0, 0] (flat, facing camera).
   */
  tilt?: [number, number, number];
  /**
   * Visual + behavioral theme for this diagram.
   * Overrides the parent `<DiagramCanvas>` theme for this diagram only.
   * If inside a DiagramCanvas and this prop is omitted, the canvas theme applies.
   * Falls back to darkGlassTheme when no canvas theme is present.
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

// ─── <DiagramExit> ────────────────────────────────────────────────────────────

export interface DiagramExitProps {
  /**
   * Target viewport position at end of exit animation, in [0..1] NVS space.
   * Values outside [0..1] move the diagram off-screen.
   * Example: to={[0.5, 2, 0]} exits 1 full viewport height below center.
   * Example: to={[-1, 0.5, 0]} exits 1 full viewport width to the left.
   * If absent, the diagram stays in place (fade only).
   */
  to?: [number, number, number];
  /**
   * If true (default), fade all node and edge opacities to 0 during exit.
   * Set false to disable the fade (translate only).
   */
  fade?: boolean;
  /**
   * Easing function. Default: 'ease' (smooth ease-in-out).
   * 'spring' produces a slight overshoot feel.
   */
  easing?: DiagramEasing;
}

/**
 * Declares exit animation for the parent <Diagram>.
 * Must be a direct child of <Diagram>. At most one <DiagramExit> per diagram.
 * @example <DiagramExit to={[0, -50, 0]} fade easing="ease-out" />
 */
export function DiagramExit(_props: DiagramExitProps): null {
  return null;
}

// ─── <DiagramEnter> ───────────────────────────────────────────────────────────

export interface DiagramEnterProps {
  /**
   * Source viewport position at start of enter animation, in [0..1] NVS space.
   * Values outside [0..1] start the animation from off-screen.
   * If absent, the diagram enters from its declared viewportBounds (fade only).
   */
  from?: [number, number, number];
  /**
   * If true (default), fade all node and edge opacities from 0 during enter.
   */
  fade?: boolean;
  /** Easing function. Default: 'ease'. */
  easing?: DiagramEasing;
}

/**
 * Declares enter animation for the parent <Diagram>.
 * Must be a direct child of <Diagram>. At most one <DiagramEnter> per diagram.
 * @example <DiagramEnter from={[-50, 0, 0]} fade easing="spring" />
 */
export function DiagramEnter(_props: DiagramEnterProps): null {
  return null;
}
