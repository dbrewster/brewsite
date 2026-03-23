// Pure compilation functions for the chart element — no Three.js, no React render.

import { blendNumber, blendOpacity, validateNVSRect, resolveToNVS, isUniformUnit, resolveAngle } from '@brewsite/core';
import type { FunctionalTransitionSpec, NVSRect, TransitionContext, SceneLength, SceneAngle } from '@brewsite/core';
import { normalizeDataInput } from '../../data/transforms';
import type {
  ChartState,
  ChartType,
  ChartTypeOptions,
  ChartStateDataSource,
  BarChartOptions,
  LineChartOptions,
  ScatterChartOptions,
  PieChartOptions,
  AreaChartOptions,
  HeatMapChartOptions,
  ChartAxisDSL,
  ChartAxisState,
  ChartSeriesDSL,
  ChartSeriesState,
  ChartLegendDSL,
  ChartLegendState,
  LegendPosition,
  ChartDataLabelsDSL,
  ChartDataLabelsState,
  ReferenceLineDSL,
  ReferenceLineState,
  ChartDataDSL,
  ChartTooltipDSL,
} from './types';
import type { ChartTheme } from '../../themes/types';
import { enterpriseChartTheme } from '../../themes/enterprise';
import type { ChartTooltipState } from './tooltip/types';
import type {
  BaseChartDSL,
  BarChartDSL,
  LineChartDSL,
  ScatterPlotChartDSL,
  PieChartDSL,
  AreaChartDSL,
  HeatMapChartDSL,
} from './dsl';

/** Default compiled state. opacity = 1 so charts are visible by default. */
export const DEFAULT_CHART_STATE: ChartState = {
  type: 'bar',
  nvsX: 0.5,
  nvsY: 0.5,
  z: 0,
  rotation: [0, 0, 0],
  bounds: { width: 1.0, height: 1.0, depth: 0.4 },
  uniformSizing: false,
  dataSource: { type: 'named', name: '' },
  transforms: [],
  xAxis: null,
  yAxis: null,
  series: [],
  legend: null,
  theme: enterpriseChartTheme,
  opacity: 1,
  interactive: false,
  sceneTheme: undefined,
  nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
  typeConfig: { kind: 'bar', options: {} },
  enabled: true,
  animateEntry: false,
  animationDuration: 0.4,
  tooltip: null,
};

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** Compiles a ChartAxisDSL to ChartAxisState — internal helper. */
function compileAxisDsl(dsl: ChartAxisDSL): ChartAxisState {
  return {
    axis: dsl.axis,
    field: dsl.field,
    label: dsl.label,
    format: dsl.format,
    scaleType: dsl.scaleType,
    domain: dsl.domain,
    tickCount: dsl.tickCount,
    nice: dsl.nice,
    clamp: dsl.clamp,
    reverse: dsl.reverse,
    gridlines: dsl.gridlines,
    gridlineOpacity: dsl.gridlineOpacity,
  };
}

/** Compiles a ChartLegendDSL to ChartLegendState — internal helper. */
function compileLegendDsl(dsl: ChartLegendDSL): ChartLegendState {
  return {
    visible: dsl.visible ?? true,
    position: (dsl.position ?? 'right') as LegendPosition,
    title: dsl.title,
    columns: dsl.columns,
    maxItems: dsl.maxItems,
  };
}

// ─── Exported Compile Functions ───────────────────────────────────────────────

/**
 * Compiles ChartTooltipDSL to ChartTooltipState.
 * Returns null when dsl is null (no <ChartTooltip> child present).
 * Pure — no Three.js, no React.
 */
export function compileTooltipDsl(dsl: ChartTooltipDSL | null): ChartTooltipState | null {
  if (!dsl) return null;
  return {
    projection: dsl.projection ?? false,
    format: dsl.format,
  };
}

/**
 * Normalizes DSL inline/url/named data props into ChartStateDataSource.
 * Handles columnar→row transposition for inline data.
 * Priority: data > dataUrl > dataDsl.source > empty named.
 * @internal
 */
