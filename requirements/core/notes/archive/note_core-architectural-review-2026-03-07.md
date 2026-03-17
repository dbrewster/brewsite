---
title: Note — @brewsite/core Architectural & Product Review
doc_type: note
owner: engineering
status: draft
updated: 2026-03-07
---

# @brewsite/core — Architectural & Product Review

Date: 2026-03-07
Reviewers: Architect agent + PM agent (team core-review)

This note records findings from a full deep-read of `packages/core/src/` and a trace of all downstream imports in `@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts`. Findings are grouped by the five review questions.

---

## Q1 — Are the Abstractions Correct?

**Verdict: The layer map is sound but four abstraction leaks need to be fixed.**

### CRITICAL — `scene.userData` is being used as an informal inter-widget message bus

`useSceneEngine.ts` (lines 774–777) writes `__brewsite_camera`, `__brewsite_renderer`, and `__brewsite_camera_override` onto `THREE.Scene.userData`. `CameraWidget.ts` reads all three, plus writes and reads `__brewsite_cam_enabled` and `__brewsite_camera_focus`. `DiagramCanvasWidget` (in `@brewsite/diagram`) writes `__brewsite_camera_focus` to request a focus operation from CameraWidget. There are at least six undocumented stringly-typed keys in use across the package boundary.

This is the single worst abstraction violation in the package. `VariableStore` already exists for cross-widget state sharing and `WidgetInitContext.renderer` already exists for renderer injection. All `__brewsite_*` keys should be eliminated:
- Renderer and camera refs → inject through `WidgetInitContext`
- Focus request channel → `ICameraFocusTarget` interface or `VariableStore`
- Camera override state → typed interface on `WidgetInitContext` or a new `ICameraOverrideTarget`

### HIGH — Player layer imports concrete `CameraWidget`

`player/useSceneEngine.ts` lines 27–29 import `CameraWidget` and `CameraOverrideState` from `elements/camera/`. The player layer should only hold `IWidget` interface references. The fix is extracting an `ICameraHost` interface that exposes what useSceneEngine needs (`setInteractionDefaults`, `isWheelClaimedByInteraction`, override mechanism) and programming the player layer to that interface.

### HIGH — `EngineProvider` encodes model-domain knowledge

`EngineProvider.tsx` lines 137–158 fetches the asset manifest and validates it by checking for `models` and `animations` arrays. This is `@brewsite/model` domain logic embedded in core. Every `EngineProvider` consumer must provide `manifestUrl` even when not using the model plugin. `manifestUrl` should be optional, and manifest loading should be fully delegated to the model plugin's `configureRegistry()` hook.

### MEDIUM — Three.js render functions exported from `elements/index.ts`

`elements/index.ts` re-exports `setSceneLightEnabled`, `applyLighting`, `applyBackground`, `applyCamera`, `applyFloor`, `applyEnvironment`, and their associated `ThreeRefs` types. These are render-layer internals. No downstream package (`diagram`, `model`, `charts`) should be calling them directly — yet `@brewsite/diagram` calls `setSceneLightEnabled` as a workaround for disabling core scene lighting when the diagram canvas is active. The correct abstraction is a compiled state flag or `ILightingOverride` interface, not a direct Three.js call exported at the package level.

### MEDIUM — `TextBox` exported from `compiler/index.ts` (wrong layer)

`compiler/index.ts` lines 23–25 re-export `TextBox` and `TextBoxProps` from `elements/text-box`. The compiler index should export only the DSL authoring surface. `TextBox` is a player-layer overlay component. Move its export to `elements/index.ts` → `src/index.ts`.

### MEDIUM — `CameraWidget` duplicates `RuntimeDriverImpl` state resolution

`CameraWidget.onTick()` lines 228–232 manually re-evaluate functional transition closures using `blockProgress`. `RuntimeDriverImpl` already performs this resolution for all widgets. The duplication exists because `IAnimationController.onTick()` receives the raw tick, not the resolved widget state. The fix is adding a `resolvedState` accessor to `AnimationTickContext`.

