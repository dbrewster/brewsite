---
title: "BrewSite Core — Vision & Overview"
doc_type: prd
owner: brewsite-product-manager
status: active
updated: 2026-02-28
change_history:
  - date: 2026-02-28
    author: brewsite-product-manager
    summary: "Comprehensive rewrite replacing outdated BrewFlow-era vision document. Updated product name to BrewSite, corrected all API surface details against actual source, expanded Widget SDK section, added SSR safety contract, aligned all type references with live codebase."
---

# BrewSite Core — Vision & Overview

---

## 1. Product Overview

`@brewsite/core` is a TypeScript + React + Three.js framework for authoring and playing back animated 3D marketing scenes. It is a published open-source SDK designed for TypeScript developers building product demo sites, marketing landing pages, and interactive 3D presentations.

The package solves a specific and painful problem: creating scroll-driven or interaction-driven 3D animations in React that look polished and perform well is normally a multi-week engineering effort. Developers must coordinate Three.js render loops, React state, animation curves, camera behaviors, and scene sequencing — all while ensuring the result is performant, SSR-safe, and maintainable. `@brewsite/core` compresses that work into a declarative JSX authoring model and a pre-baked playback engine.

A consuming developer describes their scenes as pure JSX snapshots — what objects should look like at each scene stop — and the toolkit handles all transition math, interpolation, camera animation, input handling, and React/Three.js integration. The output is a `<ScenePlayer>` React component that accepts a compiled `SceneTrack` and runs the animation against user scroll, pointer interaction, or programmatic control.

The companion package `@brewsite/diagram` extends the toolkit with immersive 3D diagram, image panel, and screen elements. It is a separate published package that imports from `@brewsite/core` and adds its own DSL components and widget implementations.

---

## 2. Core Philosophy & Design Principles

### 2.1 Scenes as Pure Declarative Snapshots

A scene definition is a pure declaration of state: what exists, where it is, what it looks like. No animation math. No Three.js calls. No frame callbacks. The author writes JSX that describes a scene at rest, and the compiler produces the transitions between scenes automatically by calling registered widget transition handlers.

This is a deliberate constraint, not a limitation. It means scenes are:
- **Testable without a DOM or WebGL context** — compile-time tests run anywhere.
- **Diffable** — the compiler computes forward and backward deltas per tick, enabling efficient React updates.
- **Refactorable** — moving a scene, reordering scenes, or changing a value is a local edit with predictable effect.
- **Auditable** — the entire animation state at any time step is a plain JavaScript object.

### 2.2 Pre-Baked Transitions for O(1) Playback

The compiler runs once at startup and produces a flat `SceneTrack` array. Each element in the array is a `SceneTrackTick`: a fully resolved frame with widget states, HUD primitives, and label positions baked in. The runtime samples the track by index using a single multiplication and floor operation — O(1) regardless of scene count or transition complexity.

This means the render loop is never doing curve evaluation, interpolation math, or conditional branching across scenes. It reads a tick. It dispatches state to widgets. It draws. Runtime performance is predictable and scales with scene count linearly only in compilation time, not in playback time.

### 2.3 Strict Layer Separation

Three.js is confined exclusively to `render.ts` files. No Three.js import may appear in `types.ts`, `dsl.tsx`, `compile.ts`, or any widget interface. No React import may appear in `compile.ts` or `render.ts`. No side effects may appear in `types.ts`.

This boundary enforces testability: the compiler pipeline and widget state machine are fully testable without instantiating a WebGL context. It also means the toolkit can be compiled in environments where Three.js is not available (e.g., SSR environments at the module graph level) as long as Three.js `render.ts` files are not imported during server rendering.

### 2.4 Widget SDK as Plugin Mechanism

Every renderable concept in the toolkit — models, cameras, lighting, backgrounds, floors, environment maps — is a widget. The Widget SDK defines a set of interfaces (`IWidget`, `ISceneElement`, `IRenderable`, `ILoadable`, etc.) that widgets implement. The runtime does not know about models or cameras — it knows about widgets. Adding a new renderable concept to the toolkit, or to a consuming application, requires no changes to the runtime: implement the interface, register the widget.

