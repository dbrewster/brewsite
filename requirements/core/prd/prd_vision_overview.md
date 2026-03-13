---
title: "BrewSite Core — Vision & Overview"
doc_type: prd
owner: brewsite-product-manager
status: active
updated: 2026-03-13
change_history:
  - date: 2026-02-28
    author: brewsite-product-manager
    summary: "Comprehensive rewrite replacing outdated BrewFlow-era vision document. Updated product name to BrewSite, corrected all API surface details against actual source, expanded Widget SDK section, added SSR safety contract, aligned all type references with live codebase."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Full PRD rewrite to match v2 codebase. ScenePlayer replaced by SceneEngine + composable primitives (ScrollStage, SceneCanvas, EngineOverlayHost, EngineARContainer, BackgroundLayer, SceneReel). HUD system removed entirely. Labels and Model element moved to @brewsite/model. createDefaultWidgetRegistry replaced by plugin system (corePlugin + modelPlugin). useEngineInput/useEngineScroll deleted; replaced by composable input components (ActionInput, KeyboardInput, TimeInput, ControlledInput). Widget SDK expanded with IContainedRenderable, IAttachmentHost, IRenderContributor, ISceneLifecycle, ICameraFocusTarget, ILightingOverride, IInputDefaultProvider, IExtraRenderPass. NVS coordinate system and layout module added. TextBox overlay element added. SpotlightRig element added. Camera gains nvsViewport mode. Lighting expanded with GlowPoint, LightStrand, Wave, Circle, Rectangle types. Package dependency table expanded to four published packages."
---

# BrewSite Core — Vision & Overview

---

## 1. Product Overview

`@brewsite/core` is a TypeScript + React + Three.js framework for authoring and playing back animated 3D marketing scenes. It is a published open-source SDK designed for TypeScript developers building product demo sites, marketing landing pages, and interactive 3D presentations.

The package solves a specific and painful problem: creating scroll-driven or interaction-driven 3D animations in React that look polished and perform well is normally a multi-week engineering effort. Developers must coordinate Three.js render loops, React state, animation curves, camera behaviors, and scene sequencing — all while ensuring the result is performant, SSR-safe, and maintainable. `@brewsite/core` compresses that work into a declarative JSX authoring model and a pre-baked playback engine.

A consuming developer describes their scenes as pure JSX snapshots — what objects should look like at each scene stop — and the toolkit handles all transition math, interpolation, camera animation, input handling, and React/Three.js integration. The output is a `<SceneEngine>` context provider composed with layout primitives (`ScrollStage`, `SceneCanvas`, `EngineOverlayHost`) that runs the animation against user scroll, pointer interaction, or programmatic control.

The monorepo publishes four packages:

| Package | Role |
|---|---|
| `@brewsite/core` | Animation engine, compiler, widget SDK, player primitives |
| `@brewsite/diagram` | 3D diagram, image-panel, and screen elements |
| `@brewsite/model` | GLTF model loading, animation, and 3D-tracked label system |
| `@brewsite/charts` | 3D chart element library |

`@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts` may import from `@brewsite/core`. `@brewsite/core` must never import from any of them.

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

The compiler runs once at startup and produces a flat `SceneTrack` array. Each element in the array is a `SceneTrackTick`: a fully resolved frame with widget states baked in. The runtime samples the track by index using a single multiplication and floor operation — O(1) regardless of scene count or transition complexity.

This means the render loop is never doing curve evaluation, interpolation math, or conditional branching across scenes. It reads a tick. It dispatches state to widgets. It draws. Runtime performance is predictable and scales with scene count linearly only in compilation time, not in playback time.

### 2.3 Strict Layer Separation

Three.js is confined exclusively to `render.ts` files and widget implementation files. No Three.js import may appear in `types.ts`, `dsl.tsx`, or `compile.ts`. No React import may appear in `compile.ts` or `render.ts`. No side effects may appear in `types.ts`.

This boundary enforces testability: the compiler pipeline and widget state machine are fully testable without instantiating a WebGL context. It also means the toolkit can be compiled in environments where Three.js is not available (e.g., SSR environments at the module graph level) as long as Three.js `render.ts` files are not imported during server rendering.

### 2.4 Plugin-Based Widget Registration

Every renderable concept in the toolkit — cameras, lighting, backgrounds, floors, environment maps, spotlight rigs, text boxes — is a widget. The Widget SDK defines a set of interfaces (`IWidget`, `ISceneElement`, `IRenderable`, `ILoadable`, etc.) that widgets implement. The runtime does not know about specific elements — it knows about widgets. Adding a new renderable concept to the toolkit, or to a consuming application, requires no changes to the runtime: implement the interface, register the widget via a plugin.

