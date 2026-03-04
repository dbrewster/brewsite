// Pure compilation functions for the chart element — no Three.js, no React render.

import { blendOpacity, blendVec3 } from '@brewsite/core';
import type { FunctionalTransitionSpec } from '@brewsite/core';
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

  return {
    type: dsl.type ?? DEFAULT_CHART_STATE.type,
    position: dsl.position ?? DEFAULT_CHART_STATE.position,
    rotation: dsl.rotation ?? DEFAULT_CHART_STATE.rotation,
    bounds: {
      width: dsl.bounds?.width ?? DEFAULT_CHART_STATE.bounds.width,
      height: dsl.bounds?.height ?? DEFAULT_CHART_STATE.bounds.height,
      depth: dsl.bounds?.depth ?? DEFAULT_CHART_STATE.bounds.depth,
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
    sceneTheme: dsl.sceneTheme,  // pass through from DSL
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
 * Uses ctx.t for all channels (zero behavior change from old scalar-t path).
 * Scene authors may add <Transition channels={['opacity']} ...> children to the
 * <Chart> DSL element to activate per-channel window/ease control.
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
    position: (blendVec3(
      from.position as [number, number, number],
      to.position as [number, number, number],
      ctx.t,
    ) ?? to.position) as readonly [number, number, number],
    rotation: (blendVec3(
      from.rotation as [number, number, number],
      to.rotation as [number, number, number],
      ctx.t,
    ) ?? to.rotation) as readonly [number, number, number],
    opacity: blendOpacity(from.opacity, to.opacity, ctx.t) ?? to.opacity,
    // Discrete switch at midpoint: preserve from.type during first half, switch to to.type at 0.5
    type: ctx.t < 0.5 ? from.type : to.type,
    // Discrete switch at midpoint: font transitions don't benefit from interpolation
    sceneTheme: ctx.t < 0.5 ? from.sceneTheme : to.sceneTheme,
  }),
};
