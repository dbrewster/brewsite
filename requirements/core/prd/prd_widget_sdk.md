---
title: "BrewSite Core — Widget SDK"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-15
change_history:
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Centralized theme system: added §11.3 documenting `themesPlugin()` from `@brewsite/themes`. Documents ThemeBundle, registerSceneThemePair/registerDiagramThemePair/registerChartThemePair as the registration API, and the configureRegistry() hook usage. Updated standard integration pattern in §11 to show themesPlugin() in the plugins array."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Carousel rendering bug fixes: (1) ChartWidget freeze-on-reparent — documented in §7.19: ChartWidget captures frozenWorldPos on first apply(), detects reparenting (_chartGroup.parent !== scene), and freezes _chartGroup.position at that value thereafter; ViewWidget's Group transform becomes the sole source of carousel movement, preventing double-positioning. (2) Opacity single-writer contract — ViewWidget.applyOpacity() sets mat.opacity directly (no base-opacity multiplication) and runs last in the tick loop (registers after ChartWidget via reconcileCompiledTrack); it is the sole opacity controller for carousel view children. Carousel views (layoutId present) pass childOpacityScale=1 to createChildApi so children compile with intrinsic opacity=1.0. Added known edge case note: opacity-animated charts inside standalone (non-carousel) Views will have their opacity suppressed to ViewState.opacity each frame by ViewWidget."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "View Widget Carousel Rendering: added IGroupOwner interface (§7.19) — capability interface for widgets that expose their root THREE.Group for ViewWidget reparenting. Added isGroupOwner duck-type guard to §8.2. Added functional requirement 8c. Updated corePlugin description (§14) to document reconcileCompiledTrack creating ViewWidgets lazily from the compiled track; documented full delta transform math including Z delta (G_z = state.z - originalZ, prevents double-offset). Updated WidgetPlugin interface documentation to show reconcileCompiledTrack. ChartWidget now implements IGroupOwner."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Scene Child Constraint: documented the optional duck-typed nodeHandlerCategory property on widget classes (§8.1). Added built-in core widget category table listing all ambient widgets. Noted that downstream package widgets (DiagramWidget, ChartWidget, ModelWidget, ImagePanelWidget, ScreenWidget) are spatial by default and do not need to declare this property. Documented TextBox classification: TextBox is an HTML overlay component, not a registered DSL spatial element; the constraint's isPrimitiveComponent guard treats unregistered components as overlay content."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "PRD audit: added missing interface documentation for IContainedRenderable (§7.14), IAttachmentHost (§7.15), IRenderContributor (§7.16), IRendererLifecycle (§7.17), and ISceneLifecycle (§7.18). These interfaces were referenced in change_history but not documented in the PRD body."
  - date: 2026-03-09
    author: "Toolkit Product"
    summary: "v2 player API: All body-text references to EngineProvider updated to SceneEngine. Plugin registration examples updated to SceneEngine. modelPlugin documentation updated to reflect that manifest loading is now handled by the plugin internally. No widget SDK interface changes — player layer refactoring only."
  - date: 2026-03-09
    author: "Toolkit Product"
    summary: "NVS Universal Coordinate System: WidgetRenderContext gains required coords: NVSCoordService field (breaking — major version bump for @brewsite/core). NVSCoordService interface documented in Section 12.3. createNVSCoordService() factory exported for test use. NVS validation functions (validateNVSScalar, validateNVSRect, validateNVSPosition) exported from layout/index.ts and documented. IExtraRenderPass reserved for future use — currently no built-in widgets implement it following DiagramCanvas removal."
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
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Codebase alignment audit. §8.2 Type Guards: replaced isContainedModel with isContainedRenderable, added all missing type guards (isCameraActionTarget, isSceneLifecycle, isRendererLifecycle, isRenderContributor, isContainedRenderable, isAttachmentHost, isCameraFocusTarget, isLightingOverride, isExtraRenderPass, isViewChild, hasCustomDslHandler). §7.3: removed getBoneWorldPositions/getTargetColors from IRenderable — replaced by IRenderContributor.contributeRenderData(). §7.6: marked IContainedModel as @deprecated. §7.15: fixed IAttachmentHost.getAttachmentPoint return type (Object3D | null, not undefined). §7.16: fixed RenderContribution type (namedPositions: ReadonlyMap, not bonePositions: Map). §7.17: fixed IRendererLifecycle.onRendererDisposing signature (takes renderer param, non-optional). §7.18: fixed ISceneLifecycle signatures (both non-optional, take sceneId + sceneIndex). §9: documented IHasCustomDslHandler interface and hasCustomDslHandler type guard for CUSTOM_NODE_HANDLER. §11 WidgetPlugin: added fetchManifest, getActionInputExtension, onRendererCreated methods. FR #15: updated type guard list to match all exported guards."
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
8c. `IGroupOwner` shall declare `readonly rootGroup: THREE.Object3D`. Widgets that expose their root Three.js Group for external reparenting implement this interface. `ViewWidget` queries `isGroupOwner(widget)` on each child widget ID when initializing carousel Group parenting. The type guard `isGroupOwner` uses a duck-type check (`'rootGroup' in widget`) to avoid runtime `instanceof` dependency on the Three.js value import. `ChartWidget` in `@brewsite/charts` implements `IGroupOwner`.
9. `WidgetRegistry.register(widget)` shall install a DSL node routing handler for the widget's `DslComponent` if one has not already been installed.
10. `WidgetRegistry.registerTypeFactory(component, factory)` shall install a type-routed handler that calls `factory(props)` on first encounter of a given `type` prop value, then registers and dispatches to the produced widget.
11. `CUSTOM_NODE_HANDLER` shall be a `Symbol` that widgets set on themselves to provide their own DSL node compilation logic. When present, the routing handler installed by `WidgetRegistry` shall delegate to it instead of the default state-merge path.
12. `VariableStore` shall be a reactive key-value store partitioned by namespace. Consumers may subscribe to individual keys (`namespace.key`) or an entire namespace.
13. The `VariableStoreReader` read-only view shall be the only variable access surface provided to `IRenderable` widgets via `WidgetRenderContext`. Full read-write `VariableStore` access is provided to `IAnimationController` widgets via `AnimationTickContext`.
14. `corePlugin()` shall provide the standard set of built-in core widgets (`LightingWidget`, `BackgroundWidget`, `EnvironmentWidget`, `FloorWidget`, `CameraWidget`, `SceneMetaWidget`, `SpotlightRigWidget`) and register their DSL node handlers. It shall also implement `reconcileCompiledTrack` to lazily create and register `ViewWidget` instances for every view ID found in the compiled `SceneTrack`. `modelPlugin()` from `@brewsite/model` shall provide `ModelWidget` (via a type factory) and register model DSL handlers. Both are passed as entries in the `plugins` prop of `SceneEngine`.
15. All type guard functions (`isSceneElement`, `isRenderable`, `isLoadable`, `isDslComposite`, `isAnimationController`, `isVariableProvider`, `isGroupOwner`, `isCameraActionTarget`, `isSceneLifecycle`, `isRendererLifecycle`, `isRenderContributor`, `isContainedRenderable`, `isAttachmentHost`, `isInputDefaultProvider`, `isCameraFocusTarget`, `isLightingOverride`, `isExtraRenderPass`, `isViewChild`, `hasCustomDslHandler`) shall be exported from the `widget` module for use by the runtime and by custom registry implementations.

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

