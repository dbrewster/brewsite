---
title: "BrewFlow Scene Toolkit — Architecture Reference"
doc_type: prd
owner: brewflow-architect
status: active
updated: 2026-02-21
change_history:
  - date: 2026-02-20
    author: brewflow-architect
    summary: "Initial architecture reference document."
  - date: 2026-02-20
    author: brewflow-architect
    summary: "Batch-fill transition model: scenes are discrete snapshots; compiler dispatches enter/exit/interpolate to widgets per transition block. Removes TransitionContext, SceneTransition, entryLead/entryStart, SceneTimeline from compiler interface. Renames sceneProgress → blockProgress on SceneTrackTick. Replaces SceneFrameContext with SceneSnapshotContext."
  - date: 2026-02-21
    author: brewflow-architect
    summary: "Update siteResources format to use type fields instead of id, aligning generator output naming."
---

# BrewFlow Scene Toolkit — Architecture Reference

This document is the authoritative architecture reference for the BrewFlow Scene Toolkit. It describes module structure, layer boundaries, dependency rules, key data types, and runtime behaviour. It is written as a stable description of the system — not as a changelog.

---

## 1. System Philosophy

**Everything is a Widget.** The compiler and runtime have zero knowledge of what any particular scene element represents. They know only how to call registered widgets through a small set of capability interfaces. Built-in elements (model, lighting, background, environment, floor) are first-party Widget implementations. Consumer-defined effects use the identical interfaces. The difference between a built-in and a consumer widget is only whether it is pre-registered by `createDefaultWidgetRegistry()`.

This makes the core engine permanently stable: adding a new visual effect requires writing a Widget class and calling `widgetRegistry.register()`. No files inside `src/` change.

**Declarative scenes, pre-baked playback.** Scene authors write JSX that describes world state at a given scroll position — no animation math, no Three.js, no imperative mutation. The compiler transforms those declarations into a flat, pre-baked `SceneTrack` that the runtime samples in O(1) at playback time.

**Strict layer isolation.** Three.js exists only inside widget `initialize()`, `apply()`, and `dispose()`. The compiler is pure TypeScript testable in Node. The Widget SDK interfaces contain no Three.js types.

---

## 2. Repository Structure

```
src/
├── widget/           Widget SDK: interfaces, registry, variable store
├── compiler/         Generic compiler: DSL → SceneTrack (pure, no Three.js)
├── runtime/          Generic runtime: tick loop, driver
├── elements/         First-party widget implementations
│   ├── model/
│   ├── lighting/
│   ├── background/
│   ├── environment/
│   └── floor/
├── labels/           World-space text labels
├── annotations/      Screen-space HTML/React overlays
├── timeline/         SceneTimeline algebra and math utilities
├── math/             Pure math utilities (Vec3, quaternion, pose)
└── player/           Consumer-facing API (ScenePlayer, hooks, engine)

examples/
├── simple/           Complete consumer demo (9-step journey)
└── widgets/          Consumer widget reference implementations
    ├── ribbon/
    ├── logo-rotator/
    └── brain-model/

scripts/
├── gen-scene-dsl.mjs       Asset pipeline: siteResources.ts → DSL + manifest
├── extract-model-metadata.mjs
└── prune-dist.mjs
```

---

## 3. Layer Architecture and Dependency Rules

Layers are ordered from most-stable (bottom) to most-consumer-facing (top). Dependencies flow downward only.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Consumer Code (pages, routes, custom widgets)                       │
│  Imports: ScenePlayer, createDefaultWidgetRegistry,                  │
│           useVariable, useSceneProgress, useCurrentScene,            │
│           Widget SDK interfaces                                      │
├──────────────────────────────────────────────────────────────────────┤
│  src/player/                                                         │
│  ScenePlayer, useSceneEngine, useEngineScroll, useSceneProgress,     │
│  useCurrentScene, EngineScrollRegion, AnnotationPositioner,          │
│  ContentSlotContext, EngineFrameDriver, createDefaultWidgetRegistry  │
├──────────────────────────────────────────────────────────────────────┤
│  src/widget/                                                         │
│  IWidget, ISceneElement, IRenderable, ILoadable, IDslComposite,      │
│  IContainedModel, IAnimationController, IVariableProvider,           │
│  WidgetRegistry, VariableStore, useVariable                          │
│  ← Pure TypeScript interfaces; no Three.js, no React                │
├──────────────────────────────────────────────────────────────────────┤
│  src/runtime/                          src/compiler/                 │
│  RuntimeDriverImpl, RuntimeLoop        sceneTrackCompiler            │
│  Iterates widget registry each tick    sceneDslCompiler              │
│  Zero element knowledge                sceneTrackSampler             │
│                                        Pure TypeScript, no Three.js  │
├──────────────────────────────────────────────────────────────────────┤
│  src/elements/  (first-party widgets)                                │
│  model / lighting / background / environment / floor                 │
│  Three.js confined to widget initialize() / apply() / dispose()      │
├──────────────────────────────────────────────────────────────────────┤
│  src/timeline/     src/math/           src/annotations/  src/labels/ │
│  Pure utilities — no Three.js, no React, fully Node-testable         │
└──────────────────────────────────────────────────────────────────────┘
```

### Hard Dependency Rules

| Module | May import | Must NOT import |
|--------|-----------|-----------------|
| `src/widget/` | `src/timeline/`, `src/math/` | Three.js, React, compiler, runtime, elements |
| `src/compiler/` | `src/widget/`, `src/timeline/`, `src/math/`, `src/annotations/`, `src/labels/` | Three.js, `src/runtime/`, any specific element type |
| `src/runtime/` | `src/widget/`, `src/compiler/`, `src/timeline/`, `src/math/` | Specific element types |
| `src/elements/*/types.ts` | `src/widget/`, `src/timeline/`, `src/math/` | Three.js, React, compiler |
| `src/elements/*/compile.ts` | `src/widget/`, `src/elements/*/types.ts`, `src/timeline/` | Three.js, React |
| `src/elements/*/dsl.tsx` | `src/widget/`, `src/elements/*/types.ts` | Three.js, compiler internals |
| `src/elements/*/render.ts` | Three.js, `src/elements/*/types.ts` | React, compiler |
| `src/elements/*/*Widget.ts` | all of the above within its element directory | Other elements |
| `src/player/` | all layers | — |

Within `src/elements/`, each element is a vertical slice. Elements must not import from other elements.

---

## 4. The Widget SDK

### 4.1 Capability Interfaces

A widget is any object implementing one or more capability interfaces. No base class is required. The combination of interfaces determines how the engine interacts with the widget.

**File:** `src/widget/types.ts`

```typescript
/** Every widget must have a stable unique string ID. */
interface IWidget {
  readonly widgetId: string;
}