Widget registration uses a plugin pattern. `corePlugin()` registers all built-in core widgets (Camera, Lighting, Background, Environment, Floor, SpotlightRig, TextBox, SceneMeta). `modelPlugin()` from `@brewsite/model` registers model and label widgets. `diagramPlugin()` from `@brewsite/diagram` registers diagram, image-panel, and screen widgets. `chartPlugin()` from `@brewsite/charts` registers chart widgets.

### 2.5 Interface-Based Testing

Tests assert observable behavior through public interfaces, not internal implementation. For runtime-level tests, the test suite uses interface-conforming doubles from `runtime/mocks/` rather than mocking internal method calls. Compiler-level tests use real DSL inputs and assert real `SceneFrame` or `SceneTrack` output.

`render.ts` files are excluded from coverage because they require a live WebGL context. Everything else — compiler, widget state machines, runtime logic, timeline math — is tested without Three.js.

### 2.6 SSR Safety Contract

`@brewsite/core` must be importable in a Node.js environment at the module level without crashing. All Three.js instantiation, all DOM access, all `window`/`document` references are deferred to component mount time or runtime initialization. The package makes no assumptions about browser globals at import time.

Consumers using frameworks like Next.js can import the package without `next/dynamic` guards. `EngineGate` renders the `placeholder` prop during SSR and until the engine's first tick completes. Client-side hydration completes the initialization.

---

## 3. Key Capabilities

### 3.1 Animated 3D Scenes

The core capability: animate cameras, lighting rigs, environment settings, and text overlays across multiple scene stops. Authors describe each scene as a JSX snapshot. The compiler interpolates between scenes using registered widget transition handlers. The player plays back against any scroll or input signal.

Built-in core elements:
- **Camera** — Perspective camera with five positioning modes: `world`, `orbit`, `fitBotHeight`, `fitFloorDepth`, and `nvsViewport`. Interactive trackpad orbit/dolly/pan controls.
- **Lighting** — Ambient, directional, point, spot, panel (RectAreaLight), glow point, and light strand lights with color, intensity, and position control.
- **Background** — Scene background via DOM element: solid colors, images, CSS gradients, CSS filters, overlay gradients, and backdrop-filter effects.
- **Environment** — HDR environment maps (HDRI, EXR, CubeTexture) for physically-based rendering.
- **Floor** — Reflective floor plane with physical and mirror modes, optional grid overlay.
- **SpotlightRig** — Themed spotlight arrays for dramatic scene lighting.
- **TextBox** — NVS-positioned HTML overlay content rendered by `EngineOverlayHost`.

Elements provided by companion packages:
- **Model** (`@brewsite/model`) — GLTF models with animation clip control, bone-tracked labels, part overrides.
- **Diagram** (`@brewsite/diagram`) — 3D diagram nodes, edges, groups, and interactive canvas.
- **Chart** (`@brewsite/charts`) — 3D bar, line, area, pie, donut, scatter, and waterfall charts.
- **ImagePanel, Screen** (`@brewsite/diagram`) — 3D image panels and screen elements.

### 3.2 Camera Modes

The camera element supports five positioning modes:

- `world` — Position and target as absolute world-space Vec3 coordinates. Maximum author control.
- `orbit` — Spherical coordinates (azimuth, polar, distance) around a target point. Natural for turntable and rotation animations.
- `fitBotHeight` — Auto-frame a specified model height. Useful for model showcase scenes.
- `fitFloorDepth` — Auto-frame a floor-level depth area. Legacy mode; prefer `world` for new scenes.
- `nvsViewport` — NVS-first camera for diagram/chart scenes. Declares `worldScale` and `zRange`; compiler derives camera position and FOV for near-orthographic appearance. Resolved to `world` at compile time.

### 3.3 Input and Navigation

Scene navigation is handled by composable input components rendered as children of `SceneEngine` or `SceneReel`:

- **ScrollStage** — Full-page scroll drives scene progress via native `window.scrollY`. Provides the sticky-canvas scroll layout pattern.
- **ActionInput** — Bridges compiled `<InputController>` DSL to the `ActionInputController` runtime. Handles pointer, wheel, pinch, and keyboard action dispatch.
- **KeyboardInput** — Focus management for keyboard navigation. Arrow keys advance/retreat scenes by default when no `<InputController>` is authored.
- **TimeInput** — Wall-clock auto-advance with configurable duration, looping, and pause-when-hidden.
- **ControlledInput** — External `value` prop drives progress directly for programmatic control.
- **useEngineScrubber** — Hook for imperative progress read/write.
- **useGoToScene** — Hook for programmatic scene navigation by id or index.

