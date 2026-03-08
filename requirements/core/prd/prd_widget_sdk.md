---
title: "BrewSite Core — Widget SDK"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-08
change_history:
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "DSL stub co-location: updated widget implementation pattern to reflect that dsl.tsx is now a pure type module (prop interfaces only) and DSL stub functions live in the widget file. Updated section 14 dsl.tsx and MyElementWidget.ts code examples accordingly."
  - date: 2026-03-07
    author: "Toolkit Product"
    summary: "Core cleanup: ISceneElement gains two new optional hooks — disableWhenAbsent (replaces duck-typed useDefaultStateWhenAbsent; when true, compiler substitutes makeDisabledDefault(defaultState) for absent scenes) and stateEquals (structural equality hook replacing JSON.stringify change detection in the compiler's delta pass). AnimationTickContext gains resolvedState (the widget's pre-resolved FunctionalTransitionSpec state for this tick, removing the need for controllers to duplicate runtime state resolution), cameraFocusTarget (the registered ICameraFocusTarget or null, replacing the __brewsite_cam_enabled scene.userData flag), cameraOverride (replaces __brewsite_camera_override key), and setCameraOverride callback (replaces __brewsite_camera_override_pending). New interfaces added: ICameraFocusTarget (requestFocus API for camera widgets), ICameraHost (decouples player layer from concrete CameraWidget), ILightingOverride (getLightingOverride + receiveLightController — replaces direct setSceneLightEnabled call from @brewsite/diagram). All scene.userData __brewsite_* bus keys eliminated."
  - date: 2026-03-05
    author: "Toolkit Product"
    summary: "@brewsite/slides integration: slidesPlugin() is now a published example of the WidgetPlugin pattern. It registers SlideMetaWidget (IWidget + CUSTOM_NODE_HANDLER via registerNode) and SlideNavWidget (plain IWidget registry anchor). SlideMetaWidget reads SceneTrackTick.sceneProgress and publishes per-slide metadata to VariableStore. This demonstrates: (1) a plugin that registers custom DSL node handlers without forking core; (2) VariableStore as the cross-widget reactive state bus; (3) plain IWidget as a registry anchor with no compile/render participation."
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the Widget SDK as the central extension mechanism for @brewsite/core, covering all interfaces, WidgetRegistry, VariableStore, CUSTOM_NODE_HANDLER, lifecycle phases, implementation patterns, and test infrastructure. Reflects the production implementation as of 2026-02-28."
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "DX improvements: WidgetRegistry now accepts WidgetRegistryOptions { strict?: boolean } constructor option — throws on duplicate widgetId when strict=true, warns otherwise. createDefaultWidgetRegistry passes { strict: true } by convention. DslComponent remains ComponentType<any> with added JSDoc explaining the intentional choice. CompileWarning type added to sceneTrackTypes.ts; SceneTrack.warnings? field added; onCompileWarning? prop added to ScenePlayer. IDslComposite correction: DiagramWidget declares layout elements (GridLayout, HierarchicalLayout, ManualLayout, Enter, Exit) as childDslComponents with topLevelError: true — the correct ownership model."
  - date: 2026-03-01
    author: "Toolkit Product"
    summary: "AnimationTickContext and WidgetRenderContext: replaced flat deltaSeconds/wallTimeSeconds with clock: RealtimeClock and effectiveDeltaSeconds. Added Widget Time Contract table (Section 12.6) and RealtimeClock type reference (Section 12.5) (plan_progress_driven_animation)."
  - date: 2026-03-01
    author: "Toolkit Product"
    summary: "Annotated IContainedModel as model-specific, moving to @brewsite/model in Phase 4 per plan_core_modularization. IContainedRenderable and IAttachmentHost remain as generic core interfaces."
  - date: 2026-03-03
    author: "Toolkit Product"
    summary: "API hardening update: replaced createDefaultWidgetRegistry() with the composable plugin model. Requirement #14 updated to document corePlugin() and modelPlugin(). Section 11 rewritten from createDefaultWidgetRegistry to document corePlugin() (from @brewsite/core) and modelPlugin() (from @brewsite/model) as the standard registration entry points. WidgetRegistry scope description updated from ScenePlayer to EngineProvider. useVariable context reference updated from ScenePlayer to EngineProvider. ScenePlayer.widgetSetup integration pattern references removed."
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "NVS system: added INVSBounded interface to Widget SDK (layout/types.ts). DiagramCanvasWidget, ChartWidget, and ModelWidget all implement INVSBounded. Interface documented in Section 6 (requirement 8b) and Section 8 (interface hierarchy). WidgetRegistry.getNVSBoundedWidgets() method added to Section 11."
  - date: 2026-03-03
    author: "Toolkit Product"
    summary: "Added IInputDefaultProvider interface (widget/types.ts), isInputDefaultProvider type guard, and WidgetRegistry.getInputDefaultProviders() method. The player layer uses these to supply default input actions from DiagramCanvasWidget when no explicit <InputController> is authored for the current scene."
---

# BrewSite Core — Widget SDK

## 1. Overview

The Widget SDK is the central extension mechanism for `@brewsite/core`. Every renderable concept in the toolkit — 3D models, cameras, lighting rigs, backgrounds, environment maps, reflective floors — is implemented as a widget. The SDK defines a set of TypeScript interfaces that a widget class implements to participate in the compilation pipeline, the runtime tick loop, and the asset loading lifecycle. External consumers can author and register entirely new 3D elements without modifying or forking the core library.

This document covers the full public API of the Widget SDK: the interface hierarchy (`IWidget`, `ISceneElement`, `IRenderable`, `ILoadable`, `IAnimationController`, `IContainedModel`, `IDslComposite`, `IVariableProvider`), the `WidgetRegistry` and `CUSTOM_NODE_HANDLER` mechanism, the `VariableStore` reactive state system, the `corePlugin()` and `modelPlugin()` built-in plugin factories, all context types used in callbacks, the widget lifecycle from registration through disposal, and the canonical implementation pattern for authoring a new widget.

Affects: `@brewsite/core`.

---

## 2. Problem Statement

Three.js-based scene toolkits frequently hard-code their renderable concepts, requiring consumers to fork the library to add new element types. This creates an unbounded maintenance surface, prevents clean versioning, and blocks third-party ecosystem development.

The BrewSite toolkit must be extensible at two seams: the authoring DSL (so new element types appear as JSX components in scene files) and the runtime (so new elements receive per-frame state and drive Three.js). Without a formal plugin contract, both seams are exposed as implementation details that break on every release.

The Widget SDK solves this by defining a stable, versioned interface set that widget authors implement. The toolkit's own built-in elements (`ModelWidget`, `CameraWidget`, `LightingWidget`, etc.) are first-class consumers of the same SDK — the SDK is not a secondary extension path but the primary element architecture.

---

## 3. Goals and Success Metrics

**Primary goals:**
- Any TypeScript developer can implement a new 3D element that participates in DSL authoring, compilation, and runtime rendering without modifying `@brewsite/core`.
- All built-in elements are implemented exclusively via the public Widget SDK interfaces — no privileged core-only APIs.
- The interface hierarchy is narrow: new interfaces are only added when a capability cannot be composed from existing interfaces.

