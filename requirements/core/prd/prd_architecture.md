---
title: "BrewSite Core — Architecture Reference"
doc_type: prd
owner: brewsite-product-manager
status: active
updated: 2026-03-21
change_history:
  - date: 2026-03-21
    author: "Toolkit Product"
    summary: "Scene unit system: added units/ module to core layer map. ViewProps and ViewLayoutProps x/y/w/h/gap now require SceneLength unit strings. RegionPadding (and View.padding) remains number — not yet migrated. All affected packages bump semver major. Migration guide: packages/claude-author/docs/migration/unit-system.md."
  - date: 2026-03-18
    author: "Toolkit Product"
    summary: "Core over-engineering audit: updated transitions/ module description — transitionTypes.ts is now types-only; blend helpers extracted to transitionBlendHelpers.ts; quaternion math extracted to rotationMath.ts. ElementTransitionSpec marked as @deprecated type alias (all implementations removed). EngineFrameDriver removed from player layer description — inlined into useSceneEngine.ts. CompileApi gains layoutContext field (replaces WeakMap side-channel). CP9 zero-consumer exports marked @deprecated."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "v1 release readiness audit complete. Plugin system (corePlugin) is the sole entry point — createDefaultWidgetRegistry removed. Export surface cleaned: test-reset functions moved to /testing sub-path, DevTools components removed from main entry, DofConfig placeholder removed. /testing and /devtools sub-paths formalized as the only paths for test and dev utilities."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Codebase alignment: renamed camera.dolly to camera.zoom. Added carousel-scrubber to core elements list. Added material system (materialTypes.ts, MaterialLoader.ts) and useCarouselState hook to widget layer description. Updated InputHud description to reflect current state (deferred component with data model). All widget interfaces (IViewChild, IInputDefaultProvider, IExtraRenderPass) already present in prior revision."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "NVS zoom-instability fix: updated section 3.5 NVSCoordService description to note mapping is pinned to compiled camera state via NVSCameraParams, no longer uses live THREE.PerspectiveCamera."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "Input unification: rewrote section 3.8 Input to describe the unified system. SceneNavInputController (InputController class) and SceneNavInputMap removed. ActionInput (React component) added as the DSL-to-runtime bridge. Default spec injection (ArrowRight/Down = scene.next, ArrowLeft/Up = scene.prev) documented. ActionInputExtensionContext mechanism for plugin extensions documented."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "View/Region Architecture: added section 3.11 Layout module; updated section 3.3 Compiler to document view DSL files and viewTypes.ts; documented <View>/<ViewLayout> DSL and CompileApi.composeBounds."
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "Compiler passthrough semantics clarified: non-widget state remains source-scene aligned across each transition block."
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
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "DSL stub co-location: dsl.tsx files are now pure type modules (prop interfaces only). DSL stub functions (null-returning components) moved to {Name}Widget.ts files. Updated element module pattern description for dsl.tsx and {Name}Widget.ts layers. Updated design rule 8."
  - date: 2026-03-07
    author: "Toolkit Product"
    summary: "Core cleanup release: eliminated scene.userData inter-widget bus (ICameraFocusTarget + ICameraHost replace stringly-typed __brewsite_* keys); added ILightingOverride interface so downstream packages opt into lighting override without calling render-layer functions; added ViewportScaleContext (EngineARContainerContext deprecated as alias); all five scene widget ID constants (SCENE_CAMERA_KEY, SCENE_LIGHTING_KEY, SCENE_BACKGROUND_KEY, SCENE_ENVIRONMENT_KEY, SCENE_FLOOR_KEY) exported from @brewsite/core; disableWhenAbsent replaces duck-typed useDefaultStateWhenAbsent on ISceneElement; stateEquals optional hook added to ISceneElement for compiler change detection; resolvedState and setCameraOverride added to AnimationTickContext; InputActionType is now an open string union — diagram-canvas.* action types removed from core and owned by @brewsite/diagram; manifestUrl on EngineProvider is now optional and deprecated in favour of plugin-supplied manifests; animejs HUD presets removed from core bundle (moved to apps/examples/ as copy-paste recipes); CameraControlPanel, CameraInteractionInfoDialog, SceneInspector moved to @brewsite/core/devtools subpath; clearRegistry and test doubles available via @brewsite/core/testing subpath."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Major alignment pass against live codebase. Section 2: expanded monorepo table to include all published packages (model, charts, screens, slides, themes, claude-author, create-brewsite, brewsite CLI). Section 3.1: replaced EngineProvider with SceneEngine, removed deleted exports (EngineInputRegion, LabelPositioner, useEngineScroll, useEngineInput, createDefaultWidgetRegistry), added current exports (SceneReel, BackgroundLayer, EngineARContainer, ViewportScaleContainer, ScrollStage, InputCoordinator, TimeInput, ControlledInput, StageScrollSources), corrected context provider tree. Section 3.2: fixed RuntimeDriver interface (added deltaProgress, setCameraOverride, initialize camera param; replaced getBoneWorldPositions/getTargetColors with collectRenderContributions). Section 3.3: corrected compiler/index.ts exports (removed SceneGroup, Hud, HudItem; added actual DSL exports), removed hudCompiler/labelCompiler references, added missing compiler files. Section 3.4: removed model/ from core elements, added spotlight-rig/, text-box/, view/; expanded lighting sub-types. Section 3.5: fixed WidgetRegistry API (get/getAll/getAllWidgets, removed getFactory, added all query methods, freeze, renderer lifecycle, widget object management, buildCacheKey), fixed useVariable signature, replaced isContainedModel with isContainedRenderable, added all current type guards, corrected all context types (WidgetInitContext, WidgetRenderContext, CompileExtraContext, AnimationTickContext). Section 3.6: HUD system removed — documented stub state. Section 3.7: labels moved to @brewsite/model. Section 3.8: replaced ActionInput with InputCoordinator. Sections 4.1/4.2/4.6/4.7: removed HUD/label fields, added current SceneFrame fields, added sceneProgress/warnings/progressProfile/sceneOverlays. Section 5.6: removed HUD/label compilation step. Section 7: removed HUD/label overlay flow, updated to collectRenderContributions model."
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

This is a `pnpm` + Turborepo monorepo. Published packages and private apps:

| Path | Package name | Role | Published |
|---|---|---|---|
| `packages/core` | `@brewsite/core` | Animation engine library | Yes |
| `packages/diagram` | `@brewsite/diagram` | Diagram + screen element library | Yes |
| `packages/model` | `@brewsite/model` | GLTF model + label system | Yes |
| `packages/charts` | `@brewsite/charts` | 3D chart element library | Yes |
| `packages/screens` | `@brewsite/screens` | Screen element library | Yes |
| `packages/slides` | `@brewsite/slides` | Slide presentation element library | Yes |
| `packages/themes` | `@brewsite/themes` | Theme definitions | Yes |
| `packages/claude-author` | `@brewsite/claude-author` | MCP server + docs search for AI-assisted scene authoring | Yes |
| `packages/npx/create-brewsite` | `create-brewsite` | Project scaffolder CLI (`npm create brewsite`) | Yes |
| `packages/npx/brewsite` | `brewsite` | Utility CLI (`npx brewsite add ...`) | Yes |
| `apps/examples` | `@brewsite/examples` | Dev/demo app | No (private) |

**Package dependency rule:** `@brewsite/diagram`, `@brewsite/model`, `@brewsite/charts`, `@brewsite/screens`, `@brewsite/slides`, and `@brewsite/themes` may import from `@brewsite/core`. `@brewsite/core` must never import from any of them. The three CLI/tooling packages (`claude-author`, `create-brewsite`, `brewsite`) are standalone — they have no cross-package build dependencies. The apps may import from all packages. This rule is absolute. Violating it creates circular dependency and prevents independent publishing.

