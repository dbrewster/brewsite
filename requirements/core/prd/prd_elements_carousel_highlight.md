---
title: "BrewSite Core — Carousel Highlight System"
doc_type: prd
status: active
owner: Toolkit Product
last_updated: 2026-03-18
change_history:
  - date: 2026-03-18
    author: "Toolkit Product"
    summary: "Carousel selection region: updated `active` targeting description to reference `focusedIndex` instead of deprecated `activeIndex`. Updated migration examples to use `focusedIndex`."
  - date: 2026-03-18
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the <Highlight> DSL component, HighlightProps type, theme integration (SceneThemeHighlightDefaults, SceneThemeHighlightPalette), programmatic API (useCarouselHighlight, createCarouselHighlightController), runtime highlight override behavior, deprecation of highlight* props on <CarouselTray>, and migration guide."
---

# BrewSite Core — Carousel Highlight System

## 1. Overview

The Carousel Highlight system provides per-view volumetric highlight effects for `<ViewLayout kind="carousel">` carousels. Highlights are visual annotations — beams, glows, backdrop dims, smoke, and dust — rendered by the `CarouselScrubberWidget` in Three.js space above the carousel tray.

The system has two authoring surfaces:
1. **Declarative DSL** — The `<Highlight>` component, authored as a child of `<ViewLayout>`, configures static per-scene highlight effects at compile time.
2. **Programmatic API** — `useCarouselHighlight()` (React hook) and `createCarouselHighlightController()` (imperative) set highlights at runtime from application code — the primary use case for monitoring dashboards and anomaly detection.

Runtime highlights override compiled highlights for the same `viewId`. When a runtime highlight is cleared, the compiled highlight resumes.

Affects: `@brewsite/core`.

---

## 2. Problem Statement

Prior to the `<Highlight>` component, highlight configuration was embedded in `<CarouselTray>` props — 11 `highlight*` props on the flat prop surface plus a `highlights` array of `ViewHighlightConfig` objects. This conflated two unrelated concepts (physical tray configuration and per-view visual effects) into a single component. The `highlights` array was particularly awkward — deeply nested object literals with no JSDoc assistance.

The highlight is a ViewLayout concern, not a CarouselTray concern. A highlight annotates a view within a layout, regardless of tray presence. Separating the DSL surface clarifies authoring intent and follows the established child-composition pattern used by other elements (`Lighting` → `Ambient`/`Directional`/`Spot`; `Chart` → `ChartAxis`/`ChartSeries`).

---

## 3. Goals & Success Metrics

**Primary goals:**
- Scene authors configure highlights through a dedicated `<Highlight>` component with clear, self-documenting props.
- Theme-resolved highlights work with a single `<Highlight active />` — zero explicit visual props needed.
- Per-view highlights are individual `<Highlight viewId="...">` elements — no array syntax.
- The programmatic API (`useCarouselHighlight`, `createCarouselHighlightController`) is explicitly documented and accessible.
- Variant resolution works in both the compiled (DSL) and runtime (programmatic) paths.

**Success metrics:**
- All `apps/examples/` carousel scenes use `<Highlight>` instead of tray highlight props.
- TypeScript autocomplete shows `<Highlight>` props with full JSDoc documentation.
- `pnpm typecheck` and `pnpm test` pass for `@brewsite/core`.

**Guardrail metrics:**
- Legacy `highlight*` props on `<CarouselTray>` continue to compile and render correctly with a deprecation warning.
- No bundle size regression beyond the new `highlightDsl.tsx` file (~1 KB).

---

## 4. Non-Goals

- **Standalone highlight rendering without `<CarouselTray>`.** Highlights require a `<CarouselTray>` sibling because the tray widget owns the Three.js highlight meshes. A future `HighlightWidget` could render highlights independently, but that is out of scope for this release.
- **Highlight transitions between scenes.** Highlights are applied per-tick from compiled state. Cross-scene transition animation for highlights is not supported.
- **Render layer changes.** This is a DSL-only refactor. The Three.js rendering of highlights (beam, backdrop, glow, dust, smoke) is unchanged.

---

## 5. Consumer Stories

- As a scene author, I want to highlight the active carousel item with a single `<Highlight active />` element that resolves all visual properties from my theme.
- As a scene author, I want to highlight a specific chart in my carousel with `<Highlight viewId="cpu" variant="error" />` when I know at authoring time which view needs attention.
- As a scene author, I want per-view highlights to be individual JSX elements so I can read, reorder, and comment them independently — not entries in an array.
- As an application developer, I want to call `setHighlight({ viewId: 'cpu', variant: 'error', smoke: true })` at runtime when my monitoring system detects an anomaly.
- As an application developer, I want runtime highlights to automatically override compiled highlights for the same view, and restore the compiled state when I call `clearHighlight()`.
- As a theme author, I want to define a `highlightPalette` with semantic variants (primary, error, warning, success) so scene authors reference variants by name rather than specifying colors and modes directly.

