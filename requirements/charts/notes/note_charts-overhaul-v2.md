---
title: Charts Overhaul v2 Feature Note
doc_type: note
owner: product
status: draft
updated: 2026-03-11
---

# @brewsite/charts — V2.1 Feature Note

## Background

`@brewsite/charts` V2.0.0 is live. It delivered: per-type DSL components, three data source paths
(inline/async/named), `ChartStateDataSource` discriminated union, `ChartTypeOptions` discriminated
union, datum-level bar/scatter morphing via `_morphT`/`MorphContext`, NVS-fractional bounds,
`ChartDataLabels`, `ReferenceLine`, and expanded axis/legend controls.

Five new feature areas have emerged from usage. This note describes what is broken or missing,
proposes solutions, surfaces design decisions, and lists open questions for the architect to resolve
in the implementation plan.

---

## 1. Problem Statement

### 1.1 Data-as-objects (reactive data binding)

V2 inline data (`data={rows}`) is baked into the `SceneTrack` at compile time. The rows are stored
in `ChartState.dataSource.rows` and become a frozen part of the pre-baked tick array. When a
consumer holds chart data in React state (`const [data, setData] = useState(initialRows)`) and
calls `setData(newRows)`, the scene is NOT recompiled — the SceneTrack remains unchanged —
so the chart never updates.

The `ChartWidget.apply()` reference-equality guard (`state.dataSource.rows !== this.lastInlineRowsRef`)
was designed to prevent redundant store writes per frame, not to detect React state changes. Since the
SceneTrack-baked `rows` reference never changes between frames, the guard always short-circuits after
the first frame.

The named source path (`ChartProvider`) does support reactive updates because `ChartDataStore.register()`
is called inside a React `useEffect` that re-fires when data changes. But it requires:
1. A `ChartProvider` wrapper in the React tree
2. A string key mapping DSL to provider
3. Knowledge that this is the reactive path (not obvious from the DSL)

There is no first-class hook for "update this chart's data when my React state changes."

**Symptom**: a consumer building a live dashboard where data is fetched on an interval and passed
as props to a scene has no way to propagate updates into a rendered chart without a full page reload.

### 1.2 Axis mapping functions

All data-to-visual-channel mappings in V2 are field-name strings. `<ChartAxis axis="x" field="revenue">`
means "use the raw `revenue` value as the X position." `sizeField="headcount"` means "use raw
`headcount` as the size scale input." There is no way to apply a transform — e.g., `log(revenue)`,
`sqrt(headcount)`, or `d => d.revenue / 1000` — at the chart level without pre-processing the data.

The serializable `DataTransform` pipeline supports `filter`, `groupBy`, `sort`, and `bin`. But
there is no `compute` transform that derives new columns. So common scenarios require the consumer
to pre-process data outside the chart DSL:

- A scatter chart that wants log-scale X axis must compute `log_teamSize` in JavaScript before
  passing data to the chart.
- A chart that wants to normalize a field to `[0, 1]` must pre-compute a `normalized_revenue` column.
- A scatter chart with a custom bubble size formula (e.g., `sqrt(area)`) must add a
  `derived_size` column.

There is no type-safe hook or DSL API for attaching accessor functions to specific charts at
runtime that bypasses the SceneTrack serialization constraint.

### 1.3 Data animations & cross-scene transitions

V2 delivers datum-level morphing for bar and scatter charts when `keyField` is set on both
from- and to-state data sources. The `_morphT` injected by `interpolateFn` and consumed by
`ChartRenderer` to build `MorphContext` works correctly.

What is missing:

**Entry animation**: When a scene containing a chart appears, bar heights instantly snap to their
final values. The `enterFn` in `functionalChartTransitionSpec` only fades opacity. There is no
mechanism to animate bars growing upward from zero on scene entry. The `IAnimationController.onTick()`
interface exists on `ChartWidget` and is already used for heatmap time-slice animation — it could
drive entry animation — but nothing connects `blockProgress` to bar geometry scaling.

**Cross-type morphing**: When two consecutive scenes have different chart types for the same `id`,
the chart type switches at `t = 0.5` with a hard geometry cut. Bar → line, line → area, etc. all
produce a jarring mid-transition swap. There is no cross-fade or partial geometry blend between types.

**Animation configuration**: There is no DSL API for configuring animation behavior:
- `animateEntry: boolean` — should bars/lines animate in on scene enter?
- `animationDuration: number` — how long should the entry animation take relative to `blockProgress`?

### 1.4 Full theme coverage

`ChartTheme` in `themes/types.ts` has tokens for: series materials, axis lines/ticks/labels,
background/floor, legend, line shape, pie tilt, and interaction hover/select. But several visual
parameters are NOT expressible via the theme and have no default in the theme object:

| Missing Theme Token | Current Location | Problem |
|---|---|---|
| Default `barPadding` | `BarChartOptions` DSL prop only | Consumers must set it every scene; no theme-level default |
| Default `fillOpacity` | `AreaChartOptions` DSL prop only | Same problem |
| `gridlines` default enabled state | Per-axis DSL prop or per-chart DSL shorthand | Theme can't set "always show gridlines for this theme" |
| `gridlines` opacity and dash pattern | `ChartBackgroundTokens.gridColor` only (partial) | gridColor exists; opacity/dash not in theme |
| `dataLabels` font size, color, background | Absent from theme entirely | `ChartDataLabels` has no theme tokens |
| `referenceLines` default color, line width | Absent from theme entirely | `ReferenceLine.color` falls back to a hardcoded color in the renderer; line width not configurable |
| `legend.textOpacity` | `legend.textColor` is color-only | No opacity control on legend label text separate from the color value |
| Axis title font size (separate from tick label font size) | `axis.fontSize` serves both | Title and tick labels have no independent font size control |
| Scatter point radius base size | `ScatterRenderer` hardcodes `0.08` sphere radius | No way to set default scatter point size via theme |
| Tooltip styling | Absent from theme entirely | `ChartTooltipOverlay` uses hardcoded styles |

### 1.5 Chart bounding fix

Charts in scene10-linked-brush.tsx overflow their declared bounds. Root causes identified:

**Root Cause A — AxesRenderer uses raw theme values, not fitted margins.**
`computeChartLayout` runs `fitMargins()` to scale down margins when they exceed the available
space. `fitMargins` correctly caps margins to prevent the plot area from going negative, but it
returns fitted `[start, end]` pairs that are ONLY used to compute `plotFrame`. The `AxesRenderer`
never receives the fitted margin values. It positions tick labels and axis titles using raw
theme values: `theme.axis.tickLength + theme.axis.gap + theme.axis.fontSize * N`. When
`fitMargins` has scaled margins down (because chart world size is small), the axis labels are
positioned OUTSIDE the fitted `plotFrame` — overflowing the `bounds.width` boundary.

**Root Cause B — ScatterRenderer xScale/yScale internal padding misaligns with AxesRenderer.**
`ScatterRenderer.update()` positions scatter points using:
```typescript
xScale.range([0.1 * bounds.width, 0.9 * bounds.width])  // 10% padding on each side
```
But it passes tick positions to `AxesRenderer` as `position: i / 5` (mapping 0→1 over full
`bounds.width`). The AxesRenderer renders tick `i` at `x = (i/5) * bounds.width`. The scatter
point for the minimum-X value is at `0.1 * bounds.width`, but the corresponding tick is at
`0.0 * bounds.width`. Ticks and points are misaligned by 10% of `bounds.width` on each axis.
This misalignment is a correctness bug independent of overflow.

**Root Cause C — Hardcoded `minPlotWidth = 0.8` in `computeChartLayout`.**
```typescript
const minPlotWidth = Math.max(bounds.width * 0.48, 0.8);
```
The `0.8` floor is in absolute world units and doesn't scale with chart size. For a chart where
`worldW = 1.2` units (a narrow chart), `minPlotWidth` is clamped to `0.8`. When margins
naturally add to more than `1.2 - 0.8 = 0.4`, `fitMargins` scales them — creating the
disconnect described in Root Cause A.

---

## 2. Proposed Solution

### 2.1 Data-as-objects (reactive data binding)

Introduce a `useLiveChartData(chartsPlugin, chartId, data)` hook that directly updates the
`ChartDataStore` without going through the SceneTrack lifecycle.

**Scope constraint**: `useLiveChartData` only works when the chart's SceneTrack-compiled
`dataSource.type === 'inline'` — i.e., when the chart DSL uses `data={rows}` directly on
the chart component. It has **no effect** on named (`<ChartData source="...">`) or async
(`dataUrl="..."`) data sources. Consumers with named or async sources that need reactive
updates must use `ChartProvider` + `ChartDataStore.register()` directly, which already
supports reactive updates through React lifecycle.

**Data flow:**
1. Consumer calls `useLiveChartData(chartsPlugin, 'my-chart', rows)` in a React component
2. On mount and on every subsequent render where `rows` reference changes, the hook calls
   `store.registerInline(widgetId, normalizeDataInput(rows))` and marks a live override flag
3. `ChartWidget.apply()` — when `state.dataSource.type === 'inline'` — checks `store.hasLiveOverride(this.widgetId)`. If true, the live-hook registration owns this widget's data; the SceneTrack-baked rows are not written
4. On unmount, `useLiveChartData` calls `store.deregisterInline(widgetId)`, which removes the data
   and clears the override flag. On the next `apply()`, `ChartWidget` falls back to writing the
   SceneTrack-baked rows as in V2.0

**Revised `ChartWidget.apply()` inline handling:**
```typescript
if (state.dataSource.type === 'inline') {
  if (this.store.hasLiveOverride(this.widgetId)) {
    // Hook owns this widget's data — skip SceneTrack-baked write.
    // store.registerInline() has already been called by useLiveChartData.
  } else {
    // No live hook active — V2 behavior: write SceneTrack rows to store.
    if (state.dataSource.rows !== this.lastInlineRowsRef) {
      this.store.registerInline(this.widgetId, state.dataSource.rows);
      this.lastInlineRowsRef = state.dataSource.rows;
    }
  }
}
```

**`ChartDataStore` additions:**
- `hasLiveOverride(widgetId: string): boolean` — returns true when `useLiveChartData` has
  registered for this ID and not yet unmounted