**Success metrics:**
- A custom widget can be registered and rendering in fewer than 50 lines of implementation code (excluding Three.js setup).
- Zero TypeScript errors when implementing any Widget SDK interface with `strict: true`.
- Adding a custom widget does not increase base bundle size of `@brewsite/core` for consumers who do not use it (tree-shaking preserves this).
- The mocks in `runtime/mocks/` satisfy all interface contracts with no Three.js dependency — verifiable by import analysis.

**Guardrail metrics:**
- No regression to existing widget consumers across any minor version release.
- `IWidget` base interface remains stable across major versions where possible; breaking changes to `IWidget` itself trigger a major semver bump.

---

## 4. Non-Goals

- The Widget SDK does not define how widgets are visually styled or what Three.js geometry they produce. That is the widget author's domain.
- The SDK does not provide a React component rendering model for 3D elements. Three.js is the rendering substrate; React is confined to the DSL authoring surface and the player layer.
- Widget hot-module replacement (HMR) behavior during development is handled by the player layer, not the SDK.
- The SDK does not manage asset loading infrastructure (loaders, caching, CDN configuration). Asset loading is the widget's own concern; the SDK provides the `ILoadable` contract so the runtime knows when to start.
- Cross-widget communication beyond `VariableStore` is out of scope. Widgets should not hold direct references to one another.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to implement a new 3D element as a TypeScript class so that it participates in DSL authoring, compilation, and runtime rendering without modifying `@brewsite/core`.
- As a toolkit consumer, I want the TypeScript interfaces to express exactly what I need to implement so that I receive a compile error — not a silent runtime failure — if I omit a required method.
- As a toolkit consumer, I want to share state between widgets at runtime so that a camera widget can influence a label widget without direct coupling.
- As a toolkit consumer, I want to register multiple models of different types from the same DSL component so that `<Model type="hero" id="hero" />` and `<Model type="sidekick" id="sidekick" />` resolve to separate widget instances.
- As a toolkit consumer, I want the default widget registry to wire all built-in elements so that I can get a fully functional scene with a single factory call.
- As a `@brewsite/diagram` author, I want to provide a custom DSL node handler so that my complex nested DSL (nodes, edges, groups) is compiled correctly without writing a generic handler.

---

## 6. Functional Requirements

1. The system shall define `IWidget` as the base interface with a single `readonly widgetId: string` property. All other widget interfaces extend `IWidget`.
2. `ISceneElement<TState, TExtra>` shall declare the DSL authoring surface: `defaultState`, `transitionSpec`, and `DslComponent`. These three properties are the minimum for a widget to participate in the compiler pipeline.
3. `IRenderable<TState>` shall declare `initialize`, `apply`, and `dispose`. Widgets implementing `IRenderable` receive a `WidgetInitContext` once and a `WidgetRenderContext` on every frame.
4. `ILoadable` shall declare `load(manifest)` and `readonly isLoaded`. The runtime shall call `load` on all loadable widgets in parallel before starting the tick loop.
5. `IAnimationController` shall declare `onTick(context: AnimationTickContext)` and an optional `readonly tickPriority: number`. Controllers with lower priority values shall tick before those with higher values. The default priority when omitted is treated as `0`.
6. `IContainedModel<TState>` shall extend `IRenderable<TState>` and add `readonly anchorModelId: string` and `readonly anchorKey: string`. The runtime shall attach the contained model to the anchor bone after initial loading completes. (model-specific; see @brewsite/model)
7. `IDslComposite` shall declare `readonly childDslComponents` as an array of component descriptors. The `WidgetRegistry` shall install protective top-level node handlers for each child component to produce meaningful error messages when they appear outside their parent.
8. `IVariableProvider` shall declare `readonly variableNamespace: string` and `readonly variableKeys: readonly string[]`. The runtime uses this for introspection; actual variable publishing is done inside `onTick` via `AnimationTickContext.variables`.
8a. `IInputDefaultProvider` shall declare `getDefaultInputActions(): InputActionSpec[]`. Widgets that carry per-canvas default input actions in their compiled state implement this interface. The player layer calls `WidgetRegistry.getInputDefaultProviders()` each frame to aggregate default actions for the current scene when no explicit `<InputController>` is authored.
8b. `INVSBounded` shall declare `readonly nvsBounds: NVSRect`. Widgets that occupy a declared sub-region of the AR-locked viewport implement this interface. `nvsBounds` returns the current NVS rectangle from the widget's most recently applied state; before any state has been applied, it returns the fullscreen default `{ x: 0, y: 0, w: 1, h: 1 }`. The interface is defined in `packages/core/src/layout/types.ts` and exported from `@brewsite/core`. `DiagramCanvasWidget`, `ChartWidget`, and `ModelWidget` all implement `INVSBounded`.
9. `WidgetRegistry.register(widget)` shall install a DSL node routing handler for the widget's `DslComponent` if one has not already been installed.
10. `WidgetRegistry.registerTypeFactory(component, factory)` shall install a type-routed handler that calls `factory(props)` on first encounter of a given `type` prop value, then registers and dispatches to the produced widget.
11. `CUSTOM_NODE_HANDLER` shall be a `Symbol` that widgets set on themselves to provide their own DSL node compilation logic. When present, the routing handler installed by `WidgetRegistry` shall delegate to it instead of the default state-merge path.
12. `VariableStore` shall be a reactive key-value store partitioned by namespace. Consumers may subscribe to individual keys (`namespace.key`) or an entire namespace.
13. The `VariableStoreReader` read-only view shall be the only variable access surface provided to `IRenderable` widgets via `WidgetRenderContext`. Full read-write `VariableStore` access is provided to `IAnimationController` widgets via `AnimationTickContext`.
14. `corePlugin()` shall provide the standard set of built-in core widgets (`LightingWidget`, `BackgroundWidget`, `EnvironmentWidget`, `FloorWidget`, `CameraWidget`, `SceneMetaWidget`) and register their DSL node handlers. `modelPlugin()` from `@brewsite/model` shall provide `ModelWidget` (via a type factory) and register model DSL handlers. Both are passed as entries in the `plugins` prop of `EngineProvider`.
15. All type guard functions (`isSceneElement`, `isRenderable`, `isLoadable`, `isContainedModel`, `isDslComposite`, `isAnimationController`, `isVariableProvider`) shall be exported from the `widget` module for use by the runtime and by custom registry implementations.

---

## 7. Interface Hierarchy

### 7.1 IWidget — Base Interface

```typescript
interface IWidget {
  readonly widgetId: string;
}
```

`widgetId` is the stable identifier used by the `WidgetRegistry`, the compiler (to key widget state in `SceneTrackTick.state.widgets`), and the runtime (to route sampled state to the correct `IRenderable`). It must be unique across all registered widgets in a given registry. The convention for built-in widgets uses simple lowercase keys (`'camera'`, `'lighting'`, `'floor'`). For type-factory-produced widgets, the `id` prop from the DSL element becomes the `widgetId`.

---

### 7.2 ISceneElement\<TState, TExtra = void\>

