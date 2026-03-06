---
title: "BrewSite Core — Player & Runtime"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-05
change_history:
  - date: 2026-03-05
    author: "Toolkit Product"
    summary: "@brewsite/slides integration: documented that @brewsite/slides is a first-class EngineProvider consumer. SlidePlayer owns its own EngineProvider internally (inputModePolicy='prefer-direct', pixelsPerScene=600) and uses the plugin system exclusively — no widgetRegistry prop is exposed. SlidePlayer passes an EMPTY_MANIFEST_URL data-URL to EngineProvider when no GLTF assets are used, as a workaround for manifestUrl being required. This pattern is documented as a known DX gap."
  - date: 2026-03-05
    author: "Toolkit Product"
    summary: "Embedded demo integration: documented inputModePolicy, scrollHeightPx, and setRawProgress as the three EngineProvider API points consumed by @brewsite/docs DemoEngine. Added Section 7A.6 with the full embedded-direct-mode pattern: inputModePolicy='prefer-direct' + empty InputController injection + scrollHeightPx=0 + setRawProgress via DemoCaptureContext. Clarified that prefer-direct alone does not activate direct mode without an InputController in the scene tree. Added explicit note that DemoEngine from @brewsite/docs intentionally excludes scrollHeightPx and id from its prop surface — both are hardcoded internal decisions."
  - date: 2026-03-05
    author: "Toolkit Product"
    summary: "Unified-scroll docs architecture: Section 7A.6 updated to reflect that @brewsite/docs no longer uses the per-demo DemoEngine/DemoCaptureContext pattern. The embedded direct-mode pattern remains documented as a valid EngineProvider integration technique, but the @brewsite/docs implementation now uses a single app-level EngineProvider driven by ScrollCaptureSection (window scroll) with all demo scenes authored in a global docs-scenes.tsx. DemoEngine and DemoCaptureContext are deleted from @brewsite/docs. setRawProgress primary-consumer note updated accordingly."
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "NVS system: added EngineARContainer component (aspect-ratio-locked container with four scale modes, --scene-scale CSS variable). EngineOverlayHost updated to render TextBox content from VariableStore in addition to raw scene overlay ReactNodes. sceneOverlays raw JSX children pattern removed from SceneFrame — that field no longer exists. EngineARContainer exports documented in Section 7A.4. NVS package ownership table added to Section 17."
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "Cross-package theming: added EngineProvider.sceneTheme optional prop. ThemeContext documented. EngineOverlayHost CSS variable injection documented. See prd_theming.md for full SceneTheme system documentation."
  - date: 2026-03-03
    author: "Toolkit Product"
    summary: "API hardening updates: ScenePlayer removed; EngineProvider is now the primary integration component. EngineGate added as the loading gate (placeholder until first tick). EngineScrollRegion removed; EngineInputRegion is the sole input region (reads from context, no engine prop). createDefaultWidgetRegistry removed; replaced by corePlugin() + modelPlugin() plugin pattern. Section 3.1 Key Exports updated. Section 7 rewritten to document EngineProvider + EngineGate composable pattern; ScenePlayerProps type definition removed. Section 14.1 EngineScrollRegion documentation removed. SceneMetaWidget registration updated to corePlugin(). SSR section updated to reference EngineProvider and EngineGate. Open question about EngineScrollRegion deprecation removed (resolved)."
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Core customization unblocking implemented: timingProfile API (blockSize/qualityPreset/fpsCap), maxAnimBoostPerFrame option, overlayTransition config, scrollHeightMode=scroll-units with pixelsPerScrollUnit, explicit invalidateCacheToken support, and nextSceneTrackCacheToken helper export."
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the Player and Runtime layers for @brewsite/core, covering ScenePlayer, useSceneEngine, RuntimeDriverImpl, RuntimeLoop, EngineFrameDriver, all consumer hooks, context providers, DOM region components, LabelPositioner, TimelineWidget, SceneMetaWidget, asset manifest, SSR safety contract, and test infrastructure. Reflects the production implementation as of 2026-02-28."
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Scene Authoring API Simplification (plan_scene_authoring_api.md implemented). ScenePlayerProps: sceneGroup removed, children: ReactNode added, id?: string added. UseSceneEngineOptions: sceneGroup replaced with scenes: InternalSceneSpec[]. Content-hash scene extraction via serializeJsx added to ScenePlayer. ScenePlayerRegistry module added (setSceneRuntimeState, getSceneRuntimeState, subscribeSceneRuntime, unregisterSceneRuntime, hasRegisteredPlayer). useSceneRuntime hook added to player exports. HMR scaffolding (hmrVersion state, import.meta.hot subscription) removed. Debug scaffolding (__robotRuntimeDebug, debugLog, engineIdRef) removed. Compiler adapter (InternalSceneSpec[] -> SceneDefinition[]) documented."
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "DX improvements batch implemented: (1) widgetSetup is now optional — when provided, receives guaranteed non-null AssetManifest; onManifestError prop added for fetch failures. (2) quality preset prop added: 'performance'=30, 'balanced'=60, 'high'=120 framesPerTick; explicit framesPerTick wins when both present. (3) onWidgetError prop added; RuntimeDriverImpl wraps apply/onTick/load in per-widget try/catch with erroredWidgets Set quarantine. (4) debug prop added; SceneInspector component conditionally rendered and exported. (5) useVariable and VariableStoreReader added to main @brewsite/core barrel export."
  - date: 2026-03-01
    author: "Toolkit Product"
    summary: "Two features implemented. (1) Engine decomposition: EngineProvider, SceneCanvas, and EngineOverlayHost added as composable player primitives. ScenePlayer retained as thin composition of these primitives with identical public props. HudOverlay removed from internals; replaced by EngineOverlayHost. sceneOverlays: Map<string, ReactNode> and sceneIds: string[] added to UseSceneEngineResult. useSceneEngineState(id) hook added for reading engine state from outside the provider tree. (2) ProgressManager: SceneProgressMapper added to player layer; applied in scroll and direct modes. remap() and inverse() documented."
  - date: 2026-03-01
    author: "Toolkit Product"
    summary: "Added setAutoAdvancePaused to UseSceneEngineResult. Added RealtimeClock / effectiveDeltaSeconds documentation (Section 7C: Synchronized Real-Time Clock). AnimationTickContext and WidgetRenderContext context shape changes from plan_progress_driven_animation: replaced flat deltaSeconds/wallTimeSeconds with clock: RealtimeClock and effectiveDeltaSeconds."
  - date: 2026-03-01
    author: "Toolkit Product"
    summary: "Annotated LabelPositioner and labelPrimitives as model-specific concepts moving to @brewsite/model per plan_core_modularization."
---

# BrewSite Core — Player & Runtime

## 1. Overview

The Player layer is the React integration surface for `@brewsite/core`. `EngineProvider` is the primary component that a host application mounts to render an animated 3D scene, composed with `EngineARContainer` (aspect-ratio-locked container), `EngineGate` (loading gate), `EngineInputRegion` (input capture), `SceneCanvas` (Three.js canvas), and `EngineOverlayHost` (overlay tier) to form the complete integration. The Runtime layer is the frame-by-frame execution engine that drives widget ticking, scene track sampling, Three.js rendering, and state publishing. Together they form the complete playback stack: from JSX scene authoring through compilation, asset loading, frame scheduling, and reactive state propagation to host UI.

This document covers `EngineProvider` and the composable player primitives (`EngineARContainer`, `EngineGate`, `EngineInputRegion`, `SceneCanvas`, `EngineOverlayHost`), the `useSceneEngine` hook and its options, `RuntimeDriverImpl` and the per-frame tick sequence, `RuntimeLoop` and the animation frame scheduler, `EngineFrameDriver` and the React state bridge, all consumer hooks (`useEngineScroll`, `useEngineInput`, `useEngineScrubber`, `useSceneProgress`, `useCurrentScene`, `useSceneEngineState`), all context providers (`EngineStateContext`, `VariableStoreContext`, `LabelPositionerContext`, `EngineContext`, `EngineARContainerContext`), the `EngineInputRegion` DOM input region, `LabelPositioner` for 3D-to-screen projection, `TimelineWidget` for interactive scrubbing, `CameraControlPanel`, `SceneMetaWidget`, `SceneProgressMapper`, the asset manifest pipeline, the Normalized Viewport Space (NVS) layout system, and the SSR safety contract.