- `deregisterInline(widgetId: string): void` — removes data from `__inline__${widgetId}` and
  clears the override flag; called on hook unmount

**Hook API:**
```typescript
import { useLiveChartData } from '@brewsite/charts';

// Inside a React component that has access to chartsPlugin:
useLiveChartData(chartsPlugin, 'revenue-chart', revenueRows);

// chartsPlugin: the value returned by chartPlugin(), passed to ScenePlayer's plugins prop.
// chartId: matches the `id` prop on <BarChart id="revenue-chart" data={initialRows}>.
// rows: any DataInput (row array or columnar). Hook normalizes before registering.
```

**DSL side stays the same**: the scene author writes `<BarChart id="revenue-chart" data={initialRows}>`.
`initialRows` seeds the SceneTrack for the very first render frame. The hook updates the live data
after mount. No DSL change is required when adding reactivity.

**Ordering note — single-frame latency on first mount**: `useLiveChartData` fires its `useEffect`
AFTER the first render. `ChartWidget.apply()` may fire on the first tick before the hook's
`useEffect` runs. This means the first frame shows the SceneTrack-baked `initialRows`, and
subsequent frames show the live data. In practice this single-frame delta is invisible — data
is available at mount time in virtually all target use cases, and the first frame and second frame
render in the same visual update. No zero-latency synchronous option is provided in V2.1; calling
store methods during React render would violate React's rules in strict mode and create ordering
hazards. If usage evidence shows the single-frame delta matters, a `sync` variant can be added in V2.2.

### 2.2 Axis mapping functions

Two tiers, matching the serializable SceneTrack constraint:

**Tier 1 — New `compute` transform (serializable, runtime-evaluated, composable with existing pipeline):**

`DataTransform` gains a new union member:
```typescript
type ComputeTransform = {
  readonly type: 'compute';
  readonly outputField: string;
  /** Built-in operations — no function references. Fully serializable. */
  readonly operation:
    | { readonly fn: 'log'; readonly inputField: string; readonly base?: number }
    | { readonly fn: 'sqrt'; readonly inputField: string }
    | { readonly fn: 'normalize'; readonly inputField: string }  // output: [0, 1] range
    | { readonly fn: 'scale'; readonly inputField: string; readonly factor: number }
    | { readonly fn: 'add'; readonly inputField: string; readonly value: number };
};

type DataTransform =
  | FilterTransform
  | GroupByTransform
  | SortTransform
  | BinTransform
  | ComputeTransform;  // new
```

**Execution timing**: `applyTransforms` runs at runtime — specifically inside `ChartDataStore.resolve()`,
which is called from `ChartRenderer.resolveData()` during every `ChartWidget.apply()` call
(memoized by `(sourceName, filteredRowCount, transformsHash)`). The transforms are stored as
serializable descriptors in `ChartState.transforms[]` (part of the SceneTrack) and evaluated
each frame against the live store data. `ComputeTransform` follows the identical timing model:
the descriptor is baked into the SceneTrack; `applyTransforms` runs it at render time.

This is NOT compile-time evaluation. The computed columns are produced from the current store
rows on each resolve call (subject to the memoization cache). For named sources, this means
the compute transform re-runs when the underlying data changes (cache miss). For inline sources,
the rows are immutable after the first SceneTrack bake, so the compute result is effectively cached
for the lifetime of the scene.

All existing exhaustive `DataTransform.type` pattern-matches in `applyTransforms` and tests must
be updated to handle `'compute'`. The architect should enumerate all such sites.

Usage:
```tsx
<ScatterPlotChart id="team-perf" sizeField="sqrt_headcount">
  <ChartData
    source="teams"
    transforms={[
      { type: 'compute', outputField: 'sqrt_headcount', operation: { fn: 'sqrt', inputField: 'headcount' } },
      { type: 'compute', outputField: 'log_revenue', operation: { fn: 'log', inputField: 'revenue', base: 10 } },
    ]}
  />
  <ChartAxis axis="x" field="teamSize" />
  <ChartAxis axis="y" field="log_revenue" />
</ScatterPlotChart>
```

**Tier 2 — Runtime accessor registry (function-based, bypasses SceneTrack):**
```typescript
import { useChartAccessors } from '@brewsite/charts';

// Attach function accessors to a specific chart by ID:
useChartAccessors(chartsPlugin, 'team-perf', {
  sizeAccessor: (row) => Math.sqrt(Number(row.headcount)),
  colorAccessor: (row) => String(row.region),
});
```

`ChartWidget` gains an `accessors` slot (NOT on `ChartState` — held in widget memory):
- `sizeAccessor?: (row: DataRow) => number`
- `colorAccessor?: (row: DataRow) => number | string`
- `xAccessor?: (row: DataRow) => number`
- `yAccessor?: (row: DataRow) => number`

Renderers (`ScatterRenderer`, `BarRenderer`, etc.) receive accessor functions via `ChartRenderContext`
and check for them first, falling back to `Number(row[field])` when absent. Accessor functions are
registered in a `ChartAccessorRegistry` held on `ChartPluginInstance`, keyed by the DSL `id` prop
(which equals the `widgetId`).

