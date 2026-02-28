---
title: "BrewSite Core — Player & Runtime"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-02-28
change_history:
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the Player and Runtime layers for @brewsite/core, covering ScenePlayer, useSceneEngine, RuntimeDriverImpl, RuntimeLoop, EngineFrameDriver, all consumer hooks, context providers, DOM region components, LabelPositioner, TimelineWidget, SceneMetaWidget, asset manifest, SSR safety contract, and test infrastructure. Reflects the production implementation as of 2026-02-28."
---

# BrewSite Core — Player & Runtime

## 1. Overview

The Player layer is the React integration surface for `@brewsite/core`. `ScenePlayer` is the top-level component that a host application mounts to render an animated 3D scene. The Runtime layer is the frame-by-frame execution engine that drives widget ticking, scene track sampling, Three.js rendering, and state publishing. Together they form the complete playback stack: from JSX scene authoring through compilation, asset loading, frame scheduling, and reactive state propagation to host UI.

This document covers `ScenePlayer` and all its props, the `useSceneEngine` hook and its options, `RuntimeDriverImpl` and the per-frame tick sequence, `RuntimeLoop` and the animation frame scheduler, `EngineFrameDriver` and the React state bridge, all consumer hooks (`useEngineScroll`, `useEngineInput`, `useEngineScrubber`, `useSceneProgress`, `useCurrentScene`), all context providers (`EngineStateContext`, `VariableStoreContext`, `LabelPositionerContext`, `EngineContext`), the `EngineScrollRegion` and `EngineInputRegion` DOM wrapper components, `LabelPositioner` for 3D-to-screen projection, `TimelineWidget` for interactive scrubbing, `CameraControlPanel`, `SceneMetaWidget`, the asset manifest pipeline, and the SSR safety contract.

Affects: `@brewsite/core`.

---

## 2. Problem Statement

Three.js scene toolkits typically expose imperative APIs: create a renderer, create a scene, load assets, call render in a loop. Integrating this into a React host application requires careful management of refs, effect cleanup, hydration safety, and progress synchronization.

The BrewSite Player layer solves these integration problems once, providing a declarative `<ScenePlayer>` component that handles all imperative Three.js lifecycle internally. Host applications interact exclusively with props, hooks, and context — no direct Three.js API surface is exposed unless the consumer explicitly requests engine access via `useSceneEngineContext`.

The Runtime layer solves the per-frame orchestration problem: widgets must tick in a defined order, scene track state must be sampled O(1), functional transitions must evaluate at blockProgress, and the output must be pushed to React state in a way that does not cause excessive re-renders.

---

## 3. Goals and Success Metrics

**Primary goals:**
- A host application can integrate a fully animated 3D scene in under 30 lines of application code.
- ScenePlayer is safe to render server-side — no crash, no hydration mismatch.
- Adding a new widget does not require changes to the Player or Runtime layers.
- The frame loop runs at 60fps on target hardware with zero React state updates per frame during steady-state playback (state updates only on tick index change, not on every animation frame).

**Success metrics:**
- ScenePlayer mounts and begins rendering in under 500ms on a 100ms round-trip manifest fetch.
- Zero React re-renders per animation frame during steady-state playback with a static scene (no scene transitions).
- TypeScript props for `ScenePlayer` produce compile errors for incorrect prop types with zero `any` escape hatches.
- `useCurrentScene` does not re-render its consumer on every frame — it re-renders only when `sceneId` changes.

**Guardrail metrics:**
- No `ScenePlayerProps` fields may be removed or renamed in a minor version release.
- The `useSceneEngine` return shape must remain backward compatible across minor versions.

---

## 4. Non-Goals

- `ScenePlayer` does not manage routing, page layout, or CSS beyond what is needed for Three.js canvas sizing.
- The Player layer does not expose a public Three.js `Scene` or `Camera` reference in the standard consumption pattern. Consumer access to engine internals is available via `useSceneEngineContext` for advanced use cases only, and is considered an escape hatch.
- Audio synchronization is out of scope for the Player layer.
- The Runtime layer does not implement physics, collision detection, or pathfinding. These belong in widget `IAnimationController` implementations.
- The Player layer does not manage React Router integration. `onSceneChange` is the hook for host-level navigation reactions.
- `ScenePlayer` does not manage full-page scroll position. `EngineScrollRegion` and `EngineInputRegion` are the tools for integrating scene progress with the document scroll.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to declare a scene in JSX and mount `<ScenePlayer>` so that my three.js scene renders without writing any imperative Three.js setup code.
- As a toolkit consumer, I want to use `useCurrentScene()` to reactively update a nav indicator so that my UI reflects the active scene without wiring custom event listeners.
- As a toolkit consumer, I want `<EngineInputRegion>` to handle scroll, drag, wheel, and keyboard input so that my scene transitions as the user navigates.
- As a toolkit consumer, I want `useVariable('scene', 'id')` inside any component nested under `<ScenePlayer>` so that I can build reactive overlays driven by scene metadata.
- As a toolkit consumer, I want `timeline={true}` on `ScenePlayer` so that I get a scrubbing timeline for development and debugging without additional code.
- As a server-side rendering host, I want `<ScenePlayer>` to render the `placeholder` prop during SSR and hydration so that my page has no layout shift and no hydration mismatch.

---

## 6. Functional Requirements

