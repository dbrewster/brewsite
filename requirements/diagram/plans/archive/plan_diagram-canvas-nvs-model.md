---
title: "DiagramCanvas NVS Model — Implementation Plan"
doc_type: plan
owner: Architect
status: complete
updated: 2026-03-08
---

# DiagramCanvas NVS Model — Implementation Plan

## Executive Summary

This plan implements the clean-break NVS redesign for `DiagramCanvas` described in `requirements/diagram/notes/prd_diagram-canvas-nvs-model.md`. It replaces the hidden camera takeover with scissored sub-viewport rendering, a private perspective camera, and a pure NVS placement contract matching `TextBox`/`Hud`.

**Semver impact**: `@brewsite/diagram` major version bump. `@brewsite/core` minor bump (new `IExtraRenderPass` interface, additive).

---

## Architectural Decisions (Open Questions Resolved)

### Decision 1: `ICameraFocusTarget` — Not Generalized

**Decision**: `DiagramCanvasWidget` stops using `ICameraFocusTarget` entirely. It operates directly on its own private `THREE.PerspectiveCamera`. No new interface is needed.

**Rationale**: `ICameraFocusTarget` is the SHARED scene camera's focus handle. In the new model the diagram camera is fully private — there is no valid reason to route focus requests through the shared camera. `focusMesh()` and `focusAll()` set `privateCamera.position` and call `privateCamera.lookAt()` directly. Focus snaps immediately in V1 (no smooth animation).

**DEBT**: Smooth focus animation (lerping `privateCamera.position` toward a target over N frames) is deferred to v2. Document in inline `// DEBT:` comment in widget.ts.

**Consequence**: `DiagramCanvasWidget` no longer implements `IAnimationController`. The `tickPriority` constant and `onTick()` method are removed. The `_cameraFocusTarget` field is removed.

### Decision 2: NVS Overlap Compile-Time Validation — Not Implemented in V1

**Decision**: No compile-time detection of overlapping `DiagramCanvas` NVS regions.

**Rationale**: Detecting overlap requires cross-widget state in a single compiler pass. The `NodeHandler` contract is stateless and per-node — it cannot observe sibling nodes. Implementing this correctly requires a scene-level post-processing step outside the current compiler architecture, which is a larger change than V1 warrants. Overlap behavior is defined and documented: "declaration order wins — later-declared canvas renders on top."

**Runtime behavior**: If two canvases overlap, the later one renders on top within the overlap region. This is documented in `DiagramCanvas.dsl.tsx` JSDoc and in the updated `README.md`.

### Decision 3: `ILightingOverride` — Removed

**Decision**: Remove `ILightingOverride` from `DiagramCanvasWidget`. The interface implementation becomes dead code in the new model.

**Rationale**: In the new model, the diagram renders in its own scissored pass against its own `THREE.Scene`. Core lights are added to the MAIN scene by `LightingWidget`. The diagram's private scene never receives those lights. The `disableAll: true` path is therefore unreachable and serves no purpose.

**Impact on `setLightEnabled` in hover controls**: `DiagramHoverControls.setLightEnabled` calls `this._lightController?.(lightId, enabled)` in the old model. After removing `ILightingOverride`, this callback becomes a no-op (null-guard). For V1 this is acceptable — mixed-scene light toggling from diagram hover is a niche use case. Keep the `setLightEnabled` stub in `createHoverControls()` as a no-op for API surface stability. Document with `// DEBT:` comment.

---

## Files to Create or Modify

### `@brewsite/core` package (minor additive changes)

| File | Change | Nature |
|---|---|---|
| `packages/core/src/widget/types.ts` | Add `IExtraRenderPass` interface | Additive |
| `packages/core/src/widget/WidgetRegistry.ts` | Add `isExtraRenderPass` type guard + `getExtraRenderPassWidgets()` | Additive |
| `packages/core/src/player/useSceneEngine.ts` | Update `render` callback to run extra passes after main scene render | Modification |

### `@brewsite/diagram` package (primary changes)

| File | Change | Nature |
|---|---|---|
| `packages/diagram/src/elements/diagram/canvas/types.ts` | Redesign `DiagramCanvasDSL` and `DiagramCanvasState` | Breaking |
| `packages/diagram/src/elements/diagram/canvas/dsl.tsx` | Update `DiagramCanvasProps` interface: remove `position`/`rotation`, add `tilt`/`padding`. (Note: `DiagramCanvas` component function lives in `widget.ts`, not here.) | Breaking |
| `packages/diagram/src/elements/diagram/canvas/compile.ts` | Update `compileCanvas()`, `compilePipe()`, transition spec | Breaking |
| `packages/diagram/src/elements/diagram/canvas/render.ts` | Update `DiagramCanvasRenderer.update()` signature; add `getBoundingBox()` | Breaking |
| `packages/diagram/src/elements/diagram/canvas/widget.ts` | Major rewrite: private scene, private camera, `IExtraRenderPass` | Breaking |
| `packages/diagram/src/elements/diagram/canvas/compiler/pipeRouter.ts` | Remove `DEFAULT_CANVAS_ASPECT` export entirely; accept `canvasAspect` parameter | Modification |
| `packages/diagram/src/compiler/handlers.ts` | Update `canvasDSL` construction; compute and thread `canvasAspect` | Modification |
| `packages/diagram/src/elements/diagram/canvas/__tests__/compile.test.ts` | Update/extend tests for new DSL props | Modification |
| `packages/diagram/src/elements/diagram/canvas/__tests__/functionalTransitionSpec.test.ts` | Update for removed `position`/`rotation` interpolation | Modification |
| `packages/diagram/src/elements/diagram/canvas/compiler/__tests__/pipeRouter.test.ts` | Update tests for `canvasAspect` parameter | Modification |

### `apps/examples` (migration — no interface changes)

All scene files using `<DiagramCanvas>` — full list in Migration section below.

---

## Part 1: Core Interface Changes (`@brewsite/core`)

### 1.1 `packages/core/src/widget/types.ts` — Add `IExtraRenderPass`

Add the following interface **after** the `ILightingOverride` interface (around line 411):

```typescript
/**
 * Widget that issues additional WebGL render passes after the main scene pass.
 *
 * Called once per frame by the render loop after `renderer.render(scene, camera)`
 * completes. Implement for widgets that require scissored sub-viewport passes
 * (e.g. DiagramCanvasWidget) or post-processing effects that must composite
 * on top of the main 3D scene.
 *
 * The main scene pass has already rendered when `renderPass()` is called.
 * The implementation must restore renderer state (scissor, viewport) to its
 * pre-call state before returning.
 *
 * @param renderer       - The active `THREE.WebGLRenderer` instance.
 * @param viewportWidth  - Current renderer output width in CSS pixels.
 * @param viewportHeight - Current renderer output height in CSS pixels.
 */
export interface IExtraRenderPass extends IWidget {
  renderPass(
    renderer: THREE.WebGLRenderer,
    viewportWidth: number,
    viewportHeight: number,
  ): void;
}
```

Add the `THREE` import at the top of the file:
```typescript
import type * as THREE from 'three';
```
(If `THREE` types are not already imported at the top of `widget/types.ts`, add this import. Check existing imports first — `WebGLRenderer` is already imported as a named import, so use `WebGLRenderer` directly rather than namespace import.)

**Revised interface using named imports** (consistent with existing pattern):

```typescript
import type { Object3D, PerspectiveCamera, Scene as ThreeScene, WebGLRenderer } from 'three';
// (already present at line 1)

export interface IExtraRenderPass extends IWidget {
  renderPass(
    renderer: WebGLRenderer,
    viewportWidth: number,
    viewportHeight: number,
  ): void;
}
```

Also export this from `packages/core/src/widget/index.ts`:
```typescript
// Add to existing exports:
export type { IExtraRenderPass } from './types';
```

### 1.2 `packages/core/src/widget/WidgetRegistry.ts` — Type Guard and Accessor

Add after the existing `isLightingOverride` type guard (around line 374):

```typescript
import type { IExtraRenderPass } from './types';

/** Type guard: returns true if widget implements IExtraRenderPass. */
export const isExtraRenderPass = (w: IWidget): w is IExtraRenderPass =>
  typeof (w as IExtraRenderPass).renderPass === 'function';
```

In the `WidgetRegistry` class, add a `getExtraRenderPassWidgets()` method alongside the existing `getAll()` / `getAllWidgets()` accessors:

```typescript
/**
 * Returns all registered widgets that implement IExtraRenderPass,
 * in registration order (which equals DSL declaration order).
 */
getExtraRenderPassWidgets(): IExtraRenderPass[] {
  return this.getAllWidgets().filter(isExtraRenderPass);
}
```

### 1.3 `packages/core/src/player/useSceneEngine.ts` — Updated Render Callback

Locate the `RuntimeLoop` constructor call (around line 876). The `render` callback currently reads:

```typescript
render: () => {
  renderer.render(scene, camera);
},
```

Replace with:

```typescript
render: () => {
  // ── Main pass: full viewport, scene Camera, 3D elements ──────────────
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
  renderer.render(scene, camera);

  // ── Extra render passes: scissored sub-viewport passes (in registration order) ──
  // DiagramCanvasWidget instances implement IExtraRenderPass and issue
  // their own scissored diagram passes here, after the main scene.
  const extraPasses = options.widgetRegistry.getExtraRenderPassWidgets();
  if (extraPasses.length > 0) {
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    for (const pass of extraPasses) {
      pass.renderPass(renderer, w, h);
    }
  }
},
```

**Important**: `renderer.domElement.clientWidth` and `clientHeight` return CSS pixel dimensions. Three.js `setViewport()` and `setScissor()` accept CSS pixel dimensions. This is correct — do NOT multiply by `devicePixelRatio`.

No other changes to `useSceneEngine.ts` are required.

---

## Part 2: Type Contract Changes (`canvas/types.ts`)

Replace the existing `DiagramCanvasDSL` and `DiagramCanvasState` interfaces entirely. The file structure and preamble comment are unchanged.

### 2.1 `DiagramCanvasDSL` (full replacement)

