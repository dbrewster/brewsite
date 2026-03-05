// Chart demo page — showcases bar, line, pie, and scatter chart types.
import type {JSX} from 'react';
import {Fragment, useMemo} from 'react';
import {EngineARContainer, EngineInputRegion, EngineOverlayHost, EngineProvider, SceneCanvas,} from '@brewsite/core';
import {ChartProvider} from '@brewsite/charts';
import {createChartDemoPlugins} from './widgetSetup';
import {
    chartDemoBar,
    chartDemoLine,
    chartDemoPie,
    chartDemoScatter,
    monthlySaasData,
    productRevenueData,
    teamPerformanceData,
} from './scenes/chartDemo';

const MANIFEST_URL = '/scene-manifest.json';

export default function ChartDemoPage(): JSX.Element {
  const { plugins } = useMemo(() => createChartDemoPlugins(), []);

  const chartData = useMemo(() => ({
    monthly:  monthlySaasData,
    products: productRevenueData,
    teams:    teamPerformanceData,
  }), []);

  return (
    <div style={{ background: '#020812', minHeight: '100vh' }}>
      <EngineProvider
        manifestUrl={MANIFEST_URL}
        plugins={plugins}
        pixelsPerScene={1400}
      >
        <ChartProvider data={chartData}>
          <Fragment key="chart-bar">{chartDemoBar}</Fragment>
          <Fragment key="chart-line">{chartDemoLine}</Fragment>
          <Fragment key="chart-pie">{chartDemoPie}</Fragment>
          <Fragment key="chart-scatter">{chartDemoScatter}</Fragment>
        </ChartProvider>
        <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width" referenceWidth={1920}>
          <EngineInputRegion>
            <SceneCanvas />
            <EngineOverlayHost />
          </EngineInputRegion>
        </EngineARContainer>
      </EngineProvider>
    </div>
  );
}