The `InputController` DSL component and its `Action` children define the action map for each scene. The `ActionInputController` routes pointer, wheel, pinch, and keyboard events to registered named-action handlers on widgets. Default keyboard navigation (`scene.next` on ArrowRight/ArrowDown, `scene.prev` on ArrowLeft/ArrowUp) is compiler-injected when no `<InputController>` is authored.

### 3.4 Overlay System

Scene overlay content is authored via the `<TextBox>` DSL element inside `<Scene>`. TextBox declares NVS-positioned HTML content that is rendered by `EngineOverlayHost` over the Three.js canvas. The `EngineARContainer` provides the aspect-ratio-locked spatial frame against which NVS coordinates resolve to pixel positions.

The previous HUD system (`<Hud>`, `<HudItem>`, `hudCompiler`, `HudOverlay`, `HudPhaseContext`, `hud/animejs/`) has been removed. See `prd_hud.md` for migration guidance.

### 3.5 3D-Tracked Labels

The labels system renders DOM text labels that track positions on 3D models. Labels are authored as children of `<Model>` elements in `@brewsite/model`, compiled to per-frame primitives, and positioned at runtime by `LabelPositioner` — which projects 3D world positions through the camera's projection matrix.

Labels, `LabelPositioner`, `LabelItem`, `LabelPositionerContext`, and all label types live in `@brewsite/model`, not `@brewsite/core`. See `requirements/model/prd/prd_model.md`.

### 3.6 Normalized Viewport Space (NVS)

The NVS coordinate system provides a resolution-independent positioning model for scene elements. NVS coordinates range from `[0, 0]` (top-left) to `[1, 1]` (bottom-right) of the viewport. The `layout/` module provides `NVSCoordService` which converts NVS positions to world-space coordinates at runtime using the active camera's projection.

Elements that declare NVS bounds (`x`, `y`, `w`, `h` props) implement `INVSBounded`. The `View` and `ViewLayout` DSL components provide spatial composition — stack and carousel layouts that partition the NVS viewport among child views.

### 3.7 Pre-Compiled Timeline Algebra

The `timeline/` module provides the algebra for converting a scene list into a tick index space. `ProgressManager` provides per-scene scroll-weight configuration for non-uniform scene durations.

### 3.8 Widget SDK and VariableStore

The Widget SDK (`widget/`) is the extension mechanism for all renderable and behavioral concepts. The `WidgetRegistry` routes DSL node types to widget instances. The `VariableStore` is a reactive key-value store for sharing state across widgets — a model widget can publish bone positions; a `TextBox` widget reads them for overlay positioning.

`CUSTOM_NODE_HANDLER` is a Symbol that a widget implements to register its own DSL node handler inline, enabling tight coupling between a widget and its DSL component without going through the global registry.

### 3.9 Cross-Package Theming

The `SceneTheme` token system provides unified visual styling across all four packages. Six theme families (`darkGlass`, `midnight`, `neonCyber`, `enterprise`, `lightCanvas`, `lightMinimal`) each have dark and light polarity variants. `SceneEngine` accepts a `sceneTheme` prop; `EngineOverlayHost` injects CSS custom properties and polarity classes on its container.

---

## 4. Published Package API

The following is the complete public surface of `@brewsite/core`. All symbols listed here are stable across patch and minor releases. Breaking changes require a major version bump.

### 4.1 React Components

```typescript
// Primary integration — pure context provider with zero DOM output
<SceneEngine id={string} plugins={WidgetPlugin[]} sceneTheme={SceneTheme}>
  <Scene key="intro">...</Scene>
  {/* Layout primitives, input components, canvas, overlays */}
</SceneEngine>

// Layout primitives
<EngineARContainer aspectRatio={number} scaleMode={ScaleMode} referenceWidth={number} />
<EngineGate placeholder={ReactNode} />
<ScrollStage scrollHeightMode="scene-count" pixelsPerScene={number} />
<SceneCanvas engineId={string} />
<BackgroundLayer style={CSSProperties} />
<EngineOverlayHost className={string} passthroughPointerEvents={boolean} />

// Convenience wrapper for embedded/inline animations
<SceneReel height={number} plugins={WidgetPlugin[]} />

// Input components
<ActionInput />
<KeyboardInput />
<TimeInput duration={number} loop pauseWhenHidden={{ y: number }} />
<ControlledInput value={number} />

// Dev tools
<TimelineWidget />
<CameraControlPanel />   // @brewsite/core/devtools subpath
<SceneInspector />        // @brewsite/core/devtools subpath
```

