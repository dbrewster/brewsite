// IChartRenderer — interface every chart-type renderer implements (V2).

import type * as THREE from 'three';
import type { DataRow, ResolvedDataFrame } from '../../data/types';
import type { ChartTheme } from '../../themes/types';

// ─── V2.1: Accessor functions ──────────────────────────────────────────────

/**
 * V2.1: Function-based data accessors registered by useChartAccessors().
 * These bypass the SceneTrack and override field-name-based value lookup in renderers.
 * Defined here (shared renderer type hub) so both renderers and the plugin layer can import
 * this type without creating a circular dependency.
 */
export type ChartAccessorFunctions = {
  /** Accessor for the X axis numeric channel. Overrides Number(row[xField]). */
  readonly xAccessor?: (row: DataRow) => number;
  /** Accessor for the Y axis numeric channel. Overrides Number(row[yField]). */
  readonly yAccessor?: (row: DataRow) => number;
  /** Accessor for the size channel (scatter). Overrides Number(row[sizeField]). */
  readonly sizeAccessor?: (row: DataRow) => number;
  /** Accessor for the color channel (scatter). Overrides field lookup. */
  readonly colorAccessor?: (row: DataRow) => number | string;
};

// ─── V2.1: Fitted margins ─────────────────────────────────────────────────

/**
 * V2.1: Actual margin values produced by fitMargins() in computeChartLayout().
 * These may be smaller than raw theme values when the chart is narrow.
 * AxesRenderer uses these for all axis decoration positioning — not raw theme margin values.
 * Defined here (shared renderer type hub) so both layout.ts and AxesRenderer.ts can import it
 * without creating a circular dependency.
 */
export type FittedMargins = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

// ─── Re-exported axis/series state (canonical definitions — elements/chart/types imports these) ─

/** Axis state — pre-computed scale domain/range for one axis. V2 adds scale control fields. */
export type ChartAxisState = {
  readonly axis: 'x' | 'y';
  readonly field: string;
  readonly label?: string;
  readonly format?: string;
  readonly domain?: readonly [number | string, number | string];
  // V2 additions:
  readonly scaleType?: 'linear' | 'log' | 'time' | 'band' | 'sqrt';
  readonly tickCount?: number;
  readonly nice?: boolean;
  readonly clamp?: boolean;
  readonly reverse?: boolean;
  readonly gridlines?: boolean;
  readonly gridlineOpacity?: number;
};

/** State for one data series within a chart. V2 adds bandField for area band variant. */
export type ChartSeriesState = {
  readonly field: string;
  readonly label?: string;
  readonly color?: string;
  /** For area band variant: name of the lower-bound field. */
  readonly bandField?: string;
};

// ─── Legend ──────────────────────────────────────────────────────────────────

/** Legend position. */
export type LegendPosition = 'right' | 'bottom' | 'top' | 'left';

/**
 * Compiled legend state — V2 adds title, columns, maxItems.
 */
export type ChartLegendState = {
  readonly visible: boolean;
  readonly position: LegendPosition;
  readonly title?: string;
  readonly columns?: number;
  readonly maxItems?: number;
};

// ─── Type-specific options (Q7/Q8 resolution) ─────────────────────────────

/** Rendered profile shape for line charts. */
export type ChartLineShape = 'circle' | 'triangle' | 'hexagon' | 'heptagon' | 'octagon' | 'line';

/** Bar chart type-specific options. */
export type BarChartOptions = {
  readonly orientation?: 'vertical' | 'horizontal';
  readonly stackMode?: 'grouped' | 'stacked';
  /** Padding ratio between bar groups [0..1]. Default from theme. */
  readonly barPadding?: number;
};

/** Line chart type-specific options. */
export type LineChartOptions = {
  readonly lineShape?: ChartLineShape;
  readonly lineSmoothness?: number;
  readonly lineSubdivisions?: number;
  readonly showPoints?: boolean;
};

/** Scatter plot type-specific options. */
export type ScatterChartOptions = {
  readonly sizeField?: string;
  readonly colorField?: string;
  readonly pointShape?: 'sphere' | 'cube' | 'cylinder';
  /** World-space radius scale range for sizeField encoding. */
  readonly sizeScale?: { readonly min: number; readonly max: number };
  /** Color interpolator for continuous numeric colorField values. */
  readonly colorInterpolator?: 'blues' | 'reds' | 'viridis' | 'plasma';
};

/** Pie/donut chart type-specific options. */
export type PieChartOptions = {
  /** [0..1] — 0 = pie, >0 = donut. Default: 0. */
  readonly innerRadius?: number;
  readonly pieTilt?: number;
  /** x-axis field value of the slice to push outward. */
  readonly explodeSlice?: string;
};

/** Area chart type-specific options. */
export type AreaChartOptions = {
  readonly stackMode?: 'none' | 'stacked';
  readonly fillOpacity?: number;
};

/** Heatmap chart type-specific options. */
export type HeatMapChartOptions = {
  readonly timeField?: string;
  readonly heightField?: string;
  readonly colorInterpolator?: 'blues' | 'reds' | 'viridis' | 'plasma';
};

