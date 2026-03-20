---
title: "BrewSite Diagram — Diagram Element"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-19
change_history:
  - date: 2026-03-10
    author: "Toolkit Product"
    summary: "Edge routing rewrite: canonical routing mode is now flow, orthogonal is removed from the public DSL, DiagramEdgeState now carries explicit path commands, flow routes attach to exact face centers, and the renderer consumes DiagramEdgePathCommand[] rather than inferring spline semantics from control-point counts."
  - date: 2026-03-10
    author: "Toolkit Product"
    summary: "Module architecture redesign: ghost node merge logic extracted to compiler/ghostNodeMerge.ts; hover state machine extracted to compiler/hoverStateMachine.ts; coordinate normalization extracted to compiler/normalizeToViewport.ts; node label arithmetic extracted to rendering/nodeLabelLayout.ts; IFocusRegionService interface + DiagramFocusRegionService class added to focusRegion.ts; DiagramRenderer now accepts optional IIconLoader injection; global dispose() side effect removed from render.ts. Updated Compilation Pipeline, Ghost Node Inheritance, Rendering Architecture, DiagramWidget Contract, and Technical Considerations sections."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Audit corrections: DiagramWidget implements ILightingOverride (not IAnimationController — IAnimationController was removed, tickPriority and onTick() do not exist). DiagramWidget implements IDslComposite, ILoadable, INVSBounded, ILightingOverride. FlowLayout added to childDslComponents. DiagramNodeProps and DiagramEdgeProps gain new fields: labelPadding, boxColor (node-level boxColor), and per-edge flow routing overrides (flowTurnRadius, flowFaceStub, flowBundleStrength, flowTargetApproachBias, allowUnderpass). DiagramState gains contentAspect field. Camera auto-framing description removed — DiagramWidget does not implement IAnimationController and no longer performs auto-framing via onTick()."
  - date: 2026-03-09
    author: "Toolkit Product"
    summary: "NVS Universal Coordinate System: DiagramCanvas removed — <Diagram> is now the top-level authoring element. DiagramProps.viewportBounds (NVSRect) replaced by flat x/y/w/h props. DiagramProps.tilt changed from Vec3 to scalar (pitch only). DiagramWidget now implements ILoadable (env map) + INVSBounded. Overview updated to remove DiagramCanvasWidget reference. Non-Goals updated to remove DiagramCanvas/DiagramPipe mention. DSL section updated with new DiagramProps. Consumer integration updated to diagramPlugin({ diagrams: [...] }) pattern. Breaking change assessment updated to major."
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the Diagram element DSL, compiled state types, compilation pipeline, ghost-node inheritance, rendering architecture, and widget contract as implemented."
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Breaking DX improvements: depth→thickness prop rename on DiagramNode and DiagramNodeState; emissive/emissiveIntensity/emissiveColor removed, replaced with glow?: boolean|DiagramNodeGlowConfig; Enter/Exit renamed to DiagramEnter/DiagramExit with corresponding prop types DiagramEnterProps/DiagramExitProps; DiagramNodeState.label type changed from string to string|undefined; ghost node trigger changed from label==='' to label===undefined; DiagramWidget removed from public exports. All affected sections updated."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "Model/diagram overhaul: iconDepth is sole control for icon extrusion depth (NVS units); DiagramPivot type deleted and pivot prop removed from DiagramProps/DiagramState; iconScale default now sourced from theme (DiagramThemeNodeConfig.defaultIconScale); compilation step 7 (pivot offset) removed; TextRenderer.ts deleted — callers import ensureText/TextWithLayout directly from @brewsite/core. All affected DSL, compiled state, pipeline, and technical sections updated."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "Coordinate system migration and group label propagation: DiagramProps position/rotation/scale/pivot replaced with viewportBounds (NVSRect) and tilt ([number,number,number]); DiagramState position/rotation/scale/pivot/bounds replaced with viewportBounds and tiltRotation; exit/enter changed from null to undefined default; DiagramGroupProps.labelColor added for per-group title color override; DiagramGroupState.labelColor added as resolved field; FlowLayout DSL component added with FlowLayoutProps. All authoring examples updated. Breaking change assessment updated to major."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Codebase alignment: removed theme? prop from DiagramProps (theme is on DiagramDSL in types.ts, not DiagramProps in dsl.tsx). Added surfaceMaterial and materialApplication props to DiagramNodeProps and DiagramGroupProps documentation. Fixed titleGap defaults in DSL comments: Grid/Hierarchical/Manual layouts default to 0.75 (via enterprise theme override of package constant 1), FlowLayout defaults to 1."
  - date: 2026-03-18
    author: "Toolkit Product"
    summary: "Rendering fixes: documented aspect ratio correction in DiagramRenderer (node world-space X divided by contentAspect so size={[N,N]} renders as a visual square). Documented fit-to-content node label layout in NodeRenderer (icon, label, and sublabel are vertically stacked and scaled to fit within the node's content area). Added node sizing guide with recommended minimum sizes for common content combinations. Semver impact: minor (rendering behavior improvements, no API changes)."
  - date: 2026-03-19
    author: "Toolkit Product"
    summary: "NVS sizing migration: all diagram sizes (node size, spacing, gap, margin, groupPadding, titleGap) are now NVS fractions [0..1]. The dual content-unit / NVS system is eliminated — all layout modes use the same coordinate system. contentAspect field removed from DiagramState. normalizeToViewport() performs center + uniform-scale-to-fit + Y-flip (not per-axis-independent normalization). Dense layouts that exceed [0..1] are uniformly scaled with 2% margin. Node Sizing Guide updated with NVS values. Semver impact: major (breaking: contentAspect removed, size semantics changed)."
  - date: 2026-03-19
    author: "Toolkit Product"
    summary: "NVS thickness migration completed: node thickness, edge thickness, group borderWidth, group borderHeight, and node cornerRadius are now NVS fractions of diagram viewport width. thicknessNormFactor eliminated from normalizeToViewport() (returns scaleFactor only). GROUP_BORDER_PX_TO_UNITS deleted from constants.ts. cornerRadius converted to world units in render.ts. All DSL props, compiled state fields, and theme defaults use NVS fractions. Pipeline: authored_nvs × scaleFactor (compile) × uniformWorldW (render) = world units."
---

# BrewSite Diagram — Diagram Element

## Overview