```typescript
/** Raw DSL props from <DiagramCanvas> in the NVS model. */
export interface DiagramCanvasDSL {
  readonly id: string;

  // ── Placement (NVS coordinates, top-left origin) ──────────────────────────
  /** NVS x-coordinate of the canvas left edge [0, 1]. Default: 0 */
  readonly x?: number;
  /** NVS y-coordinate of the canvas top edge [0, 1]. Default: 0 */
  readonly y?: number;
  /** NVS width of the canvas [0, 1]. Default: 1 */
  readonly w?: number;
  /** NVS height of the canvas [0, 1]. Default: 1 */
  readonly h?: number;

  // ── Geometry ──────────────────────────────────────────────────────────────
  /**
   * Pitch tilt applied to the diagram group geometry in radians.
   * Negative values tilt the top edge away from the viewer (typical 3D effect).
   * Default: 0 (flat, facing camera).
   */
  readonly tilt?: number;
  /**
   * World-space uniform geometry scale. The auto-fit private camera responds
   * naturally — larger geometry, camera backs up proportionally. Default: 1.
   */
  readonly scale?: number;
  /**
   * Fractional framing inset for the auto-fit private camera around the content
   * bounding box. 0 = tight crop, 0.1 = 10% margin. Default: 0.1.
   */
  readonly padding?: number;

  // ── Other ─────────────────────────────────────────────────────────────────
  /** Canvas-level theme. Propagated as default theme to all child diagrams. */
  readonly theme?: DiagramTheme;
  /** Cross-diagram pipe routing algorithm. Default: 'curved'. */
  readonly pipeRouting?: PipeRoutingAlgorithm;
  /** Pipe attachment strategy. Default: 'sides'. */
  readonly pipeLanding?: PipeLandingAlgorithm;
  /** Optional default focus center in canvas-local space (XY). */
  readonly focusCenter?: readonly [number, number] | readonly [number, number, number];
  /**
   * Default input actions derived from theme.input at compile time.
   * Consumed by DiagramCanvasWidget.getDefaultInputActions() at runtime.
   * Undefined when no theme.input is configured on the canvas.
   */
  readonly defaultInputActions?: ReadonlyArray<InputActionSpec>;
}
```

**Removed props**: `position`, `rotation`.
**New props**: `tilt`, `padding`.
**Unchanged props**: `id`, `x`, `y`, `w`, `h`, `scale`, `theme`, `pipeRouting`, `pipeLanding`, `focusCenter`, `defaultInputActions`.

### 2.2 `DiagramCanvasState` (full replacement)

```typescript
/**
 * Fully compiled state of a DiagramCanvas.
 * Owns all child diagram states and cross-diagram pipes.
 * Consumed by DiagramCanvasWidget and DiagramCanvasRenderer.
 */
export interface DiagramCanvasState {
  readonly id: string;

  /**
   * NVS bounds — authoritative for scissor rect and aspect ratio.
   * Fullscreen: { x: 0, y: 0, w: 1, h: 1 }.
   * Always present; filled with defaults by compileCanvas().
   */
  readonly nvsBounds: NVSRect;

  /**
   * Pitch tilt in radians applied to the diagram group geometry.
   * Negative = top edge tilts away from viewer. Default: 0.
   */
  readonly tilt: number;

  /** World-space uniform geometry scale. Default: 1. */
  readonly scale: number;

  /**
   * Fractional framing inset for the auto-fit private camera. Default: 0.1.
   */
  readonly padding: number;

  /**
   * Optional focus center in canvas-local space (XY).
   * When provided, focusAll() uses this as the camera look-at target
   * instead of the geometry bounding box center.
   */
  readonly focusCenter?: readonly [number, number] | readonly [number, number, number];

  /** All child diagram states, in declaration order. */
  readonly diagrams: ReadonlyArray<DiagramState>;

  /** All cross-diagram pipe states. */
  readonly pipes: ReadonlyArray<DiagramPipeState>;

  /**
   * Default input actions derived from theme.input at compile time.
   * Consumed by DiagramCanvasWidget.getDefaultInputActions() at runtime.
   */
  readonly defaultInputActions?: ReadonlyArray<InputActionSpec>;
}
```

**Removed fields**: `position`, `rotation`.
**New fields**: `tilt`, `padding`.
**Changed fields**: `nvsBounds` promoted to primary (was already present; now authoritative for scissor).
**Unchanged fields**: `id`, `scale`, `focusCenter`, `diagrams`, `pipes`, `defaultInputActions`.

---

## Part 3: Compile Changes (`canvas/compile.ts`)

### 3.1 `compileCanvas()` signature and implementation

**New signature**:
```typescript
export function compileCanvas(
  dsl: DiagramCanvasDSL,
  diagrams: ReadonlyArray<DiagramState>,
  pipes: ReadonlyArray<DiagramPipeDSL>,
  onWarn?: DiagramWarnFn,
  defaultInputActions?: ReadonlyArray<InputActionSpec>,
  canvasAspect?: number,  // NEW: actual canvas aspect at compile time; defaults to 16/9 if not provided
): DiagramCanvasState
```

**Implementation changes**:

1. Compute `nvsBounds` as before (unchanged validation logic).
2. Compute `canvasAspect` for pipe routing:
   ```typescript
   const ENGINE_ASPECT_DEFAULT = 16 / 9;
   const effectiveCanvasAspect = canvasAspect
     ?? (nvsBounds.w / nvsBounds.h) * ENGINE_ASPECT_DEFAULT;
   ```
3. Thread `effectiveCanvasAspect` into `compilePipe()` calls.
4. Return the new state shape — replace `position`/`rotation` with `tilt`/`padding`:

```typescript
return {
  id: dsl.id,
  nvsBounds,
  tilt: dsl.tilt ?? 0,
  scale: dsl.scale ?? 1,
  padding: dsl.padding ?? 0.1,
  focusCenter: dsl.focusCenter,
  diagrams,
  pipes: compiledPipes,
  defaultInputActions,
};
```

5. Remove the lines that wrote `dsl.position` and `dsl.rotation` — they no longer exist on `DiagramCanvasDSL`.

### 3.2 `compilePipe()` signature change

Add `canvasAspect: number = DEFAULT_CANVAS_ASPECT` parameter:

```typescript
export function compilePipe(
  dsl: DiagramPipeDSL,
  diagrams: ReadonlyArray<DiagramState>,
  index: number,
  routing: PipeRoutingAlgorithm = DEFAULT_PIPE_ROUTING,
  landing: PipeLandingAlgorithm = DEFAULT_PIPE_LANDING,
  onWarn?: DiagramWarnFn,
  canvasAspect: number = DEFAULT_CANVAS_ASPECT,  // NEW
): DiagramPipeState
```

Pass `canvasAspect` to all `sideAttachmentPoint()` and `nodeNvsToCanvasLocal()` calls that currently pass `DEFAULT_CANVAS_ASPECT`:

```typescript
// Before:
sideAttachmentPoint(..., DEFAULT_CANVAS_ASPECT, nodeNvsToCanvasLocal(..., DEFAULT_CANVAS_ASPECT))
// After:
sideAttachmentPoint(..., canvasAspect, nodeNvsToCanvasLocal(..., canvasAspect))
```

Do the same for the `'nearest-face'` branch:
```typescript
const fromWorld = nodeNvsToCanvasLocal(fromNode.position, fromDiagram.viewportBounds, fromDiagram.tiltRotation, canvasAspect);
const toWorld   = nodeNvsToCanvasLocal(toNode.position,   toDiagram.viewportBounds,   toDiagram.tiltRotation,   canvasAspect);
```

### 3.3 `functionalDiagramCanvasTransitionSpec` changes

Remove `position` and `rotation` interpolation. Add `tilt`, `padding`, and `nvsBounds` interpolation.

In the `interpolateFn`:

```typescript
// Remove these lines:
position: blendVec3(toMut(from.position), toMut(to.position), t) ?? to.position,
rotation: blendVec3(toMut(from.rotation), toMut(to.rotation), t) ?? to.rotation,

// Add these lines:
tilt: blendNumber(from.tilt, to.tilt, t) ?? to.tilt,
scale: blendNumber(from.scale, to.scale, t) ?? to.scale,
padding: blendNumber(from.padding, to.padding, t) ?? to.padding,
nvsBounds: {
  x: lerpNum(from.nvsBounds.x, to.nvsBounds.x, t),
  y: lerpNum(from.nvsBounds.y, to.nvsBounds.y, t),
  w: lerpNum(from.nvsBounds.w, to.nvsBounds.w, t),
  h: lerpNum(from.nvsBounds.h, to.nvsBounds.h, t),
},
```

In `exitFn` and `enterFn`, the spread `...from`/`...to` includes all fields including `tilt`, `padding`, `nvsBounds`. No explicit field changes needed there — the diagrams and pipes interpolation logic is unchanged.

Also remove the `toMut` helper (used only for `position`/`rotation` — it converts `readonly [n,n,n]` to mutable). If `blendVec3` is no longer used (only `blendNumber` and `lerpNum` remain), remove the `blendVec3` import.

Check: `blendVec3` is still used for `tiltRotation` on child diagrams (line 275 in current code). Keep the import.

### 3.4 `rerouteLivePipes` in transition spec

`rerouteLivePipes` (called in `interpolateFn`) uses `DEFAULT_PIPE_ROUTING` and `DEFAULT_PIPE_LANDING`. It also internally uses `DEFAULT_CANVAS_ASPECT` (via `pipeRouter.ts`). The `interpolateFn` has access to `to.nvsBounds`, so add `canvasAspect` threading here too:

```typescript
const ENGINE_ASPECT_DEFAULT = 16 / 9;
const canvasAspect = (to.nvsBounds.w / to.nvsBounds.h) * ENGINE_ASPECT_DEFAULT;

const livePipePoints = rerouteLivePipes(
  [...to.pipes, ...from.pipes.filter((p) => !toPipeIds.has(p.id))],
  [...interpolatedDiagrams, ...fadingDiagrams],
  DEFAULT_PIPE_ROUTING,
  DEFAULT_PIPE_LANDING,
  canvasAspect,  // NEW parameter
);
```