This is the primary extension point for toolkit consumers. A consumer building a custom 3D element for their product site implements `IWidget` (and whatever sub-interfaces are appropriate), registers it, and it participates in the same compile/playback lifecycle as all built-in elements.

### 2.5 Interface-Based Testing

Tests assert observable behavior through public interfaces, not internal implementation. For runtime-level tests, the test suite uses interface-conforming doubles from `runtime/mocks/` rather than mocking internal method calls. Compiler-level tests use real DSL inputs and assert real `SceneFrame` or `SceneTrack` output.

`render.ts` files are excluded from coverage because they require a live WebGL context. Everything else — compiler, widget state machines, runtime logic, HUD compilation, label compilation, timeline math — is tested without Three.js.

### 2.6 SSR Safety Contract

`@brewsite/core` must be importable in a Node.js environment at the module level without crashing. All Three.js instantiation, all DOM access, all `window`/`document` references are deferred to component mount time or runtime initialization. The package makes no assumptions about browser globals at import time.

Consumers using frameworks like Next.js can import the package without `next/dynamic` guards, and can render the `<ScenePlayer>` component on the server — it will produce a placeholder output rather than crash. Client-side hydration completes the initialization.

---

## 3. Key Capabilities

### 3.1 Animated 3D Scenes

The core capability: animate GLTF models, cameras, lighting rigs, and environment settings across multiple scene stops. Authors describe each scene as a JSX snapshot. The compiler interpolates between scenes using registered widget transition handlers. The player plays back against any scroll or input signal.

Built-in elements:
- **Model** — GLTF models with animation clip control, position, rotation, opacity, and contained sub-models.
- **Camera** — Perspective camera with position, target, and field-of-view control. Four positioning modes: `world` (absolute coordinates), `orbit` (spherical coordinates around a target), `fitBotHeight` (auto-fit to a height in world space), `fitFloorDepth` (auto-fit to a depth plane).
- **Lighting** — Ambient, directional, and point lights with color and intensity control.
- **Background** — Scene background color or gradient.
- **Environment** — HDR environment map for physically-based rendering.
- **Floor** — Reflective floor plane with opacity and blur control.

### 3.2 Camera Modes

The camera element supports four positioning modes that cover the primary marketing scene compositions:

- `world` — Position and target specified as absolute world-space Vec3 coordinates. Maximum author control.
- `orbit` — Position specified as spherical coordinates (radius, theta, phi) around a target point. Natural for turntable and rotation animations.
- `fitBotHeight` — Camera auto-positions to frame a specified height above the floor. Useful for scenes where a model's visible extent changes across scenes.
- `fitFloorDepth` — Camera auto-positions to frame a specified depth in the floor plane. Useful for sequences that move along a floor-level path.

### 3.3 Input and Navigation

Scene navigation is driven by any of the following input modes, selected by the consumer at integration time:

- **Scroll** — Browser scroll events drive global progress. `EngineScrollRegion` provides a scroll-locked container.
- **Drag / swipe** — Pointer drag and touch swipe events drive navigation. Configurable sensitivity.
- **Wheel** — Mousewheel events drive navigation directly. Configurable `wheelMultiplier`.
- **Keyboard** — Arrow keys, page up/down, or custom key combos advance and reverse scenes.
- **Programmatic** — Direct progress injection via `useEngineScrubber` or `useEngineInput` hooks.

The `InputController` DSL component and its `Action` children define the input map for each scene in the authoring surface. The `ActionInputController` handles action-mapped camera interactions: orbit, dolly, pan, and reset. The `DiagramCanvas` element in `@brewsite/diagram` uses the same action system for canvas-level focus and camera control.

### 3.4 HUD Overlay System

The HUD (heads-up display) overlay system renders React content synchronized to scene progress on top of the Three.js canvas. HUD items are defined inside `<Hud>` / `<HudItem>` DSL components within scene definitions. The compiler bakes HUD item visibility, styles, and content per tick into `hudPrimitives` arrays on `SceneTrackTick`.

The `hud/animejs/` sub-module provides optional anime.js-powered scroll-driven animation presets for HUD items. These presets handle common patterns like fade-in on scene entry, slide-up reveals, and stagger sequences.

### 3.5 3D-Tracked Labels

