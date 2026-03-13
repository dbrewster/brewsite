import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartDataStore } from '../../../data/ChartDataStore';
import type { ChartRenderInput, DataRow } from '../types';
import { ChartRenderer } from '../render';

const { barUpdateCalls } = vi.hoisted(() => ({
  barUpdateCalls: [] as unknown[],
}));

vi.mock('../../../renderers/bar/BarRenderer', () => ({
  BarRenderer: class {
    update = vi.fn((ctx: unknown) => {
      barUpdateCalls.push(ctx);
    });
    dispose = vi.fn();
    getInteractiveObjects = vi.fn(() => []);
    resolveHoverInfo = vi.fn(() => null);
  },
}));
vi.mock('../../../renderers/line/LineRenderer', () => ({
  LineRenderer: class {
    update = vi.fn();
    dispose = vi.fn();
    getInteractiveObjects = vi.fn(() => []);
    resolveHoverInfo = vi.fn(() => null);
  },
}));
vi.mock('../../../renderers/area/AreaRenderer', () => ({
  AreaRenderer: class {
    update = vi.fn();
    dispose = vi.fn();
    getInteractiveObjects = vi.fn(() => []);
    resolveHoverInfo = vi.fn(() => null);
  },
}));
vi.mock('../../../renderers/pie/PieRenderer', () => ({
  PieRenderer: class {
    update = vi.fn();
    dispose = vi.fn();
    getInteractiveObjects = vi.fn(() => []);
    resolveHoverInfo = vi.fn(() => null);
  },
}));
vi.mock('../../../renderers/scatter/ScatterRenderer', () => ({
  ScatterRenderer: class {
    update = vi.fn();
    dispose = vi.fn();
    getInteractiveObjects = vi.fn(() => []);
    resolveHoverInfo = vi.fn(() => null);
  },
}));
vi.mock('../../../renderers/heatmap/HeatmapRenderer', () => ({
  HeatmapRenderer: class {
    update = vi.fn();
    dispose = vi.fn();
    getInteractiveObjects = vi.fn(() => []);
    resolveHoverInfo = vi.fn(() => null);
  },
}));

const widgetId = 'revenue-comparison';

const makeInput = (overrides?: Partial<ChartRenderInput>): ChartRenderInput => ({
  type: 'bar',
  rotation: [0, 0, 0],
  bounds: { width: 12, height: 8, depth: 0.45 },
  dataSource: { type: 'inline', rows: [], keyField: 'quarter' },
  transforms: [],
  xAxis: { axis: 'x', field: 'quarter' },
  yAxis: { axis: 'y', field: 'revenue' },
  series: [{ field: 'revenue' }, { field: 'costs' }, { field: 'profit' }],
  legend: null,
  theme: 'darkGlass',
  opacity: 1,
  interactive: false,
  nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
  typeConfig: { kind: 'bar', options: {} },
  animateEntry: false,
  animationDuration: 0.4,
  position: [0, 0, 0],
  ...overrides,
});

describe('ChartRenderer empty-data passthrough', () => {
  beforeEach(() => {
    barUpdateCalls.length = 0;
  });

  it('still calls the renderer when data has no rows (scene exit with opacity 0)', () => {
    const store = new ChartDataStore();
    const renderer = new ChartRenderer(store);

    // First frame with real data
    const rows: ReadonlyArray<DataRow> = [
      { quarter: 'Q1', revenue: 128 },
    ];
    store.registerInline(widgetId, rows);
    renderer.update(makeInput({ opacity: 1 }), widgetId);

    // Second frame: empty data (chart exited scene) with opacity 0
    store.registerInline(widgetId, []);
    renderer.update(makeInput({ opacity: 0 }), widgetId);

    // Renderer must be called both times — the second call applies opacity 0
    // to hide the chart. Without it, the chart stays visible from the first frame.
    expect(barUpdateCalls).toHaveLength(2);
    expect((barUpdateCalls[1] as { opacity: number }).opacity).toBe(0);
  });
});

describe('ChartRenderer morph context', () => {
  beforeEach(() => {
    barUpdateCalls.length = 0;
  });

  it('keeps morph fromData pinned to pre-transition data for every morph frame', () => {
    const store = new ChartDataStore();
    const renderer = new ChartRenderer(store);

    const yearA: ReadonlyArray<DataRow> = [
      { quarter: 'Q1', revenue: 128, costs: 87, profit: 41 },
      { quarter: 'Q2', revenue: 184, costs: 115, profit: 69 },
    ];
    const yearB: ReadonlyArray<DataRow> = [
      { quarter: 'Q1', revenue: 165, costs: 102, profit: 63 },
      { quarter: 'Q2', revenue: 218, costs: 135, profit: 83 },
    ];

    store.registerInline(widgetId, yearA);
    renderer.update(makeInput(), widgetId);

    store.registerInline(widgetId, yearB);
    renderer.update(makeInput({ _morphT: 0.2 }), widgetId);
    renderer.update(makeInput({ _morphT: 0.7 }), widgetId);

    const firstMorphCtx = (barUpdateCalls[1] as { morphCtx?: { fromData?: { rows: ReadonlyArray<DataRow> } } })?.morphCtx;
    const secondMorphCtx = (barUpdateCalls[2] as { morphCtx?: { fromData?: { rows: ReadonlyArray<DataRow> } } })?.morphCtx;

    expect(firstMorphCtx?.fromData?.rows).toEqual(yearA);
    expect(secondMorphCtx?.fromData?.rows).toEqual(yearA);
  });
});
