---
title: "Core Package Over-Engineering Audit"
doc_type: note
owner: architect
status: complete
updated: 2026-03-18
---

# Core Package Over-Engineering Audit

Full audit of `packages/core/src/` across compiler, elements, runtime, widget SDK, player, HUD, input, timeline, math, and theme layers — **plus cross-package usage analysis** of `@brewsite/diagram`, `@brewsite/model`, `@brewsite/charts`, `@brewsite/slides`, and `apps/`. Findings are grouped by priority.

---

## HIGH PRIORITY — Duplicate Code & Unnecessary Complexity

### H1. Duplicate Quaternion/Euler Math

**Files:**
- `math/index.ts` (lines 21–109): `quatFromEuler()`, `quatToEuler()`, `quatNormalize()`, `quatSlerp()`, `quatMultiply()`
- `compiler/transitions/transitionTypes.ts` (lines 177–248): `normalizeQuat()`, `eulerToQuaternionXYZ()`, `quaternionToEulerXYZ()`, `slerpQuat()`

**Problem:** Four quaternion functions are implemented twice — once in the canonical math module and once inline in the transition types file. The `transitionTypes.ts` header even acknowledges this: `// DEBT: This file should be split into types-only, blend helpers, and math primitives`.

**Fix:** Delete the four local quaternion functions from `transitionTypes.ts` and import from `math/index.ts`. This eliminates ~70 lines of duplicated math and a divergence risk.

---

### H2. Duplicate Easing Functions

**Files:**
- `compiler/transitions/transitionAnimator.ts` (lines 10–19): `easeInOut()`, `easeLinear()`
- `compiler/transitions/transitionPresets.ts` (lines 87–108): `easeInOutCubic`, `easeLinear`, plus 5 more

**Problem:** `easeInOut` in transitionAnimator.ts is byte-for-byte identical to `easeInOutCubic` in transitionPresets.ts. `easeLinear` appears in both files.

**Fix:** Create a single canonical `easing.ts` module (or consolidate into `transitionPresets.ts`) and import from it everywhere. Eliminates ~15 lines and prevents silent divergence.

---

### H3. `ElementTransitionSpec` Is Dead Weight — Every Consumer Uses `FunctionalTransitionSpec`

**Files:** Every element's `compile.ts` (background, floor, environment, lighting, camera, carousel-scrubber)

**Problem:** Each element implements **both** `ElementTransitionSpec<T>` and `FunctionalTransitionSpec<T>` for the same state type. The `ElementTransitionSpec` variant is always a mechanical wrapper that loops over frames calling the functional version with `transitionT()`. This is ~50 lines of identical boilerplate per element, totaling ~300 lines across the codebase.

**Cross-package evidence (UPGRADED from original assessment):**
- **Every single widget in every package assigns the _functional_ spec to `transitionSpec`:**
  - `BackgroundWidget.transitionSpec = functionalBackgroundTransitionSpec`
  - `LightingWidget.transitionSpec = functionalLightingTransitionSpec`
  - `FloorWidget.transitionSpec = functionalFloorTransitionSpec`
  - `CameraWidget.transitionSpec = functionalCameraTransitionSpec`
  - `EnvironmentWidget.transitionSpec = functionalEnvironmentTransitionSpec`
  - `SpotlightRigWidget.transitionSpec = spotlightRigTransitionSpec` (functional)
  - `CarouselScrubberWidget.transitionSpec = carouselScrubberTransitionSpec` (functional)
- **All external packages use `FunctionalTransitionSpec` exclusively:**
  - `@brewsite/diagram`: `functionalDiagramTransitionSpec`
  - `@brewsite/model`: `functionalInstanceTransitionSpec`
  - `@brewsite/charts`: `functionalChartTransitionSpec`
  - `@brewsite/slides`: `SlideMetaWidget` uses `FunctionalTransitionSpec`
