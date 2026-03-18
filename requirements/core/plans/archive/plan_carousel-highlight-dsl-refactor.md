---
title: "Refactor: Separate Highlight DSL from CarouselTray"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-18
change_history:
  - date: 2026-03-18
    author: architect
    summary: "Initial plan created. Defined Phase 0 bug fixes and Phase 1 DSL refactor scope."
  - date: 2026-03-18
    author: PM + architect review
    summary: >
      Corrected viewHandlers.ts path to compiler/blocks/viewHandlers.ts.
      Removed incorrect render.ts fix from BUG-1 (mergeSnapshot fix is sufficient).
      Removed IDslComposite from CarouselScrubberWidget — Highlight detection
      handled directly in viewLayoutHandler following existing CarouselTray pattern.
      Added console.warn for Highlight without CarouselTray sibling.
      Promoted resolveRuntimeHighlight variant resolution from tech debt to Phase 1 step.
      Added explicit deprecation timeline. Expanded test strategy with integration tests.
---

# Refactor: Separate Highlight DSL from CarouselTray

## Problem Statement

`<CarouselTray>` has become a dumping ground. It configures two completely unrelated things through one flat prop surface:

1. **A physical 3D tray** — material, color, metalness, roughness, edge style, surface pattern, depth, gap, outer margin (18 props)
2. **Per-view volumetric highlight effects** — mode, color, intensity, beam height, smoke, dust, backdrop opacity, backdrop color, blend mode, z-offset, variant (11 props on `CarouselTrayProps`, plus the full `ViewHighlightConfig` bag inside the `highlights` array)

These are separate concepts that happen to render near each other. The tray is a piece of furniture. The highlights are per-view visual effects that glow, beam, smoke, and dim the scene behind them. They have different authoring intentions, different theme resolution paths, and different audiences.

### What feels wrong

A scene author writing this:

```tsx
<CarouselTray
  metalness={0.1}
  highlightActive="holographic"
  highlightColor="#E36A2E"
  highlightSmoke
/>
```

...is configuring the tray's metallic sheen and the holographic beam in the same breath. The `highlight*` prefix convention is a naming hack that papers over a missing abstraction.

The `highlights` array is worse — it's a fully-specified `ViewHighlightConfig[]` embedded as a prop of the tray. The tray doesn't meaningfully own this data. It's just the nearest component that happened to have access to the view IDs at compile time.

### What doesn't feel wrong

The `highlights` array on `ViewHighlightConfig` has `viewId` targeting — highlights are per-view. That's correct. The backdrop is a scene-space effect that dims non-highlighted content. It belongs with the highlight, not with the view.

The theme palette system (`highlightPalette` with semantic variant names) is well-designed. The problem is purely about the DSL surface and where the configuration lives.

---

## Design Principles

1. **One component, one concept.** `<CarouselTray>` should configure the tray. Highlight effects should be configured through a dedicated highlight component.
2. **Child composition, not props explosion.** The existing pattern in the codebase (Lighting → Ambient/Directional/Spot; Chart → ChartAxis/ChartSeries/ChartLegend) is child-component composition. Highlights should follow the same pattern.
3. **Highlight is a ViewLayout concern, not a CarouselTray concern.** The tray is optional — you can have a carousel without one. But highlights conceptually apply to views within a layout, regardless of whether there's a tray beneath them.
4. **Theme defaults still work.** A scene author who just wants "the theme's default highlight on the active item" should not need to specify anything — the theme's `highlightPalette` and a single enable flag should suffice.
5. **Backward compatible.** The existing `highlightActive`, `highlightColor`, etc. props on `<CarouselTray>` continue to work during a deprecation period. Legacy props are deprecated in the minor release that ships this refactor. Planned removal in the next major version.

---

## Proposed DSL

### New component: `<Highlight>`

A child of `<ViewLayout>` (not of `<CarouselTray>`). One per highlighted view.

```tsx
<ViewLayout kind="carousel" id="metrics" loop activeIndex={0} zStep={15}>
  <View id="chart-1"><RevenueChart /></View>
  <View id="chart-2"><CostChart /></View>
  <View id="chart-3"><AlertChart /></View>

  <CarouselTray surface="obsidian" metalness={0.1} />

  {/* Highlight the active item with a holographic beam */}
  <Highlight active variant="primary" smoke />

  {/* Highlight a specific view with an error beam */}
  <Highlight viewId="chart-3" variant="error" smoke />
</ViewLayout>
```

### `<Highlight>` props

