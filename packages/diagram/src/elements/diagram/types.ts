// Contract layer for the diagram element. No runtime imports, no Three.js, no React.

import type { DiagramShapeVariant } from './shapes/shapeVariants';

// ─── Node ───────────────────────────────────────────────────────────────────

/** Visual variant for edge connector lines */
export type DiagramEdgeStyle = 'solid' | 'dashed' | 'dotted';

/** Arrowhead variant at a connector endpoint */
export type DiagramArrowVariant = 'none' | 'open' | 'filled' | 'diamond' | 'circle';

/** Group container visual variant */
export type DiagramGroupVariant = 'swimlane' | 'boundary' | 'cluster';

/** Swimlane orientation when variant is 'swimlane' */
export type DiagramOrientation = 'horizontal' | 'vertical';

/**
 * Fully resolved state for a single diagram node.
 * All positions are in diagram units (1 unit ≈ scene world unit before diagram scale is applied).
 * Produced by compile.ts from DiagramNodeDSL.
 */
export interface DiagramNodeState {
  /** Unique node ID within this diagram */
  readonly id: string;

  /** Primary display label */
  readonly label: string;

  /** Optional secondary label rendered below the primary label in smaller text */
  readonly sublabel: string | undefined;

  /**
   * Shape variant determining geometry and icon.
   * Geometry variants (flow:rect, flow:diamond, etc.) use pure Three.js geometry.
   * Icon variants (aws:*, gcp:*, azure:*) overlay an SVG texture on the front face.
   */
  readonly shape: DiagramShapeVariant;

  /**
   * World-space position of the node center [x, y, z].
   * z is the primary axis for depth-reveal animations — the "flat" view has all nodes
   * at z=0; expanded views use non-zero z to create depth.
   */
  readonly position: readonly [number, number, number];

  /** Node width and height in diagram units [w, h]. */
  readonly size: readonly [number, number];

  /**
   * Physical box depth in diagram units.
   * Recommended default: 0.4 for standard nodes, 0.8 for "hero" expanded nodes.
   * Option B rendering: nodes are actual BoxGeometry objects, not flat planes.
   */
  readonly depth: number;

  /** CSS hex color for the node box face (e.g., '#dae8fc') */
  readonly color: string;

  /** CSS hex color for the node box side/edge faces */
  readonly sideColor: string;

  /** CSS hex color for the node border outline (LineSegments overlay) */
  readonly borderColor: string;

  /** Box material metalness [0–1]. Default: 0.15 */
  readonly metalness: number;

  /** Box material roughness [0–1]. Default: 0.65 (matte industrial) */
  readonly roughness: number;

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

  /** ID of the parent DiagramGroup, or undefined if top-level */
  readonly groupId: string | undefined;
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
}

// ─── Group ──────────────────────────────────────────────────────────────────

/**
 * Fully resolved state for a diagram group (swimlane, boundary, or cluster).
 * Bounding box is computed by compile.ts from the positions of member nodes.
 */
export interface DiagramGroupState {
  readonly id: string;

  /** Display label for the group header */
  readonly label: string;

  readonly variant: DiagramGroupVariant;

  /** Swimlane divider orientation. Only meaningful when variant is 'swimlane'. */
  readonly orientation: DiagramOrientation;

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
    readonly padding: number;
  };

  /** CSS hex fill color for the group interior. Typically semi-transparent. */
  readonly color: string;

  /** CSS hex border color */
  readonly borderColor: string;

  readonly borderStyle: 'solid' | 'dashed';

  /** Fill opacity [0–1]. Recommended: 0.05–0.12 for subtle background wash. */
  readonly fillOpacity: number;

  /** Border opacity [0–1] */
  readonly borderOpacity: number;
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
   * Used by the camera system to auto-frame the diagram if no explicit camera is set.
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
   * Suggested camera look-at target in world space [x, y, z].
   * Computed as the diagram bounds center. The consuming scene may override this.
   */
  readonly cameraTarget: readonly [number, number, number];

  /**
   * Suggested camera distance from cameraTarget.
   * Computed from diagram width to ensure all nodes are visible.
   * Based on a 45° vertical FOV: distance = boundsWidth / (2 * tan(22.5°))
   */
  readonly cameraDistance: number;
}

// ─── DSL input types (used by dsl.tsx and consumed by compile.ts) ────────────

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
  readonly shape?: DiagramShapeVariant;
  readonly position?: readonly [number, number, number];
  readonly size?: readonly [number, number];
  readonly depth?: number;
  readonly color?: string;
  readonly sideColor?: string;
  readonly borderColor?: string;
  readonly metalness?: number;
  readonly roughness?: number;
  readonly labelColor?: string;
  readonly sublabelColor?: string;
  readonly opacity?: number;
  readonly clickable?: boolean;
  readonly enabled?: boolean;
  readonly iconScale?: number;
  readonly groupId?: string;
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
  readonly color?: string;
  readonly thickness?: number;
  readonly opacity?: number;
}

/** Raw DSL data extracted from a <DiagramGroup> component by the compiler. */
export interface DiagramGroupDSL {
  readonly id: string;
  readonly label: string;
  readonly variant?: DiagramGroupVariant;
  readonly orientation?: DiagramOrientation;
  readonly color?: string;
  readonly borderColor?: string;
  readonly borderStyle?: 'solid' | 'dashed';
  readonly fillOpacity?: number;
  readonly borderOpacity?: number;
  readonly nodeIds: ReadonlyArray<string>;
}

/** Top-level DSL input to compile.ts. Populated by the compiler handler from <Diagram> props. */
export interface DiagramDSL {
  readonly id: string;
  /**
   * Auto-layout algorithm. Sourced from <Diagram layout="..."> prop.
   * Defaults to 'grid' if not provided.
   */
  readonly layout: 'manual' | 'grid' | 'hierarchical';
  /**
   * Node spacing in diagram units [horizontalGap, verticalGap].
   * Sourced from <Diagram layoutSpacing={[2, 2]}> prop.
   * Defaults to [2, 2] if not provided.
   */
  readonly layoutSpacing: readonly [number, number];
  readonly nodes: ReadonlyArray<DiagramNodeDSL>;
  readonly edges: ReadonlyArray<DiagramEdgeDSL>;
  readonly groups: ReadonlyArray<DiagramGroupDSL>;
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
