---
title: "BrewSite Diagram — Diagram Element"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-02
change_history:
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the Diagram element DSL, compiled state types, compilation pipeline, ghost-node inheritance, rendering architecture, and widget contract as implemented."
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Breaking DX improvements: depth→thickness prop rename on DiagramNode and DiagramNodeState; emissive/emissiveIntensity/emissiveColor removed, replaced with glow?: boolean|DiagramNodeGlowConfig; Enter/Exit renamed to DiagramEnter/DiagramExit with corresponding prop types DiagramEnterProps/DiagramExitProps; DiagramNodeState.label type changed from string to string|undefined; ghost node trigger changed from label==='' to label===undefined; DiagramWidget removed from public exports. All affected sections updated."
---

# BrewSite Diagram — Diagram Element

## Overview

The `Diagram` element is the primary authoring surface in `@brewsite/diagram`. It is a 3D interactive diagram composed of typed nodes, directed edges, and group containers. Authors declare a diagram in JSX; the compiler resolves layout, routes edges, applies theme defaults, and produces a fully resolved `DiagramState`. `DiagramCanvasWidget` drives this state through Three.js to produce a prism-based 3D visualization that transitions smoothly between scenes. This element is for TypeScript developers building animated architectural, infrastructure, or flow diagrams for immersive 3D marketing scenes.

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

- The `Diagram` element does not manage cross-diagram pipe connectors. That is `DiagramCanvas` and `DiagramPipe`.
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
9. The system shall apply the `pivot` prop to shift all compiled node positions so the chosen pivot point maps to diagram-local `[0, 0, 0]`. Edge routing shall use pivoted positions.
10. Consumers must be able to attach `onMouseEnter` and `onMouseLeave` handlers to `<DiagramNode>` and `<DiagramGroup>` elements, which are invoked at runtime when the cursor enters or leaves the corresponding 3D mesh.
11. `DiagramWidget` shall emit a `DiagramInteractionEvent` of type `'node-click'` when a `clickable` node's front-face mesh is clicked, provided an `onInteraction` callback is assigned.
12. The system shall render nodes before edges using painter's algorithm (groups rendered first, then edges, then nodes sorted back-to-front by Z).

## DSL Authoring Surface

### `<Diagram>` — Root Container

```typescript
// packages/diagram/src/elements/diagram/dsl.tsx
export interface DiagramProps {
  /** Unique diagram ID. Must be stable across scenes. */
  id: string;
  /** World/parent-space position. Default: [0, 0, 0] */
  position?: [number, number, number];
  /** World/parent-space Euler XYZ rotation in radians. Default: [0, 0, 0] */
  rotation?: [number, number, number];
  /** Uniform scale. Default: 1 */
  scale?: number;
  /** Pivot point. Which corner/center maps to diagram-local [0,0,0]. Default: 'center' */
  pivot?: DiagramPivot;
  /**
   * Visual + behavioral theme. Falls back to darkGlassTheme if absent.
   * Per-node / per-edge props take precedence over all theme values.
   */
  theme?: DiagramTheme;
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
  /** Node width and height in diagram units. Default: [4, 2] */
  size?: [number, number];
  /** Physical box thickness (z-depth of the prism) in diagram units. Default: from theme (darkGlass: 0.4) */
  thickness?: number;
  /** Front-face fill color (CSS hex). Default: from theme */
  color?: string;
  /** Side/edge faces color (CSS hex). Default: derived from color (darker) */
  sideColor?: string;
  /** Border outline color (CSS hex). Default: derived from color (lighter) */
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
  /** Corner radius in diagram units for rect shapes. Default: from theme (darkGlass: 0.06) */
  cornerRadius?: number;
  /** Label text color (CSS hex). Default: from theme */
  labelColor?: string;
  /** Sublabel text color (CSS hex). Default: '#a0a8c0' */
  sublabelColor?: string;
  /** Node opacity [0–1]. Default: 1 */
  opacity?: number;
  /** Whether node responds to click/raycast interaction. Default: false */
  clickable?: boolean;
  /** Whether node is rendered. Default: true */
  enabled?: boolean;
  /** Icon scale relative to node face [0–1]. Default: 0.6 */
  iconScale?: number;
  /**
   * 3D rendering style for the icon on this node's front face.
   * 'flat' uses ShapeGeometry + MeshBasicMaterial (unlit).
   * 'extruded' / 'layered' / 'embossed' use ExtrudeGeometry + MeshStandardMaterial (PBR, lit).
   * Default: from theme (typically 'flat').
   */
  iconStyle?: SvgIcon3DStyle;
  /**
   * Max Z extrusion depth for 3D icon geometry in diagram units.
   * Only applies when iconStyle !== 'flat'. Default: 0.15. Sensible range: 0.05–0.25.
   */
  iconDepth?: number;
  /** Runtime mouse-enter handler */
  onMouseEnter?: DiagramNodeMouseHandler;
  /** Runtime mouse-leave handler */
  onMouseLeave?: DiagramNodeMouseHandler;
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
  /** Tube radius in diagram units. Default: from theme */
  thickness?: number;
  /** Edge opacity [0–1]. Default: 1 */
  opacity?: number;
  /**
   * Per-edge routing algorithm override. Overrides the diagram theme's default routing.
   * Useful for mixing curved and orthogonal edges in the same diagram.
   */
  routing?: EdgeRoutingAlgorithm;  // 'curved' | 'orthogonal' | 'straight' | 'organic'
  /**
   * Explicit attachment port at the source node.
   * When specified, the edge attaches from this face center regardless of the
   * theme's landing algorithm.
   */
  fromPort?: DiagramEdgePort;      // 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back'
  /** Explicit attachment port at the destination node. */
  toPort?: DiagramEdgePort;
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
  /**
   * Child <DiagramNode> and <DiagramGroup> elements that belong to this group.
   * Group bounds are computed from the union of child node positions + sizes.
   * Nested <DiagramGroup> children establish sub-groups with their own layout cascade.
   */
  children?: React.ReactNode;
}
```