Affects: `@brewsite/core`.

---

## 2. Problem Statement

Three.js scene toolkits typically expose imperative APIs: create a renderer, create a scene, load assets, call render in a loop. Integrating this into a React host application requires careful management of refs, effect cleanup, hydration safety, and progress synchronization.

The BrewSite Player layer solves these integration problems once, providing a composable `<EngineProvider>` + `<EngineGate>` + `<SceneCanvas>` pattern that handles all imperative Three.js lifecycle internally. Host applications interact exclusively with props, hooks, and context — no direct Three.js API surface is exposed unless the consumer explicitly requests engine access via `useSceneEngineContext`.

The Runtime layer solves the per-frame orchestration problem: widgets must tick in a defined order, scene track state must be sampled O(1), functional transitions must evaluate at blockProgress, and the output must be pushed to React state in a way that does not cause excessive re-renders.

---

## 3. Goals and Success Metrics

**Primary goals:**
- A host application can integrate a fully animated 3D scene in under 30 lines of application code.
- EngineProvider is safe to render server-side — no crash, no hydration mismatch.
- Adding a new widget does not require changes to the Player or Runtime layers.
- The frame loop runs at 60fps on target hardware with zero React state updates per frame during steady-state playback (state updates only on tick index change, not on every animation frame).

**Success metrics:**
- EngineProvider mounts and begins rendering in under 500ms on a 100ms round-trip manifest fetch.
- Zero React re-renders per animation frame during steady-state playback with a static scene (no scene transitions).
- TypeScript props for `EngineProvider` produce compile errors for incorrect prop types with zero `any` escape hatches.
- `useCurrentScene` does not re-render its consumer on every frame — it re-renders only when `sceneId` changes.

**Guardrail metrics:**
- No `EngineProviderProps` fields may be removed or renamed in a minor version release.
- The `useSceneEngine` return shape must remain backward compatible across minor versions.

---

## 4. Non-Goals

- `EngineProvider` does not manage routing, page layout, or CSS beyond what is needed for Three.js canvas sizing.
- The Player layer does not expose a public Three.js `Scene` or `Camera` reference in the standard consumption pattern. Consumer access to engine internals is available via `useSceneEngineContext` for advanced use cases only, and is considered an escape hatch.
- Audio synchronization is out of scope for the Player layer.
- The Runtime layer does not implement physics, collision detection, or pathfinding. These belong in widget `IAnimationController` implementations.
- The Player layer does not manage React Router integration. Scene change callbacks are wired through `corePlugin({ onSceneChange })` options.
- `EngineProvider` does not manage full-page scroll position. `EngineInputRegion` is the component for integrating scene progress with document scroll or direct input.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to declare a scene in JSX and mount `<EngineProvider>` with composable layout primitives so that my three.js scene renders without writing any imperative Three.js setup code.
- As a toolkit consumer, I want to use `useCurrentScene()` to reactively update a nav indicator so that my UI reflects the active scene without wiring custom event listeners.
- As a toolkit consumer, I want `<EngineInputRegion>` to handle scroll, drag, wheel, and keyboard input so that my scene transitions as the user navigates.
- As a toolkit consumer, I want `useVariable('scene', 'id')` inside any component nested under `<EngineProvider>` so that I can build reactive overlays driven by scene metadata.
- As a toolkit consumer, I want to mount `<TimelineWidget>` inside `<EngineProvider>` so that I get a scrubbing timeline for development and debugging without additional code.
- As a server-side rendering host, I want `<EngineGate>` to render the `placeholder` prop during SSR and until the engine's first tick so that my page has no layout shift and no hydration mismatch.

---

## 6. Functional Requirements

1. `EngineProvider` shall accept `children: ReactNode`, `manifestUrl`, and `plugins` as primary props. `children` must consist of `<Scene key="...">` elements plus layout primitives (`EngineGate`, `EngineInputRegion`, etc.). All other props are optional.
2. `EngineProvider` shall fetch the manifest from `manifestUrl` and pass the parsed result to each plugin via `IWidgetPlugin.register(registry, manifest)` to construct the `WidgetRegistry`.
3. `EngineGate` shall render the `placeholder` prop while `frameState.tickIndex < 0` (before the first tick completes), then render `children`.
4. `EngineProvider` shall call `onManifestError` if manifest fetching fails. The engine continues operating with whatever plugins were already registered.
5. Scene change callbacks shall be wired via `corePlugin({ onSceneChange })` options. `SceneMetaWidget` (registered by `corePlugin()`) fires the callback when the active scene changes.
6. `EngineProvider` shall support Vite HMR automatically via content-hash compilation. When Vite HMR causes a parent component re-render, the `<Scene>` JSX elements are re-created. `serializeJsx` produces a new `contentKey` if any prop changed. If the `sceneContentKey` changes, `useMemo` fires and recompilation is triggered naturally. No manual `import.meta.hot` subscription, `hmrVersion` state counter, or `clearRegistry` call is needed or present.
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
17. `EngineProvider` shall be SSR-safe: all Three.js and DOM initialization shall be deferred to `useEffect`. On the server, `EngineGate` renders `placeholder` (if provided) or `null`.
18. `corePlugin()` shall be accessible from `@brewsite/core` player exports. Pairing `corePlugin()` with `modelPlugin()` from `@brewsite/model` provides complete widget coverage for scenes with GLTF models.

---

## 7. EngineProvider: Primary Integration Component

`EngineProvider` is the primary component for integrating BrewSite scenes into a host application. It establishes the engine context tree and manages the Three.js engine lifecycle. Compose it with `EngineGate` (loading gate), `EngineInputRegion` (input capture), `SceneCanvas` (Three.js canvas), and `EngineOverlayHost` (overlay tier) to build the complete player integration.

**Canonical integration pattern:**

```tsx
import {
  EngineProvider, EngineGate, EngineInputRegion,
  SceneCanvas, EngineOverlayHost, corePlugin,
} from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

const PLUGINS = [
  corePlugin({ onSceneChange: (id) => console.log('scene:', id) }),
  modelPlugin(manifest),
];

export default function Page() {
  return (
    <EngineProvider
      id="main"
      manifestUrl="/manifest.json"
      plugins={PLUGINS}
      framesPerTick={100}
      pixelsPerScene={1600}
    >
      <Scene key="intro">...</Scene>
      <EngineGate placeholder={<Spinner />}>
        <EngineInputRegion>
          <SceneCanvas />
          <EngineOverlayHost />
        </EngineInputRegion>
      </EngineGate>
    </EngineProvider>
  );
}
```

Define `PLUGINS` at module scope (or via `useMemo`) to keep the array reference stable across renders and avoid restarting asset loading.

Full `EngineProviderProps` documentation is in **Section 7A.1**. Full `EngineGateProps` documentation is below.

### 7.1 EngineGate

`EngineGate` renders its `placeholder` until the engine produces its first frame (`tickIndex >= 0`), then renders `children`. It is the standard loading gate for `EngineProvider` integrations and must be placed inside an `EngineProvider` tree.

```typescript
type EngineGateProps = {
  /** Rendered while the engine has not yet produced its first frame. Defaults to null. */
  placeholder?: ReactNode;
  children: ReactNode;
};

const EngineGate: React.FC<EngineGateProps>;
```

`EngineGate` reads `tickIndex` from `EngineStateContext`. Any component that needs the engine's first-frame guarantee (canvas sizing, overlay positioning, label registration) should be nested inside `EngineGate`.

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

`EngineProvider` performs the following operations on each render:

**Scene extraction and content hashing (every render, synchronous):**
1. Calls `Children.toArray(props.children)` to collect all children.
2. Filters for `<Scene>` elements; emits `console.warn` for any non-`<Scene>` children.
3. Builds `InternalSceneSpec[]`: for each `<Scene>` element, reads `element.key` (warns and falls back to index string if absent), and computes `contentKey = serializeJsx(element)`.
4. Computes `sceneContentKey` — concatenation of all `contentKey` strings, separated by `'|||'`.
5. `useMemo([sceneContentKey])` — `scenes: InternalSceneSpec[]` reference is stable when content is identical, changes when any scene prop changes.

