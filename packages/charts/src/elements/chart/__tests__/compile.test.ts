import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeSimpleContext } from '@brewsite/core';
import type { SceneTheme, NVSRect } from '@brewsite/core';
import {
  compileChart,
  compileDataSource,
  compileBarChartOptions,
  compileLineChartOptions,
  compilePieChartOptions,
  compileScatterChartOptions,
  compileAreaChartOptions,
  compileHeatMapChartOptions,
  functionalChartTransitionSpec,
  compileTooltipDsl,
} from '../compile';
import { DEFAULT_CHART_STATE } from '../compile';
import { enterpriseChartTheme } from '../../../themes/enterprise';
import { neonCyberChartTheme } from '../../../themes/neonCyber';
import type { BaseChartDSL, BarChartDSL, LineChartDSL } from '../dsl';
import type { ChartTypeOptions } from '../types';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

const mockSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: { htmlFamily: 'Inter, sans-serif', webglFontUrl: 'https://cdn.example.com/inter-msdf.ttf' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
};

/** Builds a minimal BaseChartDSL with required id. */
function baseDsl(overrides: Partial<BaseChartDSL> & { id?: string } = {}): BaseChartDSL {
  return { id: 'test-chart', ...overrides };
}

const barTypeOptions: ChartTypeOptions = { kind: 'bar', options: {} };
const lineTypeOptions: ChartTypeOptions = { kind: 'line', options: {} };
const pieTypeOptions: ChartTypeOptions = { kind: 'pie', options: {} };

// ─── DEFAULT_CHART_STATE ──────────────────────────────────────────────────────

describe('DEFAULT_CHART_STATE', () => {
  it('has fullscreen nvsBounds', () => {
    expect(DEFAULT_CHART_STATE.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('has nvsX and nvsY (no position field)', () => {
    expect(DEFAULT_CHART_STATE).toHaveProperty('nvsX');
    expect(DEFAULT_CHART_STATE).toHaveProperty('nvsY');
    expect(DEFAULT_CHART_STATE).not.toHaveProperty('position');
  });

  it('has typeConfig with kind bar', () => {
    expect(DEFAULT_CHART_STATE.typeConfig).toEqual({ kind: 'bar', options: {} });
  });

  it('has dataSource as named with empty name', () => {
    expect(DEFAULT_CHART_STATE.dataSource).toEqual({ type: 'named', name: '' });
  });
});

// ─── compileDataSource ────────────────────────────────────────────────────────

describe('compileDataSource', () => {
  it('inline: data prop with row array produces InlineDataSource', () => {
    const rows = [{ month: 'Jan', revenue: 100 }, { month: 'Feb', revenue: 120 }];
    const result = compileDataSource({ id: 'c', data: rows }, null);
    expect(result).toEqual({ type: 'inline', rows, keyField: undefined });
  });

  it('inline: columnar data object is transposed to rows', () => {
    const columnar = { month: ['Jan', 'Feb'], revenue: [100, 120] };
    const result = compileDataSource({ id: 'c', data: columnar }, null);
    expect(result.type).toBe('inline');
    if (result.type !== 'inline') return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ month: 'Jan', revenue: 100 });
    expect(result.rows[1]).toEqual({ month: 'Feb', revenue: 120 });
  });

  it('async: dataUrl present produces AsyncDataSource', () => {
    const result = compileDataSource({ id: 'c', dataUrl: '/api/data.json' }, null);
    expect(result).toEqual({ type: 'async', url: '/api/data.json', format: 'json', keyField: undefined });
  });

  it('named: ChartData source child produces NamedDataSource', () => {
    const result = compileDataSource(baseDsl(), { source: 'sales-data' });
    expect(result).toEqual({ type: 'named', name: 'sales-data', keyField: undefined });
  });

  it('named: keyField propagated to NamedDataSource', () => {
    const result = compileDataSource(baseDsl(), { source: 'sales', keyField: 'id' });
    expect(result).toEqual({ type: 'named', name: 'sales', keyField: 'id' });
  });

  it('inline: keyField propagated from dataDsl', () => {
    const rows = [{ id: 1, value: 10 }];
    const result = compileDataSource({ id: 'c', data: rows }, { keyField: 'id' });
    expect(result.type).toBe('inline');
    if (result.type !== 'inline') return;
    expect(result.keyField).toBe('id');
  });

  it('async: keyField propagated from dataDsl', () => {
    const result = compileDataSource({ id: 'c', dataUrl: '/api/data.csv' }, { keyField: 'name' });
    expect(result.type).toBe('async');
    if (result.type !== 'async') return;
    expect(result.keyField).toBe('name');
  });

  it('no source: returns empty inline source (live override path)', () => {
    const result = compileDataSource(baseDsl(), null);
    expect(result).toEqual({ type: 'inline', rows: [] });
  });

  it('warns in dev when no data source specified', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    compileDataSource({ id: 'my-chart' }, null);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('my-chart'));
    spy.mockRestore();
  });

  it('data prop takes priority over dataUrl', () => {
    const rows = [{ x: 1 }];
    const result = compileDataSource({ id: 'c', data: rows, dataUrl: '/api/data.json' }, null);
    expect(result.type).toBe('inline');
  });

  it('dataUrl takes priority over dataDsl.source', () => {
    const result = compileDataSource({ id: 'c', dataUrl: '/api/data.json' }, { source: 'named-source' });
    expect(result.type).toBe('async');
  });
});