### `<DiagramExit>` and `<DiagramEnter>` — Transition Declarations

Both components are direct children of `<Diagram>`. At most one `<DiagramExit>` and one `<DiagramEnter>` per diagram.

```typescript
export interface DiagramExitProps {
  /**
   * Target position in parent space at the end of the exit (t=1).
   * Absent: diagram stays at its declared position (scale/fade only).
   */
  to?: [number, number, number];
  /**
   * If true (default), all node and edge opacities fade to 0 during exit.
   * Set false for translate/scale-only exit.
   */
  fade?: boolean;
  /**
   * Target scale factor at exit t=1. e.g., scaleTo={0} shrinks to a point.
   * Absent: scale is not animated.
   */
  scaleTo?: number;
  /**
   * Easing function. Default: 'ease' (smooth ease-in-out).
   * 'spring' produces a slight overshoot feel.
   */
  easing?: DiagramEasing; // 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'spring'
}

export interface DiagramEnterProps {
  /**
   * Source position in parent space at the start of the enter (t=0).
   * Absent: diagram enters from its declared position (scale/fade only).
   */
  from?: [number, number, number];
  /**
   * If true (default), all node and edge opacities fade in from 0 during enter.
   */
  fade?: boolean;
  /**
   * Source scale factor at enter t=0. e.g., scaleFrom={0} grows from a point.
   */
  scaleFrom?: number;
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
  /** World-space position after layout + pivot offset. [x, y, z] */
  readonly position: readonly [number, number, number];
  /** Node width and height in diagram units. */
  readonly size: readonly [number, number];
  /** Physical prism z-depth in diagram units. */
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
    /** Resolved [top, right, bottom, left] padding in diagram units. Already incorporated into x/y/w/h. */
    readonly padding: readonly [number, number, number, number];
    /** Gap between group title label and content area in diagram units. */
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
   * Computed bounding box of the entire diagram in diagram units.
   * In DIAGRAM-LOCAL coordinates after pivot offset is applied.
   * Used by DiagramWidget.onTick() for camera auto-framing when no Camera widget is active.
   */
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly minZ: number;
    readonly maxZ: number;
  };
  /** World/parent-space position of the diagram group origin. */
  readonly position: readonly [number, number, number];
  /** World/parent-space Euler XYZ rotation in radians. */
  readonly rotation: readonly [number, number, number];
  /** Uniform scale factor. Default: 1. */
  readonly scale: number;
  readonly pivot: DiagramPivot;
  /**
   * Compiled exit config, or null for default fade.
   * Applied by exitFn in functionalDiagramTransitionSpec.
   */
  readonly exit: DiagramExitConfig | null;
  /**
   * Compiled enter config, or null for default fade.
   * Applied by enterFn in functionalDiagramTransitionSpec.
   */
  readonly enter: DiagramEnterConfig | null;
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

**Step 5 — Size and thickness map construction.** Iterate `dsl.nodes` to build `sizeMap: Map<string, [w, h]>` and `sizeWithDepthMap: Map<string, [w, h, thickness]>`, applying node-level overrides over theme defaults.

**Step 6 — Position resolution via `resolveLayoutWithGroups`.** Call `resolveLayoutWithGroups(nodes, edges, groups, rootLayout, groupLayouts, sizeWithDepthMap)`. This returns a `Map<string, [x, y, z]>` for all nodes that either have explicit positions or are assigned positions by the layout algorithm. Nodes without explicit positions and without auto-layout assignment remain absent from the map; these are ghost nodes.

**Step 7 — Pivot offset calculation.** Call `computeBounds(nodeIds, positions, sizeWithDepthMap)` on the raw (pre-pivot) positions to get `rawBounds`. Call `compilePivotOffset(rawBounds, pivot)` to compute the translation offset `[ox, oy, oz]`. Apply the offset to every position in the map in place. All subsequent steps use pivoted positions.

**Step 8 — Group bounds computation.** Call `resolveGroupBoundsMap(dsl.groups, positions, sizeWithDepthMap, groupLayouts)` to compute a bounding box for each group. Inject each group's center and synthetic size into `positions` and `sizeWithDepthMap` respectively so that edges can route to and from group borders.

**Step 9 — Edge routing.** Call `routeEdges(edgesForRouting, positions, sizeWithDepthMap, theme.edge.routing, theme.edge.landing)` to produce `controlPointsMap: Map<string, ReadonlyArray<[x, y, z]>>`. Each edge ID maps to its computed control points.

**Step 10 — Node, edge, and group compilation + final bounds.** Call `compileNode(node, position, groupId, theme, positionInherited)` for each node (nodes are sorted by Z ascending for back-to-front render order). Call `compileEdge(edge, controlPoints, index, theme)` for each edge. Call `compileGroup(group, bounds, theme)` for each group (groups are sorted by depth and area: shallowest and largest first). Call `computeBounds()` a final time for the diagram-level bounds. Assemble and return `DiagramState`.

## Ghost Node Inheritance

Ghost nodes are nodes in a subsequent scene whose `label` prop is absent (`undefined`) — meaning `DiagramNodeState.label === undefined` after compilation. Nodes with `positionInherited: true` (no explicit `position` in a `ManualLayout` diagram) also receive position inheritance.

`DiagramWidget.mergeSnapshot(prev, next)` runs before the SceneTrack baking phase. For each node in `next`:

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

**`DiagramRenderer`** — Orchestrates the other renderers. Maintains a `THREE.Group` per diagram widget ID in the scene. On each `update(state, scene)` call, delegates to `NodeRenderer`, `EdgeRenderer`, and `GroupRenderer` with the appropriate sub-arrays from `DiagramState`. Manages `InteractionRegistry` and `GroupInteractionRegistry` for click and hover hit-testing.

**`NodeRenderer`** — Manages the Three.js mesh lifecycle for each `DiagramNodeState`. Creates or reuses a box geometry (either `BoxGeometry` for `cornerRadius === 0` or rounded box via `ExtrudeGeometry` for `cornerRadius > 0`). Applies `MeshStandardMaterial` for PBR nodes and `MeshBasicMaterial` for flat-shaded elements. Renders Troika `Text` meshes for primary and sublabels. Renders icon sprites loaded via `IconLoader` from SVG URLs on the `DiagramNodeState.iconUrl` field. Renders a glow sprite behind the node when `themeConfig.nodeGlowIntensity > 0`.

**`EdgeRenderer`** — Manages the Three.js tube geometry lifecycle for each `DiagramEdgeState`. Constructs `CatmullRomCurve3` from `controlPoints` and wraps it in a `TubeGeometry`. Generates arrowhead geometries at `arrowStart` and `arrowEnd` positions (`LatheGeometry` for 3D cones when `themeConfig.use3DArrows`, flat `ShapeGeometry` for 2D arrowheads). Supports dashed material for `style === 'dashed'`. Animates flow pulses via UV offset on a flow-pulse material when `flow !== 'none'`.

**`GroupRenderer`** — Manages the Three.js fill plane and border frame lifecycle for each `DiagramGroupState`. Renders a `PlaneGeometry` fill mesh at the group's computed bounds, applying `MeshBasicMaterial` with `fillOpacity`. Renders a `LineSegments` or frame mesh at the group border using `borderColor` and `borderOpacity`. Distributes `THREE.PointLight` instances along the group's perimeter when `edgeLights` is present. Registers each group's fill mesh with `GroupInteractionRegistry` for hover hit-testing.

## DiagramWidget Contract

```typescript
// packages/diagram/src/elements/diagram/widget.ts