**On mount:**
6. Starts manifest fetch from `manifestUrl`. On success, calls `assertManifestValid(raw)` and stores the result.
7. Constructs `WidgetRegistry` by invoking each plugin via `IWidgetPlugin.register(registry, manifest)` inside `useMemo`.
8. Constructs a `LabelPositioner` instance and a `VariableStore` instance (both stable across re-renders).
9. Calls `useSceneEngine` with the registry, manifest, clip metadata, `scenes`, and configuration options.
10. `SceneMetaWidget` (registered by `corePlugin()`) fires scene change callbacks via its own internal wiring.
11. Renders the full context provider tree: `VariableStoreContext`, `LabelPositionerContext`, `EngineStateContext`, `EngineContext`.
12. Renders `EngineInputRegion` as the primary viewport container.
13. Renders `SceneCanvas`, `EngineOverlayHost`, `LabelItem` elements, optional `TimelineWidget`, and overlay children inside the input region.

**Runtime state publishing (when `id` prop is set):**
14. A `useEffect` publishes `SceneRuntimeState` to `ScenePlayerRegistry` on every change to `assetsReady`, viewport dimensions, `variableStore`, or `scenes.length`. Consumers using `useSceneRuntime(id)` receive these updates reactively.
15. On unmount, calls `unregisterSceneRuntime(id)` to clean up the registry entry.

On server (SSR), `EngineProvider` short-circuits at `typeof window === 'undefined'` and defers all engine initialization. `EngineGate` returns `placeholder ?? null` on the server code path. No Three.js imports are invoked.

---

## 7A. Composable Player Primitives

The composable player primitives allow host applications to construct custom canvas layouts. Each primitive is independently exported from `@brewsite/core`.

### 7A.1 EngineProvider

`EngineProvider` creates the engine and establishes all React context providers. It renders no DOM elements itself — it is a pure context tree wrapper. Compose it with `SceneCanvas` and `EngineOverlayHost` to construct custom layouts.

```typescript
type EngineProviderProps = {
  // Scene content — required
  children: ReactNode;

  // Player identity
  id?: string;

  // Required configuration
  manifestUrl: string;

  // Widget configuration
  widgetSetup?: (manifest: AssetManifest) => WidgetRegistry;

  // Engine configuration
  fpsCap?: number;
  pixelsPerScene?: number;
  framesPerTick?: number;
  quality?: 'performance' | 'balanced' | 'high';

  // Input
  inputMap?: SceneNavInputMap;
  /**
   * Controls whether the engine derives input mode from scene content (`'auto'`),
   * prefers scroll mode (`'prefer-scroll'`), or prefers direct mode (`'prefer-direct'`).
   *
   * `'prefer-direct'` activates direct mode ONLY when at least one `<Scene>` child
   * contains an `<InputController>`. Without an `<InputController>`, it falls back to scroll
   * mode regardless of this setting. `DemoEngine` from `@brewsite/docs` combines
   * `inputModePolicy="prefer-direct"` with automatic `<InputController>` injection to
   * prevent scroll spacer creation while keeping the engine in direct mode.
   *
   * Defaults to `'auto'`.
   */
  inputModePolicy?: InputModePolicy;
  /**
   * Fixed height in pixels for the scroll spacer element. When provided, overrides the
   * default `pixelsPerScene * sceneCount` calculation. `DemoEngine` from `@brewsite/docs`
   * passes `scrollHeightPx={0}` to suppress the scroll spacer entirely — the demo is
   * driven by direct `setRawProgress` calls from wheel event interception, not by
   * `window.scrollY`. Only meaningful in scroll mode; ignored when the engine resolves
   * to direct mode.
   */
  scrollHeightPx?: number;

  // Controlled progress mode
  controlledProgress?: number;
  onControlledProgressChange?: (progress: number) => void;

  // Lifecycle callbacks
  onReady?: () => void;
  onError?: (error: Error) => void;
  onManifestError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warning: CompileWarning) => void;
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;

  // Widget defaults
  defaultModelStates?: Record<string, unknown>;

  /**
   * Optional scene theme token set for cross-package visual styling.
   *
   * When provided: EngineOverlayHost reads the theme via ThemeContext and injects
   * CSS custom properties on its overlay container, making font family, font sizes,
   * color mode, and text colors available to all overlay content.
   *
   * CSS variables injected: --brewsite-font-family, --brewsite-font-size-{heading,body,
   * label,caption,annotation}, --brewsite-color-mode, --brewsite-text-primary,
   * --brewsite-text-secondary, --brewsite-accent-color (conditional).
   *
   * Static for the player lifetime — does not change per scene. For per-scene background
   * changes, use <Background theme={...} /> in each scene.
   *
   * The webglFontUrl token is NOT auto-plumbed to WebGL renderers — pass the sceneTheme
   * explicitly to DiagramTheme.sceneTheme or ChartTheme.sceneTheme / ChartDSL.sceneTheme.
   *
   * See requirements/core/prd/prd_theming.md for full documentation.
   */
  sceneTheme?: SceneTheme;
};
```

**When to use `EngineProvider` directly:**
- Custom canvas layout (grid, flex, portal, absolute positioning outside the document flow)
- Multiple canvases registered against a single engine
- Overlay content hosted in a separate React subtree or DOM portal
- Integration with a custom input region

**Context tree established by `EngineProvider`:**
```
VariableStoreContext.Provider
  LabelPositionerContext.Provider
    EngineStateContext.Provider
      EngineContext.Provider
        {children}
```

All player hooks (`useCurrentScene`, `useSceneProgress`, `useVariable`, `useEngineState`, `useSceneEngineContext`) require an `EngineProvider` ancestor.

### 7A.2 SceneCanvas

`SceneCanvas` renders the `<canvas>` element and registers it with the engine via `EngineContext`. It owns the `ResizeObserver` that keeps `engine.setViewportSize` current. `SceneCanvas` must be rendered inside an `EngineProvider` tree.

```typescript
type SceneCanvasProps = React.CanvasHTMLAttributes<HTMLCanvasElement> & {
  /**
   * ReactElement rendered while the engine is initializing (tickIndex < 0).
   * Overlaid absolutely over the canvas with pointer-events: none.
   */
  placeholder?: ReactElement;
};

const SceneCanvas = React.forwardRef<HTMLCanvasElement, SceneCanvasProps>(
  (props, ref) => { ... }
);
```

- `ref` forwards to the raw `HTMLCanvasElement`.
- Any `CanvasHTMLAttributes` prop (`className`, `style`, `id`, `aria-*`) is passed through to the underlying `<canvas>`.
- The `ResizeObserver` is attached to the canvas's parent container element. When the parent resizes, `engine.setViewportSize(width, height)` is called and the Three.js renderer is resized accordingly.

### 7A.3 EngineOverlayHost

`EngineOverlayHost` renders the compiled `TextBox` overlay content for the current scene, positioned in NVS coordinates over the canvas. It must be rendered inside an `EngineProvider` tree, and it must be rendered inside an `EngineARContainer` so that NVS coordinates resolve correctly against the AR-locked viewport.

```typescript
type EngineOverlayHostProps = {
  /** Additional CSS class applied to the overlay container div. */
  className?: string;
  /**
   * When true, the overlay container passes pointer events through to elements
   * beneath it. Individual overlay children can still re-enable with
   * style={{ pointerEvents: 'auto' }}.
   * Default: false (overlay receives and absorbs pointer events).
   */
  passthroughPointerEvents?: boolean;
};

const EngineOverlayHost: React.FC<EngineOverlayHostProps>;
```

