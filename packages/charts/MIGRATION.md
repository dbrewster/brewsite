# @brewsite/charts Migration Guide

## V2.1.0 — Minor Version (2.0.0 → 2.1.0)

V2.1.0 has **no breaking changes** for scene authors. All new DSL props are optional
and all new `ChartTheme` fields are optional with documented renderer defaults.

The following notes apply to **custom renderer authors**, **test authors who construct
`ChartState` directly**, and **TypeScript code that exhaustively switches on `DataTransform.type`**.

### `ChartState` gains two required fields with defaults

`ChartState` now has `animateEntry: boolean` and `animationDuration: number` as required
fields. If your code constructs a `ChartState` object directly (not via the DSL compiler or
`DEFAULT_CHART_STATE` spread), add these fields:

```typescript
// Add to any direct ChartState construction:
animateEntry: false,
animationDuration: 0.4,
```

Scene DSL — no change needed. The compiler sets these automatically from DSL props
(`animateEntry` defaults to `false`, `animationDuration` to `0.4`).

### `DataTransform` union gains `'compute'`

`DataTransform` now includes `ComputeTransform`. If you have exhaustive switches on
`DataTransform.type`, add a `'compute'` case:

```typescript
switch (transform.type) {
  case 'filter':  /* ... */ break;
  case 'groupBy': /* ... */ break;
  case 'sort':    /* ... */ break;
  case 'bin':     /* ... */ break;
  case 'compute': /* ... */ break;  // V2.1 — add this case
  default: {
    const _exhaustive: never = transform;
  }
}
```

### `BarRenderer` geometry origin changed (custom renderer authors and test authors)

In V2.1, `BarRenderer` anchors `BoxGeometry` at y=0 (bottom of bar) instead of the
Three.js default center. This allows `mesh.scale.y` to animate bars growing from the
floor. The change was made via `geometry.translate(0, barHeight/2, 0)` at creation time.

**Impact on tests:** Any test that asserts on bar mesh `position.y` values must be
updated. The bar mesh is now positioned at `barY` (bottom edge), not `barY + barHeight/2`
(center).

**Impact on custom `IChartRenderer` implementations:** If you subclass or replace
`BarRenderer`, update your `BoxGeometry` creation to use bottom-anchored origin.

### `AxisRenderState` gains a required `fittedMargins` field (test authors)

`AxesRenderer.update()` now requires `fittedMargins: FittedMargins` in `AxisRenderState`.
Any test that constructs `AxisRenderState` directly must add a stub:

```typescript
fittedMargins: { left: 0, right: 0, top: 0, bottom: 0 },
```

### `ChartBackgroundTokens.gridColor` is deprecated

The `gridColor` field on `ChartBackgroundTokens` is deprecated in favor of the new
`ChartGridlinesTokens` group on `ChartTheme`. The renderer fallback chain is:
`theme.gridlines?.color ?? theme.background.gridColor ?? '#4a6080'`.
Existing themes that set `background.gridColor` continue to work.

### Deferred to V2.2

The following were considered for V2.1 but deferred:
- **`PieRenderer` datum morphing** — arc angle interpolation requires rebuilding `ExtrudeGeometry` per frame; deferred pending performance analysis.
- **Line/area path-reveal entry animation** — `scale.y` is bar-specific. Left-to-right path reveal requires clip-mask or progressive geometry; out of V2.1 scope.
- **`useChartData` read-side subscription for inline data** — requires a new `subscribeToInline` listener registry on `ChartDataStore`; orthogonal to V2.1 feature areas.
- **`{ sync: true }` option on `useLiveChartData`** — calling store methods during React render violates strict mode rules.

---

## Breaking Changes in V2.0.0

### 1. Per-type DSL components replace `<Chart type="...">`

Before (V1, deprecated but still works):
```tsx
<Chart id="revenue" type="bar">
  <ChartData source="monthly" />
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
</Chart>
```

After (V2, preferred):
```tsx
<BarChart id="revenue">
  <ChartData source="monthly" />
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
</BarChart>
```

`<Chart>` remains exported and functional but is marked `@deprecated`. No removal timeline.

Available per-type components: `<BarChart>`, `<LineChart>`, `<ScatterPlotChart>`, `<PieChart>`, `<AreaChart>`, `<HeatMapChart>`.

### 2. `ChartState.dataSource` type changed

V1: `dataSource: string` — a named source key.
V2: `dataSource: ChartStateDataSource` — a discriminated union.

If you read `state.dataSource` in custom code:
```typescript
// V1
const sourceName = state.dataSource; // string

// V2
const sourceName = state.dataSource.type === 'named'
  ? state.dataSource.name
  : state.dataSource.type === 'inline'
    ? `__inline__${widgetId}`
    : `__async__${widgetId}`;
```

### 3. Type-specific props moved into `typeConfig.options`

