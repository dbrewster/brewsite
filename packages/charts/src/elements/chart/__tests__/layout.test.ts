import { describe, expect, it } from 'vitest';
import { darkGlassChartTheme } from '../../../themes/darkGlass';
import { computeChartLayout } from '../layout';
import type { ChartTypeOptions } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeConfig(kind: ChartTypeOptions['kind']): ChartTypeOptions {
  switch (kind) {
    case 'bar':     return { kind: 'bar',     options: {} };
    case 'line':    return { kind: 'line',    options: {} };
    case 'scatter': return { kind: 'scatter', options: {} };
    case 'pie':     return { kind: 'pie',     options: {} };
    case 'area':    return { kind: 'area',    options: {} };
    case 'heatmap': return { kind: 'heatmap', options: {} };
  }
}

// ─── computeChartLayout ───────────────────────────────────────────────────────

describe('computeChartLayout', () => {
  it('reserves left and bottom space for cartesian axes', () => {
    const layout = computeChartLayout({
      bounds: { width: 4, height: 3, depth: 0.4 },
      typeConfig: typeConfig('bar'),
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
      typeConfig: typeConfig('pie'),
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

  // V2: isCartesian depends on typeConfig.kind — test all chart types
  it('isCartesian = true for bar', () => {
    const layout = computeChartLayout({
      bounds: { width: 4, height: 3, depth: 0.4 },
      typeConfig: typeConfig('bar'),
      theme: darkGlassChartTheme,
      xAxis: { axis: 'x', field: 'month' },
      yAxis: { axis: 'y', field: 'value' },
      series: [],
      legend: null,
    });
    // Cartesian charts have larger left/bottom margins for axes
    expect(layout.plotFrame.x).toBeGreaterThan(0.12); // axis reserves more than DEFAULT_PAD
  });

  it('isCartesian = true for line', () => {
    const layout = computeChartLayout({
      bounds: { width: 4, height: 3, depth: 0.4 },
      typeConfig: typeConfig('line'),
      theme: darkGlassChartTheme,
      xAxis: { axis: 'x', field: 'date' },
      yAxis: { axis: 'y', field: 'value' },
      series: [],
      legend: null,
    });
    expect(layout.plotFrame.x).toBeGreaterThan(0.12);
  });

  it('isCartesian = true for area', () => {
    const layout = computeChartLayout({
      bounds: { width: 4, height: 3, depth: 0.4 },
      typeConfig: typeConfig('area'),
      theme: darkGlassChartTheme,
      xAxis: { axis: 'x', field: 'date' },
      yAxis: { axis: 'y', field: 'value' },
      series: [],
      legend: null,
    });
    expect(layout.plotFrame.x).toBeGreaterThan(0.12);
  });

  it('isCartesian = true for scatter', () => {
    const layout = computeChartLayout({
      bounds: { width: 4, height: 3, depth: 0.4 },
      typeConfig: typeConfig('scatter'),
      theme: darkGlassChartTheme,
      xAxis: { axis: 'x', field: 'x' },
      yAxis: { axis: 'y', field: 'y' },
      series: [],
      legend: null,
    });
    expect(layout.plotFrame.x).toBeGreaterThan(0.12);
  });

  it('isCartesian = true for heatmap', () => {
    const layout = computeChartLayout({
      bounds: { width: 4, height: 3, depth: 0.4 },
      typeConfig: typeConfig('heatmap'),
      theme: darkGlassChartTheme,
      xAxis: { axis: 'x', field: 'day' },
      yAxis: { axis: 'y', field: 'hour' },
      series: [],
      legend: null,
    });
    expect(layout.plotFrame.x).toBeGreaterThan(0.12);
  });

  it('isCartesian = false for pie — uses DEFAULT_PAD margins', () => {
    const layout = computeChartLayout({
      bounds: { width: 4, height: 3, depth: 0.4 },
      typeConfig: typeConfig('pie'),
      theme: darkGlassChartTheme,
      xAxis: null,
      yAxis: null,
      series: [],
      legend: null,
    });
    // Pie uses DEFAULT_PAD (0.12) for all margins — plotFrame.x should be ~DEFAULT_PAD
    expect(layout.plotFrame.x).toBeCloseTo(0.12, 2);
  });

  // ─── V2.1: fittedMargins ────────────────────────────────────────────────────

  it('returns fittedMargins with left, right, top, bottom fields', () => {
    const layout = computeChartLayout({
      bounds: { width: 4, height: 3, depth: 0.4 },
      typeConfig: typeConfig('bar'),
      theme: darkGlassChartTheme,
      xAxis: { axis: 'x', field: 'month', label: 'Month' },
      yAxis: { axis: 'y', field: 'value', label: 'Value' },
      series: [],
      legend: null,
    });
    expect(layout.fittedMargins).toBeDefined();
    expect(typeof layout.fittedMargins.left).toBe('number');
    expect(typeof layout.fittedMargins.right).toBe('number');
    expect(typeof layout.fittedMargins.top).toBe('number');
    expect(typeof layout.fittedMargins.bottom).toBe('number');
  });

  it('fittedMargins.left equals plotFrame.x (layout origin)', () => {
    const layout = computeChartLayout({
      bounds: { width: 4, height: 3, depth: 0.4 },
      typeConfig: typeConfig('bar'),
      theme: darkGlassChartTheme,
      xAxis: { axis: 'x', field: 'month', label: 'Month' },
      yAxis: { axis: 'y', field: 'value', label: 'Value' },
      series: [],
      legend: null,
    });
    expect(layout.fittedMargins.left).toBeCloseTo(layout.plotFrame.x, 6);
    expect(layout.fittedMargins.bottom).toBeCloseTo(layout.plotFrame.y, 6);
  });

  it('for a large chart, fittedMargins.left matches raw theme-computed left margin (no scaling)', () => {
    // With wide bounds, the margins fit within minPlotWidth — no scaling needed
    const theme = darkGlassChartTheme;
    const layout = computeChartLayout({
      bounds: { width: 8, height: 6, depth: 0.4 },
      typeConfig: typeConfig('bar'),
      theme,
      xAxis: { axis: 'x', field: 'month', label: 'Month' },
      yAxis: { axis: 'y', field: 'value', label: 'Value' },
      series: [],
      legend: null,
    });
    // Raw left = tickLength + gap + fontSize * 4.1 (has label)
    const rawLeft = theme.axis.tickLength + theme.axis.gap + theme.axis.fontSize * 4.1;
    // With wide bounds (8 units), margins should NOT be scaled down
    expect(layout.fittedMargins.left).toBeCloseTo(rawLeft, 5);
  });

  it('for a narrow chart, fittedMargins.left is scaled down from raw theme value', () => {
    const theme = darkGlassChartTheme;
    // Very narrow bounds force margin scaling
    const layout = computeChartLayout({
      bounds: { width: 0.5, height: 0.4, depth: 0.1 },
      typeConfig: typeConfig('bar'),
      theme,
      xAxis: { axis: 'x', field: 'month', label: 'Month' },
      yAxis: { axis: 'y', field: 'value', label: 'Value' },
      series: [],
      legend: null,
    });
    const rawLeft = theme.axis.tickLength + theme.axis.gap + theme.axis.fontSize * 4.1;
    // Fitted value must be smaller than raw (margins were scaled down)
    expect(layout.fittedMargins.left).toBeLessThan(rawLeft);
  });

  it('plotFrame.width > 0 and plotFrame.height > 0 for edge-case narrow bounds', () => {
    const layout = computeChartLayout({
      bounds: { width: 0.15, height: 0.12, depth: 0.05 },
      typeConfig: typeConfig('bar'),
      theme: darkGlassChartTheme,
      xAxis: { axis: 'x', field: 'month' },
      yAxis: { axis: 'y', field: 'value' },
      series: [],
      legend: null,
    });
    expect(layout.plotFrame.width).toBeGreaterThan(0);
    expect(layout.plotFrame.height).toBeGreaterThan(0);
  });

  it('minPlotWidth is percentage-based: with bounds.width=0.5, minPlotWidth=0.24 (not 0.8)', () => {
    // Test that the old absolute 0.8 floor is gone.
    // With bounds.width = 0.5, minPlotWidth should be 0.5 * 0.48 = 0.24.
    // If the old floor (0.8) were still in effect, narrow charts would incorrectly
    // require 0.8 plot width which is larger than the total bounds width.
    const layout = computeChartLayout({
      bounds: { width: 0.5, height: 0.4, depth: 0.1 },
      typeConfig: typeConfig('bar'),
      theme: darkGlassChartTheme,
      xAxis: { axis: 'x', field: 'month' },
      yAxis: { axis: 'y', field: 'value' },
      series: [],
      legend: null,
    });
    // plotFrame.width should be at least minPlotWidth = 0.5 * 0.48 = 0.24
    expect(layout.plotFrame.width).toBeGreaterThanOrEqual(0.24 - 0.01);
    // And total width (left + plotWidth + right) must not exceed bounds.width
    const totalWidth = layout.fittedMargins.left + layout.plotFrame.width + layout.fittedMargins.right;
    expect(totalWidth).toBeLessThanOrEqual(0.5 + 0.001); // allow tiny floating-point tolerance
  });
});
