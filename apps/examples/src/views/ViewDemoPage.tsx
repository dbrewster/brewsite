// View/ViewLayout demo page — showcases standalone views, stack, carousel, and nested views.
import {JSX, type RefObject, useCallback, useMemo, useRef, useState} from 'react';
import {InertiaScrollSource, WidgetPlugin} from '@brewsite/core';
import {
  ActionInput,
  BackgroundLayer,
  corePlugin,
  EngineARContainer,
  EngineOverlayHost,
  KeyboardInput,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
  type ScrollStageHandle,
  type ThemeFamily,
  type ThemePolarity,
  TimelineWidget,
  useSceneEngineContext,
} from '@brewsite/core';
import {chartPlugin} from '@brewsite/charts';
import {diagramPlugin} from '@brewsite/diagram';

import {StandaloneViewsScene} from './scenes/scene1-standalone-views';
import {StackLayoutScene} from './scenes/scene2-stack-layout';
import {CarouselScene, CarouselScene1, CarouselScene2, CarouselScene3, CarouselScene4} from './scenes/scene3-carousel';
import {NestedViewsScene} from './scenes/scene4-nested-views';
import {ChartProgressIndicator, ThemeToggle} from "../Lights";

function createViewDemoPlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [
      corePlugin(),
      chartPlugin(),
      diagramPlugin({ diagrams: ['cf-overview-2'] }),
    ],
  };
}

export default function ViewDemoPage(): JSX.Element {
  const { plugins } = useMemo(() => createViewDemoPlugins(), []);
  const scrollStageRef = useRef<ScrollStageHandle | null>(null);

  const [family, setFamily] = useState<ThemeFamily>('enterprise');
  const [polarity, setPolarity] = useState<ThemePolarity>('light');

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
      <ThemeToggle
        onPolarityChange={setPolarity}
        onFamilyChange={setFamily}
        persist
      />

      <SceneEngine plugins={plugins} themeFamily={family} themePolarity={polarity}
                   invalidateCacheToken={`${family}-${polarity}`}>
        {/* Scene 1: Two standalone views (side-by-side) */}
        <StandaloneViewsScene />

        {/* Scene 2: Stack layout with three charts */}
        <StackLayoutScene />

        {/* Scene 3: Carousel cycling through three views */}
        <CarouselScene1 />
        <CarouselScene2 />
        <CarouselScene3 />
        <CarouselScene4 />

        {/* Scene 4: Nested views with padding */}
        <NestedViewsScene />

        <ScrollStage ref={scrollStageRef} scrollHeightMode="scene-count" pixelsPerScene={500}>
          <EngineARContainer aspectRatio={9 / 9} scaleMode="fit-width">
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost />
          </EngineARContainer>
          <ActionInput />
          <KeyboardInput />
          <InertiaScrollSource inertiaSensitivity={0.010} inertiaDecay={0.82} />
        </ScrollStage>
        <ChartProgressIndicator scrollStageRef={scrollStageRef} polarity={polarity} />
      </SceneEngine>
    </div>
  );
}
