---
title: "Feature Note: Chart Value Tooltip + Y-Axis Projection"
doc_type: note
owner: product
status: complete
updated: 2026-03-11
---

# Feature Note: Chart Value Tooltip + Y-Axis Projection

## Problem Statement

The `@brewsite/charts` package ships `ChartTooltipOverlay` — a React component that renders a floating tooltip when a chart element is hovered. It has three compounding problems that make it a poor DX and a barrier to adoption:

**1. Wrong authoring location.** The tooltip is configured *outside* the chart DSL, as a sibling component in the React overlay tree. Every other chart concern — axes, series, legends, data labels, reference lines — lives *inside* the chart DSL as a child component. `ChartTooltipOverlay` breaks this convention for no good reason.

**2. Widget reference leakage.** To use `ChartTooltipOverlay`, the consumer must obtain a `ChartWidget` instance reference — an internal runtime object with no clean public API for acquisition. The mechanism for obtaining it is undocumented and fragile.

**3. Duplicated `nvsBounds`.** The overlay requires `nvsBounds` as a prop — the same value already declared in the chart DSL's `x/y/w/h` props. This is a DRY violation and a consistency hazard.

Beyond the authoring DX problem, the feature itself is anemic:
- `defaultRenderContent` renders raw `Object.entries(row).slice(0, 4)` — no awareness of chart type, axis semantics, or series names.
- Zero theme integration — hard-coded dark navy colors regardless of the active `ChartTheme`.
- No Y-axis projection: no 3D visual effect connecting the hover point to the Y-axis — a key opportunity for a signature visual moment.

---

## Proposed Solution

### Core API Principle: Tooltip Lives With the Chart

Tooltip configuration belongs inside the chart DSL as a child component — exactly like `<ChartDataLabels>`, `<ChartLegend>`, and `<ReferenceLine>`.

```tsx
// Minimum viable — zero config:
<BarChart id="revenue" interactive>
  <ChartData source="revenueData" />
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
  <ChartTooltip />
</BarChart>
```

```tsx
// With projection and custom format:
<BarChart id="revenue" interactive>
  <ChartData source="revenueData" />
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
  <ChartTooltip projection format=".2s" />
</BarChart>
```

No external component per chart. No widget reference. No duplicated `nvsBounds`.

### Global Overlay Host

A single `<ChartTooltipHost />` component (no props) placed once inside `EngineOverlayHost` renders tooltips for all charts in the engine. It reads from a shared `ChartTooltipStore` that `ChartWidget` writes to on hover:

```tsx
// In the page layout — once, for all charts:
<EngineOverlayHost>
  <ChartTooltipHost />
  {/* other overlay content */}
</EngineOverlayHost>
```

`ChartTooltipHost` subscribes to `ChartTooltipStore` and renders the active tooltip. No per-chart ID needed. When no chart is hovered, it renders nothing. This is the entire consumer-side change for standard tooltip usage.

For custom `renderContent`, a companion hook registers the function outside the SceneTrack:

```tsx
useChartTooltipConfig('revenue', {
  renderContent: (info) => <MyCustomTooltip info={info} />,
});
```

The widget reads this registration in `apply()` and uses it when rendering tooltip content. If no `renderContent` is registered, the built-in type-aware layout is used.

The existing `ChartTooltipOverlay` component is **deprecated** in this release and removed in the next minor version. See migration guide at end of this document.

---

## Visual Vision: "A Banger"

This is a flagship interaction moment. When a user hovers a data point, two things happen simultaneously:

**The tooltip** — a rich, theme-native floating card that appears anchored to the projected 3D hit point (not the mouse cursor). Contents:
- The X category or value (axis label + formatted value)
- The Y value (axis label + formatted value, styled prominently as the hero value)
- The series name with a matching color swatch
- Chart-type-specific extras: percentage for pie, bubble size for scatter, stack total for stacked bar, intensity for heatmap
- Smooth CSS fade-in on appear, fade-out on dismiss
- Theme-derived background, border, blur, color, and typography — indistinguishable from a first-party design system component
- Flips to stay within canvas bounds when within 16px of any canvas edge

**The Y-axis projection** — a glowing beam that appears in the 3D scene, animating outward from the data point to the Y-axis face. On entry: an ease-out-expo "draw" where the beam extends from the data point to the axis over ~220ms. While held: a glowing landing dot at the axis face pulses gently. On exit: fade out over ~160ms.

