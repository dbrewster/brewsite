// Contract layer for the diagram element. No runtime imports, no Three.js, no React.

import type { DiagramNodeShape, DiagramIconVariant } from './shapes/shapeVariants';

// ─── Theming ─────────────────────────────────────────────────────────────────

/**
 * Controls how edge control points are computed between nodes.
 * Applied at the diagram level via the theme, or overridden per-edge.
 * 'curved'      — current: CatmullRom spline exiting node face perpendicularly (default)
 * 'orthogonal'  — Manhattan 90° routing (draw.io / Mermaid style)
 * 'straight'    — direct line between face attachment points
 * 'organic'     — curved with a deterministic perpendicular offset per edge
 */
export type EdgeRoutingAlgorithm = 'curved' | 'orthogonal' | 'straight' | 'organic';

/**
 * Controls which point on a node face an edge attaches to.
 * 'nearest-face'   — current: pick face by dominant delta-vector direction (default)
 * 'shortest-path'  — enumerate all 36 face-pair combos, pick minimum distance
 * 'center'         — connect from/to node centers (pairs well with 'straight' routing)
 * 'port'           — use author-specified fromPort/toPort on the edge DSL
 */
export type EdgeLandingAlgorithm = 'nearest-face' | 'shortest-path' | 'center' | 'port';

/** Explicit attachment port for port-based landing. */
export type DiagramEdgePort = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';

/** Node appearance defaults within a theme. */
export interface DiagramThemeNodeConfig {
  /** Default front-face fill color (CSS hex) */
  readonly defaultColor: string;
  /** PBR metalness [0–1]. ~0.35 = polished plastic, ~0.7 = brushed metal */
  readonly defaultMetalness: number;
  /** PBR roughness [0–1]. ~0.25 = glossy, ~0.65 = matte */
  readonly defaultRoughness: number;
  /** Emissive intensity on the front face [0–1], tinted to node color */
  readonly defaultEmissiveIntensity: number;
  /**
   * Default physical thickness of node prism boxes in diagram units.
   * 0.28 = card-like, 0.6 = block-like.
   */
  readonly defaultThickness: number;
  /**
   * Corner radius in diagram units for rect-like shapes.
   * 0 = sharp BoxGeometry (legacy); > 0 = rounded box geometry.
   * Ignored for non-rect shapes (cylinder, oval, hexagon, etc.).
   */
  readonly cornerRadius: number;
  /** Glow sprite intensity behind each node [0–1]. 0 = no glow sprite. */
  readonly glowIntensity: number;
  /** Default label text color (CSS hex) */
  readonly defaultLabelColor: string;
  /** Default sublabel text color (CSS hex) */
  readonly defaultSublabelColor: string;
  /**
   * Optional troika-three-text fontUrl override.
   * Must be a URL to an MSDF-encoded .ttf or .woff font.
   * If absent, troika uses its built-in font.
   */
  readonly fontUrl?: string;
  /** Label font size multiplier relative to the default (node height × 0.28). Default: 1 */
  readonly labelSizeFactor: number;
  /** Sublabel font size multiplier relative to the default (node height × 0.18). Default: 1 */
  readonly sublabelSizeFactor: number;
  /** Default 3D icon rendering style when not specified per-node */
  readonly defaultIconStyle: SvgIcon3DStyle;
}

/** Edge/connector appearance and routing defaults within a theme. */
export interface DiagramThemeEdgeConfig {
  /** Default edge color (CSS hex) */
  readonly defaultColor: string;
  /** Optional default pulse/flow color (CSS hex). Falls back to edge color. */
  readonly defaultFlowColor?: string;
  /** Default flow animation speed (cycles per second). */
  readonly defaultFlowSpeed: number;
  /** Default flow pulse width (0–1 along edge UV). */
  readonly defaultFlowWidth: number;
  /** Default tube radius in diagram units */
  readonly defaultThickness: number;
  /** PBR metalness for edge tubes [0–1] */
  readonly defaultMetalness: number;
  /** PBR roughness for edge tubes [0–1] */
  readonly defaultRoughness: number;
  /** Default routing algorithm for all edges in the diagram */
  readonly routing: EdgeRoutingAlgorithm;
  /** Default attachment-point selection algorithm */
  readonly landing: EdgeLandingAlgorithm;
  /**
   * CatmullRom segment-count multiplier (applied to the base of max(20, pts×8)).
   * Higher values produce smoother curves at the cost of more geometry.
   * Default: 1.0
   */
  readonly smoothness: number;
  /**
   * If true, arrowheads are rendered as 3D cones (MeshStandardMaterial)
   * instead of flat triangles (MeshBasicMaterial).
   */
  readonly use3DArrows: boolean;
}

/** Group/container appearance defaults within a theme. */
export interface DiagramThemeGroupConfig {
  /** Default fill color (CSS hex) */
  readonly defaultColor: string;
  /** Default border color (CSS hex) */
  readonly defaultBorderColor: string;
  /** Default border width in pixels for group outlines. */
  readonly defaultBorderWidth: number;
  /** Default border height (depth on Z axis) for 3D group outlines. */
  readonly defaultBorderHeight: number;
  /** Default fill opacity [0–1] */
  readonly defaultFillOpacity: number;
  /** Default border opacity [0–1] */
  readonly defaultBorderOpacity: number;
  /** Optional default border emissive color (CSS hex). */
  readonly defaultBorderEmissiveColor?: string;
  /** Optional default border emissive intensity [0–1+]. */
  readonly defaultBorderEmissiveIntensity?: number;
}