```typescript
interface ISceneElement<TState, TExtra = void> extends IWidget {
  readonly defaultState: TState;
  readonly transitionSpec:
    | ElementTransitionSpec<TState>
    | FunctionalTransitionSpec<TState>;
  /**
   * The DSL React component for this widget.
   * Typed as ComponentType<any> because the registry is intentionally heterogeneous —
   * each registered widget has a different prop type for its DSL component.
   * DSL prop type safety is enforced at each widget's own component definition, not here.
   */
  readonly DslComponent: React.ComponentType<any>;
  compileExtra?(state: TState, context: CompileExtraContext): TExtra;
  mergeSnapshot?(
    prev: TState | undefined,
    next: TState | undefined,
  ): TState | undefined;
  readonly requiresTypeProp?: boolean;
  /**
   * When true, the compiler substitutes makeDisabledDefault(defaultState) —
   * a clone of defaultState with `enabled` forced to false — for scenes where
   * this widget is absent. When false or omitted, absent scenes receive the raw
   * defaultState unchanged.
   *
   * Replaces the duck-typed `readonly useDefaultStateWhenAbsent = false` pattern
   * that existed on CameraWidget, LightingWidget, and BackgroundWidget. The old
   * name was a double-negative that misrepresented the behaviour.
   *
   * Default: false. Widgets that should be disabled when not authored in a scene
   * (Camera, Lighting, Background) declare: `readonly disableWhenAbsent = true`.
   */
  readonly disableWhenAbsent?: boolean;
  /**
   * Optional structural equality hook for the compiler's delta-detection pass.
   *
   * When provided, replaces the JSON.stringify comparison in buildDelta().
   * Eliminates false positives from non-deterministic key ordering and removes
   * O(n×k) serialization cost for widgets with large or non-serializable state.
   *
   * @param a - Previous state.
   * @param b - Next state.
   * @returns true when the two states are functionally equivalent.
   */
  stateEquals?(a: TState, b: TState): boolean;
}
```

**`defaultState`** — The state returned by the compiler when a scene does not reference this widget at all. It is the zero-point for transitions into the first scene that does use the widget.

**`transitionSpec`** — Controls how the compiler bakes transition state between scene snapshots. Two variants are supported:

- `ElementTransitionSpec<TState>` — Discrete: the compiler calls `enter`, `exit`, and `interpolate` to produce pre-baked tick data. State is fully materialized at compile time; the runtime samples it at O(1) with no per-frame closures.
- `FunctionalTransitionSpec<TState>` — Functional: the compiler stores a closure `fn: (blockProgress: number) => TState`. The runtime evaluates this closure each frame at the current `blockProgress`. Used for transitions that need to reference runtime data (e.g., camera state, spring physics).

**`DslComponent`** — The React component used in scene authoring. The `WidgetRegistry` uses this as a key to install a DSL node routing handler. The component itself renders nothing (`return null`) — it is a pure data declaration. Its props shape defines the authoring API for that element type.

**`compileExtra`** — Optional per-tick extra data computation. Called by the compiler during the baking pass. The resulting `TExtra` value is stored in `SceneTrackTick.widgetExtras[widgetId]` and provided to `IRenderable.apply` via `WidgetRenderContext.extra`. Use this to attach clip-frame mappings, derived geometry parameters, or other per-tick non-state data.

**`mergeSnapshot`** — Optional state merge hook called by the compiler before baking transitions. Allows a widget to merge partial scene snapshots (e.g., preserving certain state keys across scenes that do not explicitly re-declare them). If `undefined`, the compiler uses a default shallow merge.

**`requiresTypeProp`** — When `true`, signals to the `WidgetRegistry` that DSL usage requires a string `type` prop for routing. This enables the type-factory pattern (see Section 11).

---

### 7.3 IRenderable\<TState\>

```typescript
interface IRenderable<TState> extends IWidget {
  initialize(context: WidgetInitContext): void;
  apply(state: TState, context: WidgetRenderContext): void;
  dispose(): void;
}
```

**`initialize(context)`** — Called once by the `RuntimeDriverImpl` after the Three.js `Scene` is created, before any ticks run. This is the correct place to add `THREE.Object3D` instances to the scene, configure materials, and set up any per-widget Three.js state. The `WidgetInitContext` provides the `THREE.Scene` instance and optionally the `THREE.WebGLRenderer`.

**`apply(state, context)`** — Called every animation frame with the current baked state (or the result of a functional transition closure). This is the only correct place to mutate Three.js objects in response to scene progress. The method must not perform async operations, allocate significant memory, or access React state.

**`dispose()`** — Called by `RuntimeDriverImpl.dispose()` on cleanup (component unmount, HMR update). Remove Three.js objects from the scene, dispose geometries and materials, and release any external resources. Errors in `dispose()` are swallowed by the runtime to prevent cleanup cascade failures.

An `IRenderable` widget may also optionally expose `getBoneWorldPositions(): Map<string, [number, number, number]>` — when present, the runtime collects these positions each frame and provides them to the `LabelPositioner` for 3D-to-screen projection.

An `IRenderable` widget may also optionally expose `getTargetColors(): Map<string, string>` — when present, the runtime collects color mappings for label styling when `style.color === 'target-color'` is used.

---

### 7.4 ILoadable

```typescript
interface ILoadable extends IWidget {
  load(manifest: AssetManifest | null): Promise<void>;
  readonly isLoaded: boolean;
}
```

Widgets that require async asset loading implement `ILoadable`. The `RuntimeDriverImpl` calls `load(manifest)` on all loadable widgets in parallel via `Promise.all` immediately after calling `initialize` on all renderables. The `manifest` argument is the parsed asset manifest JSON (version, models array, animations array), or `null` if no manifest was fetched. The `isLoaded` flag is checked by the runtime before starting the tick loop.

After all loadable widgets resolve, the runtime calls `attachContainedModels()` to wire any `IContainedModel` widgets to their anchor bones.

---

### 7.5 IAnimationController

```typescript
interface IAnimationController extends IWidget {
  readonly tickPriority?: number;
  onTick(context: AnimationTickContext): void;
}
```

Widgets that need to run per-frame logic independent of scene-track state — springs, physics, GSAP/anime.js integrations, scroll-linked transforms — implement `IAnimationController`. The `RuntimeDriverImpl` calls `onTick` on all animation controllers in ascending `tickPriority` order before sampling the scene track and applying renderable state.

`tickPriority` defaults to `0` when omitted. `SceneMetaWidget` uses `tickPriority = -1000` to ensure scene metadata is published to `VariableStore` before any consumer controllers tick. Camera interaction controllers typically use a high positive value to tick last.

`onTick` receives `AnimationTickContext` which includes:
- `clock` — a `RealtimeClock` with `wallTimeSeconds` (absolute, never backlogs) and `deltaSeconds` (real-time frame delta, clamped after tab switches)
- `effectiveDeltaSeconds` — scroll-boosted delta for GLTF mixers and physics; equals `clock.deltaSeconds` during idle
- `scene` — the live `THREE.Scene`
- `variables` — the full read-write `VariableStore`
- `tick` — the `SceneTrackTick` sampled during the previous frame (may be `null` on the first tick)
- `track` — the full `SceneTrack` for look-ahead queries (optional, may be `null`)

---

### 7.6 IContainedModel\<TState\>

> **Note:** `IContainedModel` is a model-specific interface. It will be removed from
> `@brewsite/core/widget/types` and relocated to `@brewsite/model` in plan_core_modularization
> Phase 4. Current core consumers using `IContainedModel` directly should plan migration.

```typescript
interface IContainedModel<TState> extends IRenderable<TState> {
  readonly anchorModelId: string;
  readonly anchorKey: string;
}
```

Models that must be attached to a bone of a parent model implement `IContainedModel`. After all loadable widgets have resolved, `RuntimeDriverImpl.attachContainedModels()` iterates every `IContainedModel`, resolves the anchor bone name via `getAnchorBoneName(anchorKey)` on the parent widget, finds the bone node via `findBoneNode(boneName)`, and calls `anchorNode.add(containedObject3D)`.