The beam is not a thin gray line. It is:
- A volumetric flat `BoxGeometry` beam with an additive emissive material — tunable width, color, and glow intensity per theme
- A landing dot (small `SpriteGeometry` or additive `PlaneGeometry`) at the Y-axis endpoint
- Per-theme styles that feel native: neonCyber gets electric cyan; darkGlass gets warm ember; enterprise gets restrained slate; midnight gets luminescent blue-white

Together, tooltip + projection make data exploration feel like a high-end interactive dashboard embedded in a 3D scene.

---

## Design Decisions

### 1. `<ChartTooltip>` as DSL Child Component

`ChartTooltip` compiles to a `ChartTooltipState` embedded in `ChartState`. The state is fully serializable — no functions.

```typescript
/** Compiled tooltip state. SceneTrack-safe — no functions. */
export type ChartTooltipState = {
  /** Whether Y-axis projection beam is enabled. Default: false. */
  readonly projection: boolean;
  /** d3-format string for numeric Y values. Default: '.3~s'. */
  readonly format?: string;
};
```

Custom `renderContent` is registered separately and is NOT part of `ChartState`:

```typescript
/**
 * Runtime-only tooltip configuration. NOT compiled into SceneTrack.
 * Registered via useChartTooltipConfig(). Read by ChartWidget in apply().
 */
export type ChartTooltipRuntimeConfig = {
  readonly renderContent?: (info: ChartHitInfo) => React.ReactNode;
};
```

### 2. Enrich `ChartHitInfo` With Typed Per-Kind Metadata

The current `ChartHitInfo` is type-blind — it returns raw row data with no knowledge of chart semantics. Each renderer knows things at hit-resolution time (stack totals, percentages, size values) that are essential for a meaningful tooltip. This is surfaced as a typed discriminated union on the same `ChartHitInfo` struct:

```typescript
export type ChartHitMeta =
  | { readonly kind: 'bar';
      readonly seriesLabel: string;
      readonly stackGroup?: string;
      /** Top of the hovered segment's value (not full stack total). */
      readonly segmentValue: number;
      readonly stackTotal?: number }
  | { readonly kind: 'line';
      readonly seriesLabel: string }
  | { readonly kind: 'area';
      readonly seriesLabel: string;
      readonly stackValue?: number }
  | { readonly kind: 'scatter';
      /** X axis value at the hit point. */
      readonly xValue: number;
      readonly sizeValue?: number;
      readonly colorValue?: number | string }
  | { readonly kind: 'pie';
      readonly sliceName: string;
      readonly percentage: number;
      readonly total: number }
  | { readonly kind: 'heatmap';
      readonly intensity: number;
      readonly rowLabel: string;
      readonly columnLabel: string };

export type ChartHitInfo = {
  readonly seriesIndex: number;
  readonly datumIndex: number;
  readonly row: Record<string, unknown>;
  readonly point: readonly [number, number, number];
  /**
   * Typed per-chart-kind metadata for tooltip rendering.
   * Populated by each renderer's resolveHoverInfo().
   */
  readonly meta?: ChartHitMeta;
  /**
   * World-space terminus for the Y-axis projection beam —
   * the point on the Y-axis face at the same Y and Z height as the hit point.
   * Absent for chart types where Y-axis projection is not applicable (pie, heatmap).
   * Beam is drawn IFF this field is non-null. Theme projection tokens control style.
   */
  readonly projectionTarget?: readonly [number, number, number];
};
```

**Beam rendering rule:** The projection beam is drawn if and only if `info.projectionTarget` is non-null. `theme.projection` tokens control how the beam looks, not whether it draws. These are independent concerns. Pie and heatmap renderers simply do not populate `projectionTarget` — no theme-level opt-out is needed or correct.

Each renderer's `resolveHoverInfo()` must be updated to populate `meta` and (where applicable) `projectionTarget`. `projectionTarget` is computed as: `[chartGroup.worldPosition.x + plotFrame.x, point[1], point[2]]` — same Y and Z as the hit, snapped to the Y-axis face. The renderer must cache `plotFrame` and `chartGroup.worldPosition` from the last `update()` call so they are accessible at hit-resolution time without recomputing layout.

**Stacked bar hit origin:** The beam originates from the top of the *hovered segment*, not the top of the full stack. The beam represents the value of the specific series the user is pointing at. The full stack total is surfaced in `stackTotal` on the tooltip meta for context.

**Scatter projection:** Y-axis projection only (not X-axis). The X value is captured in `scatter.meta.xValue` for tooltip display. Scatter charts are often multi-dimensional; a Y-only beam is the standard convention and keeps the 3D scene uncluttered.

**Z-depth of beam:** The beam uses `info.point[2]` as its Z position — same depth as the hovered geometry. No special-casing needed.

### 3. Y-Axis Projection: `ChartProjectionRenderer`