**Build tooling:**
- `@brewsite/core` builds with Vite (library mode) + tsc for type declarations.
- `@brewsite/diagram` builds with tsc only.
- Other published packages build with tsc only.
- `apps/examples` builds with Vite (app mode).

**Peer dependencies:** React, react-dom, and Three.js are peers for the published packages. Neither package pins peers to narrow version ranges. New peer dependencies require explicit justification — they impose a constraint on every consumer.

---

## 3. Layer Map

The `packages/core/src/` source tree is organized as a strict top-to-bottom dependency stack. Higher layers depend on lower layers. Lower layers never depend on higher layers.

```
player/      <- React integration surface (top)
  |
runtime/     <- Generic tick loop + widget dispatch
  |
compiler/    <- Pure DSL-to-SceneTrack pipeline
  |
elements/    <- Renderable element modules
  |
widget/      <- Plugin interfaces + registry
  |
hud/         <- InputHud stub (legacy HUD system removed)
input/       <- Input controller abstractions
timeline/    <- Timeline algebra
layout/      <- Region types + spatial composition utilities
units/       <- Scene unit type definitions + resolution functions
math/        <- Pure math utilities (bottom)
```

### 3.1 Player (`player/`)

The React integration surface. The public entry point for pages and routes. Owns the WebGL renderer lifecycle, the React context tree, and all consumer-facing React components and hooks.

**Key exports:**
- `SceneEngine` — primary component. Pure React context provider with zero DOM output. Owns plugin wiring, scene compilation, RAF loop, and context provision. Compose with `EngineGate`, `SceneCanvas`, `EngineOverlayHost`, `InputCoordinator`, `ScrollStage`, and `BackgroundLayer` for a complete integration.
- `EngineGate` — loading gate component. Renders `placeholder` until the engine produces its first frame (`tickIndex >= 0`), then renders children.
- `SceneCanvas` — renders the Three.js `<canvas>` element and registers it with the engine via `EngineContext`.
- `EngineOverlayHost` — renders overlay content positioned over the canvas. Reads the current scene overlay from `EngineContext`.
- `ScrollStage` — scroll container component that drives scene progress via scroll position. Provides scroll source integration for `SceneEngine`.
- `BackgroundLayer` — background rendering layer component.
- `SceneReel` — multi-scene reel component for sequential scene playback.
- `EngineARContainer` — aspect-ratio container for the engine viewport.
- `ViewportScaleContainer` — viewport-aware scaling container.
- `InputCoordinator` — the unified input bridge component. Reads `__input_controller` from the current tick and manages `ActionInputController` lifecycle. Replaces the deleted `ActionInput`, `KeyboardInput`, and `InertiaScrollSource` components.
- `TimeInput` — time-based input driver for auto-playing scenes.
- `ControlledInput` — programmatic input driver for externally controlled progress.
- `CustomScrollSource` / `ElementScrollSource` — scroll source components from `StageScrollSources`.
- `TimelineWidget` — debug/dev overlay showing scene timeline, tick index, and progress scrubber.
- `corePlugin(options?)` — plugin factory that registers core built-in widgets (Lighting, Background, Environment, Floor, Camera, SceneMeta) into the engine.

**Dev-only exports (`@brewsite/core/devtools` subpath — not part of the main bundle):**
- `CameraControlPanel` — debug camera state inspector.
- `CameraInteractionInfoDialog` — debug dialog for live camera interaction state.
- `SceneInspector` — debug overlay for scene/tick inspection.
Import these from `@brewsite/core/devtools` to keep them out of production bundles. They should never be imported in application code outside of development contexts.

**Testing exports (`@brewsite/core/testing` subpath):**
- `clearRegistry` — resets the global compiler node registry between tests.
- `_resetSceneThemeRegistryForTesting` — resets the scene theme registry between tests.
- Test doubles (e.g. `createMockSceneElementWidget`) for compiler and runtime unit testing.

Test-reset functions are never exported from the main `@brewsite/core` entry point. They are exclusively available via the `/testing` sub-path.

**Scene widget ID constants (exported from `@brewsite/core`):**
- `SCENE_CAMERA_KEY` — widget ID for the built-in CameraWidget (`'__brewsite_camera'`)
- `SCENE_LIGHTING_KEY` — widget ID for the built-in LightingWidget (`'lighting'`)
- `SCENE_BACKGROUND_KEY` — widget ID for the built-in BackgroundWidget (`'background'`)
- `SCENE_ENVIRONMENT_KEY` — widget ID for the built-in EnvironmentWidget (`'environment'`)
- `SCENE_FLOOR_KEY` — widget ID for the built-in FloorWidget (`'floor'`)

**Context providers (all established by `SceneEngine`):**
```
ThemeContext.Provider
  SceneRegistrationContext.Provider
    VariableStoreContext.Provider
      PluginInheritanceContext.Provider
        ActionInputExtensionContext.Provider
          EngineStateContext.Provider
            EngineContext.Provider
```
- `ThemeContext` — resolved `SceneTheme` for CSS variable injection.
- `SceneRegistrationContext` — scene registration callbacks for `<Scene>` children.
- `VariableStoreContext` — stable `VariableStore` reference. Never recreated.
- `PluginInheritanceContext` — plugin list for nested `SceneEngine` inheritance.
- `ActionInputExtensionContext` — merged `onUnknownAction` handler from all plugins.
- `EngineStateContext` — `EngineFrameState` updated on every animation frame. Consumed by hooks.
- `EngineContext` — stable engine result reference after initialization.

**Consumer hooks:**
- `useSceneEngine()` — access the engine result (RuntimeDriver, progress controls, etc.).
- `useEngineState()` — subscribe to engine frame state updates.
- `useEngineScrubber()` — read and control progress directly.
- `useSceneProgress()` — read current scene-local progress [0, 1].
- `useCurrentScene()` — read current scene id and index.
- `useSceneRuntime(id)` — read runtime state for a named engine from the global registry.
- `useGoToScene()` — programmatic scene navigation.

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
3. On each `tick()` call: samples the `SceneTrack` by progress, dispatches the tick's `state.widgets` entries to each `IRenderable` widget via `apply()`, calls `IAnimationController` widgets in `tickPriority` order, and calls `IVariableProvider` widgets to publish to the `VariableStore`.
4. For ticks within a `FunctionalTransitionSpec` block: evaluates `FunctionalWidgetTransition.fn(tick.blockProgress)` to get the widget state, then dispatches it.
5. Aggregates world-space positions and target colors via `collectRenderContributions()` by calling `contributeRenderData()` on all `IRenderContributor` widgets each frame.

**`RuntimeLoop`** — owns `requestAnimationFrame`. Calls `RuntimeDriverImpl.tick()` each frame with `deltaSeconds`, `globalProgress`, and `deltaProgress`. Can be paused, resumed, and disposed. Designed to be replaceable in tests with the mock loop from `runtime/mocks/`.

**`runtime/types.ts`** — the `RuntimeDriver` interface contract:
```typescript
type RuntimeDriver = {
  assetsReady: boolean;
  setAssetsReady(ready: boolean): void;
  setSceneTrack(track: SceneTrack): void;
  initialize(scene: ThreeScene, camera?: PerspectiveCamera, renderer?: WebGLRenderer): void;
  setCameraOverride(override: RuntimeCameraOverride | null): void;
  tick(options: {
    deltaSeconds: number;
    globalProgress: number;
    deltaProgress: number;
    wallTimeSeconds?: number;
  }): void;
  collectRenderContributions(): RenderContribution;
  getCurrentTick(): SceneTrackTick | null;
  getWallTimeSeconds(): number;
  dispose(): void;
};
```