Widgets that need to expose bone world positions or target colors to the label system implement `IRenderContributor` (see Section 7.16) instead of adding ad-hoc methods to `IRenderable`. The `contributeRenderData()` method replaces the removed `getBoneWorldPositions()` and `getTargetColors()` methods.

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

### 7.6 IContainedModel\<TState\> (deprecated)

> **@deprecated:** `IContainedModel` is a model-specific interface. It will be removed from
> `@brewsite/core/widget/types` and relocated to `@brewsite/model`. Current core consumers
> using `IContainedModel` directly should migrate to `IContainedRenderable` (Section 7.14).

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

### 7.14 IContainedRenderable

```typescript
interface IContainedRenderable extends IWidget {
  readonly anchorWidgetId: string;   // widget ID of the parent (e.g. ModelWidget)
  readonly anchorKey: string;        // named attachment point on the parent (e.g. bone name)
  readonly rootObject: THREE.Object3D;  // the contained object to parent under the attachment
}
```

Implemented by widgets that are spatially attached to another widget's skeleton or structure. `ModelWidget` in `@brewsite/model` implements this for contained sub-models (accessories attached to bones). The `RuntimeDriverImpl` wires up the parent-child attachment after all widgets complete `ILoadable.load()` by querying `IAttachmentHost` on the parent widget.

### 7.15 IAttachmentHost

```typescript
interface IAttachmentHost extends IWidget {
  getAttachmentPoint(key: string): THREE.Object3D | null;
}
```