This requires updating `rerouteLivePipes()` in `compiler/transitionHelpers.ts` to accept and pass through `canvasAspect`.

---

## Part 4: Pipe Router Changes (`canvas/compiler/pipeRouter.ts`)

### 4.1 Remove `DEFAULT_CANVAS_ASPECT` entirely

Delete the `DEFAULT_CANVAS_ASPECT` constant from `pipeRouter.ts`. All call sites that previously passed this constant now pass the computed `canvasAspect` explicitly. Internal uses within the file (e.g. as a fallback default in function signatures) are replaced with the literal `16 / 9`.

Do not export a deprecated shim. This is a major version bump — the constant is gone. Any test file that previously imported `DEFAULT_CANVAS_ASPECT` must be updated to pass `16 / 9` directly or a test-local named constant. Since all tests are in the same monorepo, this is trivially fixable at the time of the test update (Track E).

### 4.2 No signature changes to pure routing functions

`nodeNvsToCanvasLocal`, `sideAttachmentPoint`, `routePipe` already accept `canvasAspect` as explicit parameters. No changes needed to their signatures.

### 4.3 `rerouteLivePipes()` — add `canvasAspect` parameter

`rerouteLivePipes()` is in `compiler/transitionHelpers.ts`. Update its signature:

```typescript
// In packages/diagram/src/elements/diagram/compiler/transitionHelpers.ts:
export function rerouteLivePipes(
  pipes: readonly DiagramPipeState[],
  diagrams: readonly DiagramState[],
  routing: PipeRoutingAlgorithm,
  landing: PipeLandingAlgorithm,
  canvasAspect: number = DEFAULT_CANVAS_ASPECT,  // NEW with default for backward compat
): Map<string, readonly [number, number, number][]>
```

Pass `canvasAspect` to internal `sideAttachmentPoint` and `nodeNvsToCanvasLocal` calls.

---

## Part 5: Compiler Handler Changes (`packages/diagram/src/compiler/handlers.ts`)

### 5.1 `DiagramCanvas` node handler — canvasDSL construction

Replace the current `canvasDSL` construction (around line 341):

**Before**:
```typescript
const canvasDSL: DiagramCanvasDSL = {
  id: canvasId,
  position: props.position as readonly [number, number, number] | undefined,
  rotation: props.rotation as readonly [number, number, number] | undefined,
  scale: props.scale as number | undefined,
  theme: canvasTheme,
  pipeRouting: props.pipeRouting as PipeRoutingAlgorithm | undefined,
  pipeLanding: props.pipeLanding as PipeLandingAlgorithm | undefined,
  focusCenter: props.focusCenter as readonly [number, number] | readonly [number, number, number] | undefined,
};
```

**After**:
```typescript
const canvasDSL: DiagramCanvasDSL = {
  id: canvasId,
  x: props.x as number | undefined,
  y: props.y as number | undefined,
  w: props.w as number | undefined,
  h: props.h as number | undefined,
  tilt: props.tilt as number | undefined,
  scale: props.scale as number | undefined,
  padding: props.padding as number | undefined,
  theme: canvasTheme,
  pipeRouting: props.pipeRouting as PipeRoutingAlgorithm | undefined,
  pipeLanding: props.pipeLanding as PipeLandingAlgorithm | undefined,
  focusCenter: props.focusCenter as readonly [number, number] | readonly [number, number, number] | undefined,
};
```

### 5.2 Compute `canvasAspect` and pass to `compileCanvas()`

After constructing `canvasDSL`, before calling `compileCanvas()`:

```typescript
// Compute canvas aspect at compile time from the declared NVS bounds.
// Engine viewport aspect is unknown at compile time; use 16/9 as the standard default.
// This is more accurate than DEFAULT_CANVAS_ASPECT for non-fullscreen canvases
// (e.g. w=0.5 gives canvasAspect = (0.5/1) × (16/9) = 8/9).
const ENGINE_ASPECT_DEFAULT = 16 / 9;
const compiledNvsBounds = {
  x: (props.x as number | undefined) ?? 0,
  y: (props.y as number | undefined) ?? 0,
  w: (props.w as number | undefined) ?? 1,
  h: (props.h as number | undefined) ?? 1,
};
const compiledCanvasAspect = (compiledNvsBounds.w / compiledNvsBounds.h) * ENGINE_ASPECT_DEFAULT;

const canvasState = compileCanvas(canvasDSL, diagramStates, pipeDSLs, onWarn, defaultInputActions, compiledCanvasAspect);
```

### 5.3 Remove `position`/`rotation` TypeScript props from the `DiagramCanvas` handler

TypeScript will now produce a compile error if scene authors pass `position` or `rotation` to `<DiagramCanvas>` because those fields are absent from `DiagramCanvasDSL`. No additional change needed — the type system enforces this automatically.

---

## Part 6: Render Layer Changes (`canvas/render.ts`)

### 6.1 `DiagramCanvasRenderer.update()` — new signature

Remove the `camera?: THREE.PerspectiveCamera` parameter. Accept explicit `canvasAspect` and pan/rotation offsets instead:

```typescript
/**
 * Updates the canvas geometry group in the provided scene.
 *
 * The scene passed here MUST be the widget's private diagram scene,
 * not the main Three.js scene. DiagramCanvasWidget owns the private scene
 * and passes it here on every apply() call.
 *
 * @param state         Compiled canvas state (tilt, scale, nvsBounds).
 * @param scene         Private THREE.Scene owned by DiagramCanvasWidget.
 * @param canvasAspect  (nvsBounds.w / nvsBounds.h) × engineAspect.
 * @param panOffset     Input-accumulated translation [dx, dy, dz] in world units.
 * @param rotationOffset Additional pitch offset in radians (from interactive rotate).
 */
update(
  state: DiagramCanvasState,
  scene: THREE.Scene,
  canvasAspect: number,
  panOffset: readonly [number, number, number],
  rotationOffset: number,
): void {
  if (!this.canvasGroup) {
    this.canvasGroup = new THREE.Group();
    this.canvasGroup.name = `canvas:${state.id}`;
    this.pipeRoot = new THREE.Group();
    this.pipeRoot.name = `canvas:${state.id}:pipes`;
    this.canvasGroup.add(this.pipeRoot);
    scene.add(this.canvasGroup);
    this.pipeRenderer = new EdgeRenderer(new EdgeMaterialFactory());
  }

  // Position: pan offset only (no authored world position in new model).
  this.canvasGroup.position.set(panOffset[0], panOffset[1], panOffset[2]);
  // Rotation: authored tilt + interactive rotation offset.
  this.canvasGroup.rotation.set(state.tilt + rotationOffset, 0, 0);
  // Scale: authored world-space scale.
  this.canvasGroup.scale.setScalar(state.scale);

  // ... rest unchanged (diagram renderers, pipe renderers) ...
}
```

### 6.2 Add `getBoundingBox()` method

```typescript
/**
 * Returns the world-space axis-aligned bounding box of all diagram geometry
 * in the canvas group, or null if the group is not yet initialized or is empty.
 */
getBoundingBox(): THREE.Box3 | null {
  if (!this.canvasGroup) return null;
  const box = new THREE.Box3().setFromObject(this.canvasGroup);
  if (box.isEmpty()) return null;
  return box;
}
```

### 6.3 Remove `camera` from `dispose()`

The `dispose()` method signature is unchanged; it already takes `(canvasId, scene)`. The `scene` parameter now refers to the private scene (caller passes `this.diagramScene`).

### 6.4 `canvasAspect` computation moved to widget

Remove the internal `engineAspect = camera?.aspect ?? 16/9` and `canvasAspect = ...` computation from `update()`. The caller (`DiagramCanvasWidget.apply()`) computes and passes `canvasAspect` directly.

---

## Part 7: Widget Changes (`canvas/widget.ts`)

### 7.1 Interface implements list

**Before**:
```typescript
export class DiagramCanvasWidget
  implements
    ISceneElement<DiagramCanvasState>,
    IRenderable<DiagramCanvasState>,
    IAnimationController,
    IInputDefaultProvider,
    INVSBounded,
    ILightingOverride
```

**After**:
```typescript
export class DiagramCanvasWidget
  implements
    ISceneElement<DiagramCanvasState>,
    IRenderable<DiagramCanvasState>,
    IExtraRenderPass,
    IInputDefaultProvider,
    INVSBounded
```

- **Removed**: `IAnimationController`, `ILightingOverride`
- **Added**: `IExtraRenderPass`

### 7.2 New imports

```typescript
import type {
  IExtraRenderPass,
  IInputDefaultProvider,
  INVSBounded,
  IRenderable,
  ISceneElement,
  InputActionSpec,
  NVSRect,
  WidgetInitContext,
  WidgetRenderContext,
} from '@brewsite/core';
// Remove: IAnimationController, ICameraFocusTarget, ILightingOverride, AnimationTickContext
```

Also add `THREE` import for `THREE.WebGLRenderer` in `renderPass()`.

### 7.3 Private field changes

**Remove**:
- `private _cameraFocusTarget: ICameraFocusTarget | null = null;`
- `private _lightController: ((lightId: string, enabled: boolean) => void) | null = null;`
- `readonly tickPriority = 1;`

**Change**:
- `private scene: THREE.Scene | null = null;` → becomes `private diagramScene: THREE.Scene | null = null;` (private scene, NOT main scene)
- `private cameraRef: THREE.PerspectiveCamera | null = null;` → becomes `private privateCamera: THREE.PerspectiveCamera | null = null;`
- Add `private rendererRef: THREE.WebGLRenderer | null = null;`
- `private inputRotation: [number, number, number] = [0, 0, 0];` → becomes `private inputRotation: number = 0;` (pitch only)

### 7.4 `initialize()` — major changes

