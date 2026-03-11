// Hook that registers inline data as a live override in ChartDataStore without touching the SceneTrack lifecycle.

import { useEffect } from 'react';
import { normalizeDataInput } from '../data/transforms';
import type { DataInput } from '../data/types';
import type { ChartPluginInstance } from './chartPlugin';

/**
 * Registers `data` as a live override for the chart identified by `chartId`.
 *
 * On every render where the `data` reference changes, the hook calls:
 *   store.registerInline(widgetId, normalizedRows)
 *   store.setLiveOverride(widgetId)
 *
 * On unmount:
 *   store.deregisterInline(widgetId)
 *   (The store automatically invokes the ChartWidget cleanup callback registered at
 *   widget construction — no direct widget reference needed in this hook.)
 *
 * Ordering: `useEffect` fires after paint. The first frame may render SceneTrack-baked
 * initialRows before the hook fires. This single-frame delta is acceptable.
 *
 * Scope: Only effective when the chart's SceneTrack dataSource.type === 'inline'.
 * Has no effect on named or async data sources.
 *
 * @param plugin - The ChartPluginInstance returned by chartPlugin().
 * @param chartId - The `id` prop of the target chart DSL element.
 * @param data - Inline DataInput. Reference identity is the change signal.
 * @param options - Optional configuration. `filterGroup` participates in linked-brush filtering.
 */
export function useLiveChartData(
  plugin: ChartPluginInstance,
  chartId: string,
  data: DataInput,
  options?: { readonly filterGroup?: string },
): void {
  useEffect(() => {
    const store = plugin.store;
    const widgetId = chartId;
    const rows = normalizeDataInput(data);

    store.registerInline(widgetId, rows, options?.filterGroup);
    store.setLiveOverride(widgetId);

    return () => {
      // deregisterInline automatically triggers ChartWidget's cleanup callback
      // (registered in the widget constructor via store.onDeregisterInline).
      // No widget reference needed here — all cleanup is coordinated through the store.
      store.deregisterInline(widgetId);
    };
  }, [plugin, chartId, data, options?.filterGroup]); // options.filterGroup is stable if memo'd
}
