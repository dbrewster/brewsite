---
title: "Carousel Tray Root Cause Analysis"
doc_type: note
owner: architect
status: resolved
updated: 2026-03-16
---

# Carousel Tray Root Cause Analysis

## Executive Summary

Three bugs were reported against the carousel tray system:
1. Material selection in scene DSL doesn't work — always get "onyx"
2. Material selection from theme doesn't work
3. Tray texture isn't rotating with ring carousel

Investigation reveals these symptoms stem from **two architectural root causes** and **one implementation gap**:

1. **Dead-code confusion**: `resolveThemedStyle()` exists, is well-tested, but is **never called** by the actual compilation pipeline. Theme resolution is instead done ad-hoc inside `viewLayoutHandler`. The two strategies have subtly different semantics.
2. **No integration test for the critical compilation path**: The viewLayoutHandler → compileCarouselScrubber pipeline has zero test coverage. All existing tests exercise pure functions in isolation, completely missing the integration seam where bugs actually live.
3. **No texture UV rotation logic exists**: The tray mesh rotates via `cache.root.rotation.y`, but the normal map texture is baked into vertex UVs. There is zero code to rotate the texture independently or counter-rotate it.

---

## Bug-by-Bug Analysis

### Bug 1: "Material selection on the tray, in the scene, isn't working. I always get onyx."

**What "onyx" means**: The `grain` surface pattern is documented as having an "organic stone/onyx feel" in `types.ts` line 16. "Always get onyx" = the `surfacePattern` is always `'grain'` regardless of what the DSL specifies.

**The data flow** (viewHandlers.ts lines 265-329):

```
<CarouselTray surfacePattern="brushed" />
      ↓
viewLayoutHandler extracts: trayProps.surfacePattern = 'brushed'
      ↓
resolveSceneTheme(family, polarity) → sceneTheme.carouselTray.surfacePattern
      ↓
style.surfacePattern = trayProps.surfacePattern ?? trayTheme?.surfacePattern
      ↓
compileCarouselScrubber({style: {surfacePattern: ...}}, ...)
      ↓
compile.ts strips undefined, merges with DEFAULT_CAROUSEL_SCRUBBER_STYLE
      ↓
Final state → widget.apply() → render.ts ensureBase() → normalMap
```

**Tracing the failure**: The `??` merge at viewHandlers.ts line 316 is correct in isolation — DSL prop wins over theme. But the compiled state passes through `compileCarouselScrubber()` which does:

```typescript
// compile.ts lines 56-68
const definedStyle: Partial<CarouselScrubberStyle> = {};
if (props.style) {
  for (const [k, v] of Object.entries(props.style)) {
    if (v !== undefined) {
      (definedStyle as Record<string, unknown>)[k] = v;
    }
  }
}
const style: CarouselScrubberStyle = {
  ...DEFAULT_CAROUSEL_SCRUBBER_STYLE,
  ...definedStyle,
};
```

This should work. **However**, this entire path is untested as an integration. There is no test that:
1. Creates a React tree with `<ViewLayout kind="carousel"><CarouselTray surfacePattern="brushed" /></ViewLayout>`
2. Runs the compiler
3. Asserts the compiled state has `style.surfacePattern === 'brushed'`

**Possible hidden causes**:
- Theme registration timing: if `@brewsite/themes` registers its theme pairs AFTER the first compilation, `resolveSceneTheme()` falls back to `'default'` which has `surfacePattern: 'brushed'`. But if the theme later registers (e.g., `darkGlass` with `surfacePattern: 'grain'`), a recompilation picks it up. The scene might render twice — first correctly, then with theme override.
- The `??` operator handles `undefined` and `null` but NOT empty strings or other falsy values. If a prop somehow gets coerced to `''` or `0`, the fallback wouldn't trigger as expected. This is unlikely but untestable without the integration test.
- The `resolveThemedStyle()` comment in compile.ts line 54 says the undefined-stripping exists to support `resolveThemedStyle` downstream, but **resolveThemedStyle is never called**. If the original design required two-phase resolution (compile → then resolveThemedStyle in render), and that second phase was removed but the first phase's semantics were kept, the merge logic could be wrong for certain value combinations.

