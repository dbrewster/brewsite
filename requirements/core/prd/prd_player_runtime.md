---
title: "BrewSite Core — Player & Runtime"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-15
change_history:
  - date: 2026-03-09
    author: "Toolkit Product"
    summary: "v2 player API (major breaking change — @brewsite/core v2.0.0): EngineProvider, EngineInputRegion, ScenePlayer, and ScrollCaptureSection are deleted. useEngineScroll and useEngineInput hooks deleted. SceneEngine replaces EngineProvider as the primary integration component. ScrollStage replaces EngineInputRegion for the full-page scroll pattern. SceneReel introduced for embedded/docs/slides use cases. Composable input components (ScrollInput, TimeInput, KeyboardInput, PointerInput, ControlledInput) replace all input mode configuration. useEngineState(id) unifies useEngineState and deleted useSceneEngineState. useGoToScene hook added for programmatic scene navigation. IScrollSource / ScrollSourceProp replace deleted ScrollSource type. Spring-physics inertia model replaces DOM-scroll inertia. BackgroundLayer extracted as standalone component. SceneCanvas gains engineId prop for cross-tree binding. All section 7 EngineProvider documentation rewritten for SceneEngine. All apps migrated; MIGRATION.md published."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "NVS zoom-instability fix: updated tick sequence (section 9.3) to reflect new ordering — SceneTrack sampling (Step 1) before animation controllers (Step 2), NVS computation at Step 3.5 from compiled camera state, then apply (Step 4). Updated functional requirement 9 and WidgetRenderContext shape to include coords field. createNVSCoordService now accepts NVSCameraParams instead of THREE.PerspectiveCamera. NVS positions are stable under camera interaction."
  - date: 2026-03-09
    author: "Toolkit Product"
    summary: "NVS Universal Coordinate System: WidgetRenderContext gains required coords: NVSCoordService field. RuntimeDriverImpl computes NVSCoordService from the live PerspectiveCamera and canvas dimensions at the start of each tick and injects it into every apply() call. This is a breaking change — @brewsite/core major version bump. See prd_widget_sdk.md Section 12.3 for the full NVSCoordService interface and Section 12.7 for usage patterns."
  - date: 2026-03-07
    author: "Toolkit Product"
    summary: "Core cleanup: manifestUrl on EngineProvider is now optional and deprecated — plugins supplied by the plugins prop handle manifest loading internally; manifestUrl is only needed for direct model loading without a plugin. EngineARContainerContext is deprecated and aliased to ViewportScaleContext; downstream packages (e.g. @brewsite/model LabelPositioner) should import ViewportScaleContext from @brewsite/core. CameraControlPanel, CameraInteractionInfoDialog, and SceneInspector moved to the @brewsite/core/devtools subpath (removed from main player/index.ts exports). A new @brewsite/core/testing subpath exports clearRegistry and test doubles for compiler and runtime unit testing — replaces deep sub-path imports."
  - date: 2026-03-05
    author: "Toolkit Product"
    summary: "@brewsite/slides integration: documented that @brewsite/slides is a first-class EngineProvider consumer. SlidePlayer owns its own EngineProvider internally (inputModePolicy='prefer-direct', pixelsPerScene=600) and uses the plugin system exclusively — no widgetRegistry prop is exposed. SlidePlayer passes an EMPTY_MANIFEST_URL data-URL to EngineProvider when no GLTF assets are used, as a workaround for the now-resolved manifestUrl-required DX gap."
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
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Embedding modes cleanup: (1) SceneEngineProps gains theme (ActiveTheme), scrollSource, defaultTransitionDuration, defaultTransitionEasing. (2) SceneReel now accepts and forwards all four new SceneEngine props — DEBT resolved. SceneReel embedded reel examples updated to show defaultTransitionDuration. (3) ViewportScaleContainer exported as stable alias for EngineARContainer; ViewportScaleContainerProps type alias also exported. Both names stable, no deprecation. Section 7A.4 updated. (4) Canvas Region example at apps/examples/src/canvas-region/ demonstrates embedded 3D viewer mode with SceneReel, default input spec, and two-column layout."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "Input unification (plan_input-unification.md implemented): ActionInput component added as the DSL-to-runtime bridge for <InputController> scene authoring. PointerInput and ScrollInput components removed — scroll is handled natively by ScrollStage; pointer/keyboard/wheel action-based input is handled by ActionInput. KeyboardInput is now focus management only (no inputMap prop). Default keyboard nav (ArrowRight/Down = scene.next, ArrowLeft/Up = scene.prev) is compiler-injected when no scene authors <InputController>. UseSceneEngineResult gains applyCameraOrbit, applyCameraDolly, applyCameraReset, and patchWidgetStates. UseSceneEngineOptions loses inputMap (SceneNavInputMap removed). ActionInputExtensionContext documented as the mechanism for plugins to extend action dispatch. diagramPlugin.getActionInputExtension() wires diagram-canvas actions to DiagramWidget.applyCanvasAction(). carousel.next/carousel.prev are forward-declared InputActionType values."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Codebase alignment: InputCoordinator replaces ActionInput and KeyboardInput throughout. SceneEngine context tree corrected to ThemeContext > SceneRegistrationContext > VariableStoreContext > PluginInheritanceContext > ActionInputExtensionContext > EngineStateContext > EngineContext. UseSceneEngineResult updated with missing fields (applyCameraPan, applyCameraZoom, beginTransition, interruptTransition, redirectTransition, compiledScenes, sceneTrack, progressMapper, pause, resume, canvasRef). UseSceneEngineOptions corrected: removed clipMeta/fpsCap/pixelsPerScene/framesPerTick/blockSize/labelPositioner, added plugins/sceneTheme/activeTheme/primaryCameraId/primaryCanvasActionTargetId/defaultTransitionDuration/defaultTransitionEasing/onCompileWarning. RuntimeDriver.initialize() now synchronous with camera param. RuntimeDriver.tick() gains deltaProgress. collectRenderContributions() replaces getBoneWorldPositions()/getTargetColors(). ActionInputExtension type corrected to plain function. Scene registration uses SceneRegistrationContext. EngineState includes tickIndex. TimelineWidgetProps.scenes type corrected."
---

# BrewSite Core — Player & Runtime

## 1. Overview

The Player layer is the React integration surface for `@brewsite/core`. `SceneEngine` is the primary component that a host application mounts to run an animated 3D scene. It is a pure context provider with zero DOM output, composed with `EngineARContainer` (aspect-ratio-locked container), `EngineGate` (loading gate), `SceneCanvas` (Three.js canvas), `EngineOverlayHost` (overlay tier), and input components (`InputCoordinator`, `TimeInput`, `ControlledInput`) to form the complete integration. `SceneReel` provides a pre-composed convenience wrapper for embedded/docs/slides use cases. The Runtime layer is the frame-by-frame execution engine that drives widget ticking, scene track sampling, Three.js rendering, and state publishing. Together they form the complete playback stack: from JSX scene authoring through compilation, asset loading, frame scheduling, and reactive state propagation to host UI.

This document covers `SceneEngine` and the composable player primitives (`EngineARContainer`, `EngineGate`, `ScrollStage`, `SceneCanvas`, `EngineOverlayHost`, `BackgroundLayer`, `SceneReel`), the composable input components (`InputCoordinator`, `TimeInput`, `ControlledInput`), the `useSceneEngine` hook and its options, `RuntimeDriverImpl` and the per-frame tick sequence, `RuntimeLoop` and the animation frame scheduler, `EngineFrameDriver` and the React state bridge, all consumer hooks (`useEngineScrubber`, `useSceneProgress`, `useCurrentScene`, `useEngineState`, `useGoToScene`, `useNativeScrollSource`), all context providers (`EngineStateContext`, `VariableStoreContext`, `LabelPositionerContext`, `EngineContext`, `EngineARContainerContext`), `TimelineWidget` for interactive scrubbing, `CameraControlPanel`, `SceneMetaWidget`, `SceneProgressMapper`, the asset manifest pipeline, the Normalized Viewport Space (NVS) layout system, and the SSR safety contract.

Affects: `@brewsite/core`.

---

## 2. Problem Statement

Three.js scene toolkits typically expose imperative APIs: create a renderer, create a scene, load assets, call render in a loop. Integrating this into a React host application requires careful management of refs, effect cleanup, hydration safety, and progress synchronization.

The BrewSite Player layer solves these integration problems once, providing a composable `<SceneEngine>` + `<EngineGate>` + `<SceneCanvas>` pattern that handles all imperative Three.js lifecycle internally. Host applications interact exclusively with props, hooks, and context — no direct Three.js API surface is exposed unless the consumer explicitly requests engine access via `useSceneEngineContext`.

