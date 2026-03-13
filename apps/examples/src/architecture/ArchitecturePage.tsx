import type {JSX} from 'react';
import {useMemo} from 'react';
import {
  InputCoordinator,
  BackgroundLayer,
  EngineARContainer,
  EngineOverlayHost,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
} from '@brewsite/core';
import {createArchitecturePlugins} from './widgetSetup';
import {architectureFlowScenes} from './flow';

export default function ArchitecturePage(): JSX.Element {
  const { plugins, theme } = useMemo(() => createArchitecturePlugins(), []);

  return (
    <div style={{ background: '#030508', height: '100vh', overflow: 'hidden' }}>
      <SceneEngine plugins={plugins} theme={theme}>
        {architectureFlowScenes}
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1400}>
          <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width" referenceWidth={1920}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost />
          </EngineARContainer>
          <InputCoordinator />
        </ScrollStage>
      </SceneEngine>
    </div>
  );
}
