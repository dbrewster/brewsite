// ChartProvider — registers data sources into the per-engine ChartDataStore.

import { type ReactNode, useEffect } from 'react';
import { useChartStore } from '../data/ChartStoreContext';

type Row = Record<string, unknown>;

/** Object form for a single data source with optional filter group. */
export type DataSourceConfig = {
  readonly rows: ReadonlyArray<Row>;
  readonly filterGroup?: string;
};

/**
 * Accepted value for each entry in ChartProviderProps.data.
 * - ReadonlyArray<Row>: flat shorthand (no filter group)
 * - DataSourceConfig: object form with optional filterGroup
 */
// DEBT: Rename to ChartProviderDataInput to avoid collision with public DataInput type
export type DataInput = ReadonlyArray<Row> | DataSourceConfig;

export type ChartProviderProps = {
  /**
   * Map of source name → data.
   *
   * Flat shorthand (backward compatible):
   *   data={{ sales: salesRows }}
   *
   * Object form with filter group:
   *   data={{ sales: { rows: salesRows, filterGroup: 'linked-brush-1' } }}
   *
   * Both forms can be mixed in the same ChartProvider.
   */
  data: Readonly<Record<string, DataInput>>;
  children: ReactNode;
};

function isDataSourceConfig(v: DataInput): v is DataSourceConfig {
  return !Array.isArray(v) && typeof v === 'object' && v !== null && 'rows' in v;
}

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
    for (const [name, input] of Object.entries(data)) {
      if (isDataSourceConfig(input)) {
        store.register(name, input.rows, input.filterGroup);
      } else {
        store.register(name, input);
      }
    }
    return () => {
      for (const name of Object.keys(data)) {
        store.unregister(name);
      }
    };
  }, [store, data]);

  return <>{children}</>;
}