**Accessor persistence across scenes**: the `id` DSL prop is the registry key. When Scene A and
Scene B both contain `<ScatterPlotChart id="team-perf">`, a single `useChartAccessors` call at
component mount applies to both — the registry entry persists for as long as the hook is mounted.
This is the intended behavior: one hook call covers all scenes using that chart ID.

**Unmount fallback**: when the component calling `useChartAccessors` unmounts, the hook removes the
accessors from the registry. On the next render frame, renderers fall back to `Number(row[field])`
for numeric channels and `String(row[field])` for string channels.

**Scope**: Tier 1 covers common cases (log scale, normalize, scale by constant). Tier 2 covers
arbitrary transforms. Both are additive — no existing API changes.

### 2.3 Data animations & cross-scene transitions

**Entry animation — bar charts only in V2.1. `mesh.scale.y`, no geometry rebuild.**

Entry animation is scoped to `BarRenderer` in V2.1. Line and area entry animation (a
left-to-right path reveal or segment-by-segment draw-in) requires a clip-mask or
progressive geometry approach that is architecturally distinct from the `scale.y` mechanism
and is not justified by V2.1 scope. Line/area entry animation is deferred to V2.2.

For bar charts, the implementation uses `mesh.scale.y` — not geometry reconstruction.
`BoxGeometry` is built once at full height with the geometry origin anchored at y=0 (not
center, so `geometry.translate(0, barHeight/2, 0)` is applied). During entry animation,
`mesh.scale.y = easeOutCubic(entryT)` where `entryT ∈ [0, 1]`. At `entryT = 1.0` (animation
complete), `scale.y = 1.0` and the bar is at full height. No `BoxGeometry` rebuild occurs
during the animation — this is O(1) per frame regardless of bar count.

**Data flow for `entryT`:**

`IAnimationController.onTick()` runs before `IRenderable.apply()` each frame. The sequence is:

1. `ChartWidget.onTick(ctx: AnimationTickContext)` — `blockProgress` is accessed as
   `ctx.tick?.blockProgress ?? 0` (via `SceneTrackTick`, NOT directly on `AnimationTickContext`).
   `ChartWidget` computes `entryT = Math.min(blockProgress / state.animationDuration, 1.0)` when
   `state.animateEntry === true`. The result is stored as `this.currentEntryT: number` (private field).
   Default `currentEntryT = 1.0` (no animation — geometry at full height).

2. `ChartWidget.apply(state, ctx)` — reads `this.currentEntryT` and passes it to
   `ChartRenderer.update()` via an extended `ChartRenderInput`:
   ```typescript
   export type ChartRenderInput = Omit<ChartState, 'nvsX' | 'nvsY' | 'z'> & {
     readonly position: readonly [number, number, number];
     readonly entryT?: number;  // NEW: 0..1, absent or 1.0 = fully rendered
   };
   ```

3. `ChartRenderer.update(state, widgetId)` — passes `entryT` to `activeRenderer.update(ctx)` via
   `ChartRenderContext`:
   ```typescript
   export type ChartRenderContext = {
     // ... all existing fields unchanged ...
     readonly entryT?: number;  // NEW: present only when animateEntry = true and entryT < 1.0
   };
   ```

4. `BarRenderer.update(ctx)` — if `ctx.entryT !== undefined && ctx.entryT < 1.0`, sets
   `mesh.scale.y = easeOutCubic(ctx.entryT)` on each bar mesh after building/updating geometry.
   When `ctx.entryT` is absent or `1.0`, bar meshes render at `scale.y = 1.0` (default).

**DSL props:**
```typescript
type BaseChartDSL = {
  // ... existing ...
  readonly animateEntry?: boolean;        // default: false
  readonly animationDuration?: number;    // [0..1] fraction of blockProgress. Default: 0.4
};
```

Compiled to:
```typescript
type ChartState = {
  // ... existing ...
  readonly animateEntry: boolean;         // default: false
  readonly animationDuration: number;     // default: 0.4
};
```

**`animateEntry` replay behavior**: entry animation replays on every scene re-entry. `blockProgress`
resets to 0 whenever the user scrolls back to the start of a scene block; `entryT` resets
accordingly. This is consistent with the heatmap time-slice pattern and is the correct behavior
for scroll-driven animation.

**`animationEasing`**: not a V2.1 prop. `easeOutCubic` is hardcoded. Add easing selection in
V2.2 if evidence of consumer demand exists.

**Cross-scene transitions — extend datum morphing to Line and Area:**
- `LineRenderer`: morph point Y positions by interpolating between from- and to-state values
  using `MorphContext`. Point meshes (if `showPoints = true`) and curve geometry both morph.
- `AreaRenderer`: morph area boundary points (upper and lower bounds) similarly.
- `PieRenderer`: morphing arc angles is out of scope for V2.1 (see OQ-2 for rationale).

The `_morphT` / `MorphContext` pipeline is unchanged. Renderers receive it via `ctx.morphCtx`
and add morphing logic internally. No changes to `ChartWidget`, `ChartRenderer`, or `compile.ts`.

