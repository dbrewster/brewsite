---
title: "BrewSite Core — Architecture Reference"
doc_type: prd
owner: brewsite-product-manager
status: active
updated: 2026-03-07
change_history:
  - date: 2026-02-20
    author: brewflow-architect
    summary: "Initial architecture reference document."
  - date: 2026-02-20
    author: brewflow-architect
    summary: "Batch-fill transition model: scenes are discrete snapshots; compiler dispatches enter/exit/interpolate to widgets per transition block. Removes TransitionContext, SceneTransition, entryLead/entryStart, SceneTimeline from compiler interface. Renames sceneProgress to blockProgress on SceneTrackTick. Replaces SceneFrameContext with SceneSnapshotContext."
  - date: 2026-02-21
    author: brewflow-architect
    summary: "Update siteResources format to use type fields instead of id, aligning generator output naming."
  - date: 2026-02-23
    author: brewflow-architect
    summary: "Allow containedModels to define baked target/position/rotation defaults."
  - date: 2026-02-28
    author: brewsite-product-manager
    summary: "Comprehensive rewrite: corrected product name from BrewFlow to BrewSite, updated all type definitions against live source (SceneTrack, SceneTrackTick, SceneFrame, SceneFrameDelta, FunctionalTransitionSpec, RuntimeDriver, SceneTimeline, IWidget hierarchy), added FunctionalTransitionSpec and FunctionalWidgetTransition to transition spec section, added complete math module exports, added EngineState/EngineFrameState types, documented blend utility exports, clarified compiler registry pattern, added CUSTOM_NODE_HANDLER documentation."
  - date: 2026-03-03
    author: "Toolkit Product"
    summary: "API hardening updates: ScenePlayer replaced by EngineProvider as primary component (ScenePlayer deleted). EngineScrollRegion removed from key exports (deleted; use EngineInputRegion). createDefaultWidgetRegistry removed from key exports (deleted; use corePlugin()). Added EngineGate to key exports. Updated context providers attribution to EngineProvider. Removed compiler/primitives/index.ts barrel reference (barrel deleted in hardening phase). Updated all ScenePlayer references to EngineProvider across HUD, compiler, and SSR sections."
  - date: 2026-03-07
    author: "Toolkit Product"
    summary: "Core cleanup release: eliminated scene.userData inter-widget bus (ICameraFocusTarget + ICameraHost replace stringly-typed __brewsite_* keys); added ILightingOverride interface so downstream packages opt into lighting override without calling render-layer functions; added ViewportScaleContext (EngineARContainerContext deprecated as alias); all five scene widget ID constants (SCENE_CAMERA_KEY, SCENE_LIGHTING_KEY, SCENE_BACKGROUND_KEY, SCENE_ENVIRONMENT_KEY, SCENE_FLOOR_KEY) exported from @brewsite/core; disableWhenAbsent replaces duck-typed useDefaultStateWhenAbsent on ISceneElement; stateEquals optional hook added to ISceneElement for compiler change detection; resolvedState and setCameraOverride added to AnimationTickContext; InputActionType is now an open string union — diagram-canvas.* action types removed from core and owned by @brewsite/diagram; manifestUrl on EngineProvider is now optional and deprecated in favour of plugin-supplied manifests; animejs HUD presets removed from core bundle (moved to apps/examples/ as copy-paste recipes); CameraControlPanel, CameraInteractionInfoDialog, SceneInspector moved to @brewsite/core/devtools subpath; clearRegistry and test doubles available via @brewsite/core/testing subpath."
---

# BrewSite Core — Architecture Reference

This document is the authoritative architecture reference for `@brewsite/core`. It describes the monorepo structure, layer boundaries, module patterns, dependency rules, key data types, and runtime data flow. It is written as a stable description of the current system.

---

## 1. System Philosophy

`@brewsite/core` is built on five architectural commitments that constrain every design decision in the codebase:

**Pure declarative scenes.** A scene definition expresses state, not behavior. It contains no animation math, no Three.js calls, no frame callbacks, and no conditional logic. The compiler derives transitions from the difference between scenes. The runtime applies them. The author defines what, not how.

**Pre-baked tracks for O(1) playback.** All transition interpolation runs once at compile time. The result is a flat array of fully resolved ticks. At runtime, sampling any point in the animation is a single array index lookup. The render loop does no curve evaluation, no state diffing, and no conditional branching across scenes.

**Strict layer separation.** Three.js is confined to `render.ts` files. The compiler layer has no Three.js, no React, and no side effects. The runtime layer has no Three.js. Tests for any layer except rendering run without a WebGL context.

**Widget-first extension.** Every renderable or behavioral concept — models, cameras, lighting, custom 3D objects — is a widget implementing `IWidget`. Adding new elements to the toolkit, or to a consumer application, requires no framework changes. Register an implementation; it participates in the same compile/playback lifecycle as all built-in elements.

**Interface-based testing.** Tests assert observable contract behavior through public interfaces. Internal implementation details are not mocked. Runtime test doubles are interface-conforming stand-ins, not spy wrappers.

---

## 2. Monorepo Structure

This is a `pnpm` + Turborepo monorepo. Three workspaces:

| Path | Package name | Role | Published |
|---|---|---|---|
| `packages/core` | `@brewsite/core` | Animation engine library | Yes |
| `packages/diagram` | `@brewsite/diagram` | Diagram + screen element library | Yes |
| `apps/examples` | `@brewsite/examples` | Dev/demo app | No (private) |

**Package dependency rule:** `@brewsite/diagram` may import from `@brewsite/core`. `@brewsite/core` must never import from `@brewsite/diagram`. `apps/examples` may import from both. This rule is absolute. Violating it creates circular dependency and prevents independent publishing.

