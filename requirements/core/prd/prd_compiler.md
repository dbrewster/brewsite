---
title: "BrewSite Core — Compiler Pipeline"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-13
change_history:
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Centralized theme system: added `SceneSnapshotContext` type definition to Section 4 with `themeFamily: ThemeFamily` and `themePolarity: 'dark' | 'light'` fields. Updated Step 1 description to document that the context is now constructed with `themeFamily` and `themePolarity` sourced from `SceneEngine.theme`. These values default to `'default'` / `'dark'` when no theme is configured. Element node handlers access them via `api.context.themeFamily` and `api.context.themePolarity`."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Carousel rendering bug fix — opacity double-counting: documented childOpacityScale branching in viewHandlers.ts (Section 14 viewHandlers.ts key behaviors). Carousel views (layoutId present) pass childOpacityScale=1 to createChildApi so child elements compile with opacity=1.0 intrinsic — prevents ViewWidget.applyOpacity() from double-multiplying against a baked-in opacity. Non-carousel views continue to bake viewOpacity into compiled child state as before."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "View Widget Carousel Rendering: added childWidgetIds to ViewState type (Section 14 ViewState definition). Updated ViewState storage note to reflect that ViewWidget is now registered for view IDs via corePlugin.reconcileCompiledTrack. Updated createChildApi description in Section 14 View compilation to document childWidgetIds tracking. The ViewWidget captures originalNvsCenter, originalScale, and originalZ from the first apply() call (not hardcoded) to compute correct delta transforms for all carousel view positions."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Scene Child Constraint: added NodeHandlerCategory type and RegisterNodeOptions to Section 13 (DSL Node Handler Registration). Documented getHandlerCategory() API and when plugin authors use it. Documented Scene root handler enforcement behavior: child classification, auto-wrap mechanics, error cases. Added sceneViewConstraint.ts to Section 14 (Sub-directory Responsibilities). Updated registerNode contract to note category declaration requirement."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "View/Region Architecture: added <View> and <ViewLayout> to public compiler exports; documented CompileApi.composeBounds; added Section 14 covering View/ViewLayout compilation, ViewState/ViewLayoutState types, and CompileApi child scoping."
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "Clarified Step 4.5 passthrough semantics: non-widget state remains source-scene aligned across each transition block."
  - date: 2026-03-05
    author: "Toolkit Product"
    summary: "@brewsite/slides integration: added sceneProgress?: number as an optional field to SceneTrackTick (sceneTrackTypes.ts). Semantics: equals blockProgress for all non-terminal ticks; equals 1 for the terminal tick of the final scene (correct within-scene progress coordinate). Populated by sceneTrackCompiler.ts during the frame-allocation pass. The field is optional and backward-compatible — consumers that read it default to blockProgress when absent. Used by SlideMetaWidget (in @brewsite/slides) to compute visibleBullets for animated bullet reveals without inflating scene count. No change to SceneTrack structure or any other compiler types."
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the full compiler pipeline for @brewsite/core including DSL evaluation, SceneTrack baking, transition specs (discrete and functional), HUD/label compilation, delta computation, caching, and the sampler."
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Added CompileWarning type (MISSING_WIDGET, DUPLICATE_WIDGET_ID, UNRESOLVED_REFERENCE) and SceneTrack.warnings? field. Warnings accumulated during compilation are surfaced to the host via ScenePlayer.onCompileWarning after compilation completes."
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "NVS system: SceneFrame.sceneOverlay removed. SceneTrack.sceneOverlays removed. compileChildrenSeparated now emits a compiler warning for non-DSL children and returns an empty array (not an overlay ReactNode). The overlay pipeline is replaced by TextBoxWidget writing TextBoxState to VariableStore. SceneTrack type and Step 6 updated."
  - date: 2026-03-03
    author: "Toolkit Product"
    summary: "Transition timing redesign. Added TRANSITION_TIMING to CompileWarningCode. Updated FunctionalTransitionSpec closure path description: exit/enter boundaries are now determined by SceneFrame.transitionWindow (resolved via resolveSceneTransition) rather than the hardcoded 0.5 split. Updated system fallback defaults from [0,0.5]/[0.5,1.0] to [0.8,0.9]/[0.9,1.0]."
  - date: 2026-03-01
    author: "Toolkit Product"
    summary: "Two features implemented. (1) ProgressManager: ProgressManagerSpec, SceneProgressSegment, SceneProgressProfile types added to sceneTrackTypes.ts. SceneFrame gains progressManager?: ProgressManagerSpec. SceneTrack gains progressProfile?: SceneProgressProfile. CompileWarningCode gains PROGRESS_MANAGER. buildProgressProfile added as a new compiler pass (Step 8). (2) Engine decomposition: HUD pipeline removed. hudItems removed from SceneFrame. hudPrimitives removed from SceneTrackTick. hudItems removed from SceneFrameDelta. pushHudItem removed from CompileApi. compileChildrenSeparated added to CompileHelpers. SceneFrame gains sceneOverlay?: ReactNode. SceneTrack gains sceneOverlays: Map<string, ReactNode>. Step 6 (HUD and Label compilation) updated to cover label-only — HUD is no longer a compiler concern."
  - date: 2026-03-01
    author: "Toolkit Product"
    summary: "Added AutoAdvanceSpec type. Added autoAdvance and animationTimeScale to ProgressManagerSpec and SceneProgressSegment. Documented buildProgressProfile validation for autoAdvance fields (plan_progress_driven_animation)."
  - date: 2026-03-01
    author: "Toolkit Product"
    summary: "Annotated label compilation pipeline (labelCompiler.ts, ClipMeta, labelPrimitives, CompileApi.pushLabel) as model-specific, moving to @brewsite/model in Phase 4 per plan_core_modularization."
  - date: 2026-03-03
    author: "Toolkit Product"
    summary: "API hardening updates: removed ScenePlayer.onCompileWarning prop reference from SceneTrack.warnings doc (warnings are now consumed internally by EngineProvider); updated cache scope description from ScenePlayer to EngineProvider instances; updated compiler/primitives/ section to reflect that Background, Camera, Environment, Floor, and Lighting primitive files are deleted — only progressManager.ts remains active."
---

# BrewSite Core — Compiler Pipeline

## 1. Overview

The compiler pipeline is the transformation engine at the heart of `@brewsite/core`. It consumes a declarative scene authoring DSL (JSX trees authored with `<Scene>`, `<Model>`, `<Camera>`, etc.) and produces a flat, pre-baked `SceneTrack` — a fixed-length array of `SceneTrackTick` records that can be sampled in O(1) time at any progress value during playback.

The compiler is a pure transformation pipeline: it contains no Three.js, no React rendering, and no side effects observable beyond its return value. Calling `compileSceneTrack` twice with the same inputs yields byte-identical output. This purity makes the output cacheable and the pipeline safe to call during React render cycles.

Affects: `@brewsite/core`.

---

## 2. Design Constraints

The following constraints are non-negotiable. Any feature addition or modification that violates them requires explicit architectural review and a major version discussion.

1. **No Three.js imports.** The compiler must never import from `three` or any Three.js module. Three.js is confined to `render.ts` files in the element layer.
2. **No React component rendering.** The compiler evaluates JSX by calling component functions directly (via `expandNode` and `getNodeHandler` dispatch), never via `ReactDOM.render` or any reconciler. React is present only for `isValidElement`, `Children`, and `Fragment` utilities.
3. **No side effects.** `compileSceneTrack` must be a pure function of its inputs. The only exception is the module-level node registry (a Map populated at import time by `registerNode` calls), which is treated as stable configuration, not mutable state.
4. **`compiler/index.ts` exports the DSL authoring surface only.** `SceneTrack`, `compileSceneTrack`, and cache functions are internal infrastructure. They are imported directly from their source files (`sceneTrackTypes.ts`, `sceneTrackCompiler.ts`, `sceneTrackCache.ts`) by the player layer. They must never appear in `compiler/index.ts`.
5. **Widget state isolation.** The compiler writes widget states into `SceneFrame.widgets[widgetId]`. Each widget is responsible for interpreting its own state shape. The compiler does not inspect widget state contents — it stores and blends opaque values via the widget's declared `transitionSpec`.

---

## 3. Public Exports from `compiler/index.ts`

The DSL authoring surface — everything a scene author needs to import — is consolidated in `compiler/index.ts`. This index is the stable public API of the compiler layer.

```typescript
// packages/core/src/compiler/index.ts

// DSL root and resolver
export { Scene, resolveSceneFromDsl } from './sceneDslCompiler';
export type { SceneGroup, SceneDefinition, SceneSnapshotContext } from './sceneTypes';

// Compile API types (for widget implementers and external element authors)
export type { CompileApi, CompileHelpers, NodeHandler } from './sceneDslTypes';

// ProgressManager DSL component
export { ProgressManager } from './blocks/progressManager';
export type { ProgressManagerProps } from './blocks/progressManager';

// Input controller DSL components
export { InputController, Action, PointerMap, WheelMap, PinchMap, KeyMap } from './blocks/inputController';
export type {
  InputControllerProps,
  ActionProps,
  PointerMapProps,
  WheelMapProps,
  PinchMapProps,
  KeyMapProps,
} from './blocks/inputController';

// View and ViewLayout DSL components (View/Region Architecture)
export { View } from './blocks/viewDsl';
export type { ViewProps } from './blocks/viewDsl';
export { ViewLayout } from './blocks/viewLayoutDsl';
export type { ViewLayoutProps } from './blocks/viewLayoutDsl';

// Node registration (for external packages extending the DSL surface)
export { registerNode } from './registry';
```

