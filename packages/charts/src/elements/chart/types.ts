// Chart element type contracts — no Three.js, no React.

import type { SceneTheme, NVSRect } from '@brewsite/core';
import type { DataTransform, FilterGroupId } from '../../data/types';
import type { ChartThemeName, ChartTheme } from '../../themes/types';
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
  readonly theme: ChartThemeName | ChartTheme;
  readonly opacity: number;
  readonly interactive: boolean;
  /** Inner radius ratio for pie charts (0 = pie, 0.1–0.8 = donut). Default 0. */
  readonly innerRadius?: number;
  /** For heatmap time-series animation — field name containing the time dimension. */
  readonly timeField?: string;
  /**
   * Scene theme for cross-package theming.
   * Resolved at compile time from the DSL sceneTheme prop.
   * Takes precedence over ChartTheme.sceneTheme when set.
   */
  readonly sceneTheme?: SceneTheme;
  /**
   * NVS bounds declaring what region of the AR-locked container this chart occupies.
   * Fullscreen is { x: 0, y: 0, w: 1, h: 1 }. Required — always filled by compile step.
   */
  readonly nvsBounds: NVSRect;
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
  sceneTheme: undefined,
  nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
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
  readonly theme?: ChartThemeName | ChartTheme;
  readonly opacity?: number;
  readonly interactive?: boolean;
  readonly innerRadius?: number;
  /**
   * Optional scene theme for cross-package theming.
   * When set, overrides ChartTheme.sceneTheme for this element.
   * Enables using a named theme (e.g. 'darkGlass') with a custom sceneTheme
   * without constructing a full ChartTheme object.
   *
   * @example
   * <Chart theme="darkGlass" sceneTheme={mySceneTheme} />
   */
  readonly sceneTheme?: SceneTheme;
  /** NVS x-coordinate of the chart left edge [0, 1]. Default: 0 */
  readonly x?: number;
  /** NVS y-coordinate of the chart top edge [0, 1]. Default: 0 */
  readonly y?: number;
  /** NVS width of the chart [0, 1]. Default: 1 */
  readonly w?: number;
  /** NVS height of the chart [0, 1]. Default: 1 */
  readonly h?: number;
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
