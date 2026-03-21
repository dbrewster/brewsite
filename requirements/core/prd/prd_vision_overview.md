---
title: "BrewSite Core — Vision & Overview"
doc_type: prd
owner: brewsite-product-manager
status: active
updated: 2026-03-21
change_history:
  - date: 2026-03-21
    author: "Toolkit Product"
    summary: "Scene unit system: all DSL-authored spatial values across the toolkit now require explicit SceneLength/SceneAngle unit strings (e.g. '50%', '15u', '45deg'). Bare numbers except 0 are TypeScript errors. The units/ module in @brewsite/core resolves unit strings to NVS numbers at compile time. Compiled state and the SceneTrack remain number. This is a semver major breaking change across all published packages."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Codebase alignment: renamed camera.dolly to camera.zoom; added carousel-scrubber element to core elements listing; added material preset system description to widget layer; added highlight palette system to theming section."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "NVS zoom-instability fix: updated NVS section (3.6) and API signatures (4.8) to reflect createNVSCoordService now accepts NVSCameraParams instead of THREE.PerspectiveCamera. Added NVSCameraParams type and resolveNVSParamsFromCameraState function. Updated NVSCoordService description to note mapping is pinned to compiled camera state."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Codebase alignment audit. Package table: added @brewsite/screens, @brewsite/claude-author, create-brewsite, brewsite CLI. Camera modes: removed nvsViewport (DSL-only concept compiled to world; only 4 runtime modes exist). Input: replaced ActionInput/KeyboardInput with InputCoordinator. TextBox: corrected description to match actual implementation (simple React component rendering position:absolute div; no TextBoxWidget, no VariableStore pipeline). Widget SDK signatures: fixed ISceneLifecycle (both methods non-optional, take sceneId+sceneIndex), ICameraFocusTarget.requestFocus (position+target+smooth), ILightingOverride.getLightingOverride (returns {disableAll}|null), IAttachmentHost.getAttachmentPoint (returns Object3D|null), NVSCoordService.toWorldSize (returns tuple), WidgetRenderContext.variables (VariableStoreReader), AnimationTickContext.resolvedState (unknown). ThemeFamily: added 'enterprise'. Context provider tree: corrected order from source. CameraControlPanel: exported from @brewsite/core with @internal tag, not a devtools subpath."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Embedding modes cleanup: updated §4.1 SceneReel component signature to show theme and defaultTransitionDuration props. Updated §3.4 EngineARContainer reference to note ViewportScaleContainer alias."
  - date: 2026-02-28
    author: brewsite-product-manager
    summary: "Comprehensive rewrite replacing outdated BrewFlow-era vision document. Updated product name to BrewSite, corrected all API surface details against actual source, expanded Widget SDK section, added SSR safety contract, aligned all type references with live codebase."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Centralized theme system: added @brewsite/themes to the published packages table (§1) and dependency rule (§5.1). Updated §3.9 Cross-Package Theming to document the new `theme?: ActiveTheme` prop on SceneEngine, `themesPlugin()` registration pattern, ThemeBundle, and the deprecated themeFamily/themePolarity/sceneTheme props. Updated §4.1 SceneEngine component signature to show `theme={ActiveTheme}`. Updated §4.5 Plugin-Based Widget Registration example to include `themesPlugin()`. Updated §4.9 Theming to document ActiveTheme as the primary selector type and the themes namespace from @brewsite/themes. Updated §6.5 Plugin System example to include themesPlugin."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Scene Child Constraint: updated §3.6 (NVS) with a paragraph on the scene child constraint as a first-class authoring model rule — ambient elements configure global environment; spatial elements inside Views define positioned 3D regions. Updated §4.4 DSL Authoring Components to add Scene child constraint rules to the <View> and <ViewLayout> entries."
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

The monorepo publishes nine packages:

| Package | Role |
|---|---|
| `@brewsite/core` | Animation engine, compiler, widget SDK, player primitives |
| `@brewsite/diagram` | 3D diagram, image-panel, and screen elements |
| `@brewsite/model` | GLTF model loading, animation, and 3D-tracked label system |
| `@brewsite/charts` | 3D chart element library |
| `@brewsite/screens` | Screen element library |
| `@brewsite/themes` | Centralized cross-package theme bundles and `themesPlugin()` registration |
| `@brewsite/claude-author` | MCP server and docs search for AI-assisted scene authoring |
| `create-brewsite` | Project scaffolder CLI (`npm create brewsite`) |
| `brewsite` | Utility CLI (`npx brewsite add ...`) |

`@brewsite/diagram`, `@brewsite/model`, `@brewsite/charts`, `@brewsite/screens`, and `@brewsite/themes` may import from `@brewsite/core`. `@brewsite/core` must never import from any of them. The three CLI/tooling packages (`claude-author`, `create-brewsite`, `brewsite`) are standalone with no cross-package build dependencies.

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

Widget registration uses a plugin pattern. `corePlugin()` registers all built-in core widgets (Camera, Lighting, Background, Environment, Floor, SpotlightRig, TextBox, SceneMeta). `modelPlugin()` from `@brewsite/model` registers model and label widgets. `diagramPlugin()` from `@brewsite/diagram` registers diagram, image-panel, and screen widgets. `chartPlugin()` from `@brewsite/charts` registers chart widgets. `themesPlugin()` from `@brewsite/themes` registers cross-package theme bundles into the per-package theme registries — it uses the `configureRegistry()` hook and has no widget instances of its own.

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
- **Camera** — Perspective camera with four positioning modes: `world`, `orbit`, `fitBotHeight`, and `fitFloorDepth`. Interactive trackpad orbit/dolly/pan controls.
- **Lighting** — Ambient, directional, point, spot, panel (RectAreaLight), glow point, and light strand lights with color, intensity, and position control.
- **Background** — Scene background via DOM element: solid colors, images, CSS gradients, CSS filters, overlay gradients, and backdrop-filter effects.
- **Environment** — HDR environment maps (HDRI, EXR, CubeTexture) for physically-based rendering.
- **Floor** — Reflective floor plane with physical and mirror modes, optional grid overlay.
- **SpotlightRig** — Themed spotlight arrays for dramatic scene lighting.
- **TextBox** — Simple React component that renders a `position: absolute` div at NVS-percentage coordinates. Used inside `<Scene>` overlay content rendered by `EngineOverlayHost`. There is no `TextBoxWidget` — `TextBox` is a pure presentational component in `elements/text-box/dsl.tsx`.
- **CarouselScrubber** — 3D tray base rendered beneath `ViewLayout` carousels. Authored via `<CarouselTray>` as a child of `<ViewLayout kind="carousel">`. Supports material presets, surface textures (brushed, radial, crosshatch, grain), edge styles (smooth, knurled, ridged, matte), and per-view highlight effects (glow, holographic). Themed via `SceneTheme.carouselTray`.

Elements provided by companion packages:
- **Model** (`@brewsite/model`) — GLTF models with animation clip control, bone-tracked labels, part overrides.
- **Diagram** (`@brewsite/diagram`) — 3D diagram nodes, edges, groups, and interactive canvas.
- **Chart** (`@brewsite/charts`) — 3D bar, line, area, pie, donut, scatter, and waterfall charts.
- **ImagePanel, Screen** (`@brewsite/diagram`) — 3D image panels and screen elements.

### 3.2 Camera Modes

The camera element supports four positioning modes (the `CameraPositionDescriptor` discriminated union):

- `world` — Position and target as absolute world-space Vec3 coordinates. Maximum author control.
- `orbit` — Spherical coordinates (azimuth, polar, distance) around a target point. Natural for turntable and rotation animations.
- `fitBotHeight` — Auto-frame a specified model height. Useful for model showcase scenes.
- `fitFloorDepth` — Auto-frame a floor-level depth area. Legacy mode; prefer `world` for new scenes.

