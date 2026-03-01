// chartPlugin factory — composable WidgetPlugin for @brewsite/charts.

import { createElement } from 'react';
import type { ReactNode } from 'react';
import type { WidgetPlugin, WidgetRegistry } from '@brewsite/core';
import { registerNode } from '@brewsite/core';
import { ChartDataStore } from '../data/ChartDataStore';
import { ChartStoreContext } from '../data/ChartStoreContext';
import { Chart, ChartData, ChartAxis, ChartSeries, ChartLegend } from '../elements/chart/dsl';
import { compileChart } from '../elements/chart/compile';
import { ChartWidget } from '../elements/chart/ChartWidget';
import { registerChartHandlers } from '../compiler/handlers';
import type { ChartDSL, ChartDataDSL, ChartAxisDSL, ChartSeriesDSL, ChartLegendDSL } from '../elements/chart/types';

export type ChartPluginInstance = WidgetPlugin & {
  /** The per-engine ChartDataStore owned by this plugin instance. */
  readonly store: ChartDataStore;
};

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

  return {
    store,

    createWidgets: () => {
      // ChartWidgets are created lazily via Chart NodeHandler on first DSL encounter.
      return [];
    },

    registerHandlers: () => {
      registerChartHandlers();
    },

    configureRegistry: (registry: WidgetRegistry) => {
      // Install the Chart NodeHandler with registry access for auto-widget-creation.
      // registerNode() is last-writer-wins — this overrides the guard installed by registerChartHandlers.
      registerNode(Chart, (node, api, helpers) => {
        const props = node.props as Record<string, unknown>;
        const chartId = typeof props['id'] === 'string' ? props['id'] : null;
        if (!chartId) throw new Error('<Chart> requires a string "id" prop.');

        // Auto-create and register ChartWidget on first encounter.
        if (!registry.get(chartId)) {
          registry.register(new ChartWidget(chartId, store));
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

        const chartState = compileChart(props as ChartDSL, dataDsl, axisDsls, seriesDsls, legendDsl);
        api.setWidgetState(chartId, chartState);
      });
    },

    wrapProvider: (children: ReactNode): ReactNode =>
      createElement(ChartStoreContext.Provider, { value: store }, children),
  };
}
