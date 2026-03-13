---
title: "Pre-Release Audit — @brewsite/core"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-12
---

# Pre-Release Audit — @brewsite/core

## Coverage Summary

| Metric | Value |
|---|---|
| **Statement coverage** | 80.47% |
| **Branch coverage** | 78.25% |
| **Function coverage** | 77.19% |
| **Test files** | 83 |
| **Tests passing** | 1,094 |

### Low-Coverage Files (< 50% statements)

| File | Stmts | Notes |
|---|---|---|
| `player/CameraControlPanel.tsx` | 1.64% | Dev-tools component marked `@internal` |
| `player/CameraInteractionInfoDialog.tsx` | 6.16% | Dev-tools component marked `@internal` |
| `player/SceneCanvas.tsx` | 4.7% | Polling canvas bind — no test |
| `player/plugins.ts` | 8.33% | Plugin lifecycle untested |
| `player/StageScrollSources.tsx` | 15.23% | Scroll source provider barely tested |
| `player/devtools.ts` | 0% | Re-export barrel for dev tools |
| `player/useSceneEngineState.ts` | 0% | Dead code file |
| `layout/nvsWorldBridge.ts` | 53.57% | Half-tested |
| `widget/WidgetPlugin.ts` | 0% | Interface — no runtime test |
| `testing.ts` | 0% | Test-only export |

### Subsystem Coverage Summary

| Subsystem | Stmts | Branch | Funcs |
|---|---|---|---|
| `compiler/` | 94.72% | 88.01% | 96.82% |
| `runtime/` | 93.47% | 85.23% | 76.92% |
| `widget/` | 76.80% | 92.74% | 88.00% |
| `elements/` | Varies | — | — |
| `player/` | 65.37% | 77.24% | 68.00% |
| `math/` | 86.30% | 85.00% | 100% |
| `timeline/` | 100% | 100% | 90% |
| `theme/` | 100% | 87.50% | 83.33% |
| `text/` | 95.45% | 94.73% | 66.66% |

---

## P0 — Must Fix Before Release

### ~~P0-1: Spotlight-Rig Tests Are Broken~~ ✅ RESOLVED

Tests were fixed by another contributor. 3 test files, 78 tests, all passing.

### P0-2: `buildCacheKey()` Uses `fn.toString()` — Unstable Under Minification

`packages/core/src/widget/WidgetRegistry.ts` — Cache keys are built from `fn.toString()`. In production builds, many distinct functions produce identical minified source strings, causing cache collisions. This silently produces incorrect recompilation results.

**Fix:** Use a developer-assigned stable key (required `id` or `displayName` on widget registration) rather than source-text hashing.

### P0-3: `onContextRestored` Handler is Empty — No WebGL Recovery

`packages/core/src/player/useSceneEngine.ts` registers a `webglcontextrestored` listener but the handler body is empty. On GPU reset (context loss), the engine cannot recover — it hangs silently.

**Fix:** Implement basic recovery (reinitialize renderer, resume RAF loop) or remove the listener and document the limitation clearly.

---

## P1 — High Priority

### P1-1: `clamp01` Defined in 9 Locations

The most duplicated function in the codebase. Found in:
1. `math/index.ts` (canonical)
2. `timeline/math.ts`
3. `compiler/transitions/transitionTypes.ts`
4. `player/StageScrollSources.tsx`
5. `player/useViewportRelativeScroll.ts`
6. `player/useSceneEngine.ts`
7. `player/TimelineWidget.tsx`
8. `player/ScrollStage.tsx`
9. `elements/floor/render.ts`

**Fix:** Delete 8 copies. Import from `math/index.ts` everywhere.

### P1-2: `lerp` Defined in 3 Locations, `lerpVec3` in 3 Locations

- `lerp`: `math/index.ts`, `timeline/math.ts`, `compiler/transitions/transitionTypes.ts`
- `lerpVec3`: `math/index.ts`, `compiler/transitions/transitionTypes.ts`, `elements/camera/compile.ts` (private copy)

**Fix:** Consolidate to `math/index.ts`.

### P1-3: `transitionTypes.ts` is a 530-Line Monolith — Three Concerns in One File