1. `ScenePlayer` shall accept `sceneGroup`, `manifestUrl`, and `widgetSetup` as required props. All other props are optional.
2. `ScenePlayer` shall fetch the manifest from `manifestUrl` and pass the parsed result to `widgetSetup(manifest)` to construct the `WidgetRegistry`.
3. `ScenePlayer` shall render the `placeholder` prop while `frameState.tickIndex < 0` (before the first tick completes).
4. `ScenePlayer` shall render a `role="alert"` error message if manifest fetching fails. This does not throw; the host can handle via `onError`.
5. `ScenePlayer` shall call `onSceneChange(sceneId, sceneIndex)` when the active scene changes.
6. `ScenePlayer` shall support Vite HMR: on `vite:beforeUpdate`, the scene track cache and compiler node registry shall be cleared, and the engine shall reinitialize.
7. `useSceneEngine` shall create a `THREE.WebGLRenderer` once the canvas DOM element is available, and dispose it on unmount.
8. `useSceneEngine` shall compile the `SceneTrack` via `compileSceneTrack` when `sceneGroup`, `widgetRegistry`, or `clipMeta` changes. Compiled tracks shall be cached by `buildSceneTrackKey` to avoid recompilation on unrelated re-renders.
9. `RuntimeDriverImpl.tick` shall execute in this order per frame: (1) tick all `IAnimationController` widgets in priority order, (2) sample the scene track, (3) apply state to all `IRenderable` widgets.
10. `RuntimeLoop` shall throttle frames to `fpsCap` frames per second when the option is configured. When `fpsCap` is not set, the loop runs at the native animation frame rate.
11. `RuntimeLoop` shall clamp `deltaSeconds` to prevent large delta spikes when the browser tab returns from background.
12. `EngineStateContext` shall be updated at most once per animation frame, only when `tickIndex` changes. It shall not update on every `requestAnimationFrame` invocation.
13. `useCurrentScene()` shall return `{ id: string; index: number }` and re-render its consumer only when `sceneId` changes.
14. `useSceneProgress()` shall return the current `progress: number` ([0, 1] global progress) and update on every tick index change.
15. `LabelPositioner.update` shall be called once per render, after `renderer.render(scene, camera)`, with the current label primitives and bone world positions from the runtime driver.
16. `EngineInputRegion` shall support both `scroll` mode (tall spacer creates scrollable space) and `direct` mode (fixed-height viewport, pointer/wheel/keyboard events drive progress directly).
17. `ScenePlayer` shall be SSR-safe: all Three.js and DOM initialization shall be deferred to `useEffect`. On the server, the component renders `placeholder` (if provided) or `null`.
18. `createDefaultWidgetRegistry(manifest)` shall be accessible from `@brewsite/core` player exports without requiring a separate import path.

---

## 7. ScenePlayer Component

`ScenePlayer` is the top-level React integration component. It manages manifest fetching, widget registry construction, engine initialization, and the full React context tree required by all player hooks.

### 7.1 Props

```typescript
type ScenePlayerProps = {
  // Required
  sceneGroup: SceneGroup;
  manifestUrl: string;
  widgetSetup: (manifest: AssetManifest | null) => WidgetRegistry;

  // Layout
  className?: string;

  // Engine configuration
  fpsCap?: number;
  pixelsPerScene?: number;
  framesPerTick?: number;

  // Input
  inputMap?: SceneNavInputMap;

  // Timeline widget
  timeline?: boolean | Omit<TimelineWidgetProps, 'engine' | 'scenes'>;

  // Lifecycle callbacks
  onReady?: () => void;
  onError?: (error: Error) => void;
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;

  // Content
  placeholder?: ReactNode;
  children?: ReactNode;
};
```

**`sceneGroup`** — The compiled scene definition tree produced by the DSL authoring surface. Contains an array of `SceneDefinition` objects, each with an `id`, optional `meta`, and child elements.

**`manifestUrl`** — URL to the asset manifest JSON file. The manifest is fetched on mount and on `manifestUrl` changes. It is passed to `widgetSetup` and to `ILoadable` widgets. The manifest JSON must conform to `AssetManifest` schema (see Section 14).

**`widgetSetup`** — Called with the parsed `AssetManifest` (or `null` on fetch failure) after fetching completes. Returns a configured `WidgetRegistry`. Called inside `useMemo` — it must be a stable function reference or the engine will reinitialize on every render. The canonical pattern:

```typescript
const widgetSetup = useCallback(
  (manifest: AssetManifest | null) => createDefaultWidgetRegistry(manifest),
  [],
);
```

**`fpsCap`** — Maximum frames per second. When set, the RuntimeLoop throttles frame dispatch to this rate. Useful for battery-conscious deployments or reducing CPU load on non-critical background tabs. Default: unlimited (native rAF rate).

**`pixelsPerScene`** — Scroll height in pixels allocated per scene in scroll mode. When set, overrides the default height calculation. Only relevant in `scroll` input mode.

**`framesPerTick`** — Number of pre-baked frames per scene transition block (the `blockSize` in `compileSceneTrack`). Higher values produce smoother transitions at the cost of larger `SceneTrack` arrays. Default: `10`.

**`inputMap`** — Input configuration for scene navigation. Determines input mode (`scroll` or `direct`) and which input sources (wheel, drag, swipe, keys) are active. See Section 10 (`useEngineInput`) for details.

**`timeline`** — When `true`, renders `TimelineWidget` with default configuration. When an object, renders `TimelineWidget` with the provided configuration overrides. When absent, no timeline is rendered. See Section 13 for `TimelineWidgetProps`.

**`onReady`** — Called once after the first successful tick completes (all assets loaded, first frame rendered). Not called again after HMR updates.

**`onError`** — Called with any Error from manifest fetching, widget initialization, or asset loading. The engine continues operating in a degraded state; the host decides how to handle.

