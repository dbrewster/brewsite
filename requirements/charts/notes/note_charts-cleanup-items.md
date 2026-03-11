---
title: "Charts Cleanup Items — Three Design Problems"
doc_type: note
status: draft
owner: Toolkit Product
last_updated: 2026-03-11
---

# Charts Cleanup Items — Three Design Problems

This note documents three discrete design problems in `@brewsite/charts` that each require product decisions before implementation. They are captured together because they surfaced during the scene10 linked-brush implementation and all touch the data registration / bounding / accessor surface.

---

## Item 1: Reactive Named Data — String-Key Coupling and `filterGroup` Gap in `useLiveChartData`

### Problem

The `ChartProvider` registration pattern requires the same string key to appear in two separate files: once in the page component (`ChartDemoPage.tsx`) as a property key in the `data` map, and once in the scene DSL as the `source` prop on `<ChartData>`. There is no type-level enforcement connecting these two string literals. A typo or rename in one location produces a silent runtime failure (the chart renders empty).

```tsx
// ChartDemoPage.tsx — author invents a name here
const chartData = useMemo(() => ({
  'ops-data': { rows: teamPerformance, filterGroup: 'ops' },
}), []);
<ChartProvider data={chartData}>
  ...

// scene10-linked-brush.tsx — author must match the same string here
<ChartData source="ops-data" filterGroup="ops" />
```

The `filterGroup` value is also duplicated: set once in `ChartProvider`'s `DataSourceConfig.filterGroup` and again in each chart's `<ChartData filterGroup="ops" />`. They are independent registrations that happen to use the same string. Nothing in the type system enforces this relationship.

The `useLiveChartData` hook offers an escape from the named-source pattern for React-state-driven data — it registers inline data directly via `store.registerInline()` + `store.setLiveOverride()` without requiring a string key. However, the current signature has no `filterGroup` parameter:

```ts
// packages/charts/src/player/useLiveChartData.ts
export function useLiveChartData(
  plugin: ChartPluginInstance,
  chartId: string,
  data: DataInput,
): void
```

`store.registerInline()` calls `store.register('__inline__${widgetId}', rows)` — the `register()` overload that accepts a `filterGroupId` is not used. This means there is no supported path for a linked-brush scene that uses React-state-driven data AND shared filter groups. To use linked-brush today, authors must go through `ChartProvider` with the string-key pattern.

### Current Behavior

- Named source path: string key in `ChartProvider.data` must match `<ChartData source="string">` in scene DSL. Filter group is set in `ChartProvider`'s `DataSourceConfig.filterGroup` and separately in `<ChartData filterGroup="...">`.
- Inline live path (`useLiveChartData`): bypasses string-key coupling but does not support `filterGroup`. Cannot be used for linked-brush.
- Async path: URL is serialized in the DSL via `<ChartData url="..." />`; no string-key coupling problem.

### Desired Behavior

- `useLiveChartData` should accept an optional `filterGroup` parameter so React-state-driven data can participate in linked-brush without the named-source pattern.
- The string-key naming problem in `ChartProvider` is lower priority (it is the established pattern for server-data / pre-registered data, and backward compat must be maintained), but should be noted as a DX friction point.

### Proposed Direction

Extend `useLiveChartData` with an options bag:

```ts
export function useLiveChartData(
  plugin: ChartPluginInstance,
  chartId: string,
  data: DataInput,
  options?: { filterGroup?: string },
): void
```

Internally, when `options.filterGroup` is set, call `store.registerInline(widgetId, rows, filterGroup)` — which requires `ChartDataStore.registerInline()` to accept an optional `filterGroupId` parameter and pass it through to `store.register()`.

The `<ChartData filterGroup="...">` prop would remain as-is for the named-source path. For the live-data path, `filterGroup` is supplied at the hook call site instead.

### Open Questions

1. Should `ChartDataStore.registerInline()` be changed to accept `filterGroupId`? It currently delegates to `register('__inline__${widgetId}', rows)` without a group. This is a straightforward additive change.
2. When two charts both call `useLiveChartData(..., { filterGroup: 'ops' })`, they share a filter group but each has its own data rows. Is this the right model for linked-brush with independent data arrays? Or do both charts need to point at the same underlying data rows?
3. The `filterGroup` duplication between `ChartProvider.DataSourceConfig.filterGroup` and `<ChartData filterGroup="...">` is confusing — the two serve different registration points. Consider documenting which one wins or whether they must be consistent.

---

## Item 2: Accessor Functions — `colorAccessor` Gap in `ScatterRenderer`

### Problem

The accessor infrastructure is largely in place: `ChartAccessorFunctions` is defined in `IChartRenderer.ts`, `useChartAccessors()` registers them on `plugin.accessorRegistry`, `ChartWidget.apply()` reads the registry and passes `accessors` into `ChartRenderInput`, and `ChartRenderContext` carries the `accessors` field to renderers. However, `ScatterRenderer` does not consume `colorAccessor`.

The `xAccessor` and `yAccessor` channels are wired correctly in `ScatterRenderer.update()`:

```ts
// ScatterRenderer.ts — correctly uses xAccessor and yAccessor
const xValues = data.rows.map((r) =>
  ctx.accessors?.xAccessor ? ctx.accessors.xAccessor(r as Record<string, unknown>) : (Number(r[xField]) || 0),
);
const yValues = data.rows.map((r) =>
  ctx.accessors?.yAccessor ? ctx.accessors.yAccessor(r as Record<string, unknown>) : (Number(r[yField]) || 0),
);
```

The `sizeAccessor` channel is also wired:

```ts
// ScatterRenderer.ts — correctly uses sizeAccessor
const rawSize = ctx.accessors?.sizeAccessor
  ? ctx.accessors.sizeAccessor(row)
  : (sizeValues[i]!);
```

The `colorAccessor` channel is NOT wired. Color value lookup always falls back to field-name access:

```ts
// ScatterRenderer.ts — colorAccessor is never consulted
const rawVal = Number(row[colorField!]) || 0;
```

`ChartAccessorFunctions.colorAccessor` is typed as `(row: DataRow) => number | string`, but there is no code path in `ScatterRenderer` that calls it. The type exists, the hook registers it, the render context carries it — but the renderer ignores it.

### Current Behavior

- `xAccessor`, `yAccessor`, `sizeAccessor`: wired in `ScatterRenderer`. Overrides field-name lookup when present.
- `colorAccessor`: declared in `ChartAccessorFunctions`, registered by `useChartAccessors()`, present in `ChartRenderContext.accessors` — but `ScatterRenderer` never calls it. Passing a `colorAccessor` via `useChartAccessors()` has no effect.
- No other renderer (Bar, Line, Area, Pie, Heatmap) currently consumes any accessor channel. This is expected — `colorAccessor` and `sizeAccessor` are scatter-specific; `xAccessor`/`yAccessor` are plausibly useful in line/bar for log-scale preprocessing, but not yet needed.

### Desired Behavior

`ScatterRenderer` should consume `colorAccessor` for the continuous (non-ordinal) color encoding path. When `colorAccessor` is present and `colorField` is set, the accessor return value should be used in place of `Number(row[colorField])`.

The ordinal color path (where `colorField` values are strings and are mapped to theme series colors by index) does not need `colorAccessor` — ordinal lookup by string value is already correct. The accessor is only meaningful for the continuous numeric path.

### Proposed Fix (Narrow)

In `ScatterRenderer.update()`, replace the continuous color value lookup:

```ts
// Before
const rawVal = Number(row[colorField!]) || 0;

// After
const rawVal = ctx.accessors?.colorAccessor
  ? Number(ctx.accessors.colorAccessor(row))
  : (Number(row[colorField!]) || 0);
```

### Ergonomics Concern

The current hook signature requires passing `plugin` down from the page component:

```ts
useChartAccessors(plugin, chartId, {
  colorAccessor: (row) => complexDerivedValue(row),
});
```

For scenes that already have `plugin` in scope (from `chartPlugin()`), this is workable. It is not possible to call `useChartAccessors` inside a scene DSL component — functions are not SceneTrack-serializable, so accessor registration must stay at the React component level. The hook-at-page-level pattern is the correct approach; the ergonomic concern is that `plugin` propagation is verbose in larger apps.

A future improvement could accept the store directly (`{ store: plugin.store }`) to avoid full plugin coupling, but this is not blocking.

### Open Questions

1. Should `colorAccessor` return type be narrowed to `number` for the continuous path? The current `number | string` return type is ambiguous — string returns only make sense for ordinal lookup, which already works without an accessor. A `number`-only return for continuous encoding would clarify the contract.
2. Should the Heatmap renderer's height/color channels also be accessor-eligible? Deferred — only add when there is a concrete need. Do not expand the accessor surface speculatively.
3. Does `xAccessor`/`yAccessor` need to be wired in `LineRenderer` and `BarRenderer` for log-scale pre-processing use cases? Not required for current scenes, but should be noted as a natural extension.

---

## Item 3: Chart Bounding — `bounds.width`/`bounds.height` Are NVS Fractions, Not World-Space

### Problem

The `ChartState.bounds` field is documented and typed as follows:

```ts
// packages/charts/src/elements/chart/types.ts
/**
 * Chart geometry dimensions.
 * width: NVS fraction of viewport width [0..1]. Default: nvsBounds.w.
 * height: NVS fraction of viewport height [0..1]. Default: nvsBounds.h.
 * depth: World-space thickness of 3D geometry (bars, areas). Default: 0.4.
 */
readonly bounds: { readonly width: number; readonly height: number; readonly depth: number };
```

`ChartWidget.apply()` passes `bounds.width` and `bounds.height` through `ctx.coords.toWorldSize()`, confirming they are treated as NVS fractions:

```ts
// ChartWidget.apply()
const [worldW, worldH] = ctx.coords.toWorldSize(state.bounds.width, state.bounds.height);
```

So `bounds.width` = 0.35 means "35% of viewport width in world-space." This is correct behavior based on the type comment.