Contains:
1. Core transition type contracts (`ElementTransitionSpec`, `FunctionalTransitionSpec`, `TransitionContext`, etc.)
2. Math primitives (`clamp01`, `lerp`, `lerpVec3`, quaternion math)
3. Blend helpers (`blendNumber`, `blendOpacity`, `blendVec3`, `blendColor`, `blendAxisRotation`, `blendStyleValues`, etc.)

**Fix:** Split into three files:
- `transitionTypes.ts` — type contracts only
- `transitions/blendHelpers.ts` — all blend functions
- Math primitives → move to `math/index.ts`

### P1-4: `viewHandlers.ts` Uses Invisible Side-Channel (Module-Level WeakMap)

`packages/core/src/compiler/blocks/viewHandlers.ts` lines 17-23: `viewLayoutHandler` writes layout context into a module-level `WeakMap<CompileApi, ViewLayoutContext>`. `viewHandler` reads from it. The `CompileApi` type shows no sign of this coupling.

Additionally, validation errors in this file use `console.error`/`console.warn` directly, bypassing the structured `api.pushWarning` system.

**Fix:** Replace WeakMap with explicit parameter or narrowed child API. Route all warnings through `api.pushWarning`.

### P1-5: `INPUT_CONTROLLER_WIDGET_ID` Defined in Two Files

`packages/core/src/compiler/sceneTrackCompiler.ts` line 23 and `packages/core/src/compiler/blocks/inputController.tsx` line 19 both define `'__input_controller'`.

**Fix:** Single definition in `inputController.tsx`, import in `sceneTrackCompiler.ts`.

### P1-6: Dead Code — `useSceneEngineState.ts`

`packages/core/src/player/useSceneEngineState.ts` duplicates `useEngineState(id)`. Correctly omitted from `player/index.ts` but the file remains. References removed `<EngineProvider>`.

**Fix:** Delete the file.

### P1-7: Dead Code — `hud/` Directory

`packages/core/src/hud/index.ts` is a comment-only empty barrel explaining the module was removed. The whole `hud/` directory is dead infrastructure.

**Fix:** Delete the directory.

### P1-8: Dev-Tools Components in Stable Public API

`player/index.ts` exports `CameraControlPanel`, `CameraInteractionInfoDialog`, `SceneInspector` — all marked `@internal` in JSDoc but exported as stable public API. Coverage is near 0%.

**Fix:** Move to a separate `devtools` sub-path import, or remove from `player/index.ts` and document as internal-only.

### P1-9: `BackgroundWidget` Unsafe Cast in `useSceneEngine.ts`

Lines 373-378: `backgroundWidget as unknown as { setDomElement?: ... }` bypasses the type system entirely. If `BackgroundWidget`'s interface changes, this silently breaks.

**Fix:** Add `IHasDomElement` interface to `BackgroundWidget` and use typed access.

### P1-10: `expandNode` Silently Swallows Errors

`packages/core/src/compiler/sceneDslCompiler.ts` line ~91: The try/catch around `expandNode` calls `console.error` and returns `[]`. Entire DSL subtrees silently collapse with no structured diagnostic.

**Fix:** Route through `api.pushWarning`. Add test for the error path.

### P1-11: `ModifierKey`/`KeyCombo` Types Sourced from Camera Element

`packages/core/src/input/types.ts` re-exports `ModifierKey` and `KeyCombo` from `elements/camera/types`. This creates an input → element dependency, violating the dependency direction.

**Fix:** Move these types to `input/types.ts` as the canonical location. Camera element imports from there.

---

## P2 — Medium Priority

### P2-1: `SceneReel` Missing Prop Forwarding

`packages/core/src/player/SceneReel.tsx` does not accept or forward `themeFamily`, `themePolarity`, or `scrollSource` props to `SceneEngine`. Users needing theming or custom scroll source must compose lower-level components manually.

### P2-2: `WidgetRegistry.register()` Partially Duplicates `registerTypeFactory()`

`packages/core/src/widget/WidgetRegistry.ts` lines ~184-255: The typeFactory handler block inside `register()` reconstructs routing logic that `registerTypeFactory()` already encapsulates. A bug fix in one path may not be applied to the other.

