// ModelShowcasePage.tsx — Model showcase example page.

import { type JSX, useRef } from 'react';
import { useMemo } from 'react';
import {
  BackgroundLayer,
  corePlugin,
  EngineOverlayHost,
  InputCoordinator,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
  type ScrollStageHandle,
} from '@brewsite/core';
import { LabelItem } from '@brewsite/model';
import { modelShowcasePlugin } from './widgetSetup';
import { SceneNavigator } from './SceneNavigator';
import { Scene01Intro } from './scenes/scene01_intro';
import { Scene02Animation } from './scenes/scene02_animation';
import { Scene03Labels } from './scenes/scene03_labels';
import { Scene04View } from './scenes/scene04_view';
import { Scene05Carousel } from './scenes/scene05_carousel';
import { ChartProgressIndicator } from '../Lights';

export default function ModelShowcasePage(): JSX.Element {
  const plugins = useMemo(() => [corePlugin(), modelShowcasePlugin], []);
  const scrollStageRef = useRef<ScrollStageHandle | null>(null);

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#030510' }}>
      <SceneEngine plugins={plugins}>

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
          <InputCoordinator inertiaSensitivity={0.010} inertiaDecay={0.82} />
        </ScrollStage>
        <ChartProgressIndicator scrollStageRef={scrollStageRef} polarity="light" />

      </SceneEngine>
    </div>
  );
}