**Build tooling:**
- `@brewsite/core` builds with Vite (library mode) + tsc for type declarations.
- `@brewsite/diagram` builds with tsc only.
- `apps/examples` builds with Vite (app mode).

**Peer dependencies:** React, react-dom, and Three.js are peers for both published packages. Neither package pins peers to narrow version ranges. New peer dependencies require explicit justification — they impose a constraint on every consumer.

---

## 3. Layer Map

The `packages/core/src/` source tree is organized as a strict top-to-bottom dependency stack. Higher layers depend on lower layers. Lower layers never depend on higher layers.

```
player/      ← React integration surface (top)
  ↓
runtime/     ← Generic tick loop + widget dispatch
  ↓
compiler/    ← Pure DSL-to-SceneTrack pipeline
  ↓
elements/    ← Renderable element modules
  ↓
widget/      ← Plugin interfaces + registry
  ↓
hud/         ← HUD overlay types + compiler (no Three.js)
labels/      ← Label types + projection math
input/       ← Input controller abstractions
timeline/    ← Timeline algebra
math/        ← Pure math utilities (bottom)
```

### 3.1 Player (`player/`)

The React integration surface. The public entry point for pages and routes. Owns the WebGL renderer lifecycle, the React context tree, and all consumer-facing React components and hooks.

**Key exports:**
- `EngineProvider` — primary component. Establishes the engine context tree and manages the `WebGLRenderer` lifecycle. Compose with `EngineGate`, `EngineInputRegion`, `SceneCanvas`, and `EngineOverlayHost` for a complete integration.
- `EngineGate` — loading gate component. Renders `placeholder` until the engine produces its first frame (`tickIndex >= 0`), then renders children.
- `EngineFrameDriver` — the `requestAnimationFrame` driver. Converts frame timestamps to progress deltas and calls `RuntimeDriver.tick()`.
- `EngineInputRegion` — input capture region. Reads layout and engine state from `EngineContext` — no `engine` prop required. Routes pointer, scroll, and keyboard events to scene navigation controllers.
- `SceneCanvas` — renders the Three.js `<canvas>` element and registers it with the engine via `EngineContext`.
- `EngineOverlayHost` — renders HUD and label overlays positioned over the canvas. Reads the current scene overlay from `EngineContext`.
- `LabelPositioner` — bridges the Three.js render loop with React label rendering. Reads bone world positions from `RuntimeDriver.getBoneWorldPositions()`, projects through camera matrix, updates CSS positions on `LabelItem` DOM nodes.
- `TimelineWidget` — debug/dev overlay showing scene timeline, tick index, and progress scrubber.
- `SceneMetaWidget` — built-in widget that fires `onSceneChange` when the current scene index changes. Registered by `corePlugin()`.

**Dev-only exports (`@brewsite/core/devtools` subpath — not part of the main bundle):**
- `CameraControlPanel` — debug camera state inspector.
- `CameraInteractionInfoDialog` — debug dialog for live camera interaction state.
- `SceneInspector` — debug overlay for scene/tick inspection.
Import these from `@brewsite/core/devtools` to keep them out of production bundles. They should never be imported in application code outside of development contexts.

**Testing exports (`@brewsite/core/testing` subpath):**
- `clearRegistry` — resets the global compiler node registry between tests.
- Test doubles (e.g. `createMockSceneElementWidget`) for compiler and runtime unit testing.

**Scene widget ID constants (exported from `@brewsite/core`):**
- `SCENE_CAMERA_KEY` — widget ID for the built-in CameraWidget (`'__brewsite_camera'`)
- `SCENE_LIGHTING_KEY` — widget ID for the built-in LightingWidget (`'lighting'`)
- `SCENE_BACKGROUND_KEY` — widget ID for the built-in BackgroundWidget (`'background'`)
- `SCENE_ENVIRONMENT_KEY` — widget ID for the built-in EnvironmentWidget (`'environment'`)
- `SCENE_FLOOR_KEY` — widget ID for the built-in FloorWidget (`'floor'`)
- `corePlugin(options?)` — plugin factory that registers core built-in widgets (Lighting, Background, Environment, Floor, Camera, SceneMeta) into the engine.

**Context providers (all established by `EngineProvider`):**
- `EngineStateContext` — `EngineFrameState` updated on every animation frame. Consumed by hooks.
- `VariableStoreContext` — stable `VariableStore` reference. Never recreated.
- `LabelPositionerContext` — stable `LabelPositioner` instance.
- `EngineContext` — stable `RuntimeDriver` instance after initialization.

**Consumer hooks:**
- `useSceneEngine()` — access the `RuntimeDriver` and current `EngineState`.
- `useEngineScroll()` — subscribe to scroll-based progress.
- `useEngineInput(spec)` — return a ref for an input region that feeds the engine.
- `useEngineScrubber()` — read and control progress directly.
- `useSceneProgress()` — read current scene-local progress [0, 1].
- `useCurrentScene()` — read current scene id and index.

**Key types from `player/engineTypes.ts`:**
```typescript
type EngineFrameState = {
  tickIndex: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
  tick: SceneTrackTick | null;
};

type EngineState = {
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
};
```

### 3.2 Runtime (`runtime/`)

The generic, widget-based execution coordinator. Has no Three.js, no React, no side effects. Knows nothing about models, cameras, or Three.js objects. Knows only about `IWidget` instances and `SceneTrackTick` data.