`anchorModelId` must match the `widgetId` of a registered `IRenderable` that exposes `getAnchorBoneName` and `findBoneNode`. `anchorKey` is the logical bone key (resolved to the actual bone name by the parent widget, allowing the parent to abstract over rig-specific naming).

This pattern enables accessories, carried items, and sub-elements to follow parent model animation without the contained widget owning skeleton knowledge.

---

### 7.7 IDslComposite

```typescript
interface IDslComposite extends IWidget {
  readonly childDslComponents: ReadonlyArray<{
    component: React.ComponentType<unknown>;
    displayName: string;
    topLevelError?: boolean;
  }>;
}
```

Widgets whose DSL component expects child components (e.g., a `<DiagramCanvas>` that contains `<DiagramNode>` and `<DiagramEdge>` children) implement `IDslComposite`. The `WidgetRegistry` installs protective node handlers for each child component in `childDslComponents`:

- If `topLevelError` is `true`, the handler throws a developer-facing error when the child component appears at the scene top level outside its parent. This provides immediate authoring feedback.
- If `topLevelError` is absent or `false`, the handler is a no-op — the child component at top level is silently ignored.

The child components themselves are processed by the parent widget's `CUSTOM_NODE_HANDLER`, not by the protective handlers.

---

### 7.8 IVariableProvider

```typescript
interface IVariableProvider extends IWidget {
  readonly variableNamespace: string;
  readonly variableKeys: readonly string[];
}
```

Widgets that publish state to `VariableStore` declare themselves via `IVariableProvider`. This interface is informational — it describes what a widget publishes without enforcing publication mechanics. Actual publishing is done by the widget's `onTick` implementation calling `variables.set(namespace, key, value)`. The `variableNamespace` and `variableKeys` fields are used by developer tools and introspection utilities to enumerate available variables without running the scene.

---

### 7.9 IInputDefaultProvider

```typescript
/**
 * Widget that exposes default input actions to the player layer.
 *
 * Implemented by widgets (e.g. DiagramCanvasWidget) that carry input configuration
 * in their compiled state. The player calls getDefaultInputActions() each frame
 * after widget.apply() has been called to read the current scene's actions.
 *
 * CRITICAL: getDefaultInputActions() MUST return this.currentInputActions (a field
 * updated inside apply()), NOT a value derived from defaultState. defaultState is
 * constant after construction; currentInputActions reflects the live compiled state.
 */
interface IInputDefaultProvider extends IWidget {
  getDefaultInputActions(): InputActionSpec[];
}
```

Widgets that carry input action configuration in their compiled state implement `IInputDefaultProvider`. The player layer calls `WidgetRegistry.getInputDefaultProviders()` each frame. If no explicit `<InputController>` spec is present in the current tick, the player calls `buildEffectiveInputSpec(null, providers)` to assemble a `SceneInputControllerSpec` from the aggregated default actions.

`getDefaultInputActions()` must return the widget's live current actions — the value updated each frame by `apply()` — never a fixed value from `defaultState`. This distinction is critical: `defaultState` is constant after construction, while the actual input actions vary per scene in the compiled `SceneTrack`.

`IInputDefaultProvider` is defined in `@brewsite/core/widget/types.ts` so that the core player layer can call `getInputDefaultProviders()` without any `@brewsite/diagram` dependency. `DiagramCanvasWidget` in `@brewsite/diagram` implements the interface through the correct package dependency direction.

### 7.10 INVSBounded

```typescript
/**
 * Widget that occupies a declared sub-region of the AR-locked viewport.
 *
 * The NVS rectangle is a [0, 1] normalized ratio over the EngineARContainer
 * dimensions. x=0 is the left edge, y=0 is the top edge.
 *
 * Implemented by DiagramCanvasWidget, ChartWidget, and ModelWidget.
 *
 * nvsBounds must return a non-nullable NVSRect. Before any compiled state
 * has been applied (e.g. immediately after construction), return the
 * fullscreen default: { x: 0, y: 0, w: 1, h: 1 }.
 *
 * The interface is defined in packages/core/src/layout/types.ts and
 * exported from @brewsite/core. It must not be duplicated in downstream packages.
 */
interface INVSBounded {
  readonly nvsBounds: NVSRect;
}
```

`INVSBounded` is used by the `EngineARContainer` to auto-frame Three.js cameras to the widget's declared NVS region, and by authoring tools to query spatial occupancy. It is a read-only contract — the widget owns its NVS bounds and updates them on `apply()`.

`INVSBounded` does not extend `IWidget`. It is a capability interface that may be implemented independently. In practice, the three widgets that implement it — `DiagramCanvasWidget`, `ChartWidget`, and `ModelWidget` — also implement `ISceneElement` and `IRenderable`.

`WidgetRegistry.getNVSBoundedWidgets()` returns all registered widgets that implement `INVSBounded`. This method is used by the camera auto-framing system when a widget is first introduced into a scene with a non-fullscreen NVS region.

### 7.11 ICameraFocusTarget

```typescript
interface ICameraFocusTarget extends IWidget {
  requestFocus(
    position: readonly [number, number, number],
    target: readonly [number, number, number],
    smooth?: boolean,
  ): void;
}
```

Implemented by `CameraWidget`. Provides a typed channel for other widgets (e.g. `DiagramCanvasWidget` on node double-click) to request camera focus operations without coupling to the concrete `CameraWidget` type.

`RuntimeDriverImpl` resolves the first registered `ICameraFocusTarget` from the `WidgetRegistry` and injects it into `AnimationTickContext.cameraFocusTarget` before each tick. When `cameraFocusTarget` is non-null, a Camera DSL element is active in the current registry — this replaces the `__brewsite_cam_enabled` scene.userData flag.

### 7.12 ICameraHost

```typescript
interface ICameraHost extends IWidget {
  setInteractionDefaults(defaults: CameraInteractionDefaults): void;
  isWheelClaimedByInteraction(): boolean;
  getCameraOverride(): RuntimeCameraOverride | null;
  getCameraInteractionDriver(): ICameraInteractionDriver | null;
}
```

Implemented by `CameraWidget`. The player layer (`useSceneEngine`) programs against this interface rather than importing the concrete `CameraWidget` class. This decouples the player from the camera element implementation, keeping the layer boundary clean.

`useSceneEngine` resolves the registered `ICameraHost` at startup via `WidgetRegistry.getAllWidgets()` and uses it throughout the engine lifecycle for interaction configuration and override state.

### 7.13 ILightingOverride

```typescript
interface ILightingOverride extends IWidget {
  getLightingOverride(): { readonly disableAll: boolean } | null;
  receiveLightController?(setter: (lightId: string, enabled: boolean) => void): void;
}
```

Implemented by widgets that need to suppress core scene lighting. `DiagramCanvasWidget` implements this interface to disable core lights when the diagram canvas is active and manages its own HDR environment.

`LightingWidget.apply()` queries all registered `ILightingOverride` widgets each frame and skips Three.js light updates when any returns `{ disableAll: true }`. This replaces the `setSceneLightEnabled()` render-layer function that previously leaked across the `@brewsite/diagram` package boundary.

`receiveLightController` is optional — widgets that need fine-grained per-light control (rather than all-or-nothing suppression) implement it to receive a `(lightId, enabled) => void` setter injected by `LightingWidget` during `configureRegistry`.

