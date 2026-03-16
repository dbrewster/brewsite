---
title: "@brewsite/core Public API Simplification Recommendations"
doc_type: note
status: draft
owner: Toolkit Product
last_updated: 2026-03-15
change_history:
  - date: 2026-03-09
    author: Toolkit Product (PM-2 draft)
    summary: >
      Initial draft. Aggressive simplification analysis of the full @brewsite/core
      public API surface. Covers player, hooks, widget SDK, compiler DSL, input,
      runtime, layout, math, and element exports. PM-1 validation pending.
  - date: 2026-03-09
    author: Toolkit Product (PM-1/PM-2 joint review)
    summary: >
      PM-1 challenge round applied. Five concrete fixes: (1) §3.3 tree-shaking argument
      corrected — named exports stay, move to sub-path not namespace; (2) §1.5 strengthened
      with explicit useScrollToScene recommendation; (3) §6.2 flagged as blocked on v2 input
      component API design; (4) §14 cross-package coordination block added; (5) §12.2
      WHY note added for scene key constants. Multiple PM-1 concessions incorporated
      (TimelineWidget confirmed devtools, scene key constants confirmed internal, etc.).
---

# `@brewsite/core` Public API Simplification Recommendations

This document catalogs concrete recommendations for reducing the `@brewsite/core` public API
surface area. Scope is the complete published API — everything exported from
`packages/core/src/index.ts` and its sub-barrels.

Design posture: we are designing from scratch. Nothing is sacred. Every export must justify
its presence against the question: "Does a real toolkit consumer need this, or is it an
implementation detail that leaked?"

---

## 1. Player Layer

### 1.1 Delete: `EngineProvider`, `EngineInputRegion`, `ScenePlayer`, `ScrollCaptureSection`

- **What**: The four v1 player components.
- **Why cut**: Replaced by `SceneEngine`, `ScrollStage`, input components, and `SceneReel` per
  the v2 composable player architecture. These are the root cause of every layout workaround.
- **Tradeoff**: `apps/examples/`, `apps/website/`, and `apps/docs/` (~50+ files total) require
  migration. `MIGRATION.md` covers every v1 pattern with a v2 equivalent.

---

### 1.2 Delete: `useEngineScroll`, `useEngineInput`

- **What**: Internal hooks that drove scroll progress and input controller attachment.
  `useEngineScroll` — 200-line hook managing window/element scroll listeners, progress mapping,
  and `scrollTo` navigation. `useEngineInput` — wraps `useEngineScroll` and adds
  `InputController`/`ActionInputController` attachment logic with 15 config props.
- **Why cut**: Their responsibilities move into `ScrollInput`, `KeyboardInput`, and
  `PointerInput` components. The 15-prop `UseEngineInputOptions` type is replaced by
  small, focused prop interfaces on each input component.
- **Tradeoff**: Any consumer who imported and called these hooks directly must migrate to the
  input component equivalents. Based on codebase grep, these hooks are not used in
  `apps/examples/` or `apps/website/` directly — they're internal to the engine.

---

### 1.3 Consolidate: `useEngineState` + `useSceneEngineState(id)` → single `useEngineState(id?)`

- **What**: Two hooks with overlapping roles.
  - `useEngineState()` — reads `EngineStateContext` (must be inside `SceneEngine` tree).
    Returns `{ tickIndex, progress, sceneId, sceneIndex, sceneProgress }`.
  - `useSceneEngineState(id: string)` — reads `ScenePlayerRegistry` by id via
    `useSyncExternalStore`. Works from anywhere in the React tree. Returns `SceneEngineSnapshot`.
- **Why consolidate**: Same conceptual operation ("give me the current engine state"), two
  different mechanisms. `useEngineState(id?)` — if `id` is provided, reads from registry
  (cross-tree); if omitted, reads from context (in-tree). One hook, one mental model.
- **Tradeoff**: `SceneEngineSnapshot` and `EngineState` types currently have different shapes.
  They need to be unified into one return type. **Critical constraint**: the unified return
  type MUST expose `tickIndex` at the top level — `LandingPage.tsx` reads
  `engine.frameState.tickIndex < 0` for loading state detection. The new hook must provide
  this as `const { tickIndex } = useEngineState()` — not nested under `frameState`.

