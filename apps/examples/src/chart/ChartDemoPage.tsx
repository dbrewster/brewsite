// Chart demo page — showcases bar, line, pie, and scatter chart types.
import type {JSX} from 'react';
import {useMemo} from 'react';
import {BackgroundLayer, EngineARContainer, EngineOverlayHost, InertiaScrollSource, KeyboardInput, SceneCanvas, SceneEngine, ScrollStage,} from '@brewsite/core';
import {ChartProvider} from '@brewsite/charts';
import {createChartDemoPlugins} from './widgetSetup';
import {ChartDemoBar, ChartDemoLine, ChartDemoPie, ChartDemoScatter, monthlySaasData, productRevenueData, teamPerformanceData,} from './scenes/chartDemo';

export default function ChartDemoPage(): JSX.Element {
  const { plugins } = useMemo(() => createChartDemoPlugins(), []);

  const chartData = useMemo(() => ({
    monthly:  monthlySaasData,
    products: productRevenueData,
    teams:    teamPerformanceData,
  }), []);

  return (
    <div
      style={{
        display: 'flex',
        flexFlow: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 0%, #12345d 0%, #061326 42%, #020812 72%, #01040a 100%)',
      }}
    >
      <SceneEngine plugins={plugins}>
        <ChartProvider data={chartData}>
          <ChartDemoBar/>
          <ChartDemoLine/>
          <ChartDemoPie/>
          <ChartDemoScatter/>
        </ChartProvider>
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1400}>
          <EngineARContainer aspectRatio={9 / 9} scaleMode="fit-height" referenceWidth={1920}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost />
          </EngineARContainer>
          <KeyboardInput />
        </ScrollStage>
      </SceneEngine>
    </div>
  );
}