```typescript
initialize({ scene: _mainScene, renderer, camera: _sharedCamera }: WidgetInitContext): void {
  // Create private scene — diagram geometry lives here, NOT in the main scene.
  this.diagramScene = new THREE.Scene();

  // Create private perspective camera for scissored diagram pass.
  // FOV 45° is the standard default; auto-fit adjusts distance to match geometry.
  this.privateCamera = new THREE.PerspectiveCamera(
    PRIVATE_CAMERA_FOV,
    1, // aspect updated in apply()
    0.01,
    1000,
  );

  // Store renderer reference for size queries in apply() and renderPass().
  if (renderer) this.rendererRef = renderer;

  // Register DOM event listeners for interaction (unchanged from current).
  if (renderer?.domElement) {
    this.canvasElement = renderer.domElement;
    this.clickHandler = (e) => this.handleClick(e);
    this.mouseMoveHandler = (e) => this.handleMouseMove(e);
    this.mouseLeaveHandler = () => this.clearHover();
    this.canvasElement.addEventListener('click', this.clickHandler);
    this.canvasElement.addEventListener('mousemove', this.mouseMoveHandler);
    this.canvasElement.addEventListener('mouseleave', this.mouseLeaveHandler);
  }
  // Note: _mainScene and _sharedCamera are intentionally unused.
  // Diagram geometry is in this.diagramScene; camera is this.privateCamera.
}
```

### 7.5 Remove `onTick()` and `getLightingOverride()` / `receiveLightController()`

Delete these methods entirely:
- `onTick(context: AnimationTickContext): void` — no longer needed
- `getLightingOverride(): { disableAll: boolean } | null` — dead code in new model
- `receiveLightController(setter: ...): void` — dead code in new model

### 7.6 `apply()` — new implementation

```typescript
apply(state: DiagramCanvasState, _ctx: WidgetRenderContext): void {
  this.currentInputActions = state.defaultInputActions;

  if (!this.diagramScene || !this.privateCamera || !this.rendererRef) return;

  // Compute canvas aspect ratio from renderer size and NVS bounds.
  const size = new THREE.Vector2();
  this.rendererRef.getSize(size);
  const engineAspect = size.x > 0 && size.y > 0 ? size.x / size.y : 16 / 9;
  const canvasAspect = (state.nvsBounds.w / state.nvsBounds.h) * engineAspect;

  // Update private camera aspect and auto-fit to content bounding box.
  this.privateCamera.aspect = canvasAspect;
  this.privateCamera.updateProjectionMatrix();

  // Store state for renderPass() and interaction handlers.
  this.lastState = state;

  // Update diagram geometry in the private scene.
  this.renderer.update(
    state,
    this.diagramScene,
    canvasAspect,
    this.inputTranslation,
    this.inputRotation,
  );

  // Auto-fit private camera to the current geometry bounding box.
  this.updateAutoFitCamera(state, canvasAspect);
}
```

### 7.7 `updateAutoFitCamera()` — new private method

```typescript
private updateAutoFitCamera(state: DiagramCanvasState, canvasAspect: number): void {
  const cam = this.privateCamera;
  if (!cam) return;

  const box = this.renderer.getBoundingBox();
  if (!box) {
    // No geometry yet — position camera at sensible default.
    cam.position.set(0, 0, 5);
    cam.lookAt(0, 0, 0);
    return;
  }

  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);

  // Approximate fit: select the dimension that requires more pullback.
  // Note: Math.max(size.x / canvasAspect, size.y) uses vertical FOV for both
  // horizontal and vertical fitting. This is a slight over-approximation for
  // wide canvases — the camera backs up a bit further than the exact tight fit.
  // The padding prop absorbs the visual difference. Exact correction is v2 DEBT.
  const fovRad = THREE.MathUtils.degToRad(PRIVATE_CAMERA_FOV);
  const maxDim = Math.max(size.x / canvasAspect, size.y);
  const dist = (maxDim / 2 / Math.tan(fovRad / 2)) * (1 + state.padding);

  if (!Number.isFinite(dist) || dist <= 0) return;

  cam.position.set(center.x, center.y, center.z + dist);
  cam.lookAt(center.x, center.y, center.z);
}
```

Add the constant at file top:
```typescript
/** Fixed FOV for the diagram's private perspective camera. */
const PRIVATE_CAMERA_FOV = 45;
```

### 7.8 `renderPass()` — new IExtraRenderPass implementation

```typescript
/**
 * IExtraRenderPass — issues a scissored render pass for this canvas.
 *
 * Called by useSceneEngine's render callback AFTER renderer.render(scene, camera)
 * completes the main scene pass. Renders the private diagram scene with the private
 * camera, scissored to the NVS bounds.
 *
 * Render order: main scene pass → [each DiagramCanvas.renderPass() in declaration order].
 *
 * Note: If two DiagramCanvas NVS regions overlap, the later-declared canvas renders
 * on top within the overlap region. This is intentional (see PRD §8.3). No compile-time
 * overlap validation is performed in V1.
 */
renderPass(renderer: THREE.WebGLRenderer, viewportWidth: number, viewportHeight: number): void {
  if (!this.diagramScene || !this.privateCamera || !this.lastState) return;

  const { nvsBounds } = this.lastState;

  // NVS → pixel conversion. WebGL origin is bottom-left; NVS origin is top-left.
  // Apply Math.round() to avoid sub-pixel rounding artifacts.
  const left   = Math.round(nvsBounds.x * viewportWidth);
  const bottom = Math.round((1 - nvsBounds.y - nvsBounds.h) * viewportHeight);
  const width  = Math.round(nvsBounds.w * viewportWidth);
  const height = Math.round(nvsBounds.h * viewportHeight);

  // Guard against degenerate bounds (zero-area regions produce WebGL errors).
  if (width <= 0 || height <= 0) return;

  renderer.setScissorTest(true);
  renderer.setScissor(left, bottom, width, height);
  renderer.setViewport(left, bottom, width, height);

  // Clear depth buffer only — preserve main scene color underneath.
  // The diagram composites on top of the main scene within its NVS bounds.
  renderer.clearDepth();

  renderer.render(this.diagramScene, this.privateCamera);

  // Restore renderer state for subsequent passes.
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, viewportWidth, viewportHeight);
}
```

### 7.9 `dispose()` — updated

```typescript
dispose(): void {
  // Remove DOM event listeners.
  if (this.canvasElement && this.clickHandler) {
    this.canvasElement.removeEventListener('click', this.clickHandler);
    if (this.mouseMoveHandler) this.canvasElement.removeEventListener('mousemove', this.mouseMoveHandler);
    if (this.mouseLeaveHandler) this.canvasElement.removeEventListener('mouseleave', this.mouseLeaveHandler);
    this.canvasElement = null;
    this.clickHandler = null;
    this.mouseMoveHandler = null;
    this.mouseLeaveHandler = null;
  }
  this.clearHover();

  // Dispose diagram scene geometry.
  if (this.diagramScene) {
    this.renderer.dispose(this.widgetId, this.diagramScene);
    this.diagramScene = null;
  }

  this.privateCamera = null;
  this.rendererRef = null;
  this.lastState = null;
  this.inputTranslation = [0, 0, 0];
  this.inputRotation = 0;
  clearDiagramFocusRegion(this.widgetId);
  this.currentInputActions = undefined;
}
```

### 7.10 `applyInputRotate()` — simplified to pitch-only

```typescript
applyInputRotate(rx: number, _ry: number = 0, _rz: number = 0): void {
  // Only pitch (X axis) is supported in the new model. Y and Z are ignored.
  this.inputRotation += rx;
}
```

Change `inputRotation` field type from `[number, number, number]` to `number`.

### 7.11 `resetInputTransform()` — updated

```typescript
resetInputTransform(): void {
  this.inputTranslation = [0, 0, 0];
  this.inputRotation = 0;
}
```

### 7.12 `focusMesh()` and `focusAll()` — operate on private camera

**`focusMesh()`** — remove `ICameraFocusTarget` usage, operate directly on `privateCamera`:

```typescript
private focusMesh(mesh: THREE.Object3D): void {
  const cam = this.privateCamera;
  if (!cam) return;

  const box = new THREE.Box3().setFromObject(mesh);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return;

  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);

  const width = Math.max(0.001, size.x);
  const height = Math.max(0.001, size.y);
  const fovRad = THREE.MathUtils.degToRad(PRIVATE_CAMERA_FOV);
  const canvasAspect = cam.aspect || 1;
  const distY = (height / 2) / Math.tan(fovRad / 2);
  const distX = (width / 2) / (Math.tan(fovRad / 2) * canvasAspect);
  const dist = Math.max(distX, distY) * 1.2;

  // DEBT: Snap focus (no smooth animation). V2 should interpolate cam.position
  // toward the target over several frames using a lerp or spring.
  cam.position.set(center.x, center.y, center.z + dist);
  cam.lookAt(center.x, center.y, center.z);

  const info = this.renderer.lookupGroupInteraction(mesh as THREE.Mesh);
  if (info) {
    publishDiagramFocusGroup(this.defaultState, info.diagramId, info.groupId);
  }
}
```

Remove the `cam: THREE.PerspectiveCamera` parameter (was passed from `applyInputFocus`). The private camera is always used.

**`focusAll()`** — operate on private camera:

```typescript
private focusAll(
  focusCenter?: [number, number] | [number, number, number] | readonly [number, number] | readonly [number, number, number],
): void {
  const cam = this.privateCamera;
  const state = this.lastState;
  if (!cam || !state) return;

  // Focus center priority: per-action override → authored focusCenter → geometry center.
  const centerSource = focusCenter ?? state.focusCenter ?? this.defaultState.focusCenter;
  let center: THREE.Vector3;

  if (centerSource) {
    center = new THREE.Vector3(centerSource[0], centerSource[1], (centerSource as readonly number[])[2] ?? 0);
  } else {
    // Fall back to geometry bounding box center.
    const box = this.renderer.getBoundingBox();
    if (!box) return;
    center = new THREE.Vector3();
    box.getCenter(center);
  }

  // Compute camera distance to show the full diagram with canvas aspect.
  const canvasAspect = cam.aspect || 1;
  const box = this.renderer.getBoundingBox();
  if (!box) return;
  const size = new THREE.Vector3();
  box.getSize(size);

  const worldW = Math.max(0.001, size.x);
  const worldH = Math.max(0.001, size.y);
  const fovRad = THREE.MathUtils.degToRad(PRIVATE_CAMERA_FOV);
  const distY = (worldH / 2) / Math.tan(fovRad / 2);
  const distX = (worldW / 2) / (Math.tan(fovRad / 2) * canvasAspect);
  const dist = Math.max(distX, distY) * 1.2;

  // DEBT: Snap focus. V2 should animate smoothly.
  cam.position.set(center.x, center.y, center.z + dist);
  cam.lookAt(center.x, center.y, center.z);

  publishDiagramFocusCanvas(this.defaultState);
}
```