The Runtime layer solves the per-frame orchestration problem: widgets must tick in a defined order, scene track state must be sampled O(1), functional transitions must evaluate at blockProgress, and the output must be pushed to React state in a way that does not cause excessive re-renders.

---

## 3. Goals and Success Metrics

**Primary goals:**
- A host application can integrate a fully animated 3D scene in under 30 lines of application code.
- `SceneEngine` is safe to render server-side — no crash, no hydration mismatch.
- Adding a new widget does not require changes to the Player or Runtime layers.
- The frame loop runs at 60fps on target hardware with zero React state updates per frame during steady-state playback (state updates only on tick index change, not on every animation frame).

**Success metrics:**
- `SceneEngine` mounts and begins rendering in under 500ms.
- Zero React re-renders per animation frame during steady-state playback with a static scene (no scene transitions).
- TypeScript props for `SceneEngine` produce compile errors for incorrect prop types with zero `any` escape hatches.
- `useCurrentScene` does not re-render its consumer on every frame — it re-renders only when `sceneId` changes.

**Guardrail metrics:**
- No `SceneEngineProps` fields may be removed or renamed in a minor version release.
- The `useSceneEngine` return shape must remain backward compatible across minor versions.

---

## 4. Non-Goals

- `SceneEngine` does not manage routing, page layout, or CSS beyond what is needed for Three.js canvas sizing.
- The Player layer does not expose a public Three.js `Scene` or `Camera` reference in the standard consumption pattern. Consumer access to engine internals is available via `useSceneEngineContext` for advanced use cases only, and is considered an escape hatch.
- Audio synchronization is out of scope for the Player layer.
- The Runtime layer does not implement physics, collision detection, or pathfinding. These belong in widget `IAnimationController` implementations.
- The Player layer does not manage React Router integration. Scene change callbacks are wired through `corePlugin({ onSceneChange })` options.
- `SceneEngine` does not manage full-page scroll position. `ScrollStage` provides the sticky-canvas scroll layout pattern with native scroll handling; `SceneReel` handles embedded/fill-container layouts.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to declare a scene in JSX and mount `<SceneEngine>` with composable layout and input primitives so that my Three.js scene renders without writing any imperative Three.js setup code.
- As a toolkit consumer, I want to use `useCurrentScene()` to reactively update a nav indicator so that my UI reflects the active scene without wiring custom event listeners.
- As a toolkit consumer, I want to render `<InputCoordinator>` and other input components as children of `<SceneEngine>` so that my scene transitions as the user navigates, with keyboard, pointer, wheel, and inertia scroll handled by a single component.
- As a toolkit consumer, I want `useVariable('scene', 'id')` inside any component nested under `<SceneEngine>` so that I can build reactive overlays driven by scene metadata.
- As a toolkit consumer, I want to mount `<TimelineWidget>` inside `<SceneEngine>` so that I get a scrubbing timeline for development and debugging without additional code.
- As a server-side rendering host, I want `<EngineGate>` to render the `placeholder` prop during SSR and until the engine's first tick so that my page has no layout shift and no hydration mismatch.
- As a toolkit consumer building a docs page, I want `<SceneReel height={400}>` to embed a self-contained 3D animation in a single line so that I have no scroll configuration to manage.

---

## 6. Functional Requirements

1. `SceneEngine` shall accept `children: ReactNode` and `plugins` as primary props. `children` consists of `<Scene key="...">` elements plus any layout primitives, input components, and overlay hosts. `plugins` is required unless a parent `SceneEngine` provides plugins via zero-scene mode. All other props are optional.
2. Each plugin in `plugins` shall receive `IWidgetPlugin.register(registry, manifest)` when the registry is constructed. Manifest loading is performed internally by the plugin (e.g., `modelPlugin({ manifestUrl })`); `SceneEngine` does not fetch a manifest itself.
3. `EngineGate` shall render the `placeholder` prop while `frameState.tickIndex < 0` (before the first tick completes), then render `children`.
4. `SceneEngine` shall call `onError` for any error from widget initialization or asset loading. The engine continues operating with whatever plugins were already registered.
5. Scene change callbacks shall be wired via `corePlugin({ onSceneChange })` options. `SceneMetaWidget` (registered by `corePlugin()`) fires the callback when the active scene changes.
6. `SceneEngine` shall support Vite HMR automatically via content-hash compilation. When Vite HMR causes a parent component re-render, the `<Scene>` JSX elements are re-created. `serializeJsx` produces a new `contentKey` if any prop changed. If the `sceneContentKey` changes, `useMemo` fires and recompilation is triggered naturally. No manual `import.meta.hot` subscription, `hmrVersion` state counter, or `clearRegistry` call is needed or present.
7. `useSceneEngine` shall create a `THREE.WebGLRenderer` once the canvas DOM element is available, and dispose it on unmount.
8. `useSceneEngine` shall compile the `SceneTrack` via `compileSceneTrack` when `sceneGroup`, `widgetRegistry`, or `clipMeta` changes. Compiled tracks shall be cached by `buildSceneTrackKey` to avoid recompilation on unrelated re-renders.
9. `RuntimeDriverImpl.tick` shall execute in this order per frame: (1) sample the scene track, (2) tick all `IAnimationController` widgets in priority order, (3) compute NVS coordinate service from compiled camera state (Step 3.5), (4) apply state to all `IRenderable` widgets. NVS computation precedes `IRenderable.apply()` so that all widgets receive stable NVS positions unaffected by camera interaction overrides from animation controllers.
10. `RuntimeLoop` shall throttle frames to `fpsCap` frames per second when the option is configured. When `fpsCap` is not set, the loop runs at the native animation frame rate.
11. `RuntimeLoop` shall clamp `deltaSeconds` to prevent large delta spikes when the browser tab returns from background.
12. `EngineStateContext` shall be updated at most once per animation frame, only when `tickIndex` changes. It shall not update on every `requestAnimationFrame` invocation.
13. `useCurrentScene()` shall return `{ id: string; index: number }` and re-render its consumer only when `sceneId` changes.
14. `useSceneProgress()` shall return the current `progress: number` ([0, 1] global progress) and update on every tick index change.
15. `LabelPositioner.update` shall be called once per render, after `renderer.render(scene, camera)`, with the current label primitives and bone world positions from the runtime driver.
16. Input components (`InputCoordinator`, `TimeInput`, `ControlledInput`) shall be rendered as children of `SceneEngine` or `SceneReel`. Multiple input components may coexist; `ControlledInput` has highest priority, user-initiated input (`InputCoordinator`) has next priority, and `TimeInput` (auto-advance) has lowest priority and yields to user input. `ActionInput`, `KeyboardInput`, `EngineInputRegion`, `ScrollCaptureSection`, `ScrollInput`, and `PointerInput` are deleted. Scroll progress is driven by `InputCoordinator` inertia within `ScrollStage`.
17. `SceneEngine` shall be SSR-safe: all Three.js and DOM initialization shall be deferred to `useEffect`. On the server, `EngineGate` renders `placeholder` (if provided) or `null`. Input components render nothing on the server.
18. `corePlugin()` shall be accessible from `@brewsite/core` player exports. Pairing `corePlugin()` with `modelPlugin()` from `@brewsite/model` provides complete widget coverage for scenes with GLTF models.

---

## 7. SceneEngine: Primary Integration Component

`SceneEngine` is the primary component for integrating BrewSite scenes into a host application. It is a pure React context provider with zero DOM output — it establishes the engine context tree and manages the Three.js engine lifecycle without rendering any DOM structure. Compose it with `EngineGate` (loading gate), `ScrollStage` (full-page scroll layout), `SceneCanvas` (Three.js canvas), `EngineOverlayHost` (overlay tier), and input components (`InputCoordinator`, `TimeInput`, `ControlledInput`) to build the complete player integration. Use `SceneReel` for embedded/inline animations that require no custom layout.

**Canonical full-page scroll integration pattern:**

```tsx
import {
  SceneEngine, EngineARContainer, EngineGate, ScrollStage,
  BackgroundLayer, SceneCanvas, EngineOverlayHost,
  InputCoordinator, corePlugin,
} from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

const PLUGINS = [
  corePlugin({ onSceneChange: (id) => console.log('scene:', id) }),
  modelPlugin({ manifestUrl: '/manifest.json' }),
];

export default function Page() {
  return (
    <SceneEngine id="main" plugins={PLUGINS}>
      <Scene key="intro">...</Scene>
      <EngineARContainer aspectRatio={16 / 9}>
        <EngineGate placeholder={<Spinner />}>
          <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1600}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas />
            <InputCoordinator />
            <EngineOverlayHost />
          </ScrollStage>
        </EngineGate>
      </EngineARContainer>
    </SceneEngine>
  );
}
```