class DiagramWidget
  implements ISceneElement<DiagramState>, IRenderable<DiagramState>, IAnimationController, IDslComposite
{
  readonly widgetId: string;
  readonly defaultState: DiagramState;
  readonly transitionSpec = functionalDiagramTransitionSpec;
  readonly DslComponent = Diagram;
  readonly childDslComponents: IDslComposite['childDslComponents']; // DiagramNode, DiagramEdge, DiagramGroup, DiagramExit, DiagramEnter, GridLayout, HierarchicalLayout, ManualLayout

  /**
   * tickPriority = 1: runs after CameraWidget (tickPriority = 0).
   * Ensures the scene camera has been positioned before DiagramWidget evaluates
   * whether camera auto-framing is needed.
   */
  readonly tickPriority = 1;

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
  // apply: calls DiagramRenderer.update(state, scene) on every engine tick
  apply(state: DiagramState, context: WidgetRenderContext): void;

  // IAnimationController
  // onTick: auto-frames the scene camera from DiagramState.bounds when no Camera widget is active
  onTick(context: AnimationTickContext): void;

  // IDslComposite
  // childDslComponents: array of {component, displayName, topLevelError} for all child DSL types

  // Lifecycle
  initialize(context: WidgetInitContext): void;
  dispose(): void;
}
```

**Camera auto-framing (`onTick`).** When the current tick's `CameraState.enabled` is `false` (or no Camera widget is present), `DiagramWidget.onTick` computes a framing camera position from `DiagramState.bounds`, `position`, `scale`, and `rotation`. It reads the scene camera from `scene.userData['__brewsite_camera']`. This ensures diagrams are always visible even without an explicit `<Camera>` DSL element in the scene.

**Hover event bubbling.** Mouse-move events bubble from the node level up through the group hierarchy. When the cursor moves from one node to another, `dispatchNodeHover` fires `node-mouse-leave` on the old node then `node-mouse-enter` on the new node. Group hover events follow the same bubbling path: `group-mouse-leave` fires on groups no longer in the path; `group-mouse-enter` fires on newly entered groups. `stopPropagation()` on any event halts further dispatching in that cycle.

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

Scene 3 zooms into the backend group. The CDN and user nodes from Scene 2 are retained as ghosts at reduced opacity. New nodes appear with a scale-up enter animation.

```tsx
import {
  Diagram, DiagramNode, DiagramEdge,
  ManualLayout, DiagramEnter, darkGlassTheme,
} from '@brewsite/diagram';

