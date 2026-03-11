---
title: "@brewsite/charts V1 Plan — Amendment 1 (PM Review Response)"
doc_type: plan
owner: Toolkit Architect
status: active
updated: 2026-03-01
---

# @brewsite/charts — Plan Amendment 1

**Supersedes specific sections of:** `plan_charts_package_v1.md`
**All other sections of the original plan remain in effect.**

This amendment addresses all five issues flagged in the PM review. Each section
states the PM's claim, the verified codebase reality, and the revised specification.

---

## Blocker 1 — Global `chartDataStore` Singleton

**PM finding:** `export const chartDataStore = new ChartDataStore()` is a module-level
singleton. Two scenes on the same page share one store. Tests leak state across cases.

**Fix status:** ✅ Correct finding. Fix required.

### Verified pattern

`VariableStore` in core is instantiated per-engine, not globally. `WidgetPlugin.wrapProvider`
is the established mechanism for injecting per-engine React context. `WidgetPlugin.configureRegistry`
is the mechanism for passing per-engine dependencies to widget instances.

### Revised architecture

`chartPlugin()` owns the `ChartDataStore` instance. One call to `chartPlugin()` → one store.
Two engines → two `chartPlugin()` calls → two isolated stores. Tests → fresh `new ChartDataStore()`
per test case.

The store reference is distributed via two channels:
1. **To `ChartWidget` instances**: injected via the constructor, captured by the `Chart` NodeHandler
   closure inside `configureRegistry`.
2. **To React components** (`ChartProvider`, `useChartData`, `useChartFilter`): exposed via
   `ChartStoreContext`, provided by `chartPlugin`'s `wrapProvider`.

### Revised `chartPlugin.ts` signature

```ts
// packages/charts/src/player/chartPlugin.ts

import type { ReactNode } from 'react';
import type { WidgetPlugin } from '@brewsite/core';
import { registerNode } from '@brewsite/core';
import { ChartDataStore } from '../data/ChartDataStore';
import { ChartStoreContext } from '../data/ChartStoreContext';
import { ChartWidget } from '../elements/chart/ChartWidget';
import { Chart, ChartData, ChartAxis, ChartSeries, ChartLegend } from '../elements/chart/dsl';
import { compileChart } from '../elements/chart/compile';
import type { ChartDSL, ChartDataDSL, ChartAxisDSL, ChartSeriesDSL } from '../elements/chart/types';

/**
 * WidgetPlugin for @brewsite/charts.
 *
 * - Creates a ChartDataStore scoped to this plugin instance (no global singleton).
 * - Provides the store via ChartStoreContext (wrapProvider) so hooks can read it.
 * - Auto-creates ChartWidget instances on first DSL encounter (type-factory DX).
 * - No `charts` array required — just add <Chart id="..."> to the scene DSL.
 *
 * The `store` property is exposed so ChartProvider can register data into it:
 *
 * @example
 * const plugin = useMemo(() => chartPlugin(), []);
 *
 * <EngineProvider plugins={[corePlugin(), plugin]}>
 *   <ChartProvider plugin={plugin} data={{ 'revenue': rows }}>
 *     <ScenePlayer getFrame={...} />
 *   </ChartProvider>
 * </EngineProvider>
 */
export type ChartPluginInstance = WidgetPlugin & {
  /** The ChartDataStore owned by this plugin instance. */
  readonly store: ChartDataStore;
};

export function chartPlugin(): ChartPluginInstance {
  const store = new ChartDataStore();

  return {
    store,

    createWidgets: () => [],

    /**
     * Registers child DSL components as top-level error guards.
     * The <Chart> NodeHandler itself is installed in configureRegistry (needs
     * registry access for auto-widget-creation).
     */
    registerHandlers: () => {
      registerNode(ChartData, () => {
        throw new Error('<ChartData> must be nested inside <Chart>.');
      });
      registerNode(ChartAxis, () => {
        throw new Error('<ChartAxis> must be nested inside <Chart>.');
      });
      registerNode(ChartSeries, () => {
        throw new Error('<ChartSeries> must be nested inside <Chart>.');
      });
      registerNode(ChartLegend, () => {
        throw new Error('<ChartLegend> must be nested inside <Chart>.');
      });
    },

    /**
     * Installs the <Chart> NodeHandler with auto-widget-creation and child DSL
     * compilation. Called after createWidgets(), with the live WidgetRegistry.
     *
     * registerNode() is idempotent (last writer wins). This call overrides
     * any earlier guard handler for Chart if one was accidentally installed.
     */
    configureRegistry: (registry) => {
      registerNode(Chart, (node, api, helpers) => {
        const props = node.props as Record<string, unknown>;
        const chartId = props['id'] as string | undefined;
        if (!chartId) {
          throw new Error('<Chart> requires a string "id" prop.');
        }

        // Auto-create and register ChartWidget on first encounter.
        // Idempotent: registry.get() returns the existing widget if already registered.
        if (!registry.get(chartId)) {
          registry.register(new ChartWidget(chartId, store));
        }

        // Extract child DSL nodes.
        const children = helpers.collectChildren(node);
        let dataDsl: ChartDataDSL | null = null;
        const axisDsls: ChartAxisDSL[] = [];
        const seriesDsls: ChartSeriesDSL[] = [];
        let legendDsl: { visible?: boolean; position?: string } | null = null;

        for (const child of children) {
          if (!child || typeof child !== 'object') continue;
          const el = child as { type: unknown; props: Record<string, unknown> };
          if (el.type === ChartData)   { dataDsl  = el.props as ChartDataDSL; }
          else if (el.type === ChartAxis)   { axisDsls.push(el.props as ChartAxisDSL); }
          else if (el.type === ChartSeries) { seriesDsls.push(el.props as ChartSeriesDSL); }
          else if (el.type === ChartLegend) { legendDsl = el.props as { visible?: boolean; position?: string }; }
        }

        const chartState = compileChart(
          props as ChartDSL,
          dataDsl,
          axisDsls,
          seriesDsls,
          legendDsl,
        );

        api.setWidgetState(chartId, chartState);
      });
    },

    /**
     * Provides ChartStoreContext inside EngineProvider so hooks (useChartData,
     * useChartFilter) and ChartProvider can read the store instance.
     */
    wrapProvider: (children: ReactNode): ReactNode => (
      <ChartStoreContext.Provider value={store}>
        {children}
      </ChartStoreContext.Provider>
    ),
  };
}
```

