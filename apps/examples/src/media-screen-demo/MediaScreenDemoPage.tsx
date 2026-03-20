// MediaScreen Demo — demonstrates all three MediaScreen source modes.
import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import {
  BackgroundLayer,
  EngineOverlayHost,
  InputCoordinator,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
  type ThemeFamily,
  type ThemePolarity,
  type ActiveTheme,
} from '@brewsite/core';
import { useDisplayCapture } from '@brewsite/screens';
import { createMediaScreenDemoPlugins } from './widgetSetup';
import { MediaScreenScene } from './scenes/mediaScreenScene';
import { CanvasAnimation } from './CanvasAnimation';
import { ThemeToggle } from '../Lights';
import { ExampleHeader, useFpsCap } from '../ExampleHeader';
import { StatsOverlay } from '../StatsOverlay';
import { useThemeCss } from '../hooks/useThemeCss';

// ── Display capture controls (must be inside SceneEngine for hook access) ────

function DisplayCaptureControls(): JSX.Element {
  const { startCapture, stopCapture, isCapturing, error } = useDisplayCapture(
    'display-demo',
    { displaySurface: 'browser', frameRate: 30 },
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 32,
        right: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        zIndex: 10,
      }}
    >
      {!isCapturing ? (
        <button
          type="button"
          onClick={() => void startCapture()}
          className="ex-btn-primary"
        >
          Start Screen Capture
        </button>
      ) : (
        <button
          type="button"
          onClick={stopCapture}
          className="ex-btn-muted"
        >
          Stop Capture
        </button>
      )}
      {error && (
        <div className="ex-error">
          {error.message}
        </div>
      )}
    </div>
  );
}

// ── Title overlay ────────────────────────────────────────────────────────────

function TitleOverlay(): JSX.Element {
  return (
    <div className="ex-title-overlay">
      <h1 className="ex-title-overlay__heading">
        MediaScreen Demo
      </h1>
      <p className="ex-title-overlay__subtitle">
        @brewsite/screens
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MediaScreenDemoPage(): JSX.Element {
  const { plugins } = useMemo(() => createMediaScreenDemoPlugins(), []);

  const [family, setFamily] = useState<ThemeFamily>('darkGlass');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');
  const theme = useMemo((): ActiveTheme => ({ family, polarity }), [family, polarity]);
  const fpsCap = useFpsCap();
  useThemeCss(family, polarity);

  return (
    <div className="ex-page">
      <ExampleHeader>
        <ThemeToggle
          onPolarityChange={setPolarity}
          onFamilyChange={setFamily}
          persist
          style={{position: 'static', zIndex: 'auto'}}
        />
      </ExampleHeader>
      <SceneEngine plugins={plugins} theme={theme} timingProfile={{ fpsCap }}>
        {/* Scene declaration */}
        <MediaScreenScene />

        {/* Canvas + scroll layout */}
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={100}>
          <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <EngineOverlayHost passthroughPointerEvents />
          <InputCoordinator inertiaSensitivity={0.012} inertiaDecay={0.85} />
        </ScrollStage>

        {/* Hidden canvas for Panel 2 — stream registered via captureCanvasStream */}
        <CanvasAnimation />

        {/* HTML overlays — positioned over the 3D canvas */}
        <TitleOverlay />
        <DisplayCaptureControls />
        <StatsOverlay />
      </SceneEngine>
    </div>
  );
}