### 7.13 `applyInputFocus()` — remove camera parameter threading

```typescript
applyInputFocus(
  clientX: number,
  clientY: number,
  focusCenter?: [...],
): void {
  if (!this.diagramScene || !this.canvasElement) return;
  const requestedCenter = focusCenter ?? this.lastState?.focusCenter ?? this.defaultState.focusCenter;
  if (requestedCenter) {
    this.focusAll(requestedCenter);
    return;
  }

  this.computeNdc(clientX, clientY);
  const cam = this.privateCamera;
  if (!cam) return;
  this.raycaster.setFromCamera(this.ndc, cam);

  const groupHits = this.raycaster.intersectObjects(
    Array.from(this.renderer.getGroupInteractionMeshes()),
    false,
  );
  if (groupHits.length > 0) {
    const hit = pickSmallest(groupHits);
    this.focusMesh(hit.object);  // No camera parameter
    return;
  }
  this.focusAll(focusCenter);
}
```

### 7.14 `handleClick()` and `handleMouseMove()` — use `privateCamera`

Replace all occurrences of `this.cameraRef` with `this.privateCamera` in interaction handler methods.

### 7.15 `createHoverControls()` — setLightEnabled becomes no-op

```typescript
private createHoverControls(defaultDiagramId: string): DiagramHoverControls {
  return {
    setLightEnabled: (_lightId, _enabled) => {
      // DEBT: In the isolated render pass model, core scene lights do not reach
      // the diagram's private scene. Toggling them from a hover callback has no
      // visible effect on diagram geometry. For mixed scenes where toggling a main
      // scene light from a diagram hover is desired, V2 should publish a light
      // toggle event to the main scene via a shared bus.
    },
    setNodeEmissive: (nodeId, enabled, options) => {
      const diagramId = options?.diagramId ?? defaultDiagramId;
      this.renderer.setNodeEmissiveOverride(diagramId, nodeId, enabled);
    },
    // ... rest unchanged
  };
}
```

---

## Part 8: DSL Component Changes

**Important**: In this codebase, the DSL component functions (`DiagramCanvas`, `DiagramPipe`) are **colocated in `widget.ts`**, not in `dsl.tsx`. The `dsl.tsx` file contains only the TypeScript prop interfaces (`DiagramCanvasProps`, `DiagramPipeProps`). `handlers.ts` imports the component functions from `canvas/widget.ts` — not `dsl.tsx`.

This means changes are needed in **two files**:

### 8.1 `canvas/dsl.tsx` — Update `DiagramCanvasProps` interface (Track B)

```typescript
export interface DiagramCanvasProps {
  id: string;
  // ── Placement ──────────────────────────────────────────────────────────────
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  // ── Geometry ───────────────────────────────────────────────────────────────
  tilt?: number;
  scale?: number;
  padding?: number;
  // ── Other ──────────────────────────────────────────────────────────────────
  theme?: DiagramTheme;
  pipeRouting?: PipeRoutingAlgorithm;
  pipeLanding?: PipeLandingAlgorithm;
  focusCenter?: readonly [number, number] | readonly [number, number, number];
  children?: React.ReactNode;
}
```

**Remove**: `position`, `rotation`.
**Add**: `tilt`, `padding`.

The `children` and other unchanged props remain.

### 8.2 `canvas/widget.ts` — Update `DiagramCanvas` component JSDoc (Track F)

The `DiagramCanvas` function component stub lives at the top of `widget.ts` (around line 52). Update its JSDoc comment:

```typescript
/**
 * DiagramCanvas — NVS-primary container for one or more <Diagram> elements.
 *
 * Placement is declared via {x, y, w, h} NVS coordinates (top-left origin, [0,1]).
 * The diagram renders exclusively within its NVS region via a scissored
 * sub-viewport pass with an isolated depth buffer.
 *
 * @prop x       - NVS left edge [0,1]. Default: 0.
 * @prop y       - NVS top edge [0,1]. Default: 0.
 * @prop w       - NVS width [0,1]. Default: 1.
 * @prop h       - NVS height [0,1]. Default: 1.
 * @prop tilt    - Pitch tilt in radians. Negative = top tilts away. Default: 0.
 * @prop scale   - World-space geometry scale. Default: 1.
 * @prop padding - Auto-fit camera framing inset [0..1]. Default: 0.1.
 *
 * Multiple DiagramCanvas instances in a scene are fully independent.
 * If NVS regions overlap, the later-declared canvas renders on top.
 */
export function DiagramCanvas(_props: DiagramCanvasProps): null {
  return null;
}
```

The function body is unchanged (returns null). Only the JSDoc changes.

---

## Part 9: Breaking Changes and Migration Guide

### Breaking changes

| What | Before | After |
|---|---|---|
| `DiagramCanvasDSL.position` | Camera look-at target `[x,y,z]` | **Removed**. TypeScript error if used. |
| `DiagramCanvasDSL.rotation` | Euler XYZ rotation `[x,y,z]` | **Removed**. TypeScript error if used. |
| `DiagramCanvasDSL.tilt` | Did not exist | **Added**: pitch in radians. |
| `DiagramCanvasDSL.padding` | Did not exist | **Added**: framing inset, default 0.1. |
| `DiagramCanvasState.position` | World position `[x,y,z]` | **Removed** from compiled state. |
| `DiagramCanvasState.rotation` | Euler XYZ rotation `[x,y,z]` | **Removed** from compiled state. |
| `DiagramCanvasState.tilt` | Did not exist | **Added**: `number`. |
| `DiagramCanvasState.padding` | Did not exist | **Added**: `number`. |
| Camera takeover | `DiagramCanvasWidget` repositioned shared scene camera | Removed. Scene Camera is unaffected. |
| `ILightingOverride` | Implemented on `DiagramCanvasWidget` | Removed. Core lights do not reach diagram pass. |

### Migration pattern

For every `<DiagramCanvas>` in `apps/examples/src`:

```tsx
// BEFORE:
<DiagramCanvas
  id="my-canvas"
  position={[0, config.diagramTop, 0]}       // camera look-at target
  rotation={[config.diagramRotationX, 0, 0]} // pitch tilt
  scale={config.diagramScale}
  theme={myTheme}
>

// AFTER:
<DiagramCanvas
  id="my-canvas"
  x={0} y={0} w={1} h={0.55}    // NVS placement — where the diagram renders
  tilt={config.diagramRotationX} // pitch tilt (same value as rotation[0])
  scale={config.diagramScale}    // scale unchanged
  theme={myTheme}
>
```

**Key mapping rules**:
1. `rotation={[rx, 0, 0]}` → `tilt={rx}` (copy `rotation[0]` to `tilt`)
2. `position` → **delete** (replaced by NVS placement)
3. Add `x`, `y`, `w`, `h` to match the intended screen region
4. The `config.diagramTop` nudge (position.y=0.1) compensated for camera look-at drift — not needed in new model. Use `y` NVS coordinate if vertical shift is desired.

### Files requiring migration in `apps/examples/src`

The following exhaustive file list was produced by running:
```
grep -r 'DiagramCanvas' apps/examples/src --include='*.tsx' -l
```

**brewflow-comparison** (11 files):
- `apps/examples/src/brewflow-comparison/scenes/scene_bf_overview.tsx`
- `apps/examples/src/brewflow-comparison/scenes/scene_cf_overview.tsx`
- `apps/examples/src/brewflow-comparison/scenes/scene_dim1_audit.tsx`
- `apps/examples/src/brewflow-comparison/scenes/scene_dim2_learning.tsx`
- `apps/examples/src/brewflow-comparison/scenes/scene_dim3_context.tsx`
- `apps/examples/src/brewflow-comparison/scenes/scene_dim4_coordination.tsx`
- `apps/examples/src/brewflow-comparison/scenes/scene_dim5_restart.tsx`
- `apps/examples/src/brewflow-comparison/scenes/scene_dim6_gating.tsx`
- `apps/examples/src/brewflow-comparison/scenes/scene_dim7_safety.tsx`
- `apps/examples/src/brewflow-comparison/scenes/scene_dim8_maturity.tsx`
- `apps/examples/src/brewflow-comparison/scenes/scene_summary.tsx`

**brewflow-sidecar** (6 files):
- `apps/examples/src/brewflow-sidecar/scenes/scene_architecture.tsx`
- `apps/examples/src/brewflow-sidecar/scenes/scene_deployment_levels.tsx`
- `apps/examples/src/brewflow-sidecar/scenes/scene_dreamer.tsx`
- `apps/examples/src/brewflow-sidecar/scenes/scene_mcp.tsx`
- `apps/examples/src/brewflow-sidecar/scenes/scene_sequence_failure.tsx`
- `apps/examples/src/brewflow-sidecar/scenes/scene_sequence_normal.tsx`
- `apps/examples/src/brewflow-sidecar/scenes/scene_surfaces.tsx`

**brewflow-memory** (7 files):
- `apps/examples/src/brewflow-memory/scenes/scene_cls_theory.tsx`
- `apps/examples/src/brewflow-memory/scenes/scene_episodic_store.tsx`
- `apps/examples/src/brewflow-memory/scenes/scene_injector.tsx`
- `apps/examples/src/brewflow-memory/scenes/scene_learning_loop.tsx`
- `apps/examples/src/brewflow-memory/scenes/scene_neocortex.tsx`
- `apps/examples/src/brewflow-memory/scenes/scene_sensitive_data_guard.tsx`
- `apps/examples/src/brewflow-memory/scenes/scene_somniocortex.tsx`