**`RuntimeDriverImpl`** — the primary implementation of `RuntimeDriver`. Responsibilities:
1. Holds the `WidgetRegistry` and queries it for `IRenderable` and `ILoadable` widgets.
2. Waits for all `ILoadable.load()` promises to resolve before setting `assetsReady = true`.
3. On each `tick()` call: samples the `SceneTrack` by progress → `SceneTrackTick`, dispatches the tick's `state.widgets` entries to each `IRenderable` widget via `apply()`, calls `IAnimationController` widgets in `tickPriority` order, and calls `IVariableProvider` widgets to publish to the `VariableStore`.
4. For ticks within a `FunctionalTransitionSpec` block: evaluates `FunctionalWidgetTransition.fn(tick.blockProgress)` to get the widget state, then dispatches it.
5. Maintains `getBoneWorldPositions()` by aggregating world-space positions reported by `IRenderable` widgets each frame.
6. Maintains `getTargetColors()` for label color inheritance.

**`RuntimeLoop`** — owns `requestAnimationFrame`. Calls `RuntimeDriverImpl.tick()` each frame with `deltaSeconds` and `globalProgress`. Can be paused, resumed, and disposed. Designed to be replaceable in tests with the mock loop from `runtime/mocks/`.

**`runtime/types.ts`** — the `RuntimeDriver` interface contract:
```typescript
type RuntimeDriver = {
  assetsReady: boolean;
  setAssetsReady(ready: boolean): void;
  setSceneTrack(track: SceneTrack): void;
  tick(options: { deltaSeconds: number; globalProgress: number; wallTimeSeconds?: number }): void;
  getBoneWorldPositions(): Map<string, [number, number, number]>;
  getTargetColors(): Map<string, string>;
  getCurrentTick(): SceneTrackTick | null;
  getWallTimeSeconds(): number;
  dispose(): void;
};
```

Also defined in `runtime/types.ts`: `Vec3`, `Node`, `PoseSnapshot`, `PoseSnapshotMap`, `AnimationTrack`.

**`runtime/mocks/`** — interface-conforming test doubles. Used in unit tests for layers that depend on `RuntimeDriver`. These are full behavioral implementations with controllable state, not jest spies.

### 3.3 Compiler (`compiler/`)

The pure compilation pipeline. No Three.js. No React. No side effects. No I/O.

Input: scene DSL (JSX evaluated once) as an array of `SceneFrame` snapshots.
Output: `SceneTrack` — a flat pre-baked array of `SceneTrackTick` values indexed for O(1) sampling.

**`compiler/index.ts`** — exports **only** the DSL authoring surface:
```typescript
export { Scene, SceneGroup } from './blocks/sceneDsl';
export { Hud, HudItem } from './blocks/hudBlocks';
export { InputController, Action } from './blocks/inputController';
// Primitive element DSL components (Background, Camera, Environment, Floor, Lighting)
// are exported directly from @brewsite/core — the compiler/primitives/ barrel was removed.
```

Infrastructure types (`SceneTrack`, `compileSceneTrack`, `sceneTrackCache`, etc.) are **not** re-exported through `compiler/index.ts`. They are imported directly from their source files by the player layer:
```typescript
// In player/: direct imports, not through compiler/index.ts
import { compileSceneTrack } from '../compiler/sceneTrackCompiler';
import type { SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';
import { getSceneTrackCache, setSceneTrackCache } from '../compiler/sceneTrackCache';
```

**Compiler sub-directories:**
- `blocks/` — DSL block components: `hudBlocks.tsx` (Hud, HudItem), `inputController.tsx` (InputController, Action), `sceneDsl.tsx` (Scene, SceneGroup).
- `transitions/` — Transition type system: `transitionTypes.ts` defines `ElementTransitionSpec<T>`, `FunctionalTransitionSpec<T>`, `isFunctionalSpec()`, and the full set of blend/math utilities.
- `primitives/` — Contains only `progressManager.ts`. The `compiler/primitives/` barrel (`primitives/index.ts`) has been removed; element DSL components are exported directly from `@brewsite/core`.
- `registry.ts` — The global node handler registry (`registerNode`, `getNodeHandler`, `isPrimitiveComponent`, `clearRegistry`).
- `sceneTrackTypes.ts` — Core data contracts: `SceneFrame`, `SceneFrameDelta`, `SceneTrackTick`, `SceneTrack`, `SceneWindow`, `FunctionalWidgetTransition`, `SceneTrackTransitionBlock`.
- `sceneTrackCompiler.ts` — The main `compileSceneTrack()` function. Seven-step algorithm described in Section 5.
- `sceneTrackSampler.ts` — O(1) `SceneTrackSampler.sample(progress)` implementation.
- `sceneTrackCache.ts` — Optional compile-time cache for `SceneTrack` keyed by a scene hash.
- `hudCompiler.ts` — Compiles `HudItemDefinition` arrays into `HudItemResolved` arrays per tick.
- `labelCompiler.ts` — Compiles `LabelResolved` arrays per tick.
- `sceneTypes.ts` — Shared scene DSL type definitions.
- `sceneDslTypes.ts` — `NodeHandler` type and related DSL infrastructure types.

### 3.4 Elements (`elements/`)

Core renderable element modules. Each element is a self-contained module that can be used, tested, and maintained independently.

**Built-in elements:**
- `model/` — GLTF model loading, animation clip playback, position/rotation/opacity control, contained sub-models.
- `camera/` — Camera state, four positioning modes (world, orbit, fitBotHeight, fitFloorDepth), trackpad/mouse orbit controls.
- `background/` — Scene background color or gradient.
- `lighting/` — Ambient, directional, and point light configuration.
- `floor/` — Reflective floor plane with opacity and blur.
- `environment/` — HDR environment map.

**Mandatory module pattern.** Every element directory must contain exactly these files in this dependency order:

```
types.ts
  ↓
dsl.tsx
  ↓
compile.ts
  ↓
render.ts
  ↓
{Name}Widget.ts
  ↓
index.ts
```

**`types.ts`** — Interface contracts only. No runtime imports, no Three.js, no React. Defines the state shape that flows through the compile/playback pipeline (e.g., `CameraState`, `ModelState`, `LightingState`).