**Behavior:**
- Reads `engine.frameState.sceneId` from `EngineContext`.
- Reads all `TextBoxState` entries keyed under `"textbox:{id}"` from the `VariableStore` for the current scene. These are written by the `TextBoxWidget` during `onTick`.
- Reads `ThemeContext` (provided by `EngineProvider`) and — when a `SceneTheme` is present — injects CSS custom properties on the overlay container div.
- Renders each `TextBoxState` as an absolutely positioned `div` whose `left`, `top`, `width`, and `height` are derived from the `TextBoxState.nvsBounds` NVS rectangle, converted to percentage values against the container (which is AR-locked by `EngineARContainer`).
- Renders the overlay inside a `div` with `position: absolute; inset: 0; overflow: hidden`.
- Uses `key={sceneId}` on the inner overlay div to trigger a React remount on scene change, which applies a CSS fade-in transition.
- When `passthroughPointerEvents` is false (default), the container div has `pointer-events: auto`. When true, `pointer-events: none`.

**Removed:** `sceneOverlays` — the previous pattern of authoring raw HTML children directly inside `<Scene>` (collected as `SceneFrame.sceneOverlay: ReactNode`) has been removed. `SceneFrame` no longer has a `sceneOverlay` field. All overlay content is now authored via the `<TextBox>` DSL element.

**CSS variable injection (when `EngineProvider.sceneTheme` is set):**

`EngineOverlayHost` reads `ThemeContext` and injects these CSS custom properties on its root container:

| CSS Variable | Derived From |
|---|---|
| `--brewsite-font-family` | `theme.font.htmlFamily` |
| `--brewsite-font-size-heading` | `calc(1rem * theme.fontSize.heading)` |
| `--brewsite-font-size-body` | `calc(1rem * theme.fontSize.body)` |
| `--brewsite-font-size-label` | `calc(1rem * theme.fontSize.label)` |
| `--brewsite-font-size-caption` | `calc(1rem * theme.fontSize.caption)` |
| `--brewsite-font-size-annotation` | `calc(1rem * theme.fontSize.annotation)` |
| `--brewsite-color-mode` | `'dark'` or `'light'` |
| `--brewsite-text-primary` | `#ffffff` (dark) / `#111111` (light) |
| `--brewsite-text-secondary` | `rgba(255,255,255,0.6)` (dark) / `rgba(0,0,0,0.6)` (light) |
| `--brewsite-accent-color` | `theme.accentColor` — only set when present |

`fontFamily: 'var(--brewsite-font-family)'` is also set as an inline style on the container so that CSS inheritance propagates the font to all overlay children and DOM labels automatically.

When no `sceneTheme` is provided, no CSS variables are injected and overlay behavior is unchanged.

**Scene change transition:**
The overlay container uses a CSS fade-in on mount, keyed by `sceneId`. This gives a smooth crossfade effect when navigating between scenes that have overlay content.

**Example: canonical layout with EngineARContainer:**

```tsx
import {
  EngineProvider, EngineARContainer, EngineGate, EngineInputRegion,
  SceneCanvas, EngineOverlayHost, corePlugin,
} from '@brewsite/core';

function App() {
  return (
    <EngineProvider
      id="main"
      manifestUrl="/manifest.json"
      plugins={[corePlugin()]}
    >
      <Scene key="intro">
        <Camera descriptor={{ mode: 'world', position: [0, 1, 5], target: [0, 0, 0] }} />
        <TextBox id="headline" x={0.1} y={0.1} w={0.4} h={0.2}>
          <h1>Hello World</h1>
        </TextBox>
      </Scene>

      <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width">
        <EngineGate placeholder={<Spinner />}>
          <EngineInputRegion>
            <SceneCanvas />
            <EngineOverlayHost />
          </EngineInputRegion>
        </EngineGate>
      </EngineARContainer>
    </EngineProvider>
  );
}
```

### 7A.4 EngineARContainer

`EngineARContainer` maintains a fixed aspect ratio for the engine viewport. It wraps `SceneCanvas`, `EngineOverlayHost`, and `EngineInputRegion` to form the AR-locked spatial frame against which all NVS coordinates are resolved. `EngineARContainer` is required when using `<TextBox>` elements or any widget that implements `INVSBounded`.

```typescript
export type ScaleMode = 'fit-width' | 'fit-height' | 'contain' | 'cover';

export type EngineARContainerProps = {
  /**
   * Fixed aspect ratio for the engine container.
   * All 3D content and NVS-positioned elements are authored for this AR.
   * Default: 16 / 9
   */
  aspectRatio?: number;

  /**
   * The pixel width at which --scene-scale = 1.0.
   * TextBox content authored in reference-resolution pixels scales proportionally
   * from this baseline. Default: 1920
   */
  referenceWidth?: number;

  /**
   * How the fixed-AR container fits inside the available parent space.
   *
   * 'fit-width'  — Width fills the parent; height is derived from AR. Default.
   * 'fit-height' — Height fills the parent; width is derived from AR.
   * 'contain'    — Both dimensions fit; the shorter axis letterboxes.
   * 'cover'      — Both dimensions fill; content that exceeds bounds is clipped.
   */
  scaleMode?: ScaleMode;

  /** className applied to the AR-locked container div. */
  className?: string;

  /**
   * style applied to the outer wrapper div (not the AR container).
   * Use to set the background color of letterbox areas.
   */
  style?: React.CSSProperties;

  /** All children — SceneCanvas, EngineOverlayHost, EngineInputRegion, etc. */
  children: React.ReactNode;
};

export const EngineARContainer: React.FC<EngineARContainerProps>;
```

**`--scene-scale` CSS variable:**

`EngineARContainer` measures its rendered pixel dimensions via `ResizeObserver` and injects a `--scene-scale` CSS custom property on the container element on every resize. The value is computed as `containerWidth / referenceWidth`. All `TextBox` content uses `calc(Xpx * var(--scene-scale))` for sizing, which causes authored-at-reference-resolution pixel values to scale proportionally across any viewport.

**Context:**

`EngineARContainer` provides `EngineARContainerContext` to its children. Use this context when a child component needs the current container dimensions.

```typescript
export type EngineARContainerContextValue = {
  containerWidth: number;
  containerHeight: number;
  referenceWidth: number;
  scaleMode: ScaleMode;
};

export const EngineARContainerContext =
  React.createContext<EngineARContainerContextValue>({
    containerWidth: 0,
    containerHeight: 0,
    referenceWidth: 1920,
    scaleMode: 'fit-width',
  });
```

**SSR safety:** `EngineARContainer` defers `ResizeObserver` setup to `useEffect`, so it renders safely on the server with `containerWidth: 0, containerHeight: 0`.

**Source:** `packages/core/src/player/EngineARContainer.tsx`

### 7A.5 useSceneEngineState

`useSceneEngineState(id)` reads current engine state from `ScenePlayerRegistry` via `useSyncExternalStore`. It works from anywhere in the React tree — no `EngineProvider` ancestor is required. It returns `null` when no engine with the given `id` is registered.

```typescript
type SceneEngineSnapshot = {
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
  progress: number;
};

const useSceneEngineState = (id: string): SceneEngineSnapshot | null;
```

**When to use:**
- Reading engine progress from a component in a different React subtree (e.g., a navigation bar outside the canvas container)
- Coordinating multiple engines on a page without prop-drilling
- Reading scene state in a portal-rendered component

**Update frequency:** Updates on every tick index change (same cadence as `EngineStateContext`). Does not update on every animation frame.

**Null behavior:** Returns `null` when no `<EngineProvider id={id}>` has registered. Callers must handle the null case.

**Example:**
```typescript
function NavBar() {
  const state = useSceneEngineState('main-player');

  if (!state) return null;

  return (
    <nav>
      <span>Scene {state.sceneIndex + 1}</span>
      <span>{Math.round(state.progress * 100)}%</span>
    </nav>
  );
}
```

### 7A.6 Embedded Direct-Mode Integration Pattern

`EngineProvider` supports an **embedded direct-mode** configuration for use inside host pages where the engine must not create a scroll spacer, must not read `window.scrollY`, and must instead be driven imperatively via `setRawProgress`. This is a general-purpose pattern available to any host application.

**Requirements for embedded direct-mode operation:**

1. **`inputModePolicy="prefer-direct"`** — Requests direct mode. Alone, this does _not_ activate direct mode — the engine falls back to scroll if no `<InputController>` is present in any scene.