**`onSceneChange`** — Called when the active scene changes. Receives `(sceneId: string, sceneIndex: number)`. Wired internally via `SceneMetaWidget.setOnSceneChange`.

**`placeholder`** — ReactNode rendered while the engine is initializing (before the first tick). Overlaid absolutely over the canvas area with `pointerEvents: 'none'`.

**`children`** — Additional React children rendered inside the input region, overlaid on the canvas. Receives pointer events passthrough from the `EngineInputRegion` overlay.

### 7.2 Internal Behavior

`ScenePlayer` performs the following operations on mount:

1. Starts manifest fetch from `manifestUrl`. On success, calls `assertManifestValid(raw)` and stores the result.
2. Constructs `WidgetRegistry` via `widgetSetup(manifest)` inside `useMemo`.
3. Constructs a `LabelPositioner` instance and a `VariableStore` instance (both stable across re-renders).
4. Calls `useSceneEngine` with the registry, manifest, clip metadata, and configuration options.
5. Wires `SceneMetaWidget.setOnSceneChange` to the `onSceneChange` prop.
6. Renders the full context provider tree: `VariableStoreContext`, `LabelPositionerContext`, `EngineStateContext`, `EngineContext`.
7. Renders `EngineInputRegion` as the primary viewport container.
8. Renders `HudOverlay`, `LabelItem` elements, optional `TimelineWidget`, and `children` inside the input region.

On server (SSR), `ScenePlayer` short-circuits at `typeof window === 'undefined'` and returns `placeholder ?? null`. No Three.js imports are invoked on the server code path.

---

## 8. useSceneEngine Hook

`useSceneEngine` is the stateful hook that owns the Three.js engine lifecycle. It is called by `ScenePlayer` internally and is not intended for direct use by host applications in the standard integration pattern. It is exported for advanced consumers who need to compose the engine with custom container components.

### 8.1 Options

```typescript
type UseSceneEngineOptions = {
  sceneGroup: SceneGroup;
  widgetRegistry: WidgetRegistry;
  clipMeta: ClipMeta[];
  manifest?: AssetManifest | null;
  fpsCap?: number;
  pixelsPerScene?: number;
  framesPerTick?: number;
  blockSize?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
  labelPositioner?: LabelPositioner;
  inputMap?: SceneNavInputMap;
};
```

### 8.2 Return Type

```typescript
type UseSceneEngineResult = {
  frameState: EngineFrameState;
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  scrollRegionHeightPx: number;
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
  sceneCount: number;
  variableStore: VariableStore;
  setCanvasRef: (canvas: HTMLCanvasElement | null) => void;
  setBackgroundRef: (element: HTMLDivElement | null) => void;
  setViewportSize: (width: number, height: number) => void;
  getCamera: () => THREE.PerspectiveCamera | null;
  getRenderer: () => THREE.WebGLRenderer | null;
  setCameraOverride: (next: CameraOverrideState | null) => void;
  getCameraOverride: () => CameraOverrideState | null;
  debug?: {
    driverReady: boolean;
    assetsReady: boolean;
    sceneTrackTicks: number;
    viewport: { width: number; height: number };
  };
};
```

**`frameState`** — Current `EngineFrameState` (see Section 8.3). Updated once per tick index change, not once per animation frame.

**`scrollRegionRef`** — Ref to be attached to the scroll region DOM element. Used by `useEngineInput` to calculate scroll progress relative to the region.

**`scrollRegionHeightPx`** — Computed height for the scroll region spacer. In `scroll` mode: proportional to `pixelsPerScene * sceneCount`. In `direct` mode: equals viewport height.

**`progress`** — Global progress value [0, 1]. Updated via React state in scroll mode; updated via `useState` + ref in direct mode.

**`scrollToProgress(next)`** — Imperatively seeks to a progress value. In scroll mode: calls `window.scrollTo`. In direct mode: updates the progress state directly.

**`getGlobalProgress()`** — Reads the current progress from a ref (not React state). Stable, synchronous, no re-render. Used by `RuntimeLoop` to read progress each frame without subscribing to state.

**`sceneCount`** — Total number of scenes in the scene group. Used by `TimelineWidget` and input controllers for step calculations.

**`variableStore`** — The `VariableStore` instance shared across all widgets and React components in this engine instance.

**`setCanvasRef`** — Callback ref for the Three.js canvas element. When a canvas element mounts, the engine creates the `THREE.WebGLRenderer` against it.

**`setBackgroundRef`** — Callback ref for the background div element. Wired to `BackgroundWidget` if registered, enabling DOM-level background color/image transitions.

**`setViewportSize(width, height)`** — Called by `EngineScrollRegion` / `EngineInputRegion` on mount and on resize. Updates renderer size, camera aspect ratio, and label positioner container size.

**`setCameraOverride` / `getCameraOverride`** — Set and get a `CameraOverrideState` that is applied by `CameraWidget` each frame, overriding the compiled camera state. Used by camera orbit/dolly interaction handlers.

**`debug`** — Development diagnostic object. Contains `driverReady`, `assetsReady`, `sceneTrackTicks`, and viewport dimensions. Rendered by the debug overlay when `window.__robotRuntimeDebug.overlay` is set.

### 8.3 EngineFrameState

```typescript
type EngineFrameState = {
  tickIndex: number;     // Current tick index in the SceneTrack (-1 before first tick)
  progress: number;      // Global progress [0, 1]
  sceneId: string;       // Current scene id
  sceneIndex: number;    // Current scene index (0-based)
  sceneProgress: number; // blockProgress [0, 1] within current transition block
  tick: SceneTrackTick | null; // Current SceneTrackTick (null before first tick)
};
```