// ─── compileBarChartOptions ───────────────────────────────────────────────────

describe('compileBarChartOptions', () => {
  it('defaults: empty props produces all-undefined options', () => {
    const dsl: BarChartDSL = { id: 'c' };
    const opts = compileBarChartOptions(dsl);
    expect(opts).toEqual({ orientation: undefined, stackMode: undefined, barPadding: undefined });
  });

  it('stacked + horizontal props propagated', () => {
    const dsl: BarChartDSL = { id: 'c', stackMode: 'stacked', orientation: 'horizontal', barPadding: 0.2 };
    const opts = compileBarChartOptions(dsl);
    expect(opts.stackMode).toBe('stacked');
    expect(opts.orientation).toBe('horizontal');
    expect(opts.barPadding).toBe(0.2);
  });
});

// ─── compilePieChartOptions ───────────────────────────────────────────────────

describe('compilePieChartOptions', () => {
  it('innerRadius=0.5 and explodeSlice propagated', () => {
    const opts = compilePieChartOptions({ id: 'c', innerRadius: 0.5, explodeSlice: 'Core Platform' });
    expect(opts.innerRadius).toBe(0.5);
    expect(opts.explodeSlice).toBe('Core Platform');
  });

  it('pieTilt propagated', () => {
    const opts = compilePieChartOptions({ id: 'c', pieTilt: 0.48 });
    expect(opts.pieTilt).toBe(0.48);
  });
});

// ─── compileScatterChartOptions ───────────────────────────────────────────────

describe('compileScatterChartOptions', () => {
  it('sizeField + colorField + sizeScale propagated', () => {
    const opts = compileScatterChartOptions({
      id: 'c',
      sizeField: 'population',
      colorField: 'region',
      sizeScale: { min: 0.1, max: 2.0 },
    });
    expect(opts.sizeField).toBe('population');
    expect(opts.colorField).toBe('region');
    expect(opts.sizeScale).toEqual({ min: 0.1, max: 2.0 });
  });

  it('pointShape propagated', () => {
    const opts = compileScatterChartOptions({ id: 'c', pointShape: 'cube' });
    expect(opts.pointShape).toBe('cube');
  });
});

// ─── compileLineChartOptions ──────────────────────────────────────────────────

describe('compileLineChartOptions', () => {
  it('lineShape + lineSmoothness + lineSubdivisions propagated', () => {
    const dsl: LineChartDSL = { id: 'c', lineShape: 'hexagon', lineSmoothness: 0.3, lineSubdivisions: 9 };
    const opts = compileLineChartOptions(dsl);
    expect(opts.lineShape).toBe('hexagon');
    expect(opts.lineSmoothness).toBe(0.3);
    expect(opts.lineSubdivisions).toBe(9);
  });
});

// ─── compileAreaChartOptions ──────────────────────────────────────────────────