2. **Empty `<InputController>` in the scene tree** — The scene DSL must include at least one `<InputController>` (with no `<Action>` children) inside a `<Scene>`. This is the condition that `inputModePolicy="prefer-direct"` checks before switching to direct mode. A host may inject this automatically or require the scene author to include it explicitly.

3. **`scrollHeightPx={0}`** — Suppresses the scroll spacer element. Even in direct mode, the engine renders a spacer defaulting to viewport height. Pass `scrollHeightPx={0}` to eliminate it when the engine is embedded inside a host that manages its own scroll.

4. **`setRawProgress`** — Call `setRawProgress(value)` (obtained from `useSceneEngine`) to imperatively push progress into the engine. The engine enters "push" mode on first call; subsequent `window.scrollY` reads are ignored until `scrollToProgress` relinquishes control.

**Minimal example:**
```tsx
<EngineProvider
  manifestUrl={manifestUrl}
  plugins={plugins}
  inputModePolicy="prefer-direct"
  scrollHeightPx={0}
>
  <Scene id="my-scene">
    <InputController /> {/* empty — satisfies hasSceneInputController */}
    {/* scene content */}
  </Scene>
  <SceneCanvas />
  <EngineARContainer>
    <EngineOverlayHost />
    <EngineInputRegion />
  </EngineARContainer>
</EngineProvider>
```

**Do not** render `<EngineInputRegion>` outside the `<EngineARContainer>` in an embedded configuration — it would register pointer/wheel handlers against the wrong viewport bounds and interfere with the host page's own scroll.

**Note on `@brewsite/docs`:** The docs application no longer uses the embedded direct-mode pattern per demo section. As of 2026-03-05, `@brewsite/docs` uses a single app-level `EngineProvider` in standard scroll mode, driven by `ScrollCaptureSection` reading `window.scrollY`. All 34 demo scenes are authored in a single global `docs-scenes.tsx`. The per-demo `DemoEngine` and `DemoCaptureContext` components have been deleted.

---

## 7B. SceneProgressMapper

`SceneProgressMapper` is a utility class in the player layer that applies per-scene `ProgressManagerSpec` pacing curves to raw input progress. It is constructed from `SceneTrack.progressProfile` and consulted by the progress tracking layer on every frame.

```typescript
// packages/core/src/player/SceneProgressMapper.ts

class SceneProgressMapper {
  constructor(profile: SceneProgressProfile);

  /**
   * Hot path — called every frame in scroll and direct modes.
   * Maps raw input progress [0, 1] to engine progress [0, 1] by
   * applying each scene's ProgressManagerSpec.fn pacing curve within
   * its normalized segment boundary.
   */
  remap(rawProgress: number): number;

  /**
   * Cold path — called by scrollToProgress() only.
   * Inverse of remap: maps engine progress [0, 1] back to raw input
   * progress [0, 1]. Used to calculate the scroll position to jump to
   * when the caller requests a specific engine progress value.
   */
  inverse(engineProgress: number): number;
}
```

**When a mapper is active:** `SceneProgressMapper` is constructed when `SceneTrack.progressProfile` is present (i.e., at least one scene declared a `<ProgressManager>`). When `progressProfile` is absent (no `<ProgressManager>` in any scene), the identity mapping is used — no `SceneProgressMapper` is instantiated.

**Mode scope:** `remap` is applied in scroll mode and direct mode. It is not applied when `controlledProgress` is set on `EngineProvider` (the caller provides engine progress directly).

**`inverse` usage:** `scrollToProgress(engineProgress)` converts the requested engine progress through `mapper.inverse(engineProgress)` before setting scroll position or direct-mode progress state. This ensures that a call like `scrollToProgress(0.5)` jumps to the scroll position that produces engine progress 0.5, not raw progress 0.5.

---

## 7C. Synchronized Real-Time Clock

The engine exposes a `RealtimeClock` on every tick context for widget authors.

```typescript
type RealtimeClock = {
  wallTimeSeconds: number;  // absolute time from performance.now()/1000, never backlogs on tab hide/show
  deltaSeconds: number;     // real-time frame delta, ~0.0167s at 60fps
};
```

Additionally, tick contexts carry:

```typescript
effectiveDeltaSeconds: number
```

`effectiveDeltaSeconds` is the scroll-boosted delta for `IAnimationController.onTick()` and `IRenderable.apply()`. It equals `deltaSeconds` when the user is idle. When `animationTimeScale` is declared on `<ProgressManager>`, it increases proportionally with scroll speed so that GLTF animation mixers advance at the correct rate relative to scene progress.

Widget authoring guidance:

| Animation type          | Field                    | Example                                                      |
|-------------------------|--------------------------|--------------------------------------------------------------|
| Ambient oscillation     | `clock.wallTimeSeconds`  | `Math.sin(clock.wallTimeSeconds * freq)`                     |
| Physics / smooth incr.  | `clock.deltaSeconds`     | `this.vel += accel * clock.deltaSeconds`                     |
| GLTF AnimationMixer     | `effectiveDeltaSeconds`  | `mixer.update(ctx.effectiveDeltaSeconds)`                    |
| Camera controls damping | `effectiveDeltaSeconds`  | `cameraControls.update(ctx.effectiveDeltaSeconds)`           |

---

## 8. useSceneEngine Hook

`useSceneEngine` is the stateful hook that owns the Three.js engine lifecycle. It is called by `EngineProvider` internally and is not intended for direct use by host applications in the standard integration pattern. It is exported for advanced consumers who need to compose the engine with custom container components.

### 8.1 Options