### 4.2 React Hooks

```typescript
// Access engine context
const engine = useSceneEngineContext(): UseSceneEngineResult

// Read engine state — from context (no args) or cross-tree by id
const state = useEngineState(): EngineStateSnapshot
const state = useEngineState(id: string): EngineStateSnapshot | null

// Read and control the scrubber progress
const { progress, setProgress } = useEngineScrubber(): UseEngineScrubberResult

// Read current [0, 1] progress within the current scene
const sceneProgress = useSceneProgress(): number

// Read the current scene id and index
const { id, index } = useCurrentScene(): { id: string; index: number }

// Programmatic scene navigation
const goToScene = useGoToScene(): (target: string | number) => void

// Subscribe to a VariableStore value by key
const value = useVariable<T>(key: string): T | undefined

// Native scroll source for ScrollStage
const scrollSource = useNativeScrollSource(): IScrollSource

// Read scene runtime state by engine id (cross-tree)
const runtimeState = useSceneRuntime(id: string): SceneRuntimeState | null
```

### 4.3 Widget SDK

```typescript
// Core interfaces
interface IWidget { readonly widgetId: string }
interface ISceneElement<TState, TExtra> extends IWidget { /* DSL compilation */ }
interface IRenderable<TState, TExtra> extends IWidget { /* Three.js state application */ }
interface ILoadable extends IWidget { load(manifest: AssetManifest): Promise<void> }
interface IDslComposite extends IWidget { [CUSTOM_NODE_HANDLER]: NodeHandler }
interface IAnimationController extends IWidget { onTick(ctx: AnimationTickContext): void; tickPriority: number }
interface ISceneLifecycle extends IWidget { onSceneEnter?(sceneId: string): void; onSceneExit?(sceneId: string): void }
interface IVariableProvider extends IWidget { variableNamespace: string; variableKeys: string[] }

// Extended interfaces
interface IContainedRenderable extends IWidget { anchorWidgetId: string; anchorKey: string; rootObject: THREE.Object3D }
interface IAttachmentHost extends IWidget { getAttachmentPoint(key: string): THREE.Object3D | undefined }
interface IRenderContributor extends IWidget { contributeRenderData(): RenderContribution }
interface IRendererLifecycle extends IWidget { onRendererCreated(renderer: THREE.WebGLRenderer): void }
interface IInputDefaultProvider extends IWidget { getDefaultInputActions(): InputActionSpec[] }
interface ICameraFocusTarget extends IWidget { requestFocus(target: Vec3, duration?: number): void }
interface ILightingOverride extends IWidget { getLightingOverride(): Partial<SceneLighting> | undefined }
interface IExtraRenderPass extends IWidget { renderPass(renderer: THREE.WebGLRenderer, w: number, h: number): void }

// Registry
class WidgetRegistry {
  register(widget: IWidget): this
  registerTypeFactory(component: unknown, factory: WidgetFactory): this
  getSceneElements(): ISceneElement[]
  getRenderables(): IRenderable[]
  getAnimationControllers(): IAnimationController[]
}

// Type guards for all interfaces
function isSceneElement(w: IWidget): w is ISceneElement
function isRenderable(w: IWidget): w is IRenderable
function isLoadable(w: IWidget): w is ILoadable
function isAnimationController(w: IWidget): w is IAnimationController
function isSceneLifecycle(w: IWidget): w is ISceneLifecycle
function isContainedRenderable(w: IWidget): w is IContainedRenderable
function isAttachmentHost(w: IWidget): w is IAttachmentHost
function isRenderContributor(w: IWidget): w is IRenderContributor
function isRendererLifecycle(w: IWidget): w is IRendererLifecycle
function isInputDefaultProvider(w: IWidget): w is IInputDefaultProvider
function isCameraFocusTarget(w: IWidget): w is ICameraFocusTarget
function isLightingOverride(w: IWidget): w is ILightingOverride
function isExtraRenderPass(w: IWidget): w is IExtraRenderPass

// Reactive cross-widget state
class VariableStore { set, get, subscribe }
function useVariable<T>(key: string): T | undefined

// Symbol for inline DSL handler registration
const CUSTOM_NODE_HANDLER: unique symbol

// Context types
interface WidgetRenderContext<TExtra> {
  clock: RealtimeClock
  effectiveDeltaSeconds: number
  globalProgress: number
  variables: VariableStore
  extra: TExtra
  tick: SceneTrackTick
  coords: NVSCoordService  // NVS → world coordinate conversion
}

interface AnimationTickContext {
  clock: RealtimeClock
  effectiveDeltaSeconds: number
  scene: THREE.Scene
  variables: VariableStore
  tick: SceneTrackTick
  track: SceneTrack
  resolvedState: Map<string, unknown>
  cameraFocusTarget: ICameraFocusTarget | undefined
  cameraOverride: CameraOverride | undefined
  setCameraOverride(override: CameraOverride | undefined): void
}
```