/**
 * The widget participates in scene compilation and interpolation.
 * TState must be a plain serializable object — no Three.js, no functions.
 * TExtra is compile-time output stored in SceneTrackTick.widgetExtras[widgetId].
 */
interface ISceneElement<TState, TExtra = void> extends IWidget {
  readonly defaultState: TState;
  readonly transitionSpec: ElementTransitionSpec<TState>;
  readonly DslComponent: React.ComponentType<Partial<TState> & { children?: React.ReactNode }>;
  compileExtra?(state: TState, context: CompileExtraContext): TExtra;
}

/**
 * Pattern A containment: child DSL components contribute sub-state to
 * this widget's TState. They have no independent widgetId and are not
 * authored at the scene top level.
 */
interface IDslComposite extends IWidget {
  readonly childDslComponents: ReadonlyArray<{
    component: React.ComponentType<unknown>;
    displayName: string;
    topLevelError?: boolean;
  }>;
}

/** The widget loads async assets (GLBs, HDRIs). */
interface ILoadable extends IWidget {
  load(manifest: AssetManifest | null): Promise<void>;
  readonly isLoaded: boolean;
}

/** The widget has a Three.js representation, updated every frame. */
interface IRenderable<TState> extends IWidget {
  initialize(context: WidgetInitContext): void;
  apply(state: TState, context: WidgetRenderContext): void;
  dispose(): void;
}

/**
 * Pattern B runtime attachment: a full registered widget that attaches to
 * a named anchor bone on a primary model. Anchor declared at construction.
 * Authored at the scene top level as a sibling of the primary model.
 */
interface IContainedModel<TState> extends IRenderable<TState> {
  readonly anchorModelId: string;
  readonly anchorKey: string;
}

/**
 * Runs a tick every frame, independent of scene state.
 * Controllers are ticked before renderers in ascending tickPriority order.
 * Receives write access to VariableStore and the current SceneTrackTick.
 */
interface IAnimationController extends IWidget {
  readonly tickPriority?: number; // lower = earlier; default 0
  onTick(context: AnimationTickContext): void;
}

/** Declares variables this widget publishes to the VariableStore. */
interface IVariableProvider extends IWidget {
  readonly variableNamespace: string;
  readonly variableKeys: readonly string[];
}
```

### 4.2 Context Types

```typescript
/** Passed to ISceneElement.compileExtra(). */
type CompileExtraContext = {
  sceneProgress: number;
  globalProgress: number;
  clipMeta: ClipMeta[];
  prefersReducedMotion: boolean;
};

/** Passed to IRenderable.initialize(). */
type WidgetInitContext = {
  scene: THREE.Scene;
  widgetId: string;
};

/** Passed to IRenderable.apply(). */
type WidgetRenderContext = {
  deltaSeconds: number;
  globalProgress: number;
  wallTimeSeconds: number;
  variables: VariableStoreReader;
  extra: unknown; // cast to TExtra as defined by the widget's compileExtra()
};

/** Passed to IAnimationController.onTick(). */
type AnimationTickContext = {
  deltaSeconds: number;
  wallTimeSeconds: number;
  scene: THREE.Scene;
  variables: VariableStore;      // write access
  tick: SceneTrackTick | null;   // null before first compilation
};
```

### 4.3 The Two Containment Patterns

These patterns look similar but have fundamentally different semantics.

**Pattern A — DSL Composition (`IDslComposite`):**
Children contribute sub-state to the parent widget's `TState`. They have no independent `widgetId`, no state in `SceneFrame.widgets`, and no lifetime outside their parent's DSL context. Authored *inside* the parent component in scene files.

```tsx
// Pattern A: Ambient, Spot build up the LightingWidget's SceneLighting state
<Lighting>
  <Ambient intensity={2.6} color="#ffffff" />
  <Spot intensity={2.2} color="#aabbff" position={[2, 4, 3]} />
</Lighting>
```

**Pattern B — Runtime Attachment (`IContainedModel`):**
The child is a full registered widget with its own `widgetId` in `SceneFrame.widgets`. The anchor relationship is declared at construction, not in the DSL. Authored at the *top level* of the scene as a sibling of the primary model.

```tsx
// Pattern B: Brain is an independent widget that attaches to the 'head' bone at runtime
<Scene>
  <Model id="primary" scale={0.2} />
  <Brain opacity={0.8}>
    {/* Subpart is Pattern A relative to Brain */}
    <Subpart id="frontal_lobe" opacity={1.0} />
  </Brain>
