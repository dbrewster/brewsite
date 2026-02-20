---
title: "BrewFlow Scene Toolkit — Vision & Overview"
doc_type: prd
owner: Website Product
status: draft
updated: 2026-02-20
change_history:
  - date: 2026-02-20
    author: Website Product (TPM)
    summary: "Initial PRD created. Establishes the full product vision, architecture overview, design principles, and success metrics for the BrewFlow Scene Toolkit as a generic, reusable authoring toolkit."
  - date: 2026-02-20
    author: Website Product (TPM)
    summary: "Major revision: incorporated Widget SDK as the central architectural principle. Added IAnimationController, VariableStore/useVariable, IContainedModel, IDslComposite, ScenePlayer.widgetSetup pattern. Moved Ribbon to consumer-widget examples. Added Labels."
  - date: 2026-02-20
    author: Website Product (TPM)
    summary: "Third revision following updated plan_library_decoupling.md. Key changes: (1) clean-start implementation strategy — new library in src/ with no robot namespace, legacy preserved in src/legacy/; (2) all Robot* type renames to Scene* equivalents; (3) isLightScene removed from SceneFrame, replaced by SceneDefinition.meta + SceneMetaWidget; (4) prefersReducedMotion moved to engine startup detection only; (5) createDefaultWidgetRegistry reads models directly from manifest — no separate model config; (6) tickPriority on IAnimationController; (7) AnimationTickContext gains current tick; (8) new consumer hooks useSceneProgress/useCurrentScene; (9) new ScenePlayer props — onSceneChange, contentSlots, placeholder; (10) two-tier overlay architecture documented; (11) AnnotationPositioner direct-DOM pattern; (12) SSR safety contract; (13) all type definitions updated."
  - date: 2026-02-20
    author: Website Product (TPM)
    summary: "Fourth revision: four gap fixes identified during plan-vs-PRD audit. (1) widgetSetup type updated to accept optional second options argument carrying onSceneChange, matching ScenePlayer's internal invocation pattern; (2) window.__robotRuntimeDebug renamed to window.__sceneEngineDebug to satisfy the no-robot-prefix acceptance criterion; (3) FR-SDK-007 extended to specify that SceneMetaWidget publishes SceneDefinition.meta fields as scene.meta.<key> variables, enabling useVariable('scene', 'meta.theme') usage shown in section 6.4; (4) useSceneEngine options corrected — framesPerScene removed (already in SceneGroup.timeline) and pixelsPerScene added (scroll height per scene, distinct parameter)."
---

# BrewFlow Scene Toolkit — Vision & Overview

## 1. Overview

The **BrewFlow Scene Toolkit** is a TypeScript + React + Three.js toolkit for building multi-scene, scroll-driven websites that blend interactive React UI with real-time 3D content in a shared world. Website developers declare rich animated scenes in JSX using a typed, asset-aware DSL. The toolkit compiles those declarations into an optimized, pre-baked playback track that delivers smooth 60 FPS scroll-driven animation.

The central architectural principle is: **everything is a Widget**. The compiler and runtime have zero knowledge of what any particular scene element represents — they only know how to call registered widgets through a small set of capability interfaces. Built-in scene elements (model, lighting, background, environment, floor) are first-party widget implementations. Consumer-defined effects (ribbons, particle systems, logo rotators, custom overlays) use the identical interfaces. The difference between a built-in and a custom widget is only whether it is pre-registered by `createDefaultWidgetRegistry()`.

The toolkit ships no models, no brand-specific assets, and no hard-coded story arcs. Specific scenes, models, and animation content are authored on top of the toolkit by the consumer.

---

## 2. Problem Statement

Building scroll-driven, mixed 2D/3D marketing or storytelling websites is expensive and fragile. Common failure modes:

- **Performance cliffs:** Naive Three.js + React integrations re-render too broadly. A single scroll event can cascade into full scene re-renders, material re-applications, and animation restarts.
- **Authoring friction:** Developers who want to animate a 3D scene must write raw Three.js mutation code interleaved with React lifecycle management, making the authoring surface intimidating and hard to maintain.
- **Coupling of concerns:** Animation logic, scene layout, Three.js state, and React UI state are typically entangled, making scene changes risky and testing nearly impossible.
- **Asset fragility:** 3D assets (GLB files) contain bone names, clip names, and geometry that must be known at authoring time. Without a typed, code-generated DSL layer, mismatched asset references are runtime errors discovered only in the browser.
- **Extensibility walls:** Engines built around a fixed element set force consumers to fork to add new visual effects.
- **Scroll integration complexity:** Mapping browser scroll position into animation progress, accounting for viewport size, pixel-per-scene ratios, and sub-frame precision, is almost always implemented ad hoc per project.

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals

| Goal | Metric | Target |
|------|--------|--------|
| 60 FPS playback during scroll | RAF frame budget | ≤ 16.7 ms/frame at peak |
| Authoring velocity | Time to author a new scene | < 1 hour for a developer familiar with the toolkit |
| Asset safety | Build-time failures on bad asset refs | 100% of asset name mismatches caught at typecheck |
| Testability | Unit test coverage of compiler/runtime | ≥ 80% line coverage (excluding render/Three.js paths) |
| Extensibility | Add a completely new scene element | Requires only: create a Widget class + call `widgetRegistry.register()`. Zero changes to `src/`. |
| Predictability | Backward/forward scroll re-renders | Only delta-changed widget states applied per frame |

### 3.2 Guardrail Metrics

- `src/compiler/sceneTrackCompiler.ts` imports zero element-specific modules.
- `RuntimeDriverImpl.apply()` iterates the widget registry generically — no per-element render calls.
- Three.js calls originate only in widget `initialize()`/`apply()`/`dispose()` implementations.
- Scene source files contain zero animation math and zero Three.js imports.
- `SceneFrame` has no typed element fields — only `widgets: Record<string, unknown>`.
- `SceneTrack` is a flat pre-baked array for O(1) progress sampling.
- `src/` contains zero references to: `robot`, `ribbon`, `brain`, `Brain`, `particle`, `logoRotator`, `local.brewblast.ai`, `#b344ef`, `General Sans`, `MODEL_BONE_NAME_MAP`.

### 3.3 Non-Goals

- Providing a specific 3D model, character, or animation library.
- Defining any brand-specific scene content, marketing copy, or visual style.
- Providing a WYSIWYG editor or visual authoring UI.
- Managing routing, page transitions, or non-3D page layout.
- Supporting non-scroll-driven playback modes (video export, timeline editors) in current scope.
- Multi-user collaboration or scene synchronization.

---

## 4. User Stories

