// Chart demo page — showcases bar, line, pie, and scatter chart types.
import type {JSX} from 'react';
import {Fragment, useMemo} from 'react';
import {
  BackgroundLayer,
  EngineARContainer,
  EngineOverlayHost,
  KeyboardInput,
  SceneCanvas,
  SceneEngine,
  ScrollInput,
  ScrollStage,
} from '@brewsite/core';
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
      <SceneEngine plugins={plugins}>
        <ChartProvider data={chartData}>
          <Fragment key="chart-bar">{chartDemoBar}</Fragment>
          <Fragment key="chart-line">{chartDemoLine}</Fragment>
          <Fragment key="chart-pie">{chartDemoPie}</Fragment>
          <Fragment key="chart-scatter">{chartDemoScatter}</Fragment>
        </ChartProvider>
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1400}>
          <EngineARContainer aspectRatio={9 / 9} scaleMode="fit-height" referenceWidth={1920}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost />
          </EngineARContainer>
          <ScrollInput source="window" />
          <KeyboardInput />
        </ScrollStage>
      </SceneEngine>
    </div>
  );
}