`EngineFrameState` is the React state that bridges the animation loop to React rendering. It is updated by `EngineFrameDriver` only when `tickIndex` changes, preventing per-frame React state churn.

`sceneProgress` maps to `tick.blockProgress` — the normalized position [0, 1] within the current transition block, not the global progress. It is the value evaluated by functional transition closures.

### 8.4 Engine Initialization Sequence

The engine initializes across three separate `useEffect` phases that React schedules sequentially:

**Phase 1 — Scene Track Compilation:** Triggered when `sceneGroup`, `widgetRegistry`, `clipMeta`, `manifest`, `blockSize`, or `prefersReducedMotion` changes. Computes a cache key via `buildSceneTrackKey`. If a matching cached track exists, it is used directly. Otherwise `compileSceneTrack` runs and the result is cached.

**Phase 2 — Driver Initialization:** Triggered when `canvas` becomes available, `widgetRegistry` changes, `manifest` changes, `variableStore` changes, or `sceneTrack` is set. Creates a `THREE.Scene`, a `THREE.PerspectiveCamera`, and a `RuntimeDriverImpl`. Calls `driver.initialize(scene, renderer)` asynchronously. Sets `driverReady = true` on resolution.

**Phase 3 — Loop Start:** Triggered when `sceneTrack`, `driverReady`, and `getGlobalProgress` are all available. Calls `driver.setSceneTrack(sceneTrack)`, creates an `EngineFrameDriver` and a `RuntimeLoop`, and starts the loop. The loop calls `driver.tick → onAfterTick → render` each frame.

---

## 9. RuntimeDriverImpl

`RuntimeDriverImpl` is the concrete implementation of the `RuntimeDriver` interface. It orchestrates the per-frame widget lifecycle.

### 9.1 Construction

```typescript
type RuntimeConfig = {
  widgetRegistry: WidgetRegistry;
  variableStore: VariableStore;
  manifest: AssetManifest | null;
  onAssetsReady?: () => void;
  onError?: (error: Error) => void;
};

class RuntimeDriverImpl implements RuntimeDriver {
  assetsReady: boolean;
  setAssetsReady(ready: boolean): void;
  async initialize(scene: THREE.Scene, renderer?: THREE.WebGLRenderer): Promise<void>;
  setSceneTrack(track: SceneTrack): void;
  tick(options: { deltaSeconds: number; globalProgress: number; wallTimeSeconds?: number }): void;
  getBoneWorldPositions(): Map<string, [number, number, number]>;
  getTargetColors(): Map<string, string>;
  getCurrentTick(): SceneTrackTick | null;
  getWallTimeSeconds(): number;
  dispose(): void;
}
```

At construction time, `RuntimeDriverImpl` reads the sorted widget collections from the registry once (`getSceneElements()`, `getRenderables()`, `getAnimationControllers()`, `getContainedModels()`) and stores them as private arrays. These collections do not change after construction — the registry is treated as immutable after `createDefaultWidgetRegistry` returns.

### 9.2 Initialization

`initialize(scene, renderer)` performs two sequential steps:

1. **Synchronous widget initialization:** Calls `renderable.initialize({ scene, widgetId, renderer })` for every `IRenderable` in order. If any widget throws, the error is forwarded to `onError` and re-thrown (halting initialization).

2. **Parallel asset loading:** Calls `w.load(manifest)` on all `ILoadable` widgets via `Promise.all`. On resolution, calls `attachContainedModels()` to wire bone attachments, sets `assetsReady = true`, and fires `onAssetsReady`.

### 9.3 Per-Frame Tick Sequence

`tick({ deltaSeconds, globalProgress, wallTimeSeconds })` executes in this order every animation frame:

```
1. For each IAnimationController (ascending tickPriority):
   controller.onTick({ deltaSeconds, wallTimeSeconds, scene, variables, tick: currentTick, track })

2. Sample SceneTrack:
   currentTick = sampler.sample(globalProgress)  // O(1) array index lookup

3. For each IRenderable:
   a. Check for FunctionalTransitionSpec block at tick.sceneIndex
      - If present: state = functionalBlock.widgetFns[widgetId].fn(tick.blockProgress)
   b. Else: state = tick.state.widgets[widgetId] ?? defaultState
   c. extra = tick.widgetExtras?.[widgetId]
   d. renderable.apply(state, { deltaSeconds, globalProgress, wallTimeSeconds, variables, extra, tick })
```

After the tick sequence, the `RuntimeLoop` calls `render()` (Three.js renderer draw call) and then `onAfterTick` (which routes to `EngineFrameDriver.handleTick`).

### 9.4 Functional Transition Evaluation

The scene track may contain `transitionBlocks` — records of functional transition specs that were not baked to discrete state. For widgets at a given `sceneIndex` that have a functional spec, the driver evaluates the stored closure at `tick.blockProgress` rather than reading from `tick.state.widgets`. This enables spring-physics transitions, parametric camera paths, and other non-discrete state shapes.

### 9.5 getBoneWorldPositions and getTargetColors

After each tick, `RuntimeLoop.render` calls `driver.getBoneWorldPositions()` and `driver.getTargetColors()` to collect per-frame positional and color data for the label system. The driver iterates all `IRenderable` widgets and collects from those that optionally expose `getBoneWorldPositions()` and `getTargetColors()` methods. Results are passed to `LabelPositioner.update` each frame.

### 9.6 Disposal

`dispose()` calls `renderable.dispose()` on all `IRenderable` widgets. Errors during disposal are swallowed (logged to console in debug builds) to prevent one widget's disposal failure from blocking others. Internal state (`sampler`, `track`, `currentTick`) is cleared.

