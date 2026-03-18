// Input Options Showcase — demonstrates every InputController / Action /
// PointerMap / WheelMap / PinchMap / KeyMap option available in BrewSite.
import { type JSX, useCallback, useMemo, useRef, useState } from 'react';
import {
  InputCoordinator,
  BackgroundLayer,
  corePlugin,
  EngineARContainer,
  EngineOverlayHost,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
  TimelineWidget,
  useSceneEngineContext,
  type ScrollStageHandle,
  type ThemeFamily,
  type ThemePolarity,
  type ActiveTheme,
  type WidgetPlugin,
} from '@brewsite/core';
import { chartPlugin } from '@brewsite/charts';
import { texturesPlugin } from '@brewsite/textures';
import { ThemeToggle } from '../Lights';
import { themesPlugin } from '@brewsite/themes';

import { WelcomeScene } from './scenes/scene1-welcome';
import { CameraControlsScene } from './scenes/scene2-camera-controls';
import { SceneNavAScene, SceneNavBScene } from './scenes/scene3-scene-navigation';
import { RingCarouselScene } from './scenes/scene4-ring-carousel';
import { LinearCarouselScene } from './scenes/scene5-linear-carousel';
import { ScrollableTextScene } from './scenes/scene6-scrollable-text';
import { AllMapsScene } from './scenes/scene7-all-maps';
import {diagramPlugin} from "@brewsite/diagram";

// ─── Plugin factory (outside component for stable reference) ──────────────────

function createPlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [
      corePlugin(),
      chartPlugin(),
      diagramPlugin(),
      texturesPlugin(),
      themesPlugin(),
      ]
  };
}

// ─── Timeline bar (must live inside SceneEngine so it can access the engine context) ─

interface TimelineBarProps {
  scrollStageRef: React.RefObject<ScrollStageHandle | null>;
  polarity: ThemePolarity;
}

function InputTimelineBar({ scrollStageRef, polarity }: TimelineBarProps): JSX.Element {
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
      thickness={40}
      majorTicks="scene"
      minorTicksPerScene={5}
      showSceneLabels
      showProgress
      scrubEnabled
      onSeek={handleSeek}
      style={{ zIndex: 20, left: 0, right: 0, bottom: 0 }}
    />
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function InputShowcasePage(): JSX.Element {
  const { plugins } = useMemo(() => createPlugins(), []);
  const scrollStageRef = useRef<ScrollStageHandle | null>(null);

  const [family, setFamily] = useState<ThemeFamily>('darkGlass');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');

  const theme = useMemo((): ActiveTheme => ({ family, polarity }), [family, polarity]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexFlow: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: polarity === 'light'
          ? 'radial-gradient(circle at 50% 0%, #eef2f8 0%, #d8dfe8 42%, #c8d0da 72%, #d4d8e0 100%)'
          : 'radial-gradient(circle at 50% 0%, #0a1830 0%, #04091a 42%, #020610 72%, #010408 100%)',
      }}
    >
      <ThemeToggle
        onPolarityChange={setPolarity}
        onFamilyChange={setFamily}
        persist
      />

      <SceneEngine
        plugins={plugins}
        theme={theme}
      >
        {/* ── Scene declarations ───────────────────────────────────────────── */}
        <WelcomeScene />
        <CameraControlsScene />
        <SceneNavAScene />
        <SceneNavBScene />
        <RingCarouselScene />
        <LinearCarouselScene />
        <ScrollableTextScene />
        <AllMapsScene />

        {/* ── Canvas layout ────────────────────────────────────────────────── */}
        <ScrollStage
          ref={scrollStageRef}
          scrollHeightMode="scene-count"
          pixelsPerScene={600}
        >
          <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width">
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1, top: '300px', height: '100%' }} />
            {/*
              passthroughPointerEvents makes the overlay container pointer-events:none
              so pointer/wheel/click events pass through to the canvas where
              ActionInputController is listening. Individual TextBox content opts
              back in with pointerEvents:'auto' on its inner elements.
            */}
            <EngineOverlayHost passthroughPointerEvents />
          </EngineARContainer>
          <InputCoordinator inertiaSensitivity={0.012} inertiaDecay={0.85} />
        </ScrollStage>

        {/* ── Timeline scrubber ────────────────────────────────────────────── */}
        <InputTimelineBar scrollStageRef={scrollStageRef} polarity={polarity} />
      </SceneEngine>
    </div>
  );
}