### 4.1 Scene Author (Website Developer)

> **As a scene author**, I want to declare a scene in JSX — specifying what the world looks like at this scroll position — so I never write Three.js imperative code or manage animation state by hand.

> **As a scene author**, I want the DSL to be typed and auto-generated from my actual 3D assets, so I get compile-time errors if I reference a bone name, clip name, or mesh name that doesn't exist in my GLB.

> **As a scene author**, I want to attach metadata to a scene (e.g., `meta: { theme: 'light' }`) and have it published automatically so my UI components can react to scene changes without writing custom logic.

### 4.2 Page Integrator (React Developer)

> **As a page integrator**, I want to drop `<ScenePlayer>` into a page and pass it my scene group, a manifest URL, and a `widgetSetup` factory, so the entire engine lifecycle (loading → compiling → playing) is handled internally.

> **As a page integrator**, I want `useSceneProgress()` and `useCurrentScene()` hooks so my navigation, HUD, and overlay components stay in sync with the scroll position without wiring up RAF listeners.

> **As a page integrator**, I want React components to subscribe to named variables published by animation controllers via `useVariable()`, so my UI stays in sync with the 3D world without prop drilling.

### 4.3 Widget Author (Extension Developer)

> **As a widget author**, I want a small set of TypeScript interfaces (`ISceneElement`, `IRenderable`, `ILoadable`, `IAnimationController`) so I can create a new scene effect without touching the compiler or runtime internals.

> **As a widget author**, I want my custom widget to be indistinguishable from built-ins from the compiler and runtime's perspective, so optimization paths (delta tracking, pre-baking, quality tiers) apply to my widget for free.

> **As a widget author**, I want to publish named variables from my animation controller via `useVariable()` so I can create hybrid 2D/3D interactive effects.

### 4.4 Asset Pipeline Engineer

> **As a pipeline engineer**, I want a single build-time script that reads my `sceneResources.ts` and produces both typed DSL components and a runtime manifest JSON in one pass.

> **As a pipeline engineer**, I want `createDefaultWidgetRegistry(manifest)` to read model IDs directly from the manifest — so I don't declare the same model twice in two different places.

### 4.5 QA / Test Author

> **As a test author**, I want the compiler and runtime to be free of Three.js and React so I can write fast unit tests that run in Node without a DOM or WebGL context.

---

## 5. Functional Requirements

### 5.1 Implementation Architecture

**FR-ARCH-001:** The library must be implemented in a clean `src/` directory with no "robot" namespace prefix anywhere. Module paths are: `src/widget/`, `src/compiler/`, `src/runtime/`, `src/elements/`, `src/labels/`, `src/annotations/`, `src/timeline/`, `src/math/`, `src/player/`.

**FR-ARCH-002:** The existing `src/robot/` codebase must be preserved as `src/legacy/` and excluded from `tsconfig.json` compilation paths. It serves as a reference-only implementation and is deleted once the new implementation passes all acceptance criteria.

**FR-ARCH-003:** All "Robot" type and function name prefixes must be removed in the new library. Canonical renames:

| Legacy | New |
|--------|-----|
| `RobotTimeline` | `SceneTimeline` |
| `createRobotTimeline()` | `createSceneTimeline()` |
| `robotTimeline.ts` | `src/timeline/index.ts` |
| `robotTimelineMath.ts` | `src/timeline/math.ts` |
| `RobotAxisRotation` | `AxisRotation` |
| `RobotAxisTranslation` | `AxisTranslation` |
| `RobotMotionCommand` | `MotionCommand` |
| `RobotPose` | `ModelPose` |
| `RobotPoseGroup` | `PoseGroup` |
| `RobotMotionScene` | `MotionScene` |
| `sceneAnimationMultiplier` | `oversamplingRate` |

### 5.2 The Widget SDK

**FR-SDK-001:** The toolkit must define `src/widget/types.ts` exporting a set of capability interfaces. A widget is any object implementing one or more of these interfaces. No base classes are required.

**FR-SDK-002:** The capability interfaces are:

- **`IWidget`** — Base: `readonly widgetId: string`. Every widget has a stable unique ID used as its key in `SceneFrame.widgets`, `SceneTrackTick.widgetExtras`, and the `WidgetRegistry`.
- **`ISceneElement<TState, TExtra>`** — Compile-time participation: `defaultState`, `transitionSpec`, `DslComponent`, and optional `compileExtra(state, context): TExtra`. `TState` must be a plain serializable object (no Three.js, no functions).
- **`IRenderable<TState>`** — Three.js representation: `initialize(context)`, `apply(state, context)`, `dispose()`.
- **`ILoadable`** — Async asset loading: `load(manifest): Promise<void>`, `readonly isLoaded: boolean`.
- **`IDslComposite`** — Pattern A containment: `readonly childDslComponents: ReadonlyArray<{ component, displayName, topLevelError? }>`. Child components contribute sub-state to the parent's `TState` — they have no independent widget ID and are not authored at the scene top level.
- **`IContainedModel<TState>`** — Pattern B runtime attachment (extends `IRenderable`): `readonly anchorModelId: string`, `readonly anchorKey: string`. Attachment is declared at construction, not in the scene DSL. The widget is authored at the scene top level as a sibling of the primary model.
- **`IAnimationController`** — Frame-tick independent of scene state: `readonly tickPriority?: number`, `onTick(context: AnimationTickContext): void`. Controllers are ticked before renderers in ascending `tickPriority` order (default 0). `AnimationTickContext` provides write access to the `VariableStore` and the current `SceneTrackTick | null` (null before first compilation).
- **`IVariableProvider`** — Companion to `IAnimationController`: `readonly variableNamespace: string`, `readonly variableKeys: readonly string[]`. Declares the variables published to the `VariableStore`.

**FR-SDK-003:** `WidgetRegistry` must be a class with a fluent `register(widget): this` method that: (a) stores the widget by `widgetId`, (b) registers a default DSL node handler for `ISceneElement` widgets unless the widget's constructor already registered a custom handler (custom takes precedence), (c) registers protective top-level handlers for all `IDslComposite.childDslComponents` — error-throwing when `topLevelError: true`, noop otherwise. `WidgetRegistry` must also expose `buildCacheKey(): string` producing a stable string from all registered widget IDs and their compilation-relevant configuration, used for `SceneTrack` cache invalidation.

**FR-SDK-004:** `VariableStore` must be a `namespace/key → JsonPrimitive` store with `set()`, `get()`, `getNamespace()`, and `subscribe(key, listener)` (returns unsubscribe). `set()` must not call `notify()` when the new value strictly equals the old value — preventing spurious React re-renders on every tick for stable values.