**Canonical embedded reel pattern:**

```tsx
import { SceneReel, TimeInput } from '@brewsite/core';

export default function DocArticle() {
  return (
    <article>
      <p>Intro text...</p>
      <SceneReel height={400} plugins={PLUGINS} defaultTransitionDuration={500}>
        <Scene key="demo">...</Scene>
        <TimeInput duration={4} loop pauseWhenHidden={{ y: 0.5 }} />
      </SceneReel>
    </article>
  );
}
```

Define `PLUGINS` at module scope (or via `useMemo`) to keep the array reference stable across renders and avoid restarting asset loading.

Full `SceneEngineProps` documentation is in **Section 7A.1**. Full `EngineGateProps` documentation is below.

### 7.1 EngineGate

`EngineGate` renders its `placeholder` until the engine produces its first frame (`tickIndex >= 0`), then renders `children`. It is the standard loading gate for `SceneEngine` integrations and must be placed inside a `SceneEngine` tree.

```typescript
type EngineGateProps = {
  /** Rendered while the engine has not yet produced its first frame. Defaults to null. */
  placeholder?: ReactNode;
  children: ReactNode;
};

const EngineGate: React.FC<EngineGateProps>;
```

`EngineGate` reads `tickIndex` from `EngineStateContext`. Any component that needs the engine's first-frame guarantee (canvas sizing, overlay positioning, label registration) should be nested inside `EngineGate`.

**`onReady`** — Called once after the first successful tick completes (all assets loaded, first frame rendered). Not called again after HMR updates.

**`onError`** — Called with any Error from widget initialization or asset loading. The engine continues operating in a degraded state; the host decides how to handle.

**`onSceneChange`** — Called when the active scene changes. Receives `(sceneId: string, sceneIndex: number)`. Wired internally via `corePlugin({ onSceneChange })`.

**`children`** — All content: `<Scene>` declarations, layout primitives, input components, canvas, and overlay hosts. `SceneEngine` renders no DOM of its own.

### 7.2 Internal Behavior

`SceneEngine` performs the following operations on each render:

**Scene registration (reactive, via SceneRegistrationContext):**
1. `SceneEngine` provides `SceneRegistrationContext` with `register(id, element)` and `unregister(id)` callbacks.
2. Each `<Scene>` child registers itself with the context on mount and unregisters on unmount.
3. A `useEffect` syncs the registration map to `InternalSceneSpec[]`: for each registered entry, computes `contentKey = serializeJsx(element)`.
4. Computes `sceneContentKey` -- concatenation of all `contentKey` strings, separated by `'|||'`.
5. If `sceneContentKey` changed, updates `scenes` state, triggering recompilation.

**On mount:**
6. Resolves `ActiveTheme` from `theme`, `themeFamily`/`themePolarity` (deprecated), or default `{ family: 'default', polarity: 'dark' }`. Resolves `SceneTheme` via `resolveSceneTheme(family, polarity)` for `ThemeContext`.
7. Constructs `WidgetRegistry` by invoking each plugin's `registerHandlers()`, `createWidgets()`, and `configureRegistry()` inside `useMemo`. Plugins that declare `fetchManifest()` have their manifests fetched asynchronously; compilation is withheld until manifests are ready.
8. Calls `useSceneEngine` with the registry, `scenes`, and configuration options.
9. `SceneMetaWidget` (registered by `corePlugin()`) fires scene change callbacks via its own internal wiring.
10. Renders the full context provider tree (see context tree above).
11. Renders `children` -- which may include `<Scene>` declarations, layout primitives (`ScrollStage`, `EngineARContainer`), input components, `SceneCanvas`, `EngineOverlayHost`, and consumer-provided overlays.

**Runtime state publishing (when `id` prop is set):**
12. A `useEffect` publishes `SceneRuntimeState` to `ScenePlayerRegistry` on every change to `assetsReady`, viewport dimensions, `variableStore`, or `scenes.length`. Consumers using `useSceneRuntime(id)` receive these updates reactively.
13. On unmount, calls `unregisterSceneRuntime(id)` to clean up the registry entry.

On server (SSR), `SceneEngine` short-circuits at `typeof window === 'undefined'` and defers all engine initialization. `EngineGate` returns `placeholder ?? null` on the server code path. No Three.js imports are invoked.

---

## 7A. Composable Player Primitives

The composable player primitives allow host applications to construct custom canvas layouts. Each primitive is independently exported from `@brewsite/core`.

### 7A.1 SceneEngine

`SceneEngine` creates the engine and establishes all React context providers. It renders no DOM elements — it is a pure context tree wrapper. Compose it with `ScrollStage`, `SceneCanvas`, `EngineOverlayHost`, and input components to construct full-page or custom layouts. Use `SceneReel` for self-contained embedded animations.

```typescript
type SceneEngineProps = {
  /** All children: <Scene> declarations, layout, input components, canvas, overlays. */
  children: ReactNode;

  /** Registers engine state in the global registry for cross-tree useEngineState(id). */
  id?: string;

  /**
   * Widget plugins. Overrides ancestor SceneEngine plugin context when set.
   * Required if no ancestor SceneEngine provides plugins via zero-scene mode.
   */
  plugins?: WidgetPlugin[];

  timingProfile?: EngineTimingProfile;

  /** The widget id of the camera to use as the primary scene camera. */
  primaryCameraId?: string;

  /** The widget id of the canvas that receives action-based camera input. */
  primaryCanvasActionTargetId?: string;

  cameraInteractionDefaults?: CameraInteractionDefaults;

  /**
   * Increment to force recompilation of the SceneTrack when scene DSL
   * hasn't structurally changed but content has (e.g., dynamic asset URLs).
   */
  invalidateCacheToken?: number | string;

  /** Max animation-seconds that may advance in a single frame tick during fast scroll/input. */
  maxAnimBoostPerFrame?: number;

  /**
   * Optional scene theme token set for cross-package visual styling.
   * EngineOverlayHost reads the theme via ThemeContext and injects CSS custom properties.
   * See requirements/core/prd/prd_theming.md for full documentation.
   * @deprecated Use `theme` instead.
   */
  sceneTheme?: SceneTheme;

  /**
   * Active theme for this engine. Supersedes deprecated sceneTheme.
   * Provides the ActiveTheme object (family + polarity) to all widgets and overlays.
   */
  theme?: ActiveTheme;

  /**
   * Scroll source for viewport-relative context lifecycle management.
   * Used in multi-panel layouts where the engine container is not the window scroll root.
   */
  scrollSource?: ScrollSourceProp;

  /**
   * Default duration (ms) for programmatic scene transition animations.
   * Applied when navigating via useGoToScene or InputCoordinator scene.next/scene.prev
   * and no per-call duration is specified. Default: 400ms.
   */
  defaultTransitionDuration?: number;

  /**
   * Default easing function for programmatic scene transition animations.
   * Applied when navigating via useGoToScene or InputCoordinator scene.next/scene.prev
   * and no per-call easing is specified.
   */
  defaultTransitionEasing?: (t: number) => number;

  onReady?: () => void;
  onError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;
};
```

**When to use `SceneEngine` directly:**
- Custom canvas layout (grid, flex, portal, absolute positioning outside the document flow)
- Multiple canvases registered against a single engine
- Overlay content hosted in a separate React subtree or DOM portal
- Plugin hoisting (zero-scene mode: provide plugins to all nested `SceneReel` instances)

**Context tree established by `SceneEngine`:**
```
ThemeContext.Provider
  SceneRegistrationContext.Provider
    VariableStoreContext.Provider
      PluginInheritanceContext.Provider
        ActionInputExtensionContext.Provider
          EngineStateContext.Provider
            EngineContext.Provider
              {children}
```

Note: Plugin `wrapProvider()` chains are applied in reverse plugin order inside the `ActionInputExtensionContext` → `EngineContext` subtree, so the first plugin's wrapper is outermost.

All player hooks (`useCurrentScene`, `useSceneProgress`, `useVariable`, `useEngineState`, `useSceneEngineContext`) require a `SceneEngine` ancestor.

### 7A.2 SceneCanvas

`SceneCanvas` renders the `<canvas>` element and registers it with the engine via `EngineContext`. It owns the `ResizeObserver` that keeps `engine.setViewportSize` current. `SceneCanvas` must be rendered inside a `SceneEngine` tree, or paired with an `engineId` prop to bind cross-tree.

