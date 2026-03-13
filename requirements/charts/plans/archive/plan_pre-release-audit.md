---
title: "Pre-Release Audit — @brewsite/charts"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-12
---

# Pre-Release Audit — @brewsite/charts

## Coverage Summary

| Metric | Value |
|---|---|
| **Statement coverage** | 83.47% |
| **Branch coverage** | 75.62% |
| **Function coverage** | 80.32% |
| **Test files** | 23 |
| **Tests passing** | All (with recent fixes) |

### Low-Coverage Files (< 50% statements)

| File | Stmts | Notes |
|---|---|---|
| `player/ChartProvider.tsx` | 0% | No tests at all |
| `player/ChartTooltipOverlay.tsx` | 3% | Deprecated but still exported |
| `player/chartPlugin.ts` | 22% | Plugin lifecycle largely untested |
| `player/useLiveChartData.ts` | 0% | No tests |
| `player/useChartAccessors.ts` | 0% | No tests |
| `hooks/useChartTheme.ts` | 0% | No tests |
| `data/useChartData.ts` | 0% | No tests |
| `data/useChartFilter.ts` | 0% | No tests |
| `renderers/shared/LegendRenderer.ts` | 5.88% | Nearly untested |
| `elements/chart/tooltip/useChartTooltipConfig.ts` | 0% | No tests |

---

## P0 — Must Fix Before Release

### P0-1: Broken DataLabelRenderer in BarRenderer and PieRenderer (BUG)

**Severity:** Critical — `<ChartDataLabels>` silently does nothing on bar and pie charts.

Both `BarRenderer` and `PieRenderer` import `DataLabelRenderer` as **type-only** (`import type`), initialize `dataLabelRenderer` to `null`, and never construct an instance. The guard `if (this.dataLabelRenderer)` is always false.

- `packages/charts/src/renderers/bar/BarRenderer.ts` — line 13 (`import type`), line 59 (`any | null = null`), line 134-139 (dead guard)
- `packages/charts/src/renderers/pie/PieRenderer.ts` — line 10 (`import type`), line 43 (`any | null = null`), line 93-98 (dead guard)

**Fix:** Change `import type` to runtime import, construct `DataLabelRenderer` when `ctx.dataLabels` is present. Add tests verifying data labels render for bar and pie chart types.

### P0-2: Remove Deprecated V1 `Chart` Component from Public API

The `<Chart>` V1 component is exported from three locations:
- `packages/charts/src/index.ts` line 9
- `packages/charts/src/elements/chart/ChartWidget.ts` lines 556-572 (re-export block with migration comment)
- `packages/charts/src/elements/chart/index.ts` line 3

If V1 is deprecated for release, remove from `index.ts` and `ChartWidget.ts` re-exports. Keep only in `stubs.ts` marked `@internal`.

Also: the V1 handler in `chartPlugin.ts` line 341 duplicates V2 type-options compilation in a large `switch` block (lines 356-394) instead of calling the already-exported `compileXxxChartOptions()` functions. Remove or consolidate.

### P0-3: Remove `ChartTooltipOverlay` from Public API

`ChartTooltipOverlay` and `ChartTooltipOverlayProps` are exported from `index.ts` lines 85-86 with `@deprecated` marking and a "removed in next minor" warning. If this is the first public release, ship without it — or the deprecation warning is misleading from day one.

- `packages/charts/src/player/ChartTooltipOverlay.tsx`
- `packages/charts/src/index.ts` lines 85-86

### P0-4: Deprecated V1 Types Still in Public API

`ChartDSL`, `ChartDataDSL`, `ChartAxisDSL`, `ChartSeriesDSL`, `ChartLegendDSL` are exported with `@deprecated V1 type` annotations at `index.ts` lines 170-171. Remove before first public release — they should not be part of the initial API contract.

---

## P1 — High Priority

### P1-1: Massive Type Duplication Between `IChartRenderer.ts` and `types.ts`

`renderers/shared/IChartRenderer.ts` re-defines ~15 types that are canonical in `elements/chart/types.ts`:

- `ChartAxisState`, `ChartSeriesState`, `ChartLegendState`, `LegendPosition`
- `BarChartOptions`, `LineChartOptions`, `ScatterChartOptions`, `PieChartOptions`, `AreaChartOptions`, `HeatMapChartOptions`
- `ChartTypeOptions`, `DataLabelsPosition`, `ChartDataLabelsState`, `ReferenceLineState`, `ChartLineShape`