### LOW — `CompileExtraContext.sceneProgress` naming mismatch

`CompileExtraContext.sceneProgress` is populated with `frame.blockProgress` at call sites in `sceneTrackCompiler.ts`. The field name implies scene-level 0→1 progress, but the value is block-level progress. This is a latent semantic bug for any widget implementing `compileExtra`. Rename to `blockProgress`. (Breaking change.)

---

## Q2 — Is the Feature Set Minimal and Non-Overlapping?

**Verdict: Four clear bloat areas plus a class of dead code throughout.**

### Dead — `ElementTransitionSpec` instances across all element compile.ts files

Every element `compile.ts` exports both a legacy `ElementTransitionSpec` (`lightingTransitionSpec`, `backgroundTransitionSpec`, `cameraTransitionSpec`, `floorTransitionSpec`, `environmentTransitionSpec`) and a `FunctionalTransitionSpec`. All five widgets use only the `FunctionalTransitionSpec` at runtime. The legacy specs are dead code. Remove from `compile.ts` files and from `elements/index.ts`.

### Wrong-layer — AnimeJS HUD presets in `hud/animejs/`

Six opinionated animation components (`Fade`, `MidFade`, `SlideUp`, `SlideDown`, `ScrollOn`, `ScrollOff`) live in `packages/core/src/hud/animejs/` and add `animejs` as a production dependency of `@brewsite/core`. No downstream package imports them. Move to `apps/examples/` as recipes. Removes `animejs` from core's bundle for all consumers. This is a breaking change for any consumer importing these from core directly.

### Wrong-layer — Dev tools in the main bundle

`CameraControlPanel`, `CameraInteractionInfoDialog`, and `SceneInspector` are exported from `player/index.ts`. They import Three.js directly, are marked `@internal` in comments, and inflate the bundle for every consumer. Move to a `@brewsite/core/devtools` subpath export.

### Dependency inversion — `diagram-canvas.*` action types in core

`InputActionType` in `input/types.ts` lines 151–154 lists `'diagram-canvas.move'`, `'diagram-canvas.rotate'`, `'diagram-canvas.reset'`, `'diagram-canvas.focus'`. `ActionInputController.ts` lines 353–429 implements dispatch for all of them. Core is implementing input handling for a downstream package's widget concept. Make `InputActionType` an open string union and move the `diagram-canvas.*` handling to `@brewsite/diagram`.

### MEDIUM — `useDefaultStateWhenAbsent` as an informal duck-typed property

`CameraWidget`, `LightingWidget`, and `BackgroundWidget` declare `readonly useDefaultStateWhenAbsent = false`. This field is not in any `IWidget` interface. It is accessed in `sceneTrackCompiler.ts` via an unsafe cast. Add an optional `disableWhenAbsent?: boolean` to `ISceneElement<TState>` and remove the cast. The current name is also misleading — the behavior is "substitute defaultState with enabled=false", not "skip state entirely."

### LOW — Dead types and aliases

- `SceneFrameState = SceneFrame` alias in `compiler/sceneTypes.ts` line 5 — unused, remove.
- `AnimationTrack` in `runtime/types.ts` — comment says it's consumed by the model element, which has moved to `@brewsite/model`. Migrate or remove.
- `EngineFrameState` vs `EngineState` in `player/engineTypes.ts` — near-identical shapes differing only in `tick` field. Unify.
- `CameraInteractionDefaults` defined identically in `player/engineTypes.ts` (lines 44–52) and `elements/camera/types.ts` (lines 267–276). Remove duplicate; keep canonical definition in `camera/types.ts`.
- `ICameraActionTarget` (`applyOrbit`/`applyDolly`/`applyReset`) — defined and type-guarded in core but no widget implements it. Audit external implementors; if none, deprecate and remove.