```typescript
type SceneCanvasProps = React.CanvasHTMLAttributes<HTMLCanvasElement> & {
  /**
   * Binds this canvas to a SceneEngine in a separate React subtree by id.
   * When set, the canvas does not require a SceneEngine ancestor — it looks up
   * the engine by id from the global ScenePlayerRegistry.
   */
  engineId?: string;

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

`EngineOverlayHost` renders the compiled `TextBox` overlay content for the current scene, positioned in NVS coordinates over the canvas. It must be rendered inside a `SceneEngine` tree, and it must be rendered inside an `EngineARContainer` so that NVS coordinates resolve correctly against the AR-locked viewport.

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
- Reads `ThemeContext` (provided by `SceneEngine` via `sceneTheme` prop) and — when a `SceneTheme` is present — injects CSS custom properties on the overlay container div.
- Renders each `TextBoxState` as an absolutely positioned `div` whose `left`, `top`, `width`, and `height` are derived from the `TextBoxState.nvsBounds` NVS rectangle, converted to percentage values against the container (which is AR-locked by `EngineARContainer`).
- Renders the overlay inside a `div` with `position: absolute; inset: 0; overflow: hidden`.
- Uses `key={sceneId}` on the inner overlay div to trigger a React remount on scene change, which applies a CSS fade-in transition.
- When `passthroughPointerEvents` is false (default), the container div has `pointer-events: auto`. When true, `pointer-events: none`.

**Removed:** `sceneOverlays` — the previous pattern of authoring raw HTML children directly inside `<Scene>` (collected as `SceneFrame.sceneOverlay: ReactNode`) has been removed. `SceneFrame` no longer has a `sceneOverlay` field. All overlay content is now authored via the `<TextBox>` DSL element.

**CSS variable injection (when `SceneEngine.sceneTheme` is set):**

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

`fontFamily: 'var(--brewsite-font-family)'` is also set as an inline style on the container so that CSS inheritance propagates the font to all overlay children and DOM labels automatically.

When no `sceneTheme` is provided, no CSS variables are injected and overlay behavior is unchanged.

**Scene change transition:**
The overlay container uses a CSS fade-in on mount, keyed by `sceneId`. This gives a smooth crossfade effect when navigating between scenes that have overlay content.

**Example: canonical layout with EngineARContainer:**

```tsx
import {
  SceneEngine, EngineARContainer, EngineGate, ScrollStage,
  BackgroundLayer, SceneCanvas, EngineOverlayHost,
  InputCoordinator, corePlugin,
} from '@brewsite/core';

function App() {
  return (
    <SceneEngine id="main" plugins={[corePlugin()]}>
      <Scene key="intro">
        <Camera descriptor={{ mode: 'world', position: [0, 1, 5], target: [0, 0, 0] }} />
        <TextBox id="headline" x={0.1} y={0.1} w={0.4} h={0.2}>
          <h1>Hello World</h1>
        </TextBox>
      </Scene>

      <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width">
        <EngineGate placeholder={<Spinner />}>
          <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1200}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas />
            <InputCoordinator />
            <EngineOverlayHost />
          </ScrollStage>
        </EngineGate>
      </EngineARContainer>
    </SceneEngine>
  );
}
```

### 7A.4 EngineARContainer

`EngineARContainer` maintains a fixed aspect ratio for the engine viewport. It wraps `SceneCanvas` and `EngineOverlayHost` to form the AR-locked spatial frame against which all NVS coordinates are resolved. `EngineARContainer` is required when using `<TextBox>` elements or any widget that implements `INVSBounded`.

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

  /** All children — SceneCanvas, EngineOverlayHost, ScrollStage, etc. */
  children: React.ReactNode;
};

export const EngineARContainer: React.FC<EngineARContainerProps>;

/**
 * Alias for EngineARContainer. Provides a clearer name aligned with the
 * ViewportScale naming family (ViewportScaleContext, ViewportScaleContextValue).
 * Both names are stable — use whichever is clearer in context.
 */
export const ViewportScaleContainer: React.FC<EngineARContainerProps>;

/** Props alias for ViewportScaleContainer. */
export type ViewportScaleContainerProps = EngineARContainerProps;
```

**`--scene-scale` CSS variable:**

`EngineARContainer` measures its rendered pixel dimensions via `ResizeObserver` and injects a `--scene-scale` CSS custom property on the container element on every resize. The value is computed as `containerWidth / referenceWidth`. All `TextBox` content uses `calc(Xpx * var(--scene-scale))` for sizing, which causes authored-at-reference-resolution pixel values to scale proportionally across any viewport.

**Context:**

`EngineARContainer` provides `ViewportScaleContext` to its children. Use this context when a child component needs the current container dimensions.

```typescript
export type ViewportScaleContextValue = {
  containerWidth: number;
  containerHeight: number;
  referenceWidth: number;
  scaleMode: ScaleMode;
};

export const ViewportScaleContext =
  React.createContext<ViewportScaleContextValue>({
    containerWidth: 0,
    containerHeight: 0,
    referenceWidth: 1920,
    scaleMode: 'fit-width',
  });

/** @deprecated Use ViewportScaleContext. EngineARContainerContext is an alias
 *  that will be removed in v3. */
export const EngineARContainerContext = ViewportScaleContext;
/** @deprecated Use ViewportScaleContextValue. Will be removed in v3. */
export type EngineARContainerContextValue = ViewportScaleContextValue;
```

**SSR safety:** `EngineARContainer` defers `ResizeObserver` setup to `useEffect`, so it renders safely on the server with `containerWidth: 0, containerHeight: 0`.

**Source:** `packages/core/src/player/EngineARContainer.tsx`

### 7A.5 useEngineState

`useEngineState(id?)` is the unified hook for reading engine state. Called without arguments inside a `SceneEngine` tree, it reads from context. Called with an `id` string, it reads from `ScenePlayerRegistry` via `useSyncExternalStore` — no `SceneEngine` ancestor is required in that case.

`useSceneEngineState(id)` is deleted in v2; use `useEngineState(id)` instead.

```typescript
type EngineStateSnapshot = {
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
  progress: number;
};

// No arguments — reads from nearest SceneEngine ancestor context:
const useEngineState: () => EngineStateSnapshot;

// With id — reads from global ScenePlayerRegistry:
const useEngineState: (id: string) => EngineStateSnapshot | null;
```

**When to use the `id` overload:**
- Reading engine progress from a component in a different React subtree (e.g., a navigation bar outside the canvas container)
- Coordinating multiple engines on a page without prop-drilling
- Reading scene state in a portal-rendered component

**Update frequency:** Updates on every tick index change (same cadence as `EngineStateContext`). Does not update on every animation frame.

**Null behavior:** Returns `null` when no `<SceneEngine id={id}>` has registered. Callers must handle the null case.

**Example:**
```typescript
function NavBar() {
  const state = useEngineState('main-player');

  if (!state) return null;

  return (
    <nav>
      <span>Scene {state.sceneIndex + 1}</span>
      <span>{Math.round(state.progress * 100)}%</span>
    </nav>
  );
}
```

### 7A.6 Embedded Animation Integration Pattern

In v2, embedding an animation on a page is handled by `SceneReel`, which provides a self-contained, sized container with no scroll infrastructure. There is no `inputModePolicy`, no scroll spacer, and no `setRawProgress` imperative pattern.

**`SceneReel` — embedded reel:**

```tsx
import { SceneReel, TimeInput } from '@brewsite/core';

// Auto-playing inline animation — no input config required
<SceneReel height={400} plugins={PLUGINS} defaultTransitionDuration={500}>
  <Scene key="demo">
    <Camera descriptor={{ mode: 'world', position: [0, 1, 5], target: [0, 0, 0] }} />
  </Scene>
  <TimeInput duration={4} loop pauseWhenHidden={{ y: 0.5 }} />
</SceneReel>
```

`SceneReel` accepts and forwards the following `SceneEngine` props: `theme`, `scrollSource`, `defaultTransitionDuration`, `defaultTransitionEasing`, plus all props documented in Section 7A.1 (`plugins`, `id`, `timingProfile`, `primaryCameraId`, `primaryCanvasActionTargetId`, `cameraInteractionDefaults`, `invalidateCacheToken`, `maxAnimBoostPerFrame`, `sceneTheme`, and all lifecycle callbacks).

**`SceneReel` with externally controlled progress:**

```tsx
const [progress, setProgress] = useState(0);

<SceneReel height={400} plugins={PLUGINS} defaultTransitionDuration={500}>
  <Scene key="demo">...</Scene>
  <ControlledInput value={progress} onChange={setProgress} />
</SceneReel>
```