---

## 8. WidgetRegistry

```typescript
type WidgetRegistryOptions = {
  /**
   * When true, registering a widget whose widgetId is already in the registry throws
   * instead of warning. Recommended: pass { strict: true } in all production-path
   * registry construction. corePlugin() uses strict: true by default.
   * @default false
   */
  strict?: boolean;
};

class WidgetRegistry {
  constructor(options?: WidgetRegistryOptions);
  register(widget: IWidget): this;
  registerTypeFactory(
    component: unknown,
    factory: (props: Record<string, unknown>) => IWidget,
  ): this;
  get(id: string): IWidget | undefined;
  getAll(): IWidget[];
  getSceneElements(): Array<ISceneElement<unknown>>;
  getRenderables(): Array<IRenderable<unknown>>;
  getAnimationControllers(): IAnimationController[];
  getLoadables(): ILoadable[];
  getContainedModels(): Array<IContainedModel<unknown>>;
  getDslComposites(): IDslComposite[];
  /** Returns all widgets that implement IInputDefaultProvider, in registration order. */
  getInputDefaultProviders(): IInputDefaultProvider[];
  /** Returns all widgets that implement INVSBounded, in registration order. */
  getNVSBoundedWidgets(): INVSBounded[];
  buildCacheKey(): string;
}
```

`WidgetRegistry` is the central registry for all widgets in a scene. A registry is created per `EngineProvider` instance; it is not a singleton. This allows multiple independent providers on the same page with different widget configurations.

**`constructor(options?)`** — Accepts `WidgetRegistryOptions`. The `strict` option controls duplicate-ID behavior (see `register()` below). Consumers building custom registries without `corePlugin()` should pass `{ strict: true }` explicitly.

**`register(widget)`** — Installs the widget by `widgetId`. If a widget with the same `widgetId` is already registered:
- When `strict: true`: throws `Error` with a message identifying the duplicate `widgetId`. This is the behavior when using `corePlugin()`.
- When `strict: false` (default): emits `console.warn` and the new widget overwrites the old one.

For `ISceneElement` widgets, a routing handler for `widget.DslComponent` is installed in the compiler's node registry (if not already present). For `IDslComposite` widgets, protective handlers are installed for each `childDslComponent` entry — entries with `topLevelError: true` throw a descriptive error if used outside their parent widget's DSL context. Returns `this` for chaining.

**`registerTypeFactory(component, factory)`** — Registers a factory function for a given DSL component. When the component appears in a scene DSL tree, the routing handler calls `factory(props)` with the element's props to produce a concrete `IWidget`. The produced widget is registered under the `id` prop value. This is the correct API for polymorphic elements like `<Model>` where `type` determines the concrete widget class.

The routing handler installed by `registerTypeFactory` requires both a `type` prop (to select the factory product) and an `id` prop (to key the produced widget in the registry). A compile-time error is thrown if either is absent.

**`getAnimationControllers()`** — Returns all registered `IAnimationController` widgets sorted in ascending `tickPriority` order. This sorted collection is cached in `RuntimeDriverImpl` at construction time, not recomputed each frame.

**`buildCacheKey()`** — Returns a stable string key representing the current registry contents. Used by the scene track cache to detect when a registry change (e.g., model metadata update) requires recompilation.

> **Note:** `getContainedModels()` is model-specific and will be removed from `WidgetRegistry` in Phase 4 of plan_core_modularization when `IContainedModel` moves to `@brewsite/model`. The `attachContainedModels()` runtime step will move with it.

### Type Guards

The following type guard functions are exported from the `widget` module:

```typescript
const isSceneElement = (w: IWidget): w is ISceneElement<unknown>
const isRenderable = (w: IWidget): w is IRenderable<unknown>
const isLoadable = (w: IWidget): w is ILoadable
const isAnimationController = (w: IWidget): w is IAnimationController
const isVariableProvider = (w: IWidget): w is IVariableProvider
const isContainedModel = (w: IWidget): w is IContainedModel<unknown>
const isDslComposite = (w: IWidget): w is IDslComposite
const isInputDefaultProvider = (w: IWidget): w is IInputDefaultProvider
```

These are structural type guards (duck-typed on the expected property names) rather than `instanceof` checks. This allows widgets to pass interface compliance without extending a base class.

---

## 9. CUSTOM_NODE_HANDLER Symbol

```typescript
export const CUSTOM_NODE_HANDLER = Symbol('customNodeHandler');
```

`CUSTOM_NODE_HANDLER` is a well-known symbol used to give a widget its own DSL node compilation logic. When the `WidgetRegistry` routing handler encounters a widget that has `[CUSTOM_NODE_HANDLER]` set, it calls that function instead of the default state-merge path.

The custom handler signature matches the compiler's `NodeHandler` type:

```typescript
type NodeHandler = (
  node: SceneDslNode,
  api: SceneFrameApi,
  helpers: CompilerHelpers,
) => void;
```

The handler mutates the current `SceneFrame` snapshot via `api` (e.g., setting widget state, registering nested elements, walking child nodes). This is the mechanism used by `@brewsite/diagram` to process complex nested DSL trees (`<DiagramCanvas>` containing nodes, edges, and groups) without requiring the compiler to understand diagram-specific concepts.

**Usage pattern:**

```typescript
class DiagramCanvasWidget implements ISceneElement<DiagramCanvasState>, IDslComposite {
  // ... ISceneElement implementation ...

  // Install custom handler before registering with WidgetRegistry
  [CUSTOM_NODE_HANDLER](node: SceneDslNode, api: SceneFrameApi, helpers: CompilerHelpers): void {
    const props = node.props as DiagramCanvasDslProps;
    // Walk child nodes, compile diagram state, call api.setWidgetState(...)
    compileDiagramCanvas(node, api, helpers, this.widgetId);
  }
}
```

The `CUSTOM_NODE_HANDLER` symbol is exported from `@brewsite/core`'s `widget` module. External packages (`@brewsite/diagram`) import it directly:

```typescript
import { CUSTOM_NODE_HANDLER } from '@brewsite/core/widget';
```

---

## 10. VariableStore

`VariableStore` is a reactive, namespace-partitioned key-value store for cross-widget state sharing at runtime. It is the only sanctioned mechanism for widgets to communicate state to React components or to one another at runtime.

### 10.1 VariableStore (Read-Write)

```typescript
class VariableStore implements VariableStoreReader {
  set(namespace: string, key: string, value: JsonPrimitive): void;
  get(namespace: string, key: string): JsonPrimitive | undefined;
  getNamespace(namespace: string): Readonly<Record<string, JsonPrimitive>>;
  subscribe(key: string, listener: () => void): () => void;
}

type JsonPrimitive = string | number | boolean | null;
```

`set` is idempotent when the value has not changed — it compares by value before notifying subscribers, preventing unnecessary React re-renders.

`subscribe` accepts a key in one of two formats:
- `"namespace.key"` — subscribes to a single value
- `"namespace"` — subscribes to any change within the namespace

Both notify the listener synchronously on the next `set` that affects the key or namespace. The returned function removes the subscription.

Values are constrained to `JsonPrimitive` (`string | number | boolean | null`). Object values are not supported — widgets that need to publish complex state should publish individual scalar keys or encode as JSON string.

### 10.2 VariableStoreReader (Read-Only)