### Bug 2: "Material selection from the theme doesn't work"

**Root cause**: Compile-time theme resolution in viewHandlers.ts depends on `api.context.themeFamily` and `api.context.themePolarity` being correct. These are set in `sceneTrackCompiler.ts` lines 377-378:

```typescript
themeFamily:   options.activeTheme?.family   ?? 'default' as const,
themePolarity: options.activeTheme?.polarity ?? 'dark'    as const,
```

If `options.activeTheme` is not passed (or is `undefined`), the compiler always uses `'default'` + `'dark'`, which resolves to the enterprise preset. Named themes (darkGlass, neonCyber, etc.) would be silently ignored.

**Additionally**: The `resolveThemedStyle()` function in `themeResolve.ts` has a fundamental design flaw in its "is this DSL-explicit?" heuristic:

```typescript
baseColor: style.baseColor !== defaults.baseColor
  ? style.baseColor           // "DSL set this"
  : (trayTheme.color ?? style.baseColor)  // "use theme"
```

If a scene author explicitly writes `<CarouselTray color="#1E2F44" />` (which happens to BE the default), this function treats it as "not DSL-explicit" and the theme overrides it. This is a broken heuristic. **However, this function is dead code** — it's never called. The viewHandlers approach (`trayProps.color ?? trayTheme?.color`) doesn't have this problem because it checks the raw DSL prop existence, not the value.

**But the dead code is confusing**: A developer reading `themeResolve.ts` (and its 30 passing tests) would reasonably assume it's the canonical theme resolution path. The actual path is buried 30 lines deep inside a for-loop in viewHandlers.ts. This split-brain documentation/implementation mismatch is the kind of architectural confusion that breeds bugs.

### Bug 3: "The tray itself isn't rotating its texture. It should."

**Root cause**: There is **no texture rotation code** anywhere in the carousel scrubber renderer.

In `render.ts`, ring carousel tray rotation is handled at lines 509-531:

```typescript
cache.root.rotation.y = cache.currentRotation;
```

This rotates the entire `THREE.Group` containing the mesh. The mesh and its geometry rotate, and since the normal map texture is mapped via baked vertex UVs (normalized in `normalizeCapUVs()`), the texture pattern rotates WITH the geometry.

For most surface patterns, this is the correct behavior — the brushed metal pattern rotates as if the tray is physically rotating.

BUT: The user expects the texture itself to rotate independently. This could mean:

1. **The texture should counter-rotate** so the pattern stays visually fixed while the geometry spins (like a turntable platter where the grooves don't visibly spin from the camera). This requires `texture.rotation = -cache.currentRotation` each frame.

2. **The texture should rotate at a different rate** than the geometry for a visual effect.

3. **The tray rotation itself isn't happening**, so the user sees a static tray and reports "texture isn't rotating." This would happen if `state.loop` is false or `state.childCount` is 0 in the compiled state — which circles back to Bug 1/2 (compiled state is wrong).

The most likely scenario is #3: if the compiled state is wrong (bugs 1 and 2), the tray rotation conditions (`state.loop && state.childCount > 0`) might not be met, making the tray appear static.

---

## Architectural Root Causes

### Root Cause A: Dead Code Creates a Split-Brain Architecture

| File | Purpose | Status |
|---|---|---|
| `themeResolve.ts` | Canonical theme resolution | **Dead code** — imported nowhere in production |
| `themeResolve.test.ts` | Tests for theme resolution | **Testing dead code** — 30 passing tests for unused logic |
| `viewHandlers.ts:297-328` | Actual theme resolution | **Untested** — ad-hoc merge buried in handler |

The `resolveThemedStyle()` function was designed as the single point of theme resolution (per the plan files). But the implementation in `viewHandlers.ts` does its own merge using `trayProps.X ?? trayTheme?.X`. These are **semantically equivalent for the non-edge cases but diverge on edge cases**:

| Scenario | `resolveThemedStyle` result | viewHandlers result |
|---|---|---|
| DSL sets value = default | Theme overrides (bug) | DSL wins (correct) |
| DSL sets value ≠ default | DSL wins | DSL wins |
| Neither sets value | Default | Default |
| Theme sets, DSL doesn't | Theme wins | Theme wins |

The viewHandlers approach is actually more correct! But the dead function with 30 tests creates false confidence that theme resolution is well-tested, when the actual resolution path has zero tests.

### Root Cause B: The Critical Integration Seam is Untested

The carousel tray compilation involves a multi-step pipeline:

```
JSX tree → viewLayoutHandler → CarouselTray child detection →
  props extraction → theme resolution → compileCarouselScrubber →
    compiled state → widget reconciliation → widget.apply() → render
```

**What's tested** (✅) vs **what's not** (❌):

| Step | Tested? | Test file |
|---|---|---|
| `compileCarouselScrubber()` pure function | ✅ | compile.test.ts |
| `resolveThemedStyle()` (dead code) | ✅ | themeResolve.test.ts |
| `computeTrayPosition()` | ✅ | trayPosition.test.ts |
| `generateSurfaceNormalMap()` | ✅ | surfaceTexture.test.ts |
| `computeGeometryKey()` | ✅ | geometry.test.ts |
| viewLayoutHandler CarouselTray detection | ❌ | — |
| viewLayoutHandler props extraction from JSX | ❌ | — |
| viewLayoutHandler theme resolution | ❌ | — |
| viewLayoutHandler → compileCarouselScrubber integration | ❌ | — |
| CarouselScrubberWidget reconciliation (plugins.ts) | ❌ | — |
| Full DSL → compiled state end-to-end | ❌ | — |

**Every bug the user reported lives in the untested integration layer.** The pure functions work correctly in isolation. The bugs are in how they're wired together.

### Root Cause C: viewLayoutHandler Does Too Many Things

The `viewLayoutHandler` function (viewHandlers.ts) handles:
1. Layout ID generation
2. Container bounds composition
3. Child View collection and size hint extraction
4. Layout resolution via `resolveLayout()`
5. ViewLayoutResult mapping
6. Layout context propagation (WeakMap)
7. Child compilation delegation
8. ViewLayoutState creation
9. **CarouselTray detection** (nested for-loop)
10. **Theme resolution** (resolveSceneTheme call)
11. **Tray props extraction** (casting childEl.props)
12. **Tray state compilation** (compileCarouselScrubber call)
13. **View extent computation** (nested for-loop over compiled view states)

That's 13 responsibilities in a single function. The carousel tray logic (items 9-13) is nested inside an `if (kind === 'carousel')` block inside a `for (const child of children)` loop. This structure makes it nearly impossible to test the tray compilation in isolation without running the entire ViewLayout compilation.

---

## What Needs to Change

### 1. Extract Tray Compilation Into a Testable Pure Function

Move the carousel tray compilation logic out of `viewLayoutHandler` into its own pure function:

```typescript
// New file: carousel-scrubber/compileTray.ts
export function compileTrayFromViewLayout(
  trayProps: CarouselTrayProps,
  layoutId: string,
  carouselConfig: CarouselLayoutConfig,
  viewIds: string[],
  composedContainerBounds: NVSRect,
  viewStates: Map<string, ViewState>,
  themeFamily: ThemeFamily,
  themePolarity: ThemePolarity,
): CarouselScrubberState {
  // 1. Resolve theme
  // 2. Compute view extent from viewStates
  // 3. Merge DSL props > theme > defaults
  // 4. Call compileCarouselScrubber
  // 5. Return state
}
```

This function is pure, testable, and makes the merge logic visible and verifiable.

### 2. Delete `resolveThemedStyle` or Wire It In

Choose one:
- **Option A**: Delete `themeResolve.ts` and its test. The viewHandlers approach is more correct. Document the merge strategy in `compileTray.ts`.
- **Option B**: Rewrite `resolveThemedStyle` to accept raw DSL props (not compiled state) so it can distinguish "DSL set this" from "default". Then call it from `compileTray.ts`.

Option A is simpler and eliminates the split-brain. Option B preserves the abstraction but requires a new approach to the "is this DSL-explicit?" heuristic (e.g., passing a `Set<string>` of explicitly-set prop names).

### 3. Write Integration Tests for the Full Compilation Path

Required tests (these don't exist today):

```typescript
describe('viewLayoutHandler carousel tray integration', () => {
  it('compiles CarouselTray with DSL surfacePattern into state', () => {
    // Build JSX: <ViewLayout kind="carousel"><View id="v1"/><CarouselTray surfacePattern="radial"/></ViewLayout>
    // Run through sceneDslCompiler with real CompileApi
    // Assert: widgets['layoutId__tray'].style.surfacePattern === 'radial'
  });

  it('applies theme surfacePattern when DSL does not set it', () => {
    // Register darkGlass theme (surfacePattern: 'grain')
    // Build JSX: <ViewLayout kind="carousel"><View id="v1"/><CarouselTray/></ViewLayout>
    // Run compiler with themeFamily='darkGlass', themePolarity='dark'
    // Assert: widgets['layoutId__tray'].style.surfacePattern === 'grain'
  });

  it('DSL surfacePattern overrides theme surfacePattern', () => {
    // Register darkGlass theme (surfacePattern: 'grain')
    // Build JSX: <CarouselTray surfacePattern="brushed"/>
    // Assert: style.surfacePattern === 'brushed'
  });

  it('DSL color overrides theme color', () => {
    // Register darkGlass theme (color: '#1C100C')
    // Build JSX: <CarouselTray color="#ff0000"/>
    // Assert: style.baseColor === '#ff0000'
  });

  it('compiles tray with correct loop and childCount from ViewLayout', () => {
    // Build JSX with loop={true} and 5 View children
    // Assert: state.loop === true, state.childCount === 5
  });

  it('compiles correct viewExtent from resolved view bounds', () => {
    // Build JSX with known View sizes
    // Assert: state.viewExtent matches tight bounding box
  });
});
```

These tests would have caught all three reported bugs before they shipped.

### 4. Add Texture Rotation Support

The current code rotates `cache.root.rotation.y` but does nothing to the texture. Two options:

**Option A: Texture stays fixed while tray spins** (counter-rotate the normal map):
```typescript
// In render.ts, after rotation lerp:
if (cache.base?.material.normalMap) {
  cache.base.material.normalMap.rotation = -cache.currentRotation;
  cache.base.material.normalMap.center.set(0.5, 0.5);
  cache.base.material.normalMap.needsUpdate = true; // only if rotation changed
}
```

**Option B: Add a `textureRotation` field to `CarouselScrubberState`** for author control:
```typescript
// In types.ts, add to CarouselScrubberStyle:
surfaceRotation?: number; // radians, default 0. 'auto' matches tray rotation.
```

Option A is simpler and probably the correct visual default.

### 5. Establish a Testing Pattern for Child Widget Compilation

The carousel tray is the first "child widget" in the system — it's compiled as a side effect of its parent `ViewLayout` handler, not by its own registered NodeHandler. This pattern has no test coverage framework.

Define the pattern:

```
A child widget is a widget whose compiled state is produced by its parent's NodeHandler,
not by its own NodeHandler. The child's DSL component has a no-op handler
(or no handler at all). The parent extracts child props, resolves theme, and emits state.

Testing strategy: The parent handler must be testable with a minimal CompileApi
that captures setWidgetState calls. Build a JSX tree with the parent + child,
invoke the parent handler, and assert the child's compiled state.
```

This pattern also applies to potential future child widgets (e.g., `<ChartTooltip>` inside `<BarChart>`, overlay items inside `<View>`).

---

## Summary of Findings

| Bug | Root Cause | Fix Category |
|---|---|---|
| Always get "onyx" material | Integration seam untested; possible theme override | Integration test + extract compileTray |
| Theme material doesn't work | `activeTheme` propagation untested; dead code confusion | Integration test + delete dead code |
| Texture not rotating | No texture rotation code exists | Implementation gap in render.ts |

| Architectural Issue | Severity | Fix |
|---|---|---|
| `resolveThemedStyle` is dead code | High (false confidence) | Delete or wire in |
| viewLayoutHandler has 13 responsibilities | High (untestable) | Extract compileTray function |
| No integration test for tray compilation | Critical (all 3 bugs) | Write integration tests |
| No child widget testing pattern | Medium (prevents future bugs) | Define and document pattern |
| Comment in compile.ts references dead function | Low (misleading) | Update comment |