```typescript
// InternalSceneSpec — internal to player layer, not exported
type InternalSceneSpec = {
  readonly sceneKey: string;     // React key or index-derived fallback
  readonly contentKey: string;   // serializeJsx output — changes when any prop changes
  readonly element: ReactElement; // the <Scene> element passed to the compiler
};

type UseSceneEngineOptions = {
  scenes: InternalSceneSpec[];   // replaces sceneGroup: SceneGroup
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

> **Note:** `LabelPositioner` is part of `@brewsite/model` and will be removed from
> `UseSceneEngineOptions` in the major version release that extracts `@brewsite/model`.
> Current consumers can continue using it; migration guidance will accompany that release.

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
  /** All scene IDs in playback order. Derived from InternalSceneSpec[]. */
  sceneIds: string[];
  variableStore: VariableStore;
  setCanvasRef: (canvas: HTMLCanvasElement | null) => void;
  setBackgroundRef: (element: HTMLDivElement | null) => void;
  setViewportSize: (width: number, height: number) => void;
  getCamera: () => THREE.PerspectiveCamera | null;
  getRenderer: () => THREE.WebGLRenderer | null;
  setCameraOverride: (next: CameraOverrideState | null) => void;
  getCameraOverride: () => CameraOverrideState | null;
  /**
   * Pauses or resumes idle auto-advance for all scenes in this engine instance.
   * Instance-scoped: does not affect other EngineProvider instances on the same page.
   * When paused: true, the auto-advance clock is frozen regardless of idle state.
   * When paused: false, the clock resumes from where it stopped.
   * Typical use: pause when a modal opens, resume when it closes.
   */
  setAutoAdvancePaused: (paused: boolean) => void;
  /**
   * Imperatively pushes a raw progress value [0, 1] into the engine, bypassing
   * `window.scrollY`. Switches the engine to "push" mode on first call. Subsequent
   * scroll events are ignored until `scrollToProgress` is called to relinquish control.
   *
   * Reference is stable across renders (wrapped in `useCallback([])`). Safe to store
   * in a ref or pass to a non-React callback without risk of stale closure.
   *
   * Useful for any host that drives engine progress imperatively (e.g., a slide player,
   * an embedded demo, or a custom scroll driver). See Section 7A.6.
   */
  setRawProgress: (raw: number) => void;
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

**`sceneIds`** — Ordered array of all scene IDs. Derived from `InternalSceneSpec[]` in playback order. Stable reference as long as scene keys do not change. Used by `TimelineWidget` for scene label rendering.

**`sceneOverlays`** — Map from scene ID to `ReactNode`. Populated from non-DSL children of `<Scene>` elements, collected by `compileChildrenSeparated`. Always present on the result. `EngineOverlayHost` reads `sceneOverlays.get(frameState.sceneId)` each render to display the current scene's overlay.

**`variableStore`** — The `VariableStore` instance shared across all widgets and React components in this engine instance.

**`setCanvasRef`** — Callback ref for the Three.js canvas element. When a canvas element mounts, the engine creates the `THREE.WebGLRenderer` against it.

**`setBackgroundRef`** — Callback ref for the background div element. Wired to `BackgroundWidget` if registered, enabling DOM-level background color/image transitions.

**`setViewportSize(width, height)`** — Called by `EngineInputRegion` on mount and on resize. Updates renderer size, camera aspect ratio, and label positioner container size.

**`setCameraOverride` / `getCameraOverride`** — Set and get a `CameraOverrideState` that is applied by `CameraWidget` each frame, overriding the compiled camera state. Used by camera orbit/dolly interaction handlers.

**`setAutoAdvancePaused(paused)`** — Pauses or resumes idle auto-advance for all scenes in this engine instance. Instance-scoped: does not affect other `EngineProvider` instances on the same page. When `paused: true`, the auto-advance clock is frozen regardless of idle state; when `paused: false`, the clock resumes from where it stopped. Use this to pause auto-advance while a modal or overlay is open, then resume when it closes.

**`setRawProgress(raw)`** — Imperatively pushes a raw progress value `[0, 1]` into the engine, bypassing `window.scrollY`. Puts the engine in "push" mode on first call; subsequent scroll events are ignored until `scrollToProgress` is called to relinquish control. The reference is stable across renders — it is safe to capture once and call from a non-React callback. The primary consumer is `DemoCaptureContext` in `@brewsite/docs`, which registers this function during `DocsDemo` mount and calls it with normalized wheel deltas to drive the embedded `DemoEngine` from scroll gestures captured inside the demo viewport.

**`debug`** — Development diagnostic object. Contains `driverReady`, `assetsReady`, `sceneTrackTicks`, and viewport dimensions. Used internally by `EngineProvider` to publish `SceneRuntimeState` to the `ScenePlayerRegistry`. Not intended for direct use by consumers.

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

**Phase 1 — Scene Track Compilation:** Triggered when `scenes` (the `InternalSceneSpec[]` reference from `useMemo`), `widgetRegistry`, `clipMeta`, `manifest`, `blockSize`, or `prefersReducedMotion` changes. Computes a cache key via `buildSceneTrackKey({ scenes, ... })` — the key uses each spec's `contentKey` field, so any prop change in any scene produces a cache miss. If a matching cached track exists, it is used directly. Otherwise a `SceneDefinition[]` adapter is constructed from `scenes` via `useMemo` and `compileSceneTrack` runs. The result is cached.

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
  /** Called when a single widget fails during load(), onTick(), or apply(). Engine continues. */
  onWidgetError?: (widgetId: string, error: Error) => void;
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

At construction time, `RuntimeDriverImpl` reads the sorted widget collections from the registry once (`getSceneElements()`, `getRenderables()`, `getAnimationControllers()`, `getContainedModels()`) and stores them as private arrays. These collections do not change after construction — the registry is treated as immutable after plugins are registered.

### 9.2 Initialization

`initialize(scene, renderer)` performs two sequential steps:

1. **Synchronous widget initialization:** Calls `renderable.initialize({ scene, widgetId, renderer })` for every `IRenderable` in order. If any widget throws, the error is forwarded to `onError` and re-thrown (halting initialization).

2. **Parallel asset loading:** Calls `w.load(manifest)` on all `ILoadable` widgets via `Promise.all`. Each load call is individually wrapped in a try/catch — a widget that fails to load is added to `erroredWidgets` and `onWidgetError` is fired, but the promise resolves (not rejects) so the parallel chain continues. On all resolutions (success and failure), calls `attachContainedModels()` for successfully loaded models, sets `assetsReady = true`, and fires `onAssetsReady`.

### 9.3 Per-Frame Tick Sequence

`tick({ deltaSeconds, globalProgress, wallTimeSeconds })` executes in this order every animation frame. The driver constructs a `RealtimeClock` from `wallTimeSeconds` and `deltaSeconds`, and computes `effectiveDeltaSeconds` from `deltaSeconds` and the current scene's `animationTimeScale` (if declared). Both are provided to all `AnimationTickContext` and `WidgetRenderContext` instances built this frame.

The `AnimationTickContext` shape is:

```typescript
type AnimationTickContext = {
  clock: RealtimeClock;           // synchronized real-time clock
  effectiveDeltaSeconds: number;  // scroll-boosted delta; equals clock.deltaSeconds when idle
  scene: THREE.Scene;
  variables: VariableStore;
  tick: SceneTrackTick | null;
  track?: SceneTrack | null;
};
```

The `WidgetRenderContext` shape is:

```typescript
type WidgetRenderContext = {
  clock: RealtimeClock;           // synchronized real-time clock
  effectiveDeltaSeconds: number;  // scroll-boosted delta; equals clock.deltaSeconds when idle
  globalProgress: number;
  variables: VariableStoreReader;
  extra: unknown;
  tick?: SceneTrackTick | null;
};
```

See Section 7C for the `RealtimeClock` type definition and widget authoring guidance.

```
1. For each IAnimationController (ascending tickPriority):
   — Skip if widgetId is in erroredWidgets
   — try { controller.onTick({ clock, effectiveDeltaSeconds, ... }) } catch → add to erroredWidgets, fire onWidgetError

2. Sample SceneTrack:
   currentTick = sampler.sample(globalProgress)  // O(1) array index lookup

3. Apply per-block easing to blockProgress (if SceneTrack.transitionEasings[sceneIndex] set):
   bp = getEasingFn(easingName)(tick.blockProgress)

4. For each IRenderable:
   — Skip if widgetId is in erroredWidgets
   a. Check for FunctionalTransitionSpec block at tick.sceneIndex
      - If present: state = functionalBlock.widgetFns[widgetId].fn(bp)
   b. Else: state = tick.state.widgets[widgetId] ?? defaultState
   c. extra = tick.widgetExtras?.[widgetId]
   — try { renderable.apply(state, { clock, effectiveDeltaSeconds, ..., tick }) } catch → add to erroredWidgets, fire onWidgetError
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

## 12. serializeJsx and Content-Hash Compilation

### 12.1 serializeJsx

`serializeJsx` is an internal utility used by `EngineProvider` to detect scene content changes between renders. It is not exported from the player public API.

```typescript
// packages/core/src/player/serializeJsx.ts — internal

const serializeJsx = (value: unknown, depth = 0): string;
```

Converts a JSX element tree to a stable, deterministic string for cache key computation and recompilation detection. Called once per scene element on each parent render (sub-millisecond for typical scenes).

**Serialization rules:**
- Primitives (boolean, number, string, null, undefined) — stringified directly
- Functions — serialized to `displayName` → `name` → `'[fn]'`
- Arrays — each element serialized recursively
- React elements — type name + sorted prop key/value pairs + children
- Plain objects — sorted key/value pairs
- Depth > 15 — returns `'[deep]'` (prevents stack overflow on pathological inputs)

**Design constraint:** DSL components must not accept function-valued props that affect compiled output. The `[fn]` serialization for anonymous functions is intentional — it means two renders with the same anonymous callback produce the same `contentKey`. Authors who need dynamic scene content should pass concrete values (not callbacks) or use `useSceneRuntime()`.

### 12.2 ScenePlayerRegistry

`ScenePlayerRegistry` is a module-level registry that enables `useSceneRuntime()` to read engine-internal state from outside the `<EngineProvider>` React subtree. It is not exported from the player public API.

```typescript
// packages/core/src/player/ScenePlayerRegistry.ts — internal

export type SceneRuntimeState = {
  readonly assetsReady: boolean;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly aspectRatio: number;
  };
  readonly variables: VariableStoreReader | undefined;
  readonly numScenes: number;
};

// Published by EngineProvider when id prop is set
export const setSceneRuntimeState: (id: string, state: SceneRuntimeState) => void;
export const getSceneRuntimeState: (id: string) => SceneRuntimeState;
export const subscribeSceneRuntime: (id: string, listener: () => void) => () => void;
export const unregisterSceneRuntime: (id: string) => void;
// Dev-mode check: returns true if an EngineProvider with this id has registered
export const hasRegisteredPlayer: (id: string) => boolean;
```