**FR-SDK-005:** `useVariable<T>(namespace, key)` must be a React hook that reads from the `VariableStore` using `useSyncExternalStore` and re-renders only when the specific value changes. Must throw a clear error if used outside `<ScenePlayer>`.

**FR-SDK-006:** `createDefaultWidgetRegistry(manifest: AssetManifest | null): WidgetRegistry` must be a factory that: (a) reads model IDs and metadata directly from `manifest.models[]` — one `ModelWidget` per entry, no separate model config parameter, (b) pre-registers `LightingWidget`, `BackgroundWidget`, `EnvironmentWidget`, `FloorWidget`, and `SceneMetaWidget`. Returns a `WidgetRegistry` the consumer can chain `.register()` on.

**FR-SDK-007:** `SceneMetaWidget` must be a built-in `IAnimationController` (registered by `createDefaultWidgetRegistry`) that on every tick: (a) publishes `scene.id`, `scene.index`, and `scene.progress` to the `VariableStore`; (b) publishes all fields from `SceneDefinition.meta` as `variables.set('scene', 'meta.' + key, value)` — e.g., `meta: { theme: 'light' }` produces `useVariable('scene', 'meta.theme') === 'light'`; (c) detects scene boundary crossings (when `sceneId` changes from the previous tick) and fires `onSceneChange` exactly once per crossing. It reads the current tick from `AnimationTickContext.tick`. `tickPriority` must be `-1000` so it runs before all other controllers.

**FR-SDK-008:** Type guard functions (`isSceneElement`, `isRenderable`, `isLoadable`, `isContainedModel`, `isDslComposite`, `isAnimationController`, `isVariableProvider`) must be exported from `src/widget/`.

### 5.3 Scene Authoring DSL

**FR-DSL-001:** The scene authoring DSL must consist of JSX components returning `null`. Scene `getFrame()` functions must be pure — no Three.js, no side effects, no frame math.

**FR-DSL-002:** The compiler DSL public surface (`src/compiler/index.ts`) exports only scene authoring primitives — `Scene`, `Transitions`, `Annotations`, `Labels`, and the built-in widget DSL components (`Lighting`, `Model`, `Background`, `Floor`, `Environment`). No infrastructure types.

**FR-DSL-003:** Widget DSL components accept typed props and optional context-function props — props whose value is a function of `SceneFrameContext`. `SceneFrameContext` includes: `progress`, `sceneProgress`, `sceneProgressRaw`, `globalProgress`, `sceneStart`, `sceneEnd`, `assetsReady`, `timeline`, `baseState`, `nextState`, `variables: VariableStoreReader`, and `viewport: { width, height, aspectRatio }`.

**FR-DSL-004:** `SceneDefinition` must carry: `id`, `index`, `getFrame`, optional `transitions[]`, optional `meta: Record<string, JsonPrimitive>` (published to `VariableStore` by `SceneMetaWidget`), optional `entryLead` (how far before the scene boundary entry transitions begin), and optional `entryStart` (explicit override).

**FR-DSL-005:** `SceneTransition.start` and `SceneTransition.end` must accept either a `number` or a function `(context: SceneFrameContext) => number`. `SceneTransition.apply` must be `(state: SceneFrame, context, t) => SceneFrame`.

**FR-DSL-006:** Transitions between scenes must be declared inside the **incoming** scene's `transitions[]`. Negative `start` values are valid and indicate the transition begins during the previous scene's tail.

**FR-DSL-007:** DSL node registration must not rely on module-level side-effect imports. All registration occurs through `WidgetRegistry.register()` which calls the widget's constructor-registered handler.

### 5.4 Asset Metadata Pipeline

**FR-ASSET-001:** The unified `gen-scene-dsl.mjs --manifest-out` script must read a `sceneResources.ts` file and produce in a single GLB-reading pass: (a) a typed TypeScript DSL module with union types for all asset identifiers, and (b) a version-2 `AssetManifest` JSON file.

**FR-ASSET-002:** `sceneResources.ts` must support: `models[]` (with `id`, `role`, `path`, `anchorKeys[]`), `containedModels[]` (with `id`, `path`), and `animations[]` (with `id`, `path`). `anchorKeys` are consumer-defined names resolved to bone names via a four-step heuristic cascade: exact match → substring match → pattern match → warn and use key as value.

**FR-ASSET-003:** The generated TypeScript module must export typed union types for all asset identifiers, making bad asset references a `tsc` error.

**FR-ASSET-004:** The `AssetManifest` schema must be version 2: `{ version: 2, models: ModelMeta[], containedModels: ContainedModelMeta[], animations: AnimationEntry[] }`. No hardcoded named fields.

**FR-ASSET-005:** The `ILoadable` protocol replaces `ModelResourceManager`. Each loadable widget receives the manifest in `load(manifest)` and resolves its own asset URLs. The `RuntimeDriver` awaits all `ILoadable` widgets in parallel, then marks `assetsReady = true` and triggers recompile.

### 5.5 Compilation Pipeline

**FR-COMP-001:** `compileSceneTrack(options: CompileSceneTrackOptions)` must accept: `scenes`, `timeline`, `assetsReady`, `prefersReducedMotion` (detected at engine startup, not from the browser in the compiler), and `widgetRegistry`. It must produce a `SceneTrack`.

**FR-COMP-002:** `CompileApi.setWidgetState(widgetId, state)` is the sole means of writing element state during DSL compilation. Named per-element setters (`setLighting`, `setRibbon`, etc.) must not exist.

**FR-COMP-003:** The tick-baking pass must: (a) initialize `frame.widgets` from all `ISceneElement.defaultState` values, (b) apply DSL via `resolveSceneFromDsl()`, (c) interpolate per-widget via `transitionSpec.interpolate()`, (d) call `compileExtra()` for widgets that implement it — storing results in `tick.widgetExtras[widgetId]`, (e) compute `deltaForward`/`deltaBackward`, (f) compile `annotationPrimitives` and `labelPrimitives`.

**FR-COMP-004:** The compiler must import zero element-specific modules. It must not reference `SceneLighting`, `SceneModel`, `SceneRibbon`, `compileAnimation`, or any other concrete element type.

**FR-COMP-005:** Three compiler passes must be run in order: (1) base state pass, (2) auto-entry transition pass, (3) tick baking pass.

**FR-COMP-006:** `SceneTrackSampler` must provide O(1) lookup via `Math.round(progress / tickStep + eps)`.

**FR-COMP-007:** `SceneCompiler` must manage: synchronous first compile for first render, deferred quality-tier upgrade via `requestIdleCallback` / `setTimeout` fallback, and cache invalidation using `WidgetRegistry.buildCacheKey()` as part of the composite cache key.

