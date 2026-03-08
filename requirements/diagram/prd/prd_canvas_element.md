---
title: "BrewSite Diagram — Canvas Element"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-08
change_history:
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "Coordinate system audit: documented dev-mode nvsBounds guard in Guardrail Metrics. compileCanvas() now emits console.error in NODE_ENV !== 'production' when nvsBounds values fall outside [0,1]."
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "NVS system: DiagramCanvasWidget implements INVSBounded. DiagramCanvasProps gains optional x?, y?, w?, h? NVS props (default fullscreen). DiagramCanvasState gains optional nvsBounds field. API Design and Technical Considerations sections updated. Non-Goals updated."
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the @brewsite/diagram DiagramCanvas element as implemented."
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Breaking DX improvements: diagramPlugin() eliminates manual DiagramCanvasWidget pre-registration (FR 1 updated); ghost node trigger changed from label==='' to label===undefined (mergeSnapshot section updated); depth renamed to thickness in mergeSnapshot carry-forward list; Widget Registration Pattern replaced with diagramPlugin() pattern."
  - date: 2026-03-03
    author: "Toolkit Product"
    summary: "Added theme-level default input handler support: DiagramCanvasState.defaultInputActions field, DiagramCanvasWidget implements IInputDefaultProvider, defaultDiagramCanvasInputActions convenience export, IGNORED_INPUT_CONFIG warning documented."
---

# BrewSite Diagram — Canvas Element

## Overview

`DiagramCanvas` is the primary world-space integration container for `@brewsite/diagram`. It hosts one or more `Diagram` elements in a shared coordinate frame and enables cross-diagram pipe connectors (`DiagramPipe`) between nodes in sibling diagrams. `DiagramCanvasWidget` is the widget class consumers register with `WidgetRegistry` — one instance per unique `DiagramCanvas` id. This feature lives entirely in `@brewsite/diagram`; `@brewsite/core` has no knowledge of the canvas element.

## Problem Statement

A `Diagram` element in isolation renders in world space at a single position. When a scene requires multiple diagrams that must move together as a unit, share a theme, and be visually connected by cross-diagram edges, there is no mechanism to group them without duplicating position/rotation/scale logic across every scene declaration. Separately, edges cannot reach across diagram boundaries — a cross-diagram connector has no compile-time knowledge of node positions in a sibling diagram.

`DiagramCanvas` solves both gaps: it provides a single transform that positions all child diagrams as a unit, and it enables `DiagramPipe` to resolve node positions from compiled child `DiagramState` objects and route connectors in canvas-local space at compile time.

## Goals & Success Metrics

**Primary metrics:**
- Consumers can position two or more diagrams relative to each other with a single `position`/`rotation`/`scale` set at the canvas level, and the entire composition moves correctly across scenes.
- A `DiagramPipe` connecting `"frontend.browser"` to `"backend.api"` resolves at compile time to a routed `controlPoints` array with zero runtime cost.
- Camera auto-framing in the absence of a Camera widget frames all child diagrams without consumer configuration.

**Guardrail metrics:**
- No Three.js import in `canvas/types.ts`, `canvas/dsl.tsx`, or `canvas/compile.ts`.
- Unresolvable `DiagramPipe` dot notation references emit `console.warn` and produce a pipe with empty `controlPoints` — the compiler does not throw, and playback continues.
- `DiagramCanvasWidget.dispose()` removes all child diagram Three.js objects and DOM event listeners without memory leaks.
- `compileCanvas()` emits `console.error` in `NODE_ENV !== 'production'` when any `nvsBounds` component violates the [0,1] contract (`x < 0`, `y < 0`, `w ≤ 0`, `h ≤ 0`, `x + w > 1`, or `y + h > 1`). The error message includes the canvas id and the offending values. This guard does not throw — compilation continues and the out-of-range bounds are passed through.

## Non-Goals