### 12.3 useSceneRuntime

```typescript
// packages/core/src/player/useSceneRuntime.ts

export const useSceneRuntime = (playerId: string): SceneRuntimeState;
```

Reads reactive runtime state published by `<EngineProvider id={playerId}>`. Uses `useSyncExternalStore` for concurrent-mode safety. When `assetsReady`, viewport, `variables`, or `numScenes` change, subscribers re-render automatically.

**Recompile flow:**
1. Assets finish loading → `engine.debug.assetsReady` → `true`
2. EngineProvider's publish effect fires → `setSceneRuntimeState` → notifies listeners
3. Parent component re-renders via `useSceneRuntime`
4. New JSX produces different `contentKey` via `serializeJsx`
5. `sceneContentKey` changes → `useMemo` fires → new `scenes` reference
6. Compilation effect fires → cache miss → `compileSceneTrack` → new `SceneTrack`

**Dev-mode footgun warning:** If `useSceneRuntime(id)` is called but no `<EngineProvider id={id}>` registers within 1000ms, a `console.warn` is emitted. Gated on `process.env.NODE_ENV !== 'production'`.

## 13. Consumer Hooks

### 13.1 useEngineScroll

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

### 13.2 useEngineInput

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

### 13.3 useEngineScrubber

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

### 13.4 useSceneProgress

```typescript
const useSceneProgress = (): number
```

Returns the current global progress value [0, 1] from `EngineStateContext`. Re-renders on every tick index change. Used by progress indicators and overlay components that need to track scene advancement.

### 13.5 useCurrentScene

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

### 13.6 useEngineState

```typescript
const useEngineState = (): EngineState
```

Returns the full `EngineState` (`progress`, `sceneId`, `sceneIndex`, `sceneProgress`) from `EngineStateContext`. Throws if called outside `<EngineProvider>`. Used internally by `useSceneProgress` and `useCurrentScene`. Direct use is appropriate for custom overlays that need multiple state values.

---

## 14. Context Providers

All context providers are established by `EngineProvider` in this nesting order (outer to inner):

```
VariableStoreContext.Provider
  LabelPositionerContext.Provider
    EngineStateContext.Provider
      EngineContext.Provider
        EngineInputRegion
          [SceneCanvas, EngineOverlayHost, LabelItems, TimelineWidget, children]
```

### 14.1 EngineStateContext

```typescript
const EngineStateContext = createContext<EngineState | null>(null);

type EngineState = {
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
};
```

Updated by `EngineProvider` via `useMemo` from `engine.progress` and `engine.frameState`. Consumed by `useEngineState`, `useSceneProgress`, and `useCurrentScene`. The context value is a new object reference on every tick index change — memo comparisons on this context value must compare individual fields, not the object reference.

### 14.2 VariableStoreContext

```typescript
const VariableStoreContext = createContext<VariableStore | null>(null);
```

Provides the `VariableStore` instance to all components in the tree. Consumed by `useVariable`. The store instance is stable for the engine lifetime — it is created once in `useSceneEngine` via `useMemo(() => new VariableStore(), [])`.

### 14.3 LabelPositionerContext

> **Note:** `LabelPositioner` is a model-specific concept belonging to `@brewsite/model`.
> `LabelPositionerContext` and `useLabelPositioner` will move to `@brewsite/model` in the
> major version release that extracts that package.

```typescript
const LabelPositionerContext = createContext<LabelPositioner | null>(null);

const useLabelPositioner = (): LabelPositioner  // throws if outside EngineProvider
```

Provides the `LabelPositioner` instance to `LabelItem` components. The positioner is stable for the engine lifetime. `LabelItem` components call `positioner.registerElement(id, el)` on mount/unmount to register their DOM elements for per-frame positioning updates.

### 14.4 EngineContext

```typescript
const EngineContext = createContext<UseSceneEngineResult | null>(null);

const useSceneEngineContext = (): UseSceneEngineResult  // throws if outside EngineProvider
```

Provides the full `UseSceneEngineResult` to advanced consumers. Used by `CameraControlPanel` (needs `getCamera()`, `setCameraOverride()`). Not intended for standard host application use — it exposes the engine's internals. Prefer `useCurrentScene`, `useSceneProgress`, and `useVariable` for normal UI integration.

---

## 15. EngineInputRegion

`EngineInputRegion` is the canonical input capture region for `EngineProvider` integrations. It reads layout configuration and engine state directly from `EngineContext` — no `engine` prop is required. Mount `SceneCanvas` and `EngineOverlayHost` as children.

> **Migration from `EngineScrollRegion`:** `EngineScrollRegion` has been removed. Replace any `<EngineScrollRegion engine={engine}>` usage with `<EngineInputRegion>` and add `<SceneCanvas />` as a child. `EngineInputRegion` reads `scrollRegionHeightPx` and `scrollRegionRef` directly from engine context.

```typescript
type EngineInputRegionProps = {
  inputMap?: SceneNavInputMap;
  className?: string;
  children?: ReactNode;
};
```

Adapts layout based on `inputMap.mode`:

- **Scroll mode:** Outer div has height = `scrollRegionHeightPx` and `overscrollBehavior: 'none'`. Inner viewport is `position: sticky`.
- **Direct mode:** Outer div has height = `100vh`. Inner viewport is `position: relative`.

The inner viewport has `tabIndex={-1}` and an `onPointerDown` handler that calls `focus()` — this ensures keyboard events fire after the user clicks into the scene (required for keyboard navigation shortcuts).

Both region components manage `ResizeObserver` and `window.resize` events to keep `engine.setViewportSize` current.

---

## 16. LabelPositioner

> **Note:** `LabelPositioner` is a model-specific concept belonging to `@brewsite/model`.
> It is documented here for reference during the transition period. The authoritative
> reference will move to the `@brewsite/model` package documentation.

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

## 17. TimelineWidget

`TimelineWidget` is an interactive scrubbing UI component rendered inside an `<EngineProvider>` tree.

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

The `pointerEvents: 'auto'` style is critical: `EngineOverlayHost` sets `pointer-events: none` on its container by default when `passthroughPointerEvents` is true. `TimelineWidget` re-enables pointer events on its own container to remain interactive.

---

## 18. CameraControlPanel

`CameraControlPanel` is an optional React component providing interactive camera reset and preset selection UI.

```typescript
// Exported from @brewsite/core/player
export { CameraControlPanel } from './CameraControlPanel';
```

It reads `getCamera()` and `setCameraOverride()` from `useSceneEngineContext`. The reset button calls `setCameraOverride(null)`, which clears any active orbit/dolly override and returns the camera to the compiled position for the current scene.

`CameraControlPanel` is appropriate for development tooling and demo environments. Production scenes typically do not render it.

---

## 19. SceneInspector

`SceneInspector` is a development-only overlay component that provides scene navigation and progress visibility directly in the browser. Mount it inside `<EngineProvider>` for debug builds.

```typescript
// Exported from @brewsite/core/player
export { SceneInspector } from './SceneInspector';
export type { SceneInspectorProps } from './SceneInspector';
```

**Features:**
- **Scene list** — all scene keys listed; clicking a scene calls `scrollToProgress` to jump directly to it
- **Progress readouts** — current `sceneId`, 0-based `sceneIndex`, `progress` (global, 2dp), `sceneProgress` / `blockProgress` (within current transition block, 2dp), raw `tickIndex`

**Integration:**
```tsx
<EngineProvider manifestUrl="/manifest.json" plugins={PLUGINS} ...>
  {process.env.NODE_ENV === 'development' && <SceneInspector />}
  ...
```

`SceneInspector` reads from `EngineStateContext` (same source as `useCurrentScene`, `useSceneProgress`). It reads the `scenes: InternalSceneSpec[]` array via `EngineContext` to render the scene key list.