The comment at `IChartRenderer.ts:43` claims these are "canonical definitions" but they are duplicates. Any divergence causes silent type mismatches.

**Fix:** Remove all duplicate type definitions from `IChartRenderer.ts`. Import from `elements/chart/types.ts` instead.

- `packages/charts/src/renderers/shared/IChartRenderer.ts` lines 44-172

### P1-2: Duplicate `getInterpolator` Function (3 copies)

Identical d3 color interpolator lookup implemented independently in:
- `packages/charts/src/renderers/scatter/ScatterRenderer.ts` lines 17-26
- `packages/charts/src/renderers/heatmap/HeatmapRenderer.ts` lines 14-23
- `packages/charts/src/renderers/shared/ChartMaterialFactory.ts` lines 111-133 (as `interpolateColor`)

**Fix:** Extract to `renderers/shared/colorUtils.ts`, import everywhere.

### P1-3: Duplicate `lerp` Function (4 copies)

Identical `lerp(a, b, t)` in:
- `packages/charts/src/renderers/bar/BarRenderer.ts` lines 31-33
- `packages/charts/src/renderers/line/LineRenderer.ts` lines 15-17
- `packages/charts/src/renderers/area/AreaRenderer.ts` lines 13-15
- `packages/charts/src/renderers/scatter/ScatterRenderer.ts` lines 29-31

**Fix:** Extract to `renderers/shared/mathUtils.ts`.

### P1-4: Dead Code — Empty `if` Block in `ChartRenderer.update()`

`packages/charts/src/elements/chart/render.ts` lines 72-74:
```ts
if (data.rows.length === 0) {
  // empty
}
```
Likely an incomplete early-exit. Either add the return or remove the block.

### P1-5: Dead Variable `instanceIdx` in HeatmapRenderer

`packages/charts/src/renderers/heatmap/HeatmapRenderer.ts` — `instanceIdx` at line 216 is incremented (line 252) but never read. The actual index `idx` is computed separately. Remove the dead variable.

### P1-6: `AxesRenderer` Duplicates `ChartMaterialFactory` Logic

`packages/charts/src/renderers/shared/AxesRenderer.ts` lines 91-98 creates its own floor `MeshStandardMaterial` inline instead of using `ChartMaterialFactory.createFloorMaterial()` which exists for this purpose (line 71 of `ChartMaterialFactory.ts`).

### P1-7: Duplicate Test File

Both `renderers/__tests__/ChartMaterialFactory.test.ts` and `renderers/shared/__tests__/ChartMaterialFactory.test.ts` test the same class. Delete the legacy `renderers/__tests__/` copy.

### P1-8: Duplicate Import in `ChartTooltipOverlay.tsx`

`packages/charts/src/player/ChartTooltipOverlay.tsx` imports `projectNdcToNvsPixels` twice — once as a re-export (line 8) and once as a runtime import (line 46).

---

## P2 — Medium Priority

### P2-1: Three Overlapping Theme Lookup Tables

Theme name → theme object maps exist in three places:
- `themes/resolveTheme.ts` — `FULL_THEME_MAP` (12 entries, lines 18-31)
- `themes/createChartTheme.ts` — `PRESET_MAP` (6 entries, lines 24-31)
- `themes/index.ts` — `CHART_THEMES` (6 entries, lines 45-52) + `CHART_THEME_PAIRS` (12 entries)

Adding a new theme requires updating at least 3 files. Consolidate to a single source of truth.

### P2-2: Compiler Internals Exported as Public API

These functions are exported from `index.ts` but are only used internally by the plugin:
- `compileChart`, `compileTooltipDsl`
- `compileBarChartOptions`, `compileLineChartOptions`, `compileScatterChartOptions`
- `compilePieChartOptions`, `compileAreaChartOptions`, `compileHeatMapChartOptions`

Unless there's a documented use case for external consumers calling these directly, remove from the public API surface.

### P2-3: `_configureAsync` Leaky Abstraction on `ChartWidget`