- **`ElementTransitionSpec` is never used at runtime** — it exists only as dead exports in element `index.ts` files, tested explicitly to NOT appear in the public barrel
- **The `ElementTransitionSpec` variants are only consumed by their own `__tests__/` files**

**Fix:** This is stronger than the original "adapter" recommendation. The `ElementTransitionSpec` type and all per-element implementations are **removable dead code**. Steps:
1. Delete all `ElementTransitionSpec` implementations from element compile.ts files (~250 lines)
2. Remove their exports from element `index.ts` files
3. Remove the `ElementTransitionSpec` type from `transitionTypes.ts` (keep it only as a deprecated type alias if external consumers reference it)
4. Update `sceneTrackCompiler.ts` to remove the `ElementTransitionSpec` code path
5. Update tests that reference the deleted specs

---

### H4. Duplicate Color Conversion

**Files:**
- `math/index.ts` (lines 237–285): `parseHexColor()` — full hex parser with alpha support
- `compiler/transitions/transitionTypes.ts` (lines 313–334): `hexToRgb()`, `rgbToHex()` — simpler internal hex↔RGB conversion

**Problem:** Two independent hex color implementations. The `blendColor()` function in transitions uses its own `hexToRgb/rgbToHex` instead of the math module's `parseHexColor`.

**Fix:** Export a `blendHexColors(from, to, t)` utility from the math module (or a new `math/color.ts`). Remove the private `hexToRgb`/`rgbToHex` from transitionTypes.ts. Eliminates ~25 lines.

---

### H5. `blendStyleValues` / `blendStyleValuesPartial` Duplication

**File:** `compiler/transitions/transitionTypes.ts` (lines 436–501)

**Problem:** Two nearly-identical functions (65 lines total). The only difference: `blendStyleValues` initializes result with `{ ...fromValues, ...toValues }`, `blendStyleValuesPartial` initializes with `{}`. The inner loop is identical.

**Fix:** Extract shared loop into a helper, parameterize initialization. Or add an `includeAllKeys` boolean parameter:
```typescript
export const blendStyleValues = (from, to, t, includeAllKeys = true) => { ... };
```

---

### H6. Duplicate Blend Functions in Lighting

**File:** `elements/lighting/compile.ts` (lines 12–117)

**Problem:** `blendLightArray<T>()` and `blendSpots()` implement nearly identical id-keyed array blending logic. Code itself has a DEBT comment: "blendLightArray and blendSpots implement nearly identical id-keyed blend logic — unify via typed generic."

**Fix:** Extract a single `blendIdKeyedArray<T extends { id?: string }>()` utility. Eliminates ~60 lines.

---

### H7. Inline Clamp Implementations

**Files:**
- `player/SceneProgressMapper.ts` (3 locations): `Math.max(0, Math.min(1, ...))`
- `layout/regionLayout.ts` (2 locations): mixed patterns
- `compiler/transitions/transitionPresets.ts` (line 66): `Math.min(Math.max(...), 0.99)`
- `elements/camera/compile.ts`: custom `lerpNum()` that re-implements `blendNumber()` logic

**Problem:** `clamp01()` exists in `math/index.ts` but inline `Math.min/Math.max` patterns are used instead.

**Fix:** Replace all inline clamp patterns with `clamp01()` import. For non-0-1 ranges, add a `clamp(min, max, value)` utility to the math module.

---

## MEDIUM PRIORITY — Over-Engineering & Structural Issues

### M1. `transitionTypes.ts` Is a God File

**File:** `compiler/transitions/transitionTypes.ts`

**Problem:** This single file contains:
- Type definitions (`ElementTransitionSpec`, `FunctionalTransitionSpec`, `EaseFn`, etc.)
- Blend helpers (`blendNumber`, `blendColor`, `blendVec3`, `blendOpacity`, etc.)
- Quaternion math (duplicate — see H1)
- Style value blending (duplicate — see H5)
- Re-exports from math module

