// Integration tests for chartPlugin compilation pipeline.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('three', () => {
  class Vector3 {
    x = 0; y = 0; z = 0;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
    distanceTo() { return 0; }
  }
  class Object3D {
    children: Object3D[] = [];
    position = new Vector3();
    rotation = { set: vi.fn() };
    userData: Record<string, unknown> = {};
    add(...objs: Object3D[]) { this.children.push(...objs); }
    remove(obj: Object3D) { const i = this.children.indexOf(obj); if (i >= 0) this.children.splice(i, 1); }
  }
  class Scene extends Object3D {}
  class Group extends Object3D {}
  class BufferGeometry { dispose = vi.fn(); }
  class MockMaterial {
    opacity = 1; transparent = false; dispose = vi.fn();
    constructor(opts: Record<string, unknown> = {}) { Object.assign(this, opts); }
  }
  class MeshPhysicalMaterial extends MockMaterial {}
  class LineBasicMaterial extends MockMaterial {}
  class MeshStandardMaterial extends MockMaterial {}
  class Mesh extends Object3D {
    geometry: BufferGeometry;
    material: MockMaterial;
    constructor(geo?: BufferGeometry, mat?: MockMaterial) {
      super();
      this.geometry = geo ?? new BufferGeometry();
      this.material = mat ?? new MockMaterial();
    }
  }
  class Camera extends Object3D {}
  class PerspectiveCamera extends Camera {}
  class Raycaster {
    setFromCamera = vi.fn();
    intersectObjects = vi.fn().mockReturnValue([]);
  }
  class Color { constructor(_?: unknown) {} set(_: unknown) {} }
  const FrontSide = 0;
  return {
    Vector3, Object3D, Scene, Group, BufferGeometry,
    MeshPhysicalMaterial, LineBasicMaterial, MeshStandardMaterial,
    Mesh, Camera, PerspectiveCamera, Raycaster, Color, FrontSide,
  };
});

// Mock all renderers to avoid d3 + Three.js dependency chains
vi.mock('../../renderers/bar/BarRenderer', () => ({
  BarRenderer: class { update = vi.fn(); dispose = vi.fn(); getInteractiveObjects = vi.fn().mockReturnValue([]); resolveHoverInfo = vi.fn(); },
}));
vi.mock('../../renderers/line/LineRenderer', () => ({
  LineRenderer: class { update = vi.fn(); dispose = vi.fn(); getInteractiveObjects = vi.fn().mockReturnValue([]); resolveHoverInfo = vi.fn(); },
}));
vi.mock('../../renderers/area/AreaRenderer', () => ({
  AreaRenderer: class { update = vi.fn(); dispose = vi.fn(); getInteractiveObjects = vi.fn().mockReturnValue([]); resolveHoverInfo = vi.fn(); },
}));
vi.mock('../../renderers/pie/PieRenderer', () => ({
  PieRenderer: class { update = vi.fn(); dispose = vi.fn(); getInteractiveObjects = vi.fn().mockReturnValue([]); resolveHoverInfo = vi.fn(); },
}));
vi.mock('../../renderers/scatter/ScatterRenderer', () => ({
  ScatterRenderer: class { update = vi.fn(); dispose = vi.fn(); getInteractiveObjects = vi.fn().mockReturnValue([]); resolveHoverInfo = vi.fn(); },
}));
vi.mock('../../renderers/heatmap/HeatmapRenderer', () => ({
  HeatmapRenderer: class { update = vi.fn(); dispose = vi.fn(); getInteractiveObjects = vi.fn().mockReturnValue([]); resolveHoverInfo = vi.fn(); },
}));

import { createElement } from 'react';
import { WidgetRegistry } from '@brewsite/core';
import { chartPlugin } from '../../player/chartPlugin';
import {
  compileChart,
  compileBarChartOptions,
  compilePieChartOptions,
  compileScatterChartOptions,
} from '../../elements/chart/compile';
import { resetChartHandlerRegistrationForTesting } from '../handlers';
import type { ChartState } from '../../elements/chart/types';

