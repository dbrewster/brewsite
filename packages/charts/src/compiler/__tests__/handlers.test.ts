import { describe, it, expect, beforeEach } from 'vitest';
import { registerChartHandlers, resetChartHandlerRegistrationForTesting } from '../handlers';
import {
  ChartData, ChartAxis, ChartSeries, ChartLegend,
  ChartDataLabels, ReferenceLine,
  BarChart, LineChart, ScatterPlotChart, PieChart, AreaChart, HeatMapChart,
} from '../../elements/chart/stubs';

// Access registry internals via direct source import for testing only.
// In production, only registerNode is used.
import { getNodeHandler, clearRegistry } from '@brewsite/core/compiler/registry';

describe('registerChartHandlers', () => {
  beforeEach(() => {
    clearRegistry();
    resetChartHandlerRegistrationForTesting();
  });

  it('registers guard handlers for all child components', () => {
    registerChartHandlers();
    expect(getNodeHandler(ChartData)).toBeDefined();
    expect(getNodeHandler(ChartAxis)).toBeDefined();
    expect(getNodeHandler(ChartSeries)).toBeDefined();
    expect(getNodeHandler(ChartLegend)).toBeDefined();
    expect(getNodeHandler(ChartDataLabels)).toBeDefined();
    expect(getNodeHandler(ReferenceLine)).toBeDefined();
  });

  it('registers guard handlers for all per-type chart components', () => {
    registerChartHandlers();
    expect(getNodeHandler(BarChart)).toBeDefined();
    expect(getNodeHandler(LineChart)).toBeDefined();
    expect(getNodeHandler(ScatterPlotChart)).toBeDefined();
    expect(getNodeHandler(PieChart)).toBeDefined();
    expect(getNodeHandler(AreaChart)).toBeDefined();
    expect(getNodeHandler(HeatMapChart)).toBeDefined();
  });

  it('is idempotent — safe to call multiple times', () => {
    registerChartHandlers();
    registerChartHandlers();
    // If this would throw (double-registration error), the test would fail.
    expect(getNodeHandler(ChartData)).toBeDefined();
  });

  it('ChartData guard handler throws with descriptive message', () => {
    registerChartHandlers();
    const handler = getNodeHandler(ChartData)!;
    expect(() => handler({} as never, {} as never, {} as never)).toThrow(
      '<ChartData> must be nested inside a chart component',
    );
  });

  it('ChartAxis guard handler throws with descriptive message', () => {
    registerChartHandlers();
    const handler = getNodeHandler(ChartAxis)!;
    expect(() => handler({} as never, {} as never, {} as never)).toThrow(
      '<ChartAxis> must be nested inside a chart component',
    );
  });

  it('ChartSeries guard handler throws with descriptive message', () => {
    registerChartHandlers();
    const handler = getNodeHandler(ChartSeries)!;
    expect(() => handler({} as never, {} as never, {} as never)).toThrow(
      '<ChartSeries> must be nested inside a chart component',
    );
  });

  it('ChartLegend guard handler throws with descriptive message', () => {
    registerChartHandlers();
    const handler = getNodeHandler(ChartLegend)!;
    expect(() => handler({} as never, {} as never, {} as never)).toThrow(
      '<ChartLegend> must be nested inside a chart component',
    );
  });

  it('ChartDataLabels guard handler throws when compiled outside chart context', () => {
    registerChartHandlers();
    const handler = getNodeHandler(ChartDataLabels)!;
    expect(() => handler({} as never, {} as never, {} as never)).toThrow(
      '<ChartDataLabels> must be nested inside a chart component',
    );
  });

  it('ReferenceLine guard handler throws when compiled outside chart context', () => {
    registerChartHandlers();
    const handler = getNodeHandler(ReferenceLine)!;
    expect(() => handler({} as never, {} as never, {} as never)).toThrow(
      '<ReferenceLine> must be nested inside a chart component',
    );
  });

  it('BarChart guard handler throws when used before plugin init', () => {
    registerChartHandlers();
    const handler = getNodeHandler(BarChart)!;
    expect(() => handler({} as never, {} as never, {} as never)).toThrow(
      '<BarChart> must be nested inside a chart component',
    );
  });
});