**`@brewsite/docs` integration:** The docs application uses a single app-level `SceneEngine` in standard scroll mode. All demo scenes are authored in a single global `docs-scenes.tsx`. Scroll input is provided natively by `ScrollStage` via `InputCoordinator` inertia; action-based input (keyboard, camera) is provided by `<InputCoordinator>`.

### 7A.7 InputCoordinator

`InputCoordinator` is the unified input coordinator that replaces the former `ActionInput`, `KeyboardInput`, and `InertiaScrollSource` components. It bridges compiled `<InputController>` DSL to the `ActionInputController` class, manages inertia scroll, carousel X-axis inertia, and pauseWhenHidden.

```typescript
export interface InputCoordinatorProps {
  inertiaSensitivity?: number;       // Inertia scroll sensitivity. Default: 0.01.
  inertiaDecay?: number;             // Inertia decay per frame (0..1). Default: 0.85.
  target?: HTMLElement | null;       // DOM element for pointer/wheel events. Default: ScrollStage container or canvas.
  keyboardTarget?: HTMLElement | Document | Window | null; // Keyboard event target. Default: document.
  pauseWhenHidden?: PauseWhenHiddenOptions;
}

export function InputCoordinator(props: InputCoordinatorProps): ReactElement | null;
```

**Behavior:**
- Reads `tick.state.widgets['__input_controller']` from the current engine tick via a getter function passed to `ActionInputController`.
- Dispatches recognized action types (`camera.orbit`, `camera.zoom`, `camera.pan`, `camera.reset`, `scene.next`, `scene.prev`, `carousel.next`, `carousel.prev`) to the engine.
- Dispatches unrecognized action types (e.g., `diagram-canvas.move`) to `onUnknownAction` from `ActionInputExtensionContext`.
- When inside a `ScrollStage`, implements Y-axis inertia scroll (unclaimed wheel events) and X-axis inertia for carousel horizontal scroll.
- When no `<InputController>` is authored, the compiler injects a default spec via `createDefaultInputSpec()`.
- Renders null (no DOM output).

**Canonical usage:**
```tsx
<ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1200}>
  <SceneCanvas />
  <InputCoordinator />    {/* Handles all input: keyboard, pointer, wheel, inertia, focus */}
  <EngineOverlayHost />
</ScrollStage>
```

### 7A.8 ActionInputExtensionContext

`ActionInputExtensionContext` allows downstream plugins to extend `InputCoordinator`'s action dispatch without modifying `@brewsite/core`. `SceneEngine` collects `getActionInputExtension()` from each registered plugin and merges all `onUnknownAction` handlers into a single function provided via this context.

```typescript
// packages/core/src/player/ActionInputExtensionContext.ts

/** Merged onUnknownAction callback from all WidgetPlugin.getActionInputExtension() results. */
export type ActionInputExtension = NonNullable<ActionInputHandler['onUnknownAction']>;
// Equivalent to:
// (type: string, canvasId: string | undefined,
//  event: PointerEvent | WheelEvent | KeyboardEvent | MouseEvent,
//  extra: Record<string, unknown>) => void;

export const ActionInputExtensionContext =
  React.createContext<ActionInputExtension | null>(null);
```

`ActionInputExtension` is a plain function type derived from `ActionInputHandler['onUnknownAction']`. It is NOT an object with a `registerHandlers` method.

**Plugin implementation (WidgetPlugin interface):**
```typescript
interface WidgetPlugin {
  // ... other methods ...

  /**
   * Optional. Return an object with onUnknownAction to handle custom InputActionTypes.
   * Called by SceneEngine at startup; the registry is fully populated by this point.
   */
  getActionInputExtension?(registry: WidgetRegistry): { onUnknownAction: ActionInputExtension } | undefined;
}
```

`InputCoordinator` reads this context and passes it as `handler.onUnknownAction` to `ActionInputController`. Actions with types not recognized by core (e.g., `diagram-canvas.move`) are forwarded to this callback. The callback receives the action `type`, the `canvasId` from the `<Action>` DSL spec, the original DOM event, and an `extra` record with event-specific data (`dx`, `dy`, `speed`, `focusCenter`).

### 7A.9 KeyboardInput (removed)

`KeyboardInput` has been removed. Its focus management and keyboard event handling responsibilities are now integrated into `InputCoordinator`. The `InputCoordinator.keyboardTarget` prop defaults to `document`, providing broad keyboard event capture. When inside a `ScrollStage`, `InputCoordinator` adds a capture-phase keydown guard on the scroll container to prevent arrow keys from triggering native scroll before the action handler runs.

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
   * Cold path — called by setProgress() and useGoToScene() only.
   * Inverse of remap: maps engine progress [0, 1] back to raw input
   * progress [0, 1]. Used to calculate the scroll position to jump to
   * when the caller requests a specific engine progress value.
   */
  inverse(engineProgress: number): number;
}
```

**When a mapper is active:** `SceneProgressMapper` is constructed when `SceneTrack.progressProfile` is present (i.e., at least one scene declared a `<ProgressManager>`). When `progressProfile` is absent (no `<ProgressManager>` in any scene), the identity mapping is used — no `SceneProgressMapper` is instantiated.

**Mode scope:** `remap` is applied in scroll mode and direct mode. It is not applied when `ControlledInput` drives engine progress directly (the caller provides engine progress directly).

**`inverse` usage:** `setProgress(engineProgress)` and `useGoToScene` convert the requested engine progress through `mapper.inverse(engineProgress)` before setting scroll position or direct-mode progress state. This ensures that a call like `setProgress(0.5)` jumps to the scroll position that produces engine progress 0.5, not raw progress 0.5.

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

`useSceneEngine` is the stateful hook that owns the Three.js engine lifecycle. It is called by `SceneEngine` internally and is not intended for direct use by host applications in the standard integration pattern. It is exported for advanced consumers who need to compose the engine with custom container components.

### 8.1 Options

```typescript
// InternalSceneSpec — internal to player layer, exported as a type
type InternalSceneSpec = {
  readonly sceneKey: string;     // React key or index-derived fallback
  readonly contentKey: string;   // serializeJsx output — changes when any prop changes
  readonly element: ReactElement; // the <Scene> element passed to the compiler
};