**Cross-type morphing (bar → line, etc.)**: remains deferred. Opacity cross-fade is correct and
sufficient. Geometry blending between fundamentally different chart types is not justified by
usage evidence.

### 2.4 Full theme coverage

Three categories of changes to `ChartTheme`:

**Category A — Additions to existing token groups (non-breaking, existing types gain optional fields):**

`ChartLegendTokens` gains:
```typescript
export type ChartLegendTokens = {
  // ... existing fields unchanged ...
  /** Opacity for legend label text [0..1]. Default: 1.0. */
  readonly textOpacity?: number;
};
```

`ChartAxisTokens` gains:
```typescript
export type ChartAxisTokens = {
  // ... existing fields unchanged ...
  /** Font size for axis titles (separate from tick label fontSize). Default: fontSize * 1.1. */
  readonly titleFontSize?: number;
};
```

**Category B — New optional token groups on `ChartTheme`:**

```typescript
/** New optional bar chart defaults. Fallback when DSL barPadding is not specified. */
export type ChartBarTokens = {
  readonly padding: number;            // default barPadding [0..1]. Suggested: 0.2
};

/** New optional area chart defaults. Fallback when DSL fillOpacity is not specified. */
export type ChartAreaTokens = {
  readonly fillOpacity: number;        // default fillOpacity [0..1]. Suggested: 0.7
};

/**
 * Gridlines token group. Replaces the partial ChartBackgroundTokens.gridColor.
 * gridColor on ChartBackgroundTokens is kept for backward compat but deprecated.
 * When ChartGridlinesTokens is present, it takes precedence.
 */
export type ChartGridlinesTokens = {
  readonly color: string;              // gridline color
  readonly opacity: number;            // default 0.15
  readonly visible: boolean;           // default false (gridlines off unless requested)
  /** Dash segment length (world units). Absent = solid line. Requires LineDashedMaterial. */
  readonly dashSize?: number;
  /** Gap between dash segments (world units). Only meaningful when dashSize is set. */
  readonly gapSize?: number;
};

/** Data label theme tokens. Used when <ChartDataLabels> is present in the DSL. */
export type ChartDataLabelsTokens = {
  readonly fontSize: number;
  readonly color: string;
  readonly background?: string;        // optional pill background color (hex)
};

/**
 * Reference line theme tokens.
 * Applied when ReferenceLine.color or lineWidth is not specified in the DSL.
 * Note: lineWidth uses LineDashedMaterial or BoxGeometry depending on renderer;
 * WebGL1 LineBasicMaterial.linewidth is not reliably supported. The architect should
 * choose the implementation approach (thin BoxGeometry is more portable).
 */
export type ChartReferenceLineTokens = {
  readonly defaultColor: string;
  readonly lineWidth: number;          // world-space width of the reference line geometry
  readonly lineOpacity: number;
};

// Updated ChartTheme — all new fields are optional:
export type ChartTheme = {
  // ... all existing fields unchanged ...
  readonly bar?: ChartBarTokens;
  readonly area?: ChartAreaTokens;
  readonly gridlines?: ChartGridlinesTokens;
  readonly dataLabels?: ChartDataLabelsTokens;
  readonly referenceLines?: ChartReferenceLineTokens;
};
```

**Category C — Non-goals (confirmed out of scope):**
- **Tooltip theme tokens**: `ChartTooltipOverlay` is a React HTML/CSS component. WebGL theme
  tokens don't apply. The correct mechanism is CSS custom properties (CSS variables) on the
  overlay's root element. The architect should expose a `--chart-tooltip-*` CSS variable set
  in the component's default styles.
- **Scatter point base radius**: the `sizeScale` DSL prop on `ScatterPlotChart` already provides
  min/max radius control. A theme default for the base radius would duplicate this without adding
  value. Hardcoded `0.08` sphere base radius in `ScatterRenderer` becomes the implicit default.

**All 10 problem-table items are now accounted for:**
- `barPadding` → `ChartBarTokens.padding` ✓
- `fillOpacity` → `ChartAreaTokens.fillOpacity` ✓
- `gridlines` default state → `ChartGridlinesTokens.visible` ✓
- `gridlines` opacity/dash → `ChartGridlinesTokens.opacity`, `dashSize`, `gapSize` ✓
- `dataLabels` tokens → `ChartDataLabelsTokens` ✓
- `referenceLines` color, lineWidth → `ChartReferenceLineTokens.defaultColor`, `lineWidth` ✓
- `legend.textOpacity` → `ChartLegendTokens.textOpacity` ✓
- Axis title font size → `ChartAxisTokens.titleFontSize` ✓
- Scatter point radius → confirmed non-goal ✓
- Tooltip styling → confirmed non-goal (CSS variables) ✓

Update the four built-in themes (darkGlass, neonCyber, enterprise, lightMinimal) to include
the new optional token groups with appropriate defaults.

### 2.5 Chart bounding fix

**Fix A — Pass fitted margins from `computeChartLayout` to `AxesRenderer`:**