**`dsl.tsx`** — React DSL components. No Three.js. The JSX components that authors write in scene definitions (e.g., `<Camera mode="orbit" radius={5} />`). These are thin wrappers — they exist only to be evaluated by the compiler's JSX handler. They produce no React output.

**`compile.ts`** — Pure transformation functions. No React, no Three.js. Contains functions that transform DSL props into the element's `types.ts` state shape. Called by the node handler registered in the compiler registry. May also export an `ElementTransitionSpec<T>` or `FunctionalTransitionSpec<T>` for the compiler to call during track baking.

**`render.ts`** — Three.js application layer. No React, no compiler imports. Contains the Three.js mutation logic that applies a compiled state object to the live Three.js scene. This is the only file in the element module that may import from `three`.

**`{Name}Widget.ts`** — Implements `IWidget` and the relevant sub-interfaces. Bridges the compiler state (from `compile.ts` output) to the render layer (from `render.ts`). Owns the widget's `ILoadable.load()` call if the element requires async asset loading. Calls `render.ts` functions from `IRenderable.apply()`.

**`index.ts`** — Public re-exports only. Defines the element's public API surface. May re-export DSL components, widget class, state types, and compile utilities. Must not re-export internal render utilities.

### 3.5 Widget SDK (`widget/`)

The plugin system for extending the runtime with new renderable and behavioral concepts.

**`WidgetRegistry`** — Two internal registries:
1. Instance registry: maps `widgetId` string → `IWidget` instance. Used for singleton widgets.
2. Type-factory registry: maps DSL component function → `(props) => IWidget` factory. Used for multi-instance widgets like models where each DSL node creates a distinct widget instance.

```typescript
class WidgetRegistry {
  register(widget: IWidget): this;
  registerTypeFactory(
    component: unknown,
    factory: (props: Record<string, unknown>) => IWidget
  ): this;
  getWidget(id: string): IWidget | undefined;
  getFactory(component: unknown): ((props: Record<string, unknown>) => IWidget) | undefined;
  getAllWidgets(): IWidget[];
}
```

**`VariableStore`** — Reactive key-value store with `JsonPrimitive` values (`string | number | boolean | null`). Synchronous get/set. Subscription model for React integration via `useVariable`.

```typescript
type JsonPrimitive = string | number | boolean | null;

class VariableStore {
  set(key: string, value: JsonPrimitive): void;
  get(key: string): JsonPrimitive | undefined;
  subscribe(key: string, listener: (value: JsonPrimitive | undefined) => void): () => void;
}
```

**`useVariable<T>(store, key)`** — React hook. Subscribes to a `VariableStore` key and returns the current value. Re-renders the component when the value changes. Returns `undefined` if the key has no value.

**Type guards** — exported from `widget/index.ts`:
```typescript
function isSceneElement(w: IWidget): w is ISceneElement
function isRenderable(w: IWidget): w is IRenderable
function isLoadable(w: IWidget): w is ILoadable
function isContainedModel(w: IWidget): w is IContainedModel
function isDslComposite(w: IWidget): w is IDslComposite
function isAnimationController(w: IWidget): w is IAnimationController
function isVariableProvider(w: IWidget): w is IVariableProvider
```

**Context types** — the argument types passed to widget lifecycle methods:

```typescript
type WidgetInitContext = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  variableStore: VariableStore;
};

type WidgetRenderContext = {
  tick: SceneTrackTick;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  variableStore: VariableStore;
  deltaSeconds: number;
  wallTimeSeconds: number;
};

type CompileExtraContext = {
  ticks: SceneTrackTick[];
  scenes: SceneFrame[];
  timeline: SceneTimeline;
};

type AnimationTickContext = {
  deltaSeconds: number;
  wallTimeSeconds: number;
  currentTick: SceneTrackTick | null;
};
```

### 3.6 HUD (`hud/`)

The heads-up display overlay system. Renders React content synchronized to scene progress over the Three.js canvas.

**`hud/types.ts`** — Type definitions:
- `HudItemDefinition` — the authored form, declared in scene DSL inside `<Hud>/<HudItem>`.
- `HudItemResolved` — the compiled form, stored in `SceneTrackTick.hudPrimitives`. Contains resolved CSS, content, and visibility state.
- `HudPhaseContext` — React context providing the current HUD phase to child components.

**`hudCompiler.ts`** — Pure compilation function. Called once per scene during track baking. Transforms `HudItemDefinition[]` into `HudItemResolved[]` for each tick. No Three.js or React.

**`HudOverlay`** — React component rendered in the `EngineOverlayHost` overlay tier. Reads `hudPrimitives` from the current `EngineFrameState` tick and renders each `HudItemResolved` as a positioned React element with CSS-based styling and animation.

**`hud/animejs/`** — Removed. The `Fade`, `MidFade`, `SlideUp`, `SlideDown`, `ScrollOn`, `ScrollOff` preset components and `useScrollTimeline` have been removed from `@brewsite/core`. They are available as copy-paste recipes in `apps/examples/`. The `animejs` package is no longer a production dependency of `@brewsite/core`.

### 3.7 Labels (`labels/`)

The 3D-tracked label system. Renders React label components positioned at 3D world-space coordinates in the Three.js scene.

**`labels/types.ts`** — `LabelResolved` type:
```typescript
type LabelResolved = {
  id: string;
  target: string;            // bone or node name to track
  text?: string;
  css?: Record<string, string | number>;
  offsetPx?: [number, number];
  colorFromTarget?: boolean;
};
```

**`labelCompiler.ts`** — Pure compilation function. Compiles label definitions into `LabelResolved[]` per tick. No Three.js or React.