### New file: `data/ChartStoreContext.tsx`

```tsx
// packages/charts/src/data/ChartStoreContext.tsx
// Provides the per-engine ChartDataStore via React context.

import { createContext, useContext } from 'react';
import type { ChartDataStore } from './ChartDataStore';

export const ChartStoreContext = createContext<ChartDataStore | null>(null);

export function useChartStore(): ChartDataStore {
  const store = useContext(ChartStoreContext);
  if (!store) {
    throw new Error(
      '[ChartStoreContext] No ChartDataStore found. ' +
      'Ensure chartPlugin() is included in EngineProvider plugins.',
    );
  }
  return store;
}
```

### Revised `player/ChartProvider.tsx`

`ChartProvider` is now placed INSIDE `EngineProvider` (because `ChartStoreContext` is
provided by `chartPlugin`'s `wrapProvider` which wraps the EngineProvider subtree).
It accepts `plugin` to get the store reference, OR reads from `ChartStoreContext`:

```tsx
// packages/charts/src/player/ChartProvider.tsx

import { type ReactNode, useEffect } from 'react';
import { useChartStore } from '../data/ChartStoreContext';

export type ChartProviderProps = {
  /**
   * Named data sources. Keys = source names referenced in <ChartData source="...">.
   * Values = arrays of plain row objects.
   *
   * ChartProvider must be placed inside EngineProvider (which is inside the
   * ChartStoreContext provided by chartPlugin's wrapProvider).
   */
  data: Readonly<Record<string, ReadonlyArray<Record<string, unknown>>>>;
  children: ReactNode;
};

/**
 * Registers named data sources with the per-engine ChartDataStore.
 *
 * IMPORTANT: Must be placed inside EngineProvider, not outside it:
 *
 * @example
 * const plugin = useMemo(() => chartPlugin(), []);
 *
 * // ✅ Correct — ChartProvider is inside EngineProvider
 * <EngineProvider plugins={[corePlugin(), plugin]}>
 *   <ChartProvider data={{ 'revenue': rows }}>
 *     <ScenePlayer getFrame={...} />
 *   </ChartProvider>
 * </EngineProvider>
 *
 * // ❌ Wrong — ChartProvider outside EngineProvider can't reach ChartStoreContext
 * <ChartProvider data={...}>
 *   <EngineProvider ...>...</EngineProvider>
 * </ChartProvider>
 */
export function ChartProvider({ data, children }: ChartProviderProps): ReactNode {
  const store = useChartStore();

  useEffect(() => {
    for (const [name, rows] of Object.entries(data)) {
      store.register(name, rows);
    }
    return () => {
      for (const name of Object.keys(data)) {
        store.unregister(name);
      }
    };
  }, [store, data]);

  return <>{children}</>;
}
```

### `ChartDataStore` — add `unregister` method

```ts
/** Remove a named data source. Called by ChartProvider on unmount. */
unregister(name: string): void {
  this.sources.delete(name);
}
```

### `ChartWidget` constructor — store injection

```ts
constructor(widgetId: string, store: ChartDataStore) {
  this.widgetId = widgetId;
  this.store = store;
  this.renderer = new ChartRenderer(store);
}
```

`ChartRenderer` also receives `store` in its constructor — it calls
`store.resolve(state.dataSource, state.transforms)` in `update()`.

### Test isolation — revised test setup

```ts
// In each test file that tests ChartDataStore-dependent code:
import { ChartDataStore } from '../ChartDataStore';

describe('ChartWidget apply()', () => {
  let store: ChartDataStore;

  beforeEach(() => {
    store = new ChartDataStore(); // fresh per test — no leakage
    store.register('revenue', rows);
  });

  it('updates chart geometry from resolved data', () => {
    const widget = new ChartWidget('test-chart', store);
    // ...
  });
});
```

### Files added/modified relative to original plan

| File | Change |
|---|---|
| `data/ChartStoreContext.tsx` | **New** — replaces `ChartFilterContext.tsx` for store distribution |
| `data/ChartDataStore.ts` | Add `unregister(name)` method; remove `clear()` from global export usage |
| `player/chartPlugin.ts` | Wholesale replacement — see above |
| `player/ChartProvider.tsx` | Reads from `ChartStoreContext`; must be inside `EngineProvider` |
| `elements/chart/ChartWidget.ts` | Constructor gains `store: ChartDataStore` parameter |
| `elements/chart/render.ts` | `ChartRenderer` constructor gains `store: ChartDataStore` parameter |

---

## Blocker 2 — Unserializable `FilterTransform.test` Function

**PM finding:** `FilterTransform.test: (row) => boolean` is a runtime closure baked into
`ChartState.transforms` which lives in `SceneTrackTick.state.widgets`. Functions cannot
be serialized, diffed, or cached.

**Fix status:** ✅ Correct finding. Fix required. PM recommendation adopted.

### Revised `data/types.ts` — FilterTransform

**Remove:**
```ts
export type FilterTransform = {
  readonly type: 'filter';
  readonly test: (row: Record<string, unknown>) => boolean;  // ← not serializable
};
```

**Replace with:**
```ts
/**
 * Comparison operators for serializable filter predicates.
 * All operators are data — no closures, no function references.
 */
export type FilterOp =
  | 'eq'   // value equals field value (===)
  | 'neq'  // value does not equal field value (!==)
  | 'gt'   // field value > value (numeric)
  | 'gte'  // field value >= value (numeric)
  | 'lt'   // field value < value (numeric)
  | 'lte'  // field value <= value (numeric)
  | 'in';  // field value is in the value array

/**
 * Serializable filter predicate. No function references.
 * If a consumer needs arbitrary filter logic, apply it before registering
 * the data with ChartProvider — do not put arbitrary predicates in the DSL.
 */
export type FilterTransform = {
  readonly type: 'filter';
  readonly field: string;
  readonly op: FilterOp;
  /**
   * The comparison value. For 'in' operator, must be an array.
   * For all other operators, must be a scalar (string | number | boolean).
   */
  readonly value: string | number | boolean | ReadonlyArray<string | number | boolean>;
};
```

### Revised `data/transforms.ts` — `applyFilter`

```ts
export function applyFilter(
  rows: ReadonlyArray<Record<string, unknown>>,
  transform: FilterTransform,
): ReadonlyArray<Record<string, unknown>> {
  return rows.filter((row) => evaluateFilterOp(row[transform.field], transform.op, transform.value));
}

function evaluateFilterOp(
  fieldValue: unknown,
  op: FilterOp,
  compareValue: FilterTransform['value'],
): boolean {
  switch (op) {
    case 'eq':  return fieldValue === compareValue;
    case 'neq': return fieldValue !== compareValue;
    case 'gt':  return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue > compareValue;
    case 'gte': return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue >= compareValue;
    case 'lt':  return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue < compareValue;
    case 'lte': return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue <= compareValue;
    case 'in':  return Array.isArray(compareValue) && (compareValue as ReadonlyArray<unknown>).includes(fieldValue);
    default:    return false;
  }
}
```

### DSL surface — how consumers filter with complex logic

If a consumer needs arbitrary predicate logic (e.g., multi-field regex, date range with
computed boundaries), that logic runs **before** `ChartProvider`, in the data preparation
step. The registered data is already filtered:

```tsx
// Pre-filter in data preparation — NOT in the DSL transform pipeline
const apacRows = allRows.filter((d) => d.region === 'APAC' && d.year === 2025);

<ChartProvider data={{ 'apac-2025': apacRows }}>
  <ChartData source="apac-2025" />
</ChartProvider>
```

For declarative scene-time filtering (e.g., the chart's filter state changes across
scenes), the serializable `FilterTransform` operators are sufficient for the vast
majority of presentation data scenarios (category equality, value range, set membership).

---

## Blocker 3 — Registration Pattern Clarification

**PM finding:** "`@brewsite/core` does not export `registerNode`. Use `CUSTOM_NODE_HANDLER`."

**Codebase verification result:** The PM's premise is **incorrect on both counts.**

**`registerNode` IS exported from `@brewsite/core`** — verified in `packages/core/src/index.ts`:
```ts
export { registerNode } from './compiler/registry';
```

**`CUSTOM_NODE_HANDLER` is NOT in the public API** — `packages/core/src/widget/index.ts`
does not export it. It is re-exported from `packages/core/src/elements/camera/index.ts`
as a camera-module-specific export, but is not part of the general `@brewsite/core` surface.
External packages (`@brewsite/diagram`, `@brewsite/model`) use deep internal paths
(`@brewsite/core/compiler/registry`, `@brewsite/core/widget/WidgetRegistry`) to access
it — paths that are valid within the monorepo but are not part of the published public API.

**The original plan's `import { registerNode } from '@brewsite/core'` was correct.**

### Correct pattern for `@brewsite/charts`

The **diagram package pattern** is the established pattern for external packages that
have complex child DSL. `@brewsite/diagram/src/compiler/handlers.ts` uses:

```ts
import { registerNode } from '@brewsite/core';
registerNode(Diagram, (node, api, helpers) => {
  // full child DSL extraction and compilation here
  // compiles DiagramNode, DiagramEdge, DiagramGroup children
});
```

This is identical to what `@brewsite/charts` needs. The chart handler additionally
auto-creates widget instances using `registry` from `configureRegistry` — this is
the DX improvement that addresses Medium 1 simultaneously.

The revised `chartPlugin.ts` in Blocker 1's fix above implements the correct pattern:
- `registerHandlers()`: registers child guards (ChartData, etc.) via `registerNode`
- `configureRegistry(registry)`: registers the Chart NodeHandler via `registerNode`, with
  the registry available for auto-widget-creation

**No `CUSTOM_NODE_HANDLER` is used. No deep internal path imports are used.**

### Why `registerTypeFactory` is not used for charts

`WidgetRegistry.registerTypeFactory()` (used by the model package) installs a NodeHandler
that calls `CUSTOM_NODE_HANDLER` on the widget instance to dispatch child DSL. Since
`CUSTOM_NODE_HANDLER` is not in the public API, external packages cannot set it on
their widget instances. Using `registerTypeFactory` without `CUSTOM_NODE_HANDLER` would
silently fall through to the default prop-merge, losing all child DSL (ChartData, ChartAxis,
ChartSeries, ChartLegend). This is why `registerNode` with a full handler is the right
approach — it is the same pattern the diagram package uses.

---

## Medium 1 — Type-Factory DX (No Pre-Registration Required)

**PM finding:** `chartPlugin({ charts: [{ id: 'revenue-chart' }] })` is a DX regression
vs. the type-factory pattern. Consumers should not need to enumerate chart IDs upfront.

**Fix status:** ✅ Addressed by the Blocker 1 + Blocker 3 fix above.

The revised `chartPlugin()` takes no arguments. The `Chart` NodeHandler (installed in
`configureRegistry`) auto-creates and registers a `ChartWidget` on the first compilation
encounter with a given `id`. Consumers only need:

```tsx
const plugin = useMemo(() => chartPlugin(), []);

<EngineProvider plugins={[corePlugin(), plugin]}>
  <ChartProvider data={{ 'revenue': rows }}>
    <ScenePlayer getFrame={() => (
      <Scene>
        {/* Widget auto-created on first compile — no pre-registration needed */}
        <Chart id="revenue-chart" type="bar" theme="darkGlass">
          <ChartData source="revenue" xField="quarter" yField="revenue" />
          <ChartAxis axis="x" label="Quarter" />
          <ChartAxis axis="y" label="Revenue ($)" format="$,.0f" />
        </Chart>
      </Scene>
    )} />
  </ChartProvider>
</EngineProvider>
```

Adding a new `<Chart id="trend-chart">` to a scene requires zero changes to plugin
setup.

---

## Medium 2 — Multi-Series Charts: ChartSeries DSL + State Field

**PM finding:** `ChartState` has no `series` field. Multi-series charts have no DSL path.
`ChartSeriesState` is orphaned. The plan must either add `<ChartSeries>` or explicitly
scope V1 to single-series only.

**Fix status:** ✅ Add `<ChartSeries>` and `series: readonly ChartSeriesState[]` to V1.

### Revised `elements/chart/types.ts` — additions

```ts
/** DSL for declaring one data series within a chart. */
export type ChartSeriesDSL = {
  /** The data field providing Y values (or radius for pie, size for bubble). */
  readonly field: string;
  /** Human-readable series label shown in legend. */
  readonly label?: string;
  /** Optional field encoding point size (scatter/bubble only). */
  readonly sizeField?: string;
  /** Optional field encoding per-point color (scatter/heatmap only). */
  readonly colorField?: string;
};

/** Compiled state for a single data series. Stored in SceneTrack. */
export type ChartSeriesState = {
  readonly field: string;
  readonly label: string;
  readonly sizeField?: string;
  readonly colorField?: string;
};
```

**Add `series` to `ChartState`:**
```ts
export type ChartState = {
  // ... (all existing fields) ...

  /**
   * Data series declarations.
   * When empty: renderers derive a single series from yAxis.field (backward compat).
   * When populated: renderers render one series per entry (grouped bar, multi-line, etc.).
   */
  readonly series: readonly ChartSeriesState[];
};

export const DEFAULT_CHART_STATE: ChartState = {
  // ... existing fields ...
  series: [],
  opacity: 1,  // see Minor 2 fix below
};
```

### New DSL component: `ChartSeries`

**Add to `elements/chart/dsl.tsx`:**

```tsx
export type ChartSeriesProps = ChartSeriesDSL;

/** Series declaration for multi-series charts. Child of Chart. */
export function ChartSeries(_props: ChartSeriesProps): null { return null; }
ChartSeries.displayName = 'ChartSeries';
```

### Updated `compileChart` signature

```ts
export function compileChart(
  dsl: ChartDSL,
  dataDsl: ChartDataDSL | null,
  axisDsls: readonly ChartAxisDSL[],
  seriesDsls: readonly ChartSeriesDSL[],   // ← new parameter
  legendDsl: { visible?: boolean; position?: string } | null,
): ChartState;
```

Series compilation:
```ts
const series: ChartSeriesState[] = seriesDsls.map((s) => ({
  field: s.field,
  label: s.label ?? s.field,
  sizeField: s.sizeField,
  colorField: s.colorField,
}));
```

### Update `ChartWidget.childDslComponents`

```ts
readonly childDslComponents: IDslComposite['childDslComponents'] = [
  { component: ChartData   as React.ComponentType<unknown>, displayName: 'ChartData' },
  { component: ChartAxis   as React.ComponentType<unknown>, displayName: 'ChartAxis' },
  { component: ChartSeries as React.ComponentType<unknown>, displayName: 'ChartSeries' },
  { component: ChartLegend as React.ComponentType<unknown>, displayName: 'ChartLegend' },
];
```

### Renderer backward compatibility

Each chart-type renderer checks `state.series`:
```ts
// In each renderer's update():
const effectiveSeries: readonly ChartSeriesState[] =
  state.series.length > 0
    ? state.series
    : state.yAxis
    ? [{ field: state.yAxis.field, label: state.yAxis.label ?? state.yAxis.field }]
    : [];

if (effectiveSeries.length === 0) {
  console.warn(`[ChartRenderer] Chart "${widgetId}" has no series to render.`);
  return;
}
```

### Multi-series DSL usage example

**Grouped bar chart — three series:**
```tsx
<Chart id="revenue-by-region" type="bar" theme="darkGlass">
  <ChartData source="revenue" xField="quarter" />
  <ChartSeries field="apac_revenue"     label="APAC" />
  <ChartSeries field="emea_revenue"     label="EMEA" />
  <ChartSeries field="americas_revenue" label="Americas" />
  <ChartAxis axis="x" label="Quarter" />
  <ChartAxis axis="y" label="Revenue ($)" format="$,.0f" />
  <ChartLegend />
</Chart>
```

**Multi-line chart:**
```tsx
<Chart id="trend-lines" type="line" theme="neonCyber">
  <ChartData source="metrics" xField="date" />
  <ChartSeries field="signups"    label="Sign-ups" />
  <ChartSeries field="activations" label="Activations" />
  <ChartAxis axis="x" label="Date" format="%b %Y" />
  <ChartAxis axis="y" label="Count" format=",.0f" />
</Chart>
```

### `index.ts` update

Export the new component and type:
```ts
export { Chart, ChartData, ChartAxis, ChartSeries, ChartLegend } from './elements/chart/dsl';
export type { ChartSeriesProps, ChartSeriesDSL } from './elements/chart/dsl';
export type { ChartSeriesState } from './elements/chart/types';
```

---

## Minor 1 — `blendOpacity` and `blendVec3` Exports

**PM finding:** Verify these are exported from `@brewsite/core` before Phase 6 typechecks.

**Verification:** Both confirmed exported in `packages/core/src/index.ts`:
```ts
export { blendNumber, blendOpacity, blendVec3, blendColor, transitionT }
  from './compiler/transitions/transitionTypes';
```

**No plan change required.** The original plan's imports are correct.

---

## Minor 2 — `DEFAULT_CHART_STATE.opacity = 0` Makes Charts Invisible

**PM finding:** In a single-scene demo with no transitions, `opacity: 0` means the chart
never becomes visible. Change the default to `1`.

**Fix status:** ✅ Change required.

### Revised `DEFAULT_CHART_STATE`

```ts
export const DEFAULT_CHART_STATE: ChartState = {
  type: 'bar',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  bounds: { width: 4, height: 3, depth: 0.5 },
  dataSource: '',
  transforms: [],
  filterGroup: undefined,
  xAxis: null,
  yAxis: null,
  series: [],
  legend: null,
  theme: 'darkGlass',
  opacity: 1,           // ← changed from 0 to 1
  interactive: false,
};
```

**How transitions still work correctly:**

`functionalChartTransitionSpec`:
- `exitFn`: animates opacity from the chart's current state opacity → 0
- `enterFn`: animates opacity from 0 → the chart's declared state opacity
- `interpolateFn`: blends opacity between adjacent scene declarations

`DEFAULT_CHART_STATE` is used as the fallback when a chart widget is absent from a
scene (e.g. scene 1 has no `<Chart id="revenue">` but scene 2 does). In that case the
default state `opacity: 1` provides the base for the `enterFn` to animate from. The
`enterFn` starts at `t=0 → opacity: 0` (widget absent) and reaches `t=1 → opacity: 1`
(the declared state).

In a single-scene demo with no transitions, the chart renders at full opacity immediately.
This is the correct behavior.

---

## Updated File Checklist Delta

The following files are added or changed relative to the original Phase checklist:

### New files
- [ ] `packages/charts/src/data/ChartStoreContext.tsx` ← replaces `ChartFilterContext.tsx`

### Modified files (specification changes)
- [ ] `packages/charts/src/data/types.ts` — `FilterTransform` uses `field/op/value`, add `FilterOp`
- [ ] `packages/charts/src/data/transforms.ts` — `applyFilter` evaluates structural predicates
- [ ] `packages/charts/src/data/ChartDataStore.ts` — add `unregister(name)` method; no global export
- [ ] `packages/charts/src/data/useChartData.ts` — reads `ChartStoreContext` not `ChartFilterContext`
- [ ] `packages/charts/src/data/useChartFilter.ts` — reads `ChartStoreContext` not `ChartFilterContext`
- [ ] `packages/charts/src/elements/chart/types.ts` — add `ChartSeriesDSL`, `ChartSeriesState`; add `series: readonly ChartSeriesState[]` to `ChartState`; `DEFAULT_CHART_STATE.opacity = 1`
- [ ] `packages/charts/src/elements/chart/dsl.tsx` — add `ChartSeries`, `ChartSeriesProps`
- [ ] `packages/charts/src/elements/chart/compile.ts` — `compileChart()` gains `seriesDsls` parameter; compiles to `state.series`
- [ ] `packages/charts/src/elements/chart/ChartWidget.ts` — constructor: `(widgetId: string, store: ChartDataStore)`; `childDslComponents` includes `ChartSeries`
- [ ] `packages/charts/src/elements/chart/render.ts` — `ChartRenderer` constructor: `(store: ChartDataStore)`; `effectiveSeries` backward-compat logic
- [ ] `packages/charts/src/compiler/handlers.ts` — remove Chart NodeHandler (moved to `chartPlugin.configureRegistry`); keep child guards for top-level error messages as fallback
- [ ] `packages/charts/src/player/chartPlugin.ts` — wholesale replacement per Blocker 1 fix
- [ ] `packages/charts/src/player/ChartProvider.tsx` — reads `ChartStoreContext`; must be inside `EngineProvider`
- [ ] `packages/charts/src/index.ts` — export `ChartSeries`, `ChartSeriesProps`, `ChartSeriesState`, `ChartStoreContext`, `useChartStore`

### Removed files
- `packages/charts/src/data/ChartFilterContext.tsx` — replaced by `ChartStoreContext.tsx`
  (crossfilter2 instance management moves inside `ChartDataStore` itself, not a separate context)

---

## Updated Test Matrix Delta

| Module | Revised strategy |
|---|---|
| `data/transforms.ts:applyFilter` | Pass rows with real field/op/value predicates; assert structural filter works for all 7 ops |
| `data/ChartDataStore.ts` | Construct `new ChartDataStore()` directly (no global); call `register`, `unregister`, `resolve`; assert isolation between instances |
| `player/chartPlugin.ts` | Construct `chartPlugin()`; call `configureRegistry(mockRegistry)` where mock registry implements `get/register`; verify Chart NodeHandler fires and creates a ChartWidget |
| `elements/chart/compile.ts:compileChart` | Include `seriesDsls` in test inputs; assert `state.series` is populated correctly |
