// Chart element type contracts — no Three.js, no React.

import type { DataTransform, FilterGroupId } from '../../data/types';
import type { ChartThemeName } from '../../themes/types';
import type { ChartAxisState, ChartSeriesState } from '../../renderers/shared/IChartRenderer';

export type { ChartAxisState, ChartSeriesState };

/** Supported chart types. */
export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'heatmap';

/** Legend position. */
export type LegendPosition = 'right' | 'bottom' | 'top' | 'left';

/** Compiled legend state. */
export type ChartLegendState = {
  readonly visible: boolean;
  readonly position: LegendPosition;
};

/**
 * Compiled runtime state for one chart element.
 * All fields serializable — no function references.
 */
export type ChartState = {
  readonly type: ChartType;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly bounds: { readonly width: number; readonly height: number; readonly depth: number };
  /** Data source name registered via ChartProvider. NOT the data itself. */
  readonly dataSource: string;
  /** Serializable transforms applied at resolve time. */
  readonly transforms: readonly DataTransform[];
  /** Linked-brush filter group. */
  readonly filterGroup?: FilterGroupId;
  readonly xAxis: ChartAxisState | null;
  readonly yAxis: ChartAxisState | null;
  /**
   * Explicit series definitions. When empty, the renderer derives a single series
   * from yAxis.field for backward compatibility.
   */
  readonly series: readonly ChartSeriesState[];
  readonly legend: ChartLegendState | null;
  readonly theme: ChartThemeName;
  readonly opacity: number;
  readonly interactive: boolean;
  /** For heatmap time-series animation — field name containing the time dimension. */
  readonly timeField?: string;
};

/** Default compiled state. opacity = 1 so charts are visible by default. */
export const DEFAULT_CHART_STATE: ChartState = {
  type: 'bar',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  bounds: { width: 4, height: 3, depth: 0.4 },
  dataSource: '',
  transforms: [],
  xAxis: null,
  yAxis: null,
  series: [],
  legend: null,
  theme: 'darkGlass',
  opacity: 1,
  interactive: false,
};

// ─── DSL prop types ─────────────────────────────────────────────────────────

/** Props for the <Chart> DSL component. */
export type ChartDSL = {
  readonly id: string;
  readonly type: ChartType;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly bounds?: { readonly width?: number; readonly height?: number; readonly depth?: number };
  readonly dataSource?: string;
  readonly theme?: ChartThemeName;
  readonly opacity?: number;
  readonly interactive?: boolean;
};

/** Props for the <ChartData> DSL component. */
export type ChartDataDSL = {
  readonly source: string;
  readonly transforms?: readonly DataTransform[];
  readonly filterGroup?: FilterGroupId;
  readonly timeField?: string;
};

/** Props for the <ChartAxis> DSL component. */
export type ChartAxisDSL = {
  readonly axis: 'x' | 'y';
  readonly field: string;
  readonly label?: string;
  readonly format?: string;
};

/** Props for the <ChartSeries> DSL component. */
export type ChartSeriesDSL = {
  readonly field: string;
  readonly label?: string;
  readonly color?: string;
};

/** Props for the <ChartLegend> DSL component. */
export type ChartLegendDSL = {
  readonly visible?: boolean;
  readonly position?: LegendPosition;
};