The `Diagram` element is the primary authoring surface in `@brewsite/diagram`. It is a 3D interactive diagram composed of typed nodes, directed edges, and group containers. Authors declare `<Diagram>` directly inside `<Scene>` with `x/y/w/h` NVS bounds; the compiler resolves layout, routes edges, applies theme defaults, and produces a fully resolved `DiagramState`. `DiagramWidget` drives this state through Three.js, rendering directly into the main scene using the NVS coordinate service, to produce a prism-based 3D visualization that transitions smoothly between scenes. This element is for TypeScript developers building animated architectural, infrastructure, or flow diagrams for immersive 3D marketing scenes.

Affected package: `@brewsite/diagram`.

## Problem Statement

Technical marketing scenes frequently need to visualize system architecture, data flows, and organizational structure. Building these visualizations requires a consistent visual language (nodes, edges, groups), automatic layout for complex graphs, smooth scene-to-scene transitions that maintain node identity, and runtime interactivity (hover, click). Without a dedicated element, each team reimplements this from scratch in Three.js — inconsistently, at high cost, and without any guarantee of transition correctness. The `Diagram` element eliminates this problem by providing a complete, tested, production-ready solution with a declarative JSX API.

## Goals & Success Metrics

**Primary metrics:**
- A developer can add a 6-node diagram with edges, a group, and grid layout to a scene with under 30 lines of JSX and zero Three.js.
- `compileDiagram` test coverage is 100% on all pure functions in `compiler/` sub-modules.
- Scene-to-scene transitions correctly interpolate positions, opacities, and edge control points — verified by `transitionHelpers` unit tests.

**Guardrail metrics:**
- No Three.js import in `types.ts`, `dsl.tsx`, or `compiler/` files.
- Ghost node merge does not regress: nodes with no `label` in subsequent scenes inherit visual identity from the prior scene's compiled state.
- Adding a `Diagram` with 20 nodes to a scene produces no TypeScript errors with strict mode enabled.

## Non-Goals

- Cross-diagram pipe connectors (`DiagramPipe`, `DiagramCanvas`) are not part of this element and have been removed from `@brewsite/diagram`. Multiple independent `<Diagram>` elements may coexist in the same scene as siblings.
- Per-node animation beyond what `functionalDiagramTransitionSpec` provides (enter/exit/interpolate) is not part of this element's scope.
- Real-time editable diagrams (runtime add/remove nodes) are out of scope. All diagram content is authored at compile time.
- The element does not provide a legend, tooltip system, or annotation layer. Those belong in the consumer's HUD layer.
- Automatic cycle detection and layout repair for cyclic graphs is not provided. Cycles are handled gracefully (treated as non-constraining after initial root selection in hierarchical layout) but are not flagged or repaired.

## Consumer Stories

- As a toolkit consumer, I want to declare a diagram in JSX with nodes, edges, and groups so that I can author structured 3D visualizations without Three.js knowledge.
- As a toolkit consumer, I want nodes to automatically animate between their positions across scenes so that diagrams tell a coherent spatial story.
- As a toolkit consumer, I want ghost nodes (nodes declared with no label in a later scene) to inherit their visual identity from the prior scene so that I can spotlight a subset of a diagram without re-declaring every node.
- As a toolkit consumer, I want to choose between grid, hierarchical, and manual layout so that I can match the diagram's visual structure to its semantic meaning.
- As a toolkit consumer, I want to attach hover handlers to individual nodes and groups so that I can build interactive diagrams without a separate event system.

## Functional Requirements

1. The system shall compile a `<Diagram>` JSX element with any combination of `<DiagramNode>`, `<DiagramEdge>`, `<DiagramGroup>`, `<GridLayout>`, `<HierarchicalLayout>`, `<ManualLayout>`, `<DiagramExit>`, and `<DiagramEnter>` children into a `DiagramState` using `compileDiagram(dsl, fallbackTheme?)`.
2. Consumers must be able to specify per-node `position`, `size`, `thickness`, `color`, `shape`, `icon`, `opacity`, `metalness`, `roughness`, `glow`, `cornerRadius`, `labelColor`, `sublabelColor`, `clickable`, `enabled`, `iconScale`, `iconStyle`, and `iconDepth`.
3. Consumers must be able to specify per-edge `from`, `to`, `style`, `arrowStart`, `arrowEnd`, `flow`, `flowColor`, `color`, `thickness`, `opacity`, `routing`, `fromPort`, and `toPort`.
4. Consumers must be able to nest `<DiagramNode>` and child `<DiagramGroup>` elements inside a `<DiagramGroup>` to establish group membership and visual containment.
5. The system shall resolve all node positions that have no explicit `position` prop using the layout specified by the diagram's layout child element, or the theme's default layout if none is specified.
6. The system shall route all edges using the `routeEdges()` function after layout resolution, producing `controlPoints` on each `DiagramEdgeState`.
7. The `mergeSnapshot(prev, next)` method on `DiagramWidget` shall carry forward `label`, `sublabel`, `shape`, `iconUrl`, `iconScale`, and `sublabelColor` from `prev` for any node in `next` whose `label` is `undefined` (i.e., the `label` prop was omitted in the DSL). Nodes with `label=""` (explicit empty string) are not ghost nodes and are not subject to merge.
8. The `mergeSnapshot` method shall additionally carry forward `position`, `size`, and `thickness` from `prev` for any node in `next` where `positionInherited` is `true`.
9. Consumers must be able to attach `onMouseEnter` and `onMouseLeave` handlers to `<DiagramNode>` and `<DiagramGroup>` elements, which are invoked at runtime when the cursor enters or leaves the corresponding 3D mesh.
10. `DiagramWidget` shall emit a `DiagramInteractionEvent` of type `'node-click'` when a `clickable` node's front-face mesh is clicked, provided an `onInteraction` callback is assigned.
11. The system shall render nodes before edges using painter's algorithm (groups rendered first, then edges, then nodes sorted back-to-front by Z).

## DSL Authoring Surface

### `<Diagram>` — Root Container

```typescript
// packages/diagram/src/elements/diagram/dsl.tsx
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
  /**
   * Pitch tilt in radians applied to the diagram geometry group.
   * Negative = top edge tilts away from viewer. Default: 0.
   */
  tilt?: number;
  /**
   * World-space Z depth of the diagram's geometry plane. Default: 0.
   * Allows diagrams to be composited in front of or behind other scene elements.
   */
  z?: number;
  /** World-space geometry scale multiplier. Default: 1. */
  scale?: number;
  children?: React.ReactNode;
}
```

### `<DiagramNode>` — Node