```typescript
export type HighlightProps = {
  /**
   * When true, this highlight tracks the active carousel item.
   * Mutually exclusive with `viewId`.
   * Default: false.
   */
  active?: boolean;

  /**
   * Target a specific view by ID. The highlight follows this view
   * as it moves around the carousel.
   * Mutually exclusive with `active`.
   */
  viewId?: string;

  /**
   * Semantic variant name — resolves color, mode, intensity, backdrop,
   * etc. from the theme's highlightPalette.
   * Explicit props override variant values.
   *
   * @example 'primary' | 'error' | 'warning' | 'success'
   */
  variant?: HighlightVariantName;

  /**
   * Highlight mode. Default: resolved from variant, or 'glow'.
   */
  mode?: ViewHighlightMode;

  /** Highlight color. Default: resolved from variant, or accentColor. */
  color?: string;

  /** Intensity [0-1]. Default: resolved from variant, or mode default. */
  intensity?: number;

  /** Beam height in world units (holographic only). Default: 5.0. */
  beamHeight?: number;

  /** Enable smoke ring (holographic only). Default: false. */
  smoke?: boolean;

  /** Enable volumetric dust motes (holographic only). Default: false. */
  dust?: boolean;

  /** Z offset in world units. Negative = push back. Default: 0. */
  zOffset?: number;

  /** Backdrop opacity [0-1]. 0 = no backdrop. Default: from variant. */
  backdropOpacity?: number;

  /** Backdrop color. Default: from variant, or polarity default. */
  backdropColor?: string;

  /**
   * Blending mode. Auto-resolved from scene colorMode when not set.
   * 'additive' — bright glow on dark backgrounds.
   * 'normal'   — tinted overlay on light backgrounds.
   */
  blendMode?: 'additive' | 'normal';
};
```

### Before and after

**Before (current):**

```tsx
<ViewLayout kind="carousel" id="metrics" loop activeIndex={0} zStep={15}>
  <CarouselViews />
  <CarouselTray
    metalness={0.1}
    highlightActive="holographic"
    highlightColor="#E36A2E"
    highlightSmoke
  />
</ViewLayout>
```

**After (proposed):**

```tsx
<ViewLayout kind="carousel" id="metrics" loop activeIndex={0} zStep={15}>
  <CarouselViews />
  <CarouselTray metalness={0.1} />
  <Highlight active mode="holographic" color="#E36A2E" smoke />
</ViewLayout>
```

**Before (per-view highlights):**

```tsx
<CarouselTray
  metalness={0.1}
  highlights={[
    { viewId: 'rc1', mode: 'holographic', variant: 'primary', smoke: true, beamHeight: 4 },
    { viewId: 'rc3', mode: 'glow', variant: 'success', intensity: 0.5 },
    { viewId: 'rc5', mode: 'holographic', variant: 'error', smoke: true, beamHeight: 4 },
  ]}
/>
```

**After (per-view highlights):**

```tsx
<CarouselTray metalness={0.1} />
<Highlight viewId="rc1" variant="primary" mode="holographic" smoke beamHeight={4} />
<Highlight viewId="rc3" variant="success" mode="glow" intensity={0.5} />
<Highlight viewId="rc5" variant="error" mode="holographic" smoke beamHeight={4} />
```

The per-view form is dramatically more readable. Each highlight is a self-contained declaration. No array syntax, no object literal nesting, no bracket soup.

### Theme-only usage (no DSL props at all)

```tsx
<ViewLayout kind="carousel" id="metrics" loop activeIndex={0} zStep={15}>
  <CarouselViews />
  <CarouselTray />
  <Highlight active />
</ViewLayout>
```

`<Highlight active />` resolves everything from the theme: variant defaults to 'primary', which pulls mode, color, intensity, backdrop from the theme's `highlightPalette.primary`. One element, one intent.

---

## Theme Surface Changes

### Move highlight defaults OUT of `SceneThemeCarouselTray`

The following fields are **deprecated** on `SceneThemeCarouselTray` (with backward compat):

- `highlightActive`
- `highlightColor`
- `highlightIntensity`
- `highlightBeamHeight`
- `highlightSmoke`
- `highlightZOffset`
- `highlightBackdropColor`
- `highlightViewId`

These were always awkward — they're highlight configuration masquerading as tray configuration. Deprecated in the minor release that ships this refactor; removed in the next major version.

### New: `SceneThemeHighlightDefaults`

A dedicated theme token block at the `SceneTheme` level (not nested under `carouselTray`):

```typescript
export type SceneThemeHighlightDefaults = {
  /** Default mode when no variant or explicit mode is set. Default: 'glow'. */
  readonly mode?: ViewHighlightMode;
  /** Default backdrop opacity [0-1]. */
  readonly backdropOpacity?: number;
  /** Default backdrop color. Auto-resolved from polarity when not set. */
  readonly backdropColor?: string;
  /** Default beam height [world units]. */
  readonly beamHeight?: number;
};

export type SceneTheme = {
  // ... existing fields ...

  /** Semantic highlight palette — named highlight variants. */
  readonly highlightPalette?: SceneThemeHighlightPalette;

  /** Default highlight configuration when no variant is specified. */
  readonly highlightDefaults?: SceneThemeHighlightDefaults;
};
```

