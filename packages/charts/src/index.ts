// @brewsite/charts — native 3D chart elements for BrewSite scenes.
import './register';

// ─── DSL authoring surface ────────────────────────────────────────────────────
export { Chart, ChartData, ChartAxis, ChartSeries, ChartLegend } from './elements/chart/dsl';
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

// ─── Widget + renderer ────────────────────────────────────────────────────────
export { ChartWidget } from './elements/chart/ChartWidget';
export type { ChartHoverInfo } from './elements/chart/ChartWidget';
export { ChartRenderer } from './elements/chart/render';

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
export type { ChartTheme, ChartThemeName } from './themes/types';