### 4.4 DSL Authoring Components

```typescript
// Scene container — declares one stop in the sequence
<Scene key={string} transition={SceneTransitionProp}>...</Scene>

// Core elements
<Camera descriptor={CameraPositionDescriptor} lens={CameraLens} post={CameraPost} interaction={TrackpadCameraConfig} />
<Lighting ambient={...} directional={...} points={...} spots={...} panels={...} />
<Background color={string} gradient={string} imageUrl={string} cssFilter={string} overlayGradient={string} theme={SceneTheme} />
<Environment preset={EnvironmentPreset} url={string} intensity={number} />
<Floor enabled={boolean} reflectivity={number} roughness={number} />
<SpotlightRig theme={SpotlightRigTheme}>
  <Spotlight position={Vec3} target={Vec3} intensity={number} />
</SpotlightRig>
<TextBox id={string} x={number} y={number} w={number} h={number}>
  {/* HTML overlay content */}
</TextBox>

// Input controller — defines action input map for a scene
<InputController scope="canvas">
  <Action drag={PointerMap} onAction="camera.orbit" />
  <Action wheel={WheelMap} onAction="camera.dolly" />
</InputController>

// Transition control
<Transition ease={EaseFn} duration={number} />

// Spatial composition
<View id={string} x={number} y={number} w={number} h={number}>...</View>
<ViewLayout kind="stack" direction="horizontal">...</ViewLayout>

// Progress weighting
<ProgressManager scrollUnits={number} />
```

### 4.5 Plugin-Based Widget Registration

```typescript
import { SceneEngine, corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

const PLUGINS = [
  corePlugin({ onSceneChange: (id) => console.log(id) }),
  modelPlugin({ manifestUrl: '/manifest.json' }),
];

<SceneEngine plugins={PLUGINS}>
  <Scene key="hero">...</Scene>
</SceneEngine>
```

`corePlugin()` registers: `CameraWidget`, `LightingWidget`, `BackgroundWidget`, `EnvironmentWidget`, `FloorWidget`, `SpotlightRigWidget`, `TextBoxWidget`, `SceneMetaWidget`.

`modelPlugin()` from `@brewsite/model` registers: `ModelWidget` (with factory from manifest), `LabelPositioner`.

`diagramPlugin()` from `@brewsite/diagram` registers: `DiagramWidget`, `ImagePanelWidget`, `ScreenWidget`.

`chartPlugin()` from `@brewsite/charts` registers: `ChartWidget`.

### 4.6 Transition Utilities (Re-exported from compiler)

```typescript
// Functional closure transition spec — widget returns pure t => T functions
type FunctionalTransitionSpec<T> = {
  exitFn: (fromState: T) => (t: number) => T
  enterFn: (toState: T) => (t: number) => T
  interpolateFn: (fromState: T, toState: T) => (t: number) => T
}

// Blend helpers
function blendNumber(from?: number, to?: number, t?: number): number | undefined
function blendVec3(from?: Vec3, to?: Vec3, t?: number): Vec3 | undefined
function blendColor(from?: string, to?: string, t?: number): string | undefined
function blendOpacity(from?: number, to?: number, t?: number): number | undefined
function blendAxisRotation(from?, to?, t?): AxisRotation | undefined
function blendAxisTranslation(from?, to?, t?): AxisTranslation | undefined
function resolveEnabledByOpacity(opacity?: number, fallback?: boolean): boolean
function transitionT(phase: TransitionPhase, blockProgress: number): number
```

### 4.7 Math Utilities