The highlight palette already lives at the `SceneTheme` level — moving the defaults to match is natural.

---

## Compilation Changes

### New NodeHandler: `highlightNodeHandler`

Registered for the `<Highlight>` DSL component. Called by the viewLayout compiler when it encounters `<Highlight>` children.

**Input:** `<Highlight>` props + parent ViewLayout context (layout ID, view IDs, active index, polarity)

**Output:** Appends to the `viewHighlights` array on the `CarouselScrubberState` for the associated tray widget. If no tray exists, the highlights are stored on the ViewLayout state and the tray (or a future standalone highlight renderer) reads them.

### Resolution chain

For each `<Highlight>` child:

1. Resolve variant from `props.variant` → `SceneTheme.highlightPalette[variant]`
2. Resolve each field: `props.{field} ?? variant.{field} ?? SceneTheme.highlightDefaults.{field} ?? constant default`
3. Resolve `active` vs `viewId`:
   - `active`: target the view at `carousel.activeIndex`
   - `viewId`: target the named view
   - Neither: compile warning (highlight has no target)
4. Build `ViewHighlight` and append to the compiled highlights array

### Backward compatibility in compileTray.ts

When `<CarouselTray>` has the old `highlightActive`, `highlightColor`, etc. props:

1. Convert to an equivalent `<Highlight active mode={...} color={...} />` internally
2. Emit a `console.warn` in dev mode: "highlight* props on <CarouselTray> are deprecated — use <Highlight> as a sibling child of <ViewLayout>"
3. Both sources merge: explicit `<Highlight>` children + legacy tray props → same `viewHighlights` array

---

## Render Changes

**None.** The render layer already consumes `CarouselScrubberState.viewHighlights` — it doesn't care where they came from. The entire refactor is DSL + compilation.

The only consideration: if a `<ViewLayout>` has `<Highlight>` children but no `<CarouselTray>`, where do the highlights attach? Two options:

**Option A (recommended):** Require `<CarouselTray>` for highlights to render. The tray widget owns the Three.js highlight meshes. A `<Highlight>` without a `<CarouselTray>` sibling emits `console.warn('[ViewLayout] <Highlight> requires a <CarouselTray> sibling to render. Highlights will be ignored.')` and produces no output. This is the current architecture and requires zero render changes.

**Option B (future):** A standalone `HighlightWidget` that renders highlights without a tray. This is a larger change for a future release.

We go with Option A. `<Highlight>` is a configuration component consumed by the tray's compilation path. The tray remains the renderer. This preserves the existing render architecture while completely cleaning up the DSL.

---

## File Changes

### New files

| File | Purpose |
|------|---------|
| `elements/carousel-scrubber/highlightDsl.tsx` | `<Highlight>` DSL component + `HighlightProps` type |

### Modified files

| File | Changes |
|------|---------|
| `compiler/blocks/viewLayoutDsl.tsx` | No change — `<Highlight>` is a child component, processed by the viewLayout handler |
| `compiler/blocks/viewHandlers.ts` | Detect `<Highlight>` children alongside `<CarouselTray>` children in `viewLayoutHandler`. Collect highlight props, and if no `<CarouselTray>` sibling exists emit `console.warn('[ViewLayout] <Highlight> requires a <CarouselTray> sibling to render. Highlights will be ignored.')`. Pass collected highlight configs to `compileTrayFromViewLayout()` |
| `elements/carousel-scrubber/dsl.tsx` | Mark `highlightActive`, `highlightColor`, `highlightIntensity`, `highlightBeamHeight`, `highlightSmoke`, `highlightZOffset`, `highlightViewId`, `highlights` as `@deprecated` |
| `elements/carousel-scrubber/compileTray.ts` | Accept parsed `<Highlight>` configs alongside legacy tray props. Merge both into the same `viewHighlights` array |
| `theme/types.ts` | Add `SceneThemeHighlightDefaults` to `SceneTheme`. Deprecate highlight fields on `SceneThemeCarouselTray` |
| `elements/carousel-scrubber/index.ts` | Export `Highlight` component and `HighlightProps` type. Current exports are already clean (internal geometry/position types were removed in latest commit) |
| `compiler/index.ts` | Export `Highlight` from the DSL authoring surface (currently exports `CarouselTray` + `CarouselTrayProps`) |
| `elements/index.ts` | Add `Highlight` + `HighlightProps` to the public re-exports (currently exports `ViewHighlightMode`, `ViewHighlightConfig`, `useCarouselHighlight`, `createCarouselHighlightController`) |

### Unchanged files