### 5.6 Runtime & Playback

**FR-RT-001:** `RuntimeDriverImpl.apply()` must iterate `widgetRegistry.getRenderables()` generically — no per-element render calls.

**FR-RT-002:** Tick ordering per frame:
  1. Tick all `IAnimationController` widgets in `tickPriority` order (ascending) — write to `VariableStore`.
  2. Sample `SceneTrackTick` from `SceneTrackSampler`.
  3. Apply delta-tracked state to all `IRenderable` widgets.
  4. Call `AnnotationPositioner.update()` — resolves bone world positions and sets annotation/label DOM positions via direct mutation (no React).

**FR-RT-003:** `RuntimeDriverImpl` must implement delta-tracked apply modes: full, forward (`deltaForward`), backward (`deltaBackward`), none.

**FR-RT-004:** Initialization sequence: (a) `initialize()` all `IRenderable` widgets synchronously — creates placeholder Three.js objects, (b) `await Promise.all(loadables.map(w => w.load(manifest)))`, (c) `assetsReady = true`, trigger recompile.

**FR-RT-005:** `RuntimeLoop` must: accept driver, `getGlobalProgress()` (direct DOM read), optional `render()`, and `onAfterTick()`. Support configurable FPS cap (default 60), deterministic time override for testing, and perf ring buffer at `window.__sceneEngineDebug.perf`.

**FR-RT-006:** `IContainedModel` widgets — after `load()` resolves, the engine resolves `anchorKey → boneName` from the primary model's `anchorTargets` in the manifest and attaches the widget's Three.js group to that bone.

**FR-RT-007:** Three.js scene ownership chain: `EngineScrollRegion` owns the `<canvas>`, `useSceneEngine` creates the `THREE.WebGLRenderer`, `RuntimeDriver` creates the `THREE.Scene` and `THREE.Camera`. `RuntimeDriver.dispose()` calls `widget.dispose()` for all renderables, then disposes the renderer.

### 5.7 Scroll Integration

**FR-SCROLL-001:** `useEngineScroll` maps scroll position to progress [0, 1]. Scroll container may be `window` or any scrollable element.

**FR-SCROLL-002:** Exposes both `progress` React state (for UI) and `getGlobalProgress()` direct DOM read (for RAF loop — zero lag).

**FR-SCROLL-003:** Exposes `scrollToProgress(value)` for programmatic control.

**FR-SCROLL-004:** Scroll region height: `viewportHeight + (sceneCount × pixelsPerScene)`. Default `pixelsPerScene = 400`, configurable.

### 5.8 Built-in Widget Elements

**FR-ELEM-001:** Built-in widgets wrap existing `types.ts` → `compile.ts` → `dsl.tsx` → `render.ts` logic into Widget SDK classes. No logic is rewritten — only wrapped. File structure in `src/elements/*/` is: `types.ts`, `*Widget.ts`, `compile.ts`, `ModelRenderer.ts` (model only), `index.ts`.

**FR-ELEM-002:** First-party built-in widgets:
  - **`ModelWidget`** — `ISceneElement<SceneModelInstanceState, CompiledAnimation>` + `IRenderable` + `ILoadable` + `IDslComposite`. `widgetId` = model's `id` from manifest. `compileExtra()` produces `CompiledAnimation` via `compileAnimation()`. Child DSL: `BodyPart`, `BodyParts`, `Pose`, `ModelPart`, `Playback`, `Motion`, `Animation` (all `topLevelError: true`); `ContainedModel`, `Subpart` (noop at top-level).
  - **`LightingWidget`** — `ISceneElement<SceneLighting>` + `IRenderable` + `IDslComposite`. Child DSL: `Ambient`, `Directional`, `Spot`, `Point`, `Panel` (all `topLevelError: true`).
  - **`BackgroundWidget`** — `ISceneElement<SceneBackground>` + `IRenderable`.
  - **`EnvironmentWidget`** — `ISceneElement<SceneEnvironment>` + `IRenderable` + `ILoadable`.
  - **`FloorWidget`** — `ISceneElement<SceneFloor>` + `IRenderable`.
  - **`SceneMetaWidget`** — `IAnimationController`. Built-in. Reads `AnimationTickContext.tick` to publish `scene.id`, `scene.index`, `scene.progress` to the `VariableStore` every frame.

**FR-ELEM-003:** Adding any new element type requires: create a Widget class + `widgetRegistry.register(new MyWidget())`. Zero changes to any file in `src/`.

### 5.9 Overlay Architecture

**FR-OVERLAY-001:** Annotation and label positions must update via **direct DOM mutation** — not React state. The `AnnotationPositioner` class must maintain a `Map<id, HTMLElement>` populated by React annotation components via `registerElement(id, el)` on mount/unmount. Every frame, `RuntimeDriver` calls `AnnotationPositioner.update()` after `THREE.WebGLRenderer.render()` (so bone world matrices are final) — this directly sets `element.style.transform` without triggering React renders.

**FR-OVERLAY-002:** Annotation and label **content** (text, color, visibility) must update via React and `useSyncExternalStore`. `SceneMetaWidget` and other controllers publish changes to the `VariableStore`; React components re-render via `useVariable()` only when content changes.

**FR-OVERLAY-003:** This two-tier design ensures: positions update at 60 FPS with zero React overhead; content updates only when changed; both are visually merged into a single browser paint frame.

**FR-OVERLAY-004:** `ScenePlayer` must provide `ContentSlotContext` — a `Record<string, ReactNode>` consumed via `useContentSlot(contentId)` in annotation renderers. Populated via `ScenePlayer.contentSlots` prop.

**FR-OVERLAY-005:** `AnnotationPlacement` must be a typed union: `{ mode: 'fixed', reference: { x, y }, offset: { xPct, yPct } }` for viewport-relative placement, or `{ mode: 'follow', targetPartId, targetOffset?, screenOffset? }` for world-tracked placement. The legacy `mode: 'world' | 'screen' | 'hud'` union must not exist.

### 5.10 Labels

**FR-LABEL-001:** Labels are world-space text labels that attach to named bone or subpart nodes. `LabelDefinition`: `id`, `text`, `targetPartId`, `labelOffset?`, `enabled?`, `style?` (color, line color, opacity, font size, line thickness).

**FR-LABEL-002:** Labels are compiled via `compileLabels()` in the tick-baking pass, stored as `tick.labelPrimitives`. Positions are resolved in the `AnnotationPositioner.update()` call (same DOM-mutation path as annotations).

### 5.11 Timeline Algebra