### P2-3: `coreHandlers.ts` Has No Dedicated Test + Double-Guard Redundancy

`registerCoreHandlers()` guards with `if (coreHandlersRegistered) return`, then each inner registration re-checks via `getNodeHandler()`. The inner checks are dead logic. No dedicated test exists.

### P2-4: `private active = true` Never Set to `false` in Two Classes

- `RuntimeDriverImpl.active` — never set to `false`, making `if (!this.active)` dead code
- `RuntimeLoop.active` — same pattern

**Fix:** Either implement the `destroy()` lifecycle or remove the dead field and guard.

### P2-5: Stale "Stub - Implemented in Phase N" Comments

- `compiler/sceneTrackSampler.ts` — "Stub - implemented in Phase 4"
- `runtime/RuntimeLoop.ts` — "Stub - implemented in Phase 6"

Both implementations are complete. Delete the misleading comments.

### P2-6: `SceneCanvas` Polling Loop Has No Timeout

`packages/core/src/player/SceneCanvas.tsx` lines 54-62: `requestAnimationFrame` retry for canvas binding runs indefinitely if the binding never resolves.

**Fix:** Add a max retry count (e.g., 300 frames = ~5 seconds) with a `console.warn` on timeout.

### P2-7: `TimelineWidget` Takes Explicit `engine` Prop Instead of Context

`packages/core/src/player/TimelineWidget.tsx` accepts an explicit `engine` prop rather than calling `useSceneEngineContext()`. Architecturally inconsistent with all other player components.

Also: `void tickAreaHeight` at line 136 is a dead variable suppression.

### P2-8: Two Functions Named `useEngineState` with Different Contracts

`EngineStateContext.ts` exports `useEngineState` (throws if no context). `useEngineState.ts` exports `useEngineState` (overloaded: supports context and id-based access). Both exist at their local paths. `player/index.ts` exports only the overloaded version, but `EngineGate.tsx` imports from `EngineStateContext` internally.

**Fix:** Rename the context-only version to `useEngineStateContext` or make it private.

### P2-9: `Vec3` Type Defined in Two Places

`runtime/types.ts` and `math/index.ts` both define `Vec3 = { x: number; y: number; z: number }`.

**Fix:** Single definition, import elsewhere.

### P2-10: Deprecated `EngineState` Type Still Exported

`packages/core/src/player/engineTypes.ts` — `EngineState` is `@deprecated` but exported from `player/index.ts`.

### P2-11: Deprecated Aliases in `EngineARContainer.tsx` Still Exported

`EngineARContainerContextValue` and `EngineARContainerContext` both `@deprecated`, both in stable public surface.

### P2-12: `SceneTrackTick.sceneProgress` Optional Field — Permanent Backward-Compat

`packages/core/src/compiler/sceneTrackTypes.ts` — `sceneProgress` is optional with a backward-compat note. Forces null-checks everywhere. If this is a major release, make it required.

### P2-13: `camera/compile.ts` Uses `console.error` in Pure Function

`compileNvsViewportCamera()` calls `console.error()` for invalid input rather than using a structured warning/return system. Tests are coupled to console mock assertions.

### P2-14: `lighting/compile.ts` — `blendLightArray` and `blendSpots` Near-Duplicate

`blendLightArray` (generic for points/directionals) and `blendSpots` implement nearly identical id-keyed blend logic. Should be unified via typed generic constraint.

### P2-15: `floor/compile.ts` — `interpolate` Function Hard-Cuts at Midpoint

All non-enabled fields use `t < 0.5 ? from.X : to.X` — never actually interpolated. Function is named `interpolate` which misleads. Add a comment explaining why blending is not done for floor surfaces.

### P2-16: `elements/index.ts` Missing Camera Sub-Types

Does not export `ICameraHost`, `CameraInteractionDefaults`, `FitBotHeightCamera`, `FitFloorDepthCamera`, `WorldSpaceCamera`, `OrbitCamera`. Advanced users must use private import paths.

---

## P3 — Low Priority / Polish