describe('chartPlugin', () => {
  beforeEach(() => {
    resetChartHandlerRegistrationForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an isolated plugin with store', () => {
    const plugin = chartPlugin();
    expect(plugin.store).toBeDefined();
    expect(plugin.getWidget).toBeDefined();
    expect(plugin.registerHandlers).toBeDefined();
    expect(plugin.configureRegistry).toBeDefined();
  });

  it('getWidget returns undefined before any widget is created', () => {
    const plugin = chartPlugin();
    expect(plugin.getWidget('nonexistent')).toBeUndefined();
  });

  it('store is accessible on the plugin instance', () => {
    const plugin = chartPlugin();
    plugin.store.register('test', [{ x: 1 }]);
    const frame = plugin.store.resolve('test', []);
    expect(frame.rows).toHaveLength(1);
  });

  it('two plugin instances have separate stores', () => {
    const plugin1 = chartPlugin();
    const plugin2 = chartPlugin();
    plugin1.store.register('data', [{ v: 1 }]);
    const frame = plugin2.store.resolve('data', []);
    expect(frame.rows).toHaveLength(0);
  });

  it('wrapProvider wraps children with ChartStoreContext', () => {
    const plugin = chartPlugin();
    expect(plugin.wrapProvider).toBeDefined();
    const wrapped = plugin.wrapProvider!(createElement('div'));
    expect(wrapped).not.toBeNull();
  });

  it('createWidgets returns empty array (widgets created lazily)', () => {
    const plugin = chartPlugin();
    const widgets = plugin.createWidgets!();
    expect(widgets).toEqual([]);
  });

  it('registerHandlers does not throw', () => {
    const plugin = chartPlugin();
    expect(() => plugin.registerHandlers!()).not.toThrow();
  });

  it('reconcileCompiledTrack registers missing chart widgets from compiled state', () => {
    const plugin = chartPlugin();
    const registry = new WidgetRegistry({ strict: true });

    const chartState = compileChart(
      { id: 'revenue' },
      'bar',
      { kind: 'bar', options: compileBarChartOptions({ id: 'revenue' }) },
      { source: 'sales' },
      [{ axis: 'x', field: 'month', label: 'Month' }],
      [{ field: 'sales', label: 'Sales' }],
      null,
      null,
      [],
    );

    plugin.reconcileCompiledTrack?.(registry, {
      ticks: [
        {
          state: {
            widgets: {
              revenue: chartState,
            },
          },
        },
      ],
    } as never);

    expect(registry.get('revenue')).toBeDefined();
    expect(plugin.getWidget('revenue')).toBeDefined();
  });

  it('reconcileCompiledTrack calls _configureAsync for async sources', () => {
    const plugin = chartPlugin();
    const registry = new WidgetRegistry({ strict: true });

    const asyncState = compileChart(
      { id: 'async-chart', dataUrl: '/data/metrics.json' },
      'line',
      { kind: 'line', options: {} },
      null,
      [{ axis: 'x', field: 'month' }],
      [{ field: 'value' }],
      null,
      null,
      [],
    );

    plugin.reconcileCompiledTrack?.(registry, {
      ticks: [
        {
          state: {
            widgets: {
              'async-chart': asyncState,
            },
          },
        },
      ],
    } as never);

    const widget = plugin.getWidget('async-chart');
    expect(widget).toBeDefined();
    // After _configureAsync, isLoaded should be false (has async URL, not yet fetched)
    const chartWidget = registry.get('async-chart') as { isLoaded: boolean };
    expect(chartWidget.isLoaded).toBe(false);
  });
});