### LOW — Fragile `serialize()` delta detection in `sceneTrackCompiler.ts`

`JSON.stringify` is used to detect widget state changes between scenes for transition injection. This is O(n×k) at compile time and breaks for state with non-serializable values or non-deterministic key ordering. A structural equality helper or a widget-supplied `stateEquals()` hook would be more robust.

---

## Q3 — Is the Right Surface Exposed to Other Packages?

**Verdict: Exports that shouldn't be public; gaps that force @brewsite/model to deep-import.**

### Should NOT be public

| Export | Source | Reason |
|---|---|---|
| `setSceneLightEnabled` | `elements/lighting/render.ts` | Three.js render call; diagram uses it as a workaround |
| `applyLighting`, `applyBackground`, `applyCamera`, `applyFloor`, `applyEnvironment` | `elements/index.ts` | Render-layer Three.js functions; no downstream package should call these |
| `LightingThreeRefs`, `BackgroundDomRefs`, `EnvironmentThreeRefs`, `FloorThreeRefs` | `elements/index.ts` | Render-layer internal types |
| `DEFAULT_LIGHTING`, `DEFAULT_BACKGROUND`, `DEFAULT_CAMERA`, `DEFAULT_FLOOR`, `DEFAULT_ENVIRONMENT` | `elements/index.ts` | Internal compile-time defaults |
| Dead `ElementTransitionSpec` instances | `elements/index.ts` | Dead code (see Q2) |
| `registerNode` (direct re-export) | `src/index.ts` line 13 | Already comes through `export * from './compiler'`; redundant |
| `FunctionalTransitionSpec` explicit re-export | `src/index.ts` lines 11–12 | Already covered by `export * from './compiler'`; redundant |
| `corePlugin` (duplicate) | `widget/index.ts` | Already exported from `player/index.ts`; resolve to one path |

### Missing from the public API (forcing @brewsite/model to deep-import)

`@brewsite/model` currently has four sub-path imports that bypass the public API:
- `AnimationTrack` from `@brewsite/core/runtime/types`
- `Resolvable<T>` from `@brewsite/core/compiler/sceneTypes`
- `getNodeHandler` from `@brewsite/core/compiler/registry`
- Transition blend functions via direct file path

Fix: add `AnimationTrack`, `Resolvable<T>`, and `getNodeHandler` to `src/index.ts`. Migrate `AnimationTrack` out of `runtime/types.ts` to a model-adjacent location.

### Other public API gaps

- `UseSceneEngineResult` — the return type of `useSceneEngine()` is not exported from `player/index.ts`. Consumers cannot type a variable holding the engine object. Concrete TypeScript DX gap.
- `ICameraInteractionDriver` and `CameraInteractionDriverFactory` — defined in `elements/camera/types.ts` but not exported through the package barrel. Needed for custom camera backends and testing.
- `CompileWarning` type from `compiler/sceneTrackTypes.ts` — useful for downstream tooling that surfaces compiler diagnostics.
- `clearRegistry` — needed by any consumer writing compiler tests. Not in the main index. Add to a `@brewsite/core/testing` subpath export.
- `SCENE_CAMERA_KEY` is exported but equivalent constants for lighting, background, floor, and environment are not. Either export all or none.

### Hidden load-bearing contract: `EngineARContainerContext`

`@brewsite/model`'s `plugin.ts` reads `EngineARContainerContext` to get `referenceWidth` and `scaleMode` for `LabelPositioner`. This creates an invisible constraint: labels only work correctly inside `<EngineARContainer>`. Consumers using custom layouts get broken label positioning with no error. Generalize to a `ViewportScaleContext` that any layout approach can provide.

---

## Q4 — Are the Abstractions for Individual Features Correct?

**Verdict: Most are sound. Three features have specific design gaps.**

### IWidget hierarchy — correct, two formal gaps