`initialize()` is synchronous. It accepts the Three.js scene and optional camera/renderer references. Synchronously initializes all `IRenderable` widgets and resolves `ICameraFocusTarget`. Asset loading is started internally as a fire-and-forget operation.

`collectRenderContributions()` replaces the previous `getBoneWorldPositions()` and `getTargetColors()` methods. It aggregates named world positions and target colors from all `IRenderContributor` widgets into a single `RenderContribution` object.

Also defined in `runtime/types.ts`: `RealtimeClock`, `Vec3`, `Node`, `PoseSnapshot`, `PoseSnapshotMap`, `AnimationTrack`.

**`runtime/mocks/`** — interface-conforming test doubles. Used in unit tests for layers that depend on `RuntimeDriver`. These are full behavioral implementations with controllable state, not jest spies.

### 3.3 Compiler (`compiler/`)

The pure compilation pipeline. No Three.js. No React. No side effects. No I/O.

Input: scene DSL (JSX evaluated once) as an array of `SceneFrame` snapshots.
Output: `SceneTrack` — a flat pre-baked array of `SceneTrackTick` values indexed for O(1) sampling.

**`compiler/index.ts`** — exports **only** the DSL authoring surface:
```typescript
export { Scene, resolveSceneFromDsl } from './sceneDslCompiler';
export { ProgressManager } from './primitives/progressManager';
export { InputController, Action, PointerMap, WheelMap, PinchMap, KeyMap } from './blocks/inputController';
export { Transition } from './blocks/transition';
export { View } from './blocks/viewDsl';
export { ViewLayout } from './blocks/viewLayoutDsl';
export { registerNode } from './registry';
// Plus: type exports for SceneSnapshotContext, CompileApi, CompileHelpers, NodeHandler,
//   InputControllerProps, ActionProps, PointerMapProps, WheelMapProps, PinchMapProps, KeyMapProps,
//   TransitionProps, ViewProps, ViewLayoutProps, ViewState, ViewLayoutState,
//   EaseFn, TransitionContext, CompiledTransitionGroup, WithTransitionConfig, TransitionPhase,
//   TransitionWindow, TransitionName, SceneTransitionProp
// Plus: transition functions (easeLinear, easeOutCubic, easeOutExpo, easeInOutSine, etc.)
//   resolveSceneTransition, makeResolver, makeSimpleContext
```

Infrastructure types (`SceneTrack`, `compileSceneTrack`, `sceneTrackCache`, etc.) are **not** re-exported through `compiler/index.ts`. They are imported directly from their source files by the player layer:
```typescript
// In player/: direct imports, not through compiler/index.ts
import { compileSceneTrack } from '../compiler/sceneTrackCompiler';
import type { SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';
import { getSceneTrackCache, setSceneTrackCache } from '../compiler/sceneTrackCache';
```

**Compiler source files:**
- `blocks/` — DSL block components: `inputController.tsx` (InputController, Action, PointerMap, WheelMap, PinchMap, KeyMap), `transition.tsx` (Transition), `viewDsl.tsx` (`<View>` DSL component), `viewLayoutDsl.tsx` (`<ViewLayout>` DSL component), `viewHandlers.ts` (NodeHandler implementations for `<View>` and `<ViewLayout>`).
- `transitions/` — Transition type system: `transitionTypes.ts` defines type contracts (`FunctionalTransitionSpec<T>`, `isFunctionalSpec()`, `ElementTransitionSpec<T>` as a `@deprecated` type alias). `transitionBlendHelpers.ts` exports all blend utilities (`blendNumber`, `blendColor`, `blendVec3`, `blendOpacity`, `blendStyleValues`, etc.). `rotationMath.ts` exports quaternion helpers for `blendAxisRotation` (ZYX intrinsic convention, distinct from `math/index.ts`). `transitionPresets.ts` defines named transition types and easing functions. `transitionResolver.ts` provides `makeResolver` and `makeSimpleContext`.
- `primitives/` — Contains only `progressManager.ts`.
- `registry.ts` — The global node handler registry (`registerNode`, `getNodeHandler`, `isPrimitiveComponent`, `clearRegistry`).
- `coreHandlers.ts` — Core DSL node handlers registered by the compiler.
- `childApi.ts` — Child traversal API used during DSL compilation.
- `dslSourceInfo.ts` — Source location extraction for DSL breadcrumb trails.
- `identityFn.ts` — Identity function utility for transition specs.
- `sceneViewConstraint.ts` — View-level constraint enforcement during compilation.
- `viewTypes.ts` — Compiler state contracts for `<View>` and `<ViewLayout>`: `ViewState` and `ViewLayoutState`. Stored in `SceneFrame.widgets` keyed by the view/layout id. No Three.js, no React.
- `sceneTrackTypes.ts` — Core data contracts: `SceneFrame`, `SceneFrameDelta`, `SceneTrackTick`, `SceneTrack`, `SceneWindow`, `FunctionalWidgetTransition`, `SceneTrackTransitionBlock`, `CompileWarning`, `ProgressManagerSpec`, `SceneProgressProfile`.
- `sceneTrackCompiler.ts` — The main `compileSceneTrack()` function.
- `sceneTrackSampler.ts` — O(1) `SceneTrackSampler.sample(progress)` implementation.
- `sceneTrackCache.ts` — Optional compile-time cache for `SceneTrack` keyed by a scene hash.
- `SceneRegistrationContext.ts` — React context for scene registration in `SceneEngine`.
- `sceneDslCompiler.ts` — DSL-to-SceneFrame compiler (`Scene`, `resolveSceneFromDsl`).
- `sceneDslTypes.ts` — `NodeHandler` type and related DSL infrastructure types. Contains `CompileApi` (including `composeBounds` and `layoutContext`) and `CompileHelpers`.
- `sceneTypes.ts` — Shared scene DSL type definitions (`SceneSnapshotContext`).

### 3.4 Elements (`elements/`)

Core renderable element modules. Each element is a self-contained module that can be used, tested, and maintained independently.

**Built-in elements:**
- `camera/` — Camera state, four positioning modes (world, orbit, fitBotHeight, fitFloorDepth), trackpad/mouse orbit controls.
- `background/` — Scene background color or gradient.
- `lighting/` — Scene lighting with sub-elements: `<Ambient>`, `<Directional>`, `<Point>`, `<Spot>`, `<GlowPoint>` (sprite-based pseudo-light), `<Panel>` (grid of point lights), `<LightStrand>` (string of point lights along a curve with `<Wave>`, `<Circle>`, `<Rectangle>` child shape components).
- `floor/` — Reflective floor plane with opacity and blur.
- `environment/` — HDR environment map.
- `spotlight-rig/` — Animated spotlight rig system with presets (moviePremiere, concertStage). Includes `SpotlightRig`, `Spotlight` DSL components and `SpotlightRigWidget`.
- `text-box/` — Text overlay element for scene-embedded text content. Authored via DSL and rendered as DOM overlays via `EngineOverlayHost`.
- `view/` — View element for layout composition. Implements the `<View>` and `<ViewLayout>` DSL components' runtime behavior, including carousel transitions and opacity delegation to `IViewChild` widgets.
- `carousel-scrubber/` — 3D tray base rendered beneath `ViewLayout` carousels. Authored via `<CarouselTray>` as a child of `<ViewLayout kind="carousel">`. Supports material presets, surface textures, edge styles, and per-view highlight effects (glow, holographic). Includes geometry generation, highlight particles, highlight shader, and tray compilation.

Note: The `model/` element has been moved to the `@brewsite/model` package. Labels have also been moved to `@brewsite/model`.

**Mandatory module pattern.** Every element directory must contain exactly these files in this dependency order:

```
types.ts
  |
dsl.tsx
  |
compile.ts
  |
render.ts
  |
{Name}Widget.ts
  |
index.ts
```