describe('compileAreaChartOptions', () => {
  it('stackMode + fillOpacity propagated', () => {
    const opts = compileAreaChartOptions({ id: 'c', stackMode: 'stacked', fillOpacity: 0.7 });
    expect(opts.stackMode).toBe('stacked');
    expect(opts.fillOpacity).toBe(0.7);
  });
});

// ─── compileHeatMapChartOptions ───────────────────────────────────────────────

describe('compileHeatMapChartOptions', () => {
  it('timeField + heightField + colorInterpolator propagated', () => {
    const opts = compileHeatMapChartOptions({ id: 'c', timeField: 'month', heightField: 'temp', colorInterpolator: 'viridis' });
    expect(opts.timeField).toBe('month');
    expect(opts.heightField).toBe('temp');
    expect(opts.colorInterpolator).toBe('viridis');
  });
});

// ─── compileChart ─────────────────────────────────────────────────────────────

describe('compileChart', () => {
  it('derives nvsX, nvsY from x,y,w,h props', () => {
    const state = compileChart(baseDsl({ x: 0.2, y: 0.1, w: 0.5, h: 0.6 }), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.nvsX).toBeCloseTo(0.2 + 0.5 / 2, 5);
    expect(state.nvsY).toBeCloseTo(0.1 + 0.6 / 2, 5);
  });

  it('defaults to NVS center when no x,y specified', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.nvsX).toBe(0.5);
    expect(state.nvsY).toBe(0.5);
  });

  it('has no position property', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state).not.toHaveProperty('position');
  });

  it('respects explicit z prop', () => {
    const state = compileChart(baseDsl({ z: -2 }), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.z).toBe(-2);
  });

  it('defaults z to 0', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.z).toBe(0);
  });

  it('type equals kind param', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.type).toBe('bar');
  });

  it('defaults theme to enterpriseChartTheme when resolvedTheme is not provided', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.theme).toBe(enterpriseChartTheme);
    expect(typeof state.theme).toBe('object');
  });

  it('uses the provided resolvedTheme object', () => {
    const state = compileChart(baseDsl(), 'line', lineTypeOptions, null, [], [], null, null, [], null, neonCyberChartTheme);
    expect(state.theme).toBe(neonCyberChartTheme);
  });

  it('compiles xAxis from ChartAxisDSL', () => {
    const state = compileChart(
      baseDsl(),
      'bar',
      barTypeOptions,
      null,
      [{ axis: 'x', field: 'q', label: 'Quarter' }],
      [],
      null,
      null,
      [],
    );
    expect(state.xAxis).not.toBeNull();
    expect(state.xAxis?.field).toBe('q');
    expect(state.xAxis?.label).toBe('Quarter');
  });

  it('compiles yAxis from ChartAxisDSL', () => {
    const state = compileChart(
      baseDsl(),
      'bar',
      barTypeOptions,
      null,
      [{ axis: 'y', field: 'revenue', label: 'Revenue' }],
      [],
      null,
      null,
      [],
    );
    expect(state.yAxis?.field).toBe('revenue');
  });

  it('compiles series from ChartSeriesDSL', () => {
    const state = compileChart(
      baseDsl(),
      'bar',
      barTypeOptions,
      null,
      [],
      [{ field: 'revenue', label: 'Revenue' }, { field: 'cost', label: 'Cost' }],
      null,
      null,
      [],
    );
    expect(state.series).toHaveLength(2);
    expect(state.series[0]!.field).toBe('revenue');
    expect(state.series[1]!.field).toBe('cost');
  });

  it('defaults opacity to 1', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.opacity).toBe(1);
  });

  it('uses provided opacity', () => {
    const state = compileChart(baseDsl({ opacity: 0.7 }), 'scatter', { kind: 'scatter', options: {} }, null, [], [], null, null, []);
    expect(state.opacity).toBe(0.7);
  });

  it('compiles dataSource from ChartDataDSL source → NamedDataSource', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, { source: 'sales-data' }, [], [], null, null, []);
    expect(state.dataSource).toEqual({ type: 'named', name: 'sales-data', keyField: undefined });
  });

  it('compiles inline dataSource from data prop', () => {
    const rows = [{ month: 'Jan', revenue: 100 }];
    const state = compileChart({ id: 'c', data: rows }, 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.dataSource).toMatchObject({ type: 'inline', rows });
  });

  it('compiles transforms from ChartDataDSL', () => {
    const state = compileChart(
      baseDsl(),
      'bar',
      barTypeOptions,
      {
        source: 'data',
        transforms: [{ type: 'filter', field: 'year', op: 'eq', value: 2025 }],
      },
      [],
      [],
      null,
      null,
      [],
    );
    expect(state.transforms).toHaveLength(1);
  });

  it('compiles legend from ChartLegendDSL', () => {
    const state = compileChart(
      baseDsl(),
      'bar',
      barTypeOptions,
      null,
      [],
      [],
      { visible: true, position: 'right' },
      null,
      [],
    );
    expect(state.legend).not.toBeNull();
    expect(state.legend?.visible).toBe(true);
    expect(state.legend?.position).toBe('right');
  });

  it('produces empty series when no ChartSeries provided', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.series).toHaveLength(0);
  });

  it('produces undefined sceneTheme when not specified', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.sceneTheme).toBeUndefined();
  });

  it('maps x/y/w/h DSL props to nvsBounds', () => {
    const state = compileChart(
      baseDsl({ x: 0.1, y: 0.2, w: 0.5, h: 0.6 }),
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.nvsBounds).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.6 });
  });

  it('defaults nvsBounds to fullscreen when no NVS props provided', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('defaults partial NVS props — only w provided, others default', () => {
    const state = compileChart(baseDsl({ w: 0.5 }), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 0.5, h: 1 });
  });

  it('bounds.width defaults to dsl.w (NVS fraction)', () => {
    const state = compileChart(baseDsl({ w: 0.6 }), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.bounds.width).toBe(0.6);
  });

  it('bounds.height defaults to dsl.h (NVS fraction)', () => {
    const state = compileChart(baseDsl({ h: 0.7 }), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.bounds.height).toBe(0.7);
  });

  it('bounds.width=1.0 when no w or bounds.width specified (NVS default)', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.bounds.width).toBe(1);
    expect(state.bounds.height).toBe(1);
  });

  it('bounds.width is always derived from dsl.w (bounds.width override ignored)', () => {
    const state = compileChart(baseDsl({ w: 0.8, bounds: { width: 0.5 } }), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.bounds.width).toBe(0.8);
  });

  it('bounds.depth defaults to 0.4 when not specified', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.bounds.depth).toBe(0.4);
  });

  it('explicit bounds.depth overrides default', () => {
    const state = compileChart(baseDsl({ bounds: { depth: 0.8 } }), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.bounds.depth).toBe(0.8);
  });

  it('nvsX = x + w/2 (centering contract)', () => {
    const cases: Array<{ x: number; y: number; w: number; h: number; expectedX: number; expectedY: number }> = [
      { x: 0,   y: 0,   w: 1,   h: 1,   expectedX: 0.5,  expectedY: 0.5  },
      { x: 0.1, y: 0.2, w: 0.6, h: 0.4, expectedX: 0.4,  expectedY: 0.4  },
      { x: 0,   y: 0,   w: 0.5, h: 0.5, expectedX: 0.25, expectedY: 0.25 },
    ];
    for (const c of cases) {
      const state = compileChart(
        baseDsl({ x: c.x, y: c.y, w: c.w, h: c.h }),
        'bar',
        barTypeOptions,
        null, [], [], null, null, [],
      );
      expect(state.nvsX).toBeCloseTo(c.expectedX, 5);
      expect(state.nvsY).toBeCloseTo(c.expectedY, 5);
    }
  });

  // V2 test #10 — BarChart full compile
  it('BarChart full compile: typeConfig.kind=bar, type=bar, inline dataSource, correct axes and series', () => {
    const rows = [{ month: 'Jan', revenue: 100 }, { month: 'Feb', revenue: 120 }];
    const typeOpts: ChartTypeOptions = { kind: 'bar', options: { stackMode: 'stacked', orientation: 'vertical' } };
    const state = compileChart(
      { id: 'bar-chart', data: rows, opacity: 0.9 },
      'bar',
      typeOpts,
      { keyField: 'month' },
      [{ axis: 'x', field: 'month' }, { axis: 'y', field: 'revenue' }],
      [{ field: 'revenue', label: 'Revenue' }],
      { visible: true, position: 'right' },
      null,
      [],
    );
    expect(state.typeConfig.kind).toBe('bar');
    expect(state.type).toBe('bar');
    expect(state.dataSource.type).toBe('inline');
    expect(state.xAxis?.field).toBe('month');
    expect(state.yAxis?.field).toBe('revenue');
    expect(state.series[0]?.label).toBe('Revenue');
    expect(state.opacity).toBe(0.9);
  });

  // V2 test #11 — axis V2 fields
  it('axis V2 fields: scaleType, domain, tickCount, gridlines propagated to ChartAxisState', () => {
    const state = compileChart(
      baseDsl(),
      'line',
      lineTypeOptions,
      null,
      [
        {
          axis: 'x',
          field: 'date',
          scaleType: 'time',
          domain: ['2020-01-01', '2025-01-01'],
          tickCount: 12,
          gridlines: true,
          gridlineOpacity: 0.3,
          nice: true,
          clamp: false,
          reverse: false,
        },
        {
          axis: 'y',
          field: 'value',
          scaleType: 'log',
          tickCount: 5,
        },
      ],
      [],
      null,
      null,
      [],
    );
    expect(state.xAxis?.scaleType).toBe('time');
    expect(state.xAxis?.domain).toEqual(['2020-01-01', '2025-01-01']);
    expect(state.xAxis?.tickCount).toBe(12);
    expect(state.xAxis?.gridlines).toBe(true);
    expect(state.xAxis?.gridlineOpacity).toBe(0.3);
    expect(state.xAxis?.nice).toBe(true);
    expect(state.yAxis?.scaleType).toBe('log');
    expect(state.yAxis?.tickCount).toBe(5);
  });

  // V2 test #12 — legend V2 fields
  it('legend V2 fields: title, columns, maxItems propagated', () => {
    const state = compileChart(
      baseDsl(),
      'bar',
      barTypeOptions,
      null,
      [],
      [],
      { visible: true, position: 'bottom', title: 'Products', columns: 3, maxItems: 10 },
      null,
      [],
    );
    expect(state.legend?.title).toBe('Products');
    expect(state.legend?.columns).toBe(3);
    expect(state.legend?.maxItems).toBe(10);
    expect(state.legend?.position).toBe('bottom');
  });

  // V2 test #13 — dataLabels
  it('dataLabels: ChartDataLabelsState propagated when dataLabelsDsl provided', () => {
    const state = compileChart(
      baseDsl(),
      'bar',
      barTypeOptions,
      null, [], [], null,
      { position: 'center', format: '.1f' },
      [],
    );
    expect(state.dataLabels).not.toBeUndefined();
    expect(state.dataLabels?.position).toBe('center');
    expect(state.dataLabels?.format).toBe('.1f');
  });

  it('dataLabels: undefined when no dataLabelsDsl', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.dataLabels).toBeUndefined();
  });

  // V2 test #14 — referenceLines
  it('referenceLines: ReferenceLineState[] propagated', () => {
    const state = compileChart(
      baseDsl(),
      'line',
      lineTypeOptions,
      null, [], [], null, null,
      [
        { axis: 'y', value: 100, label: 'Target', color: '#ff0000' },
        { axis: 'x', value: 5 },
      ],
    );
    expect(state.referenceLines).toHaveLength(2);
    expect(state.referenceLines![0]).toEqual({ axis: 'y', value: 100, label: 'Target', color: '#ff0000' });
    expect(state.referenceLines![1]).toEqual({ axis: 'x', value: 5, label: undefined, color: undefined });
  });

  it('referenceLines: undefined when empty array', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.referenceLines).toBeUndefined();
  });

  it('gridlines prop propagated to state', () => {
    const state = compileChart(baseDsl({ gridlines: true }), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.gridlines).toBe(true);
  });

  // V2.1: animateEntry + animationDuration
  it('animateEntry defaults to false when not specified', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.animateEntry).toBe(false);
  });

  it('animateEntry=true propagated when specified', () => {
    const state = compileChart(baseDsl({ animateEntry: true }), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.animateEntry).toBe(true);
  });

  it('animationDuration defaults to 0.4 when not specified', () => {
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.animationDuration).toBeCloseTo(0.4);
  });

  it('animationDuration=1.5 is clamped to 1.0', () => {
    const state = compileChart(baseDsl({ animationDuration: 1.5 }), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.animationDuration).toBe(1.0);
  });

  it('animationDuration=0 is clamped to 0.01', () => {
    const state = compileChart(baseDsl({ animationDuration: 0 }), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.animationDuration).toBe(0.01);
  });

  it('animationDuration=0.25 passes through unchanged', () => {
    const state = compileChart(baseDsl({ animationDuration: 0.25 }), 'bar', barTypeOptions, null, [], [], null, null, []);
    expect(state.animationDuration).toBe(0.25);
  });

  it('series bandField propagated', () => {
    const state = compileChart(
      baseDsl(),
      'area',
      { kind: 'area', options: {} },
      null,
      [],
      [{ field: 'upper', bandField: 'lower', label: 'Band' }],
      null,
      null,
      [],
    );
    expect(state.series[0]?.bandField).toBe('lower');
  });

  // composeBoundsFn — bounds composition
  it('composeBoundsFn: absent → behavior unchanged (identity)', () => {
    const state = compileChart(
      baseDsl({ x: 0.2, y: 0.1, w: 0.5, h: 0.6 }),
      'bar', barTypeOptions, null, [], [], null, null, [],
    );
    expect(state.nvsBounds).toEqual({ x: 0.2, y: 0.1, w: 0.5, h: 0.6 });
    expect(state.nvsX).toBeCloseTo(0.2 + 0.5 / 2, 5);
    expect(state.nvsY).toBeCloseTo(0.1 + 0.6 / 2, 5);
    expect(state.bounds.width).toBeCloseTo(0.5, 5);
    expect(state.bounds.height).toBeCloseTo(0.6, 5);
  });

  it('composeBoundsFn: maps local [0,0,1,1] into parent region → correct bounds and center', () => {
    const compose = (r: NVSRect): NVSRect => ({
      x: 0.1 + r.x * 0.8,
      y: 0.1 + r.y * 0.8,
      w: r.w * 0.8,
      h: r.h * 0.8,
    });
    const state = compileChart(baseDsl(), 'bar', barTypeOptions, null, [], [], null, null, [], null, DEFAULT_CHART_STATE.theme, compose);
    expect(state.nvsBounds).toEqual({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    expect(state.nvsX).toBeCloseTo(0.5);
    expect(state.nvsY).toBeCloseTo(0.5);
    expect(state.bounds.width).toBeCloseTo(0.8);
    expect(state.bounds.height).toBeCloseTo(0.8);
  });

  it('composeBoundsFn: composed bounds used for nvsX/nvsY center recomputation', () => {
    // Local rect in top-left quadrant; parent maps it to the right half
    const compose = (r: NVSRect): NVSRect => ({
      x: 0.5 + r.x * 0.5,
      y: r.y * 0.5,
      w: r.w * 0.5,
      h: r.h * 0.5,
    });
    const state = compileChart(
      baseDsl({ x: 0, y: 0, w: 1, h: 1 }),
      'bar', barTypeOptions, null, [], [], null, null, [], null, DEFAULT_CHART_STATE.theme, compose,
    );
    // Composed: { x: 0.5, y: 0, w: 0.5, h: 0.5 } → center at (0.75, 0.25)
    expect(state.nvsBounds).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 });
    expect(state.nvsX).toBeCloseTo(0.75);
    expect(state.nvsY).toBeCloseTo(0.25);
    expect(state.bounds.width).toBeCloseTo(0.5);
    expect(state.bounds.height).toBeCloseTo(0.5);
  });

  // Backward compat: deprecated <Chart> DSL — ChartDSL is a superset of BaseChartDSL
  it('backward-compat: deprecated Chart DSL compiles via compileChart with derived kind', () => {
    // Handlers will extract type from ChartDSL.type and pass as kind.
    // We test that compileChart produces correct state when called this way.
    const state = compileChart(
      { id: 'legacy', x: 0, y: 0, w: 1, h: 1 },
      'pie',
      pieTypeOptions,
      { source: 'legacy-data' },
      [{ axis: 'x', field: 'product' }],
      [{ field: 'revenue' }],
      { visible: false },
      null,
      [],
    );
    expect(state.type).toBe('pie');
    expect(state.typeConfig.kind).toBe('pie');
    expect(state.dataSource).toEqual({ type: 'named', name: 'legacy-data', keyField: undefined });
    expect(state.legend?.visible).toBe(false);
  });
});

