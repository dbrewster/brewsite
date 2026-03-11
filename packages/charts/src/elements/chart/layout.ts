import type { ChartAxisState, ChartSeriesState, FittedMargins } from '../../renderers/shared/IChartRenderer';
import type { ChartLegendState, ChartTypeOptions } from './types';
import type { ChartTheme } from '../../themes/types';

type ChartBounds = {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
};

export type ChartFrame = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type ChartLayout = {
  readonly plotFrame: ChartFrame;
  readonly legendAnchor: { readonly x: number; readonly y: number } | null;
  /**
   * V2.1: Actual fitted margin values in world units.
   * AxesRenderer MUST use these for axis title and tick label positioning.
   * These values may be smaller than raw theme margin values when fitMargins() scaled them.
   */
  readonly fittedMargins: FittedMargins;
};

type ComputeChartLayoutInput = {
  readonly bounds: ChartBounds;
  readonly typeConfig: ChartTypeOptions;
  readonly theme: ChartTheme;
  readonly xAxis: ChartAxisState | null;
  readonly yAxis: ChartAxisState | null;
  readonly series: readonly ChartSeriesState[];
  readonly legend: ChartLegendState | null;
};

const DEFAULT_PAD = 0.12;

function fitMargins(
  total: number,
  start: number,
  end: number,
  minInner: number,
): readonly [number, number] {
  const maxMarginSum = Math.max(0, total - minInner);
  const marginSum = start + end;
  if (marginSum <= maxMarginSum || marginSum === 0) {
    return [start, end] as const;
  }

  const scale = maxMarginSum / marginSum;
  return [start * scale, end * scale] as const;
}

function estimateLegendReserve(
  series: readonly ChartSeriesState[],
  theme: ChartTheme,
): number {
  const labels = series.map((entry) => entry.label ?? entry.field);
  const longestLabel = labels.reduce((maxLen, label) => Math.max(maxLen, label.length), 0);
  const swatch = theme.legend.swatchSize || 0.08;
  const textWidth = longestLabel * theme.legend.fontSize * 0.58;
  return swatch + textWidth + theme.legend.fontSize * 2.6;
}

export function computeChartLayout({
  bounds,
  typeConfig,
  theme,
  xAxis,
  yAxis,
  series,
  legend,
}: ComputeChartLayoutInput): ChartLayout {
  const isCartesian = typeConfig.kind !== 'pie';
  let left = DEFAULT_PAD;
  let right = DEFAULT_PAD;
  let top = DEFAULT_PAD * 0.8;
  let bottom = DEFAULT_PAD;

  if (isCartesian) {
    left = theme.axis.tickLength + theme.axis.gap + theme.axis.fontSize * (yAxis?.label ? 4.1 : 2.5);
    bottom = theme.axis.tickLength + theme.axis.gap + theme.axis.fontSize * (xAxis?.label ? 3.1 : 1.8);
    top = theme.axis.fontSize * 0.7;
    right = theme.axis.fontSize * 0.7;
  }

  if (legend?.visible && series.length > 0) {
    const reserve = estimateLegendReserve(series, theme);
    switch (legend.position) {
      case 'right':
        right += reserve + theme.legend.gap;
        break;
      case 'left':
        left += reserve + theme.legend.gap;
        break;
      case 'top':
        top += theme.legend.gap + theme.legend.spacing * Math.max(series.length, 1) + theme.legend.fontSize * 1.8;
        break;
      case 'bottom':
        bottom += theme.legend.gap + theme.legend.spacing * Math.max(series.length, 1) + theme.legend.fontSize * 1.8;
        break;
    }
  }

  const minPlotWidth = bounds.width * 0.48;   // 48% floor, purely relative — no absolute 0.8 floor
  const minPlotHeight = bounds.height * 0.42; // 42% floor, purely relative

  const [fittedLeft, fittedRight] = fitMargins(bounds.width, left, right, minPlotWidth);
  const [fittedBottom, fittedTop] = fitMargins(bounds.height, bottom, top, minPlotHeight);

  const plotFrame: ChartFrame = {
    x: fittedLeft,
    y: fittedBottom,
    width: Math.max(bounds.width - fittedLeft - fittedRight, 0.01),
    height: Math.max(bounds.height - fittedBottom - fittedTop, 0.01),
  };

  const fittedMargins: FittedMargins = {
    left: fittedLeft,
    right: fittedRight,
    top: fittedTop,
    bottom: fittedBottom,
  };

  if (!legend?.visible) {
    return { plotFrame, legendAnchor: null, fittedMargins };
  }

  const legendPad = theme.legend.gap;
  switch (legend.position) {
    case 'right':
      return {
        plotFrame,
        legendAnchor: {
          x: plotFrame.x + plotFrame.width + legendPad,
          y: plotFrame.y + plotFrame.height / 2,
        },
        fittedMargins,
      };
    case 'left':
      return {
        plotFrame,
        legendAnchor: {
          x: legendPad,
          y: plotFrame.y + plotFrame.height / 2,
        },
        fittedMargins,
      };
    case 'top':
      return {
        plotFrame,
        legendAnchor: {
          x: plotFrame.x + plotFrame.width / 2,
          y: plotFrame.y + plotFrame.height + legendPad,
        },
        fittedMargins,
      };
    case 'bottom':
      return {
        plotFrame,
        legendAnchor: {
          x: plotFrame.x + plotFrame.width / 2,
          y: legendPad,
        },
        fittedMargins,
      };
  }
}