The DSL supports an `nvsViewport` convenience concept for diagram/chart scenes that declares `worldScale` and `zRange`. This is resolved to a `world`-mode descriptor at compile time — it is not a distinct runtime camera mode.

### 3.3 Input and Navigation

Scene navigation is handled by composable input components rendered as children of `SceneEngine` or `SceneReel`:

- **ScrollStage** — Full-page scroll drives scene progress via native `window.scrollY`. Provides the sticky-canvas scroll layout pattern.
- **InputCoordinator** — Unified input component that bridges compiled `<InputController>` DSL to the `ActionInputController` runtime. Handles pointer, wheel, pinch, and keyboard action dispatch, including focus management and default keyboard navigation (ArrowRight/ArrowDown = scene.next, ArrowLeft/ArrowUp = scene.prev when no `<InputController>` is authored).
- **TimeInput** — Wall-clock auto-advance with configurable duration, looping, and pause-when-hidden.
- **ControlledInput** — External `value` prop drives progress directly for programmatic control.
- **useEngineScrubber** — Hook for imperative progress read/write.
- **useGoToScene** — Hook for programmatic scene navigation by id or index.

The `InputController` DSL component and its `Action` children define the action map for each scene. The `ActionInputController` routes pointer, wheel, pinch, and keyboard events to registered named-action handlers on widgets. Default keyboard navigation (`scene.next` on ArrowRight/ArrowDown, `scene.prev` on ArrowLeft/ArrowUp) is compiler-injected when no `<InputController>` is authored.

### 3.4 Overlay System

Scene overlay content is authored via the `<TextBox>` component inside `<Scene>`. `TextBox` is a simple React component (in `elements/text-box/dsl.tsx`) that renders a `position: absolute` div at NVS-percentage coordinates (`left`, `top`, `width`, `height` as percentages). It is rendered by `EngineOverlayHost` over the Three.js canvas. The `EngineARContainer` (also exported as `ViewportScaleContainer`) provides the aspect-ratio-locked spatial frame against which NVS coordinates resolve to pixel positions.

The previous HUD system (`<Hud>`, `<HudItem>`, `hudCompiler`, `HudOverlay`, `HudPhaseContext`, `hud/animejs/`) has been removed. See `prd_hud.md` for migration guidance.

### 3.5 3D-Tracked Labels

The labels system renders DOM text labels that track positions on 3D models. Labels are authored as children of `<Model>` elements in `@brewsite/model`, compiled to per-frame primitives, and positioned at runtime by `LabelPositioner` — which projects 3D world positions through the camera's projection matrix.

Labels, `LabelPositioner`, `LabelItem`, `LabelPositionerContext`, and all label types live in `@brewsite/model`, not `@brewsite/core`. See `requirements/model/prd/prd_model.md`.

### 3.6 Normalized Viewport Space (NVS)

The NVS coordinate system provides a resolution-independent positioning model for scene elements. NVS coordinates range from `[0, 0]` (top-left) to `[1, 1]` (bottom-right) of the viewport. The `layout/` module provides `NVSCoordService` which converts NVS positions to world-space coordinates at runtime using the **compiled camera state** and canvas dimensions. NVS mapping is pinned to the scene author's intended viewport — user camera interaction (orbit, zoom, pan) does not affect NVS positions.

Elements that declare NVS bounds (`x`, `y`, `w`, `h` props) implement `INVSBounded`. The `View` and `ViewLayout` DSL components provide spatial composition — stack and carousel layouts that partition the NVS viewport among child views.

The NVS model divides all DSL elements into two categories with a first-class authoring rule enforced at compile time:

- **Ambient elements** (`<Camera>`, `<Lighting>`, `<Background>`, `<Environment>`, `<Floor>`, `<SpotlightRig>`, `<InputController>`, `<ProgressManager>`, `<TextBox>`) configure the global scene environment. They do not require NVS bounds relative to the canvas and may always appear as direct `<Scene>` children regardless of scene composition.

- **Spatial elements** (`<DiagramCanvas>`, `<Chart>`, `<Model>`, `<ImagePanel>`, `<Screen>`) occupy a region of the 3D viewport and require NVS bounds to render correctly. The compiler enforces a constraint on direct `<Scene>` children: a single spatial element is silently auto-wrapped in a full-screen View; two or more spatial elements without explicit `<View>` wrappers produce a `console.error`; mixing bare spatial elements with `<View>`/`<ViewLayout>` children is also an error.

This constraint is not a limitation — it is a deliberate authoring model rule that ensures all spatial content flows through the `viewHandler` compilation path, eliminating coordinate-system ambiguity and providing a consistent spatial composition model. Authors who want multiple spatial elements in a single scene always use explicit `<View>` or `<ViewLayout>` wrappers, making layout intent visible in the DSL.

### 3.7 Pre-Compiled Timeline Algebra

The `timeline/` module provides the algebra for converting a scene list into a tick index space. `ProgressManager` provides per-scene scroll-weight configuration for non-uniform scene durations.

### 3.8 Widget SDK and VariableStore

The Widget SDK (`widget/`) is the extension mechanism for all renderable and behavioral concepts. The `WidgetRegistry` routes DSL node types to widget instances. The `VariableStore` is a reactive key-value store for sharing state across widgets — a model widget can publish bone positions; a `TextBox` widget reads them for overlay positioning.

`CUSTOM_NODE_HANDLER` is a Symbol that a widget implements via the `IHasCustomDslHandler` interface to register its own DSL node handler inline, enabling tight coupling between a widget and its DSL component without going through the global registry. The `hasCustomDslHandler(widget)` type guard checks for this symbol.

The widget layer includes a **material preset system** (`MaterialLoader`, `MaterialPreset`, `MaterialManifest`, `MaterialApplication`) for loading and applying PBR texture sets to widgets. Material presets define named texture bundles (color, normal, roughness, metalness, AO maps) that are loaded once and applied to floor surfaces, carousel trays, and other elements via the `surfaceMaterial` and `materialApplication` fields.

### 3.9 Cross-Package Theming

The centralized theme system provides unified visual styling across all packages. Seven theme families (`default`, `enterprise`, `darkGlass`, `midnight`, `neonCyber`, `lightCanvas`, `lightMinimal`) each have dark and light polarity variants.

Theme selection is controlled by a single `theme?: ActiveTheme` prop on `<SceneEngine>`, sourced from `@brewsite/themes`. Themes are registered at engine startup via `themesPlugin()`, which populates per-package theme registries (`sceneThemeRegistry`, `diagramThemeRegistry`, `chartThemeRegistry`) from `ThemeBundle` objects. Each `ThemeBundle` carries the full dark/light preset pair for one family across all three rendering packages.

`EngineOverlayHost` injects CSS custom properties and polarity classes onto its container from the resolved `SceneTheme`. Spatial elements (`DiagramCanvas`, `Chart`) resolve their theme at compile time from `api.context.themeFamily` and `api.context.themePolarity` — no per-element `theme=` prop is required or supported.

The theme system includes a **highlight palette** (`SceneThemeHighlightPalette`) with named semantic variants (`primary`, `secondary`, `tertiary`, `error`, `warning`, `success`, `info`). Each variant defines color, mode (glow/holographic), intensity, blend mode, and backdrop settings. Default palettes (`darkHighlightPalette`, `lightHighlightPalette`) are exported from `@brewsite/core` for dark and light polarities respectively. Theme presets in `@brewsite/themes` can override individual variants.

The `themeFamily`/`themePolarity`/`sceneTheme` props on `SceneEngine` are deprecated in favor of the unified `theme` prop. See `@brewsite/themes` for the full authoring pattern.