| File | Reason |
|------|--------|
| `elements/carousel-scrubber/render.ts` | Consumes `viewHighlights` — no structural change. Beam now uses `MeshBasicMaterial` + canvas gradient texture (no longer uses `highlightShader.ts`). Runtime highlight merge calls `resolveRuntimeHighlight()` from `compileTray.ts` |
| `elements/carousel-scrubber/types.ts` | Pure type contracts only (constants already extracted to `highlightConstants.ts`). `ViewHighlight` and `ViewHighlightConfig` stay as-is |
| `elements/carousel-scrubber/compile.ts` | Default state and transition spec unchanged |
| `elements/carousel-scrubber/highlightConstants.ts` | Constants unchanged |
| `elements/carousel-scrubber/highlightParticles.ts` | Particle math unchanged |
| All theme preset files | `highlightPalette` already lives at the right level |

### Dead code to remove

| File | Reason |
|------|--------|
| `elements/carousel-scrubber/highlightShader.ts` | No longer imported anywhere. Beam rendering was rewritten to use `MeshBasicMaterial` + canvas gradient texture instead of the custom vertex/fragment shader. Delete this file during implementation |

### Scene file updates

| File | Change |
|------|--------|
| `apps/examples/src/views/scenes/scene3-carousel.tsx` | Move `highlightActive`, `highlightColor`, `highlightSmoke` from `<CarouselTray>` to `<Highlight active>` sibling |
| `apps/examples/src/input-showcase/scenes/scene4-ring-carousel.tsx` | Replace `highlights={[...]}` array with three `<Highlight>` siblings |
| `apps/examples/src/input-showcase/scenes/scene5-linear-carousel.tsx` | No change (no highlights) |

---

## Test Strategy

Current test state: `compileTray.test.ts` is 881 lines covering `compileTrayFromViewLayout`, `computeViewExtent`, `resolveHighlightMode`, `buildViewHighlights` (including `backdropColor` threading), and `resolveRuntimeHighlight`. All 1661 core tests pass.

| Module | Tests |
|--------|-------|
| `highlightDsl.tsx` | No runtime tests needed — null-returning stub, type-only |
| `compileTray.ts` | **New tests**: Add a `buildViewHighlightsFromDsl()` (or similar) function that accepts parsed `<Highlight>` props and produces `ViewHighlight[]`. Test: active targeting, viewId targeting, variant resolution, explicit overrides, mixed `<Highlight>` + legacy props merge, no-target warning. Keep all existing `buildViewHighlights` tests — they exercise the legacy path which remains supported |
| `compiler/blocks/viewHandlers.ts` | **Integration tests** in `compiler/__tests__/viewHandlers.test.tsx`: (1) Compile a `<ViewLayout kind="carousel">` with `<CarouselTray />` and `<Highlight active variant="primary" smoke />` as children — assert the resulting `CarouselScrubberState.viewHighlights` contains the correct resolved highlight entry. (2) Compile with `<Highlight viewId="chart-3" variant="error" />` — assert viewId targeting. (3) Compile with `<Highlight>` but no `<CarouselTray>` sibling — assert `console.warn` is emitted and no highlight state is produced. (4) Compile with both `<Highlight>` children and legacy `highlightActive` tray props — assert both merge into the same `viewHighlights` array |
| `resolveRuntimeHighlight` | **Extend existing tests**: Add tests for variant resolution via the new `palette` parameter — `resolveRuntimeHighlight({ viewId: 'x', variant: 'error' }, bounds, accentColor, palette)` must produce the palette's error mode/color/intensity, not the fallback glow |

---

## Migration Guide

### For scene authors

**Before:**
```tsx
<CarouselTray highlightActive="holographic" highlightColor="#E36A2E" highlightSmoke />
```

**After:**
```tsx
<CarouselTray />
<Highlight active mode="holographic" color="#E36A2E" smoke />
```

**Before:**
```tsx
<CarouselTray highlights={[
  { viewId: 'rc1', variant: 'primary', mode: 'holographic', smoke: true },
]} />
```

**After:**
```tsx
<CarouselTray />
<Highlight viewId="rc1" variant="primary" mode="holographic" smoke />
```

### For theme authors

No changes required. `highlightPalette` already lives at the `SceneTheme` level. The deprecated `carouselTray.highlightActive` etc. fields continue to work.

Optionally adopt `SceneTheme.highlightDefaults` for global non-variant defaults (backdrop color, mode, beam height).

---

## Implementation Order

### Parallelization notes

- **Phase 0 and Phase 1 are fully independent** — no file overlap after the IDslComposite removal. They can be implemented in parallel.
- **Within Phase 0:** ENH-1 and ENH-2 both touch `render.ts` and must be serialized. BUG-1 and BUG-2 touch different files and can run in parallel. ENH-1/ENH-2 can run in parallel with BUG-1/BUG-2.
- **Within Phase 1:** Steps are sequential (each builds on the prior).

### Phase 0: Bug fixes (ship immediately, before or alongside DSL refactor)