/** Environment map / image-based lighting config within a theme. */
export interface DiagramThemeEnvironmentConfig {
  /**
   * URL of an equirectangular Radiance HDR (.hdr) for image-based lighting.
   * null  → use procedural gradient sky derived from skyColor/horizonColor.
   * 'none' → disable environment map entirely (no IBL).
   */
  readonly envMapUrl: string | null | 'none';
  /** IBL intensity applied to scene.environment [0–2]. Default: 0.9 */
  readonly envMapIntensity: number;
  /** Base sky color (CSS hex) for the procedural gradient sky */
  readonly skyColor: string;
  /** Horizon color (CSS hex) for the procedural gradient sky */
  readonly horizonColor: string;
}

/** Layout defaults in a theme for grid/hierarchical/manual compilation. */
export interface DiagramThemeLayoutConfig {
  /**
   * Root layout kind when no <GridLayout>/<HierarchicalLayout>/<ManualLayout>
   * child is declared on <Diagram>. Default: 'grid'.
   */
  readonly defaultKind?: 'grid' | 'hierarchical' | 'manual';
  /** Defaults applied when resolving a grid layout. */
  readonly grid?: {
    readonly columns?: number | 'auto';
    readonly spacing?: readonly [number, number];
    readonly margin?: number | readonly [number, number];
    readonly groupPadding?: LayoutPadding;
    readonly titleGap?: number;
    readonly alignment?: LayoutAlignment;
    readonly disconnected?: LayoutDisconnected;
  };
  /** Defaults applied when resolving a hierarchical layout. */
  readonly hierarchical?: {
    readonly direction?: 'top-down' | 'left-right';
    readonly spacing?: readonly [number, number];
    readonly margin?: number | readonly [number, number];
    readonly groupPadding?: LayoutPadding;
    readonly titleGap?: number;
    readonly alignment?: LayoutAlignment;
    readonly disconnected?: LayoutDisconnected;
  };
  /** Defaults applied when resolving a manual layout. */
  readonly manual?: {
    readonly groupPadding?: LayoutPadding;
    readonly titleGap?: number;
  };
}

/**
 * The complete visual and behavioral contract for a diagram.
 * Pass to <Diagram theme={...}> or <DiagramCanvas theme={...}> to apply.
 * Per-node / per-edge props still take precedence over theme defaults.
 */
export interface DiagramTheme {
  readonly node: DiagramThemeNodeConfig;
  readonly edge: DiagramThemeEdgeConfig;
  readonly group: DiagramThemeGroupConfig;
  readonly environment: DiagramThemeEnvironmentConfig;
  /** Optional layout defaults used by layoutResolver when DSL fields are omitted. */
  readonly layout?: DiagramThemeLayoutConfig;
  /**
   * Optional ordered color palette for auto-coloring nodes that have no
   * explicit color. Colors are assigned round-robin by declaration order.
   */
  readonly palette?: readonly string[];
}

/**
 * Render-time properties carried on DiagramState.themeConfig.
 * Derived from DiagramTheme at compile time. render.ts reads this struct only —
 * it never imports from themes/ or from compile.ts.
 */
export interface DiagramThemeRenderConfig {
  /** See DiagramThemeEnvironmentConfig.envMapUrl */
  readonly envMapUrl: string | null | 'none';
  /** IBL intensity [0–2] */
  readonly envMapIntensity: number;
  /** Gradient sky base color (CSS hex) */
  readonly skyColor: string;
  /** Gradient sky horizon color (CSS hex) */
  readonly horizonColor: string;
  /** Glow sprite intensity for all nodes [0–1]. 0 = disabled */
  readonly nodeGlowIntensity: number;
  /** Corner radius in diagram units for rect nodes. 0 = BoxGeometry */
  readonly nodeCornerRadius: number;
  /** Use 3D cone arrowheads (MeshStandardMaterial) instead of flat triangles */
  readonly use3DArrows: boolean;
  /** CatmullRom segment multiplier */
  readonly edgeSmoothness: number;
  /** Edge tube metalness */
  readonly edgeMetalness: number;
  /** Edge tube roughness */
  readonly edgeRoughness: number;
  /** Flow animation speed (cycles per second). */
  readonly edgeFlowSpeed: number;
  /** Flow pulse width (0–1 along edge UV). */
  readonly edgeFlowWidth: number;
  /** Optional troika fontUrl override */
  readonly fontUrl: string | undefined;
}

// ─── Node ───────────────────────────────────────────────────────────────────

/** Visual variant for edge connector lines */
export type DiagramEdgeStyle = 'solid' | 'dashed' | 'dotted';

/** Arrowhead variant at a connector endpoint */
export type DiagramArrowVariant = 'none' | 'open' | 'filled' | 'diamond' | 'circle';

/** Animated flow direction for edges */
export type DiagramEdgeFlow = 'none' | 'forward' | 'backward' | 'bidirectional';

