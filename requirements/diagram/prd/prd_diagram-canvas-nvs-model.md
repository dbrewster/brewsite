---
title: "DiagramCanvas NVS Sub-Viewport Model"
doc_type: prd
owner: product
status: deprecated
updated: 2026-03-21
change_history:
  - date: 2026-03-21
    author: "Toolkit Product"
    summary: "Note: this deprecated document predates the scene unit system. All bare-number spatial DSL props shown in examples below would now require SceneLength/SceneAngle unit strings. See prd_diagram_element.md for current Diagram element spec with unit types."
  - date: 2026-03-09
    author: "Toolkit Product"
    summary: "DEPRECATED: The DiagramCanvas scissored sub-viewport model described in this document has been superseded by the NVS Universal Coordinate System (plan_nvs-universal-coordinate-system.md). DiagramCanvas has been removed from @brewsite/diagram entirely. Diagrams now render into the main Three.js scene via DiagramWidget using context.coords (NVSCoordService). The IExtraRenderPass contract and private-scene isolation model are no longer in use. See prd_canvas_element.md (deprecated) and prd_diagram_element.md for the current Diagram element spec."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the fully implemented NVS-primary sub-viewport redesign of DiagramCanvas: scissored rendering, private perspective camera, tilt/x/y/w/h placement API, IExtraRenderPass contract. Replaces the hidden-camera-takeover model. Records the major semver bump for @brewsite/diagram and minor bump for @brewsite/core."
---

# DiagramCanvas NVS Sub-Viewport Model

## Overview

`DiagramCanvas` is the primary container element in `@brewsite/diagram` for hosting one or more `Diagram` elements in a shared coordinate frame. In the NVS sub-viewport model, each `DiagramCanvas` declares its position and size as normalized viewport-space (NVS) coordinates — the same coordinate system used by `TextBox`, `Hud`, and other overlay elements. The canvas renders in its own scissored WebGL sub-viewport with a private `THREE.PerspectiveCamera` and an isolated depth buffer, compositing over the main scene without disturbing the main scene camera or its depth state.

This model replaces the previous hidden-camera-takeover design, in which `DiagramCanvas` seized the main scene camera and suppressed core lighting via `ILightingOverride`. The NVS model is the current and authoritative implementation in both `@brewsite/diagram` (major bump) and `@brewsite/core` (minor bump — new `IExtraRenderPass` interface).

## Problem Statement

The previous camera-takeover model had three structural defects:

1. **Single-canvas constraint.** The main scene camera can only look from one direction at a time. Multiple `DiagramCanvas` elements in the same scene were mutually exclusive in practice — only the last one to call `onTick()` determined the camera position.
2. **Main scene contamination.** Diagram geometry lived in the shared `THREE.Scene`. This meant diagram objects contributed to the main scene's depth buffer, shadow maps, and environment map lookups, producing visual artifacts when other core elements (floor, background, models) were present simultaneously.
3. **Lighting suppression leak.** Disabling core lights via `ILightingOverride` affected the entire frame — not just the diagram sub-region — making it impossible to have lit core scene content alongside a diagram canvas.

The NVS model eliminates all three defects: multiple canvases are fully independent sub-viewports; diagram geometry is isolated in a private `THREE.Scene`; and there is no interaction whatsoever with core lighting.

## Goals & Success Metrics

**Primary metrics:**
- Two or more `DiagramCanvas` elements in the same scene each render their content in their declared NVS sub-region without interfering with each other or the main scene.
- `DiagramCanvas` placement is declared with the same `x / y / w / h` NVS props used throughout the toolkit's overlay system — zero new coordinate systems to learn.
- The `ILightingOverride` implementation is removed from `DiagramCanvasWidget`. Core scene lights are unaffected by the presence of a `DiagramCanvas`.
- `canvasAspect` is computed from actual NVS bounds at runtime — no `DEFAULT_CANVAS_ASPECT` constant, no consumer-supplied aspect ratio.