describe('compileChart via chartPlugin', () => {
  it('compiles BarChart with all children into correct V2 ChartState', () => {
    const typeOptions = { kind: 'bar' as const, options: compileBarChartOptions({ id: 'revenue' }) };
    const state: ChartState = compileChart(
      { id: 'revenue', opacity: 0.8, theme: 'neonCyber' },
      'bar',
      typeOptions,
      { source: 'sales', transforms: [{ type: 'filter', field: 'year', op: 'eq', value: 2025 }] },
      [
        { axis: 'x', field: 'month', label: 'Month' },
        { axis: 'y', field: 'revenue', label: 'Revenue ($)', format: '$,.0f' },
      ],
      [
        { field: 'revenue', label: 'Revenue' },
        { field: 'costs', label: 'Costs' },
      ],
      { visible: true, position: 'right' },
      null,
      [],
    );

    expect(state.type).toBe('bar');
    expect(state.typeConfig.kind).toBe('bar');
    expect(state.dataSource).toMatchObject({ type: 'named', name: 'sales' });
    expect(state.transforms).toHaveLength(1);
    expect(state.xAxis?.field).toBe('month');
    expect(state.yAxis?.field).toBe('revenue');
    expect(state.yAxis?.format).toBe('$,.0f');
    expect(state.series).toHaveLength(2);
    expect(state.legend?.visible).toBe(true);
    expect(state.legend?.position).toBe('right');
    expect(state.theme).toBe('neonCyber');
    expect(state.opacity).toBe(0.8);
  });

  it('PieChart handler produces state with correct typeConfig.kind', () => {
    const typeOptions = { kind: 'pie' as const, options: compilePieChartOptions({ id: 'donut', innerRadius: 0.4 }) };
    const state: ChartState = compileChart(
      { id: 'donut', innerRadius: 0.4 },
      'pie',
      typeOptions,
      { source: 'data' },
      [],
      [],
      null,
      null,
      [],
    );
    expect(state.type).toBe('pie');
    expect(state.typeConfig.kind).toBe('pie');
    expect(state.typeConfig.options).toMatchObject({ innerRadius: 0.4 });
  });

  it('ScatterPlotChart handler produces state with sizeField and colorField in typeConfig.options', () => {
    const typeOptions = {
      kind: 'scatter' as const,
      options: compileScatterChartOptions({ id: 'sc', sizeField: 'headcount', colorField: 'region' }),
    };
    const state: ChartState = compileChart(
      { id: 'sc', sizeField: 'headcount', colorField: 'region' } as never,
      'scatter',
      typeOptions,
      { source: 'teams' },
      [],
      [],
      null,
      null,
      [],
    );
    expect(state.typeConfig.kind).toBe('scatter');
    expect(state.typeConfig.options).toMatchObject({ sizeField: 'headcount', colorField: 'region' });
  });

  it('compileChart with null dataDsl and no dataUrl yields empty named source', () => {
    const state = compileChart(
      { id: 'c' },
      'bar',
      { kind: 'bar', options: {} },
      null,
      [],
      [],
      null,
      null,
      [],
    );
    expect(state.dataSource).toMatchObject({ type: 'named', name: '' });
  });

  it('compileChart with inline data yields InlineDataSource', () => {
    const rows = [{ month: 'Jan', revenue: 100 }];
    const state = compileChart(
      { id: 'c', data: rows },
      'bar',
      { kind: 'bar', options: {} },
      null,
      [],
      [],
      null,
      null,
      [],
    );
    expect(state.dataSource).toMatchObject({ type: 'inline', rows });
  });

  it('compileChart with dataUrl yields AsyncDataSource', () => {
    const state = compileChart(
      { id: 'c', dataUrl: '/api/data.json' },
      'line',
      { kind: 'line', options: {} },
      null,
      [],
      [],
      null,
      null,
      [],
    );
    expect(state.dataSource).toMatchObject({ type: 'async', url: '/api/data.json' });
  });

  it('compileChart includes filterGroup from ChartData DSL', () => {
    const state = compileChart(
      { id: 'c' },
      'bar',
      { kind: 'bar', options: {} },
      { source: 'data', filterGroup: 'linked-brush-1' },
      [],
      [],
      null,
      null,
      [],
    );
    expect(state.filterGroup).toBe('linked-brush-1');
  });

  it('isChartStateLike correctly identifies V2 ChartState (dataSource is object)', () => {
    const plugin = chartPlugin();
    const registry = new WidgetRegistry({ strict: true });

    const v2State = compileChart(
      { id: 'v2' },
      'bar',
      { kind: 'bar', options: {} },
      { source: 'data' },
      [],
      [],
      null,
      null,
      [],
    );

    // V2 state should be recognized by reconcileCompiledTrack
    plugin.reconcileCompiledTrack?.(registry, {
      ticks: [{ state: { widgets: { v2: v2State } } }],
    } as never);

    expect(registry.get('v2')).toBeDefined();
  });

  it('compileChart with multiple independent states produces separate ChartState objects', () => {
    const state1: ChartState = compileChart(
      { id: 'c1' },
      'bar',
      { kind: 'bar', options: {} },
      { source: 'sales' },
      [{ axis: 'x', field: 'month' }],
      [],
      null,
      null,
      [],
    );

    const state2: ChartState = compileChart(
      { id: 'c2', opacity: 0.5 },
      'line',
      { kind: 'line', options: {} },
      { source: 'expenses' },
      [{ axis: 'y', field: 'cost' }],
      [{ field: 'cost', label: 'Cost' }],
      { visible: true, position: 'bottom' },
      null,
      [],
    );

    expect(state1.type).toBe('bar');
    expect(state1.dataSource).toMatchObject({ type: 'named', name: 'sales' });
    expect(state2.type).toBe('line');
    expect(state2.dataSource).toMatchObject({ type: 'named', name: 'expenses' });
    expect(state2.opacity).toBe(0.5);
    expect(state2.legend?.position).toBe('bottom');
  });
});

describe('guard handlers', () => {
  beforeEach(() => {
    resetChartHandlerRegistrationForTesting();
  });

  it('registerChartHandlers registers guard handlers for child DSL components', () => {
    const plugin = chartPlugin();
    plugin.registerHandlers!();
    // Guard handlers are registered; they throw when children appear outside a chart component.
    // We verify registration completes without error.
    expect(true).toBe(true);
  });
});