</Scene>
```

A widget may implement both patterns simultaneously. `BrainModelWidget` is Pattern B relative to the primary model (`anchorModelId: 'primary'`, `anchorKey: 'head'`) and Pattern A for its `<Subpart>` children.

### 4.4 WidgetRegistry

**File:** `src/widget/WidgetRegistry.ts`

`WidgetRegistry` is a fluent registry with a `register(widget): this` method that:

1. Stores the widget by `widgetId`. Logs a warning on duplicate ID.
2. For `ISceneElement` widgets, installs a routing DSL node handler keyed on `widget.DslComponent`. When multiple widgets share the same DSL component (e.g., two `ModelWidget` instances sharing `<Model>`), the router dispatches by the `id` prop. Widgets with complex DSL register a custom handler via the `CUSTOM_NODE_HANDLER` symbol on themselves; this takes precedence over the default prop-merge handler.
3. For `IDslComposite` widgets, registers protective top-level handlers for all declared child components — error-throwing when `topLevelError: true`, noop otherwise.

Key methods:
```typescript
class WidgetRegistry {
  register(widget: IWidget): this
  get(id: string): IWidget | undefined
  getAll(): IWidget[]
  getSceneElements(): Array<ISceneElement<unknown>>
  getRenderables(): Array<IRenderable<unknown>>
  getLoadables(): ILoadable[]
  getAnimationControllers(): IAnimationController[]  // sorted by tickPriority ascending
  getContainedModels(): Array<IContainedModel<unknown>>
  buildCacheKey(): string  // stable string for SceneTrack cache invalidation
}
```

`buildCacheKey()` produces a sorted, joined string of all widget IDs and their compilation-relevant configuration (for `ModelWidget`: sorted clip names and durations; for other widgets: widgetId only).

### 4.5 VariableStore

**File:** `src/widget/VariableStore.ts`

A `namespace/key → JsonPrimitive` store. Animation controllers write to it in `onTick()`; React components read from it via `useVariable()`. `set()` does not call `notify()` when the value is unchanged — preventing spurious React re-renders on every tick for stable values.

```typescript
class VariableStore {
  set(namespace: string, key: string, value: JsonPrimitive): void
  get(namespace: string, key: string): JsonPrimitive | undefined
  getNamespace(namespace: string): Readonly<Record<string, JsonPrimitive>>
  subscribe(key: string, listener: () => void): () => void  // returns unsubscribe
}
```

### 4.6 useVariable

**File:** `src/widget/useVariable.ts`

```typescript
export const useVariable = <T extends JsonPrimitive>(
  namespace: string,
  key: string,
): T | undefined
```

Reads from `VariableStore` using `useSyncExternalStore`. Re-renders only when the specific `namespace.key` value changes. Throws a clear error if used outside `<ScenePlayer>`.

---

## 5. Core Data Types

### 5.1 SceneFrame

**File:** `src/compiler/sceneTrackTypes.ts`

The resolved state for a single point in the compiled track. All element states live in `widgets`.

```typescript
type SceneFrame = {
  id: string;
  scrollProgress: number;
  widgets: Record<string, unknown>; // keyed by widgetId; type = widget's TState
  annotations?: AnnotationDefinition[];
  annotationDefaults?: Partial<AnnotationDefaults>;
  labels?: LabelDefinition[];
};
```

### 5.2 SceneTrackTick

```typescript
type SceneTrackTick = {
  index: number;
  progress: number;         // global [0, 1]
  sceneId: string;          // id of scene N (the "from" scene for this transition block)
  sceneIndex: number;       // index of scene N
  blockProgress: number;    // [0, 1] within this transition block
                            //   0 = widget is at scene N's authored state
                            //   1 = widget is at scene N+1's authored state
  state: SceneFrame;
  deltaForward: SceneFrameDelta;   // what changed relative to tick[index+1]
  deltaBackward: SceneFrameDelta;  // what changed relative to tick[index-1]
  annotationPrimitives?: AnnotationResolved[];
  labelPrimitives?: LabelResolved[];
  widgetExtras?: Record<string, unknown>; // compileExtra() outputs, keyed by widgetId
};

type SceneFrameDelta = {
  widgets?: Record<string, unknown>;
  annotations?: SceneFrame['annotations'];
  annotationDefaults?: SceneFrame['annotationDefaults'];
  labels?: SceneFrame['labels'];
};
```

### 5.3 SceneTrack

```typescript
type SceneTrack = {
  ticks: SceneTrackTick[];
  tickStep: number;
  subTickCount: number;
  sceneWindows: SceneWindow[];
};

type SceneWindow = {
  id: string;
  index: number;
  start: number;  // normalized [0, 1] progress of this block's first frame
  end: number;    // normalized [0, 1] progress of this block's last frame (inclusive)
};
```

### 5.4 SceneDefinition and SceneGroup

**File:** `src/compiler/sceneTypes.ts`

```typescript
type SceneDefinition = {
  id: string;
  index: number;
  meta?: Record<string, JsonPrimitive>; // published to VariableStore by SceneMetaWidget
  getFrame: (context: SceneSnapshotContext) => React.ReactNode | SceneFrame;
};