Infrastructure that is intentionally absent from this index:
- `SceneTrack`, `SceneTrackTick`, `SceneFrame`, `SceneFrameDelta` — imported from `./sceneTrackTypes` by consumers who need them.
- `compileSceneTrack`, `CompileSceneTrackOptions` — imported from `./sceneTrackCompiler`.
- `buildSceneTrackKey`, `getCachedTrack`, `setCachedTrack`, `clearCache` — imported from `./sceneTrackCache`.
- `createSceneTrackSampler` — imported from `./sceneTrackSampler`.
- `ElementTransitionSpec`, `FunctionalTransitionSpec`, `transitionT` and blend helpers — imported from `./transitions/transitionTypes` by element implementers.

---

## 4. Compilation Pipeline

`compileSceneTrack` is the single entry point for scene track compilation. It accepts a `CompileSceneTrackOptions` and returns a complete `SceneTrack`.

```typescript
// packages/core/src/compiler/sceneTrackCompiler.ts

export type CompileSceneTrackOptions = {
  scenes: SceneDefinition[];
  widgetRegistry: WidgetRegistry;
  /**
   * Number of frames per transition block.
   * Determined by the engine layer as: numSubTicks * numFramesPerSubTick.
   */
  blockSize: number;
  clipMeta?: ClipMeta[];
  prefersReducedMotion?: boolean;
};

export const compileSceneTrack = (options: CompileSceneTrackOptions): SceneTrack;
```

The pipeline executes seven sequential steps. Each step is described below with its inputs, outputs, and key implementation decisions.

### Step 1: DSL Evaluation (`sceneDslCompiler.ts`)

**Input:** `SceneDefinition[]`, `WidgetRegistry`, `SceneSnapshotContext` (one per scene).
**Output:** `SceneFrame[]` — one snapshot per scene, each containing the widget states authored by that scene's DSL tree.

The `SceneSnapshotContext` type passed to each scene's `getFrame`:

```typescript
// packages/core/src/compiler/sceneTypes.ts
export type SceneSnapshotContext = {
  /** 0-based index of this scene in the ordered array. */
  sceneIndex: number;
  /** Total number of scenes. */
  numScenes: number;
  /** Whether model/texture assets have finished loading. Always true during compilation. */
  assetsReady: boolean;
  /** Runtime variable store — for variable-driven DSL content. */
  variables?: VariableStoreReader;
  /** Viewport dimensions — for viewport-responsive DSL layout. */
  viewport?: { width: number; height: number; aspectRatio: number };
  /**
   * Active theme family for this engine instance.
   * Sourced from `SceneEngine.theme.family`. Defaults to `'default'` when no theme is configured.
   * Accessible to every NodeHandler via `api.context.themeFamily`.
   */
  themeFamily: ThemeFamily;
  /**
   * Active theme polarity for this engine instance.
   * Sourced from `SceneEngine.theme.polarity`. Defaults to `'dark'` when no theme is configured.
   * Accessible to every NodeHandler via `api.context.themePolarity`.
   */
  themePolarity: 'dark' | 'light';
};
```

For each scene in the ordered array:
1. Construct a `SceneSnapshotContext` with `sceneIndex`, `numScenes`, `assetsReady: true`, and `themeFamily`/`themePolarity` from the resolved `ActiveTheme` (defaults `'default'`/`'dark'` when none is configured).
2. Call `scene.getFrame(context)`.
3. If the result is a React element (detected by `$$typeof`), pass it to `resolveSceneFromDsl(tree, context, widgetRegistry)`.
4. If the result is a plain `SceneFrame` object (detected by the presence of `id`, `scrollProgress`, and `widgets` fields), use it directly.
5. Any other return value is a compile-time error.

`resolveSceneFromDsl` creates a `CompileApi` with an empty mutable `SceneFrame`, looks up the root element's handler from the node registry, and invokes it. The handler (the `Scene` root handler) reads its own props, sets scene metadata, then calls `helpers.compileChildren` to recursively process all child DSL elements. Each child handler writes into `api.state.widgets[widgetId]` via `api.setWidgetState`.

After all scenes are evaluated, `snapshots[i]` contains only the widget states explicitly authored in scene `i`. A widget absent from a scene's DSL tree is absent from that scene's `widgets` map — this is the signal that distinguishes "not in this scene" from "in this scene but at default state."

**Step 1.5: Snapshot Merging for Persistence**

Immediately after DSL evaluation, widgets implementing `mergeSnapshot` are given the opportunity to modify the raw snapshots. This pass enables "carry-forward" behavior — a widget can propagate state from scene N to scene N+1 if the author omitted the widget from scene N+1 intentionally but wants the previous state to persist rather than reset.

```typescript
for (const widget of widgetRegistry.getSceneElements()) {
  if (!widget.mergeSnapshot) continue;
  let prev: unknown = undefined;
  for (let i = 0; i < snapshots.length; i++) {
    const next = snapshots[i].widgets[widget.widgetId];
    const merged = widget.mergeSnapshot(prev as never, next as never);
    if (merged === undefined) {
      delete snapshots[i].widgets[widget.widgetId];
    } else {
      snapshots[i].widgets[widget.widgetId] = merged as never;
    }
    prev = merged;
  }
}
```

`mergeSnapshot` receives the previous scene's merged state and the current scene's raw authored state. It returns the final state for that scene, `undefined` to mark the widget absent, or the unmodified current state. This is called in scene order, so each call can depend on the already-merged prior state.

### Step 2: Frame Array Allocation (`sceneTrackCompiler.ts`)

**Input:** `numScenes`, `blockSize`.
**Output:** Pre-allocated `SceneTrackTick[]` of length `totalFrames`.

```
totalFrames = (numScenes - 1) * blockSize + 1
tickStep    = 1 / (totalFrames - 1)   [or 1 if totalFrames === 1]
```

Each frame is initialized with:
- `index`: 0-based position in the array.
- `progress`: `index / (totalFrames - 1)` — normalized [0, 1] global progress.
- `sceneId` and `sceneIndex`: derived from which block the frame belongs to.
- `blockProgress`: position within the current transition block, [0, 1].
- `state`: an empty `SceneFrame` with `widgets: {}`.
- `deltaForward` and `deltaBackward`: empty `SceneFrameDelta` objects (filled in Step 7).

The last frame (`index = totalFrames - 1`) is the terminal frame. It is assigned `sceneId` and `sceneIndex` of the final scene and `blockProgress = 0`, regardless of block arithmetic.

**Non-widget passthrough states** — `SceneFrame.widgets` entries that are not registered `ISceneElement` widgets (e.g., the `__input_controller` state written by `<InputController>`) are identified after Step 1. These are segregated into `passthroughWidgetsByScene[]` and reapplied to every frame in Step 4.5, using source-scene-aligned state for each block.

### Step 3: Transition Block Fill

**Input:** `SceneFrame[]` snapshots (one per scene), allocated `SceneTrackTick[]`, `WidgetRegistry`.
**Output:** `SceneTrackTick[]` with `state.widgets[widgetId]` filled for all registered `ISceneElement` widgets; `SceneTrackTransitionBlock[]` populated for widgets using `FunctionalTransitionSpec`.

For each adjacent scene pair `(fromSnap, toSnap)` at block index `n`:
- `blockStart = n * blockSize`
- `block = frames[blockStart ... blockStart + blockSize]`
- `mid = Math.floor(blockSize / 2)` — the split point between exit and enter halves.

For each registered `ISceneElement` widget:
- Determine `fromState = fromSnap.widgets[widgetId]` and `toState = toSnap.widgets[widgetId]`.
- The `absentDefault` is `widget.defaultState` with `enabled: false` set if `useDefaultStateWhenAbsent !== false`.

**Discrete fill path** (`ElementTransitionSpec`):

| Scenario | Block Fill Strategy |
|----------|---------------------|
| Widget in both scenes | Call `transitionSpec.interpolate(block, widgetId, fromState, toState)` — fills all `blockSize` frames. |
| Widget in `fromSnap` only (exit) | Call `transitionSpec.exit(block.slice(0, mid), widgetId, fromState)` for first half. Fill second half with `absentDefault`. |
| Widget in `toSnap` only (enter) | Fill first half with `toState` (or `absentDefault` if `useDefaultStateWhenAbsent` is false). Call `transitionSpec.enter(block.slice(mid), widgetId, toState)` for second half. |
| Widget absent from both | Fill all frames with `absentDefault`. |

**Functional closure path** (`FunctionalTransitionSpec`):

When `isFunctionalSpec(transitionSpec)` returns true, the compiler does not fill frame state directly. Instead it captures a closure:

| Scenario | Closure Behavior |
|----------|------------------|
| Widget in both scenes | `rawFn = transitionSpec.interpolateFn(fromState, toState)`. Store `fn = (bp) => rawFn(bp)`, `kind: 'interpolate'`. |
| Widget in `fromSnap` only (exit) | `rawFn = transitionSpec.exitFn(fromState)`. The compiler resolves `sceneExit = fromSnap.transitionWindow?.exit ?? [0.8, 0.9]` via `makeResolver`. The stored closure returns `absentDefault` when `bp < effectiveExitStart` and after `effectiveExitEnd`, and normalizes `bp` to `[0, 1]` within the exit window for the raw closure. `kind: 'exit'`. |
| Widget in `toSnap` only (enter) | `rawFn = transitionSpec.enterFn(toState)`. The compiler resolves `sceneEnter = toSnap.transitionWindow?.enter ?? [0.9, 1.0]` via `makeResolver`. The stored closure returns `absentDefault` before `effectiveEnterStart`, and normalizes `bp` to `[0, 1]` within the enter window. `kind: 'enter'`. |
| Widget absent from both | Fall through to discrete fill — no closure needed. |

Closures are stored in `transitionBlocks[n].widgetFns[widgetId]`. The runtime evaluates these at playback time by calling `fn(tick.blockProgress)`.

**Window-based remapping** is fully encapsulated within the stored closure via `makeResolver`. The exact exit/enter windows are read from:
- `fromSnap.transitionWindow?.exit ?? specDefault?.exit ?? [0.8, 0.9]`
- `toSnap.transitionWindow?.enter ?? specDefault?.enter ?? [0.9, 1.0]`

`transitionWindow` on a `SceneFrame` is set by the `<Scene>` node handler via `resolveSceneTransition(props.transition, props.exitStart)`. Both `.exit` and `.enter` on a given frame govern that scene's behavior in two different blocks: `.exit` when the scene is departing, `.enter` when it is arriving. The runtime passes `tick.blockProgress` directly — no transformation is applied by the runtime driver.

### Step 4: Terminal Frame Fill

**Input:** Final allocated tick (`frames[totalFrames - 1]`), last scene's snapshot.
**Output:** Terminal frame with all widget states set to their final scene values (or `absentDefault` if absent from the last scene).

```typescript
for (const widget of widgetRegistry.getSceneElements()) {
  const snapState = terminalSnap.widgets[widget.widgetId];
  terminalTick.state.widgets[widget.widgetId] = snapState ?? absentDefault;
}
```

The terminal frame is the "resting state" of the experience at progress = 1.

**Step 4.5: Passthrough Widget Backfill**

Non-widget scene-level states (those not managed by `ISceneElement` widgets) are written into every frame. For frame at block index `n`:
- Use `passthroughWidgetsByScene[n]` for all frames in the block (source-scene-aligned).
- Final frame uses the last scene state by construction (`n` resolves to the final scene index).

This ensures `InputController` spec state (keyed as `__input_controller`) is always available on `tick.state.widgets` without requiring InputController to implement `ISceneElement`.

### Step 5: compileExtra Pass

**Input:** Filled `SceneTrackTick[]`, all widgets implementing `ISceneElement.compileExtra`.
**Output:** `SceneTrackTick.widgetExtras[widgetId]` populated per-frame for widgets that declare `compileExtra`.

`compileExtra` is an optional method on `ISceneElement` that computes derived, per-frame extra data from the widget's already-compiled state. It is used for pre-computing values that would be expensive to compute at runtime every frame — for example, baking animation clip weights or resolving label 3D positions.

```typescript
// Called once per frame, per widget that declares compileExtra
widget.compileExtra(state, context: CompileExtraContext): TExtra
```

For functional-path widgets, the compiler evaluates the functional closure to obtain the frame's state before calling `compileExtra`, since `frame.state.widgets[widgetId]` is absent for frames within a functional transition block.

### Step 6: Label Compilation

**Input:** Filled `SceneTrackTick[]`, scene snapshots with `labels`.
**Output:** `SceneTrackTick.labelPrimitives` populated per-frame.

**Labels** are interpolated across the transition block using `compileLabels(fromLabels, toLabels, { sceneProgress: frame.blockProgress })`. `labelPrimitives` is set on the frame only when at least one label definition is present in either snapshot.

Scene overlay content is no longer stored on `SceneFrame` or `SceneTrack`. DOM overlay content is authored via `<TextBox>` DSL elements, which are compiled into widget state and written to the VariableStore by `TextBoxWidget` at tick time. `compileChildrenSeparated` emits a compiler warning for any non-DSL children it encounters and returns an empty array.

### Step 7: Delta Computation

**Input:** Filled `SceneTrackTick[]` (all states final).
**Output:** `SceneTrackTick.deltaForward` and `SceneTrackTick.deltaBackward` populated for every frame.

Deltas are sparse diffs between adjacent frames, serialized via `JSON.stringify` for comparison. A delta field is only present when the value changed:

```typescript
type SceneFrameDelta = {
  widgets?: Record<string, unknown>;
  labels?: SceneFrame['labels'];
};
```

**Forward delta** (`deltaForward`): what changed going from frame N-1 to frame N. This is what the runtime applies when advancing forward.

**Backward delta** (`deltaBackward`): what changed going from frame N+1 to frame N. This is what the runtime applies when scrubbing backward.

The sparse delta model allows the runtime driver to skip widget updates on frames where the widget state did not change, reducing Three.js API call volume during static (non-transitioning) portions of the track.

### Step 8: buildProgressProfile Pass

**Input:** `SceneFrame[]` (snapshots with `progressManager` fields set), `numScenes`.
**Output:** `SceneTrack.progressProfile?: SceneProgressProfile`.

`buildProgressProfile` runs after delta computation. It reads `progressManager` from each `SceneFrame` (already carry-forward merged) and constructs a `SceneProgressProfile`.

**Algorithm:**
1. Collect `scrollUnits` from each scene's `progressManager` (default: 1). Sum all units.
2. Normalize each scene's `rawStart`/`rawEnd` based on its cumulative proportional share of the total units.
3. Assign `engineStart`/`engineEnd` uniformly (equal engine progress range per scene — the pacing curve only affects how raw input maps within the segment, not the engine segment boundaries).
4. Store the `fn` from each scene's `ProgressManagerSpec`.
5. Set `isUniform = true` when all scenes have `scrollUnits === 1` and `fn` is the identity function. When uniform, `SceneTrack.progressProfile` is still written but the player uses this flag to skip `SceneProgressMapper` construction.

**Validation (emits PROGRESS_MANAGER warnings, does not throw):**
- `scrollUnits <= 0` — warns, falls back to `1`.
- `fn(0) !== 0` — warns, marks the profile's `isUniform = false`.
- `fn(1) !== 1` — warns, marks the profile's `isUniform = false`.
- `autoAdvance.duration <= 0` — warns, the `autoAdvance` field is dropped from the compiled segment.
- `autoAdvance.max` outside `(0, 1]` — warns, clamps to nearest valid value.
- `autoAdvance` declared on the last scene — warns (no outgoing transition exists to advance into).

**`isUniform` fast-path:** `isUniform` is `false` when any segment has `autoAdvance` or `animationTimeScale` declared (in addition to the existing non-identity `fn` and non-unit `scrollUnits` conditions). When `isUniform` is `false`, `SceneProgressMapper` is always constructed; the player cannot skip it.

When all scenes have no `progressManager`, `progressProfile` is absent from `SceneTrack` entirely.

---

## 5. SceneTrack Data Structure