The projection beam is managed by a new `ChartProjectionRenderer` class that lives inside `ChartRenderer`'s scene subtree as a `projectionGroup`, parallel to `seriesGroup` and `axesGroup`.

`ChartRenderer` gains a new method:
```typescript
updateProjection(info: ChartHitInfo | null, theme: ChartTheme): void
```

`ChartWidget`'s internal hover handler calls `this.chartRenderer.updateProjection(info, effectiveTheme)` immediately on hover change, before forwarding to the consumer's `onHover` callback. `ChartRendererLike` (the test seam type) must also include `updateProjection`.

**Beam geometry:** Flat `BoxGeometry` spanning `[info.point[0], info.projectionTarget[0]]` along X, with height `theme.projection.beamWidth` in world units. `MeshBasicMaterial` with `color = theme.projection.color` and `transparent = true` / `opacity = theme.projection.opacity`. The emissive effect is achieved via a second additive `MeshBasicMaterial` layer or `blending: THREE.AdditiveBlending`.

**Landing dot:** Small `SpriteGeometry` or `PlaneGeometry` at `projectionTarget` with an additive material. A mild scale pulse (`sin(time * 4) * 0.15 + 1.0`) driven by wall-clock time.

**Entrance animation:** `beam.scale.x` animates from `0 → 1` using `easeOutExpo` over `theme.projection.animationDurationMs` (default: 220ms). The beam scales from the data point outward toward the Y-axis (scale origin is at the data point, not center). Animation driven by wall-clock time (`performance.now()` deltas), NOT by `blockProgress`.

**Hover-change behavior (re-trigger):** When hover moves from one data point to another without leaving the chart, the beam **snaps to the new position and restarts the entrance animation** from 0. No translation tween. Smooth translation would be visually chaotic during rapid bar traversal and is not worth the state machine complexity.

**Exit animation:** On `info = null`, beam and dot opacity fade to 0 over `~160ms`, then geometry is hidden (`visible = false`).

**Wall-clock delta routing:** `ChartProjectionRenderer` maintains its own `lastFrameTime: number` field. On `updateProjection()`, it reads `performance.now()` to compute `deltaMs` internally. No dependency on `AnimationTickContext` or `blockProgress`. The RAF loop triggers `apply()` each frame, which triggers `chartRenderer.update()`. `updateProjection()` is called separately from DOM hover events and from apply's call chain when projection state needs re-drawing (e.g., during fade-out animation between hover events). The architect must determine the exact call site for ongoing animation ticks — likely a `tickProjection()` method called from `ChartWidget.onTick()` for the active fade/pulse animations.

### 4. Tooltip Positioning

The tooltip is **anchored to the projected 3D hit point**, not the mouse cursor. The 3D `info.point` is projected to 2D screen coordinates using the widget's camera (same mechanism as the current `ChartTooltipOverlay`). The widget writes `{ x, y, info }` to `ChartTooltipStore` on hover.

**Edge-flip behavior:** When the projected tooltip position is within 16px of the right or bottom canvas edge, the tooltip flips to render to the left or above the anchor point respectively. `ChartTooltipHost` handles this purely in CSS/React using boundary detection against the host container size.

**Anchor offset:** 12px right and 12px above the projected hit point by default (configurable via `ChartTooltipTokens.offsetX` / `offsetY`).

### 5. Theme Token Groups

Two new optional token groups added to `ChartTheme`:

```typescript
/**
 * Tooltip HTML overlay visual tokens.
 * When absent, built-in defaults apply (dark glass style).
 */
export type ChartTooltipTokens = {
  readonly background: string;
  /**
   * Argument to `backdrop-filter: blur(...)`, e.g. '8px' for frosted-glass blur on the
   * background behind the tooltip. Empty string `''` = no backdrop-filter applied.
   * Note: `backdrop-filter` requires a non-opaque background to be visible.
   */
  readonly blur: string;
  readonly borderColor: string;
  readonly borderRadius: string;
  /** Primary value text color (the Y value hero line). */
  readonly valueColor: string;
  /** Secondary label/key text color. */
  readonly labelColor: string;
  /** Font size in px (HTML units, not world units). */
  readonly fontSize: number;
  /** CSS font-family. Defaults to the scene theme's HTML font family when absent. */
  readonly fontFamily?: string;
  readonly shadow: string;
  /** Inner padding, CSS shorthand (e.g. '8px 12px'). */
  readonly padding: string;
  /** Maximum tooltip width in px. Default: 220. */
  readonly maxWidth: number;
  /** X offset from anchor point in px. Default: 12. */
  readonly offsetX: number;
  /** Y offset from anchor point in px. Default: -12 (above). */
  readonly offsetY: number;
  /**
   * No caret. The tooltip floats without a directional indicator.
   * The Y-axis projection beam provides the visual connection to the data point.
   */
};

/**
 * Y-axis projection beam visual tokens.
 * Present on all themes. Beam is drawn only when ChartHitInfo.projectionTarget is non-null.
 * Absent theme.projection → use built-in defaults (not disable projection).
 */
export type ChartProjectionTokens = {
  readonly color: string;
  readonly emissiveIntensity: number;
  /** Beam height in world units. */
  readonly beamWidth: number;
  readonly opacity: number;
  /** Landing dot radius in world units. */
  readonly dotRadius: number;
  readonly dotEmissiveIntensity: number;
  /** Entrance animation duration in ms. Default: 220. */
  readonly animationDurationMs: number;
};
```

