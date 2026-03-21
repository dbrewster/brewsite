// Chart element type contracts — no Three.js, no React. V2 breaking-change revision.

import type { SceneTheme, NVSRect } from '@brewsite/core';
import type { DataTransform, FilterGroupId } from '../../data/types';
import type { ChartThemeName, ChartTheme } from '../../themes/types';
import type { ChartAccessorFunctions } from '../../renderers/shared/IChartRenderer';

// ─── Re-exports from data/types ──────────────────────────────────────────────

export type { DataRow, ColumnarData, DataInput } from '../../data/types';

// ─── Data Source Types (V2 new) ───────────────────────────────────────────────

/** Inline static rows — stored directly in ChartState. SceneTrack-safe. */
export type InlineDataSource = {
  readonly type: 'inline';
  readonly rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  /** Key field for datum-level morphing between scenes. */
  readonly keyField?: string;
};

/** Named reference to a ChartProvider-registered source. V1 behavior. */
export type NamedDataSource = {
  readonly type: 'named';
  readonly name: string;
  readonly keyField?: string;
};

/** Async fetch — URL serialized in SceneTrack; data cached in widget memory. */
export type AsyncDataSource = {
  readonly type: 'async';
  readonly url: string;
  readonly format?: 'json' | 'csv';
  readonly keyField?: string;
};

/** Discriminated union of all compiled data sources. All variants are SceneTrack-safe. */
export type ChartStateDataSource = InlineDataSource | NamedDataSource | AsyncDataSource;

// ─── Type-Specific Options (V2 new) ──────────────────────────────────────────

/** Options specific to bar charts. */
export type BarChartOptions = {
  readonly orientation?: 'vertical' | 'horizontal';
  readonly stackMode?: 'grouped' | 'stacked';
  /** Padding ratio between bar groups [0..1]. Default from theme. */
  readonly barPadding?: number;
};

/** Options specific to line charts. */
export type LineChartOptions = {
  readonly lineShape?: ChartLineShape;
  readonly lineSmoothness?: number;
  readonly lineSubdivisions?: number;
  readonly showPoints?: boolean;
};

/** Options specific to scatter charts. */
export type ScatterChartOptions = {
  readonly sizeField?: string;
  readonly colorField?: string;
  readonly pointShape?: 'sphere' | 'cube' | 'cylinder';
  /** World-space radius scale range for sizeField encoding. */
  readonly sizeScale?: { readonly min: number; readonly max: number };
  /** Color interpolator for continuous numeric colorField values. */
  readonly colorInterpolator?: 'blues' | 'reds' | 'viridis' | 'plasma';
};

/** Options specific to pie/donut charts. */
export type PieChartOptions = {
  /** [0..1] — 0 = pie, >0 = donut. Default: 0. */
  readonly innerRadius?: number;
  readonly pieTilt?: number;
  /** x-axis field value of the slice to push outward. */
  readonly explodeSlice?: string;
};

/** Options specific to area charts. */
export type AreaChartOptions = {
  readonly stackMode?: 'none' | 'stacked';
  readonly fillOpacity?: number;
};

/** Options specific to heatmap charts. */
export type HeatMapChartOptions = {
  readonly timeField?: string;
  readonly heightField?: string;
  readonly colorInterpolator?: 'blues' | 'reds' | 'viridis' | 'plasma';
};

/**
 * Discriminated union of per-chart-type options.
 * `kind` matches `ChartState.type`. Renderers pattern-match on `kind`.
 */
export type ChartTypeOptions =
  | { readonly kind: 'bar';     readonly options: BarChartOptions }
  | { readonly kind: 'line';    readonly options: LineChartOptions }
  | { readonly kind: 'scatter'; readonly options: ScatterChartOptions }
  | { readonly kind: 'pie';     readonly options: PieChartOptions }
  | { readonly kind: 'area';    readonly options: AreaChartOptions }
  | { readonly kind: 'heatmap'; readonly options: HeatMapChartOptions };

// ─── Data Labels (V2 new) ─────────────────────────────────────────────────────

/** Position variant for data point value labels. */
export type DataLabelsPosition = 'top' | 'center' | 'outside';

/** Compiled state for data-point value label rendering. */
export type ChartDataLabelsState = {
  readonly position: DataLabelsPosition;
  /** d3-format string. Default: '.0f'. */
  readonly format?: string;
};

// ─── Reference Lines (V2 new) ────────────────────────────────────────────────

/** State for a single reference line drawn across the chart. */
export type ReferenceLineState = {
  readonly axis: 'x' | 'y';
  readonly value: number;
  readonly label?: string;
  readonly color?: string;
};

// ─── Shared primitives ────────────────────────────────────────────────────────

/** Supported chart types. */
export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'heatmap';