/**
 * Group container visual variant.
 * - 'boundary'  — outlined rectangular region.
 * - 'cluster'   — shaded container region.
 * - 'swimlane'  — lane container with orientation-aware title/divider.
 * - 'container' — borderless region; border style is always suppressed.
 */
export type DiagramGroupVariant = 'swimlane' | 'boundary' | 'cluster' | 'container';

/** Swimlane orientation when variant is 'swimlane' */
export type DiagramOrientation = 'horizontal' | 'vertical';

/** Clockwise side identifiers for rectangular group bounds. */
export type DiagramGroupSide = 'top' | 'right' | 'bottom' | 'left';

/** Compile-time color resolver for group edge lights. */
export type DiagramGroupEdgeLightColorResolver = (
  lightIndex: number,
  side: DiagramGroupSide,
  indexOnSide: number,
) => string;

/**
 * Visual rendering style for 3D SVG icons on diagram node faces.
 * 'flat' preserves current behaviour (ShapeGeometry, unlit MeshBasicMaterial).
 * All other values produce extruded geometry using MeshStandardMaterial (PBR, lit).
 */
export type SvgIcon3DStyle = 'flat' | 'extruded' | 'layered' | 'embossed';

/** Pivot point: which corner/center of the node layout maps to diagram local [0,0,0]. */
export type DiagramPivot =
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/** Easing function for <Exit> / <Enter> transitions. */
export type DiagramEasing = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'spring';

/**
 * CSS-style padding shorthand for group interior padding in diagram units.
 * number                              → all four sides equal
 * [vertical, horizontal]              → top/bottom and left/right
 * [top, horizontal, bottom]           → top, left/right, bottom
 * [top, right, bottom, left]          → each side individually (CSS order)
 */
export type LayoutPadding =
  | number
  | readonly [number, number]
  | readonly [number, number, number]
  | readonly [number, number, number, number];

/**
 * Alignment of nodes within a grid row or hierarchical level.
 * 'left'   — pack left (grid default)
 * 'center' — pack and center (hierarchical default)
 * 'right'  — pack right
 * 'fill'   — distribute nodes evenly across the widest-row reference width
 */
export type LayoutAlignment = 'left' | 'center' | 'right' | 'fill';

/**
 * Placement policy for nodes with no incoming or outgoing edges.
 * 'next-to' — maintain declaration order; disconnected nodes appear inline
 *             with connected nodes at their declaration position (default)
 * 'after'   — all connected nodes positioned first; disconnected appended after
 */
export type LayoutDisconnected = 'next-to' | 'after';

/**
 * Properties shared by GridLayoutDSL and HierarchicalLayoutDSL.
 * All fields optional in DSL; resolved defaults are applied by layoutResolver.ts.
 */
export interface BaseLayoutDSL {
  /**
   * Gap between adjacent node footprints [colGap, rowGap] in diagram units.
   * CSS box model: spacing is the gap between expanded footprints (see margin).
   * Default: [2, 2]
   */
  readonly spacing?: readonly [number, number];
  /**
   * Per-node breathing room in diagram units.
   * Expands each node's claimed bounding box before spacing is applied.
   * number     → uniform margin on all axes
   * [h, v]     → separate horizontal (x) and vertical (y) margin
   * Default: 0
   */
  readonly margin?: number | readonly [number, number];
  /**
   * Padding inside the group boundary box in diagram units (CSS shorthand).
   * Replaces the hardcoded GROUP_PADDING = 1.5 constant per group.
   * Default: 1.5 (all sides)
   */
  readonly groupPadding?: LayoutPadding;
  /**
   * Vertical gap in diagram units between the group title label
   * and the top of the group's content area.
   * Default: 0.75
   */
  readonly titleGap?: number;
  /**
   * Alignment of nodes within a grid row or hierarchical level.
   * Default: 'left' for grid, 'center' for hierarchical.
   */
  readonly alignment?: LayoutAlignment;
  /**
   * Placement policy for nodes with no edges.
   * Default: 'next-to'
   */
  readonly disconnected?: LayoutDisconnected;
}

/**
 * DSL props for <GridLayout>.
 * The `kind: 'grid'` discriminant is implicit from the component type;
 * authors do not specify `kind` directly.
 */
export interface GridLayoutDSL extends BaseLayoutDSL {
  readonly kind: 'grid';
  /**
   * Number of columns, or 'auto' to use the default (currently 4).
   * Rows expand as needed. Default: 'auto'
   */
  readonly columns?: number | 'auto';
}

/**
 * DSL props for <HierarchicalLayout>.
 * The `kind: 'hierarchical'` discriminant is implicit from the component type.
 */
export interface HierarchicalLayoutDSL extends BaseLayoutDSL {
  readonly kind: 'hierarchical';
  /**
   * Primary layout axis.
   * 'top-down'   — roots at top, leaves below (default)
   * 'left-right' — roots at left, leaves to the right
   */
  readonly direction?: 'top-down' | 'left-right';
}

/**
 * DSL props for <ManualLayout>.
 * All non-ghost nodes must have explicit positions; a compile-time error is
 * thrown for any labeled node that lacks a position.
 * Spacing/margin/alignment props are inapplicable and intentionally absent.
 */