**brewflow-multiuser** (11 files):
- `apps/examples/src/brewflow-multiuser/scenes/scene_conflict.tsx`
- `apps/examples/src/brewflow-multiuser/scenes/scene_convergence.tsx`
- `apps/examples/src/brewflow-multiuser/scenes/scene_crossuser_flow.tsx`
- `apps/examples/src/brewflow-multiuser/scenes/scene_debate_rounds.tsx`
- `apps/examples/src/brewflow-multiuser/scenes/scene_dreaming_cloud.tsx`
- `apps/examples/src/brewflow-multiuser/scenes/scene_episodic_partition.tsx`
- `apps/examples/src/brewflow-multiuser/scenes/scene_expert_roles.tsx`
- `apps/examples/src/brewflow-multiuser/scenes/scene_fractal.tsx`
- `apps/examples/src/brewflow-multiuser/scenes/scene_neocortex_scopes.tsx`
- `apps/examples/src/brewflow-multiuser/scenes/scene_problems.tsx`
- `apps/examples/src/brewflow-multiuser/scenes/scene_session_hierarchy.tsx`

**whiteboard-arch** (7 files):
- `apps/examples/src/whiteboard-arch/scenes/scene_alb.tsx`
- `apps/examples/src/whiteboard-arch/scenes/scene_client.tsx`
- `apps/examples/src/whiteboard-arch/scenes/scene_controlplane.tsx`
- `apps/examples/src/whiteboard-arch/scenes/scene_fwcloud.tsx`
- `apps/examples/src/whiteboard-arch/scenes/scene_overview.tsx`
- `apps/examples/src/whiteboard-arch/scenes/scene_parkinglot.tsx`
- `apps/examples/src/whiteboard-arch/scenes/scene_proxy.tsx`

**architecture** (4 files):
- `apps/examples/src/architecture/scenes/scene_charts.tsx`
- `apps/examples/src/architecture/scenes/scene_core.tsx`
- `apps/examples/src/architecture/scenes/scene_diagram.tsx`
- `apps/examples/src/architecture/scenes/scene_model.tsx`

**slides-demo** (1 file):
- `apps/examples/src/slides-demo/deck.tsx`

**Total: 47 files to migrate.**

**`apps/examples/src/settings.ts`** — after all migrations are complete, verify zero remaining usages before removing fields:
```bash
grep -r 'diagramRotationX\|diagramTop' apps/examples/src
```
If output is empty, delete `diagramRotationX` and `diagramTop` from `settings.ts`. Run the same check for `diagramScale`; if zero usages remain, remove it too and delete the `config` export entirely if no other fields remain.

---

## Part 10: Architect's Resolution of Open Questions

### Open Question 1: `ICameraFocusTarget` Generalization

**Resolution**: Not generalized. Not needed.

`ICameraFocusTarget` is a contract for operating on the SHARED scene camera. `DiagramCanvasWidget` no longer interacts with the shared scene camera at all. The private camera is an implementation detail of `DiagramCanvasWidget`; it requires no protocol interface because it is never accessed from outside the widget.

`focusMesh()` and `focusAll()` directly operate on `this.privateCamera`. This is the correct abstraction level — the private camera is a rendering detail, not a cross-widget contract.

**Impact on CameraWidget**: No changes required to `CameraWidget`. The `ICameraFocusTarget` interface definition in `@brewsite/core` is unchanged and continues to be implemented by `CameraWidget` for its existing consumers.

### Open Question 2: Multiple Canvas Instances, Single vs. Multiple Render Targets

**Resolution**: Single default framebuffer with scissor. No render targets per canvas.

The scissor + depth-clear approach described in PRD §8.1 is both sufficient and correct:
- Each canvas has its own private `THREE.Scene`, its own `THREE.PerspectiveCamera`, and issues its own `renderer.render(diagramScene, privateCamera)` call with scissor/viewport set to its NVS bounds.
- `renderer.clearDepth()` before each diagram pass ensures 3D scene geometry does not conflict with diagram geometry at the same Z values.
- No per-canvas `THREE.WebGLRenderTarget` is required — compositing against the default framebuffer is exactly what is needed.

**NVS overlap behavior**: If two canvases overlap, WebGL draw order determines the result. The later-declared canvas's `renderPass()` runs second and overwrites the earlier canvas's pixels in the overlap region. This is well-defined, documented, and consistent with the PRD declaration-order rule (§8.3). No compile-time validation is implemented in V1 (see Decision 2 above).

### Open Question 3: `ILightingOverride` Dead Code

**Verification**: Confirmed dead code in new model.

In the new model:
- `DiagramCanvasWidget.diagramScene` is a fresh `THREE.Scene` created by the widget.
- Core lights (`THREE.AmbientLight`, `THREE.DirectionalLight`, etc.) are added to the MAIN scene by `LightingWidget.apply()`. They are never added to `diagramScene`.
- The private camera renders only `diagramScene` — it never sees the main scene's lights.
- Therefore `getLightingOverride()` returning `{ disableAll: true }` is unreachable code.

**Action**: Remove `ILightingOverride` from `DiagramCanvasWidget` entirely (interface removed from implements list, methods deleted, `_lightController` field deleted). The compiler will fail on `setLightingOverrides()` call if the widget is no longer an `ILightingOverride`. Verify that `packages/core/src/player/plugins.ts` (around line 50) does not hard-code `DiagramCanvasWidget` as an `ILightingOverride` — it uses type guards (`isLightingOverride`), so removing the interface implementation is sufficient.

---

## Part 11: Test Strategy

All tests follow the interface-based stateful test pattern: real inputs, assert real outputs. Mocks of Three.js renderer methods (`setScissor`, `setViewport`, `render`) are explicitly justified below — they test that the correct renderer API is called with the correct arguments, not that the renderer itself works correctly. This is the appropriate boundary.

### Test 1: `canvas/__tests__/compile.test.ts` — Update existing tests

Update `makeDiagram` and `compileCanvas()` call sites to use new DSL props:

```typescript
const state = compileCanvas(
  { id: 'test', tilt: -0.3, scale: 1, padding: 0.1, x: 0, y: 0, w: 1, h: 0.55 },
  diagrams,
  [],
);
expect(state.tilt).toBe(-0.3);
expect(state.padding).toBe(0.1);
expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 0.55 });
expect('position' in state).toBe(false);
expect('rotation' in state).toBe(false);
```

**New test cases to add**:
1. Defaults: omitting all optional props → `tilt=0`, `padding=0.1`, `nvsBounds={x:0,y:0,w:1,h:1}`.
2. `canvasAspect` correctness: control points for the same node positions differ when `canvasAspect=8/9` vs `16/9` (sub-canvas placement fix regression test).
3. NVS out-of-bounds: `x=-0.1` emits `console.error` in non-production.
4. Explicit `canvasAspect`: control points are deterministically computed for a known input.

### Test 2: `canvas/__tests__/functionalTransitionSpec.test.ts` — Update

Build test states using new fields. Remove all `position`/`rotation` interpolation tests. Add:
1. `tilt` interpolates at `t=0.5`: result equals `(from.tilt + to.tilt) / 2`.
2. `nvsBounds` interpolates at `t=0.5`: each `x/y/w/h` field lerps.
3. `padding` interpolates at `t=0.5`.
4. `exitFn`/`enterFn` preserve `tilt`, `padding`, `nvsBounds` from the from/to state.

### Test 3: `compiler/__tests__/pipeRouter.test.ts` — Update

Replace all uses of the removed `DEFAULT_CANVAS_ASPECT` constant with the explicit literal `16 / 9`. Add a test verifying that `sideAttachmentPoint` and `nodeNvsToCanvasLocal` produce different results for `canvasAspect = 8/9` vs `16/9` with identical inputs.

### Test 4: `canvas/__tests__/widget.renderPass.test.ts` — New (pure behavior + renderer call verification)

**4a. Pure scissor math** — `nvsToScissorRect`:

Extract scissor rect calculation from `renderPass()` as an exported pure helper in `widget.ts` (see Part 7.8 for function spec). Test it directly:

```typescript
import { nvsToScissorRect } from '../widget';

it('NVS top-half maps to correct WebGL bottom-half pixel rect', () => {
  // NVS y=0, h=0.5 is the top half. WebGL bottom = (1 - 0 - 0.5) * 600 = 300.
  const rect = nvsToScissorRect({ x: 0, y: 0, w: 1, h: 0.5 }, 1600, 600);
  expect(rect).toEqual({ left: 0, bottom: 300, width: 1600, height: 300 });
});

it('NVS right-half maps to correct left/width', () => {
  const rect = nvsToScissorRect({ x: 0.5, y: 0, w: 0.5, h: 1 }, 1600, 600);
  expect(rect).toEqual({ left: 800, bottom: 0, width: 800, height: 600 });
});

it('sub-pixel NVS values are rounded', () => {
  // x=0.333, w=0.334 on 1000px wide viewport → left=333, width=334
  const rect = nvsToScissorRect({ x: 0.333, y: 0, w: 0.334, h: 1 }, 1000, 600);
  expect(rect.left).toBe(333);
  expect(rect.width).toBe(334);
});
```

**4b. `computeNdcForNvs` — NVS sub-region pointer mapping**:

```typescript
import { computeNdcForNvs } from '../widget';

it('maps pointer at center of NVS sub-region to NDC (0, 0)', () => {
  // Right half canvas. Center of right half = x=1200, y=300 on 1600×600 viewport.
  const ndc = computeNdcForNvs(1200, 300, 1600, 600, { x: 0.5, y: 0, w: 0.5, h: 1 });
  expect(ndc.x).toBeCloseTo(0, 3);
  expect(ndc.y).toBeCloseTo(0, 3);
});

it('maps pointer at NVS sub-region top-left to NDC (-1, 1)', () => {
  const ndc = computeNdcForNvs(800, 0, 1600, 600, { x: 0.5, y: 0, w: 0.5, h: 1 });
  expect(ndc.x).toBeCloseTo(-1, 3);
  expect(ndc.y).toBeCloseTo(1, 3);
});
```

**4c. Render integration — verify `setScissor` is called with correct pixel rect**:

This test verifies the `renderPass()` contract: that the correct WebGL scissor/viewport calls are made. We use `vi.fn()` mocks on the renderer API — this is justified because we are testing the *call contract* (which arguments are passed to Three.js), not the internal Three.js implementation.

