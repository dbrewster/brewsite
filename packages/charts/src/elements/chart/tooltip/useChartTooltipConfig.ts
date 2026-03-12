// useChartTooltipConfig — registers custom tooltip renderContent for a specific chart.

import { useEffect } from 'react';
import { chartTooltipStore } from './ChartTooltipStore';
import type { ChartTooltipRuntimeConfig } from './types';

/**
 * Registers a custom renderContent function for the named chart's tooltip.
 * Deregisters automatically on component unmount or when chartId changes.
 *
 * @param chartId   Matches the `id` prop on the chart DSL component.
 * @param config    Runtime tooltip config. Stabilize renderContent with useCallback.
 */
export function useChartTooltipConfig(
  chartId: string,
  config: ChartTooltipRuntimeConfig,
): void {
  // Always-update: keep current config reference in the store without re-running cleanup
  useEffect(() => {
    chartTooltipStore.setRuntimeConfig(chartId, config);
  });

  // Cleanup on unmount or chartId change
  useEffect(() => {
    return () => {
      chartTooltipStore.clearRuntimeConfig(chartId);
    };
  }, [chartId]);
}