---

## 10. RuntimeLoop

`RuntimeLoop` owns the `requestAnimationFrame` loop. It is the only place in the toolkit that calls `rAF`.

```typescript
type RuntimeLoopOptions = {
  driver: RuntimeDriver;
  getGlobalProgress: () => number;
  render?: () => void;
  onAfterTick?: (frame: RuntimeFrame) => void;
  fpsCap?: number;
  fixedDeltaSeconds?: number;
  clock?: RuntimeLoopClock;
};

class RuntimeLoop {
  start(): void;
  stop(): void;
  step(nowMs: number): void;         // advance one frame (test use)
  stepImmediate(nowMs: number): void; // advance one frame, bypass fpsCap (test use)
  setWallTimeOverride(value: number | null): void;
}
```

Each frame, `RuntimeLoop` performs:

1. Compute `deltaMs` from the clock (clamped to prevent runaway after tab switch).
2. If `fpsCap` is configured and not enough time has accumulated, skip this frame.
3. Call `driver.tick({ deltaSeconds, globalProgress, wallTimeSeconds })`.
4. Call `onAfterTick(frame)` — this triggers `EngineFrameDriver.handleTick`.
5. Call `render()` — this calls `renderer.render(scene, camera)` and updates `LabelPositioner`.

The loop uses a pluggable `RuntimeLoopClock` abstraction (`now`, `requestFrame`, `cancelFrame`) to support deterministic testing without actual rAF.

`fixedDeltaSeconds` forces a constant delta time, used in tests and screenshot snapshots. `setWallTimeOverride` pins wall time for reproducible test scenarios.

---

## 11. EngineFrameDriver

`EngineFrameDriver` is the bridge between the animation loop and React state. It is deliberately minimal.

```typescript
class EngineFrameDriver {
  constructor(onFrameChange: (state: EngineFrameState) => void);
  handleTick(tick: SceneTrackTick | null): void;
  reset(): void;
}
```

`handleTick` is called by `RuntimeLoop.onAfterTick` each frame. It compares `tick.index` to `lastIndex`. If the index has not changed (same tick played twice due to non-linear progress), no React state update is triggered. Only when the tick index advances does `onFrameChange(state)` fire, batching a React state update via `setFrameState`.

`reset()` clears `lastIndex` to `-1`, used on HMR updates to ensure the first tick after recompilation triggers a state update.

This design ensures React re-renders from the animation loop are proportional to actual scene progress changes, not to animation frame rate.

---

## 12. Consumer Hooks

### 12.1 useEngineScroll

```typescript
type UseEngineScrollOptions = {
  scrollRegionRef: RefObject<HTMLElement | null>;
  scrollRegionHeightPx: number;
};

type UseEngineScrollResult = {
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
};

const useEngineScroll = (options: UseEngineScrollOptions): UseEngineScrollResult
```

Subscribes to `window.scroll` and `window.resize` events. Computes progress as the normalized scroll position of the scroll region within the viewport: `(scrollTop - regionTop) / (scrollRegionHeightPx - viewportHeight)`. `getGlobalProgress` reads from a ref for synchronous access in the rAF loop.

### 12.2 useEngineInput

```typescript
type UseEngineInputOptions = {
  scrollRegionRef: RefObject<HTMLElement | null>;
  scrollRegionHeightPx: number;
  sceneCount: number;
  canvasRef?: RefObject<HTMLElement | null>;
  inputMap?: SceneNavInputMap;
  wheelGuard?: () => boolean;
  inputControllerSpec?: SceneInputControllerSpec | null;
  onCameraOrbit?: (cameraId: string, dx: number, dy: number, speed: number) => void;
  onCameraDolly?: (cameraId: string, delta: number, speed: number) => void;
  onCameraReset?: (cameraId: string) => void;
  onDiagramCanvasMove?: (canvasId: string, dx: number, dy: number, speed: number) => void;
  onDiagramCanvasRotate?: (canvasId: string, dx: number, dy: number, speed: number) => void;
  onDiagramCanvasReset?: (canvasId: string) => void;
  onDiagramCanvasFocus?: (
    canvasId: string,
    clientX: number,
    clientY: number,
    focusCenter?: [number, number] | [number, number, number],
  ) => void;
};

type UseEngineInputResult = {
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
};
```

`useEngineInput` is the unified input hook that handles all scene navigation and camera/canvas interaction. It selects between three internal routing paths:

**Path 1: Scene-authored controller (`inputControllerSpec` present)** — When the current scene tick includes a `SceneInputControllerSpec` (from a `<InputController>` DSL element), an `ActionInputController` is created and attached. `ActionInputController` reads the spec each frame via a ref, dispatching to `onCameraOrbit`, `onCameraDolly`, `onCameraReset`, `onDiagramCanvasMove`, etc., based on the action mappings in the spec.

**Path 2: Scroll mode** — When no `inputMap` or `inputMap.mode === 'scroll'`, delegates to `useEngineScroll`. Also attaches an `InputController` for keyboard-only navigation (arrow keys, Home/End). Wheel events are handled by native scroll; a separate `InputController` is not attached for wheel.

**Path 3: Direct mode** — When `inputMap.mode === 'direct'`, attaches an `InputController` to the scroll region element for wheel, drag, swipe, and keyboard input. Progress is managed via a local ref + state pair rather than window scroll. `wheelGuard` is passed to `InputController` to suppress wheel scene navigation when the camera dolly interaction is active.