Implemented by widgets that expose named attachment points for `IContainedRenderable` children. `ModelWidget` implements this — it returns bone `Object3D` references by name, or `null` if the key is not found or the host is not yet initialized. The runtime calls `getAttachmentPoint(anchorKey)` on the host widget and re-parents the contained widget's `rootObject` under the returned object.

### 7.16 IRenderContributor

```typescript
interface IRenderContributor extends IWidget {
  contributeRenderData(): RenderContribution;
}

type RenderContribution = {
  namedPositions?: ReadonlyMap<string, [number, number, number]>;
  targetColors?: ReadonlyMap<string, string>;
};
```

Implemented by widgets that publish render-time data for consumption by other systems (e.g., label projection, mesh target color tracking). `ModelWidget` in `@brewsite/model` implements this to expose bone world positions (used by `LabelPositioner`) and mesh target colors (used for label color inheritance).

`RuntimeDriverImpl` calls `contributeRenderData()` on all `IRenderContributor` widgets after `apply()` and aggregates the results into a unified render data map available to post-tick consumers.

### 7.17 IRendererLifecycle

```typescript
interface IRendererLifecycle extends IWidget {
  onRendererCreated(renderer: THREE.WebGLRenderer): void;
  onRendererDisposing(renderer: THREE.WebGLRenderer): void;
}
```

Implemented by widgets that need a reference to the `WebGLRenderer` for setup or cleanup (e.g., environment map generation, post-processing effects). `EnvironmentWidget` implements this to run `PMREMGenerator` initialization when the renderer is first created.

### 7.18 ISceneLifecycle

```typescript
interface ISceneLifecycle extends IWidget {
  onSceneEnter(sceneId: string, sceneIndex: number): void;
  onSceneExit(sceneId: string, sceneIndex: number): void;
}
```

Implemented by widgets that need to perform side effects on scene transitions that cannot be expressed as compiled state changes. Both methods are required (non-optional). `SceneMetaWidget` implements this to fire the `onSceneChange` callback. The runtime calls `onSceneExit(sceneId, sceneIndex)` on the outgoing scene and `onSceneEnter(sceneId, sceneIndex)` on the incoming scene during tick processing when the active scene ID changes.

### 7.19 IGroupOwner

```typescript
/**
 * Widget that exposes its root Three.js Group for external parenting.
 * Implement this interface to allow ViewWidget to re-parent the widget's
 * 3D content into a View Group for carousel/layout delta transforms.
 */
interface IGroupOwner extends IWidget {
  readonly rootGroup: THREE.Object3D;
}
```

Implemented by widgets whose 3D content must move as a unit when a carousel step repositions their parent View. `ViewWidget` queries the `WidgetRegistry` for `IGroupOwner` instances when reparenting children into its `THREE.Group` on the first `apply()` call.

`IGroupOwner` is a capability interface — it does not extend `ISceneElement` or `IRenderable`. Any widget that has a stable root `Object3D` may implement it, regardless of its other interface participation.

`ChartWidget` in `@brewsite/charts` implements `IGroupOwner`, exposing its internal `_chartGroup`. `DiagramWidget` in `@brewsite/diagram` may implement it in a follow-up to support carousel Views containing diagram elements.

**ChartWidget reparent freeze.** When `ViewWidget` reparents `_chartGroup` into its `THREE.Group`, `_chartGroup` moves from being a direct child of the scene to a child of the View Group. If `ChartWidget.apply()` continued setting `_chartGroup.position` to absolute world coordinates each tick, the View Group delta and the chart's self-positioning would compound (double-positioning). To prevent this, `ChartWidget` captures `frozenWorldPos` on first `apply()`, detects when `_chartGroup.parent !== scene` (i.e., it has been reparented), and freezes `_chartGroup.position` at `frozenWorldPos` thereafter. The View Group transform then becomes the sole source of carousel movement. Widgets implementing `IGroupOwner` must apply the same freeze pattern to avoid double-positioning after reparenting.

The type guard `isGroupOwner` in `widget/WidgetRegistry.ts` uses a duck-type check (not `instanceof`), since `widget/types.ts` uses type-only Three.js imports:

```typescript
export function isGroupOwner(widget: IWidget): widget is IGroupOwner {
  return 'rootGroup' in widget;
}
```

`IGroupOwner` and `isGroupOwner` are exported from `@brewsite/core` via `widget/index.ts`.