- `DiagramCanvas` does not implement camera animation. Camera movement is the responsibility of the `@brewsite/core` Camera widget or the canvas auto-framing heuristic. It does not expose orbit controls directly.
- The canvas does not manage lighting. Lighting configuration belongs to the `@brewsite/core` Lighting widget.
- `DiagramPipe` does not support intra-diagram connections. Connections between nodes within the same `<Diagram>` are `<DiagramEdge>` elements.
- The canvas does not support dynamic child addition at runtime. Children are declared at DSL authoring time and compiled into the SceneTrack.

## Consumer Stories

- As a toolkit consumer, I want to group multiple diagrams under a single canvas transform so that one `position`/`rotation`/`scale` value moves the entire visualization as a unit across scene transitions.
- As a toolkit consumer, I want to declare a cross-diagram pipe connector using dot notation (`"diagramId.nodeId"`) so that nodes in different sibling diagrams appear visually connected.
- As a toolkit consumer, I want the canvas-level theme to propagate as a default to all child diagrams so that I can define a consistent visual style once without repeating it per diagram.
- As a toolkit consumer, I want camera auto-framing to work without configuring a Camera widget so that simple canvas scenes display correctly with zero camera setup.
- As a toolkit consumer, I want `DiagramPipe` routing to attach to node side faces rather than the front face so that pipe connectors do not obscure node icons and labels.

## Functional Requirements

1. `DiagramCanvasWidget` instances are auto-registered at compile time by `diagramPlugin()` when the `DiagramCanvas` handler encounters a new canvas id. No manual widget pre-registration in `widgetSetup.ts` is required for canvas elements.
2. The canvas `theme` prop shall propagate as `fallbackTheme` to all child `<Diagram>` elements that do not specify their own `theme`.
3. Canvas `position`, `rotation`, and `scale` shall transform all child diagram groups and pipe renderers as a single `THREE.Group` in world space.
4. `DiagramPipe` dot notation (`"diagramId.nodeId"`) shall be validated at compile time. An invalid reference (missing diagram id, missing node id, or malformed dot notation) shall emit `console.warn` and produce a `DiagramPipeState` with `controlPoints: []` (rendered as invisible). The compiler must not throw.
5. Pipe routing with `pipeLanding: 'sides'` shall attach to the left or right face of each node based on which side faces the target diagram's canvas-local X position, routing around the front (+Z) face where icons and labels render.
6. Pipe routing with `pipeLanding: 'nearest-face'` shall use the same face-selection logic as intra-diagram edges, operating in canvas-local space.
7. The `pipeRouting: 'curved'` algorithm shall produce a CatmullRom arc using `controlPoints` pre-baked at compile time.
8. The `pipeRouting: 'straight'` algorithm shall produce a direct line between side-face attachment points.
9. When no Camera widget is active (determined by `camera.enabled !== true` in the current tick state), `DiagramCanvasWidget.onTick()` shall compute camera position and look-at by framing the union of all child diagram bounds transformed to canvas space.
10. `DiagramCanvasWidget.dispose()` shall remove all child diagram Three.js objects from the scene, deregister all event listeners on the WebGL canvas element, and call `clearDiagramFocusRegion` for the widget's canvas id.
11. The canvas renderer shall handle child diagram removal between ticks by disposing `DiagramRenderer` instances for diagrams no longer present in the new state.

## API Design

### DSL Components

