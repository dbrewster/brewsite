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
import type { MaterialApplication } from '@brewsite/core';

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
   * Node size as NVS fractions [width, height].
   * width ∈ [0..1]: fraction of diagram viewport width.
   * height ∈ [0..1]: fraction of diagram viewport height.
   * Example: [0.15, 0.08] = 15% wide, 8% tall.
   * Default: from theme (typically [0.15, 0.08]).
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
  /** Box/depth color (CSS hex) for sides, top, bottom, and back. Default: from theme or derived from color */
  boxColor?: string;
  /** Legacy alias for boxColor. Default: derives from color (darker) */
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
  /** When true, sublabel text wraps at the node content width. Default: false. */
  sublabelWrap?: boolean;
  /** Maximum number of wrapped sublabel lines (1–4). Only applies when sublabelWrap is true. Default: 2. */
  sublabelMaxLines?: number;
  /**
   * Label padding as a fraction of node content height [0–1].
   * Controls the vertical offset applied to all label/sublabel positions within
   * the node's front face. Positive values shift labels downward (toward the
   * bottom of the node); negative values shift upward.
   * 0 = labels use default centered/stacked positions.
   * Default: from theme (defaultLabelPadding, typically 0).
   */
  labelPadding?: number;
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
  /** Icon extrusion depth in NVS units. Default: from theme (0.15). */
  iconDepth?: number;
  /** Override icon fill color for this node (CSS hex). Defaults to theme's defaultIconColor. */
  iconColor?: string;
  /** Border line width in NVS units. Default: from theme (0.005). */
  borderWidth?: number;
  /** Border frame Z-depth in NVS units. Default: from theme (0.005). */
  borderHeight?: number;
  /** Runtime mouse-enter handler for this node. */
  onMouseEnter?: DiagramNodeMouseHandler;
  /** Runtime mouse-leave handler for this node. */
  onMouseLeave?: DiagramNodeMouseHandler;
  /**
   * Named PBR material preset applied to the node's front face via CSM UV projection.
   * Requires @brewsite/textures to be installed and configured. If the preset is not
   * found in the material manifest, a console.warn is emitted and the existing
   * MeshStandardMaterial is used as fallback.
   */
  surfaceMaterial?: string;
  /** Controls how the material preset textures are applied. See MaterialApplication. */
  materialApplication?: MaterialApplication;
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
   * `routing="flow"` is the canonical obstacle-aware routing mode.
   */
  routing?: EdgeRoutingAlgorithm;
  /** Optional per-edge override for canonical flow turn radius. */
  flowTurnRadius?: number;
  /** Optional per-edge override for canonical flow face stub length. */
  flowFaceStub?: number;
  /** Optional per-edge override for how long sibling flow edges remain bundled before splitting. */
  flowBundleStrength?: number;
  /** Optional per-edge override for how strongly a flow edge prefers direct target ingress after splitting. */
  flowTargetApproachBias?: number;
  /** Enables the flow router's Z underpass escape hatch when true. */
  allowUnderpass?: boolean;
  /**
   * Explicit attachment port at the source node (requires landing: 'port' or
   * automatically enables port landing for this edge). In `flow` mode this still
   * attaches at the exact face center.
   */
  fromPort?: DiagramEdgePort;
  /**
   * Explicit attachment port at the destination node. In `flow` mode this still
   * attaches at the exact face center.
   */
  toPort?: DiagramEdgePort;
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
   * Named PBR material preset applied to the group fill plane via CSM UV projection.
   * Requires @brewsite/textures to be installed and configured.
   */
  surfaceMaterial?: string;
  /** Controls how the material preset textures are applied. See MaterialApplication. */
  materialApplication?: MaterialApplication;
  /**
   * Child <DiagramNode> and <DiagramGroup> elements that belong to this group.
   * Group bounds are computed from the union of child node positions + sizes.
   * Nested <DiagramGroup> children establish sub-groups with their own layout.
   */
  children?: React.ReactNode;
}

// ─── <GridLayout> ─────────────────────────────────────────────────────────────

export interface GridLayoutProps {
  /** Number of grid columns, or 'auto' (default 4). Rows expand as needed. */
  columns?: number | 'auto';
  /** Gap between node footprints [colGap, rowGap] in NVS fractions. Default: [0.06, 0.06] */
  spacing?: [number, number];
  /** Per-node margin [h, v] in NVS fractions. Default: 0 */
  margin?: number | [number, number];
  /** Padding inside group boundary boxes in NVS fractions. Default: 0.035 (all sides) */
  groupPadding?: LayoutPadding;
  /** Gap between group title and content in NVS fractions. Default: 0.025 */
  titleGap?: number;
  /** Row alignment. Default: 'left' */
  alignment?: LayoutAlignment;
  /** Disconnected node placement. Default: 'next-to' */
  disconnected?: LayoutDisconnected;
}

// ─── <HierarchicalLayout> ─────────────────────────────────────────────────────

export interface HierarchicalLayoutProps {
  /** Layout axis direction. Default: 'top-down' */
  direction?: 'top-down' | 'left-right';
  /** Gap between node footprints in NVS fractions. Default: [0.045, 0.045] */
  spacing?: [number, number];
  /** Per-node margin [h, v] in NVS fractions. Default: 0 */
  margin?: number | [number, number];
  /** Padding inside group boundary boxes in NVS fractions. Default: 0.035 (all sides) */
  groupPadding?: LayoutPadding;
  /** Gap between group title and content in NVS fractions. Default: 0.025 */
  titleGap?: number;
  /** Level alignment. Default: 'center' */
  alignment?: LayoutAlignment;
  /** Disconnected node placement. Default: 'next-to' */
  disconnected?: LayoutDisconnected;
}

// ─── <ManualLayout> ───────────────────────────────────────────────────────────

export interface ManualLayoutProps {
  /** Padding inside group boundary boxes in NVS fractions. Default: 0.035 (all sides) */
  groupPadding?: LayoutPadding;
  /** Gap between group title and content in NVS fractions. Default: 0.025 */
  titleGap?: number;
}

// ─── <FlowLayout> ─────────────────────────────────────────────────────────────

export interface FlowLayoutProps {
  /**
   * Primary layout axis direction.
   * 'top-down'   — items stacked vertically (decreasing Y). Default.
   * 'left-right' — items stacked horizontally (increasing X).
   */
  direction?: 'top-down' | 'left-right';
  /** Edge-to-edge gap between adjacent items in NVS fractions. Default: 0.06 */
  gap?: number;
  /** Padding inside group boundary boxes in NVS fractions. Default: 0.035 (all sides) */
  groupPadding?: LayoutPadding;
  /** Gap between group title and content in NVS fractions. Default: 0.025 */
  titleGap?: number;
}

// ─── <Diagram> ────────────────────────────────────────────────────────────────

export interface DiagramProps {
  /** Unique diagram ID. Must be stable across scenes. */
  id: string;
  /** NVS left edge [0..1]. Default: 0. */
  x?: number;
  /** NVS top edge [0..1]. Default: 0. */
  y?: number;
  /** NVS width [0..1]. Default: 1. */
  w?: number;
  /** NVS height [0..1]. Default: 1. */
  h?: number;
  /** Pitch tilt in radians applied to diagram geometry. Default: 0. */
  tilt?: number;
  /** World-space Z depth of the diagram plane. Default: 0. */
  z?: number;
  /** World-space geometry scale. Default: 1. */
  scale?: number;
  children?: React.ReactNode;
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