---

## 4. Published Package API

The following is the complete public surface of `@brewsite/core`. All symbols listed here are stable across patch and minor releases. Breaking changes require a major version bump.

### 4.1 React Components

```typescript
// Primary integration — pure context provider with zero DOM output
<SceneEngine id={string} plugins={WidgetPlugin[]} theme={ActiveTheme}>
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
<SceneReel height={number} plugins={WidgetPlugin[]} theme={ActiveTheme} defaultTransitionDuration={number} />

// Input components
<InputCoordinator />
<TimeInput duration={number} loop pauseWhenHidden={{ y: number }} />
<ControlledInput value={number} />

// Dev tools (@internal — not part of the stable public API)
<TimelineWidget />
<CameraControlPanel />
<SceneInspector />
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
interface ILoadable extends IWidget { load(manifest: AssetManifest | null): Promise<void>; readonly isLoaded: boolean }
interface IDslComposite extends IWidget { readonly childDslComponents: ReadonlyArray<{ component: React.ComponentType<unknown>; displayName: string; topLevelError?: boolean }> }
interface IAnimationController extends IWidget { onTick(ctx: AnimationTickContext): void; tickPriority: number }
interface ISceneLifecycle extends IWidget { onSceneEnter(sceneId: string, sceneIndex: number): void; onSceneExit(sceneId: string, sceneIndex: number): void }
interface IVariableProvider extends IWidget { variableNamespace: string; variableKeys: readonly string[] }

// Extended interfaces
interface IContainedRenderable extends IWidget { anchorWidgetId: string; anchorKey: string; rootObject: THREE.Object3D }
interface IAttachmentHost extends IWidget { getAttachmentPoint(key: string): THREE.Object3D | null }
interface IRenderContributor extends IWidget { contributeRenderData(): RenderContribution }
interface IRendererLifecycle extends IWidget { onRendererCreated(renderer: THREE.WebGLRenderer): void; onRendererDisposing(renderer: THREE.WebGLRenderer): void }
interface IInputDefaultProvider extends IWidget { getDefaultInputActions(): InputActionSpec[] }
interface ICameraFocusTarget extends IWidget { requestFocus(position: readonly [number, number, number], target: readonly [number, number, number], smooth?: boolean): void }
interface ILightingOverride extends IWidget { getLightingOverride(): { readonly disableAll: boolean } | null }
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
  variables: VariableStoreReader
  extra: TExtra
  tick?: SceneTrackTick | null
  coords: NVSCoordService  // NVS → world coordinate conversion (compiled camera state)
}

interface AnimationTickContext {
  clock: RealtimeClock
  effectiveDeltaSeconds: number
  scene: THREE.Scene
  variables: VariableStore
  tick: SceneTrackTick | null
  track: SceneTrack | null
  resolvedState: unknown
  cameraFocusTarget: ICameraFocusTarget | null
  cameraOverride: RuntimeCameraOverride | null
  setCameraOverride: (override: RuntimeCameraOverride | null) => void
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
<TextBox x={number} y={number} w={number} h={number} layer={number} overflow={'hidden' | 'visible'}>
  {/* HTML overlay content */}
</TextBox>

// Input controller — defines action input map for a scene
<InputController scope="canvas">
  <Action drag={PointerMap} onAction="camera.orbit" />
  <Action wheel={WheelMap} onAction="camera.zoom" />
</InputController>

// Transition control
<Transition ease={EaseFn} duration={number} />

// Spatial composition
// NOTE: <View> and <ViewLayout> are the required wrappers for multiple spatial elements.
// Two or more spatial elements as direct <Scene> children without Views → console.error.
// One spatial element without a View → auto-wrapped to full-screen __scene_root__ View.
// Ambient elements (<Camera>, <Lighting>, etc.) never require <View> wrappers.
<View id={string} x={number} y={number} w={number} h={number}>...</View>
<ViewLayout kind="stack" direction="horizontal">...</ViewLayout>

// Progress weighting
<ProgressManager scrollUnits={number} />
```