**`LabelPositioner`** — React component in the player layer. Each animation frame:
1. Reads `labelPrimitives` from the current tick.
2. Calls `RuntimeDriver.getBoneWorldPositions()` to get Three.js object positions keyed by target name.
3. Projects each world position through `camera.projectionMatrix × camera.matrixWorldInverse`.
4. Updates `<LabelItem>` DOM nodes to the resulting CSS pixel coordinates.

**`LabelItem`** — React component. Renders a single label with CSS positioning. Accepts `LabelResolved` data plus a computed `{ x, y }` screen coordinate.

### 3.8 Input (`input/`)

Scene navigation and action-based input controllers.

**`InputController` (exported as `SceneNavInputController`)** — Maps scroll, drag, swipe, wheel, and keyboard input to scene navigation progress. Configures via `SceneInputControllerSpec`:

```typescript
type SceneInputControllerSpec = {
  mode: 'scroll' | 'direct';
  scope?: InputControllerScope;   // 'window' | 'element'
  inputMap?: SceneNavInputMap;
};

type SceneNavInputMap = {
  wheel?: WheelConfig;
  drag?: DragConfig;
  swipe?: SwipeConfig;
  click?: ClickConfig;
  key?: SceneNavKeys;
};
```

**`ActionInputController`** — Maps pointer and wheel input to named actions. Used for camera orbit, dolly, pan, and custom canvas interactions. The `InputController` DSL component and its `Action` children define the action-to-input mapping per scene:

```typescript
type InputActionSpec = {
  name: string;
  type: InputActionType;  // 'orbit' | 'dolly' | 'pan' | 'reset' | 'focus' | string
};

type InputActionMap = Record<string, InputPointerMap | InputWheelMap | InputPinchMap | InputKeyMap>;
```

**`input/types.ts`** — All input type definitions. Exported from `input/index.ts`.

### 3.9 Timeline (`timeline/`)

Timeline algebra: the math for converting a scene list into a tick index space.

**`SceneTimeline`** type:
```typescript
type SceneTimeline = {
  stops: ReadonlyArray<{ id: string }>;
  sceneCount: number;
  framesPerScene: number;
  subTicksPerSegment: number;
  oversamplingRate: number;
  tickStep: number;
  subTickCount: number;
  tick(index: number): number;
  mapToSceneProgress(progress: number): number;
  snapToTick(progress: number): number;
};
```

**`createSceneTimeline(scenes, options?)`** — Primary factory. Defaults: `framesPerScene = 30`, `oversamplingRate = 10`. Total tick count formula:
```
subTickCount = (sceneCount - 1) * subTicksPerSegment * oversamplingRate + 1
```

**`createQualityTimeline(base, subTicksPerSegment)`** — Quality variant factory. Produces a new `SceneTimeline` from the base configuration with a different `subTicksPerSegment`. Used by the quality tiering system to produce low/high resolution compilations.

### 3.10 Math (`math/`)

Pure math utilities. No Three.js, no React, no side effects. Used by compile-time and runtime-level code alike.

**`math/index.ts`** exports:
```typescript
type Vec3 = [number, number, number];
type Mat4 = [/* 16 numbers */];
type Quaternion = { x: number; y: number; z: number; w: number };

function clamp01(value: number): number;
function lerp(a: number, b: number, t: number): number;
function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3;
function quatFromEuler(rotation: Vec3): Quaternion;
function quatNormalize(q: Quaternion): Quaternion;
function quatSlerp(a: Quaternion, b: Quaternion, t: number): Quaternion;
function quatMultiply(a: Quaternion, b: Quaternion): Quaternion;
function quatToEuler(q: Quaternion): Vec3;
function composeMatrix(position: Vec3, rotation: Vec3, scale: Vec3): Mat4;
function multiplyMatrices(a: Mat4, b: Mat4): Mat4;
function decomposeMatrix(matrix: Mat4): { position: Vec3; rotation: Vec3; scale: Vec3 };
function copyVec3(value: Vec3): Vec3;
```

**`math/pose.ts`** — Pose utilities for working with `Node` scene graph objects: computing world-space positions, applying pose snapshots, and diffing pose maps.

---

## 4. Key Data Types

All type definitions below are taken directly from `packages/core/src/compiler/sceneTrackTypes.ts` and related source files.

### 4.1 SceneFrame

The declared state of a scene at a single point in time. Produced by the DSL compiler. Consumed by the track compiler to bake `SceneTrackTick[]`.

```typescript
type SceneFrame = {
  id: string;
  scrollProgress: number;
  widgets: Record<string, unknown>;         // widgetId → compiled widget state
  meta?: Record<string, JsonPrimitive>;
  materialMetalnessMultiplier?: number;
  materialRoughnessMultiplier?: number;
  hudItems?: HudItemDefinition[];           // HUD items declared for this scene
  labels?: LabelResolved[];                 // Label definitions for this scene
};
```

Each entry in `widgets` is typed as `unknown` at the frame level because each widget owns the shape of its own state. The `IRenderable.apply(state, context)` method receives the specific widget's state cast appropriately.

### 4.2 SceneFrameDelta

A sparse diff between two `SceneFrame` states. Fields are only present when the value changed between the previous tick and this one. Used by `EngineProvider` to skip unnecessary React re-renders.

```typescript
type SceneFrameDelta = {
  widgets?: Record<string, unknown>;
  hudItems?: HudItemDefinition[];
  labels?: SceneFrame['labels'];
};
```

### 4.3 SceneWindow

A progress range corresponding to one scene. The `sceneWindows` array on `SceneTrack` maps scene IDs to their [start, end] progress intervals.

```typescript
type SceneWindow = {
  id: string;
  index: number;
  start: number;
  end: number;
};
```

### 4.4 FunctionalWidgetTransition

A compiled functional transition closure for one widget in one transition block. Produced by the compiler from a `FunctionalTransitionSpec`. Stored in `SceneTrack.transitionBlocks` and evaluated by `RuntimeDriverImpl` at tick.blockProgress each frame.