Both added to `ChartTheme`:
```typescript
// In ChartTheme:
readonly tooltip?: ChartTooltipTokens;
readonly projection?: ChartProjectionTokens;
```

**Token defaults for all 12 themes:**

| Theme | Tooltip bg | Tooltip border | Projection color | Beam width |
|-------|-----------|----------------|-----------------|------------|
| darkGlass | `rgba(28,16,10,0.92)` | `rgba(227,106,46,0.3)` | `#E36A2E` | 0.004 |
| darkGlassLight | `rgba(252,246,240,0.95)` | `rgba(179,58,43,0.25)` | `#B33A2B` | 0.004 |
| neonCyber | `rgba(8,0,28,0.94)` | `rgba(0,231,255,0.4)` | `#00E7FF` | 0.005 |
| neonCyberLight | `rgba(240,248,255,0.95)` | `rgba(138,61,255,0.3)` | `#8A3DFF` | 0.005 |
| enterprise | `rgba(255,255,255,0.96)` | `rgba(79,118,184,0.25)` | `#4F76B8` | 0.003 |
| enterpriseLight | `rgba(255,255,255,0.97)` | `rgba(63,127,115,0.25)` | `#3F7F73` | 0.003 |
| midnight | `rgba(6,8,24,0.94)` | `rgba(107,155,255,0.3)` | `#6B9BFF` | 0.005 |
| midnightLight | `rgba(242,244,255,0.96)` | `rgba(79,100,200,0.25)` | `#4F64C8` | 0.004 |
| lightCanvas | `rgba(255,255,255,0.96)` | `rgba(90,138,106,0.25)` | `#5A8A6A` | 0.003 |
| lightCanvasDark | `rgba(18,26,20,0.93)` | `rgba(90,138,106,0.3)` | `#5A8A6A` | 0.003 |
| lightMinimal | `rgba(255,255,255,0.97)` | `rgba(180,180,180,0.3)` | `#888888` | 0.003 |
| lightMinimalDark | `rgba(16,16,18,0.94)` | `rgba(150,150,150,0.25)` | `#999999` | 0.003 |

---

## Constraints and Architecture Notes

### Interaction system is mouse-only
`ChartWidget` attaches `mousemove`, `mouseleave`, and `click` listeners. No touch support. This feature is mouse-only. Touch is a separate future feature.

### `interactive: true` is required
All hover behavior gates on `state.interactive`. Document prominently in the API reference.

### Layout must be cached in renderers
`resolveHoverInfo()` currently receives only `intersection` and `data`. Computing `projectionTarget` requires `plotFrame.x` and `chartGroup.worldPosition.x` from the layout. Each renderer must cache these fields during `update()` so they are available at hit-resolution time. This is renderer-internal state — it does NOT change the `IChartRenderer` interface signature for `resolveHoverInfo()`.

### Six-renderer blast radius
All six renderers (`BarRenderer`, `LineRenderer`, `AreaRenderer`, `ScatterRenderer`, `PieRenderer`, `HeatmapRenderer`) must be updated to:
1. Cache `plotFrame` and world position from `update()`
2. Populate `meta` with type-specific data in `resolveHoverInfo()`
3. Populate `projectionTarget` where applicable (bar, line, area, scatter)

### `ChartProjectionRenderer` animation testing
Animation is time-driven. Tests must inject a `getNow: () => number` parameter to make timing deterministic.

### HTML bridge: `ChartTooltipStore` pattern
`ChartWidget` on hover writes `{ widgetId, x, y, info }` to a module-level `ChartTooltipStore`. `<ChartTooltipHost />` subscribes (via a lightweight `useSyncExternalStore` wrapper) and renders the active tooltip. The store is keyed by widgetId to support multiple simultaneous charts — only the most recently hovered chart shows a tooltip at any time.