```typescript
type VariableStoreReader = {
  get(namespace: string, key: string): JsonPrimitive | undefined;
  getNamespace(namespace: string): Readonly<Record<string, JsonPrimitive>>;
};
```

`IRenderable` widgets receive only `VariableStoreReader` in their `WidgetRenderContext`. This prevents renderable widgets from mutating cross-widget state during the apply phase, which would create order-dependent side effects.

### 10.3 useVariable Hook

```typescript
const useVariable = <T extends JsonPrimitive = JsonPrimitive>(
  namespace: string,
  key: string,
): T | undefined
```

React hook for consuming `VariableStore` values in components. Uses `useSyncExternalStore` for correct concurrent-mode subscription. Must be called inside `<EngineProvider>` (reads from `VariableStoreContext`). Re-renders only when the specific `namespace.key` changes.

**Example:**

```typescript
// In a custom overlay component inside EngineProvider
const sceneId = useVariable<string>('scene', 'id');
const sceneIndex = useVariable<number>('scene', 'index');
```

### 10.4 Built-In Variable Namespaces

`SceneMetaWidget` publishes to the `'scene'` namespace on every tick:

| Key | Type | Description |
|-----|------|-------------|
| `scene.id` | `string` | Current scene DSL `id` prop |
| `scene.index` | `number` | Zero-based scene index |
| `scene.progress` | `number` | `blockProgress` [0, 1] within current transition |
| `scene.[meta.*]` | `JsonPrimitive` | Any keys from `tick.state.meta` (scene-authored metadata) |

---

## 11. Built-In Plugins: corePlugin() and modelPlugin()

Widget registration follows the composable plugin model. Plugins are passed as an array to the `plugins` prop of `EngineProvider`. Each plugin implements the `WidgetPlugin` interface:

```typescript
interface WidgetPlugin {
  createWidgets(): IWidget[];
  registerHandlers(): void;
  configureRegistry?(registry: WidgetRegistry, manifest: AssetManifest | null): void;
  wrapProvider?(children: ReactNode): ReactNode;
  onRendererDisposing?(renderer: WebGLRenderer): void;
}
```

### corePlugin()

```typescript
import { corePlugin } from '@brewsite/core';

interface CorePluginOptions {
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
}

function corePlugin(options?: CorePluginOptions): WidgetPlugin
```

The built-in `WidgetPlugin` for `@brewsite/core`. Provides all non-model core widgets and registers their DSL node handlers.

**Widgets registered by corePlugin():**

| Widget | widgetId | Interfaces |
|--------|----------|------------|
| `LightingWidget` | `'lighting'` | `ISceneElement`, `IRenderable` |
| `BackgroundWidget` | `'background'` | `ISceneElement`, `IRenderable` |
| `EnvironmentWidget` | `'environment'` | `ISceneElement`, `IRenderable`, `ILoadable` |
| `FloorWidget` | `'floor'` | `ISceneElement`, `IRenderable` |
| `CameraWidget` | `'camera'` | `ISceneElement`, `IRenderable`, `IAnimationController` |
| `SceneMetaWidget` | `'__scene_meta__'` | `IAnimationController` |

`onSceneChange` wires a callback into `SceneMetaWidget` that fires on every scene transition with the new scene's `id` and zero-based index.

### modelPlugin()

```typescript
import { modelPlugin } from '@brewsite/model';

interface ModelPluginOptions {
  manifestUrl?: string;
  manifest?: AssetManifest | null;
  defaultModelStates?: Partial<Record<string, Partial<SceneModel>>>;
}

function modelPlugin(options?: ModelPluginOptions): WidgetPlugin & {
  getManifest(): AssetManifest | null;
  fetchManifest(): Promise<AssetManifest | null>;
}
```

The `WidgetPlugin` for `@brewsite/model`. Provides `ModelWidget` (via a type factory registered in `configureRegistry()`) and registers model DSL node handlers (`Label`, `Labels`). Manifest loading is handled asynchronously by `EngineProvider` — consumers pass either `manifestUrl` (fetched on mount) or a pre-loaded `manifest` object.

**Model type factory:** When a manifest is available, `registerTypeFactory(ModelRouter, factory)` installs a lazy factory on the `WidgetRegistry`. On first encounter of a `<Model>` DSL node, the factory looks up model metadata from `manifest.models` by `type` prop and constructs a `ModelWidget` with that metadata and the derived `clipMeta`. If no manifest is provided, no `ModelWidget` instances are created — scenes without models work normally.

### Standard Integration Pattern

```typescript
// page.tsx
import { corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

<EngineProvider
  manifestUrl="/assets/manifest.json"
  plugins={[
    corePlugin({ onSceneChange: (id, index) => console.log(id, index) }),
    modelPlugin({ manifestUrl: '/assets/manifest.json' }),
  ]}
>
  {scene01}
  {scene02}
</EngineProvider>
```

**Adding custom widgets:**

```typescript
import { corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

const myModelPlugin = modelPlugin({ manifestUrl: '/assets/manifest.json' });

<EngineProvider
  plugins={[
    corePlugin(),
    myModelPlugin,
    {
      createWidgets: () => [new MyCustomWidget()],
      registerHandlers: () => {},
    },
  ]}
>
  {scene01}
</EngineProvider>
```

---

## 12. Context Types

### 12.1 CompileExtraContext

```typescript
type CompileExtraContext = {
  sceneProgress: number;
  globalProgress: number;
  clipMeta: ClipMeta[];
  prefersReducedMotion: boolean;
};
```

Passed to `ISceneElement.compileExtra` during the compiler baking pass. `sceneProgress` is the normalized position within the current transition block. `clipMeta` is the full list of animation clips from the asset manifest — used by model widgets to map DSL clip names to GLTF frame ranges. `prefersReducedMotion` reflects the `prefers-reduced-motion` media query detected at compile time.

### 12.2 WidgetInitContext

```typescript
type WidgetInitContext = {
  scene: THREE.Scene;
  widgetId: string;
  renderer?: THREE.WebGLRenderer;
};
```

Passed to `IRenderable.initialize`. Provides the live `THREE.Scene` for adding objects. `renderer` is optional — it is available if the canvas has been set up before initialization, which is the normal case in `useSceneEngine`. It may be absent in test environments.

### 12.3 WidgetRenderContext

```typescript
type WidgetRenderContext = {
  clock: RealtimeClock;          // synchronized real-time clock
  effectiveDeltaSeconds: number; // scroll-boosted delta; equals clock.deltaSeconds when idle
  globalProgress: number;
  variables: VariableStoreReader;
  extra: unknown;
  tick?: SceneTrackTick | null;
};
```

Passed to `IRenderable.apply` on every frame. `extra` is the value returned by `compileExtra` for this widget at this tick (or `undefined` if `compileExtra` is not implemented). `variables` is the read-only view of the `VariableStore`. `tick` is the current `SceneTrackTick` — useful for accessing label primitives or per-tick metadata.

`clock.wallTimeSeconds` is the canonical source for time-based oscillations and ambient animations. `effectiveDeltaSeconds` is the correct delta to pass to GLTF `AnimationMixer` and camera controls damping — it is scroll-speed-boosted when `animationTimeScale` is declared on `<ProgressManager>`, and equals `clock.deltaSeconds` during idle. See Section 12.5 for the `RealtimeClock` type definition.

### 12.4 AnimationTickContext