**FR-TL-001:** `SceneTimeline` must include: `stops[]`, `sceneCount`, `framesPerScene`, `subTicksPerSegment`, `oversamplingRate` (replaces `sceneAnimationMultiplier`), `tickStep`, `subTickCount`, `tick(index)`, `mapToSceneProgress(progress)`, `snapToTick(progress)`.

**FR-TL-002:** Math helpers in `src/timeline/math.ts` must be pure functions: `clamp01`, `lerp`, `invLerp`, `rangeProgress`, `smoothstep`, `createRangeTransition`, `createFadeTransition`.

**FR-TL-003:** `createQualityTimeline(base, subTicksPerSegment)` must produce a variant with different tick resolution without requiring scene re-declaration.

### 5.12 ScenePlayer Component

**FR-PLAYER-001:** `<ScenePlayer>` accepts:
  - `sceneGroup: SceneGroup` — `{ id, scenes: SceneDefinition[], timeline: SceneTimeline }`.
  - `manifestUrl: string` — URL to the `AssetManifest` JSON.
  - `widgetSetup: (manifest: AssetManifest | null, options?: { onSceneChange?: (sceneId: string, sceneIndex: number) => void }) => WidgetRegistry` — factory called on mount and when manifest loads. `ScenePlayer` passes `options.onSceneChange` so consumer factories (e.g., `createDefaultWidgetRegistry`) can thread it to `SceneMetaWidget`. Consumers who do not use `onSceneChange` can ignore the second argument.
  - `className?`, `scrollHeightPx?` (default: `scenes.length × 800`), `framesPerScene?` (default 30), `fpsCap?` (default 60).
  - `onReady?: () => void`, `onError?: (error: Error) => void`.
  - `onSceneChange?: (sceneId: string, sceneIndex: number) => void` — fired by `SceneMetaWidget` when the active scene changes (not every tick).
  - `contentSlots?: Record<string, ReactNode>` — named React content for `contentId`-based annotations.
  - `placeholder?: ReactNode` — rendered server-side and before engine initialization (SSR safety).
  - `children?: ReactNode` — overlay content above canvas with `pointer-events: none`.

**FR-PLAYER-002:** `ScenePlayer` must provide: `VariableStoreContext`, `AnnotationPositionerContext`, `ContentSlotContext`.

**FR-PLAYER-003:** `ScenePlayer` provides `useSceneProgress(): number` and `useCurrentScene(): { id: string; index: number }` hooks via an `EngineStateContext`. These update from `SceneMetaWidget`'s `VariableStore` publications.

**FR-PLAYER-004:** `ScenePlayer` must return `placeholder ?? null` when `typeof window === 'undefined'` (SSR). Widget `initialize()` must never be called in non-browser environments.

### 5.13 SSR Safety

**FR-SSR-001:** `src/compiler/`, `src/timeline/`, `src/math/` must be fully SSR-safe — no browser APIs, no Three.js. Can run in Node for pre-compilation or testing.

**FR-SSR-002:** Widget class definitions must not reference Three.js at module import time. Three.js imports must appear inside `initialize()` or use dynamic imports.

### 5.14 Integration Hook

**FR-ENG-001:** `useSceneEngine` accepts: `sceneGroup`, `widgetRegistry`, `clipMeta`, `pixelsPerScene` (scroll height per scene — distinct from `framesPerScene`, which is already encoded in `SceneGroup.timeline`), `fpsCap`, `onReady`. Returns `frameState`, `scrollRegionRef`, `progress`, `scrollToProgress`, `getGlobalProgress`.

**FR-ENG-002:** All callbacks passed to `useSceneEngine` must be stored in refs to prevent RAF loop restarts on React re-renders.

**FR-ENG-003:** `EngineFrameDriver` notifies React state only when the tick **index** changes — not on every RAF frame.

---

## 6. Technical Considerations

### 6.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Pages / Routes (Integrator Code)                                    │
│    imports: ScenePlayer, createDefaultWidgetRegistry,                │
│             useVariable, useSceneProgress, useCurrentScene,          │
│             custom Widget classes                                     │
├──────────────────────────────────────────────────────────────────────┤
│  src/player/                                                         │
│    ScenePlayer, useSceneEngine, useEngineScroll, useSceneProgress,   │
│    useCurrentScene, EngineScrollRegion, AnnotationPositioner,        │
│    ContentSlotContext, createDefaultWidgetRegistry                   │
├──────────────────────────────────────────────────────────────────────┤
│  src/widget/                                                         │
│    IWidget, ISceneElement, IRenderable, ILoadable, IDslComposite,    │
│    IContainedModel, IAnimationController, IVariableProvider,         │
│    WidgetRegistry, VariableStore, useVariable                        │
│    ← Pure TypeScript interfaces; no Three.js, no React              │
├──────────────────────────────────────────────────────────────────────┤
│  src/runtime/                                                        │
│    RuntimeDriverImpl, RuntimeLoop                                    │
│    Iterates widget registry each tick — zero element knowledge       │
├──────────────────────────────────────────────────────────────────────┤
│  src/compiler/                                                       │
│    sceneTrackCompiler, sceneDslCompiler, sceneTrackSampler           │
│    Pure TypeScript; no Three.js, no React, no DOM                   │
│    ← Calls widget.DslComponent, .defaultState, .transitionSpec,     │
│       .compileExtra()                                                │
├──────────────────────────────────────────────────────────────────────┤
│  src/elements/  (first-party widgets)                                │
│    model/ lighting/ background/ environment/ floor/                  │
│    Three.js confined to widget initialize()/apply()/dispose()        │
├──────────────────────────────────────────────────────────────────────┤
│  Consumer scenes (anywhere)                                          │
│    Pure JSX declarations. No logic, no Three.js, no math            │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 The "Everything Is a Widget" Principle

The compiler and runtime have zero knowledge of specific element types. They only:

1. Call registered widget DSL node handlers to produce `widgets[id]` state (compiler).
2. Interpolate each widget's state via its `transitionSpec` (compiler).
3. Call `compileExtra()` on widgets that implement it, storing results in `widgetExtras[id]` (compiler).
4. Tick `IAnimationController` widgets in `tickPriority` order (runtime — before renderers).
5. Call `apply(state, context)` on all `IRenderable` widgets (runtime).

Adding a `FogWidget`, `ParticleWidget`, or `VideoTextureWidget` requires zero changes to `src/`.

### 6.3 The Two Containment Patterns

**Pattern A — DSL Composition (`IDslComposite`):** Children contribute sub-state to the parent widget's `TState`. No independent `widgetId`. Authored *inside* the parent widget's component. Example: `<Ambient>` inside `<Lighting>`.