The labels system renders React-based label components that track 3D positions in the scene and project them to screen coordinates. Labels are defined in scene DSL, compiled to `labelPrimitives` per tick, and positioned at runtime by `LabelPositioner` — which reads bone world positions from the `RuntimeDriver` and projects them through the active camera's projection matrix.

Labels support text, custom CSS, color inheritance from tracked mesh targets, and configurable offset.

### 3.6 Pre-Compiled Timeline Algebra

The `timeline/` module provides the algebra for converting a scene list into a tick index space. `createSceneTimeline(scenes)` returns a `SceneTimeline` describing the total tick count, tick step, oversampling rate, and utility functions for progress mapping and snapping.

Defaults: 30 frames per scene, 10× oversampling rate. `createQualityTimeline(base, subTicksPerSegment)` produces a variant at a different resolution for quality tiering.

### 3.7 Widget SDK and VariableStore

The Widget SDK (`widget/`) is the extension mechanism for all renderable and behavioral concepts. The `WidgetRegistry` routes DSL node types to widget instances. The `VariableStore` is a reactive key-value store for sharing state across widgets — a model widget can publish its current animation name; a HUD widget can subscribe and render it.

`CUSTOM_NODE_HANDLER` is a Symbol that a widget can implement to register its own DSL node handler inline, enabling tight coupling between a widget and its DSL component without going through the global registry.

---

## 4. Published Package API

The following is the complete public surface of `@brewsite/core`. All symbols listed here are stable across patch and minor releases. Breaking changes require a major version bump.

### 4.1 React Components

```typescript
// Primary entry point — renders the Three.js canvas and all overlay layers
<ScenePlayer
  sceneTrack={SceneTrack}
  widgetRegistry={WidgetRegistry}
  variableStore={VariableStore}
  progress={number}                                      // controlled progress [0, 1]
  onSceneChange?: (sceneId: string, index: number) => void
  contentSlots?: Record<string, ReactNode>               // named slots for overlay content
  placeholder?: ReactNode                                // shown while assets load
/>

// Overlay component for projecting 3D-tracked labels to screen space
<LabelPositioner runtime={RuntimeDriver} camera={THREE.Camera} renderer={THREE.WebGLRenderer} />

// Debug/scrubbing UI — shows scene timeline and current progress
<TimelineWidget />

// Debug camera controls panel
<CameraControlPanel />
```

### 4.2 React Hooks

```typescript
// Access the underlying RuntimeDriver and engine state
const engine = useSceneEngine(): { driver: RuntimeDriver; state: EngineState } | null

// Subscribe to scroll-based progress updates
const { progress, onScroll } = useEngineScroll(): EngineScrollBinding

// Inject input events (drag, wheel, key) into the engine
const inputRef = useEngineInput(options: SceneInputControllerSpec): RefObject<HTMLElement>

// Read and control the scrubber progress directly
const { progress, setProgress } = useEngineScrubber(): ScrubberBinding

// Read current [0, 1] progress within the current scene
const sceneProgress = useSceneProgress(): number

// Read the current scene id and index
const { sceneId, sceneIndex } = useCurrentScene(): { sceneId: string; sceneIndex: number }

// Subscribe to a VariableStore value by key
const value = useVariable<T>(store: VariableStore, key: string): T | undefined
```

### 4.3 Widget SDK

```typescript
// Interfaces
interface IWidget { /* base contract */ }
interface ISceneElement extends IWidget { /* participates in scene DSL compilation */ }
interface IRenderable extends IWidget { /* applies state to Three.js scene each tick */ }
interface ILoadable extends IWidget { /* async asset loading lifecycle */ }
interface IDslComposite extends IWidget { /* owns sub-node DSL handling */ }
interface IAnimationController extends IWidget { /* drives GLTF animation clips */ }
interface IContainedModel extends IWidget { /* sub-model inside a parent ModelWidget */ }
interface IVariableProvider extends IWidget { /* publishes values to VariableStore */ }

// Registry
class WidgetRegistry {
  register(widget: IWidget): this
  registerTypeFactory(component: unknown, factory: (props: Record<string, unknown>) => IWidget): this
}

// Reactive cross-widget state
class VariableStore {
  set(key: string, value: JsonPrimitive): void
  get(key: string): JsonPrimitive | undefined
  subscribe(key: string, listener: (value: JsonPrimitive | undefined) => void): () => void
}

// React hook for VariableStore values
function useVariable<T extends JsonPrimitive>(store: VariableStore, key: string): T | undefined

// Type guards
function isSceneElement(w: IWidget): w is ISceneElement
function isRenderable(w: IWidget): w is IRenderable
function isLoadable(w: IWidget): w is ILoadable
function isContainedModel(w: IWidget): w is IContainedModel
function isDslComposite(w: IWidget): w is IDslComposite
function isAnimationController(w: IWidget): w is IAnimationController
function isVariableProvider(w: IWidget): w is IVariableProvider

// Symbol for inline DSL handler registration
const CUSTOM_NODE_HANDLER: unique symbol
```