### 4.5 Plugin-Based Widget Registration

```typescript
import { SceneEngine, corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';
import { diagramPlugin } from '@brewsite/diagram';
import { chartPlugin } from '@brewsite/charts';
import { themesPlugin, themes } from '@brewsite/themes';

const PLUGINS = [
  corePlugin({ onSceneChange: (id) => console.log(id) }),
  modelPlugin({ manifestUrl: '/manifest.json' }),
  diagramPlugin({ manifestUrl: '/manifest.json' }),
  chartPlugin(),
  themesPlugin(),   // registers all five named ThemeBundles into per-package registries
];

<SceneEngine plugins={PLUGINS} theme={themes.darkGlass.dark}>
  <Scene key="hero">...</Scene>
</SceneEngine>
```

`corePlugin()` registers: `CameraWidget`, `LightingWidget`, `BackgroundWidget`, `EnvironmentWidget`, `FloorWidget`, `SpotlightRigWidget`, `SceneMetaWidget`. It also implements `reconcileCompiledTrack` to lazily create `ViewWidget` instances for view IDs found in the compiled `SceneTrack`.

`modelPlugin()` from `@brewsite/model` registers: `ModelWidget` (with factory from manifest), `LabelPositioner`.

`diagramPlugin()` from `@brewsite/diagram` registers: `DiagramWidget`, `ImagePanelWidget`, `ScreenWidget`.

`chartPlugin()` from `@brewsite/charts` registers: `ChartWidget`.

`themesPlugin()` from `@brewsite/themes` registers no widgets — it populates the per-package theme registries via its `configureRegistry()` hook so that `DiagramWidget`, `ChartWidget`, and core elements resolve their visual style from `SceneEngine.theme` at compile time.

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
  toWorldSize(nvsW: number, nvsH: number): readonly [number, number]
  canvasAspect: number
  visibleWorldHeight: number
  visibleWorldWidth: number
  viewportWidth: number
  viewportHeight: number
}

// NVS camera params — pure math, no Three.js dependency
type NVSCameraParams = {
  distance: number     // camera distance to target in world units
  fovDeg: number       // vertical FOV in degrees
  centerX?: number     // world-space X of viewport center (default 0)
  centerY?: number     // world-space Y of viewport center (default 0)
}

// Coordinate conversion utilities
function nvsToWorldAnalytic(nvsX: number, nvsY: number, worldH: number, aspect: number): Vec3
function worldToNvsAnalytic(worldX: number, worldY: number, worldH: number, aspect: number): NVSPosition
function createNVSCoordService(camera: NVSCameraParams, width: number, height: number): NVSCoordService
function resolveNVSParamsFromCameraState(state: SceneCamera): NVSCameraParams | null

// Validation
function validateNVSScalar(value: number, name: string): boolean
function validateNVSRect(rect: NVSRect): boolean
function validateNVSPosition(pos: NVSPosition): boolean
```

### 4.9 Theming

Theme selection uses `ActiveTheme` — a plain `{ family, polarity }` selector passed to `<SceneEngine theme={...}>`. Theme data (colors, typography, material tokens) is registered separately via `themesPlugin()` from `@brewsite/themes` and looked up at compile time.

**From `@brewsite/core`:**

```typescript
// Primary selector type — passed to SceneEngine.theme
interface ActiveTheme {
  readonly family: ThemeFamily;
  readonly polarity: 'dark' | 'light';
}

type ThemeFamily =
  | 'default'       // enterprise aesthetic; always pre-registered, no themesPlugin() required
  | 'enterprise'    // distinct enterprise variant
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'lightCanvas'
  | 'lightMinimal'

type ThemePolarity = 'dark' | 'light'