The `wheelGuard` callback reads `CameraWidget.isWheelClaimedByInteraction()` — this prevents the scene from advancing while the user is using two-finger scroll to dolly the camera.

### 12.3 useEngineScrubber

```typescript
type UseEngineScrubberOptions = {
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
};

type UseEngineScrubberResult = {
  progress: number;
  isScrubbing: boolean;
  startScrub: () => void;
  stopScrub: () => void;
  setProgress: (next: number) => void;
};

const useEngineScrubber = (options: UseEngineScrubberOptions): UseEngineScrubberResult
```

Provides direct progress control for the `TimelineWidget`. `setProgress` calls `scrollToProgress`. `startScrub` / `stopScrub` manage the `isScrubbing` flag, which the `TimelineWidget` uses to show a visual drag indicator and suppress engine progress during active scrub.

### 12.4 useSceneProgress

```typescript
const useSceneProgress = (): number
```

Returns the current global progress value [0, 1] from `EngineStateContext`. Re-renders on every tick index change. Used by progress indicators and overlay components that need to track scene advancement.

### 12.5 useCurrentScene

```typescript
const useCurrentScene = (): { id: string; index: number }
```

Returns `{ id, index }` from `EngineStateContext`. Re-renders only when `sceneId` or `sceneIndex` changes — not on every tick. The primary hook for host application navigation reactions and scene-conditional UI.

**Example:**

```typescript
const { id } = useCurrentScene();

return (
  <nav>
    {scenes.map((s) => (
      <a key={s.id} className={s.id === id ? 'active' : ''}>{s.title}</a>
    ))}
  </nav>
);
```

### 12.6 useEngineState

```typescript
const useEngineState = (): EngineState
```

Returns the full `EngineState` (`progress`, `sceneId`, `sceneIndex`, `sceneProgress`) from `EngineStateContext`. Throws if called outside `<ScenePlayer>`. Used internally by `useSceneProgress` and `useCurrentScene`. Direct use is appropriate for custom overlays that need multiple state values.

---

## 13. Context Providers

All context providers are established by `ScenePlayer` in this nesting order (outer to inner):

```
VariableStoreContext.Provider
  LabelPositionerContext.Provider
    EngineStateContext.Provider
      EngineContext.Provider
        EngineInputRegion
          [children, HudOverlay, LabelItems, TimelineWidget]
```

### 13.1 EngineStateContext

```typescript
const EngineStateContext = createContext<EngineState | null>(null);

type EngineState = {
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
};
```

Updated by `ScenePlayer` via `useMemo` from `engine.progress` and `engine.frameState`. Consumed by `useEngineState`, `useSceneProgress`, and `useCurrentScene`. The context value is a new object reference on every tick index change — memo comparisons on this context value must compare individual fields, not the object reference.

### 13.2 VariableStoreContext

```typescript
const VariableStoreContext = createContext<VariableStore | null>(null);
```

Provides the `VariableStore` instance to all components in the tree. Consumed by `useVariable`. The store instance is stable for the engine lifetime — it is created once in `useSceneEngine` via `useMemo(() => new VariableStore(), [])`.

### 13.3 LabelPositionerContext

```typescript
const LabelPositionerContext = createContext<LabelPositioner | null>(null);

const useLabelPositioner = (): LabelPositioner  // throws if outside ScenePlayer
```

Provides the `LabelPositioner` instance to `LabelItem` components. The positioner is stable for the engine lifetime. `LabelItem` components call `positioner.registerElement(id, el)` on mount/unmount to register their DOM elements for per-frame positioning updates.

### 13.4 EngineContext

```typescript
const EngineContext = createContext<UseSceneEngineResult | null>(null);

const useSceneEngineContext = (): UseSceneEngineResult  // throws if outside ScenePlayer
```

Provides the full `UseSceneEngineResult` to advanced consumers. Used by `CameraControlPanel` (needs `getCamera()`, `setCameraOverride()`). Not intended for standard host application use — it exposes the engine's internals. Prefer `useCurrentScene`, `useSceneProgress`, and `useVariable` for normal UI integration.

---

## 14. EngineScrollRegion and EngineInputRegion

### 14.1 EngineScrollRegion

```typescript
type EngineScrollRegionProps = {
  engine: UseSceneEngineResult;
  className?: string;
  children?: ReactNode;
};
```

DOM wrapper for scroll-mode deployments. Renders a tall outer div (height = `engine.scrollRegionHeightPx`) with `engine.scrollRegionRef` attached. Inside, a sticky viewport div (height = `100vh`) contains a background div, the Three.js canvas, and an overlay div for children. Manages `ResizeObserver` to call `engine.setViewportSize` on container resize.

### 14.2 EngineInputRegion

```typescript
type EngineInputRegionProps = {
  engine: UseSceneEngineResult;
  inputMap?: SceneNavInputMap;
  className?: string;
  children?: ReactNode;
};
```

The component used inside `ScenePlayer` internally. Adapts layout based on `inputMap.mode`:

- **Scroll mode:** Outer div has height = `scrollRegionHeightPx` and `overscrollBehavior: 'none'`. Inner viewport is `position: sticky`.
- **Direct mode:** Outer div has height = `100vh`. Inner viewport is `position: relative`.

The inner viewport has `tabIndex={-1}` and an `onPointerDown` handler that calls `focus()` — this ensures keyboard events fire after the user clicks into the scene (required for keyboard navigation shortcuts).

Both region components manage `ResizeObserver` and `window.resize` events to keep `engine.setViewportSize` current.

---

## 15. LabelPositioner

`LabelPositioner` manages DOM element registration and per-frame CSS transform positioning for label elements. It is the 3D-to-screen projection system for `LabelItem` components.