`nvsBounds` is stored by `ChartWidget` internally (it already has it from `ChartState.nvsBounds`) and used during projection. The consumer never needs to specify it.

### `ChartRendererLike` test seam
Must include `updateProjection(info: ChartHitInfo | null, theme: ChartTheme): void`.

### Dev-mode warning for missing `<ChartTooltipHost />`
In development mode, if `ChartWidget` writes to `ChartTooltipStore` and no `<ChartTooltipHost />` subscriber is registered within one frame, a `console.warn` is emitted once per chart ID:
```
[ChartTooltipStore] Chart "revenue" has tooltip enabled but no <ChartTooltipHost /> is mounted. Add <ChartTooltipHost /> inside EngineOverlayHost.
```
Silent failure is the worst adoption outcome — a consumer who adds `<ChartTooltip />` and sees nothing will assume the feature is broken. The warning is suppressed in production (`process.env.NODE_ENV !== 'production'` guard).

### Fallback token values for custom consumer themes
When `theme.tooltip` or `theme.projection` is absent (i.e., a consumer-defined custom theme that does not specify these optional fields), `ChartTooltipHost` and `ChartProjectionRenderer` fall back to the **`darkGlass` theme token values** as hardcoded compile-time constants. Consumers who want different fallback behavior must specify the token group explicitly on their theme object.

---

## Open Questions for the Architect

The following unresolved design questions require architect input before implementation:

1. **`tickProjection()` call site**: The projection beam fade-out and landing-dot pulse require ongoing ticks between user interactions (not just on hover events). The architect must specify whether `ChartWidget.onTick()` calls `chartRenderer.tickProjection(deltaMs)` each frame, or whether the `ChartProjectionRenderer` independently participates in the RAF loop.

2. **`useChartTooltipConfig()` public API surface**: Is this hook exported from `@brewsite/charts/index.ts`? What is its exact signature and return type? Does it need cleanup on unmount, and if so, how is the lifecycle managed?

3. **`renderContent` + `ChartTooltipRuntimeConfig` disposal**: If the component calling `useChartTooltipConfig` unmounts, the runtime config must be deregistered. Confirm the hook's cleanup semantics.

---

## Deprecation: `ChartTooltipOverlay`

`ChartTooltipOverlay` is **deprecated in this release** and will be **removed in the next minor version**.

Migration:

```tsx
// Before — external component, widget reference, duplicated nvsBounds:
<ChartTooltipOverlay
  widget={someWidget}
  nvsBounds={{ x: 0, y: 0, w: 1, h: 1 }}
/>
// In DSL:
<BarChart id="revenue" interactive>...</BarChart>

// After — one child, one global host:
// In DSL:
<BarChart id="revenue" interactive>
  ...
  <ChartTooltip />
</BarChart>

// In EngineOverlayHost (once, for all charts):
<EngineOverlayHost>
  <ChartTooltipHost />
</EngineOverlayHost>
```

The `@deprecated` JSDoc on `ChartTooltipOverlay` must reference the version it was deprecated in and the version it will be removed in.

---

## Launch Criteria

- [ ] `<ChartTooltip>` DSL child compiles to `ChartState.tooltip: ChartTooltipState | null`
- [ ] `ChartTooltipRuntimeConfig` type exported; `useChartTooltipConfig()` hook exported from `@brewsite/charts`
- [ ] All 6 renderers return `ChartHitInfo` with `meta` populated for their chart kind
- [ ] Bar, line, area, scatter renderers populate `projectionTarget`; pie and heatmap do not
- [ ] `ChartProjectionRenderer` renders beam + landing dot for bar, line, area, scatter
- [ ] Entrance (220ms ease-out-expo) and exit (160ms fade) animations play correctly
- [ ] Hover-change snaps to new position and restarts entrance animation
- [ ] `ChartTooltipStore` + `<ChartTooltipHost />` render type-aware rich tooltip for all 6 chart types
- [ ] Tooltip anchored to projected 3D hit point; edge-flip at 16px canvas boundary
- [ ] All 12 preset themes have explicit `tooltip` and `projection` token defaults
- [ ] `ChartTooltipOverlay` carries `@deprecated` JSDoc with version numbers and migration link
- [ ] All new types exported from `packages/charts/src/index.ts`
- [ ] `ChartProjectionRenderer` tests use `getNow` injection for deterministic timing
- [ ] Updated example in `apps/examples/src/chart/` demonstrates tooltip + projection on ≥2 chart types
- [ ] TypeScript strict mode passes across `packages/charts/`