function Scene3() {
  return (
    <Scene id="scene-3">
      <Diagram id="microservices" theme={darkGlassTheme} scale={1.5}>
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
        {/* Scale up from zero on enter */}
        <DiagramEnter scaleFrom={0.2} fade easing="spring" />
      </Diagram>
    </Scene>
  );
}
```

## Technical Considerations

- **Pivot offset is compile-time.** All compiled `DiagramNodeState.position` values are already in pivoted space. The pivot offset is not stored separately; it is baked into every position. This simplifies the renderer and ensures that `bounds` in `DiagramState` is always in the same coordinate system as node positions.
- **Group bounds use a synthetic position/size injection.** After `resolveGroupBoundsMap`, each group's center position and border-inset size are injected into the same `positions` and `sizeWithDepthMap` used by `routeEdges`. This allows edges to terminate visually at the group border frame, not at the group center.
- **Edge control points are recomputed on every interpolation tick.** `rerouteLiveEdges` in `transitionHelpers.ts` re-runs edge routing at each blended position during a scene transition. This is necessary for smooth edge motion as nodes move during interpolation.
- **Three.js geometry is reused across frames.** `NodeRenderer`, `EdgeRenderer`, and `GroupRenderer` maintain per-ID geometry caches. Geometry is disposed and recreated only when the corresponding state changes structurally (e.g., node shape changes, edge control point count changes).
- **Troika text is loaded asynchronously.** Label text meshes created by `TextRenderer` are async. There is no blocking on text load; labels appear as they resolve. This is consistent with the rest of the Three.js rendering model in the toolkit.

## Breaking Change Assessment

Semver impact: **none** (documentation of implemented behavior).

## Open Questions

None at this time. This document reflects the current implemented element.

## Launch Criteria

This is a documentation PRD for an implemented element. The criteria for keeping it current are:

- Updated within one sprint of any change to `DiagramProps`, `DiagramNodeProps`, `DiagramEdgeProps`, `DiagramGroupProps`, `DiagramExitProps`, `DiagramEnterProps`, or any of the compiled state interfaces.
- All TypeScript interfaces in the API Design section remain in sync with `packages/diagram/src/elements/diagram/types.ts` and `dsl.tsx`.
- Authoring examples compile without TypeScript errors against the current package.
- Ghost node merge behavior is covered by at least one test in `packages/diagram/src/elements/diagram/__tests__/`.