### 4.4 DSL Authoring Components

```typescript
// Scene container — declares one stop in the sequence
<Scene id={string} />

// Scene group — groups scenes for shared metadata or layout
<SceneGroup id={string} />

// HUD overlay — renders React content over the canvas
<Hud>
  <HudItem id={string} css={CSSProperties} />
</Hud>

// Input controller — defines navigation and action input map for a scene
<InputController drag? wheel? click? key? />

// Action — defines an action binding within an InputController
<Action name={string} type={InputActionType} />
```

### 4.5 Default Widget Registration

```typescript
// Wires all built-in widgets from the manifest. Call once per ScenePlayer instance.
function createDefaultWidgetRegistry(
  manifest: AssetManifest | null,
  options?: { onSceneChange?: (sceneId: string, sceneIndex: number) => void }
): WidgetRegistry
```

`createDefaultWidgetRegistry` registers: `ModelWidget` (with factory from manifest), `LightingWidget`, `BackgroundWidget`, `EnvironmentWidget`, `FloorWidget`, `CameraWidget`, `SceneMetaWidget`.

### 4.6 Transition Utilities (Re-exported from compiler)

```typescript
// Discrete batch-fill transition spec — widget fills frame slots in compiler
type ElementTransitionSpec<T> = {
  exit(frames: SceneTrackTick[], widgetId: string, fromState: T): void
  enter(frames: SceneTrackTick[], widgetId: string, toState: T): void
  interpolate(frames: SceneTrackTick[], widgetId: string, fromState: T, toState: T): void
}

// Functional closure transition spec — widget returns pure t => T functions
type FunctionalTransitionSpec<T> = {
  exitFn: (fromState: T) => (t: number) => T
  enterFn: (toState: T) => (t: number) => T
  interpolateFn: (fromState: T, toState: T) => (t: number) => T
}

// Blend helpers
function clamp01(value: number): number
function lerp(a: number, b: number, t: number): number
function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3
function blendNumber(from?: number, to?: number, t?: number): number | undefined
function blendVec3(from?: Vec3, to?: Vec3, t?: number): Vec3 | undefined
function blendColor(from?: string, to?: string, t?: number): string | undefined
function blendOpacity(from?: number, to?: number, t?: number): number | undefined
function blendDistance(from?: number, to?: number, t?: number): number | undefined
function blendAxisRotation(from?, to?, t?): { yawPct?, pitchPct?, rollPct? } | undefined
function blendAxisTranslation(from?, to?, t?): { xPct?, yPct?, zPct? } | undefined
function blendStyleValues<T>(from?: T, to?: T, t: number): T | undefined
function blendStyleValuesPartial<T>(from?: T, to?: T, t: number): T | undefined
function mergeCssOpacity(css?, opacity?): Record<string, string | number> | undefined
function resolveTransitionOpacity(opacity?: number, enabled?: boolean): number
function resolveEnabledByOpacity(opacity?: number, fallback?: boolean): boolean
```

### 4.7 Math Utilities

```typescript
type Vec3 = [number, number, number]
type Mat4 = [number, number, number, number, /* ... 16 elements */]
type Quaternion = { x: number; y: number; z: number; w: number }

function quatFromEuler(rotation: Vec3): Quaternion
function quatNormalize(q: Quaternion): Quaternion
function quatSlerp(a: Quaternion, b: Quaternion, t: number): Quaternion
function quatMultiply(a: Quaternion, b: Quaternion): Quaternion
function quatToEuler(q: Quaternion): Vec3
function composeMatrix(position: Vec3, rotation: Vec3, scale: Vec3): Mat4
function multiplyMatrices(a: Mat4, b: Mat4): Mat4
function decomposeMatrix(matrix: Mat4): { position: Vec3; rotation: Vec3; scale: Vec3 }
function copyVec3(value: Vec3): Vec3
```

