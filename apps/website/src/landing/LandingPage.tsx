import { useState, useMemo, useEffect } from 'react';
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
import { prefersReducedMotion } from '../utils/reducedMotion';
import { useSectionTelemetry } from '../telemetry/useSectionTelemetry';
import { emit } from '../telemetry/emit';

const MANIFEST_URL = '/scene-manifest.json';

/** Emit reduced-motion and apply body class on mount. */
function useReducedMotionSetup(): void {
  useEffect(() => {
    if (prefersReducedMotion()) {
      document.documentElement.classList.add('bw-reduced-motion');
      emit('reduced_motion_detected', {});
    }
    return () => {
      document.documentElement.classList.remove('bw-reduced-motion');
    };
  }, []);
}

/** HTML fallback shell rendered when the engine fails hard. */
function FallbackShell({ error }: { error: Error }): JSX.Element {
  return (
    <div
      role="alert"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        background: '#0a0a0f',
        color: '#c9d1d9',
        fontFamily: 'JetBrains Mono, system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 16, color: '#e6edf3' }}>
        BrewSite
      </h1>
      <p style={{ fontSize: 14, maxWidth: 480, lineHeight: 1.6, marginBottom: 24 }}>
        React toolkit for technical storytelling. Author diagrams, models, charts,
        screens, and slides in JSX.
      </p>
      <code
        style={{
          display: 'block',
          padding: '12px 24px',
          background: '#161b22',
          borderRadius: 8,
          fontSize: 14,
          color: '#58a6ff',
          marginBottom: 16,
        }}
      >
        npm create brewsite
      </code>
      <p style={{ fontSize: 11, color: '#8b949e', marginTop: 16 }}>
        Scene engine unavailable: {error.message}
      </p>
    </div>
  );
}

/** Inner layout — must live inside SceneEngine to access engine context. */
function WebsiteLayout({
  loadError,
}: {
  loadError: Error | null;
}): JSX.Element {
  const engine = useSceneEngineContext();
  const isLoading = engine.frameState.tickIndex < 0;

  // Wire telemetry for section views
  useSectionTelemetry();

  if (loadError) {
    return <FallbackShell error={loadError} />;
  }

  return (
    <ScrollStage pixelsPerScene={1400} style={{height: '100vh'}}>
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

  // Apply reduced-motion class and emit telemetry on mount
  useReducedMotionSetup();

  // Stable plugin array — useMemo ensures it never recreates between renders
  const plugins = useMemo(() => createWebsitePlugins(MANIFEST_URL), []);

  return (
    <SceneEngine
      id="website-flow-player"
      plugins={plugins}
      timingProfile={{ qualityPreset: isMobile ? 'balanced' : 'high' }}
      onError={(err) => {
        setLoadError(err);
        emit('webgl_error', { message: err.message });
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