/**
 * Discriminated union of per-chart-type options.
 * `kind` matches ChartState.type. Renderers pattern-match on `kind`.
 */
export type ChartTypeOptions =
  | { readonly kind: 'bar';     readonly options: BarChartOptions }
  | { readonly kind: 'line';    readonly options: LineChartOptions }
  | { readonly kind: 'scatter'; readonly options: ScatterChartOptions }
  | { readonly kind: 'pie';     readonly options: PieChartOptions }
  | { readonly kind: 'area';    readonly options: AreaChartOptions }
  | { readonly kind: 'heatmap'; readonly options: HeatMapChartOptions };

// ─── Data labels (Q8 resolution) ─────────────────────────────────────────

/** Position of data value labels relative to geometry. */
export type DataLabelsPosition = 'top' | 'center' | 'outside';

/** Compiled data label display state. */
export type ChartDataLabelsState = {
  readonly position: DataLabelsPosition;
  /** d3-format string. Default: '.0f'. */
  readonly format?: string;
};

// ─── Reference lines ──────────────────────────────────────────────────────

/** A single reference line drawn on one axis at a given value. */
export type ReferenceLineState = {
  readonly axis: 'x' | 'y';
  readonly value: number;
  readonly label?: string;
  readonly color?: string;
};

// ─── Morph context (Q3 resolution) ───────────────────────────────────────

/**
 * Q3 Resolution: Datum morphing context.
 * Present in ChartRenderContext only when keyField is set on both the from- and
 * to-state data sources and both have data. Renderers that don't implement
 * morphing safely ignore this field.
 */
export type MorphContext = {
  readonly fromData: ResolvedDataFrame;
  // toData intentionally omitted — renderers use ctx.data for the to-state (Challenge 11).
  readonly t: number;
  readonly keyField: string;
};

// ─── Data label entry (Q8 resolution) ────────────────────────────────────

/**
 * Q8 Resolution: Single entry for DataLabelRenderer.
 * Per-type renderers compute these from geometry; shared DataLabelRenderer renders them.
 */
export type DataLabelAlignment = 'above' | 'center' | 'outside';

export type DataLabelEntry = {
  readonly position: THREE.Vector3;
  readonly text: string;
  readonly alignment: DataLabelAlignment;
};

// ─── Hit info ─────────────────────────────────────────────────────────────

/**
 * Typed per-chart-kind hover metadata.
 * Discriminated on `kind` — matches ChartType.
 * Populated by each renderer's resolveHoverInfo().
 */
export type ChartHitMeta =
  | {
      readonly kind: 'bar';
      /** Label of the hovered series (from ChartSeriesState.label or field). */
      readonly seriesLabel: string;
      /** Stack group key when stackMode='stacked'. */
      readonly stackGroup?: string;
      /** The hovered segment's own value (not the cumulative stack top). */
      readonly segmentValue: number;
      /** Sum of all series values for this datum. Absent for grouped bars. */
      readonly stackTotal?: number;
    }
  | {
      readonly kind: 'line';
      readonly seriesLabel: string;
      /** The Y-axis value at the hit point — from row[yAxis.field]. */
      readonly yValue: number;
    }
  | {
      readonly kind: 'area';
      readonly seriesLabel: string;
      /** The Y-axis value at the hit point — from row[yAxis.field]. */
      readonly yValue: number;
      /** Cumulative stack value at this point, when stackMode='stacked'. */
      readonly stackValue?: number;
    }
  | {
      readonly kind: 'scatter';
      /** The X-axis numeric value at the hit point. */
      readonly xValue: number;
      /** Size encoding value (from sizeField). */
      readonly sizeValue?: number;
      /** Color encoding value (from colorField). */
      readonly colorValue?: number | string;
    }
  | {
      readonly kind: 'pie';
      /** The category label for the hovered slice. */
      readonly sliceName: string;
      /** Percentage of total this slice represents [0..100]. */
      readonly percentage: number;
      /** Sum of all slice values. */
      readonly total: number;
    }
  | {
      readonly kind: 'heatmap';
      /** Normalized intensity value [0..1] at the hit cell. */
      readonly intensity: number;
      /** Row label (Y-axis category). */
      readonly rowLabel: string;
      /** Column label (X-axis category). */
      readonly columnLabel: string;
    };

/** Hit information returned by hover/click raycasting. */
export type ChartHitInfo = {
  readonly seriesIndex: number;
  readonly datumIndex: number;
  readonly row: Record<string, unknown>;
  /** World-space hit point [x, y, z]. */
  readonly point: readonly [number, number, number];
  /**
   * Typed per-chart-kind metadata for rich tooltip rendering.
   * Populated by each renderer's resolveHoverInfo().
   */
  readonly meta?: ChartHitMeta;
  /**
   * World-space terminus for the Y-axis projection beam.
   * The point on the Y-axis face at the same Y and Z height as the hit point.
   * Formula: [chartGroup.position.x + plotFrame.x, point[1], point[2]]
   * Present for bar, line, area, scatter. Absent for pie, heatmap.
   * Beam is drawn IFF this field is non-null.
   */
  readonly projectionTarget?: readonly [number, number, number];
};

