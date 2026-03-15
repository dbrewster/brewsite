// Core Showcase — demonstrates @brewsite/core architecture and DSL features.
// Canvas fills the full viewport. TopChrome and BottomChrome are fixed overlays
// outside the canvas but inside SceneEngine (so they can use engine hooks).
import type { JSX } from 'react';
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
  type ActiveTheme,
} from '@brewsite/core';
import { ChartTooltipHost } from '@brewsite/charts';
import { createCoreShowcasePlugins } from './widgetSetup';
import { ThemeToggle } from '../Lights';
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
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1200}>
          <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <EngineOverlayHost passthroughPointerEvents>
            <ChartTooltipHost />
          </EngineOverlayHost>
          <InputCoordinator inertiaSensitivity={0.008} inertiaDecay={0.85} />
        </ScrollStage>

        {/* ── Overlay chrome ──────────────────────────────────────────────── */}
        {/*
          TopChrome and BottomChrome use useCurrentScene() which requires a
          SceneEngine ancestor. They are rendered inside SceneEngine but outside
          ScrollStage, so they float fixed over everything using position:fixed.
        */}
        <TopChrome />
        <BottomChrome />
      </SceneEngine>
    </div>
  );
}
