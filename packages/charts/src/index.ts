// @brewsite/charts — native 3D chart elements for BrewSite scenes.

// ─── DSL authoring surface ────────────────────────────────────────────────────
// V2: Per-type components
export { BarChart, LineChart, ScatterPlotChart, PieChart, AreaChart, HeatMapChart } from './elements/chart/stubs';
// V2: Shared child components
export { ChartData, ChartAxis, ChartSeries, ChartLegend, ChartDataLabels, ReferenceLine } from './elements/chart/stubs';
// Deprecated: generic V1 Chart component
export { Chart } from './elements/chart/stubs';

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
export { DEFAULT_CHART_STATE } from './elements/chart/types';

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

// ─── Compiler ────────────────────────────────────────────────────────────────
export {
  compileChart,
  compileBarChartOptions,
  compileLineChartOptions,
  compileScatterChartOptions,
  compilePieChartOptions,
  compileAreaChartOptions,
  compileHeatMapChartOptions,
  functionalChartTransitionSpec,
} from './elements/chart/compile';

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
export { ChartTooltipOverlay } from './player/ChartTooltipOverlay';
export type { ChartTooltipOverlayProps } from './player/ChartTooltipOverlay';

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
export type { FittedMargins, ChartAccessorFunctions } from './renderers/shared/IChartRenderer';

// ─── Themes ───────────────────────────────────────────────────────────────────
export { darkGlassChartTheme } from './themes/darkGlass';
export { neonCyberChartTheme } from './themes/neonCyber';
export { enterpriseChartTheme } from './themes/enterprise';
export { lightMinimalChartTheme } from './themes/lightMinimal';
export { createChartTheme } from './themes/createChartTheme';
export { CHART_THEMES } from './themes/index';
export type { ChartThemeOverrides } from './themes/createChartTheme';
export type {
  ChartTheme,
  ChartThemeName,
  ChartLegendTokens,
  ChartPieTokens,
  ChartInteractionTokens,
  ChartBarTokens,
  ChartAreaTokens,
  ChartGridlinesTokens,
  ChartDataLabelsTokens,
  ChartReferenceLineTokens,
} from './themes/types';

// V1 deprecated type exports (migration compat)
/** @deprecated V1 type. Use BarChartDSL, LineChartDSL, etc. from specific imports. */
export type { ChartDSL, ChartDataDSL, ChartAxisDSL, ChartSeriesDSL, ChartLegendDSL } from './elements/chart/types';