### 4.8 Timeline API

```typescript
type SceneTimeline = {
  stops: ReadonlyArray<{ id: string }>
  sceneCount: number
  framesPerScene: number
  subTicksPerSegment: number
  oversamplingRate: number
  tickStep: number
  subTickCount: number
  tick(index: number): number
  mapToSceneProgress(progress: number): number
  snapToTick(progress: number): number
}

function createSceneTimeline(
  scenes: ReadonlyArray<{ id: string }>,
  options?: { framesPerScene?: number; subTicksPerSegment?: number; oversamplingRate?: number }
): SceneTimeline

function createQualityTimeline(base: SceneTimeline, subTicksPerSegment: number): SceneTimeline
```

---

## 5. Architectural Boundaries

### 5.1 Package Dependency Rule

`@brewsite/diagram` may import from `@brewsite/core`. `@brewsite/core` must never import from `@brewsite/diagram`. `apps/examples` may import from both.

This is a hard constraint. Violating it would create a circular dependency and make the packages unseparately publishable.

### 5.2 Layer Dependency Rule Within Core

The layer stack flows strictly top-to-bottom. Higher layers depend on lower layers; lower layers never depend on higher layers:

```
player/ → runtime/ → compiler/ → elements/ → widget/ → timeline/ → math/
hud/    ← compiler/
labels/ ← compiler/
input/  ← (standalone)
```

Concretely:
- `compiler/index.ts` exports only DSL authoring surface. Infrastructure types (`SceneTrack`, `compileSceneTrack`, cache functions) are imported directly from their source files by the player layer, never re-exported through the compiler index.
- `runtime/` has no Three.js imports. It receives widget instances that internally use Three.js, but the runtime itself does not.
- `elements/{name}/types.ts` has no Three.js, no React, no runtime imports — only plain TypeScript types.
- `elements/{name}/render.ts` may import Three.js. It must not import from the compiler layer.

### 5.3 Three.js Confinement

Three.js imports are allowed only in:
- `elements/*/render.ts`
- `elements/*/render.ts` files in `@brewsite/diagram`
- `player/` components that create or manage the `WebGLRenderer` and `Scene` instances

Anywhere else — types files, compile files, widget files, runtime files, hooks — Three.js is prohibited.

### 5.4 No Circular Dependencies

The monorepo enforces no circular imports between layers. Any new file added to the codebase must be assignable to exactly one layer. If a new type or utility is needed by multiple layers, it belongs in the lowest layer that needs it.

---

## 6. Widget SDK Design

### 6.1 IWidget Interface Hierarchy

All widgets implement the base `IWidget` interface. Additional capabilities are expressed through optional sub-interfaces that the runtime queries via type guards.

```typescript
interface IWidget {
  readonly widgetId: string;
}

interface ISceneElement extends IWidget {
  // Participates in DSL compilation. The compiler calls compileExtra()
  // after the main track bake to let this widget post-process tick data
  // (e.g., bake animation clip metadata into widgetExtras).
  compileExtra?(context: CompileExtraContext): void;
}

interface IRenderable extends IWidget {
  // Called by RuntimeDriverImpl each tick after sampling the SceneTrack.
  // Receives the widget's compiled state for this tick and applies it
  // to the Three.js scene.
  apply(state: unknown, context: WidgetRenderContext): void;
  // Called when the Three.js scene is set up. Widget adds its meshes/lights.
  mount(context: WidgetInitContext): void;
  // Called on dispose. Widget removes and disposes all Three.js objects.
  unmount(): void;
}

interface ILoadable extends IWidget {
  // Async asset loading. Runtime waits for all ILoadable.load() calls
  // to resolve before setting assetsReady = true.
  load(): Promise<void>;
}

interface IDslComposite extends IWidget {
  // Widget handles sub-node DSL routing for its child DSL components.
  // The CUSTOM_NODE_HANDLER symbol is the registration path.
  [CUSTOM_NODE_HANDLER]: NodeHandler;
}

interface IAnimationController extends IWidget {
  // Drives GLTF animation clips. tick() is called each frame in priority order.
  tick(context: AnimationTickContext): void;
  tickPriority: number;  // lower = earlier
}

interface IContainedModel extends IWidget {
  // A sub-model managed by a parent ModelWidget.
  // setParent() is called by ModelWidget.mount() when the parent GLTF loads.
  setParent(parent: THREE.Object3D): void;
}

interface IVariableProvider extends IWidget {
  // Publishes values to the VariableStore on each tick.
  publishVariables(store: VariableStore, context: WidgetRenderContext): void;
}
```