Extend `ChartLayout` to include the actual margin values produced by `fitMargins`:
```typescript
export type ChartLayout = {
  readonly plotFrame: ChartFrame;
  readonly legendAnchor: { readonly x: number; readonly y: number } | null;
  /** Actual fitted margins in world units. AxesRenderer uses these — not raw theme values. */
  readonly fittedMargins: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  };
};
```

`computeChartLayout` returns the fitted `[left, right]` and `[bottom, top]` values (already
computed by `fitMargins`) as `fittedMargins`. `ChartRenderer.update()` passes `fittedMargins`
to `AxesRenderer` via `AxisRenderState`. `AxesRenderer.updateTicks()` positions axis titles
relative to the fitted margins:

```typescript
// Y axis title — fits within fitted left margin
obj.position.set(-fittedMargins.left + titlePad, height / 2, AXIS_LABEL_Z_OFFSET);

// X axis title — fits within fitted bottom margin
titleObject.position.set(width / 2, -fittedMargins.bottom + titlePad, AXIS_LABEL_Z_OFFSET);
```

Where `titlePad` is a small positive offset (e.g., `theme.axis.fontSize * 0.5`) to prevent
the title from landing exactly on the boundary. This replaces the current hardcoded
`-tickLen - axisGap - fontSize * 2.5` formula that uses raw theme values regardless of
whether `fitMargins` scaled them down.

The `FittedMargins` type should be defined in `renderers/shared/IChartRenderer.ts` (the shared
type hub for the renderer layer) to avoid creating a dependency from `AxesRenderer` on
`elements/chart/layout.ts`.

**Fix B — Fix ScatterRenderer scale alignment:**

Remove the 10%/90% internal range padding. Use the full `[0, bounds.width]` and
`[0, bounds.height]` ranges for scatter point positioning, and add whitespace via domain
padding instead:
```typescript
const xPad = (xMax - xMin) * 0.05;
const yPad = (yMax - yMin) * 0.05;
const xScale = scaleLinear().domain([xMin - xPad, xMax + xPad]).range([0, bounds.width]);
const yScale = scaleLinear().domain([yMin - yPad, yMax + yPad]).range([0, bounds.height]);
```

The corresponding xTicks must be generated from the same scale:
```typescript
// Ticks aligned with the actual xScale — positions match where points are rendered
const xTickValues = xScale.ticks(6);
const xTicks = xTickValues.map((v) => ({
  value: Math.round(v),
  position: xScale(v) / bounds.width,  // normalized [0..1] position
}));
```

This fixes the 10% misalignment between tick positions and point positions.

**Fix C — Make `minPlotWidth` relative:**
```typescript
// Before:
const minPlotWidth = Math.max(bounds.width * 0.48, 0.8);  // absolute floor removed

// After:
const minPlotWidth = bounds.width * 0.48;
const minPlotHeight = bounds.height * 0.42;
```

**Rationale for 48% minimum**: Under the established theme token ranges (typical axis font size
~0.055 world units, typical left margin ~0.3 world units, typical right margin ~0.04 world units),
combined axis margins consume at most ~34-40% of chart width for a full-label Y axis. The 48%
minimum reserves at least 48% for the plot area — charts cannot have less than 48% of their width
devoted to data geometry. This is a floor derived from the theme range, not an arbitrary constant.

**Edge case acknowledged**: a chart displaying tick values like "10,000,000" (long numeric labels)
may have Y-axis label requirements that exceed 52% of chart width for very small NVS bounds.
In this case, `fitMargins` will correctly scale the margins down (now using the corrected fitted
values in `AxesRenderer`), preventing overflow at the cost of tight label spacing. The consumer
should widen `bounds.width` or use `format` on `<ChartAxis>` to shorten tick labels. A unit test
must verify that `computeChartLayout` returns a `plotFrame` with `width > 0` and `height > 0` for
`bounds = { width: 0.15, height: 0.12 }` at default theme values.

---

## 3. Key Design Decisions

### 3.1 `useLiveChartData` bypasses SceneTrack — is this right?

**Decision: Yes.** The SceneTrack pre-baking model is the correct design for deterministic
playback. Reactive data is an orthogonal concern. The live data hook is a React runtime
integration that updates the `ChartDataStore` directly, similar to how `ChartProvider` works.
The SceneTrack still contains the initial snapshot. The live hook replaces that snapshot
at runtime, after the SceneTrack is built.

**Alternative considered**: Recompile the SceneTrack on data changes. Rejected — too expensive,
defeats the purpose of pre-baking, breaks mid-scroll playback.

### 3.2 `useLiveChartData` only works for inline data sources

**Decision**: `useLiveChartData` is scoped to charts whose SceneTrack-compiled `dataSource.type`
is `'inline'`. It does NOT override named or async sources. This is deliberate: the named source
path (`ChartProvider` + `ChartDataStore.register()`) already supports full reactive updates
and is the correct mechanism for shared, cross-chart, or large datasets. `useLiveChartData` is
a convenience wrapper for the simpler "single chart, locally-managed data" use case.

Mixing `useLiveChartData` with `<ChartData source="...">` on the same chart ID has no effect —
`ChartWidget.apply()` routes to the named store key when `state.dataSource.type === 'named'`,
and `hasLiveOverride()` is only consulted in the `'inline'` branch.