```typescript
type AnimationTickContext = {
  clock: RealtimeClock;          // synchronized real-time clock
  effectiveDeltaSeconds: number; // scroll-boosted delta; equals clock.deltaSeconds when idle
  scene: THREE.Scene;
  variables: VariableStore;
  tick: SceneTrackTick | null;
  track: SceneTrack | null;
  /**
   * The widget's fully resolved state for this tick.
   * For FunctionalTransitionSpec widgets: the runtime evaluates the closure at
   * tick.blockProgress and places the result here, so IAnimationController
   * implementors do not need to duplicate the runtime's state resolution.
   * Cast to TState inside the widget's onTick() body.
   * Null when the widget has no compiled state for this tick.
   */
  resolvedState: unknown;
  /**
   * The registered ICameraFocusTarget, if any.
   * Use this to request camera focus operations (e.g. on node double-click)
   * without coupling to the concrete CameraWidget type.
   * Also serves as an implicit signal that a Camera DSL element is active.
   * Null when no ICameraFocusTarget widget is registered.
   */
  cameraFocusTarget: ICameraFocusTarget | null;
  /**
   * Active camera override set by the player layer.
   * When non-null, camera widgets should apply this override in preference
   * to authored scene state.
   */
  cameraOverride: RuntimeCameraOverride | null;
  /**
   * Promote a pending focus request to a durable camera override.
   * CameraWidget calls this in onTick() when a focus request arrives in
   * non-interaction mode. The override persists in the driver and is reflected
   * in cameraOverride on the next frame.
   */
  setCameraOverride: (override: RuntimeCameraOverride | null) => void;
};
```