```typescript
// packages/diagram/src/elements/diagram/canvas/dsl.tsx

export interface DiagramCanvasProps {
  /**
   * Unique canvas ID. The DiagramCanvasWidget must be registered with this
   * exact id in widgetSetup.ts before ScenePlayer mounts.
   */
  id: string;
  /** World-space position [x, y, z]. Default: [0, 0, 0] */
  position?: [number, number, number];
  /** World-space Euler XYZ rotation in radians. Default: [0, 0, 0] */
  rotation?: [number, number, number];
  /**
   * Uniform scale for the entire canvas group.
   * Child diagram positions, scales, and pipe thicknesses all scale with this.
   * Default: 1
   */
  scale?: number;
  /**
   * Canvas-level theme. Acts as the default theme for all child <Diagram>
   * elements. Each child can override with its own theme prop.
   * Falls back to darkGlassTheme when absent.
   */
  theme?: DiagramTheme;
  /** Pipe routing algorithm for cross-diagram connectors. Default: 'curved' */
  pipeRouting?: PipeRoutingAlgorithm;
  /**
   * Pipe attachment strategy. Default: 'sides' (left/right face based on
   * relative diagram X position — routes around front-face icons/labels).
   */
  pipeLanding?: PipeLandingAlgorithm;
  /**
   * Optional world-space center used when a canvas focus action targets the
   * full canvas (e.g. Cmd+click on empty canvas area).
   */
  focusCenter?: [number, number] | [number, number, number];

  /**
   * NVS sub-region occupied by this canvas in the EngineARContainer.
   * All values are ratios in [0, 1] relative to the AR-locked container.
   * When absent, the canvas is fullscreen: x=0, y=0, w=1, h=1.
   *
   * DiagramCanvasWidget implements INVSBounded. The raycaster uses these
   * bounds to restrict hit-testing to the canvas's declared viewport region.
   */
  x?: number;
  y?: number;
  w?: number;
  h?: number;

  children?: React.ReactNode;
}

export function DiagramCanvas(_props: DiagramCanvasProps): null;

export interface DiagramPipeProps {
  /**
   * Auto-generated id if omitted: "pipe-{from}--{to}-{index}" with dots
   * replaced by dashes.
   */
  id?: string;
  /**
   * Source node in dot notation: "diagramId.nodeId"
   * The diagramId must match a <Diagram id="..."> sibling inside this canvas.
   */
  from: string;
  /** Destination node in dot notation: "diagramId.nodeId" */
  to: string;
  /** Optional label at the pipe midpoint. */
  label?: string;
  /** Line visual style. Default: 'solid' */
  style?: DiagramEdgeStyle;
  /** Arrowhead at source. Default: 'none' */
  arrowStart?: DiagramArrowVariant;
  /** Arrowhead at destination. Default: 'open' */
  arrowEnd?: DiagramArrowVariant;
  /** Pipe color (CSS hex). Default: DIAGRAM_PIPE_DEFAULT_COLOR ('#3d5a9a') */
  color?: string;
  /** Tube radius in canvas units. Default: 0.08 */
  thickness?: number;
  /** Opacity [0–1]. Default: 1 */
  opacity?: number;
}

export function DiagramPipe(_props: DiagramPipeProps): null;
```

### Routing Algorithm Types

```typescript
// packages/diagram/src/elements/diagram/canvas/types.ts

/**
 * Pipe routing algorithm for cross-diagram pipes within a canvas.
 * 'curved'   — CatmullRom arc through 3D canvas space (default)
 * 'straight' — direct line between side-face attachment points
 */
export type PipeRoutingAlgorithm = 'curved' | 'straight';

/**
 * Pipe attachment strategy for cross-diagram connectors.
 * 'sides'        — attach to left or right face based on relative diagram X
 *                  position (default). Routes around the front face where
 *                  icons and labels are rendered.
 * 'nearest-face' — use the same nearest-face logic as intra-diagram edges,
 *                  operating in canvas-local space.
 */
export type PipeLandingAlgorithm = 'sides' | 'nearest-face';
```

### Compiled State Types

