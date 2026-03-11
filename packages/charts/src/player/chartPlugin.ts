// chartPlugin factory — composable WidgetPlugin for @brewsite/charts.

import type { ChartAccessorFunctions } from '../renderers/shared/IChartRenderer';
export type { ChartAccessorFunctions };

import { createElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { WidgetPlugin, WidgetRegistry } from '@brewsite/core';
import { registerNode } from '@brewsite/core';
import type { CompileApi, CompileHelpers } from '@brewsite/core';
import { ChartDataStore } from '../data/ChartDataStore';
import { ChartStoreContext } from '../data/ChartStoreContext';
import {
  Chart, ChartData, ChartAxis, ChartSeries, ChartLegend, ChartDataLabels, ReferenceLine,
  BarChart, LineChart, ScatterPlotChart, PieChart, AreaChart, HeatMapChart,
} from '../elements/chart/stubs';
import {
  compileChart,
  compileBarChartOptions,
  compileLineChartOptions,
  compileScatterChartOptions,
  compilePieChartOptions,
  compileAreaChartOptions,
  compileHeatMapChartOptions,
} from '../elements/chart/compile';
import { ChartWidget } from '../elements/chart/ChartWidget';
import { registerChartHandlers } from '../compiler/handlers';
import type {
  ChartDSL,
  ChartDataDSL,
  ChartSeriesDSL,
  ChartLegendDSL,
  ChartAxisDSL,
  ChartDataLabelsDSL,
  ReferenceLineDSL,
  ChartState,
  ChartTypeOptions,
} from '../elements/chart/types';
import type {
  BarChartDSL,
  LineChartDSL,
  ScatterPlotChartDSL,
  PieChartDSL,
  AreaChartDSL,
  HeatMapChartDSL,
} from '../elements/chart/dsl';

export type ChartPluginInstance = WidgetPlugin & {
  /** The per-engine ChartDataStore owned by this plugin instance. */
  readonly store: ChartDataStore;
  /**
   * V2.1: Accessor registry for useChartAccessors(). Keyed by chart ID (= widgetId).
   * Exposed publicly so the hook can read/write it directly.
   * Runtime implementation (instantiation) is in the chartPlugin() factory — Stream C.
   */
  readonly accessorRegistry: Map<string, ChartAccessorFunctions>;
  /**
   * Retrieve a chart widget instance by chart ID to attach onHover/onSelect callbacks.
   * Returns undefined if the chart has not yet been initialized or the id is unknown.
   * _resetInlineRef is NOT exposed here — it is not a public API.
   *
   * @example
   * const plugin = useMemo(() => chartPlugin(), []);
   * useEffect(() => {
   *   const widget = plugin.getWidget('revenue');
   *   if (widget) widget.onHover = (info) => console.log(info);
   * }, [plugin]);
   */
  getWidget(id: string): Pick<ChartWidget, 'onHover' | 'onSelect'> | undefined;
};

const CHART_TYPES = new Set(['bar', 'line', 'area', 'pie', 'scatter', 'heatmap']);

/**
 * Type guard for V2 ChartState — checks discriminated union dataSource.type field.
 */
function isChartStateLike(state: unknown): state is ChartState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Partial<ChartState>;
  return (
    typeof s.type === 'string' &&
    CHART_TYPES.has(s.type) &&
    s.dataSource !== null && typeof s.dataSource === 'object' &&
    'type' in (s.dataSource as object) &&
    Array.isArray(s.series) &&
    typeof s.bounds?.width === 'number' &&
    typeof s.bounds?.height === 'number' &&
    typeof s.bounds?.depth === 'number'
  );
}

/**
 * Extracts typed chart child DSL props from a collected children array.
 * Children are matched by component identity (type === stub function).
 */
function extractChartChildren(
  children: unknown[],
): {
  dataDsl: ChartDataDSL | null;
  axisDsls: ChartAxisDSL[];
  seriesDsls: ChartSeriesDSL[];
  legendDsl: ChartLegendDSL | null;
  dataLabelsDsl: ChartDataLabelsDSL | null;
  referenceLineDsls: ReferenceLineDSL[];
} {
  let dataDsl: ChartDataDSL | null = null;
  const axisDsls: ChartAxisDSL[] = [];
  const seriesDsls: ChartSeriesDSL[] = [];
  let legendDsl: ChartLegendDSL | null = null;
  let dataLabelsDsl: ChartDataLabelsDSL | null = null;
  const referenceLineDsls: ReferenceLineDSL[] = [];

  for (const child of children) {
    if (!child || typeof child !== 'object') continue;
    const el = child as { type: unknown; props: Record<string, unknown> };
    if      (el.type === ChartData)       dataDsl = el.props as ChartDataDSL;
    else if (el.type === ChartAxis)       axisDsls.push(el.props as ChartAxisDSL);
    else if (el.type === ChartSeries)     seriesDsls.push(el.props as ChartSeriesDSL);
    else if (el.type === ChartLegend)     legendDsl = el.props as ChartLegendDSL;
    else if (el.type === ChartDataLabels) dataLabelsDsl = el.props as ChartDataLabelsDSL;
    else if (el.type === ReferenceLine)   referenceLineDsls.push(el.props as ReferenceLineDSL);
  }

  return { dataDsl, axisDsls, seriesDsls, legendDsl, dataLabelsDsl, referenceLineDsls };
}