```typescript
export interface DiagramNodeProps {
  /** Unique ID within the diagram */
  id: string;
  /**
   * Primary label text.
   * Omit on ghost nodes in later scenes — the label is inherited from the
   * prior scene's compiled DiagramNodeState via DiagramWidget.mergeSnapshot().
   */
  label?: string;
  /** Secondary label text rendered below primary in smaller text */
  sublabel?: string;
  /**
   * Geometry shape. Determines the 3D prism rendered for this node.
   * Default: 'rectangle'. See DiagramNodeShape for all variants.
   */
  shape?: DiagramNodeShape;
  /**
   * SVG icon overlaid on the node's front face.
   * Accepts any DiagramIconVariant namespace:
   * flow:*, ui:*, tech:*, security:*, data:*, net:*, aws:*, gcp:*, azure:*, custom:*.
   * 'custom:*' resolves to no icon by default unless a custom resolver is provided.
   */
  icon?: DiagramIconVariant;
  /**
   * Diagram-local position [x, y, z].
   * z controls depth layering. If omitted, auto-layout assigns based on declaration order.
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
  /** Node prism Z-depth as an NVS fraction of diagram viewport width. Default: from theme (darkGlass: 0.150). */
  thickness?: number;
  /** Front-face fill color (CSS hex). Default: from theme */
  color?: string;
  /** Side/box faces color (CSS hex). Default: derived from color via theme sideColorDarkenFactor */
  boxColor?: string;
  /** Legacy alias for boxColor. Both are accepted; boxColor is preferred. */
  sideColor?: string;
  /** Border outline color (CSS hex). Default: derived from color via theme borderColorLightenFactor */
  borderColor?: string;
  /** PBR metalness [0–1]. Default: from theme (darkGlass: 0.40) */
  metalness?: number;
  /** PBR roughness [0–1]. Default: from theme (darkGlass: 0.30) */
  roughness?: number;
  /**
   * Node glow (emissive) override.
   * - Omit: inherit from theme (default behavior)
   * - true: enable with theme-default intensity and color
   * - false: disable glow regardless of theme
   * - object: full control over intensity and color
   */
  glow?: boolean | DiagramNodeGlowConfig;
  /** Corner radius as an NVS fraction of diagram viewport width. Default: from theme (darkGlass: 0.009). */
  cornerRadius?: number;
  /** Label text color (CSS hex). Default: from theme */
  labelColor?: string;
  /** Sublabel text color (CSS hex). Default: '#a0a8c0' */
  sublabelColor?: string;
  /**
   * Label padding as a fraction of the node's content height [0–1].
   * Positive values shift labels downward; negative values shift upward.
   * Default: from theme (defaultLabelPadding, typically 0).
   */
  labelPadding?: number;
  /** Node opacity [0–1]. Default: 1 */
  opacity?: number;
  /** Whether node responds to click/raycast interaction. Default: false */
  clickable?: boolean;
  /** Whether node is rendered. Default: true */
  enabled?: boolean;
  /** Icon scale relative to node face [0–1]. Default: from theme (see DiagramThemeNodeConfig.defaultIconScale). */
  iconScale?: number;
  /**
   * 3D rendering style for the icon on this node's front face.
   * 'flat' uses ShapeGeometry + MeshBasicMaterial (unlit).
   * 'extruded' / 'layered' / 'embossed' use ExtrudeGeometry + MeshStandardMaterial (PBR, lit).
   * Default: from theme (typically 'flat').
   */
  iconStyle?: SvgIcon3DStyle;
  /**
   * Icon extrusion depth in NVS units. Default: from theme (0.15).
   * Only applies when iconStyle !== 'flat'.
   */
  iconDepth?: number;
  /** Runtime mouse-enter handler */
  onMouseEnter?: DiagramNodeMouseHandler;
  /** Runtime mouse-leave handler */
  onMouseLeave?: DiagramNodeMouseHandler;
  /**
   * Named PBR material preset applied to the node's front face via CSM UV projection.
   * Requires @brewsite/textures to be installed and configured.
   */
  surfaceMaterial?: string;
  /** Controls how the material preset textures are applied. See MaterialApplication. */
  materialApplication?: MaterialApplication;
}
```

### `<DiagramEdge>` — Edge / Connector