**Fix:** Split into:
- `transitionTypes.ts` — types only (specs, ease fn, transition context)
- `transitionBlendHelpers.ts` — all `blend*` and resolution functions
- Remove quaternion math (import from `math/`)

---

### M2. WeakMap Side-Channel in View Handlers

**File:** `compiler/blocks/viewHandlers.ts` (lines 23–30)

**Problem:** Layout context is passed via a module-level `WeakMap<CompileApi, ViewLayoutContext>` instead of through the `CompileApi` interface. Code flags this: `// DEBT: Replace this invisible side-channel with an explicit parameter on CompileApi`.

**Impact:** Hidden data flow between ViewLayout handler (writes) and View handler (reads). Breaks the handler contract — data flows outside the `CompileApi` interface.

**Fix:** Add `layoutContext?: ViewLayoutContext` field to `CompileApi`.

---

### M3. Registry Maintains 4 Parallel Maps

**File:** `compiler/registry.ts`

**Problem:** The compiler registry maintains `nodeRegistry` + `nodeRegistryByName` + `nodeCategoryRegistry` + `nodeCategoryRegistryByName` — four maps for what could be two. Name extraction logic (`component.displayName ?? component.name`) is repeated 3 times.

**Fix:** Merge into two maps with composite value types. Extract `getComponentDisplayName()` utility.

---

### M4. CameraWidget Implements 5 Interfaces With 14 Private Fields

**File:** `elements/camera/CameraWidget.ts` (lines 44–100)

**Problem:** CameraWidget mixes camera scene element rendering with interaction driver lifecycle, keyboard listener management, and focus override tracking. This creates a large surface area that's hard to test.

**Consideration:** Splitting into CameraWidget (scene element) + CameraInteractionWidget (driver lifecycle) would improve testability and separation of concerns. However, this is a significant refactor with risk.

---

### M5. Lighting Child Handler Is a 100+ Line If/Else Chain

**File:** `elements/lighting/LightingWidget.ts` (lines 125–240+)

**Problem:** The `CUSTOM_NODE_HANDLER` for lighting dispatches 10 child DSL components via sequential if/else blocks, each ~10 lines of nearly identical prop extraction.

**Fix:** Use a handler map pattern:
```typescript
const childHandlers: Record<string, (props, context) => void> = { Ambient: ..., Directional: ..., ... };
```

---

### M6. InputCoordinator Is 683 Lines With Scattered Ref State

**File:** `player/InputCoordinator.tsx`

**Problem:** Manages a complex multi-axis state machine using 5+ raw refs (`yInertiaRef`, `xInertiaRef`, `arbiterRef`, `carouselStepFnRef`, `subscribersRef`). No single source of truth. Hard to reason about state transitions.

**Fix:** Extract an `InputStateMachine` class or use a `useReducer` pattern to colocate all input state transitions.

---

### M7. 6 Separate Scroll-Related React Contexts

**Files:**
- `player/ScrollRegionContext.tsx`
- `player/ScrollNavigatorContext.tsx`
- `player/ScrollDriverContext.tsx`
- `player/ControlledProgressContext.tsx`
- `player/ActionInputExtensionContext.ts`
- `player/PluginInheritanceContext.tsx`

**Problem:** Each is a one-line context creation + one-line hook. Consumers need 6 separate imports for scroll-related state.

**Consideration:** Grouping related contexts (e.g., `ScrollState = { region, navigator, driver }`) would reduce import burden. However, this changes the public API surface, so evaluate consumer impact first.

---

### M8. `ThemeKeyContext` Is Dead Code — No Consumer Uses It

**Files:** `theme/ThemeContext.ts`, `theme/ThemeKeyContext.ts`