// Low-level SceneTheme token set (CSS vars, font tokens, background/floor presets)
type SceneTheme = {
  readonly colorMode: SceneColorMode
  readonly font: SceneThemeFontTokens
  readonly fontSize: SceneThemeFontSizeScale
  readonly background?: SceneThemeBackground
  readonly floor?: SceneThemeFloor
}
type SceneThemePair = { readonly dark: SceneTheme; readonly light: SceneTheme }

// Registry functions (called by themesPlugin internally — consumers rarely call these directly)
function registerSceneThemePair(family: ThemeFamily, pair: SceneThemePair): void

// @deprecated — use SceneEngine.theme prop; direct SceneTheme construction is unnecessary
const darkGlassSceneTheme, darkGlassLightSceneTheme: SceneTheme
const midnightSceneTheme, midnightLightSceneTheme: SceneTheme
// ... all 12 named presets available for backward compatibility
const darkSceneTheme, lightSceneTheme: SceneTheme  // generic aliases
```

**From `@brewsite/themes`:**

```typescript
// Plugin — registers ThemeBundles into per-package registries at engine startup
function themesPlugin(bundles?: ThemeBundle[]): WidgetPlugin

// ThemeBundle — complete cross-package theme data for one family
interface ThemeBundle {
  readonly family: ThemeFamily;
  readonly scene:   { readonly dark: SceneTheme;   readonly light: SceneTheme };
  readonly diagram: { readonly dark: DiagramTheme; readonly light: DiagramTheme };
  readonly chart:   { readonly dark: ChartTheme;   readonly light: ChartTheme };
}

// Pre-built ActiveTheme selectors — the idiomatic way to pick a theme
import { themes } from '@brewsite/themes';
const activeTheme = themes.darkGlass.dark;   // { family: 'darkGlass', polarity: 'dark' }
const activeTheme = themes.midnight.light;   // { family: 'midnight', polarity: 'light' }
// Available: darkGlass, midnight, neonCyber, lightCanvas, lightMinimal, defaultTheme

// Pre-built ThemeBundle objects — pass to themesPlugin() for selective registration
import { bundles } from '@brewsite/themes';
themesPlugin([bundles.darkGlass])  // only register darkGlass for bundle-size optimization