```typescript
export interface DiagramEdgeProps {
  /** Unique ID within the diagram. Auto-generated as `${from}-${to}-${index}` if absent. */
  id?: string;
  /** ID of the source node. Must match a sibling <DiagramNode id="...">. */
  from: string;
  /** ID of the destination node. Must match a sibling <DiagramNode id="...">. */
  to: string;
  /** Label displayed at edge midpoint */
  label?: string;
  /** Line visual style. Default: 'solid' */
  style?: DiagramEdgeStyle;        // 'solid' | 'dashed' | 'dotted'
  /** Arrowhead at source end. Default: 'none' */
  arrowStart?: DiagramArrowVariant; // 'none' | 'open' | 'filled' | 'diamond' | 'circle'
  /** Arrowhead at destination end. Default: 'open' */
  arrowEnd?: DiagramArrowVariant;
  /** Animated flow direction. Default: 'none' */
  flow?: DiagramEdgeFlow;          // 'none' | 'forward' | 'backward' | 'bidirectional'
  /** Flow pulse color (CSS hex). Defaults to edge color when absent. */
  flowColor?: string;
  /** Edge color (CSS hex). Default: from theme */
  color?: string;
  /** Tube radius as an NVS fraction of diagram viewport width. Default: from theme. */
  thickness?: number;
  /** Edge opacity [0–1]. Default: 1 */
  opacity?: number;
  /**
   * Per-edge routing algorithm override. Overrides the diagram theme's default routing.
   * `routing=\"flow\"` is the canonical obstacle-aware routing mode.
  */
  routing?: EdgeRoutingAlgorithm;  // 'curved' | 'straight' | 'organic' | 'flow'
  /**
   * Explicit attachment port at the source node.
   * When specified, the edge attaches from this face center regardless of the
   * theme's landing algorithm.
   */
  fromPort?: DiagramEdgePort;      // 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back'
  /** Explicit attachment port at the destination node. */
  toPort?: DiagramEdgePort;
  /** Per-edge override for canonical flow turn radius. Only applies when routing='flow'. */
  flowTurnRadius?: number;
  /** Per-edge override for canonical flow face stub length. Only applies when routing='flow'. */
  flowFaceStub?: number;
  /** Per-edge override for how long sibling flow edges remain bundled before splitting. */
  flowBundleStrength?: number;
  /** Per-edge override for how strongly a flow edge prefers direct target ingress after splitting. */
  flowTargetApproachBias?: number;
  /** Enables the flow router's Z underpass escape hatch for this edge. Default: from theme. */
  allowUnderpass?: boolean;
}
```

### `<DiagramGroup>` — Group / Container

```typescript
export interface DiagramGroupProps {
  /** Unique ID within the diagram */
  id: string;
  /** Group header label (optional) */
  label?: string;
  /**
   * Group visual variant. Default: 'boundary'.
   * 'boundary'  — outlined rectangular region.
   * 'cluster'   — shaded container region.
   * 'swimlane'  — lane container with orientation-aware divider (orientation prop applies here).
   * 'container' — borderless region; borderStyle is forced to 'none'.
   */
  variant?: DiagramGroupVariant;   // 'boundary' | 'cluster' | 'swimlane' | 'container'
  /** Swimlane orientation (only for variant='swimlane'). Default: 'vertical' */
  orientation?: DiagramOrientation; // 'horizontal' | 'vertical'
  /** Fill color (CSS hex). Default: from theme */
  color?: string;
  /** Border color (CSS hex). Default: from theme */
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
  /** Runtime mouse-enter handler */
  onMouseEnter?: DiagramGroupMouseHandler;
  /** Runtime mouse-leave handler */
  onMouseLeave?: DiagramGroupMouseHandler;
  /** Optional point lights distributed clockwise around the group border perimeter. */
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
   * Nested <DiagramGroup> children establish sub-groups with their own layout cascade.
   */
  children?: React.ReactNode;
}
```

### `<FlowLayout>` — Sequential Flow Layout

```typescript
export interface FlowLayoutProps {
  /** Primary layout axis. Default: 'top-down' */
  direction?: 'top-down' | 'left-right';
  /** Edge-to-edge gap between adjacent items in NVS fractions. Default: 0.06 */
  gap?: number;
  /** Padding inside group boundary boxes in NVS fractions. Default: 0.035 (all sides) */
  groupPadding?: LayoutPadding;
  /** Gap between group title label and content area in NVS fractions. Default: 0.025 */
  titleGap?: number;
}
```

`<FlowLayout>` places all direct children in a single line in JSX declaration order. Items are positioned along the direction axis with edge-to-edge gap spacing. Cross-axis position is always 0 (center-aligned). Cascades with parent layouts of the same kind.

### `<DiagramExit>` and `<DiagramEnter>` — Transition Declarations

Both components are direct children of `<Diagram>`. At most one `<DiagramExit>` and one `<DiagramEnter>` per diagram.

```typescript
export interface DiagramExitProps {
  /**
   * Target viewport position at end of exit animation, in [0..1] NVS space.
   * Values outside [0..1] move the diagram off-screen.
   * Absent: diagram stays in place (fade only).
   */
  to?: [number, number, number];
  /**
   * If true (default), all node and edge opacities fade to 0 during exit.
   * Set false for translate-only exit.
   */
  fade?: boolean;
  /**
   * Easing function. Default: 'ease' (smooth ease-in-out).
   * 'spring' produces a slight overshoot feel.
   */
  easing?: DiagramEasing; // 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'spring'
}