```typescript
type Vec3 = [number, number, number]
type Vec2 = [number, number]
type Quaternion = { x: number; y: number; z: number; w: number }

function quatFromEuler(rotation: Vec3): Quaternion
function quatSlerp(a: Quaternion, b: Quaternion, t: number): Quaternion
function quatToEuler(q: Quaternion): Vec3
function composeMatrix(position: Vec3, rotation: Vec3, scale: Vec3): Mat4
function decomposeMatrix(matrix: Mat4): { position: Vec3; rotation: Vec3; scale: Vec3 }
function copyVec3(value: Vec3): Vec3
```

### 4.8 NVS and Layout

```typescript
// NVS types
type NVSRect = { x: number; y: number; w: number; h: number }
type NVSPosition = { x: number; y: number }
interface INVSBounded { nvsBounds: NVSRect }

// NVS coordinate service (provided in WidgetRenderContext.coords)
interface NVSCoordService {
  toWorld(nvsX: number, nvsY: number, z?: number): Vec3
  toWorldSize(nvsW: number, nvsH: number): { width: number; height: number }
  canvasAspect: number
  visibleWorldHeight: number
  visibleWorldWidth: number
  viewportWidth: number
  viewportHeight: number
}

// Coordinate conversion utilities
function nvsToWorldAnalytic(nvsX: number, nvsY: number, worldH: number, aspect: number): Vec3
function worldToNvsAnalytic(worldX: number, worldY: number, worldH: number, aspect: number): NVSPosition
function createNVSCoordService(camera: THREE.PerspectiveCamera, width: number, height: number): NVSCoordService

// Validation
function validateNVSScalar(value: number, name: string): boolean
function validateNVSRect(rect: NVSRect): boolean
function validateNVSPosition(pos: NVSPosition): boolean
```

### 4.9 Theming

```typescript
type SceneTheme = {
  readonly colorMode: SceneColorMode
  readonly font: SceneThemeFontTokens
  readonly fontSize: SceneThemeFontSizeScale
  readonly background?: SceneThemeBackground
  readonly floor?: SceneThemeFloor
}

type ThemeFamily = 'darkGlass' | 'midnight' | 'neonCyber' | 'enterprise' | 'lightCanvas' | 'lightMinimal'
type ThemePolarity = 'dark' | 'light'
type SceneThemePair = { readonly dark: SceneTheme; readonly light: SceneTheme }

const SCENE_THEME_PAIRS: Record<ThemeFamily, SceneThemePair>
function resolveThemeFamily(sceneTheme: SceneTheme): ThemeFamily | undefined

// Named presets (12 total — 6 families × 2 polarities)
const darkGlassSceneTheme, darkGlassLightSceneTheme: SceneTheme
const midnightSceneTheme, midnightLightSceneTheme: SceneTheme
const neonCyberSceneTheme, neonCyberLightSceneTheme: SceneTheme
const enterpriseSceneTheme, enterpriseLightSceneTheme: SceneTheme
const lightCanvasSceneTheme, lightCanvasDarkSceneTheme: SceneTheme
const lightMinimalSceneTheme, lightMinimalDarkSceneTheme: SceneTheme

// Backward-compatible generic presets
const darkSceneTheme, lightSceneTheme: SceneTheme
```

---

## 5. Architectural Boundaries

### 5.1 Package Dependency Rule

```
@brewsite/diagram  ─┐
@brewsite/model    ─┼─ may import from ─→ @brewsite/core
@brewsite/charts   ─┘
```

`@brewsite/core` must never import from any downstream package. This is a hard constraint enforced at build time.

### 5.2 Layer Dependency Rule Within Core

The layer stack flows strictly top-to-bottom:

```
player/ → runtime/ → compiler/ → elements/ → widget/ → timeline/ → math/
                                  layout/   ← (standalone)
                                  input/    ← (standalone)
                                  theme/    ← (standalone)
                                  text/     ← (standalone)
```

Concretely:
- `compiler/index.ts` exports only the DSL authoring surface. Infrastructure types (`SceneTrack`, `compileSceneTrack`, cache functions) are imported directly from their source files by the player layer, never re-exported through the compiler index.
- `runtime/` has no Three.js imports. It receives widget instances that internally use Three.js, but the runtime itself does not.
- `elements/{name}/types.ts` has no Three.js, no React, no runtime imports — only plain TypeScript types.
- `elements/{name}/render.ts` may import Three.js. It must not import from the compiler layer.

### 5.3 Three.js Confinement

