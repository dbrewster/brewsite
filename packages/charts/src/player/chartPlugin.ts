// chartPlugin factory — composable WidgetPlugin for @brewsite/charts.

import { createElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { WidgetPlugin, WidgetRegistry } from '@brewsite/core';
import { registerNode } from '@brewsite/core';
import type { CompileApi, CompileHelpers } from '@brewsite/core';
import { ChartDataStore } from '../data/ChartDataStore';
import { ChartStoreContext } from '../data/ChartStoreContext';
import { Chart, ChartData, ChartAxis, ChartSeries, ChartLegend } from '../elements/chart/ChartWidget';
import { compileChart } from '../elements/chart/compile';
import { ChartWidget } from '../elements/chart/ChartWidget';
import { registerChartHandlers } from '../compiler/handlers';
import type {
  ChartDSL,
  ChartDataDSL,
  ChartSeriesDSL,
  ChartLegendDSL,
  ChartAxisDSL,
  ChartState,
} from '../elements/chart/types';

export type ChartPluginInstance = WidgetPlugin & {
  /** The per-engine ChartDataStore owned by this plugin instance. */
  readonly store: ChartDataStore;
  /**
   * Retrieve a chart widget instance by chart ID to attach onHover/onSelect callbacks.
   * Returns undefined if the chart has not yet been initialized or the id is unknown.
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

function isChartStateLike(state: unknown): state is ChartState {
  if (!state || typeof state !== 'object') return false;
  const candidate = state as Partial<ChartState> & {
    bounds?: { width?: unknown; height?: unknown; depth?: unknown };
    nvsBounds?: { x?: unknown; y?: unknown; w?: unknown; h?: unknown };
  };
  return (
    typeof candidate.type === 'string' &&
    CHART_TYPES.has(candidate.type) &&
    typeof candidate.dataSource === 'string' &&
    Array.isArray(candidate.series) &&
    typeof candidate.bounds?.width === 'number' &&
    typeof candidate.bounds?.height === 'number' &&
    typeof candidate.bounds?.depth === 'number' &&
    typeof candidate.nvsBounds?.x === 'number' &&
    typeof candidate.nvsBounds?.y === 'number' &&
    typeof candidate.nvsBounds?.w === 'number' &&
    typeof candidate.nvsBounds?.h === 'number'
  );
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
  const registerChartWidget = (registry: WidgetRegistry, chartId: string): ChartWidget => {
    const existing = registry.get(chartId);
    if (existing instanceof ChartWidget) {
      widgetMap.set(chartId, existing);
      return existing;
    }

    const widget = new ChartWidget(chartId, store);
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

    getWidget(id: string) {
      return widgetMap.get(id);
    },

    createWidgets: () => {
      // ChartWidgets are created lazily via Chart NodeHandler on first DSL encounter.
      return [];
    },

    registerHandlers: () => {
      registerChartHandlers();
    },

    configureRegistry: (registry: WidgetRegistry) => {
      // Register the main Chart handler. This is the only handler for Chart — child
      // component guards (ChartData, ChartAxis, etc.) are registered separately in
      // registerHandlers() and are never invoked for children collected by this handler.
      registerNode(Chart, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
        const props = node.props as Record<string, unknown>;
        const chartId = typeof props['id'] === 'string' ? props['id'] : null;
        if (!chartId) throw new Error('<Chart> requires a string "id" prop.');

        // Auto-create and register ChartWidget on first encounter.
        if (!registry.get(chartId)) {
          registerChartWidget(registry, chartId);
        }

        // Extract and compile child DSL.
        const children = helpers.collectChildren(node);
        let dataDsl: ChartDataDSL | null = null;
        const axisDsls: ChartAxisDSL[] = [];
        const seriesDsls: ChartSeriesDSL[] = [];
        let legendDsl: ChartLegendDSL | null = null;

        for (const child of children) {
          if (!child || typeof child !== 'object') continue;
          const el = child as { type: unknown; props: Record<string, unknown> };
          if      (el.type === ChartData)   dataDsl = el.props as ChartDataDSL;
          else if (el.type === ChartAxis)   axisDsls.push(el.props as ChartAxisDSL);
          else if (el.type === ChartSeries) seriesDsls.push(el.props as ChartSeriesDSL);
          else if (el.type === ChartLegend) legendDsl = el.props as ChartLegendDSL;
        }

        if (!dataDsl) {
          throw new Error(
            `<Chart id="${chartId}"> is missing a required <ChartData> child. ` +
            `Add <ChartData source="your-source-name" /> as a direct child of <Chart>.`
          );
        }

        const chartState = compileChart(props as ChartDSL, dataDsl, axisDsls, seriesDsls, legendDsl);
        api.setWidgetState(chartId, chartState);
      });
    },

    reconcileCompiledTrack: (
      registry: WidgetRegistry,
      track: Parameters<NonNullable<WidgetPlugin['reconcileCompiledTrack']>>[1],
    ) => {
      for (const tick of track.ticks) {
        for (const [widgetId, state] of Object.entries(tick.state.widgets)) {
          if (!registry.get(widgetId) && isChartStateLike(state)) {
            registerChartWidget(registry, widgetId);
          }
        }
      }
    },

    wrapProvider: (children: ReactNode): ReactNode =>
      createElement(ChartStoreContext.Provider, { value: store }, children),
  };
}