1. **BUG-1: Scene merge** — Fix `mergeSnapshot()` to clear `viewHighlights` on exit (`{ ...prev, showBase: false, viewHighlights: [] }`). No render.ts changes needed. Add tests.
2. **BUG-2: Scroll spatial gating** — Add NVS hit-test to `ActionInputController.dispatchCarousel()`. Verify mobile touch works.
3. **ENH-2: Beam Z squeeze** — Add `HL_BEAM_Z_SQUEEZE = 0.7` constant, apply to all highlight mesh Z scales.
4. **ENH-1: Closed linear tray** — Replace parabolic horseshoe with closed rounded shape. Update geometry tests.

### Phase 1: DSL refactor

5. **`highlightDsl.tsx`** — Create `<Highlight>` component and `HighlightProps` type
6. **`compiler/blocks/viewHandlers.ts`** — Detect `<Highlight>` children by React element type in `viewLayoutHandler` (same pattern as existing `CarouselTray` detection). Collect highlight props. If `<Highlight>` children exist but no `<CarouselTray>` sibling, emit `console.warn`. Pass collected highlight configs to `compileTrayFromViewLayout()`
7. **`compileTray.ts`** — Accept new highlight configs, merge with legacy
8. **`compileTray.ts` (resolveRuntimeHighlight)** — Add `palette` parameter to `resolveRuntimeHighlight()`. Resolve `cfg.variant` against the palette before field resolution, matching the logic in `buildViewHighlights`. This unblocks the programmatic monitoring use case where `setHighlight({ viewId: 'cpu', variant: 'error' })` must resolve to the theme's error palette. Update existing `resolveRuntimeHighlight` tests to cover variant resolution
9. **`theme/types.ts`** — Add `SceneThemeHighlightDefaults`
10. **`compiler/index.ts`** + `index.ts` + `elements/index.ts` — Export new component
11. **Scene files** — Migrate examples
12. **`dsl.tsx`** + `theme/types.ts` — Add `@deprecated` JSDoc to old fields
13. **Cleanup** — Delete dead `highlightShader.ts`
14. **Tests** — Parallel test coverage for new `<Highlight>` input path

---

## Programmatic Control (Runtime Highlights)

The primary use case for highlights is **not** static scene authoring — it's runtime application monitoring. A system watches metrics, detects an anomaly, and highlights the graph that shows the problem. This is imperative, event-driven, and happens outside the DSL.

### Existing API — already correct, no changes needed

The programmatic API already exists and is well-designed for this use case. It operates at the widget level, completely independent of the DSL refactor:

#### React hook (inside EngineProvider / overlay content)

```tsx
import { useCarouselHighlight } from '@brewsite/core';

function MetricsOverlay() {
  const engine = useSceneEngineContext();
  const highlights = useCarouselHighlight(engine.widgetRegistry, 'metrics-layout');

  useEffect(() => {
    // WebSocket, polling, or state change triggers a highlight
    const unsub = anomalyDetector.subscribe((anomaly) => {
      highlights.setHighlight({
        viewId: anomaly.chartId,
        variant: 'error',
        mode: 'holographic',
        smoke: true,
      });
    });
    return unsub;
  }, [highlights]);

  // Clear when user acknowledges
  const onDismiss = (chartId: string) => highlights.clearHighlight(chartId);

  return <DismissButton onClick={() => onDismiss('chart-3')} />;
}
```

#### Non-React imperative API (callbacks, timers, WebSocket handlers)

```typescript
import { createCarouselHighlightController } from '@brewsite/core';

// Outside React — e.g., in a WebSocket message handler
const controller = createCarouselHighlightController(registry, 'metrics-layout');

socket.onMessage((msg) => {
  if (msg.type === 'anomaly') {
    controller.setHighlight({
      viewId: msg.chartId,
      variant: 'error',
      mode: 'holographic',
      smoke: true,
      backdropOpacity: 0.7,
    });
  }
  if (msg.type === 'resolved') {
    controller.clearHighlight(msg.chartId);
  }
});
```

### Why no changes are needed

The programmatic API accepts `ViewHighlightConfig` objects — the same shape used internally by the compile layer. It writes directly to the tray widget's `runtimeHighlights` map, which is merged with compiled highlights every frame in `render.ts`. The full resolution chain works:

1. `setHighlight({ viewId: 'chart-3', variant: 'error' })` → stored on widget
2. Next render frame: `resolveRuntimeHighlight()` resolves variant + defaults → `ViewHighlight`
3. Merged into `mergedHighlights` array (runtime overrides compiled for same viewId)
4. `applyViewHighlights()` renders/updates the Three.js meshes with fade transitions

All of `backdropColor`, `backdropOpacity`, `blendMode`, `dust`, `smoke`, `beamHeight`, `zOffset` — everything the DSL `<Highlight>` can configure — is already available through `ViewHighlightConfig` in the programmatic API.

