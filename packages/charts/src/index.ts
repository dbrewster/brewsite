// @brewsite/charts — native 3D chart elements for BrewSite scenes.

// ─── DSL authoring surface ────────────────────────────────────────────────────
// V2: Per-type components
export { BarChart, LineChart, ScatterPlotChart, PieChart, AreaChart, HeatMapChart } from './elements/chart/stubs';
// V2: Shared child components
export { ChartData, ChartAxis, ChartSeries, ChartLegend, ChartDataLabels, ReferenceLine } from './elements/chart/stubs';

// V2 prop types
export type {
  BarChartProps, LineChartProps, ScatterPlotChartProps, PieChartProps,
  AreaChartProps, HeatMapChartProps, ChartDataProps, ChartAxisProps,
  ChartSeriesProps, ChartLegendProps, ChartDataLabelsProps, ReferenceLineProps,
} from './elements/chart/dsl';

// ─── State types ─────────────────────────────────────────────────────────────
export type {
  ChartState,
  ChartType,
  ChartAxisState,
  ChartSeriesState,
  ChartLegendState,
  ChartTypeOptions,
  BarChartOptions,
  LineChartOptions,
  ScatterChartOptions,
  PieChartOptions,
  AreaChartOptions,
  HeatMapChartOptions,
  ChartStateDataSource,
  InlineDataSource,
  NamedDataSource,
  AsyncDataSource,
  ChartDataLabelsState,
  DataLabelsPosition,
  ReferenceLineState,
  DataRow,
  ColumnarData,
  DataInput,
} from './elements/chart/types';
export { DEFAULT_CHART_STATE } from './elements/chart/compile';

import type { ChartType } from './elements/chart/types';
import type { FilterOp } from './data/types';

/** All supported chart types. Useful for building type-selector dropdowns or tests. */
export const CHART_TYPES = [
  'bar', 'line', 'area', 'pie', 'scatter', 'heatmap',
] as const satisfies readonly ChartType[];

/** All supported filter operators. */
export const FILTER_OPS = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in',
] as const satisfies readonly FilterOp[];


// ─── Widget ──────────────────────────────────────────────────────────────────
export type { ChartHoverInfo } from './elements/chart/ChartWidget';

// ─── Plugin ───────────────────────────────────────────────────────────────────
export { chartPlugin } from './player/chartPlugin';
export type { ChartPluginInstance } from './player/chartPlugin';

// ─── Player hooks (V2.1) ─────────────────────────────────────────────────────
export { useLiveChartData } from './player/useLiveChartData';
export { useChartAccessors } from './player/useChartAccessors';

// ─── Player components ────────────────────────────────────────────────────────
export { ChartProvider } from './player/ChartProvider';
export type { ChartProviderProps } from './player/ChartProvider';

// ─── Data layer ───────────────────────────────────────────────────────────────
export { ChartDataStore } from './data/ChartDataStore';
export { useChartData } from './data/useChartData';
export { useChartFilter } from './data/useChartFilter';
export { useChartStore, ChartStoreContext } from './data/ChartStoreContext';
export type { IFilterEngine } from './data/IFilterEngine';
export { SimpleFilterEngine } from './data/SimpleFilterEngine';
export { normalizeDataInput } from './data/transforms';
export type {
  DataTransform,
  FilterTransform,
  FilterOp,
  GroupByTransform,
  SortTransform,
  BinTransform,
  ComputeTransform,
  ResolvedDataFrame,
  FilterGroupId,
  ChartDimension,
} from './data/types';

// ─── Renderer shared types (V2.1) ─────────────────────────────────────────────
export type { FittedMargins, ChartAccessorFunctions, ChartHitInfo, ChartHitMeta } from './renderers/shared/IChartRenderer';

// ─── Tooltip system (new in v2.2) ─────────────────────────────────────────────

// DSL component
export { ChartTooltip } from './elements/chart/stubs';
export type { ChartTooltipProps } from './elements/chart/dsl';

// Types
export type { ChartTooltipState, ChartTooltipRuntimeConfig } from './elements/chart/tooltip/types';

// Store hook (read-only consumer surface — chartTooltipStore singleton is NOT exported)
export { useChartTooltip } from './elements/chart/tooltip/ChartTooltipStore';
export type { ChartTooltipEntry } from './elements/chart/tooltip/ChartTooltipStore';
export { useChartTooltipConfig } from './elements/chart/tooltip/useChartTooltipConfig';

// Host component
export { ChartTooltipHost } from './elements/chart/tooltip/ChartTooltipHost';

// ─── Themes ───────────────────────────────────────────────────────────────────
// Default presets (enterprise aesthetic). Named presets live in @brewsite/themes.
export { enterpriseChartTheme, defaultChartTheme } from './themes/enterprise';
export { enterpriseLightChartTheme, defaultLightChartTheme } from './themes/enterpriseLight';
export { createChartTheme } from './themes/createChartTheme';
export type { ChartThemeOverrides } from './themes/createChartTheme';
export type { ChartThemePairEntry } from './themes/chartThemeRegistry';
export type {
  ChartTheme,
  ChartThemeName,
  ChartSeriesMaterialTokens,
  ChartAxisTokens,
  ChartBackgroundTokens,
  ChartLegendTokens,
  ChartPieTokens,
  ChartInteractionTokens,
  ChartBarTokens,
  ChartAreaTokens,
  ChartGridlinesTokens,
  ChartDataLabelsTokens,
  ChartReferenceLineTokens,
  ChartTooltipTokens,
  ChartProjectionTokens,
} from './themes/types';

// ─── Theme registry ───────────────────────────────────────────────────────────
export {
  registerChartThemePair,
  resolveChartTheme,
} from './themes/chartThemeRegistry';

// ─── Convenience hooks ───────────────────────────────────────────────────────
export { useChartTheme } from './hooks/useChartTheme';