**Guardrail metrics:**
- No Three.js import in `canvas/types.ts`, `canvas/dsl.tsx`, or `canvas/compile.ts`.
- `compileCanvas()` emits `console.error` in `NODE_ENV !== 'production'` when any NVS component violates the `[0, 1]` contract. The error does not throw; compilation continues.
- `DiagramCanvasWidget.renderPass()` returns immediately (no render issued) when the scissored region is zero pixels wide or tall.
- All 52 migrated app scene files pass `pnpm typecheck` after `position` / `rotation` props are removed.

## Non-Goals

- Smooth animated focus transitions (`focusMesh`, `focusAll` snap immediately — deferred to v2 as a documented `DEBT` comment in `widget.ts`).
- Compile-time NVS overlap validation. When two canvas NVS regions overlap, the later-declared canvas renders on top. No warning is issued in V1.
- Depth compositing between the diagram sub-viewport and main scene content (e.g., diagram nodes occluding main-scene models). Each canvas's depth buffer is independent. This is a deliberate design choice, not a limitation to be removed.
- World-space position/rotation/scale of the entire `DiagramCanvas` group. The canvas is placed via NVS coordinates only. Child `<Diagram>` elements retain their own `position` / `rotation` / `scale` in diagram-local space.

## Consumer Stories

- As a toolkit consumer, I want to declare a `DiagramCanvas` using `x / y / w / h` NVS coordinates so that I can place it precisely alongside `TextBox` and `Hud` overlays using the same mental model.
- As a toolkit consumer, I want the diagram to render with its own perspective camera so that I never need to configure a `Camera` widget just to display a diagram.
- As a toolkit consumer, I want multiple `DiagramCanvas` elements in the same scene to each occupy their own region so that split-screen diagram comparisons work without conflict.
- As a toolkit consumer, I want the `tilt` prop to control the 3D pitch angle of the diagram geometry so that I can author the classic "tilted board" visual without manual rotation math.
- As a toolkit consumer, I want the diagram to auto-fit its camera to content so that I never need to tune a camera distance value.

## Functional Requirements

1. `DiagramCanvas` placement is declared exclusively via `x`, `y`, `w`, `h` NVS props (top-left origin, values in `[0, 1]`). World-space `position` and `rotation` props are removed.
2. Each `DiagramCanvas` renders in its own scissored WebGL sub-viewport pass, executed after the main scene render pass, via the `IExtraRenderPass` interface.
3. Each `DiagramCanvas` maintains a private `THREE.Scene` and a private `THREE.PerspectiveCamera(FOV=45)`. Diagram geometry is added to the private scene only — never to the main scene.
4. The private camera's aspect ratio is computed from the NVS bounds and the current renderer size: `canvasAspect = (nvs.w / nvs.h) * (rendererWidth / rendererHeight)`. No static aspect ratio constant is used.
5. `DiagramCanvasWidget.renderPass()` clears the depth buffer only (not color) within its scissored region before rendering. This composites the diagram over the main scene color while preventing depth fighting.
6. The `tilt` prop (radians) applies a pitch rotation to the diagram geometry group before auto-fit camera framing runs. Negative values tilt the top edge away from the viewer.
7. The `padding` prop (default `0.1`) adds a proportional pullback margin to the auto-fit camera calculation. `padding=0` produces a tight crop; `padding=0.1` adds a 10% margin around the content bounding box.
8. The `scale` prop applies a uniform geometry scale to the diagram group. The auto-fit camera responds naturally — larger geometry causes the camera to back up proportionally.
9. `DiagramCanvasWidget` no longer implements `IAnimationController` or `ILightingOverride`. The `tickPriority` constant and `onTick()` method are removed.
10. Raycasting for click and hover interaction is scoped to the canvas's NVS sub-region. Pointer NDC coordinates are computed via `computeNdcForNvs()` using the current `nvsBounds`.
11. `compileCanvas()` emits `console.error` (not throw) in `NODE_ENV !== 'production'` when any `nvsBounds` component falls outside `[0, 1]` (`x < 0`, `y < 0`, `w ≤ 0`, `h ≤ 0`, `x + w > 1`, or `y + h > 1`). The error message includes the canvas id and the offending component values.