The opt-in interface composition model (`IWidget` + `ISceneElement`, `IRenderable`, `ILoadable`, `IDslComposite`, `IAnimationController`, `IVariableProvider`, `IContainedModel`) is well-designed. The write/read asymmetry of `VariableStore` between `AnimationTickContext` and `WidgetRenderContext` is intentional and correct.

Gaps:
1. `IAnimationController.onTick()` does not deliver resolved widget state. `CameraWidget` works around this by re-implementing the runtime's state resolution (see Q1). Add a typed `resolvedState` accessor to `AnimationTickContext`.
2. `WidgetRenderContext.tick` is optional without documented reason. The optionality exists only to support pre-first-tick init calls — document this or restructure.

### WidgetRegistry — routing logic duplicated

`register()` and `registerTypeFactory()` implement nearly identical ~80-line routing logic (extract type/id props → find or create widget → dispatch to `CUSTOM_NODE_HANDLER` or default merge). Extract to a shared `dispatchToWidget()` helper.

Also: `api.pushWarning()` is called in the routing handler but is not declared in `CompileApi` in `sceneDslTypes.ts`. Confirm and fix the type.

### SceneTrack pipeline — clean, one design smell

The three-pass pipeline is well-structured. The smell: `InputController` state at step 4.5 is injected via a string ID comparison (`!sceneElementWidgetIds.has(widgetId)`) that bypasses the widget registry entirely. Either make `InputController` a proper `ISceneElement` or add an explicit named passthrough concept.

### RuntimeDriverImpl — lazy registration workaround

`initialize()` re-reads widget lists from the registry because ChartWidgets are registered inside DSL node handlers during `compileSceneTrack`, which runs after driver construction. Add a `WidgetRegistry.freeze()` method that finalizes the widget list and throws if widgets are registered after it. Call it before `RuntimeDriverImpl.initialize()` to make the ordering contract explicit.

### VariableStore, ProgressManager — no issues

Both are correctly designed and correctly located. No changes needed.

### InputController split — structurally correct, polluted by diagram types (see Q2)

The split between `InputController` (scroll/direct navigation) and `ActionInputController` (action-mapped camera/canvas input) is correct. The pollution from `diagram-canvas.*` types needs to be resolved separately (see Q2).

### `ScenePlayerRegistry` — undocumented global singleton

Two `Map<string, ...>` registries at module scope accumulate across the JS runtime. Fragile in SSR and multi-instance setups. No code change needed — document the constraint in JSDoc and README.

---

## Q5 — Are the Features Consistent?

**Verdict: Four naming/pattern inconsistencies, all fixable.**

### Mixed ElementTransitionSpec / FunctionalTransitionSpec in elements barrel

All widgets use `FunctionalTransitionSpec` at runtime, but `elements/index.ts` exports both variants for each element. Remove the dead `ElementTransitionSpec` exports to enforce the correct pattern (see Q2).

### `useDefaultStateWhenAbsent` naming misrepresents the behavior

When `useDefaultStateWhenAbsent = false`, the compiler calls `makeDisabledDefault(defaultState)` — it substitutes `enabled: false`, it doesn't skip state. The name implies "skip the default." Rename to `disableWhenAbsent: true` when formalizing in `ISceneElement`.

### Multiple redundant/duplicate exports in `src/index.ts`

- `registerNode` exported twice (direct + via `export * from './compiler'`)
- `FunctionalTransitionSpec`/`ElementTransitionSpec` explicitly re-exported on lines 11–12 AND already covered by `export * from './compiler'`
- `corePlugin` exported from both `player/index.ts` and `widget/index.ts`

All three should resolve to single canonical paths.

### `canvas.pan` as an undocumented alias

`ActionInputController.ts` has two switch-statement fall-throughs where `'canvas.pan'` resolves to `diagram-canvas.move` behavior. This alias is not in `InputActionType` and not documented anywhere. Resolve when `diagram-canvas.*` moves to `@brewsite/diagram`.

---

## Prioritised Change List