export interface DiagramEnterProps {
  /**
   * Source viewport position at start of enter animation, in [0..1] NVS space.
   * Values outside [0..1] start the animation from off-screen.
   * Absent: diagram enters from its declared viewportBounds (fade only).
   */
  from?: [number, number, number];
  /**
   * If true (default), all node and edge opacities fade in from 0 during enter.
   */
  fade?: boolean;
  /** Easing function. Default: 'ease'. */
  easing?: DiagramEasing;
}
```

## Compiled State Types

These types are defined in `packages/diagram/src/elements/diagram/types.ts` and exported from `@brewsite/diagram`.

### `DiagramNodeState`

```typescript
export interface DiagramNodeState {
  readonly id: string;
  /**
   * Primary label text.
   * undefined when the label prop was omitted — this node is a ghost node
   * and will inherit label, shape, icon, size, and thickness from the
   * prior scene's DiagramNodeState via DiagramWidget.mergeSnapshot().
   */
  readonly label: string | undefined;
  readonly sublabel: string | undefined;
  readonly shape: DiagramNodeShape;
  /** World-space position after layout resolution. [x, y, z] */
  readonly position: readonly [number, number, number];
  /** Node width and height as NVS fractions [0..1]. */
  readonly size: readonly [number, number];
  /** Physical prism Z-depth as an NVS fraction of diagram viewport width. Converted to world units by render.ts (× uniformWorldW). */
  readonly thickness: number;
  readonly color: string;
  readonly sideColor: string;
  readonly borderColor: string;
  readonly metalness: number;
  readonly roughness: number;
  readonly emissiveIntensity: number;
  readonly emissive: boolean;
  readonly emissiveColor: string;
  readonly cornerRadius: number;
  readonly labelColor: string;
  readonly sublabelColor: string;
  readonly opacity: number;
  readonly clickable: boolean;
  readonly enabled: boolean;
  /**
   * True when this node had no explicit DSL position in a ManualLayout diagram.
   * mergeSnapshot replaces position/size/depth with the previous scene's values.
   * Always false after mergeSnapshot has run.
   */
  readonly positionInherited?: boolean;
  /**
   * Resolved public asset URL for the shape icon, populated at compile time
   * via iconRegistry.resolveIconUrl(shape). Undefined for geometry-only shapes.
   */
  readonly iconUrl: string | undefined;
  readonly iconScale: number;
  readonly iconStyle: SvgIcon3DStyle;
  /** Icon extrusion depth in NVS units. */
  readonly iconDepth: number;
  readonly groupId: string | undefined;
  readonly onMouseEnter?: DiagramNodeMouseHandler;
  readonly onMouseLeave?: DiagramNodeMouseHandler;
}
```

### `DiagramEdgeState`

```typescript
export interface DiagramEdgeState {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly label: string | undefined;
  readonly style: DiagramEdgeStyle;
  readonly arrowStart: DiagramArrowVariant;
  readonly arrowEnd: DiagramArrowVariant;
  readonly color: string;
  readonly flow: DiagramEdgeFlow;
  readonly flowColor: string | undefined;
  readonly thickness: number;
  /**
   * Bezier/CatmullRom control points for the edge path, in world space.
   * Computed by routeEdges() at compile time. Always >= 2 points (start and end).
   * Start and end points are offset from the source/destination node face centers.
   */
  readonly controlPoints: ReadonlyArray<readonly [number, number, number]>;
  readonly opacity: number;
  readonly routing: EdgeRoutingAlgorithm;
  readonly fromPort?: DiagramEdgePort;
  readonly toPort?: DiagramEdgePort;
}
```

### `DiagramGroupState`

```typescript
export interface DiagramGroupState {
  readonly id: string;
  readonly label: string;
  readonly variant: DiagramGroupVariant;
  readonly orientation: DiagramOrientation;
  readonly parentId?: string;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    /** Resolved [top, right, bottom, left] padding as NVS fractions. Already incorporated into x/y/w/h. */
    readonly padding: readonly [number, number, number, number];
    /** Gap between group title label and content area as an NVS fraction. */
    readonly titleGap: number;
  };
  readonly color: string;
  readonly borderColor: string;
  readonly borderWidth: number;
  readonly borderHeight: number;
  readonly borderStyle: 'solid' | 'dashed' | 'none';
  readonly fillOpacity: number;
  readonly borderOpacity: number;
  readonly borderEmissiveColor: string;
  readonly borderEmissiveIntensity: number;
  readonly onMouseEnter?: DiagramGroupMouseHandler;
  readonly onMouseLeave?: DiagramGroupMouseHandler;
  readonly edgeLights?: DiagramGroupEdgeLightsState;
  /** Compiled group title label color. From DiagramGroupDSL.labelColor ?? theme.group.defaultLabelColor. */
  readonly labelColor: string;
}
```

### `DiagramState`

```typescript
export interface DiagramState {
  readonly id: string;
  /** All nodes in render order (back-to-front by Z for correct transparency sorting) */
  readonly nodes: ReadonlyArray<DiagramNodeState>;
  /** All edges. Rendered before nodes (painter's algorithm) */
  readonly edges: ReadonlyArray<DiagramEdgeState>;
  /** All groups. Rendered before edges (painter's algorithm) */
  readonly groups: ReadonlyArray<DiagramGroupState>;
  /**
   * NVS bounds for this diagram in the viewport.
   * { x, y, w, h } in [0..1] fractions of the full viewport.
   * Compiled from the <Diagram x/y/w/h> props.
   * Default: { x: 0, y: 0, w: 1, h: 1 } (fullscreen).
   */
  readonly viewportBounds: NVSRect;
  /**
   * 3D tilt rotation (Euler XYZ radians) for dramatic perspective effects.
   * Default: [0, 0, 0] (flat, facing camera).
   */
  readonly tiltRotation: readonly [number, number, number];
  /**
   * Compiled exit behaviour. undefined = default fade (no position animation).
   * Applied by exitFn in functionalDiagramTransitionSpec.
   */
  readonly exit: DiagramExitConfig | undefined;
  /**
   * Compiled enter behaviour. undefined = default fade.
   * Applied by enterFn in functionalDiagramTransitionSpec.
   */
  readonly enter: DiagramEnterConfig | undefined;
  /** Render-time theme properties resolved at compile time. render.ts reads this struct only. */
  readonly themeConfig: DiagramThemeRenderConfig;
}
```

## Compilation Pipeline

`compileDiagram(dsl: DiagramDSL, fallbackTheme?: DiagramTheme): DiagramState` executes the following 10 steps in order. All steps are pure — no side effects, no Three.js, no React.

**Step 1 — Theme selection.** Use `dsl.theme` if present; otherwise use `fallbackTheme`; otherwise use `darkGlassTheme`. All subsequent steps reference the resolved theme.

**Step 2 — Layout defaults from theme.** Call `resolveThemeLayoutDefaults(theme.layout)` to produce a `ResolvedLayoutDefaults` struct. This merges the theme's layout preferences over the package-level fallback constants. All per-group and root layout resolutions in later steps use this struct as their base.

**Step 3 — Root and group layout resolution.** Call `resolveEffectiveLayout(dsl.layout, undefined, layoutDefaults)` to produce the `rootLayout`. Call `resolveGroupLayouts(dsl.groups, rootLayout, layoutDefaults)` to produce the `groupLayouts` map. Layout cascade follows the rules documented in the Layout System PRD.

**Step 4 — Group membership map construction.** Build `groupMap: Map<string, string>` mapping each node ID to its group ID, extracted from `dsl.groups[].nodeIds`. Emit a `console.warn` if a node ID appears in multiple groups.

**Step 5 — Size and thickness map construction.** Call `buildNodeDefaults(theme)` from `compiler/defaultsCompiler.ts` to get the resolved theme defaults for all node fields. Iterate `dsl.nodes` to build `sizeMap: Map<string, [w, h]>` and `sizeWithDepthMap: Map<string, [w, h, thickness]>`, applying node-level overrides over those defaults. `buildEdgeDefaults(theme)` and `buildGroupDefaults(theme)` follow the same pattern for edges and groups respectively, eliminating lateral coupling between `nodeCompiler.ts` and `groupCompiler.ts`.

**Step 6 — Position resolution via `resolveLayoutWithGroups`.** Call `resolveLayoutWithGroups(nodes, edges, groups, rootLayout, groupLayouts, sizeWithDepthMap)`. This returns a `Map<string, [x, y, z]>` for all nodes that either have explicit positions or are assigned positions by the layout algorithm. Nodes without explicit positions and without auto-layout assignment remain absent from the map; these are ghost nodes.

**Step 7 — Group bounds computation.** Call `resolveGroupBoundsMap(dsl.groups, positions, sizeWithDepthMap, groupLayouts)` to compute a bounding box for each group. Inject each group's center and synthetic size into `positions` and `sizeWithDepthMap` respectively so that edges can route to and from group borders.

**Step 8 — Edge routing.** Call `routeEdges(edgesForRouting, positions, sizeWithDepthMap, theme.edge.routing, theme.edge.landing)` to produce `controlPointsMap: Map<string, ReadonlyArray<[x, y, z]>>`. Each edge ID maps to its computed control points.

**Step 9 — Node, edge, and group compilation + final bounds.** Call `compileNode(node, position, groupId, theme, positionInherited)` for each node (nodes are sorted by Z ascending for back-to-front render order). Call `compileEdge(edge, controlPoints, index, theme)` for each edge. Call `compileGroup(group, bounds, theme)` for each group (groups are sorted by depth and area: shallowest and largest first). Call `computeBounds()` a final time for the diagram-level bounds. Assemble and return `DiagramState`.

## Ghost Node Inheritance

Ghost nodes are nodes in a subsequent scene whose `label` prop is absent (`undefined`) — meaning `DiagramNodeState.label === undefined` after compilation. Nodes with `positionInherited: true` (no explicit `position` in a `ManualLayout` diagram) also receive position inheritance.

`DiagramWidget.mergeSnapshot(prev, next)` runs before the SceneTrack baking phase. The merge logic is implemented as a pure function in `compiler/ghostNodeMerge.ts` and called by `widget.ts` — this separation makes the inheritance rules independently testable without constructing a widget instance.

For each node in `next`:

- If `node.label === undefined`: carry forward `label`, `sublabel`, `shape`, `iconUrl`, `iconScale`, `sublabelColor` from the matching node in `prev` (matched by `id`).
- If `node.positionInherited === true`: additionally carry forward `position`, `size`, `thickness` from `prev`.
- After merge, `positionInherited` is cleared (`undefined`).

Setting `label=""` (explicit empty string) is **not** a ghost node — it produces a node with a blank text label and preserves all other explicitly authored props.

Ghost node declarations are intentionally minimal:

```tsx
// Scene 2: spotlight the CDN node; keep API gateway as context ghost
<Diagram id="infra">
  <DiagramNode id="cdn" label="CDN" color="#4a90e2" opacity={1} />
  <DiagramNode id="api-gw" opacity={0.2} />  {/* ghost: label prop absent → inherits label/shape/position from Scene 1 */}