**Pattern B — Runtime Attachment (`IContainedModel`):** The child is a full registered widget with its own `widgetId` in `SceneFrame.widgets`. Anchor relationship declared at construction. Authored at the **scene top level** as a sibling. Example: `BrainModelWidget` (`anchorModelId: 'primary'`, `anchorKey: 'head'`) authored as `<Brain>` alongside `<Model>`.

A widget may implement both simultaneously — `BrainModelWidget` is Pattern B relative to the primary model (attaches to head bone) and Pattern A for `<Subpart>` children (contribute to `BrainState`).

### 6.4 `isLightScene` Removal and SceneDefinition Metadata

`isLightScene` was a BrewBlast CSS theming concept and has no place in the generic library. It is removed from `SceneFrame`.

Replacement: `SceneDefinition.meta: Record<string, JsonPrimitive>` carries consumer-defined scene metadata. `SceneMetaWidget` publishes `meta.*` fields to the `VariableStore` each frame. Consumer React components read them via `useVariable()` and apply their own theming. Example:

```typescript
export const scene02: SceneDefinition = {
  id: 'robot', index: 1,
  meta: { theme: 'light', background: '#ffffff' },  // consumer-defined
  getFrame: (ctx) => ( /* ... */ ),
};
// Consumer component:
const theme = useVariable<string>('scene', 'meta.theme');
```

### 6.5 Variable Update Timing — The Two-Tier Overlay Pattern

Every RAF frame, `RuntimeLoop.step()` executes synchronously:

```
Step 1  driver.tick()
        ├─ IAnimationController.onTick() — writes to VariableStore (synchronous)
        │   └─ VariableStore.set() → notify() → useSyncExternalStore listeners scheduled
        └─ IRenderable.apply() — reads VariableStore directly (zero lag)

Step 2  THREE.WebGLRenderer.render(scene, camera)
        → Three.js frame drawn to canvas

Step 3  AnnotationPositioner.update(annotations, labels, camera, bonePositions)
        → Reads bone worldMatrix from Three.js (matrices final after Step 2)
        → Sets element.style.transform DIRECTLY on DOM nodes — NO React
        → Runs at 60 FPS with zero React overhead

[RAF callback ends]

Step 4  React synchronous flush (triggered by Step 1 VariableStore notifications)
        → Components using useVariable() re-render with new values
        → Annotation content (text, color) updates

Step 5  Browser paint: Three.js canvas + DOM changes merged into one visual frame
```

**Key guarantees:** Positions update with zero lag via direct DOM mutation (Step 3). Content updates with at most one-frame lag via React (Step 4), invisible in practice since the browser merges Steps 2–4 into one paint.

**Critical constraint:** Annotation positions must never go through React state. Setting position via React state causes one-frame lag at 60 FPS — visibly wrong.

### 6.6 Pre-baking & O(1) Sampling

All computational work is compile-time. `SceneTrackSampler.sample(progress)` = `Math.round(progress / tickStep + eps)` — a single arithmetic operation. Delta structures keyed by `widgetId` are pre-computed; the runtime applies only changed properties per frame.

### 6.7 Three.js Confinement

Three.js imports appear only in widget `initialize()`/`apply()`/`dispose()`. Compiler and Widget SDK are pure TypeScript testable in Node. This boundary should be enforced by lint rule (`no-restricted-imports` on `three` outside permitted element paths).

### 6.8 `prefersReducedMotion` Placement

`prefersReducedMotion` is detected once at engine startup (`window.matchMedia(...).matches`) and passed only through `CompileExtraContext` (the argument to `ISceneElement.compileExtra()`). It does not appear in `CompileSceneTrackOptions`. The compiler is thus independent of browser accessibility APIs.

### 6.9 Consumer Widget Examples

Site-specific features are removed from `src/` and re-implemented as consumer examples in `examples/widgets/`:

- **`RibbonWidget`** (`examples/widgets/ribbon/`) — `ISceneElement<RibbonConfig>` + `IRenderable`. Neutral white defaults.
- **`LogoRotatorWidget`** (`examples/widgets/logo-rotator/`) — `IAnimationController` + `IVariableProvider`. Publishes `currentLogoId`, `currentColor`, `currentLabel`.
- **`BrainModelWidget`** (`examples/widgets/brain-model/`) — `ISceneElement<BrainState>` + `IContainedModel` + `ILoadable` + `IDslComposite`. Canonical reference for both containment patterns simultaneously.

### 6.10 SSR Architecture

**Compiler/math/timeline** (`src/compiler/`, `src/timeline/`, `src/math/`): fully SSR-safe. No browser APIs, no Three.js. Can run in Node for pre-compilation or testing.

**Renderable widgets**: NOT SSR-safe. `initialize()` uses Three.js. Widget class definitions must not reference Three.js at module import time (use dynamic imports or put imports inside `initialize()`). `ScenePlayer` returns `placeholder ?? null` when `typeof window === 'undefined'`.

### 6.11 Performance Targets

| Metric | Target |
|--------|--------|
| RAF frame budget (scrolling) | ≤ 16.7 ms |
| First scene render (cold) | ≤ 100 ms after manifest load |
| Compile time (low quality, 5 scenes) | ≤ 50 ms synchronous |
| Compile time (high quality, 5 scenes) | ≤ 500 ms via requestIdleCallback |
| `SceneTrackSampler.sample()` | O(1), ≤ 0.01 ms |
| Three.js `renderer.render()` | ≤ 10 ms per frame at 1× DPR |

---

## 7. UX & Design Requirements

### 7.1 Consumer Journey

The authoring journey must be completable in nine documented steps with no undocumented globals:

```
1. Prepare assets      → GLB models + animation GLBs → public/assets/
2. Define resources    → sceneResources.ts: models, containedModels, animations, anchorKeys
3. Generate DSL        → pnpm gen:scene-dsl → typed DSL + scene-manifest.json
4. Build widgets       → implement custom Widget classes (optional)
5. Register widgets    → widgetSetup.ts: createDefaultWidgetRegistry(manifest).register(...)
6. Author scenes       → scene files using generated DSL + widget DSL components
7. Compose group       → SceneGroup: scenes[] + timeline
8. Embed player        → <ScenePlayer sceneGroup={...} manifestUrl="..." widgetSetup={...} />
9. Build + deploy      → pnpm build; browser loads manifest, compiles, plays on scroll
```

### 7.2 Developer Ergonomics