---

### 1.4 Make Internal: `useSceneEngine`

- **What**: `useSceneEngine` is exported publicly but is the internal hook that powers
  `SceneEngine` (the component). It accepts 20+ options and returns the full `EngineState`
  object.
- **Why make internal**: No external consumer should be instantiating engine state directly —
  that's what `SceneEngine` is for. Exposing `useSceneEngine` creates an undocumented second
  way to create an engine that bypasses the component tree and context provision.
  `UseSceneEngineResult` type export can also be removed.
- **Tradeoff**: Any consumer who used `useSceneEngine` directly (unusual — requires deep
  framework knowledge) would need to switch to `SceneEngine`. No known usage in apps.

---

### 1.5 Keep Public + Augment: `EngineContext`, `useSceneEngineContext` + add `useScrollToScene`

- **What**: The raw React context object (`EngineContext`) and its typed consumer hook
  (`useSceneEngineContext`). Both are exported publicly.
- **Keep `useSceneEngineContext` as explicitly documented public API.** Real consumer code
  in `apps/website/src/landing/nav/NavMenu.tsx` and `LandingPage.tsx` uses it for three
  capabilities: `engine.scrollToProgress()` (programmatic nav), `engine.sceneIds`
  (index lookup), and `engine.frameState.tickIndex` (loading detection). These are legitimate
  consumer needs with no current alternative.
- **Add: `useScrollToScene(sceneId: string): void`** — a new convenience hook that handles
  the index-lookup + scrollToProgress pattern that every sidebar/nav consumer will repeat:
  ```ts
  // Before (consumer must reach for raw engine context):
  const engine = useSceneEngineContext();
  const index = engine.sceneIds.findIndex(id => id === sceneId);
  const progress = index / (engine.sceneIds.length - 1);
  engine.scrollToProgress(progress);

  // After (one hook, no raw engine object needed for the common case):
  const scrollToScene = useScrollToScene();
  scrollToScene('hero');
  ```
  Once `useScrollToScene` exists, `useSceneEngineContext` becomes a true escape hatch for
  genuinely advanced consumers rather than a crutch for the common nav pattern.
- **`EngineContext` (the raw context object)**: Make internal. Consumers use hooks, not
  raw contexts. No known external usage of `EngineContext` directly.
- **Tradeoff**: `useScrollToScene` is a new export that must be maintained. The
  alternative is every consumer writing the same 3-line index/progress calculation.

---

### 1.6 Move to `@brewsite/core/devtools`: `CameraControlPanel`, `CameraInteractionInfoDialog`, `SceneInspector`

- **What**: Three dev-tool components already marked `@deprecated` in `player/index.ts` with
  the note "Import from `@brewsite/core/devtools` instead."
- **Why cut from main barrel**: They're already deprecated. A dev tool that is imported by
  production bundles when consumers do `import { ... } from '@brewsite/core'` adds unnecessary
  bundle weight. Move to a dedicated sub-path entry point only.
- **Tradeoff**: Consumers who import from the main barrel get a type error at upgrade. Simple
  import path change. Already flagged as deprecated so this is expected.

---

### 1.7 Evaluate: `useEngineScrubber`

- **What**: A thin hook that wraps `scrollToProgress` + `getGlobalProgress` with `isScrubbing`
  state. 30 lines of code. Returns `{ progress, isScrubbing, startScrub, stopScrub, setProgress }`.
- **Why consider cutting**: With `ControlledInput` in v2, the scrubber pattern (external
  component drives progress) is handled by `<ControlledInput value={p} onChange={setP} />`.
  `useEngineScrubber` becomes unnecessary boilerplate around `useState`.
- **Tradeoff**: Consumers building custom scrubber UIs would need to write the `isScrubbing`
  state themselves (3 lines). Marginal. **Recommendation: cut** — it adds no capability that
  `ControlledInput` + `useState` doesn't provide in fewer lines.

---

### 1.8 Evaluate: `TimelineWidget`

- **What**: A consumer-facing timeline/progress visualization component exported from the
  player barrel. Shows tick marks, scene stops, and playhead position.
- **Why evaluate**: Is this actually used by external consumers, or only internally for
  development? If it's a dev/debug tool, it belongs in `@brewsite/core/devtools`, not the
  main barrel.
