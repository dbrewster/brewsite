import { useMemo } from 'react';
import type { JSX } from 'react';
import {
  EngineProvider,
  EngineInputRegion,
  SceneCanvas,
} from '@brewsite/core';
import { ChartProvider } from '@brewsite/charts';
import { createChartDemoPlugins } from './widgetSetup';
import {
  sampleSalesData,
  chartDemoBar,
  chartDemoLine,
  chartDemoScatter,
} from './scenes/chartDemo';

const MANIFEST_URL = '/scene-manifest.json';

export default function ChartDemoPage(): JSX.Element {
  const { plugins } = useMemo(() => createChartDemoPlugins(), []);

  return (
    <EngineProvider manifestUrl={MANIFEST_URL} plugins={plugins}>
      <ChartProvider data={{ sales: sampleSalesData }}>
        {chartDemoBar}
        {chartDemoLine}
        {chartDemoScatter}
      </ChartProvider>
      <EngineInputRegion>
        <SceneCanvas />
      </EngineInputRegion>
    </EngineProvider>
  );
}