export interface ManualLayoutDSL {
  readonly kind: 'manual';
  /** Padding inside group boundary boxes. Default: 1.5 */
  readonly groupPadding?: LayoutPadding;
  /** Gap between group title label and content area. Default: 0.75 */
  readonly titleGap?: number;
}

/** Discriminated union of all layout DSL types. */
export type LayoutDSL = GridLayoutDSL | HierarchicalLayoutDSL | ManualLayoutDSL;
/**
 * Compiled exit behaviour for a diagram. Produced from <Exit> DSL child.
 * Applied by exitFn in functionalDiagramTransitionSpec.
 */
export interface DiagramExitConfig {
  /**
   * Target position in parent space (canvas-local or world) at t=1.
   * If absent, diagram stays at its declared position (scale/fade only).
   */
  readonly to?: readonly [number, number, number];
  /** If true, fades all node and edge opacities from their declared values to 0. Default: true */
  readonly fade: boolean;
  /** Target scale factor at t=1. If absent, scale does not animate. */
  readonly scaleTo?: number;
  readonly easing: DiagramEasing;
}

/**
 * Compiled enter behaviour for a diagram. Produced from <Enter> DSL child.
 * Applied by enterFn in functionalDiagramTransitionSpec.
 */
export interface DiagramEnterConfig {
  /**
   * Source position in parent space (canvas-local or world) at t=0.
   * If absent, diagram enters from its declared position (scale/fade only).
   */
  readonly from?: readonly [number, number, number];
  /** If true, fades all node and edge opacities from 0 to their declared values. Default: true */
  readonly fade: boolean;
  /** Source scale factor at t=0. If absent, scale does not animate. */
  readonly scaleFrom?: number;
  readonly easing: DiagramEasing;
}

/**
 * Raw DSL props from <Exit> before compile.ts applies defaults.
 * All fields are optional; compile.ts fills in defaults.
 */
export interface DiagramExitDSL {
  readonly to?: readonly [number, number, number];
  readonly fade?: boolean;
  readonly scaleTo?: number;
  readonly easing?: DiagramEasing;
}

/** Raw DSL props from <Enter> before compile.ts applies defaults. */
export interface DiagramEnterDSL {
  readonly from?: readonly [number, number, number];
  readonly fade?: boolean;
  readonly scaleFrom?: number;
  readonly easing?: DiagramEasing;
}

/**
 * Fully resolved state for a single diagram node.
 * All positions are in diagram units (1 unit ≈ scene world unit before diagram scale is applied).
 * Produced by compile.ts from DiagramNodeDSL.
 */
export interface DiagramNodeState {
  /** Unique node ID within this diagram */
  readonly id: string;

  /**
   * Primary display label.
   * `undefined` means this is a ghost node — it inherits its visual identity
   * (label, sublabel, shape, icon, size) from the matching node in the previous scene.
   * `''` (empty string) is a fully-declared node with an empty text label.
   */
  readonly label: string | undefined;

  /** Optional secondary label rendered below the primary label in smaller text */
  readonly sublabel: string | undefined;

  /**
   * Geometry shape variant — determines the 3D prism geometry for this node.
   * Use polygon shapes (circle, triangle, hexagon, etc.) or special 2D shapes.
   * Default: 'rectangle'. Set icon separately to overlay an SVG on the front face.
   */
  readonly shape: DiagramNodeShape;

  /**
   * World-space position of the node center [x, y, z].
   * z is the primary axis for depth-reveal animations — the "flat" view has all nodes
   * at z=0; expanded views use non-zero z to create depth.
   */
  readonly position: readonly [number, number, number];

  /** Node width and height in diagram units [w, h]. */
  readonly size: readonly [number, number];

  /**
   * Physical thickness of the 3D prism box in diagram units — how far it protrudes
   * toward the camera. NOT the same as z-axis depth layering (use `position[2]` for that).
   * Recommended defaults: 0.4 for standard nodes, 0.8 for hero/expanded nodes.
   */
  readonly thickness: number;

  /** CSS hex color for the node box face (e.g., '#dae8fc') */
  readonly color: string;

  /** CSS hex color for the node box side/edge faces */
  readonly sideColor: string;

  /** CSS hex color for the node border outline (LineSegments overlay) */
  readonly borderColor: string;

  /** Box material metalness [0–1]. Default: 0.35 */
  readonly metalness: number;

  /** Box material roughness [0–1]. Default: 0.35 (polished) */
  readonly roughness: number;

  /**
   * Emissive intensity on the node's front face [0–1].
   * Combined with emissiveColor to produce a "lit panel" look.
   * 0 = no emissive (flat lit surface). Default: 0.10.
   */
  readonly emissiveIntensity: number;
  /** Whether emissive lighting is enabled for this node. */
  readonly emissive: boolean;
  /** Emissive color (CSS hex). Defaults to node color. */
  readonly emissiveColor: string;

  /**
   * Corner radius in diagram units for rect-like shapes.
   * 0 = sharp BoxGeometry. > 0 = rounded box via ExtrudeGeometry.
   * Only applies to flow:rect and other box-based shapes.
   * Default: 0.06.
   */
  readonly cornerRadius: number;