type UseSceneEngineOptions = {
  scenes: InternalSceneSpec[];
  widgetRegistry: WidgetRegistry;
  plugins?: WidgetPlugin[];
  manifest: AssetManifest | null;
  sceneTheme?: SceneTheme | null;
  activeTheme?: ActiveTheme;
  timingProfile?: EngineTimingProfile;
  maxAnimBoostPerFrame?: number;
  invalidateCacheToken?: number | string;
  primaryCameraId?: string;
  primaryCanvasActionTargetId?: string;
  defaultTransitionDuration?: number;
  defaultTransitionEasing?: TransitionEasing;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;
};
```

### 8.2 Return Type

```typescript
type UseSceneEngineResult = {
  // ── Frame state ──
  frameState: EngineFrameState;
  progress: number;

  // ── Asset state ──
  variableStore: VariableStore;

  // ── Canvas wiring ──
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  setCanvasRef(el: HTMLCanvasElement | null): void;
  setViewportSize(w: number, h: number): void;
  setBackgroundRef(el: HTMLDivElement | null): void;

  // ── Progress control ──
  setControlledProgress: (p: number) => void;
  pause: () => void;
  resume: () => void;
  setRawProgress(raw: number): void;
  setProgress(mapped: number): void;
  advanceProgress(delta: number): void;

  // ── Compiled scene info ──
  sceneTrack: SceneTrack | null;
  sceneCount: number;
  compiledScenes: ReadonlyArray<{ id: string; index: number }>;
  progressMapper: SceneProgressMapper | null;

  // ── Action input wiring ──
  readonly primaryCameraId: string;
  readonly primaryCanvasActionTargetId: string;
  applyCameraOrbit(cameraId: string, dx: number, dy: number, speed: number): void;
  applyCameraDolly(cameraId: string, delta: number, speed: number): void;
  applyCameraZoom(cameraId: string, delta: number, speed: number): void;
  applyCameraPan(cameraId: string, dx: number, dy: number, speed: number): void;
  applyCameraReset(cameraId: string): void;
  beginTransition(toProgress: number, durationMs?: number, easing?: TransitionEasing): void;
  interruptTransition(): void;
  redirectTransition(newToProgress: number, durationMs?: number, easing?: TransitionEasing): void;
  patchWidgetStates(patches: Record<string, unknown>): void;

  // ── Camera control ──
  getCamera(): THREE.PerspectiveCamera | null;
  getRenderer(): THREE.WebGLRenderer | null;
  setCameraOverride(next: CameraOverrideState | null): void;
  getCameraOverride(): CameraOverrideState | null;
  setAutoAdvancePaused(paused: boolean): void;

  // ── Overlay content ──
  sceneOverlays: Map<string, ReactNode>;

  debug?: {
    assetsReady: boolean;
    viewport: { width: number; height: number };
  };
};
```

**`frameState`** — Current `EngineFrameState` (see Section 8.3). Updated once per tick index change, not once per animation frame.

**`progress`** — Global progress value [0, 1]. Derived from `frameState.progress`.

**`canvasRef`** — Mutable ref to the canvas element managed by `SceneCanvas`. Used by `InputCoordinator` for pointer/wheel event attachment.

**`setControlledProgress(p)`** — Updates the engine's controlled progress ref directly without React re-render. Safe for passive scroll handlers.

**`pause()` / `resume()`** — Pauses/resumes the `RuntimeLoop` RAF cycle.

**`setRawProgress(raw)`** — Write raw scroll-space progress through the `SceneProgressMapper` (if present). Used by scroll sources only.

**`setProgress(mapped)`** — Write post-mapper engine progress directly, bypassing the mapper. Used by `ControlledInput`, inertia mode, keyboard, time, and pointer inputs.

**`advanceProgress(delta)`** — Advance engine progress by a signed delta. Clamps to [0, 1].

**`sceneTrack`** — The compiled `SceneTrack`. Null until first compilation completes.

**`sceneCount`** — Total number of compiled scenes. 0 until compile completes.

**`compiledScenes`** — Ordered list of `{ id: string; index: number }` for compiled scenes. Empty until compile completes.

**`progressMapper`** — The `SceneProgressMapper` derived from the compiled track's `progressProfile`. Null when all scenes have equal scroll weight.

**`applyCameraOrbit` / `applyCameraDolly` / `applyCameraZoom` / `applyCameraPan` / `applyCameraReset`** — Camera interaction dispatch methods. Called by `InputCoordinator` on action dispatch. `applyCameraZoom` is an alias for `applyCameraDolly` (both delegate to the same camera widget method).

**`beginTransition` / `interruptTransition` / `redirectTransition`** — Programmatic scene transition animation control. `beginTransition` starts an animated transition from the current progress to a target. `interruptTransition` stops at the current interpolated value. `redirectTransition` changes the target of an active transition.

**`patchWidgetStates(patches)`** — Apply per-widget state overrides for the current tick. Used by carousel scrubbing. Cleared by calling with `{}`.

**`sceneOverlays`** — Map from scene ID to `ReactNode`. Populated from compiled overlay content. `EngineOverlayHost` reads `sceneOverlays.get(frameState.sceneId)` each render.

**`variableStore`** — The `VariableStore` instance shared across all widgets and React components in this engine instance.

**`setCameraOverride` / `getCameraOverride`** — Set and get a `CameraOverrideState` that is applied by `CameraWidget` each frame.

**`setAutoAdvancePaused(paused)`** — No-op stub in v2. Player-level auto-advance state machine has been removed; per-scene auto-advance is managed inside `RuntimeDriverImpl`.

**`debug`** — Development diagnostic object. Contains `assetsReady` and viewport dimensions. Used internally by `SceneEngine` to publish `SceneRuntimeState`.

### 8.3 EngineFrameState and EngineState

```typescript
type EngineFrameState = {
  tickIndex: number;           // Current tick index in the SceneTrack (-1 before first tick)
  progress: number;            // Global progress [0, 1]
  sceneId: string;             // Current scene id
  sceneIndex: number;          // Current scene index (0-based)
  sceneProgress: number;       // blockProgress [0, 1] within current transition block
  tick?: SceneTrackTick | null; // Current SceneTrackTick (null before first tick, optional field)
};

/** @deprecated Use EngineFrameState instead. Alias retained for backward compatibility. */
type EngineState = EngineFrameState;
```

`EngineFrameState` is the React state that bridges the animation loop to React rendering. It is updated by `EngineFrameDriver` only when `tickIndex` changes, preventing per-frame React state churn.

`sceneProgress` maps to `tick.blockProgress` — the normalized position [0, 1] within the current transition block, not the global progress. It is the value evaluated by functional transition closures.

### 8.4 Engine Initialization Sequence

The engine initializes across three separate `useEffect` phases that React schedules sequentially:

**Phase 1 — Scene Track Compilation:** Triggered when `scenes` (the `InternalSceneSpec[]` reference from `useMemo`), `widgetRegistry`, `clipMeta`, `manifest`, `blockSize`, or `prefersReducedMotion` changes. Computes a cache key via `buildSceneTrackKey({ scenes, ... })` — the key uses each spec's `contentKey` field, so any prop change in any scene produces a cache miss. If a matching cached track exists, it is used directly. Otherwise a `SceneDefinition[]` adapter is constructed from `scenes` via `useMemo` and `compileSceneTrack` runs. The result is cached.

**Phase 2 — Driver Initialization:** Triggered when `canvas` becomes available, `widgetRegistry` changes, `manifest` changes, `variableStore` changes, or `sceneTrack` transitions from null to non-null. Creates a `THREE.Scene`, a `THREE.PerspectiveCamera`, and a `RuntimeDriverImpl`. Calls `driver.initialize(scene, camera, renderer)` synchronously. Sets `driverReady = true` on success.

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
  initialize(scene: THREE.Scene, camera?: THREE.PerspectiveCamera, renderer?: THREE.WebGLRenderer): void;
  setSceneTrack(track: SceneTrack): void;
  tick(options: { deltaSeconds: number; globalProgress: number; deltaProgress: number; wallTimeSeconds?: number }): void;
  collectRenderContributions(): RenderContribution;
  getCurrentTick(): SceneTrackTick | null;
  getWallTimeSeconds(): number;
  dispose(): void;
}
```

At construction time, `RuntimeDriverImpl` reads the sorted widget collections from the registry once (`getSceneElements()`, `getRenderables()`, `getAnimationControllers()`, `getContainedModels()`) and stores them as private arrays. These collections do not change after construction — the registry is treated as immutable after plugins are registered.

### 9.2 Initialization

`initialize(scene, camera?, renderer?)` is **synchronous** and performs:

1. **Widget initialization:** Calls `renderable.initialize({ scene, widgetId, renderer })` for every `IRenderable` in order. If any widget throws, the error is forwarded to `onError` and re-thrown (halting initialization).

2. **Parallel asset loading (fire-and-forget):** Calls `w.load(manifest)` on all `ILoadable` widgets via `Promise.all` internally. Each load call is individually wrapped in a try/catch -- a widget that fails to load is added to `erroredWidgets` and `onWidgetError` is fired, but the promise resolves (not rejects) so the parallel chain continues. On all resolutions, sets `assetsReady = true` and fires `onAssetsReady`.

### 9.3 Per-Frame Tick Sequence

`tick({ deltaSeconds, globalProgress, deltaProgress, wallTimeSeconds })` executes in this order every animation frame. The `deltaProgress` field is the non-negative forward progress delta this frame (zero on backward navigation), used to compute `effectiveDeltaSeconds` via `animationTimeScale`. The driver constructs a `RealtimeClock` from `wallTimeSeconds` and `deltaSeconds`, and computes `effectiveDeltaSeconds` from `deltaSeconds` and the current scene's `animationTimeScale` (if declared). Both are provided to all `AnimationTickContext` and `WidgetRenderContext` instances built this frame.

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
  coords: NVSCoordService;       // NVS → world conversion, pinned to compiled camera state
};
```

See Section 7C for the `RealtimeClock` type definition and widget authoring guidance.

```
1. Sample SceneTrack:
   currentTick = sampler.sample(globalProgress)  // O(1) array index lookup

2. For each IAnimationController (ascending tickPriority):
   — Skip if widgetId is in erroredWidgets
   — try { controller.onTick({ clock, effectiveDeltaSeconds, ... }) } catch → add to erroredWidgets, fire onWidgetError

3. Apply per-block easing to blockProgress (if SceneTrack.transitionEasings[sceneIndex] set):
   bp = getEasingFn(easingName)(tick.blockProgress)

3.5. Compute NVS coordinate service:
   nvsParams = resolveNVSParamsFromCameraState(currentTick.state.camera)
   coords = createNVSCoordService(nvsParams, viewportWidth, viewportHeight)
   // NVS is pinned to compiled camera state — CameraWidget.onTick() interaction
   // overrides (orbit/zoom/pan) do NOT affect NVS positions.