type SceneGroup = {
  id: string;
  scenes: SceneDefinition[];
};
```

Scenes are discrete state snapshots. There are no `SceneTransition` objects, no `entryLead`, and no `entryStart`. The space between adjacent scenes is entirely owned by the widget's `transitionSpec` methods.

### 5.5 SceneSnapshotContext

Passed to `SceneDefinition.getFrame()` during compilation. Scenes are evaluated exactly once per compilation — there is no `sceneProgress` variation within a scene.

```typescript
type SceneSnapshotContext = {
  /** 0-based index of this scene in the scene array. */
  sceneIndex: number;
  /** Total number of scenes. */
  numScenes: number;
  /** Whether model/texture assets have finished loading. */
  assetsReady: boolean;
  /** Runtime variable store — for variable-driven DSL content. */
  variables?: VariableStoreReader;
  /** Viewport dimensions — for viewport-responsive DSL layout. */
  viewport?: { width: number; height: number; aspectRatio: number };
};
```

### 5.6 SceneTimeline

**File:** `src/timeline/index.ts`

`SceneTimeline` is used by the player layer (`src/player/`) for scroll-progress algebra — mapping scroll position to global progress, snapping to tick boundaries, and reporting scene count. It is **not passed to the compiler**. The compiler accepts `blockSize: number` directly.

```typescript
type SceneTimeline = {
  stops: ReadonlyArray<{ id: string }>;
  sceneCount: number;
  tickStep: number;
  subTickCount: number;
  snapToTick: (progress: number) => number;
};
```

Factory: `createSceneTimeline(scenes, options?)` remains in `src/timeline/` for player use.

### 5.7 AssetManifest

**File:** `src/elements/model/metadata.ts`

```typescript
type AssetManifest = {
  version: 2;
  models: ModelMeta[];
  containedModels: ContainedModelMeta[];
  animations: AnimationEntry[];
};

type ModelMeta = {
  id: string;
  glb: string;
  bones: string[];
  meshes: string[];
  anchorTargets: Record<string, string>; // consumer-defined key → resolved bone name
};

type ContainedModelMeta = { id: string; glb: string; subparts: string[] };
type AnimationEntry = { id: string; glb: string; clipName: string; duration: number };
```

---

## 6. The Compiler Pipeline

**File:** `src/compiler/sceneTrackCompiler.ts`

The compiler is a pure function. No Three.js. No browser APIs. Fully Node-testable.

```typescript
type CompileSceneTrackOptions = {
  scenes: SceneDefinition[];
  widgetRegistry: WidgetRegistry;
  /**
   * Number of frames per transition block.
   * totalFrames = (numScenes - 1) * blockSize + 1
   * Provided by the player layer from its scroll configuration.
   */
  blockSize: number;
  clipMeta?: ClipMeta[];
  prefersReducedMotion?: boolean;
};

const compileSceneTrack = (options: CompileSceneTrackOptions): SceneTrack
```

### 6.1 Compiler Algorithm

The compiler operates in two steps. Think of it as the index-card animation trick: draw a card for each pose, then fill in all the cards between poses — each widget draws its own in-between cards.

**Step 1 — Scene Snapshot Evaluation:**
Each scene's `getFrame(context)` is called exactly once with a `SceneSnapshotContext`. The result is a `SceneFrame` snapshot: a map of `widgetId → authored state` for widgets explicitly present in that scene. Widgets absent from a scene are absent from its snapshot — there is no inheritance from prior scenes.

**Step 2 — Transition Block Baking:**
The flat frame array has `(numScenes - 1) * blockSize + 1` entries. For each adjacent pair of scenes (N, N+1), the compiler allocates a contiguous block of `blockSize` frames and inspects `snapshot[N]` and `snapshot[N+1]` for each registered widget:

- **Present in both** → `widget.transitionSpec.interpolate(fullBlock, widgetId, fromState, toState)` fills all `blockSize` frames.
- **Present in N only** → `widget.transitionSpec.exit(firstHalf, widgetId, fromState)` fills the first `blockSize/2` frames; `defaultState` fills the remainder.
- **Present in N+1 only** → `defaultState` fills the first `blockSize/2` frames; `widget.transitionSpec.enter(secondHalf, widgetId, toState)` fills the rest.
- **Present in neither** → `widget.defaultState` fills all frames in the block.

The terminal frame (`+1`) holds the last scene's snapshot directly — no outbound transition.

After all blocks are filled:
- `compileExtra()` is called per-frame for widgets that implement it.
- `annotationPrimitives` and `labelPrimitives` are compiled per-frame.
- `deltaForward` / `deltaBackward` are computed via `JSON.stringify` structural equality.

**The compiler imports zero element-specific modules.** It does not reference `SceneLighting`, `SceneModel`, `compileAnimation`, or any concrete element type.

### 6.2 CompileApi

The sole interface through which DSL node handlers write scene state during snapshot evaluation.

```typescript
type CompileApi = {
  context: SceneSnapshotContext;
  state: SceneFrame;
  pushAnnotation: (a: AnnotationDefinition) => void;
  pushLabel: (l: LabelDefinition) => void;
  setWidgetState: (widgetId: string, state: unknown) => void; // only write path
  setSceneMeta: (meta: { id?: string; meta?: Record<string, JsonPrimitive> }) => void;
};
```

### 6.3 DSL Node Handler Registration

Each widget registers its DSL node handler in its constructor via the `CUSTOM_NODE_HANDLER` symbol or defers to `WidgetRegistry`'s default prop-merge handler. There are no module-level side-effect registrations. All registration occurs through `WidgetRegistry.register()`.

**`<Scene>` root handler** (built into the compiler, not a widget):
Recursively delegates child processing to `compileChildren`. Non-primitive JSX components (those not in the `nodeRegistry`) are called as functions and their output expanded — allowing consumer-defined compound components in scene files.

### 6.4 ElementTransitionSpec

Each `ISceneElement` widget provides a transition spec that **batch-fills** a pre-allocated slice of the `SceneTrackTick` array. The compiler calls exactly one method per widget per transition block, passing the appropriate frame slice and the widget's authored states at the scene endpoints. The widget writes `frames[i].state.widgets[widgetId]` for every frame in the slice.

```typescript
type ElementTransitionSpec<T> = {
  /**
   * Widget is leaving (present in scene N, absent from scene N+1).
   * frames = first half of the transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   */
  exit(frames: SceneTrackTick[], widgetId: string, fromState: T): void;

  /**
   * Widget is arriving (absent from scene N, present in scene N+1).
   * frames = second half of the transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   */
  enter(frames: SceneTrackTick[], widgetId: string, toState: T): void;

  /**
   * Widget is present in both scenes.
   * frames = the full transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   */
  interpolate(frames: SceneTrackTick[], widgetId: string, fromState: T, toState: T): void;
};
```

The normalized progress scalar for frame `i` within a slice of length `len`:
```typescript
const transitionT = (i: number, len: number): number => len > 1 ? i / (len - 1) : 1;
```
`transitionT` is exported from `src/compiler/transitions/transitionTypes.ts` alongside the blend helpers: `blendNumber`, `blendVec3`, `blendColor`, `blendOpacity`, `blendAxisRotation`, `blendAxisTranslation`, `blendStyleValues`.

### 6.5 SceneTrackCache

**File:** `src/compiler/sceneTrackCache.ts`

Module-level singleton `Map<string, CacheEntry>`. A track is reused when all of the following are identical: scene IDs and order, `blockSize`, widget registry cache key (from `buildCacheKey()`), and `prefersReducedMotion`. Cache entries are replaced on key collision. Multiple `ScenePlayer` instances share the cache and benefit from shared compilation results.

`clearCache()` is exported for test isolation — each test that compiles a scene track calls it in `beforeEach`.

### 6.6 SceneTrackSampler

**File:** `src/compiler/sceneTrackSampler.ts`

O(1) lookup: `sample(progress) = ticks[Math.round(progress / tickStep + eps)]`. Used at playback time; never in the compiler itself.

---

## 7. Runtime

### 7.1 Frame Tick Sequence

Every RAF frame, `RuntimeLoop.step()` executes synchronously:

```
Step 1  RuntimeDriverImpl.tick(deltaSeconds, globalProgress, wallTimeSeconds)
        ├─ IAnimationController.onTick() for each controller in tickPriority order
        │   └─ variableStore.set() fires listeners synchronously
        │       └─ useSyncExternalStore schedules React flush
        └─ IRenderable.apply() for each renderable
            └─ reads variableStore.get() directly — zero lag