**`types.ts`** — Interface contracts only. No runtime imports, no Three.js, no React. Defines the state shape that flows through the compile/playback pipeline (e.g., `CameraState`, `LightingState`).

**`dsl.tsx`** — Prop type interfaces only. No React component function declarations, no Three.js. Defines the prop shapes (`XxxProps`) that authors use when writing scene definitions. DSL stub functions (null-returning components like `<Camera />`, `<Background />`, etc.) are defined in `{Name}Widget.ts`, not here.

**`compile.ts`** — Pure transformation functions. No React, no Three.js. Contains functions that transform DSL props into the element's `types.ts` state shape. Called by the node handler registered in the compiler registry. Exports a `FunctionalTransitionSpec<T>` for the compiler to call during track baking. (`ElementTransitionSpec` is deprecated and no longer implemented by any built-in element.)

**`render.ts`** — Three.js application layer. No React, no compiler imports. Contains the Three.js mutation logic that applies a compiled state object to the live Three.js scene. This is the only file in the element module that may import from `three`.

**`{Name}Widget.ts`** — Defines DSL stub functions (null-returning components, e.g., `export const Camera = (_props: CameraProps): null => null;`) and implements `IWidget` and the relevant sub-interfaces. Bridges the compiler state (from `compile.ts` output) to the render layer (from `render.ts`). Owns the widget's `ILoadable.load()` call if the element requires async asset loading. Calls `render.ts` functions from `IRenderable.apply()`.

**`index.ts`** — Public re-exports only. Defines the element's public API surface. May re-export DSL components, widget class, state types, and compile utilities. Must not re-export internal render utilities.

### 3.5 Widget SDK (`widget/`)

The plugin system for extending the runtime with new renderable and behavioral concepts.

**`WidgetRegistry`** — Two internal registries:
1. Instance registry: maps `widgetId` string to `IWidget` instance. Used for singleton widgets.
2. Type-factory registry: maps DSL component function to `(props) => IWidget` factory. Used for multi-instance widgets like models where each DSL node creates a distinct widget instance.

```typescript
class WidgetRegistry {
  constructor(options?: { strict?: boolean });

  // Registration (throws after freeze())
  register(widget: IWidget): this;
  registerTypeFactory(
    component: unknown,
    factory: (props: Record<string, unknown>) => IWidget
  ): this;
  freeze(): void;

  // Lookup
  get(id: string): IWidget | undefined;
  getAll(): IWidget[];
  getAllWidgets(): IterableIterator<IWidget>;

  // Interface-filtered queries
  getSceneElements(): Array<ISceneElement<unknown>>;
  getRenderables(): Array<IRenderable<unknown>>;
  getAnimationControllers(): IAnimationController[];  // sorted by tickPriority
  getLoadables(): ILoadable[];
  getDslComposites(): IDslComposite[];
  getSceneLifecycleWidgets(): ISceneLifecycle[];
  getContainedRenderables(): IContainedRenderable[];
  getAttachmentHosts(): IAttachmentHost[];
  getInputDefaultProviders(): IInputDefaultProvider[];
  getExtraRenderPassWidgets(): IExtraRenderPass[];

  // Renderer lifecycle broadcasts
  notifyRendererCreated(renderer: WebGLRenderer): void;
  notifyRendererDisposing(renderer: WebGLRenderer): void;

  // Widget object management (root Object3D per widget)
  setWidgetObject(widgetId: string, obj: Object3D): void;
  getWidgetObject(widgetId: string): Object3D | undefined;
  clearWidgetObject(widgetId: string): void;

  // Cache key for compile-time invalidation
  buildCacheKey(): string;
}
```

**`CUSTOM_NODE_HANDLER`** — Symbol key for widgets that override default DSL node routing. Set on widget instances that implement `IHasCustomDslHandler`. The routing handler installed by `WidgetRegistry` calls the widget's `[CUSTOM_NODE_HANDLER]` method when the widget's `DslComponent` is encountered in a scene DSL tree.

**`VariableStore`** — Reactive key-value store with namespace-scoped `JsonPrimitive` values (`string | number | boolean | null`). Synchronous get/set. Subscription model for React integration via `useVariable`.

```typescript
type JsonPrimitive = string | number | boolean | null;

type VariableStoreReader = {
  get(namespace: string, key: string): JsonPrimitive | undefined;
  getNamespace(namespace: string): Readonly<Record<string, JsonPrimitive>>;
};

class VariableStore implements VariableStoreReader {
  set(namespace: string, key: string, value: JsonPrimitive): void;
  get(namespace: string, key: string): JsonPrimitive | undefined;
  getNamespace(namespace: string): Readonly<Record<string, JsonPrimitive>>;
  subscribe(key: string, listener: () => void): () => void;
}
```

**`useVariable<T>(namespace, key)`** — React hook. Reads from `VariableStoreContext` (no explicit store parameter). Subscribes to a `VariableStore` key and returns the current value. Re-renders the component when the value changes. Returns `undefined` if the key has no value. Must be used inside `<SceneEngine>`.

**Widget interfaces** — the `IWidget` hierarchy:
- `IWidget` — base interface. `{ readonly widgetId: string }`.
- `ISceneElement<TState, TExtra>` — declarative widget with compiled state, transition spec, and DSL component.
- `IRenderable<TState, TExtra>` — widget with Three.js lifecycle: `initialize(context)`, `apply(state, context)`, `dispose()`.
- `ILoadable` — async asset loading: `load(manifest)`, `isLoaded`.
- `IAnimationController` — per-frame tick: `onTick(context)`, optional `tickPriority`.
- `IDslComposite` — widget with child DSL components.
- `IVariableProvider` — publishes to VariableStore: `variableNamespace`, `variableKeys`.
- `ICameraActionTarget` (deprecated) — camera action target: `applyOrbit`, `applyDolly`, `applyReset`.
- `IRendererLifecycle` — WebGLRenderer lifecycle: `onRendererCreated`, `onRendererDisposing`.
- `IRenderContributor` — per-frame render data: `contributeRenderData(): RenderContribution`.
- `IContainedRenderable` — widget parented to an attachment host: `anchorWidgetId`, `anchorKey`, `rootObject`.
- `IAttachmentHost` — exposes named attachment points: `getAttachmentPoint(key)`.
- `ISceneLifecycle` — scene transition events: `onSceneEnter`, `onSceneExit`.
- `IInputDefaultProvider` — exposes default input actions: `getDefaultInputActions()`.
- `ICameraFocusTarget` — accepts camera focus requests: `requestFocus(position, target, smooth?)`.
- `ILightingOverride` — suppresses core scene lighting: `getLightingOverride()`, optional `receiveLightController`.
- `IExtraRenderPass` — additional WebGL render passes: `renderPass(renderer, width, height)`.
- `IViewChild` — accepts view-level opacity: `applyViewOpacity(opacity)`.

**Type guards** — exported from `widget/WidgetRegistry.ts`:
```typescript
function isSceneElement(w: IWidget): w is ISceneElement<unknown>;
function isRenderable(w: IWidget): w is IRenderable<unknown, unknown>;
function isLoadable(w: IWidget): w is ILoadable;
function isAnimationController(w: IWidget): w is IAnimationController;
function isCameraActionTarget(w: IWidget): w is ICameraActionTarget;
function isVariableProvider(w: IWidget): w is IVariableProvider;
function isDslComposite(w: IWidget): w is IDslComposite;
function isRendererLifecycle(w: IWidget): w is IRendererLifecycle;
function isSceneLifecycle(w: IWidget): w is ISceneLifecycle;
function isRenderContributor(w: IWidget): w is IRenderContributor;
function isContainedRenderable(w: IWidget): w is IContainedRenderable;
function isAttachmentHost(w: IWidget): w is IAttachmentHost;
function isInputDefaultProvider(w: IWidget): w is IInputDefaultProvider;
function isCameraFocusTarget(w: IWidget): w is ICameraFocusTarget;
function isLightingOverride(w: IWidget): w is ILightingOverride;
function isExtraRenderPass(w: IWidget): w is IExtraRenderPass;
function isViewChild(w: IWidget): w is IViewChild;
```

