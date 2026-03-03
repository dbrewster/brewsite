import { useState, useMemo } from 'react';
import type { JSX } from 'react';
import {
  EngineProvider,
  EngineInputRegion,
  SceneCanvas,
  EngineOverlayHost,
  useSceneEngineContext,
} from '@brewsite/core';
import { createWebsitePlugins } from '../widgetSetup';
import { websiteFlowScenes } from '../scenes/websiteFlow';
import { NavMenu } from './nav/NavMenu';
import { isMobile } from '../utils/viewport';

const MANIFEST_URL = '/scene-manifest.json';

/** Inner layout — must live inside EngineProvider to access engine context. */
function WebsiteLayout({
  loadError,
}: {
  loadError: Error | null;
}): JSX.Element {
  const engine = useSceneEngineContext();
  const isLoading = engine.frameState.tickIndex < 0;

  return (
    <div style={{ position: 'relative' }}>
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
      <EngineInputRegion>
        <SceneCanvas style={{ width: '100%', height: '100%' }} />
        <EngineOverlayHost />
      </EngineInputRegion>
    </div>
  );
}

export default function LandingPage(): JSX.Element {
  const [loadError, setLoadError] = useState<Error | null>(null);

  // Stable plugin array — useMemo ensures it never recreates between renders
  const plugins = useMemo(() => createWebsitePlugins(MANIFEST_URL), []);

  return (
    <EngineProvider
      id="website-flow-player"
      manifestUrl={MANIFEST_URL}
      plugins={plugins}
      quality={isMobile ? 'balanced' : 'high'}
      pixelsPerScene={1400}
      onError={(err) => {
        setLoadError(err);
        console.error('[WebsiteFlow] Engine error:', err);
      }}
      onWidgetError={(widgetId, err) => {
        console.error(`[WebsiteFlow] Widget "${widgetId}" error:`, err);
      }}
      onManifestError={(err) => {
        console.error('[WebsiteFlow] Manifest load failed:', err);
      }}
      onCompileWarning={(warnings) => {
        warnings.forEach((w) => console.warn('[WebsiteFlow] Compile warning:', w));
      }}
    >
      {websiteFlowScenes}
      <NavMenu />
      <WebsiteLayout loadError={loadError} />
    </EngineProvider>
  );
}
