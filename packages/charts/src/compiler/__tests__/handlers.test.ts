import { describe, it, expect, beforeEach } from 'vitest';
import { registerChartHandlers, resetChartHandlerRegistrationForTesting } from '../handlers';
import { ChartData, ChartAxis, ChartSeries, ChartLegend } from '../../elements/chart/dsl';

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
      '<ChartData> must be nested inside <Chart>.',
    );
  });

  it('ChartAxis guard handler throws with descriptive message', () => {
    registerChartHandlers();
    const handler = getNodeHandler(ChartAxis)!;
    expect(() => handler({} as never, {} as never, {} as never)).toThrow(
      '<ChartAxis> must be nested inside <Chart>.',
    );
  });

  it('ChartSeries guard handler throws with descriptive message', () => {
    registerChartHandlers();
    const handler = getNodeHandler(ChartSeries)!;
    expect(() => handler({} as never, {} as never, {} as never)).toThrow(
      '<ChartSeries> must be nested inside <Chart>.',
    );
  });

  it('ChartLegend guard handler throws with descriptive message', () => {
    registerChartHandlers();
    const handler = getNodeHandler(ChartLegend)!;
    expect(() => handler({} as never, {} as never, {} as never)).toThrow(
      '<ChartLegend> must be nested inside <Chart>.',
    );
  });
});