### 6.2 WidgetRegistry Routing

The `WidgetRegistry` maintains two registries:
1. A direct widget-instance registry: `widgetId → IWidget`. Used for fixed-identity widgets (camera, lighting, floor, etc.).
2. A type-factory registry: `DSL component function → factory`. Used for multiple-instance widgets (models) where the widget instance is created from DSL props at compile time.

When the compiler evaluates a scene DSL node, it calls `getNodeHandler(component)` on the global registry to find the handler. The handler transforms DSL props into a `SceneFrame` widget state entry keyed by widget ID.

### 6.3 VariableStore

`VariableStore` is a synchronous reactive key-value store with `JsonPrimitive` values. Widgets implementing `IVariableProvider` call `store.set(key, value)` each tick. React components call `useVariable(store, key)` to subscribe and re-render when the value changes.

The canonical use case: a `ModelWidget` publishes the current GLTF animation clip name. A HUD label subscribes and displays it. The store eliminates the need for prop-drilling or external state management for this class of cross-widget communication.

### 6.4 CUSTOM_NODE_HANDLER

`CUSTOM_NODE_HANDLER` is a `unique symbol` exported from the Widget SDK. A widget that wants to handle its own DSL node type inline (rather than registering through the global compiler registry) implements the symbol as a method:

```typescript
class MyWidget implements IWidget, IDslComposite {
  readonly widgetId = 'my-widget';

  [CUSTOM_NODE_HANDLER](props: Record<string, unknown>, children: unknown[]): SceneFrame {
    // transform DSL props into SceneFrame widget state
  }
}
```

This pattern is used by complex widgets that have their own child DSL nodes (e.g., `ModelRouter` / `ModelWidget` which handles `<Model>` with nested `<ContainedModel>` children).

### 6.5 createDefaultWidgetRegistry

`createDefaultWidgetRegistry(manifest, options?)` is the convenience entry point for standard scenes. It creates a `WidgetRegistry` and registers all built-in widgets:

- `ModelWidget` — registered via type factory using the `AssetManifest`. The factory looks up model metadata by `type`, validates it exists, and constructs a `ModelWidget` instance.
- `LightingWidget`, `BackgroundWidget`, `EnvironmentWidget`, `FloorWidget`, `CameraWidget` — registered as singleton instances.
- `SceneMetaWidget` — registered with the optional `onSceneChange` callback for scene transition notifications.

Consumers building custom-only scenes (no GLTF models) pass `null` as the manifest. Consumers with models pass the `AssetManifest` generated by `gen:scene-dsl`.

---

## 7. Two-Tier Overlay Architecture

`<ScenePlayer>` renders two visual layers stacked in a single container:

**Tier 1: Three.js Canvas (WebGL)**
The `<canvas>` element managed by `WebGLRenderer`. All 3D objects (models, lighting, floor, environment) render here. The canvas is positioned `absolute, inset: 0` and fills the container.

**Tier 2: React Overlay**
A `<div>` positioned `absolute, inset: 0, pointerEvents: none` rendered over the canvas. Contains:
- `HudOverlay` — renders `hudPrimitives` from the current tick as React components with CSS animations.
- `LabelPositioner` — reads `labelPrimitives` from the current tick, projects 3D world positions through the camera's projection matrix, and renders `<LabelItem>` components at the correct screen coordinates.
- `contentSlots` — consumer-provided named React nodes injected into the overlay.

The two tiers share the same `RuntimeDriver` instance and `SceneTrackTick` data. `LabelPositioner` is the bridge: it reads `getBoneWorldPositions()` from the driver (which comes from `IRenderable` widgets reporting their Three.js object positions) and applies the camera projection to convert them to CSS pixel coordinates.

