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
import {CarouselScene1, CarouselScene2, CarouselScene3} from './scenes/scene3-carousel';
import {NestedViewsScene} from './scenes/scene4-nested-views';
import {ThemeToggle} from "../Lights";

function createViewDemoPlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [
      corePlugin(),
      chartPlugin(),
      diagramPlugin({ diagrams: ['cf-overview-2'] }),
    ],
  };
}

type ChartProgressIndicatorProps = {
  scrollStageRef: RefObject<ScrollStageHandle | null>;
  polarity: ThemePolarity;
};

function ChartProgressIndicator({ scrollStageRef, polarity }: ChartProgressIndicatorProps): JSX.Element {
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
      theme={polarity === 'light' ? 'light' : 'dark'}
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

export default function ViewDemoPage(): JSX.Element {
  const { plugins } = useMemo(() => createViewDemoPlugins(), []);
  const scrollStageRef = useRef<ScrollStageHandle | null>(null);

  const [family, setFamily] = useState<ThemeFamily>('enterprise');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');

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
        initialFamily={family}
        initialPolarity={polarity}
        persist
      />

      <SceneEngine plugins={plugins} themeFamily={family} themePolarity={polarity}>
        {/* Scene 1: Two standalone views (side-by-side) */}
        <StandaloneViewsScene />

        {/* Scene 2: Stack layout with three charts */}
        <StackLayoutScene />

        {/* Scene 3: Carousel cycling through three views */}
        <CarouselScene1 />
        <CarouselScene2 />
        <CarouselScene3 />

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