**Context types** — the argument types passed to widget lifecycle methods:

```typescript
type WidgetInitContext = {
  scene: ThreeScene;
  widgetId: string;
  renderer?: WebGLRenderer;
  camera?: PerspectiveCamera;
};

type WidgetRenderContext<TExtra = unknown> = {
  clock: RealtimeClock;
  effectiveDeltaSeconds: number;
  globalProgress: number;
  variables: VariableStoreReader;
  extra: TExtra;
  tick?: SceneTrackTick | null;
  coords: NVSCoordService;
};

type CompileExtraContext = {
  blockProgress: number;
  globalProgress: number;
  prefersReducedMotion: boolean;
};

type AnimationTickContext = {
  clock: RealtimeClock;
  effectiveDeltaSeconds: number;
  scene: ThreeScene;
  variables: VariableStore;
  tick: SceneTrackTick | null;
  track: SceneTrack | null;
  resolvedState: unknown;
  cameraFocusTarget: ICameraFocusTarget | null;
  cameraOverride: RuntimeCameraOverride | null;
  setCameraOverride: (override: RuntimeCameraOverride | null) => void;
};
```

`RealtimeClock` provides `wallTimeSeconds` (absolute time since page load) and `deltaSeconds` (real-time elapsed since last frame). Both fields are synchronized — every widget receives identical values each frame.

`NVSCoordService` provides `toWorld(nvsX, nvsY, z?)` and `toWorldSize(nvsW, nvsH)` for converting NVS [0..1] viewport coordinates to Three.js world-space, plus `canvasAspect`, `visibleWorldHeight`, `visibleWorldWidth`, `viewportWidth`, and `viewportHeight`. The NVS mapping is pinned to the compiled camera state (via `NVSCameraParams`) — user camera interaction (orbit, zoom, pan) does not affect NVS positions. `createNVSCoordService` accepts `NVSCameraParams` (pure math, no Three.js dependency) rather than a live `THREE.PerspectiveCamera`.

**Material system** — the widget layer includes a material preset system for loading and applying PBR texture sets:
- `materialTypes.ts` — defines `MaterialPreset` (named texture set with maps for color, normal, roughness, metalness, AO), `MaterialPresetMaps` (URL references to texture files), `MaterialPresetDefaults` (default PBR property overrides), `MaterialManifest` (collection of named presets), `MaterialApplication` (runtime application controls — colorMix, brightness, saturation, contrast, depthMix, roughnessMix, tint, texScale), `LoadedMaterialTextures`, and `LoadedMaterialPreset`.
- `MaterialLoader.ts` — runtime texture loader that fetches and caches material preset textures. Used by `FloorWidget` and `CarouselScrubberWidget` to apply named material presets (e.g., 'onyx', 'steel') to their surfaces.

**Hooks** — the widget layer exports:
- `useVariable(namespace, key)` — reactive hook for reading VariableStore values from React components.
- `useCarouselState(layoutId)` — reactive hook that returns the current carousel state (active index, total slides) for a given `ViewLayout` carousel.

### 3.6 HUD (`hud/`)

The legacy compiled HUD pipeline (`<Hud>`, `<HudItem>`, `hudCompiler.ts`, `HudOverlay.tsx`) has been removed. The `hud/` directory contains the InputHud system:

- `InputHud.tsx` — Deferred `InputHud` component. Returns null (rendering not yet implemented). Accepts `InputHudProps` with `state: InputHudState` and `visible?: boolean`. The data model and event plumbing (`onActionFired` from `ActionInputController`) are implemented.
- `inputHudTypes.ts` — Data model for the InputHud overlay. Defines `InputHudHint` (action ID, type, human-readable trigger descriptions, original maps) and `InputHudState` (sorted hints array, detected platform).
- `__tests__/` — Tests for the InputHud module.

Overlay content is authored via the `<TextBox>` DSL element (in `elements/text-box/`) and rendered through `EngineOverlayHost`.

### 3.7 Labels

Labels have been moved entirely to the `@brewsite/model` package. `LabelItem`, `LabelPositioner`, and all label compilation logic live in `packages/model/src/`. `@brewsite/core` has no label-related code.

### 3.8 Input (`input/`)

Scene navigation and action-based input. The input system is unified: a single declarative `<InputController>` DSL element covers all keyboard, pointer, and wheel-based input. The compiled spec is read at runtime by `InputCoordinator`, which bridges it to `ActionInputController`.

**`ActionInputController`** — The sole runtime input controller. Maps pointer, wheel, pinch, and keyboard events to named actions. Actions are dispatched to typed handlers:

- `camera.orbit` / `camera.zoom` / `camera.reset` — delegated to `CameraWidget` methods via `UseSceneEngineResult`
- `scene.next` / `scene.prev` — call `engine.advanceProgress(delta)` to step through scenes
- `carousel.next` / `carousel.prev` — forward-declared; runtime handler is a follow-on plan
- Unknown action types — forwarded to `onUnknownAction` from `ActionInputExtensionContext` (used by `@brewsite/diagram` to handle `diagram-canvas.*` actions)

The `<InputController>` DSL component and its `<Action>` children compile to a `SceneInputControllerSpec` stored at the `__input_controller` widget ID in the SceneTrack:

```typescript
type SceneInputControllerSpec = {
  id: string;
  scope: InputControllerScope;   // 'canvas' | 'window'
  actions: InputActionSpec[];
};

type InputActionSpec = {
  id: string;
  type: InputActionType;  // 'camera.orbit' | 'scene.next' | 'carousel.next' | string
  cameraId?: string;
  canvasId?: string;
  focusCenter?: [number, number] | [number, number, number];
  speed?: number;
  stepScenes?: number;
  maps: InputActionMap[];   // pointer/wheel/pinch/key event bindings
};
```

When no scene authors an `<InputController>`, the compiler injects a default spec at compile time:
- `scope: 'window'`, id `'__default'`
- ArrowRight / ArrowDown to `scene.next`
- ArrowLeft / ArrowUp to `scene.prev`

**`InputCoordinator`** (player layer, `player/InputCoordinator.tsx`) — The React bridge component. Replaces the deleted `ActionInput`, `KeyboardInput`, and `InertiaScrollSource` components. Reads `__input_controller` from the current tick on every DOM event (no re-mount on scene change), constructs an `ActionInputController`, and keeps it attached for the component lifetime. Dispatches recognized actions to engine methods and unknown actions to `ActionInputExtensionContext`. Renders null.

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

### 3.11 Layout (`layout/`)

Spatial composition utilities for the View/Region system. All code here is pure — no Three.js, no React, no side effects.

**`layout/regionTypes.ts`** — Type contracts for the region system:

```typescript
/** RegionBounds is an alias for NVSRect. All region math operates on NVSRect directly. */
type RegionBounds = NVSRect;

/** Padding spec — single value, [vertical, horizontal], or [top, right, bottom, left]. All in NVS fractions. */
type RegionPadding = number | readonly [number, number] | readonly [number, number, number, number];

/** Always [top, right, bottom, left]. Produced by normalizePadding(). */
type NormalizedPadding = readonly [number, number, number, number];

/** Layout policy discriminator. */
type ViewLayoutKind = 'stack' | 'carousel';

type StackLayoutConfig = {
  kind: 'stack';
  direction?: 'horizontal' | 'vertical';  // default: 'horizontal'
  gap?: number;                            // Resolved NVS gap between views. Default: 0.
  // Note: this is a compiled/internal type. The DSL surface (ViewLayoutProps.gap) uses SceneLength.
};

type CarouselLayoutConfig = {
  kind: 'carousel';
  activeIndex: number;      // 0-indexed active view
  gap?: number;             // Resolved NVS gap between adjacent views. Default: 0.04.
  inactiveScale?: number;   // Scale for inactive views. Default: 0.75.
  zStep?: number;           // NVS z-step per position from active. Default: 0.1.
  // Note: this is a compiled/internal type. The DSL surface (ViewLayoutProps.gap) uses SceneLength.
};

type ViewLayoutConfig = StackLayoutConfig | CarouselLayoutConfig;

/** Per-view result of a layout resolution pass. */
type ViewLayoutResult = {
  bounds: NVSRect;   // Resolved absolute NVS bounds for this view
  layer: number;     // Z-order — higher = in front
  scale: number;     // Scale factor (1.0 = full size; < 1.0 for inactive carousel items)
};
```

**`layout/regionNormalize.ts`** — Pure helper functions:

```typescript
/** Normalize any RegionPadding form to a 4-tuple [top, right, bottom, left]. */
function normalizePadding(padding: RegionPadding): NormalizedPadding;

/** Apply padding insets to a rect, returning the inner content bounds. */
function applyPaddingToRect(rect: NVSRect, padding: NormalizedPadding): NVSRect;

/** Resolve a RegionContract to its full ResolvedRegion (outer bounds + content bounds + padding). */
function resolveRegion(contract: RegionContract): ResolvedRegion;

/**
 * Map a local [0..1] NVS rect into a parent NVS rect.
 * local.x=0 maps to parent.x; local.x=1 maps to parent.x + parent.w.
 * Used by CompileApi.composeBounds() to chain view nesting.
 */
function composeBoundsIntoParent(local: NVSRect, parent: NVSRect): NVSRect;

/** Compute the smallest NVS rect enclosing both input rects. */
function unionBounds(a: NVSRect, b: NVSRect): NVSRect;
```

**`layout/regionLayout.ts`** — Layout resolution algorithms:

```typescript
/**
 * Resolves a layout for N child views within a container.
 * Returns one ViewLayoutResult per child in the same order as childSizeHints.
 */
function resolveLayout(
  config: ViewLayoutConfig,
  container: NVSRect,
  childSizeHints: Array<{ w: number; h: number }>,
): ViewLayoutResult[];

/** Stack layout: arranges views linearly with optional gap. */
function resolveStackLayout(
  config: StackLayoutConfig,
  container: NVSRect,
  childSizeHints: Array<{ w: number; h: number }>,
): ViewLayoutResult[];

/** Carousel layout: symmetric fan around active view with scale + z-depth falloff. */
function resolveCarouselLayout(
  config: CarouselLayoutConfig,
  container: NVSRect,
  childSizeHints: Array<{ w: number; h: number }>,
): ViewLayoutResult[];
```

**`layout/index.ts`** — Re-exports all public layout symbols. Consumers of the View/Region system import from `@brewsite/core/layout` or directly from `@brewsite/core` (types are re-exported from the core index).

**Design rule for the layout module:** All functions are pure. They accept plain data and return plain data. There is no Three.js, no React, and no mutable shared state. Tests for this module use real inputs and assert exact output shapes.

### 3.12 Units (`units/`)

Pure type definitions and resolution functions for the scene unit system. No Three.js, no React, no side effects.

All DSL spatial props (positions, sizes, gaps) require explicit unit strings instead of bare numbers. The unit system enforces authoring-time clarity about coordinate semantics while keeping compiled state as plain `number` for O(1) runtime sampling.

**Type definitions (`units/types.ts`):**

```typescript
/** A spatial value with explicit units. */
type SceneLength = `${number}u` | `${number}%` | `${number}vw` | `${number}vh` | 0;

/** An angle value with explicit units. */
type SceneAngle = `${number}deg` | `${number}rad` | 0;

/** A 2D spatial value (e.g., size). */
type SceneSize2 = readonly [SceneLength, SceneLength];

/** A 3D spatial value (e.g., position with Z). */
type ScenePosition3 = readonly [SceneLength, SceneLength, SceneLength];

/**
 * Layout padding — follows CSS shorthand.
 * 1 value: uniform. 2 values: [vertical, horizontal].
 * 3 values: [top, horizontal, bottom]. 4 values: [top, right, bottom, left].
 */
type ScenePadding =
  | SceneLength
  | readonly [SceneLength, SceneLength]
  | readonly [SceneLength, SceneLength, SceneLength]
  | readonly [SceneLength, SceneLength, SceneLength, SceneLength];

type ParsedLength = { readonly value: number; readonly unit: 'u' | '%' | 'vw' | 'vh' };
type ParsedAngle = { readonly value: number; readonly unit: 'deg' | 'rad' };
```

**Unit semantics:**
- `u` — world units (maps 1:1 to Three.js world space at the default camera distance).
- `%` — percentage of the parent container (or viewport when no parent).
- `vw` — percentage of viewport width (analogous to CSS `vw`).
- `vh` — percentage of viewport height (analogous to CSS `vh`).
- `0` — literal zero, accepted without a unit suffix.

**Resolution functions (`units/parse.ts`, `units/resolve.ts`):**

```typescript
function parseLength(value: SceneLength): ParsedLength;
function parseAngle(value: SceneAngle): ParsedAngle;

type UnitContext = {
  viewportWidth: number;
  viewportHeight: number;
  containerWidth: number;
  containerHeight: number;
};

function resolveToNVS(value: SceneLength, axis: 'x' | 'y', ctx: UnitContext): number;
function resolveAngle(value: SceneAngle): number;  // always returns radians
function isUniformUnit(a: SceneLength, b: SceneLength): boolean;
function unitContextFromCoords(coords: NVSCoordService): UnitContext;
```

All resolution functions are pure. `resolveToNVS` converts a `SceneLength` to a normalized NVS fraction suitable for the compiled `ViewState` / `ViewLayoutState`. The compiled state remains `number` — the unit system is a DSL-surface concern only.

**DSL-to-compiled boundary:** `ViewProps.x/y/w/h` and `ViewLayoutProps.x/y/w/h/gap` accept `SceneLength` at the DSL surface. The `viewHandlers.ts` compile step calls `resolveToNVS` to produce the `number` values stored in `ViewState` and `ViewLayoutState`. Internal layout types (`StackLayoutConfig.gap`, `CarouselLayoutConfig.gap`, `NVSRect` fields) remain `number` because they operate on already-resolved NVS fractions.

**Not yet migrated:** `RegionPadding` (and `ViewProps.padding`) remains `number`-based. Migration to `ScenePadding` is a follow-on task.

**`units/index.ts`** — Re-exports all public types and functions. Consumers import from `@brewsite/core` (types are re-exported from the core index).

---

## 4. Key Data Types

All type definitions below are taken directly from `packages/core/src/compiler/sceneTrackTypes.ts` and related source files.

### 4.1 SceneFrame

The declared state of a scene at a single point in time. Produced by the DSL compiler. Consumed by the track compiler to bake `SceneTrackTick[]`.

```typescript
type SceneFrame = {
  id: string;
  scrollProgress: number;
  widgets: Record<string, unknown>;              // widgetId -> compiled widget state
  meta?: Record<string, JsonPrimitive>;
  materialMetalnessMultiplier?: number;
  materialRoughnessMultiplier?: number;
  transitionWindow?: TransitionWindow;           // per-scene transition window config
  progressManager?: ProgressManagerSpec;         // per-scene scroll weight and pacing
  primaryCarouselId?: string;                    // primary carousel layout widget ID
  sceneOverlay?: ReactNode;                      // non-DSL JSX overlay content (e.g. <TextBox>)
};
```