**Problem (UPGRADED from original assessment):** Cross-package analysis reveals:
- **`ThemeKeyContext.Provider` is never rendered anywhere** — grep across all packages finds zero usages
- **`useThemeKey()` is never called outside its own definition file** — only appears in requirements docs and the definition itself
- **All theme consumers use `useTheme()` or `api.context.themeFamily/themePolarity`:**
  - `@brewsite/diagram`: `useTheme()` hook in `useDiagramTheme.ts`, plus `api.context.themeFamily` / `api.context.themePolarity` during compilation
  - `@brewsite/charts`: `useTheme()` hook in `useChartTheme.ts`, plus `api.context.themeFamily` / `api.context.themePolarity` during compilation
  - `@brewsite/model`: Does not interact with theme at all
  - `@brewsite/slides`: `SceneTheme` type import only
  - `apps/`: `ThemeFamily` type imports, no `ThemeKeyContext` usage

**Fix:** Delete `ThemeKeyContext.ts` and its exports. It's unused infrastructure that adds confusion to the theme API surface. The `ThemeContext` + `CompileApi.context.themeFamily/themePolarity` pattern is the established and universally-used approach.

---

### M9. EngineFrameDriver Is a 29-Line Class Wrapper With Zero External Consumers

**File:** `player/EngineFrameDriver.ts`

**Problem:** The class does only two things: cache the last tick index and call a callback when it changes. This could be a 5-line inline function.

**Cross-package evidence:** `EngineFrameDriver` is only imported in `player/useSceneEngine.ts`. No external package (diagram, model, charts, slides, apps) references it. It is purely internal plumbing.

**Fix:** Inline into `useSceneEngine.ts` as a simple ref-based dedup closure. Delete the file and its test.

---

### M10. SceneCanvas RAF Retry Loop Has No Timeout

**File:** `player/SceneCanvas.tsx` (lines 51–68)

**Problem:** When `engineId` is set, SceneCanvas retries binding to the engine via `requestAnimationFrame` indefinitely. Code flags: `// DEBT: This RAF retry loop has no timeout`.

**Fix:** Add max retry count (~300 frames / ~5s) with `console.warn` on exhaustion.

---

## LOW PRIORITY — Minor Issues & Cleanup

### L1. Redundant Guard Checks in coreHandlers.ts

**File:** `compiler/coreHandlers.ts` (lines 34–47)

After the `coreHandlersRegistered` guard, each `registerNode()` call is also wrapped in `if (!getNodeHandler(X))`. The inner checks are always true.

---

### L2. WidgetRegistry Routing Logic Duplication

**File:** `widget/WidgetRegistry.ts`

DSL node routing logic appears in three places: `dispatchToWidget()`, `registerTypeFactory()`, and `register()`. Code flags this as DEBT.

---

### L3. MaterialLoader.getLoadedPreset() Always Returns Null

**File:** `widget/MaterialLoader.ts` (lines 150–160)

The method body loops but ignores the loop variable (`void preset`), always returning `null`. Either implement or remove.

---

### L4. useCarouselIndex.ts File Named Inconsistently

**File:** `widget/useCarouselIndex.ts` exports `useCarouselState()`. File should be renamed `useCarouselState.ts`.

---

### L5. `useEngineState` Name Conflict

**Files:** `player/EngineStateContext.ts` vs `player/useEngineState.ts`

Two different things named `useEngineState`. Code flags: `// DEBT: Rename to useEngineStateContext`.

---

### L6. InputHud Is a Null Stub in Public Exports

**File:** `hud/InputHud.tsx` — Returns `null` with comment "DEFERRED: placeholder for future implementation." Types and infrastructure are defined but unused.

---

### L7. DSL Component Return Type Inconsistency

Some DSL stubs use `(_props: XProps) => null` (no explicit return type), others use `(_props: XProps): null => null` (explicit). Trivial but inconsistent.

---

### L8. Type Guard Pattern Inconsistency in WidgetRegistry

**File:** `widget/WidgetRegistry.ts` (lines 435–487)

15 type guards use three different implementation patterns (`in` operator, `typeof ... === 'function'`, mixed). Should standardize on one approach.