```typescript
// packages/core/src/compiler/sceneTrackTypes.ts

export type CompileWarningCode =
  | 'MISSING_WIDGET'        // DSL element has no registered widget handler
  | 'DUPLICATE_WIDGET_ID'   // same widgetId registered twice
  | 'UNRESOLVED_REFERENCE'  // e.g. targetId on Camera points to unknown widget
  | 'PROGRESS_MANAGER'      // invalid ProgressManager props: fn(0)!==0, fn(1)!==1, scrollUnits<=0
  | 'TRANSITION_TIMING';    // exitStart on the last scene — no outgoing transition exists

export type CompileWarning = {
  code: CompileWarningCode;
  message: string;
  widgetId?: string;     // the widget ID involved, if applicable
  sceneIndex?: number;   // the scene where the warning occurred, if applicable
};

export type SceneTrack = {
  /** The flat pre-baked frame array. Length = (numScenes - 1) * blockSize + 1. */
  ticks: SceneTrackTick[];
  /** Reciprocal of (totalFrames - 1). Used for O(1) index lookup. */
  tickStep: number;
  /** Total frame count. Equals ticks.length. */
  subTickCount: number;
  /** One window per scene — maps scene identity to progress range [start, end]. */
  sceneWindows: SceneWindow[];
  /**
   * Functional transition closures, indexed by block index.
   * Block index N = transition from scenes[N] to scenes[N+1].
   * Only present when at least one widget uses FunctionalTransitionSpec.
   */
  transitionBlocks?: SceneTrackTransitionBlock[];
  /**
   * Warnings accumulated during compilation. Empty or absent when no issues.
   * Consumed internally by EngineProvider after compilation completes.
   */
  warnings?: CompileWarning[];
  /**
   * Input pacing and scroll budget profile derived from ProgressManager declarations.
   * Absent when no scene declares <ProgressManager>. When present, the player layer
   * constructs a SceneProgressMapper from this profile.
   */
  progressProfile?: SceneProgressProfile;
};

export type SceneWindow = {
  id: string;
  index: number;
  /** Normalized start progress for this scene's window. */
  start: number;
  /** Normalized end progress for this scene's window (inclusive of transition into next). */
  end: number;
};

export type SceneTrackTick = {
  /** 0-based frame index. */
  index: number;
  /** Normalized global progress [0, 1]. */
  progress: number;
  /** ID of the scene this tick belongs to (the "from" scene for transition ticks). */
  sceneId: string;
  /** 0-based scene index. */
  sceneIndex: number;
  /** Normalized position within the current transition block [0, 1]. */
  blockProgress: number;
  /** Widget states for this tick. Filled by transition spec methods and terminal frame pass. */
  state: SceneFrame;
  /** Resolved label primitives for this tick. model-specific field; will move to @brewsite/model in Phase 4 of plan_core_modularization. */
  labelPrimitives?: LabelResolved[];
  /** Forward delta: what changed from tick N-1 → N. */
  deltaForward: SceneFrameDelta;
  /** Backward delta: what changed from tick N+1 → N. */
  deltaBackward: SceneFrameDelta;
  /** Per-widget extras produced by compileExtra(). */
  widgetExtras?: Record<string, unknown>;
};

export type SceneFrame = {
  id: string;
  scrollProgress: number;
  widgets: Record<string, unknown>;
  meta?: Record<string, JsonPrimitive>;
  materialMetalnessMultiplier?: number;
  materialRoughnessMultiplier?: number;
  labels?: LabelResolved[];
  /**
   * Compiled ProgressManager spec for this scene.
   * Absent when the scene (and all prior scenes via carry-forward) declare no ProgressManager.
   */
  progressManager?: ProgressManagerSpec;
};

export type SceneFrameDelta = {
  widgets?: Record<string, unknown>;
  labels?: SceneFrame['labels'];
};
```

### ProgressManager Types

```typescript
// packages/core/src/compiler/sceneTrackTypes.ts

/**
 * Compiled auto-advance configuration stored on ProgressManagerSpec.
 * Constructed from <ProgressManager autoAdvance={{ ... }}> props.
 */
export type AutoAdvanceSpec = {
  /** Seconds to traverse the scene window from 0 to max while the user is idle. */
  duration: number;
  /** Default 1.0; ceiling fraction of scene window in (0, 1]. */
  max: number;
  /** Default true; pauses auto-advance when the user scrolls. */
  pauseOnScroll: boolean;
};

/**
 * Compiled form of a <ProgressManager> DSL element.
 * Stored on SceneFrame.progressManager after carry-forward merge.
 */
export type ProgressManagerSpec = {
  /**
   * Proportional scroll budget for this scene's outgoing transition.
   * The engine normalizes all scene budgets so the sum equals the total progress span.
   * Default: 1.
   */
  scrollUnits: number;
  /**
   * Pure input pacing curve mapping local raw progress [0, 1] to local engine progress [0, 1].
   * Constraints enforced at compile time (PROGRESS_MANAGER warning if violated):
   * - fn(0) === 0
   * - fn(1) === 1
   * - Continuous and monotonically non-decreasing
   * Default: identity (t => t).
   */
  fn: (localT: number) => number;
  /**
   * Cinematic idle auto-play configuration. When set, wall-clock time advances rawProgress
   * at max/duration per second while the user is idle. Must not appear on the last scene.
   */
  autoAdvance?: AutoAdvanceSpec;
  /**
   * Total animation-seconds played when scrolling 0 → 1 through this scene's window.
   * Undefined means 1× speed always (animation time equals wall time).
   */
  animationTimeScale?: number;
};

/**
 * A single scene's contribution to the global progress profile.
 * rawStart/rawEnd are the bounds of this scene's scroll segment in [0, 1] raw input space.
 * engineStart/engineEnd are the corresponding bounds in engine progress space.
 * fn maps local raw progress within this segment to local engine progress.
 * autoAdvance pre-computed fields avoid division in the RAF hot path.
 */
export type SceneProgressSegment = {
  sceneIndex: number;
  rawStart: number;
  rawEnd: number;
  engineStart: number;
  engineEnd: number;
  fn: (localT: number) => number;
  /**
   * Pre-computed auto-advance fields. Absent when autoAdvance is not declared.
   * rawRate and maxRaw are computed at compile time to avoid division in the RAF hot path.
   */
  autoAdvance?: {
    /**
     * (max × segmentWidth) / duration — pre-computed to avoid division in RAF hot path.
     * segmentWidth = rawEnd - rawStart.
     */
    rawRate: number;
    /**
     * rawStart + max × segmentWidth — pre-computed ceiling in raw progress space.
     */
    maxRaw: number;
    pauseOnScroll: boolean;
  };
  /** Total animation-seconds played when scrolling 0 → 1 through this segment. */
  animationTimeScale?: number;
};

/**
 * The compiled progress profile for all scenes.
 * Built by the buildProgressProfile compiler pass from SceneFrame.progressManager values.
 * Stored on SceneTrack.progressProfile.
 */
export type SceneProgressProfile = {
  segments: SceneProgressSegment[];
  /**
   * True when all scenes have the same scrollUnits and identity fn.
   * Allows the player to skip SceneProgressMapper construction.
   */
  isUniform: boolean;
};
```

### ViewState and ViewLayoutState

View-related compiled states stored in `SceneFrame.widgets`, produced by `viewHandler` and `viewLayoutHandler`:

```typescript
// packages/core/src/compiler/viewTypes.ts

export type ViewState = {
  readonly id: string;
  /** Resolved absolute NVS bounds for this view. */
  readonly bounds: NVSRect;
  /** Normalized padding applied to this view's bounds [top, right, bottom, left]. */
  readonly padding: NormalizedPadding;
  /** Content bounds (bounds after padding). Elements inside this view are relative to contentBounds. */
  readonly contentBounds: NVSRect;
  /** Z-order layer. 0 = default. Higher values render in front. Set by carousel layout. */
  readonly layer: number;
  /** Scale factor applied by the layout manager. 1.0 for standalone views and stack layouts. */
  readonly scale: number;
  /** ID of the parent ViewLayout, if any. Absent for standalone views. */
  readonly layoutId?: string;
  /**
   * Widget IDs compiled within this View's scoped child context.
   * Populated by createChildApi's setWidgetState interceptor during compilation.
   * Used by ViewWidget to reparent child 3D objects into the View's THREE.Group
   * for carousel delta-transform repositioning.
   */
  readonly childWidgetIds: readonly string[];
};

export type ViewLayoutState = {
  readonly id: string;
  readonly kind: ViewLayoutKind;
  /** Absolute NVS bounds of the layout container. */
  readonly bounds: NVSRect;
  /** Ordered list of child view IDs. */
  readonly viewIds: readonly string[];
};
```

Both types are stored in `SceneFrame.widgets` keyed by the view/layout `id`. They are not `ISceneElement` widget states — they carry no `defaultState`, `transitionSpec`, or `DslComponent`. However, `corePlugin().reconcileCompiledTrack` registers a `ViewWidget` (`IRenderable<ViewState>`) for each view ID found in the compiled track. This widget owns the Three.js Group that repositions child widget content during carousel steps. Consumer code that needs to read view bounds at runtime may access them via `tick.state.widgets[viewId] as ViewState`.

### Functional Transition Types

```typescript
export type FunctionalWidgetTransition = {
  /**
   * Evaluate this widget's state at blockProgress ∈ [0, 1].
   * Half-block remapping is pre-applied — the runtime passes blockProgress directly.
   */
  fn: (blockProgress: number) => unknown;
  kind: 'exit' | 'enter' | 'interpolate';
};

export type SceneTrackTransitionBlock = {
  /** Block index N = transition from scenes[N] to scenes[N+1]. */
  blockIndex: number;
  /** Widget function closures for this block, keyed by widgetId. */
  widgetFns: Record<string, FunctionalWidgetTransition>;
};
```

---

## 6. SceneTrack Sampler

The sampler provides O(1) lookup of a `SceneTrackTick` at any normalized progress value.

```typescript
// packages/core/src/compiler/sceneTrackSampler.ts

export type SceneTrackSampler = {
  track: SceneTrack;
  sample: (progress: number) => SceneTrackTick;
};

export const createSceneTrackSampler = (track: SceneTrack): SceneTrackSampler;
```

**Lookup algorithm:**

```typescript
const clamped = clamp01(progress);
const scaled  = clamped * Math.max(1, track.subTickCount - 1);
// Bias slightly upward to prevent floating-point half-step rounding artifacts
const index   = Math.min(maxIndex, Math.max(0, Math.round(scaled + 1e-9)));
return track.ticks[index] ?? track.ticks[track.ticks.length - 1];
```