4. For each IRenderable:
   — Skip if widgetId is in erroredWidgets
   a. Check for FunctionalTransitionSpec block at tick.sceneIndex
      - If present: state = functionalBlock.widgetFns[widgetId].fn(bp)
   b. Else: state = tick.state.widgets[widgetId] ?? defaultState
   c. extra = tick.widgetExtras?.[widgetId]
   — try { renderable.apply(state, { clock, effectiveDeltaSeconds, ..., coords, tick }) } catch → add to erroredWidgets, fire onWidgetError
```

After the tick sequence, the `RuntimeLoop` calls `render()` (Three.js renderer draw call) and then `onAfterTick` (which routes to `EngineFrameDriver.handleTick`).

### 9.4 Functional Transition Evaluation

The scene track may contain `transitionBlocks` — records of functional transition specs that were not baked to discrete state. For widgets at a given `sceneIndex` that have a functional spec, the driver evaluates the stored closure at `tick.blockProgress` rather than reading from `tick.state.widgets`. This enables spring-physics transitions, parametric camera paths, and other non-discrete state shapes.

### 9.5 collectRenderContributions

After each tick, `RuntimeLoop.render` calls `driver.collectRenderContributions()` to collect per-frame positional and color data from all `IRenderContributor` widgets. The method returns a `RenderContribution` object containing named world positions and target colors. Results are passed to `LabelPositioner.update` each frame.

The `getBoneWorldPositions()` and `getTargetColors()` methods from v1 have been replaced by this unified collection mechanism.

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

`serializeJsx` is an internal utility used by `SceneEngine` to detect scene content changes between renders. It is not exported from the player public API.

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

`ScenePlayerRegistry` is a module-level registry that enables `useSceneRuntime()` to read engine-internal state from outside the `<SceneEngine>` React subtree. It is not exported from the player public API.

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

// Published by SceneEngine when id prop is set
export const setSceneRuntimeState: (id: string, state: SceneRuntimeState) => void;
export const getSceneRuntimeState: (id: string) => SceneRuntimeState;
export const subscribeSceneRuntime: (id: string, listener: () => void) => () => void;
export const unregisterSceneRuntime: (id: string) => void;
// Dev-mode check: returns true if a SceneEngine with this id has registered
export const hasRegisteredPlayer: (id: string) => boolean;
```

### 12.3 useSceneRuntime

```typescript
// packages/core/src/player/useSceneRuntime.ts

export const useSceneRuntime = (playerId: string): SceneRuntimeState;
```

Reads reactive runtime state published by `<SceneEngine id={playerId}>`. Uses `useSyncExternalStore` for concurrent-mode safety. When `assetsReady`, viewport, `variables`, or `numScenes` change, subscribers re-render automatically.

**Recompile flow:**
1. Assets finish loading → `engine.debug.assetsReady` → `true`
2. SceneEngine's publish effect fires → `setSceneRuntimeState` → notifies listeners
3. Parent component re-renders via `useSceneRuntime`
4. New JSX produces different `contentKey` via `serializeJsx`
5. `sceneContentKey` changes → `useMemo` fires → new `scenes` reference
6. Compilation effect fires → cache miss → `compileSceneTrack` → new `SceneTrack`

**Dev-mode footgun warning:** If `useSceneRuntime(id)` is called but no `<SceneEngine id={id}>` registers within 1000ms, a `console.warn` is emitted. Gated on `process.env.NODE_ENV !== 'production'`.

## 13. Consumer Hooks

### 13.1 useEngineScroll (deleted in v2)

`useEngineScroll` is removed in v2.0.0. Scene navigation from native scroll is now handled by `<ScrollStage>` directly. See `packages/core/MIGRATION.md`.

### 13.2 useEngineInput (deleted in v2)

`useEngineInput` is removed in v2.0.0. Replace with `<InputCoordinator>` for keyboard, pointer, wheel, and inertia scroll input (including camera orbit/zoom/pan and scene navigation). Camera/canvas interaction is dispatched through `ActionInputController` via the compiled `<InputController>` DSL. See `packages/core/MIGRATION.md`.

### 13.3 useEngineScrubber

```typescript
type UseEngineScrubberResult = {
  isScrubbing: boolean;
  startScrub: () => void;
  stopScrub: () => void;
  setProgress: (next: number) => void;
};

const useEngineScrubber = (): UseEngineScrubberResult
```

No options in v2 — the hook reads the engine context directly and must be called inside a `<SceneEngine>` tree. `setProgress` calls `engine.setProgress(p)` internally. `startScrub` / `stopScrub` manage the `isScrubbing` flag, which the `TimelineWidget` uses to show a visual drag indicator and suppress engine progress during active scrub.

The `progress` field from the v1 result is removed. Read `engine.progress` from `useSceneEngineContext()` directly instead.

### 13.3a useGoToScene (new in v2)

```typescript
const useGoToScene = (): (target: string | number) => void
```

Returns a stable callback for programmatic scene navigation. The callback accepts either a scene `id` string or a zero-based scene `index` number. It syncs the active scroll source to the target scene — the correct mechanism for navigation buttons and sidebar links.

```typescript
const goToScene = useGoToScene();

// By id:
goToScene('chapter-3');

// By index:
goToScene(2);
```

### 13.3b useNativeScrollSource (new in v2)

```typescript
const useNativeScrollSource = (containerRef: RefObject<HTMLElement>): IScrollSource
```

Returns an `IScrollSource` implementation that reads scroll position from the provided element ref. Used to override `ScrollStage`'s native scroll driver with a custom scroll container. Pass the result to `<CustomScrollSource source={source} />` inside a `ScrollStage`. The returned object is stable across renders (referential equality preserved).

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

Returns the full `EngineState` (`progress`, `sceneId`, `sceneIndex`, `sceneProgress`) from `EngineStateContext`. Throws if called outside `<SceneEngine>`. Used internally by `useSceneProgress` and `useCurrentScene`. Direct use is appropriate for custom overlays that need multiple state values.

---

## 14. Context Providers

All context providers are established by `SceneEngine` in this nesting order (outer to inner):

```
ThemeContext.Provider
  SceneRegistrationContext.Provider
    VariableStoreContext.Provider
      PluginInheritanceContext.Provider
        ActionInputExtensionContext.Provider
          EngineStateContext.Provider
            EngineContext.Provider
              {children}  <- SceneCanvas, EngineOverlayHost, ScrollStage, input components, etc.
```

### 14.1 EngineStateContext

```typescript
const EngineStateContext = createContext<EngineState | null>(null);

type EngineState = {
  tickIndex: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
};
```

Updated by `SceneEngine` via `useMemo` from `engine.progress` and `engine.frameState`. Consumed by `useEngineState`, `useSceneProgress`, and `useCurrentScene`. Includes `tickIndex` for `EngineGate` to determine first-frame readiness. The context value is a new object reference on every tick index change -- memo comparisons on this context value must compare individual fields, not the object reference.

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

const useLabelPositioner = (): LabelPositioner  // throws if outside SceneEngine
```

Provides the `LabelPositioner` instance to `LabelItem` components. The positioner is stable for the engine lifetime. `LabelItem` components call `positioner.registerElement(id, el)` on mount/unmount to register their DOM elements for per-frame positioning updates.

### 14.4 EngineContext

```typescript
const EngineContext = createContext<UseSceneEngineResult | null>(null);