Step 2  THREE.WebGLRenderer.render(scene, camera)

Step 3  AnnotationPositioner.update(annotations, labels, camera, bonePositions)
        → Reads bone worldMatrix (final after Step 2)
        → Sets element.style.transform on DOM nodes directly — NO React

[RAF callback ends]

Step 4  React synchronous flush (triggered by Step 1 VariableStore notifications)
        → Components using useVariable() re-render with new values

Step 5  Browser paint: Three.js canvas + DOM changes in one visual frame
```

**Key guarantees:**
- Widget renderers read `VariableStore` values with zero lag (Steps 1 and 3 are within the same RAF callback).
- Annotation positions update with zero lag via direct DOM mutation (Step 3).
- Annotation content updates with at most one-frame lag via React (Step 4) — invisible in practice as the browser merges Steps 2–4 into one paint.

### 7.2 RuntimeDriverImpl

**File:** `src/runtime/RuntimeDriver.ts`

`RuntimeDriverImpl` holds the `WidgetRegistry`, `VariableStore`, and `THREE.Scene`. It implements the minimal `RuntimeDriver` interface consumed by `RuntimeLoop` and `SceneCompiler`:

```typescript
type RuntimeDriver = {
  assetsReady: boolean;
  tick(options: { deltaSeconds: number; globalProgress: number; wallTimeSeconds: number }): void;
  setSceneTrack(track: SceneTrack, sampler: SceneTrackSampler): void;
  setAssetsReady(ready: boolean): void;
  getBoneWorldPositions(): Map<string, [number, number, number]>;
};
```

### 7.3 Initialization Sequence

```typescript
async initialize(config: RuntimeConfig): Promise<void> {
  // 1. Create THREE.Scene, THREE.PerspectiveCamera, THREE.WebGLRenderer
  this.setupThreeScene();

  // 2. Initialize all IRenderable widgets (sync — creates placeholder Three.js objects)
  for (const renderable of widgetRegistry.getRenderables()) {
    renderable.initialize({ scene: this.threeScene, widgetId: renderable.widgetId });
  }

  // 3. Attach IContainedModel widgets to their anchor bones
  this.resolveContainedModelAnchors();

  // 4. Load all async assets in parallel
  await Promise.all(widgetRegistry.getLoadables().map((w) => w.load(manifest)));

  // 5. Trigger recompile with assetsReady = true
  this.assetsReady = true;
  this.recompile();
}
```

### 7.4 IContainedModel Anchor Resolution

After all `ILoadable` widgets complete:
```
for each IContainedModel widget:
  primaryWidget = registry.get(containedModel.anchorModelId) as ModelWidget
  anchorBoneName = primaryWidget.getAnchorBoneName(containedModel.anchorKey)
  anchorNode = primaryWidget.renderer.findNodeByName(anchorBoneName)
  if anchorNode: anchorNode.add(containedModel.threeGroup)
  else: console.warn(...)