**ViewWidget opacity single-writer contract.** `ViewWidget.applyOpacity()` sets `mat.opacity = opacity` directly — it does not multiply against a base opacity from the child widget's compiled state. `corePlugin().reconcileCompiledTrack` registers `ViewWidget` instances after all other widgets (including `ChartWidget`), so `ViewWidget` is always the last writer of `mat.opacity` in the tick loop for carousel view children. Carousel views (those with a `layoutId` in `ViewState`) pass `childOpacityScale = 1` to `createChildApi`, so their child elements compile with `opacity = 1.0` (intrinsic). Non-carousel views bake `viewOpacity` into compiled child state as before, and `ViewWidget.applyOpacity()` is effectively a no-op (setting opacity to 1.0 on an already-1.0 value).

> **Known edge case:** If a chart inside a standalone (non-carousel) `<View>` has its own independent opacity animation authored separately from the View opacity, `ViewWidget` will override it to `ViewState.opacity` (typically 1.0) each frame, since `ViewWidget` runs last in the tick loop. Authors should be aware that opacity-animated charts inside standalone Views will have their opacity suppressed by `ViewWidget`. This limitation does not affect carousel views — their children compile with `opacity = 1.0` and `ViewWidget` owns opacity entirely by design.

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

`WidgetRegistry` is the central registry for all widgets in a scene. A registry is created per `SceneEngine` instance; it is not a singleton. This allows multiple independent engines on the same page with different widget configurations.

**`constructor(options?)`** — Accepts `WidgetRegistryOptions`. The `strict` option controls duplicate-ID behavior (see `register()` below). Consumers building custom registries without `corePlugin()` should pass `{ strict: true }` explicitly.

**`register(widget)`** — Installs the widget by `widgetId`. If a widget with the same `widgetId` is already registered:
- When `strict: true`: throws `Error` with a message identifying the duplicate `widgetId`. This is the behavior when using `corePlugin()`.
- When `strict: false` (default): emits `console.warn` and the new widget overwrites the old one.

For `ISceneElement` widgets, a routing handler for `widget.DslComponent` is installed in the compiler's node registry (if not already present). For `IDslComposite` widgets, protective handlers are installed for each `childDslComponent` entry — entries with `topLevelError: true` throw a descriptive error if used outside their parent widget's DSL context. Returns `this` for chaining.

**`registerTypeFactory(component, factory)`** — Registers a factory function for a given DSL component. When the component appears in a scene DSL tree, the routing handler calls `factory(props)` with the element's props to produce a concrete `IWidget`. The produced widget is registered under the `id` prop value. This is the correct API for polymorphic elements like `<Model>` where `type` determines the concrete widget class.

The routing handler installed by `registerTypeFactory` requires both a `type` prop (to select the factory product) and an `id` prop (to key the produced widget in the registry). A compile-time error is thrown if either is absent.

**`getAnimationControllers()`** — Returns all registered `IAnimationController` widgets sorted in ascending `tickPriority` order. This sorted collection is cached in `RuntimeDriverImpl` at construction time, not recomputed each frame.

**`buildCacheKey()`** — Returns a stable string key representing the current registry contents. Used by the scene track cache to detect when a registry change (e.g., model metadata update) requires recompilation.

### 8.1 `nodeHandlerCategory` Duck-Type Property

Widget classes may declare an optional `nodeHandlerCategory` property to control how the compiler's Scene child constraint classifies their DSL component. This is a duck-typed opt-in — it is not defined in any `IWidget` sub-interface.

```typescript
// Declare a widget as ambient by adding this property:
class CameraWidget implements ISceneElement<CameraState>, IRenderable<CameraState> {
  readonly widgetId = 'camera';
  readonly nodeHandlerCategory = 'ambient' as const;
  // ... ISceneElement and IRenderable implementation ...
}
```

When `WidgetRegistry.register(widget)` installs a widget's DSL handler via `registerNode`, it reads `widget.nodeHandlerCategory` and passes `{ category: widget.nodeHandlerCategory }` to `registerNode`. If the property is absent, the category defaults to `'spatial'`.

**Built-in core widget categories:**