```typescript
type FunctionalWidgetTransition = {
  /**
   * Evaluate this widget's state at blockProgress ∈ [0, 1].
   * Half-block remapping for exit/enter is already baked into this closure.
   */
  fn: (blockProgress: number) => unknown;
  /** Identifies which transition scenario produced this closure. */
  kind: 'exit' | 'enter' | 'interpolate';
};
```

### 4.5 SceneTrackTransitionBlock

Functional transition overrides for one scene-to-scene transition block. Block index N corresponds to the transition from `scenes[N]` to `scenes[N+1]`.

```typescript
type SceneTrackTransitionBlock = {
  blockIndex: number;
  widgetFns: Record<string, FunctionalWidgetTransition>;
};
```

### 4.6 SceneTrackTick

A single pre-baked frame in the scene track. The atomic unit of playback. Indexed for O(1) sampling by progress.

```typescript
type SceneTrackTick = {
  index: number;
  progress: number;         // [0, 1] global progress
  sceneId: string;
  sceneIndex: number;
  blockProgress: number;    // [0, 1] progress within the current transition block
  state: SceneFrame;        // fully resolved widget states for this tick
  hudPrimitives?: HudItemResolved[];   // resolved HUD items for this tick
  labelPrimitives?: LabelResolved[];   // resolved labels for this tick
  deltaForward: SceneFrameDelta;       // diff from previous tick
  deltaBackward: SceneFrameDelta;      // diff from next tick
  widgetExtras?: Record<string, unknown>;  // per-widget compiled extras (e.g., clip metadata)
};
```

`blockProgress` is the coordinate passed to `FunctionalWidgetTransition.fn()`. For ticks outside transition blocks (steady-state), `blockProgress` is `0` (start of scene) or `1` (end of scene).

### 4.7 SceneTrack

The compiled output of the entire scene definition. A flat array of `SceneTrackTick` with metadata for O(1) sampling.

```typescript
type SceneTrack = {
  ticks: SceneTrackTick[];
  tickStep: number;          // 1 / (totalTicks - 1) — progress increment per tick
  subTickCount: number;      // total tick count
  sceneWindows: SceneWindow[];
  /**
   * Present only when at least one widget uses FunctionalTransitionSpec.
   * Length ≤ numScenes - 1 (one entry per transition block that has functional closures).
   */
  transitionBlocks?: SceneTrackTransitionBlock[];
};
```

Sampling by progress is: `ticks[Math.min(Math.round(progress / tickStep), ticks.length - 1)]`.

---

## 5. Compiler Architecture

The compiler runs once at scene load time (or build time with caching) and produces the `SceneTrack`. It is a pure multi-pass algorithm with no side effects.

### 5.1 Step 1: Evaluate DSL to SceneFrame[]

Each scene's JSX is evaluated once. The JSX evaluation traverses the React element tree, calling the compiler registry's `getNodeHandler()` for each recognized DSL component. Each handler transforms JSX props into a widget state entry and writes it into a `SceneFrame.widgets` record. HUD blocks and label blocks are compiled to their respective collections.

The result is a `SceneFrame[]` — one `SceneFrame` per scene, representing the declared state at that scene stop.

### 5.2 Step 2: Allocate Tick Array

The timeline determines the total tick count:
```
totalTicks = (numScenes - 1) * subTicksPerSegment * oversamplingRate + 1
```
A flat `SceneTrackTick[]` array of this size is allocated. Each tick is pre-populated with its `index`, `progress`, `sceneId`, and `sceneIndex`.

### 5.3 Step 3: Fill Transition Blocks via Widget Batch Methods

For each pair of adjacent scenes (block index N → scene N+1), the compiler iterates over the union of widget IDs present in either scene and calls one of three dispatch paths:

**Path A — ElementTransitionSpec (batch-fill discrete):**
The widget fills its own frame slots by writing `frames[i].state.widgets[widgetId]` for every frame in the transition block. The compiler passes a slice of the tick array:
- `exit()` — widget present in scene N, absent in scene N+1. Receives the first half of the block.
- `enter()` — widget absent from scene N, present in scene N+1. Receives the second half of the block.
- `interpolate()` — widget present in both scenes. Receives the full block.

**Path B — FunctionalTransitionSpec (closure capture):**
The compiler calls `exitFn(fromState)`, `enterFn(toState)`, or `interpolateFn(fromState, toState)` once, capturing endpoint state into closures. The returned `(t: number) => T` functions are wrapped with half-block remapping and stored in `SceneTrack.transitionBlocks[N].widgetFns`.

Path B is selected when `isFunctionalSpec(spec)` returns `true` — i.e., when the spec has `interpolateFn` rather than `interpolate`.

**Path C — No transition spec:**
Widget snaps between states at the midpoint of the transition block. Frames before the midpoint use the `fromState`; frames from the midpoint use `toState`.

### 5.4 Step 4: Fill Terminal Frame

The final tick (`index = totalTicks - 1`, `progress = 1.0`) is filled with the last scene's fully resolved states. This ensures the animation can reach its final scene without floating-point sampling error.

### 5.5 Step 5: Run compileExtra()

Each `ISceneElement` widget that implements `compileExtra(context: CompileExtraContext)` is called once. This pass allows widgets to write into `SceneTrackTick.widgetExtras` — for example, `ModelWidget` bakes animation clip metadata (durations, start/end times) into `widgetExtras` so the runtime has this data available at tick time without recomputing it.

### 5.6 Step 6: Compile HUD and Labels Per Tick

`hudCompiler.ts` and `labelCompiler.ts` are called once per tick to resolve their respective definitions into `hudPrimitives` and `labelPrimitives` arrays. The compilation resolves any progress-gated visibility, merges theme styles, and produces the final resolved form consumed by the React overlay.