---

## 6. Functional Requirements

1. The `<Highlight>` component shall be a null-returning React function exported from `@brewsite/core`. It is consumed by the `viewLayoutHandler` compiler, not rendered directly.
2. `<Highlight>` shall be authored as a child of `<ViewLayout kind="carousel">`, alongside `<View>` and `<CarouselTray>` elements.
3. If `<Highlight>` children exist but no `<CarouselTray>` sibling is present, the compiler shall emit `console.warn('[ViewLayout] <Highlight> requires a <CarouselTray> sibling to render. Highlights will be ignored.')` and produce no highlight state.
4. Each `<Highlight>` shall target either the active carousel item (`active={true}`) or a specific view by ID (`viewId="..."`) . These are mutually exclusive. A `<Highlight>` with neither `active` nor `viewId` shall emit a compile warning.
5. The `variant` prop shall resolve visual properties from `SceneTheme.highlightPalette[variant]`. Explicit props override variant values.
6. The resolution chain for each visual field shall be: explicit prop → variant palette value → `SceneTheme.highlightDefaults` value → constant default.
7. Multiple `<Highlight>` children shall be supported within a single `<ViewLayout>`. Each produces a separate entry in the compiled `viewHighlights` array.
8. Legacy `highlight*` props on `<CarouselTray>` shall continue to function with a `console.warn` deprecation message in dev mode. Legacy props are converted to equivalent highlight config internally and merged with `<Highlight>` children.
9. When both `<Highlight>` children and legacy tray highlight props are present, both merge into the same `viewHighlights` array.
10. `useCarouselHighlight(registry, layoutId)` shall return `{ setHighlight, clearHighlight, clearAll }` for React-based runtime highlight control.
11. `createCarouselHighlightController(registry, layoutId)` shall return the same shape for non-React imperative highlight control.
12. Runtime highlights (set via `setHighlight()`) shall override compiled highlights for the same `viewId`. When `clearHighlight(viewId)` is called, the compiled highlight for that view resumes.
13. `resolveRuntimeHighlight()` shall accept a `palette` parameter and resolve `cfg.variant` against the theme palette, enabling `setHighlight({ viewId: 'cpu', variant: 'error' })` to correctly resolve to the theme's error palette.
14. Multiple simultaneous runtime highlights shall be supported. Each `setHighlight()` call is additive — calling it for two different `viewId`s highlights both. Only `clearHighlight(viewId)` or `clearAll()` removes them.

---

## 7. API Design

### 7.1 `<Highlight>` DSL Component (`elements/carousel-scrubber/highlightDsl.tsx`)

```typescript
export type HighlightProps = {
  /** When true, tracks the active carousel item. Mutually exclusive with viewId. */
  active?: boolean;
  /** Target a specific view by ID. Mutually exclusive with active. */
  viewId?: string;
  /** Semantic variant name — resolves from SceneTheme.highlightPalette. */
  variant?: HighlightVariantName;
  /** Highlight mode. Default: resolved from variant, or 'glow'. */
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
  /** Blending mode. Auto-resolved from scene colorMode when not set. */
  blendMode?: 'additive' | 'normal';
};

/** Null-returning DSL stub. Consumed by viewLayoutHandler. */
export const Highlight: (props: HighlightProps) => null;
```

### 7.2 Theme Types (`theme/types.ts`)

```typescript
/** Default highlight configuration when no variant is specified. */
export type SceneThemeHighlightDefaults = {
  readonly mode?: ViewHighlightMode;
  readonly backdropOpacity?: number;
  readonly backdropColor?: string;
  readonly beamHeight?: number;
};

// On SceneTheme:
export type SceneTheme = {
  // ... existing fields ...
  readonly highlightPalette?: SceneThemeHighlightPalette;
  readonly highlightDefaults?: SceneThemeHighlightDefaults;
};
```

`SceneThemeHighlightPalette` and `SceneThemeHighlightVariant` are unchanged — they were already well-designed at the `SceneTheme` level.

### 7.3 Programmatic API (`elements/carousel-scrubber/useCarouselHighlight.ts`)

#### React Hook

```typescript
import { useCarouselHighlight } from '@brewsite/core';

function MonitoringOverlay() {
  const { widgetRegistry } = useSceneEngineContext();
  const highlights = useCarouselHighlight(widgetRegistry, 'metrics-layout');

  useEffect(() => {
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

  const onDismiss = (chartId: string) => highlights.clearHighlight(chartId);
  return <DismissButton onClick={() => onDismiss('chart-3')} />;
}
```

#### Non-React Imperative API