Each entry in `widgets` is typed as `unknown` at the frame level because each widget owns the shape of its own state. The `IRenderable.apply(state, context)` method receives the specific widget's state cast appropriately.

### 4.2 SceneFrameDelta

A sparse diff between two `SceneFrame` states. Fields are only present when the value changed between the previous tick and this one. Used by the runtime to skip unnecessary `IRenderable.apply()` calls for widgets that did not change.

```typescript
type SceneFrameDelta = {
  widgets?: Record<string, unknown>;
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
   * Evaluate this widget's state at blockProgress in [0, 1].
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
  progress: number;             // [0, 1] global progress
  sceneId: string;
  sceneIndex: number;
  blockProgress: number;        // [0, 1] progress within the current transition block
  sceneProgress?: number;       // [0, 1] progress within the current scene
  state: SceneFrame;            // fully resolved widget states for this tick
  deltaForward: SceneFrameDelta;    // diff from previous tick
  deltaBackward: SceneFrameDelta;   // diff from next tick
  widgetExtras?: Record<string, unknown>;  // per-widget compiled extras
};
```

`blockProgress` is the coordinate passed to `FunctionalWidgetTransition.fn()`. For ticks outside transition blocks (steady-state), `blockProgress` is `0` (start of scene) or `1` (end of scene).

`sceneProgress` is normalized progress within the current scene [0, 1]. At the first tick of a scene, `sceneProgress = 0`. At the terminal tick of the final scene, `sceneProgress = 1`. This field is optional for backward compatibility; it defaults to `blockProgress` when absent at runtime.

### 4.7 SceneTrack

The compiled output of the entire scene definition. A flat array of `SceneTrackTick` with metadata for O(1) sampling.

```typescript
type SceneTrack = {
  ticks: SceneTrackTick[];
  tickStep: number;              // 1 / (totalTicks - 1) — progress increment per tick
  subTickCount: number;          // total tick count
  sceneWindows: SceneWindow[];
  /**
   * Present only when at least one widget uses FunctionalTransitionSpec.
   * Length <= numScenes - 1 (one entry per transition block that has functional closures).
   */
  transitionBlocks?: SceneTrackTransitionBlock[];
  /** Warnings accumulated during compilation. Empty/undefined when no issues. */
  warnings?: CompileWarning[];
  /** Per-scene scroll weights and pacing curves. Undefined when no <ProgressManager> was declared. */
  progressProfile?: SceneProgressProfile;
  /** Keyed by scene id. Non-DSL JSX overlay content rendered by EngineOverlayHost. */
  sceneOverlays?: Map<string, ReactNode>;
};
```

Sampling by progress is: `ticks[Math.min(Math.round(progress / tickStep), ticks.length - 1)]`.

---

## 5. Compiler Architecture

The compiler runs once at scene load time (or build time with caching) and produces the `SceneTrack`. It is a pure multi-pass algorithm with no side effects.

### 5.1 Step 1: Evaluate DSL to SceneFrame[]

Each scene's JSX is evaluated once. The JSX evaluation traverses the React element tree, calling the compiler registry's `getNodeHandler()` for each recognized DSL component. Each handler transforms JSX props into a widget state entry and writes it into a `SceneFrame.widgets` record.

The result is a `SceneFrame[]` — one `SceneFrame` per scene, representing the declared state at that scene stop.

### 5.2 Step 2: Allocate Tick Array

The timeline determines the total tick count:
```
totalTicks = (numScenes - 1) * subTicksPerSegment * oversamplingRate + 1
```
A flat `SceneTrackTick[]` array of this size is allocated. Each tick is pre-populated with its `index`, `progress`, `sceneId`, and `sceneIndex`.

### 5.3 Step 3: Fill Transition Blocks via Widget Batch Methods

For each pair of adjacent scenes (block index N to scene N+1), the compiler iterates over the union of widget IDs present in either scene and calls one of three dispatch paths:

**Path A — FunctionalTransitionSpec (closure capture):**
The compiler calls `exitFn(fromState)`, `enterFn(toState)`, or `interpolateFn(fromState, toState)` once, capturing endpoint state into closures. The returned `(t: number) => T` functions are wrapped with transition-window remapping and stored in `SceneTrack.transitionBlocks[N].widgetFns`.

Path A is the standard path. All built-in and external widgets use `FunctionalTransitionSpec`. The compiler detects functional specs via `isFunctionalSpec(spec)` — i.e., when the spec has `interpolateFn` rather than `interpolate`.

**Path B — No transition spec:**
Widget snaps between states at the midpoint of the transition block. Frames before the midpoint use the `fromState`; frames from the midpoint use `toState`.

### 5.4 Step 4: Fill Terminal Frame

The final tick (`index = totalTicks - 1`, `progress = 1.0`) is filled with the last scene's fully resolved states. This ensures the animation can reach its final scene without floating-point sampling error.

### 5.5 Step 5: Run compileExtra()

Each `ISceneElement` widget that implements `compileExtra(context: CompileExtraContext)` is called once per tick. This pass allows widgets to write into `SceneTrackTick.widgetExtras` — for example, model widgets bake animation clip metadata (durations, start/end times) into `widgetExtras` so the runtime has this data available at tick time without recomputing it.

### 5.6 Step 6: Compute Forward and Backward Deltas

For each tick, the compiler computes `deltaForward` (diff from the previous tick) and `deltaBackward` (diff from the next tick). Deltas are sparse: only widget IDs whose state changed from one tick to the next appear in the delta. These deltas allow the runtime to skip `IRenderable.apply()` calls for widgets that did not change.

---

## 6. Transition Spec Types

### 6.1 ElementTransitionSpec (Deprecated)

`ElementTransitionSpec<T>` is retained as a `@deprecated` type alias for backward compatibility. No built-in or external widget implements it — all widgets use `FunctionalTransitionSpec` exclusively. The `sceneTrackCompiler.ts` code path for discrete batch-fill has been removed. Consumers who referenced `ElementTransitionSpec` in custom widgets must migrate to `FunctionalTransitionSpec`.

### 6.2 FunctionalTransitionSpec (Closure-Based)

```typescript
type FunctionalTransitionSpec<T> = {
  /**
   * Called once with fromState at compile time.
   * Returns a pure function: t in [0, 1] -> T.
   * Active over the configured exit window.
   * t = 0: widget at fromState. t = 1: widget fully absent.
   */
  exitFn(fromState: T): (t: number) => T;

  /**
   * Called once with toState at compile time.
   * Returns a pure function: t in [0, 1] -> T.
   * Active over the configured enter window.
   * t = 0: widget fully absent. t = 1: widget at toState.
   */
  enterFn(toState: T): (t: number) => T;

  /**
   * Called once with (fromState, toState) at compile time.
   * Returns a pure function: t in [0, 1] -> T.
   * Active over full block (blockProgress in [0, 1]).
   * t = 0: widget at fromState. t = 1: widget at toState.
   */
  interpolateFn(fromState: T, toState: T): (t: number) => T;
};
```

The type guard `isFunctionalSpec<T>(spec)` identifies functional specs at compile time:
```typescript
const isFunctionalSpec = <T>(
  spec: ElementTransitionSpec<T> | FunctionalTransitionSpec<T>,
): spec is FunctionalTransitionSpec<T> => 'interpolateFn' in spec;
```

`FunctionalTransitionSpec` captures closures at compile time. The runtime evaluates `fn(tick.blockProgress)` once per frame for widgets in a functional transition block, producing continuous smooth curves without requiring a large tick array. This is the only transition dispatch path in active use.

---

## 7. Runtime Data Flow

The complete lifecycle from compile output to Three.js draw call:

