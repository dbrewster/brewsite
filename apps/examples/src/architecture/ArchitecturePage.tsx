import type {JSX} from 'react';
import {useMemo} from 'react';
import {EngineInputRegion, EngineOverlayHost, EngineProvider, SceneCanvas,} from '@brewsite/core';
import {createArchitecturePlugins} from './widgetSetup';
import {architectureFlowScenes} from './flow';

const MANIFEST_URL = '/scene-manifest.json';

export default function ArchitecturePage(): JSX.Element {
  const { plugins } = useMemo(() => createArchitecturePlugins(), []);

  return (
    <div style={{ background: '#030508', minHeight: '100vh' }}>
      <EngineProvider manifestUrl={MANIFEST_URL} plugins={plugins} pixelsPerScene={1400} inputModePolicy="prefer-scroll">
        {architectureFlowScenes}
        <EngineInputRegion>
          <SceneCanvas />
          <EngineOverlayHost />
        </EngineInputRegion>
      </EngineProvider>
    </div>
  );
}