// Bundle customization
import { mergeThemeBundle } from '@brewsite/themes';
const custom = mergeThemeBundle(bundles.darkGlass, { scene: { dark: { ... } } });
```

---

## 5. Architectural Boundaries

### 5.1 Package Dependency Rule

```
@brewsite/diagram  ─┐
@brewsite/model    ─┤
@brewsite/charts   ─┼─ may import from ─→ @brewsite/core
@brewsite/screens  ─┤
@brewsite/themes   ─┘
```

`@brewsite/core` must never import from any downstream package. This is a hard constraint enforced at build time. `@brewsite/themes` imports from `@brewsite/core`, `@brewsite/diagram`, and `@brewsite/charts` — it is a leaf package with no downstream dependents within the monorepo.

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
  load(manifest: AssetManifest | null): Promise<void>;
  readonly isLoaded: boolean;
}

interface IAnimationController extends IWidget {
  // Called each frame in priority order for frame-dependent logic.
  onTick(context: AnimationTickContext): void;
  tickPriority: number;  // lower = earlier; CameraWidget = 100
}

interface ISceneLifecycle extends IWidget {
  // Notified on scene transitions for cleanup/setup that cannot
  // be expressed as compiled state.
  onSceneEnter(sceneId: string, sceneIndex: number): void;
  onSceneExit(sceneId: string, sceneIndex: number): void;
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
  getAttachmentPoint(key: string): THREE.Object3D | null;
}

interface IRenderContributor extends IWidget {
  // Contributes render data (bone positions, target colors) for
  // consumption by the label system and other cross-widget consumers.
  contributeRenderData(): RenderContribution;
}

interface IRendererLifecycle extends IWidget {
  // Notified when the WebGLRenderer is created or destroyed.
  onRendererCreated(renderer: THREE.WebGLRenderer): void;
  onRendererDisposing(renderer: THREE.WebGLRenderer): void;
}

interface IInputDefaultProvider extends IWidget {
  // Provides default input actions when no <InputController> is authored.
  getDefaultInputActions(): InputActionSpec[];
}

interface ICameraFocusTarget extends IWidget {
  // Receives focus requests from action dispatch.
  requestFocus(position: readonly [number, number, number], target: readonly [number, number, number], smooth?: boolean): void;
}

interface ILightingOverride extends IWidget {
  // Suppresses core scene lighting when a widget manages its own.
  getLightingOverride(): { readonly disableAll: boolean } | null;
  receiveLightController?(setter: (lightId: string, enabled: boolean) => void): void;
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

`VariableStore` is a synchronous reactive key-value store. Widgets implementing `IVariableProvider` publish named values each tick. React components call `useVariable(key)` to subscribe and re-render when the value changes.

### 6.4 CUSTOM_NODE_HANDLER

`CUSTOM_NODE_HANDLER` is a `unique symbol` exported from the Widget SDK. A widget that wants to handle its own DSL node type inline implements the symbol, enabling tight coupling between a widget and its DSL component without going through the global registry.

### 6.5 Plugin System

`corePlugin(options?)` is the standard entry point for built-in widget registration. Plugins are passed to `SceneEngine` via the `plugins` prop. Each plugin implements the `WidgetPlugin` interface with required methods `createWidgets()` and `registerHandlers()`, and optional hooks `configureRegistry?()`, `reconcileCompiledTrack?()`, `wrapProvider?()`, `fetchManifest?()`, and `getActionInputExtension?()`.

```typescript
import { themesPlugin, themes } from '@brewsite/themes';

const PLUGINS = [
  corePlugin({ onSceneChange: (id, index) => { ... } }),
  modelPlugin({ manifestUrl: '/manifest.json' }),
  themesPlugin(),   // registers ThemeBundles via configureRegistry()
];

<SceneEngine plugins={PLUGINS} theme={themes.darkGlass.dark}>...</SceneEngine>
```

---

## 7. Two-Tier Overlay Architecture

`SceneEngine` composes two visual layers stacked in a container:

**Tier 1: Three.js Canvas (WebGL)**
The `<canvas>` element rendered by `SceneCanvas`, managed by `WebGLRenderer`. All 3D objects (lighting, floor, environment, models, diagrams, charts) render here. The canvas fills the `EngineARContainer` with `position: absolute; inset: 0`.

**Tier 2: React Overlay**
`EngineOverlayHost` renders a `<div>` positioned `absolute, inset: 0` over the canvas. It renders scene overlay content (including `<TextBox>` components from the compiled `SceneTrack.sceneOverlays` map) as absolutely positioned HTML. CSS custom properties from `SceneTheme` are injected on the overlay container for styling.

The two tiers share the same `EngineContext`. `EngineARContainer` provides the spatial reference frame: NVS coordinates `[0, 0]` to `[1, 1]` map to the AR-locked container bounds, enabling resolution-independent overlay positioning.

### 7.1 Context Providers

`SceneEngine` establishes the following React context tree (outermost to innermost):

```
ThemeContext.Provider
  SceneRegistrationContext.Provider
    VariableStoreContext.Provider
      PluginInheritanceContext.Provider
        ActionInputExtensionContext.Provider          ← plugin wrapProvider chain applied here
          EngineStateContext.Provider
            EngineContext.Provider
              {children}
```

Plugin `wrapProvider` hooks (e.g., `modelPlugin` providing `LabelPositionerContext`) are applied between the `PluginInheritanceContext` layer and the `ActionInputExtensionContext` layer, wrapping the inner content in reverse plugin order so the first plugin is outermost.

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