### 5.7 Step 7: Compute Forward and Backward Deltas

For each tick, the compiler computes `deltaForward` (diff from the previous tick) and `deltaBackward` (diff from the next tick). Deltas are sparse: only widget IDs whose state changed from one tick to the next appear in the delta. These deltas allow `EngineProvider` to skip `IRenderable.apply()` calls for widgets that did not change, and to skip React re-renders for HUD items that did not change.

---

## 6. Transition Spec Types

### 6.1 ElementTransitionSpec (Discrete Batch-Fill)

```typescript
type ElementTransitionSpec<T> = {
  /**
   * Widget is leaving (present in scene N, absent from scene N+1).
   * frames is the first half of the transition block.
   * Write frames[i].state.widgets[widgetId] for every i.
   * Use transitionT(i, frames.length) for normalized 0→1 progress.
   */
  exit(frames: SceneTrackTick[], widgetId: string, fromState: T): void;

  /**
   * Widget is arriving (absent from scene N, present in scene N+1).
   * frames is the second half of the transition block.
   * Write frames[i].state.widgets[widgetId] for every i.
   */
  enter(frames: SceneTrackTick[], widgetId: string, toState: T): void;

  /**
   * Widget present in both scenes.
   * frames is the full transition block.
   * Write frames[i].state.widgets[widgetId] for every i.
   */
  interpolate(frames: SceneTrackTick[], widgetId: string, fromState: T, toState: T): void;
};
```

The helper `transitionT(i, len)` computes the normalized progress scalar for frame `i` within a slice of length `len`:
```typescript
const transitionT = (i: number, len: number): number => (len > 1 ? i / (len - 1) : 1);
```

### 6.2 FunctionalTransitionSpec (Closure-Based)

```typescript
type FunctionalTransitionSpec<T> = {
  /**
   * Called once with fromState at compile time.
   * Returns a pure function: t ∈ [0, 1] → T.
   * Active over first half of block (blockProgress ∈ [0, 0.5)).
   * t = 0: widget at fromState. t = 1: widget fully absent.
   */
  exitFn(fromState: T): (t: number) => T;

  /**
   * Called once with toState at compile time.
   * Returns a pure function: t ∈ [0, 1] → T.
   * Active over second half of block (blockProgress ∈ [0.5, 1]).
   * t = 0: widget fully absent. t = 1: widget at toState.
   */
  enterFn(toState: T): (t: number) => T;

  /**
   * Called once with (fromState, toState) at compile time.
   * Returns a pure function: t ∈ [0, 1] → T.
   * Active over full block (blockProgress ∈ [0, 1]).
   * t = 0: widget at fromState. t = 1: widget at toState.
   */
  interpolateFn(fromState: T, toState: T): (t: number) => T;
};
```

The type guard `isFunctionalSpec<T>(spec)` selects the dispatch path at compile time:
```typescript
const isFunctionalSpec = <T>(
  spec: ElementTransitionSpec<T> | FunctionalTransitionSpec<T>,
): spec is FunctionalTransitionSpec<T> => 'interpolateFn' in spec;
```

The key behavioral difference between the two specs:
- `ElementTransitionSpec` fills frame slots at compile time. The runtime simply reads the pre-computed value from `tick.state.widgets[id]` with no additional computation per frame.
- `FunctionalTransitionSpec` captures closures at compile time. The runtime evaluates `fn(tick.blockProgress)` once per frame for widgets in a functional transition block. This is slightly more CPU work per frame but produces continuous smooth curves without requiring a large tick array.

---

## 7. Runtime Data Flow

The complete lifecycle from compile output to Three.js draw call:

```
Scene DSL (JSX)
  ↓ compileSceneTrack()
SceneTrack (flat pre-baked array)
  ↓ SceneTrackSampler.sample(globalProgress)
SceneTrackTick (O(1) index lookup)
  ↓ RuntimeDriverImpl.tick()
  │
  ├── For each IRenderable widget where state changed (deltaForward/deltaBackward):
  │     widget.apply(tick.state.widgets[id], context)
  │       ↓ render.ts functions
  │     Three.js object mutations (position, material, visibility, etc.)
  │
  ├── For each widget in SceneTrack.transitionBlocks[blockIndex]:
  │     state = transitionBlock.widgetFns[id].fn(tick.blockProgress)
  │     widget.apply(state, context)
  │
  ├── For each IAnimationController widget (sorted by tickPriority):
  │     widget.tick(animContext)
  │       ↓ advances Three.js AnimationMixer
  │
  └── For each IVariableProvider widget:
        widget.publishVariables(store, context)
          ↓ store.set(key, value)
        → triggers useVariable() re-renders in React overlay
  ↓
THREE.WebGLRenderer.render(scene, camera)
  ↓
canvas frame
```

