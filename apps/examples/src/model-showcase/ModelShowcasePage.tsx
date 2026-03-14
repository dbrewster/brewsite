// ModelShowcasePage.tsx — Minimal model test: one scene, one robot, no scroll.

import type { JSX } from 'react';
import { useMemo } from 'react';
import {
  Ambient,
  Background,
  Camera,
  Directional,
  Lighting,
  Scene,
  BackgroundLayer,
  corePlugin,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
  InputCoordinator,
} from '@brewsite/core';
import { Model } from '@brewsite/model';
import { modelShowcasePlugin } from './widgetSetup';

export default function ModelShowcasePage(): JSX.Element {
  const plugins = useMemo(() => [corePlugin(), modelShowcasePlugin], []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#030510' }}>
      <SceneEngine plugins={plugins}>

        <Scene id="test">
          <Camera mode="world" position={[0, 1.2, 4.5]} target={[0, 1.0, 0]} fov={45} />
          <Lighting intensityScale={1.1}>
            <Ambient intensity={0.7} color="#d0e4ff" />
            <Directional intensity={1.0} color="#ffffff" position={[3, 8, 6]} />
          </Lighting>
          <Background color="#1a1a2e" />
          <Model
            type="Robot"
            id="robot"
            scale={0.06}
            x={0.15} y={0} w={0.7} h={1}
            opacity={1}
            z={0}
          />
        </Scene>

        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1200}>
          <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <InputCoordinator inertiaSensitivity={0.010} inertiaDecay={0.82} />
        </ScrollStage>

      </SceneEngine>
    </div>
  );
}
