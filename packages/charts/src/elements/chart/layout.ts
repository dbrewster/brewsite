import type { ChartAxisState, ChartSeriesState } from '../../renderers/shared/IChartRenderer';
import type { ChartLegendState, ChartType } from './types';
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
};

type ComputeChartLayoutInput = {
  readonly bounds: ChartBounds;
  readonly type: ChartType;
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
  type,
  theme,
  xAxis,
  yAxis,
  series,
  legend,
}: ComputeChartLayoutInput): ChartLayout {
  const isCartesian = type !== 'pie';
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

  const minPlotWidth = Math.max(bounds.width * 0.48, 0.8);
  const minPlotHeight = Math.max(bounds.height * 0.42, 0.6);
  [left, right] = fitMargins(bounds.width, left, right, minPlotWidth);
  [bottom, top] = fitMargins(bounds.height, bottom, top, minPlotHeight);

  const plotFrame: ChartFrame = {
    x: left,
    y: bottom,
    width: Math.max(bounds.width - left - right, 0.01),
    height: Math.max(bounds.height - bottom - top, 0.01),
  };

  if (!legend?.visible) {
    return { plotFrame, legendAnchor: null };
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
      };
    case 'left':
      return {
        plotFrame,
        legendAnchor: {
          x: legendPad,
          y: plotFrame.y + plotFrame.height / 2,
        },
      };
    case 'top':
      return {
        plotFrame,
        legendAnchor: {
          x: plotFrame.x + plotFrame.width / 2,
          y: plotFrame.y + plotFrame.height + legendPad,
        },
      };
    case 'bottom':
      return {
        plotFrame,
        legendAnchor: {
          x: plotFrame.x + plotFrame.width / 2,
          y: legendPad,
        },
      };
  }
}