export function compileDataSource(
  dsl: BaseChartDSL,
  dataDsl: ChartDataDSL | null,
): ChartStateDataSource {
  if (dsl.data !== undefined) {
    const rows = normalizeDataInput(dsl.data);
    if (process.env.NODE_ENV !== 'production' && rows.length > 500) {
      console.warn(
        `[charts] <Chart id="${dsl.id}"> has ${rows.length} inline rows. Consider using dataUrl for large datasets.`,
      );
    }
    return { type: 'inline', rows, keyField: dataDsl?.keyField };
  }

  if (dsl.dataUrl !== undefined) {
    return { type: 'async', url: dsl.dataUrl, format: 'json', keyField: dataDsl?.keyField };
  }

  if (dataDsl?.source) {
    return { type: 'named', name: dataDsl.source, keyField: dataDsl.keyField };
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[charts] <Chart id="${dsl.id}"> has no data source specified. Rendering with empty data until useLiveChartData registers data.`);
  }
  return { type: 'inline', rows: [] };
}

/**
 * Compiles BarChart-specific options from DSL props.
 * Pure — no Three.js, no React.
 */
export function compileBarChartOptions(dsl: BarChartDSL): BarChartOptions {
  return {
    orientation: dsl.orientation,
    stackMode: dsl.stackMode,
    barPadding: dsl.barPadding,
  };
}

/**
 * Compiles LineChart-specific options from DSL props.
 * Pure — no Three.js, no React.
 */
export function compileLineChartOptions(dsl: LineChartDSL): LineChartOptions {
  return {
    lineShape: dsl.lineShape,
    lineSmoothness: dsl.lineSmoothness,
    lineSubdivisions: dsl.lineSubdivisions,
    showPoints: dsl.showPoints,
  };
}

/**
 * Compiles ScatterPlotChart-specific options from DSL props.
 * Pure — no Three.js, no React.
 */
export function compileScatterChartOptions(dsl: ScatterPlotChartDSL): ScatterChartOptions {
  return {
    sizeField: dsl.sizeField,
    colorField: dsl.colorField,
    pointShape: dsl.pointShape,
    sizeScale: dsl.sizeScale,
    colorInterpolator: dsl.colorInterpolator,
  };
}

/**
 * Compiles PieChart-specific options from DSL props.
 * Pure — no Three.js, no React.
 */
export function compilePieChartOptions(dsl: PieChartDSL): PieChartOptions {
  return {
    innerRadius: dsl.innerRadius,
    pieTilt: dsl.pieTilt,
    explodeSlice: dsl.explodeSlice,
  };
}

/**
 * Compiles AreaChart-specific options from DSL props.
 * Pure — no Three.js, no React.
 */
export function compileAreaChartOptions(dsl: AreaChartDSL): AreaChartOptions {
  return {
    stackMode: dsl.stackMode,
    fillOpacity: dsl.fillOpacity,
  };
}

/**
 * Compiles HeatMapChart-specific options from DSL props.
 * Pure — no Three.js, no React.
 */
export function compileHeatMapChartOptions(dsl: HeatMapChartDSL): HeatMapChartOptions {
  return {
    timeField: dsl.timeField,
    heightField: dsl.heightField,
    colorInterpolator: dsl.colorInterpolator,
  };
}

/**
 * Compiles ChartState from V2 DSL components.
 * Pure function — no side effects, no Three.js.
 *
 * nvsX and nvsY are derived from nvsBounds center (x + w/2, y + h/2).
 * World-space position is computed at render time in ChartWidget.apply().
 *
 * @param dsl               Base props shared across all chart types
 * @param kind              The chart type ('bar'|'line'|...) — from the specific DSL component
 * @param typeOptions       Already-compiled ChartTypeOptions (from compileXxxChartOptions())
 * @param dataDsl           Compiled <ChartData> child props, or null
 * @param axisDsls          All <ChartAxis> children props
 * @param seriesDsls        All <ChartSeries> children props
 * @param legendDsl         <ChartLegend> child props, or null
 * @param dataLabelsDsl     <ChartDataLabels> child props, or null
 * @param referenceLineDsls All <ReferenceLine> children props
 * @param tooltipDsl        <ChartTooltip> child props, or null
 * @param resolvedTheme     Resolved ChartTheme object — passed in from the NodeHandler via chartThemeRegistry.
 *                          Defaults to DEFAULT_CHART_STATE.theme (enterpriseChartTheme) when absent.
 * @param composeBoundsFn   Optional function to compose local NVS rect into parent view/region space.
 *                          When absent, local bounds are used as-is (identity behavior).
 * @param composeZFn        Optional function to compose local Z into accumulated parent Z offset.
 *                          When absent, local Z is used as-is (identity behavior).
 * @param composeOpacityFn  Optional function to compose local opacity with parent view opacity.
 *                          When absent, local opacity is used as-is (identity behavior).
 */
export function compileChart(
  dsl: BaseChartDSL,
  kind: ChartType,
  typeOptions: ChartTypeOptions,
  dataDsl: ChartDataDSL | null,
  axisDsls: readonly ChartAxisDSL[],
  seriesDsls: readonly ChartSeriesDSL[],
  legendDsl: ChartLegendDSL | null,
  dataLabelsDsl: ChartDataLabelsDSL | null,
  referenceLineDsls: readonly ReferenceLineDSL[],
  tooltipDsl: ChartTooltipDSL | null = null,
  resolvedTheme: ChartTheme = DEFAULT_CHART_STATE.theme,
  composeBoundsFn?: (localRect: NVSRect) => NVSRect,
  composeZFn?: (localZ: number) => number,
  composeOpacityFn?: (localOpacity: number) => number,
): ChartState {
  const xAxisDsl = axisDsls.find((a) => a.axis === 'x') ?? null;
  const yAxisDsl = axisDsls.find((a) => a.axis === 'y') ?? null;

  // Resolve SceneLength DSL values to NVS fractions
  const x = dsl.x !== undefined ? resolveToNVS(dsl.x) : 0;
  const y = dsl.y !== undefined ? resolveToNVS(dsl.y) : 0;
  const w = dsl.w !== undefined ? resolveToNVS(dsl.w) : 1;
  const h = dsl.h !== undefined ? resolveToNVS(dsl.h) : 1;
  const localBounds: NVSRect = { x, y, w, h };

  // Determine uniformSizing: true if any size/position prop uses the `u` unit
  const uniformSizing =
    (dsl.w !== undefined && isUniformUnit(dsl.w)) ||
    (dsl.h !== undefined && isUniformUnit(dsl.h)) ||
    (dsl.x !== undefined && isUniformUnit(dsl.x)) ||
    (dsl.y !== undefined && isUniformUnit(dsl.y));

  // Compose into parent view/region if present. Identity when no parent.
  const nvsBounds: NVSRect = composeBoundsFn ? composeBoundsFn(localBounds) : localBounds;

  const boundsDepth = dsl.depth ?? 0.4;

  if (process.env.NODE_ENV !== 'production') {
    validateNVSRect(nvsBounds, `<Chart id="${dsl.id}">`);
  }

  const dataSource = compileDataSource(dsl, dataDsl);

  const xAxis: ChartAxisState | null = xAxisDsl ? compileAxisDsl(xAxisDsl) : null;
  const yAxis: ChartAxisState | null = yAxisDsl ? compileAxisDsl(yAxisDsl) : null;

  const series: readonly ChartSeriesState[] = seriesDsls.map((s) => ({
    field: s.field,
    label: s.label,
    color: s.color,
    bandField: s.bandField,
  }));

  const legend: ChartLegendState | null = legendDsl ? compileLegendDsl(legendDsl) : null;

  const dataLabels: ChartDataLabelsState | undefined = dataLabelsDsl
    ? { position: dataLabelsDsl.position ?? 'top', format: dataLabelsDsl.format }
    : undefined;

  const referenceLines: ReadonlyArray<ReferenceLineState> | undefined =
    referenceLineDsls.length > 0
      ? referenceLineDsls.map((r) => ({
          axis: r.axis,
          value: r.value,
          label: r.label,
          color: r.color,
        }))
      : undefined;

  // Compose local Z with parent view/layout Z offset (carousel zStep, nested views, etc.)
  const localZ = dsl.z ?? 0;
  const composedZ = composeZFn ? composeZFn(localZ) : localZ;

  // Compose local opacity with parent view opacity (carousel fade, nested views, etc.)
  const localOpacity = dsl.opacity ?? 1;
  const composedOpacity = composeOpacityFn ? composeOpacityFn(localOpacity) : localOpacity;

  // Resolve rotation angles (SceneAngle → radians)
  const rotation: readonly [number, number, number] = dsl.rotation
    ? [resolveAngle(dsl.rotation[0]), resolveAngle(dsl.rotation[1]), resolveAngle(dsl.rotation[2])]
    : DEFAULT_CHART_STATE.rotation;

  return {
    type: kind,
    nvsX: nvsBounds.x + nvsBounds.w / 2,
    nvsY: nvsBounds.y + nvsBounds.h / 2,
    z: composedZ,
    rotation,
    bounds: {
      width: nvsBounds.w,
      height: nvsBounds.h,
      depth: boundsDepth,
    },
    uniformSizing,
    dataSource,
    transforms: dataDsl?.transforms ?? [],
    filterGroup: dataDsl?.filterGroup,
    xAxis,
    yAxis,
    series,
    referenceLines,
    legend,
    theme: resolvedTheme,
    opacity: composedOpacity,
    interactive: dsl.interactive ?? false,
    nvsBounds,
    typeConfig: typeOptions,
    dataLabels,
    gridlines: dsl.gridlines,
    enabled: true,
    animateEntry: dsl.animateEntry ?? false,
    animationDuration: Math.min(Math.max(dsl.animationDuration ?? 0.4, 0.01), 1.0),
    tooltip: compileTooltipDsl(tooltipDsl),
  };
}

/**
 * FunctionalTransitionSpec for ChartState.
 *
 * Uses FunctionalTransitionSpec (not ElementTransitionSpec) because:
 * - Chart transitions are mathematically clean closures (opacity fade, position blend)
 * - Runtime data-resolve cost means lazy evaluation is preferred over pre-baking
 * - Consistent with how @brewsite/diagram handles its element transitions
 *
 * V2 additions:
 * - _morphT is injected so ChartRenderer can build MorphContext during keyField transitions
 * - when chart type/config/theme changes, transitions defer structural switch until scene boundary
 * - defaultWindow: { exit: [0,0], enter: [0,0] } — charts update instantly by default.
 *   Scene-level transition={{ exit: [...], enter: [...] }} overrides this when morphing is wanted.
 */
export const functionalChartTransitionSpec: FunctionalTransitionSpec<ChartState> = {
  /**
   * exit: [0.9,1.0] — leaving charts fade out in the last 10% of the transition block.
   * enter: [0,0] — redundant (degenerate windows are treated as unset by the compiler,
   *   falling through to the system default [0.9,1.0] for a cross-dissolve).
   * These defaults apply only when the scene has no explicit transition={{ exit:[…], enter:[…] }}.
   * Charts present in both adjacent scenes use interpolateFn over [0,1] — defaultWindow has no effect.
   */
  defaultWindow: { exit: [0.9, 1.0], enter: [0.0, 0.0] },

  exitFn: (from: ChartState) => (ctx: TransitionContext): ChartState => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, ctx.t) ?? 0,
  }),

  enterFn: (to: ChartState) => (ctx: TransitionContext): ChartState => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, ctx.t) ?? to.opacity,
  }),

  interpolateFn: (from: ChartState, to: ChartState) => {
    const typeChanged = from.type !== to.type;
    const typeConfigChanged = JSON.stringify(from.typeConfig) !== JSON.stringify(to.typeConfig);
    const sceneThemeChanged = from.sceneTheme !== to.sceneTheme;
    const needsDeferredSwitch = typeChanged || typeConfigChanged || sceneThemeChanged;

    return (ctx: TransitionContext): ChartState => {
      if (!needsDeferredSwitch) {
        return {
          ...to,
          nvsX: blendNumber(from.nvsX, to.nvsX, ctx.t) ?? to.nvsX,
          nvsY: blendNumber(from.nvsY, to.nvsY, ctx.t) ?? to.nvsY,
          z: blendNumber(from.z, to.z, ctx.t) ?? to.z,
          bounds: {
            width: blendNumber(from.bounds.width, to.bounds.width, ctx.t) ?? to.bounds.width,
            height: blendNumber(from.bounds.height, to.bounds.height, ctx.t) ?? to.bounds.height,
            depth: blendNumber(from.bounds.depth, to.bounds.depth, ctx.t) ?? to.bounds.depth,
          },
          opacity: blendOpacity(from.opacity, to.opacity, ctx.t) ?? to.opacity,
          // Internal: inject t so ChartRenderer can build MorphContext for datum-level morphing
          _morphT: ctx.t,
          // Internal: carry the "from" scene's data source so ChartRenderer can resolve
          // morph origin data regardless of scroll direction (fixes reverse morph bug)
          _morphFromDataSource: from.dataSource,
          _morphFromTransforms: from.transforms,
        };
      }

      // For structural chart changes (type/config/theme), keep current scene chart
      // until the boundary and then switch to the next scene chart.
      return ctx.t < 1
        ? { ...from, _morphT: undefined }
        : { ...to, _morphT: undefined };
    };
  },
};