```typescript
// packages/diagram/src/elements/diagram/canvas/types.ts

export const DIAGRAM_PIPE_DEFAULT_COLOR = '#3d5a9a';

export interface DiagramPipeState {
  readonly id: string;
  readonly fromDiagramId: string;
  readonly fromNodeId: string;
  readonly toDiagramId: string;
  readonly toNodeId: string;
  readonly label: string | undefined;
  readonly style: DiagramEdgeStyle;
  readonly arrowStart: DiagramArrowVariant;
  readonly arrowEnd: DiagramArrowVariant;
  readonly color: string;
  readonly thickness: number;
  readonly opacity: number;
  /**
   * CatmullRom control points in canvas-local space.
   * Computed at compile time from endpoint node positions and diagram transforms.
   * Empty array indicates an unresolvable pipe reference (rendered invisible).
   */
  readonly controlPoints: ReadonlyArray<readonly [number, number, number]>;
}

export interface DiagramCanvasState {
  readonly id: string;
  /** Canvas world-space position. Default: [0, 0, 0] */
  readonly position: readonly [number, number, number];
  /** Canvas world-space Euler XYZ rotation in radians. Default: [0, 0, 0] */
  readonly rotation: readonly [number, number, number];
  /** Canvas uniform scale. Default: 1 */
  readonly scale: number;
  /**
   * Optional focus center (XY or XYZ) in world space.
   * Z component is accepted but only XY is used for canvas-wide focus framing.
   */
  readonly focusCenter?: readonly [number, number] | readonly [number, number, number];
  /** All child diagram states, in declaration order. */
  readonly diagrams: ReadonlyArray<DiagramState>;
  /** All cross-diagram pipe states. */
  readonly pipes: ReadonlyArray<DiagramPipeState>;
  /**
   * Default input actions derived from theme.input at compile time.
   * canvasId has been injected by the compiler from the <DiagramCanvas id="...">.
   * Undefined when no theme.input is configured on the canvas.
   * Consumed by DiagramCanvasWidget.getDefaultInputActions() at runtime.
   */
  readonly defaultInputActions?: ReadonlyArray<InputActionSpec>;

  /**
   * NVS bounds for this canvas. Derived from the x, y, w, h DSL props at compile time.
   * Defaults to { x: 0, y: 0, w: 1, h: 1 } (fullscreen) when no NVS props are declared.
   * Read by DiagramCanvasWidget.nvsBounds to implement INVSBounded.
   */
  readonly nvsBounds: NVSRect;
}

/** Raw DSL props for <DiagramCanvas> before compile.ts applies defaults. */
export interface DiagramCanvasDSL {
  readonly id: string;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly theme?: DiagramTheme;
  readonly pipeRouting?: PipeRoutingAlgorithm;
  readonly pipeLanding?: PipeLandingAlgorithm;
  readonly focusCenter?: readonly [number, number] | readonly [number, number, number];
}

/** Raw DSL props for <DiagramPipe> before compile.ts applies defaults. */
export interface DiagramPipeDSL {
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
```

### Compile Functions

```typescript
// packages/diagram/src/elements/diagram/canvas/compile.ts

/**
 * Compiles a single DiagramPipeDSL into a DiagramPipeState.
 * Resolves from/to node positions from the compiled DiagramState array
 * and routes the pipe in canvas-local space.
 *
 * With pipeLanding='sides' (default), attaches to the left or right face
 * of each node based on which side faces the target diagram, routing
 * around the front-face icons and labels.
 *
 * Emits console.warn for unresolvable references and returns a pipe with
 * empty controlPoints rather than throwing.
 */
export function compilePipe(
  dsl: DiagramPipeDSL,
  diagrams: ReadonlyArray<DiagramState>,
  index: number,
  routing?: PipeRoutingAlgorithm,
  landing?: PipeLandingAlgorithm,
): DiagramPipeState;

/**
 * Two-pass compilation for DiagramCanvas.
 * Pass 1: child diagrams are already compiled (caller provides DiagramState[]).
 * Pass 2: compile DiagramPipe elements using node positions from pass 1.
 *
 * Called by the DiagramCanvas compiler handler in handlers.ts after it has
 * compiled all child Diagram elements via compileDiagram().
 *
 * The optional defaultInputActions parameter carries pre-processed input actions
 * (with canvasId already injected) from theme.input. When absent, the returned
 * DiagramCanvasState has no defaultInputActions field.
 */
export function compileCanvas(
  dsl: DiagramCanvasDSL,
  diagrams: ReadonlyArray<DiagramState>,
  pipes: ReadonlyArray<DiagramPipeDSL>,
  onWarn?: DiagramWarnFn,
  defaultInputActions?: ReadonlyArray<InputActionSpec>,
): DiagramCanvasState;

/**
 * Functional transition spec for DiagramCanvasState.
 * - Canvas position/rotation/scale: linearly interpolated.
 * - Child diagrams: blended node-by-node, edges rerouted live.
 * - Pipes: opacity interpolated; control points rerouted live from
 *   interpolated diagram node positions.
 * - Diagrams entering: applyDiagramEnter (fade in).
 * - Diagrams exiting: applyDiagramExit (fade out).
 */
export const functionalDiagramCanvasTransitionSpec: FunctionalTransitionSpec<DiagramCanvasState>;
```