Passed to `IAnimationController.onTick`. `variables` here is the full read-write `VariableStore`. `tick` is the `SceneTrackTick` from the previous frame (the scene track is sampled after animation controllers tick, so the current frame's tick is not yet available). `track` is the full `SceneTrack` for look-ahead queries — useful for prefetching or computing derived state from future ticks.

`resolvedState` provides the pre-resolved widget state for FunctionalTransitionSpec widgets, eliminating duplicate closure evaluation that previously occurred in `CameraWidget.onTick()`.

`cameraFocusTarget`, `cameraOverride`, and `setCameraOverride` replace the stringly-typed `scene.userData['__brewsite_*']` bus that previously conveyed camera focus requests and override state between widgets.

`clock.wallTimeSeconds` is the canonical source for time-based oscillations. `effectiveDeltaSeconds` is the correct delta to pass to GLTF `AnimationMixer` and physics integrations — it accounts for scroll-speed boosting when `animationTimeScale` is declared on `<ProgressManager>`. See Section 12.5 for the `RealtimeClock` type definition and the Widget Time Contract table.

---

### 12.5 RealtimeClock Type

```typescript
type RealtimeClock = {
  wallTimeSeconds: number;  // absolute time since page load (performance.now()/1000); never backlogs
  deltaSeconds: number;     // real-time frame delta (~0.0167s at 60fps)
};
```

`wallTimeSeconds` is derived from `performance.now() / 1000`. It is clamped and reset when a browser tab returns from the background, preventing the large delta spikes that would otherwise cause animation jumps. It is the correct source for any time-based oscillation formula.

`deltaSeconds` is the actual elapsed time between the previous frame and the current frame. It is clamped by `RuntimeLoop` to prevent runaway physics integrations after tab switches.

---

## 12.6 Widget Time Contract

| Animation type          | Use                      | Field                                                        |
|-------------------------|--------------------------|--------------------------------------------------------------|
| Ambient oscillation     | `clock.wallTimeSeconds`  | `Math.sin(clock.wallTimeSeconds * freq)`                     |
| Physics / smooth incr.  | `clock.deltaSeconds`     | `this.vel += accel * clock.deltaSeconds`                     |
| GLTF AnimationMixer     | `effectiveDeltaSeconds`  | `mixer.update(ctx.effectiveDeltaSeconds)`                    |
| Camera controls damping | `effectiveDeltaSeconds`  | `cameraControls.update(ctx.effectiveDeltaSeconds)`           |

> **WARNING: Never use `this.localTime += deltaSeconds`** as a widget-internal clock. It drifts between
> widgets (different start times) and backlogs when a browser tab is hidden then shown.
> `clock.wallTimeSeconds` is absolute and self-correcting.

---

## 13. Widget Lifecycle

The lifecycle of a widget instance spans from registry installation to runtime disposal. The phases are:

### Phase 1: Register

```
registry.register(widget)
```

The widget is stored in the registry's internal map. If the widget implements `ISceneElement`, the compiler's node registry receives a routing handler for `widget.DslComponent`. If it implements `IDslComposite`, protective top-level handlers are installed for each child component.

### Phase 2: Compile

The `compileSceneTrack` pipeline iterates all `ISceneElement` widgets from the registry and calls their `transitionSpec` methods (`enter`, `exit`, `interpolate` for discrete; stores closures for functional) to populate the `SceneTrack`. `compileExtra` is called per tick if implemented. The output is a flat pre-baked `SceneTrack` — an array of `SceneTrackTick` objects supporting O(1) sampling.

### Phase 3: Initialize

```
RuntimeDriverImpl.initialize(threeScene, renderer)
```

For every `IRenderable` widget, `initialize({ scene, widgetId, renderer })` is called synchronously. This is the correct phase for adding `THREE.Object3D` instances to the scene.

### Phase 4: Load

```
await Promise.all(loadables.map(w => w.load(manifest)))
```

All `ILoadable` widgets receive `load(manifest)` simultaneously. When all promises resolve, `attachContainedModels()` runs and the driver emits `assetsReady = true`.

### Phase 5: Tick (IAnimationController)

Each frame, before scene track sampling, all `IAnimationController` widgets receive `onTick(context)` in ascending `tickPriority` order. This is when spring animations, GSAP timelines, and reactive VariableStore updates execute.

### Phase 6: Apply (IRenderable)

Immediately after animation controllers tick, the scene track is sampled at `globalProgress`. For each `IRenderable`:
- If the current tick's scene block has a `FunctionalTransitionSpec` closure for this widget, that closure is called with `blockProgress` to produce state.
- Otherwise, the pre-baked state from `tick.state.widgets[widgetId]` is used.
- `renderable.apply(state, context)` is called with the resolved state.

### Phase 7: Dispose

```
RuntimeDriverImpl.dispose()
```

On component unmount or HMR update, all `IRenderable` widgets receive `dispose()`. Three.js objects must be removed from the scene and materials/geometries disposed here.

---

## 14. Widget Implementation Pattern

The canonical pattern for authoring a widget follows the five-file module structure enforced by the repository architecture:

```
elements/my-element/
  types.ts        — state shape, no runtime/Three.js/React
  dsl.tsx         — prop type interfaces only, no React components, no Three.js
  compile.ts      — transition spec, no React/Three.js
  render.ts       — Three.js application layer, no React/compiler
  MyElementWidget.ts  — IWidget implementation, bridges compile → render
  index.ts        — public re-exports
```

**types.ts:**

```typescript
// Pure state shape — no imports from Three.js, React, or the compiler.
export interface MyElementState {
  position: [number, number, number];
  opacity: number;
  visible: boolean;
}
```

**dsl.tsx:**

```typescript
import type { MyElementState } from './types';

// Prop types only — no function declarations.
export type MyElementProps = Partial<MyElementState> & { id?: string };
```

**compile.ts:**

```typescript
import type { ElementTransitionSpec } from '@brewsite/core/compiler';
import type { MyElementState } from './types';

export const DEFAULT_STATE: MyElementState = {
  position: [0, 0, 0],
  opacity: 1,
  visible: true,
};

export const myTransitionSpec: ElementTransitionSpec<MyElementState> = {
  exit: (state) => ({ ...state, opacity: 0 }),
  enter: (state) => ({ ...state, opacity: 0 }),
  interpolate: (from, to, t) => ({
    position: lerpVec3(from.position, to.position, t),
    opacity: lerp(from.opacity, to.opacity, t),
    visible: t < 0.5 ? from.visible : to.visible,
  }),
};
```

**MyElementWidget.ts:**

```typescript
import type {
  ISceneElement, IRenderable,
  WidgetInitContext, WidgetRenderContext,
} from '@brewsite/core/widget';
import type { MyElementProps } from './dsl';
import { DEFAULT_STATE, myTransitionSpec } from './compile';
import type { MyElementState } from './types';
import * as THREE from 'three';

// DSL stub — returns null; consumed purely by the compiler.
export function MyElement(_props: MyElementProps): null { return null; }
MyElement.displayName = 'MyElement';

export class MyElementWidget
  implements ISceneElement<MyElementState>, IRenderable<MyElementState>
{
  readonly widgetId: string;
  readonly defaultState = DEFAULT_STATE;
  readonly transitionSpec = myTransitionSpec;
  readonly DslComponent = MyElement;

  private mesh: THREE.Mesh | null = null;

  constructor(widgetId = 'my-element') {
    this.widgetId = widgetId;
  }

  initialize({ scene }: WidgetInitContext): void {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial();
    this.mesh = new THREE.Mesh(geo, mat);
    scene.add(this.mesh);
  }

  apply(state: MyElementState, _ctx: WidgetRenderContext): void {
    if (!this.mesh) return;
    this.mesh.visible = state.visible;
    this.mesh.position.set(...state.position);
    (this.mesh.material as THREE.MeshStandardMaterial).opacity = state.opacity;
  }

  dispose(): void {
    if (!this.mesh) return;
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.MeshStandardMaterial).dispose();
    this.mesh = null;
  }
}
```

---

## 15. Type-Factory Pattern

The type-factory pattern enables one DSL component to produce multiple concrete widget implementations based on the `type` prop:

```typescript
// In widgetSetup:
registry.registerTypeFactory(ModelRouter, (props) => {
  const type = props.type as string;
  const id = props.id as string;
  const modelMeta = manifest.models.find((m) => m.type === type);
  return new ModelWidget({ modelMeta, clipMeta, widgetId: id });
});
```

DSL usage:

```tsx
<Scene id="intro">
  <Model type="hero"    id="hero"    position={[0, 0, 0]} />
  <Model type="sidekick" id="sidekick" position={[2, 0, 0]} />
</Scene>
```

The routing handler produces two `ModelWidget` instances with `widgetId = 'hero'` and `widgetId = 'sidekick'` respectively. Both are registered in the same `WidgetRegistry`. Each compiles and renders independently with separate state tracks.

The type-factory routing handler requires both `type` and `id` props. Omitting either throws a compile-time error with a descriptive message. This is enforced by the routing handler installed by `registerTypeFactory`.

---

## 16. Contained Model Pattern

The contained model pattern enables 3D objects to follow the bone animation of a parent model:

```typescript
class LogoWidget implements ISceneElement<LogoState>, IContainedModel<LogoState> {
  readonly widgetId = 'logo';
  readonly anchorModelId = 'hero';    // widgetId of the parent ModelWidget
  readonly anchorKey = 'right-hand';  // logical bone key

  // ... IRenderable implementation ...
}
```

After all `ILoadable` widgets resolve, `RuntimeDriverImpl.attachContainedModels()` runs:

1. For each `IContainedModel`, find the parent widget by `anchorModelId`.
2. Call `parent.getAnchorBoneName(anchorKey)` to resolve the rig-specific bone name.
3. Call `parent.findBoneNode(boneName)` to get the Three.js bone object.
4. Call `anchorNode.add(containedObject3D)` to parent the contained model.

From that point, the contained model's Object3D follows the parent bone's world transform automatically via Three.js scene graph hierarchy. The `IContainedModel` widget still receives its own `apply(state, context)` calls each frame — it can apply local transforms relative to the bone.

---

## 17. Test Infrastructure

Test doubles for the Widget SDK live in `packages/core/src/runtime/mocks/widgetMocks.ts`. They implement widget interfaces with observable state and no Three.js dependency.

**`createMockRenderable(id: string): MockRenderable`** — Implements `IRenderable`. Records every `initialize`, `apply`, and `dispose` call. `appliedStates` array is inspectable in assertions.

**`createMockSceneElementWidget<TState>(id, defaultState): MockSceneElementWidget<TState>`** — Implements `ISceneElement + IRenderable`. The transition spec is identity (interpolate returns `b`). Used for testing compiler and runtime tick logic without element-specific behaviour.

**`createMockAnimationController(id, tickPriority?): MockAnimationController`** — Implements `IAnimationController`. Records `tickCount` and `lastCtx` for assertion.

All mocks are safe to construct in any test environment without Three.js, without jsdom, and without a React tree.

---

## 18. Breaking Change Assessment

**Current semver status:** Patch and minor additions to the Widget SDK are backward compatible. The interface hierarchy has been stable since the initial extraction of the generic runtime from the legacy robot-specific implementation.

**Known future risk:** The `TExtra` generic defaults to `void` on `ISceneElement`. If a future compiler optimization requires `TExtra` to be constrainted more tightly (e.g., serializable), that would be a major version change for any consumer that passes a non-serializable extra.

**API regret surface:** The `AnimationTickContext.tick` is the previous frame's tick, not the current frame's. This is correct (controllers tick before sampling) but counterintuitive. The field name does not reflect this lag — a future major version may rename it to `previousTick` for clarity, which would be a breaking change for all `IAnimationController` implementations.

---

## 19. Open Questions

- Should `ILoadable.isLoaded` be removed in a future version? The runtime checks `assetsReady` on the driver level, not per-widget `isLoaded`. The per-widget flag is currently unused by the runtime after initial load.
- Should `VariableStore` support object values (typed as `JsonObject`) in a future minor version? This would require a more complex equality check and broader `JsonPrimitive` type.
- Should `CUSTOM_NODE_HANDLER` be replaced with a formal `compileNode` method on `ISceneElement`? The Symbol approach is ergonomic but invisible to TypeScript's structural type system — a formal interface method would be more discoverable.

---

## 20. Launch Criteria

For any release that modifies the Widget SDK public API:

- All existing `IWidget`, `ISceneElement`, `IRenderable`, `ILoadable`, `IAnimationController` tests pass with zero regressions.
- TypeScript compilation with `strict: true` produces no errors for a widget implementing all interfaces.
- `corePlugin()` and `modelPlugin()` together produce a registry that renders a complete scene without errors.
- The `runtime/mocks/widgetMocks.ts` file is updated to reflect any new interface methods.
- `CHANGELOG.md` in `packages/core` has an entry for every changed exported symbol.
- At least one example in `apps/examples/` demonstrates any new Widget SDK capability.
- Bundle size delta for `@brewsite/core` is within +/- 1 KB for changes that do not add new Three.js geometry.
