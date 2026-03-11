// Chart demo page — 10-scene V2 showcase.
import type { JSX } from 'react';
import { useMemo } from 'react';
import {
  BackgroundLayer,
  EngineARContainer,
  EngineOverlayHost,
  InertiaScrollSource,
  KeyboardInput,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
  TimelineWidget,
  useSceneEngineContext,
} from '@brewsite/core';
import { ChartProvider, useLiveChartData } from '@brewsite/charts';
import { createChartDemoPlugins } from './widgetSetup';

// ─── Data imports (named provider registrations only) ────────────────────────
// Inline-data scenes (1, 2, 6, 9) pass data via props — NOT registered here.
// Async scene (8) fetches /data/metrics.json via dataUrl — NOT registered here.
import { regionalRevenue, saasMetrics24Months } from './data/saasMetrics';
import { teamPerformance } from './data/teamData';
import { activityHeatmap } from './data/heatmapData';

// ─── Scene imports ────────────────────────────────────────────────────────────
import { Scene1a, Scene1b } from './scenes/scene1-bar-morph';
import { Scene2a, Scene2b } from './scenes/scene2-stacked-bar';
import { Scene3 } from './scenes/scene3-multiline';
import { Scene4 } from './scenes/scene4-stacked-area';
import { Scene5 } from './scenes/scene5-bubble';
import { Scene6a, Scene6b, Scene6c } from './scenes/scene6-pie-donut';
import { Scene7 } from './scenes/scene7-heatmap';
import { Scene8 } from './scenes/scene8-async';
import { Scene9a, Scene9b, Scene9c, Scene9d } from './scenes/scene9-switcher';
import { Scene10 } from './scenes/scene10-linked-brush';

function ChartProgressIndicator(): JSX.Element {
  const engine = useSceneEngineContext();

  return (
    <TimelineWidget
      engine={engine}
      theme="dark"
      position="bottom"
      thickness={36}
      majorTicks="scene"
      minorTicksPerScene={10}
      showSceneLabels={false}
      showProgress
      scrubEnabled
      style={{ zIndex: 20, left: 4, right: 4, bottom: 12, borderRadius: 10 }}
    />
  );
}

export default function ChartDemoPage(): JSX.Element {
  const { plugins, chartsPlugin } = useMemo(() => createChartDemoPlugins(), []);

  // Named data sources: only scenes using <ChartData source="..."> are registered here.
  //   Scene 3 (multi-line):    source="saas-24m"
  //   Scene 4 (stacked area):  source="regional"
  //   Scene 5 (bubble):        source="teams"
  //   Scene 7 (heatmap):       source="heatmap"
  //   Scene 10 (linked brush): live data via useLiveChartData (no named source needed)
  const chartData = useMemo(() => ({
    'saas-24m': saasMetrics24Months,
    'regional': regionalRevenue,
    'teams':    teamPerformance,
    'heatmap':  activityHeatmap,
  }), []);

  // Scene 10: Register teamPerformance as live inline data for both ops charts,
  // with filterGroup="ops" so linked-brush filters propagate across both charts.
  useLiveChartData(chartsPlugin, 'ops-bar', teamPerformance, { filterGroup: 'ops' });
  useLiveChartData(chartsPlugin, 'ops-scatter', teamPerformance, { filterGroup: 'ops' });

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
          {/* Scene 1: Animated bar morphing (2 sub-scenes, same chart ID) */}
          <Scene1a />
          <Scene1b />

          {/* Scene 2: Stacked bar chart (2 sub-scenes: stacked → horizontal) */}
          <Scene2a />
          <Scene2b />

          {/* Scene 3: Multi-line chart with reference line */}
          <Scene3 />

          {/* Scene 4: Stacked area chart — neonCyber theme */}
          <Scene4 />

          {/* Scene 5: Scatter bubble chart (4D: x/y/size/color) */}
          <Scene5 />

          {/* Scene 6: Pie → Donut → Explode (3 sub-scenes, same chart ID) */}
          <Scene6a />
          <Scene6b />
          <Scene6c />

          {/* Scene 7: Heatmap with time animation */}
          <Scene7 />

          {/* Scene 8: Async data loading */}
          <Scene8 />

          {/* Scene 9: Chart-type switcher (4 sub-scenes, same chart ID) */}
          <Scene9a />
          <Scene9b />
          <Scene9c />
          <Scene9d />

          {/* Scene 10: Linked-brush multi-chart dashboard */}
          <Scene10 />
        </ChartProvider>
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={400}>
          <EngineARContainer aspectRatio={9 / 9} scaleMode="fit-height" referenceWidth={1920}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost />
          </EngineARContainer>
          <KeyboardInput />
          <InertiaScrollSource inertiaSensitivity={0.010} inertiaDecay={0.82} />
        </ScrollStage>
        <ChartProgressIndicator />
      </SceneEngine>
    </div>
  );
}