## API Design

### DSL Props

```typescript
// packages/diagram/src/elements/diagram/canvas/dsl.tsx

export interface DiagramCanvasProps {
  /** Unique canvas id. */
  id: string;

  // ── NVS placement (top-left origin, [0, 1]) ──────────────────────────────
  /** NVS x-coordinate of the canvas left edge. Default: 0 */
  x?: number;
  /** NVS y-coordinate of the canvas top edge. Default: 0 */
  y?: number;
  /** NVS width of the canvas. Default: 1 */
  w?: number;
  /** NVS height of the canvas. Default: 1 */
  h?: number;

  // ── Geometry ──────────────────────────────────────────────────────────────
  /**
   * Pitch tilt of the diagram geometry group in radians.
   * Negative = top edge tilts away from viewer. Default: 0.
   */
  tilt?: number;
  /**
   * World-space uniform geometry scale. Default: 1.
   * The auto-fit camera responds naturally to changes in scale.
   */
  scale?: number;
  /**
   * Fractional framing inset for the auto-fit private camera.
   * 0 = tight crop. 0.1 = 10% margin. Default: 0.1.
   */
  padding?: number;

  // ── Other ─────────────────────────────────────────────────────────────────
  /** Canvas-level theme. Propagated as default theme to all child <Diagram> elements. */
  theme?: DiagramTheme;
  /** Cross-diagram pipe routing algorithm. Default: 'curved'. */
  pipeRouting?: PipeRoutingAlgorithm;
  /** Pipe attachment strategy. Default: 'sides'. */
  pipeLanding?: PipeLandingAlgorithm;
  /** Optional focus center in canvas-local space (XY). */
  focusCenter?: [number, number] | [number, number, number];

  children?: React.ReactNode;
}

export function DiagramCanvas(_props: DiagramCanvasProps): null;
```

### Compiled State

```typescript
// packages/diagram/src/elements/diagram/canvas/types.ts

export interface DiagramCanvasState {
  readonly id: string;

  /**
   * NVS bounds — authoritative for scissor rect and aspect ratio.
   * Fullscreen default: { x: 0, y: 0, w: 1, h: 1 }.
   * Always present; filled with defaults by compileCanvas().
   */
  readonly nvsBounds: NVSRect;

  /**
   * Pitch tilt in radians applied to the diagram geometry group.
   * Negative = top edge tilts away from viewer. Default: 0.
   */
  readonly tilt: number;

  /** World-space uniform geometry scale. Default: 1. */
  readonly scale: number;

  /**
   * Fractional framing inset for the auto-fit private camera. Default: 0.1.
   */
  readonly padding: number;

  /** Optional focus center in canvas-local space (XY or XYZ). */
  readonly focusCenter?: readonly [number, number] | readonly [number, number, number];

  /** All child diagram states, in declaration order. */
  readonly diagrams: ReadonlyArray<DiagramState>;

  /** All cross-diagram pipe states. */
  readonly pipes: ReadonlyArray<DiagramPipeState>;

  /**
   * Default input actions derived from theme.input at compile time.
   * Undefined when no theme.input is configured.
   */
  readonly defaultInputActions?: ReadonlyArray<InputActionSpec>;
}
```

Note: `DiagramCanvasState` no longer contains `position`, `rotation`, or world-space transform fields. The placement contract is entirely expressed through `nvsBounds`. Child `<Diagram>` elements retain their own `position` / `rotation` / `scale` in diagram-local space.

### IExtraRenderPass Contract

`IExtraRenderPass` is a new interface in `@brewsite/core` (`packages/core/src/widget/types.ts`):