  /** CSS hex color for label text */
  readonly labelColor: string;

  /** CSS hex color for sublabel text */
  readonly sublabelColor: string;

  /** Node opacity [0–1] */
  readonly opacity: number;

  /**
   * Whether this node is registered for click/raycast interaction.
   * When true, render.ts registers the node's front-face mesh with the interaction registry.
   */
  readonly clickable: boolean;

  /**
   * Whether this node is rendered at all.
   * Allows nodes to be hidden in one scene and shown in another during a transition.
   */
  readonly enabled: boolean;

  /**
   * True when this node had no explicit position in the DSL and layout is 'manual'.
   * mergeSnapshot will replace position (and size, depth) with the previous scene's
   * compiled values — enabling minimal ghost-node declarations:
   *   <DiagramNode id="cdn" opacity={0.3} />  ← inherits position from prev scene
   * Always false after mergeSnapshot has run, and always false for grid/hierarchical layout
   * (where auto-layout assigns positions).
   */
  readonly positionInherited?: boolean;

  /**
   * Resolved public asset URL for the shape icon, or undefined for geometry-only shapes.
   * Populated by compile.ts via iconRegistry.resolveIconUrl(shape).
   * render.ts loads this URL via THREE.SVGLoader and composites it on the front face.
   */
  readonly iconUrl: string | undefined;

  /**
   * Icon display scale relative to node face [0–1].
   * At 1.0 the icon fills the full node width; 0.5 is half width.
   * Default: 0.6
   */
  readonly iconScale: number;

  /**
   * 3D rendering style for the icon placed on this node's front face.
   * 'flat' uses ShapeGeometry + MeshBasicMaterial (current behaviour).
   * 'extruded' / 'layered' / 'embossed' use ExtrudeGeometry + MeshStandardMaterial.
   * Default: 'flat'.
   */
  readonly iconStyle: SvgIcon3DStyle;

  /**
   * Maximum Z extrusion depth for 3D icon geometry, in diagram units.
   * Applies only when iconStyle !== 'flat'.
   * Default: 0.15.
   */
  readonly iconDepth: number;

  /** ID of the parent DiagramGroup, or undefined if top-level */
  readonly groupId: string | undefined;

  /** Runtime hover enter callback for this node. */
  readonly onMouseEnter?: DiagramNodeMouseHandler;
  /** Runtime hover leave callback for this node. */
  readonly onMouseLeave?: DiagramNodeMouseHandler;
}

// ─── Edge ───────────────────────────────────────────────────────────────────

/**
 * Fully resolved state for a single diagram edge (connector).
 * Produced by compile.ts from DiagramEdgeDSL, including computed control points.
 */
export interface DiagramEdgeState {
  readonly id: string;

  /** ID of the node this edge originates from */
  readonly fromId: string;

  /** ID of the node this edge terminates at */
  readonly toId: string;

  /** Optional label displayed at the midpoint of the edge */
  readonly label: string | undefined;

  /** Line visual style */
  readonly style: DiagramEdgeStyle;

  /** Arrowhead at the origin end */
  readonly arrowStart: DiagramArrowVariant;

  /** Arrowhead at the destination end */
  readonly arrowEnd: DiagramArrowVariant;

  /** CSS hex edge color */
  readonly color: string;

  /** Optional flow animation direction */
  readonly flow: DiagramEdgeFlow;

  /** Optional flow pulse color (defaults to edge color) */
  readonly flowColor: string | undefined;

  /**
   * Tube geometry radius in diagram units.
   * Recommended: 0.04 for standard edges, 0.07 for highlighted/emphasized edges.
   */
  readonly thickness: number;

  /**
   * Bezier/catmull-rom control points for the edge path, in world space.
   * Computed by compile.ts edge router. Always has ≥ 2 points (start and end).
   * The start point is offset from the source node's nearest face center.
   * The end point is offset from the destination node's nearest face center.
   * Intermediate points create smooth routing around obstacles.
   */
  readonly controlPoints: ReadonlyArray<readonly [number, number, number]>;

  /** Edge opacity [0–1] */
  readonly opacity: number;

  /**
   * Per-edge routing algorithm override.
   * If absent, the diagram theme's edge.routing is used.
   * Stored on compiled state so transitions can re-route edges correctly.
   */
  readonly routing: EdgeRoutingAlgorithm;

  /** Optional explicit source port from DSL; used to preserve live reroute intent. */
  readonly fromPort?: DiagramEdgePort;

  /** Optional explicit destination port from DSL; used to preserve live reroute intent. */
  readonly toPort?: DiagramEdgePort;
}

// ─── Group ──────────────────────────────────────────────────────────────────

/**
 * Fully resolved state for a diagram group (swimlane, boundary, or cluster).
 * Bounding box is computed by compile.ts from the positions of member nodes.
 */
export interface DiagramGroupState {
  readonly id: string;

  /** Display label for the group header (optional) */
  readonly label: string;

  readonly variant: DiagramGroupVariant;

  /** Swimlane divider orientation. Only meaningful when variant is 'swimlane'. */
  readonly orientation: DiagramOrientation;
  /** Optional parent group id for nested groups. */
  readonly parentId?: string;

