// Page component for the whiteboard architecture slide deck.
import type { JSX } from 'react';
import { useMemo } from 'react';
import {
  BackgroundLayer,
  EngineARContainer,
  EngineOverlayHost,
  KeyboardInput,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
} from '@brewsite/core';
import { createWhiteboardArchPlugins } from './widgetSetup';
import { whiteboardArchScenes } from './flow';

const MANIFEST_URL = '/scene-manifest.json';

const scenes = whiteboardArchScenes;

export default function WhiteboardArchPage(): JSX.Element {
  const { plugins } = useMemo(() => createWhiteboardArchPlugins(), []);

  return (
    <div style={{ background: '#0d1117', height: '100vh', overflow: 'hidden' }}>
      <SceneEngine plugins={plugins}>
        {scenes}
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1400}>
          <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width" referenceWidth={1920}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost />
          </EngineARContainer>
          <KeyboardInput />
        </ScrollStage>
      </SceneEngine>
    </div>
  );
}