| Widget | `nodeHandlerCategory` | Notes |
|---|---|---|
| `CameraWidget` | `'ambient'` | Configures the global camera; no viewport region. |
| `LightingWidget` | `'ambient'` | Configures global scene lighting. |
| `BackgroundWidget` | `'ambient'` | Sets the DOM background behind the canvas. |
| `EnvironmentWidget` | `'ambient'` | Provides the HDR environment map. |
| `FloorWidget` | `'ambient'` | Manages the reflective floor plane. |
| `SpotlightRigWidget` | `'ambient'` | Themed spotlight arrays. |
| `SceneMetaWidget` | `'ambient'` | Internal scene metadata; not a spatial element. |
| `TextBoxWidget` | `'ambient'` | HTML overlay positioned via NVS — see note below. |

**TextBox classification note:** `TextBoxWidget` is registered with category `'ambient'`. However, `<TextBox>` elements authored inside `<Scene>` are typically treated as HTML overlay content by the Scene root handler via the `isPrimitiveComponent` guard. If authored as a direct `<Scene>` child, TextBox is classified as ambient and does not trigger the spatial constraint regardless of how many other elements are present.

**Downstream package widgets:** `DiagramWidget`, `ChartWidget`, `ModelWidget`, `ImagePanelWidget`, and `ScreenWidget` are all spatial by default. They do not declare `nodeHandlerCategory` and the default `'spatial'` applies. This means they participate in the Scene child constraint — two of them as direct `<Scene>` children without `<View>` wrappers triggers a `console.error`.

> **Note:** `getContainedModels()` is model-specific and will be removed from `WidgetRegistry` in Phase 4 of plan_core_modularization when `IContainedModel` moves to `@brewsite/model`. The `attachContainedModels()` runtime step will move with it.

### Type Guards

The following type guard functions are exported from the `widget` module:

```typescript
// Core type guards
const isSceneElement = (w: IWidget): w is ISceneElement<unknown>
const isRenderable = (w: IWidget): w is IRenderable<unknown>
const isLoadable = (w: IWidget): w is ILoadable
const isAnimationController = (w: IWidget): w is IAnimationController
const isVariableProvider = (w: IWidget): w is IVariableProvider
const isDslComposite = (w: IWidget): w is IDslComposite
const isInputDefaultProvider = (w: IWidget): w is IInputDefaultProvider
const isGroupOwner = (w: IWidget): w is IGroupOwner  // duck-type: 'rootGroup' in w

// Extended type guards
const isCameraActionTarget = (w: IWidget): w is ICameraActionTarget  // @deprecated
const isSceneLifecycle = (w: IWidget): w is ISceneLifecycle
const isRendererLifecycle = (w: IWidget): w is IRendererLifecycle
const isRenderContributor = (w: IWidget): w is IRenderContributor
const isContainedRenderable = (w: IWidget): w is IContainedRenderable
const isAttachmentHost = (w: IWidget): w is IAttachmentHost
const isCameraFocusTarget = (w: IWidget): w is ICameraFocusTarget
const isLightingOverride = (w: IWidget): w is ILightingOverride
const isExtraRenderPass = (w: IWidget): w is IExtraRenderPass
const isViewChild = (w: IWidget): w is IViewChild
const hasCustomDslHandler = (w: IWidget): w is IHasCustomDslHandler
```

> **Note:** `isContainedModel` is no longer exported from the widget module. Use `isContainedRenderable` instead. `IContainedModel` is `@deprecated` and will be removed when it moves to `@brewsite/model`.

These are structural type guards (duck-typed on the expected property names) rather than `instanceof` checks. This allows widgets to pass interface compliance without extending a base class. `isGroupOwner` specifically avoids `instanceof Object3D` because `widget/types.ts` uses type-only Three.js imports — the `Object3D` class is not available as a runtime value at that import site.

---

## 9. CUSTOM_NODE_HANDLER Symbol

```typescript
export const CUSTOM_NODE_HANDLER = Symbol('customNodeHandler');
```

`CUSTOM_NODE_HANDLER` is a well-known symbol used to give a widget its own DSL node compilation logic. Widgets that need custom compilation implement the `IHasCustomDslHandler` interface exported from `WidgetRegistry.ts`. The `hasCustomDslHandler(widget)` type guard checks for the symbol's presence. When the `WidgetRegistry` routing handler encounters a widget that implements `IHasCustomDslHandler`, it calls the widget's `[CUSTOM_NODE_HANDLER]` method instead of the default state-merge path.

```typescript
interface IHasCustomDslHandler extends IWidget {
  readonly [CUSTOM_NODE_HANDLER]: NodeHandler;
}
```

The custom handler signature matches the compiler's `NodeHandler` type:

```typescript
type NodeHandler = (
  node: ReactElement,
  api: CompileApi,
  helpers: CompileHelpers,
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

React hook for consuming `VariableStore` values in components. Uses `useSyncExternalStore` for correct concurrent-mode subscription. Must be called inside `<SceneEngine>` (reads from `VariableStoreContext`). Re-renders only when the specific `namespace.key` changes.

**Example:**

```typescript
// In a custom overlay component inside SceneEngine
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

Widget registration follows the composable plugin model. Plugins are passed as an array to the `plugins` prop of `SceneEngine`. Each plugin implements the `WidgetPlugin` interface:

```typescript
interface WidgetPlugin {
  /** Returns widget instances to register. Called once before first compilation. */
  createWidgets(): IWidget[];
  /** Registers DSL NodeHandlers. Must be idempotent. */
  registerHandlers(): void;
  /** Optional: fetches external assets (e.g. model manifest). */
  fetchManifest?(): Promise<AssetManifest | null>;
  /** Optional: performs plugin-specific registry configuration after widget registration. */
  configureRegistry?(registry: WidgetRegistry, manifest: AssetManifest | null): void;
  /**
   * Optional: reconcile a compiled SceneTrack back into the live WidgetRegistry.
   * Called after compilation completes. Use this for plugins that author state into
   * the track before all widget instances are materialized, so runtime renderables
   * can be created from the compiled output.
   *
   * corePlugin() uses this to lazily register ViewWidget instances — one per unique
   * view ID found in the compiled track — after scene DSL compilation completes.
   */
  reconcileCompiledTrack?(registry: WidgetRegistry, track: SceneTrack): void;
  /** Optional: wraps the engine subtree with plugin React context providers. */
  wrapProvider?(children: ReactNode): ReactNode;
  /** Optional: returns ActionInputHandler extensions for custom action types. */
  getActionInputExtension?(registry: WidgetRegistry): Partial<Pick<ActionInputHandler, 'onUnknownAction'>>;
  /** Optional: called when a WebGLRenderer is created. */
  onRendererCreated?(renderer: WebGLRenderer): void;
  /** Optional: called before a WebGLRenderer is disposed. */
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

| Widget | widgetId | Interfaces | Registration |
|--------|----------|------------|--------------|
| `LightingWidget` | `'lighting'` | `ISceneElement`, `IRenderable` | `createWidgets()` |
| `BackgroundWidget` | `'background'` | `ISceneElement`, `IRenderable` | `createWidgets()` |
| `EnvironmentWidget` | `'environment'` | `ISceneElement`, `IRenderable`, `ILoadable` | `createWidgets()` |
| `FloorWidget` | `'floor'` | `ISceneElement`, `IRenderable` | `createWidgets()` |
| `CameraWidget` | `'camera'` | `ISceneElement`, `IRenderable`, `IAnimationController` | `createWidgets()` |
| `SceneMetaWidget` | `'__scene_meta__'` | `IAnimationController`, `ISceneLifecycle` | `createWidgets()` |
| `SpotlightRigWidget` | `'spotlight-rig'` | `ISceneElement`, `IRenderable` | `createWidgets()` |
| `ViewWidget` | `<view id>` (one per view) | `IRenderable` | `reconcileCompiledTrack()` — lazy, one per view ID in compiled track |

`ViewWidget` instances are not returned by `createWidgets()`. They are created lazily in `reconcileCompiledTrack()` after the `SceneTrack` is compiled. Each `ViewWidget` owns a `THREE.Group` that reparents child widget 3D content (those implementing `IGroupOwner`) on first `apply()`. On each subsequent `apply()`, it computes a delta transform from the original compile-time bounds (captured on first call) to the current `ViewState.bounds`, and applies it to the Group: XY position uses `G = P_new - P_old * scaleRatio`; Z position uses `G_z = state.z - originalZ` (delta to prevent Z double-offsetting); scale uses `state.scale / originalScale`. All three original values are captured from the first `apply()` call. `ViewWidget` does not implement `ISceneElement` — it has no DSL component, no `defaultState`, and no `transitionSpec`. Its state (`ViewState`) is authored by the `viewHandler` compiler block.

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

The `WidgetPlugin` for `@brewsite/model`. Provides `ModelWidget` (via a type factory registered in `configureRegistry()`) and registers model DSL node handlers (`Label`, `Labels`). Manifest loading is handled internally by the plugin itself — consumers pass either `manifestUrl` (fetched on mount) or a pre-loaded `manifest` object.

**Model type factory:** When a manifest is available, `registerTypeFactory(ModelRouter, factory)` installs a lazy factory on the `WidgetRegistry`. On first encounter of a `<Model>` DSL node, the factory looks up model metadata from `manifest.models` by `type` prop and constructs a `ModelWidget` with that metadata and the derived `clipMeta`. If no manifest is provided, no `ModelWidget` instances are created — scenes without models work normally.

### Standard Integration Pattern

```tsx
// page.tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