```typescript
import { vi, describe, it, expect } from 'vitest';

// Construct a minimal mock renderer that records calls.
const makeMockRenderer = () => ({
  setScissorTest: vi.fn(),
  setScissor: vi.fn(),
  setViewport: vi.fn(),
  clearDepth: vi.fn(),
  render: vi.fn(),
});

describe('DiagramCanvasWidget.renderPass()', () => {
  it('calls setScissor with correct pixel rect for right-half NVS region', () => {
    const widget = new DiagramCanvasWidget('test', makeDefaultCanvasState());
    // Prime lastState with a known nvsBounds.
    const state: DiagramCanvasState = {
      ...makeDefaultCanvasState(),
      nvsBounds: { x: 0.5, y: 0, w: 0.5, h: 1 },
    };
    // Force lastState (replicate what apply() would do without full Three.js setup).
    (widget as unknown as { lastState: DiagramCanvasState }).lastState = state;
    // Also set diagramScene and privateCamera to non-null stubs.
    (widget as unknown as { diagramScene: object }).diagramScene = {};
    (widget as unknown as { privateCamera: object }).privateCamera = {};

    const renderer = makeMockRenderer();
    widget.renderPass(renderer as unknown as THREE.WebGLRenderer, 1600, 600);

    // Right half: left=800, bottom=0, width=800, height=600.
    expect(renderer.setScissor).toHaveBeenCalledWith(800, 0, 800, 600);
    expect(renderer.setViewport).toHaveBeenCalledWith(800, 0, 800, 600);
    expect(renderer.setScissorTest).toHaveBeenCalledWith(true);
    expect(renderer.clearDepth).toHaveBeenCalledOnce();
    expect(renderer.render).toHaveBeenCalledOnce();
    // Scissor test must be reset after pass.
    expect(renderer.setScissorTest).toHaveBeenLastCalledWith(false);
  });

  it('does not call render when nvsBounds produces zero-area rect', () => {
    const widget = new DiagramCanvasWidget('test', makeDefaultCanvasState());
    const state: DiagramCanvasState = {
      ...makeDefaultCanvasState(),
      nvsBounds: { x: 0.5, y: 0, w: 0, h: 1 },  // zero width
    };
    (widget as unknown as { lastState: DiagramCanvasState }).lastState = state;
    (widget as unknown as { diagramScene: object }).diagramScene = {};
    (widget as unknown as { privateCamera: object }).privateCamera = {};

    const renderer = makeMockRenderer();
    widget.renderPass(renderer as unknown as THREE.WebGLRenderer, 1600, 600);

    expect(renderer.render).not.toHaveBeenCalled();
  });
});
```

`makeDefaultCanvasState()` is a test helper producing a valid `DiagramCanvasState` with sensible defaults (`tilt=0`, `scale=1`, `padding=0.1`, `nvsBounds={x:0,y:0,w:1,h:1}`, empty diagrams/pipes).

### Test 5: `@brewsite/core` — `IExtraRenderPass` type guard and registry method

Add to `packages/core/src/widget/__tests__/WidgetRegistry.test.ts` (following the existing pattern for `isLightingOverride`):

```typescript
import { isExtraRenderPass } from '../WidgetRegistry';
import type { IExtraRenderPass } from '../types';

// ─── S4.3.D — isExtraRenderPass type guard ────────────────────────────────

it('isExtraRenderPass returns false for widget without renderPass method', () => {
  const plain: IWidget = { widgetId: 'plain' };
  expect(isExtraRenderPass(plain)).toBe(false);
});

it('isExtraRenderPass returns true for widget with renderPass method', () => {
  const passWidget: IWidget & IExtraRenderPass = {
    widgetId: 'pass',
    renderPass: vi.fn(),
  };
  expect(isExtraRenderPass(passWidget)).toBe(true);
});

it('getExtraRenderPassWidgets() returns only implementing widgets in registration order', () => {
  const plain = new TestWidget('plain');  // does not implement IExtraRenderPass
  const pass1: IWidget & IExtraRenderPass = { widgetId: 'pass1', renderPass: vi.fn() };
  const pass2: IWidget & IExtraRenderPass = { widgetId: 'pass2', renderPass: vi.fn() };

  registry.register(plain);
  registry.register(pass1);
  registry.register(pass2);

  const result = registry.getExtraRenderPassWidgets();
  expect(result).toHaveLength(2);
  expect(result[0].widgetId).toBe('pass1');
  expect(result[1].widgetId).toBe('pass2');
});
```

### Test 6: `useSceneEngine` render callback — `IExtraRenderPass` invocation order

This is the render integration test for the core render callback change. It must verify that:
- `renderer.render(scene, camera)` (main pass) is called before any `renderPass()` calls.
- `renderPass()` is called once per registered `IExtraRenderPass` widget per frame.
- Widgets are called in registration order.

This test belongs in `packages/core/src/player/__tests__/` as a new file `extraRenderPass.test.ts`.

Since `useSceneEngine` is a React hook, testing it directly requires `@testing-library/react` or a test harness. Instead, test the **contract** by verifying `RuntimeLoop.render` invokes extra passes in correct order. Use a test-double `RuntimeLoop` with a controlled `render` callback:

```typescript
// packages/core/src/player/__tests__/extraRenderPass.test.ts
import { describe, it, expect, vi } from 'vitest';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { IExtraRenderPass } from '../../widget/types';
import type { IWidget } from '../../widget/types';
import type * as THREE from 'three';

describe('IExtraRenderPass render callback ordering', () => {
  it('calls renderPass widgets after main render in registration order', () => {
    const callOrder: string[] = [];

    const registry = new WidgetRegistry();
    const pass1: IWidget & IExtraRenderPass = {
      widgetId: 'pass1',
      renderPass: vi.fn(() => { callOrder.push('pass1'); }),
    };
    const pass2: IWidget & IExtraRenderPass = {
      widgetId: 'pass2',
      renderPass: vi.fn(() => { callOrder.push('pass2'); }),
    };
    registry.register(pass1);
    registry.register(pass2);

    // Simulate the render callback as it appears in useSceneEngine.ts.
    const mainRender = vi.fn(() => { callOrder.push('main'); });
    const mockRenderer = {
      setScissorTest: vi.fn(),
      setViewport: vi.fn(),
      domElement: { clientWidth: 1600, clientHeight: 900 },
    } as unknown as THREE.WebGLRenderer;

    const renderCallback = () => {
      // Main pass
      mainRender();
      // Extra passes
      const extraPasses = registry.getExtraRenderPassWidgets();
      for (const pass of extraPasses) {
        pass.renderPass(mockRenderer, 1600, 900);
      }
    };

    renderCallback();

    expect(callOrder).toEqual(['main', 'pass1', 'pass2']);
    expect(pass1.renderPass).toHaveBeenCalledWith(mockRenderer, 1600, 900);
    expect(pass2.renderPass).toHaveBeenCalledWith(mockRenderer, 1600, 900);
  });

  it('render callback with no IExtraRenderPass widgets calls only main render', () => {
    const registry = new WidgetRegistry();
    // No IExtraRenderPass widgets registered.

    const mainRender = vi.fn();
    const renderCallback = () => {
      mainRender();
      for (const pass of registry.getExtraRenderPassWidgets()) {
        pass.renderPass({} as THREE.WebGLRenderer, 100, 100);
      }
    };

    renderCallback();
    expect(mainRender).toHaveBeenCalledOnce();
  });
});
```

### Test 7: Mixed-scene non-interference (unit test)

This test verifies that `DiagramCanvasWidget` does not interact with the shared scene camera after the redesign. It is a unit test, not a visual test.

**What it verifies**:
- `DiagramCanvasWidget.initialize()` does NOT store the shared camera reference (it ignores `WidgetInitContext.camera`).
- Raycasting in `handleClick()` uses `this.privateCamera`, not the shared camera.

```typescript
// Append to canvas/__tests__/widget.renderPass.test.ts

describe('DiagramCanvasWidget mixed-scene isolation', () => {
  it('initialize() ignores the shared scene camera', () => {
    const widget = new DiagramCanvasWidget('test', makeDefaultCanvasState());

    const sharedCamera = new THREE.PerspectiveCamera(45, 16/9, 0.1, 100);
    sharedCamera.position.set(99, 99, 99);  // distinctive position

    widget.initialize({
      scene: new THREE.Scene(),
      widgetId: 'test',
      renderer: undefined,
      camera: sharedCamera,
    });

    // After initialize, the widget's internal private camera should NOT be the shared camera.
    // Access via type cast for test visibility.
    const internalCamera = (widget as unknown as { privateCamera: THREE.PerspectiveCamera }).privateCamera;
    expect(internalCamera).not.toBe(sharedCamera);
    expect(internalCamera.position.z).not.toBe(99);  // private camera is not the shared one

    widget.dispose();
  });
});
```

**Visual QA requirement** (in addition to the above unit test): Before merge, manually verify the mixed scene at `apps/examples/src/architecture/scenes/scene_diagram.tsx` (or a test scene created for this purpose) containing both `<Camera>` and `<DiagramCanvas>`. Confirm that:
1. The 3D model is framed by the `<Camera>` declaration.
2. The diagram renders in its NVS region independently.
3. Changing `<Camera>` position does not affect diagram framing.

This visual QA step is recorded in the launch checklist (Part 13).

---

## Part 12: Independent Work Streams

### Dependency Model and Phase Structure

Track C has a **functional dependency** on Track B: `handlers.ts` calls `compileCanvas()` (whose signature changes in Track B's `compile.ts`), and `transitionHelpers.ts` calls `rerouteLivePipes()` (which gains a `canvasAspect` parameter threaded from Track B's `compilePipe` changes). There are no raw file conflicts, but the compiled output of Track C will diverge from Track B until merged.

**Approach: frozen-spec parallelism with merge sequencing.**