/** Legend position. */
export type LegendPosition = 'right' | 'bottom' | 'top' | 'left';

/** Rendered profile shape for line charts. */
export type ChartLineShape = 'circle' | 'triangle' | 'hexagon' | 'heptagon' | 'octagon' | 'line';

// ─── Updated ChartAxisState (V2) ─────────────────────────────────────────────

/**
 * Compiled axis configuration for one chart axis.
 * V2 adds: scaleType, domain, tickCount, nice, clamp, reverse, gridlines, gridlineOpacity.
 */
export type ChartAxisState = {
  readonly axis: 'x' | 'y';
  readonly field: string;
  readonly label?: string;
  readonly format?: string;
  // V2 additions:
  readonly scaleType?: 'linear' | 'log' | 'time' | 'band' | 'sqrt';
  readonly domain?: readonly [number | string, number | string];
  readonly tickCount?: number;
  readonly nice?: boolean;
  readonly clamp?: boolean;
  readonly reverse?: boolean;
  readonly gridlines?: boolean;
  readonly gridlineOpacity?: number;
};

// ─── Updated ChartSeriesState (V2) ───────────────────────────────────────────

/**
 * State for one data series within a chart.
 * V2 adds: bandField for area band variant.
 */
export type ChartSeriesState = {
  readonly field: string;
  readonly label?: string;
  readonly color?: string;
  /** For area band variant: name of the lower-bound field. */
  readonly bandField?: string;
};

// ─── Updated ChartLegendState (V2) ───────────────────────────────────────────

/**
 * Compiled legend state.
 * V2 adds: title, columns, maxItems.
 */
export type ChartLegendState = {
  readonly visible: boolean;
  readonly position: LegendPosition;
  readonly title?: string;
  readonly columns?: number;
  readonly maxItems?: number;
};

// ─── ChartState V2 (breaking change) ─────────────────────────────────────────

/**
 * Compiled runtime state for one chart element — V2.
 *
 * Breaking changes from V1:
 * - `dataSource: string` → `dataSource: ChartStateDataSource` (discriminated union)
 * - `typeConfig: ChartTypeOptions` added — replaces flat optional per-type fields
 * - Removed flat fields: lineShape, lineSmoothness, lineSubdivisions, innerRadius,
 *   pieTilt, timeField, axisGap, legendGap (all moved into typeConfig.options)
 * - `dataLabels?: ChartDataLabelsState` added
 * - `gridlines?: boolean` added (per-chart shorthand)
 * - `referenceLines?: ReadonlyArray<ReferenceLineState>` added
 * - `series[].bandField` added
 * - Legend gains title, columns, maxItems
 * - Axis gains scaleType, domain, tickCount, nice, clamp, reverse, gridlines, gridlineOpacity
 * - `_morphT?: number` internal field for transition morphing (not public API)
 */
export type ChartState = {
  /** Convenience derived field — always equals typeConfig.kind. Kept for backward compat. */
  readonly type: ChartType;
  readonly nvsX: number;
  readonly nvsY: number;
  readonly z: number;
  readonly rotation: readonly [number, number, number];
  /**
   * Chart geometry dimensions.
   * width: NVS fraction of viewport width [0..1]. Default: nvsBounds.w.
   * height: NVS fraction of viewport height [0..1]. Default: nvsBounds.h.
   * depth: World-space thickness of 3D geometry (bars, areas). Default: 0.4.
   */
  readonly bounds: { readonly width: number; readonly height: number; readonly depth: number };
  /**
   * When true, bounds.width and bounds.height are scaled uniformly using
   * vmin (min(visibleWorldWidth, visibleWorldHeight)) instead of per-axis scaling.
   * Set by the compile layer when any DSL size prop uses the `u` unit.
   * @default false
   */
  readonly uniformSizing: boolean;
  /** V2: Discriminated data source. Replaces V1 `dataSource: string`. */
  readonly dataSource: ChartStateDataSource;
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
  readonly referenceLines?: ReadonlyArray<ReferenceLineState>;
  readonly legend: ChartLegendState | null;
  /** Resolved ChartTheme object — always a concrete theme, never a name string. */
  readonly theme: ChartTheme;
  readonly opacity: number;
  readonly interactive: boolean;
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
  /** V2: Discriminated type-specific options. */
  readonly typeConfig: ChartTypeOptions;
  /** V2: Data point value labels (bar tops, pie slices, scatter points). */
  readonly dataLabels?: ChartDataLabelsState;
  /** V2: Per-chart gridlines shorthand — overrides axis-level settings. */
  readonly gridlines?: boolean;
  /**
   * Internal: interpolation t value injected by interpolateFn during transitions.
   * Used by ChartRenderer to build MorphContext. Not part of the public API.
   * @internal
   */
  // DEBT: Move to separate internal state type
  readonly _morphT?: number;
  /**
   * Internal: the "from" scene's data source, injected by interpolateFn.
   * Used by ChartRenderer to resolve the morph origin data independently of scroll direction.
   * Without this, reverse scrolling would pin B's data as both from and to (no visible morph).
   * @internal
   */
  readonly _morphFromDataSource?: ChartStateDataSource;
  /**
   * Internal: the "from" scene's data transforms, paired with _morphFromDataSource.
   * @internal
   */
  readonly _morphFromTransforms?: readonly DataTransform[];
  /**
   * V2.1: Whether bars animate upward from y=0 on scene entry.
   * Driven by blockProgress via ChartWidget.onTick(). Currently scoped to BarRenderer only.
   * @default false
   */
  readonly animateEntry: boolean;
  /**
   * V2.1: Duration of the entry animation as a fraction of blockProgress [0..1].
   * At blockProgress = animationDuration, entryT reaches 1.0 (full height).
   * Values outside [0.01..1.0] are clamped.
   * @default 0.4
   */
  readonly animationDuration: number;
  /**
   * Compiled tooltip configuration. Non-null when <ChartTooltip> is a DSL child.
   * Null when no <ChartTooltip> child is present.
   */
  readonly tooltip: import('./tooltip/types').ChartTooltipState | null;
};