<SceneEngine
  plugins={[
    corePlugin({ onSceneChange: (id, index) => console.log(id, index) }),
    modelPlugin({ manifestUrl: '/assets/manifest.json' }),
  ]}
>
  {scene01}
  {scene02}
</SceneEngine>
```

**Adding custom widgets:**

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

const myModelPlugin = modelPlugin({ manifestUrl: '/assets/manifest.json' });

<SceneEngine
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
</SceneEngine>
```

### 11.3 themesPlugin() — `@brewsite/themes`

`themesPlugin()` is the centralized theme registration plugin. It uses the `configureRegistry()` hook to populate the per-package theme registries at engine startup — before any compilation or rendering occurs.

```typescript
import { themesPlugin, bundles } from '@brewsite/themes';
import type { ThemeBundle } from '@brewsite/themes';
```

**`ThemeBundle`** is the complete cross-package theme data for a single theme family:

```typescript
interface ThemeBundle {
  readonly family: ThemeFamily;
  readonly scene:   { readonly dark: SceneTheme;   readonly light: SceneTheme };
  readonly diagram: { readonly dark: DiagramTheme; readonly light: DiagramTheme };
  readonly chart:   { readonly dark: ChartTheme;   readonly light: ChartTheme };
}
```

**Registration API** — the three per-package registry functions called by `configureRegistry()`:

```typescript
// @brewsite/core — registers a SceneThemePair for a ThemeFamily key
registerSceneThemePair(family: ThemeFamily, pair: SceneThemePair): void

// @brewsite/diagram — registers a DiagramThemePair for a ThemeFamily key
registerDiagramThemePair(family: ThemeFamily, pair: DiagramThemePair): void

// @brewsite/charts — registers a ChartThemePair for a ThemeFamily key
registerChartThemePair(family: ThemeFamily, pair: ChartThemePair): void
```

**`configureRegistry()` usage:** `themesPlugin()` implements the optional `configureRegistry(registry, manifest)` hook on `WidgetPlugin`. For each `ThemeBundle` in the configured list, it calls all three registration functions in sequence. This hook runs once per engine instance at startup, before compilation begins, ensuring the per-package registries are populated before any `NodeHandler` calls `resolveTheme()`.

```typescript
// themesPlugin implements WidgetPlugin:
function themesPlugin(bundles?: ThemeBundle[]): WidgetPlugin {
  return {
    createWidgets() { return []; },
    registerHandlers() {},
    configureRegistry(_registry, _manifest) {
      for (const bundle of bundles ?? ALL_BUNDLES) {
        registerSceneThemePair(bundle.family, bundle.scene);
        registerDiagramThemePair(bundle.family, bundle.diagram);
        registerChartThemePair(bundle.family, bundle.chart);
      }
    },
  };
}
```

**Standard pattern with themes:**

```tsx
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { chartPlugin } from '@brewsite/charts';
import { themesPlugin, themes } from '@brewsite/themes';

<SceneEngine
  plugins={[
    corePlugin(),
    diagramPlugin({ /* ... */ }),
    chartPlugin(),
    themesPlugin(),             // registers all five named bundles
  ]}
  theme={themes.darkGlass.dark} // ActiveTheme selector
>
  {scene01}
</SceneEngine>
```

**Selective registration** — only include bundles used by the app to optimize tree-shaking:

```tsx
import { themesPlugin, bundles } from '@brewsite/themes';

themesPlugin([bundles.darkGlass])   // only darkGlass is included in the bundle
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
  /**
   * Per-frame NVS coordinate conversion service.
   * Converts NVS [0..1] viewport positions to Three.js world-space
   * using the live camera and live canvas dimensions.
   *
   * Widgets that place geometry in the main scene MUST use this service
   * instead of holding camera references or using hardcoded aspect-ratio
   * constants. Available from the first apply() call onward. Non-null.
   *
   * See Section 12.7 for the NVSCoordService interface definition.
   */
  coords: NVSCoordService;
};
```

