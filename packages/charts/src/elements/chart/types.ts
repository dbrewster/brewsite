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

/** Rendered profile shape for line charts. */
export type ChartLineShape = 'circle' | 'triangle' | 'hexagon' | 'heptagon' | 'octagon' | 'line';

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
  /**
   * NVS center position X [0..1]. Derived from nvsBounds center at compile time.
   * nvsX = nvsBounds.x + nvsBounds.w / 2
   * Converted to world-space X at render time.
   */
  readonly nvsX: number;
  /**
   * NVS center position Y [0..1]. Derived from nvsBounds center at compile time.
   * nvsY = nvsBounds.y + nvsBounds.h / 2
   * Converted to world-space Y at render time.
   */
  readonly nvsY: number;
  /**
   * World-space depth (Z) of the chart center. Replaces position[2].
   * Default: 0.
   */
  readonly z: number;
  readonly rotation: readonly [number, number, number];
  /**
   * Chart geometry dimensions.
   * width: NVS fraction of viewport width [0..1]. Default: nvsBounds.w.
   * height: NVS fraction of viewport height [0..1]. Default: nvsBounds.h.
   * depth: World-space thickness of 3D geometry (bars, areas). Default: 0.4.
   */
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
  /** Optional per-chart line profile shape. */
  readonly lineShape?: ChartLineShape;
  /** Optional per-chart line smoothness override. Falls back to theme.line.smoothness. */
  readonly lineSmoothness?: number;
  /** Optional per-chart line subdivision override. Falls back to theme.line.subdivisions. */
  readonly lineSubdivisions?: number;
  /** Optional per-chart axis gap override. Falls back to theme.axis.gap. */
  readonly axisGap?: number;
  /** Inner radius ratio for pie charts (0 = pie, 0.1–0.8 = donut). Default 0. */
  readonly innerRadius?: number;
  /** Optional per-chart legend gap override. Falls back to theme.legend.gap. */
  readonly legendGap?: number;
  /** Optional per-chart pie tilt override in radians. Falls back to theme.pie.tilt. */
  readonly pieTilt?: number;
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
  nvsX: 0.5,
  nvsY: 0.5,
  z: 0,
  rotation: [0, 0, 0],
  bounds: { width: 1.0, height: 1.0, depth: 0.4 },
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
  readonly rotation?: readonly [number, number, number];
  readonly bounds?: {
    /** NVS width fraction [0..1]. Default: same as `w` prop (fills nvsBounds). */
    readonly width?: number;
    /** NVS height fraction [0..1]. Default: same as `h` prop (fills nvsBounds). */
    readonly height?: number;
    /** World-space 3D depth of chart geometry. Default: 0.4. */
    readonly depth?: number;
  };
  readonly dataSource?: string;
  readonly theme?: ChartThemeName | ChartTheme;
  readonly opacity?: number;
  readonly interactive?: boolean;
  readonly lineShape?: ChartLineShape;
  readonly lineSmoothness?: number;
  readonly lineSubdivisions?: number;
  readonly axisGap?: number;
  readonly innerRadius?: number;
  readonly legendGap?: number;
  readonly pieTilt?: number;
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
  /** World-space depth (Z) of the chart center. Default: 0 */
  readonly z?: number;
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