  /**
   * Computed bounding box of all member nodes in diagram units.
   * Includes a padding margin around the outermost node edges.
   * Populated by compile.ts after layout resolution.
   */
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    /**
     * Resolved group padding [top, right, bottom, left] in diagram units.
     * The bounds x/y/w/h already incorporate this padding.
     * Stored for informational use by renderers.
     */
    readonly padding: readonly [number, number, number, number];
    /**
     * Gap between group title label and content area in diagram units.
     * Used by GroupRenderer to offset the title text.
     */
    readonly titleGap: number;
  };

  /** CSS hex fill color for the group interior. Typically semi-transparent. */
  readonly color: string;

  /** CSS hex border color */
  readonly borderColor: string;

  /** Border width in pixels */
  readonly borderWidth: number;
  /** Border height/depth in diagram units */
  readonly borderHeight: number;

  readonly borderStyle: 'solid' | 'dashed' | 'none';

  /** Fill opacity [0–1]. Recommended: 0.05–0.12 for subtle background wash. */
  readonly fillOpacity: number;

  /** Border opacity [0–1] */
  readonly borderOpacity: number;
  /** Border emissive color (CSS hex). */
  readonly borderEmissiveColor: string;
  /** Border emissive intensity [0–1+]. */
  readonly borderEmissiveIntensity: number;
  /** Runtime hover enter callback for this group. */
  readonly onMouseEnter?: DiagramGroupMouseHandler;
  /** Runtime hover leave callback for this group. */
  readonly onMouseLeave?: DiagramGroupMouseHandler;

  /** Optional point lights distributed around the group's border perimeter. */
  readonly edgeLights?: DiagramGroupEdgeLightsState;
}

export interface DiagramGroupEdgeLightState {
  /** Index across all lights on this group (clockwise order). */
  readonly index: number;
  /** Side the light belongs to. */
  readonly side: DiagramGroupSide;
  /** Index of this light within its side sequence. */
  readonly indexOnSide: number;
  /** Light position in GROUP-LOCAL space. */
  readonly position: readonly [number, number, number];
  /** Resolved CSS color for this light. */
  readonly color: string;
}

export interface DiagramGroupEdgeLightsState {
  readonly lights: ReadonlyArray<DiagramGroupEdgeLightState>;
  readonly intensity: number;
  readonly distance: number;
  readonly decay: number;
}

// ─── Diagram (top-level compiled state) ─────────────────────────────────────

/**
 * The fully compiled state of a diagram element.
 * This is what render.ts receives — all layout has been resolved, all icons
 * have been mapped to URLs, all edges have been routed.
 */
export interface DiagramState {
  readonly id: string;

  /** All nodes in render order (back to front for correct transparency sorting) */
  readonly nodes: ReadonlyArray<DiagramNodeState>;

  /** All edges. Rendered before nodes (painter's algorithm) */
  readonly edges: ReadonlyArray<DiagramEdgeState>;

  /** All groups. Rendered before edges (painter's algorithm) */
  readonly groups: ReadonlyArray<DiagramGroupState>;

  /**
   * Computed bounding box of the entire diagram in diagram units.
   * Bounding box of the diagram layout in DIAGRAM-LOCAL coordinates
   * (after pivot offset is applied). Used by DiagramWidget.onTick() for
   * camera auto-framing and by DiagramCanvasRenderer for canvas-level bounds.
   */
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly minZ: number;
    readonly maxZ: number;
  };

  /**
   * World/parent-space position of the diagram group origin.
   * In a DiagramCanvas, parent space = canvas-local space.
   * Defaults to [0, 0, 0].
   */
  readonly position: readonly [number, number, number];

  /**
   * World/parent-space Euler XYZ rotation of the diagram group in radians.
   * Defaults to [0, 0, 0].
   */
  readonly rotation: readonly [number, number, number];

  /**
   * Uniform scale applied to the entire diagram group.
   * All node sizes, edge thicknesses, and depths scale proportionally.
   * Use this to convert Lucid pixel coordinates to world units
   * (e.g., scale={0.01} for a 1000px Lucid diagram → 10 world units wide).
   * Defaults to 1.
   */
  readonly scale: number;

  /**
   * Which point of the node layout bounding box maps to local [0,0,0].
   * Pivot offset is applied at compile time — all node/edge/group positions in the
   * compiled state are already offset so the chosen pivot is at [0,0,0].
   * Defaults to 'center'.
   */
  readonly pivot: DiagramPivot;

  /**
   * Compiled exit behaviour. null = default fade (no position/scale animation).
   * Applied by exitFn in functionalDiagramTransitionSpec.
   */
  readonly exit: DiagramExitConfig | null;

  /**
   * Compiled enter behaviour. null = default fade.
   * Applied by enterFn in functionalDiagramTransitionSpec.
   */
  readonly enter: DiagramEnterConfig | null;

  /**
   * Render-time theme properties resolved at compile time.
   * render.ts reads this struct to apply env map, glow, 3D arrows, etc.
   */
  readonly themeConfig: DiagramThemeRenderConfig;
}

// ─── DSL input types (used by dsl.tsx and consumed by compile.ts) ────────────