const useSceneEngineContext = (): UseSceneEngineResult  // throws if outside SceneEngine
```

Provides the full `UseSceneEngineResult` to advanced consumers. Used by `CameraControlPanel` (needs `getCamera()`, `setCameraOverride()`). Not intended for standard host application use — it exposes the engine's internals. Prefer `useCurrentScene`, `useSceneProgress`, and `useVariable` for normal UI integration.

---

## 15. ScrollStage (replaces EngineInputRegion)

`EngineInputRegion` is deleted in v2.0.0. The full-page scroll layout it provided is now implemented by `ScrollStage`. All input -- focus management, action-based input (keyboard scene navigation, camera orbit/zoom/pan), and inertia scroll -- is handled by `InputCoordinator`.

`ScrollStage` creates the tall-spacer + sticky-viewport DOM structure for full-page scroll-driven animations. It handles native scroll internally — no `ScrollInput` component is required. It computes scroll height from the compiled `SceneTrack` (via `SceneEngineContext`) or from explicit props.

```typescript
type ScrollStageProps = {
  children: ReactNode;
  className?: string;
} & (
  | { scrollHeightMode: 'scene-count'; pixelsPerScene: number }
  | { scrollHeightMode: 'scroll-units'; pixelsPerScrollUnit: number }
  | { scrollHeightPx: number }
);
```

**Layout:**
- **Outer div:** Height = computed scroll height. `overscrollBehavior: 'none'`.
- **Inner viewport:** `position: sticky; top: 0; height: 100vh`. Contains `SceneCanvas`, `EngineOverlayHost`, and any other children.

Input components (`InputCoordinator`, `TimeInput`, etc.) are rendered as children of `ScrollStage` alongside `SceneCanvas` and `EngineOverlayHost`. They attach their own event listeners and do not require a separate region wrapper. Scroll source overrides (`CustomScrollSource`, `ElementScrollSource`) must also be children of `ScrollStage`. `InputCoordinator` provides built-in inertia scroll when inside a `ScrollStage`.

See `packages/core/MIGRATION.md` for the `EngineInputRegion` → `ScrollStage` migration guide.

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

`TimelineWidget` is an interactive scrubbing UI component rendered inside a `<SceneEngine>` tree.

```typescript
type TimelineWidgetProps = {
  engine: UseSceneEngineResult;
  scenes?: ReadonlyArray<{ id: string; meta?: Record<string, unknown> }>;
  orientation?: 'horizontal' | 'vertical';
  position?: 'top' | 'bottom' | 'left' | 'right';
  theme?: TimelineTheme;  // 'light' | 'dark'
  thickness?: number;
  majorTicks?: TimelineTickStyle;  // 'scene' | 'frame' | 'none'
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

Scrubbing is implemented via pointer capture (`setPointerCapture`) — the handle tracks the pointer even when it moves outside the track bounds. During scrub, `engine.setProgress` is called on every pointer move. The `isScrubbing` flag suppresses the engine's own progress from overwriting the scrub handle position during the drag.

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

`SceneInspector` is a development-only overlay component that provides scene navigation and progress visibility directly in the browser. Mount it inside `<SceneEngine>` for debug builds.

```typescript
// Exported from @brewsite/core/player
export { SceneInspector } from './SceneInspector';
export type { SceneInspectorProps } from './SceneInspector';
```

**Features:**
- **Scene list** — all scene keys listed; clicking a scene calls `goToScene` to jump directly to it
- **Progress readouts** — current `sceneId`, 0-based `sceneIndex`, `progress` (global, 2dp), `sceneProgress` / `blockProgress` (within current transition block, 2dp), raw `tickIndex`

**Integration:**
```tsx
<SceneEngine plugins={PLUGINS} ...>
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

Validates the raw JSON fetched from a manifest URL. Throws if the manifest is not an object with a `version` field, or if `models` / `animations` are not arrays. Used by plugins (e.g., `modelPlugin`) before storing the manifest in state.

---

## 22. SSR Safety Contract

`SceneEngine` must be safe to render server-side. The following constraints are enforced:

1. **No Three.js code on the server code path.** All Three.js imports (`new THREE.WebGLRenderer(...)`, `new THREE.Scene()`, etc.) are inside `useEffect` callbacks. They are never called during `render()` or `renderToString()`.

2. **Server render gates via EngineGate.** `SceneEngine` defers all engine initialization to client-side effects. `EngineGate` returns `placeholder ?? null` until the engine's first client-side tick, producing stable HTML for hydration. Input components render nothing on the server.

3. **No hydration mismatch.** The canvas, overlay, and label elements are only rendered client-side (after the engine's first tick via `EngineGate`). The placeholder renders identically on server and client until that point.

4. **Vite-specific HMR code is guarded.** The `import.meta.hot` HMR handler is only registered if `import.meta.hot` exists. This guard prevents crashes in non-Vite build environments.

5. **Manifest fetching is safe.** Plugin manifest fetches (`modelPlugin({ manifestUrl })`) are initiated inside `useEffect` with cancelled-flag guards. If the plugin component unmounts before fetch resolves, the state update is suppressed.

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

For hooks (`useSceneProgress`, `useCurrentScene`, `useEngineState`, `useGoToScene`), use React Testing Library with a minimal `SceneEngine` wrapper providing a real engine context.

---

## 24. Breaking Change Assessment

**Current semver status:** `@brewsite/core` v2.0.0 — major release. The following symbols are deleted entirely with no compatibility shims: `EngineProvider`, `EngineInputRegion`, `ScenePlayer`, `ScrollCaptureSection`, `useEngineScroll`, `useEngineInput`, `useSceneEngineState`, `InputModePolicy`, `ScrollSource`. `scrollToProgress` renamed to `setProgress` on `UseSceneEngineResult`. `WidgetRenderContext.coords: NVSCoordService` is now required. `createNVSCoordService` accepts `NVSCameraParams` (pure math) instead of `THREE.PerspectiveCamera`. See `packages/core/MIGRATION.md` for full migration table.

**Guardrail:** `SceneEngineProps` fields must not be removed or renamed in minor versions. New optional fields can be added freely. `SceneEngineProps`, `ScrollStageProps`, and all input component prop types are the stable public API surface.

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
| `ChartTooltipOverlay` NVS bounds | `@brewsite/charts` | `src/elements/chart/ChartTooltipOverlay.tsx` — **@deprecated**, use `<ChartTooltip>` + `<ChartTooltipHost />` |

**Core NVS types are exported from `@brewsite/core`:**

```typescript
import type { NVSRect, NVSPosition, INVSBounded } from '@brewsite/core';
```

All downstream packages (`@brewsite/diagram`, `@brewsite/charts`, `@brewsite/model`) import `NVSRect` and `INVSBounded` from `@brewsite/core`. The core package must never import from them.

---

## 26. Open Questions

- Should `useSceneProgress()` return the full `EngineState` instead of just `number`, to avoid consumers calling both `useSceneProgress` and `useCurrentScene`? A combined hook would reduce context reads.
- Should `SceneEngine` expose a way to forward a `ref` to the canvas element for consumers who need direct canvas access (e.g., screenshot capture)? `SceneCanvas` already supports `forwardRef` — a convenience shortcut may be warranted.
- Should `debug` information in `UseSceneEngineResult` be gated behind a `__DEV__` flag to prevent any dev-only overhead in production builds?
- Should `EngineOverlayHost` expose a `transitionDurationMs` prop to control the CSS fade-in duration on scene change, or is a CSS class override sufficient?

---

## 27. Launch Criteria

For any release that modifies the Player or Runtime public API:

- All `SceneEngine`, `SceneReel`, `ScrollStage`, `EngineGate`, `SceneCanvas`, `EngineOverlayHost`, and `EngineARContainer` prop types compile with `strict: true` and no `any`.
- All input components (`InputCoordinator`, `TimeInput`, `ControlledInput`) prop types compile with `strict: true` and no `any`.
- `useCurrentScene`, `useSceneProgress`, and `useVariable` pass integration tests inside a `<SceneEngine>` wrapper.
- `useEngineState(id)` passes integration tests verifying: returns null before registration, returns correct snapshot after registration, returns null after unregister, updates on tick index change.
- `useGoToScene` integration test verifies navigation to scene by id and by index.
- `RuntimeDriverImpl` unit tests cover the full tick sequence order (animation controllers before sampling before apply).
- `RuntimeLoop` deterministic tests cover fpsCap throttling and delta clamping.
- `ScrollStage` renders correctly in all three height modes (`scene-count`, `scroll-units`, `scrollHeightPx`).
- `TimelineWidget` scrub interaction test confirms `engine.setProgress` is called on pointer drag.
- `EngineOverlayHost` renders `TextBox` overlay content from VariableStore and switches it on scene change.
- `EngineARContainer` injects `--scene-scale` correctly for all four `scaleMode` values; unit test verifies computed scale for known parent dimensions.
- `SceneProgressMapper.remap` unit tests cover: uniform segments (identity), single custom fn, multiple scenes with different scrollUnits, progress boundary conditions (0, 1).
- `SceneProgressMapper.inverse` unit tests verify inverse maps engine progress back to raw progress correctly for both uniform and non-uniform profiles.
- SSR render of `<SceneEngine>` with `<EngineGate>` produces no Three.js errors and matches the placeholder output.
- At least one example in `apps/examples/` demonstrates `SceneEngine` + `EngineARContainer` + `SceneCanvas` + `EngineOverlayHost` with a `TextBox` overlay element.
- At least one example demonstrates `SceneReel` with `TimeInput`.
- At least one example demonstrates the Canvas Region embedding mode: `SceneReel` with default input spec camera interaction, no scene navigation, embedded in a normal page layout.
- `CHANGELOG.md` in `packages/core` has an entry for every changed exported symbol.
- `packages/core/README.md` reflects the current `SceneEngineProps` interface and documents `SceneEngine`, `SceneReel`, `ScrollStage`, `EngineGate`, `SceneCanvas`, `EngineOverlayHost`, `InputCoordinator`, `TimeInput`, `ControlledInput`, and `useGoToScene`.