### Widget Class

```typescript
// packages/diagram/src/elements/diagram/canvas/widget.ts

export class DiagramCanvasWidget
  implements
    ISceneElement<DiagramCanvasState>,
    IRenderable<DiagramCanvasState>,
    IAnimationController,
    IInputDefaultProvider,
    INVSBounded
{
  readonly widgetId: string;
  readonly defaultState: DiagramCanvasState;
  readonly transitionSpec: FunctionalTransitionSpec<DiagramCanvasState>;
  readonly DslComponent: typeof DiagramCanvas;
  readonly tickPriority: number; // 1

  /**
   * Optional callback for node-click events within any child diagram.
   * Assign after construction in widgetSetup.ts.
   */
  public onInteraction: ((event: DiagramInteractionEvent) => void) | undefined;

  /**
   * Implements INVSBounded. Returns the NVS bounds from the most recently
   * applied DiagramCanvasState. Before any state has been applied, returns
   * { x: 0, y: 0, w: 1, h: 1 } (fullscreen default).
   *
   * The raycaster uses these bounds to restrict hit-testing to the sub-region
   * of the viewport this canvas occupies. The EngineARContainer uses these
   * bounds to auto-frame the camera to the declared region.
   */
  readonly nvsBounds: NVSRect;

  constructor(widgetId: string, defaultState: DiagramCanvasState);

  initialize(context: WidgetInitContext): void;

  /**
   * Camera auto-framing: computes world-space bounds over all child diagrams
   * and positions the camera to show everything. Yields to a Camera widget
   * if one is active (camera.enabled === true in current tick state).
   */
  onTick(context: AnimationTickContext): void;

  /**
   * Applies canvas state to Three.js scene via DiagramCanvasRenderer.
   * Merges inputTranslation and inputRotation offsets from ActionInputController
   * before passing state to the renderer. Also updates currentInputActions from
   * state.defaultInputActions so getDefaultInputActions() reflects the current scene.
   */
  apply(state: DiagramCanvasState, context: WidgetRenderContext): void;

  /**
   * Returns the current scene's default input actions.
   * Returns the value updated by the most recent apply() call — never defaultState.
   * Returns an empty array when no defaultInputActions are configured in the theme.
   * Implements IInputDefaultProvider from @brewsite/core.
   */
  getDefaultInputActions(): InputActionSpec[];

  /**
   * Ghost-node merge: carries forward label/shape/iconUrl for empty-label
   * ghost nodes in each child diagram across scene transitions.
   */
  mergeSnapshot(
    prev: DiagramCanvasState | undefined,
    next: DiagramCanvasState | undefined,
  ): DiagramCanvasState | undefined;

  dispose(): void;

  /** Apply orbit/pan input offset (from ActionInputController). */
  applyInputMove(dx: number, dy: number, dz?: number): void;
  applyInputRotate(rx: number, ry: number, rz?: number): void;
  resetInputTransform(): void;

  /**
   * Focus the camera on a specific group (by raycasting) or the full canvas.
   * Called by ActionInputController on focus action.
   */
  applyInputFocus(
    clientX: number,
    clientY: number,
    focusCenter?: [number, number] | [number, number, number] | readonly [number, number] | readonly [number, number, number],
  ): void;
}
```

### Plugin Setup Pattern

`diagramPlugin()` is the recommended integration path. Pass it to `EngineProvider` or `ScenePlayer` via the `plugins` prop. It automatically creates and registers `DiagramCanvasWidget` instances when the compiler first encounters a `<DiagramCanvas id="...">` element.