### What the PM should document in PRDs

The following are **existing capabilities** that should be explicitly called out in product documentation, since they're the primary use case:

1. **`useCarouselHighlight(registry, layoutId)`** — React hook for highlight control from overlay content. Returns `{ setHighlight, clearHighlight, clearAll }`.

2. **`createCarouselHighlightController(registry, layoutId)`** — Non-React imperative API for highlight control from callbacks, timers, WebSocket handlers. Same return shape.

3. **Runtime highlights override compiled highlights.** If a `<Highlight>` DSL component targets `chart-3` with `variant="primary"`, and runtime code calls `setHighlight({ viewId: 'chart-3', variant: 'error' })`, the runtime highlight wins. When `clearHighlight('chart-3')` is called, the compiled highlight resumes.

4. **Multiple simultaneous highlights.** Each `setHighlight()` call is additive — calling it for `chart-1` and then `chart-3` highlights both. Only `clearHighlight(viewId)` or `clearAll()` removes them.

5. **Variant resolution in the runtime path — fixed in Phase 1 step 8.** `resolveRuntimeHighlight()` is updated to accept a `palette` parameter and resolve `cfg.variant` against the theme palette, matching the logic in `buildViewHighlights`. After this fix, `setHighlight({ viewId: 'chart-3', variant: 'error' })` correctly resolves to the theme's error palette (e.g., red holographic beam).

6. **Access pattern.** The `WidgetRegistry` is available via:
   - `useSceneEngineContext().widgetRegistry` — inside the `<SceneEngine>` React tree (overlay content, HUD components)
   - The `widgetRegistry` option passed to `useSceneEngine()` — for app-level code that owns the engine
   - Direct widget reference: `registry.get('layoutId__tray') as CarouselScrubberWidget` — for advanced use

### Typical integration pattern: monitoring dashboard

```tsx
// Scene: declarative layout with default highlights
const MonitoringScene = () => (
  <Scene>
    <ViewLayout kind="carousel" id="metrics" loop activeIndex={0} zStep={15}>
      <View id="cpu"><CpuChart /></View>
      <View id="memory"><MemoryChart /></View>
      <View id="network"><NetworkChart /></View>
      <View id="disk"><DiskChart /></View>

      <CarouselTray surface="steel" />
      <Highlight active variant="primary" />  {/* subtle glow on current view */}
    </ViewLayout>
  </Scene>
);

// Overlay: reacts to anomalies at runtime
const AlertOverlay = () => {
  const { widgetRegistry } = useSceneEngineContext();
  const hl = useCarouselHighlight(widgetRegistry, 'metrics');

  useEffect(() => {
    const unsub = alertStream.subscribe((alert) => {
      if (alert.severity === 'critical') {
        hl.setHighlight({
          viewId: alert.metricId,   // e.g., 'cpu'
          variant: 'error',
          mode: 'holographic',
          smoke: true,
        });
      } else if (alert.severity === 'warning') {
        hl.setHighlight({
          viewId: alert.metricId,
          variant: 'warning',
        });
      } else if (alert.type === 'resolved') {
        hl.clearHighlight(alert.metricId);
      }
    });
    return unsub;
  }, [hl]);

  return null; // pure side-effect overlay
};
```

The declarative `<Highlight active variant="primary" />` provides baseline visual context. The imperative `hl.setHighlight(...)` overrides specific views when anomalies occur. When the anomaly resolves, `clearHighlight()` restores the compiled baseline. Both paths merge seamlessly because they produce the same `ViewHighlight` shape.

---

## What this does NOT do

- **Does not change the render layer.** Highlights still render via `CarouselScrubberWidget`. Beam uses `MeshBasicMaterial` + canvas gradient (the old `highlightShader.ts` GLSL shader is dead code and should be deleted). This is a DSL-only refactor.
- **Does not remove `ViewHighlightConfig`.** The programmatic API (`useCarouselHighlight`, `createCarouselHighlightController`) still accepts `ViewHighlightConfig` objects. That's the right shape for imperative code — the DSL refactor is about declarative scene authoring only.
- **Does not break existing scenes.** Legacy props continue to work with a deprecation warning.
- **Does not move highlights to `<View>`.** Highlights are an effect rendered by the tray in 3D space above the carousel — they're not a view-level concept. A view doesn't know or care whether it's highlighted. The highlight is an external annotation, like a spotlight on a stage — it belongs to the stage director (the layout), not the actor (the view).

## Bug Fixes (must ship with or before this refactor)

### BUG-1: Scene merge — tray and highlights persist across scene transitions

**Symptom:** When transitioning from a scene with a `<CarouselTray>` + highlights to a scene without one, the tray mesh and highlight beams remain visible as ghosts instead of fading out.