```typescript
class LabelPositioner {
  registerElement(id: string, el: HTMLElement | null): void;
  setContainerSize(width: number, height: number): void;
  update(
    labels: LabelResolved[],
    camera: THREE.Camera,
    boneWorldPositions: Map<string, [number, number, number]>,
    targetColors?: Map<string, string>,
  ): void;
}
```

`update` is called once per render frame (after `renderer.render`). For each active `LabelResolved`:

1. Looks up the DOM element by `label.id` from the registered elements map.
2. Reads the bone world position for `label.targetPartId` from `boneWorldPositions`.
3. Projects both the bone position and the offset-adjusted position to screen space via `vec.project(camera)`.
4. Computes the connector line angle, length, and anchor point.
5. Sets CSS custom properties on the DOM element: `--label-line-length`, `--label-line-angle`, `--label-line-origin-x`, `--label-line-origin-y`.
6. Sets `--label-color` and `--label-line-color` if `style.color === 'target-color'` and a target color is available.
7. Sets `element.style.transform` to position the label at the projected screen coordinates.

Labels for which `enabled === false` have `display: none` set without projection computation.

---

## 16. TimelineWidget

`TimelineWidget` is an interactive scrubbing UI component rendered inside `<ScenePlayer>` when `timeline` is set.

```typescript
type TimelineWidgetProps = {
  engine: UseSceneEngineResult;
  scenes?: SceneDefinition[];
  orientation?: 'horizontal' | 'vertical';
  position?: 'top' | 'bottom' | 'left' | 'right';
  theme?: 'dark' | 'light';
  thickness?: number;
  majorTicks?: 'scene' | 'frame';
  minorTicksPerScene?: number;
  showSceneLabels?: boolean;
  showProgress?: boolean;
  scrubEnabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onSeek?: (progress: number) => void;
};
```

The widget renders a track bar with a draggable handle. Major tick marks correspond to scene boundaries (when `majorTicks === 'scene'`) or individual tick frames (when `majorTicks === 'frame'`). Scene labels appear above/beside major ticks when `showSceneLabels` is true.

Scrubbing is implemented via pointer capture (`setPointerCapture`) — the handle tracks the pointer even when it moves outside the track bounds. During scrub, `engine.scrollToProgress` is called on every pointer move. The `isScrubbing` flag suppresses the engine's own progress from overwriting the scrub handle position during the drag.

The `pointerEvents: 'auto'` style is critical: `HudOverlay` sets `pointer-events: none` on its container. `TimelineWidget` re-enables pointer events on its own container to remain interactive.

---

## 17. CameraControlPanel

`CameraControlPanel` is an optional React component providing interactive camera reset and preset selection UI.

```typescript
// Exported from @brewsite/core/player
export { CameraControlPanel } from './CameraControlPanel';
```

It reads `getCamera()` and `setCameraOverride()` from `useSceneEngineContext`. The reset button calls `setCameraOverride(null)`, which clears any active orbit/dolly override and returns the camera to the compiled position for the current scene.

`CameraControlPanel` is appropriate for development tooling and demo environments. Production scenes typically do not render it.

---

## 18. SceneMetaWidget

`SceneMetaWidget` is an `IAnimationController` that bridges the scene track to the `VariableStore`. It runs at `tickPriority = -1000`, ensuring it ticks before any consumer controller.

```typescript
class SceneMetaWidget implements IAnimationController {
  readonly widgetId = '__scene_meta__';
  readonly tickPriority = -1000;
  constructor(options?: { onSceneChange?: (sceneId: string, sceneIndex: number) => void });
  setOnSceneChange(callback?: (sceneId: string, sceneIndex: number) => void): void;
  onTick({ variables, tick }: AnimationTickContext): void;
}
```

On each tick, `SceneMetaWidget` publishes to the `'scene'` namespace:

- `scene.id` — `tick.sceneId`
- `scene.index` — `tick.sceneIndex`
- `scene.progress` — `tick.blockProgress`
- Any keys present in `tick.state.meta` (dynamic scene metadata authored via `<Scene meta={{ ... }}>`)

When the `sceneId` changes, `onSceneChange(sceneId, sceneIndex)` is fired. `ScenePlayer` wires this to the `onSceneChange` prop.

`SceneMetaWidget` is registered by `createDefaultWidgetRegistry` with `widgetId = '__scene_meta__'`. It is always present in the default registry. Custom registries built without `createDefaultWidgetRegistry` must register it explicitly to enable `useCurrentScene`, `useSceneProgress`, and `useVariable('scene', ...)`.

---

## 19. Asset Manifest

### 19.1 Manifest Format

```typescript
type AssetManifest = {
  version: number;
  models: ModelAsset[];
  animations: AnimationAsset[];
};
```

The manifest JSON is authored separately from the scene DSL and fetched at runtime. It decouples asset URLs and metadata from scene authoring. `siteResources.ts` in `apps/examples` is the canonical source; `pnpm gen:scene-dsl` regenerates typed DSL from it.

### 19.2 clipMetaFromManifest

```typescript
const clipMetaFromManifest = (manifest: AssetManifest): ClipMeta[]
```

Extracts `ClipMeta[]` from the manifest for use by the compiler. Each `ClipMeta` describes an animation clip name, duration in seconds, and optional `clipStart` / `clipEnd` frame overrides. The compiler uses `clipMeta` in `compileExtra` to map DSL clip references to GLTF frame ranges.

### 19.3 assertManifestValid

```typescript
const assertManifestValid = (raw: unknown): AssetManifest
```