### 3.3 `useLiveChartData` cleanup on unmount

**Decision**: On unmount, `useLiveChartData` calls `store.deregisterInline(widgetId)`, which
removes both the data entry (`__inline__${widgetId}`) and the override flag from the store.
On the next `apply()`, `ChartWidget` re-registers the SceneTrack-baked rows as in V2.0
(the reference-equality guard will fire on that first post-unmount frame since
`this.lastInlineRowsRef` no longer matches the store's cleared state).

This ensures no ghost data or stale override flags remain after the live-data hook unmounts.

### 3.4 `hasLiveOverride()` on `ChartDataStore` — is this the right abstraction?

**Decision: Yes.** The store already owns all data registration. Adding a `hasLiveOverride(widgetId)`
check is a thin addition that keeps `ChartWidget.apply()` from overwriting live-hook registrations.

**Alternative considered**: A separate `LiveDataRegistry` held on `ChartPluginInstance`.
Rejected — it duplicates registration state that the store already tracks.

### 3.5 `compute` transform — should it support arbitrary JS expressions?

**Decision: No.** Arbitrary expression evaluation (even sandboxed) creates security and complexity
concerns. The named built-in operations (`log`, `sqrt`, `normalize`, `scale`, `add`) cover the
vast majority of axis-mapping scenarios. Function-based accessors (Tier 2) are the escape hatch
for arbitrary logic, and they require explicit consumer code — not embedded string expressions.

### 3.6 Entry animation uses `mesh.scale.y`, not geometry rebuild

**Decision**: `mesh.scale.y` is the sole mechanism for entry animation. `BoxGeometry` is built
once at full height with origin anchored at y=0. No `BoxGeometry` rebuild during animation.
This is O(1) per frame — cost is independent of bar count. The geometry anchoring requirement
(`geometry.translate(0, barHeight/2, 0)`) is a confirmed implementation detail for the architect.

### 3.7 Entry animation driven by `blockProgress` (via `ctx.tick?.blockProgress`)

**Decision**: `blockProgress` is accessed as `ctx.tick?.blockProgress ?? 0` inside
`ChartWidget.onTick()`. This is verified against the codebase: `AnimationTickContext` does NOT
have a direct `blockProgress` field. `blockProgress` lives on `SceneTrackTick` and is accessible
via `ctx.tick.blockProgress`. The existing heatmap animation code already accesses it this way.
No changes to `AnimationTickContext` or the core runtime are required for entry animation.

**Decision: `blockProgress` over wall time.** `blockProgress` is the canonical progress signal.
Wall-time animation would be inconsistent with heatmap animation, would break scrubbing (scrolling
backward should reverse the animation), and would produce non-deterministic behavior. `blockProgress`
makes animation deterministic and testable.

### 3.8 Extend `ChartLayout` with `fittedMargins`

**Decision**: `ChartLayout` is extended with `fittedMargins` (values already computed by
`fitMargins`, previously discarded after use). `AxesRenderer` uses these values for all axis
decoration positioning. The `FittedMargins` type is defined in `renderers/shared/IChartRenderer.ts`
to avoid circular dependencies.

### 3.9 New theme fields are optional with renderer fallback defaults

**Decision: Optional.** Making new fields required would break all existing `createChartTheme()`
callers. Renderer fallback defaults (matching current hardcoded behavior) are specified for each
new field. The four built-in themes are updated to include explicit values for documentation clarity.

---

## 4. Open Questions

### OQ-1: `useLiveChartData` signature — plugin instance or store directly?

Current proposal passes the `ChartPluginInstance`:
```typescript
useLiveChartData(chartsPlugin, 'chart-id', data)
```

Alternative: expose the store directly:
```typescript
useLiveChartData(chartsPlugin.store, 'chart-id', data)
```

`ChartPluginInstance.store` is already a public stable property on the type. Passing it directly
avoids the hook needing to call an accessor. But passing the full plugin instance is consistent
with `ChartProvider` (which also receives `chartsPlugin`).

**PM leans toward**: pass `chartsPlugin`. Consistency with `ChartProvider` is more valuable than
saving one property access. The architect should make the final call.

### OQ-2: Which renderers implement `MorphContext` morphing in V2.1?

V2.0 implements morphing in `BarRenderer` and `ScatterRenderer`. V2.1 proposes extending to
`LineRenderer` and `AreaRenderer`.

**Resolved: PieRenderer morphing is deferred to V2.2.** Morphing between pie slices requires
interpolating both start and end angles of each arc, matched by `keyField`. The `d3-shape`
`arc` generator produces SVG path data, not geometry coordinates — the Three.js `ExtrudeGeometry`
would need to be rebuilt for each morph frame, negating the performance model. The complexity
is not justified by V2.1 usage evidence. Pie morphing should be scoped as a separate feature
with its own plan.

### OQ-3: `FittedMargins` type placement — `IChartRenderer.ts` or `layout.ts`?

**Proposed resolution**: Define `FittedMargins` in `renderers/shared/IChartRenderer.ts`.
`computeChartLayout` (in `elements/chart/layout.ts`) imports `FittedMargins` from there.
`AxesRenderer` also imports from there. No circular dependency.

The architect should verify this doesn't create an import direction violation (renderers →
elements). If `layout.ts` importing from `renderers/shared/` is a direction violation,
`FittedMargins` should instead live in a new `elements/chart/layoutTypes.ts` file that
both `layout.ts` and `AxesRenderer` can import from.