```typescript
export interface IExtraRenderPass extends IWidget {
  /**
   * Issues an additional render pass after the main scene pass completes.
   * The implementation is responsible for setting up and tearing down
   * any renderer state it modifies (scissor, viewport, etc.).
   *
   * @param renderer       - The active THREE.WebGLRenderer instance.
   * @param viewportWidth  - Current renderer output width in CSS pixels.
   * @param viewportHeight - Current renderer output height in CSS pixels.
   */
  renderPass(
    renderer: THREE.WebGLRenderer,
    viewportWidth: number,
    viewportHeight: number,
  ): void;
}
```

`WidgetRegistry.getExtraRenderPassWidgets()` returns all registered widgets that implement this interface. `useSceneEngine`'s render callback iterates this list after `renderer.render(scene, camera)` to issue the extra passes in registration order (which matches declaration order in the DSL).

### Widget Class

```typescript
// packages/diagram/src/elements/diagram/canvas/widget.ts

export class DiagramCanvasWidget
  implements
    ISceneElement<DiagramCanvasState>,
    IRenderable<DiagramCanvasState>,
    IExtraRenderPass,
    IInputDefaultProvider,
    INVSBounded
{
  readonly widgetId: string;
  readonly defaultState: DiagramCanvasState;
  readonly transitionSpec: FunctionalTransitionSpec<DiagramCanvasState>;
  readonly DslComponent: typeof DiagramCanvas;

  /** Fires on clickable node interaction within any child diagram. */
  public onInteraction: ((event: DiagramInteractionEvent) => void) | undefined;

  /** NVS bounds from the most recently applied state. Fullscreen default before first apply(). */
  readonly nvsBounds: NVSRect;

  constructor(widgetId: string, defaultState: DiagramCanvasState);

  initialize(context: WidgetInitContext): void;

  /**
   * Applies compiled canvas state to the private scene.
   * Computes canvasAspect from renderer size + nvsBounds.
   * Updates auto-fit camera position.
   */
  apply(state: DiagramCanvasState, context: WidgetRenderContext): void;

  /**
   * Issues a scissored render pass for this canvas.
   * Called by useSceneEngine AFTER the main scene render pass.
   * Clears depth only — composites diagram over main scene color.
   * Returns immediately when the scissored region is zero-area.
   */
  renderPass(renderer: THREE.WebGLRenderer, viewportWidth: number, viewportHeight: number): void;

  getDefaultInputActions(): InputActionSpec[];

  mergeSnapshot(
    prev: DiagramCanvasState | undefined,
    next: DiagramCanvasState | undefined,
  ): DiagramCanvasState | undefined;

  dispose(): void;

  applyInputMove(dx: number, dy: number, dz?: number): void;
  applyInputRotate(rx: number, ry?: number, rz?: number): void;
  resetInputTransform(): void;

  applyInputFocus(
    clientX: number,
    clientY: number,
    focusCenter?: [number, number] | [number, number, number] | readonly [number, number] | readonly [number, number, number],
  ): void;

  handleMove(event: PointerEvent | WheelEvent, speed?: number): void;
  handleRotate(event: PointerEvent | WheelEvent, speed?: number): void;
  handleReset(): void;
  handleFocus(event: PointerEvent | MouseEvent, focusCenter?: [number, number] | [number, number, number]): void;
}
```

### Utility Exports

Two pure helper functions are exported from `widget.ts` for testing and advanced use:

```typescript
/**
 * Computes NDC coordinates for a pointer event scoped to an NVS sub-region.
 * Returns { x: [-1, 1], y: [-1, 1] }.
 */
export function computeNdcForNvs(
  pointerLocalX: number,
  pointerLocalY: number,
  canvasWidth: number,
  canvasHeight: number,
  nvsBounds: NVSRect,
): { x: number; y: number };

/**
 * Converts NVS bounds to a WebGL scissor/viewport pixel rect.
 * Performs the Y-flip (NVS is top-left origin; WebGL is bottom-left).
 * Rounds to integer pixels to avoid sub-pixel rounding artifacts.
 */
export function nvsToScissorRect(
  nvs: { x: number; y: number; w: number; h: number },
  vw: number,
  vh: number,
): { left: number; bottom: number; width: number; height: number };
```

