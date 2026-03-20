// Core Showcase — demonstrates @brewsite/core architecture and DSL features.
// Canvas fills the full viewport. TopChrome and BottomChrome are fixed overlays
// outside the canvas but inside SceneEngine (so they can use engine hooks).
import {JSX, useCallback, useRef} from 'react';
import { useMemo, useState } from 'react';
import {
  InputCoordinator,
  BackgroundLayer,
  EngineOverlayHost,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
  type ThemeFamily,
  type ThemePolarity,
  type ActiveTheme, type ScrollStageHandle,
} from '@brewsite/core';
import { RendererStats } from '@brewsite/core/player/devtools';
import { ChartTooltipHost } from '@brewsite/charts';
import { createCoreShowcasePlugins } from './widgetSetup';
import {ChartProgressIndicator, ThemeToggle} from '../Lights';
import { TopChrome, BottomChrome } from './overlays';
import {
  HeroScene,
  OverviewScene,
  SceneDslScene,
  SceneTransitionScene,
  CompilerScene,
  CameraWorldScene,
  CameraOrbitScene,
  LightingSoftScene,
  LightingDramaticScene,
  ChartAScene,
  ChartBScene,
  InputScene,
  ThemingScene,
  SummaryScene,
} from './scenes';

export default function CoreShowcasePage(): JSX.Element {
  const { plugins } = useMemo(() => createCoreShowcasePlugins(), []);

  const [family, setFamily] = useState<ThemeFamily>('darkGlass');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');
  const theme = useMemo((): ActiveTheme => ({ family, polarity }), [family, polarity]);
  const scrollStageRef = useRef<ScrollStageHandle | null>(null);
  const [showStats, setShowStats] = useState(false);
  const toggleStats = useCallback(() => setShowStats((v) => !v), []);

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden', background: '#030510' }}>
      <ThemeToggle
        onPolarityChange={setPolarity}
        onFamilyChange={setFamily}
        persist
      />
      <SceneEngine plugins={plugins} theme={theme}>

        {/* ── Scene declarations ──────────────────────────────────────────── */}
        {/* Act 1: Introduction */}
        <HeroScene />
        <OverviewScene />

        {/* Act 2: Scene Authoring */}
        <SceneDslScene />
        <SceneTransitionScene />

        {/* Act 3: Compiler Pipeline */}
        <CompilerScene />

        {/* Act 4: Camera System */}
        <CameraWorldScene />
        <CameraOrbitScene />

        {/* Act 5: Lighting & Environment */}
        <LightingSoftScene />
        <LightingDramaticScene />

        {/* Act 6: Charts */}
        <ChartAScene />
        <ChartBScene />

        {/* Act 7: Input & Interaction */}
        <InputScene />

        {/* Act 8: Theming */}
        <ThemingScene />

        {/* Act 9: Summary */}
        <SummaryScene />

        {/* ── Canvas + scroll ─────────────────────────────────────────────── */}
        {/*
          No EngineARContainer — the canvas fills the full viewport.
          ScrollStage creates the scroll spacer; SceneCanvas fills inset:0.
          EngineOverlayHost layers TextBox and React HTML over the canvas.
        */}
        <ScrollStage ref={scrollStageRef} scrollHeightMode="scene-count" pixelsPerScene={1200}>
          <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <EngineOverlayHost passthroughPointerEvents>
            <ChartTooltipHost />
          </EngineOverlayHost>
          <InputCoordinator inertiaSensitivity={0.012} inertiaDecay={0.85} />
          <ChartProgressIndicator scrollStageRef={scrollStageRef} polarity={polarity}/>
        </ScrollStage>

        {/* ── Overlay chrome ──────────────────────────────────────────────── */}
        {/*
          TopChrome and BottomChrome use useCurrentScene() which requires a
          SceneEngine ancestor. They are rendered inside SceneEngine but outside
          ScrollStage, so they float fixed over everything using position:fixed.
        */}
        <TopChrome />
        <BottomChrome />

        {/* ── Renderer stats (toggle with button) ─────────────────────────── */}
        {showStats && <RendererStats position="top-left" />}
      </SceneEngine>

      {/* Stats toggle — outside SceneEngine so it's always clickable */}
      <button
        onClick={toggleStats}
        style={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 100000,
          background: showStats ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)',
          color: showStats ? '#0f0' : '#888',
          border: '1px solid ' + (showStats ? '#0f04' : '#fff2'),
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 10,
          fontFamily: 'monospace',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        {showStats ? '● STATS' : '○ Stats'}
      </button>
    </div>
  );
}
