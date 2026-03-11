// Hook that registers function-based data accessors for a chart widget on the plugin's accessorRegistry.

import { useEffect } from 'react';
import type { ChartPluginInstance, ChartAccessorFunctions } from './chartPlugin';

/**
 * Registers function-based data accessors for a chart by ID.
 *
 * Accessors are stored in the plugin's accessorRegistry (not in the SceneTrack).
 * Renderers check for registered accessors before falling back to Number(row[field]).
 *
 * The registry entry persists for the lifetime of the hook (across scenes using the same chart ID).
 * On unmount, accessors are removed and renderers fall back to field-name lookup.
 *
 * @param plugin - The ChartPluginInstance returned by chartPlugin().
 * @param chartId - The `id` prop on the target chart DSL element.
 * @param accessors - Function accessors for one or more data channels.
 */
export function useChartAccessors(
  plugin: ChartPluginInstance,
  chartId: string,
  accessors: ChartAccessorFunctions,
): void {
  useEffect(() => {
    plugin.accessorRegistry.set(chartId, accessors);
    return () => {
      plugin.accessorRegistry.delete(chartId);
    };
  }, [plugin, chartId, accessors]);
}