**Root cause:** `mergeSnapshot()` in `CarouselScrubberWidget.ts:115-131` sets `showBase: false` when `next` is undefined, which hides the tray geometry. But it preserves `viewHighlights` from the previous state via `{ ...prev, showBase: false }`. The render layer continues to see the old `viewHighlights` array and keeps the highlight meshes alive.

Note: there is no `showBase` early return in `applyCarouselScrubber()`. The only early return (render.ts:1299) checks `childCount === 0 || layoutId === ''`, which does not trigger here because `prev` had valid values. The `showBase` flag is passed to `ensureBase()` (render.ts:1382) which controls tray mesh visibility but does not return early — execution continues to the highlight section at render.ts:1414+. The stale `viewHighlights` array causes `hasHighlights` to be true, so highlights keep rendering.

**Fix:** When `!next && prev`, return a state that also clears highlights:

```typescript
// CarouselScrubberWidget.ts — mergeSnapshot
if (!next && prev) return { ...prev, showBase: false, viewHighlights: [] };
```

With `viewHighlights: []`, the `hasHighlights` check (render.ts:1433) evaluates to false, and the cleanup branch (render.ts:1437-1443) disposes the highlight meshes. No render.ts changes are needed.

**Files:** `CarouselScrubberWidget.ts`
**Tests:** Add `mergeSnapshot` tests verifying that `viewHighlights` is cleared when `next` is undefined.

---

### BUG-2: Carousel scroll/wheel events fire globally instead of only over the tray

**Symptom:** Scrolling or swiping anywhere on the canvas triggers `carousel.next`/`carousel.prev` actions, even when the pointer isn't near the carousel. On mobile, a full-screen swipe moves the carousel instead of scrolling the page.

**Root cause:** The `<Action type="carousel.next">` + `<WheelMap>` / `<PointerMap>` DSL captures events on the entire canvas element. There is no hit-test or spatial gating. `ActionInputController.dispatchCarousel()` (ActionInputController.ts:209-220) fires unconditionally — it checks `action.layoutId` but not pointer position.

**Fix approach:** Add a spatial gate to carousel actions. Two options:

**Option A (recommended): NVS hit-test in ActionInputController**
- When dispatching a `carousel.next`/`carousel.prev` from a pointer/wheel event, check whether the pointer's NVS coordinates fall within the carousel's layout bounds (available from `ViewLayoutState`).
- The `ActionInputController` already has access to canvas coordinates via the event. Add an NVS conversion (pixel → NVS) and bounds check.
- For touch/mobile: use `touchstart` coordinates for the active touch, not the center of the viewport.

**Option B: Canvas region zones**
- Allow `<Action>` to specify an NVS bounding region (`region={{ x, y, w, h }}`) that gates pointer/wheel events. Only fire when the event lands inside the region.
- More general but higher implementation cost.

**Key requirement:** Mobile must work. Swipe gestures on the carousel area should advance slides; swipes outside should scroll the page (or navigate scenes, depending on `InputController` config).

**Files:** `input/ActionInputController.ts`, potentially `input/types.ts` (for region bounds on `InputActionSpec`)
**Tests:** Test that carousel actions only fire when pointer is within layout bounds. Test touch events.

---

### ENH-1: Linear carousel tray should be a closed shape

**Symptom:** Linear carousels with `zStep > 0` render a parabolic "horseshoe" shape — an open arc where the front and back edges diverge at the sides. It looks like a banana or a horseshoe when viewed from above.

**Root cause:** `generateParabolicPoints()` in `geometry.ts:168-204` produces two parallel parabolic arcs (front and back edges) that are NOT connected at the endpoints. `render.ts:254` calls `shape.closePath()` which draws a straight line from the last back-edge point to the first front-edge point — creating a visible straight-line seam on the left side and an unclosed gap on the right (or vice versa). The shape is topologically closed but visually open.

**Fix:** Replace the parabolic open arc with a closed stadium/rounded-rect that follows the parabolic curve. Specifically:
- Compute the parabolic depth curve as today for the center-line
- Add rounded end-caps (semicircles or quadratic curves) connecting the front and back edges at x = ±halfWidth
- The result is a smooth closed outline that looks like a rounded rectangle bent along a parabola — not a horseshoe

Alternative simpler fix: use a rounded-rect shape with enough Z depth to cover the parabolic range, and skip the per-vertex parabolic curvature. The parabolic shape was designed to hug the item positions, but a generous rounded rect may look better.

**Files:** `geometry.ts` (shape generation), `render.ts` (tray creation uses the shape)
**Tests:** Update `geometry.test.ts` — verify the new shape is topologically closed (first point ≈ last point or explicit closePath).

---

### ENH-2: Highlight beam ellipsis — make Z axis 30% thinner

**Symptom:** The holographic beam and backdrop cylinders are too fat in the Z axis (depth direction). They should be elliptical, not circular, with Z squeezed by 30%.