```

The Three.js parent-child relationship means the contained model's group automatically follows the anchor bone's world transform every frame.

### 7.5 Three.js Scene Ownership

1. `EngineScrollRegion` creates and owns the HTML `<canvas>`.
2. `useSceneEngine` creates and owns the `THREE.WebGLRenderer`, passing the canvas.
3. `RuntimeDriver` creates and owns the `THREE.Scene` and `THREE.PerspectiveCamera`.
4. `RuntimeDriver.initialize()` calls `widget.initialize({ scene })` for all `IRenderable` widgets — widgets add their objects to the scene.
5. On unmount: `RuntimeDriver.dispose()` calls `widget.dispose()` for all renderables, then disposes the renderer.

---

## 8. Built-in Widgets

**File pattern:** `src/elements/{name}/{Name}Widget.ts`

Each built-in widget wraps the logic from its element module's `types.ts`, `compile.ts`, `dsl.tsx`, and `render.ts` files into the Widget SDK interfaces. No logic is rewritten — only composed.

| Widget | Interfaces | Notes |
|--------|-----------|-------|
| `ModelWidget` | `ISceneElement<SceneModelInstanceState, CompiledAnimation>` + `IRenderable` + `ILoadable` + `IDslComposite` | `widgetId` = model's `id` from manifest. `compileExtra()` calls `compileAnimation()`. |
| `LightingWidget` | `ISceneElement<SceneLighting>` + `IRenderable` + `IDslComposite` | Child DSL: `Ambient`, `Directional`, `Spot`, `Point`, `Panel` |
| `BackgroundWidget` | `ISceneElement<SceneBackground>` + `IRenderable` | |
| `EnvironmentWidget` | `ISceneElement<SceneEnvironment>` + `IRenderable` + `ILoadable` | Async HDRI load |
| `FloorWidget` | `ISceneElement<SceneFloor>` + `IRenderable` | |
| `SceneMetaWidget` | `IAnimationController` | `tickPriority: -1000`. Publishes `scene.id`, `scene.index`, `scene.progress` to `VariableStore`. Fires `onSceneChange` on boundary crossings. |

### ModelWidget.compileExtra()

The only built-in widget implementing `compileExtra()`. Called by the compiler generically — the compiler has no knowledge of what `compileAnimation()` does.

```typescript
compileExtra(state: SceneModelInstanceState, ctx: CompileExtraContext): CompiledAnimation {
  return compileAnimation(state.playback.animation, this.config.clipMeta, ctx.prefersReducedMotion);
}
```

The result is stored in `tick.widgetExtras['primary']` (or whatever the model's `widgetId` is). The `ModelWidget.apply()` implementation casts `ctx.extra as CompiledAnimation`.

### createDefaultWidgetRegistry

**File:** `src/player/defaultWidgets.ts`

```typescript
export const createDefaultWidgetRegistry = (
  manifest: AssetManifest | null,
  options?: { onSceneChange?: (sceneId: string, sceneIndex: number) => void },
): WidgetRegistry
```

Reads model IDs directly from `manifest.models[]` — one `ModelWidget` per model entry. Consumers do not declare model IDs separately. Chains `LightingWidget`, `BackgroundWidget`, `EnvironmentWidget`, `FloorWidget`, and `SceneMetaWidget`. Returns a `WidgetRegistry` the consumer can chain `.register()` on.

---

## 9. The Overlay Architecture

Annotations and labels have two completely separate update pathways, running at different rates and through different mechanisms.

### Tier 1 — Positions (every frame, no React)

```
Source:  THREE.Object3D.matrixWorld (computed by THREE.WebGLRenderer)
Path:    Three.js → computeScreenPosition() → element.style.transform
Timing:  After renderer.render() in every RAF frame
React:   Never involved
```

`AnnotationPositioner` maintains a `Map<id, HTMLElement>` populated by React annotation components via `registerElement(id, el)` on mount/unmount. Every frame it iterates the map and sets `element.style.transform` directly. Annotation positions must never go through React state — doing so would cause one-frame lag at 60 FPS, visibly wrong.

### Tier 2 — Content (when content changes, via React)

```
Source:  VariableStore, annotationPrimitives, labelPrimitives
Path:    variableStore.set() → notify() → useSyncExternalStore → React re-render
Timing:  Only when content actually changes (text, color, visibility)
React:   Manages this entirely via useSyncExternalStore
```

### AnnotationPlacement

```typescript
type AnnotationPlacement =
  | {
      mode: 'fixed';
      reference: { x: 'left' | 'center' | 'right'; y: 'top' | 'middle' | 'bottom' };
      offset: { xPct: number; yPct: number };
    }
  | {
      mode: 'follow';
      targetPartId: string;           // bone or subpart node name
      targetOffset?: [number, number, number];
      screenOffset?: { xPct: number; yPct: number };
    };