Three.js imports are allowed only in:
- `elements/*/render.ts` and `elements/*/{Name}Widget.ts`
- `player/` components that create or manage the `WebGLRenderer` and `Scene` instances
- `text/TextRenderer.ts`

Anywhere else — types files, compile files, runtime files, hooks — Three.js is prohibited.

### 5.4 No Circular Dependencies

The monorepo enforces no circular imports between layers. Any new file added to the codebase must be assignable to exactly one layer.

---

## 6. Widget SDK Design

### 6.1 IWidget Interface Hierarchy

All widgets implement the base `IWidget` interface. Additional capabilities are expressed through optional sub-interfaces that the runtime queries via type guards.

**Core interfaces** (required for most widgets):

```typescript
interface IWidget {
  readonly widgetId: string;
}

interface ISceneElement<TState, TExtra = void> extends IWidget {
  // Participates in DSL compilation. Provides transition spec for
  // enter/exit/interpolate between scenes.
}

interface IRenderable<TState, TExtra = void> extends IWidget {
  // Called each tick after sampling the SceneTrack.
  // Applies compiled state to the Three.js scene.
  initialize(context: WidgetInitContext): void;
  apply(state: TState, context: WidgetRenderContext<TExtra>): void;
  dispose(): void;
}

interface ILoadable extends IWidget {
  // Async asset loading. Runtime awaits all ILoadable.load() calls
  // before transitioning to the ready state.
  load(manifest: AssetManifest): Promise<void>;
  isLoaded(): boolean;
}

interface IAnimationController extends IWidget {
  // Called each frame in priority order for frame-dependent logic.
  onTick(context: AnimationTickContext): void;
  tickPriority: number;  // lower = earlier; CameraWidget = 100
}

interface ISceneLifecycle extends IWidget {
  // Notified on scene transitions for cleanup/setup that cannot
  // be expressed as compiled state.
  onSceneEnter?(sceneId: string): void;
  onSceneExit?(sceneId: string): void;
}
```

**Extended interfaces** (for specialized capabilities):

```typescript
interface IContainedRenderable extends IWidget {
  // A renderable attached to a parent widget's attachment point.
  readonly anchorWidgetId: string;
  readonly anchorKey: string;
  readonly rootObject: THREE.Object3D;
}

interface IAttachmentHost extends IWidget {
  // Provides named attachment points for IContainedRenderable widgets.
  getAttachmentPoint(key: string): THREE.Object3D | undefined;
}

interface IRenderContributor extends IWidget {
  // Contributes render data (bone positions, target colors) for
  // consumption by the label system and other cross-widget consumers.
  contributeRenderData(): RenderContribution;
}

interface IRendererLifecycle extends IWidget {
  // Notified when the WebGLRenderer is created or destroyed.
  onRendererCreated(renderer: THREE.WebGLRenderer): void;
  onRendererDisposing?(): void;
}

interface IInputDefaultProvider extends IWidget {
  // Provides default input actions when no <InputController> is authored.
  getDefaultInputActions(): InputActionSpec[];
}

interface ICameraFocusTarget extends IWidget {
  // Receives focus requests from action dispatch.
  requestFocus(target: Vec3, duration?: number): void;
}

interface ILightingOverride extends IWidget {
  // Overrides scene lighting for specific rendering contexts.
  getLightingOverride(): Partial<SceneLighting> | undefined;
}

interface IExtraRenderPass extends IWidget {
  // Performs additional render passes (e.g., reflection, post-processing).
  renderPass(renderer: THREE.WebGLRenderer, width: number, height: number): void;
}
```

### 6.2 WidgetRegistry Routing

The `WidgetRegistry` maintains two registries:
1. A direct widget-instance registry: `widgetId → IWidget`. Used for fixed-identity widgets (camera, lighting, floor, etc.).
2. A type-factory registry: `DSL component function → factory`. Used for multiple-instance widgets (models, diagrams) where the widget instance is created from DSL props at compile time.

### 6.3 VariableStore

`VariableStore` is a synchronous reactive key-value store. Widgets implementing `IVariableProvider` publish named values each tick. React components call `useVariable(key)` to subscribe and re-render when the value changes. `TextBoxWidget` uses the `VariableStore` to publish overlay state that `EngineOverlayHost` reads for rendering.

### 6.4 CUSTOM_NODE_HANDLER

`CUSTOM_NODE_HANDLER` is a `unique symbol` exported from the Widget SDK. A widget that wants to handle its own DSL node type inline implements the symbol, enabling tight coupling between a widget and its DSL component without going through the global registry.