### P1 — API Contract Integrity (fix before next minor release)

1. **Replace `scene.userData` inter-widget bus** with `ICameraFocusTarget` interface + `WidgetInitContext` injection. Affects `CameraWidget.ts`, `useSceneEngine.ts`, `@brewsite/diagram`.
2. **Add `AnimationTrack`, `Resolvable<T>`, `getNodeHandler` to `src/index.ts`** to eliminate `@brewsite/model`'s four deep sub-path imports.
3. **Export `UseSceneEngineResult` type** from `player/index.ts`.
4. **Make `manifestUrl` optional on `EngineProvider`** and move manifest loading to the model plugin.

### P2 — API Surface Cleanup (next minor release)

5. **Replace `setSceneLightEnabled`** with a compiled state flag or `ILightingOverride` interface. Update `@brewsite/diagram` to stop calling it directly.
6. **Decouple player from concrete `CameraWidget`** — extract `ICameraHost` interface.
7. **Move `diagram-canvas.*` action types and handlers to `@brewsite/diagram`**. Make `InputActionType` an open string union.
8. **Remove `applyLighting`, `applyBackground`, `applyCamera`, `applyFloor`, `applyEnvironment`, `*ThreeRefs` types, `DEFAULT_*` constants, and dead `ElementTransitionSpec` instances** from `elements/index.ts` and `src/index.ts`.
9. **Remove redundant `registerNode` direct export** from `src/index.ts` line 13.
10. **Remove redundant `FunctionalTransitionSpec`/`ElementTransitionSpec` re-exports** from `src/index.ts` lines 11–12.
11. **Resolve duplicate `corePlugin` export** — keep only `player/index.ts` as the source.
12. **Fix `TextBox` export** — remove from `compiler/index.ts`, keep in `elements/index.ts`.

### P3 — Structural Improvements (next minor or major)

13. **Move `animejs` HUD presets** out of `packages/core/src/hud/animejs/` to `apps/examples/`. Removes `animejs` as a core production dependency.
14. **Move dev tools** (`CameraControlPanel`, `CameraInteractionInfoDialog`, `SceneInspector`) to `@brewsite/core/devtools` subpath export.
15. **Formalize `disableWhenAbsent`** — add to `ISceneElement<TState>` as an optional field, remove duck-typed cast in `sceneTrackCompiler.ts`.
16. **Add `resolvedState` accessor to `AnimationTickContext`** to eliminate `CameraWidget`'s duplicate state resolution.
17. **Add `WidgetRegistry.freeze()`** to make widget registration ordering explicit.
18. **Export `ICameraInteractionDriver` and `CameraInteractionDriverFactory`** from package barrel.
19. **Add `clearRegistry` to `@brewsite/core/testing` subpath** to stop consumers from deep-importing.

### P4 — Documentation and Low-Impact Fixes (ongoing)

20. **Rename `CompileExtraContext.sceneProgress` → `blockProgress`**. Breaking, but prevents a latent semantic bug.
21. **Generalize `EngineARContainerContext` → `ViewportScaleContext`** so label positioning works with custom layouts.
22. **Document `ScenePlayerRegistry` as a module-level singleton** with SSR/multi-instance constraints (JSDoc + README).
23. **Deduplicate `CameraInteractionDefaults` type** — keep in `camera/types.ts`, remove from `player/engineTypes.ts`.
24. **Unify `EngineFrameState` / `EngineState`** — merge into one type with optional `tick`.
25. **Remove dead types**: `SceneFrameState` alias in `sceneTypes.ts`, `AnimationTrack` if stranded, `ICameraActionTarget` if no live implementors.
26. **Export stable widget ID constants for all core elements** or remove `SCENE_CAMERA_KEY` for consistency.
27. **Deduplicate `WidgetRegistry` routing logic** into a shared `dispatchToWidget()` helper.
28. **Confirm `api.pushWarning()` is declared in `CompileApi`** type; add if missing.