Tracks A, B, C, and D work from the interface spec in this plan (which is the authoritative contract). Each track is on its own branch. Integration order at merge time:
1. Merge Track B first (`types.ts`, `compile.ts`, `dsl.tsx`).
2. Merge Track A next (`@brewsite/core` changes — no diagram dependencies).
3. Merge Tracks C and D after Track B is merged (both depend on B types; they do not conflict with each other).
4. Merge Track E (tests) after B, C are merged.
5. Merge Track F (widget rewrite) after all of A, B, C, D are merged.
6. Merge Track G (app migration) after Track F.

### Phase 1a — Immediate start (no dependencies)

**Track A: Core interfaces** (`@brewsite/core` only)

Files touched: `packages/core/src/widget/types.ts`, `packages/core/src/widget/WidgetRegistry.ts`, `packages/core/src/widget/index.ts`, `packages/core/src/player/useSceneEngine.ts`

New test file: `packages/core/src/player/__tests__/extraRenderPass.test.ts`

Also add to `packages/core/src/widget/__tests__/WidgetRegistry.test.ts`: `isExtraRenderPass` type guard tests and `getExtraRenderPassWidgets()` tests (Test 5 in Part 11).

Work: Add `IExtraRenderPass` interface + `isExtraRenderPass` type guard + `getExtraRenderPassWidgets()` + update render callback in `useSceneEngine.ts` per Part 1. All new code; no removals. Existing tests unaffected.

**Track B: Types, compile, and DSL props** (pure TypeScript, no Three.js)

Files touched: `packages/diagram/src/elements/diagram/canvas/types.ts`, `packages/diagram/src/elements/diagram/canvas/dsl.tsx`, `packages/diagram/src/elements/diagram/canvas/compile.ts`

Work: Replace `DiagramCanvasDSL`, `DiagramCanvasState` per Parts 2–3. Update `compileCanvas()` and `compilePipe()` signatures. Update `functionalDiagramCanvasTransitionSpec`. Update `DiagramCanvasProps` in `dsl.tsx` per Part 8.1.

Note: After merging Track B, `render.ts` and `widget.ts` will have TypeScript errors (they reference removed `position`/`rotation` fields). This is expected; those files are fixed in Tracks D and F respectively.

### Phase 1b — Start after Track B types are merged (or from frozen spec)

Tracks C, D, and E have no file conflicts with each other and can proceed in parallel once Track B's interface contract is agreed (which it is — this plan is the spec).

**Track C: Pipeline fix — pipeRouter + handlers**

Files touched: `packages/diagram/src/elements/diagram/canvas/compiler/pipeRouter.ts`, `packages/diagram/src/compiler/handlers.ts`, `packages/diagram/src/elements/diagram/compiler/transitionHelpers.ts`

Work: Remove `DEFAULT_CANVAS_ASPECT` export entirely from `pipeRouter.ts`. Add `canvasAspect` parameter to `compilePipe`. Update `handlers.ts` canvasDSL construction per Part 5. Update `rerouteLivePipes` signature per Part 4.3.

**Track D: Render layer** (Three.js only)

Files touched: `packages/diagram/src/elements/diagram/canvas/render.ts`

Work: Update `DiagramCanvasRenderer.update()` signature per Part 6. Add `getBoundingBox()`. Update `dispose()`. Remove `position`/`rotation` transform code. Add tilt + rotation-offset + pan-offset application.

**Track E: Test updates**

Files touched: `packages/diagram/src/elements/diagram/canvas/__tests__/compile.test.ts`, `packages/diagram/src/elements/diagram/canvas/__tests__/functionalTransitionSpec.test.ts`, `packages/diagram/src/elements/diagram/canvas/compiler/__tests__/pipeRouter.test.ts`

New test file: `packages/diagram/src/elements/diagram/canvas/__tests__/widget.renderPass.test.ts`

Work: Update existing tests per Tests 1–3 in Part 11. Add new `widget.renderPass.test.ts` per Tests 4 and 7 in Part 11.

### Phase 2 — Sequential (after all Phase 1 tracks merged)

**Track F: Widget rewrite** — depends on Tracks A + B + C + D

Files touched: `packages/diagram/src/elements/diagram/canvas/widget.ts`

Work: Major rewrite per Part 7. Implements `IExtraRenderPass` (Track A), uses new types (Track B), calls updated render API (Track D). Removes `IAnimationController`, `ILightingOverride`. Adds private scene + camera. Implements `renderPass()`. Also updates `DiagramCanvas`/`DiagramPipe` JSDoc per Part 8.2.

Exports `nvsToScissorRect` as a named pure function (required for Track E tests).

### Phase 3 — After Track F merged

**Track G: App migration** (47 files — see exhaustive list in Part 9)

Work: For each file, replace `position`/`rotation` with `tilt` + `x/y/w/h` NVS placement per the migration pattern in Part 9. After all files are migrated, run the `settings.ts` cleanup grep per Part 9.

---

## Part 13: Launch Criteria Checklist

Directly from PRD §13 — all must be true before merge:

- [ ] `DiagramCanvasDSL` and `DiagramCanvasState` do not contain `position` or `rotation`. TypeScript rejects these props.
- [ ] `tilt` and `padding` are exported from `@brewsite/diagram`.
- [ ] Scissored sub-viewport rendering is implemented. `Test 4c` (mock renderer) verifies `setScissor` is called with the correct pixel rect. Visual QA confirms diagram clips at NVS boundary.
- [ ] Mixed scene non-interference: `Test 7` (unit) verifies `DiagramCanvasWidget` does not store the shared camera. Visual QA on `scene_diagram.tsx` confirms `<Camera>` governs 3D elements and `<DiagramCanvas>` renders independently.
- [ ] Interactive focus (`focusMesh`, `focusAll`) operates on the diagram's private camera and produces correct framing.
- [ ] Raycasting (click, hover) is correct for sub-region placements (`x=0.3, w=0.4`).
- [ ] All scene files in `apps/examples/src` compile without TypeScript errors.
- [ ] `config.diagramScale/Top/RotationX` removed from `settings.ts` (or retained only for unrelated uses).
- [ ] Cross-diagram pipe routing uses actual `canvasAspect` from `nvsBounds`. `DEFAULT_CANVAS_ASPECT` constant is deleted entirely from `pipeRouter.ts` — no export, no deprecated shim.
- [ ] All existing tests pass: `pnpm test`.
- [ ] TypeScript strict mode: `pnpm typecheck` passes for `@brewsite/core` and `@brewsite/diagram`.
- [ ] `packages/diagram/README.md` updated with new `DiagramCanvas` authoring example.
- [ ] CHANGELOG entry written for the major version bump.

---

## Appendix A: `DiagramCanvasRenderer.getBoundingBox()` — Why This is Safe

`THREE.Box3.setFromObject()` traverses the scene graph of `canvasGroup` and computes the axis-aligned bounding box of all visible geometry. This call happens once per `apply()` frame (not `renderPass()`) and is O(N) in the number of geometries. For typical diagram sizes (20-50 nodes), this is fast enough in the 60fps loop. For very large diagrams (200+ nodes), caching the bounding box and invalidating on state change is a performance optimization deferred to v2.

The `getBoundingBox()` method returns `null` if `canvasGroup` is not initialized or if the box is empty (no geometry yet). The auto-fit camera method guards on `null` and positions the camera at a sensible default instead of breaking.

## Appendix B: Size retrieval — two methods, same values

The plan uses two different ways to get the viewport size. They return the same values (CSS pixels) but are used in different call sites for different reasons:

| Site | Method | Reason |
|---|---|---|
| `useSceneEngine.ts` render callback | `renderer.domElement.clientWidth/clientHeight` | Called in a React closure; no `this` reference; renderer DOM element is available directly |
| `DiagramCanvasWidget.apply()` | `renderer.getSize(new THREE.Vector2())` | Called on `this.rendererRef`; both methods return the same CSS pixel dimensions |

**Why CSS pixels, not `.width` (physical pixels)**:
- `.domElement.width` = physical pixel width = CSS width × devicePixelRatio
- `.domElement.clientWidth` = CSS pixel width (what CSS layout sees)
- `renderer.getSize(v)` = CSS pixel output size (same as `clientWidth`/`clientHeight`)
- `renderer.setViewport(x, y, w, h)` and `renderer.setScissor(x, y, w, h)` both accept **CSS pixel coordinates**. Three.js multiplies by `pixelRatio` internally before calling the WebGL scissor API.

Using `clientWidth` and `clientHeight` (CSS pixels) is correct. Using `.width` (physical pixels) would produce a scissor region that is `devicePixelRatio` times too large on high-DPI displays.

**Guard**: if `clientWidth` is 0 (renderer not yet attached to DOM), the check `if (width <= 0 || height <= 0) return;` in `renderPass()` prevents any WebGL call.

## Appendix D: `WidgetInitContext.renderer` — already present

Issue 7 from PM review: *"Does `WidgetInitContext` currently expose `renderer` as a property?"*

**Confirmed**: `WidgetInitContext.renderer` is already defined in `packages/core/src/widget/types.ts` at line 299:

```typescript
export type WidgetInitContext = {
  scene: ThreeScene;
  widgetId: string;
  renderer?: WebGLRenderer;   // ← line 299, present since Phase 2 renderer lifecycle work
  camera?: PerspectiveCamera;
};
```

Track A does **not** need to add this field. No scope change required.

## Appendix C: The `inputRotation` Type Change

Current: `private inputRotation: [number, number, number] = [0, 0, 0];`

Changed to: `private inputRotation: number = 0;` (pitch only)

**Why**: In the new model, the `tilt` prop controls pitch, and `inputRotation` accumulates interactive pitch offsets on top of it. Yaw and roll are explicitly out of scope (PRD §4). Storing a scalar pitch offset is cleaner and removes ambiguity about what `inputRotation[1]` and `inputRotation[2]` would mean.

`handleRotate()` calls `applyInputRotate(scaledX, 0, 0)` with Y and Z always zero. After changing to scalar, `handleRotate()` calls `applyInputRotate(scaledX)` directly.

`resetInputTransform()` resets `this.inputRotation = 0`.

In `DiagramCanvasRenderer.update(..., rotationOffset: number)`, the value is applied as `this.canvasGroup.rotation.set(state.tilt + rotationOffset, 0, 0)`.