```typescript
import { useMemo } from 'react';
import { EngineProvider, corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';

function App() {
  const diagPlugin = useMemo(() => diagramPlugin(), []);
  return (
    <EngineProvider
      manifestUrl="/assets/manifest.json"
      plugins={[corePlugin(), diagPlugin]}
    >
      {/* scenes with <DiagramCanvas> */}
    </EngineProvider>
  );
}
```

Manual construction of `DiagramCanvasWidget` and `compileCanvas` is still supported for advanced cases (e.g., wiring `onInteraction` callbacks before the first render), but is no longer the primary recommended pattern.

### Authoring Example

```tsx
// In a scene DSL file:

<DiagramCanvas
  id="system-canvas"
  rotation={[-Math.PI / 10, -Math.PI / 8, 0]}
  scale={1.1}
  theme={darkGlassTheme}
  pipeRouting="curved"
  pipeLanding="sides"
>
  <Diagram id="frontend-tier" pivot="center" position={[-8, 0, 0]}>
    <GridLayout columns={2} />
    <DiagramNode id="browser" label="Browser" icon="ui:globe-alt" />
    <DiagramNode id="cdn" label="CDN" icon="aws:cloudfront" />
  </Diagram>

  <Diagram id="backend-tier" pivot="center" position={[8, 0, 0]}>
    <GridLayout columns={2} />
    <DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" />
    <DiagramNode id="db" label="Database" icon="aws:rds" />
  </Diagram>

  <DiagramPipe from="frontend-tier.cdn" to="backend-tier.api" label="HTTPS" />
</DiagramCanvas>
```

## Technical Considerations

### Two-Pass Compilation

The `compileCanvas` function is a two-pass pipeline called by the `DiagramCanvas` compiler handler in `packages/diagram/src/compiler/handlers.ts`:

**Pass 1 — Compile child Diagrams:** The handler extracts each `<Diagram>` child from the React element tree and calls `compileDiagram(dsl, canvasTheme)` where `canvasTheme` is passed as the `fallbackTheme` parameter. The canvas theme applies to all fields not overridden by the child diagram's own theme.