</Diagram>
```

## Rendering Architecture

Four rendering classes collaborate to produce the Three.js scene. All live in `packages/diagram/src/elements/diagram/rendering/`.

**`DiagramRenderer`** — Orchestrates the other renderers. Maintains a `THREE.Group` per diagram widget ID in the scene. On each `update(state, scene)` call, delegates to `NodeRenderer`, `EdgeRenderer`, and `GroupRenderer` with the appropriate sub-arrays from `DiagramState`. Manages `InteractionRegistry` and `GroupInteractionRegistry` for click and hover hit-testing. Converts NVS positions and sizes to world-space using `uniformWorldW` / `uniformWorldH` — no aspect ratio correction is needed because all sizes are NVS fractions in the same coordinate system.

**`NodeRenderer`** — Manages the Three.js mesh lifecycle for each `DiagramNodeState`. Creates or reuses a box geometry (either `BoxGeometry` for `cornerRadius === 0` or rounded box via `ExtrudeGeometry` for `cornerRadius > 0`). Applies `MeshStandardMaterial` for PBR nodes and `MeshBasicMaterial` for flat-shaded elements. Uses a **fit-to-content layout** algorithm: label position arithmetic (Y offsets, font sizes, Z depth) is computed by the pure `computeNodeLabelLayout()` function in `rendering/nodeLabelLayout.ts`, which returns a `NodeLabelLayout` struct. The layout vertically stacks icon, label, and sublabel within the node's content area, scaling text and icon sizes to fit. `NodeRenderer` applies the result to Troika `Text` meshes for primary and sublabels. Renders icon sprites loaded via `IconLoader` from SVG URLs on the `DiagramNodeState.iconUrl` field; icon size is automatically scaled down by fit-to-content layout when combined with labels. Renders a glow sprite behind the node when `themeConfig.nodeGlowIntensity > 0`.

**Node Sizing Guide:** Nodes require minimum NVS sizes for readable content:

| Content | Minimum Size (NVS) | Notes |
|---------|-------------|-------|
| Label only | `[0.15, 0.08]` | Theme default |
| Label + sublabel | `[0.15, 0.10]` | Two text lines need vertical room |
| Icon + label | `[0.12, 0.12]` | Icon needs vertical space |
| Icon + label + sublabel | `[0.15, 0.12]` | Safe minimum for all three stacking |
| Icon + label + sublabel (circle/hex) | `[0.13, 0.13]` | Polygon content area < bounding box |
| Icon + label + sublabel (diamond) | `[0.15, 0.15]` | Diamond content area ~50% of bbox |

**`EdgeRenderer`** — Manages the Three.js tube geometry lifecycle for each `DiagramEdgeState`. Consumes explicit `DiagramEdgePathCommand[]` from `DiagramEdgeState.path`, building a `CurvePath` from `LineCurve3` and `CubicBezierCurve3` commands instead of inferring spline semantics from control-point counts. Generates arrowhead geometries at `arrowStart` and `arrowEnd` positions (`LatheGeometry` for 3D cones when `themeConfig.use3DArrows`, flat `ShapeGeometry` for 2D arrowheads). Supports dashed material for `style === 'dashed'`. Animates flow pulses via UV offset on a flow-pulse material when `flow !== 'none'`.

**`GroupRenderer`** — Manages the Three.js fill plane and border frame lifecycle for each `DiagramGroupState`. Renders a `PlaneGeometry` fill mesh at the group's computed bounds, applying `MeshBasicMaterial` with `fillOpacity`. Renders a `LineSegments` or frame mesh at the group border using `borderColor` and `borderOpacity`. Distributes `THREE.PointLight` instances along the group's perimeter when `edgeLights` is present. Registers each group's fill mesh with `GroupInteractionRegistry` for hover hit-testing.

## DiagramWidget Contract

```typescript
// packages/diagram/src/elements/diagram/widget.ts