/**
 * Node glow (emissive lighting) configuration for the DSL surface.
 * The internal render state always uses the three-field emissive model.
 */
export type DiagramNodeGlowConfig = {
  /** Emissive intensity [0–1]. Default: from theme. */
  intensity?: number;
  /** Emissive color (CSS hex). Default: node face color. */
  color?: string;
};

/**
 * Raw DSL data extracted from a <DiagramNode> component by the compiler.
 * This is an intermediate type — not part of the public API.
 * All optional fields have defaults applied in compile.ts.
 */
export interface DiagramNodeDSL {
  readonly id: string;
  /**
   * Primary label text.
   * Optional — omitted on ghost/partial-update nodes in multi-scene sequences.
   * compile.ts falls back to '' when not provided; mergeSnapshot carries forward
   * the label from the previous scene's compiled state.
   */
  readonly label?: string;
  readonly sublabel?: string;
  /**
   * Geometry shape. Controls the 3D prism rendered for this node.
   * Default: 'rectangle'. Use icon to overlay an SVG on the front face.
   */
  readonly shape?: DiagramNodeShape;
  /**
   * SVG icon overlaid on the node's front face.
   * Accepts any DiagramIconVariant: ui:*, aws:*, gcp:*, azure:*, tech:*, etc.
   * If omitted, no icon is rendered regardless of shape.
   */
  readonly icon?: DiagramIconVariant;
  /**
   * Diagram-LOCAL position [x, y, z] of the node center.
   * z=0 puts the node on the diagram's base plane; non-zero z creates depth layering.
   * Lucid imports: x/y are Lucid pixel coordinates (origin per the diagram's pivot setting).
   * If omitted, auto-layout assigns a position based on declaration order.
   */
  readonly position?: readonly [number, number, number];
  readonly size?: readonly [number, number];
  readonly thickness?: number;
  readonly color?: string;
  readonly sideColor?: string;
  readonly borderColor?: string;
  readonly metalness?: number;
  readonly roughness?: number;
  /**
   * Node glow (emissive) override.
   * - Omit: use theme default (recommended for consistent branding)
   * - `true`: enable glow with theme-default intensity and node face color
   * - `false`: disable glow regardless of theme
   * - object: full control — `{ intensity?: number; color?: string }`
   */
  readonly glow?: boolean | DiagramNodeGlowConfig;
  /** Corner radius in diagram units. Overrides theme default (theme.node.cornerRadius). */
  readonly cornerRadius?: number;
  readonly labelColor?: string;
  readonly sublabelColor?: string;
  readonly opacity?: number;
  readonly clickable?: boolean;
  readonly enabled?: boolean;
  readonly iconScale?: number;
  /** 3D icon rendering style. Default: from theme (typically 'layered'). */
  readonly iconStyle?: SvgIcon3DStyle;
  /** Max extrusion depth for 3D icon in diagram units. Default: 0.15. */
  readonly iconDepth?: number;
  readonly groupId?: string;
  readonly onMouseEnter?: DiagramNodeMouseHandler;
  readonly onMouseLeave?: DiagramNodeMouseHandler;
}

/** Raw DSL data extracted from a <DiagramEdge> component by the compiler. */
export interface DiagramEdgeDSL {
  /** Optional — compile.ts auto-generates `${from}-${to}-${index}` if omitted. */
  readonly id?: string;
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly style?: DiagramEdgeStyle;
  readonly arrowStart?: DiagramArrowVariant;
  readonly arrowEnd?: DiagramArrowVariant;
  /** Optional flow animation direction */
  readonly flow?: DiagramEdgeFlow;
  /** Optional flow pulse color (defaults to edge color) */
  readonly flowColor?: string;
  readonly color?: string;
  readonly thickness?: number;
  readonly opacity?: number;
  /**
   * Per-edge routing algorithm override. Overrides the diagram theme's edge.routing.
   * Useful for mixing curved and orthogonal edges in the same diagram.
   */
  readonly routing?: EdgeRoutingAlgorithm;
  /**
   * Explicit attachment port at the source node.
   * Requires landing: 'port' in the theme, or overrides to port landing for this edge.
   */
  readonly fromPort?: DiagramEdgePort;
  /**
   * Explicit attachment port at the destination node.
   * Requires landing: 'port' in the theme, or overrides to port landing for this edge.
   */
  readonly toPort?: DiagramEdgePort;
}

/** Raw DSL data extracted from a <DiagramGroup> component by the compiler. */
export interface DiagramGroupDSL {
  readonly id: string;
  readonly label?: string;
  readonly variant?: DiagramGroupVariant;
  readonly orientation?: DiagramOrientation;
  readonly color?: string;
  readonly borderColor?: string;
  readonly borderStyle?: 'solid' | 'dashed' | 'none';
  readonly fillOpacity?: number;
  readonly borderOpacity?: number;
  readonly borderEmissiveColor?: string;
  readonly borderEmissiveIntensity?: number;
  readonly onMouseEnter?: DiagramGroupMouseHandler;
  readonly onMouseLeave?: DiagramGroupMouseHandler;
  readonly edgeLights?: DiagramGroupEdgeLightsDSL;
  readonly nodeIds: ReadonlyArray<string>;
  readonly childGroupIds?: ReadonlyArray<string>;
  readonly parentId?: string;
  /**
   * Layout configuration extracted from a layout child element of this group.
   * Cascades from parent: same-kind merges, different-kind replaces, absent inherits.
   */
  readonly layout?: LayoutDSL;
}