`clamp01` ensures progress outside [0, 1] resolves to the terminal frames rather than throwing. The `+ 1e-9` epsilon bias prevents a progress value of exactly `0.5 * tickStep` from rounding down to the prior frame.

The sampler is created once per compiled track and reused for all playback samples. It is created by the player layer, not the compiler itself, so the compiler has no dependency on the sampler.

---

## 7. Transition Spec Architecture

### 7.1 ElementTransitionSpec (Discrete Batch-Fill)

The standard transition contract. The compiler calls the widget's spec methods once per transition block at compile time. The widget fills its own frame slots directly.

```typescript
// packages/core/src/compiler/transitions/transitionTypes.ts

export type ElementTransitionSpec<T> = {
  /**
   * Widget is leaving (in sceneN, absent from sceneN+1).
   * frames = first half of the transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   */
  exit: (frames: SceneTrackTick[], widgetId: string, fromState: T) => void;

  /**
   * Widget is arriving (absent from sceneN, in sceneN+1).
   * frames = second half of the transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   */
  enter: (frames: SceneTrackTick[], widgetId: string, toState: T) => void;

  /**
   * Widget present in both scenes.
   * frames = the full transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   */
  interpolate: (frames: SceneTrackTick[], widgetId: string, fromState: T, toState: T) => void;
};
```

**`transitionT` helper:**

```typescript
/**
 * Normalized progress scalar for frame i within a slice of length len.
 * Returns 1 when len === 1 (single-frame edge case).
 */
export const transitionT = (i: number, len: number): number =>
  len > 1 ? i / (len - 1) : 1;
```

All built-in element transition specs use `transitionT(i, frames.length)` within their loop bodies to convert frame index to a [0, 1] normalized value, then call blend helpers to interpolate state fields.

**Suitable for:** position/rotation/scale/opacity blending, animation weight transitions, any state that can be fully pre-baked to discrete frames.

### 7.2 FunctionalTransitionSpec (Closure-Based)

An alternative contract for widgets requiring continuous evaluation at runtime — useful for spring physics, easing curves that depend on runtime input, or state that cannot be meaningfully pre-baked.

```typescript
export type FunctionalTransitionSpec<T> = {
  /**
   * Called once at compile time with fromState.
   * Returns a pure function of t ∈ [0, 1].
   * t = 0: widget at fromState. t = 1: widget fully absent.
   * Active over the configured exit window.
   */
  exitFn: (fromState: T) => (t: number) => T;

  /**
   * Called once at compile time with toState.
   * Returns a pure function of t ∈ [0, 1].
   * t = 0: widget fully absent. t = 1: widget at toState.
   * Active over the configured enter window.
   */
  enterFn: (toState: T) => (t: number) => T;

  /**
   * Called once at compile time with (fromState, toState).
   * Returns a pure function of t ∈ [0, 1].
   * t = 0: widget at fromState. t = 1: widget at toState.
   * Active over the full block (blockProgress ∈ [0, 1]).
   */
  interpolateFn: (fromState: T, toState: T) => (t: number) => T;
};
```

**Type guard:**

```typescript
export const isFunctionalSpec = <T>(
  spec: ElementTransitionSpec<T> | FunctionalTransitionSpec<T>,
): spec is FunctionalTransitionSpec<T> => 'interpolateFn' in spec;
```

**Runtime contract:** For frames in a functional transition block, `tick.state.widgets[widgetId]` is absent (the compiler intentionally does not write it). The runtime driver checks `track.transitionBlocks[tick.sceneIndex]?.widgetFns[widgetId]` and, if present, calls `fn(tick.blockProgress)` to obtain the current state before passing it to the widget's `apply` method.

**Window remapping:** The compiler wraps the widget author's raw closure with window-aware remapping at storage time. The author writes closures expecting `t ∈ [0, 1]` only. The wrapper handles transition-window activation and `absentDefault` fallback. The runtime need not know the difference between exit, enter, and interpolate closures at evaluation time.

**Suitable for:** Spring physics, momentum-based transitions, easing curves that require continuous evaluation, diagram canvas camera transitions.

### 7.3 Choosing Between Spec Types

| Criterion | ElementTransitionSpec | FunctionalTransitionSpec |
|-----------|----------------------|--------------------------|
| Pre-baked to disk | Yes — all states stored in ticks | No — closures stored, evaluated at runtime |
| Memory cost | O(blockSize × numWidgets × stateSize) | O(numTransitionBlocks × numWidgets) |
| Scrub quality | Perfect — any frame is exact | Perfect — function evaluated at blockProgress |
| Spring / physics | Not suitable | Native fit |
| Serialization | Fully serializable | Closures cannot be serialized |
| `prefersReducedMotion` | Widget can check in loop | Widget can check in closure factory |

Most core widgets use `ElementTransitionSpec`. `FunctionalTransitionSpec` is reserved for widgets where the transition behavior inherently requires runtime state or continuous-time physics.

---

## 8. Blend Helpers

The blend helpers in `transitions/transitionTypes.ts` are utility functions for use inside `ElementTransitionSpec` implementations and `FunctionalTransitionSpec` closures. They are exported from `compiler/index.ts` for use by external element packages (e.g., `@brewsite/diagram`).

```typescript
// All exported from packages/core/src/compiler/transitions/transitionTypes.ts

/**
 * Lerp two optional numbers.
 * Returns undefined if both are undefined.
 * Returns the defined value if only one is defined.
 */
export const blendNumber = (from?: number, to?: number, t?: number): number | undefined;

/**
 * Lerp two optional distances.
 * Handles non-finite values by switching at t = 0.5.
 */
export const blendDistance = (from?: number, to?: number, t?: number): number | undefined;

/**
 * Lerp two optional opacity values.
 * Treats undefined as 0.
 */
export const blendOpacity = (from?: number, to?: number, t?: number): number | undefined;

/**
 * Lerp two optional Vec3 tuples: [x, y, z].
 */
export const blendVec3 = (
  from?: [number, number, number],
  to?: [number, number, number],
  t?: number,
): [number, number, number] | undefined;

/**
 * Lerp two hex color strings by interpolating RGB channels.
 * Returns to ?? from if either is unparseable or t is undefined.
 */
export const blendColor = (from?: string, to?: string, t?: number): string | undefined;

/**
 * Lerp two optional axis rotation specs using quaternion slerp.
 * Accepts { yawPct?, pitchPct?, rollPct? } and returns a blended spec.
 */
export const blendAxisRotation = (
  from?: { yawPct?: number; pitchPct?: number; rollPct?: number },
  to?: { yawPct?: number; pitchPct?: number; rollPct?: number },
  t?: number,
): { yawPct?: number; pitchPct?: number; rollPct?: number } | undefined;

/**
 * Lerp two optional axis translation specs: { xPct?, yPct?, zPct? }.
 */
export const blendAxisTranslation = (
  from?: { xPct?: number; yPct?: number; zPct?: number },
  to?: { xPct?: number; yPct?: number; zPct?: number },
  t?: number,
): { xPct?: number; yPct?: number; zPct?: number } | undefined;

/**
 * Blend two style value objects. Interpolates number values and hex color strings.
 * Non-numeric, non-color values use the "to" side when both are present.
 */
export const blendStyleValues = <T extends Record<string, StyleValue>>(
  from: T | undefined,
  to: T | undefined,
  t: number,
): T | undefined;

/**
 * Like blendStyleValues but only emits keys present in either object (not all keys merged).
 */
export const blendStyleValuesPartial = <T extends Record<string, StyleValue>>(
  from: T | undefined,
  to: T | undefined,
  t: number,
): T | undefined;
```

**Rotation blending detail:** `blendAxisRotation` converts Euler angles to quaternions (XYZ order), spherically interpolates with SLERP, and converts back. This prevents gimbal lock and produces correct shortest-path rotation arcs. The quaternion math is self-contained in `transitionTypes.ts` — no Three.js dependency.

---

## 9. Scene Overlay Collection (`compileChildrenSeparated`)

Scene overlay collection extracts non-DSL HTML/React children from `<Scene>` elements during DSL evaluation. It is implemented by the `compileChildrenSeparated` helper in `CompileHelpers`.

```typescript
// packages/core/src/compiler/sceneDslTypes.ts (part of CompileHelpers)

/**
 * Separates DSL children from non-DSL children of a ReactElement node.
 * DSL children (those with a registered node handler) are compiled normally.
 * Non-DSL children (HTML elements, non-registered React components) are not
 * valid <Scene> children — they produce a UNSUPPORTED_OVERLAY_CHILD compiler
 * warning and are discarded. DOM overlay content must be authored via <TextBox>.
 *
 * Called by the Scene root handler during DSL evaluation (Step 1).
 */
compileChildrenSeparated: (node: ReactElement, api: CompileApi) => ReactNode[];
```

**Classification:**
- A child is a DSL child if its `type` has a registered handler in the node registry (`isPrimitiveComponent(child.type) === true`).
- A child is a non-DSL child if its `type` is a string (HTML element, e.g., `'div'`, `'h1'`) or is a React component with no registered handler.
- `null`, `undefined`, and boolean children are ignored (React standard behavior).