class DiagramWidget
  implements
    ISceneElement<DiagramState>,
    IRenderable<DiagramState>,
    ILoadable,
    INVSBounded,
    IDslComposite,
    ILightingOverride
{
  readonly widgetId: string;
  readonly defaultState: DiagramState;
  readonly transitionSpec = functionalDiagramTransitionSpec;
  readonly DslComponent = Diagram;
  readonly childDslComponents: IDslComposite['childDslComponents'];
  // DiagramNode, DiagramEdge, DiagramGroup, DiagramExit, DiagramEnter,
  // GridLayout, HierarchicalLayout, ManualLayout, FlowLayout

  /**
   * Assign after construction to receive node-click events:
   *   widget.onInteraction = (evt) => { ... };
   */
  public onInteraction: ((event: DiagramInteractionEvent) => void) | undefined;

  constructor(widgetId: string, defaultState: DiagramState);

  // ISceneElement
  // mergeSnapshot: carries ghost node identity and position from prev scene.
  // Ghost node trigger: node.label === undefined (label prop absent in DSL).
  // Position inheritance trigger: node.positionInherited === true.
  mergeSnapshot(prev: DiagramState | undefined, next: DiagramState | undefined): DiagramState | undefined;

  // IRenderable
  // apply: positions the diagramGroup via NVS coords, then calls DiagramRenderer.update()
  apply(state: DiagramState, context: WidgetRenderContext): void;

  // ILoadable
  // load: loads the HDR environment map via DiagramRenderer.loadEnvMap()
  async load(manifest: AssetManifest | null): Promise<void>;
  get isLoaded(): boolean;

  // INVSBounded
  // nvsBounds: returns lastState.viewportBounds (or defaultState if not yet applied)
  get nvsBounds(): NVSRect;

  // ILightingOverride
  // getLightingOverride: returns null (DiagramWidget does not suppress scene lights)
  getLightingOverride(): { disableAll: boolean } | null;
  // receiveLightController: stores the per-light setter for use in hover callbacks
  receiveLightController(setter: (lightId: string, enabled: boolean) => void): void;

  // IDslComposite
  // childDslComponents: registered child component types

  // Canvas action (from diagramPlugin's ActionInputExtension)
  applyCanvasAction(
    action: 'move' | 'rotate' | 'focus' | 'reset',
    dx: number,
    dy: number,
    speed: number,
    focusCenter?: [number, number],
  ): void;

  // Lifecycle
  initialize(context: WidgetInitContext): void;
  dispose(): void;
}
```

**Hover event bubbling.** Mouse-move events bubble from the node level up through the group hierarchy. The pure hover state machine logic is implemented in `compiler/hoverStateMachine.ts` — it computes which nodes and groups have entered or left the hover path given the previous and next hovered IDs, and returns a list of events to dispatch. `widget.ts` calls this function and fires the resulting events; no hover logic lives in `widget.ts` itself. When the cursor moves from one node to another, `node-mouse-leave` fires on the old node then `node-mouse-enter` fires on the new node. Group hover events follow the same bubbling path: `group-mouse-leave` fires on groups no longer in the path; `group-mouse-enter` fires on newly entered groups. `stopPropagation()` on any event halts further dispatching in that cycle.

## Authoring Examples

### Example 1: Simple Manual-Layout Diagram

Four nodes connected in sequence, positioned manually, using the darkGlass theme.

```tsx
import { Diagram, DiagramNode, DiagramEdge, ManualLayout, darkGlassTheme } from '@brewsite/diagram';

function Scene1() {
  return (
    <Scene id="scene-1">
      <Diagram id="pipeline" theme={darkGlassTheme}>
        <ManualLayout />
        <DiagramNode id="ingest" label="Ingest" icon="aws:kinesis" position={[-9, 0, 0]} />
        <DiagramNode id="process" label="Process" icon="aws:lambda" position={[-3, 0, 0]} />
        <DiagramNode id="store" label="Store" icon="aws:s3" position={[3, 0, 0]} />
        <DiagramNode id="serve" label="Serve" icon="aws:cloudfront" position={[9, 0, 0]} />
        <DiagramEdge from="ingest" to="process" flow="forward" />
        <DiagramEdge from="process" to="store" flow="forward" />
        <DiagramEdge from="store" to="serve" flow="forward" />
      </Diagram>
    </Scene>
  );
}
```

### Example 2: Grouped Diagram with GridLayout

Two service groups, each containing auto-layout nodes. The root diagram uses hierarchical layout to place the groups; each group uses grid layout for its members.

```tsx
import {
  Diagram, DiagramNode, DiagramEdge, DiagramGroup,
  HierarchicalLayout, GridLayout, darkGlassTheme,
} from '@brewsite/diagram';

function Scene2() {
  return (
    <Scene id="scene-2">
      <Diagram id="microservices" theme={darkGlassTheme}>
        <HierarchicalLayout direction="top-down" spacing={[3, 4]} />

        <DiagramGroup id="frontend" label="Frontend" variant="boundary">
          <GridLayout columns={2} spacing={[2, 2]} />
          <DiagramNode id="web" label="Web App" icon="tech:react" />
          <DiagramNode id="mobile" label="Mobile" icon="tech:react-native" />
        </DiagramGroup>

        <DiagramGroup id="backend" label="Backend" variant="boundary">
          <GridLayout columns={3} spacing={[2, 2]} />
          <DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" />
          <DiagramNode id="auth" label="Auth" icon="aws:cognito" />
          <DiagramNode id="db" label="Database" icon="aws:rds" />
        </DiagramGroup>

        <DiagramEdge from="web" to="api" arrowEnd="filled" />
        <DiagramEdge from="mobile" to="api" arrowEnd="filled" />
        <DiagramEdge from="api" to="auth" style="dashed" />
        <DiagramEdge from="api" to="db" arrowEnd="filled" />
      </Diagram>
    </Scene>
  );
}
```

### Example 3: Drill-Down Scene with Ghost Nodes and Enter Animation

Scene 3 zooms into the backend group. The CDN and user nodes from Scene 2 are retained as ghosts at reduced opacity. The diagram enters from the right edge with a fade.

```tsx
import {
  Diagram, DiagramNode, DiagramEdge,
  ManualLayout, DiagramEnter, darkGlassTheme,
} from '@brewsite/diagram';