### 7.1 Context Providers

`ScenePlayer` provides the following React contexts to its subtree:

- `EngineStateContext` — current `EngineFrameState` (progress, sceneId, sceneIndex, tick). Updates on every frame.
- `VariableStoreContext` — the `VariableStore` instance. Stable reference; never recreated.
- `LabelPositionerContext` — the `LabelPositioner` instance for 3D → screen projection.
- `EngineContext` — the `RuntimeDriver` instance. Stable reference after initialization.

---

## 8. SSR Safety Contract

The following guarantees hold for all code in `@brewsite/core`:

1. **No top-level browser global access.** No module-level references to `window`, `document`, `navigator`, `performance`, or `requestAnimationFrame`. All such access is inside function bodies or `useEffect`/`useLayoutEffect` hooks.
2. **Three.js instantiation is deferred.** `WebGLRenderer`, `Scene`, `PerspectiveCamera`, and all Three.js objects are created inside `EngineFrameDriver.mount()` or equivalent React lifecycle methods, never at module import time.
3. **ScenePlayer renders a placeholder during SSR.** The component detects server environment (no `window`) and renders the `placeholder` prop (or an empty container) instead of the canvas. No WebGL context is requested.
4. **Compiler is fully SSR-safe.** `compileSceneTrack()` is a pure function with no DOM or browser dependencies. It can run during server-side data fetching or build-time static generation.
5. **Hooks guard against SSR.** All hooks that read browser state (`useEngineScroll`, `useEngineInput`, etc.) are no-ops during server rendering and initialize their listeners on mount.

---

## 9. Success Metrics

The following metrics define what success looks like for `@brewsite/core` as a product:

**Integration Time**
A developer integrating the toolkit into a new React project (with an existing GLTF asset) should reach a working animated scene with scroll navigation in under 2 hours. This is measured against example scenes in `apps/examples/`.

**TypeScript Error Surface**
Authoring errors — wrong prop types, unknown widget IDs, missing required fields — should be caught at TypeScript compile time, not at runtime. The API surface should produce no `any`-typed inference gaps at the DSL authoring layer.

**Bundle Size**
`@brewsite/core` (excluding Three.js peer dependency) should not exceed 120KB gzipped for a typical integration that uses the default widget set. Tree-shaking must be effective: a consumer using only the compiler and no player UI should not pull in React component code.

**Test Coverage**
Minimum 80% line coverage across all non-`render.ts` source files in `packages/core/src/`. Compiler pipeline, runtime logic, widget state machines, and timeline math must have comprehensive tests. Coverage is enforced in CI.

**API Stability**
No unintentional breaking changes in published minor versions. All breaking changes are deliberate, documented in CHANGELOG, and accompanied by a migration guide. The semver discipline is verified by comparing published `.d.ts` type signatures against the previous release.

**Developer Discovery**
The `packages/core/README.md` plus `apps/examples/` provide sufficient documentation for a new developer to understand the authoring model without reading source code. Example scenes cover: single-scene, multi-scene with scroll, custom widget, HUD overlay, labels, and camera interaction.

---

## 10. Non-Goals

The following are explicitly out of scope for `@brewsite/core`:

- **Application routing** — The toolkit does not manage URL-based navigation or deep-linking into scenes. That is consumer application responsibility.
- **Content management** — Scene content (model URLs, copy, colors) is authored in code. There is no CMS integration, no visual editor, and no data-fetching abstraction in the toolkit.
- **Physics or collision** — The toolkit is for visual playback of pre-defined animations, not real-time physics simulation.
- **Audio** — No audio playback, synchronization, or spatial audio. A consumer can implement audio via the `VariableStore` + a custom widget if needed.
- **Video textures** — No native video-texture DSL. Consumers can add this via the widget extension model.
- **Multi-renderer** — `@brewsite/core` targets WebGL via Three.js exclusively. WebGPU, React Native, or other renderer targets are not in scope.
- **Visual scene editor** — The authoring surface is code-first JSX. There is no drag-and-drop GUI. The `TimelineWidget` and `CameraControlPanel` are debug inspection tools, not authoring tools.
- **Application state management** — `VariableStore` is for cross-widget runtime values only. It is not a replacement for application-level state management (Redux, Zustand, etc.).
