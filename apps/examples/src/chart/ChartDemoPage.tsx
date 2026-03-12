// Chart demo page — 10-scene V2 showcase.
import type { JSX } from 'react';
import { useState, useCallback, useMemo, useRef, type RefObject } from 'react';
import {
  ActionInput,
  BackgroundLayer,
  EngineARContainer,
  EngineOverlayHost,
  InertiaScrollSource,
  KeyboardInput,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
  type ScrollStageHandle,
  TimelineWidget,
  useSceneEngineContext,
  clearSceneTrackCache,
  SCENE_THEME_PAIRS,
  type ThemeFamily,
  type ThemePolarity,
} from '@brewsite/core';
import { CHART_THEME_PAIRS, ChartTooltipHost } from '@brewsite/charts';
import { createChartDemoPlugins } from './widgetSetup';
import { ChartDemoThemeProvider } from './scenes/sceneShared';

// Bust the compiled SceneTrack cache whenever this module is re-evaluated by Vite HMR.
// This ensures changes to transition specs (functionalChartTransitionSpec, etc.) take effect
// immediately in the dev server without a hard browser reload.
if (process.env.NODE_ENV !== 'production') { clearSceneTrackCache(); }

// ─── Scene imports ────────────────────────────────────────────────────────────
import { Scene1a, Scene1b } from './scenes/scene1-bar-morph';
import { Scene2a, Scene2b } from './scenes/scene2-stacked-bar';
import { Scene3a, Scene3b } from './scenes/scene3-multiline';
import { Scene4 } from './scenes/scene4-stacked-area';
import { Scene5 } from './scenes/scene5-bubble';
import { Scene6a, Scene6b, Scene6c } from './scenes/scene6-pie-donut';
import { Scene7 } from './scenes/scene7-heatmap';
import { Scene8 } from './scenes/scene8-async';
import { Scene9a, Scene9b, Scene9c, Scene9d } from './scenes/scene9-switcher';
import { Scene10 } from './scenes/scene10-linked-brush';
import {LightDarkToggle} from "../Lights";

type ChartProgressIndicatorProps = {
  scrollStageRef: RefObject<ScrollStageHandle | null>;
  colorMode: 'dark' | 'light';
};

function ChartProgressIndicator({ scrollStageRef, colorMode }: ChartProgressIndicatorProps): JSX.Element {
  const engine = useSceneEngineContext();
  const handleSeek = useCallback((progress: number): void => {
    const rawProgress = engine.progressMapper ? engine.progressMapper.inverse(progress) : progress;
    if (scrollStageRef.current) {
      scrollStageRef.current.scrollToProgress(rawProgress);
      return;
    }
    engine.setProgress(progress);
  }, [engine, scrollStageRef]);

  return (
    <TimelineWidget
      engine={engine}
      theme={colorMode === 'light' ? 'light' : 'dark'}
      position="bottom"
      thickness={36}
      majorTicks="scene"
      minorTicksPerScene={10}
      showSceneLabels={false}
      showProgress
      scrubEnabled
      onSeek={handleSeek}
      style={{ zIndex: 20, left: 0, right: 0, bottom: 0, borderRadius: 10 }}
    />
  );
}

export default function ChartDemoPage(): JSX.Element {
  if (process.env.NODE_ENV !== 'production') {
    clearSceneTrackCache();
  }

  const CHART_FAMILY: ThemeFamily = 'enterprise';
  const [polarity, setPolarity] = useState<ThemePolarity>('light');

  const sceneTheme = SCENE_THEME_PAIRS[CHART_FAMILY][polarity];
  const chartTheme = useMemo(
    () => CHART_THEME_PAIRS[CHART_FAMILY][polarity],
    [polarity]
  );

  const { plugins } = createChartDemoPlugins();
  const scrollStageRef = useRef<ScrollStageHandle | null>(null);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexFlow: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: polarity === 'light'
          ? 'radial-gradient(circle at 50% 0%, #f2f4f3 0%, #dadada 42%, #c2c8c2 72%, #d6d3d6 100%)'
          : 'radial-gradient(circle at 50% 0%, #12345d 0%, #061326 42%, #020812 72%, #01040a 100%)',
      }}
    >
      <LightDarkToggle setPolarity={setPolarity} savePolarityInLocalStorage/>

      <SceneEngine
        plugins={plugins}
        sceneTheme={sceneTheme}
      >
        <ChartDemoThemeProvider value={chartTheme}>
          {/* Scene 1: Animated bar morphing (2 sub-scenes, same chart ID) */}
          <Scene1a />
          <Scene1b />

          {/* Scene 2: Stacked bar chart (2 sub-scenes: stacked → horizontal) */}
          <Scene2a />
          <Scene2b />

          {/* Scene 3: Multi-line chart morph (2 sub-scenes, same chart ID) */}
          <Scene3a />
          <Scene3b />

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
        </ChartDemoThemeProvider>
        <ScrollStage ref={scrollStageRef} scrollHeightMode="scene-count" pixelsPerScene={400}>
          <EngineARContainer aspectRatio={9 / 9} scaleMode="fit-height" referenceWidth={1920}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost passthroughPointerEvents>
              <ChartTooltipHost />
            </EngineOverlayHost>
          </EngineARContainer>
          <ActionInput />
          <KeyboardInput />
          <InertiaScrollSource inertiaSensitivity={0.010} inertiaDecay={0.82} />
        </ScrollStage>
        <ChartProgressIndicator scrollStageRef={scrollStageRef} colorMode={sceneTheme.colorMode} />
      </SceneEngine>
    </div>
  );
}