// ─── ChartRenderInput (V2.1 — moved here from render.ts) ────────────────────

/**
 * Input type for ChartRenderer.update(). Extends ChartState with world-space bounds,
 * world-space position, and runtime-only fields (entryT, accessors) that are not
 * SceneTrack-serializable. Defined in types.ts (not render.ts) so ChartWidget.ts and
 * render.ts both resolve it from the same Phase 1 source.
 */
export type ChartRenderInput = Omit<ChartState, 'nvsX' | 'nvsY' | 'z'> & {
  /** World-space position of the chart center [x, y, z]. */
  readonly position: readonly [number, number, number];
  /**
   * V2.1: Entry animation progress from ChartWidget.onTick(). Absent or 1.0 = full size.
   * @default undefined (treated as 1.0)
   */
  readonly entryT?: number;
  /**
   * V2.1: Function accessors from useChartAccessors(). Absent = no override.
   * @default undefined
   */
  readonly accessors?: ChartAccessorFunctions;
  /**
   * Material loader for PBR preset textures. Absent when no @brewsite/textures plugin is active.
   * @default undefined
   */
  readonly materialLoader?: import('@brewsite/core').MaterialLoader;
  /**
   * Material manifest for preset lookup. Absent when no @brewsite/textures plugin is active.
   * @default undefined
   */
  readonly materialManifest?: import('@brewsite/core').MaterialManifest | null;
};

// ─── DSL prop types ─────────────────────────────────────────────────────────

/** Updated V2 ChartDataDSL — source is now optional (inline/async paths don't need it). */
export type ChartDataDSL = {
  readonly source?: string;
  readonly transforms?: readonly DataTransform[];
  readonly filterGroup?: FilterGroupId;
  readonly keyField?: string;
};

/** Updated V2 ChartAxisDSL — includes all new axis control fields. */
export type ChartAxisDSL = {
  readonly axis: 'x' | 'y';
  readonly field: string;
  readonly label?: string;
  readonly format?: string;
  readonly scaleType?: 'linear' | 'log' | 'time' | 'band' | 'sqrt';
  readonly domain?: readonly [number | string, number | string];
  readonly tickCount?: number;
  readonly nice?: boolean;
  readonly clamp?: boolean;
  readonly reverse?: boolean;
  readonly gridlines?: boolean;
  readonly gridlineOpacity?: number;
};

/** Updated V2 ChartSeriesDSL — adds bandField for area charts. */
export type ChartSeriesDSL = {
  readonly field: string;
  readonly label?: string;
  readonly color?: string;
  readonly bandField?: string;
};

/** Updated V2 ChartLegendDSL — adds title, columns, maxItems. */
export type ChartLegendDSL = {
  readonly visible?: boolean;
  readonly position?: LegendPosition;
  readonly title?: string;
  readonly columns?: number;
  readonly maxItems?: number;
};

/** Data labels DSL component props. */
export type ChartDataLabelsDSL = {
  readonly position?: DataLabelsPosition;
  readonly format?: string;
};

/** Reference line DSL component props. */
export type ReferenceLineDSL = {
  readonly axis: 'x' | 'y';
  readonly value: number;
  readonly label?: string;
  readonly color?: string;
};

/** DSL props for <ChartTooltip> child component. */
export type ChartTooltipDSL = {
  /** Enable Y-axis projection beam. Default: false. */
  readonly projection?: boolean;
  /**
   * d3-format string for Y values in the tooltip.
   * @default '.3~s'
   */
  readonly format?: string;
};