Passed to `IRenderable.apply` on every frame. `extra` is the value returned by `compileExtra` for this widget at this tick (or `undefined` if `compileExtra` is not implemented). `variables` is the read-only view of the `VariableStore`. `tick` is the current `SceneTrackTick` — useful for accessing label primitives or per-tick metadata. `coords` is the live coordinate conversion service injected by the engine from the current camera state.

`clock.wallTimeSeconds` is the canonical source for time-based oscillations and ambient animations. `effectiveDeltaSeconds` is the correct delta to pass to GLTF `AnimationMixer` and camera controls damping — it is scroll-speed-boosted when `animationTimeScale` is declared on `<ProgressManager>`, and equals `clock.deltaSeconds` during idle. See Section 12.5 for the `RealtimeClock` type definition.

### 12.7 NVSCoordService

NVS (Normalized Viewport Space) is the canonical coordinate language for all authored positions, sizes, and bounds across the BrewSite toolkit. NVS values are `[0..1]` fractions of the viewport: `x=0` is the left edge, `x=1` is the right edge, `y=0` is the top, `y=1` is the bottom.

`NVSCoordService` is a per-frame service injected into every `WidgetRenderContext`. It converts NVS positions to Three.js world-space using the live camera and live canvas dimensions. The engine computes this service at the start of each tick from the current `PerspectiveCamera` state and canvas pixel dimensions.

```typescript
// packages/core/src/widget/types.ts

export interface NVSCoordService {
  /**
   * Convert NVS [0..1] viewport position to Three.js world-space XYZ.
   * Projects onto the world Z-plane at the given depth.
   * @param nvsX  Horizontal position [0=left, 1=right].
   * @param nvsY  Vertical position [0=top, 1=bottom].
   * @param z     World-space Z depth of the target plane. Default: 0.
   */
  toWorld(nvsX: number, nvsY: number, z?: number): readonly [number, number, number];

  /**
   * Convert NVS width/height fractions to Three.js world-space units.
   * Based on the visible world size at z=0 (the camera look-at plane).
   * @param nvsW  Width as fraction of viewport [0..1].
   * @param nvsH  Height as fraction of viewport [0..1].
   */
  toWorldSize(nvsW: number, nvsH: number): readonly [number, number];

  /** Live canvas aspect ratio: width / height in CSS pixels. */
  readonly canvasAspect: number;

  /**
   * Visible world height at z=0 (the camera look-at plane).
   * Equals 2 * cameraDistance * tan(fov/2).
   */
  readonly visibleWorldHeight: number;

  /** Visible world width at z=0. Equals visibleWorldHeight * canvasAspect. */
  readonly visibleWorldWidth: number;

  /** Canvas width in CSS pixels. Updated each frame. */
  readonly viewportWidth: number;

  /** Canvas height in CSS pixels. Updated each frame. */
  readonly viewportHeight: number;
}
```

The `createNVSCoordService(camera, width, height)` factory is exported from `@brewsite/core` for test environments where a real engine is not running:

```typescript
import { createNVSCoordService } from '@brewsite/core';
import * as THREE from 'three';

const cam = new THREE.PerspectiveCamera(45, 16/9, 0.01, 100);
cam.position.set(0, 0, 5);
cam.updateProjectionMatrix();
const coords = createNVSCoordService(cam, 1920, 1080);
const [x, y, z] = coords.toWorld(0.5, 0.5, 0); // center of viewport at z=0
```

### 12.8 NVS Validation Functions

Three validation functions are exported from `@brewsite/core` (via `packages/core/src/layout/index.ts`) for use in widget `apply()` and compile functions in development mode:

```typescript
/** Asserts nvsValue is in [0..1]. Emits console.error (does not throw). */
function validateNVSScalar(value: number, label: string): void;

/** Asserts all four components of an NVSRect are valid. Emits console.error per violation. */
function validateNVSRect(rect: NVSRect, label: string): void;

/** Asserts nvsX and nvsY components of an NVS position are in [0..1]. */
function validateNVSPosition(pos: readonly [number, number, ...number[]], label: string): void;
```

All three are no-ops in production builds (`process.env.NODE_ENV === 'production'`). Use `validateNVSRect` in widget `apply()` to catch out-of-range compiled state in development:

```typescript
apply(state: MyState, ctx: WidgetRenderContext): void {
  if (process.env.NODE_ENV !== 'production') {
    validateNVSRect(state.bounds, `MyWidget(${this.widgetId})`);
  }
  const [worldX, worldY] = ctx.coords.toWorld(state.bounds.x, state.bounds.y);
  // ...
}
```

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