```
Scene DSL (JSX)
  | compileSceneTrack()
SceneTrack (flat pre-baked array)
  | SceneTrackSampler.sample(globalProgress)
SceneTrackTick (O(1) index lookup)
  | RuntimeDriverImpl.tick()
  |
  +-- For each IRenderable widget where state changed (deltaForward/deltaBackward):
  |     widget.apply(tick.state.widgets[id], context)
  |       | render.ts functions
  |     Three.js object mutations (position, material, visibility, etc.)
  |
  +-- For each widget in SceneTrack.transitionBlocks[blockIndex]:
  |     state = transitionBlock.widgetFns[id].fn(tick.blockProgress)
  |     widget.apply(state, context)
  |
  +-- For each IAnimationController widget (sorted by tickPriority):
  |     widget.onTick(animContext)
  |       | advances Three.js AnimationMixer
  |
  +-- For each IVariableProvider widget:
        widget.publishVariables(store, context)
          | store.set(namespace, key, value)
        -> triggers useVariable() re-renders in React overlay
  |
THREE.WebGLRenderer.render(scene, camera)
  |
RuntimeDriverImpl.collectRenderContributions()
  | aggregates namedPositions + targetColors from all IRenderContributor widgets
  -> consumed by LabelPositioner (@brewsite/model) for 3D-to-CSS projection
  |
canvas frame
```

The React overlay layer runs in parallel (same frame, via React's `useLayoutEffect` / `useEffect`):

```
SceneTrackTick
  | SceneTrack.sceneOverlays[sceneId]
EngineOverlayHost (React) renders scene overlay content (e.g. TextBox)
  | collectRenderContributions().namedPositions
LabelPositioner (@brewsite/model) projects 3D coordinates -> CSS pixel positions
  | updates LabelItem DOM nodes
```

---

## 8. Compiler Registry

The compiler uses a global node handler registry to route DSL JSX nodes to their compilation handlers.

**`compiler/registry.ts`** manages two maps:
1. `nodeRegistry: Map<unknown, NodeHandler>` — keyed by the component function reference.
2. `nodeRegistryByName: Map<string, NodeHandler>` — keyed by `component.displayName ?? component.name`. This fallback enables registry lookups after module bundler mangling.

```typescript
function registerNode(component: unknown, handler: NodeHandler, options?: { category: NodeHandlerCategory }): void;
function getNodeHandler(component: unknown): NodeHandler | undefined;
function isPrimitiveComponent(component: unknown): boolean;
function clearRegistry(): void;  // test utility
```

`NodeHandlerCategory` is `'spatial' | 'ambient'`. Ambient widgets (Camera, Lighting, etc.) are exempt from scene view constraint enforcement. Defaults to `'spatial'` if not specified.

Each element's widget registration calls `registerNode()` (via `WidgetRegistry.register()`) with its DSL component function and a handler:

```typescript
type NodeHandler = (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => void;
```

The compiler evaluates a scene by traversing the JSX tree and calling `getNodeHandler(element.type)` for each node. If a handler is found, it is called with the element, compile API, and helpers. The handler uses `api.setWidgetState()` to write into the current `SceneFrame`. Unrecognized nodes are ignored (they may be React layout components or custom consumer components).

---

## 9. Entry Transitions Rule

Entry transitions belong to the **incoming** scene, not the outgoing one.

When the compiler processes the transition block between scenes N and N+1, the transition behavior (easing, duration within the block, animation style) is determined by the widget registration of the element as it appears in scene N+1. If the element declares a `FunctionalTransitionSpec`, that spec governs the entire block including the exit of scene N.

This rule ensures consistent mental model: to change how a scene animates in, the author edits the incoming scene's element declarations.

Corollary: there is no "outgoing scene transition" concept. A scene controls its entry animation; it does not control how it is animated out.

---

## 10. SSR Safety Contract

All code in `@brewsite/core` satisfies the following invariants:

1. **No top-level browser global access.** No module-level access to `window`, `document`, `navigator`, `performance`, or `requestAnimationFrame`. All browser-dependent code is inside function bodies, component mount callbacks, or `useEffect`/`useLayoutEffect`.

2. **Three.js instantiation is deferred to mount.** `WebGLRenderer`, `Scene`, `PerspectiveCamera`, and all Three.js instances are created in mount lifecycle, never at module import time.

3. **SceneEngine renders safely on the server.** The component defers all WebGL initialization to client-side effects. `EngineGate` renders the `placeholder` prop (or null) until the engine's first client-side frame rather than attempting to create a WebGL context.

4. **Compiler is SSR-safe and build-time safe.** `compileSceneTrack()` is a pure function. It runs in Node.js, Vitest, or browser environments without modification.

5. **All hooks are no-ops during SSR.** `useEngineScrubber`, `useSceneProgress`, `useCurrentScene`, and all other hooks return safe initial values during server rendering and initialize their listeners on client mount.

---

## 11. Testing Philosophy and Coverage

Tests live in `__tests__/` directories co-located with the code they test. Test files are named `*.test.ts` or `*.test.tsx`.

**Interface-based stateful testing.** Tests use real inputs and assert real outputs. They do not mock internal method calls. A test for the compiler calls `compileSceneTrack()` with a real DSL and asserts properties of the resulting `SceneTrack`. A test for `RuntimeDriverImpl` creates a real instance with a real `WidgetRegistry` populated with interface-conforming test doubles from `runtime/mocks/`.

**No mocking of internal calls.** If a module is hard to test without mocking its internals, that is a design signal: the module has too many dependencies and should be refactored.

**Runtime test doubles.** `runtime/mocks/widgetMocks.ts` provides widget test doubles that implement `IWidget` sub-interfaces with controllable state. These are not jest spies — they are real implementations that record calls and expose them for assertion.

**Coverage targets.** `vitest` coverage is configured to instrument:
```
packages/core/src/{compiler,elements,runtime,widget,player,hud,input,timeline,units,math}/**/*.ts
packages/diagram/src/**/*.ts
packages/model/src/**/*.ts
packages/charts/src/**/*.ts
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

4. **`@brewsite/diagram` may import from `@brewsite/core`, never vice versa.** This is a hard dependency direction constraint. `@brewsite/core` must remain publishable and usable without `@brewsite/diagram`. The same rule applies to `@brewsite/model`, `@brewsite/charts`, `@brewsite/screens`, `@brewsite/slides`, and `@brewsite/themes`.

5. **Widget classes are the runtime integration contract.** New renderable or behavioral concepts are added by implementing `IWidget` (and relevant sub-interfaces) and registering with `WidgetRegistry`. The runtime and compiler are not modified to accommodate new concepts.

6. **Entry transitions belong to the incoming scene.** Transition behavior for a scene-to-scene boundary is determined by the incoming scene's widget declarations.

7. **Lower layers never import from higher layers.** `math/` does not import from `compiler/`. `compiler/` does not import from `runtime/`. `elements/` does not import from `player/`.

8. **The mandatory element module pattern is not optional.** Every new element module must contain `types.ts -> dsl.tsx -> compile.ts -> render.ts -> {Name}Widget.ts -> index.ts` in that dependency order. `dsl.tsx` contains only prop type interfaces; DSL stub functions live in `{Name}Widget.ts`. Files that don't fit this pattern belong in a shared utility layer, not in an element module.

9. **No new peer dependencies without justification.** React, react-dom, and Three.js are the established peers. Adding a new peer imposes a constraint on every consumer of the package. Any proposed new peer dependency requires explicit evaluation of its bundle impact, version range constraint, and alternative approaches.

10. **Test render.ts by integration, not by unit test.** `render.ts` files are excluded from coverage requirements because they require a live WebGL context. Integration testing of rendering behavior happens in the `apps/examples/` app via visual inspection, not in the automated test suite.
