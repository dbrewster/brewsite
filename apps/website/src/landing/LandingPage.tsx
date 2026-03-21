import { useState, useMemo } from 'react';
import type { JSX } from 'react';
import {
  InputCoordinator,
  BackgroundLayer,
  EngineARContainer,
  EngineOverlayHost,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
  useSceneEngineContext,
} from '@brewsite/core';
import { createWebsitePlugins } from '../widgetSetup';
import { websiteFlowScenes } from '../scenes/websiteFlow';
import { NavMenu } from './nav/NavMenu';
import { isMobile } from '../utils/viewport';

const MANIFEST_URL = '/scene-manifest.json';

/** Inner layout — must live inside SceneEngine to access engine context. */
function WebsiteLayout({
  loadError,
}: {
  loadError: Error | null;
}): JSX.Element {
  const engine = useSceneEngineContext();
  const isLoading = engine.frameState.tickIndex < 0;

  return (
    <ScrollStage pixelsPerScene={1400} style={{height: '100vh'}}>
      {loadError && (
        <div role="alert" style={{ position: 'absolute', inset: 0, zIndex: 100, padding: 16 }}>
          Scene engine error: {loadError.message}
        </div>
      )}
      {isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 50,
          display: 'grid',
          placeItems: 'center',
          color: '#8b949e',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          pointerEvents: 'none',
        }}>
          Loading BrewSite flow…
        </div>
      )}
      <EngineARContainer aspectRatio={9 / 16} scaleMode="fit-height">
        <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
        <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
        <EngineOverlayHost passthroughPointerEvents />
      </EngineARContainer>
      <InputCoordinator />
    </ScrollStage>
  );
}

export default function LandingPage(): JSX.Element {
  const [loadError, setLoadError] = useState<Error | null>(null);

  // Stable plugin array — useMemo ensures it never recreates between renders
  const plugins = useMemo(() => createWebsitePlugins(MANIFEST_URL), []);

  return (
    <SceneEngine
      id="website-flow-player"
      plugins={plugins}
      timingProfile={{ qualityPreset: isMobile ? 'balanced' : 'high' }}
      onError={(err) => {
        setLoadError(err);
        console.error('[WebsiteFlow] Engine error:', err);
      }}
      onWidgetError={(widgetId, err) => {
        console.error(`[WebsiteFlow] Widget "${widgetId}" error:`, err);
      }}
      onCompileWarning={(warnings) => {
        warnings.forEach((w) => console.warn('[WebsiteFlow] Compile warning:', w));
      }}
    >
      {websiteFlowScenes}
      <NavMenu />
      <WebsiteLayout loadError={loadError} />
    </SceneEngine>
  );
}
