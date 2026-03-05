import { describe, it, expect } from 'vitest';
import { makeSimpleContext } from '@brewsite/core';
import type { SceneTheme } from '@brewsite/core';
import { compileChart, functionalChartTransitionSpec } from '../compile';
import { DEFAULT_CHART_STATE } from '../types';

const mockSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: { htmlFamily: 'Inter, sans-serif', webglFontUrl: 'https://cdn.example.com/inter-msdf.ttf' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
};

describe('DEFAULT_CHART_STATE', () => {
  it('has fullscreen nvsBounds', () => {
    expect(DEFAULT_CHART_STATE.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});

describe('compileChart', () => {
  it('defaults type from DSL prop', () => {
    const state = compileChart({ id: 'c', type: 'bar' }, null, [], [], null);
    expect(state.type).toBe('bar');
  });

  it('defaults theme to darkGlass when not specified', () => {
    const state = compileChart({ id: 'c', type: 'bar' }, null, [], [], null);
    expect(state.theme).toBe('darkGlass');
  });

  it('uses provided theme', () => {
    const state = compileChart({ id: 'c', type: 'line', theme: 'neonCyber' }, null, [], [], null);
    expect(state.theme).toBe('neonCyber');
  });

  it('compiles xAxis from ChartAxisDSL', () => {
    const state = compileChart(
      { id: 'c', type: 'bar' },
      null,
      [{ axis: 'x', field: 'q', label: 'Quarter' }],
      [],
      null,
    );
    expect(state.xAxis).not.toBeNull();
    expect(state.xAxis?.field).toBe('q');
    expect(state.xAxis?.label).toBe('Quarter');
  });

  it('compiles yAxis from ChartAxisDSL', () => {
    const state = compileChart(
      { id: 'c', type: 'bar' },
      null,
      [{ axis: 'y', field: 'revenue', label: 'Revenue' }],
      [],
      null,
    );
    expect(state.yAxis?.field).toBe('revenue');
  });

  it('compiles series from ChartSeriesDSL', () => {
    const state = compileChart(
      { id: 'c', type: 'bar' },
      null,
      [],
      [{ field: 'revenue', label: 'Revenue' }, { field: 'cost', label: 'Cost' }],
      null,
    );
    expect(state.series).toHaveLength(2);
    expect(state.series[0]!.field).toBe('revenue');
    expect(state.series[1]!.field).toBe('cost');
  });

  it('defaults opacity to 1', () => {
    const state = compileChart({ id: 'c', type: 'bar' }, null, [], [], null);
    expect(state.opacity).toBe(1);
  });

  it('uses provided opacity', () => {
    const state = compileChart({ id: 'c', type: 'scatter', opacity: 0.7 }, null, [], [], null);
    expect(state.opacity).toBe(0.7);
  });

  it('compiles dataSource from ChartDataDSL', () => {
    const state = compileChart(
      { id: 'c', type: 'bar' },
      { source: 'sales-data' },
      [],
      [],
      null,
    );
    expect(state.dataSource).toBe('sales-data');
  });

  it('compiles transforms from ChartDataDSL', () => {
    const state = compileChart(
      { id: 'c', type: 'bar' },
      {
        source: 'data',
        transforms: [{ type: 'filter', field: 'year', op: 'eq', value: 2025 }],
      },
      [],
      [],
      null,
    );
    expect(state.transforms).toHaveLength(1);
  });

  it('compiles legend from ChartLegendDSL', () => {
    const state = compileChart(
      { id: 'c', type: 'bar' },
      null,
      [],
      [],
      { visible: true, position: 'right' },
    );
    expect(state.legend).not.toBeNull();
    expect(state.legend?.visible).toBe(true);
    expect(state.legend?.position).toBe('right');
  });

  it('produces empty series when no ChartSeries provided', () => {
    const state = compileChart({ id: 'c', type: 'bar' }, null, [], [], null);
    expect(state.series).toHaveLength(0);
  });

  it('passes sceneTheme through when provided', () => {
    const state = compileChart({ id: 'c', type: 'bar', sceneTheme: mockSceneTheme }, null, [], [], null);
    expect(state.sceneTheme).toBe(mockSceneTheme);
  });

  it('produces undefined sceneTheme when not specified', () => {
    const state = compileChart({ id: 'c', type: 'bar' }, null, [], [], null);
    expect(state.sceneTheme).toBeUndefined();
  });

  it('maps x/y/w/h DSL props to nvsBounds', () => {
    const state = compileChart(
      { id: 'c', type: 'bar', x: 0.1, y: 0.2, w: 0.5, h: 0.6 },
      null,
      [],
      [],
      null,
    );
    expect(state.nvsBounds).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.6 });
  });

  it('defaults nvsBounds to fullscreen when no NVS props provided', () => {
    const state = compileChart({ id: 'c', type: 'bar' }, null, [], [], null);
    expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('defaults partial NVS props — only w provided, others default', () => {
    const state = compileChart({ id: 'c', type: 'bar', w: 0.5 }, null, [], [], null);
    expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 0.5, h: 1 });
  });
});

describe('functionalChartTransitionSpec', () => {
  it('exitFn fades opacity to 0 at t=1', () => {
    const fn = functionalChartTransitionSpec.exitFn({ ...DEFAULT_CHART_STATE, opacity: 1 });
    expect(fn(makeSimpleContext(1)).opacity).toBeCloseTo(0);
    expect(fn(makeSimpleContext(0)).opacity).toBeCloseTo(1);
  });

  it('exitFn preserves non-opacity fields', () => {
    const from = { ...DEFAULT_CHART_STATE, type: 'bar' as const, theme: 'darkGlass' as const };
    const fn = functionalChartTransitionSpec.exitFn(from);
    expect(fn(makeSimpleContext(0.5)).type).toBe('bar');
    expect(fn(makeSimpleContext(0.5)).theme).toBe('darkGlass');
  });

  it('enterFn fades opacity from 0 at t=0', () => {
    const fn = functionalChartTransitionSpec.enterFn({ ...DEFAULT_CHART_STATE, opacity: 1 });
    expect(fn(makeSimpleContext(0)).opacity).toBeCloseTo(0);
    expect(fn(makeSimpleContext(1)).opacity).toBeCloseTo(1);
  });

  it('interpolateFn blends opacity', () => {
    const from = { ...DEFAULT_CHART_STATE, opacity: 0.2 };
    const to = { ...DEFAULT_CHART_STATE, opacity: 0.8 };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);
    const mid = fn(makeSimpleContext(0.5));
    expect(mid.opacity).toBeGreaterThan(0.2);
    expect(mid.opacity).toBeLessThan(0.8);
  });

  it('interpolateFn switches type at midpoint', () => {
    const from = { ...DEFAULT_CHART_STATE, type: 'bar' as const };
    const to = { ...DEFAULT_CHART_STATE, type: 'line' as const };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);
    expect(fn(makeSimpleContext(0.4)).type).toBe('bar');
    expect(fn(makeSimpleContext(0.6)).type).toBe('line');
  });

  it('interpolateFn blends position', () => {
    const from = { ...DEFAULT_CHART_STATE, position: [0, 0, 0] as const };
    const to = { ...DEFAULT_CHART_STATE, position: [4, 0, 0] as const };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);
    const mid = fn(makeSimpleContext(0.5));
    expect(mid.position[0]).toBeCloseTo(2);
  });

  it('interpolateFn carries from.sceneTheme at t < 0.5', () => {
    const fromTheme: SceneTheme = { ...mockSceneTheme, colorMode: 'dark' };
    const toTheme: SceneTheme = { ...mockSceneTheme, colorMode: 'light' };
    const from = { ...DEFAULT_CHART_STATE, sceneTheme: fromTheme };
    const to = { ...DEFAULT_CHART_STATE, sceneTheme: toTheme };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);
    expect(fn(makeSimpleContext(0)).sceneTheme).toBe(fromTheme);
    expect(fn(makeSimpleContext(0.4)).sceneTheme).toBe(fromTheme);
  });

  it('interpolateFn switches to to.sceneTheme at t >= 0.5', () => {
    const fromTheme: SceneTheme = { ...mockSceneTheme, colorMode: 'dark' };
    const toTheme: SceneTheme = { ...mockSceneTheme, colorMode: 'light' };
    const from = { ...DEFAULT_CHART_STATE, sceneTheme: fromTheme };
    const to = { ...DEFAULT_CHART_STATE, sceneTheme: toTheme };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);
    expect(fn(makeSimpleContext(0.5)).sceneTheme).toBe(toTheme);
    expect(fn(makeSimpleContext(1)).sceneTheme).toBe(toTheme);
  });
});