**Pass 2 — Compile DiagramPipes:** The handler calls `compileCanvas(canvasDSL, compiledDiagrams, pipeDSLs)`. Inside `compileCanvas`, each `<DiagramPipe>` is compiled via `compilePipe()`. `compilePipe` parses the dot notation, finds the source and destination nodes in the compiled `DiagramState[]` from Pass 1, transforms their positions from diagram-local to canvas-local space (applying each diagram's `position`/`rotation`/`scale`), then routes the pipe using `pipeRouter.ts`.

### Pipe Routing — pipeRouter.ts

`packages/diagram/src/elements/diagram/canvas/compiler/pipeRouter.ts` provides:

- `sideAttachmentPoint(nodeLocalPos, nodeSize, nodeDepth, diagramPos, diagramScale, diagramRotation, otherNodeCanvasPos)` — returns `{ point, normal }` in canvas-local space. The attachment side (left or right face) is determined by the sign of `(otherNodeCanvasPos.x - nodeCanvasPos.x)`.
- `routePipe(fromPoint, toPoint, fromNormal, toNormal, routing)` — produces `controlPoints` in canvas-local space. For `'curved'`, generates 4 CatmullRom control points with departure/arrival tangents perpendicular to the attachment face normals. For `'straight'`, produces `[fromPoint, toPoint]`.
- `rotateXYZ(vec, rx, ry, rz)` — Euler XYZ rotation utility used throughout the canvas compilation layer.
- `rerouteLivePipes(pipes, interpolatedDiagrams, routing, landing)` — used by `functionalDiagramCanvasTransitionSpec.interpolateFn` to recompute pipe control points from interpolated diagram node positions during scene transitions, ensuring pipes track their endpoints smoothly as diagrams move.

### DiagramCanvasRenderer Architecture

`packages/diagram/src/elements/diagram/canvas/render.ts` maintains:

- A `THREE.Group` (`canvas:{id}`) added to the scene as the root of the canvas world-space transform.
- A nested `THREE.Group` (`canvas:{id}:pipes`) for pipe EdgeRenderer output.
- A `Map<string, DiagramRenderer>` — one `DiagramRenderer` per child diagram id. `DiagramRenderer` instances are created on first encounter and disposed when a diagram id is no longer present in the state.
- A single `EdgeRenderer` instance (`pipeRenderer`) that renders all `DiagramPipeState` objects into the pipe root group.

On each `update()` call, the canvas group's `position`, `rotation`, and `scale` are set from the state. The renderer reconciles the active diagram set, disposing stale `DiagramRenderer` instances and creating new ones as needed.

### Camera Auto-Framing

When no `Camera` widget is active, `DiagramCanvasWidget.onTick()` computes camera position:

1. Transforms all four corners of each child diagram's `bounds` rectangle from diagram-local to canvas-local space (applying diagram `scale`/`rotation`/`position`), then to canvas-rotated world space.
2. Computes the world-space bounding box (`minX`/`maxX`/`minY`/`maxY`) of all corners.
3. Sets the camera position to a point along the camera's existing direction, stepped back far enough that the full bounding box fits within the FOV with a 1.2× safety margin.
4. The camera look-at target is the center of the bounding box.

This runs every tick when the Camera widget is inactive, giving a stable framing that updates as diagrams animate.

### Ghost-Node mergeSnapshot

`mergeSnapshot` implements the ghost-node pattern for multi-scene canvas sequences. For each child diagram pair (prev/next matched by id), nodes with `label === undefined` (i.e., the `label` prop was omitted entirely in the DSL) or `positionInherited === true` are backfilled from the previous scene's compiled node state (carrying forward `label`, `sublabel`, `shape`, `iconUrl`, `iconScale`, `sublabelColor`, `position`, `size`, `thickness`). Explicitly setting `label=""` (empty string) is not a ghost node — it declares a node with a blank label and retains all other explicitly authored props. This allows minimal per-scene node declarations in manual-layout diagrams.

### Interaction Wiring

`DiagramCanvasWidget.initialize()` attaches `click`, `mousemove`, and `mouseleave` handlers to the WebGL canvas element (`renderer.domElement`). These handlers drive the hover and click pipelines for all child diagrams:

- **Click:** Raycasts against `InteractionRegistry` meshes for all child `DiagramRenderer`s. On hit, fires `onInteraction` callback with a `DiagramInteractionEvent`.
- **MouseMove:** Raycasts against both node meshes (`InteractionRegistry`) and group meshes (`GroupInteractionRegistry`). Computes a `HoverTarget` (diagramId, groupPath, nodeId). Transitions the hover state by dispatching `onMouseEnter`/`onMouseLeave` on the delta between previous and current `HoverTarget`.
- **MouseLeave:** Clears the current hover target, firing leave events as needed.

### Transition Model

`functionalDiagramCanvasTransitionSpec` in `canvas/compile.ts` handles three cases:

- **exitFn:** Applies `applyDiagramExit` to each child diagram (fades nodes/edges according to each diagram's `<Exit>` config) and fades all pipe opacities to 0.
- **enterFn:** Applies `applyDiagramEnter` to each child diagram and fades pipe opacities from 0 to their declared value.
- **interpolateFn:** For each `to` diagram, blends nodes (position, size, opacity) and edges (control points rerouted live, opacity) against the matching `from` diagram. Diagrams present in `from` but not `to` are exited; diagrams present in `to` but not `from` are entered. Pipe control points are rerouted live from interpolated node positions via `rerouteLivePipes`.

## Breaking Change Assessment

**Semver impact: minor** (new optional NVS props on `DiagramCanvasProps` and `DiagramCanvasState`).

The `x`, `y`, `w`, `h` props on `DiagramCanvas` are fully optional with fullscreen defaults. Existing scenes that do not declare NVS props compile and render identically to before. The addition of `nvsBounds` to `DiagramCanvasState` is a new field with a defined default (`{ x: 0, y: 0, w: 1, h: 1 }`) — consumers who snapshot or serialize `DiagramCanvasState` directly will now receive an additional field, which may require test updates.

The `INVSBounded` interface addition to `DiagramCanvasWidget` is purely additive.

Consumers adding `DiagramCanvasWidget` to an existing project must:

1. Import `DiagramCanvasWidget` and `compileCanvas` from `@brewsite/diagram`.
2. Register one `DiagramCanvasWidget` instance per `DiagramCanvas` id before `ScenePlayer` mounts.
3. Replace standalone `<Diagram>` DSL usages with `<DiagramCanvas>` + nested `<Diagram>` children wherever cross-diagram pipes or unified transforms are needed. Standalone `<Diagram>` elements outside a canvas remain fully supported.

## Dependencies

- `@brewsite/core`: `FunctionalTransitionSpec`, `ISceneElement`, `IRenderable`, `IAnimationController`, `INVSBounded`, `NVSRect`, `blendNumber`, `blendVec3`, `blendOpacity`, `setSceneLightEnabled`, `WidgetRegistry`, `WidgetInitContext`, `WidgetRenderContext`, `AnimationTickContext`.
- `packages/diagram/src/elements/diagram/compile.ts`: `compileDiagram`, `applyDiagramEnter`, `applyDiagramExit`.
- `packages/diagram/src/elements/diagram/compiler/transitionHelpers.ts`: `blendDiagramNodes`, `buildLiveNodeMaps`, `rerouteLiveEdges`, `blendDiagramEdges`.
- `packages/diagram/src/elements/diagram/canvas/compiler/pipeRouter.ts`: `sideAttachmentPoint`, `routePipe`, `rerouteLivePipes`, `rotateXYZ`.
- Three.js (render layer only): `THREE.Group`, `THREE.Scene`, `THREE.Raycaster`, `THREE.Vector2`, `THREE.Box3`, `THREE.PerspectiveCamera`.

## Risks & Mitigations

**Risk: API regret on focusCenter shape** — `focusCenter` accepts both `[x, y]` and `[x, y, z]` as `readonly` tuples. The Z component is accepted but ignored in canvas-wide framing. This is intentional for forward compatibility but could confuse consumers.
**Mitigation:** JSDoc on `DiagramCanvasProps.focusCenter` explicitly documents that Z is accepted but only XY is used for canvas focus.

**Risk: Pipe control points become stale on transition** — If pipe control points were baked once and not updated during transitions, pipes would snap rather than track their endpoints.
**Mitigation:** `rerouteLivePipes` in `interpolateFn` recomputes control points from interpolated node positions every frame during a transition.

**Risk: `inputTranslation`/`inputRotation` accumulate unbounded** — If `applyInputMove` / `applyInputRotate` are called every frame without a reset, the canvas will drift.
**Mitigation:** `resetInputTransform()` is a public method. The ActionInputController is responsible for calling it on interaction end.

## Open Questions

None. The canvas element is fully implemented and all design decisions are resolved.

## Launch Criteria

- `compileCanvas` and `compilePipe` have full unit test coverage in `canvas/__tests__/compile.test.ts` with real DSL inputs and asserted real `controlPoints` output.
- `DiagramCanvasWidget` has integration tests verifying ghost-node `mergeSnapshot` behavior.
- `prd_canvas_element.md` is published to `requirements/diagram/prd/`.
- At least one example scene in `apps/examples/` demonstrates a two-diagram canvas with a `DiagramPipe`.
- All exported types (`DiagramCanvasState`, `DiagramPipeState`, `DiagramCanvasWidget`, `compileCanvas`, `compilePipe`, `PipeRoutingAlgorithm`, `PipeLandingAlgorithm`, `DiagramCanvasInputConfig`) are present in `packages/diagram/src/index.ts`.
- `defaultDiagramCanvasInputActions` constant is exported from `packages/diagram/src/index.ts`.
- `IInputDefaultProvider` interface and `isInputDefaultProvider` type guard are exported from `packages/core/src/index.ts`.
- CHANGELOG entry written for `@brewsite/diagram`.
