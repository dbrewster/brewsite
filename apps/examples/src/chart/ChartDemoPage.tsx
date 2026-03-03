// Chart demo page — showcases bar, line, pie, and scatter chart types.
import { useMemo, Fragment } from 'react';
import type { JSX } from 'react';
import {
  EngineProvider,
  EngineInputRegion,
  EngineOverlayHost,
  SceneCanvas,
} from '@brewsite/core';
import { ChartProvider } from '@brewsite/charts';
import { createChartDemoPlugins } from './widgetSetup';
import {
  monthlySaasData,
  productRevenueData,
  teamPerformanceData,
  chartDemoBar,
  chartDemoLine,
  chartDemoPie,
  chartDemoScatter,
} from './scenes/chartDemo';

const MANIFEST_URL = '/scene-manifest.json';

export default function ChartDemoPage(): JSX.Element {
  const { plugins } = useMemo(() => createChartDemoPlugins(), []);

  return (
    <div style={{ background: '#020812', minHeight: '100vh' }}>
      <EngineProvider
        manifestUrl={MANIFEST_URL}
        plugins={plugins}
        pixelsPerScene={1400}
      >
        <ChartProvider
          data={{
            monthly:  monthlySaasData,
            products: productRevenueData,
            teams:    teamPerformanceData,
          }}
        >
          <Fragment key="chart-bar">{chartDemoBar}</Fragment>
          <Fragment key="chart-line">{chartDemoLine}</Fragment>
          <Fragment key="chart-pie">{chartDemoPie}</Fragment>
          <Fragment key="chart-scatter">{chartDemoScatter}</Fragment>
        </ChartProvider>
        <EngineInputRegion>
          <SceneCanvas />
          <EngineOverlayHost />
        </EngineInputRegion>
      </EngineProvider>
    </div>
  );
}