### P3-1: `ICameraActionTarget` Deprecated — No Removal Timeline

`packages/core/src/widget/types.ts` — `@deprecated` with no replacement path or timeline.

### P3-2: `IExtraRenderPass` Published But Unused

`packages/core/src/widget/types.ts` — `@debt` annotation, never implemented. Dead API surface.

### P3-3: `VariableStore` vs `VariableStoreReader` Inconsistency

`AnimationTickContext.variables` exposes full mutable `VariableStore`. `WidgetRenderContext.variables` exposes read-only `VariableStoreReader`. If the asymmetry is intentional (animation controllers may write, render callbacks may only read), document it. If accidental, align.

### P3-4: Historical Phase Labels in `WidgetRegistry.ts`

Comment blocks reading "Phase 1 type guards" and "Phase 5 type guards" are internal development artifacts with no meaning to published-package consumers.

### P3-5: `compiler/index.ts` Export Hygiene

`makeResolver`, `makeSimpleContext`, and easing functions (`easeInOutCubic`, etc.) are exported from the DSL authoring barrel. These are transition infrastructure, not DSL surface. Consider a separate import path.

### P3-6: Module-Level Registry Singleton in `registry.ts`

`nodeRegistry` and `nodeRegistryByName` are mutable module-level singletons. `clearRegistry()` is exported for tests but does not prevent non-hermetic test pollution.

### P3-7: `window.__robotRuntimeDebug` Undocumented Global

`packages/core/src/runtime/RuntimeLoop.ts` — `(window as any).__robotRuntimeDebug?.perf` is an undocumented debug escape. Formalize with a type declaration or remove.

### P3-8: `unregisterSceneRuntime` Cross-Concern Side Effect

`packages/core/src/player/ScenePlayerRegistry.ts` lines 59-65 — also clears `engineSnapshotRegistry` entries. Implicit coupling between two registry types.

### P3-9: `usePauseWhenHidden` Requires Stable Callbacks

`packages/core/src/player/usePauseWhenHidden.ts` — `onPauseChange` excluded from `useEffect` deps; callers must pass stable callbacks. Not enforced by API.

### P3-10: Deferred Phase 2 Items in Production Code

| Location | Item |
|---|---|
| `elements/camera/types.ts:122` | `DofConfig = never; // Phase 2` |
| `elements/camera/compile.ts:311` | `// Phase 2: DoF interpolation` |
| `elements/spotlight-rig/render.ts:324-327` | Per-light halos deferred |

These should be tracked in requirements, not inline comments.

### P3-11: Legacy `darkSceneTheme`/`lightSceneTheme` Presets Not Deprecated

`packages/core/src/theme/presets.ts` — two legacy presets exported without `@deprecated` markers.

### P3-12: `LEGACY_CAMERA_ID` Warning May Spam Console

`packages/core/src/input/ActionInputController.ts` lines 282-289 — `console.warn` fires every time an old-style camera action is dispatched. Could generate significant noise in production.

### P3-13: `modifiersMatch` Near-Duplication in `ActionInputController.ts`

Module-level `modifiersMatch` and instance method `modifiersMatchForPinchWheel` implement nearly identical logic with a minor variant. Should be a single shared utility.

### P3-14: `makeDisabledDefault` Duck-Typed Mutation

`packages/core/src/compiler/sceneTrackCompiler.ts` line ~334 — performs structural clone and sets `enabled`, `opacity`, `model.enabled` using duck-typed field mutation. No interface contract enforces which state shapes have these fields.

### P3-15: Stale Mock Properties in `registry.test.ts`

`fakeApi` mock carries `pushHudItem` and `pushLabel` properties that don't exist on the current `CompileApi` type. Tests pass due to structural typing but the mock is out of sync.

### P3-16: `WidgetPlugin.reconcileCompiledTrack` Untested

The method exists on the interface but no test verifies that `RuntimeDriverImpl` calls it or that plugins can use it to mutate compiled tracks.

### P3-17: `SceneEngine.tsx` Double-useMemo for StrictMode

Lines 198-223 contain a double-`useMemo` pattern to work around React 18 StrictMode. Adequately commented but unusual enough to confuse maintainers.