export interface DiagramGroupEdgeLightsDSL {
  /** Enable or disable edge light generation for this group. */
  readonly enabled?: boolean;
  /** Lights per diagram unit along each side, unless overridden by side. */
  readonly density?: number;
  /** Per-side density override in lights per diagram unit. */
  readonly densityBySide?: Partial<Record<DiagramGroupSide, number>>;
  /**
   * Constant color or compile-time resolver.
   * Resolver receives (globalIndex, side, indexOnSide) and must return CSS color.
   */
  readonly color?: string | DiagramGroupEdgeLightColorResolver;
  /** PointLight intensity. */
  readonly intensity?: number;
  /** PointLight distance. */
  readonly distance?: number;
  /** PointLight decay. */
  readonly decay?: number;
  /** Extra local Z offset above the group border top surface. */
  readonly zOffset?: number;
}

/** Top-level DSL input to compile.ts. Populated by the compiler handler from <Diagram> props. */
export interface DiagramDSL {
  readonly id: string;
  /**
   * Layout configuration extracted from a <GridLayout>, <HierarchicalLayout>,
   * or <ManualLayout> child element, if present.
   * Absent = default grid layout (columns: 'auto', spacing: [2,2]).
   */
  readonly layout?: LayoutDSL;
  readonly nodes: ReadonlyArray<DiagramNodeDSL>;
  readonly edges: ReadonlyArray<DiagramEdgeDSL>;
  readonly groups: ReadonlyArray<DiagramGroupDSL>;
  /**
   * World/parent-space position of the diagram group origin. Default: [0, 0, 0].
   * In a DiagramCanvas, this is canvas-local space.
   */
  readonly position?: readonly [number, number, number];
  /** World/parent-space Euler XYZ rotation in radians. Default: [0, 0, 0]. */
  readonly rotation?: readonly [number, number, number];
  /**
   * Uniform scale factor. Default: 1.
   * Lucid authors: set scale to (desired world units / Lucid diagram pixel width).
   */
  readonly scale?: number;
  /**
   * Pivot point. Default: 'center'.
   * 'top-left' is convenient for Lucid imports (no coordinate offsetting needed).
   */
  readonly pivot?: DiagramPivot;
  /** Raw exit config from <Exit> child. Absent = default fade. */
  readonly exit?: DiagramExitDSL;
  /** Raw enter config from <Enter> child. Absent = default fade. */
  readonly enter?: DiagramEnterDSL;
  /**
   * Theme to apply to this diagram.
   * In a DiagramCanvas, the canvas theme is the fallback; this merges on top.
   * Individual node/edge props still override the theme.
   */
  readonly theme?: DiagramTheme;
}

// ─── Interaction ─────────────────────────────────────────────────────────────

/**
 * Emitted when a clickable diagram node is interacted with.
 * v1: dispatched to the scroll advance handler (triggers next scene stop).
 * v2: will carry additional context for free-form interactive exploration.
 */
export interface DiagramInteractionEvent {
  readonly type: 'node-click';
  readonly diagramId: string;
  readonly nodeId: string;
  /** World-space position of the click intersection point */
  readonly intersectPoint: readonly [number, number, number];
}

export interface DiagramHoverEventBase {
  readonly diagramId: string;
  readonly intersectPoint: readonly [number, number, number];
  readonly controls: DiagramHoverControls;
  stopPropagation(): void;
  isPropagationStopped(): boolean;
}

export interface DiagramHoverControls {
  /** Enables/disables a light from the core Lighting widget by light id. */
  setLightEnabled(lightId: string, enabled: boolean): void;
  /** Enables/disables emissive rendering for a single node. */
  setNodeEmissive(nodeId: string, enabled: boolean, options?: { diagramId?: string }): void;
  /** Enables/disables emissive rendering for all nodes in a group. */
  setGroupNodesEmissive(
    groupId: string,
    enabled: boolean,
    options?: { diagramId?: string; includeDescendants?: boolean },
  ): void;
}

export interface DiagramNodeHoverEvent extends DiagramHoverEventBase {
  readonly type: 'node-mouse-enter' | 'node-mouse-leave';
  readonly nodeId: string;
  readonly groupId?: string;
}

export interface DiagramGroupHoverEvent extends DiagramHoverEventBase {
  readonly type: 'group-mouse-enter' | 'group-mouse-leave';
  readonly groupId: string;
}

export type DiagramNodeMouseHandler = (event: DiagramNodeHoverEvent) => void;
export type DiagramGroupMouseHandler = (event: DiagramGroupHoverEvent) => void;

/**
 * Callback for compile-time warnings emitted by diagram compilation functions.
 * handlers.ts adapts this into CompileApi.pushWarning().
 * @internal — consumed by handlers.ts, not part of consumer-facing DSL.
 */
export type DiagramWarnFn = (code: string, message: string) => void;