```typescript
import { createCarouselHighlightController } from '@brewsite/core';

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

#### API Shape

Both `useCarouselHighlight` and `createCarouselHighlightController` return:

```typescript
{
  setHighlight(config: ViewHighlightConfig): void;
  clearHighlight(viewId: string): void;
  clearAll(): void;
}
```

`setHighlight` accepts a `ViewHighlightConfig` object — the same shape used internally by the compile layer. Runtime highlights are stored on the tray widget's `runtimeHighlights` map and merged with compiled highlights every frame in the render loop.

#### Access Patterns

The `WidgetRegistry` is available via:
- `useSceneEngineContext().widgetRegistry` — inside the `<SceneEngine>` React tree (overlay content, HUD components)
- The `widgetRegistry` option from `useSceneEngine()` — for app-level code that owns the engine
- Direct widget reference: `registry.get('layoutId__tray') as CarouselScrubberWidget` — for advanced use

---

## 8. Technical Considerations

### Compilation

`<Highlight>` children are detected by the `viewLayoutHandler` in `compiler/blocks/viewHandlers.ts` using React element type matching (the same pattern used for `<CarouselTray>` detection). Highlight props are collected and passed to `compileTrayFromViewLayout()` in `elements/carousel-scrubber/compileTray.ts`, which merges them with any legacy tray highlight props into the `viewHighlights` array on `CarouselScrubberState`.

### Variant Resolution

The resolution chain is:

1. `props.variant` → look up `SceneTheme.highlightPalette[variant]`
2. For each field: `props.{field} ?? variant.{field} ?? SceneTheme.highlightDefaults.{field} ?? constant default`
3. `active` targets the view at `carousel.focusedIndex`; `viewId` targets the named view

This resolution runs in both the compiled path (`buildViewHighlights` in `compileTray.ts`) and the runtime path (`resolveRuntimeHighlight` in `compileTray.ts`).

### Runtime Highlight Merge

Every render frame, the tray's render function merges compiled and runtime highlights:
1. Start with compiled `viewHighlights` from the baked `SceneTrack`
2. For each runtime highlight (from `runtimeHighlights` map), resolve via `resolveRuntimeHighlight()` and override the compiled entry for the same `viewId`
3. Apply the merged list to Three.js meshes with fade transitions

### Module Structure

```
elements/carousel-scrubber/
  highlightDsl.tsx          — <Highlight> component + HighlightProps type (NEW)
  types.ts                  — ViewHighlightMode, ViewHighlightConfig, ViewHighlight
  compileTray.ts            — buildViewHighlights, resolveRuntimeHighlight
  render.ts                 — Three.js highlight mesh rendering
  useCarouselHighlight.ts   — React hook + imperative controller
  CarouselScrubberWidget.ts — widget class + runtimeHighlights storage
```

### Exports

From `compiler/index.ts` (DSL authoring surface):
```typescript
export { Highlight } from '../elements/carousel-scrubber/highlightDsl';
export type { HighlightProps } from '../elements/carousel-scrubber/highlightDsl';
```

From `elements/index.ts` (public API):
```typescript
export { Highlight, HighlightProps } from './carousel-scrubber';
export { useCarouselHighlight, createCarouselHighlightController } from './carousel-scrubber';
export type { ViewHighlightMode, ViewHighlightConfig, ViewHighlight } from './carousel-scrubber';
```

---

## 9. Breaking Change Assessment

**Semver impact: minor.** The `<Highlight>` component and `SceneThemeHighlightDefaults` type are additive. Legacy `highlight*` props on `<CarouselTray>` and `SceneThemeCarouselTray` are deprecated but continue to function.

**Deprecation timeline:**
- **Current release (minor):** `highlight*` props on `<CarouselTray>` and `SceneThemeCarouselTray` are marked `@deprecated` with JSDoc. A `console.warn` is emitted in dev mode when legacy props are used.
- **Next major version:** Deprecated props are removed. Consumers must migrate to `<Highlight>`.

**No existing consumer code breaks.** Scenes using `highlight*` props on `<CarouselTray>` continue to compile and render identically. The deprecation is informational only until the major version bump.

---

## 10. Dependencies

- `packages/core/src/elements/carousel-scrubber/highlightDsl.tsx` — new file
- `packages/core/src/elements/carousel-scrubber/compileTray.ts` — modified (accepts Highlight configs)
- `packages/core/src/compiler/blocks/viewHandlers.ts` — modified (detects Highlight children)
- `packages/core/src/theme/types.ts` — modified (SceneThemeHighlightDefaults added)
- No new external dependencies.

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API regret on `<Highlight>` prop names | Hard to rename without major bump | Props mirror existing `ViewHighlightConfig` field names; naming is stable |
| Orphaned `<Highlight>` without `<CarouselTray>` | Silent no-op confuses authors | Console.warn emitted; documented clearly in JSDoc |
| Legacy + new highlight merge conflicts | Unexpected double-highlights | Merge logic is well-defined: both sources produce `ViewHighlight` entries in the same array |
| Runtime variant resolution depends on palette availability | `setHighlight({ variant: 'error' })` falls back to glow if no palette | Fixed: `resolveRuntimeHighlight` accepts palette parameter and resolves variants correctly |

---

## 12. Migration Guide

### From `highlight*` props on `<CarouselTray>`

**Before:**
```tsx
<ViewLayout kind="carousel" id="metrics" loop focusedIndex={0} zStep={15}>
  <View id="chart-1"><RevenueChart /></View>
  <View id="chart-2"><CostChart /></View>
  <CarouselTray
    metalness={0.1}
    highlightActive="holographic"
    highlightColor="#E36A2E"
    highlightSmoke
  />