- **Decision**: Move to `@brewsite/core/devtools`. Grep confirms it only appears in
  `apps/docs/src/pages/core/ScenePlayerRef.tsx` (a docs reference page) and core package
  internals. No production consumer usage.
- **Tradeoff**: Docs page import path changes. Expected — it's a dev tool.

---

### 1.9 Delete: `computeContainerDims` from `EngineARContainer`

- **What**: A utility function exported alongside `EngineARContainer` that computes
  constrained container dimensions given an aspect ratio and scale mode.
- **Why cut**: This is a layout math utility, not a React component API. If consumers need
  this calculation, they write it (10 lines of arithmetic). Exporting it from the player layer
  implies it's a stable public contract when it's really an implementation detail of
  `EngineARContainer`.
- **Tradeoff**: Any consumer using `computeContainerDims` directly must inline the math.
  No known external usage.

---

### 1.10 Evaluate: `ViewportScaleContext`, `EngineARContainerContext`

- **What**: Two React context objects exported from `EngineARContainer`.
- **Why evaluate**: Are external consumers reading these contexts, or is this only used
  internally by `EngineInputRegion`/`ScrollStage`?  `EngineInputRegion` (v1) reads
  `EngineARContainerContext` to get `computedArHeight`. In v2, `ScrollStage` and `SceneReel`
  will do the same. There is no reason consumers need direct access to these context objects.
- **Recommendation**: Make both internal. Expose `useEngineARContainerState()` if consumers
  need the AR-computed height.

---

## 2. Hook API

### 2.1 Delete: `SceneRuntimeState` type re-export

- **What**: `SceneRuntimeState` is re-exported from `player/index.ts` via
  `export type { SceneRuntimeState } from './ScenePlayerRegistry'`. It's the type that
  `useSceneRuntime` returns.
- **Why evaluate**: `ScenePlayerRegistry` is an internal module. Exporting its types via the
  player barrel is an accidental leak. The type is accessible via `ReturnType<typeof useSceneRuntime>`.
  If it's needed externally, re-export it with a better name from a non-implementation-detail source.

---

### 2.2 Rename: `useSceneRuntime` — clarify intent

- **What**: `useSceneRuntime(id: string)` returns `SceneRuntimeState` — assets loaded status,
  viewport dimensions, variable store reference, scene count.