```

### ContentSlotContext

**File:** `src/player/ContentSlotContext.ts`

Annotations may reference external React content by ID: `content: { contentId: 'hero-overlay' }`. The consumer provides slot content via `ScenePlayer.contentSlots`. The annotation renderer reads from `ContentSlotContext` via `useContentSlot(contentId)`.

---

## 10. ScenePlayer

**File:** `src/player/ScenePlayer.tsx`

The top-level consumer component. Manages manifest fetching, widget registry lifecycle, `VariableStore`, `AnnotationPositioner`, and overlay contexts.

```typescript
type ScenePlayerProps = {
  sceneGroup: SceneGroup;
  manifestUrl: string;
  widgetSetup: (manifest: AssetManifest | null) => WidgetRegistry;
  className?: string;
  scrollHeightPx?: number;        // default: scenes.length × 800
  framesPerScene?: number;         // default: 30
  fpsCap?: number;                 // default: 60
  onReady?: () => void;
  onError?: (error: Error) => void;
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
  contentSlots?: Record<string, ReactNode>;
  placeholder?: ReactNode;         // rendered server-side and before engine init
  children?: ReactNode;            // overlay content, pointer-events: none
};
```

`ScenePlayer` provides these React contexts to all descendants:
- `VariableStoreContext` — for `useVariable()`
- `AnnotationPositionerContext` — for annotation DOM registration
- `ContentSlotContext` — for `contentId`-based annotation content

### Consumer Hooks

**`useVariable<T>(namespace, key): T | undefined`** — reads from `VariableStore` via `useSyncExternalStore`.

**`useSceneProgress(): number`** — current global scroll progress `[0, 1]`. Backed by `VariableStore` key `scene.progress` written by `SceneMetaWidget`.

**`useCurrentScene(): { id: string; index: number }`** — current scene identity. Backed by `scene.id` and `scene.index` from `SceneMetaWidget`.

### useSceneEngine

**File:** `src/player/useSceneEngine.ts`

Manages the full engine lifecycle internally: `SceneCompiler` (recompiles on registry or asset changes), `RuntimeDriverImpl`, `RuntimeLoop`, `EngineFrameDriver` (frame-change detection for efficient React state updates — notifies React only when the tick index changes, not every RAF frame). All callbacks stored in refs to prevent loop restarts on re-renders.

```typescript
type UseSceneEngineOptions = {
  sceneGroup: SceneGroup;
  widgetRegistry: WidgetRegistry;
  clipMeta: ClipMeta[];
  fpsCap?: number;
  pixelsPerScene?: number;
  onReady?: () => void;
};

type UseSceneEngineResult = {
  frameState: EngineFrameState;
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  scrollRegionHeightPx: number;
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
  variableStore: VariableStore;
};
```

---

## 11. Asset Pipeline

**Script:** `scripts/gen-scene-dsl.mjs`

Single GLB-reading pass that accepts a `siteResources.ts` file and produces:
1. `siteResources.generated.ts` — union types for all asset identifiers, typed DSL component wrappers.
2. `scene-manifest.json` (with `--manifest-out`) — version-2 `AssetManifest` JSON.

**`siteResources.ts` format:**
```typescript
export const siteResources = {
  models: [
    { type: 'Robot', role: 'primary' as const,
      path: '/assets/robot.glb', anchorKeys: ['head', 'chest'] },
  ],
  containedModels: [
    { type: 'Brain', path: '/assets/brain.glb' },
  ],
  animations: [
    { type: 'ChatRelaxF', path: '/assets/motion/chat-relax-f.glb' },
  ],
} as const;
```

**Anchor key resolution heuristic** (for each `anchorKey` in `model.anchorKeys[]`):
1. Exact match (case-insensitive)
2. Suffix match: `node.name.toLowerCase().endsWith(':' + key.toLowerCase())`
3. Contains match: name includes key, is a bone, does not contain 'end'
4. If no match: `console.warn`, store the key itself as the value

**`animationTrackMapping.ts`** (`src/elements/model/animationTrackMapping.ts`): pure utilities for resolving GLTF animation track names to scene graph node names. `mapTrackTargetName` is a passthrough — bone names in GLTF files are already in their native format when loaded via `GLTFLoader`.

---

## 12. SSR Safety Contract

**Compiler, timeline, math** (`src/compiler/`, `src/timeline/`, `src/math/`): fully SSR-safe. No browser APIs, no Three.js. Can run in Node for pre-compilation and testing.

**Renderable widgets** (`src/elements/*/`, `examples/widgets/*/`): NOT SSR-safe. `initialize()` uses Three.js and DOM APIs. Widget class definitions must not reference Three.js at module import time — imports must be inside `initialize()` or dynamic. The engine never calls `initialize()` when `typeof window === 'undefined'`.

**`ScenePlayer`**: returns `placeholder ?? null` server-side. All engine lifecycle hooks (`useEffect`, RAF) are client-only.

---

## 13. Testing Philosophy

Tests live in `__tests__/` directories co-located with the code they test, named `*.test.ts` / `*.test.tsx`. All tests run with Vitest in Node environment — no DOM or WebGL required for compiler and Widget SDK tests.

**Interface-based stateful tests** — test at module boundaries through public APIs, asserting on observable outputs. For compile functions (pure): pass real inputs, assert on real outputs. For runtime modules: use interface-conforming test doubles from `src/runtime/mocks/`, not spy-based mocks of internals.

**The guiding question for every test:** *Am I testing the contract this module promises, or am I testing how it is implemented?* Only the former is valid.

**Coverage targets** (`vite.config.ts`):
```typescript
include: [
  'src/{compiler,runtime,elements,widget,labels,annotations,timeline,math,player}/**/*.ts',
],
exclude: [
  'src/**/render.ts',   // Three.js render files
  'src/**/*.test.ts',
  'src/**/index.ts',    // barrel exports
  'src/**/mocks/**',
],
```

### Test Patterns

**Testing a transition spec (extract helpers, test as pure functions):**
```typescript
// Pull out the internal helper that computes a single blended state at t.
// Call it directly — no frame array needed for unit tests.
const result = applyLightingInterpolate(fromState, toState, 0.5);
expect(result.ambient.intensity).toBeCloseTo(1.0);
```

**Testing the batch-fill methods end-to-end:**
```typescript
const frames = Array.from({ length: 10 }, (_, i) => makeTick(i));
widget.transitionSpec.interpolate(frames, 'lighting', fromState, toState);
expect(frames[0].state.widgets['lighting']).toEqual(fromState);
expect(frames[9].state.widgets['lighting']).toEqual(toState);
```

**Testing the compiler with a mock widget:**
```typescript
const registry = new WidgetRegistry();
registry.register(createMockSceneElementWidget('fog', { density: 0 }));
const track = compileSceneTrack({ scenes, blockSize: 4, widgetRegistry: registry });
// totalFrames = (2 scenes - 1) * 4 + 1 = 5
expect(track.ticks.length).toBe(5);
expect(track.ticks[0].state.widgets['fog']).toEqual({ density: 0 });
```

**Testing VariableStore:**
```typescript
const store = new VariableStore();
const listener = vi.fn();
store.subscribe('ns.key', listener);
store.set('ns', 'key', 42);
expect(listener).toHaveBeenCalledTimes(1);
store.set('ns', 'key', 42); // same value — no notification
expect(listener).toHaveBeenCalledTimes(1);
```

**Mock doubles** (`src/runtime/mocks/`):
- `MockWidgetRegistry` — empty registry for isolated runtime tests
- `createMockRenderable(id)` — records `apply()` calls for assertion
- `createMockAnimationController(id)` — records `onTick()` calls

---

## 14. Consumer Extensibility

Adding a new scene element:

```typescript
// 1. Define state type
type FogState = { enabled: boolean; color: string; near: number; far: number };