function Scene3() {
  return (
    <Scene id="scene-3">
      {/* viewportBounds fills the full canvas; tilt adds a slight perspective lean */}
      <Diagram id="microservices" theme={darkGlassTheme} tilt={[0.1, 0, 0]}>
        <ManualLayout />
        {/* Full nodes in this scene — explicitly positioned in the expanded view */}
        <DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" position={[0, 2, 0]} />
        <DiagramNode id="auth" label="Auth Service" icon="aws:cognito" position={[-4, -2, 0]} />
        <DiagramNode id="db" label="Database" icon="aws:rds" position={[4, -2, 0]} />
        {/* Ghost nodes — inherit label/shape/position from Scene 2 at reduced opacity */}
        <DiagramNode id="web" opacity={0.15} />
        <DiagramNode id="mobile" opacity={0.15} />
        <DiagramEdge from="api" to="auth" style="dashed" />
        <DiagramEdge from="api" to="db" arrowEnd="filled" />
        {/* Fade in from right on enter */}
        <DiagramEnter from={[1.5, 0.5, 0]} fade easing="spring" />
      </Diagram>
    </Scene>
  );
}
```

## Technical Considerations

- **Group bounds use a synthetic position/size injection.** After `resolveGroupBoundsMap`, each group's center position and border-inset size are injected into the same `positions` and `sizeWithDepthMap` used by `routeEdges`. This allows edges to terminate visually at the group border frame, not at the group center.
- **Edge control points are recomputed on every interpolation tick.** `rerouteLiveEdges` in `transitionHelpers.ts` re-runs edge routing at each blended position during a scene transition. This is necessary for smooth edge motion as nodes move during interpolation.
- **Coordinate normalization is a pure, testable module.** `compiler/normalizeToViewport.ts` performs center + uniform-scale-to-fit + Y-flip on NVS-scale layout output. When a dense layout exceeds [0..1] on either axis, all positions and sizes are uniformly scaled by the same factor to fit within 96% usable area (2% margin per side). The function returns `scaleFactor` (1.0 when no scale-down is needed); the compile pipeline multiplies all NVS dimensional props (thickness, cornerRadius, borderWidth, borderHeight) by `scaleFactor` for proportional down-scaling. It is a pure function with no Three.js or React dependencies and is covered directly by unit tests.
- **Three.js geometry is reused across frames.** `NodeRenderer`, `EdgeRenderer`, and `GroupRenderer` maintain per-ID geometry caches. Geometry is disposed and recreated only when the corresponding state changes structurally (e.g., node shape changes, edge control point count changes).
- **`DiagramRenderer` supports optional `IIconLoader` injection.** Passing an `IIconLoader` implementation to the `DiagramRenderer` constructor overrides the default global icon loader. Tests and consumers that need to control icon loading (e.g., stub out network requests) pass a custom `IIconLoader`. The global `dispose()` side effect that previously ran at module-load time has been removed; disposal is now explicit via `DiagramRenderer.dispose()`.
- **Troika text is loaded asynchronously.** Label text meshes created via `ensureText` (imported directly from `@brewsite/core`) are async. There is no blocking on text load; labels appear as they resolve. This is consistent with the rest of the Three.js rendering model in the toolkit.

## Breaking Change Assessment

Semver impact: **major**.

The 2026-03-08 overhaul introduced multiple breaking changes to the public API surface:

| Change | Before | After |
|---|---|---|
| `DiagramProps.position` | `[number,number,number]` | removed |
| `DiagramProps.rotation` | `[number,number,number]` | removed |
| `DiagramProps.scale` | `number` | removed |
| `DiagramProps.pivot` | `DiagramPivot` | removed |
| `DiagramProps.x/y/w/h` | absent | `number \| undefined` (NVS bounds props, replace `viewportBounds`) |
| `DiagramProps.tilt` | absent | `number \| undefined` (scalar pitch; was `[number,number,number]` in intermediate form) |
| `DiagramProps.z` | absent | `number \| undefined` |
| `DiagramProps.scale` | `number` on `DiagramCanvas` | now on `<Diagram>` directly |
| `DiagramNodeProps.iconDepth` | `number` (NVS units) | `number` (NVS units, absolute depth) |
| `DiagramState.position` | `readonly [number,number,number]` | removed |
| `DiagramState.rotation` | `readonly [number,number,number]` | removed |
| `DiagramState.scale` | `number` | removed |
| `DiagramState.pivot` | `DiagramPivotState` | removed |
| `DiagramState.bounds` | `DiagramBounds` | removed |
| `DiagramState.viewportBounds` | absent | `NVSRect` |
| `DiagramState.tiltRotation` | absent | `readonly [number,number,number]` |
| `DiagramState.exit` | `DiagramExitConfig \| null` | `DiagramExitConfig \| undefined` |
| `DiagramState.enter` | `DiagramEnterConfig \| null` | `DiagramEnterConfig \| undefined` |
| `DiagramExitProps.scaleTo` | `number` | removed |
| `DiagramEnterProps.scaleFrom` | `number` | removed |
| `DiagramGroupProps.labelColor` | absent | `string \| undefined` (new, non-breaking) |
| `DiagramGroupState.labelColor` | absent | `readonly string` (new, non-breaking) |
| `DiagramPivot` type | exported | deleted |
| `DiagramState.contentAspect` | `number` | removed (NVS-native sizing eliminates aspect correction) |
| `DiagramNodeProps.size` | content units for auto-layout, NVS for manual | NVS fractions `[0..1]` for all layout modes |
| `FlowLayoutProps.gap` | content units (default: `2`) | NVS fractions (default: `0.06`) |
| Layout `spacing` | content units (default: `[2, 2]`) | NVS fractions (default: `[0.06, 0.06]`) |
| Layout `groupPadding` | dual: content units or NVS | NVS fractions (default: `0.035`) |
| Layout `titleGap` | dual: content units or NVS | NVS fractions (default: `0.025`) |
| `theme.node.defaultSize` | `[4, 2]` (content units) | `[0.15, 0.08]` (NVS fractions) |
| `DiagramNodeProps.thickness` | content units (e.g. `1.0`) | NVS fractions (e.g. `0.150`) |
| `DiagramEdgeProps.thickness` | content units (e.g. `0.065`) | NVS fractions (e.g. `0.00975`) |
| `theme.node.defaultThickness` | content units | NVS fractions of viewport width |
| `theme.node.cornerRadius` | content units (raw, no conversion) | NVS fractions of viewport width |
| `theme.edge.defaultThickness` | content units | NVS fractions of viewport width |
| `theme.group.defaultBorderWidth` | content units (triple multiplier pipeline) | NVS fractions of viewport width |
| `theme.group.defaultBorderHeight` | content units | NVS fractions of viewport width |
| `normalizeToViewport().thicknessNormFactor` | `scaleFactor × max(defaultNodeSize)` | removed; returns `scaleFactor` only |
| `GROUP_BORDER_PX_TO_UNITS` constant | `0.4` (render-time multiplier) | deleted |

**Migration path.** Replace `position`, `rotation`, `pivot` on `<Diagram>` with `x/y/w/h` NVS props. Move `scale` from `<DiagramCanvas>` to `<Diagram>` directly. Replace `tilt=[x,y,z]` with scalar `tilt` (pitch only). `iconDepth` on `<DiagramNode>` is now an absolute NVS value (no longer a fraction of thickness). Replace null checks on `DiagramState.exit` and `DiagramState.enter` with `undefined` checks. Remove `scaleTo`/`scaleFrom` from `<DiagramExit>`/`<DiagramEnter>` — the equivalent effect is achieved via `to`/`from` with an off-screen NVS coordinate. See `packages/diagram/MIGRATION.md` for step-by-step instructions.

## Open Questions

None at this time. This document reflects the current implemented element.

## Launch Criteria

This is a documentation PRD for an implemented element. The criteria for keeping it current are:

- Updated within one sprint of any change to `DiagramProps`, `DiagramNodeProps`, `DiagramEdgeProps`, `DiagramGroupProps`, `DiagramExitProps`, `DiagramEnterProps`, or any of the compiled state interfaces.
- All TypeScript interfaces in the API Design section remain in sync with `packages/diagram/src/elements/diagram/types.ts` and `dsl.tsx`.
- Authoring examples compile without TypeScript errors against the current package.
- Ghost node merge behavior is covered by at least one test in `packages/diagram/src/elements/diagram/__tests__/`.