### OQ-4: `ChartAxisTokens.titleFontSize` — theme token or DSL override?

Adding `titleFontSize?: number` to `ChartAxisTokens` is the proposed mechanism for independent
axis title vs. tick label font size control. The architect should verify that `AxesRenderer`
can read this from the theme passed in `ChartRenderContext` without touching the `ChartAxisState`
type or DSL. If the current `AxesRenderer.updateTicks()` signature already accepts the full
`ChartTheme`, this is straightforward.

---

## 5. Constraints & Risks

### SceneTrack serialization constraint
No function references can live in `ChartState`. `useLiveChartData`, `useChartAccessors`, and
`compute` transforms all respect this: function references live in React/plugin memory; the
SceneTrack holds only serializable keys or descriptors.

### Reference-equality behavior of React state
`useLiveChartData` must use `Object.is(prevData, nextData)` as the change signal. A naive
implementation that calls `normalizeDataInput(rows)` on every render cycle would produce a new
array reference each time, triggering unnecessary store writes every frame. The hook must capture
the `rows` reference identity in its `useEffect` dependency array, not a derived value.

### `compute` transform: exhaustive pattern-match sites
`DataTransform` union gains a new `'compute'` member. Every exhaustive switch on
`DataTransform.type` — including `applyTransforms`, the `transforms.test.ts` suite, and any
codec or serialization layer — must be updated. The architect must enumerate these sites.

### `mesh.scale.y` bar anchoring
`BoxGeometry` centers geometry at the origin by default. For bars to grow from y=0 (floor),
the geometry must be anchored at y=0. This requires `geometry.translate(0, height/2, 0)` or
an equivalent origin shift. This must be applied at geometry creation time, not at runtime.
Existing `BarRenderer` bar geometry creation must be updated. Any existing tests that assert
on bar mesh `position.y` values will need to be updated to account for the new geometry origin.

### `ChartGridlinesTokens.dashSize` and WebGL line width limitations
Dashed lines in Three.js require `LineDashedMaterial` and `line.computeLineDistances()`.
`LineBasicMaterial` (currently used by `AxesRenderer`) does not support dashing.
`LineDashedMaterial.linewidth` has the same WebGL1 limitation as `LineBasicMaterial.linewidth`
(capped at 1px in most WebGL1 contexts). The architect should note this limitation in the plan
and consider using a thin `BoxGeometry` plane for dashed reference lines as a portable alternative.
For gridlines specifically, `LineDashedMaterial` is acceptable since gridlines are decorative.

### `useLiveChartData` deregister race condition
If the component unmounts in the same React commit as a new data update (edge case), the deregister
call and the prior `registerInline` call may interleave with a pending `apply()`. The architect
should ensure `deregisterInline()` is atomic with respect to `apply()` — no partial state.
Since JavaScript is single-threaded, this is guaranteed as long as `apply()` does not yield
(it does not — it's synchronous). The risk is low but should be verified.

### `minPlotWidth = 0.48` floor — edge cases for long labels
Removing the 0.8 absolute floor means a chart with `bounds.width` of 0.15 NVS has a minimum plot
width of `0.15 * visibleWorldWidth * 0.48` world units. For the target camera configuration
(FOV=42, distance≈6.6), `visibleWorldWidth ≈ 9.0`, so `0.15 * 9.0 * 0.48 ≈ 0.65` world units.
If the Y axis needs 0.35 world units and the right margin needs 0.04, total margins = 0.39 →
plot = 0.26, which is above 0.65 * 0.48 = 0.31... wait, the floor is 0.48 of `bounds.width`
(in world units = `0.15 * 9.0 = 1.35`), so minimum plot width = `1.35 * 0.48 = 0.65`. Margins
= 0.39, so `1.35 - 0.39 = 0.96` — fits easily. The 48% floor only kicks in when margins
would consume more than 52% of `worldW`. A unit test should cover the narrow-chart case.

---

## Summary: Scope for V2.1

| Feature | Priority | Complexity |
|---|---|---|
| `useLiveChartData` hook + `ChartDataStore` additions | High | Medium |
| `compute` transform | Medium | Low |
| `useChartAccessors` registry | Medium | Medium |
| Entry animation — bar charts only (`mesh.scale.y`, line/area deferred to V2.2) | High | Medium |
| Extended MorphContext to Line/Area | Medium | Medium |
| New theme token groups (bar, area, gridlines, dataLabels, referenceLines) | High | Low |
| `ChartLegendTokens.textOpacity`, `ChartAxisTokens.titleFontSize` | High | Low |
| Bounding fix — fitted margins in `ChartLayout` + `AxesRenderer` | High (correctness) | Low |
| Bounding fix — ScatterRenderer scale/tick alignment | High (correctness) | Low |
| Bounding fix — remove absolute `0.8` floor | High (correctness) | Low |