</ViewLayout>
```

**After:**
```tsx
<ViewLayout kind="carousel" id="metrics" loop focusedIndex={0} zStep={15}>
  <View id="chart-1"><RevenueChart /></View>
  <View id="chart-2"><CostChart /></View>
  <CarouselTray metalness={0.1} />
  <Highlight active mode="holographic" color="#E36A2E" smoke />
</ViewLayout>
```

### From `highlights` array on `<CarouselTray>`

**Before:**
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

**After:**
```tsx
<CarouselTray metalness={0.1} />
<Highlight viewId="rc1" variant="primary" mode="holographic" smoke beamHeight={4} />
<Highlight viewId="rc3" variant="success" mode="glow" intensity={0.5} />
<Highlight viewId="rc5" variant="error" mode="holographic" smoke beamHeight={4} />
```

### Theme-only usage

```tsx
<ViewLayout kind="carousel" id="metrics" loop focusedIndex={0} zStep={15}>
  <View id="chart-1"><RevenueChart /></View>
  <View id="chart-2"><CostChart /></View>
  <CarouselTray />
  <Highlight active />
</ViewLayout>
```

`<Highlight active />` resolves everything from the theme: variant defaults to `'primary'`, which pulls mode, color, intensity, and backdrop from `SceneTheme.highlightPalette.primary`. One element, one intent.

### For theme authors

No changes required. `highlightPalette` already lives at the `SceneTheme` level. The deprecated `carouselTray.highlightActive` etc. fields continue to work.

Optionally adopt `SceneTheme.highlightDefaults` for global non-variant defaults:

```typescript
const theme: SceneTheme = {
  // ... existing fields ...
  highlightDefaults: {
    mode: 'holographic',
    backdropOpacity: 0.4,
    beamHeight: 6,
  },
};
```

---

## 13. Typical Integration: Monitoring Dashboard

```tsx
// Scene: declarative layout with default highlight
const MonitoringScene = () => (
  <Scene>
    <ViewLayout kind="carousel" id="metrics" loop focusedIndex={0} zStep={15}>
      <View id="cpu"><CpuChart /></View>
      <View id="memory"><MemoryChart /></View>
      <View id="network"><NetworkChart /></View>
      <View id="disk"><DiskChart /></View>
      <CarouselTray surface="steel" />
      <Highlight active variant="primary" />
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
          viewId: alert.metricId,
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

  return null;
};
```

The declarative `<Highlight active variant="primary" />` provides baseline visual context. The imperative `hl.setHighlight(...)` overrides specific views when anomalies occur. When the anomaly resolves, `clearHighlight()` restores the compiled baseline.

---

## 14. Launch Criteria

- [x] `<Highlight>` component exported from `@brewsite/core` with full TypeScript types.
- [x] `HighlightProps` type exported with JSDoc on every field.
- [x] `SceneThemeHighlightDefaults` type exported from `@brewsite/core`.
- [x] `SceneTheme.highlightDefaults` field available.
- [x] Legacy `highlight*` props on `<CarouselTray>` marked `@deprecated` with console.warn in dev mode.
- [x] `resolveRuntimeHighlight()` resolves `variant` against palette parameter.
- [x] Compiler integration tests: `<Highlight active>`, `<Highlight viewId>`, no-tray warning, legacy+new merge.
- [x] All `apps/examples/` carousel scenes migrated to `<Highlight>`.
- [x] `pnpm typecheck` and `pnpm test` pass for `@brewsite/core`.
- [x] `useCarouselHighlight` and `createCarouselHighlightController` exported from `@brewsite/core`.

**Follow-on (not yet shipped):**
- [ ] Standalone `HighlightWidget` that renders highlights without a `<CarouselTray>` (future release).
- [ ] Removal of deprecated `highlight*` props from `<CarouselTray>` and `SceneThemeCarouselTray` (next major version).
