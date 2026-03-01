// ChartProvider — registers data sources into the per-engine ChartDataStore.

import { type ReactNode, useEffect } from 'react';
import { useChartStore } from '../data/ChartStoreContext';

export type ChartProviderProps = {
  /** Map of source name → rows to register. Registered on mount, unregistered on unmount. */
  data: Readonly<Record<string, ReadonlyArray<Record<string, unknown>>>>;
  children: ReactNode;
};

/**
 * Registers data sources into the ChartDataStore provided by chartPlugin().wrapProvider().
 *
 * Must be placed inside the EngineProvider that includes chartPlugin().
 * Data is registered on mount and unregistered on unmount.
 *
 * @example
 * <EngineProvider plugins={[corePlugin(), chartsPlugin]}>
 *   <ChartProvider data={{ sales: salesRows }}>
 *     <ScenePlayer ... />
 *   </ChartProvider>
 * </EngineProvider>
 */
export function ChartProvider({ data, children }: ChartProviderProps): ReactNode {
  const store = useChartStore();

  useEffect(() => {
    for (const [name, rows] of Object.entries(data)) {
      store.register(name, rows);
    }
    return () => {
      for (const name of Object.keys(data)) {
        store.unregister(name);
      }
    };
  }, [store, data]);

  return <>{children}</>;
}