---

### L9. `expandNode` Swallows Errors Silently

**File:** `compiler/sceneDslCompiler.ts` (lines 100–108)

When a function component throws during DSL expansion, the error is caught and discarded. Code flags: `// DEBT: Route through api.pushWarning`.

---

### L10. Duplicate Scroll Progress Computation in ScrollStage

**File:** `player/ScrollStage.tsx` (lines 112–180)

The `maxScrollTop` / `rawProgress` calculation appears in 3 places within the same component. Extract into a pure function.

---

## CROSS-PACKAGE USAGE ANALYSIS

Audited `@brewsite/diagram` (139 files), `@brewsite/model` (12+ source files), `@brewsite/charts` (85 files), `@brewsite/slides`, and `apps/examples` + `apps/website` + `apps/docs`.

### Key Cross-Package Findings

#### CP1. Every External Package Uses Only `FunctionalTransitionSpec`
No external package imports or uses `ElementTransitionSpec`. All widget `transitionSpec` properties point to functional variants. This confirms H3 — `ElementTransitionSpec` can be removed.

#### CP2. `ThemeKeyContext` Has Zero Consumers
`useThemeKey()` is never called outside its own definition file. `ThemeKeyContext.Provider` is never rendered. All packages use `useTheme()` + `api.context.themeFamily/themePolarity`. This confirms M8 — delete it.

#### CP3. Each Package Implements Its Own Theme Registry (Appropriate Pattern)
- Diagram: `themeRegistry.ts` maps `family + polarity → DiagramTheme`
- Charts: `chartThemeRegistry.ts` maps `family + polarity → ChartTheme`
- Both resolve via `api.context.themeFamily/themePolarity` during compilation
- This is the correct pattern — domain themes should NOT be in core.

#### CP4. `EngineFrameDriver` Is Purely Internal
Only imported by `useSceneEngine.ts`. No external consumer. Confirms M9 — inline it.

#### CP5. External Packages Don't Duplicate Core Math (With Minor Exceptions)
- Diagram has local `clamp01/clamp` in `colorUtils.ts` and `edgeRouter.ts` — justified for domain-specific geometric algorithms
- Model has local `lerp/lerpVec3` in `labelCompiler.ts` — tiny label-specific helpers
- Charts has local `easeOutCubic` in `BarRenderer.ts` — single entry animation ease
- **None of these justify moving to core** — they're small, domain-scoped utilities

#### CP6. Core Blend Functions Are Well-Used Across Packages
The following are the actual "core math API" used by consumers:
- `lerp(a, b, t)` — used by diagram, charts, model
- `blendNumber(from, to, t)` — used by charts, model
- `blendOpacity(from, to, t)` — used by diagram, model, charts
- `blendVec3(from, to, t)` — used by diagram, model
- `blendColor(from, to, t)` — used by model
- `blendAxisRotation/blendAxisTranslation` — used by model only
- `parseHexColor(hex)` — used by diagram, charts
- `copyVec3(vec)` — used by diagram only

**Unused by any external consumer:**
- `lerpVec3` (from math module) — diagram uses `lerp` on scalar components, model has local impl
- `quatSlerp/quatFromEuler/quatToEuler/quatNormalize` — used only by `transitionTypes.ts` internally
- `blendDistance` — used only internally by floor transitions
- `blendStyleValues/blendStyleValuesPartial` — used only internally by HUD transitions
- `resolveOpacity` — used only internally

This means the quaternion math in `transitionTypes.ts` (H1 duplication) serves only ONE consumer: the `blendAxisRotation` function. Consider whether the quaternion code even needs to be in a shared math module vs. kept local to the rotation blend function.

