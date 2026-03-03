import { useMemo } from 'react';
import type { JSX } from 'react';
import {
  EngineProvider,
  EngineInputRegion,
  EngineOverlayHost,
  SceneCanvas,
} from '@brewsite/core';
import { createArchitecturePlugins } from './widgetSetup';
import { architectureFlowScenes } from './flow';

const MANIFEST_URL = '/scene-manifest.json';

export default function ArchitecturePage(): JSX.Element {
  const { plugins } = useMemo(() => createArchitecturePlugins(), []);

  return (
    <div style={{ background: '#030508', minHeight: '100vh' }}>
      <EngineProvider manifestUrl={MANIFEST_URL} plugins={plugins} pixelsPerScene={1400}>
        {architectureFlowScenes}
        <EngineInputRegion>
          <SceneCanvas />
          <EngineOverlayHost />
        </EngineInputRegion>
      </EngineProvider>
    </div>
  );
}