**Current code:** In `render.ts:1132-1133`:
```typescript
const scaleX = worldW * HL_BEAM_SCALE;  // HL_BEAM_SCALE = 0.7
const scaleZ = worldH * HL_BEAM_SCALE;  // same scale for both axes
```

Both beam, backdrop, dust, and smoke meshes use the same `scaleZ` value. Making Z 30% thinner means multiplying `scaleZ` by `0.7`.

**Fix:** Add a `HL_BEAM_Z_SQUEEZE` constant in `highlightConstants.ts`:

```typescript
/** Z-axis squeeze factor for beam/backdrop ellipsis. 0.7 = 30% thinner in depth. */
export const HL_BEAM_Z_SQUEEZE = 0.7;
```

Apply in render.ts:
```typescript
const scaleX = worldW * HL_BEAM_SCALE;
const scaleZ = worldH * HL_BEAM_SCALE * HL_BEAM_Z_SQUEEZE;
```

This affects: beam cylinder, backdrop cylinder, dust particle bounds, smoke ring radius, and surface glow plane. All should use the squeezed Z so they visually align.

**Files:** `highlightConstants.ts` (new constant), `render.ts` (apply squeeze to scaleZ in highlight mesh creation and update paths)
**Tests:** No compile-layer change. Visual verification only (render.ts is excluded from coverage).

---

## Known technical debt (address during or after implementation)

1. **`highlightShader.ts` is dead code.** No imports reference it anywhere in the codebase. The beam was rewritten to use `MeshBasicMaterial` + `createBeamGradientTexture()`. Deleted in Phase 1 step 13.

2. **`render.ts` imports cleaned but still 1474 lines.** The `updatePresetTextures` import, `generateRoundedRectPoints` import, and `computeTrayBorderPadding` import were removed in the latest commit. The highlight beam/backdrop/glow/dust/smoke mesh creation functions (~400 lines) are candidates for future extraction into `highlightMeshes.ts`, but this is not blocking the DSL refactor.

Note: The `resolveRuntimeHighlight()` variant resolution gap was promoted from tech debt to an explicit Phase 1 step (step 8). It is required for the programmatic monitoring use case and must not ship as debt.

## Current codebase state (as of 2026-03-18)

### Module structure

```
carousel-scrubber/
  types.ts              (176 lines) — pure type contracts, zero runtime values
  dsl.tsx               (135 lines) — CarouselTray + CarouselScrubberProps
  compile.ts            (162 lines) — state resolution + transition spec
  compileTray.ts        (376 lines) — theme merge, view extent, highlight compilation, resolveRuntimeHighlight
  render.ts             (1474 lines) — Three.js rendering (tray geometry, material, highlights)
  CarouselScrubberWidget.ts (231 lines) — widget class + programmatic highlight API
  highlightConstants.ts (51 lines) — all HL_* constants (extracted from types.ts)
  highlightParticles.ts (116 lines) — smoke/dust particle math
  highlightShader.ts    (37 lines) — DEAD CODE: unused GLSL shader
  geometry.ts           (255 lines) — pure shape math
  surfaceTexture.ts     (324 lines) — procedural normal map generation
  trayPosition.ts       (107 lines) — pure position math
  useCarouselHighlight.ts (90 lines) — React hook + imperative controller
  index.ts              (13 lines) — public exports (cleaned: no internal types leaked)
```

### Test coverage

```
__tests__/compile.test.ts          (403 lines) — core compilation
__tests__/compileTray.test.ts      (881 lines) — theme merge, highlights, backdropColor, resolveRuntimeHighlight
__tests__/geometry.test.ts         (321 lines) — shape generation
__tests__/highlightParticles.test.ts (184 lines) — particle lifecycle
__tests__/surfaceTexture.test.ts   (121 lines) — normal map generation
__tests__/trayPosition.test.ts     (115 lines) — position math
Total: 2025 lines, 1661 passing tests
```

### Public exports (from `index.ts`)

```typescript
// Types
CarouselScrubberState, CarouselScrubberStyle, CarouselTrayEdgeStyle,
CarouselTraySurfacePattern, ViewHighlightMode, ViewHighlightConfig, ViewHighlight

// Widget + handler
CarouselScrubberWidget, CarouselScrubber, carouselScrubberNodeHandler,
isCarouselScrubberStateLike

// Compile defaults
DEFAULT_CAROUSEL_SCRUBBER_STATE, DEFAULT_CAROUSEL_SCRUBBER_STYLE

// DSL
CarouselScrubberProps (type)

// Programmatic API
useCarouselHighlight, createCarouselHighlightController
```

### DSL surface (from `compiler/index.ts`)

```typescript
CarouselTray, CarouselTrayProps  // → will add: Highlight, HighlightProps
```
