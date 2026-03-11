// @brewsite/charts — native 3D chart elements for BrewSite scenes.

// ─── DSL authoring surface ────────────────────────────────────────────────────
export { Chart, ChartData, ChartAxis, ChartSeries, ChartLegend } from './elements/chart/ChartWidget';
export type {
  ChartProps,
  ChartDataProps,
  ChartAxisProps,
  ChartSeriesProps,
  ChartLegendProps,
} from './elements/chart/dsl';

// ─── State types ─────────────────────────────────────────────────────────────
export type {
  ChartState,
  ChartType,
  ChartAxisState,
  ChartSeriesState,
  ChartLegendState,
  ChartDSL,
  ChartDataDSL,
  ChartAxisDSL,
  ChartSeriesDSL,
  ChartLegendDSL,
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
export { compileChart, functionalChartTransitionSpec } from './elements/chart/compile';

// ─── Widget ──────────────────────────────────────────────────────────────────
export type { ChartHoverInfo } from './elements/chart/ChartWidget';

// ─── Plugin ───────────────────────────────────────────────────────────────────
export { chartPlugin } from './player/chartPlugin';
export type { ChartPluginInstance } from './player/chartPlugin';

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
export type {
  DataTransform,
  FilterTransform,
  FilterOp,
  GroupByTransform,
  SortTransform,
  BinTransform,
  ResolvedDataFrame,
  FilterGroupId,
  ChartDimension,
} from './data/types';

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
} from './themes/types';