`ChartWidget._configureAsync()` has a leading underscore suggesting internal, but is `public` and called from `chartPlugin.ts`. Either make it truly internal with a plugin-specific interface, or drop the underscore prefix.

- `packages/charts/src/elements/chart/ChartWidget.ts`

### P2-4: `_morphT` Internal Field in Public `ChartState` Type

`ChartState._morphT?: number` is documented `@internal` but lives in the public state type visible to all consumers. Consider a separate internal state type or a branded field.

- `packages/charts/src/elements/chart/types.ts` lines 256-259

### P2-5: `DataInput` Type Collision Between `ChartProvider` and `data/types`

`ChartProvider.tsx` line 19 defines a local `DataInput` type that is structurally different from the public `DataInput` exported from `data/types.ts`. The `ChartProviderProps.data` field uses the local type, but consumers importing `DataInput` from the package get the different public type. Rename the local type or align them.

### P2-6: `compileDataSource` Exported from `compile.ts` But Not in `index.ts`

`packages/charts/src/elements/chart/compile.ts` exports `compileDataSource()` which is an internal-only function. Make it non-exported (`function` instead of `export function`).

### P2-7: Module-Level Singleton `chartTooltipStore`

`packages/charts/src/elements/chart/tooltip/ChartTooltipStore.ts` line 124 exports a module-level singleton. While `ChartTooltipHost` accepts a `_store` injection for testing, `ChartWidget` at line 29 imports and calls the singleton directly with no injection seam. This limits testability.

### P2-8: `register.ts` Side-Effect File

`packages/charts/src/register.ts` calls `registerChartHandlers()` on import as a side effect. Its JSDoc says "Do NOT call this directly — chartPlugin() handles registration." Unclear when this file is imported. If dead, delete it.

---

## P3 — Low Priority / Polish

### P3-1: Missing Tests for Hooks and Player Components

The following have 0% coverage and no test files:
- `player/useLiveChartData.ts`
- `player/useChartAccessors.ts`
- `hooks/useChartTheme.ts`
- `data/useChartData.ts`
- `data/useChartFilter.ts`
- `data/ChartStoreContext.tsx`
- `player/ChartProvider.tsx`
- `elements/chart/tooltip/useChartTooltipConfig.ts`
- `elements/chart/tooltip/projectUtils.ts` (pure math — easy to test)

### P3-2: `JSON.stringify` on Hot Animation Path

`packages/charts/src/elements/chart/compile.ts` line 364 uses `JSON.stringify` for change detection during chart transitions. This allocates strings every animation frame.

**Fix:** Use a structural comparison or pre-compute a hash at compile time.

### P3-3: `useChartTooltipConfig` Effect Pattern

`packages/charts/src/elements/chart/tooltip/useChartTooltipConfig.ts` runs an effect on every render with no dependency array. Callers must stabilize the `config` parameter with `useCallback` — this is not documented.

### P3-4: Missing JSDoc on Public Functions

- `compileDataSource()` — no JSDoc
- `resolveChartTheme()` — minimal JSDoc
- `useChartData()` — minimal JSDoc
- `useChartFilter()` — no JSDoc on `activeFilters` stale closure behavior
- `ChartDataStore.getTimeSlice()` — no JSDoc

### P3-5: `ChartWidget.onTick()` Duplicates Position Math from `apply()`

`packages/charts/src/elements/chart/ChartWidget.ts` — `onTick()` lines 359-376 duplicates the world-position computation from `apply()` lines 291-299. Extract to a shared helper.

### P3-6: `LegendRenderer` Nearly Untested (5.88% coverage)

`packages/charts/src/renderers/shared/LegendRenderer.ts` has almost no test coverage. It handles legend text layout, spacing, and visibility. Add tests.

### P3-7: `DEFAULT_CHART_STATE` Exported as Public API

`packages/charts/src/elements/chart/types.ts` exports `DEFAULT_CHART_STATE`. This is an internal default that could encourage anti-patterns (spreading/mutating). Consider removing from public API.

### P3-8: `CHART_TYPES` Name Collision

`chartPlugin.ts` line 73 defines `const CHART_TYPES = new Set([...])` locally. `index.ts` lines 49-51 exports `const CHART_TYPES = [...]` publicly. Same name, different types (`Set` vs `readonly array`). Rename the local one to avoid confusion.