// ─── functionalChartTransitionSpec ───────────────────────────────────────────

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

  it('interpolateFn blends nvsX at t=0.5', () => {
    const from = { ...DEFAULT_CHART_STATE, nvsX: 0.0 };
    const to = { ...DEFAULT_CHART_STATE, nvsX: 1.0 };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);
    expect(fn(makeSimpleContext(0.5)).nvsX).toBeCloseTo(0.5);
  });

  it('interpolateFn blends nvsY at t=0.5', () => {
    const from = { ...DEFAULT_CHART_STATE, nvsY: 0.0 };
    const to = { ...DEFAULT_CHART_STATE, nvsY: 1.0 };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);
    expect(fn(makeSimpleContext(0.5)).nvsY).toBeCloseTo(0.5);
  });

  it('interpolateFn blends z at t=0.5', () => {
    const from = { ...DEFAULT_CHART_STATE, z: 0 };
    const to = { ...DEFAULT_CHART_STATE, z: 4 };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);
    expect(fn(makeSimpleContext(0.5)).z).toBeCloseTo(2);
  });

  it('interpolateFn defers type switch until t=1', () => {
    const from = { ...DEFAULT_CHART_STATE, type: 'bar' as const };
    const to = { ...DEFAULT_CHART_STATE, type: 'line' as const };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);
    expect(fn(makeSimpleContext(0)).type).toBe('bar');
    expect(fn(makeSimpleContext(0.4)).type).toBe('bar');
    expect(fn(makeSimpleContext(0.9)).type).toBe('bar');
    expect(fn(makeSimpleContext(1)).type).toBe('line');
  });

  it('interpolateFn defers sceneTheme switch until t=1', () => {
    const fromTheme: SceneTheme = { ...mockSceneTheme, colorMode: 'dark' };
    const toTheme: SceneTheme = { ...mockSceneTheme, colorMode: 'light' };
    const from = { ...DEFAULT_CHART_STATE, sceneTheme: fromTheme };
    const to = { ...DEFAULT_CHART_STATE, sceneTheme: toTheme };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);
    expect(fn(makeSimpleContext(0)).sceneTheme).toBe(fromTheme);
    expect(fn(makeSimpleContext(0.4)).sceneTheme).toBe(fromTheme);
    expect(fn(makeSimpleContext(0.9)).sceneTheme).toBe(fromTheme);
    expect(fn(makeSimpleContext(1)).sceneTheme).toBe(toTheme);
  });

  // V2 test #15 — typeConfig + _morphT
  it('interpolateFn defers typeConfig switch until t=1', () => {
    const fromConfig: ChartTypeOptions = { kind: 'bar', options: { stackMode: 'grouped' } };
    const toConfig: ChartTypeOptions = { kind: 'line', options: { lineShape: 'hexagon' } };
    const from = { ...DEFAULT_CHART_STATE, typeConfig: fromConfig, type: 'bar' as const };
    const to = { ...DEFAULT_CHART_STATE, typeConfig: toConfig, type: 'line' as const };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);

    expect(fn(makeSimpleContext(0)).typeConfig).toBe(fromConfig);
    expect(fn(makeSimpleContext(0.4)).typeConfig).toBe(fromConfig);
    expect(fn(makeSimpleContext(0.9)).typeConfig).toBe(fromConfig);
    expect(fn(makeSimpleContext(1)).typeConfig).toBe(toConfig);
  });

  it('interpolateFn injects _morphT equal to ctx.t', () => {
    const from = { ...DEFAULT_CHART_STATE };
    const to = { ...DEFAULT_CHART_STATE };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);

    expect(fn(makeSimpleContext(0))._morphT).toBeCloseTo(0);
    expect(fn(makeSimpleContext(0.25))._morphT).toBeCloseTo(0.25);
    expect(fn(makeSimpleContext(0.75))._morphT).toBeCloseTo(0.75);
    expect(fn(makeSimpleContext(1))._morphT).toBeCloseTo(1);
  });

  it('interpolateFn clears _morphT when cross-fading structural changes', () => {
    const from = { ...DEFAULT_CHART_STATE, type: 'bar' as const };
    const to = { ...DEFAULT_CHART_STATE, type: 'line' as const };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);
    expect(fn(makeSimpleContext(0.25))._morphT).toBeUndefined();
    expect(fn(makeSimpleContext(0.75))._morphT).toBeUndefined();
  });

  it('interpolateFn opacity is interpolated across full range', () => {
    const from = { ...DEFAULT_CHART_STATE, opacity: 0 };
    const to = { ...DEFAULT_CHART_STATE, opacity: 1 };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);
    expect(fn(makeSimpleContext(0)).opacity).toBeCloseTo(0);
    expect(fn(makeSimpleContext(1)).opacity).toBeCloseTo(1);
  });

  it('interpolateFn carries _morphFromDataSource from the "from" state', () => {
    const fromDataSource = { type: 'inline' as const, rows: [{ id: 1, v: 10 }], keyField: 'id' };
    const toDataSource = { type: 'inline' as const, rows: [{ id: 1, v: 20 }], keyField: 'id' };
    const from = { ...DEFAULT_CHART_STATE, dataSource: fromDataSource, transforms: [] };
    const to = { ...DEFAULT_CHART_STATE, dataSource: toDataSource, transforms: [] };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);

    const at0 = fn(makeSimpleContext(0));
    const atMid = fn(makeSimpleContext(0.5));
    const at1 = fn(makeSimpleContext(1));

    // _morphFromDataSource always references "from" state's data source
    expect(at0._morphFromDataSource).toBe(fromDataSource);
    expect(atMid._morphFromDataSource).toBe(fromDataSource);
    expect(at1._morphFromDataSource).toBe(fromDataSource);

    // dataSource (via ...to spread) always references "to" state's data source
    expect(at0.dataSource).toBe(toDataSource);
    expect(atMid.dataSource).toBe(toDataSource);
    expect(at1.dataSource).toBe(toDataSource);
  });

  it('interpolateFn does not set _morphFromDataSource for structural changes', () => {
    const from = { ...DEFAULT_CHART_STATE, type: 'bar' as const };
    const to = { ...DEFAULT_CHART_STATE, type: 'line' as const };
    const fn = functionalChartTransitionSpec.interpolateFn(from, to);

    expect(fn(makeSimpleContext(0.5))._morphFromDataSource).toBeUndefined();
  });
});

