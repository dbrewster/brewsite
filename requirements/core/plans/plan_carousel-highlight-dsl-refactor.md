---
title: "Refactor: Separate Highlight DSL from CarouselTray"
doc_type: plan
owner: architect
status: draft
updated: 2026-03-17
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
5. **Backward compatible.** The existing `highlightActive`, `highlightColor`, etc. props on `<CarouselTray>` continue to work during a deprecation period.

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

These were always awkward — they're highlight configuration masquerading as tray configuration.

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

**Option A (recommended):** Require `<CarouselTray>` for highlights to render. The tray widget owns the Three.js highlight meshes. A `<Highlight>` without a tray silently does nothing (or warns). This is the current architecture and requires zero render changes.

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
| `compiler/viewHandlers.ts` | Detect `<Highlight>` children alongside `<CarouselTray>` children. Collect highlight configs and pass to `compileTrayFromViewLayout()` |
| `elements/carousel-scrubber/dsl.tsx` | Mark `highlightActive`, `highlightColor`, `highlightIntensity`, `highlightBeamHeight`, `highlightSmoke`, `highlightZOffset`, `highlightViewId`, `highlights` as `@deprecated` |
| `elements/carousel-scrubber/compileTray.ts` | Accept parsed `<Highlight>` configs alongside legacy tray props. Merge both into the same `viewHighlights` array |
| `elements/carousel-scrubber/CarouselScrubberWidget.ts` | Register `<Highlight>` in `childDslComponents` via `IDslComposite` |
| `theme/types.ts` | Add `SceneThemeHighlightDefaults` to `SceneTheme`. Deprecate highlight fields on `SceneThemeCarouselTray` |
| `elements/carousel-scrubber/index.ts` | Export `Highlight` component and `HighlightProps` type |
| `compiler/index.ts` | Export `Highlight` from the DSL authoring surface |

### Unchanged files

| File | Reason |
|------|--------|
| `elements/carousel-scrubber/render.ts` | Consumes `viewHighlights` — no structural change |
| `elements/carousel-scrubber/types.ts` | `ViewHighlight` and `ViewHighlightConfig` stay as-is |
| `elements/carousel-scrubber/compile.ts` | Default state and transition spec unchanged |
| `elements/carousel-scrubber/highlightConstants.ts` | Constants unchanged |
| `elements/carousel-scrubber/highlightParticles.ts` | Particle math unchanged |
| `elements/carousel-scrubber/highlightShader.ts` | Shader unchanged |
| All theme preset files | `highlightPalette` already lives at the right level |

### Scene file updates

| File | Change |
|------|--------|
| `apps/examples/src/views/scenes/scene3-carousel.tsx` | Move `highlightActive`, `highlightColor`, `highlightSmoke` from `<CarouselTray>` to `<Highlight active>` sibling |
| `apps/examples/src/input-showcase/scenes/scene4-ring-carousel.tsx` | Replace `highlights={[...]}` array with three `<Highlight>` siblings |
| `apps/examples/src/input-showcase/scenes/scene5-linear-carousel.tsx` | No change (no highlights) |

---

## Test Strategy

| Module | Tests |
|--------|-------|
| `highlightDsl.tsx` | No runtime tests needed — null-returning stub, type-only |
| `compileTray.ts` | **New tests**: Verify `<Highlight>` parsed configs produce identical `viewHighlights` to the legacy props path. Test: active targeting, viewId targeting, variant resolution, explicit overrides, mixed `<Highlight>` + legacy props (legacy gets deprecation path), no-target warning |
| `viewHandlers.ts` | **Modify existing tests**: Verify `<Highlight>` children are detected and passed through to `compileTrayFromViewLayout()` |
| Existing `compileTray.test.ts` | Keep all existing tests (they exercise the legacy path which remains supported). Add parallel tests for the new `<Highlight>` input path |

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

1. **`highlightDsl.tsx`** — Create `<Highlight>` component and `HighlightProps` type
2. **`compiler/viewHandlers.ts`** — Detect and collect `<Highlight>` children
3. **`compileTray.ts`** — Accept new highlight configs, merge with legacy
4. **`theme/types.ts`** — Add `SceneThemeHighlightDefaults`
5. **`CarouselScrubberWidget.ts`** — Register `<Highlight>` in `childDslComponents`
6. **`compiler/index.ts`** + `index.ts` — Export new component
7. **Scene files** — Migrate examples
8. **`dsl.tsx`** + `theme/types.ts` — Add `@deprecated` JSDoc to old fields
9. **Tests** — Parallel test coverage for new path

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

5. **Variant resolution works at runtime.** `setHighlight({ viewId: 'chart-3', variant: 'error' })` resolves the `error` variant from the theme's `highlightPalette` at render time — the caller doesn't need to specify color, intensity, or backdrop settings.

6. **Access pattern.** The `WidgetRegistry` is available via:
   - `useSceneEngineContext().widgetRegistry` — inside `<EngineProvider>` React tree
   - The `widgetRegistry` option passed to `useSceneEngine()` — for app-level code
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

- **Does not change the render layer.** Highlights still render via `CarouselScrubberWidget`. This is a DSL-only refactor.
- **Does not remove `ViewHighlightConfig`.** The programmatic API (`useCarouselHighlight`, `createCarouselHighlightController`) still accepts `ViewHighlightConfig` objects. That's the right shape for imperative code — the DSL refactor is about declarative scene authoring only.
- **Does not break existing scenes.** Legacy props continue to work with a deprecation warning.
- **Does not move highlights to `<View>`.** Highlights are an effect rendered by the tray in 3D space above the carousel — they're not a view-level concept. A view doesn't know or care whether it's highlighted. The highlight is an external annotation, like a spotlight on a stage — it belongs to the stage director (the layout), not the actor (the view).