The problem is that `w` (from `<BarChart w={0.42} />`) and `bounds.width` (from `bounds={{ width: 0.35 }}`) are two independent NVS fractions that both affect chart sizing, but they control different things and there is no enforced relationship between them:

- `w`/`h` → stored in `ChartState.nvsBounds.w`/`h` via the NVS rect compile step. Used for NVS region declaration (hover hit testing, layout intent). Does NOT drive geometry size.
- `bounds.width`/`bounds.height` → stored in `ChartState.bounds.width`/`height`. Used exclusively to size the Three.js geometry via `toWorldSize()`. Does NOT derive from `w`/`h`.

In `scene10-linked-brush.tsx`:

```tsx
<BarChart
  x={DASH_LAYOUT_LEFT.x}   // 0.05 — NVS region left edge
  y={DASH_LAYOUT_LEFT.y}   // 0.18 — NVS region top edge
  w={DASH_LAYOUT_LEFT.w}   // 0.42 — NVS region width (layout intent)
  h={DASH_LAYOUT_LEFT.h}   // 0.58 — NVS region height (layout intent)
  bounds={{ width: 0.35, height: 0.28, depth: 0.4 }}
  // geometry is 35% wide × 28% tall of viewport
  // but the declared layout region is 42% wide × 58% tall
>
```

The geometry (35%×28%) is smaller than the declared NVS region (42%×58%). This misalignment means:

- The chart occupies 35% of viewport width in world-space, but 42% in NVS layout intent.
- If a future author sets `bounds={{ width: 0.50 }}` while keeping `w={0.42}`, the geometry overflows the declared region. Nothing warns about this at authoring time.
- The `DEFAULT_CHART_STATE` sets `bounds: { width: 1.0, height: 1.0 }` — both at 100% of viewport. This means a chart with no explicit `bounds` props will fill 100% of viewport width/height in world-space regardless of `w`/`h`. This is almost certainly wrong for most usage.

The overflow observed in scene10 is because `bounds.width`=0.35 produces geometry that is 35% of viewport width, while the positioning centers it at `x=0.05, w=0.42` NVS region. With FOV 42 and the AR container at 9:9 aspect, 35% of viewport width in world-space at chart Z depth may not equal 35% of the rendered pixel width, because `toWorldSize()` computes world-space from the AR container's reference geometry, not from camera projection at a specific depth. If chart geometry is rendered at a Z position that causes it to appear larger on screen than its NVS fraction implies, overflow occurs.

### Root Cause Summary

`bounds.width`/`bounds.height` are a second independent size channel alongside `w`/`h` that authors must manually keep consistent. There is no constraint enforcing `bounds.width <= w` or any correspondence between the two. The default values (`1.0, 1.0`) are wrong for non-fullscreen charts.

### Desired Behavior

`bounds.width` and `bounds.height` should default to the chart's `w`/`h` NVS props, so that geometry size matches the declared layout region by default. Authors who need to inset geometry within the NVS region (leaving padding) could still set explicit `bounds.width`/`height` values, but the common case (geometry fills the declared region) should require no extra props.

The `depth` dimension remains separate — it controls 3D extrusion and has no 2D layout counterpart.

### Proposed Direction (Option A — Preferred)

In `compile.ts`, when `bounds.width` and `bounds.height` are not explicitly set in the DSL, default them to the compiled `nvsBounds.w` and `nvsBounds.h` respectively:

```ts
// compile.ts (conceptual)
bounds: {
  width:  props.bounds?.width  ?? nvsBoundsW,
  height: props.bounds?.height ?? nvsBoundsH,
  depth:  props.bounds?.depth  ?? 0.4,
},
```

This makes the default behavior correct and eliminates the need to set `bounds.width`/`height` explicitly in most scene DSL files.

### Alternative (Option B — Validator-Only)

Keep `bounds.width`/`bounds.height` as explicit props but add a dev-mode validation warning in `ChartWidget.apply()` when `bounds.width > nvsBounds.w` or `bounds.height > nvsBounds.h`. This catches overflow at runtime without changing compile-time defaults.

Option A is preferred because it eliminates the authoring burden. Option B is a fallback if backward compat concerns are significant (changing the default for existing charts that rely on `bounds.width: 1.0` default would alter their rendered size).

### Open Questions

1. Do any existing scenes depend on the `bounds.width: 1.0` default being different from `w`? Need to audit all chart DSL files for charts that omit `bounds` props.
2. Should `bounds.width`/`bounds.height` DSL props be deprecated in favor of computing geometry size entirely from `w`/`h`? This would be cleaner long-term but is a more significant API change (major version).
3. The `depth` prop is the only remaining reason for the `bounds` object to exist if `width`/`height` are removed. Consider whether `depth` should be a top-level prop (e.g., `<BarChart depth={0.4} />`) to match `w`/`h` ergonomics.
4. Does `toWorldSize()` produce correct pixel-width correspondence at the chart's render Z depth? The NVS-to-world conversion may assume Z=0; charts rendered at non-zero Z will appear larger or smaller on screen than their NVS fraction implies. This may be a separate (and more fundamental) depth-compensation bug in `NVSCoordService`.