Validates the raw JSON fetched from `manifestUrl`. Throws if the manifest is not an object with a `version` field, or if `models` / `animations` are not arrays. Used by `ScenePlayer` before storing the manifest in state.

---

## 20. SSR Safety Contract

`ScenePlayer` must be safe to render server-side. The following constraints are enforced:

1. **No Three.js code on the server code path.** All Three.js imports (`new THREE.WebGLRenderer(...)`, `new THREE.Scene()`, etc.) are inside `useEffect` callbacks. They are never called during `render()` or `renderToString()`.

2. **Server render returns placeholder.** `ScenePlayer` checks `typeof window !== 'undefined'` at render time. On the server, it returns `placeholder ?? null`. This produces stable HTML for hydration.

3. **No hydration mismatch.** The canvas, HUD overlay, and label elements are only rendered client-side (after `isBrowser` is `true`). The placeholder renders identically on server and client until the engine's first tick.

4. **Vite-specific HMR code is guarded.** The `import.meta.hot` HMR handler is only registered if `import.meta.hot` exists. This guard prevents crashes in non-Vite build environments.

5. **Manifest fetching is safe.** The `fetch(manifestUrl)` call is inside a `useEffect` with a `cancelled` flag. If the component unmounts before fetch resolves, the state update is suppressed.

---

## 21. Test Infrastructure

### 21.1 Runtime Mocks

Test doubles for the Runtime and Widget SDK live in `packages/core/src/runtime/mocks/`. All mocks implement their respective interfaces with no Three.js dependency.

**`createMockRenderable(id)`** — Implements `IRenderable`. Records `appliedStates[]`, `initializeCalled`, `disposeCalled`.

**`createMockSceneElementWidget<TState>(id, defaultState)`** — Implements `ISceneElement + IRenderable`. Identity transition spec. Records `appliedStates[]`.

**`createMockAnimationController(id, tickPriority?)`** — Implements `IAnimationController`. Records `tickCount`, `lastCtx`.

### 21.2 RuntimeLoop Test Utilities

`RuntimeLoop` accepts a pluggable `clock` option:

```typescript
type RuntimeLoopClock = {
  now: () => number;
  requestFrame: (cb: (nowMs: number) => void) => RuntimeLoopFrameHandle;
  cancelFrame: (id: RuntimeLoopFrameHandle) => void;
};
```

In tests, provide a deterministic clock that controls `now()` and manually dispatches frames via `loop.step(nowMs)` or `loop.stepImmediate(nowMs)`. Combined with `fixedDeltaSeconds`, this enables fully reproducible frame sequences without actual rAF scheduling.

### 21.3 Testing Principles

The testing pattern for the Runtime layer is interface-based stateful testing: construct a real `RuntimeDriverImpl` with mock widgets from `widgetMocks.ts`, call `tick` with known inputs, assert on `appliedStates[]`. Do not mock `RuntimeDriverImpl` internals.

For hooks (`useSceneProgress`, `useCurrentScene`, `useEngineInput`), use React Testing Library with a minimal `ScenePlayer` wrapper providing a real engine context.

---

## 22. Breaking Change Assessment

**Current semver status:** `ScenePlayerProps.widgetSetup` was changed from `(registry: WidgetRegistry) => void` to `(manifest: AssetManifest | null) => WidgetRegistry`. This was a major breaking change — existing consumers that mutated a registry passed to them now need to construct and return a registry from `widgetSetup`. New consumers use `createDefaultWidgetRegistry(manifest)` inside `widgetSetup`.

**Guardrail:** `ScenePlayerProps` fields must not be removed or renamed in minor versions. New optional fields can be added freely.

**Known future risk:** `useSceneEngineContext` returns `UseSceneEngineResult` which includes internal engine refs. Additions to this type are non-breaking; removals are major changes. The type should not be used as a stable public API surface for third-party libraries — prefer the narrow hook APIs.

---

## 23. Open Questions

- Should `EngineScrollRegion` be deprecated in favor of `EngineInputRegion`? Both serve the scroll-mode use case; `EngineInputRegion` is more general. Having two components for scroll-mode integration is confusing.
- Should `useSceneProgress()` return the full `EngineState` instead of just `number`, to avoid consumers calling both `useSceneProgress` and `useCurrentScene`? A combined hook would reduce context reads.
- Should `ScenePlayer` accept a `ref` forwarded to the canvas element for consumers who need direct canvas access (e.g., screenshot capture)? Currently achievable via `useSceneEngineContext().getRenderer()`, but less ergonomic.
- Should `debug` information in `UseSceneEngineResult` be gated behind a `__DEV__` flag to prevent any dev-only overhead in production builds?

---

## 24. Launch Criteria

For any release that modifies the Player or Runtime public API:

- All `ScenePlayer` prop types compile with `strict: true` and no `any`.
- `useCurrentScene`, `useSceneProgress`, and `useVariable` pass integration tests inside a `<ScenePlayer>` wrapper.
- `RuntimeDriverImpl` unit tests cover the full tick sequence order (animation controllers before sampling before apply).
- `RuntimeLoop` deterministic tests cover fpsCap throttling and delta clamping.
- `EngineInputRegion` renders correctly in both `scroll` and `direct` modes.
- `TimelineWidget` scrub interaction test confirms `scrollToProgress` is called on pointer drag.
- SSR render of `<ScenePlayer>` produces no Three.js errors and matches the placeholder output.
- `CHANGELOG.md` in `packages/core` has an entry for every changed exported symbol.
- `packages/core/README.md` reflects the current `ScenePlayerProps` interface.
- At least one example in `apps/examples/` demonstrates the feature if it is new behavior.