**Tree-shaking:** When `debug` is statically `false` or absent, bundlers eliminate the import. No SceneInspector code reaches production bundles in a properly tree-shaken build.

`SceneInspector` is also exported standalone for consumers who want to mount it independently (e.g., in a portal, in a different position on screen) rather than through the `debug` prop.

---

## 20. SceneMetaWidget

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

When the `sceneId` changes, `onSceneChange(sceneId, sceneIndex)` is fired. This callback is registered via `corePlugin({ onSceneChange })` options.

`SceneMetaWidget` is registered by `corePlugin()` with `widgetId = '__scene_meta__'`. It is always present when `corePlugin()` is used. Registries that do not use `corePlugin()` must register it explicitly to enable `useCurrentScene`, `useSceneProgress`, and `useVariable('scene', ...)`.

---

## 21. Asset Manifest

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

Validates the raw JSON fetched from `manifestUrl`. Throws if the manifest is not an object with a `version` field, or if `models` / `animations` are not arrays. Used by `EngineProvider` before storing the manifest in state.

---

## 22. SSR Safety Contract

`EngineProvider` must be safe to render server-side. The following constraints are enforced:

1. **No Three.js code on the server code path.** All Three.js imports (`new THREE.WebGLRenderer(...)`, `new THREE.Scene()`, etc.) are inside `useEffect` callbacks. They are never called during `render()` or `renderToString()`.

2. **Server render gates via EngineGate.** `EngineProvider` defers all engine initialization to client-side effects. `EngineGate` returns `placeholder ?? null` until the engine's first client-side tick, producing stable HTML for hydration.

3. **No hydration mismatch.** The canvas, HUD overlay, and label elements are only rendered client-side (after the engine's first tick via `EngineGate`). The placeholder renders identically on server and client until that point.

4. **Vite-specific HMR code is guarded.** The `import.meta.hot` HMR handler is only registered if `import.meta.hot` exists. This guard prevents crashes in non-Vite build environments.

5. **Manifest fetching is safe.** The `fetch(manifestUrl)` call is inside a `useEffect` with a `cancelled` flag. If the component unmounts before fetch resolves, the state update is suppressed.

---

## 23. Test Infrastructure

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

For hooks (`useSceneProgress`, `useCurrentScene`, `useEngineInput`), use React Testing Library with a minimal `EngineProvider` wrapper providing a real engine context.

---

## 24. Breaking Change Assessment

**Current semver status:** `ScenePlayer` and `ScenePlayerProps` have been removed entirely (major breaking change). `EngineScrollRegion` and `EngineScrollRegionProps` have been removed. `createDefaultWidgetRegistry` and `DefaultWidgetRegistryOptions` have been removed. The canonical integration pattern is `EngineProvider` + `EngineGate` + `EngineInputRegion` + `SceneCanvas` + `EngineOverlayHost` with `corePlugin()` and `modelPlugin()`. Migration: replace `<ScenePlayer widgetSetup={...}>` with `<EngineProvider plugins={[corePlugin(), modelPlugin(manifest)]}>` wrapped layout primitives.

**Guardrail:** `EngineProviderProps` fields must not be removed or renamed in minor versions. New optional fields can be added freely.

**Known future risk:** `useSceneEngineContext` returns `UseSceneEngineResult` which includes internal engine refs. Additions to this type are non-breaking; removals are major changes. The type should not be used as a stable public API surface for third-party libraries — prefer the narrow hook APIs.

---

## 25. Normalized Viewport Space (NVS) — Package Ownership

The NVS system is a cross-package spatial contract. The authoritative reference for which package owns each concept is the table below. See `requirements/core/notes/note_normalized-viewport-layout.md` for the full design rationale and `requirements/core/notes/note_nvs-known-limitations.md` for known implementation limitations.

| Concept | Package | Source File |
|---|---|---|
| `NVSRect`, `NVSPosition`, `INVSBounded` | `@brewsite/core` | `src/layout/types.ts` |
| `EngineARContainer` | `@brewsite/core` | `src/player/EngineARContainer.tsx` |
| `TextBox` DSL element | `@brewsite/core` | `src/elements/text-box/` |
| `--scene-scale` CSS variable | `@brewsite/core` | injected by `EngineARContainer` |
| `DiagramCanvas` NVS bounds (`x`, `y`, `w`, `h` props) | `@brewsite/diagram` | `src/elements/diagram/canvas/` |
| `Chart` NVS bounds (`x`, `y`, `w`, `h` props) | `@brewsite/charts` | `src/elements/chart/` |
| `Model` NVS bounds (`x`, `y`, `w`, `h` props) | `@brewsite/model` | `src/elements/model/` |
| `LabelPositioner` NVS sub-region | `@brewsite/model` | `src/player/LabelPositioner.ts` |
| `ChartTooltipOverlay` NVS bounds | `@brewsite/charts` | `src/elements/chart/ChartTooltipOverlay.tsx` |

**Core NVS types are exported from `@brewsite/core`:**

```typescript
import type { NVSRect, NVSPosition, INVSBounded } from '@brewsite/core';
```

All downstream packages (`@brewsite/diagram`, `@brewsite/charts`, `@brewsite/model`) import `NVSRect` and `INVSBounded` from `@brewsite/core`. The core package must never import from them.

---

## 26. Open Questions

- Should `useSceneProgress()` return the full `EngineState` instead of just `number`, to avoid consumers calling both `useSceneProgress` and `useCurrentScene`? A combined hook would reduce context reads.
- Should `EngineProvider` expose a way to forward a `ref` to the canvas element for consumers who need direct canvas access (e.g., screenshot capture)? `SceneCanvas` already supports `forwardRef` — a convenience shortcut may be warranted.
- Should `debug` information in `UseSceneEngineResult` be gated behind a `__DEV__` flag to prevent any dev-only overhead in production builds?
- Should `EngineOverlayHost` expose a `transitionDurationMs` prop to control the CSS fade-in duration on scene change, or is a CSS class override sufficient?
- Should `useSceneEngineState` be renamed to `useEngineSnapshot` to avoid confusion with `useSceneEngine`?

---

## 27. Launch Criteria

For any release that modifies the Player or Runtime public API:

- All `EngineProvider`, `EngineGate`, `SceneCanvas`, `EngineOverlayHost`, and `EngineARContainer` prop types compile with `strict: true` and no `any`.
- `useCurrentScene`, `useSceneProgress`, and `useVariable` pass integration tests inside an `<EngineProvider>` wrapper.
- `useSceneEngineState(id)` passes integration tests verifying: returns null before registration, returns correct snapshot after registration, returns null after unregister, updates on tick index change.
- `RuntimeDriverImpl` unit tests cover the full tick sequence order (animation controllers before sampling before apply).
- `RuntimeLoop` deterministic tests cover fpsCap throttling and delta clamping.
- `EngineInputRegion` renders correctly in both `scroll` and `direct` modes.
- `TimelineWidget` scrub interaction test confirms `scrollToProgress` is called on pointer drag.
- `EngineOverlayHost` renders `TextBox` overlay content from VariableStore and switches it on scene change.
- `EngineARContainer` injects `--scene-scale` correctly for all four `scaleMode` values; unit test verifies computed scale for known parent dimensions.
- `SceneProgressMapper.remap` unit tests cover: uniform segments (identity), single custom fn, multiple scenes with different scrollUnits, progress boundary conditions (0, 1).
- `SceneProgressMapper.inverse` unit tests verify inverse maps engine progress back to raw progress correctly for both uniform and non-uniform profiles.
- SSR render of `<EngineProvider>` with `<EngineGate>` produces no Three.js errors and matches the placeholder output.
- At least one example in `apps/examples/` demonstrates `EngineProvider` + `EngineARContainer` + `SceneCanvas` + `EngineOverlayHost` with a `TextBox` overlay element.
- `CHANGELOG.md` in `packages/core` has an entry for every changed exported symbol.
- `packages/core/README.md` reflects the current `EngineProviderProps` interface and documents `EngineARContainer`, `EngineGate`, `EngineInputRegion`, `SceneCanvas`, and `EngineOverlayHost`.