The React overlay layer runs in parallel (same frame, via React's `useLayoutEffect` / `useEffect` for label positioning):

```
SceneTrackTick
  ↓ tick.hudPrimitives
HudOverlay (React) renders resolved HUD items with CSS animation
  ↓ tick.labelPrimitives + RuntimeDriver.getBoneWorldPositions()
LabelPositioner projects 3D coordinates → CSS pixel positions
  ↓ updates LabelItem DOM nodes
```

---

## 8. Compiler Registry

The compiler uses a global node handler registry to route DSL JSX nodes to their compilation handlers.

**`compiler/registry.ts`** manages two maps:
1. `nodeRegistry: Map<unknown, NodeHandler>` — keyed by the component function reference.
2. `nodeRegistryByName: Map<string, NodeHandler>` — keyed by `component.displayName ?? component.name`. This fallback enables registry lookups after module bundler mangling.

```typescript
function registerNode(component: unknown, handler: NodeHandler): void;
function getNodeHandler(component: unknown): NodeHandler | undefined;
function isPrimitiveComponent(component: unknown): boolean;
function clearRegistry(): void;  // test utility
```

Each element's `compile.ts` calls `registerNode()` with its DSL component function and a handler:

```typescript
type NodeHandler = (props: Record<string, unknown>, children: unknown[]) => Partial<SceneFrame>;
```

The compiler evaluates a scene by traversing the JSX tree and calling `getNodeHandler(element.type)` for each node. If a handler is found, it is called with the element's props and children, and the result is merged into the current `SceneFrame`. Unrecognized nodes are ignored (they may be React layout components or custom consumer components).

---

## 9. Entry Transitions Rule

Entry transitions belong to the **incoming** scene, not the outgoing one.

When the compiler processes the transition block between scenes N and N+1, the transition behavior (easing, duration within the block, animation style) is determined by the widget registration of the element as it appears in scene N+1. If the element declares a custom `ElementTransitionSpec` or `FunctionalTransitionSpec`, that spec governs the entire block including the exit of scene N.

This rule ensures consistent mental model: to change how a scene animates in, the author edits the incoming scene's element declarations.

Corollary: there is no "outgoing scene transition" concept. A scene controls its entry animation; it does not control how it is animated out.

---

## 10. SSR Safety Contract

All code in `@brewsite/core` satisfies the following invariants:

1. **No top-level browser global access.** No module-level access to `window`, `document`, `navigator`, `performance`, or `requestAnimationFrame`. All browser-dependent code is inside function bodies, component mount callbacks, or `useEffect`/`useLayoutEffect`.

2. **Three.js instantiation is deferred to mount.** `WebGLRenderer`, `Scene`, `PerspectiveCamera`, and all Three.js instances are created in `EngineFrameDriver` mount lifecycle, never at module import time.

3. **EngineProvider renders safely on the server.** The component defers all WebGL initialization to client-side effects. `EngineGate` renders the `placeholder` prop (or null) until the engine's first client-side frame rather than attempting to create a WebGL context.

4. **Compiler is SSR-safe and build-time safe.** `compileSceneTrack()` is a pure function. It runs in Node.js, Vitest, or browser environments without modification.

5. **All hooks are no-ops during SSR.** `useEngineScroll`, `useEngineInput`, `useEngineScrubber`, and all other hooks return safe initial values during server rendering and initialize their listeners on client mount.

---

## 11. Testing Philosophy and Coverage

Tests live in `__tests__/` directories co-located with the code they test. Test files are named `*.test.ts` or `*.test.tsx`.

**Interface-based stateful testing.** Tests use real inputs and assert real outputs. They do not mock internal method calls. A test for the compiler calls `compileSceneTrack()` with a real DSL and asserts properties of the resulting `SceneTrack`. A test for `RuntimeDriverImpl` creates a real instance with a real `WidgetRegistry` populated with interface-conforming test doubles from `runtime/mocks/`.

**No mocking of internal calls.** If a module is hard to test without mocking its internals, that is a design signal: the module has too many dependencies and should be refactored.

**Runtime test doubles.** `runtime/mocks/widgetMocks.ts` provides widget test doubles that implement `IWidget` sub-interfaces with controllable state. These are not jest spies — they are real implementations that record calls and expose them for assertion.

**Coverage targets.** `vitest` coverage is configured to instrument:
```
packages/core/src/{compiler,elements,runtime,widget,player,hud,labels,input,timeline,math}/**/*.ts
packages/diagram/src/**/*.ts
```

Coverage excludes:
- `render.ts` files (require live WebGL context)
- Barrel `index.ts` exports (no logic to test)

Minimum coverage: 80% line coverage across all instrumented files.

---

## 12. Key Design Rules

These rules are non-negotiable. Any change that violates them requires a corresponding update to this document and explicit architectural sign-off.

1. **Three.js is confined to `render.ts` files.** No Three.js import appears anywhere else in the element module stack, runtime, compiler, or widget SDK.

2. **Scenes are purely declarative.** Scene definitions describe state only. No animation math, no Three.js, no frame logic, no conditional behavior based on runtime state.

3. **`compiler/index.ts` exports only DSL authoring surface.** Infrastructure types (`SceneTrack`, `compileSceneTrack`, cache utilities) are imported directly from their source files, not re-exported through the compiler index.

4. **`@brewsite/diagram` may import from `@brewsite/core`, never vice versa.** This is a hard dependency direction constraint. `@brewsite/core` must remain publishable and usable without `@brewsite/diagram`.

5. **Widget classes are the runtime integration contract.** New renderable or behavioral concepts are added by implementing `IWidget` (and relevant sub-interfaces) and registering with `WidgetRegistry`. The runtime and compiler are not modified to accommodate new concepts.

6. **Entry transitions belong to the incoming scene.** Transition behavior for a scene-to-scene boundary is determined by the incoming scene's widget declarations.

7. **Lower layers never import from higher layers.** `math/` does not import from `compiler/`. `compiler/` does not import from `runtime/`. `elements/` does not import from `player/`.

8. **The mandatory element module pattern is not optional.** Every new element module must contain `types.ts → dsl.tsx → compile.ts → render.ts → {Name}Widget.ts → index.ts` in that dependency order. Files that don't fit this pattern belong in a shared utility layer, not in an element module.

9. **No new peer dependencies without justification.** React, react-dom, and Three.js are the established peers. Adding a new peer imposes a constraint on every consumer of the package. Any proposed new peer dependency requires explicit evaluation of its bundle impact, version range constraint, and alternative approaches.

10. **Test render.ts by integration, not by unit test.** `render.ts` files are excluded from coverage requirements because they require a live WebGL context. Integration testing of rendering behavior happens in the `apps/examples/` app via visual inspection, not in the automated test suite.
