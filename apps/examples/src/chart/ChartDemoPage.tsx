// Chart demo page — 10-scene V2 showcase.
import type { JSX } from 'react';
import { useMemo, useRef, useState } from 'react';
import {
  InputCoordinator,
  BackgroundLayer,
  EngineARContainer,
  EngineOverlayHost,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
  type ScrollStageHandle,
  type ThemeFamily,
  type ThemePolarity,
  type ActiveTheme,
  clearSceneTrackCache,
} from '@brewsite/core';
import { ChartTooltipHost } from '@brewsite/charts';
import { createChartDemoPlugins } from './widgetSetup';
import { ThemeToggle } from '../Lights';
import { ExampleHeader, useFpsCap } from '../ExampleHeader';
import { StatsOverlay } from '../StatsOverlay';

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
import {ChartProgressIndicator} from "../Lights";

export default function ChartDemoPage(): JSX.Element {
  const { plugins } = useMemo(() => createChartDemoPlugins(), []);
  const scrollStageRef = useRef<ScrollStageHandle | null>(null);

  const [family, setFamily] = useState<ThemeFamily>('lightCanvas');
  const [polarity, setPolarity] = useState<ThemePolarity>('light');
  const theme = useMemo((): ActiveTheme => ({ family, polarity }), [family, polarity]);
  const fpsCap = useFpsCap();

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
          : 'radial-gradient(circle at 50% 0%, #0a1830 0%, #04091a 42%, #020610 72%, #010408 100%)',
      }}
    >
      <ExampleHeader>
        <ThemeToggle
          onPolarityChange={setPolarity}
          onFamilyChange={setFamily}
          initialFamily="lightCanvas"
          initialPolarity="light"
          persist
          style={{position: 'static', zIndex: 'auto'}}
        />
      </ExampleHeader>
      <SceneEngine
        plugins={plugins}
        theme={theme}
        timingProfile={{ fpsCap }}
      >
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
        <ScrollStage ref={scrollStageRef} scrollHeightMode="scene-count" pixelsPerScene={400}>
          <EngineARContainer aspectRatio={9 / 9} scaleMode="fit-height" referenceWidth={1920}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost passthroughPointerEvents>
              <ChartTooltipHost />
            </EngineOverlayHost>
          </EngineARContainer>
          <InputCoordinator inertiaSensitivity={0.012} inertiaDecay={0.85} />
        </ScrollStage>
        <ChartProgressIndicator scrollStageRef={scrollStageRef} polarity="light" />
        <StatsOverlay />
      </SceneEngine>
    </div>
  );
}