// ─── Render context ───────────────────────────────────────────────────────

/**
 * V2 render context — passed to every IChartRenderer.update() call.
 *
 * Breaking changes from V1: typeOptions replaces flat lineShape/pieTilt/etc.,
 * morphCtx added (optional), dataLabels added, referenceLines added,
 * gridlines added, legend field added (Challenge 1+2 fix).
 *
 * All fields defined here in Phase 0-B so Stream 4 (LegendRenderer) does NOT
 * need to modify this file. All fields are final after Phase 0-B.
 */
export type ChartRenderContext = {
  readonly seriesGroup: THREE.Group;
  readonly axesGroup: THREE.Group;
  readonly legendGroup: THREE.Group;
  readonly chartPosition?: readonly [number, number, number];
  /**
   * Current/to-state data. Renderers use this for all normal rendering.
   * When morphCtx is present, this IS the to-state data — morphCtx.fromData
   * holds the from-state. No separate toData field on MorphContext (Challenge 11).
   */
  readonly data: ResolvedDataFrame;
  readonly xAxis: ChartAxisState | null;
  readonly yAxis: ChartAxisState | null;
  readonly series: readonly ChartSeriesState[];
  readonly referenceLines?: ReadonlyArray<ReferenceLineState>;
  /** V2: Legend state — used by LegendRenderer.update() for title, columns, maxItems. */
  readonly legend: ChartLegendState | null;
  readonly bounds: { readonly width: number; readonly height: number; readonly depth: number };
  readonly theme: ChartTheme;
  readonly opacity: number;
  /** V2: Replaces flat lineShape, lineSmoothness, innerRadius, pieTilt, timeField, etc. */
  readonly typeOptions: ChartTypeOptions;
  /** V2: Non-null when <ChartDataLabels> is present in the DSL. */
  readonly dataLabels: ChartDataLabelsState | null;
  /** V2: Per-chart gridlines override (null = use axis-level settings). */
  readonly gridlines: boolean | null;
  readonly fontUrl?: string;
  /**
   * Q3 Resolution: Present only during keyField-based datum-morphing transitions.
   * Built solely inside ChartRenderer.update() — NOT in ChartWidget.apply().
   * Renderers that don't implement morphing ignore this field — they render `data` as-is.
   * Implementing renderers use morphCtx.fromData (from) and ctx.data (to).
   */
  readonly morphCtx?: MorphContext;
  /**
   * V2.1: Entry animation progress [0..1].
   * Present only when animateEntry=true and the animation is in progress.
   * Absent (or 1.0) = geometry at full size. Currently consumed by BarRenderer only.
   * @default undefined (treated as 1.0 — fully rendered)
   */
  readonly entryT?: number;
  /**
   * V2.1: Function accessors from useChartAccessors(). May override field-name lookups.
   * Renderers check for accessors before falling back to Number(row[field]).
   * @default undefined (no override — field-name lookup applies)
   */
  readonly accessors?: ChartAccessorFunctions;
  /**
   * V2.1: Fitted margin values from computeChartLayout().
   * Passed to AxesRenderer for axis title positioning.
   * Absent for renderers that have not yet been migrated to the bounding-fix path.
   */
  readonly fittedMargins?: FittedMargins;
  /**
   * Offset of the plot frame within chartGroup local space.
   * plotFrameOffset.x is the X position of the Y-axis face in chartGroup coordinates.
   * World-space Y-axis X = chartPosition[0] + plotFrameOffset.x
   * Required by renderers to compute projectionTarget.
   * @default undefined — renderers that don't need it ignore this field
   */
  readonly plotFrameOffset?: { readonly x: number; readonly y: number };
};

// ─── Interface ────────────────────────────────────────────────────────────

/**
 * Interface every chart-type renderer (Bar, Line, Area, Pie, Scatter, Heatmap) implements.
 *
 * Lifecycle:
 * 1. `update(ctx)` — called each frame with current compiled state and resolved data.
 * 2. `getInteractiveObjects()` — called once per frame for raycasting.
 * 3. `resolveHoverInfo(intersection, data)` — called when a ray hit is detected.
 * 4. `dispose()` — called when the widget is destroyed or chart type changes.
 */
export interface IChartRenderer {
  /** Update (or initially create) all Three.js geometry for the current data/state. */
  update(ctx: ChartRenderContext): void;
  /** Release all Three.js resources owned by this renderer. */
  dispose(): void;
  /** Returns Three.js objects eligible for interactive raycasting. */
  getInteractiveObjects(): THREE.Object3D[];
  /** Resolves a raycaster intersection to a ChartHitInfo, or null if not applicable. */
  resolveHoverInfo(intersection: THREE.Intersection, data: ResolvedDataFrame): ChartHitInfo | null;
}
