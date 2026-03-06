// Page component for the whiteboard architecture slide deck.
import type { JSX } from 'react';
import { useMemo } from 'react';
import {
  EngineARContainer,
  EngineInputRegion,
  EngineOverlayHost,
  EngineProvider,
  SceneCanvas,
} from '@brewsite/core';
import { createWhiteboardArchPlugins } from './widgetSetup';
import { whiteboardArchScenes } from './flow';

const MANIFEST_URL = '/scene-manifest.json';

const scenes = whiteboardArchScenes;

export default function WhiteboardArchPage(): JSX.Element {
  const { plugins } = useMemo(() => createWhiteboardArchPlugins(), []);

  return (
    <div style={{ background: '#0d1117', minHeight: '100vh' }}>
      <EngineProvider
        manifestUrl={MANIFEST_URL}
        plugins={plugins}
        pixelsPerScene={1400}
        inputModePolicy="prefer-scroll"
      >
        {scenes}
        <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width" referenceWidth={1920}>
          <EngineInputRegion>
            <SceneCanvas />
            <EngineOverlayHost />
          </EngineInputRegion>
        </EngineARContainer>
      </EngineProvider>
    </div>
  );
}