- **Why rename**: The name "runtime" is overloaded (there's also `RuntimeDriver`, `RuntimeLoop`).
  `useSceneStatus(id)` or `useEngineStatus(id)` better describes what it returns.
- **Tradeoff**: Import path change for consumers using it.

---

## 3. Compiler DSL Layer

### 3.1 Delete: `blendNumber`, `blendOpacity`, `blendVec3`, `blendColor`, `transitionT`, `blendAxisRotation`, `blendAxisTranslation`, `resolveEnabledByOpacity`

- **What**: 8 blend math functions exported from the root `index.ts`. They live in
  `compiler/transitions/transitionTypes.ts` and are used internally in `FunctionalTransitionSpec`
  closures authored by widget implementors.
- **Why cut from main barrel**: These are widget-author primitives, not scene-author primitives.
  They have no business in the same import path as `<Scene>`, `<Camera>`, or `<Lighting>`.
  Scene authors never call `blendVec3` — widget authors do.
- **Recommendation**: Move to a dedicated sub-path: `@brewsite/core/widget-utils` or
  `@brewsite/core/transitions`. Scene authors import from `@brewsite/core`. Widget authors
  import from `@brewsite/core/widget-utils`.
- **Tradeoff**: `@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts` likely import
  these. Their import paths would change from `@brewsite/core` to `@brewsite/core/widget-utils`.

---

### 3.2 Delete: `makeResolver`, `makeSimpleContext`

- **What**: Internal compiler utilities for evaluating `FunctionalTransitionSpec` closures.
  Exported from compiler `index.ts`.
- **Why cut**: These are used by widget authors to implement `FunctionalTransitionSpec`. Like
  the blend functions above, they belong in a widget-author sub-path, not the main barrel.
  Scene authors should never import these.
- **Tradeoff**: Same as 3.1 — move to `@brewsite/core/widget-utils`.

---

### 3.3 Move to Sub-path: 7 Named Easing Functions → `@brewsite/core/easing`

- **What**: 7 individual easing function exports:
  `easeLinear`, `easeOutCubic`, `easeOutExpo`, `easeInOutSine`, `easeInOutCubic`,
  `easeInSquared`, `easeOutQuart`.
- **Why move**: These functions add noise to the main barrel but are not needed in the typical
  scene authoring import. Scene authors who write custom transition easing do need them —
  they belong on a focused sub-path, not the kitchen-sink barrel.
- **Keep as named exports — do NOT collapse to a namespace object.** Named exports are
  individually tree-shakeable: a consumer who imports only `easeOutCubic` gets only that
  function. A namespace object (`Easing.outCubic`) is NOT tree-shakeable at the function
  level — the whole object is included. Named exports also autocomplete better in IDEs.
  ```ts
  // Current (too prominent on main barrel):
  import { easeOutCubic } from '@brewsite/core';

  // After (focused sub-path, named exports kept):
  import { easeOutCubic } from '@brewsite/core/easing';
  ```
- **`EaseFn` type and `TransitionName`/`SceneTransitionProp`**: Remain on the main barrel —
  they are used in DSL authoring prop types.
- **Tradeoff**: Import path change for any consumer currently using easing functions.
  The functions themselves are unchanged.

---

### 3.4 Delete: `resolveSceneFromDsl`

- **What**: Exported from `compiler/index.ts`. Called internally by the compiler pipeline to
  extract scene specs from JSX.
- **Why cut**: This is a compiler internal. No scene author needs to call `resolveSceneFromDsl`
  — the `SceneEngine` component handles this automatically.
- **Tradeoff**: None expected — no known external usage.

---

### 3.5 Move to sub-path: `registerNode`

- **What**: `registerNode` is the compiler's DSL node handler registration function. Exported
  from the main barrel.
- **Why move**: This is a plugin/widget-author API, not a scene-author API. Scene authors never
  call `registerNode`. It belongs in a `@brewsite/core/plugin` or `@brewsite/core/widget-utils`
  sub-path alongside `WidgetPlugin`, `CUSTOM_NODE_HANDLER`, and the type guards.
- **Tradeoff**: Import path change for widget authors and sub-packages.

---

### 3.6 Delete or Move: `SceneSnapshotContext`, `Resolvable`, `CompileApi`, `CompileHelpers`, `NodeHandler`

- **What**: Types exported from the compiler barrel that are implementation-detail contracts
  for widget/plugin authors.
  - `SceneSnapshotContext` — compiler context passed to snapshot functions
  - `Resolvable` — union type for runtime-resolvable DSL values
  - `CompileApi`, `CompileHelpers`, `NodeHandler` — compiler pipeline interfaces
- **Why move**: These are authored by widget implementors building custom DSL nodes. They're
  not needed by scene authors. Move to `@brewsite/core/plugin` sub-path.
- **Tradeoff**: Import path change for widget authors and `@brewsite/diagram`/`@brewsite/model`.

---

## 4. Widget SDK

### 4.1 Delete: `ICameraActionTarget`

- **What**: Interface for widgets that handle camera orbit/dolly/reset actions. Already marked
  `@deprecated` in `widget/types.ts` with the note "migrate to `ActionInputController`'s
  `onUnknownAction` callback pattern."
- **Why cut**: No built-in widget implements it. The `@deprecated` JSDoc says it will be
  removed. Clean cut now since we're already doing a major version.
- **Tradeoff**: Any custom widget implementing `ICameraActionTarget` must migrate to
  `onUnknownAction`. The callback pattern is strictly more capable.

---

### 4.2 Move to sub-path: All 16 Type Guard Functions

- **What**: `isSceneElement`, `isRenderable`, `isLoadable`, `isRendererLifecycle`,
  `isRenderContributor`, `isContainedRenderable`, `isAttachmentHost`, `isDslComposite`,
  `isAnimationController`, `isCameraActionTarget`, `isVariableProvider`, `isSceneLifecycle`,
  `isInputDefaultProvider`, `isCameraFocusTarget`, `isLightingOverride`, `isExtraRenderPass`.
  16 type guard functions exported from the widget barrel.
- **Why move**: These are runtime dispatch utilities used internally by `RuntimeDriverImpl`
  to route ticks, renders, loads, etc. to the correct widgets. Widget authors may use a few
  of them when building composite widgets. Scene authors never use them.
  They add significant visual noise to the `@brewsite/core` namespace.
- **Recommendation**: Move to `@brewsite/core/plugin` or `@brewsite/core/widget-utils`.
  Keep the underlying interface types on the main barrel (consumers may `instanceof` check
  or type-narrow without calling the guard functions).
- **Tradeoff**: Import path change for `RuntimeDriverImpl` (internal), `@brewsite/diagram`,
  `@brewsite/model`, and any custom widget authors.

---

### 4.3 Delete: `isCameraActionTarget` specifically

- **What**: Type guard for the deprecated `ICameraActionTarget` interface.
- **Why cut**: Both the interface and its guard are deprecated. Cut together.

---

### 4.4 Evaluate: `NVSCoordService` type on widget context

- **What**: `NVSCoordService` is exported as part of the widget types barrel. It's the
  interface for the NVS coordinate service passed to widgets via `WidgetRenderContext`.
- **Why evaluate**: Is this type needed by scene authors, or only by widget authors who
  implement `IRenderable.apply()`? If only widget authors need it, it belongs in the
  widget-utils sub-path.
- **Recommendation**: Move to `@brewsite/core/plugin`.

---

### 4.5 Evaluate: `VariableStoreReader` type export

- **What**: `VariableStoreReader` — read-only interface for `VariableStore`. Exported from
  the widget barrel.
- **Why evaluate**: This is used by `IVariableProvider` implementors and consumers calling
  `useVariable()`. It's a legitimate public type. Keep it on the main barrel.
- **Recommendation**: Keep.

---

## 5. Runtime Layer

### 5.1 Make Internal: `RuntimeDriverImpl`, `RuntimeLoop`, `RuntimeDriver`

- **What**: `RuntimeDriverImpl` — the concrete runtime class. `RuntimeLoop` — the RAF loop.
  `RuntimeDriver` — the interface. All three exported from `runtime/index.ts`.
- **Why make internal**: `SceneEngine` is the public entry point for the engine. No consumer
  should be instantiating a `RuntimeDriverImpl` directly. These are implementation details.
  Exporting them creates an undocumented advanced API that cannot be changed without a major bump.
- **Exception**: `@brewsite/diagram` and `@brewsite/model` may import `RuntimeDriver` type
  for type annotations on widgets. If so, move it to `@brewsite/core/plugin`.
- **Tradeoff**: Any consumer doing custom runtime instantiation must use `SceneEngine` instead.
  No known external usage.

---

### 5.2 Make Internal: `SceneTrackSampler`, `RuntimeConfig`, `RuntimeFrame`, `RuntimeLoopOptions`

- **What**: Companion types to `RuntimeDriverImpl` and `RuntimeLoop`.
- **Why make internal**: Same reasoning as 5.1. These are implementation-detail types.
- **Tradeoff**: None expected.

---

### 5.3 Move to sub-path: `AnimationTrack`

- **What**: `AnimationTrack` is exported from `runtime/types.ts` and re-exported from the
  root `index.ts` with the comment "eliminates @brewsite/model deep sub-path imports."
- **Why move**: This type is used by `@brewsite/model` for GLTF animation data. It's a
  cross-package contract, not a scene-author type. Move to `@brewsite/core/plugin`.
- **Tradeoff**: `@brewsite/model` import path changes from `@brewsite/core` to
  `@brewsite/core/plugin`.

---

## 6. Input Layer

### 6.1 Make Internal: `SceneNavInputController` (alias of `InputController`), `ActionInputController`

- **What**: `SceneNavInputController` is `InputController` re-exported under a different name.
  `ActionInputController` handles action-mapped camera/canvas input.
  Both exported from `input/index.ts`.
- **Why make internal**: In v2, input is handled by `ScrollInput`, `KeyboardInput`,
  `PointerInput` components. These underlying controller classes become implementation details
  of those components. Scene authors never instantiate `InputController` directly.
- **Tradeoff**: Custom widget authors who build their own input handling (e.g., a custom
  `ActionInputController` usage) would need an alternative. Add `ActionInputController` to
  the `@brewsite/core/plugin` sub-path if needed.

---

### 6.2 Prune: Input Type Exports — defer until v2 input component prop interfaces are finalized

- **What**: 17 input types exported: `SceneNavInputMap`, `WheelConfig`, `DragConfig`,
  `SwipeConfig`, `ClickConfig`, `SceneNavKeys`, `KeyCombo`, `ModifierKey`,
  `InputNavigationHandler`, `MouseButton`, `SceneInputControllerSpec`, `InputControllerScope`,
  `InputActionType`, `InputActionSpec`, `InputActionMap`, `InputPointerMap`, `InputWheelMap`,
  `InputPinchMap`, `InputKeyMap`.
- **Intent**: Reduce to ~6 types needed on main barrel. Many of these are internal controller
  configs that belong in `@brewsite/core/plugin`.
- **⚠️ BLOCKED — defer until v2 input component API is finalized.** The v2 player redesign
  introduces `ScrollInput`, `KeyboardInput`, `PointerInput`, `ControlledInput` as public
  components. Their prop interfaces are not yet fully specified. Any type that appears directly
  in a public component prop (e.g., `KeyboardInput.inputMap: SceneNavInputMap`) MUST stay
  on the main barrel regardless of whether it feels "internal." If `SceneNavKeys`, `KeyCombo`,
  or `ModifierKey` are referenced in those prop types, they cannot be pruned without breaking
  prop authoring.
- **Rule**: After v2 input component API is designed, audit which types appear in any public
  component prop. Those stay on main barrel. Everything else can move to `@brewsite/core/plugin`.
- **Likely safe to move regardless** (not exposed in any prop type):
  `WheelConfig`, `DragConfig`, `SwipeConfig`, `ClickConfig`, `InputNavigationHandler`,
  `MouseButton`, `InputControllerScope`, `InputActionType`.
- **Tradeoff**: Deferring means this doesn't land in v2. Plan for v2.1 or a follow-up pass.

---

### 6.3 Delete: `SceneNavInputMap.mode: 'scroll' | 'direct'`

- **What**: The `mode` field on `SceneNavInputMap` was the v1 input mode branching flag
  (`'scroll'` vs `'direct'`). The v2 input component model makes this distinction implicit
  (you add `<ScrollInput>` or not).
- **Why cut**: The field is now meaningless. Keeping it creates confusion about whether
  consumers still need to set it.
- **Tradeoff**: Any consumer who set `mode: 'scroll'` or `mode: 'direct'` on their input
  map gets a TypeScript error at upgrade. Simple migration: remove the field.

---

## 7. Layout Layer

### 7.1 Evaluate: NVS coordinate bridge functions

- **What**: `nvsToWorldAnalytic`, `worldToNvsAnalytic`, `nvsToWorldWithCamera`,
  `worldToNvsWithCamera`, `computeWorldDimensions`, `computeWorldDimensionsFromCamera`.
  6 functions exported from `layout/index.ts`.
- **Why evaluate**: These are used by `@brewsite/diagram` for NVS→world coordinate mapping.
  They are NOT scene-author utilities — scene authors don't call coordinate bridges. They
  should be in the `@brewsite/core/plugin` sub-path, not the main barrel.
- **Exception**: If `@brewsite/diagram` imports them from `@brewsite/core` (it does), and
  we move them, `@brewsite/diagram`'s import paths change. This is acceptable.
- **Recommendation**: Move to `@brewsite/core/plugin`.

---

### 7.2 Evaluate: NVS validation functions

- **What**: `validateNVSScalar`, `validateNVSRect`, `validateNVSPosition`.
- **Why evaluate**: These are used internally for validation during NVS coordinate operations.
  No scene author calls `validateNVSScalar`.
- **Recommendation**: Make internal (not exported at all, or move to `@brewsite/core/plugin`
  for widget authors who build NVS-positioned elements).

---

### 7.3 Keep: `NVSRect`, `NVSPosition`, `INVSBounded`, `NVSCameraParams`, `createNVSCoordService`, `resolveNVSParamsFromCameraState`

- **What**: The NVS type definitions, camera params type, and coord service factory.
- **Why keep**: These ARE used by widget authors to declare NVS-bounded elements and create
  coordinate services. `createNVSCoordService` accepts `NVSCameraParams` (pure math, no Three.js)
  and `resolveNVSParamsFromCameraState` extracts params from compiled `SceneCamera` state.
  They should remain accessible, either on the main barrel or in `@brewsite/core/plugin`.

---

## 8. Math Layer

### 8.1 Keep: Core math types and functions — but evaluate `composeMatrix`, `decomposeMatrix`, `multiplyMatrices`

- **What**: `Vec3`, `Mat4`, `Quaternion`, `clamp01`, `lerp`, `lerpVec3`, `quatFromEuler`,
  `quatNormalize`, `quatSlerp`, `quatMultiply`, `quatToEuler`, `composeMatrix`,
  `decomposeMatrix`, `multiplyMatrices`, `copyVec3`.
- **What to keep**: `Vec3`, `Mat4`, `Quaternion`, `clamp01`, `lerp`, `lerpVec3` — genuinely
  useful in scene DSL authoring and widget render code.
- **What to evaluate**: `composeMatrix`, `decomposeMatrix`, `multiplyMatrices`, `quatFromEuler`,
  `quatNormalize`, `quatSlerp`, `quatMultiply`, `quatToEuler`, `quatToEuler`, `copyVec3` —
  these are Three.js-adjacent matrix/quat math that is only useful in `render.ts` files.
  Scene authors never compose matrices. These are widget-author utilities.
- **Recommendation**: Move matrix/quat functions to `@brewsite/core/plugin` or
  `@brewsite/core/math`. Keep `Vec3`, `Mat4`, `Quaternion`, `clamp01`, `lerp`, `lerpVec3`
  on main barrel.

---

## 9. Timeline Layer

### 9.1 Make Internal: `createSceneTimeline`, `createQualityTimeline`, `SceneTimeline`

- **What**: `createSceneTimeline` — factory for the timeline algebra used by the compiler.
  `createQualityTimeline` — variant for quality tier system. `SceneTimeline` — the type.
  All exported from `timeline/index.ts`.
- **Why make internal**: These are compiler implementation details. Scene authors never create
  timelines — the compiler does. Exporting them suggests consumers can or should create
  timelines directly, which they should not.
- **Tradeoff**: None expected — no known external consumer of these functions.

---

## 10. Text Layer

### 10.1 Evaluate: `ensureText`, `TextWithLayout`

- **What**: `ensureText` — utility exported from `text/TextRenderer`. `TextWithLayout` —
  type from `text/types`. Both re-exported from root `index.ts`.
- **Why evaluate**: These appear to be used by `@brewsite/diagram` or `@brewsite/model` for
  3D text rendering. If so, they belong in `@brewsite/core/plugin`.
- **Action needed**: Grep for usages. If only in sub-packages, move to plugin sub-path.

---

## 11. Theme Layer

### 11.1 Keep: `SceneTheme` and related types

- **What**: `SceneTheme` is used on the `SceneEngine.sceneTheme` prop — a legitimate
  consumer-facing prop. Keep on main barrel.

---

## 12. Elements Layer

### 12.1 Delete: `EaseFnName` from Camera element

- **What**: `EaseFnName` — a union type of camera easing function names, exported from the
  camera element.
- **Why evaluate**: Is this used in scene DSL authoring (consumers write `easeFn="easeOutCubic"`)
  or only in widget internals? If it's a DSL prop type, it stays. If it's an internal enum,
  cut it.
- **Action needed**: Check if `Camera` DSL props use `EaseFnName` — if so, keep.

---

### 12.2 Make Internal: Scene key constants `SCENE_CAMERA_KEY`, `SCENE_LIGHTING_KEY`, etc.

- **What**: 5 exported string constants: `SCENE_CAMERA_KEY`, `SCENE_LIGHTING_KEY`,
  `SCENE_BACKGROUND_KEY`, `SCENE_ENVIRONMENT_KEY`, `SCENE_FLOOR_KEY`.
- **Why cut**: Grep confirms zero usage in `apps/examples/` or `apps/website/`. They only
  appear in `packages/core/src/elements/` — they are widget registration identifiers.
- **Why they're internal by design**: These constants are the `widgetId` strings used when
  registering built-in widgets in the `WidgetRegistry`. They are NOT DSL authoring tokens.
  Scene authors reference camera, lighting, floor, etc. through DSL components (`<Camera>`,
  `<Lighting>`, `<Floor>`) — never by string ID. Exporting these constants implies consumers
  can use them to reference widgets programmatically, which is not a supported or documented
  pattern. Keeping them public risks consumers building coupling to internal widget IDs.
- **Tradeoff**: None — zero known external consumer usage.

---

## 13. Sub-path Entry Points — Proposed Structure

The above recommendations imply creating sub-path exports in `package.json` to organize the
API tiers. Proposed:

```json
"exports": {
  ".": "./dist/index.js",          // Scene authors — DSL components, hooks, player primitives
  "./plugin": "./dist/plugin.js",  // Widget/plugin authors — interfaces, type guards, compiler internals
  "./devtools": "./dist/devtools.js" // Dev tools — CameraControlPanel, SceneInspector, TimelineWidget
}
```

**Main barrel (`.`)** exports: player components, consumer hooks, DSL elements, easing presets,
`WidgetPlugin`, `corePlugin()`, `Vec3`/`Mat4`/`Quaternion`, `lerp`/`clamp01`.

**Plugin sub-path (`./plugin`)** exports: widget interfaces, type guards, compiler internals,
blend functions, `registerNode`, `RuntimeDriver`, coordinate bridge functions, math utilities,
input controller types.

**Devtools sub-path (`./devtools`)** exports: `CameraControlPanel`, `CameraInteractionInfoDialog`,
`SceneInspector`, `TimelineWidget`.

---

## 14. Priority Order for Implementation

**High (do now — clean wins, no real tradeoffs):**
1. Delete deprecated `ICameraActionTarget` and `isCameraActionTarget`
2. Delete `useEngineScroll`, `useEngineInput` (replaced by input components)
3. Delete `computeContainerDims`
4. Delete `useEngineScrubber` (replaced by `ControlledInput` + `useState`)
5. Consolidate `useEngineState` + `useSceneEngineState` → `useEngineState(id?)`
6. Delete `createSceneTimeline`, `createQualityTimeline` from public exports

**Medium (do during v2 — clear separation needed):**
7. Make `useSceneEngine` internal
8. Make `RuntimeDriverImpl`, `RuntimeLoop`, `RuntimeDriver` internal
9. Move `blendNumber`/`blendVec3`/etc. + `makeResolver`/`makeSimpleContext` to `./plugin`
10. Move type guard functions to `./plugin`
11. Move `SceneNavInputController`, `ActionInputController` to `./plugin`
12. Move devtools to `./devtools` sub-path
13. Delete `SceneNavInputMap.mode` field
14. Move easing functions to `@brewsite/core/easing` sub-path (named exports, not namespace)

**⚠️ Cross-package coordination required for items 9, 10, §7.1, §10.1:**
Items 9 and 10 (`blendNumber`/`blendVec3`/etc., type guards, NVS bridge functions,
`ensureText`/`TextWithLayout`, `registerNode`) are actively imported from `@brewsite/core`
by `@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts`. Moving them to `./plugin`
requires synchronized import updates across all three sub-packages. These changes must:
- Land in the same major release as the `./plugin` entry point is created
- Be reviewed and applied to all three packages before the release ships
- Not be deferred to a follow-up — a broken sub-package import in production is a
  hard failure, not a warning

Confirm the `./plugin` sub-path exists and exports correctly before any sub-package changes begin.

**Lower (evaluate with data first):**
15. Move matrix/quat math to `./plugin` or `./math`
16. Move NVS functions to `./plugin`
17. Rename `useSceneRuntime` → `useEngineStatus`
18. Prune input types to ~6 on main barrel — **defer until v2 input component props finalized** (see §6.2)

---

*PM-1: challenge any recommendation that would silently break real consumer patterns
identified in your `apps/` code analysis. Specifically flag anything that touches
`engine.scrollToProgress()`, `engine.sceneIds`, `engine.frameState.tickIndex`,
`EngineARContainer`, or `useCurrentScene()` return shape.*
