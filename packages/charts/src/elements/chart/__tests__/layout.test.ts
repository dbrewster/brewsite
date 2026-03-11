import { describe, expect, it } from 'vitest';
import { darkGlassChartTheme } from '../../../themes/darkGlass';
import { computeChartLayout } from '../layout';

describe('computeChartLayout', () => {
  it('reserves left and bottom space for cartesian axes', () => {
    const layout = computeChartLayout({
      bounds: { width: 4, height: 3, depth: 0.4 },
      type: 'bar',
      theme: darkGlassChartTheme,
      xAxis: { axis: 'x', field: 'month', label: 'Month' },
      yAxis: { axis: 'y', field: 'revenue', label: 'Revenue ($k)' },
      series: [
        { field: 'revenue', label: 'Revenue' },
        { field: 'costs', label: 'Costs' },
      ],
      legend: { visible: true, position: 'right' },
    });

    expect(layout.plotFrame.x).toBeGreaterThan(0.45);
    expect(layout.plotFrame.y).toBeGreaterThan(0.35);
    expect(layout.plotFrame.x + layout.plotFrame.width).toBeLessThan(4);
    expect(layout.legendAnchor).not.toBeNull();
    expect(layout.legendAnchor!.x - (layout.plotFrame.x + layout.plotFrame.width)).toBeCloseTo(
      darkGlassChartTheme.legend.gap,
      6,
    );
  });

  it('does not push a pie plot against the chart edges', () => {
    const layout = computeChartLayout({
      bounds: { width: 3.2, height: 2.8, depth: 0.4 },
      type: 'pie',
      theme: darkGlassChartTheme,
      xAxis: { axis: 'x', field: 'product', label: 'Product' },
      yAxis: { axis: 'y', field: 'revenue', label: 'Revenue' },
      series: [{ field: 'revenue', label: 'Revenue' }],
      legend: null,
    });

    expect(layout.plotFrame.x).toBeGreaterThan(0);
    expect(layout.plotFrame.y).toBeGreaterThan(0);
    expect(layout.plotFrame.width).toBeLessThan(3.2);
    expect(layout.plotFrame.height).toBeLessThan(2.8);
  });
});