- TypeScript strict mode throughout. No `any` in public APIs.
- `WidgetRegistry` logs a clear warning on duplicate `widgetId`.
- `IDslComposite` protective handlers throw descriptive errors when a child is misused at scene top level (e.g., `"<Ambient> must be used inside <Lighting>"`).
- `useVariable()` throws a clear error if used outside `<ScenePlayer>`.
- `useAnnotationPositioner()` throws if used outside `<ScenePlayer>`.
- Debug mode: `window.__sceneEngineDebug` exposes perf ring buffer and tick-level state.

### 7.3 Accessibility

- The scroll spacer is `aria-hidden="true"`.
- `ScenePlayer`'s overlay container uses `pointer-events: none`. Consumer overlays manage their own focus and ARIA.
- All visible UI content over the canvas must meet WCAG 2.1 AA — the toolkit must not interfere with sibling DOM focus or ARIA attributes.

---

## 8. Dependencies

| Dependency | Version | Role |
|------------|---------|------|
| React | 19.x | JSX DSL, hooks, `useSyncExternalStore` for `useVariable` |
| Three.js | 0.169 | 3D scene graph, WebGL renderer, animation mixer |
| TypeScript | 5.x | Strict-mode type safety throughout |
| Vite | 5.x | Dev server and bundler |
| Vitest | 2.x | Test runner |
| gltf-transform | (scripts only) | GLTF metadata extraction at build time |
| Babel | (scripts only) | JSX parsing in `gen-scene-dsl.mjs` |
| pnpm | 9.x | Package manager |

No runtime dependencies beyond React and Three.js. Compiler, runtime, and Widget SDK are Node-testable.

---

## 9. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `SceneFrame.widgets: Record<string, unknown>` loses per-widget type safety | Medium | Each widget casts internally; `ISceneElement<TState>` documents expected type; tests verify shape |
| Widget `tickPriority` ordering not obvious to new widget authors | Low | Document in Widget SDK guide; `SceneMetaWidget` uses priority -1000 (runs first); user controllers default to 0; controllers with inter-dependencies declare explicit relative priorities |
| `VariableStore` mutations causing React re-render cascades | Low | `useSyncExternalStore` subscribes per `namespace.key`; `set()` skips notify on same value |
| `AnnotationPositioner` DOM nodes not registered before first `update()` call | Low | Guard with `if (!el) continue` — nodes are registered progressively as React mounts them |
| Widget class Three.js imports at module level crashing SSR | Medium | Documented SSR contract; lint rule for Three.js outside `initialize()` paths |
| `SceneTrack` memory growth with widget count × scene count × quality tier | Medium | Expose memory estimate in compiler output; document max scene guidance |
| `createDefaultWidgetRegistry(null)` (before manifest loads) creating broken ModelWidgets | Low | `ModelWidget.load(null)` logs a warning and returns without crashing; widget renders nothing until manifest loads |
| Three.js minor version API changes | Medium | Pin version; all Three.js confined to element `initialize()`/`apply()` — version changes are localized |

---

## 10. Open Questions

| # | Question | Owner | Priority |
|---|----------|-------|----------|
| OQ-1 | Should `ISceneElement.compileExtra()` be required to return a serializable value (to support future SceneTrack pre-serialization/caching to disk)? | Engineering | Medium |
| OQ-2 | Should `useVariable()` support a typed variable map via a consumer-defined generic parameter, or is per-call generic casting sufficient? | Website Product | Low |
| OQ-3 | Should `gen-scene-dsl.mjs` be published as a versioned CLI tool or remain a build script? | Website Product | Medium |
| OQ-4 | Should `src/legacy/` be deleted immediately after the new implementation is green, or archived as a tagged git commit? | Engineering | Low |
| OQ-5 | Should Three.js confinement be enforced via ESLint `no-restricted-imports` or a custom import boundary checker? | Engineering | Medium |
| OQ-6 | What is the empirical memory footprint per tick at high quality tier, and what is the practical scene count ceiling? | Engineering | Medium |

---

## 11. Launch Criteria

- [ ] **Widget SDK:** All interfaces, `WidgetRegistry`, `VariableStore`, `useVariable`, `SceneMetaWidget`, `createDefaultWidgetRegistry` implemented with tests.
- [ ] **Generic compiler:** `sceneTrackCompiler.ts` imports zero element-specific modules — verified by CI grep.
- [ ] **Generic runtime:** `RuntimeDriverImpl.apply()` iterates widget registry only — no per-element render calls.
- [ ] **All built-ins as widgets:** `ModelWidget`, `LightingWidget`, `BackgroundWidget`, `EnvironmentWidget`, `FloorWidget`, `SceneMetaWidget` implemented.
- [ ] **`SceneFrame` clean:** No typed element fields — only `widgets`, `annotations`, `labels`. Verified by TypeScript.
- [ ] **Two-tier overlay:** `AnnotationPositioner` direct-DOM pattern implemented and tested. React content updates via `useVariable`/`useSyncExternalStore`.
- [ ] **`ScenePlayer` implemented:** `onSceneChange`, `contentSlots`, `placeholder`, `useSceneProgress`, `useCurrentScene` all functional.
- [ ] **`tsc --noEmit` passes** with zero errors in strict mode.
- [ ] **`pnpm test` passes.** Widget SDK, compiler generics, runtime generics, built-in widgets all covered.
- [ ] **Performance:** 5-scene, 3-widget page achieves 60 FPS on a mid-tier laptop GPU.
- [ ] **`examples/simple/`** demonstrates the complete 9-step consumer journey end-to-end. Zero site-specific references.
- [ ] **Consumer widget example** (`RibbonWidget` or `LogoRotatorWidget`) in `examples/widgets/` demonstrates the extension pattern.
- [ ] **`src/` clean:** Zero references to `robot`, `ribbon`, `brain`, `particle`, `logoRotator`, `local.brewblast.ai`, `#b344ef`, `General Sans`, `MODEL_BONE_NAME_MAP`.

---

## 12. Appendix: Authoritative Type Contracts

### Widget SDK Capability Interfaces
```typescript
interface IWidget { readonly widgetId: string; }

interface ISceneElement<TState, TExtra = void> extends IWidget {
  readonly defaultState: TState;
  readonly transitionSpec: ElementTransitionSpec<TState>;
  readonly DslComponent: React.ComponentType<Partial<TState> & { children?: React.ReactNode }>;
  compileExtra?(state: TState, context: CompileExtraContext): TExtra;
}

interface IRenderable<TState> extends IWidget {
  initialize(context: WidgetInitContext): void;
  apply(state: TState, context: WidgetRenderContext): void;
  dispose(): void;
}

interface ILoadable extends IWidget {
  load(manifest: AssetManifest | null): Promise<void>;
  readonly isLoaded: boolean;
}

interface IContainedModel<TState> extends IRenderable<TState> {
  readonly anchorModelId: string;
  readonly anchorKey: string;
}

interface IAnimationController extends IWidget {
  readonly tickPriority?: number;  // lower = earlier; default 0
  onTick(context: AnimationTickContext): void;
}

interface IVariableProvider extends IWidget {
  readonly variableNamespace: string;
  readonly variableKeys: readonly string[];
}

type AnimationTickContext = {
  deltaSeconds: number;
  wallTimeSeconds: number;
  scene: ThreeScene;
  variables: VariableStore;
  tick: SceneTrackTick | null;  // null before first compilation
};
```

