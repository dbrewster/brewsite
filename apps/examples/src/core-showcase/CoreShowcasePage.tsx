// Core Showcase — demonstrates @brewsite/core architecture and DSL features.
// Canvas fills the full viewport. TopChrome and BottomChrome are fixed overlays
// outside the canvas but inside SceneEngine (so they can use engine hooks).
import type {JSX} from 'react';
import { useMemo, useRef, useState } from 'react';
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
import { ChartTooltipHost } from '@brewsite/charts';
import { createCoreShowcasePlugins } from './widgetSetup';
import {ChartProgressIndicator, ThemeToggle} from '../Lights';
import {ExampleHeader, useFpsCap} from '../ExampleHeader';
import {StatsOverlay} from '../StatsOverlay';
import { TopChrome, BottomChrome } from './overlays';
import { useThemeCss } from '../hooks/useThemeCss';
import {
  HeroScene,
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
import {OverviewScene} from "./overviewScene";

export default function CoreShowcasePage(): JSX.Element {
  const { plugins } = useMemo(() => createCoreShowcasePlugins(), []);

  const [family, setFamily] = useState<ThemeFamily>('darkGlass');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');
  const theme = useMemo((): ActiveTheme => ({ family, polarity }), [family, polarity]);
  const scrollStageRef = useRef<ScrollStageHandle | null>(null);
  const fpsCap = useFpsCap();
  useThemeCss(family, polarity);

  return (
    <div className="ex-page">
      <ExampleHeader>
        <ThemeToggle
          onPolarityChange={setPolarity}
          onFamilyChange={setFamily}
          persist
          style={{position: 'static', zIndex: 'auto'}}
        />
      </ExampleHeader>
      <SceneEngine plugins={plugins} theme={theme} timingProfile={{ fpsCap }}>

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
        <TopChrome />
        <BottomChrome />

        <StatsOverlay />
      </SceneEngine>
    </div>
  );
}