/**
 * Creates a WidgetPlugin for @brewsite/charts.
 *
 * Each call creates a fully isolated plugin + ChartDataStore instance.
 * Use one instance per EngineProvider.
 *
 * @example
 * const chartsPlugin = useMemo(() => chartPlugin(), []);
 * // In JSX:
 * <EngineProvider plugins={[corePlugin(), chartsPlugin]}>
 *   <ChartProvider data={{ sales: [...] }}>
 *     <ScenePlayer ... />
 *   </ChartProvider>
 * </EngineProvider>
 */
export function chartPlugin(): ChartPluginInstance {
  const store = new ChartDataStore();
  const widgetMap = new Map<string, ChartWidget>();
  const accessorRegistry = new Map<string, ChartAccessorFunctions>();

  const registerChartWidget = (registry: WidgetRegistry, chartId: string): ChartWidget => {
    const existing = registry.get(chartId);
    if (existing instanceof ChartWidget) {
      widgetMap.set(chartId, existing);
      return existing;
    }

    const widget = new ChartWidget(chartId, store, accessorRegistry);
    widgetMap.set(chartId, widget);
    const originalDispose = widget.dispose.bind(widget);
    widget.dispose = () => {
      widgetMap.delete(chartId);
      originalDispose();
    };
    registry.register(widget);
    return widget;
  };

  return {
    store,
    accessorRegistry,

    getWidget(id: string) {
      return widgetMap.get(id);
    },

    createWidgets: () => {
      // ChartWidgets are created lazily via NodeHandlers on first DSL encounter.
      return [];
    },

    registerHandlers: () => {
      registerChartHandlers();
    },

    configureRegistry: (registry: WidgetRegistry) => {
      // ─── Per-type V2 handlers ──────────────────────────────────────────────

      registerNode(BarChart, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
        const props = node.props as BarChartDSL;
        const chartId = props.id;
        if (!chartId) throw new Error('<BarChart> requires an "id" prop.');
        if (!registry.get(chartId)) registerChartWidget(registry, chartId);

        const children = helpers.collectChildren(node);
        const { dataDsl, axisDsls, seriesDsls, legendDsl, dataLabelsDsl, referenceLineDsls } =
          extractChartChildren(children);

        const typeOptions: ChartTypeOptions = {
          kind: 'bar',
          options: compileBarChartOptions(props),
        };

        const state = compileChart(
          props, 'bar', typeOptions, dataDsl, axisDsls, seriesDsls,
          legendDsl, dataLabelsDsl, referenceLineDsls,
        );
        api.setWidgetState(chartId, state);
      });

      registerNode(LineChart, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
        const props = node.props as LineChartDSL;
        const chartId = props.id;
        if (!chartId) throw new Error('<LineChart> requires an "id" prop.');
        if (!registry.get(chartId)) registerChartWidget(registry, chartId);

        const children = helpers.collectChildren(node);
        const { dataDsl, axisDsls, seriesDsls, legendDsl, dataLabelsDsl, referenceLineDsls } =
          extractChartChildren(children);

        const typeOptions: ChartTypeOptions = {
          kind: 'line',
          options: compileLineChartOptions(props),
        };

        const state = compileChart(
          props, 'line', typeOptions, dataDsl, axisDsls, seriesDsls,
          legendDsl, dataLabelsDsl, referenceLineDsls,
        );
        api.setWidgetState(chartId, state);
      });

      registerNode(ScatterPlotChart, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
        const props = node.props as ScatterPlotChartDSL;
        const chartId = props.id;
        if (!chartId) throw new Error('<ScatterPlotChart> requires an "id" prop.');
        if (!registry.get(chartId)) registerChartWidget(registry, chartId);

        const children = helpers.collectChildren(node);
        const { dataDsl, axisDsls, seriesDsls, legendDsl, dataLabelsDsl, referenceLineDsls } =
          extractChartChildren(children);

        const typeOptions: ChartTypeOptions = {
          kind: 'scatter',
          options: compileScatterChartOptions(props),
        };

        const state = compileChart(
          props, 'scatter', typeOptions, dataDsl, axisDsls, seriesDsls,
          legendDsl, dataLabelsDsl, referenceLineDsls,
        );
        api.setWidgetState(chartId, state);
      });

      registerNode(PieChart, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
        const props = node.props as PieChartDSL;
        const chartId = props.id;
        if (!chartId) throw new Error('<PieChart> requires an "id" prop.');
        if (!registry.get(chartId)) registerChartWidget(registry, chartId);

        const children = helpers.collectChildren(node);
        const { dataDsl, axisDsls, seriesDsls, legendDsl, dataLabelsDsl, referenceLineDsls } =
          extractChartChildren(children);

        const typeOptions: ChartTypeOptions = {
          kind: 'pie',
          options: compilePieChartOptions(props),
        };

        const state = compileChart(
          props, 'pie', typeOptions, dataDsl, axisDsls, seriesDsls,
          legendDsl, dataLabelsDsl, referenceLineDsls,
        );
        api.setWidgetState(chartId, state);
      });

      registerNode(AreaChart, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
        const props = node.props as AreaChartDSL;
        const chartId = props.id;
        if (!chartId) throw new Error('<AreaChart> requires an "id" prop.');
        if (!registry.get(chartId)) registerChartWidget(registry, chartId);

        const children = helpers.collectChildren(node);
        const { dataDsl, axisDsls, seriesDsls, legendDsl, dataLabelsDsl, referenceLineDsls } =
          extractChartChildren(children);

        const typeOptions: ChartTypeOptions = {
          kind: 'area',
          options: compileAreaChartOptions(props),
        };

        const state = compileChart(
          props, 'area', typeOptions, dataDsl, axisDsls, seriesDsls,
          legendDsl, dataLabelsDsl, referenceLineDsls,
        );
        api.setWidgetState(chartId, state);
      });

      registerNode(HeatMapChart, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
        const props = node.props as HeatMapChartDSL;
        const chartId = props.id;
        if (!chartId) throw new Error('<HeatMapChart> requires an "id" prop.');
        if (!registry.get(chartId)) registerChartWidget(registry, chartId);

        const children = helpers.collectChildren(node);
        const { dataDsl, axisDsls, seriesDsls, legendDsl, dataLabelsDsl, referenceLineDsls } =
          extractChartChildren(children);

        const typeOptions: ChartTypeOptions = {
          kind: 'heatmap',
          options: compileHeatMapChartOptions(props),
        };

        const state = compileChart(
          props, 'heatmap', typeOptions, dataDsl, axisDsls, seriesDsls,
          legendDsl, dataLabelsDsl, referenceLineDsls,
        );
        api.setWidgetState(chartId, state);
      });

      // ─── Deprecated V1 Chart handler ──────────────────────────────────────
      // Maps V1 flat props to V2 typeConfig structure.
      registerNode(Chart, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
        const props = node.props as Record<string, unknown>;
        const chartId = typeof props['id'] === 'string' ? props['id'] : null;
        if (!chartId) throw new Error('<Chart> requires a string "id" prop.');

        if (!registry.get(chartId)) registerChartWidget(registry, chartId);

        const dsl = props as ChartDSL;
        const kind = (dsl.type ?? 'bar') as ChartState['type'];

        const children = helpers.collectChildren(node);
        const { dataDsl, axisDsls, seriesDsls, legendDsl, dataLabelsDsl, referenceLineDsls } =
          extractChartChildren(children);

        // Build typeOptions from V1 flat props — V1→V2 compat shim
        let typeOptions: ChartTypeOptions;
        switch (kind) {
          case 'line':
            typeOptions = {
              kind: 'line',
              options: {
                lineShape: dsl.lineShape,
                lineSmoothness: dsl.lineSmoothness,
                lineSubdivisions: dsl.lineSubdivisions,
              },
            };
            break;
          case 'pie':
            typeOptions = {
              kind: 'pie',
              options: {
                innerRadius: dsl.innerRadius,
                pieTilt: dsl.pieTilt,
              },
            };
            break;
          case 'heatmap':
            typeOptions = {
              kind: 'heatmap',
              options: {
                timeField: dsl.timeField,
              },
            };
            break;
          case 'scatter':
            typeOptions = { kind: 'scatter', options: {} };
            break;
          case 'area':
            typeOptions = { kind: 'area', options: {} };
            break;
          default:
            typeOptions = { kind: 'bar', options: {} };
            break;
        }

        const state = compileChart(
          dsl, kind, typeOptions, dataDsl, axisDsls, seriesDsls,
          legendDsl, dataLabelsDsl, referenceLineDsls,
        );
        api.setWidgetState(chartId, state);
      });
    },

    reconcileCompiledTrack: (
      registry: WidgetRegistry,
      track: Parameters<NonNullable<WidgetPlugin['reconcileCompiledTrack']>>[1],
    ) => {
      for (const tick of track.ticks) {
        for (const [widgetId, state] of Object.entries(tick.state.widgets)) {
          if (!registry.get(widgetId) && isChartStateLike(state)) {
            const widget = registerChartWidget(registry, widgetId);
            if (state.dataSource.type === 'async') {
              widget._configureAsync(state.dataSource.url, state.dataSource.format ?? 'json');
            }
          }
        }
      }
    },

    wrapProvider: (children: ReactNode): ReactNode =>
      createElement(ChartStoreContext.Provider, { value: store }, children),
  };
}