### Authoring Example

```tsx
// Half-screen left canvas (fullscreen default) + quarter-screen right canvas

<Scene id="split-screen">
  <DiagramCanvas
    id="left-canvas"
    x={0} y={0} w={0.5} h={1}
    tilt={-0.2}
    theme={darkGlassTheme}
  >
    <Diagram id="frontend" pivot="center">
      <GridLayout columns={2} />
      <DiagramNode id="browser" label="Browser" icon="ui:globe-alt" />
      <DiagramNode id="cdn" label="CDN" icon="aws:cloudfront" />
    </Diagram>
  </DiagramCanvas>

  <DiagramCanvas
    id="right-canvas"
    x={0.55} y={0.1} w={0.4} h={0.8}
    tilt={-0.15}
    padding={0.15}
    theme={enterpriseTheme}
  >
    <Diagram id="backend" pivot="center">
      <GridLayout columns={2} />
      <DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" />
      <DiagramNode id="db" label="Database" icon="aws:rds" />
    </Diagram>
  </DiagramCanvas>
</Scene>
```

### Migration from the Camera-Takeover Model

Before (old camera-takeover API):
```tsx
<DiagramCanvas
  id="my-canvas"
  position={[0, 0, -5]}
  rotation={[-0.3, 0, 0]}
  scale={1.2}
  theme={darkGlassTheme}
>
  <Diagram id="main" />
</DiagramCanvas>
```

After (NVS model):
```tsx
<DiagramCanvas
  id="my-canvas"
  x={0} y={0} w={1} h={1}
  tilt={-0.3}
  scale={1.2}
  theme={darkGlassTheme}
>
  <Diagram id="main" />
</DiagramCanvas>
```

Key changes:
- Replace `position` and `rotation` with `x / y / w / h` and `tilt`.
- `x / y / w / h` default to `0 / 0 / 1 / 1` (fullscreen). Omit them entirely for a fullscreen canvas.
- `tilt` replaces the X component of `rotation`. The Y and Z rotation components had no effect in the new model — they are not supported.
- `scale` is unchanged.
- `position` had no effect in NVS model and is removed.

## Technical Considerations

### Scissored Sub-Viewport Rendering

`DiagramCanvasWidget.renderPass()` follows this exact sequence:

1. Compute pixel rect from `nvsToScissorRect(lastState.nvsBounds, viewportWidth, viewportHeight)`.
2. Guard: if `width <= 0 || height <= 0`, return immediately.
3. `renderer.setScissorTest(true)`.
4. `renderer.setScissor(left, bottom, width, height)`.
5. `renderer.setViewport(left, bottom, width, height)`.
6. `renderer.clearDepth()` — clears depth only, preserving main scene color.
7. `renderer.render(this.diagramScene, this.privateCamera)`.
8. Restore: `renderer.setScissorTest(false)`, `renderer.setViewport(0, 0, viewportWidth, viewportHeight)`.

If multiple `DiagramCanvas` instances are registered, `useSceneEngine` calls their `renderPass()` methods in the order returned by `WidgetRegistry.getExtraRenderPassWidgets()`, which matches widget registration order (DSL declaration order when using `diagramPlugin()`). If NVS regions overlap, later passes render on top.

### Private Scene and Camera

`DiagramCanvasWidget.initialize()` creates:
- `this.diagramScene = new THREE.Scene()` — diagram geometry lives exclusively here.
- `this.privateCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)` — aspect updated in `apply()` before each render.

The `WidgetInitContext.scene` (main scene) and `WidgetInitContext.camera` (shared camera) are intentionally unused. This is documented with a `// Note:` comment in `initialize()`.

### Auto-Fit Camera

`apply()` calls `updateAutoFitCamera(state, canvasAspect)` on every frame:

1. Call `this.renderer.getBoundingBox()` — returns a `THREE.Box3` of all diagram geometry in the private scene. Returns `null` before geometry is loaded.
2. Compute `maxDim = Math.max(size.x / canvasAspect, size.y)`.
3. Compute `dist = (maxDim / 2 / Math.tan(fovRad / 2)) * (1 + state.padding)`.
4. Set `cam.position.set(center.x, center.y, center.z + dist)` and `cam.lookAt(center)`.

When no geometry is available yet, the camera defaults to `position(0, 0, 5)` looking at the origin.

### Canvas Aspect Ratio

The aspect ratio is computed fresh every `apply()` call:

```typescript
const size = new THREE.Vector2();
this.rendererRef.getSize(size);
const engineAspect = size.x > 0 && size.y > 0 ? size.x / size.y : 16 / 9;
const canvasAspect = (state.nvsBounds.w / state.nvsBounds.h) * engineAspect;
```

This means the camera projection automatically adapts when the browser is resized or when `nvsBounds` transitions between scenes. The removed `DEFAULT_CANVAS_ASPECT` constant was `16 / 9` and was used as a static fallback — it is gone entirely.

### IExtraRenderPass in @brewsite/core

The `IExtraRenderPass` interface addition to `@brewsite/core` is a **minor** semver change — it adds a new exported interface and a new `WidgetRegistry` method (`getExtraRenderPassWidgets()`), both purely additive. Existing consumers who do not implement `IExtraRenderPass` are unaffected.

`WidgetRegistry.getExtraRenderPassWidgets()` is called in `useSceneEngine`'s render callback:

```typescript
// After main scene render:
const extraPasses = registry.getExtraRenderPassWidgets();
for (const w of extraPasses) {
  w.renderPass(renderer, viewportWidth, viewportHeight);
}
```

### Removed Interfaces

`DiagramCanvasWidget` no longer implements:
- `IAnimationController` — the `tickPriority` constant and `onTick()` method are removed. Camera position is computed in `apply()` instead.
- `ILightingOverride` — `getLightingOverride()` is removed. Core scene lights are never toggled by `DiagramCanvasWidget`.

Consumers who called `onTick()` directly (atypical) or relied on `IAnimationController` type narrowing via the registry must remove those references.

### Tilt Implementation

`tilt` is applied as a pitch rotation to the diagram geometry group in `DiagramCanvasRenderer.update()`:

```typescript
group.rotation.x = state.tilt + this.inputRotationOffset;
```

The `inputRotationOffset` is the interactive pitch delta accumulated via `applyInputRotate()`. Only the X axis (pitch) is supported for interactive rotation — Y and Z deltas are silently ignored, matching the new single-axis tilt model.

## Breaking Change Assessment

**`@brewsite/diagram`: major version bump.**

All changes below are in `packages/diagram/src/elements/diagram/canvas/`.

| Change | Before | After |
|---|---|---|
| `DiagramCanvasProps.position` | `position?: [number, number, number]` | **Removed** |
| `DiagramCanvasProps.rotation` | `rotation?: [number, number, number]` | **Removed** |
| `DiagramCanvasState.position` | `readonly position: readonly [number, number, number]` | **Removed** |
| `DiagramCanvasState.rotation` | `readonly rotation: readonly [number, number, number]` | **Removed** |
| `DiagramCanvasState.nvsBounds` | Optional field with default | **Always present** |
| `DiagramCanvasState.tilt` | Not present | **New required field** (default `0`) |
| `DiagramCanvasState.padding` | Not present | **New required field** (default `0.1`) |
| `DiagramCanvasWidget` interfaces | `ISceneElement, IRenderable, IAnimationController, ILightingOverride, IInputDefaultProvider, INVSBounded` | `ISceneElement, IRenderable, IExtraRenderPass, IInputDefaultProvider, INVSBounded` |
| `DiagramCanvasWidget.onTick()` | Present (`IAnimationController`) | **Removed** |
| `DEFAULT_CANVAS_ASPECT` export | `export const DEFAULT_CANVAS_ASPECT = 16/9` | **Removed** |