V1 flat fields `lineShape`, `pieTilt`, `innerRadius`, `timeField`, `lineSmoothness`,
`lineSubdivisions`, `axisGap`, `legendGap` are removed from `ChartState`.

V2: Use `state.typeConfig.options` with a `kind` guard:
```typescript
// V1
const shape = state.lineShape;

// V2
const shape = state.typeConfig.kind === 'line'
  ? state.typeConfig.options.lineShape
  : undefined;
```

### 4. `ChartProvider` is now optional for inline data

```tsx
// V2: No ChartProvider needed for inline data
<BarChart id="revenue" data={myRows}>
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
</BarChart>

// V2: Async fetch — no ChartProvider needed
<LineChart id="remote-chart" dataUrl="/api/metrics.json">
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="value" />
</LineChart>

// V2: ChartProvider still required for named sources
<ChartProvider data={{ monthly: rows }}>
  <BarChart id="revenue">
    <ChartData source="monthly" />
  </BarChart>
</ChartProvider>
```

### 5. `IChartRenderer.update()` context changed

Custom `IChartRenderer` implementations must update `update(ctx: ChartRenderContext)`:
- Remove reads of `ctx.lineShape`, `ctx.pieTilt`, `ctx.innerRadius`, etc.
- Replace with `ctx.typeOptions.kind === 'xxx' ? ctx.typeOptions.options.xxx : undefined`
- Add null-guard for `ctx.legend` (now in context; was not present in V1)

```typescript
// V1
const shape = ctx.lineShape;

// V2
const shape = ctx.typeOptions.kind === 'line' ? ctx.typeOptions.options.lineShape : undefined;
```

### 6. Package version

`@brewsite/charts` 2.0.0 is a major version. Update your package.json:
```json
{ "dependencies": { "@brewsite/charts": "^2.0.0" } }
```

---

## v2.x — NVS Universal Coordinate System

### `ChartState.bounds.width` and `.height` are now NVS fractions

**Change:** `bounds.width` and `bounds.height` changed from world-space units to
NVS fractions in the range [0..1]. `bounds.depth` remains world-space and is unchanged.

**Before (world-unit values):**
```typescript
// Old: chart occupied 8.89 × 5.0 world units on a worldScale=10 scene
<Chart
  id="revenue"
  type="bar"
  bounds={{ width: 8.89, height: 5 }}
/>
```

**After (NVS fractions):**
```typescript
// New: chart occupies 50% of viewport width × 50% of viewport height
<Chart
  id="revenue"
  type="bar"
  bounds={{ width: 0.5, height: 0.5 }}
/>
```

**Default values also changed:**
- Before: `bounds = { width: 4, height: 3, depth: 0.4 }`
- After:  `bounds = { width: 1.0, height: 1.0, depth: 0.4 }`

The new default (1.0 × 1.0) means the chart fills its declared NVS region
(`x/y/w/h` props) by default. This is the most common case.

### Conversion formula

To migrate from world-unit bounds to NVS fractions, divide by the visible world
dimensions at your scene's `worldScale`:

```
nvsWidth  = worldWidth  / visibleWorldWidth
nvsHeight = worldHeight / visibleWorldHeight
```

For a `worldScale=10` scene (`visibleWorldWidth ≈ 17.78`, `visibleWorldHeight ≈ 10.0`):
```
bounds={{ width: 8.89, height: 5.0 }}  →  bounds={{ width: 0.5, height: 0.5 }}
bounds={{ width: 17.78, height: 10.0 }} →  bounds={{ width: 1.0, height: 1.0 }}
```

### Transition spec migration

Any scene that authors `bounds.width` or `bounds.height` in transition `enter`/`exit`
overrides must reauthor those values from world-unit ranges to NVS fractions [0..1].

**Before:**
```typescript
// enter: grow from 0 world units to full size
enter={{ bounds: { width: 0, height: 0 } }}  →  bounds={{ width: 8.89, height: 5 }}
```

**After:**
```typescript
// enter: grow from 0 NVS fraction to full size
enter={{ bounds: { width: 0, height: 0 } }}  →  bounds={{ width: 0.5, height: 0.5 }}
```

### `ChartWidget.apply()` internals

`ChartWidget` now uses `context.coords` (a `NVSCoordService`) to convert NVS bounds
to world-space. The `private cameraRef` stash and the `nvsToWorldAnalytic()` hardcoded
fallback have been removed. This requires `WidgetRenderContext.coords` to be populated,
which the `RuntimeDriverImpl` handles automatically.

No changes are required in consuming code unless you were constructing `WidgetRenderContext`
objects manually (e.g., in tests). Those must now include a `coords` field:

```typescript
import { createNVSCoordService } from '@brewsite/core';
import * as THREE from 'three';

const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.01, 100);
camera.position.set(0, 0, 12.07);
const coords = createNVSCoordService(camera, 1920, 1080);

const ctx: WidgetRenderContext = {
  // ... other fields ...
  coords,
};
```