// 2. Create the widget class
export class FogWidget implements ISceneElement<FogState>, IRenderable<FogState> {
  readonly widgetId = 'fog';
  readonly defaultState: FogState = { enabled: false, color: '#ffffff', near: 10, far: 100 };
  readonly transitionSpec: ElementTransitionSpec<FogState> = {
    exit(frames, widgetId, from) {
      for (let i = 0; i < frames.length; i++) {
        const t = transitionT(i, frames.length);
        frames[i].state.widgets[widgetId] = { ...from, enabled: t < 1 };
      }
    },
    enter(frames, widgetId, to) {
      for (let i = 0; i < frames.length; i++) {
        const t = transitionT(i, frames.length);
        frames[i].state.widgets[widgetId] = { ...to, enabled: t > 0 };
      }
    },
    interpolate(frames, widgetId, from, to) {
      for (let i = 0; i < frames.length; i++) {
        const t = transitionT(i, frames.length);
        frames[i].state.widgets[widgetId] = {
          enabled: from.enabled || to.enabled,
          color:   blendColor(from.color, to.color, t) ?? to.color,
          near:    lerp(from.near,  to.near,  t),
          far:     lerp(from.far,   to.far,   t),
        };
      }
    },
  };
  readonly DslComponent = FogDsl;

  initialize({ scene }: WidgetInitContext): void { /* create THREE.Fog */ }
  apply(state: FogState, _ctx: WidgetRenderContext): void { /* update fog */ }
  dispose(): void { /* cleanup */ }
}

// 3. Register
createDefaultWidgetRegistry(manifest).register(new FogWidget())
```

Zero changes to any file in `src/`. The compiler, runtime, and `ScenePlayer` handle it automatically.

Adding a variable-publishing animation controller:

```typescript
export class ClockWidget implements IAnimationController, IVariableProvider {
  readonly widgetId = 'clock';
  readonly variableNamespace = 'clock';
  readonly variableKeys = ['seconds', 'formatted'] as const;
  readonly tickPriority = 0;

  onTick({ wallTimeSeconds, variables }: AnimationTickContext): void {
    const s = Math.floor(wallTimeSeconds);
    variables.set('clock', 'seconds', s % 60);
    variables.set('clock', 'formatted', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  }
}

// Consumer React component — zero wiring required
const Clock = () => {
  const formatted = useVariable<string>('clock', 'formatted');
  return <div>{formatted}</div>;
};
```

---

## 15. Consumer Widget Examples

Site-specific effects are implemented in `examples/widgets/` as canonical reference implementations demonstrating each Widget SDK interface combination.

| Example | Location | Interfaces |
|---------|----------|-----------|
| `RibbonWidget` | `examples/widgets/ribbon/` | `ISceneElement<RibbonConfig>` + `IRenderable` |
| `LogoRotatorWidget` | `examples/widgets/logo-rotator/` | `IAnimationController` + `IVariableProvider` |
| `BrainModelWidget` | `examples/widgets/brain-model/` | `ISceneElement<BrainState>` + `IContainedModel` + `ILoadable` + `IDslComposite` |

`BrainModelWidget` is the canonical reference for simultaneous Pattern A and Pattern B containment.

---

## 16. Build Commands

```bash
pnpm install          # install dependencies
pnpm dev              # Vite dev server (port 5173)
pnpm build            # metadata extract → tsc → vite build → prune dist
pnpm preview          # serve production build locally
pnpm typecheck        # tsc --noEmit
pnpm test             # run Vitest suite once
pnpm test:watch       # Vitest in watch mode
pnpm coverage         # test coverage with v8 provider

# Run a single test file:
pnpm vitest run src/compiler/__tests__/someFile.test.ts

# Asset pipeline:
node scripts/gen-scene-dsl.mjs \
  --input   examples/simple/siteResources.ts \
  --out-dir src/resources/ \
  --manifest-out public/assets/scene-manifest.json
```
