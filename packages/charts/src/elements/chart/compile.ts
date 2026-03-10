// Pure compilation functions for the chart element — no Three.js, no React render.

import { blendNumber, blendOpacity, validateNVSScalar, validateNVSRect } from '@brewsite/core';
import type { FunctionalTransitionSpec, NVSRect } from '@brewsite/core';
import type {
  ChartState,
  ChartDSL,
  ChartDataDSL,
  ChartAxisDSL,
  ChartSeriesDSL,
  ChartLegendDSL,
  LegendPosition,
} from './types';
import { DEFAULT_CHART_STATE } from './types';

/**
 * Compiles ChartState from DSL components.
 * Pure function — no side effects, no Three.js.
 *
 * nvsX and nvsY are derived from nvsBounds center (x + w/2, y + h/2).
 * World-space position is computed at render time in ChartWidget.apply().
 */
export function compileChart(
  dsl: Partial<ChartDSL>,
  dataDsl: ChartDataDSL | null,
  axisDsls: readonly ChartAxisDSL[],
  seriesDsls: readonly ChartSeriesDSL[],
  legendDsl: ChartLegendDSL | null,
): ChartState {
  const xAxisDsl = axisDsls.find((a) => a.axis === 'x') ?? null;
  const yAxisDsl = axisDsls.find((a) => a.axis === 'y') ?? null;

  const x = dsl.x ?? 0;
  const y = dsl.y ?? 0;
  const w = dsl.w ?? 1;
  const h = dsl.h ?? 1;

  const nvsBounds: NVSRect = { x, y, w, h };

  // bounds.width/height are NVS fractions [0..1] defaulting to nvsBounds.w/h
  const boundsWidth = dsl.bounds?.width ?? w;
  const boundsHeight = dsl.bounds?.height ?? h;
  const boundsDepth = dsl.bounds?.depth ?? 0.4;

  if (process.env.NODE_ENV !== 'production') {
    validateNVSScalar(boundsWidth, 'bounds.width', `<Chart id="${dsl.id}">`);
    validateNVSScalar(boundsHeight, 'bounds.height', `<Chart id="${dsl.id}">`);
    validateNVSRect(nvsBounds, `<Chart id="${dsl.id}">`);
  }

  return {
    type: dsl.type ?? DEFAULT_CHART_STATE.type,
    nvsX: x + w / 2,
    nvsY: y + h / 2,
    z: dsl.z ?? 0,
    rotation: dsl.rotation ?? DEFAULT_CHART_STATE.rotation,
    bounds: {
      width: boundsWidth,
      height: boundsHeight,
      depth: boundsDepth,
    },
    dataSource: dataDsl?.source ?? dsl.dataSource ?? '',
    transforms: dataDsl?.transforms ?? [],
    filterGroup: dataDsl?.filterGroup,
    timeField: dataDsl?.timeField,
    xAxis: xAxisDsl
      ? { axis: 'x', field: xAxisDsl.field, label: xAxisDsl.label, format: xAxisDsl.format }
      : null,
    yAxis: yAxisDsl
      ? { axis: 'y', field: yAxisDsl.field, label: yAxisDsl.label, format: yAxisDsl.format }
      : null,
    series: seriesDsls.map((s) => ({
      field: s.field,
      label: s.label,
      color: s.color,
    })),
    legend: legendDsl
      ? {
          visible: legendDsl.visible ?? true,
          position: (legendDsl.position ?? 'right') as LegendPosition,
        }
      : null,
    theme: dsl.theme ?? 'darkGlass',
    opacity: dsl.opacity ?? 1,
    interactive: dsl.interactive ?? false,
    innerRadius: dsl.innerRadius ?? 0,
    sceneTheme: dsl.sceneTheme,
    nvsBounds,
  };
}

/**
 * FunctionalTransitionSpec for ChartState.
 *
 * Uses FunctionalTransitionSpec (not ElementTransitionSpec) because:
 * - Chart transitions are mathematically clean closures (opacity fade, position blend)
 * - Runtime data-resolve cost means lazy evaluation is preferred over pre-baking
 * - Consistent with how @brewsite/diagram handles its element transitions
 */
export const functionalChartTransitionSpec: FunctionalTransitionSpec<ChartState> = {
  exitFn: (from: ChartState) => (ctx): ChartState => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, ctx.t) ?? 0,
  }),

  enterFn: (to: ChartState) => (ctx): ChartState => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, ctx.t) ?? to.opacity,
  }),

  interpolateFn: (from: ChartState, to: ChartState) => (ctx): ChartState => ({
    ...to,
    nvsX: blendNumber(from.nvsX, to.nvsX, ctx.t) ?? to.nvsX,
    nvsY: blendNumber(from.nvsY, to.nvsY, ctx.t) ?? to.nvsY,
    z: blendNumber(from.z, to.z, ctx.t) ?? to.z,
    opacity: blendOpacity(from.opacity, to.opacity, ctx.t) ?? to.opacity,
    // Discrete switch at midpoint: preserve from.type during first half, switch to to.type at 0.5
    type: ctx.t < 0.5 ? from.type : to.type,
    // Discrete switch at midpoint: font transitions don't benefit from interpolation
    sceneTheme: ctx.t < 0.5 ? from.sceneTheme : to.sceneTheme,
  }),
};