### SceneFrame (Generic)
```typescript
type SceneFrame = {
  id: string;
  scrollProgress: number;
  /** All widget states keyed by widgetId. Type = widget's TState. */
  widgets: Record<string, unknown>;
  annotations?: AnnotationDefinition[];
  annotationDefaults?: Partial<AnnotationDefaults>;
  labels?: LabelDefinition[];
  // isLightScene REMOVED — use SceneDefinition.meta instead
};
```

### SceneTrackTick
```typescript
type SceneTrackTick = {
  index: number;
  progress: number;          // global [0, 1]
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;     // scene-local [0, 1]
  state: SceneFrame;
  deltaForward: SceneFrameDelta;
  deltaBackward: SceneFrameDelta;
  annotationPrimitives?: AnnotationResolved[];
  labelPrimitives?: LabelResolved[];
  widgetExtras?: Record<string, unknown>;  // compileExtra() outputs keyed by widgetId
};

type SceneTrack = {
  ticks: SceneTrackTick[];
  tickStep: number;
  subTickCount: number;
  sceneWindows: SceneWindow[];
  // anchorTargets REMOVED — ModelWidget's internal concern
};

type SceneFrameDelta = {
  widgets?: Record<string, unknown>;
  annotations?: SceneFrame['annotations'];
  annotationDefaults?: SceneFrame['annotationDefaults'];
  labels?: SceneFrame['labels'];
};
```

### SceneDefinition and SceneGroup
```typescript
type SceneDefinition = {
  id: string;
  index: number;
  meta?: Record<string, JsonPrimitive>;  // published by SceneMetaWidget each frame
  entryLead?: number;     // how far before scene boundary entry transitions begin
  entryStart?: number;    // explicit override for entry transition start
  getFrame: (context: SceneFrameContext) => React.ReactNode;
  transitions?: SceneTransition[];
};

type SceneTransition = {
  id: string;
  start: number | ((context: SceneFrameContext) => number);
  end: number | ((context: SceneFrameContext) => number);
  scope?: 'active' | 'persist';
  apply: (state: SceneFrame, context: SceneFrameContext, t: number) => SceneFrame;
};

type SceneGroup = {
  id: string;
  scenes: SceneDefinition[];
  timeline: SceneTimeline;
};
```

### SceneFrameContext
```typescript
type SceneFrameContext = {
  progress: number;
  sceneProgress: number;
  sceneProgressRaw?: number;  // unclamped — may be <0 or >1 during entry/exit
  globalProgress: number;
  sceneStart: number;
  sceneEnd: number;
  assetsReady: boolean;
  timeline: SceneTimeline;
  baseState?: SceneFrame;
  baseStateRaw?: SceneFrame;
  nextState?: SceneFrame;
  variables?: VariableStoreReader;
  viewport?: { width: number; height: number; aspectRatio: number };
};
```

### CompileApi and CompileHelpers
```typescript
type CompileApi = {
  context: SceneFrameContext;
  state: SceneFrame;
  transitions: SceneTransition[];
  pushAnnotation: (a: AnnotationDefinition) => void;
  pushLabel: (l: LabelDefinition) => void;
  setWidgetState: (widgetId: string, state: unknown) => void;  // ONLY write path
  setSceneMeta: (meta: { id?: string; meta?: Record<string, JsonPrimitive> }) => void;
};

type CompileHelpers = {
  compileChildren: (node: React.ReactElement, api: CompileApi) => void;
  resolveValue: <T>(value: T | ((ctx: SceneFrameContext) => T), ctx: SceneFrameContext) => T;
  resolveObjectValues: <T extends Record<string, unknown>>(value: T, ctx: SceneFrameContext) => T;
  stripUndefinedDeep: <T extends Record<string, unknown>>(value: T) => T;
  collectChildren: (node: React.ReactElement) => unknown[];
};
```

### SceneTimeline
```typescript
type SceneTimeline = {
  stops: ReadonlyArray<{ id: string }>;
  sceneCount: number;
  framesPerScene: number;
  subTicksPerSegment: number;
  oversamplingRate: number;   // was sceneAnimationMultiplier
  tickStep: number;
  subTickCount: number;
  tick: (index: number) => number;
  mapToSceneProgress: (progress: number) => number;
  snapToTick: (progress: number) => number;
};
```

### AssetManifest (Version 2)
```typescript
type AssetManifest = {
  version: 2;
  models: ModelMeta[];
  containedModels: ContainedModelMeta[];
  animations: AnimationEntry[];
};

type ModelMeta = {
  id: string; glb: string; bones: string[]; meshes: string[];
  anchorTargets: Record<string, string>;  // consumer-defined key → resolved bone name
};
type ContainedModelMeta = { id: string; glb: string; subparts: string[] };
type AnimationEntry = { id: string; glb: string; clipName: string; duration: number };
```

### ScenePlayerProps
```typescript
type ScenePlayerProps = {
  sceneGroup: SceneGroup;
  manifestUrl: string;
  widgetSetup: (manifest: AssetManifest | null, options?: { onSceneChange?: (sceneId: string, sceneIndex: number) => void }) => WidgetRegistry;
  className?: string;
  scrollHeightPx?: number;         // default: scenes.length × 800
  framesPerScene?: number;          // default: 30
  fpsCap?: number;                  // default: 60
  onReady?: () => void;
  onError?: (error: Error) => void;
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
  contentSlots?: Record<string, ReactNode>;  // for contentId-based annotations
  placeholder?: ReactNode;          // rendered server-side / before engine init
  children?: ReactNode;             // overlay content, pointer-events: none
};
```

### RuntimeDriver (Minimal Interface)
```typescript
type RuntimeDriver = {
  assetsReady: boolean;
  tick(options: { deltaSeconds: number; globalProgress: number; wallTimeSeconds: number }): void;
  setSceneTrack(track: SceneTrack, sampler: SceneTrackSampler): void;
  setAssetsReady(ready: boolean): void;
  getBoneWorldPositions(): Map<string, [number, number, number]>;
};
```