### 6.5 Plugin System

`corePlugin(options?)` is the standard entry point for built-in widget registration. Plugins are passed to `SceneEngine` via the `plugins` prop. Each plugin implements `IWidgetPlugin.register(registry, manifest)`.

```typescript
const PLUGINS = [
  corePlugin({ onSceneChange: (id, index) => { ... } }),
  modelPlugin({ manifestUrl: '/manifest.json' }),
];

<SceneEngine plugins={PLUGINS}>...</SceneEngine>
```

---

## 7. Two-Tier Overlay Architecture

`SceneEngine` composes two visual layers stacked in a container:

**Tier 1: Three.js Canvas (WebGL)**
The `<canvas>` element rendered by `SceneCanvas`, managed by `WebGLRenderer`. All 3D objects (lighting, floor, environment, models, diagrams, charts) render here. The canvas fills the `EngineARContainer` with `position: absolute; inset: 0`.

**Tier 2: React Overlay**
`EngineOverlayHost` renders a `<div>` positioned `absolute, inset: 0` over the canvas. It reads `TextBoxState` entries from the `VariableStore` and renders them as absolutely positioned HTML content. CSS custom properties from `SceneTheme` are injected on the overlay container for styling.

The two tiers share the same `EngineContext`. `EngineARContainer` provides the spatial reference frame: NVS coordinates `[0, 0]` to `[1, 1]` map to the AR-locked container bounds, enabling resolution-independent overlay positioning.

### 7.1 Context Providers

`SceneEngine` establishes the following React context tree:

```
VariableStoreContext.Provider
  LabelPositionerContext.Provider
    EngineStateContext.Provider
      EngineContext.Provider
        ThemeContext.Provider
          {children}
```

All player hooks (`useCurrentScene`, `useSceneProgress`, `useVariable`, `useEngineState`, `useSceneEngineContext`) require a `SceneEngine` ancestor.

---

## 8. SSR Safety Contract

The following guarantees hold for all code in `@brewsite/core`:

1. **No top-level browser global access.** No module-level references to `window`, `document`, `navigator`, `performance`, or `requestAnimationFrame`. All such access is inside function bodies or `useEffect`/`useLayoutEffect` hooks.
2. **Three.js instantiation is deferred.** `WebGLRenderer`, `Scene`, `PerspectiveCamera`, and all Three.js objects are created inside React lifecycle methods, never at module import time.
3. **EngineGate renders a placeholder during SSR.** On the server, `EngineGate` renders `placeholder` (if provided) or `null`. Input components render nothing on the server.
4. **Compiler is fully SSR-safe.** `compileSceneTrack()` is a pure function with no DOM or browser dependencies.
5. **Hooks guard against SSR.** All hooks that read browser state are no-ops during server rendering and initialize their listeners on mount.

---

## 9. Success Metrics

**Integration Time**
A developer integrating the toolkit into a new React project should reach a working animated scene with scroll navigation in under 2 hours using only TypeScript types and the examples app.

**TypeScript Error Surface**
Authoring errors — wrong prop types, unknown widget IDs, missing required fields — should be caught at TypeScript compile time, not at runtime. The API surface produces no `any`-typed inference gaps at the DSL authoring layer.

**Bundle Size**
`@brewsite/core` (excluding Three.js peer dependency) should not exceed 120KB gzipped for a typical integration. Tree-shaking must be effective: a consumer using only the compiler and no player UI should not pull in React component code.

**Test Coverage**
Minimum 80% line coverage across all non-`render.ts` source files. Coverage is enforced in CI.

**API Stability**
No unintentional breaking changes in published minor versions. All breaking changes are documented in CHANGELOG with a migration guide.

**Developer Discovery**
`packages/core/README.md` plus `apps/examples/` provide sufficient documentation for a new developer to understand the authoring model without reading source code.

---

## 10. Non-Goals

- **Application routing** — The toolkit does not manage URL-based navigation or deep-linking into scenes.
- **Content management** — Scene content is authored in code. No CMS integration, no visual editor.
- **Physics or collision** — The toolkit is for visual playback of pre-defined animations, not real-time physics.
- **Audio** — No audio playback, synchronization, or spatial audio.
- **Video textures** — No native video-texture DSL. Consumers can add this via the widget extension model.
- **Multi-renderer** — `@brewsite/core` targets WebGL via Three.js exclusively.
- **Visual scene editor** — The authoring surface is code-first JSX.
- **Application state management** — `VariableStore` is for cross-widget runtime values only.