**`@brewsite/core`: minor version bump.**

| Change | Before | After |
|---|---|---|
| `IExtraRenderPass` | Not present | **New exported interface** |
| `WidgetRegistry.getExtraRenderPassWidgets()` | Not present | **New method** |
| `isExtraRenderPass` type guard | Not present | **New exported function** |

### Migration for `DiagramCanvasState` Snapshot Consumers

Consumers who snapshot or serialize `DiagramCanvasState` (e.g., in tests asserting the compiled output) must update expectations:
- Remove assertions on `position` and `rotation` fields.
- Add assertions on `tilt` (default `0`), `padding` (default `0.1`), and `nvsBounds` (always present).

### DSL Migration

All `<DiagramCanvas>` JSX in consumer scenes must replace `position` / `rotation` with NVS props:

```tsx
// Before
<DiagramCanvas id="c" position={[0, 2, -3]} rotation={[-0.3, 0, 0]} scale={1.1} />

// After
<DiagramCanvas id="c" tilt={-0.3} scale={1.1} />
// (x/y/w/h omitted = fullscreen default)
```

## Dependencies

- `@brewsite/core`: `IExtraRenderPass` (new, minor bump), `INVSBounded`, `NVSRect`, `ISceneElement`, `IRenderable`, `IInputDefaultProvider`, `WidgetInitContext`, `WidgetRenderContext`, `FunctionalTransitionSpec`.
- `three`: `THREE.Scene`, `THREE.PerspectiveCamera`, `THREE.WebGLRenderer`, `THREE.Raycaster`, `THREE.Vector2`, `THREE.Box3`, `THREE.Vector3` (render layer only).

## Risks & Mitigations

**Risk: Interactive rotation only supports pitch** — `applyInputRotate(rx, ry, rz)` ignores `ry` and `rz`. Consumers who authored canvas rotation on Y or Z axes in the old model will find that interactive Y/Z rotation is silently ignored.
**Mitigation:** This is by design in V1. The PRD and JSDoc document the single-axis constraint. Full 3-axis interactive rotation is deferred to v2.

**Risk: Camera auto-fit over-approximates for wide canvases** — The auto-fit formula `Math.max(size.x / canvasAspect, size.y)` uses vertical FOV for both axes, which over-approximates the required pullback for wide canvases. The camera backs up slightly further than a mathematically exact tight fit.
**Mitigation:** The `padding` prop absorbs the visual difference. The exact horizontal FOV correction is a v2 DEBT, documented in the `updateAutoFitCamera` implementation.

**Risk: NVS overlap renders later canvas on top** — When two `DiagramCanvas` NVS regions overlap, the later-declared canvas paints over the earlier one in the overlap region. This is intentional but may surprise consumers.
**Mitigation:** Documented in the widget's class JSDoc and in this PRD's Technical Considerations. Compile-time overlap detection is deferred to v2.

## Open Questions

None. The NVS model is fully implemented, all 52 app scene files are migrated, and all design decisions are resolved.

## Launch Criteria

- `DiagramCanvasWidget` tests in `canvas/__tests__/widget.renderPass.test.ts` verify scissor setup, depth-clear-only behavior, and zero-area guard.
- `canvas/__tests__/compile.test.ts` asserts `nvsBounds` defaults and NVS out-of-range `console.error` behavior.
- `pnpm typecheck` passes across all packages with `position` / `rotation` props removed.
- `apps/examples/` contains at least one scene demonstrating two `DiagramCanvas` elements with distinct NVS placements.
- CHANGELOG entry written for `@brewsite/diagram` (major) and `@brewsite/core` (minor).
- This PRD published to `requirements/diagram/prd/prd_diagram-canvas-nvs-model.md`.
- `requirements/diagram/plans/plan_diagram-canvas-nvs-model.md` archived.