**Non-DSL children:** Non-DSL children emit a `CompileWarning` with code `UNSUPPORTED_OVERLAY_CHILD` and are discarded. The returned `ReactNode[]` is always empty. There is no `SceneFrame.sceneOverlay` field and no `SceneTrack.sceneOverlays` map. Use `<TextBox>` for all DOM overlay content.

---

## 10. Label Compilation (`labelCompiler.ts`)

> **Note:** Label compilation (`labelCompiler.ts`, `CompileApi.pushLabel`, `SceneFrame.labels`)
> is model-specific infrastructure. It will be removed from `@brewsite/core` and moved to
> `@brewsite/model` in plan_core_modularization Phase 4.

Label compilation produces per-frame `LabelResolved[]` from the label definitions in adjacent scene snapshots.

```typescript
// packages/core/src/compiler/labelCompiler.ts

export const compileLabels = (
  fromLabels: LabelResolved[] | undefined,
  toLabels: LabelResolved[] | undefined,
  options: { sceneProgress: number },
): LabelResolved[];
```

Labels target 3D attachment points within Model elements. They carry 3D world-space positions that are projected to screen coordinates by `LabelPositioner` in the player layer during each render frame.

`compileLabels` interpolates label position data between `fromLabels` and `toLabels` using `options.sceneProgress` (which equals the frame's `blockProgress`). Labels are identified by ID; a label present in both snapshots is interpolated, a label only in one snapshot follows enter/exit timing aligned with the general half-block semantics.

`labelPrimitives` is only set on a `SceneTrackTick` when at least one label definition exists in either snapshot for that tick's block. Frames with no labels carry no `labelPrimitives` field, keeping the tick object compact.

---

## 11. CompileExtraContext

`compileExtra` on `ISceneElement` receives a `CompileExtraContext` providing per-frame metadata for derived computation.

```typescript
// Defined in sceneTrackCompiler.ts, consumed by ISceneElement implementers

export type CompileExtraContext = {
  /** Normalized position within the current transition block [0, 1]. */
  sceneProgress: number;
  /** Normalized global progress [0, 1]. */
  globalProgress: number;
  /** Animation clip metadata for all clips registered with the widget. */
  clipMeta: ClipMeta[];
  /** Whether the consumer has indicated a preference for reduced motion. */
  prefersReducedMotion: boolean;
};
```

> **Note:** `ClipMeta` is model-specific and will be removed from `@brewsite/core` compiler
> types when `@brewsite/model` is extracted (plan_core_modularization Phase 4).

`ClipMeta` carries animation clip name, total duration in seconds, and optional trim boundaries (`clipStart`, `clipEnd`). Widget implementations use this at `compileExtra` time to pre-compute per-frame animation clock values (current time within clip, playback direction, loop count) rather than computing them on every render tick.

---

## 12. Scene Track Caching

The track cache prevents recompilation on React re-renders. The cache is keyed on a deterministic string built from scene IDs, block size, widget registry contents, and `prefersReducedMotion`.

```typescript
// packages/core/src/compiler/sceneTrackCache.ts

export const buildSceneTrackKey = (options: {
  scenes: SceneDefinition[];
  widgetRegistry: WidgetRegistry;
  blockSize: number;
  prefersReducedMotion: boolean;
}): string;

export const getCachedTrack = (key: string): SceneTrack | undefined;
export const setCachedTrack = (key: string, track: SceneTrack): void;
export const clearCache = (): void;
```

**Key construction:**

```typescript
const key = [
  scenes.map(s => s.id).join('|'),    // Scene IDs in order
  `b:${blockSize}`,                   // Block size
  `w:${widgetRegistry.buildCacheKey()}`, // Widget identity + clip metadata
  `rm:${prefersReducedMotion ? 1 : 0}`,
].join('::');
```

`WidgetRegistry.buildCacheKey()` returns a sorted, pipe-delimited string of `${widgetId}:${clipMetaFingerprint}` for all registered widgets. This ensures cache misses when clip durations or trim boundaries change after asset loading.

**Cache invalidation:** The cache is a module-level `Map<string, SceneTrack>`. It is never automatically invalidated — `clearCache()` must be called explicitly. The player layer calls `clearCache()` when the widget registry is rebuilt (e.g., after hot module replacement or viewport resize that forces registry recreation).

**Cache scope:** The cache is process-scoped (same Map instance for all `EngineProvider` instances in a single page). In practice this is safe because the cache key includes all variable inputs. Two providers with the same scenes and registry will correctly share a cached track.

---

## 13. DSL Node Handler Registration

The node registry is the dispatch table that maps DSL component references to their compile-time handlers.

### 13.1 Registry API

```typescript
// packages/core/src/compiler/registry.ts

/**
 * The compile-time classification of a DSL element.
 *
 * 'spatial'  — The element occupies a viewport region and must be compiled
 *              inside a <View>. Spatial elements are subject to the Scene
 *              child constraint (see §13.3). This is the default.
 * 'ambient'  — The element configures the global scene environment and is
 *              not bound to any viewport region. Ambient elements are never
 *              subject to the Scene child constraint.
 */
export type NodeHandlerCategory = 'spatial' | 'ambient';

/**
 * Options for registerNode(). The category field is optional;
 * omitting it defaults to 'spatial'.
 */
export type RegisterNodeOptions = {
  category?: NodeHandlerCategory;
};

/** Register a handler for a DSL component. Overwrites any existing handler. */
export const registerNode = (
  component: unknown,
  handler: NodeHandler,
  options?: RegisterNodeOptions,
): void;

/** Look up the handler for a DSL component. Returns undefined if not registered. */
export const getNodeHandler = (component: unknown): NodeHandler | undefined;

/**
 * Returns the NodeHandlerCategory for a registered component.
 * Returns 'spatial' (the default) for any component that is not registered
 * or for which no category was declared at registration time.
 *
 * Plugin authors use this when implementing custom Scene-level compilers
 * or constraint enforcement in test harnesses. Most consumers do not call
 * this function directly.
 */
export const getHandlerCategory = (component: unknown): NodeHandlerCategory;

/** Returns true if the component has a registered handler. */
export const isPrimitiveComponent = (component: unknown): boolean;

/** Clear all registrations. Used in test teardown only. */
export const clearRegistry = (): void;
```

### 13.2 Registration Conventions

**Dual index:** Handlers are indexed by both component reference (primary) and `displayName` string (secondary). The `displayName` fallback enables correct dispatch after Hot Module Replacement, where module re-evaluation creates a new function reference but preserves `displayName`. The secondary lookup uses `displayName ?? name` from the component function.

**Registration timing:** Core DSL components (`Scene`, `ProgressManager`, `InputController`, and its children) register themselves at module import time as side effects. This is intentional — the DSL authoring surface must be ready before any `resolveSceneFromDsl` call. `ensureSceneRegistry()` and `ensureInputControllerRegistry()` guard against double-registration in environments where modules may be evaluated multiple times.

**Category declaration requirement:** All `registerNode` calls should explicitly declare `category` when the element is ambient. The default (`'spatial'`) is appropriate for elements that place content in the 3D viewport. Elements that configure global scene environment (lighting, background, camera, etc.) must declare `{ category: 'ambient' }` to opt out of the Scene child constraint. Failing to declare ambient category for an ambient element will cause the Scene root handler to treat it as a spatial element during constraint enforcement, which may produce spurious constraint errors when multiple ambient elements are present.

**External element registration:** `@brewsite/diagram` elements register their handlers by importing `registerNode` from `@brewsite/core` and calling it from their element module's `dsl.tsx` or `compile.ts` at module load time. This means any application that imports `@brewsite/diagram` DSL components automatically populates the registry with diagram handlers. Spatial elements from companion packages (DiagramCanvas, Chart, Model, ImagePanel, Screen) do not need to declare a category — they are spatial by default.

**WidgetRegistry interaction:** `WidgetRegistry.register(widget)` internally calls `registerNode(widget.DslComponent, routingHandler, { category })` if no handler exists for that component. The category is read from the duck-typed `widget.nodeHandlerCategory` property (see `prd_widget_sdk.md` §8). If the property is absent, the default `'spatial'` is used. For type-factory-routed widgets, `registerTypeFactory` installs a handler that creates the correct widget instance on demand.

### 13.3 Scene Root Handler Enforcement

The `<Scene>` root handler (`createSceneRootHandler`) enforces the spatial-element constraint on its direct children before delegating compilation. The enforcement is implemented in `packages/core/src/compiler/sceneViewConstraint.ts` and produces a `ConstraintResult` that determines which compilation path the Scene root handler takes.

**Child classification:** The Scene root handler calls `collectChildrenShallow()` to enumerate direct children of the `<Scene>` JSX element, flattening one level of Fragments. For each child:
- If the child is a primitive (string, number, boolean, null, undefined): ignored.
- If the child is an HTML element (a string tag): treated as an overlay and ignored by the constraint. HTML elements pass through to `compileChildrenSeparated`.
- If the child is a function component:
  - If registered and category is `'ambient'`: classified as ambient.
  - If registered and category is `'spatial'`: classified as spatial.
  - If registered and the component is `View` or `ViewLayout`: classified as a View.
  - If not registered (`isPrimitiveComponent` returns false): classified as spatial (conservative default; will trigger constraint errors when mixed with Views or other spatials).

**Enforcement outcomes:**

| Scenario | Result | Behavior |
|---|---|---|
| No spatial children | `noSpatial` | Normal compilation; no auto-wrap. |
| One spatial, no Views | `autoWrap` | Spatial child compiled inside implicit `__scene_root__` View. |
| Multiple spatials, no Views | `error` | `console.error` emitted; spatial children skipped. Ambient children compile. |
| Views only (no bare spatials) | `viewMode` | Normal View/ViewLayout compilation path. |
| Bare spatials mixed with Views | `error` | `console.error` emitted; bare spatials skipped. Views compile normally. |

**`__scene_root__` sentinel:** The implicit View created during auto-wrap uses the id `IMPLICIT_SCENE_ROOT_VIEW_ID = '__scene_root__'`. The `viewHandler` suppresses the reserved-id `console.warn` for this sentinel value specifically.

---

## 14. Sub-directory Responsibilities

### `compiler/blocks/`

Hosts DSL block components that are not element-specific but still require handler registration.

**`progressManager.tsx`:** `<ProgressManager>` DSL component. The handler reads `scrollUnits` and `fn` props, validates constraints (emitting `PROGRESS_MANAGER` warnings for violations), and writes a `ProgressManagerSpec` to `api.state.progressManager`. Carry-forward merge of `ProgressManagerSpec` across scenes happens in the Step 1.5 snapshot merging pass, using the same `mergeSnapshot` mechanism as other carry-forward widgets — the `ProgressManager` handler itself only writes to the current scene's snapshot.

**`inputController.tsx`:** `<InputController>`, `<Action>`, `<PointerMap>`, `<WheelMap>`, `<PinchMap>`, `<KeyMap>`. The InputController handler parses the full action tree and writes a `SceneInputControllerSpec` to `api.setWidgetState('__input_controller', spec)`. Child components (`Action`, `*Map`) are registered with protective handlers that throw if used outside an `InputController`. `ensureInputControllerRegistry()` guards all registrations.

**`viewDsl.tsx`:** `<View>` DSL component and `ViewProps`. A null-returning component registered with `viewHandler` at module load time. Defines `id` (required), `x`, `y`, `w`, `h`, and `padding` props.

**`viewLayoutDsl.tsx`:** `<ViewLayout>` DSL component and `ViewLayoutProps`. A null-returning component registered with `viewLayoutHandler` at module load time. Defines `id` (optional — auto-generated when absent), `kind`, container geometry (`x`, `y`, `w`, `h`), and layout-policy-specific props (`direction` for stack; `activeIndex`, `inactiveScale`, `zStep` for carousel).

**`viewHandlers.ts`:** `viewHandler` and `viewLayoutHandler` — the `NodeHandler` implementations for `<View>` and `<ViewLayout>`. Both are pure: no Three.js, no side effects beyond `api.setWidgetState` calls and `helpers.compileChildren`. The handler coordination mechanism uses a module-level `WeakMap<CompileApi, ViewLayoutContext>` to pass pre-computed bounds from `viewLayoutHandler` to the child `viewHandler` instances it spawns, without polluting the `CompileApi` interface. Nested `<ViewLayout>` nesting is supported via save/restore of the previous layout context before and after `helpers.compileChildren`.

Key behaviors:
- **Standalone `<View>`** (no parent `<ViewLayout>`): resolves absolute bounds via `api.composeBounds(localBounds)`. Sets `layer = 0`, `scale = 1.0`.
- **Managed `<View>`** (inside `<ViewLayout>`): bounds, layer, and scale are pre-computed by the parent `viewLayoutHandler` via `resolveLayout(config, container, sizeHints)` and injected via the WeakMap context. The `x`/`y` props are ignored (a console warning is emitted).
- **Child scoping**: after resolving bounds and padding, each `<View>` creates a scoped child `CompileApi` via `createChildApi(api, contentBounds)` (defined in `compiler/childApi.ts`). The child API's `composeBounds` is configured to map local [0..1] coordinates into the view's content bounds. Its `setWidgetState` is wrapped to record the widget ID in a `childWidgetIds` accumulator. After child compilation completes, `childWidgetIds` is stored on `ViewState`. All DSL children of `<View>` are compiled using this scoped api, so elements like `<Chart>` or `<DiagramCanvas>` inside a view automatically inherit absolute bounds and are tracked as children without any knowledge of the nesting.
- **childOpacityScale branching**: `viewHandler` passes a `childOpacityScale` parameter to `createChildApi`. For carousel views (those whose `ViewState.layoutId` is set — i.e., they are children of a `<ViewLayout kind="carousel">`), `childOpacityScale = 1` is passed, so all child element states compile with `opacity = 1.0` regardless of what the carousel layout's active/inactive scale might suggest. This ensures `ViewWidget.applyOpacity()` is the sole opacity controller for carousel children at runtime (no double-counting against a baked-in fractional opacity). For standalone views (no `layoutId`), `childOpacityScale` is the view's own opacity (default 1.0), and the existing behavior of baking `viewOpacity` into compiled child state is preserved.

`ViewState` and `ViewLayoutState` (from `compiler/viewTypes.ts`) are stored via `api.setWidgetState(id, state)` on the parent CompileApi, ensuring they appear in `SceneFrame.widgets` alongside all other element states.

### `CompileApi.composeBounds`

`CompileApi` carries a `composeBounds(localRect: NVSRect): NVSRect` method used by DSL node handlers to convert local NVS coordinates into absolute NVS coordinates:

```typescript
export type CompileApi = {
  context: SceneSnapshotContext;
  state: SceneFrame;
  setWidgetState: (widgetId: string, state: unknown) => void;
  setSceneMeta: (meta: { id?: string; meta?: Record<string, JsonPrimitive> }) => void;
  pushWarning: (warning: CompileWarning) => void;
  /**
   * Maps a local NVS rect into absolute NVS coordinate space.
   *
   * At the root (no parent View), this is the identity: localRect is returned unchanged.
   * Inside a <View>, this maps local [0..1] coordinates into the view's content bounds
   * using composeBoundsIntoParent() from layout/regionNormalize.ts.
   * Nesting is handled transparently — each level chains with its parent via createChildApi.
   *
   * Handlers for elements that accept NVS position/size props (Chart, Model,
   * DiagramCanvas, TextBox) must call api.composeBounds() to resolve absolute bounds
   * before writing to SceneFrame.widgets.
   */
  composeBounds: (localRect: NVSRect) => NVSRect;
};
```

**How it works:** The root-level `CompileApi` uses the identity function for `composeBounds`. When a `<View>` is compiled, its handler calls `createChildApi(api, contentBounds)` to produce a new `CompileApi` whose `composeBounds` maps local [0..1] coordinates into the view's `contentBounds` rectangle. This child api is passed to `helpers.compileChildren()` for all of the view's DSL children. Nesting is correctly handled — a `<View>` inside another `<View>` creates a chain of `composeBounds` mappings.

**Consumer contract:** Any DSL handler that places an element at an NVS position must call `api.composeBounds(localRect)` rather than using the prop values directly. This ensures the element respects its parent view's bounds when nested inside `<View>`. Handlers that do not respect this contract will render at incorrect positions when placed inside a `<View>`.

### `compiler/sceneViewConstraint.ts`

**New file** added by the Scene Child Constraint feature. Contains the pure enforcement logic for the spatial-element constraint:

```typescript
// packages/core/src/compiler/sceneViewConstraint.ts

/** The sentinel id used for the implicit full-screen View auto-created during auto-wrap. */
export const IMPLICIT_SCENE_ROOT_VIEW_ID = '__scene_root__';

/**
 * The outcome of constraint enforcement for a given <Scene>'s direct children.
 *
 * 'noSpatial'  — No spatial children found. Normal ambient-only compilation.
 * 'autoWrap'   — Exactly one spatial child, no Views. Compiler auto-wraps in __scene_root__.
 * 'viewMode'   — Only <View>/<ViewLayout> children (no bare spatials). Normal View path.
 * 'error'      — Constraint violated (multiple spatials, or mixed spatial+View).
 *                Spatial children are excluded from compilation; ambients compile normally.
 */
export type ConstraintResult =
  | { kind: 'noSpatial' }
  | { kind: 'autoWrap'; spatialChild: ReactElement }
  | { kind: 'viewMode' }
  | { kind: 'error'; message: string; skipElements: ReactElement[] };

/** Classifies the direct children of a <Scene> and returns the enforcement outcome. */
export function enforceSceneChildConstraint(
  children: ReactNode,
  getCategory: (component: unknown) => NodeHandlerCategory,
  isPrimitive: (component: unknown) => boolean,
): ConstraintResult;
```

`enforceSceneChildConstraint` is a pure function: it reads children (using `collectChildrenShallow` from `sceneDslCompiler.ts`) and the registry query functions, and returns a `ConstraintResult`. It has no side effects. All `console.error` calls happen in `createSceneRootHandler` after receiving the result, not inside the constraint function itself.

### `compiler/transitions/`

**`transitionTypes.ts`:** All transition contracts and blend utilities. No imports from `react`, `three`, or any element module. Contains `ElementTransitionSpec`, `FunctionalTransitionSpec`, `isFunctionalSpec`, `transitionT`, `blendNumber`, `blendDistance`, `blendOpacity`, `blendVec3`, `blendColor`, `blendAxisRotation`, `blendAxisTranslation`, `blendStyleValues`, `blendStyleValuesPartial`, quaternion SLERP, and opacity resolution helpers.

### `compiler/primitives/`

Only `progressManager.ts` remains active in this directory. It exports `compileProgressManager` and `buildProgressProfile`, which process `<ProgressManager>` DSL props into `SceneProgressProfile` entries on the `SceneTrack`. The `Background`, `Camera`, `Environment`, `Floor`, and `Lighting` primitive files previously located here have been deleted — those DSL handlers are now registered via `corePlugin().registerHandlers()` through `coreHandlers.ts`.

---

## 15. Technical Considerations

### Pure Function Guarantee

`compileSceneTrack` is a pure function. The node registry (populated at module import time) is treated as stable configuration. Any test that mutates the registry must call `clearRegistry()` in teardown to prevent cross-test contamination.

The only legitimate use of `clearRegistry()` outside tests is in HMR scenarios where the entire module graph is being re-evaluated and all registrations must be re-established from scratch.

### Serialization and Delta Computation

Delta computation uses `JSON.stringify` with a custom replacer to handle functions within widget state (functions are replaced with `'[function]'`). Only `widgets` and `labels` participate in the sparse delta diff. `TextBox` state is written to the VariableStore by `TextBoxWidget.onTick` — it is not part of the delta pipeline.

### blockSize and Frame Count Arithmetic

`blockSize` is set by the engine layer based on the scroll region height and desired tick resolution. The relationship is:

```
totalFrames = (numScenes - 1) * blockSize + 1
```

For a 3-scene track with `blockSize = 120`: `totalFrames = 241`. This gives 120 frames per transition block, which at 60fps corresponds to a 2-second transition duration.

`blockSize` must be at least 2 for meaningful transitions. A `blockSize` of 1 produces single-frame "hard cuts" with no transition animation.

### Memory Budget

Each `SceneTrackTick` holds a `SceneFrame` with `widgets` as a `Record<string, unknown>`. For a typical scene with 8 widgets and 241 ticks, the in-memory SceneTrack is approximately:

- Widget states: 241 ticks × 8 widgets × ~200 bytes per state ≈ 385 KB
- Deltas (sparse): typically 20–40% of full widget state ≈ 80–150 KB
- Functional blocks (if present): negligible — closures only, no state arrays

Total per-track memory: typically under 1 MB for a 3-scene experience. This is acceptable for a single-page application context.

### `prefersReducedMotion` Integration

`prefersReducedMotion` is passed through to `CompileSceneTrackOptions` and made available in `CompileExtraContext`. Widget transition specs can check this flag in their `exit`/`enter`/`interpolate` methods to produce instant-cut transitions rather than animated ones. The flag is also part of the cache key, ensuring users with reduced motion preferences get a correctly baked track without animation.

---

## 16. Breaking Change Assessment

**Current status: no breaking changes defined.** This PRD documents the existing, stable compiler pipeline.

Any future change to the following constitutes a breaking change requiring a major semver bump in `@brewsite/core`, which cascades to a required major bump in `@brewsite/diagram`:

- Removing or renaming any field on `SceneTrack`, `SceneTrackTick`, `SceneFrame`, or `SceneFrameDelta`.
- Changing the signature of `compileSceneTrack` or `CompileSceneTrackOptions` in a way that is not backward-compatible.
- Changing `ElementTransitionSpec` or `FunctionalTransitionSpec` method signatures.
- Changing the `transitionT` function signature.
- Removing or renaming any blend helper exported from `transitionTypes.ts`.
- Changing the `registerNode` or `getNodeHandler` function signatures.
- Changing the `CUSTOM_NODE_HANDLER` symbol contract.
- Changing the `SceneSnapshotContext` shape in a non-additive way.
- Changing the `CompileApi` or `CompileHelpers` interface shapes.
- Changing the `__input_controller` widget ID used to store `InputController` state.
- Changing `ProgressManagerSpec`, `SceneProgressSegment`, or `SceneProgressProfile` shapes.
- Changing the `buildProgressProfile` algorithm in a way that alters existing `SceneTrack.progressProfile` output for scenes without explicit `<ProgressManager>` declarations.
- Changing the `compileChildrenSeparated` classification rules (what counts as a DSL child vs. an overlay child).

---

## 17. Dependencies

- `react` (peer) — `isValidElement`, `Children`, `Fragment`. No hooks, no reconciler.
- `packages/core/src/widget/WidgetRegistry` — consumed by `compileSceneTrack` and `resolveSceneFromDsl`.
- `packages/core/src/labels/types` — `LabelResolved`.
- `packages/core/src/input/types` — `InputActionType`, `InputActionMap`, `SceneInputControllerSpec`, and related types.
- `packages/core/src/widget/VariableStore` — `JsonPrimitive` type.
- `packages/core/src/timeline/math` — `clamp01` utility used in the sampler.
- No Three.js dependency. No external animation libraries. No HUD library dependencies.

No Three.js dependency. No external animation libraries.

---

## 18. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cache key collision causing stale tracks after widget registry changes | High | `WidgetRegistry.buildCacheKey()` includes clip metadata. Test that cache misses correctly on registry mutation. |
| `JSON.stringify` failing on circular widget state | Medium | The serializer catches and warns on stringify errors, returning `''` as a fallback. Any widget with circular state will produce false "changed" deltas every frame — acceptable degradation. |
| `FunctionalTransitionSpec` closures capturing stale state | Medium | Closures capture `fromState` and `toState` at compile time. The authored state is immutable after `compileSceneTrack` returns. No mutation risk post-compilation. |
| `displayName` fallback causing wrong handler dispatch with duplicate names | Low | `displayName` is a secondary index. Component-reference lookup takes priority. Duplicate display names produce ambiguous secondary lookups only, which fall through gracefully. |
| `blockSize = 1` causing single-frame transition blocks with degenerate enter/exit splits | Low | `mid = Math.floor(1 / 2) = 0` — the exit slice is empty; the enter slice is the full single frame. Transition spec `enter([singleFrame], ...)` implementations must handle len=1 gracefully. `transitionT(0, 1)` returns `1` by contract. |
| Large SceneTrack memory footprint for long experiences (many scenes, large block sizes) | Medium | Document memory budget per track. Recommend keeping `blockSize` ≤ 120 for typical use. Future optimization: sparse state representation for static widgets. |

---

## 19. Open Questions

1. Should `SceneFrame.materialMetalnessMultiplier` and `materialRoughnessMultiplier` be moved out of `SceneFrame` and into the Camera widget state, given that material multipliers are conceptually a rendering concern co-located with the camera's post-processing pipeline?
2. Should `compileLabels` interpolate label opacity between enter/exit states, or is hard-cut the correct behavior for label appearance at scene boundaries?
3. Should `buildSceneTrackKey` include the `scenes[i].getFrame.toString()` source to invalidate the cache when scene DSL function bodies change (e.g., during development), or is the widget registry key sufficient?
4. Should `FunctionalTransitionSpec` closures be required to be pure functions (no external state captures), and if so, should the compiler provide a linting mechanism to detect impure closures?

---

## 20. Launch Criteria

- `compileSceneTrack` has unit test coverage for: single-scene track, two-scene interpolation, three-scene with enter/exit, functional transition path, `prefersReducedMotion` path, passthrough widget backfill, `compileExtra` pass, label compilation, and delta computation.
- `buildProgressProfile` has unit tests covering: all-default scenes (no ProgressManager → absent profile), single scene with custom scrollUnits, multiple scenes with varying scrollUnits, custom fn carry-forward, invalid fn(0)≠0 warning, invalid fn(1)≠1 warning, scrollUnits≤0 warning.
- `compileChildrenSeparated` has unit tests covering: all DSL children, all overlay children, mixed DSL and overlay children, Fragment-wrapped overlay children, null/undefined/boolean children ignored.
- `createSceneTrackSampler` has unit test coverage for boundary conditions: progress = 0, progress = 1, progress = 0.5, and floating-point values at half-step boundaries.
- `sceneTrackCache.ts` has unit tests for key construction, cache hit, cache miss, and cache clear.
- All blend helpers in `transitionTypes.ts` have unit tests covering undefined inputs, single-defined inputs, both defined, and edge cases (`blendColor` with invalid hex, `blendAxisRotation` near-parallel quaternions).
- `apps/examples/` compiles with zero TypeScript errors under `pnpm typecheck`.
- At least one example in `apps/examples/` demonstrates a `FunctionalTransitionSpec` widget.
- At least one example in `apps/examples/` demonstrates `<ProgressManager>` with a non-trivial `fn` and multiple `scrollUnits`.
- CHANGELOG entry written for the current release version documenting any API changes since the prior release.
