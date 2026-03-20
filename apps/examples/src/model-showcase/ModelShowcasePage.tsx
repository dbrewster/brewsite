// ModelShowcasePage.tsx — Model showcase example page.

import { type JSX, useRef, useMemo, useState } from 'react';
import {
  BackgroundLayer,
  corePlugin,
  EngineOverlayHost,
  InputCoordinator,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
  type ScrollStageHandle,
  type ThemeFamily,
  type ThemePolarity,
  type ActiveTheme,
} from '@brewsite/core';
import { LabelItem } from '@brewsite/model';
import { modelShowcasePlugin } from './widgetSetup';
import { SceneNavigator } from './SceneNavigator';
import { Scene01Intro } from './scenes/scene01_intro';
import { Scene02Animation } from './scenes/scene02_animation';
import { Scene03Labels } from './scenes/scene03_labels';
import { Scene04View } from './scenes/scene04_view';
import { Scene05Carousel } from './scenes/scene05_carousel';
import { ChartProgressIndicator, ThemeToggle } from '../Lights';
import { ExampleHeader, useFpsCap } from '../ExampleHeader';
import { StatsOverlay } from '../StatsOverlay';

export default function ModelShowcasePage(): JSX.Element {
  const plugins = useMemo(() => [corePlugin(), modelShowcasePlugin], []);
  const scrollStageRef = useRef<ScrollStageHandle | null>(null);

  const [family, setFamily] = useState<ThemeFamily>('darkGlass');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');
  const theme = useMemo((): ActiveTheme => ({ family, polarity }), [family, polarity]);
  const fpsCap = useFpsCap();

  return (
    <div style={{ position: 'relative', display: 'flex', flexFlow: 'column', height: '100vh', overflow: 'hidden', background: '#030510' }}>
      <ExampleHeader>
        <ThemeToggle
          onPolarityChange={setPolarity}
          onFamilyChange={setFamily}
          persist
          style={{position: 'static', zIndex: 'auto'}}
        />
      </ExampleHeader>
      <SceneEngine plugins={plugins} theme={theme} timingProfile={{ fpsCap }}>

        {/* Scene declarations */}
        <Scene01Intro />
        <Scene02Animation />
        <Scene03Labels />
        <Scene04View />
        <Scene05Carousel />

        {/* Canvas + scroll */}
        <ScrollStage ref={scrollStageRef} scrollHeightMode="scene-count" pixelsPerScene={1000}>
          <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <EngineOverlayHost>
            <LabelItem label={{ id: 'head-label', text: 'Sensor Array', targetPartId: 'Head' }} />
            <SceneNavigator />
          </EngineOverlayHost>
          <InputCoordinator inertiaSensitivity={0.012} inertiaDecay={0.85} />
        </ScrollStage>
        <ChartProgressIndicator scrollStageRef={scrollStageRef} polarity="light" />
        <StatsOverlay />
      </SceneEngine>
    </div>
  );
}