#### CP7. Widget Interface Usage Is Appropriate
External packages implement 5-8 interfaces each, all with clear purpose:
- Diagram: 6 (ISceneElement, IRenderable, ILoadable, INVSBounded, IDslComposite, ILightingOverride)
- Model: 8 (ISceneElement, IRenderable, ILoadable, IDslComposite, IAttachmentHost, IRenderContributor, IHasCustomDslHandler, INVSBounded)
- Charts: 6 (ISceneElement, IRenderable, IAnimationController, IDslComposite, ILoadable, INVSBounded)
The interface count per widget is justified — each interface adds a distinct runtime capability.

#### CP8. `makeSimpleContext` Is a Legitimate Cross-Package Test Utility
Used in test files across core, diagram, model, charts, screens. It's appropriately exported and useful.

#### CP9. Several Public Exports Have Zero Consumers

The following are exported from `@brewsite/core` but never imported by any package or app:
- `TimeInput` — manual time scrubbing component
- `ControlledInput` — controlled input wrapper
- `useNativeScrollSource()` — native scroll detection hook
- `CustomScrollSource` / `ElementScrollSource` — alternative scroll source implementations
- `useSceneRuntime()` — widget runtime state hook (not used in any demo)
- `useEngineScrubber()` — timeline scrubber state hook (not directly used)

These are candidates for deprecation or removal from the public barrel. Low-risk since no consumer depends on them.

#### CP10. Apps Use a Small, Well-Defined Core DSL Surface
The consumer-facing DSL imports from apps are:
- **Scene structure:** `Scene`, `ProgressManager`, `View`, `ViewLayout`
- **Element DSL:** `Camera`, `Background`, `Lighting`, `Ambient`, `Directional`, `Floor`, `FloorMirror`, `Environment`, `TextBox`
- **Input:** `InputController`, `Action`, `PointerMap`, `WheelMap`, `KeyMap`, `PinchMap`
- **Player:** `SceneEngine`, `SceneCanvas`, `EngineOverlayHost`, `ScrollStage`, `InputCoordinator`, `TimeInput`, `EngineGate`, `BackgroundLayer`
- **Hooks:** `useEngineState`, `useCurrentScene`, `useGoToScene`, `useSceneProgress`, `useVariable`, `useEngineScrubber`
- **Plugin:** `corePlugin`, `WidgetPlugin`, `ActiveTheme`
- **Types:** `ThemeFamily`

No app imports `EngineFrameDriver`, `ElementTransitionSpec`, `ThemeKeyContext`, `RuntimeDriver`, `RuntimeLoop`, `WidgetRegistry` (directly), or any of the compiler infrastructure types.

---

## ITEMS ASSESSED — NOT OVER-ENGINEERED

The following were evaluated and found to be **appropriately designed**:

| Area | Assessment |
|------|------------|
| **IWidget interface hierarchy (18 interfaces)** | Each interface has a clear single responsibility. All are referenced in type guards and used by real widgets. Granular opt-in composition is the right pattern. |
| **VariableStore reactivity** | 39 lines. Simple Map + listener sets. No computed fields, no dependency graphs. Justified by `useSyncExternalStore` integration. |
| **RuntimeDriverImpl state fields** | 32 private fields, each with clear responsibility. Error sets, patches, caching all serve distinct purposes. |
| **Timeline algebra** | Justified complexity — hides real mathematical operations behind clean API. |
| **Element module pattern (types→dsl→compile→render→Widget)** | Mandatory layering per architecture. Different layers handle different concerns. Not duplication. |
| **Barrel exports** | Appropriate for published package. No circular re-exports detected. |
| **Test doubles in runtime/mocks/** | Interface-conforming, observable state, no `vi.fn()`. Exemplary. |
| **ActionInputController size (947 lines)** | Large but each section handles a distinct concern. Optional refactor for testability, not a priority. |

---

## SUMMARY TABLE

| ID | Issue | Severity | Est. LOC Saved | Effort | Cross-Package Evidence |
|----|-------|----------|----------------|--------|----------------------|
| H1 | Quaternion math duplication | HIGH | ~70 | Low | Quat funcs only used internally by `blendAxisRotation` |
| H2 | Easing function duplication | HIGH | ~15 | Low | — |
| H3 | `ElementTransitionSpec` is dead code | **CRITICAL** | ~300+ | Medium | Zero usage across all 4 external packages; all widgets use functional spec |
| H4 | Color conversion duplication | HIGH | ~25 | Low | — |
| H5 | blendStyleValues duplication | HIGH | ~30 | Low | Only used internally by HUD transitions |
| H6 | Lighting blend array duplication | HIGH | ~60 | Low | — |
| H7 | Inline clamp patterns | HIGH | ~15 | Low | — |
| M1 | transitionTypes.ts god file | MEDIUM | 0 (reorg) | Medium | — |
| M2 | WeakMap side-channel | MEDIUM | ~10 | Low | — |
| M3 | Registry 4 parallel maps | MEDIUM | ~20 | Low | — |
| M4 | CameraWidget 5-interface mix | MEDIUM | 0 (split) | High | Interface count justified by cross-pkg comparison (5-8 is normal) |
| M5 | Lighting if/else handler chain | MEDIUM | ~30 | Medium | — |
| M6 | InputCoordinator ref sprawl | MEDIUM | 0 (refactor) | High | — |
| M7 | 6 scroll contexts | MEDIUM | 0 (merge) | Medium | Apps import hooks individually; merging would simplify |
| M8 | `ThemeKeyContext` is dead code | **HIGH** | ~40 | Low | Zero usage across all packages; `useThemeKey()` never called |
| M9 | EngineFrameDriver internal-only | MEDIUM | ~30 | Low | Zero external consumers; inline into useSceneEngine |
| M10 | SceneCanvas infinite retry | MEDIUM | 0 (add guard) | Low | — |
| L1–L10 | Minor cleanup items | LOW | ~30 | Low | — |

**Total estimated LOC reduction: ~645+ lines** (up from 465 after cross-package analysis exposed H3 and M8 as removable dead code)

### Revised Recommendations

**Wave 1 — Safe deduplication, no API changes (est. 2–3 hours):**
H1, H2, H4, H5, H6, H7 — pure internal deduplication. No consumer-facing changes.

**Wave 2 — Dead code removal (est. 3–4 hours):**
- H3: Delete all `ElementTransitionSpec` implementations from elements, remove the type's code path from `sceneTrackCompiler.ts`, update tests. Keep the type itself as a deprecated alias for one release cycle.
- M8: Delete `ThemeKeyContext.ts` and its exports from `theme/index.ts`.
- M9: Inline `EngineFrameDriver` into `useSceneEngine.ts`, delete file + test.

**Wave 3 — Structural improvements (est. 4–6 hours):**
M1 (transitionTypes split), M2 (WeakMap → CompileApi), M3 (registry consolidation), M5 (lighting handler map).

**Wave 4 — Larger refactors, evaluate ROI (optional):**
M4 (CameraWidget split), M6 (InputCoordinator reducer), M7 (context consolidation).

### Changed Assessments After Cross-Package Analysis

| Item | Original Assessment | Revised Assessment | Reason |
|------|-------------------|-------------------|--------|
| H3 | HIGH (create adapter) | **CRITICAL** (remove entirely) | No consumer uses ElementTransitionSpec; all use functional |
| M8 | MEDIUM (document or merge) | **HIGH** (delete dead code) | ThemeKeyContext has zero consumers across all packages |
| M4 | MEDIUM (consider splitting) | **KEEP AS-IS** | 5 interfaces is normal; diagram=6, model=8, charts=6 |
| M9 | MEDIUM (inline) | MEDIUM (confirmed, inline) | Zero external consumers verified |
| H5 | HIGH | HIGH (narrow scope) | Only used by HUD transitions internally |
| H1 | HIGH | HIGH (narrow scope) | Quat math only needed by `blendAxisRotation`, not widely used |