// ─── compileTooltipDsl ────────────────────────────────────────────────────────

describe('compileTooltipDsl', () => {
  it('null input → null output', () => {
    expect(compileTooltipDsl(null)).toBeNull();
  });

  it('empty object → projection=false, format=undefined', () => {
    expect(compileTooltipDsl({})).toEqual({ projection: false, format: undefined });
  });

  it('projection=true, format=".2f" → compiles verbatim', () => {
    expect(compileTooltipDsl({ projection: true, format: '.2f' })).toEqual({
      projection: true,
      format: '.2f',
    });
  });
});

// ─── compileChart: tooltip field ─────────────────────────────────────────────

describe('compileChart: tooltip field', () => {
  it('no tooltip child → state.tooltip is null', () => {
    const state = compileChart(
      baseDsl({ id: 'test' }), 'bar', barTypeOptions,
      null, [], [], null, null, [],
      null,
    );
    expect(state.tooltip).toBeNull();
  });

  it('<ChartTooltip projection> → state.tooltip.projection is true', () => {
    const state = compileChart(
      baseDsl({ id: 'test' }), 'bar', barTypeOptions,
      null, [], [], null, null, [],
      { projection: true },
    );
    expect(state.tooltip?.projection).toBe(true);
  });

  it('<ChartTooltip format=".2f"> → state.tooltip.format is set', () => {
    const state = compileChart(
      baseDsl({ id: 'test' }), 'bar', barTypeOptions,
      null, [], [], null, null, [],
      { format: '.2f' },
    );
    expect(state.tooltip?.format).toBe('.2f');
  });
});

// ─── Warn suppression helper ──────────────────────────────────────────────────

// Suppress console.warn for tests that intentionally trigger warnings (like missing data source)
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});
